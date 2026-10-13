import { notebookCalendarDays, notebookCalendarInfo } from './notebook-calendar.util';

describe('Notebook calendar dates', () => {
  it('uses six full weeks and the configured first weekday across years', () => {
    const days = notebookCalendarDays('2026-10', 1);
    expect(days.length).toBe(42);
    expect(days[0]).toBe('2026-09-28');
    expect(days[41]).toBe('2026-11-08');
    expect(notebookCalendarDays('2027-01', 0)[0]).toBe('2026-12-27');
    expect(new Set(days).size).toBe(42);
  });

  it('matches lunar month boundaries and the 2026 solar terms in the reference', () => {
    expect(notebookCalendarInfo('2026-10-11').lunar).toBe('初二');
    expect(notebookCalendarInfo('2026-10-10').lunar).toBe('九月');
    expect(notebookCalendarInfo('2026-10-08').labelKey).toContain('COLD_DEW');
    expect(notebookCalendarInfo('2026-10-23').labelKey).toContain('FROST');
    expect(notebookCalendarInfo('2026-10-18').labelKey).toContain('DOUBLE_NINTH');
  });

  it('marks actual statutory adjustments and does not invent future adjustments', () => {
    expect(notebookCalendarInfo('2026-10-01').holiday).toBe('off');
    expect(notebookCalendarInfo('2026-10-07').holiday).toBe('off');
    expect(notebookCalendarInfo('2026-10-08').holiday).toBeNull();
    expect(notebookCalendarInfo('2026-10-10').holiday).toBe('work');
    expect(notebookCalendarInfo('2026-09-20').holiday).toBe('work');
    expect(notebookCalendarInfo('2027-10-10').holiday).toBeNull();
    expect(notebookCalendarInfo('2026-09-25').labelKey).toContain('MID_AUTUMN');
  });
});
