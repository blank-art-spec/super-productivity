import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { selectTaskEntities } from './store/task.selectors';
import { Task } from './task.model';

@Injectable({ providedIn: 'root' })
export class TaskStatusService {
  private readonly _store = inject(Store);
  private readonly _entities = this._store.selectSignal(selectTaskEntities);

  complete(id: string): void {
    void this._resolve(id, false);
  }

  abandon(id: string): void {
    void this._resolve(id, true);
  }

  reopen(id: string): void {
    this._store.dispatch(
      TaskSharedActions.updateTask({
        task: { id, changes: { isDone: false, isAbandoned: false } },
      }),
    );
  }

  toggleDoneWithAnimation(
    id: string,
    isDone: boolean,
    setAnimation: (animate: boolean) => void,
  ): number | undefined {
    setAnimation(!isDone);
    if (isDone) {
      this.reopen(id);
      return undefined;
    }
    return window.setTimeout(() => this.complete(id), 200);
  }

  private async _resolve(id: string, isAbandoned: boolean): Promise<void> {
    const entities = this._entities();
    const task = entities[id];
    if (!task) return;
    const children = new Set(task.subTaskIds);
    for (const candidate of Object.values(entities)) {
      if (candidate?.parentId === id) children.add(candidate.id);
    }
    const doneOn = Date.now();
    // Each task retains its ordinary completion effects and per-entity conflict
    // boundary, as in project completion. Never emit an opaque multi-task op.
    for (const taskId of [...children, id]) {
      if (!entities[taskId]) continue;
      if (
        taskId !== id &&
        !isAbandoned &&
        entities[taskId]?.isDone &&
        !entities[taskId]?.isAbandoned
      )
        continue;
      const changes: Partial<Task> = { isDone: true, isAbandoned, doneOn };
      this._store.dispatch(
        TaskSharedActions.updateTask({ task: { id: taskId, changes } }),
      );
    }
    // Let capture start persisting even when a parent has 50+ children.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
