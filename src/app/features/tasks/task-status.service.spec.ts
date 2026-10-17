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

  it('abandons only the selected subtask', fakeAsync(() => {
    service.abandon('one');
    tick();
    expect(state.tasks.entities.one!.isAbandoned).toBeTrue();
    expect(state.tasks.entities.parent!.isDone).toBeFalse();
    expect(state.tasks.entities.two!.isAbandoned).toBeFalse();
  }));

  it('reopening clears abandonment and completion time without reopening siblings', () => {
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
    expect(state.tasks.entities.one!.isDone).toBeFalse();
    expect(state.tasks.entities.one!.isAbandoned).toBeFalse();
    expect(state.tasks.entities.one!.doneOn).toBeUndefined();
  });

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
});
