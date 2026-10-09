import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DateService } from '../../core/date/date.service';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';

@Component({
  selector: 'tasksmart-date',
  template: '<time [attr.datetime]="today()">{{ label() }}</time>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksmartDateComponent {
  private readonly _date = inject(DateService);
  private readonly _format = inject(DateTimeFormatService);
  readonly today = toSignal(inject(GlobalTrackingIntervalService).todayDateStr$, {
    initialValue: this._date.todayStr(),
  });
  readonly label = computed(() =>
    new Intl.DateTimeFormat(this._format.textLocale(), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${this.today()}T12:00:00`)),
  );
}
