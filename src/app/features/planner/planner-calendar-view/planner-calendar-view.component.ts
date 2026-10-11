import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { DateService } from '../../../core/date/date.service';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';
import { GlobalConfigService } from '../../config/global-config.service';
import { parseDbDateStr } from '../../../util/parse-db-date-str';
import { T } from '../../../t.const';
import { PlannerService } from '../planner.service';
import { LayoutService } from '../../../core-ui/layout/layout.service';
import { PlannerCalendarNavComponent } from '../planner-calendar-nav/planner-calendar-nav.component';
import { PlannerDayComponent } from '../planner-day/planner-day.component';
import { PlannerPlanViewComponent } from '../planner-plan-view/planner-plan-view.component';
import {
  getPlannerCalendarDates,
  PlannerCalendarView,
  shiftPlannerCalendarDate,
} from '../util/planner-calendar.util';

@Component({
  selector: 'planner-calendar-view',
  imports: [
    CdkDropListGroup,
    CdkScrollable,
    MatIcon,
    TranslatePipe,
    PlannerDayComponent,
    PlannerPlanViewComponent,
    PlannerCalendarNavComponent,
  ],
  templateUrl: './planner-calendar-view.component.html',
  styleUrl: './planner-calendar-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannerCalendarViewComponent {
  private readonly _date = inject(DateService);
  private readonly _format = inject(DateTimeFormatService);
  private readonly _config = inject(GlobalConfigService);
  private readonly _planner = inject(PlannerService);
  readonly T = T;
  readonly layout = inject(LayoutService);
  readonly daysWithTasks = input<ReadonlySet<string>>(new Set());
  readonly view = signal<PlannerCalendarView>('week');
  private readonly _anchor = signal<string | null>(null);
  readonly today = toSignal(inject(GlobalTrackingIntervalService).todayDateStr$, {
    initialValue: this._date.todayStr(),
  });
  readonly anchor = computed(() => this._anchor() ?? this.today());
  readonly dates = computed(() =>
    getPlannerCalendarDates(
      this.anchor(),
      this.view(),
      this._config.localization()?.firstDayOfWeek ?? 1,
    ),
  );
  readonly days = toSignal(this._planner.selectCalendarDays$(toObservable(this.dates)), {
    initialValue: [],
  });
  readonly title = computed(() =>
    parseDbDateStr(this.anchor()).toLocaleDateString(
      this._format.textLocale(),
      this.view() === 'day' ? { dateStyle: 'full' } : { month: 'long', year: 'numeric' },
    ),
  );
  readonly weekDays = computed(() => {
    const locale = this._format.textLocale();
    const counts = new Map(this.days().map((day) => [day.dayDate, day.itemsTotal]));
    return this.dates().map((day) => {
      const date = parseDbDateStr(day);
      return {
        day,
        number: date.getDate(),
        weekday: date.toLocaleDateString(locale, { weekday: 'short' }),
        label: date.toLocaleDateString(locale, { dateStyle: 'full' }),
        hasItems: !!counts.get(day),
      };
    });
  });
  readonly weekdays = computed(() =>
    this.dates()
      .slice(0, 7)
      .map((day) =>
        parseDbDateStr(day).toLocaleDateString(this._format.textLocale(), {
          weekday: 'short',
        }),
      ),
  );
  readonly cells = computed(() =>
    this.days().map((day) => ({
      day,
      number: parseDbDateStr(day.dayDate).getDate(),
      label: parseDbDateStr(day.dayDate).toLocaleDateString(this._format.textLocale(), {
        dateStyle: 'full',
      }),
      isOutsideMonth: day.dayDate.slice(0, 7) !== this.anchor().slice(0, 7),
    })),
  );
  readonly visibleDays = computed(() =>
    this.view() === 'month' || (this.view() === 'week' && this.layout.isXs())
      ? this.days().filter((day) => day.dayDate === this.anchor())
      : this.days(),
  );
  readonly views = [
    { id: 'month', label: T.F.PLANNER.CALENDAR.MONTH },
    { id: 'week', label: T.F.PLANNER.CALENDAR.WEEK },
    { id: 'day', label: T.F.PLANNER.CALENDAR.DAY },
    { id: 'agenda', label: T.F.PLANNER.CALENDAR.AGENDA },
  ] as const;

  navigate(direction: -1 | 1): void {
    this._anchor.set(shiftPlannerCalendarDate(this.anchor(), this.view(), direction));
  }
  goToToday(): void {
    this._anchor.set(null);
  }
  selectDay(day: string): void {
    this._anchor.set(day);
  }
}
