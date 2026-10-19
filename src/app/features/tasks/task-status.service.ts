import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { selectTaskEntities } from './store/task.selectors';
import { Task } from './task.model';

@Injectable({ providedIn: 'root' })
export class TaskStatusService {
  private readonly _store = inject(Store);
  private readonly _entities = this._store.selectSignal(selectTaskEntities);

  /**
   * 完成指定任务，并联动完成其未完成的子任务。
   * 已经独立完成的子任务保持原状态和完成时间，便于之后选择性取消完成。
   * @param id 用户直接勾选的任务标识，可以是父任务或子任务。
   */
  complete(id: string): void {
    void this._resolve(id, false);
  }

  /**
   * 将任务及其子任务标记为放弃完成，沿用现有的放弃状态规则。
   * @param id 用户选择放弃完成的任务标识。
   */
  abandon(id: string): void {
    void this._resolve(id, true);
  }

  /**
   * 取消指定任务的完成状态，并恢复由它联动完成的子任务。
   * 手动完成的子任务、没有来源记录的旧任务以及放弃完成的子任务均保留原状态。
   * @param id 用户直接反选的任务标识；反选子任务不会影响兄弟任务。
   */
  reopen(id: string): void {
    void this._reopen(id);
  }

  /**
   * 在复选框动画与任务状态修改之间协调时序。
   * @param id 当前点击的任务标识。
   * @param isDone 点击前是否已经完成；为 true 时立即取消完成。
   * @param setAnimation 设置勾选动画显示状态的回调。
   * @returns 完成动画的定时器标识；取消完成时没有定时器，返回 undefined。
   */
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

  /**
   * 通过普通任务更新完成一次完成或放弃操作，保留每个任务已有的副作用和同步边界。
   * @param id 本次操作的目标任务标识。
   * @param isAbandoned true 表示放弃完成；false 表示正常完成并记录子任务的联动来源。
   * @returns 所有状态更新已派发，且已让出一次事件循环；不代表同步写盘已经结束。
   */
  private async _resolve(id: string, isAbandoned: boolean): Promise<void> {
    const entities = this._entities();
    const task = entities[id];
    if (!task) return;
    const children = new Set(task.subTaskIds);
    for (const candidate of Object.values(entities)) {
      if (candidate?.parentId === id) children.add(candidate.id);
    }
    const doneOn = Date.now();
    // 继续逐个派发普通更新，使完成音效、重复计划和每个任务的同步冲突边界保持一致。
    for (const taskId of [...children, id]) {
      if (!entities[taskId]) continue;
      if (
        taskId !== id &&
        !isAbandoned &&
        entities[taskId]?.isDone &&
        !entities[taskId]?.isAbandoned
      )
        continue;
      const changes: Partial<Task> = {
        isDone: true,
        isAbandoned,
        doneOn,
        // 只为随父任务正常完成的子任务记录来源；手动完成和放弃操作显式清空来源。
        doneByParentId: taskId !== id && !isAbandoned ? id : null,
      };
      this._store.dispatch(
        TaskSharedActions.updateTask({ task: { id: taskId, changes } }),
      );
    }
    // 大量子任务连续更新后让出事件循环，使操作日志能够开始持久化。
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  /**
   * 从当前状态查出联动完成的直属子任务，然后逐个取消完成并清除来源标记。
   * 以子任务自身的 parentId 为准，避免父任务列表中的过期条目误改已移动的任务。
   * @param id 被反选的任务标识；不存在时忽略本次操作。
   * @returns 所有取消完成操作已派发，并已让出一次事件循环以便记录操作日志。
   */
  private async _reopen(id: string): Promise<void> {
    const entities = this._entities();
    if (!entities[id]) return;
    const children = Object.values(entities).filter(
      (candidate): candidate is Task =>
        !!candidate &&
        candidate.parentId === id &&
        candidate.isDone &&
        !candidate.isAbandoned &&
        candidate.doneByParentId === id,
    );
    for (const taskId of [...children.map((child) => child.id), id]) {
      this._store.dispatch(
        TaskSharedActions.updateTask({
          task: {
            id: taskId,
            // null 在 JSON 保存和同步后仍然存在，避免旧的联动来源在重放时残留。
            changes: { isDone: false, isAbandoned: false, doneByParentId: null },
          },
        }),
      );
    }
    // 与完成操作一样，为大量子任务的操作日志留出开始写盘的机会。
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
