import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TaskStatusService } from './task-status.service';
import { selectTaskEntities } from './store/task.selectors';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { taskSharedCrudMetaReducer } from '../../root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer';
import {
  createBaseState,
  createMockTask,
} from '../../root-store/meta/task-shared-meta-reducers/test-utils';
import { RootState } from '../../root-store/root-state';
import { Task } from './task.model';
import { Action } from '@ngrx/store';

describe('TaskStatusService', () => {
  let service: TaskStatusService;
  let store: MockStore;
  let state: RootState;

  beforeEach(() => {
    const tasks = [
      createMockTask({ id: 'parent', subTaskIds: ['one', 'two', 'missing'] }),
      createMockTask({ id: 'one', parentId: 'parent' }),
      createMockTask({ id: 'two', parentId: 'parent', isDone: true, doneOn: 123 }),
      createMockTask({ id: 'reverse-only', parentId: 'parent' }),
      createMockTask({ id: 'unrelated' }),
    ];
    state = createBaseState();
    state = {
      ...state,
      tasks: {
        ...state.tasks,
        ids: tasks.map((t) => t.id),
        entities: Object.fromEntries(tasks.map((t) => [t.id, t])),
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [{ selector: selectTaskEntities, value: state.tasks.entities }],
        }),
      ],
    });
    store = TestBed.inject(MockStore);
    service = TestBed.inject(TaskStatusService);
    const reducer = taskSharedCrudMetaReducer((s) => s);
    const dispatch = spyOn(store, 'dispatch') as jasmine.Spy<(action: Action) => void>;
    dispatch.and.callFake((action) => {
      state = reducer(state, action) as RootState;
      // 模拟真实 Store：每次派发后刷新任务快照，后续取消完成必须读取最新来源标记。
      store.overrideSelector(selectTaskEntities, state.tasks.entities);
      store.refreshState();
    });
  });

  it('completes every child and the parent through replayable ordinary updates', fakeAsync(() => {
    service.complete('parent');
    tick();
    for (const id of ['parent', 'one', 'two', 'reverse-only']) {
      expect(state.tasks.entities[id]!.isDone).toBeTrue();
      expect(state.tasks.entities[id]!.isAbandoned).toBeFalse();
      if (id !== 'two')
        expect(state.tasks.entities[id]!.doneOn).toBe(
          state.tasks.entities.parent!.doneOn,
        );
    }
    expect(state.tasks.entities.unrelated!.isDone).toBeFalse();
    expect(state.tasks.entities.two!.doneOn).toBe(123);
    expect(store.dispatch).toHaveBeenCalledTimes(3);
  }));

  it('abandons a parent and every child, including previously completed children', fakeAsync(() => {
    service.abandon('parent');
    tick();
    for (const id of ['parent', 'one', 'two', 'reverse-only']) {
      expect(state.tasks.entities[id]!.isAbandoned).toBeTrue();
      expect(state.tasks.entities[id]!.isDone).toBeTrue();
    }
    expect(state.tasks.entities.unrelated!.isAbandoned).toBeFalse();
  }));

  it('取消父任务完成时仅恢复联动完成的子任务，保留手动完成的子任务', fakeAsync(() => {
    // 即使独立完成与联动完成恰好发生在同一毫秒，也必须依据来源区分。
    spyOn(Date, 'now').and.returnValue(123);
    service.complete('parent');
    tick();
    service.reopen('parent');
    tick();

    for (const id of ['parent', 'one', 'reverse-only']) {
      expect(state.tasks.entities[id]!.isDone).toBeFalse();
      expect(state.tasks.entities[id]!.doneOn).toBeUndefined();
      expect(state.tasks.entities[id]!.doneByParentId).toBeNull();
    }
    expect(state.tasks.entities.two!.isDone).toBeTrue();
    expect(state.tasks.entities.two!.doneOn).toBe(123);
    expect(state.tasks.entities.unrelated!.isDone).toBeFalse();
  }));

  it('子任务取消后手动重新完成，不再随父任务取消完成', fakeAsync(() => {
    service.complete('parent');
    tick();
    service.reopen('one');
    tick();
    service.complete('one');
    tick();
    const manualDoneOn = state.tasks.entities.one!.doneOn;
    service.reopen('parent');
    tick();

    expect(state.tasks.entities.one!.isDone).toBeTrue();
    expect(state.tasks.entities.one!.doneByParentId).toBeNull();
    expect(state.tasks.entities.one!.doneOn).toBe(manualDoneOn);
    expect(state.tasks.entities['reverse-only']!.isDone).toBeFalse();
  }));

  it('因子任务全部完成而自动完成的父任务，反选后恢复全部直属子任务', fakeAsync(() => {
    service.complete('one');
    service.complete('reverse-only');
    store.dispatch(
      TaskSharedActions.updateTask({
        task: {
          id: 'parent',
          changes: { isDone: true, isDoneBySubTasks: true, doneOn: 456 },
        },
      }),
    );
    tick();
    // 自动完成来源必须在持久化后仍可使用，不能靠当前配置或完成时间推断。
    state = JSON.parse(JSON.stringify(state)) as RootState;
    store.overrideSelector(selectTaskEntities, state.tasks.entities);
    store.refreshState();
    service.reopen('parent');
    tick();

    for (const id of ['parent', 'one', 'two', 'reverse-only']) {
      expect(state.tasks.entities[id]!.isDone).toBeFalse();
      expect(state.tasks.entities[id]!.isAbandoned).toBeFalse();
      expect(state.tasks.entities[id]!.doneOn).toBeUndefined();
      expect(state.tasks.entities[id]!.isDoneBySubTasks).toBeFalse();
    }
    expect(state.tasks.entities.unrelated!.isDone).toBeFalse();
    // 切回手动完成父任务后，仍保留之前独立完成的子任务。
    service.complete('one');
    service.complete('parent');
    tick();
    service.reopen('parent');
    tick();
    expect(state.tasks.entities.one!.isDone).toBeTrue();
    expect(state.tasks.entities.two!.isDone).toBeFalse();
  }));

  it('自动完成父任务反选时也恢复已放弃的子任务，但不影响已移动的子任务', fakeAsync(() => {
    const anotherParent = createMockTask({ id: 'another-parent', subTaskIds: ['two'] });
    state = {
      ...state,
      tasks: {
        ...state.tasks,
        ids: [...state.tasks.ids, anotherParent.id],
        entities: { ...state.tasks.entities, [anotherParent.id]: anotherParent },
      },
    };
    service.abandon('one');
    service.complete('reverse-only');
    store.dispatch(
      TaskSharedActions.updateTask({
        task: { id: 'two', changes: { parentId: 'another-parent' } },
      }),
    );
    store.dispatch(
      TaskSharedActions.updateTask({
        task: { id: 'parent', changes: { isDone: true, isDoneBySubTasks: true } },
      }),
    );
    tick();
    service.reopen('parent');
    tick();

    expect(state.tasks.entities.one!.isDone).toBeFalse();
    expect(state.tasks.entities.one!.isAbandoned).toBeFalse();
    expect(state.tasks.entities['reverse-only']!.isDone).toBeFalse();
    expect(state.tasks.entities.two!.isDone).toBeTrue();
    expect(state.tasks.entities.two!.doneOn).toBe(123);
  }));

  it('反选自动完成父任务的一个子任务时，兄弟任务仍然保持完成', fakeAsync(() => {
    service.complete('one');
    store.dispatch(
      TaskSharedActions.updateTask({
        task: { id: 'parent', changes: { isDone: true, isDoneBySubTasks: true } },
      }),
    );
    tick();
    service.reopen('one');
    tick();

    expect(state.tasks.entities.one!.isDone).toBeFalse();
    expect(state.tasks.entities.two!.isDone).toBeTrue();
    expect(state.tasks.entities.parent!.isDone).toBeTrue();
  }));

  it('多次切换父任务时持续保留手动完成的子任务', fakeAsync(() => {
    for (let i = 0; i < 3; i++) {
      service.complete('parent');
      tick();
      expect(state.tasks.entities.one!.doneByParentId).toBe('parent');
      service.reopen('parent');
      tick();
      expect(state.tasks.entities.one!.isDone).toBeFalse();
      expect(state.tasks.entities.two!.isDone).toBeTrue();
      expect(state.tasks.entities.two!.doneOn).toBe(123);
    }
  }));

  it('旧任务没有联动来源记录时保留子任务完成状态，不按完成时间猜测', fakeAsync(() => {
    const legacyTasks = [
      createMockTask({
        id: 'legacy-parent',
        subTaskIds: ['legacy-child'],
        isDone: true,
        doneOn: 123,
        doneByParentId: undefined,
      }),
      createMockTask({
        id: 'legacy-child',
        parentId: 'legacy-parent',
        isDone: true,
        doneOn: 123,
        doneByParentId: undefined,
      }),
    ];
    state = {
      ...state,
      tasks: {
        ...state.tasks,
        ids: legacyTasks.map((task) => task.id),
        entities: Object.fromEntries(legacyTasks.map((task) => [task.id, task])),
      },
    };
    store.overrideSelector(selectTaskEntities, state.tasks.entities);
    store.refreshState();
    service.reopen('legacy-parent');
    tick();

    expect(state.tasks.entities['legacy-parent']!.isDone).toBeFalse();
    expect(state.tasks.entities['legacy-child']!.isDone).toBeTrue();
    expect(state.tasks.entities['legacy-child']!.doneOn).toBe(123);
  }));

  it('完成来源经过 JSON 保存及重新加载后仍可用于取消联动完成', fakeAsync(() => {
    service.complete('parent');
    tick();
    const actions = (store.dispatch as jasmine.Spy).calls
      .allArgs()
      .map(([action]) => action);
    const reducer = taskSharedCrudMetaReducer((s) => s);
    const originalTasks = [
      createMockTask({ id: 'parent', subTaskIds: ['one', 'two', 'missing'] }),
      createMockTask({ id: 'one', parentId: 'parent' }),
      createMockTask({ id: 'two', parentId: 'parent', isDone: true, doneOn: 123 }),
      createMockTask({ id: 'reverse-only', parentId: 'parent' }),
      createMockTask({ id: 'unrelated' }),
    ];
    let replayedState: RootState = {
      ...createBaseState(),
      tasks: {
        ...createBaseState().tasks,
        ids: originalTasks.map((task) => task.id),
        entities: Object.fromEntries(originalTasks.map((task) => [task.id, task])),
      },
    };
    // 从原始状态重放序列化操作，确保来源来自可持久化的载荷，而不是内存缓存。
    for (const action of actions) {
      const replayedAction = JSON.parse(JSON.stringify(action)) as Action;
      replayedState = reducer(replayedState, replayedAction) as RootState;
    }
    expect(replayedState.tasks.entities.one!.doneByParentId).toBe('parent');
    state = JSON.parse(JSON.stringify(replayedState)) as RootState;
    store.overrideSelector(selectTaskEntities, state.tasks.entities);
    store.refreshState();
    service.reopen('parent');
    tick();

    expect(state.tasks.entities.one!.isDone).toBeFalse();
    expect(state.tasks.entities['reverse-only']!.isDone).toBeFalse();
    expect(state.tasks.entities.two!.isDone).toBeTrue();
    const reopenAction = (store.dispatch as jasmine.Spy).calls.mostRecent()
      .args[0] as ReturnType<typeof TaskSharedActions.updateTask>;
    expect(
      JSON.parse(JSON.stringify(reopenAction)).task.changes.doneByParentId,
    ).toBeNull();
  }));

  it('abandons only the selected subtask', fakeAsync(() => {
    service.abandon('one');
    tick();
    expect(state.tasks.entities.one!.isAbandoned).toBeTrue();
    expect(state.tasks.entities.parent!.isDone).toBeFalse();
    expect(state.tasks.entities.two!.isAbandoned).toBeFalse();
  }));

  it('reopening clears abandonment and completion time without reopening siblings', fakeAsync(() => {
    const task: Task = {
      ...state.tasks.entities.one!,
      isDone: true,
      isAbandoned: true,
      doneOn: 123,
    };
    state = {
      ...state,
      tasks: { ...state.tasks, entities: { ...state.tasks.entities, one: task } },
    };
    service.reopen('one');
    tick();
    expect(state.tasks.entities.one!.isDone).toBeFalse();
    expect(state.tasks.entities.one!.isAbandoned).toBeFalse();
    expect(state.tasks.entities.one!.doneOn).toBeUndefined();
  }));

  it('取消父任务的放弃状态时，仍保留子任务的放弃状态', fakeAsync(() => {
    service.abandon('parent');
    tick();
    service.reopen('parent');
    tick();

    expect(state.tasks.entities.parent!.isDone).toBeFalse();
    expect(state.tasks.entities.parent!.isAbandoned).toBeFalse();
    for (const id of ['one', 'two', 'reverse-only']) {
      expect(state.tasks.entities[id]!.isDone).toBeTrue();
      expect(state.tasks.entities[id]!.isAbandoned).toBeTrue();
    }
  }));

  it('来源指向当前父任务但已移到其他父任务的子任务不会被反选', fakeAsync(() => {
    service.complete('parent');
    tick();
    const anotherParent = createMockTask({ id: 'another-parent', subTaskIds: ['one'] });
    state = {
      ...state,
      tasks: {
        ...state.tasks,
        ids: [...state.tasks.ids, anotherParent.id],
        entities: { ...state.tasks.entities, [anotherParent.id]: anotherParent },
      },
    };
    store.dispatch(
      TaskSharedActions.updateTask({
        task: { id: 'one', changes: { parentId: 'another-parent' } },
      }),
    );
    service.reopen('parent');
    tick();

    expect(state.tasks.entities.one!.isDone).toBeTrue();
    expect(state.tasks.entities['reverse-only']!.isDone).toBeFalse();
  }));

  it('ignores a deleted task', fakeAsync(() => {
    service.abandon('deleted');
    tick();
    expect(store.dispatch).not.toHaveBeenCalled();
  }));

  it('keeps completion metadata in the payload after a JSON round trip', fakeAsync(() => {
    service.abandon('parent');
    tick();
    const action = (store.dispatch as jasmine.Spy).calls.first().args[0] as ReturnType<
      typeof TaskSharedActions.updateTask
    >;
    const replay = JSON.parse(JSON.stringify(action)) as typeof action;
    expect(replay.task.changes.isDone).toBeTrue();
    expect(replay.task.changes.isAbandoned).toBeTrue();
    expect(replay.task.changes.doneOn).toEqual(jasmine.any(Number));
    expect(replay.meta.entityId).toBe(replay.task.id as string);
    expect(replay.meta.entityIds).toBeUndefined();
  }));

  it('handles a large parent without dropping child updates', fakeAsync(() => {
    const children = Array.from({ length: 100 }, (_, i) =>
      createMockTask({ id: `child-${i}`, parentId: 'large' }),
    );
    const parent = createMockTask({ id: 'large', subTaskIds: children.map((t) => t.id) });
    state = {
      ...state,
      tasks: {
        ...state.tasks,
        ids: [parent, ...children].map((t) => t.id),
        entities: Object.fromEntries([parent, ...children].map((t) => [t.id, t])),
      },
    };
    store.overrideSelector(
      selectTaskEntities,
      Object.fromEntries([parent, ...children].map((t) => [t.id, t])),
    );
    store.refreshState();
    service.abandon('large');
    tick();
    expect(store.dispatch).toHaveBeenCalledTimes(101);
    expect(
      Object.values(state.tasks.entities).every((task) => task?.isAbandoned),
    ).toBeTrue();
  }));

  it('一百个子任务联动完成后可以全部取消完成，并保留逐任务同步边界', fakeAsync(() => {
    const tasks = [
      createMockTask({
        id: 'large',
        subTaskIds: Array.from({ length: 100 }, (_, i) => `child-${i}`),
      }),
      ...Array.from({ length: 100 }, (_, i) =>
        createMockTask({ id: `child-${i}`, parentId: 'large' }),
      ),
    ];
    state = {
      ...state,
      tasks: {
        ...state.tasks,
        ids: tasks.map((task) => task.id),
        entities: Object.fromEntries(tasks.map((task) => [task.id, task])),
      },
    };
    store.overrideSelector(selectTaskEntities, state.tasks.entities);
    store.refreshState();
    service.complete('large');
    tick();
    service.reopen('large');
    tick();

    expect(store.dispatch).toHaveBeenCalledTimes(202);
    expect(Object.values(state.tasks.entities).every((task) => !task?.isDone)).toBeTrue();
    const actions = (store.dispatch as jasmine.Spy).calls
      .allArgs()
      .map(([action]) => action as ReturnType<typeof TaskSharedActions.updateTask>);
    for (const action of actions) {
      expect(action.meta.entityId).toBe(action.task.id as string);
      expect(action.meta.entityIds).toBeUndefined();
    }
  }));
});
