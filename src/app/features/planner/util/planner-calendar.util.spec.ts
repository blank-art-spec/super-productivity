import {
  getPlannerCalendarDates,
  shiftPlannerCalendarDate,
} from './planner-calendar.util';

describe('Planner calendar windows', () => {
  it('covers a full month with six complete weeks and the configured week start', () => {
    const dates = getPlannerCalendarDates('2026-10-09', 'month', 1);
    expect(dates.length).toBe(42);
    expect(dates[0]).toBe('2026-09-28');
    expect(dates[41]).toBe('2026-11-08');
    expect(new Set(dates).size).toBe(42);
  });

  it('respects Sunday and Monday starts across year boundaries', () => {
    expect(getPlannerCalendarDates('2026-01-01', 'week', 0)[0]).toBe('2025-12-28');
    expect(getPlannerCalendarDates('2026-01-01', 'week', 1)[0]).toBe('2025-12-29');
    expect(getPlannerCalendarDates('2026-01-01', 'day', 1)).toEqual(['2026-01-01']);
  });

  it('clamps month-end navigation including leap February', () => {
    expect(shiftPlannerCalendarDate('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(shiftPlannerCalendarDate('2024-03-31', 'month', -1)).toBe('2024-02-29');
    expect(shiftPlannerCalendarDate('2026-12-31', 'day', 1)).toBe('2027-01-01');
    expect(shiftPlannerCalendarDate('2026-10-09', 'week', -1)).toBe('2026-10-02');
  });

  it('produces consecutive local calendar days across DST transition weekends', () => {
    expect(getPlannerCalendarDates('2026-03-08', 'week', 0)).toEqual([
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
    ]);
    expect(getPlannerCalendarDates('2026-10-25', 'week', 0)[6]).toBe('2026-10-31');
  });
});
