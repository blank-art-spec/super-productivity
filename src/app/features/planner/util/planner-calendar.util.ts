import { getDbDateStr } from '../../../util/get-db-date-str';
import { parseDbDateStr } from '../../../util/parse-db-date-str';

export type PlannerCalendarView = 'month' | 'week' | 'day' | 'agenda';

export const getPlannerCalendarDates = (
  anchor: string,
  view: PlannerCalendarView,
  firstDayOfWeek: number,
): string[] => {
  const start = parseDbDateStr(anchor);
  // Calendar arithmetic stays local, at noon, including across DST changes.
  start.setHours(12);
  if (view === 'month') start.setDate(1);
  if (view === 'month' || view === 'week') {
    start.setDate(start.getDate() - ((start.getDay() - firstDayOfWeek + 7) % 7));
  }
  const count = view === 'month' ? 42 : view === 'week' ? 7 : 1;
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return getDbDateStr(day);
  });
};

export const shiftPlannerCalendarDate = (
  anchor: string,
  view: PlannerCalendarView,
  direction: -1 | 1,
): string => {
  const date = parseDbDateStr(anchor);
  date.setHours(12);
  if (view === 'month') {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  } else {
    const step = direction * (view === 'week' ? 7 : 1);
    date.setDate(date.getDate() + step);
  }
  return getDbDateStr(date);
};
