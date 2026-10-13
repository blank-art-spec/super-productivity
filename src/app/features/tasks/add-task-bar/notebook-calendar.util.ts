import { getDbDateStr } from '../../../util/get-db-date-str';
import { getChineseHolidayAdjustment } from '../../../core/date/chinese-workday.util';

// 2026 mainland holiday adjustments: State Council notice, 2025-11-04.
// https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/202511/t20251104_4258838.html
// Hong Kong Observatory's Gregorian–lunar conversion table (UTC+8).
// https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2026e.pdf
const SOLAR_TERMS_2026 = new Map([
  ['01-05', 'MINOR_COLD'],
  ['01-20', 'MAJOR_COLD'],
  ['02-04', 'SPRING'],
  ['02-18', 'RAIN'],
  ['03-05', 'INSECTS'],
  ['03-20', 'SPRING_EQUINOX'],
  ['04-05', 'QINGMING'],
  ['04-20', 'GRAIN_RAIN'],
  ['05-05', 'SUMMER'],
  ['05-21', 'GRAIN_FULL'],
  ['06-05', 'GRAIN_EAR'],
  ['06-21', 'SUMMER_SOLSTICE'],
  ['07-07', 'MINOR_HEAT'],
  ['07-23', 'MAJOR_HEAT'],
  ['08-07', 'AUTUMN'],
  ['08-23', 'END_HEAT'],
  ['09-07', 'DEW'],
  ['09-23', 'AUTUMN_EQUINOX'],
  ['10-08', 'COLD_DEW'],
  ['10-23', 'FROST'],
  ['11-07', 'WINTER'],
  ['11-22', 'MINOR_SNOW'],
  ['12-07', 'MAJOR_SNOW'],
  ['12-22', 'WINTER_SOLSTICE'],
]);
const FESTIVALS = new Map([
  ['1-1', 'SPRING_FESTIVAL'],
  ['1-15', 'LANTERN'],
  ['5-5', 'DRAGON_BOAT'],
  ['7-7', 'QIXI'],
  ['8-15', 'MID_AUTUMN'],
  ['9-9', 'DOUBLE_NINTH'],
  ['12-8', 'LABA'],
]);
const SOLAR_FESTIVALS = new Map([
  ['01-01', 'NEW_YEAR'],
  ['05-01', 'LABOUR'],
  ['10-01', 'NATIONAL_DAY'],
  ['10-24', 'UN_DAY'],
]);
const lunar = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  month: 'long',
  day: 'numeric',
});
const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export const notebookCalendarDays = (month: string, firstDayOfWeek: number): string[] => {
  const date = new Date(`${month.slice(0, 7)}-01T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() - firstDayOfWeek + 7) % 7));
  return Array.from({ length: 42 }, () => {
    const day = getDbDateStr(date);
    date.setDate(date.getDate() + 1);
    return day;
  });
};

export const notebookCalendarInfo = (
  day: string,
): {
  lunar: string;
  labelKey: string | null;
  holiday: 'off' | 'work' | null;
} => {
  const date = new Date(`${day}T12:00:00`);
  const parts = lunar.formatToParts(date);
  const month = parts.find((part) => part.type === 'month')!.value;
  const number = Number(parts.find((part) => part.type === 'day')!.value);
  const lunarText =
    number === 1
      ? month
      : number <= 10
        ? `初${numerals[number - 1]}`
        : number < 20
          ? `十${numerals[number - 11]}`
          : number === 20
            ? '二十'
            : number < 30
              ? `廿${numerals[number - 21]}`
              : '三十';
  const monthNumber =
    [
      '正月',
      '二月',
      '三月',
      '四月',
      '五月',
      '六月',
      '七月',
      '八月',
      '九月',
      '十月',
      '十一月',
      '腊月',
    ].indexOf(month) + 1;
  const md = day.slice(5);
  const key =
    SOLAR_FESTIVALS.get(md) ||
    FESTIVALS.get(`${monthNumber}-${number}`) ||
    (day.startsWith('2026-') ? SOLAR_TERMS_2026.get(md) : null);
  const holiday = getChineseHolidayAdjustment(day);
  return {
    lunar: lunarText,
    labelKey: key ? `F.TASK.NOTEBOOK_ADD.CALENDAR.${key}` : null,
    holiday,
  };
};
