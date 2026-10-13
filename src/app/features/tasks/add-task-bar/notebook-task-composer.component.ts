import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { T } from '../../../t.const';
import { AddTaskBarStateService } from './add-task-bar-state.service';
import { AddTaskBarParserService } from './add-task-bar-parser.service';
import { NotebookTaskDraftService } from './notebook-task-draft.service';
import { notebookRangeDuration, NotebookTimeRange } from './notebook-time-range';
import { DateService } from '../../../core/date/date.service';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { ProjectService } from '../../project/project.service';
import { INBOX_PROJECT } from '../../project/project.const';
import { TagService } from '../../tag/tag.service';
import { DialogPromptComponent } from '../../../ui/dialog-prompt/dialog-prompt.component';
import { DialogCreateProjectComponent } from '../../project/dialogs/create-project/dialog-create-project.component';
import {
  RepeatCycleOption,
  RepeatQuickSetting,
} from '../../task-repeat-cfg/task-repeat-cfg.model';
import { TaskReminderOptionId } from '../task.model';
import { TASK_REMINDER_OPTIONS } from '../../planner/dialog-schedule-task/task-reminder-options.const';
import { MATRIX_QUADRANTS } from '../../eisenhower-matrix/eisenhower-matrix.const';
import { EisenhowerQuadrant } from '../../eisenhower-matrix/eisenhower-matrix.model';
import { OperationWriteFlushService } from '../../../op-log/sync/operation-write-flush.service';
import { TaskService } from '../task.service';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { Dialog } from '@angular/cdk/dialog';
import { NotebookCalendarComponent } from './notebook-calendar.component';
import {
  hasChineseWorkdayCalendar,
  isChineseWorkday,
} from '../../../core/date/chinese-workday.util';

type NotebookRepeatChoice = Exclude<RepeatQuickSetting, 'CUSTOM'>;

type ComposerPanel =
  | 'quadrant'
  | 'children'
  | 'range'
  | 'repeat'
  | 'category'
  | 'reminder';

