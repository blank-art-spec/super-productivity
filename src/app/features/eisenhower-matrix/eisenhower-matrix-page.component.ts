import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  DestroyRef,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
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
import { sortMatrixTasks } from './matrix-task-order.util';
import { MatrixQuadrantComponent } from './matrix-quadrant/matrix-quadrant.component';
import { MatrixTaskCardComponent } from './matrix-task-card/matrix-task-card.component';
import { LayoutService } from '../../core-ui/layout/layout.service';
import { NotebookCalendarComponent } from '../tasks/add-task-bar/notebook-calendar.component';
import { notebookTasksForDay } from './notebook-day-tasks.util';
import { TaskArchiveService } from '../archive/task-archive.service';
import { SimpleCounter, SimpleCounterType } from '../simple-counter/simple-counter.model';
import { selectEnabledSimpleCounters } from '../simple-counter/store/simple-counter.reducer';
import { SimpleCounterService } from '../simple-counter/simple-counter.service';
import { DialogSimpleCounterEditComponent } from '../simple-counter/dialog-simple-counter-edit/dialog-simple-counter-edit.component';
import { Log } from '../../core/log';
import {
  MatrixTaskEditorComponent,
  MatrixTaskEditorData,
  MatrixTaskEditorResult,
} from './matrix-task-editor/matrix-task-editor.component';

interface MatrixDropListData {
  id: MatrixGroupId;
  tasks: readonly Task[];
}

