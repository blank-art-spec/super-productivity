import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { isDBDateStr } from '../../util/get-db-date-str';
import { selectTaskEntities } from '../tasks/store/task.selectors';
import { Task } from '../tasks/task.model';
import {
  findRepeatSubTaskTemplateIndex,
  getRepeatSubTaskTemplateId,
} from './repeat-end-date.util';
import { updateTaskRepeatCfg } from './store/task-repeat-cfg.actions';
import { selectAllTaskRepeatCfgs } from './store/task-repeat-cfg.selectors';
import { TaskRepeatCfg } from './task-repeat-cfg.model';

interface SubTaskRepeatContext {
  parent: Task;
  cfg: TaskRepeatCfg;
  index: number;
  endDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class SubTaskRepeatEndService {
  private readonly _store = inject(Store);
  private readonly _entities = this._store.selectSignal(selectTaskEntities);
  private readonly _configs = this._store.selectSignal(selectAllTaskRepeatCfgs);

  getContext(task: Task): SubTaskRepeatContext | null {
    if (!task.parentId) return null;
    const parent = this._entities()[task.parentId];
    if (!parent?.repeatCfgId) return null;
    const cfg = this._configs().find((item) => item.id === parent.repeatCfgId);
    if (!cfg) return null;
    const index = findRepeatSubTaskTemplateIndex(
      task,
      parent,
      cfg.subTaskTemplates ?? [],
    );
    const template = cfg.subTaskTemplates?.[index];
    const endDate =
      template?.repeatEndDate !== undefined
        ? template.repeatEndDate
        : (task.repeatEndDate ?? null);
    return { parent, cfg, index, endDate };
  }

  setEndDate(taskId: string, endDate: string | null): void {
    if (endDate && !isDBDateStr(endDate)) return;
    const task = this._entities()[taskId];
    if (!task) return;
    const context = this.getContext(task);
    if (!context) return;
    const { cfg, index, parent } = context;
    const templates = (cfg.subTaskTemplates ?? []).map((template, i) => ({
      ...template,
      id: getRepeatSubTaskTemplateId(template, i, cfg.id),
      ...(!template.id && parent.subTaskIds.length === cfg.subTaskTemplates?.length
        ? { sourceTaskId: parent.subTaskIds[i] }
        : {}),
    }));
    const id = index >= 0 ? templates[index].id : task.repeatSubTaskId || task.id;
    if (index >= 0) {
      templates[index] = { ...templates[index], repeatEndDate: endDate };
    } else {
      templates.push({
        id,
        title: task.title,
        notes: task.notes,
        timeEstimate: task.timeEstimate,
        repeatEndDate: endDate,
      });
    }
    // Ordinary per-entity patches: template controls future creation; the task
    // patch labels this existing child. Neither operation deletes occurrences.
    this._store.dispatch(
      updateTaskRepeatCfg({
        taskRepeatCfg: { id: cfg.id, changes: { subTaskTemplates: templates } },
        isAskToUpdateAllTaskInstances: false,
      }),
    );
    this._store.dispatch(
      TaskSharedActions.updateTask({
        task: { id: taskId, changes: { repeatEndDate: endDate, repeatSubTaskId: id } },
      }),
    );
  }
}