@Component({
  selector: 'notebook-task-composer',
  templateUrl: './notebook-task-composer.component.html',
  styleUrl: './notebook-task-composer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, MatIcon],
})
export class NotebookTaskComposerComponent {
  readonly state = inject(AddTaskBarStateService);
  readonly draft = inject(NotebookTaskDraftService);
  private readonly _parser = inject(AddTaskBarParserService);
  private readonly _date = inject(DateService);
  private readonly _projects = inject(ProjectService);
  private readonly _tags = inject(TagService);
  private readonly _dialog = inject(MatDialog);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _tasks = inject(TaskService);
  private readonly _flush = inject(OperationWriteFlushService);
  private readonly _dateFormat = inject(DateTimeFormatService);
  private readonly _calendarDialog = inject(Dialog);
  readonly T = T;
  readonly N = T.F.TASK.NOTEBOOK_ADD;
  readonly busy = input(false);
  readonly submitted = output<void>();
  readonly refocus = output<void>();
  readonly panel = signal<ComposerPanel | null>(null);
  readonly childText = signal('');
  readonly clearingQuadrant = signal(false);
  readonly pendingTaskId = this.draft.pendingTaskId;
  readonly range = signal<NotebookTimeRange>({
    startDay: this._date.todayStr(),
    endDay: this._date.todayStr(),
    withTime: false,
    startTime: '09:00',
    endTime: '10:00',
  });
  readonly repeatChoice = signal<NotebookRepeatChoice | null>(null);
  readonly repeatEvery = signal<number | null>(1);
  readonly repeatEndDay = signal<string | null>(null);
  readonly repeatCycle = computed<RepeatCycleOption>(() => {
    switch (this.repeatChoice()) {
      case 'WEEKLY_CURRENT_WEEKDAY':
        return 'WEEKLY';
      case 'MONTHLY_CURRENT_DATE':
        return 'MONTHLY';
      case 'YEARLY_CURRENT_DATE':
        return 'YEARLY';
      default:
        return 'DAILY';
    }
  });
  readonly repeatUnit = computed(
    () =>
      ({
        DAILY: this.N.REPEAT_DAYS,
        WEEKLY: this.N.REPEAT_WEEKS,
        MONTHLY: this.N.REPEAT_MONTHS,
        YEARLY: this.N.REPEAT_YEARS,
      })[this.repeatCycle()],
  );
  readonly repeatEndLabel = computed(() =>
    this.repeatEndDay()
      ? new Intl.DateTimeFormat(this._dateFormat.textLocale(), {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        }).format(new Date(`${this.repeatEndDay()}T12:00:00`))
      : null,
  );
  readonly isRepeatValid = computed(() => {
    const isWorkday = this.repeatChoice() === 'MONDAY_TO_FRIDAY';
    if (!this._isRepeatWindowValid(this.repeatEndDay(), isWorkday)) return false;
    if (isWorkday) return true;
    const every = this.repeatEvery();
    return every !== null && Number.isInteger(every) && every >= 1 && every <= 1000;
  });
  readonly isConfirmedRepeatValid = computed(() => {
    const repeat = this.state.state().repeat;
    if (!repeat || repeat.type === 'DIALOG') return true;
    return this._isRepeatWindowValid(repeat.endDate || null, !!repeat.isChineseWorkday);
  });
  readonly reminderChoice = signal(TaskReminderOptionId.DoNotRemind);
  readonly reminderTime = signal('09:00');
  readonly rangeDuration = computed(() => notebookRangeDuration(this.range()));
  readonly hasRangeEnd = signal(false);
  readonly rangeStartLabel = computed(() => this._formatDay(this.range().startDay));
  readonly rangeEndLabel = computed(() => this._formatDay(this.range().endDay));
  readonly reminderOptions = TASK_REMINDER_OPTIONS;
  readonly reminderIds = TaskReminderOptionId;
  readonly today = computed(() => this._date.todayStr());
  readonly tomorrow = computed(() => {
    const day = this._date.getLogicalTodayDate();
    day.setDate(day.getDate() + 1);
    return getDbDateStr(day);
  });
  readonly selectedDay = computed(() => this.state.state().date || this.today());
  readonly isOtherDay = computed(
    () => this.selectedDay() !== this.today() && this.selectedDay() !== this.tomorrow(),
  );
  readonly categories = this._tags.tagsNoMyDayAndNoListInTreeOrder;
  readonly goals = computed(() =>
    this._projects.listInTreeOrderForUI().filter((p) => p.id !== INBOX_PROJECT.id),
  );
  readonly categoryLabel = computed(() => {
    const state = this.state.state();
    const tag = this.categories().find((t) =>
      [...state.tagIds, ...state.tagIdsFromTxt].includes(t.id),
    );
    const goal = this.goals().find((p) => p.id === state.projectId);
    return tag?.title || goal?.title || null;
  });
  readonly quadrants = [
    EisenhowerQuadrant.DELEGATE,
    EisenhowerQuadrant.DO_FIRST,
    EisenhowerQuadrant.ELIMINATE,
    EisenhowerQuadrant.SCHEDULE,
  ].map((id) => MATRIX_QUADRANTS.find((q) => q.id === id)!);
  readonly repeatOptions: { value: NotebookRepeatChoice | null; label: string }[] = [
    { value: null, label: this.N.NO_REPEAT },
    { value: 'DAILY', label: this.N.DAILY },
    { value: 'WEEKLY_CURRENT_WEEKDAY', label: this.N.WEEKLY },
    { value: 'MONTHLY_CURRENT_DATE', label: this.N.MONTHLY },
    { value: 'YEARLY_CURRENT_DATE', label: this.N.YEARLY },
    { value: 'MONDAY_TO_FRIDAY', label: this.N.CHINESE_WORKDAYS },
  ];
  readonly selectedQuadrantIndex = computed(() =>
    this.quadrants.findIndex((q) => q.id === this.draft.quadrant()),
  );

