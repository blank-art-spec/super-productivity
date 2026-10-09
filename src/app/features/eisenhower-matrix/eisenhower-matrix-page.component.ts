import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map, startWith } from 'rxjs';
import { T } from '../../t.const';
import { DateService } from '../../core/date/date.service';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { GlobalConfigService } from '../config/global-config.service';
import { DefaultStartPage } from '../config/default-start-page.const';
import { selectAllTasksInActiveProjects } from '../tasks/store/task.selectors';
import { selectUnarchivedProjects } from '../project/store/project.selectors';
import { selectAllTagsWithoutMyDay } from '../tag/store/tag.reducer';
import { INBOX_PROJECT } from '../project/project.const';
import { Task } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { FocusModeService } from '../focus-mode/focus-mode.service';
import { DialogConfirmComponent } from '../../ui/dialog-confirm/dialog-confirm.component';
import { MATRIX_QUADRANTS } from './eisenhower-matrix.const';
import { MatrixGroupId, MatrixTimeFilter } from './eisenhower-matrix.model';
import {
  filterMatrixTasks,
  getMatrixGroup,
  getMatrixTaskDates,
  getMatrixWeekDates,
  shiftMatrixWeek,
  suggestEisenhowerQuadrant,
} from './eisenhower-matrix.util';
import { EisenhowerMatrixService } from './eisenhower-matrix.service';
import { MatrixQuadrantComponent } from './matrix-quadrant/matrix-quadrant.component';
import { MatrixTaskCardComponent } from './matrix-task-card/matrix-task-card.component';
import {
  MatrixTaskEditorComponent,
  MatrixTaskEditorData,
  MatrixTaskEditorResult,
} from './matrix-task-editor/matrix-task-editor.component';

