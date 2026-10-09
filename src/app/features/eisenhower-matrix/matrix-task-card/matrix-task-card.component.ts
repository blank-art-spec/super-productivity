import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { LocaleDatePipe } from '../../../ui/pipes/locale-date.pipe';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { Task } from '../../tasks/task.model';
import { MsToStringPipe } from '../../../ui/duration/ms-to-string.pipe';
import { T } from '../../../t.const';
import { MATRIX_QUADRANTS } from '../eisenhower-matrix.const';
import { MatrixGroupId } from '../eisenhower-matrix.model';
import { getMatrixTaskDates } from '../eisenhower-matrix.util';

@Component({
  selector: 'matrix-task-card',
  imports: [LocaleDatePipe, MatIcon, MatMenuModule, TranslatePipe, MsToStringPipe],
  templateUrl: './matrix-task-card.component.html',
  styleUrl: './matrix-task-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrixTaskCardComponent {
  private readonly _dateTimeFormat = inject(DateTimeFormatService);
  readonly task = input.required<Task>();
  readonly projectTitle = input('');
  readonly currentTaskId = input<string | null>(null);
  readonly isSuggested = input(false);
  readonly isFocusEnabled = input(true);
  readonly isFocusModeEnabled = input(true);
  readonly compact = input(false);
  readonly today = input('');
  readonly dayOffset = input(0);
  readonly dateLocale = this._dateTimeFormat.currentLocale;
  readonly dateFormat = this._dateTimeFormat.dateFormat;
  readonly complete = output<Task>();
  readonly edit = output<Task>();
  readonly details = output<Task>();
  readonly focusTask = output<Task>();
  readonly remove = output<Task>();
  readonly classify = output<MatrixGroupId>();
  readonly acceptSuggestion = output<Task>();
  readonly T = T;
  readonly quadrants = MATRIX_QUADRANTS;
  readonly isCurrent = computed(() => this.currentTaskId() === this.task().id);
  readonly planned = computed(() => this.task().dueWithTime ?? this.task().dueDay);
  readonly deadline = computed(
    () => this.task().deadlineWithTime ?? this.task().deadlineDay,
  );
  readonly hasPlannedTime = computed(() => this.task().dueWithTime != null);
  readonly hasDeadlineTime = computed(() => this.task().deadlineWithTime != null);
  readonly isOverdue = computed(() => {
    if (!this.today()) return false;
    const dates = getMatrixTaskDates(this.task(), this.dayOffset());
    return !!(
      (dates.planned && dates.planned < this.today()) ||
      (dates.deadline && dates.deadline < this.today())
    );
  });
}
