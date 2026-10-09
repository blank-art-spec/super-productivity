import { getTodayPeriod, groupTodayTasks } from './today-periods.util';
import { DEFAULT_TASK, TaskWithSubTasks } from '../tasks/task.model';

describe('Today period grouping', () => {
  const at = (hour: number): number => new Date(2026, 9, 9, hour).getTime();
  it('keeps tasks without a time separate and uses local period boundaries', () => {
    expect(getTodayPeriod()).toBe('anytime');
    expect(getTodayPeriod(null)).toBe('anytime');
    expect(getTodayPeriod(NaN)).toBe('anytime');
    expect(getTodayPeriod(at(11))).toBe('morning');
    expect(getTodayPeriod(at(12))).toBe('afternoon');
    expect(getTodayPeriod(at(18))).toBe('evening');
    expect(getTodayPeriod(at(2))).toBe('morning');
  });
  it('keeps each parent once, retains subtasks and does not mutate the source', () => {
    const task = {
      ...DEFAULT_TASK,
      id: 'a',
      projectId: 'project',
      subTasks: [],
      dueWithTime: at(18),
    } as TaskWithSubTasks;
    const anytime = {
      ...DEFAULT_TASK,
      id: 'b',
      projectId: 'project',
      subTasks: [],
    } as TaskWithSubTasks;
    const tasks = [task, anytime, task];
    const groups = groupTodayTasks(tasks);
    expect(groups.flatMap((group) => group.tasks).map((entry) => entry.id)).toEqual([
      'b',
      'a',
    ]);
    expect(groups[3].tasks[0]).toBe(task);
    expect(tasks).toEqual([task, anytime, task]);
  });
});