@Component({
  selector: 'eisenhower-matrix-page',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    MatIcon,
    TranslatePipe,
    MatrixQuadrantComponent,
    MatrixTaskCardComponent,
  ],
  providers: [EisenhowerMatrixService],
  templateUrl: './eisenhower-matrix-page.component.html',
  styleUrl: './eisenhower-matrix-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EisenhowerMatrixPageComponent {
  private readonly _store = inject(Store);
  private readonly _dateService = inject(DateService);
  private readonly _format = inject(DateTimeFormatService);
  private readonly _injector = inject(Injector);
  private readonly _clock = inject(GlobalTrackingIntervalService);
  private readonly _dialog = inject(MatDialog);
  private readonly _matrix = inject(EisenhowerMatrixService);
  private readonly _focusMode = inject(FocusModeService);
  readonly config = inject(GlobalConfigService);
  readonly taskService = inject(TaskService);
  readonly T = T;
  readonly isDataLoaded = toSignal(
    inject(DataInitStateService).isAllDataLoadedInitially$,
    {
      initialValue: false,
    },
  );
  private readonly _viewport = toSignal(
    inject(BreakpointObserver).observe(['(max-width: 767px)', '(max-height: 700px)']),
  );
  readonly isPhone = computed(
    () => !!this._viewport()?.breakpoints['(max-width: 767px)'],
  );
  readonly previewLimit = computed(() =>
    this._viewport()?.breakpoints['(max-height: 700px)'] ? 1 : 2,
  );
  readonly expandedGroupId = signal<MatrixGroupId | undefined>(undefined);
  private readonly _selectedDate = signal<string | null>(null);
  private readonly _quadrants = viewChildren(MatrixQuadrantComponent);
  private readonly _expandedHeading =
    viewChild<ElementRef<HTMLHeadingElement>>('expandedHeading');
  private readonly _unclassifiedButton =
    viewChild<ElementRef<HTMLButtonElement>>('unclassifiedButton');
  readonly timeFilter = signal<MatrixTimeFilter>('all');
  readonly projectId = signal('');
  readonly scopeProjectId = input<string | null>(null);
  readonly effectiveProjectId = computed(() => this.scopeProjectId() ?? this.projectId());
  readonly tagId = signal('');
  readonly previewSuggestions = signal(false);
  readonly dragStartDelay = { touch: 300, mouse: 0 };
  readonly today = toSignal(this._clock.todayDateStr$, {
    initialValue: this._dateService.todayStr(),
  });
  readonly anchor = computed(() => this._selectedDate() ?? this.today());
  readonly calendarTitle = computed(() =>
    new Intl.DateTimeFormat(this._format.textLocale(), {
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${this.anchor()}T12:00:00`)),
  );
  readonly days = computed(() => {
    const counts = new Map<string, number>();
    const scopedTasks = filterMatrixTasks(
      this._tasks(),
      {
        time: 'all',
        projectId: this.effectiveProjectId(),
        tagId: this.tagId(),
      },
      this.today(),
      this._dayOffset(),
    );
    for (const task of scopedTasks) {
      const dates = getMatrixTaskDates(task, this._dayOffset());
      for (const day of new Set([dates.planned, dates.deadline])) {
        if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
      }
    }
    const locale = this._format.textLocale();
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const full = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });
    return getMatrixWeekDates(
      this.anchor(),
      this.config.localization()?.firstDayOfWeek ?? 1,
    ).map((day) => {
      const date = new Date(`${day}T12:00:00`);
      return {
        day,
        number: date.getDate(),
        weekday: weekday.format(date),
        label: full.format(date),
        hasTasks: !!counts.get(day),
      };
    });
  });
  readonly periods = [
    { id: 'all', label: T.F.MATRIX.ALL },
    { id: 'today', label: T.G.TODAY_TAG_TITLE },
    { id: 'week', label: T.F.PLANNER.CALENDAR.WEEK },
  ] as const;
  private readonly _dayOffset = toSignal(
    this._dateService.startOfNextDayDiffChange$.pipe(
      map(() => this._dateService.getStartOfNextDayDiffMs()),
      startWith(this._dateService.getStartOfNextDayDiffMs()),
    ),
    { requireSync: true },
  );
  private readonly _tasks = this._store.selectSignal(selectAllTasksInActiveProjects);
  readonly dayOffset = computed(() => this._dayOffset());
  readonly projects = this._store.selectSignal(selectUnarchivedProjects);
  readonly tags = this._store.selectSignal(selectAllTagsWithoutMyDay);
  readonly projectTitles = computed(() =>
    Object.fromEntries(this.projects().map((project) => [project.id, project.title])),
  );
  readonly isDefaultHome = computed(
    () => this.config.misc()?.defaultStartPage === DefaultStartPage.Matrix,
  );
  readonly isFocusEnabled = computed(
    () =>
      !!(
        this.config.appFeatures().isTimeTrackingEnabled ||
        this.config.appFeatures().isFocusModeEnabled
      ),
  );
  readonly visibleTasks = computed(() =>
    filterMatrixTasks(
      this._tasks(),
      {
        time: this.timeFilter(),
        projectId: this.effectiveProjectId(),
        tagId: this.tagId(),
        day: this.anchor(),
      },
      this.today(),
      this._dayOffset(),
      this.config.localization()?.firstDayOfWeek ?? 1,
    ),
  );
  readonly groups = computed(() => {
    const grouped = new Map<MatrixGroupId, Task[]>(
      MATRIX_QUADRANTS.map((group) => [group.id, []]),
    );
    for (const task of this.visibleTasks()) {
      grouped
        .get(
          getMatrixGroup(
            task,
            this.previewSuggestions(),
            this.today(),
            this._dayOffset(),
          ),
        )!
        .push(task);
    }
    return MATRIX_QUADRANTS.map((group) => {
      const tasks = grouped.get(group.id)!;
      return { ...group, tasks, previewTasks: tasks.slice(0, this.previewLimit()) };
    });
  });
  readonly quadrants = computed(() => this.groups().filter((group) => group.id !== null));
  readonly unclassified = computed(
    () => this.groups().find((group) => group.id === null)!,
  );
  readonly expandedGroup = computed(() =>
    this.groups().find((group) => group.id === this.expandedGroupId()),
  );
  readonly phoneExpandedGroup = computed(() =>
    this.isPhone() ? this.expandedGroup() : undefined,
  );
  readonly desktopExpandedGroup = computed(() =>
    this.isPhone() ? undefined : this.expandedGroup(),
  );
  readonly hasActiveFilters = computed(
    () => !!this.projectId() || !!this.tagId() || this.timeFilter() !== 'all',
  );
  readonly emptyMessage = computed(() =>
    !this.hasActiveFilters() &&
    !this.scopeProjectId() &&
    this._tasks().length > 0 &&
    this._tasks().every((task) => task.isDone)
      ? T.F.MATRIX.EMPTY_COMPLETED
      : T.F.MATRIX.EMPTY_FILTER,
  );
  readonly isFocusModeEnabled = computed(
    () => !!this.config.appFeatures().isFocusModeEnabled,
  );

  selectDay(day: string): void {
    this._selectedDate.set(day === this.today() ? null : day);
    this.timeFilter.set('day');
  }

  setPeriod(period: 'all' | 'today' | 'week'): void {
    this.timeFilter.set(period);
    if (period === 'today') this._selectedDate.set(null);
  }

  navigateWeek(direction: -1 | 1): void {
    this._selectedDate.set(shiftMatrixWeek(this.anchor(), direction));
    this.timeFilter.set('week');
  }

  goToToday(): void {
    this._selectedDate.set(null);
    this.timeFilter.set('today');
  }

  resetFilters(): void {
    this.projectId.set('');
    this.tagId.set('');
    this._selectedDate.set(null);
    this.timeFilter.set('all');
  }

  expandGroup(groupId: MatrixGroupId): void {
    this.expandedGroupId.set(groupId);
    afterNextRender(() => this._expandedHeading()?.nativeElement.focus(), {
      injector: this._injector,
    });
  }

  closeGroup(): void {
    const groupId = this.expandedGroupId();
    this.expandedGroupId.set(undefined);
    afterNextRender(
      () => {
        if (groupId === null) this._unclassifiedButton()?.nativeElement.focus();
        else
          this._quadrants()
            .find((group) => group.groupId() === groupId)
            ?.focusViewAll();
      },
      { injector: this._injector },
    );
  }

  setDefaultHome(): void {
    this.config.updateSection('misc', { defaultStartPage: DefaultStartPage.Matrix });
  }

  drop(event: CdkDragDrop<MatrixGroupId, MatrixGroupId, Task>): void {
    if (
      event.previousContainer.data === event.container.data ||
      !event.isPointerOverContainer
    )
      return;
    this._matrix.classify(event.item.data, event.container.data);
  }

  classify(task: Task, quadrant: MatrixGroupId): void {
    this._matrix.classify(task, quadrant);
  }

  acceptSuggestion(task: Task): void {
    this._matrix.classify(
      task,
      suggestEisenhowerQuadrant(task, this.today(), this._dayOffset()),
    );
  }

  complete(task: Task): void {
    const groupId = this.groups().find((group) =>
      group.tasks.some((item) => item.id === task.id),
    )?.id;
    this.taskService.setDone(task.id);
    afterNextRender(
      () => {
        if (this.expandedGroup()) this._expandedHeading()?.nativeElement.focus();
        else if (groupId === null) this._unclassifiedButton()?.nativeElement.focus();
        else
          this._quadrants()
            .find((group) => group.groupId() === groupId)
            ?.focusViewAll();
      },
      { injector: this._injector },
    );
  }

  focus(task: Task): void {
    if (this.taskService.currentTaskId() === task.id) {
      this.taskService.pauseCurrent();
      return;
    }
    this.taskService.setCurrentId(task.id);
    if (this.config.appFeatures().isFocusModeEnabled) this._focusMode.openOverlay();
  }

  async remove(task: Task): Promise<void> {
    const confirmed = await firstValueFrom(
      this._dialog
        .open(DialogConfirmComponent, {
          restoreFocus: true,
          data: {
            message: T.F.MATRIX.CONFIRM_DELETE,
            okTxt: T.G.DELETE,
            cancelTxt: T.G.CANCEL,
          },
        })
        .afterClosed(),
    );
    if (confirmed) this.taskService.removeMultipleTasks([task.id]);
  }

  async edit(task: Task): Promise<void> {
    const result = await this._openEditor(task.eisenhowerQuadrant ?? null, task);
    if (result && Object.keys(result.fields).length)
      this._matrix.update(task, result.fields);
  }

  async add(quadrant: MatrixGroupId): Promise<void> {
    const result = await this._openEditor(quadrant);
    if (result)
      this._matrix.add(result.title, { ...result.fields, projectId: result.projectId });
  }

  private _openEditor(
    quadrant: MatrixGroupId,
    task?: Task,
  ): Promise<MatrixTaskEditorResult | undefined> {
    const projects = this.projects();
    const preferredProject =
      this.effectiveProjectId() ||
      this.config.tasks()?.defaultProjectId ||
      INBOX_PROJECT.id;
    const projectId = projects.some((project) => project.id === preferredProject)
      ? preferredProject
      : INBOX_PROJECT.id;
    return firstValueFrom(
      this._dialog
        .open<MatrixTaskEditorComponent, MatrixTaskEditorData, MatrixTaskEditorResult>(
          MatrixTaskEditorComponent,
          {
            width: '520px',
            maxWidth: '95vw',
            restoreFocus: true,
            data: {
              task,
              projects:
                this.scopeProjectId() && !task
                  ? projects.filter((project) => project.id === this.scopeProjectId())
                  : projects,
              tags: this.tags(),
              projectId,
              tagId: this.tagId(),
              quadrant,
              day: this.timeFilter() === 'all' ? '' : this.anchor(),
            },
          },
        )
        .afterClosed(),
    );
  }
}
