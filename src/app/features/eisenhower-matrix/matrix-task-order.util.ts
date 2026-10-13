import { Task } from '../tasks/task.model';

const taskKey = (task: Task): string => `task:${task.id}`;
const repeatKey = (task: Task): string | undefined =>
  task.repeatCfgId ? `repeat:${task.repeatCfgId}` : undefined;

/** Sorting is independent of dates; future repeat instances inherit their series' anchor. */
export const sortMatrixTasks = (
  tasks: readonly Task[],
  order: readonly string[],
): Task[] => {
  const positions = new Map(order.map((key, index) => [key, index]));
  const position = (task: Task): number =>
    positions.get(taskKey(task)) ?? positions.get(repeatKey(task) ?? '') ?? order.length;
  return [...tasks].sort((a, b) => position(a) - position(b));
};

/** Replace only visible slots, preserving hidden tasks, other quadrants and series anchors. */
export const reorderMatrixTasks = (
  order: readonly string[],
  tasks: readonly Task[],
  movedTaskId: string,
  targetIndex: number,
  allTasks: readonly Task[] = tasks,
): string[] | null => {
  const sourceIndex = tasks.findIndex((task) => task.id === movedTaskId);
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= tasks.length ||
    sourceIndex === targetIndex
  )
    return null;

  const nextOrder = [...new Set(order)];
  const knownKeys = new Set(nextOrder);
  const orderedTasks = sortMatrixTasks(allTasks, order);
  // Materialize new instances next to their saved anchor before replacing slots.
  // Reverse traversal keeps multiple instances of the same series in display order.
  for (const task of [...orderedTasks].reverse()) {
    const key = taskKey(task);
    const anchor = repeatKey(task);
    if (!knownKeys.has(key) && anchor && knownKeys.has(anchor)) {
      nextOrder.splice(nextOrder.indexOf(anchor) + 1, 0, key);
      knownKeys.add(key);
    }
  }
  for (const task of orderedTasks) {
    const key = taskKey(task);
    if (!knownKeys.has(key)) {
      nextOrder.push(key);
      knownKeys.add(key);
    }
  }

  const reordered = tasks.map(taskKey);
  const [movedKey] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, movedKey);
  const visibleKeys = new Set(reordered);
  let index = 0;
  const result = nextOrder.map((key) =>
    visibleKeys.has(key) ? reordered[index++] : key,
  );

  // Keep future instances with their visible representative. Moving one instance
  // also updates its series anchor, without overriding other instances' own positions.
  const representatives = new Map<string, string>();
  const tasksByKey = new Map(tasks.map((task) => [taskKey(task), task]));
  for (const key of reordered) {
    const task = tasksByKey.get(key)!;
    const anchor = repeatKey(task);
    if (anchor && (!representatives.has(anchor) || task.id === movedTaskId)) {
      representatives.set(anchor, key);
    }
  }
  for (const [anchor, key] of representatives) {
    const previousIndex = result.indexOf(anchor);
    if (previousIndex >= 0) result.splice(previousIndex, 1);
    result.splice(result.indexOf(key), 0, anchor);
  }
  return result;
};
