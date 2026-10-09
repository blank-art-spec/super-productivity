import { Task } from '../tasks/task.model';
import { TaskRepeatCfg } from './task-repeat-cfg.model';
import { EisenhowerQuadrant } from '../eisenhower-matrix/eisenhower-matrix.model';

// Inherit the most recent preceding occurrence. A later planned occurrence
// must not rewrite an earlier one; null is an explicit Unclassified choice.
export const getRepeatQuadrant = (
  cfg: TaskRepeatCfg,
  instances: readonly Task[],
  targetCreated: number,
): EisenhowerQuadrant | null => {
  const previous = instances
    .filter((task) => !task.parentId && task.created < targetCreated)
    .reduce<Task | undefined>((latest, task) => {
      if (!latest) return task;
      if (task.created !== latest.created)
        return task.created > latest.created ? task : latest;
      return task.id > latest.id ? task : latest;
    }, undefined);
  return previous?.eisenhowerQuadrant !== undefined
    ? previous.eisenhowerQuadrant
    : (cfg.eisenhowerQuadrant ?? null);
};
