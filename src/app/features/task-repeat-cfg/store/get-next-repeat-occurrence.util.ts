import { TASK_REPEAT_WEEKDAY_MAP, TaskRepeatCfg } from '../task-repeat-cfg.model';
import { getDiffInDays } from '../../../util/get-diff-in-days';
import { getDiffInMonth } from '../../../util/get-diff-in-month';
import { getDiffInYears } from '../../../util/get-diff-in-years';
import { getDiffInWeeks } from '../../../util/get-diff-in-weeks';
import { dateStrToUtcDate } from '../../../util/date-str-to-utc-date';
import { getEffectiveLastTaskCreationDay } from './get-effective-last-task-creation-day.util';
import { getEffectiveRepeatStartDate } from './get-effective-repeat-start-date.util';
import {
  findMonthlyNthWeekdayOccurrence,
  hasNthWeekdayAnchor,
} from './get-nth-weekday-of-month.util';
import { Log } from '../../../core/log';
import { getRepeatEndDay, isAllowedRepeatDay } from './repeat-occurrence-limits.util';
import { getDbDateStr } from '../../../util/get-db-date-str';

export const getNextRepeatOccurrence = (
  taskRepeatCfg: TaskRepeatCfg,
  fromDate: Date = new Date(),
  options: { inclusive?: boolean } = {},
): Date | null => {
  if (!taskRepeatCfg.endDate && !taskRepeatCfg.isChineseWorkday)
    return getNextUnboundedOccurrence(taskRepeatCfg, fromDate, options);
  let next = getNextUnboundedOccurrence(taskRepeatCfg, fromDate, options);
  const end = getRepeatEndDay(taskRepeatCfg);
  while (next) {
    if (end && getDbDateStr(next) > end) return null;
    if (isAllowedRepeatDay(taskRepeatCfg, next)) return next;
    const cursor = new Date(next);
    cursor.setDate(cursor.getDate() + 1);
    next = getNextUnboundedOccurrence(taskRepeatCfg, cursor, { inclusive: true });
  }
  return null;
};

