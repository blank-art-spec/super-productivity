import { clampPastTimedOccurrence } from './clamp-past-timed-occurrence.util';
import { getDbDateStr } from '../../../util/get-db-date-str';

describe('clampPastTimedOccurrence', () => {
  const addDays = (days: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(12, 0, 0, 0);
    return d;
  };

  it('returns the occurrence unchanged for non-timed cfgs (#7344 preservation)', () => {
    const pastDay = addDays(-20);
    const result = clampPastTimedOccurrence(pastDay, { startTime: undefined });
    expect(result).toBe(pastDay);
  });

  it('clamps past occurrences to today at noon when cfg is timed (#7354)', () => {
    const pastDay = addDays(-20);
    const result = clampPastTimedOccurrence(pastDay, { startTime: '10:00' });
    expect(result).not.toBeNull();
    expect(getDbDateStr(result!)).toBe(getDbDateStr());
    expect(result!.getHours()).toBe(12);
    expect(result!.getMinutes()).toBe(0);
  });

  it('preserves today occurrences for timed cfgs', () => {
    const today = addDays(0);
    const result = clampPastTimedOccurrence(today, { startTime: '10:00' });
    expect(result).toBe(today);
  });

  it('preserves future occurrences for timed cfgs', () => {
    const future = addDays(30);
    const result = clampPastTimedOccurrence(future, { startTime: '10:00' });
    expect(result).toBe(future);
  });

  it('returns null when the input is null', () => {
    expect(clampPastTimedOccurrence(null, { startTime: '10:00' })).toBeNull();
    expect(clampPastTimedOccurrence(null, { startTime: undefined })).toBeNull();
  });

  it('does not clamp an expired timed repeat back to today', () => {
    const pastDay = addDays(-20);
    expect(
      clampPastTimedOccurrence(pastDay, {
        startTime: '10:00',
        endDate: getDbDateStr(addDays(-1)),
      }),
    ).toBeNull();
  });

  it('advances a past timed occurrence to the next statutory workday', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-10-02T09:00:00'));
      const config = {
        startTime: '10:00',
        isChineseWorkday: true,
        startDate: '2026-09-30',
        repeatCycle: 'DAILY' as const,
        repeatEvery: 1,
      };
      expect(
        getDbDateStr(clampPastTimedOccurrence(new Date('2026-09-30T12:00:00'), config)!),
      ).toBe('2026-10-08');
      expect(
        clampPastTimedOccurrence(new Date('2026-09-30T12:00:00'), {
          ...config,
          endDate: '2026-10-07',
        }),
      ).toBeNull();
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
