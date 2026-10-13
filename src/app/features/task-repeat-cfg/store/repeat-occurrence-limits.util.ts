import { TaskRepeatCfg } from '../task-repeat-cfg.model';
import { getDbDateStr } from '../../../util/get-db-date-str';
import {
  CHINESE_WORKDAY_CALENDAR_END,
  isChineseWorkday,
} from '../../../core/date/chinese-workday.util';

type RepeatLimits = Pick<TaskRepeatCfg, 'endDate' | 'isChineseWorkday'>;

export const getRepeatEndDay = (cfg: RepeatLimits): string | null => {
  const end = cfg.endDate || null;
  if (!cfg.isChineseWorkday) return end;
  return end && end < CHINESE_WORKDAY_CALENDAR_END ? end : CHINESE_WORKDAY_CALENDAR_END;
};

export const isAllowedRepeatDay = (cfg: RepeatLimits, date: Date): boolean => {
  const day = getDbDateStr(date);
  const end = getRepeatEndDay(cfg);
  return (!end || day <= end) && (!cfg.isChineseWorkday || isChineseWorkday(day));
};
