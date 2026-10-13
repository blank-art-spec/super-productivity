import { DEFAULT_TASK_REPEAT_CFG, TaskRepeatCfg } from '../task-repeat-cfg.model';
import { getFirstRepeatOccurrence } from './get-first-repeat-occurrence.util';
import { getNextRepeatOccurrence } from './get-next-repeat-occurrence.util';
import { getNewestPossibleDueDate } from './get-newest-possible-due-date.util';
import { getDbDateStr } from '../../../util/get-db-date-str';
import {
  selectTaskRepeatCfgsForExactDay,
  selectAllUnprocessedTaskRepeatCfgs,
} from './task-repeat-cfg.selectors';

const date = (day: string): Date => new Date(`${day}T12:00:00`);
const dayOf = (value: Date | null): string | null => (value ? getDbDateStr(value) : null);
const cfg = (fields: Partial<TaskRepeatCfg> = {}): TaskRepeatCfg => ({
  ...DEFAULT_TASK_REPEAT_CFG,
  id: 'bounded',
  startDate: '2026-10-12',
  lastTaskCreationDay: '2026-10-11',
  repeatCycle: 'DAILY',
  quickSetting: 'CUSTOM',
  ...fields,
});

describe('repeat occurrence limits through generation and planner selectors', () => {
  it('keeps month-end intervals on the correct month in both directions', () => {
    const config = cfg({
      repeatCycle: 'MONTHLY',
      repeatEvery: 3,
      startDate: '2026-01-31',
      lastTaskCreationDay: '2026-01-31',
      endDate: '2026-04-30',
    });
    expect(dayOf(getNextRepeatOccurrence(config, date('2026-01-31')))).toBe('2026-04-30');
    expect(dayOf(getNewestPossibleDueDate(config, date('2026-04-30')))).toBe(
      '2026-04-30',
    );
    expect(
      dayOf(getNewestPossibleDueDate({ ...config, endDate: null }, date('2026-05-30'))),
    ).toBe('2026-04-30');
    const monthly = { ...config, repeatEvery: 1, endDate: null };
    expect(dayOf(getNewestPossibleDueDate(monthly, date('2026-03-30')))).toBe(
      '2026-02-28',
    );
  });

  it('uses February 28 in non-leap years and restores February 29 in leap years', () => {
    const config = cfg({
      repeatCycle: 'YEARLY',
      startDate: '2024-02-29',
      lastTaskCreationDay: '2024-02-29',
      endDate: '2025-02-28',
    });
    expect(dayOf(getNextRepeatOccurrence(config, date('2024-02-29')))).toBe('2025-02-28');
    expect(dayOf(getNewestPossibleDueDate(config, date('2025-02-28')))).toBe(
      '2025-02-28',
    );
    const midnight = date('2025-02-28');
    midnight.setHours(0);
    expect(dayOf(getNewestPossibleDueDate(config, midnight))).toBe('2025-02-28');
    expect(getNextRepeatOccurrence(config, date('2025-02-28'))).toBeNull();
    expect(
      selectTaskRepeatCfgsForExactDay.projector([config], {
        dayDate: date('2025-02-28').getTime(),
      }),
    ).toEqual([config]);
    const leap = { ...config, endDate: null, lastTaskCreationDay: '2027-02-28' };
    expect(dayOf(getNextRepeatOccurrence(leap, date('2027-02-28')))).toBe('2028-02-29');
    expect(dayOf(getNewestPossibleDueDate(leap, date('2028-02-29')))).toBe('2028-02-29');
  });
  it('generates configured intervals for every supported cycle, including the editor maximum', () => {
    for (const repeatCycle of ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const) {
      for (const repeatEvery of [2, 1000]) {
        const config = cfg({
          repeatCycle,
          repeatEvery,
          monday: true,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
        });
        const expected = date(config.startDate!);
        if (repeatCycle === 'DAILY') expected.setDate(expected.getDate() + repeatEvery);
        if (repeatCycle === 'WEEKLY') {
          const intervalDays = repeatEvery * 7;
          expected.setDate(expected.getDate() + intervalDays);
        }
        if (repeatCycle === 'MONTHLY')
          expected.setMonth(expected.getMonth() + repeatEvery);
        if (repeatCycle === 'YEARLY')
          expected.setFullYear(expected.getFullYear() + repeatEvery);
        const next = getNextRepeatOccurrence(config, date(config.startDate!));
        expect(dayOf(next))
          .withContext(`${repeatCycle} every ${repeatEvery}`)
          .toBe(getDbDateStr(expected));
        expect(dayOf(getNewestPossibleDueDate(config, expected))).toBe(
          getDbDateStr(expected),
        );
      }
    }
  });
  it('includes the end day for all cycles and projects nothing beyond it', () => {
    for (const repeatCycle of ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const) {
      const config = cfg({ repeatCycle, endDate: '2026-10-12', monday: true });
      expect(dayOf(getFirstRepeatOccurrence(config))).toBe('2026-10-12');
      expect(
        dayOf(getNextRepeatOccurrence(config, date('2026-10-12'), { inclusive: true })),
      ).toBe('2026-10-12');
      expect(getNextRepeatOccurrence(config, date('2026-10-12'))).toBeNull();
      expect(getNewestPossibleDueDate(config, date('2026-10-13'))).toBeNull();
      expect(
        selectTaskRepeatCfgsForExactDay.projector([config], {
          dayDate: date('2026-10-13').getTime(),
        }),
      ).toEqual([]);
      expect(
        selectAllUnprocessedTaskRepeatCfgs.projector([config], {
          dayDate: date('2026-10-13').getTime(),
        }),
      ).toEqual([]);
    }
  });
  it('skips holidays for first, next and scheduled occurrences and respects an earlier end', () => {
    const config = cfg({
      isChineseWorkday: true,
      startDate: '2026-10-01',
      lastTaskCreationDay: '2026-09-30',
    });
    expect(dayOf(getFirstRepeatOccurrence(config))).toBe('2026-10-08');
    expect(dayOf(getNextRepeatOccurrence(config, date('2026-09-30')))).toBe('2026-10-08');
    expect(
      selectTaskRepeatCfgsForExactDay.projector([config], {
        dayDate: date('2026-10-01').getTime(),
      }),
    ).toEqual([]);
    expect(
      selectTaskRepeatCfgsForExactDay.projector([config], {
        dayDate: date('2026-10-08').getTime(),
      }),
    ).toEqual([config]);
    expect(getFirstRepeatOccurrence({ ...config, endDate: '2026-10-07' })).toBeNull();
    expect(
      getNextRepeatOccurrence({ ...config, endDate: '2026-10-07' }, date('2026-09-30')),
    ).toBeNull();
  });
  it('includes statutory Sunday makeup work and skips normal weekends', () => {
    const config = cfg({
      isChineseWorkday: true,
      startDate: '2026-09-18',
      lastTaskCreationDay: '2026-09-18',
    });
    expect(dayOf(getNextRepeatOccurrence(config, date('2026-09-18')))).toBe('2026-09-20');
    expect(dayOf(getNewestPossibleDueDate(config, date('2026-09-20')))).toBe(
      '2026-09-20',
    );
  });
  it('preserves legacy recurrence without limits and allows clearing an end date', () => {
    expect(dayOf(getNextRepeatOccurrence(cfg(), date('2026-10-12')))).toBe('2026-10-13');
    expect(
      dayOf(
        getNextRepeatOccurrence(
          cfg({ endDate: null, isChineseWorkday: false }),
          date('2026-10-12'),
        ),
      ),
    ).toBe('2026-10-13');
    expect(
      getNextRepeatOccurrence(
        cfg({
          isChineseWorkday: true,
          startDate: '2026-12-31',
          lastTaskCreationDay: '2026-12-31',
        }),
        date('2026-12-31'),
      ),
    ).toBeNull();
  });
});
