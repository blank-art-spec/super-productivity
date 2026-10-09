import { Task } from '../tasks/task.model';
import { getTaskPriority } from '../tasks/task-priority.const';
import { getDbDateStr } from '../../util/get-db-date-str';
import {
  EisenhowerQuadrant,
  MatrixFilter,
  MatrixGroupId,
} from './eisenhower-matrix.model';

/** Scheduled dates follow logical-day boundaries; deadlines use their calendar day. */
export const getMatrixTaskDates = (
  task: Task,
  startOfNextDayDiffMs: number,
): { planned: string | null; deadline: string | null } => ({
  planned:
    task.dueWithTime != null
      ? getDbDateStr(task.dueWithTime - startOfNextDayDiffMs)
      : (task.dueDay ?? null),
  deadline:
    task.deadlineWithTime != null
      ? getDbDateStr(task.deadlineWithTime)
      : (task.deadlineDay ?? null),
});

/** High priority is important. Due/overdue today is urgent. No writes occur here. */
export const suggestEisenhowerQuadrant = (
  task: Task,
  today: string,
  startOfNextDayDiffMs: number,
): EisenhowerQuadrant => {
  const important = getTaskPriority(task.priority) === 3;
  const { planned, deadline } = getMatrixTaskDates(task, startOfNextDayDiffMs);
  const urgent = !!((planned && planned <= today) || (deadline && deadline <= today));
  return important
    ? urgent
      ? EisenhowerQuadrant.DO_FIRST
      : EisenhowerQuadrant.SCHEDULE
    : urgent
      ? EisenhowerQuadrant.DELEGATE
      : EisenhowerQuadrant.ELIMINATE;
};

export const getMatrixWeekRange = (
  today: string,
  firstDayOfWeek: number = 1,
): { start: string; end: string } => {
  // Parse a date-only value in local time, never as UTC; use calendar arithmetic for DST.
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() - firstDayOfWeek + 7) % 7));
  const start = getDbDateStr(date);
  date.setDate(date.getDate() + 6);
  return { start, end: getDbDateStr(date) };
};

export const filterMatrixTasks = (
  tasks: readonly Task[],
  filter: MatrixFilter,
  today: string,
  startOfNextDayDiffMs: number,
  firstDayOfWeek: number = 1,
): Task[] => {
  const anchor = filter.day ?? today;
  const week = getMatrixWeekRange(anchor, firstDayOfWeek);
  return tasks.filter((task) => {
    if (task.isDone) return false;
    if (filter.projectId && task.projectId !== filter.projectId) return false;
    if (filter.tagId && !task.tagIds.includes(filter.tagId)) return false;
    if (filter.time === 'all') return true;
    const dates = getMatrixTaskDates(task, startOfNextDayDiffMs);
    return [dates.planned, dates.deadline].some(
      (date) =>
        date !== null &&
        (filter.time === 'today' || filter.time === 'day'
          ? date === (filter.time === 'today' ? today : anchor)
          : date >= week.start && date <= week.end),
    );
  });
};

/** Local noon and calendar arithmetic avoid UTC parsing and DST-sized days. */
export const getMatrixWeekDates = (anchor: string, firstDayOfWeek: number): string[] => {
  const { start } = getMatrixWeekRange(anchor, firstDayOfWeek);
  const date = new Date(`${start}T12:00:00`);
  return Array.from({ length: 7 }, () => {
    const day = getDbDateStr(date);
    date.setDate(date.getDate() + 1);
    return day;
  });
};

export const shiftMatrixWeek = (anchor: string, direction: -1 | 1): string => {
  const date = new Date(`${anchor}T12:00:00`);
  const daysToShift = direction * 7;
  date.setDate(date.getDate() + daysToShift);
  return getDbDateStr(date);
};

export const getMatrixGroup = (
  task: Task,
  previewSuggestions: boolean,
  today: string,
  startOfNextDayDiffMs: number,
): MatrixGroupId =>
  task.eisenhowerQuadrant ??
  (previewSuggestions
    ? suggestEisenhowerQuadrant(task, today, startOfNextDayDiffMs)
    : null);
