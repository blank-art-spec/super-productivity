import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { DateService } from '../../../core/date/date.service';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { GlobalConfigService } from '../../config/global-config.service';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { notebookCalendarDays, notebookCalendarInfo } from './notebook-calendar.util';
import { T } from '../../../t.const';

@Component({
  selector: 'notebook-calendar',
  imports: [TranslatePipe],
  templateUrl: './notebook-calendar.component.html',
  styleUrl: './notebook-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotebookCalendarComponent {
  private readonly _ref = inject<DialogRef<string>>(DialogRef);
  private readonly _format = inject(DateTimeFormatService);
  private readonly _config = inject(GlobalConfigService);
  readonly today = inject(DateService).todayStr();
  readonly selected = signal(inject<string>(DIALOG_DATA));
  readonly month = signal(this.selected().slice(0, 7));
  readonly showLunar = signal(this._format.textLocale().startsWith('zh'));
  readonly T = T;
  readonly N = T.F.TASK.NOTEBOOK_ADD;
  readonly title = computed(() =>
    new Intl.DateTimeFormat(this._format.textLocale(), {
      year: 'numeric',
      month: 'long',
    }).format(new Date(`${this.month()}-01T12:00:00`)),
  );
  readonly days = computed(() =>
    notebookCalendarDays(
      this.month(),
      this._config.localization()?.firstDayOfWeek ?? 1,
    ).map((day) => ({
      day,
      number: Number(day.slice(8)),
      outside: day.slice(0, 7) !== this.month(),
      label: new Intl.DateTimeFormat(this._format.textLocale(), {
        dateStyle: 'full',
      }).format(new Date(`${day}T12:00:00`)),
      ...notebookCalendarInfo(day),
    })),
  );
  readonly weekdays = computed(() =>
    this.days()
      .slice(0, 7)
      .map(({ day }) =>
        new Intl.DateTimeFormat(this._format.textLocale(), { weekday: 'narrow' }).format(
          new Date(`${day}T12:00:00`),
        ),
      ),
  );

  navigate(direction: -1 | 1): void {
    const date = new Date(`${this.month()}-01T12:00:00`);
    date.setMonth(date.getMonth() + direction);
    this.month.set(getDbDateStr(date).slice(0, 7));
  }

  close(confirm: boolean): void {
    this._ref.close(confirm ? this.selected() : undefined);
  }
}
