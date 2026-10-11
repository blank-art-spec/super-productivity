import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { InboxCaptureComponent } from './inbox-capture.component';
import { EisenhowerMatrixService } from '../../eisenhower-matrix/eisenhower-matrix.service';
import { DEFAULT_TASK, TaskWithSubTasks } from '../../tasks/task.model';
import { INBOX_PROJECT } from '../../project/project.const';
import { TaskService } from '../../tasks/task.service';
import { EisenhowerQuadrant } from '../../eisenhower-matrix/eisenhower-matrix.model';

describe('Inbox quick capture and organization', () => {
  const task = {
    ...DEFAULT_TASK,
    id: 'captured',
    projectId: INBOX_PROJECT.id,
    subTasks: [],
  } as TaskWithSubTasks;
  let component: InboxCaptureComponent;
  let add: jasmine.Spy;
  let update: jasmine.Spy;
  let open: jasmine.Spy;

  beforeEach(() => {
    add = jasmine.createSpy('add');
    update = jasmine.createSpy('update');
    open = jasmine
      .createSpy('open')
      .and.returnValue({ afterClosed: () => of(undefined) });
    TestBed.configureTestingModule({
      imports: [InboxCaptureComponent],
      providers: [
        { provide: MatDialog, useValue: { open } },
        { provide: Store, useValue: { selectSignal: () => signal([]) } },
        { provide: TaskService, useValue: { add } },
      ],
    }).overrideComponent(InboxCaptureComponent, {
      set: {
        template: '',
        imports: [],
        providers: [{ provide: EisenhowerMatrixService, useValue: { add, update } }],
      },
    });
    const fixture = TestBed.createComponent(InboxCaptureComponent);
    fixture.componentRef.setInput('tasks', [task]);
    component = fixture.componentInstance;
  });

  it('captures explicitly in Inbox, without inheriting a project or a scheduled day', () => {
    component.title = '  An idea  ';
    component.capture();
    expect(add).toHaveBeenCalledWith(
      'An idea',
      false,
      {
        projectId: INBOX_PROJECT.id,
        dueDay: null,
        dueWithTime: null,
        tagIds: [],
      },
      true,
    );
    expect(component.title).toBe('');
  });

  it('does not create a blank task', () => {
    component.title = '  ';
    component.capture();
    expect(add).not.toHaveBeenCalled();
  });

  it('passes short syntax to the original task entry point without disabling it', () => {
    component.title = 'Read #learning 20m';
    component.capture();
    expect(add.calls.mostRecent().args[0]).toBe('Read #learning 20m');
    expect(add.calls.mostRecent().args[4]).toBeUndefined();
  });

  it('applies an organization edit through one existing task update', async () => {
    const fields = {
      projectId: 'destination',
      eisenhowerQuadrant: EisenhowerQuadrant.SCHEDULE,
      dueDay: '2026-10-10',
    };
    open.and.returnValue({
      afterClosed: () => of({ title: task.title, projectId: 'destination', fields }),
    });
    component.taskId.set(task.id);
    await component.organize();
    expect(update).toHaveBeenCalledOnceWith(task, fields);
  });

  it('leaves canceled edits and tasks that have moved out of Inbox alone', async () => {
    component.taskId.set(task.id);
    await component.organize();
    expect(update).not.toHaveBeenCalled();
    component.taskId.set('no-longer-in-inbox');
    await component.organize();
    expect(open).toHaveBeenCalledTimes(1);
  });
});
