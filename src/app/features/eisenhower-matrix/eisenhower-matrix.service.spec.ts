import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { EisenhowerMatrixService } from './eisenhower-matrix.service';
import { EisenhowerQuadrant } from './eisenhower-matrix.model';
import { WorkContextType } from '../work-context/work-context.model';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { signal } from '@angular/core';
import { GlobalConfigService } from '../config/global-config.service';
import { DEFAULT_GLOBAL_CONFIG } from '../config/default-global-config.const';
import { MiscConfig } from '../config/global-config.model';

describe('EisenhowerMatrixService', () => {
  let service: EisenhowerMatrixService;
  let taskService: jasmine.SpyObj<TaskService>;
  let store: jasmine.SpyObj<Store>;
  const misc = signal<MiscConfig>(DEFAULT_GLOBAL_CONFIG.misc);
  let config: { misc: typeof misc; updateSection: jasmine.Spy };
  const task: Task = {
    ...DEFAULT_TASK,
    id: 'task',
    projectId: 'project',
    priority: 3,
    dueDay: '2026-10-09',
    deadlineDay: '2026-10-10',
  };

  beforeEach(() => {
    misc.set(DEFAULT_GLOBAL_CONFIG.misc);
    config = { misc, updateSection: jasmine.createSpy('updateSection') };
    taskService = jasmine.createSpyObj<TaskService>('TaskService', [
      'createNewTaskWithDefaults',
      'update',
    ]);
    taskService.createNewTaskWithDefaults.and.returnValue(task);
    store = jasmine.createSpyObj<Store>('Store', ['dispatch']);
    TestBed.configureTestingModule({
      providers: [
        EisenhowerMatrixService,
        { provide: TaskService, useValue: taskService },
        { provide: Store, useValue: store },
        { provide: GlobalConfigService, useValue: config },
      ],
    });
    service = TestBed.inject(EisenhowerMatrixService);
  });

  it('saves a move as one config patch without changing any task or other settings', () => {
    const second: Task = { ...task, id: 'second' };
    service.reorder([task, second], 'second', 0);
    expect(config.updateSection).toHaveBeenCalledOnceWith(
      'misc',
      { matrixTaskOrder: ['task:second', 'task:task'] },
      true,
    );
    expect(taskService.update).not.toHaveBeenCalled();
    expect(store.dispatch).not.toHaveBeenCalled();
    expect(misc()).toBe(DEFAULT_GLOBAL_CONFIG.misc);
    expect(task.dueDay).toBe('2026-10-09');
  });

  it('reads saved ordering and skips no-op moves', () => {
    misc.set({ ...DEFAULT_GLOBAL_CONFIG.misc, matrixTaskOrder: ['task:task'] });
    service.reorder([task], task.id, 0);
    expect(config.updateSection).not.toHaveBeenCalled();
  });

  it('classifies through a single field patch without changing priority or dates', () => {
    service.classify(task, EisenhowerQuadrant.SCHEDULE);
    expect(taskService.update).toHaveBeenCalledOnceWith('task', {
      eisenhowerQuadrant: EisenhowerQuadrant.SCHEDULE,
    });
    expect(task.priority).toBe(3);
    expect(task.dueDay).toBe('2026-10-09');
    expect(task.deadlineDay).toBe('2026-10-10');
  });

  it('clears a saved quadrant explicitly and does not write no-op moves', () => {
    service.classify({ ...task, eisenhowerQuadrant: EisenhowerQuadrant.SCHEDULE }, null);
    expect(taskService.update).toHaveBeenCalledOnceWith('task', {
      eisenhowerQuadrant: null,
    });
    taskService.update.calls.reset();
    service.classify(task, null);
    service.classify(
      { ...task, eisenhowerQuadrant: EisenhowerQuadrant.SCHEDULE },
      EisenhowerQuadrant.SCHEDULE,
    );
    expect(taskService.update).not.toHaveBeenCalled();
  });

  it('creates a task in the chosen project without inheriting another work context', () => {
    expect(
      service.add('New task', {
        projectId: 'project',
        eisenhowerQuadrant: EisenhowerQuadrant.DO_FIRST,
      }),
    ).toBe('task');
    expect(taskService.createNewTaskWithDefaults).toHaveBeenCalledOnceWith({
      title: 'New task',
      workContextId: 'project',
      workContextType: WorkContextType.PROJECT,
      additional: {
        dueDay: null,
        dueWithTime: null,
        tagIds: [],
        projectId: 'project',
        eisenhowerQuadrant: EisenhowerQuadrant.DO_FIRST,
      },
    });
    expect(store.dispatch).toHaveBeenCalledOnceWith(
      TaskSharedActions.addTask({
        task,
        workContextId: 'project',
        workContextType: WorkContextType.PROJECT,
        isAddToBacklog: false,
        isAddToBottom: true,
        isIgnoreShortSyntax: true,
      }),
    );
  });

  it('preserves the reminder offset when moving a timed task', () => {
    const due = new Date('2026-10-09T18:30:45').getTime();
    const nextDue = due + 86400000;
    service.update(
      { ...task, dueWithTime: due, remindAt: due - 900000 },
      {
        dueWithTime: nextDue,
        dueDay: null,
      },
    );
    expect(taskService.update).toHaveBeenCalledOnceWith(task.id, {
      dueWithTime: nextDue,
      dueDay: null,
      remindAt: nextDue - 900000,
    });
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  for (const dueDay of ['2026-10-10', null]) {
    it(`clears the reminder through a JSON-safe action when changing to ${dueDay}`, () => {
      service.update(
        { ...task, dueWithTime: 1000000, remindAt: 900000 },
        {
          dueWithTime: null,
          dueDay,
        },
      );
      const action = store.dispatch.calls.mostRecent().args[0];
      expect(JSON.parse(JSON.stringify(action))).toEqual(
        TaskSharedActions.dismissReminderOnly({ id: task.id, isSkipSnack: true }),
      );
      expect(taskService.update).toHaveBeenCalledOnceWith(task.id, {
        dueWithTime: null,
        dueDay,
      });
    });
  }

  it('does not create reminders or change them during unrelated edits', () => {
    service.update(task, { dueWithTime: 1000000, dueDay: null });
    expect(taskService.update).toHaveBeenCalledWith(task.id, {
      dueWithTime: 1000000,
      dueDay: null,
    });
    service.update({ ...task, remindAt: 900000 }, { title: 'Changed' });
    expect(taskService.update).toHaveBeenCalledWith(task.id, { title: 'Changed' });
    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
