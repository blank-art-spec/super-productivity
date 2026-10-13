import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { filterMatrixTasks } from './eisenhower-matrix.util';
import { reorderMatrixTasks, sortMatrixTasks } from './matrix-task-order.util';

describe('Persistent Matrix task order', () => {
  const task = (id: string, fields: Partial<Task> = {}): Task => ({
    ...DEFAULT_TASK,
    id,
    projectId: 'project',
    ...fields,
  });
  const ids = (tasks: readonly Task[]): string[] => tasks.map((item) => item.id);
  const a = task('a');
  const b = task('b');
  const c = task('c');

  it('preserves legacy order and appends newly added tasks without mutating inputs', () => {
    const tasks = Object.freeze([a, b, c]);
    expect(ids(sortMatrixTasks(tasks, []))).toEqual(['a', 'b', 'c']);
    expect(ids(sortMatrixTasks(tasks, ['task:b', 'task:a']))).toEqual(['b', 'a', 'c']);
    expect(ids(tasks)).toEqual(['a', 'b', 'c']);
  });

  it('persists moves in both directions and survives JSON reload and a new day', () => {
    const order = reorderMatrixTasks([], [a, b, c], 'c', 0)!;
    const reloaded: string[] = JSON.parse(JSON.stringify(order));
    const tomorrowTasks = [a, b, c].map((item) => ({ ...item, dueDay: '2026-10-12' }));
    const tomorrow = filterMatrixTasks(
      tomorrowTasks,
      { time: 'today', projectId: '', tagId: '' },
      '2026-10-12',
      0,
    );
    expect(ids(sortMatrixTasks(tomorrow, reloaded))).toEqual(['c', 'a', 'b']);
    const next = reorderMatrixTasks(reloaded, [c, a, b], 'c', 2)!;
    expect(ids(sortMatrixTasks([c, b, a], next))).toEqual(['a', 'b', 'c']);
  });

  it('keeps filtered-out, completed and other-quadrant slots in the saved order', () => {
    const order = Object.freeze(['task:a', 'task:hidden', 'task:b', 'task:done']);
    const moved = reorderMatrixTasks(order, [a, b], 'b', 0)!;
    expect(moved).toEqual(['task:b', 'task:hidden', 'task:a', 'task:done']);
    expect(ids(sortMatrixTasks([a, task('hidden'), b, task('done')], moved))).toEqual([
      'b',
      'hidden',
      'a',
      'done',
    ]);
    expect(order[0]).toBe('task:a');
  });

  it('preserves hidden slots even when the first move occurs in a filtered view', () => {
    const hidden = task('hidden');
    const order = reorderMatrixTasks([], [a, b], 'b', 0, [a, hidden, b])!;
    expect(ids(sortMatrixTasks([a, hidden, b], order))).toEqual(['b', 'hidden', 'a']);
  });

  it('uses stable repeat identities for future instances even after earlier ones disappear', () => {
    const oldA = task('old-a', { repeatCfgId: 'series-a' });
    const oldB = task('old-b', { repeatCfgId: 'series-b' });
    const order = reorderMatrixTasks([], [oldA, oldB, c], 'old-b', 0)!;
    const nextA = task('next-a', { repeatCfgId: 'series-a' });
    const nextB = task('next-b', { repeatCfgId: 'series-b' });
    expect(ids(sortMatrixTasks([c, nextA, nextB], order))).toEqual([
      'next-b',
      'next-a',
      'c',
    ]);
    const secondOrder = reorderMatrixTasks(order, [nextB, nextA, c], 'c', 0)!;
    expect(ids(sortMatrixTasks([nextA, nextB, c], secondOrder))).toEqual([
      'c',
      'next-b',
      'next-a',
    ]);
    expect(
      ids(
        sortMatrixTasks([task('later-a', { repeatCfgId: 'series-a' }), c], secondOrder),
      ),
    ).toEqual(['c', 'later-a']);
  });

  it('allows individual instances of one series to move independently', () => {
    const first = task('first', { repeatCfgId: 'same' });
    const second = task('second', { repeatCfgId: 'same' });
    const order = reorderMatrixTasks([], [first, c, second], 'second', 0)!;
    expect(ids(sortMatrixTasks([first, c, second], order))).toEqual([
      'second',
      'first',
      'c',
    ]);
    expect(
      ids(sortMatrixTasks([c, task('future', { repeatCfgId: 'same' })], order)),
    ).toEqual(['future', 'c']);
  });

  it('keeps unrelated task and repeat IDs distinct', () => {
    const regular = task('same');
    const repeat = task('instance', { repeatCfgId: 'same' });
    const order = reorderMatrixTasks([], [regular, repeat], 'instance', 0)!;
    expect(ids(sortMatrixTasks([regular, repeat], order))).toEqual(['instance', 'same']);
  });

  it('ignores unchanged, missing and invalid drops', () => {
    for (const [id, index] of [
      ['a', 0],
      ['missing', 1],
      ['a', -1],
      ['a', 2],
    ] as const) {
      expect(reorderMatrixTasks([], [a, b], id, index)).toBeNull();
    }
    expect(reorderMatrixTasks([], [a], 'a', 0)).toBeNull();
  });
});
