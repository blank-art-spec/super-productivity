import { inject, Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { filter, map, withLatestFrom } from 'rxjs/operators';
import { LOCAL_ACTIONS } from '../../../util/local-actions.token';
import {
  moveTaskInTodayList,
  moveTaskUpInTodayList,
  moveTaskDownInTodayList,
  moveTaskToTopInTodayList,
  moveTaskToBottomInTodayList,
} from '../../work-context/store/work-context-meta.actions';
import { moveItemAfterAnchor } from '../../work-context/store/work-context-meta.helper';
import { selectActiveWorkContext } from '../../work-context/store/work-context.selectors';
import { selectTaskEntities } from '../../tasks/store/task.selectors';
import { selectAllTaskRepeatCfgs } from './task-repeat-cfg.selectors';
import { updateTaskRepeatCfg } from './task-repeat-cfg.actions';
import { getMovedRepeatTaskRank } from '../repeat-task-order';
import { orderRepeatTaskIds } from '../repeat-task-order';
import { TaskSharedActions } from '../../../root-store/meta/task-shared.actions';
import { selectTagFeatureState } from '../../tag/store/tag.reducer';
import { TODAY_TAG } from '../../tag/tag.const';
import { moveItemBeforeItem } from '../../../util/move-item-before-item';
import { PlannerActions } from '../../planner/store/planner.actions';
import { selectPlannerState } from '../../planner/store/planner.selectors';
import {
  moveProjectTaskInBacklogList,
  moveProjectTaskUpInBacklogList,
  moveProjectTaskDownInBacklogList,
  moveProjectTaskToTopInBacklogList,
  moveProjectTaskToBottomInBacklogList,
} from '../../project/store/project.actions';
import {
  arrayMoveLeft,
  arrayMoveRight,
  arrayMoveToStart,
  arrayMoveToEnd,
} from '../../../util/array-move';
import { Task } from '../../tasks/task.model';
import { TaskRepeatCfg } from '../task-repeat-cfg.model';

@Injectable()
export class RepeatTaskOrderEffects {
  private readonly _actions$ = inject(LOCAL_ACTIONS);
  private readonly _store = inject(Store);

  // The ordinary move owns this occurrence's position. A separate, single-series
  // patch saves the user's preference for all occurrences, including future ones.
  readonly rememberOrder$ = createEffect(() =>
    this._actions$.pipe(
      ofType(moveTaskInTodayList, moveProjectTaskInBacklogList),
      filter(
        (action) =>
          action.type === moveProjectTaskInBacklogList.type ||
          (action.src === 'UNDONE' && action.target === 'UNDONE'),
      ),
      withLatestFrom(
        this._store.select(selectActiveWorkContext),
        this._store.select(selectTaskEntities),
        this._store.select(selectAllTaskRepeatCfgs),
      ),
      map(([action, context, entities, cfgs]) => ({
        task: entities[action.taskId],
        rank: getMovedRepeatTaskRank(
          action.taskId,
          moveItemAfterAnchor(
            action.taskId,
            action.afterTaskId,
            action.type === moveProjectTaskInBacklogList.type
              ? context.backlogTaskIds || []
              : context.taskIds,
          ),
          entities,
          cfgs,
        ),
      })),
      filter(({ task, rank }) => !!task?.repeatCfgId && rank !== undefined),
      map(({ task, rank }) =>
        updateTaskRepeatCfg({
          taskRepeatCfg: { id: task!.repeatCfgId!, changes: { listOrder: rank } },
          isAskToUpdateAllTaskInstances: false,
        }),
      ),
    ),
  );

  readonly rememberPlannerOrder$ = createEffect(() =>
    this._actions$.pipe(
      ofType(PlannerActions.moveInList, TaskSharedActions.moveTaskInTodayTagList),
      withLatestFrom(
        this._store.select(selectTaskEntities),
        this._store.select(selectAllTaskRepeatCfgs),
        this._store.select(selectPlannerState),
        this._store.select(selectTagFeatureState),
      ),
      map(([action, entities, cfgs, planner, tags]) => {
        if (action.type === PlannerActions.moveInList.type) {
          const ids = orderRepeatTaskIds(
            planner.days[action.targetDay] || [],
            entities,
            cfgs,
          );
          const taskId = action.taskId;
          return taskId
            ? this._rankUpdate(
                taskId,
                moveItemAfterAnchor(taskId, action.afterTaskId ?? null, ids),
                entities,
                cfgs,
              )
            : undefined;
        }
        const ids = orderRepeatTaskIds(
          tags.entities[TODAY_TAG.id]?.taskIds || [],
          entities,
          cfgs,
        );
        return this._rankUpdate(
          action.fromTaskId,
          moveItemBeforeItem(ids, action.fromTaskId, action.toTaskId),
          entities,
          cfgs,
        );
      }),
      filter((action): action is ReturnType<typeof updateTaskRepeatCfg> => !!action),
    ),
  );

  readonly rememberKeyboardOrder$ = createEffect(() =>
    this._actions$.pipe(
      ofType(
        moveTaskUpInTodayList,
        moveTaskDownInTodayList,
        moveTaskToTopInTodayList,
        moveTaskToBottomInTodayList,
        moveProjectTaskUpInBacklogList,
        moveProjectTaskDownInBacklogList,
        moveProjectTaskToTopInBacklogList,
        moveProjectTaskToBottomInBacklogList,
      ),
      withLatestFrom(
        this._store.select(selectTaskEntities),
        this._store.select(selectAllTaskRepeatCfgs),
      ),
      map(([action, entities, cfgs]) => {
        const ids =
          'doneTaskIds' in action ? action.doneTaskIds : action.doneBacklogTaskIds;
        const up =
          action.type === moveTaskUpInTodayList.type ||
          action.type === moveProjectTaskUpInBacklogList.type;
        const down =
          action.type === moveTaskDownInTodayList.type ||
          action.type === moveProjectTaskDownInBacklogList.type;
        const top =
          action.type === moveTaskToTopInTodayList.type ||
          action.type === moveProjectTaskToTopInBacklogList.type;
        const reordered = up
          ? arrayMoveLeft(ids, action.taskId)
          : down
            ? arrayMoveRight(ids, action.taskId)
            : top
              ? arrayMoveToStart(ids, action.taskId)
              : arrayMoveToEnd(ids, action.taskId);
        return this._rankUpdate(action.taskId, reordered, entities, cfgs);
      }),
      filter((action): action is ReturnType<typeof updateTaskRepeatCfg> => !!action),
    ),
  );

  private _rankUpdate(
    taskId: string,
    ids: string[],
    entities: Record<string, Task | undefined>,
    cfgs: TaskRepeatCfg[],
  ): ReturnType<typeof updateTaskRepeatCfg> | undefined {
    const rank = getMovedRepeatTaskRank(taskId, ids, entities, cfgs);
    const cfgId = entities[taskId]?.repeatCfgId;
    return cfgId && rank !== undefined
      ? updateTaskRepeatCfg({
          taskRepeatCfg: { id: cfgId, changes: { listOrder: rank } },
          isAskToUpdateAllTaskInstances: false,
        })
      : undefined;
  }
}
