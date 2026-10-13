import { notebookTasksForDay } from './notebook-day-tasks.util';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { EisenhowerQuadrant } from './eisenhower-matrix.model';

describe('Notebook daily task progress', () => {
  const task = (id: string, fields: Partial<Task>): Task => ({
    ...DEFAULT_TASK,
    id,
    projectId: 'project',
    eisenhowerQuadrant: EisenhowerQuadrant.DO_FIRST,
    ...fields,
  });
  it('counts a parent once, preserves completed tasks, and excludes unclassified tasks', () => {
    const tasks = [
      task('parent', { dueDay: '2026-10-11', subTaskIds: ['child'] }),
      task('child', { parentId: 'parent', dueDay: '2026-10-11' }),
      task('done', { dueDay: '2026-10-11', isDone: true }),
      task('unclassified', { dueDay: '2026-10-11', eisenhowerQuadrant: null }),
    ];
    expect(
      notebookTasksForDay(tasks, '2026-10-11', '2026-10-12', 0).map((item) => item.id),
    ).toEqual(['parent', 'done']);
  });
  it('uses the archive completion day and logical-day boundary when scheduling is absent', () => {
    const tasks = [
      task('archived', { isDone: true, doneOn: new Date(2026, 9, 12, 1).getTime() }),
    ];
    expect(
      notebookTasksForDay(tasks, '2026-10-11', '2026-10-12', 4 * 3600000).length,
    ).toBe(1);
    expect(
      notebookTasksForDay(tasks, '2026-10-12', '2026-10-12', 4 * 3600000).length,
    ).toBe(0);
  });
  it('includes unscheduled plans today and never leaks them into other dates', () => {
    const tasks = [task('unscheduled', {}), task('tomorrow', { dueDay: '2026-10-13' })];
    expect(
      notebookTasksForDay(tasks, '2026-10-12', '2026-10-12', 0).map((item) => item.id),
    ).toEqual(['unscheduled']);
    expect(
      notebookTasksForDay(tasks, '2026-10-13', '2026-10-12', 0).map((item) => item.id),
    ).toEqual(['tomorrow']);
  });
});