  togglePanel(panel: ComposerPanel): void {
    if (this.busy() || this.pendingTaskId()) return;
    this.clearingQuadrant.set(false);
    if (this.panel() === panel) {
      this.panel.set(null);
      return;
    }
    if (panel === 'range') {
      const state = this.state.state();
      const start = state.date || this.today();
      this.hasRangeEnd.set(!!state.deadlineDate || !!state.time);
      const end = state.time
        ? new Date(`${start}T${state.time}:00`)
        : new Date(`${start}T09:00:00`);
      end.setTime(end.getTime() + (state.estimate || 3600000));
      this.range.set({
        startDay: start,
        endDay: state.deadlineDate || getDbDateStr(end),
        withTime: !!state.time,
        startTime: state.time || '09:00',
        endTime:
          state.deadlineTime ||
          `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
      });
    }
    if (panel === 'repeat') {
      const repeat = this.state.state().repeat;
      this.repeatChoice.set(
        repeat?.isChineseWorkday
          ? 'MONDAY_TO_FRIDAY'
          : repeat?.type === 'INTERVAL'
            ? (
                {
                  DAILY: 'DAILY',
                  WEEKLY: 'WEEKLY_CURRENT_WEEKDAY',
                  MONTHLY: 'MONTHLY_CURRENT_DATE',
                  YEARLY: 'YEARLY_CURRENT_DATE',
                } as const
              )[repeat.repeatCycle]
            : repeat?.type === 'PRESET'
              ? repeat.quickSetting
              : null,
      );
      this.repeatEvery.set(repeat?.type === 'INTERVAL' ? repeat.repeatEvery : 1);
      this.repeatEndDay.set(repeat?.endDate || null);
    }
    if (panel === 'reminder') {
      this.reminderChoice.set(
        this.state.state().remindOption || TaskReminderOptionId.DoNotRemind,
      );
      this.reminderTime.set(this.state.state().time || '09:00');
    }
    this.panel.set(panel);
  }

  private _isRepeatWindowValid(end: string | null, isWorkday: boolean): boolean {
    const start = this.selectedDay();
    if (end && end < start) return false;
    if (!isWorkday) return true;
    if (!hasChineseWorkdayCalendar(start)) return false;
    const next = new Date(`${start}T12:00:00`);
    while (
      hasChineseWorkdayCalendar(getDbDateStr(next)) &&
      !isChineseWorkday(getDbDateStr(next))
    )
      next.setDate(next.getDate() + 1);
    return (
      hasChineseWorkdayCalendar(getDbDateStr(next)) && (!end || getDbDateStr(next) <= end)
    );
  }

  selectDay(day: string): void {
    if (!day) return;
    const state = this.state.state();
    this._parser.applyUserDatePick(day, state.time, state.remindOption);
  }

  selectQuadrant(quadrant: EisenhowerQuadrant): void {
    this.draft.selectQuadrant(quadrant);
    this.panel.set(null);
    this.refocus.emit();
  }

  clearQuadrant(): void {
    if (this.draft.quadrant()) this.clearingQuadrant.set(true);
    else this.panel.set(null);
  }

  finishQuadrantAnimation(): void {
    if (!this.clearingQuadrant()) return;
    this.draft.selectQuadrant(null);
    this.clearingQuadrant.set(false);
    this.panel.set(null);
  }

  openCalendar(target: 'day' | 'start' | 'end' | 'repeatEnd'): void {
    const date =
      target === 'day'
        ? this.selectedDay()
        : target === 'repeatEnd'
          ? this.repeatEndDay() || this.selectedDay()
          : target === 'start'
            ? this.range().startDay
            : this.range().endDay;
    this._calendarDialog
      .open<string>(NotebookCalendarComponent, {
        data: date,
        width: 'min(88vw, 420px)',
        autoFocus: false,
        backdropClass: 'notebook-overlay-backdrop',
      })
      .closed.pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((day) => {
        if (!day) return;
        if (target === 'day') this.selectDay(day);
        else if (target === 'repeatEnd') this.repeatEndDay.set(day);
        else this.patchRange(target === 'start' ? { startDay: day } : { endDay: day });
      });
  }

  addChild(): void {
    if (this.draft.addChild(this.childText())) this.childText.set('');
  }

  patchRange(patch: Partial<NotebookTimeRange>): void {
    if (patch.endDay) this.hasRangeEnd.set(true);
    this.range.update((range) => ({ ...range, ...patch }));
  }

  private _formatDay(day: string): string {
    if (!day) return '';
    return new Intl.DateTimeFormat(this._dateFormat.textLocale(), {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(new Date(`${day}T12:00:00`));
  }

  confirmRange(): void {
    const range = this.range();
    const duration = this.rangeDuration();
    if (duration === null) return;
    this._parser.applyUserDatePick(
      range.startDay,
      range.withTime ? range.startTime : null,
      range.withTime ? this.state.state().remindOption : TaskReminderOptionId.DoNotRemind,
    );
    if (range.withTime) this._parser.applyUserEstimatePick(duration);
    // A multi-day date range uses the existing deadline, not a new persisted field.
    if (range.endDay !== range.startDay || range.withTime) {
      this._parser.applyUserDeadlinePick(
        range.endDay,
        range.withTime ? range.endTime : null,
        null,
      );
    } else {
      this.state.clearDeadline(
        this._parser.removeShortSyntaxFromInput(this.state.inputTxt(), 'deadline'),
      );
    }
    this.panel.set(null);
  }

  confirmRepeat(): void {
    const choice = this.repeatChoice();
    if (choice && !this.isRepeatValid()) return;
    if (choice) {
      const limits = this.repeatEndDay() ? { endDate: this.repeatEndDay()! } : {};
      this._parser.applyUserRepeatPick(
        choice === 'MONDAY_TO_FRIDAY'
          ? {
              type: 'INTERVAL',
              repeatCycle: 'DAILY',
              repeatEvery: 1,
              isChineseWorkday: true,
              ...limits,
            }
          : this.repeatEvery() !== 1
            ? {
                type: 'INTERVAL',
                repeatCycle: this.repeatCycle(),
                repeatEvery: this.repeatEvery()!,
                ...limits,
              }
            : { type: 'PRESET', quickSetting: choice, ...limits },
      );
    } else {
      this.state.clearRepeatSetting(
        this._parser.removeShortSyntaxFromInput(this.state.inputTxt(), 'repeat'),
      );
    }
    this.panel.set(null);
  }

  confirmReminder(): void {
    const choice = this.reminderChoice();
    const time =
      choice === TaskReminderOptionId.DoNotRemind
        ? this.state.state().time
        : this.reminderTime();
    if (
      choice !== TaskReminderOptionId.DoNotRemind &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')
    )
      return;
    this._parser.applyUserDatePick(this.selectedDay(), time, choice);
    this.panel.set(null);
  }

  selectCategory(tagId: string | null): void {
    this._parser.applyUserContextPick(INBOX_PROJECT.id, tagId ? [tagId] : []);
    this.panel.set(null);
  }

  selectGoal(projectId: string): void {
    this._parser.applyUserContextPick(projectId, []);
    this.panel.set(null);
  }

  createCategory(): void {
    this._dialog
      .open(DialogPromptComponent, { data: { placeholder: this.N.NEW_CATEGORY } })
      .afterClosed()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((title: string | undefined) => {
        if (title?.trim())
          this.selectCategory(this._tags.addTag({ title: title.trim() }));
      });
  }

  createGoal(): void {
    this._dialog
      .open(DialogCreateProjectComponent)
      .afterClosed()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((id: string | undefined) => {
        if (id) this.selectGoal(id);
      });
  }

  /** Resume on a failed flush without creating the parent or committed children twice. */
  async completeSubtasks(taskId: string): Promise<void> {
    this.draft.setPendingTaskId(taskId);
    while (this.draft.children().length) {
      await this._flush.flushPendingWrites();
      const title = this.draft.children()[0];
      this._tasks.addSubTaskTo(taskId, {
        title,
        eisenhowerQuadrant: this.draft.quadrant(),
      });
      this.draft.removeChild(0);
    }
    await this._flush.flushPendingWrites();
    this.draft.setPendingTaskId(null);
  }
}
