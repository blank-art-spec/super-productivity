import { TaskWithSubTasks } from '../tasks/task.model';
import { T } from '../../t.const';

export type TodayPeriod = 'anytime' | 'morning' | 'afternoon' | 'evening';
export interface TodayPeriodGroup {
  id: TodayPeriod;
  title: string;
  icon: string;
  tasks: TaskWithSubTasks[];
}

// Use wall-clock time for the labels. The Today selectors decide which logical
// day a task belongs to (including the user's start-of-next-day offset).
export const getTodayPeriod = (dueWithTime?: number | null): TodayPeriod => {
  if (dueWithTime == null || !Number.isFinite(dueWithTime)) return 'anytime';
  const hour = new Date(dueWithTime).getHours();
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
};

export const groupTodayTasks = (tasks: TaskWithSubTasks[]): TodayPeriodGroup[] => {
  const definitions = [
    { id: 'anytime', title: T.F.TASK_PAGE.ANYTIME, icon: 'today' },
    { id: 'morning', title: T.F.TASK_PAGE.MORNING, icon: 'wb_twilight' },
    { id: 'afternoon', title: T.F.TASK_PAGE.AFTERNOON, icon: 'light_mode' },
    { id: 'evening', title: T.F.TASK_PAGE.EVENING, icon: 'dark_mode' },
  ] as const;
  const seen = new Set<string>();
  const groups = definitions.map((definition) => ({
    ...definition,
    tasks: [] as TaskWithSubTasks[],
  }));
  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    groups
      .find((group) => group.id === getTodayPeriod(task.dueWithTime))!
      .tasks.push(task);
  }
  return groups;
};
