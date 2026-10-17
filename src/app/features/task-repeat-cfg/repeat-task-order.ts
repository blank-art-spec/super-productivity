import { Task } from '../tasks/task.model';
import { TaskRepeatCfg } from './task-repeat-cfg.model';

export const getRepeatTaskRanks = (cfgs: TaskRepeatCfg[]): Map<string, number> => {
  // Legacy integer orders insert nonpositive groups at the top (in reverse
  // creation order) and positive groups at the bottom. This baseline does not
  // shift when a new config is appended to the entity store.
  return new Map(
    cfgs.map((cfg, index) => {
      const offset = ((cfg.order > 0 ? 1 : -1) * index) / (index + 1);
      return [cfg.id, cfg.listOrder ?? cfg.order + offset] as const;
    }),
  );
};

/** Keep ordinary and finished tasks in their slots; sort recurring peers by rank. */
export const orderRepeatTaskIds = (
  ids: string[],
  entities: Record<string, Task | undefined>,
  cfgs: TaskRepeatCfg[],
): string[] => {
  if (!cfgs.some((cfg) => cfg.listOrder !== undefined)) return ids;
  const ranks = getRepeatTaskRanks(cfgs);
  const groups = new Map<string, { positions: number[]; ids: string[] }>();
  ids.forEach((id, index) => {
    const task = entities[id];
    if (
      !task?.repeatCfgId ||
      task.parentId ||
      task.isDone ||
      !ranks.has(task.repeatCfgId)
    )
      return;
    const day = task.dueDay || '';
    const group = groups.get(day) ?? { positions: [], ids: [] };
    group.positions.push(index);
    group.ids.push(id);
    groups.set(day, group);
  });
  const result = [...ids];
  for (const group of groups.values()) {
    group.ids.sort(
      (a, b) =>
        ranks.get(entities[a]!.repeatCfgId!)! - ranks.get(entities[b]!.repeatCfgId!)!,
    );
    group.positions.forEach((position, index) => {
      result[position] = group.ids[index];
    });
  }
  return result;
};

/** Only the moved series changes: unrelated series keep their own sync boundary. */
export const getMovedRepeatTaskRank = (
  taskId: string,
  ids: string[],
  entities: Record<string, Task | undefined>,
  cfgs: TaskRepeatCfg[],
): number | undefined => {
  const task = entities[taskId];
  if (!task?.repeatCfgId || task.parentId || task.isDone) return undefined;
  const ranks = getRepeatTaskRanks(cfgs);
  if (!ranks.has(task.repeatCfgId)) return undefined;
  const peers = ids.filter((id) => {
    const peer = entities[id];
    return (
      peer?.repeatCfgId &&
      !peer.parentId &&
      !peer.isDone &&
      (peer.dueDay || '') === (task.dueDay || '') &&
      ranks.has(peer.repeatCfgId)
    );
  });
  const index = peers.indexOf(taskId);
  if (index < 0 || peers.length < 2) return undefined;
  const prev = ranks.get(entities[peers[index - 1]]?.repeatCfgId ?? '');
  const next = ranks.get(entities[peers[index + 1]]?.repeatCfgId ?? '');
  return prev === undefined
    ? next! - 1
    : next === undefined
      ? prev + 1
      : (prev + next) / 2;
};
