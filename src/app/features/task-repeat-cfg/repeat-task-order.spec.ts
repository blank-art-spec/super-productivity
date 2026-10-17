import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { DEFAULT_TASK_REPEAT_CFG, TaskRepeatCfg } from './task-repeat-cfg.model';
import { getMovedRepeatTaskRank, orderRepeatTaskIds } from './repeat-task-order';

describe('repeating task order', () => {
  const cfgs: TaskRepeatCfg[] = ['a', 'b', 'c'].map((id) => ({
    ...DEFAULT_TASK_REPEAT_CFG,
    id,
  }));
  const tasks = (day: string): Record<string, Task> =>
    Object.fromEntries(
      ['a', 'b', 'c'].map((id) => [
        id + day,
        { ...DEFAULT_TASK, id: id + day, repeatCfgId: id, projectId: '', dueDay: day },
      ]),
    );

  it('preserves existing order until the user reorders a series', () => {
    const ids = ['a1', 'b1', 'c1'];
    expect(orderRepeatTaskIds(ids, tasks('1'), cfgs)).toBe(ids);
  });

  it('keeps the same manual order on tomorrow and after serialization', () => {
    const rank = getMovedRepeatTaskRank('a1', ['c1', 'a1', 'b1'], tasks('1'), cfgs);
    const updated: TaskRepeatCfg[] = JSON.parse(
      JSON.stringify(cfgs.map((c) => (c.id === 'a' ? { ...c, listOrder: rank } : c))),
    );
    expect(orderRepeatTaskIds(['c2', 'b2', 'a2'], tasks('2'), updated)).toEqual([
      'c2',
      'a2',
      'b2',
    ]);
    expect(orderRepeatTaskIds(['a3', 'b3', 'c3'], tasks('3'), updated)).toEqual([
      'c3',
      'a3',
      'b3',
    ]);
  });

  it('supports moving to the beginning and end', () => {
    const rank = getMovedRepeatTaskRank('a1', ['a1', 'c1', 'b1'], tasks('1'), cfgs)!;
    const updated = cfgs.map((c) => (c.id === 'a' ? { ...c, listOrder: rank } : c));
    expect(orderRepeatTaskIds(['c1', 'b1', 'a1'], tasks('1'), updated)).toEqual([
      'a1',
      'c1',
      'b1',
    ]);
    const lastRank = getMovedRepeatTaskRank(
      'a1',
      ['c1', 'b1', 'a1'],
      tasks('1'),
      updated,
    )!;
    expect(lastRank).toBeGreaterThan(rank);
    expect(
      orderRepeatTaskIds(
        ['a1', 'c1', 'b1'],
        tasks('1'),
        updated.map((c) => (c.id === 'a' ? { ...c, listOrder: lastRank } : c)),
      ),
    ).toEqual(['c1', 'b1', 'a1']);
  });

  it('keeps existing ranks stable when a new repeating plan is created', () => {
    const rank = getMovedRepeatTaskRank('a1', ['c1', 'a1', 'b1'], tasks('1'), cfgs);
    const updated = cfgs.map((c) => (c.id === 'a' ? { ...c, listOrder: rank } : c));
    const withNewCfg = [...updated, { ...DEFAULT_TASK_REPEAT_CFG, id: 'new' }];
    expect(orderRepeatTaskIds(['a1', 'b1', 'c1'], tasks('1'), withNewCfg)).toEqual([
      'c1',
      'a1',
      'b1',
    ]);
  });

  it('uses peers from the moved occurrence day when a project contains several days', () => {
    const entities = { ...tasks('1'), ...tasks('2') };
    expect(
      getMovedRepeatTaskRank('a1', ['c1', 'a1', 'b1', 'a2', 'b2', 'c2'], entities, cfgs),
    ).toBe(getMovedRepeatTaskRank('a1', ['c1', 'a1', 'b1'], entities, cfgs));
  });

  it('preserves ordinary tasks, done tasks, subtasks and other days in their slots', () => {
    const entities: Record<string, Task> = {
      ...tasks('1'),
      ...tasks('2'),
      ordinary: { ...DEFAULT_TASK, id: 'ordinary', projectId: '' },
      done: {
        ...DEFAULT_TASK,
        id: 'done',
        projectId: '',
        repeatCfgId: 'c',
        isDone: true,
      },
      sub: {
        ...DEFAULT_TASK,
        id: 'sub',
        projectId: '',
        parentId: 'a1',
        repeatCfgId: 'b',
      },
    };
    const updated = cfgs.map((c) => (c.id === 'a' ? { ...c, listOrder: -1 } : c));
    expect(
      orderRepeatTaskIds(
        ['c1', 'ordinary', 'b1', 'done', 'a1', 'sub', 'b2', 'a2'],
        entities,
        updated,
      ),
    ).toEqual(['a1', 'ordinary', 'c1', 'done', 'b1', 'sub', 'a2', 'b2']);
    expect(
      getMovedRepeatTaskRank('ordinary', ['ordinary', 'a1'], entities, updated),
    ).toBeUndefined();
    expect(
      getMovedRepeatTaskRank('sub', ['sub', 'a1'], entities, updated),
    ).toBeUndefined();
  });
});