@Component({
  selector: 'eisenhower-matrix-page',
  imports: [
    FormsModule,
    RouterLink,
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
  private readonly _layout = inject(LayoutService);
  private readonly _calendar = inject(Dialog);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _archive = inject(TaskArchiveService);
  private readonly _archiveTasks = signal<readonly Task[]>([]);
  private _archiveVersion = 0;
  private _swipeStart: { x: number; y: number } | null = null;
  readonly dateTransition = signal<-1 | 0 | 1>(0);
  readonly dateDragOffset = signal(0);
  readonly isDateDragging = signal(false);
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
  private readonly _homePage = viewChild<ElementRef<HTMLDivElement>>('homePage');
  private readonly _homeBanner = viewChild<ElementRef<HTMLImageElement>>('homeBanner');
  readonly frozenHomeSize = signal<{ page: number; banner: number } | null>(null);
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
  readonly scopeTagId = input<string | null>(null);
  readonly isNotebookHome = computed(() => !this.scopeProjectId() && !this.scopeTagId());
  readonly homeView = signal<'grid' | 'list'>('grid');
  readonly isCompactView = computed(
    () => this.isPhone() && (!this.isNotebookHome() || this.homeView() === 'grid'),
  );
  readonly effectiveTagId = computed(() => this.scopeTagId() ?? this.tagId());
  readonly previewSuggestions = signal(false);
  readonly dragStartDelay = { touch: 300, mouse: 0 };
  readonly unclassifiedDropListData: MatrixDropListData = { id: null, tasks: [] };
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
  readonly calendarYear = computed(
    () =>
      new Intl.DateTimeFormat(this._format.textLocale(), { year: 'numeric' })
        .formatToParts(new Date(`${this.anchor()}T12:00:00`))
        .find((part) => part.type === 'year')!.value,
  );
  readonly calendarDate = computed(() =>
    new Intl.DateTimeFormat(this._format.textLocale(), {
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${this.anchor()}T12:00:00`)),
  );
  readonly days = computed(() => {
    const scopedTasks = this.isNotebookHome()
      ? this._calendarTasks()
      : filterMatrixTasks(
          this._tasks(),
          {
            time: 'all',
            projectId: this.effectiveProjectId(),
            tagId: this.effectiveTagId(),
          },
          this.today(),
          this._dayOffset(),
        );
    const locale = this._format.textLocale();
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const full = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });
    return getMatrixWeekDates(
      this.anchor(),
      this.config.localization()?.firstDayOfWeek ?? 1,
    ).map((day) => {
      const date = new Date(`${day}T12:00:00`);
      const dayTasks = notebookTasksForDay(
        scopedTasks,
        day,
        this.today(),
        this._dayOffset(),
      );
      const habits = this._habitsForDay(day);
      const total = dayTasks.length + habits.length;
      const done =
        dayTasks.filter((task) => task.isDone).length +
        habits.filter(
          (habit) => (habit.countOnDay[day] || 0) >= (habit.streakMinValue || 1),
        ).length;
      const dots = new Set(
        dayTasks
          .map(
            (task) =>
              MATRIX_QUADRANTS.find((group) => group.id === task.eisenhowerQuadrant)
                ?.tone,
          )
          .filter((tone) => tone && tone !== 'unclassified'),
      );
      if (habits.length) dots.add('delegate');
      return {
        day,
        number: date.getDate(),
        weekday: weekday.format(date),
        label: full.format(date),
        hasTasks: this.isNotebookHome()
          ? total > 0
          : scopedTasks.some((task) => {
              const dates = getMatrixTaskDates(task, this._dayOffset());
              return dates.planned === day || dates.deadline === day;
            }),
        total,
        done,
        progress: total ? done / total : 0,
        tones: [...dots],
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
  private readonly _counters = this._store.selectSignal(selectEnabledSimpleCounters);
  private readonly _taskIds = computed(() =>
    this._tasks()
      .map((task) => task.id)
      .join('|'),
  );
  private readonly _calendarTasks = computed(() => {
    const active = this._tasks();
    const activeIds = new Set(active.map((task) => task.id));
    const projectIds = new Set(this.projects().map((project) => project.id));
    return [
      ...active,
      ...this._archiveTasks().filter(
        (task) => !activeIds.has(task.id) && projectIds.has(task.projectId),
      ),
    ].filter(
      (task) =>
        (!this.effectiveProjectId() || task.projectId === this.effectiveProjectId()) &&
        (!this.effectiveTagId() || task.tagIds.includes(this.effectiveTagId())),
    );
  });
  readonly childrenById = computed(() => {
    const byId = new Map(this._calendarTasks().map((task) => [task.id, task]));
    return Object.fromEntries(
      this._calendarTasks()
        .filter((task) => task.subTaskIds.length)
        .map((task) => [
          task.id,
          task.subTaskIds
            .map((id) => byId.get(id))
            .filter((child): child is Task => !!child),
        ]),
    );
  });
  readonly archivedIds = computed(() => {
    const activeIds = new Set(this._tasks().map((task) => task.id));
    return new Set(
      this._archiveTasks()
        .map((task) => task.id)
        .filter((id) => !activeIds.has(id)),
    );
  });
  readonly habits = computed(() =>
    this.isNotebookHome() && !this.effectiveProjectId() && !this.effectiveTagId()
      ? this._habitsForDay(this.anchor()).map((habit) => ({
          habit,
          done: (habit.countOnDay[this.anchor()] || 0) >= (habit.streakMinValue || 1),
        }))
      : [],
  );
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
    this.isNotebookHome()
      ? notebookTasksForDay(
          this._calendarTasks(),
          this.anchor(),
          this.today(),
          this._dayOffset(),
        )
      : filterMatrixTasks(
          this._tasks(),
          {
            time: this.timeFilter(),
            projectId: this.effectiveProjectId(),
            tagId: this.effectiveTagId(),
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
    for (const task of sortMatrixTasks(
      this.visibleTasks(),
      this.config.misc()?.matrixTaskOrder ?? [],
    )) {
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
      const previewTasks = tasks.slice(0, this.previewLimit());
      return {
        ...group,
        tasks,
        previewTasks,
        dropListData: { id: group.id, tasks },
        previewDropListData: { id: group.id, tasks: previewTasks },
      };
    });
  });
  readonly quadrants = computed(() => this.groups().filter((group) => group.id !== null));
  readonly unclassified = computed(
    () => this.groups().find((group) => group.id === null)!,
  );
  readonly completedCount = computed(
    () => this._tasks().filter((task) => task.isDone).length,
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
    !this.scopeTagId() &&
    this._tasks().length > 0 &&
    this._tasks().every((task) => task.isDone)
      ? T.F.MATRIX.EMPTY_COMPLETED
      : T.F.MATRIX.EMPTY_FILTER,
  );
  readonly isFocusModeEnabled = computed(
    () => !!this.config.appFeatures().isFocusModeEnabled,
  );

  constructor() {
    effect(() => {
      if (!this._layout.isShowAddTaskBar() || !this.isNotebookHome() || !this.isPhone()) {
        this.frozenHomeSize.set(null);
        return;
      }
      const page = this._homePage()?.nativeElement;
      const banner = this._homeBanner()?.nativeElement;
      if (page && banner) {
        // Native keyboards resize the viewport when an interval input loses
        // focus. Keep the obscured home fixed until its composer closes.
        this.frozenHomeSize.set({
          page: page.getBoundingClientRect().height,
          banner: banner.getBoundingClientRect().height,
        });
      }
    });
    effect(() => {
      this._taskIds();
      this.today();
      if (this.isDataLoaded() && this.isNotebookHome()) void this.refreshArchive();
    });
  }

  async refreshArchive(): Promise<void> {
    const version = ++this._archiveVersion;
    try {
      const archive = await this._archive.load();
      if (!this._destroyRef.destroyed && version === this._archiveVersion)
        this._archiveTasks.set(
          archive.ids.map((id) => archive.entities[id]!).filter(Boolean),
        );
    } catch (error) {
      Log.warn('Notebook calendar archive load failed', error);
    }
  }

  private _habitsForDay(day: string): SimpleCounter[] {
    const dow = new Date(`${day}T12:00:00`).getDay();
    if (this.effectiveProjectId() || this.effectiveTagId()) return [];
    return this._counters().filter(
      (habit) =>
        habit.type === SimpleCounterType.ClickCounter &&
        habit.isTrackStreaks &&
        (habit.streakMode === 'weekly-frequency' ||
          !habit.streakWeekDays ||
          habit.streakWeekDays[dow]),
    );
  }

  toggleHabit(habit: SimpleCounter): void {
    const value = habit.countOnDay[this.anchor()] || 0;
    this._injector
      .get(SimpleCounterService)
      .setCounterForDate(
        habit.id,
        this.anchor(),
        (habit.streakMinValue || 1) === 1 && value ? 0 : value + 1,
      );
  }

  editHabit(habit: SimpleCounter): void {
    this._dialog.open(DialogSimpleCounterEditComponent, {
      data: {
        simpleCounter: { ...habit, countOnDay: { ...habit.countOnDay } },
        selectedDate: this.anchor(),
      },
    });
  }

  openCalendar(): void {
    this._calendar
      .open<string>(NotebookCalendarComponent, {
        data: this.anchor(),
        width: 'min(88vw, 420px)',
        autoFocus: false,
        backdropClass: 'notebook-overlay-backdrop',
      })
      .closed.pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((day) => {
        if (day) this.selectDay(day);
      });
  }

  swipeStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this._swipeStart =
      event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
    this.isDateDragging.set(!!this._swipeStart);
    this.dateDragOffset.set(0);
  }

  swipeMove(event: TouchEvent): void {
    const start = this._swipeStart;
    if (!start || event.touches.length !== 1 || !this.isNotebookHome()) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    this.dateDragOffset.set(
      Math.abs(dx) > Math.abs(touch.clientY - start.y) * 1.5
        ? Math.max(-48, Math.min(48, dx * 0.35))
        : 0,
    );
  }

  swipeCancel(): void {
    this._swipeStart = null;
    this.isDateDragging.set(false);
    this.dateDragOffset.set(0);
  }

  swipeEnd(event: TouchEvent): void {
    const start = this._swipeStart;
    this.swipeCancel();
    if (!start || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(touch.clientY - start.y) * 1.5)
      this.navigateWeek(dx < 0 ? 1 : -1);
  }

  selectDay(day: string): void {
    this.dateTransition.set(day === this.anchor() ? 0 : day > this.anchor() ? 1 : -1);
    this._selectedDate.set(day === this.today() ? null : day);
    this.timeFilter.set('day');
    if (this.isNotebookHome()) void this.refreshArchive();
  }

  setPeriod(period: 'all' | 'today' | 'week'): void {
    this.timeFilter.set(period);
    if (period === 'today') this._selectedDate.set(null);
  }

  navigateWeek(direction: -1 | 1): void {
    this.dateTransition.set(direction);
    this._selectedDate.set(shiftMatrixWeek(this.anchor(), direction));
    this.timeFilter.set(this.isNotebookHome() ? 'day' : 'week');
    if (this.isNotebookHome()) void this.refreshArchive();
  }

  goToToday(): void {
    this.dateTransition.set(
      this.anchor() === this.today() ? 0 : this.today() > this.anchor() ? 1 : -1,
    );
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

  drop(event: CdkDragDrop<MatrixDropListData, MatrixDropListData, Task>): void {
    if (!event.isPointerOverContainer) return;
    const target = event.container.data;
    if (event.previousContainer.data.id === target.id) {
      this._matrix.reorder(
        target.tasks,
        event.item.data.id,
        event.currentIndex,
        this._tasks(),
      );
    } else {
      this._matrix.classify(event.item.data, target.id);
    }
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
    if (this.archivedIds().has(task.id)) return;
    if (task.isDone) {
      this.taskService.setUnDone(task.id);
      return;
    }
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
    if (this.isNotebookHome() && this.isPhone()) {
      this._layout.showAddTaskBar({
        eisenhowerQuadrant: quadrant,
        dueDay: this.anchor(),
        ...(this.effectiveProjectId() ? { projectId: this.effectiveProjectId() } : {}),
        ...(this.effectiveTagId() ? { tagIds: [this.effectiveTagId()] } : {}),
      });
      return;
    }
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
            panelClass: 'tasksmart-editor-dialog',
            restoreFocus: true,
            data: {
              task,
              projects:
                this.scopeProjectId() && !task
                  ? projects.filter((project) => project.id === this.scopeProjectId())
                  : projects,
              tags: this.tags(),
              projectId,
              tagId: this.effectiveTagId(),
              quadrant,
              day: this.timeFilter() === 'all' ? '' : this.anchor(),
            },
          },
        )
        .afterClosed(),
    );
  }
}
