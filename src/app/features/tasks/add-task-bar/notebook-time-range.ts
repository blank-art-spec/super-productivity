export interface NotebookTimeRange {
  startDay: string;
  endDay: string;
  withTime: boolean;
  startTime: string;
  endTime: string;
}

/** Local wall-clock arithmetic, also across midnight and daylight-saving changes. */
export const notebookRangeDuration = (range: NotebookTimeRange): number | null => {
  const timestamp = (day: string, clock: string): number => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(clock)) {
      return NaN;
    }
    const [year, month, date] = day.split('-').map(Number);
    const [hours, minutes] = clock.split(':').map(Number);
    const result = new Date(year, month - 1, date, hours, minutes);
    return result.getFullYear() === year &&
      result.getMonth() === month - 1 &&
      result.getDate() === date &&
      result.getHours() === hours &&
      result.getMinutes() === minutes
      ? result.getTime()
      : NaN;
  };
  const start = timestamp(range.startDay, range.withTime ? range.startTime : '00:00');
  const end = timestamp(range.endDay, range.withTime ? range.endTime : '00:00');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  if (range.withTime && end === start) return null;
  return range.withTime ? end - start : 0;
};
