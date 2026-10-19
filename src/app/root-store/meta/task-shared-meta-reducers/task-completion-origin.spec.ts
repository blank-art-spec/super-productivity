import { TaskSharedActions } from '../task-shared.actions';
import { taskSharedCrudMetaReducer } from './task-shared-crud.reducer';
import { createBaseState, createMockTask } from './test-utils';
import { RootState } from '../../root-state';

describe('任务完成来源的统一处理', () => {
  let state: RootState;
  const reducer = taskSharedCrudMetaReducer((s) => s);

  beforeEach(() => {
    const child = createMockTask({
      id: 'child',
      parentId: 'parent',
      isDone: true,
      doneOn: 123,
      doneByParentId: 'parent',
    });
    const parent = createMockTask({ id: 'parent', subTaskIds: [child.id] });
    state = {
      ...createBaseState(),
      tasks: {
        ...createBaseState().tasks,
        ids: [parent.id, child.id],
        entities: { parent, child },
      },
    };
  });

  it('普通完成载荷会清除之前的联动来源，包括快捷键或插件发起的更新', () => {
    const next = reducer(
      state,
      TaskSharedActions.updateTask({
        task: { id: 'child', changes: { isDone: true, doneOn: 456 } },
      }),
    ) as RootState;

    expect(next.tasks.entities.child!.isDone).toBeTrue();
    expect(next.tasks.entities.child!.doneOn).toBe(456);
    expect(next.tasks.entities.child!.doneByParentId).toBeNull();
    expect(state.tasks.entities.child!.doneByParentId).toBe('parent');
  });

  it('明确指定来源的完成载荷会保留来源，并且 JSON 重放得到相同状态', () => {
    // 固定修改时间，避免 reducer 记录 modified 时恰好跨毫秒导致比较不稳定。
    spyOn(Date, 'now').and.returnValue(456);
    const action = TaskSharedActions.updateTask({
      task: {
        id: 'child',
        changes: { isDone: true, doneOn: 456, doneByParentId: 'parent' },
      },
    });
    const next = reducer(state, action) as RootState;
    const replayed = reducer(state, JSON.parse(JSON.stringify(action))) as RootState;

    expect(next.tasks.entities.child!.doneByParentId).toBe('parent');
    expect(replayed.tasks.entities.child).toEqual(next.tasks.entities.child);
  });

  it('取消完成会清除来源和完成时间，即使载荷仍然携带旧来源', () => {
    const next = reducer(
      state,
      TaskSharedActions.updateTask({
        task: { id: 'child', changes: { isDone: false, doneByParentId: 'parent' } },
      }),
    ) as RootState;

    expect(next.tasks.entities.child!.isDone).toBeFalse();
    expect(next.tasks.entities.child!.doneOn).toBeUndefined();
    expect(next.tasks.entities.child!.doneByParentId).toBeNull();
  });

  it('放弃完成不会继续保留正常完成的联动来源', () => {
    const next = reducer(
      state,
      TaskSharedActions.updateTask({
        task: {
          id: 'child',
          changes: { isDone: true, isAbandoned: true, doneByParentId: 'parent' },
        },
      }),
    ) as RootState;

    expect(next.tasks.entities.child!.isAbandoned).toBeTrue();
    expect(next.tasks.entities.child!.doneByParentId).toBeNull();
  });

  it('修改标题等非完成字段时保留来源，不改变后续取消完成的行为', () => {
    const next = reducer(
      state,
      TaskSharedActions.updateTask({
        task: { id: 'child', changes: { title: '修改后的子任务' } },
      }),
    ) as RootState;

    expect(next.tasks.entities.child!.doneByParentId).toBe('parent');
    expect(next.tasks.entities.child!.doneOn).toBe(123);
  });

  it('父任务的自动完成来源随操作 JSON 重放保留，非完成修改不会清除来源', () => {
    const action = TaskSharedActions.updateTask({
      task: {
        id: 'parent',
        changes: { isDone: true, isDoneBySubTasks: true, doneOn: 456 },
      },
    });
    const completed = reducer(state, JSON.parse(JSON.stringify(action))) as RootState;
    const renamed = reducer(
      completed,
      TaskSharedActions.updateTask({
        task: { id: 'parent', changes: { title: 'Renamed parent' } },
      }),
    ) as RootState;

    expect(completed.tasks.entities.parent!.isDoneBySubTasks).toBeTrue();
    expect(renamed.tasks.entities.parent!.isDoneBySubTasks).toBeTrue();
    expect(state.tasks.entities.parent!.isDoneBySubTasks).toBeUndefined();
  });

  for (const changes of [
    { isDone: false, isDoneBySubTasks: true },
    { isDone: true, isAbandoned: true, isDoneBySubTasks: true },
    { isDone: true },
  ]) {
    it(`手动完成、反选或放弃完成会清除父任务自动完成来源：${JSON.stringify(changes)}`, () => {
      const completed = reducer(
        state,
        TaskSharedActions.updateTask({
          task: { id: 'parent', changes: { isDone: true, isDoneBySubTasks: true } },
        }),
      ) as RootState;
      const next = reducer(
        completed,
        TaskSharedActions.updateTask({ task: { id: 'parent', changes } }),
      ) as RootState;

      expect(next.tasks.entities.parent!.isDoneBySubTasks).toBeFalse();
      expect(completed.tasks.entities.parent!.isDoneBySubTasks).toBeTrue();
    });
  }
});
