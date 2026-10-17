import { DEFAULT_TASK, Task } from '../task.model';
import { initialTaskState, TASK_FEATURE_NAME } from './task.reducer';
import { taskAdapter } from './task.adapter';
import { selectAllDoneTasksWithSubTasks } from './task.selectors';

const makeTask = (id: string, changes: Partial<Task> = {}): Task => ({
  ...DEFAULT_TASK,
  id,
  title: id,
  projectId: 'project',
  subTaskIds: [],
  tagIds: [],
  ...changes,
});
const state = (tasks: Task[]): object => ({
  [TASK_FEATURE_NAME]: taskAdapter.setAll(tasks, initialTaskState),
});

describe('Completed history projections', () => {
  it('shows only completed parents, newest first, preserving their children', () => {
    const parent = makeTask('parent', {
      isDone: true,
      doneOn: 20,
      subTaskIds: ['child'],
    });
    const child = makeTask('child', { isDone: true, doneOn: 30, parentId: 'parent' });
    const legacy = makeTask('legacy', { isDone: true });
    const result = selectAllDoneTasksWithSubTasks(
      state([legacy, parent, child, makeTask('unfinished')]),
    );
    expect(result.map((task) => task.id)).toEqual(['parent', 'legacy']);
    expect(result[0].subTasks).toEqual([child]);
  });

  it('reuses the exact history array when an unfinished task tracks time', () => {
    const done = makeTask('done', { isDone: true });
    const unfinished = makeTask('unfinished');
    const before = selectAllDoneTasksWithSubTasks(state([done, unfinished]));
    const after = selectAllDoneTasksWithSubTasks(
      state([done, { ...unfinished, timeSpent: 1000 }]),
    );
    expect(after).toBe(before);
  });

  it('updates changed children while preserving other completed parent references', () => {
    const parent = makeTask('parent', {
      isDone: true,
      doneOn: 20,
      subTaskIds: ['child'],
    });
    const child = makeTask('child', { parentId: 'parent' });
    const other = makeTask('other', { isDone: true, doneOn: 10 });
    const before = selectAllDoneTasksWithSubTasks(state([parent, child, other]));
    const after = selectAllDoneTasksWithSubTasks(
      state([parent, { ...child, timeSpent: 1000 }, other]),
    );
    expect(after[0]).not.toBe(before[0]);
    expect(after[0].subTasks[0].timeSpent).toBe(1000);
    expect(after[1]).toBe(before[1]);
  });

  it('reflects completion-time changes and removes reopened or deleted tasks', () => {
    const a = makeTask('a', { isDone: true, doneOn: 20 });
    const b = makeTask('b', { isDone: true, doneOn: 10 });
    selectAllDoneTasksWithSubTasks(state([a, b]));
    expect(
      selectAllDoneTasksWithSubTasks(state([a, { ...b, doneOn: 30 }])).map((t) => t.id),
    ).toEqual(['b', 'a']);
    expect(selectAllDoneTasksWithSubTasks(state([{ ...a, isDone: false }]))).toEqual([]);
  });
});
