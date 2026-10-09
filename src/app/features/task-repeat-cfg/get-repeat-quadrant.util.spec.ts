import { getRepeatQuadrant } from './get-repeat-quadrant.util';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { DEFAULT_TASK_REPEAT_CFG } from './task-repeat-cfg.model';
import { EisenhowerQuadrant } from '../eisenhower-matrix/eisenhower-matrix.model';

describe('Repeat quadrant inheritance', () => {
  const cfg = {
    ...DEFAULT_TASK_REPEAT_CFG,
    id: 'repeat',
    eisenhowerQuadrant: EisenhowerQuadrant.SCHEDULE,
  };
  const instance = (created: number, quadrant: Task['eisenhowerQuadrant']): Task => ({
    ...DEFAULT_TASK,
    id: String(created),
    projectId: 'project',
    created,
    eisenhowerQuadrant: quadrant,
  });

  it('inherits the latest preceding root occurrence, including archived instances', () => {
    expect(
      getRepeatQuadrant(
        cfg,
        [
          instance(1, EisenhowerQuadrant.DO_FIRST),
          instance(2, EisenhowerQuadrant.DELEGATE),
          instance(4, EisenhowerQuadrant.ELIMINATE),
        ],
        3,
      ),
    ).toBe(EisenhowerQuadrant.DELEGATE);
  });

  it('preserves explicitly unclassified occurrences and ignores subtasks', () => {
    expect(
      getRepeatQuadrant(
        cfg,
        [
          instance(1, null),
          { ...instance(2, EisenhowerQuadrant.DO_FIRST), parentId: 'parent' },
        ],
        3,
      ),
    ).toBeNull();
  });

  it('uses the optional config default when old data has no quadrant', () => {
    expect(getRepeatQuadrant(cfg, [instance(1, undefined)], 2)).toBe(
      EisenhowerQuadrant.SCHEDULE,
    );
    expect(
      getRepeatQuadrant({ ...cfg, eisenhowerQuadrant: undefined }, [], 2),
    ).toBeNull();
  });

  it('resolves equal timestamps independently of enumeration order', () => {
    const first = { ...instance(1, EisenhowerQuadrant.DO_FIRST), id: 'a' };
    const second = { ...instance(1, EisenhowerQuadrant.SCHEDULE), id: 'b' };
    expect(getRepeatQuadrant(cfg, [first, second], 2)).toBe(
      getRepeatQuadrant(cfg, [second, first], 2),
    );
  });
});
