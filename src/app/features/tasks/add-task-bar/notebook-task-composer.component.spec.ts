import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { NotebookTaskComposerComponent } from './notebook-task-composer.component';
import { AddTaskBarStateService } from './add-task-bar-state.service';
import { AddTaskBarParserService } from './add-task-bar-parser.service';
import { NotebookTaskDraftService } from './notebook-task-draft.service';
import { DateService } from '../../../core/date/date.service';
import { ProjectService } from '../../project/project.service';
import { TagService } from '../../tag/tag.service';
import { TaskService } from '../task.service';
import { OperationWriteFlushService } from '../../../op-log/sync/operation-write-flush.service';
import { TaskReminderOptionId } from '../task.model';
import { INBOX_PROJECT } from '../../project/project.const';
import { DEFAULT_PROJECT } from '../../project/project.const';
import { DEFAULT_TAG } from '../../tag/tag.const';
import { SS } from '../../../core/persistence/storage-keys.const';
import { EisenhowerQuadrant } from '../../eisenhower-matrix/eisenhower-matrix.model';
import { DialogCreateProjectComponent } from '../../project/dialogs/create-project/dialog-create-project.component';
import { DialogPromptComponent } from '../../../ui/dialog-prompt/dialog-prompt.component';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { ShortSyntaxConfig } from '../../config/global-config.model';

