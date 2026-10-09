import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { EisenhowerMatrixService } from './eisenhower-matrix.service';
import { EisenhowerQuadrant } from './eisenhower-matrix.model';
import { WorkContextType } from '../work-context/work-context.model';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';

describe('EisenhowerMatrixService', () => {
  let service: EisenhowerMatrixService;
  let taskService: jasmine.SpyObj<TaskService>;
  let store: jasmine.SpyObj<Store>;
  const task: Task = {
    ...DEFAULT_TASK,
    id: 'task',
    projectId: 'project',
    priority: 3,
    dueDay: '2026-10-09',
    deadlineDay: '2026-10-10',
  };

  beforeEach(() => {
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
      ],
    });
    service = TestBed.inject(EisenhowerMatrixService);
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
