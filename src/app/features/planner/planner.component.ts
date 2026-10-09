import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DateService } from '../../core/date/date.service';
import { PlannerActions } from './store/planner.actions';
import { selectTaskFeatureState } from '../tasks/store/task.selectors';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { T } from '../../t.const';
import { PlannerCalendarViewComponent } from './planner-calendar-view/planner-calendar-view.component';
import { PlannerService } from './planner.service';
import { selectPlannerDayMap } from './store/planner.selectors';

@Component({
  selector: 'planner',
  templateUrl: './planner.component.html',
  styleUrl: './planner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlannerCalendarViewComponent],
})
export class PlannerComponent {
  private _store = inject(Store);
  private _dateService = inject(DateService);
  private _plannerService = inject(PlannerService);

  readonly T = T;

  private _days = toSignal(this._plannerService.days$, { initialValue: [] });
  private _plannerDayMap = toSignal(this._store.select(selectPlannerDayMap), {
    initialValue: {},
  });
  private _prevDaysWithTasksKey = '';
  private _prevDaysWithTasks: ReadonlySet<string> = new Set();
  daysWithTasks = computed<ReadonlySet<string>>(() => {
    const days = this._days();
    const plannerDayMap = this._plannerDayMap();
    const dayDates = new Set(
      Object.entries(plannerDayMap)
        .filter(([, tasks]) => tasks.length > 0)
        .map(([dayDate]) => dayDate),
    );
    for (const day of days) {
      if (day.tasks.length > 0) {
        dayDates.add(day.dayDate);
      }
    }
    const sortedDayDates = [...dayDates].sort();
    const key = sortedDayDates.join(',');
    if (key === this._prevDaysWithTasksKey) {
      return this._prevDaysWithTasks;
    }
    this._prevDaysWithTasksKey = key;
    this._prevDaysWithTasks = new Set(sortedDayDates);
    return this._prevDaysWithTasks;
  });

  constructor() {
    this._store
      .select(selectTaskFeatureState)
      .pipe(takeUntilDestroyed())
      .subscribe((taskState) => {
        this._store.dispatch(
          PlannerActions.cleanupOldAndUndefinedPlannerTasks({
            today: this._dateService.todayStr(),
            allTaskIds: taskState.ids as string[],
          }),
        );
      });
  }
}
