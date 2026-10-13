import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { TaskService } from '../tasks/task.service';
import { Task } from '../tasks/task.model';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { WorkContextType } from '../work-context/work-context.model';
import { MatrixGroupId } from './eisenhower-matrix.model';
import { GlobalConfigService } from '../config/global-config.service';
import { reorderMatrixTasks } from './matrix-task-order.util';

@Injectable()
export class EisenhowerMatrixService {
  private readonly _store = inject(Store);
  private readonly _taskService = inject(TaskService);
  private readonly _config = inject(GlobalConfigService);

  reorder(
    tasks: readonly Task[],
    movedTaskId: string,
    targetIndex: number,
    allTasks: readonly Task[] = tasks,
  ): void {
    const order = reorderMatrixTasks(
      this._config.misc()?.matrixTaskOrder ?? [],
      tasks,
      movedTaskId,
      targetIndex,
      allTasks,
    );
    if (order) {
      // One existing config field patch persists the entire move as a single op.
      this._config.updateSection('misc', { matrixTaskOrder: order }, true);
    }
  }

  add(title: string, fields: Partial<Task> & { projectId: string }): string {
    // The matrix is global: never inherit Today, project or tags from the last route.
    const task = this._taskService.createNewTaskWithDefaults({
      title,
      workContextId: fields.projectId,
      workContextType: WorkContextType.PROJECT,
      additional: { dueDay: null, dueWithTime: null, tagIds: [], ...fields },
    });
    this._store.dispatch(
      TaskSharedActions.addTask({
        task,
        workContextId: fields.projectId,
        workContextType: WorkContextType.PROJECT,
        isAddToBacklog: false,
        isAddToBottom: true,
        isIgnoreShortSyntax: true,
      }),
    );
    return task.id;
  }

  classify(task: Task, quadrant: MatrixGroupId): void {
    if ((task.eisenhowerQuadrant ?? null) === quadrant) return;
    // Single-entity field patch uses the existing persistence/conflict path.
    this._taskService.update(task.id, { eisenhowerQuadrant: quadrant });
  }

  update(task: Task, fields: Partial<Task>): void {
    const changes = { ...fields };
    if ('dueWithTime' in changes && task.remindAt !== undefined) {
      if (changes.dueWithTime != null && task.dueWithTime != null) {
        changes.remindAt = task.remindAt + changes.dueWithTime - task.dueWithTime;
      } else {
        // As in the scheduling dialog, clear through the existing id-only action:
        // an undefined field in a generic update would disappear on JSON replay.
        this._store.dispatch(
          TaskSharedActions.dismissReminderOnly({ id: task.id, isSkipSnack: true }),
        );
      }
    }
    if (Object.keys(changes).length) this._taskService.update(task.id, changes);
  }
}