describe('NotebookTaskComposerComponent', () => {
  let fixture: ComponentFixture<NotebookTaskComposerComponent>;
  let composer: NotebookTaskComposerComponent;
  let tasks: jasmine.SpyObj<TaskService>;
  let flush: jasmine.SpyObj<OperationWriteFlushService>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let tags: jasmine.SpyObj<TagService>;

  beforeEach(async () => {
    sessionStorage.removeItem(SS.ADD_TASK_BAR_TXT);
    sessionStorage.removeItem(SS.ADD_TASK_BAR_NOTE);
    sessionStorage.removeItem(SS.NOTEBOOK_TASK_DRAFT);
    tasks = jasmine.createSpyObj<TaskService>('TaskService', ['addSubTaskTo']);
    flush = jasmine.createSpyObj<OperationWriteFlushService>(
      'OperationWriteFlushService',
      ['flushPendingWrites'],
    );
    flush.flushPendingWrites.and.resolveTo();
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    tags = jasmine.createSpyObj<TagService>('TagService', ['addTag'], {
      tagsNoMyDayAndNoListInTreeOrder: signal([
        { ...DEFAULT_TAG, id: 'tag', title: '分类' },
      ]),
    });
    await TestBed.configureTestingModule({
      imports: [NotebookTaskComposerComponent, TranslateModule.forRoot()],
      providers: [
        AddTaskBarStateService,
        AddTaskBarParserService,
        NotebookTaskDraftService,
        {
          provide: DateService,
          useValue: {
            todayStr: () => '2026-10-11',
            getLogicalTodayDate: () => new Date(2026, 9, 11),
          },
        },
        {
          provide: ProjectService,
          useValue: {
            listInTreeOrderForUI: signal([
              INBOX_PROJECT,
              { ...DEFAULT_PROJECT, id: 'goal', title: '目标' },
            ]),
          },
        },
        { provide: TagService, useValue: tags },
        { provide: MatDialog, useValue: dialog },
        { provide: TaskService, useValue: tasks },
        { provide: OperationWriteFlushService, useValue: flush },
        { provide: DateTimeFormatService, useValue: { textLocale: () => 'zh-CN' } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotebookTaskComposerComponent);
    composer = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses the logical today and tomorrow and excludes Inbox from goals', () => {
    expect(composer.selectedDay()).toBe('2026-10-11');
    expect(composer.tomorrow()).toBe('2026-10-12');
    expect(composer.goals().map((p) => p.id)).toEqual(['goal']);
  });

  it('reopens the selected quadrant with a drawing circle and clears only after its reverse animation', () => {
    composer.selectQuadrant(EisenhowerQuadrant.SCHEDULE);
    expect(composer.panel()).toBeNull();
    composer.togglePanel('quadrant');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.selection-circle')).not.toBeNull();
    composer.clearQuadrant();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.selection-circle.erasing'),
    ).not.toBeNull();
    expect(composer.draft.quadrant()).toBe(EisenhowerQuadrant.SCHEDULE);
    composer.finishQuadrantAnimation();
    expect(composer.draft.quadrant()).toBeNull();
    expect(composer.panel()).toBeNull();
  });

  it('puts added child plans under the input with a branch, aligned remove controls and a count', () => {
    composer.togglePanel('children');
    composer.childText.set('First child');
    composer.addChild();
    composer.childText.set('Second child');
    composer.addChild();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('.child-branch .child-item').length,
    ).toBe(2);
    expect(fixture.nativeElement.querySelector('.child-count').textContent.trim()).toBe(
      '2',
    );
    expect(composer.childText()).toBe('');
    expect(fixture.nativeElement.querySelector('.child-minus').textContent.trim()).toBe(
      '−',
    );
  });

  it('preserves the selected time and reminder when changing date tabs', () => {
    composer.state.updateDate('2026-10-11', '12:30');
    composer.state.updateRemindOption(TaskReminderOptionId.m5);
    composer.selectDay(composer.tomorrow());
    expect(composer.state.state().date).toBe('2026-10-12');
    expect(composer.state.state().time).toBe('12:30');
    expect(composer.state.state().remindOption).toBe(TaskReminderOptionId.m5);
  });

  it('chooses and clears the real quadrant without changing classification', () => {
    composer.selectCategory('tag');
    composer.selectQuadrant(EisenhowerQuadrant.DO_FIRST);
    expect(composer.draft.quadrant()).toBe(EisenhowerQuadrant.DO_FIRST);
    expect(composer.state.state().tagIds).toEqual(['tag']);
    expect(composer.panel()).toBeNull();
  });

  it('keeps canceled time-range changes out of task state', () => {
    composer.state.updateDate('2026-10-11', null);
    composer.togglePanel('range');
    composer.patchRange({ startDay: '2026-10-12', endDay: '2026-10-15', withTime: true });
    composer.panel.set(null);
    expect(composer.state.state().date).toBe('2026-10-11');
    expect(composer.state.state().estimate).toBeNull();
    expect(composer.state.state().deadlineDate).toBeNull();
  });

  it('commits a cross-day timed range as due time, estimate and deadline', () => {
    composer.range.set({
      startDay: '2026-10-11',
      endDay: '2026-10-12',
      withTime: true,
      startTime: '23:30',
      endTime: '00:30',
    });
    composer.confirmRange();
    expect(composer.state.state()).toEqual(
      jasmine.objectContaining({
        date: '2026-10-11',
        time: '23:30',
        estimate: 3600000,
        deadlineDate: '2026-10-12',
        deadlineTime: '00:30',
      }),
    );
  });

  it('rejects a reversed range without closing the editor', () => {
    composer.togglePanel('range');
    composer.patchRange({ endDay: '2026-10-10' });
    composer.confirmRange();
    expect(composer.panel()).toBe('range');
    expect(composer.state.state().date).toBeNull();
  });

  it('saves an all-day multi-day range using the existing deadline field', () => {
    composer.range.set({
      startDay: '2026-10-11',
      endDay: '2026-10-15',
      withTime: false,
      startTime: '',
      endTime: '',
    });
    composer.confirmRange();
    expect(composer.state.state().deadlineDate).toBe('2026-10-15');
    expect(composer.state.state().time).toBeNull();
    expect(composer.state.state().estimate).toBeNull();
    expect(composer.state.state().remindOption).toBe(TaskReminderOptionId.DoNotRemind);
  });

  it('does not apply repeat pill changes until confirmed', () => {
    composer.togglePanel('repeat');
    composer.repeatChoice.set('DAILY');
    composer.panel.set(null);
    expect(composer.state.state().repeat).toBeNull();
    composer.confirmRepeat();
    expect(composer.state.state().repeat).toEqual({
      type: 'PRESET',
      quickSetting: 'DAILY',
    });
    composer.repeatChoice.set(null);
    composer.confirmRepeat();
    expect(composer.state.state().repeat).toBeNull();
  });

  it('shows screenshot-style interval and end controls for each repeat cycle', () => {
    composer.togglePanel('repeat');
    expect(
      composer.repeatOptions.some((option) => String(option.value) === 'CUSTOM'),
    ).toBeFalse();
    for (const choice of [
      'DAILY',
      'WEEKLY_CURRENT_WEEKDAY',
      'MONTHLY_CURRENT_DATE',
      'YEARLY_CURRENT_DATE',
    ] as const) {
      composer.repeatChoice.set(choice);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('.repeat-interval input'),
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.repeat-end')).not.toBeNull();
    }
    expect(composer.state.state().repeat).toBeNull();
    composer.repeatEvery.set(2);
    composer.repeatChoice.set('WEEKLY_CURRENT_WEEKDAY');
    composer.repeatEndDay.set('2026-12-31');
    composer.confirmRepeat();
    expect(composer.state.state().repeat).toEqual({
      type: 'INTERVAL',
      repeatCycle: 'WEEKLY',
      repeatEvery: 2,
      endDate: '2026-12-31',
    });
    composer.togglePanel('repeat');
    expect(composer.repeatChoice()).toBe('WEEKLY_CURRENT_WEEKDAY');
    expect(composer.repeatEvery()).toBe(2);
    expect(composer.repeatCycle()).toBe('WEEKLY');
    expect(composer.repeatEndDay()).toBe('2026-12-31');
  });

  it('keeps confirmed interval and end settings when a later edit is cancelled', () => {
    composer.state.updateRepeatSetting({
      type: 'INTERVAL',
      repeatCycle: 'MONTHLY',
      repeatEvery: 3,
      endDate: '2026-12-31',
    });
    composer.togglePanel('repeat');
    composer.repeatEvery.set(7);
    composer.repeatChoice.set('YEARLY_CURRENT_DATE');
    composer.repeatEndDay.set(null);
    composer.panel.set(null);
    expect(composer.state.state().repeat).toEqual({
      type: 'INTERVAL',
      repeatCycle: 'MONTHLY',
      repeatEvery: 3,
      endDate: '2026-12-31',
    });
    composer.togglePanel('repeat');
    expect(composer.repeatEvery()).toBe(3);
    expect(composer.repeatCycle()).toBe('MONTHLY');
    expect(composer.repeatEndDay()).toBe('2026-12-31');
  });

  it('blocks empty, fractional and out-of-range repeat intervals', () => {
    composer.togglePanel('repeat');
    composer.repeatChoice.set('DAILY');
    for (const invalid of [null, 0, -1, 1.5, 1001, NaN, Infinity]) {
      composer.repeatEvery.set(invalid);
      composer.confirmRepeat();
      expect(composer.isRepeatValid()).toBeFalse();
      expect(composer.state.state().repeat).toBeNull();
      expect(composer.panel()).toBe('repeat');
    }
    composer.repeatEvery.set(1000);
    expect(composer.isRepeatValid()).toBeTrue();
    composer.confirmRepeat();
    expect(composer.state.state().repeat).toEqual({
      type: 'INTERVAL',
      repeatCycle: 'DAILY',
      repeatEvery: 1000,
    });
  });

  it('blocks an end date before the plan date and actually clears a confirmed end', () => {
    composer.togglePanel('repeat');
    composer.repeatChoice.set('DAILY');
    composer.repeatEndDay.set('2026-10-10');
    composer.confirmRepeat();
    expect(composer.state.state().repeat).toBeNull();
    expect(composer.panel()).toBe('repeat');
    composer.repeatEndDay.set('2026-10-12');
    composer.confirmRepeat();
    expect(composer.state.state().repeat).toEqual({
      type: 'PRESET',
      quickSetting: 'DAILY',
      endDate: '2026-10-12',
    });
    composer.togglePanel('repeat');
    composer.repeatEndDay.set(null);
    composer.confirmRepeat();
    expect(composer.state.state().repeat).toEqual({
      type: 'PRESET',
      quickSetting: 'DAILY',
    });
  });

  it('applies statutory workdays to the real interval payload and rejects an all-holiday range', () => {
    composer.togglePanel('repeat');
    composer.repeatChoice.set('MONDAY_TO_FRIDAY');
    composer.confirmRepeat();
    expect(composer.state.state().repeat).toEqual({
      type: 'INTERVAL',
      repeatCycle: 'DAILY',
      repeatEvery: 1,
      isChineseWorkday: true,
    });
    composer.state.clearRepeatSetting();
    composer.state.updateDate('2026-10-01');
    composer.togglePanel('repeat');
    composer.repeatChoice.set('MONDAY_TO_FRIDAY');
    composer.repeatEndDay.set('2026-10-07');
    composer.confirmRepeat();
    expect(composer.state.state().repeat).toBeNull();
    expect(composer.panel()).toBe('repeat');
    composer.repeatEndDay.set('2026-10-08');
    expect(composer.isRepeatValid()).toBeTrue();
  });

  it('revalidates a confirmed repeat when another plan date is selected', () => {
    composer.state.updateInputTxt('计划');
    composer.togglePanel('repeat');
    composer.repeatChoice.set('DAILY');
    composer.repeatEndDay.set('2026-10-12');
    composer.confirmRepeat();
    composer.selectDay('2026-10-13');
    fixture.detectChanges();
    expect(composer.isConfirmedRepeatValid()).toBeFalse();
    expect(
      (fixture.nativeElement.querySelector('.send') as HTMLButtonElement).disabled,
    ).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    composer.selectDay('2026-10-12');
    fixture.detectChanges();
    expect(composer.isConfirmedRepeatValid()).toBeTrue();
    expect(
      (fixture.nativeElement.querySelector('.send') as HTMLButtonElement).disabled,
    ).toBeFalse();
  });

  it('blocks unsupported statutory years without treating unconfirmed choices as saved rules', () => {
    composer.togglePanel('repeat');
    composer.repeatChoice.set('MONDAY_TO_FRIDAY');
    composer.confirmRepeat();
    composer.selectDay('2027-01-01');
    expect(composer.isConfirmedRepeatValid()).toBeFalse();
    composer.state.clearRepeatSetting();
    composer.togglePanel('repeat');
    composer.repeatChoice.set('MONDAY_TO_FRIDAY');
    expect(composer.isRepeatValid()).toBeFalse();
    expect(composer.isConfirmedRepeatValid()).toBeTrue();
  });

  it('requires a valid timed start for opt-in reminders', () => {
    composer.togglePanel('reminder');
    composer.reminderChoice.set(TaskReminderOptionId.m15);
    composer.reminderTime.set('');
    composer.confirmReminder();
    expect(composer.panel()).toBe('reminder');
    composer.reminderTime.set('14:00');
    composer.confirmReminder();
    expect(composer.state.state().time).toBe('14:00');
    expect(composer.state.state().remindOption).toBe(TaskReminderOptionId.m15);
  });

  it('selects categories, goals and no category using tags and projects', () => {
    composer.selectCategory('tag');
    expect(composer.categoryLabel()).toBe('分类');
    composer.selectGoal('goal');
    expect(composer.state.state().tagIds).toEqual([]);
    expect(composer.categoryLabel()).toBe('目标');
    composer.selectCategory(null);
    expect(composer.state.state().projectId).toBe(INBOX_PROJECT.id);
    expect(composer.categoryLabel()).toBeNull();
  });

  it('removes old project and tag syntax together when choosing no category', async () => {
    const parser = TestBed.inject(AddTaskBarParserService);
    const project = { ...DEFAULT_PROJECT, id: 'old', title: 'Old Goal' };
    const tag = { ...DEFAULT_TAG, id: 'old-tag', title: 'urgent' };
    const config: ShortSyntaxConfig = {
      isEnableProject: true,
      isEnableTag: true,
      isEnableDue: true,
      isEnableDeadline: false,
    };
    composer.state.updateInputTxt('Review +Old Goal #urgent');
    await parser.parseAndUpdateText(
      composer.state.inputTxt(),
      config,
      [project],
      [tag],
      INBOX_PROJECT,
    );
    composer.selectCategory(null);
    expect(composer.state.inputTxt()).toBe('Review');
    await parser.parseAndUpdateText(
      composer.state.inputTxt(),
      config,
      [project],
      [tag],
      INBOX_PROJECT,
    );
    expect(composer.state.state().projectId).toBe(INBOX_PROJECT.id);
    expect(composer.state.state().tagIdsFromTxt).toEqual([]);
  });

  it('creates and selects a category through the existing tag service', () => {
    dialog.open.and.returnValue({ afterClosed: () => of('  分类  ') } as ReturnType<
      MatDialog['open']
    >);
    tags.addTag.and.returnValue('new-tag');
    composer.createCategory();
    expect(dialog.open).toHaveBeenCalledWith(DialogPromptComponent, jasmine.any(Object));
    expect(tags.addTag).toHaveBeenCalledWith({ title: '分类' });
    expect(composer.state.state().tagIds).toEqual(['new-tag']);
  });

  it('selects the goal returned by the existing project creation dialog', () => {
    dialog.open.and.returnValue({ afterClosed: () => of('new-goal') } as ReturnType<
      MatDialog['open']
    >);
    composer.createGoal();
    expect(dialog.open).toHaveBeenCalledWith(DialogCreateProjectComponent);
    expect(composer.state.state().projectId).toBe('new-goal');
  });

  it('flushes the parent before children and the last child before completion', async () => {
    composer.draft.addChild('One');
    composer.draft.addChild('Two');
    const order: string[] = [];
    flush.flushPendingWrites.and.callFake(async () => {
      order.push('flush');
    });
    tasks.addSubTaskTo.and.callFake((_id, child) => {
      order.push(child!.title!);
      return 'child';
    });
    await composer.completeSubtasks('parent');
    expect(order).toEqual(['flush', 'One', 'flush', 'Two', 'flush']);
    expect(tasks.addSubTaskTo.calls.allArgs().map((args) => args[0])).toEqual([
      'parent',
      'parent',
    ]);
    expect(composer.pendingTaskId()).toBeNull();
  });

  it('resumes after a write interruption without recreating committed children', async () => {
    composer.draft.addChild('One');
    composer.draft.addChild('Two');
    flush.flushPendingWrites.and.returnValues(
      Promise.resolve(),
      Promise.reject(new Error('flush failed')),
    );
    await expectAsync(composer.completeSubtasks('parent')).toBeRejected();
    expect(composer.pendingTaskId()).toBe('parent');
    expect(composer.draft.children()).toEqual(['Two']);
    flush.flushPendingWrites.and.resolveTo();
    await composer.completeSubtasks('parent');
    expect(tasks.addSubTaskTo.calls.allArgs().map((args) => args[1]!.title)).toEqual([
      'One',
      'Two',
    ]);
  });
});
