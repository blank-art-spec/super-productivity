import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { DEFAULT_TASK_REPEAT_CFG, TaskRepeatCfg } from './task-repeat-cfg.model';
import {
  buildRepeatSubTaskTemplates,
  findRepeatSubTaskTemplateIndex,
  isWithinRepeatEndDate,
} from './repeat-end-date.util';
import { getFirstRepeatOccurrence } from './store/get-first-repeat-occurrence.util';
import { getNextRepeatOccurrence } from './store/get-next-repeat-occurrence.util';
import { getNewestPossibleDueDate } from './store/get-newest-possible-due-date.util';
import { getDbDateStr } from '../../util/get-db-date-str';
import { selectTaskRepeatCfgsForExactDay } from './store/task-repeat-cfg.selectors';

const day = (date: number): Date => new Date(2026, 9, date, 12);
const config = (changes: Partial<TaskRepeatCfg> = {}): TaskRepeatCfg => ({
  ...DEFAULT_TASK_REPEAT_CFG,
  id: 'repeat',
  repeatCycle: 'DAILY',
  startDate: '2026-10-18',
  lastTaskCreationDay: '2026-10-18',
  endDate: '2026-10-19',
  ...changes,
});
const task = (id: string, changes: Partial<Task> = {}): Task => ({
  ...DEFAULT_TASK,
  projectId: 'project',
  id,
  title: id,
  subTaskIds: [],
  created: day(20).getTime(),
  ...changes,
});

describe('Repeat end dates', () => {
  it('includes the last day and leaves missing or cleared limits unlimited', () => {
    expect(isWithinRepeatEndDate('2026-10-19', '2026-10-19')).toBeTrue();
    expect(isWithinRepeatEndDate('2026-10-19', '2026-10-20')).toBeFalse();
    expect(isWithinRepeatEndDate(null, '2026-10-20')).toBeTrue();
    expect(isWithinRepeatEndDate(undefined, '2026-10-20')).toBeTrue();
  });

  for (const cycle of ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const) {
    it(`bounds ${cycle} first, next, due and planner occurrences`, () => {
      const cfg = config({ repeatCycle: cycle, startDate: '2026-10-19', monday: true });
      expect(getDbDateStr(getFirstRepeatOccurrence(cfg)!)).toBe('2026-10-19');
      expect(
        getDbDateStr(getNextRepeatOccurrence(cfg, day(19), { inclusive: true })!),
      ).toBe('2026-10-19');
      expect(getNewestPossibleDueDate(cfg, day(19))).not.toBeNull();
      expect(
        getNextRepeatOccurrence({ ...cfg, lastTaskCreationDay: '2026-10-19' }, day(19)),
      ).toBeNull();
      expect(getNewestPossibleDueDate(cfg, day(20))).toBeNull();
      expect(
        selectTaskRepeatCfgsForExactDay.projector([cfg], { dayDate: day(20).getTime() }),
      ).toEqual([]);
      expect(getFirstRepeatOccurrence({ ...cfg, endDate: '2026-10-18' })).toBeNull();
    });
  }

  it('does not invent a weekly occurrence when the end day is not selected', () => {
    expect(
      getFirstRepeatOccurrence(
        config({ repeatCycle: 'WEEKLY', startDate: '2026-10-18', endDate: '2026-10-18' }),
      ),
    ).toBeNull();
  });

  it('clearing a parent end date restores future generation', () => {
    expect(getNewestPossibleDueDate(config({ endDate: null }), day(20))).not.toBeNull();
  });

  it('preserves expired templates while a later child is edited', () => {
    const previous = [
      { id: 'legacy-0', title: 'Expired', repeatEndDate: '2026-10-19' },
      { id: 'legacy-1', title: 'Ongoing' },
    ];
    const parent = task('parent', { subTaskIds: ['parent_sub_1'] });
    const sub = task('parent_sub_1', {
      repeatSubTaskId: 'legacy-1',
      title: 'Edited ongoing',
      parentId: parent.id,
    });
    const result = buildRepeatSubTaskTemplates([sub], previous, parent);
    expect(result[0]).toBe(previous[0]);
    expect(result[1].title).toBe('Edited ongoing');
    expect(result[1].id).toBe('legacy-1');
    expect(result).toHaveSize(2);
  });

  it('resolves legacy indices after template reorder without matching duplicate titles', () => {
    const parent = task('parent', { subTaskIds: ['parent_sub_0', 'parent_sub_1'] });
    const templates = [
      { id: 'legacy-1', title: 'Same' },
      { id: 'legacy-0', title: 'Same' },
    ];
    expect(findRepeatSubTaskTemplateIndex(task('parent_sub_0'), parent, templates)).toBe(
      1,
    );
    expect(
      findRepeatSubTaskTemplateIndex(
        task('parent_sub_1', { repeatSubTaskId: 'legacy-1' }),
        parent,
        templates,
      ),
    ).toBe(0);
  });

  it('keeps the binding of original non-deterministic children after reorder', () => {
    const parent = task('parent', { subTaskIds: ['b', 'a'] });
    const templates = [
      { id: 'legacy-0', sourceTaskId: 'a', title: 'Same', repeatEndDate: '2026-10-19' },
      { id: 'legacy-1', sourceTaskId: 'b', title: 'Same' },
    ];
    const result = buildRepeatSubTaskTemplates([task('b'), task('a')], templates, {
      ...parent,
      created: day(19).getTime(),
    });
    expect(result.map((item) => item.id)).toEqual(['legacy-1', 'legacy-0']);
    expect(result[1].repeatEndDate).toBe('2026-10-19');
  });

  it('keeps a changed or cleared template limit when another existing instance is edited', () => {
    const parent = task('parent', { subTaskIds: ['parent_sub_0'] });
    const sub = task('parent_sub_0', {
      repeatSubTaskId: 'legacy-0',
      parentId: parent.id,
      repeatEndDate: '2026-10-19',
    });
    for (const repeatEndDate of [null, '2026-10-21']) {
      const templates = [{ id: 'legacy-0', title: 'Child', repeatEndDate }];
      expect(buildRepeatSubTaskTemplates([sub], templates, parent)[0].repeatEndDate)
        .withContext(
          'The current template controls future generation, not an old row snapshot',
        )
        .toBe(repeatEndDate);
    }
  });
});
