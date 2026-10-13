import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { BehaviorSubject, of } from 'rxjs';
import { DateService } from '../../core/date/date.service';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { GlobalConfigService } from '../config/global-config.service';
import { DEFAULT_GLOBAL_CONFIG } from '../config/default-global-config.const';
import { TaskService } from '../tasks/task.service';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { selectAllTasksInActiveProjects } from '../tasks/store/task.selectors';
import { FocusModeService } from '../focus-mode/focus-mode.service';
import { EisenhowerMatrixPageComponent } from './eisenhower-matrix-page.component';
import { EisenhowerMatrixService } from './eisenhower-matrix.service';
import { EisenhowerQuadrant, MatrixGroupId } from './eisenhower-matrix.model';
import { LayoutService } from '../../core-ui/layout/layout.service';
import { Dialog } from '@angular/cdk/dialog';
import { TaskArchiveService } from '../archive/task-archive.service';

describe('Matrix persistent drag ordering', () => {
  const group = EisenhowerQuadrant.DO_FIRST;
  const task = (id: string, fields: Partial<Task> = {}): Task => ({
    ...DEFAULT_TASK,
    id,
    projectId: 'project',
    eisenhowerQuadrant: group,
    ...fields,
  });
  const a = task('a');
  const b = task('b');
  let component: EisenhowerMatrixPageComponent;
  let pageFixture: ComponentFixture<EisenhowerMatrixPageComponent>;
  let matrix: jasmine.SpyObj<EisenhowerMatrixService>;
  const showAddTaskBar = jasmine.createSpy('showAddTaskBar');
  const isShowAddTaskBar = signal(false);
  const tasks = signal<Task[]>([]);
  const misc = signal(DEFAULT_GLOBAL_CONFIG.misc);
  const today = new BehaviorSubject('2026-10-11');
  const drop = (
    source: MatrixGroupId,
    target: MatrixGroupId,
    moved: Task = b,
    index: number = 0,
    inside: boolean = true,
  ): Parameters<EisenhowerMatrixPageComponent['drop']>[0] =>
    ({
      previousContainer: { data: { id: source, tasks: [a, b] } },
      container: { data: { id: target, tasks: [a, b] } },
      item: { data: moved },
      currentIndex: index,
      isPointerOverContainer: inside,
    }) as unknown as Parameters<EisenhowerMatrixPageComponent['drop']>[0];

  beforeEach(() => {
    tasks.set([a, b]);
    misc.set(DEFAULT_GLOBAL_CONFIG.misc);
    today.next('2026-10-11');
    showAddTaskBar.calls.reset();
    isShowAddTaskBar.set(false);
    matrix = jasmine.createSpyObj<EisenhowerMatrixService>('Matrix', [
      'reorder',
      'classify',
    ]);
    TestBed.configureTestingModule({
      imports: [EisenhowerMatrixPageComponent],
      providers: [
        {
          provide: Store,
          useValue: {
            selectSignal: (selector: unknown) =>
              selector === selectAllTasksInActiveProjects ? tasks : signal([]),
          },
        },
        {
          provide: DateService,
          useValue: {
            todayStr: () => today.value,
            getStartOfNextDayDiffMs: () => 0,
            startOfNextDayDiffChange$: of(0),
          },
        },
        { provide: DateTimeFormatService, useValue: { textLocale: signal('zh-CN') } },
        { provide: GlobalTrackingIntervalService, useValue: { todayDateStr$: today } },
        {
          provide: DataInitStateService,
          useValue: { isAllDataLoadedInitially$: of(true) },
        },
        {
          provide: GlobalConfigService,
          useValue: {
            misc,
            localization: signal(DEFAULT_GLOBAL_CONFIG.localization),
            appFeatures: signal(DEFAULT_GLOBAL_CONFIG.appFeatures),
          },
        },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () =>
              of({
                matches: true,
                breakpoints: Object.fromEntries([
                  ['(max-width: 767px)', true],
                  ['(max-height: 700px)', false],
                ]),
              }),
          },
        },
        { provide: TaskService, useValue: {} },
        { provide: FocusModeService, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: Dialog, useValue: {} },
        {
          provide: LayoutService,
          useValue: { showAddTaskBar, isShowAddTaskBar },
        },
        {
          provide: TaskArchiveService,
          useValue: { load: async () => ({ ids: [], entities: {} }) },
        },
      ],
    });
    TestBed.overrideComponent(EisenhowerMatrixPageComponent, {
      set: {
        template: `<div #homePage class="size-home" [style.height.px]="frozenHomeSize()?.page" [style.min-height.px]="frozenHomeSize()?.page">
          <img #homeBanner class="size-banner" alt="" [style.height.px]="frozenHomeSize()?.banner" />
        </div>`,
        styles: [
          '.size-home { height: 100%; min-height: 100%; } .size-banner { display: block; height: 40%; }',
        ],
        imports: [],
        providers: [{ provide: EisenhowerMatrixService, useValue: matrix }],
      },
    });
    pageFixture = TestBed.createComponent(EisenhowerMatrixPageComponent);
    component = pageFixture.componentInstance;
  });

  it('keeps the obscured home size through keyboard resizes and releases it when the composer closes', async () => {
    const host: HTMLElement = pageFixture.nativeElement;
    host.style.height = '300px';
    pageFixture.detectChanges();
    await pageFixture.whenStable();
    const page = host.querySelector<HTMLDivElement>('.size-home')!;
    const banner = host.querySelector<HTMLImageElement>('.size-banner')!;
    expect(page.getBoundingClientRect().height).toBe(300);
    expect(banner.getBoundingClientRect().height).toBe(120);
    isShowAddTaskBar.set(true);
    pageFixture.detectChanges();
    await pageFixture.whenStable();
    host.style.height = '150px';
    pageFixture.detectChanges();
    expect(page.getBoundingClientRect().height).toBe(300);
    expect(banner.getBoundingClientRect().height).toBe(120);
    host.style.height = '450px';
    pageFixture.detectChanges();
    expect(page.getBoundingClientRect().height).toBe(300);
    expect(banner.getBoundingClientRect().height).toBe(120);
    host.style.height = '150px';
    isShowAddTaskBar.set(false);
    pageFixture.detectChanges();
    await pageFixture.whenStable();
    expect(page.style.height).toBe('');
    expect(page.style.minHeight).toBe('');
    expect(banner.style.height).toBe('');
    expect(page.getBoundingClientRect().height).toBe(150);
    expect(banner.getBoundingClientRect().height).toBe(60);
  });

  it('routes same-quadrant drops to sorting without reclassifying the task', () => {
    component.drop(drop(group, group));
    expect(matrix.reorder).toHaveBeenCalledOnceWith([a, b], 'b', 0, [a, b]);
    expect(matrix.classify).not.toHaveBeenCalled();
  });

  it('preserves cross-quadrant classification including the unclassified entry', () => {
    component.drop(drop(group, EisenhowerQuadrant.SCHEDULE));
    component.drop(drop(group, null));
    expect(matrix.classify.calls.allArgs()).toEqual([
      [b, EisenhowerQuadrant.SCHEDULE],
      [b, null],
    ]);
    expect(matrix.reorder).not.toHaveBeenCalled();
  });

  it('does not persist a cancelled drop', () => {
    component.drop(drop(group, group, b, 0, false));
    expect(matrix.reorder).not.toHaveBeenCalled();
    expect(matrix.classify).not.toHaveBeenCalled();
  });

  it('uses the saved order in mobile previews and expanded lists across midnight', () => {
    misc.set({ ...DEFAULT_GLOBAL_CONFIG.misc, matrixTaskOrder: ['task:b', 'task:a'] });
    tasks.set([a, b, task('c')]);
    expect(component.isPhone()).toBeTrue();
    let first = component.quadrants()[0];
    expect(first.previewDropListData.tasks.map((item) => item.id)).toEqual(['b', 'a']);
    expect(first.dropListData.tasks.map((item) => item.id)).toEqual(['b', 'a', 'c']);
    today.next('2026-10-12');
    first = component.quadrants()[0];
    expect(first.tasks.map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(matrix.reorder).not.toHaveBeenCalled();
  });

  it('switches home layout without changing saved task order or classification', () => {
    misc.set({ ...DEFAULT_GLOBAL_CONFIG.misc, matrixTaskOrder: ['task:b', 'task:a'] });
    const savedConfig = misc();
    expect(component.isCompactView()).toBeTrue();
    component.homeView.set('list');
    expect(component.isCompactView()).toBeFalse();
    expect(component.quadrants()[0].tasks.map((item) => item.id)).toEqual(['b', 'a']);
    component.homeView.set('grid');
    expect(component.isCompactView()).toBeTrue();
    expect(misc()).toBe(savedConfig);
    expect(matrix.reorder).not.toHaveBeenCalled();
    expect(matrix.classify).not.toHaveBeenCalled();
  });

  it('shows date markers only for actual classified tasks on that date', () => {
    tasks.set([
      task('today', { dueDay: '2026-10-11' }),
      task('next-week', { dueDay: '2026-10-12' }),
      task('unclassified', { dueDay: '2026-10-10', eisenhowerQuadrant: undefined }),
    ]);
    expect(component.calendarYear()).toBe('2026');
    expect(component.calendarDate()).toBe('10月11日');
    expect(component.days().find((day) => day.day === '2026-10-11')?.tones).toEqual([
      'do-first',
    ]);
    expect(component.days().find((day) => day.day === '2026-10-10')?.tones).toEqual([]);
    expect(component.days().find((day) => day.day === '2026-10-09')?.tones).toEqual([]);
  });

  it('opens the shared composer with the clicked quadrant and selected date', async () => {
    component.selectDay('2026-10-12');
    await component.add(EisenhowerQuadrant.SCHEDULE);
    expect(showAddTaskBar).toHaveBeenCalledWith({
      eisenhowerQuadrant: EisenhowerQuadrant.SCHEDULE,
      dueDay: '2026-10-12',
    });
  });

  it('uses completed plans in daily progress without counting children twice', () => {
    tasks.set([
      task('parent', { dueDay: '2026-10-11', subTaskIds: ['child'] }),
      task('child', { parentId: 'parent', dueDay: '2026-10-11' }),
      task('done', { dueDay: '2026-10-11', isDone: true }),
    ]);
    const day = component.days().find((item) => item.day === '2026-10-11')!;
    expect(day.total).toBe(2);
    expect(day.done).toBe(1);
    expect(day.progress).toBe(0.5);
    expect(component.quadrants()[0].tasks.map((item) => item.id)).toEqual([
      'parent',
      'done',
    ]);
  });

  it('swipes weeks only for deliberate horizontal gestures and filters to the selected day', () => {
    const start = (x: number, y: number): void =>
      component.swipeStart({
        touches: [{ clientX: x, clientY: y }],
      } as unknown as TouchEvent);
    const end = (x: number, y: number): void =>
      component.swipeEnd({
        changedTouches: [{ clientX: x, clientY: y }],
      } as unknown as TouchEvent);
    start(250, 50);
    end(100, 52);
    expect(component.anchor()).toBe('2026-10-18');
    expect(component.timeFilter()).toBe('day');
    start(100, 50);
    end(250, 52);
    expect(component.anchor()).toBe('2026-10-11');
    start(250, 50);
    end(200, 170);
    expect(component.anchor()).toBe('2026-10-11');
  });

  it('follows horizontal movement and resets it on cancellation or date selection', () => {
    component.swipeStart({
      touches: [{ clientX: 240, clientY: 50 }],
    } as unknown as TouchEvent);
    component.swipeMove({
      touches: [{ clientX: 160, clientY: 52 }],
    } as unknown as TouchEvent);
    expect(component.dateDragOffset()).toBe(-28);
    component.swipeCancel();
    expect(component.dateDragOffset()).toBe(0);
    expect(component.isDateDragging()).toBeFalse();
    component.selectDay('2026-10-12');
    expect(component.dateTransition()).toBe(1);
    component.selectDay('2026-10-11');
    expect(component.dateTransition()).toBe(-1);
  });

  it('preserves unclassified date markers in a project matrix', () => {
    tasks.set([
      task('unclassified', { dueDay: '2026-10-10', eisenhowerQuadrant: undefined }),
    ]);
    const fixture = TestBed.createComponent(EisenhowerMatrixPageComponent);
    fixture.componentRef.setInput('scopeProjectId', 'project');
    expect(
      fixture.componentInstance.days().find((day) => day.day === '2026-10-10')?.hasTasks,
    ).toBeTrue();
  });
});