const getNextUnboundedOccurrence = (
  taskRepeatCfg: TaskRepeatCfg,
  fromDate: Date = new Date(),
  // When `inclusive` is true the scan starts from `fromDate` itself instead of
  // the day after the last task creation. Used when relocating an existing live
  // instance on a schedule edit: `fromDate` (today) may still be a valid
  // occurrence and must not be skipped (#7951). The default (exclusive) keeps
  // the "strictly next future occurrence" semantics relied on by the preview,
  // scheduled-list and heatmap.
  { inclusive = false }: { inclusive?: boolean } = {},
): Date | null => {
  if (!Number.isInteger(taskRepeatCfg.repeatEvery) || taskRepeatCfg.repeatEvery < 1) {
    Log.warn(
      `Invalid repeatEvery value "${taskRepeatCfg.repeatEvery}" for TaskRepeatCfg "${taskRepeatCfg.id}"`,
    );
    return null;
  }

  const checkDate = new Date(fromDate);
  // Get the effective last task creation day with fallback logic
  const startDateStr = getEffectiveRepeatStartDate(taskRepeatCfg);
  const startDateDate = dateStrToUtcDate(startDateStr);

  // Get the effective last task creation day with fallback logic
  const lastTaskCreationDateStr =
    getEffectiveLastTaskCreationDay(taskRepeatCfg) || '1970-01-01';
  const lastTaskCreation = dateStrToUtcDate(lastTaskCreationDateStr);
  // Use noon (12:00) to avoid DST issues - noon is never affected by DST transitions
  checkDate.setHours(12, 0, 0, 0);
  lastTaskCreation.setHours(12, 0, 0, 0);
  startDateDate.setHours(12, 0, 0, 0);

  if (inclusive) {
    // Relocating an existing instance: ignore prior-creation gating entirely so
    // the scan starts at `fromDate` and today is considered. Neutralising
    // `lastTaskCreation` (epoch) also disarms the per-cycle "skip past last
    // creation" guards (MONTHLY/YEARLY below) for a uniform inclusive scan.
    lastTaskCreation.setTime(0);
  } else {
    // Start checking from the day after last task creation
    if (lastTaskCreation >= checkDate) {
      checkDate.setTime(lastTaskCreation.getTime());
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  // MONTHLY/YEARLY reset to the period's anchor and can move backwards.
  // Preserve the scan floor for both modes so "next" never returns an
  // already-passed date, even when no task was created on that anchor day.
  const fromDateFloor = new Date(checkDate);

  switch (taskRepeatCfg.repeatCycle) {
    case 'DAILY': {
      // The notebook interval editor accepts up to 1000 cycles. Cover a full
      // supported interval without removing the cap for malformed imported data.
      const maxDaysToCheck = Math.max(
        365 * 2,
        Math.min(taskRepeatCfg.repeatEvery, 1000) + 1,
      );

      for (let i = 0; i < maxDaysToCheck; i++) {
        const diffInDays = getDiffInDays(startDateDate, checkDate);
        if (diffInDays >= 0 && diffInDays % taskRepeatCfg.repeatEvery === 0) {
          return checkDate;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
      return null;
    }

    case 'WEEKLY': {
      const intervalDays = Math.min(taskRepeatCfg.repeatEvery, 1000) * 7;
      const maxDaysToCheck = Math.max(365 * 2, intervalDays + 7);

      for (let i = 0; i < maxDaysToCheck; i++) {
        const diffInWeeks = getDiffInWeeks(startDateDate, checkDate);
        const todayDay = checkDate.getDay();
        const todayDayStr = TASK_REPEAT_WEEKDAY_MAP[
          todayDay
        ] as keyof typeof TASK_REPEAT_WEEKDAY_MAP;

        if (
          diffInWeeks >= 0 &&
          diffInWeeks % taskRepeatCfg.repeatEvery === 0 &&
          todayDayStr &&
          taskRepeatCfg[todayDayStr as keyof TaskRepeatCfg] === true
        ) {
          return checkDate;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
      return null;
    }

    case 'MONTHLY': {
      const maxMonthsToCheck = Math.max(
        24,
        Math.min(taskRepeatCfg.repeatEvery, 1000) + 1,
      );

      if (hasNthWeekdayAnchor(taskRepeatCfg)) {
        return findMonthlyNthWeekdayOccurrence(taskRepeatCfg, checkDate, {
          direction: 1,
          maxMonths: maxMonthsToCheck,
          accept: (candidate, cursor) => {
            const diffInMonth = getDiffInMonth(startDateDate, cursor);
            return (
              candidate >= checkDate &&
              diffInMonth >= 0 &&
              diffInMonth % taskRepeatCfg.repeatEvery === 0
            );
          },
        });
      }

      // `monthlyLastDay` anchors to month-end: day 31 makes setDateSafely's
      // Math.min(31, lastDayOfMonth) clamp to the true last day every month.
      const dayOfMonthRepeat = taskRepeatCfg.monthlyLastDay
        ? 31
        : startDateDate.getDate();

      // Handle month-end dates properly
      const setDateSafely = (date: Date, day: number): void => {
        date.setDate(1); // First set to 1st to avoid overflow
        const lastDayOfMonth = new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          0,
        ).getDate();
        date.setDate(Math.min(day, lastDayOfMonth));
      };

      // Move to the next possible month occurrence
      checkDate.setDate(1);
      if (
        lastTaskCreation.getMonth() === checkDate.getMonth() &&
        lastTaskCreation.getFullYear() === checkDate.getFullYear()
      ) {
        checkDate.setMonth(checkDate.getMonth() + 1);
      }
      setDateSafely(checkDate, dayOfMonthRepeat);

      for (let i = 0; i < maxMonthsToCheck; i++) {
        const diffInMonth = getDiffInMonth(startDateDate, checkDate);

        if (
          diffInMonth >= 0 &&
          diffInMonth % taskRepeatCfg.repeatEvery === 0 &&
          checkDate >= fromDateFloor
        ) {
          return checkDate;
        }
        checkDate.setDate(1);
        checkDate.setMonth(checkDate.getMonth() + 1);
        setDateSafely(checkDate, dayOfMonthRepeat);
      }
      return null;
    }

    case 'YEARLY': {
      const maxYearsToCheck = Math.max(10, Math.min(taskRepeatCfg.repeatEvery, 1000) + 1);
      const dayOfMonthRepeat = startDateDate.getDate();
      const monthOfMonthRepeat = startDateDate.getMonth();

      // Handle Feb 29 for non-leap years
      const setYearlyDate = (date: Date): void => {
        date.setDate(1);
        date.setMonth(monthOfMonthRepeat);
        if (monthOfMonthRepeat === 1 && dayOfMonthRepeat === 29) {
          // February 29 - check if leap year
          const isLeapYear = (year: number): boolean => {
            return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
          };
          if (!isLeapYear(date.getFullYear())) {
            date.setDate(28); // Set to Feb 28 for non-leap years
          } else {
            date.setDate(29);
          }
        } else {
          date.setDate(dayOfMonthRepeat);
        }
      };

      setYearlyDate(checkDate);

      // If we've already passed this year's occurrence, move to next year
      if (checkDate <= lastTaskCreation) {
        checkDate.setFullYear(checkDate.getFullYear() + 1);
        setYearlyDate(checkDate);
      }

      for (let i = 0; i < maxYearsToCheck; i++) {
        const diffInYears = getDiffInYears(startDateDate, checkDate);

        if (
          diffInYears >= 0 &&
          diffInYears % taskRepeatCfg.repeatEvery === 0 &&
          checkDate >= fromDateFloor
        ) {
          return checkDate;
        }
        checkDate.setFullYear(checkDate.getFullYear() + 1);
        setYearlyDate(checkDate);
      }
      return null;
    }

    default:
      return null;
  }
};
