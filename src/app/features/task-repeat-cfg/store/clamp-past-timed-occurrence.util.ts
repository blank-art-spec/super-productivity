import { DEFAULT_TASK_REPEAT_CFG, TaskRepeatCfg } from '../task-repeat-cfg.model';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { getRepeatEndDay, isAllowedRepeatDay } from './repeat-occurrence-limits.util';
import { getNextRepeatOccurrence } from './get-next-repeat-occurrence.util';

/**
 * When a repeat cfg has `startTime`, a first occurrence in the past would
 * produce a past `remindAt` and the reminder module (`reminder.module.ts`)
 * would fire a "missed reminder" popup immediately on save (#7354). Clamp
 * to today (at noon) in that case. Non-timed cfgs are left alone — past-day
 * preservation (#7344) is intentional for untimed tasks.
 */
export const clampPastTimedOccurrence = (
  occurrence: Date | null,
  cfg: Pick<TaskRepeatCfg, 'startTime'> & Partial<TaskRepeatCfg>,
): Date | null => {
  if (!occurrence || !cfg.startTime) {
    return occurrence;
  }
  // yyyy-mm-dd strings sort lexicographically like calendar dates
  if (getDbDateStr(occurrence) < getDbDateStr()) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const end = getRepeatEndDay(cfg);
    if (end && getDbDateStr(today) > end) return null;
    if (!isAllowedRepeatDay(cfg, today)) {
      return getNextRepeatOccurrence(
        { ...DEFAULT_TASK_REPEAT_CFG, ...cfg, id: cfg.id || '' },
        today,
        { inclusive: true },
      );
    }
    return today;
  }
  return occurrence;
};
