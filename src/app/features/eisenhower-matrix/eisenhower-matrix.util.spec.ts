import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { EisenhowerQuadrant, MatrixFilter } from './eisenhower-matrix.model';
import {
  filterMatrixTasks,
  getMatrixGroup,
  getMatrixTaskDates,
  getMatrixWeekRange,
  getMatrixWeekDates,
  shiftMatrixWeek,
  suggestEisenhowerQuadrant,
} from './eisenhower-matrix.util';

describe('Eisenhower Matrix classification and filters', () => {
  const today = '2026-10-09';
  const task = (fields: Partial<Task> = {}): Task => ({
    ...DEFAULT_TASK,
    id: 'task',
    projectId: 'project',
    ...fields,
  });
  const filter: MatrixFilter = { time: 'all', projectId: '', tagId: '' };

  it('reads both priority encodings without mutating the task', () => {
    for (const priority of [3, 'high'] as const) {
      const source = Object.freeze(task({ priority, dueDay: today }));
      expect(suggestEisenhowerQuadrant(source, today, 0)).toBe(
        EisenhowerQuadrant.DO_FIRST,
      );
      expect(source.eisenhowerQuadrant).toBeUndefined();
    }
    expect(
      suggestEisenhowerQuadrant(task({ priority: 3, dueDay: '2026-10-12' }), today, 0),
    ).toBe(EisenhowerQuadrant.SCHEDULE);
    expect(
      suggestEisenhowerQuadrant(
        task({ priority: 1, deadlineDay: '2026-10-08' }),
        today,
        0,
      ),
    ).toBe(EisenhowerQuadrant.DELEGATE);
    expect(suggestEisenhowerQuadrant(task(), today, 0)).toBe(
      EisenhowerQuadrant.ELIMINATE,
    );
  });

  it('keeps missing and explicitly cleared quadrants unclassified outside preview', () => {
    expect(
      getMatrixGroup(task({ priority: 3, dueDay: today }), false, today, 0),
    ).toBeNull();
    expect(
      getMatrixGroup(task({ eisenhowerQuadrant: null }), false, today, 0),
    ).toBeNull();
    const assigned = task({
      eisenhowerQuadrant: EisenhowerQuadrant.SCHEDULE,
      deadlineDay: today,
    });
    expect(getMatrixGroup(assigned, true, today, 0)).toBe(EisenhowerQuadrant.SCHEDULE);
  });

  it('gives each task exactly one group, even when both planned and deadline dates match', () => {
    const source = task({ dueDay: today, deadlineDay: today, priority: 3 });
    const groups = [null, ...Object.values(EisenhowerQuadrant)];
    expect(
      groups.filter((group) => getMatrixGroup(source, true, today, 0) === group).length,
    ).toBe(1);
    expect(filterMatrixTasks([source], { ...filter, time: 'today' }, today, 0)).toEqual([
      source,
    ]);
  });

  it('uses logical days for scheduled times and prefers timed values over legacy day fields', () => {
    const source = task({
      dueWithTime: new Date('2026-10-10T02:00:00').getTime(),
      dueDay: '2026-10-12',
      deadlineWithTime: new Date('2026-10-11T13:00:00').getTime(),
      deadlineDay: today,
    });
    expect(getMatrixTaskDates(source, 4 * 3600000)).toEqual({
      planned: today,
      deadline: '2026-10-11',
    });
    expect(
      filterMatrixTasks([source], { ...filter, time: 'today' }, today, 4 * 3600000),
    ).toEqual([source]);
  });

  it('combines date, project and tag filters while excluding completed tasks', () => {
    const included = task({ dueDay: '2026-10-05', tagIds: ['tag'] });
    const sources = [
      included,
      task({ id: 'done', isDone: true, dueDay: today, tagIds: ['tag'] }),
      task({ id: 'other-project', projectId: 'other', dueDay: today, tagIds: ['tag'] }),
      task({ id: 'other-tag', dueDay: today }),
      task({ id: 'next-week', dueDay: '2026-10-12', tagIds: ['tag'] }),
    ];
    expect(
      filterMatrixTasks(
        sources,
        { time: 'week', projectId: 'project', tagId: 'tag' },
        today,
        0,
      ),
    ).toEqual([included]);
    expect(filterMatrixTasks([task()], { ...filter, time: 'today' }, today, 0)).toEqual(
      [],
    );
  });

  it('honors the configured week start across month and year boundaries', () => {
    expect(getMatrixWeekRange('2027-01-01', 1)).toEqual({
      start: '2026-12-28',
      end: '2027-01-03',
    });
    expect(getMatrixWeekRange('2026-10-11', 0)).toEqual({
      start: '2026-10-11',
      end: '2026-10-17',
    });
  });

  it('filters a selected calendar date without changing task fields or importance', () => {
    const selected = Object.freeze(task({ dueDay: '2026-10-13', priority: 3 }));
    const deadline = task({ id: 'deadline', deadlineDay: '2026-10-13' });
    const sources = [selected, deadline, task({ id: 'today', dueDay: today })];
    expect(
      filterMatrixTasks(sources, { ...filter, time: 'day', day: '2026-10-13' }, today, 0),
    ).toEqual([selected, deadline]);
    expect(
      filterMatrixTasks(
        sources,
        { ...filter, time: 'today', day: '2026-10-13' },
        today,
        0,
      ),
    ).toEqual([sources[2]]);
    expect(selected.dueDay).toBe('2026-10-13');
    expect(selected.eisenhowerQuadrant).toBeUndefined();
    expect(suggestEisenhowerQuadrant(selected, today, 0)).toBe(
      EisenhowerQuadrant.SCHEDULE,
    );
  });

  it('filters the browsed week and preserves project/tag constraints', () => {
    const nextWeek = task({ dueDay: '2026-10-13', tagIds: ['tag'] });
    const sources = [
      nextWeek,
      task({ id: 'current-week', dueDay: today, tagIds: ['tag'] }),
      task({
        id: 'wrong-project',
        projectId: 'other',
        dueDay: '2026-10-13',
        tagIds: ['tag'],
      }),
    ];
    expect(
      filterMatrixTasks(
        sources,
        {
          time: 'week',
          day: '2026-10-13',
          projectId: 'project',
          tagId: 'tag',
        },
        today,
        0,
      ),
    ).toEqual([nextWeek]);
  });

  it('builds seven local calendar dates and moves weeks across year and DST boundaries', () => {
    expect(getMatrixWeekDates('2027-01-01', 1)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(getMatrixWeekDates('2026-10-11', 0)[0]).toBe('2026-10-11');
    expect(shiftMatrixWeek('2026-12-28', 1)).toBe('2027-01-04');
    expect(shiftMatrixWeek('2026-03-30', -1)).toBe('2026-03-23');
    expect(shiftMatrixWeek('2026-10-26', -1)).toBe('2026-10-19');
  });
});
