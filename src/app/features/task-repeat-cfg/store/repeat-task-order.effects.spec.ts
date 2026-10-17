import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Action } from '@ngrx/store';
import { Subject } from 'rxjs';
import { LOCAL_ACTIONS } from '../../../util/local-actions.token';
import { RepeatTaskOrderEffects } from './repeat-task-order.effects';
import { selectAllTaskRepeatCfgs } from './task-repeat-cfg.selectors';
import { selectTaskEntities } from '../../tasks/store/task.selectors';
import { selectActiveWorkContext } from '../../work-context/store/work-context.selectors';
import {
  moveTaskInTodayList,
  moveTaskToTopInTodayList,
} from '../../work-context/store/work-context-meta.actions';
import { DEFAULT_TASK } from '../../tasks/task.model';
import { DEFAULT_TASK_REPEAT_CFG } from '../task-repeat-cfg.model';
import { TODAY_TAG } from '../../tag/tag.const';
import { WorkContextType } from '../../work-context/work-context.model';
import { updateTaskRepeatCfg } from './task-repeat-cfg.actions';
import { orderRepeatTaskIds } from '../repeat-task-order';
import { selectPlannerState } from '../../planner/store/planner.selectors';
import { selectTagFeatureState } from '../../tag/store/tag.reducer';
import { PlannerActions } from '../../planner/store/planner.actions';
import { TaskSharedActions } from '../../../root-store/meta/task-shared.actions';

describe('RepeatTaskOrderEffects', () => {
  const cfgs = ['a', 'b', 'c'].map((id) => ({ ...DEFAULT_TASK_REPEAT_CFG, id }));
  const entities = Object.fromEntries(
    cfgs.map((cfg) => [
      cfg.id,
      { ...DEFAULT_TASK, id: cfg.id, projectId: '', repeatCfgId: cfg.id },
    ]),
  );
  let actions$: Subject<Action>;
  let effects: RepeatTaskOrderEffects;

  beforeEach(() => {
    actions$ = new Subject<Action>();
    TestBed.configureTestingModule({
      providers: [
        RepeatTaskOrderEffects,
        { provide: LOCAL_ACTIONS, useValue: actions$ },
        provideMockStore({
          selectors: [
            { selector: selectAllTaskRepeatCfgs, value: cfgs },
            { selector: selectTaskEntities, value: entities },
            {
              selector: selectActiveWorkContext,
              value: {
                ...TODAY_TAG,
                type: WorkContextType.TAG,
                routerLink: '',
                taskIds: ['c', 'b', 'a'],
              },
            },
            {
              selector: selectPlannerState,
              value: { days: Object.fromEntries([['2026-10-18', ['c', 'a', 'b']]]) },
            },
            {
              selector: selectTagFeatureState,
              value: {
                entities: { TODAY: { ...TODAY_TAG, taskIds: ['c', 'a', 'b'] } },
                ids: ['TODAY'],
              },
            },
          ],
        }),
      ],
    });
    effects = TestBed.inject(RepeatTaskOrderEffects);
  });

  afterEach(() => actions$.complete());

  it('saves a single-series patch and applies it to occurrences on another day', () => {
    const emitted: ReturnType<typeof updateTaskRepeatCfg>[] = [];
    const subscription = effects.rememberOrder$.subscribe((a) => emitted.push(a));
    actions$.next(
      moveTaskInTodayList({
        taskId: 'a',
        afterTaskId: 'c',
        src: 'UNDONE',
        target: 'UNDONE',
        workContextId: 'TODAY',
        workContextType: WorkContextType.TAG,
      }),
    );
    expect(emitted.length).toBe(1);
    expect(emitted[0].meta.entityId).toBe('a');
    expect('entityIds' in emitted[0].meta).toBeFalse();
    const nextCfgs = cfgs.map((cfg) =>
      cfg.id === 'a' ? { ...cfg, ...emitted[0].taskRepeatCfg.changes } : cfg,
    );
    expect(orderRepeatTaskIds(['c', 'b', 'a'], entities, nextCfgs)).toEqual([
      'c',
      'a',
      'b',
    ]);
    subscription.unsubscribe();
  });

  it('does not record completion-list moves as recurring order changes', () => {
    const next = jasmine.createSpy('next');
    const subscription = effects.rememberOrder$.subscribe(next);
    actions$.next(
      moveTaskInTodayList({
        taskId: 'a',
        afterTaskId: 'c',
        src: 'UNDONE',
        target: 'DONE',
        workContextId: 'TODAY',
        workContextType: WorkContextType.TAG,
      }),
    );
    expect(next).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('records the explicit anchor when dragging in a future planner day', () => {
    const next = jasmine.createSpy('next');
    const subscription = effects.rememberPlannerOrder$.subscribe(next);
    actions$.next(
      PlannerActions.moveInList({
        targetDay: '2026-10-18',
        fromIndex: 2,
        toIndex: 1,
        taskId: 'a',
        afterTaskId: 'c',
      }),
    );
    expect(next).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        taskRepeatCfg: { id: 'a', changes: { listOrder: jasmine.any(Number) } },
      }),
    );
    subscription.unsubscribe();
  });

  it('records recurring order changes from the planner Today column', () => {
    const next = jasmine.createSpy('next');
    const subscription = effects.rememberPlannerOrder$.subscribe(next);
    actions$.next(
      TaskSharedActions.moveTaskInTodayTagList({ fromTaskId: 'a', toTaskId: 'b' }),
    );
    expect(next).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        taskRepeatCfg: { id: 'a', changes: { listOrder: jasmine.any(Number) } },
      }),
    );
    subscription.unsubscribe();
  });

  it('keeps keyboard reordering usable after recurring order is enabled', () => {
    const next = jasmine.createSpy('next');
    const subscription = effects.rememberKeyboardOrder$.subscribe(next);
    actions$.next(
      moveTaskToTopInTodayList({
        taskId: 'a',
        doneTaskIds: ['c', 'b', 'a'],
        workContextId: 'TODAY',
        workContextType: WorkContextType.TAG,
      }),
    );
    expect(next).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        taskRepeatCfg: { id: 'a', changes: { listOrder: jasmine.any(Number) } },
      }),
    );
    subscription.unsubscribe();
  });
});
