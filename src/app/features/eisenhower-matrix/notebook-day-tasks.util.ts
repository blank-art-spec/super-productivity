import { Task } from '../tasks/task.model';
import { getDbDateStr } from '../../util/get-db-date-str';
import { getMatrixTaskDates } from './eisenhower-matrix.util';

/** Parent plans count once; children contribute through the parent's done state. */
export const notebookTasksForDay = (
  tasks: readonly Task[],
  day: string,
  today: string,
  offset: number,
): Task[] =>
  tasks.filter((task) => {
    if (task.parentId || !task.eisenhowerQuadrant) return false;
    const { planned, deadline } = getMatrixTaskDates(task, offset);
    if (planned || deadline) return planned === day || deadline === day;
    if (task.isDone && task.doneOn) return getDbDateStr(task.doneOn - offset) === day;
    return !task.isDone && day === today;
  });
