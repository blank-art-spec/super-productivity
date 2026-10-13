// State Council's published 2026 holiday and compensatory workday schedule.
// https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/202511/t20251104_4258838.html
const OFF_DAYS = [
  ['01-01', '01-03'],
  ['02-15', '02-23'],
  ['04-04', '04-06'],
  ['05-01', '05-05'],
  ['06-19', '06-21'],
  ['09-25', '09-27'],
  ['10-01', '10-07'],
];
const WORK_DAYS = ['01-04', '02-14', '02-28', '05-09', '09-20', '10-10'];
export const CHINESE_WORKDAY_CALENDAR_END = '2026-12-31';

export const hasChineseWorkdayCalendar = (day: string): boolean =>
  day.startsWith('2026-');

export const getChineseHolidayAdjustment = (day: string): 'off' | 'work' | null => {
  if (!hasChineseWorkdayCalendar(day)) return null;
  const md = day.slice(5);
  return WORK_DAYS.includes(md)
    ? 'work'
    : OFF_DAYS.some(([start, end]) => md >= start && md <= end)
      ? 'off'
      : null;
};

export const isChineseWorkday = (day: string): boolean => {
  // Do not silently invent statutory schedules for unpublished/unsupported years.
  if (!hasChineseWorkdayCalendar(day)) return false;
  const adjustment = getChineseHolidayAdjustment(day);
  const weekday = new Date(`${day}T12:00:00`).getDay();
  return adjustment === 'work' || (adjustment !== 'off' && weekday >= 1 && weekday <= 5);
};
