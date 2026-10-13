import { notebookRangeDuration, NotebookTimeRange } from './notebook-time-range';

describe('notebookRangeDuration', () => {
  const range: NotebookTimeRange = {
    startDay: '2026-10-11',
    endDay: '2026-10-11',
    withTime: true,
    startTime: '09:00',
    endTime: '10:30',
  };
  it('calculates a timed duration', () => {
    expect(notebookRangeDuration(range)).toBe(90 * 60000);
  });
  it('supports a time range across midnight', () => {
    expect(
      notebookRangeDuration({
        ...range,
        startTime: '23:30',
        endDay: '2026-10-12',
        endTime: '00:30',
      }),
    ).toBe(3600000);
  });
  it('does not invent an estimate for all-day date ranges', () => {
    expect(
      notebookRangeDuration({ ...range, withTime: false, endDay: '2026-10-15' }),
    ).toBe(0);
    expect(notebookRangeDuration({ ...range, withTime: false })).toBe(0);
  });
  it('rejects reversed dates and zero or reversed timed durations', () => {
    expect(notebookRangeDuration({ ...range, endDay: '2026-10-10' })).toBeNull();
    expect(notebookRangeDuration({ ...range, endTime: '09:00' })).toBeNull();
    expect(notebookRangeDuration({ ...range, endTime: '08:00' })).toBeNull();
  });
  it('rejects invalid dates and times instead of silently normalizing them', () => {
    expect(notebookRangeDuration({ ...range, startDay: '2026-02-30' })).toBeNull();
    expect(notebookRangeDuration({ ...range, startTime: '25:00' })).toBeNull();
    expect(notebookRangeDuration({ ...range, endDay: '' })).toBeNull();
  });
});
