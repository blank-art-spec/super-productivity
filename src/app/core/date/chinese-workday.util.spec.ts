import { getChineseHolidayAdjustment, isChineseWorkday } from './chinese-workday.util';

describe('published China statutory workdays', () => {
  it('excludes every published 2026 holiday and includes compensatory weekends', () => {
    for (const [start, end] of [
      ['01-01', '01-03'],
      ['02-15', '02-23'],
      ['04-04', '04-06'],
      ['05-01', '05-05'],
      ['06-19', '06-21'],
      ['09-25', '09-27'],
      ['10-01', '10-07'],
    ]) {
      const cursor = new Date(`2026-${start}T12:00:00`);
      while (cursor <= new Date(`2026-${end}T12:00:00`)) {
        const day = `2026-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        expect(getChineseHolidayAdjustment(day)).toBe('off');
        expect(isChineseWorkday(day)).toBeFalse();
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    for (const md of ['01-04', '02-14', '02-28', '05-09', '09-20', '10-10']) {
      expect(getChineseHolidayAdjustment(`2026-${md}`)).toBe('work');
      expect(isChineseWorkday(`2026-${md}`)).toBeTrue();
    }
  });
  it('retains ordinary weekdays/weekends and never invents unsupported years', () => {
    expect(isChineseWorkday('2026-10-12')).toBeTrue();
    expect(isChineseWorkday('2026-10-11')).toBeFalse();
    expect(isChineseWorkday('2027-01-04')).toBeFalse();
    expect(getChineseHolidayAdjustment('2027-01-04')).toBeNull();
  });
});
