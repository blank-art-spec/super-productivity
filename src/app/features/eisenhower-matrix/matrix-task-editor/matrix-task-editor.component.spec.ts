import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DEFAULT_TASK, Task } from '../../tasks/task.model';
import { EisenhowerQuadrant } from '../eisenhower-matrix.model';
import {
  MatrixTaskEditorComponent,
  MatrixTaskEditorData,
} from './matrix-task-editor.component';

describe('Matrix task editor field patches', () => {
  let dialog: jasmine.SpyObj<MatDialogRef<MatrixTaskEditorComponent>>;
  const task: Task = {
    ...DEFAULT_TASK,
    id: 'task',
    title: 'Existing task',
    projectId: 'project',
    dueWithTime: new Date('2026-10-09T18:30:45').getTime(),
    deadlineDay: '2026-10-10',
    priority: 'high',
    timeEstimate: 1234567,
    tagIds: ['existing-tag'],
  };
  const create = (source?: Task): MatrixTaskEditorComponent => {
    const data: MatrixTaskEditorData = {
      task: source,
      projects: [],
      tags: [],
      projectId: 'project',
      tagId: '',
      quadrant: null,
      day: '',
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialog },
      ],
    });
    return TestBed.runInInjectionContext(() => new MatrixTaskEditorComponent());
  };

  beforeEach(() => {
    dialog = jasmine.createSpyObj<MatDialogRef<MatrixTaskEditorComponent>>(
      'MatDialogRef',
      ['close'],
    );
  });

  it('editing a title preserves timed dates, priority, deadlines and tags', () => {
    const editor = create(task);
    editor.title = 'Changed title';
    editor.save();
    expect(dialog.close).toHaveBeenCalledOnceWith({
      title: 'Changed title',
      projectId: 'project',
      fields: { title: 'Changed title' },
    });
  });

  it('saving without edits sends no task-field changes', () => {
    create(task).save();
    expect(dialog.close).toHaveBeenCalledOnceWith({
      title: task.title,
      projectId: 'project',
      fields: {},
    });
  });

  it('clears the timed value when a task becomes all-day', () => {
    const editor = create(task);
    editor.time = '';
    editor.save();
    expect(dialog.close).toHaveBeenCalledOnceWith({
      title: task.title,
      projectId: 'project',
      fields: { dueDay: '2026-10-09', dueWithTime: null },
    });
  });

  it('changes only the chosen quadrant when assigning an existing task', () => {
    const editor = create(task);
    editor.quadrant = EisenhowerQuadrant.SCHEDULE;
    editor.save();
    expect(dialog.close).toHaveBeenCalledOnceWith({
      title: task.title,
      projectId: 'project',
      fields: { eisenhowerQuadrant: EisenhowerQuadrant.SCHEDULE },
    });
  });

  it('keeps a new undated task unclassified', () => {
    const editor = create();
    editor.title = '  New task  ';
    editor.save();
    expect(dialog.close).toHaveBeenCalledOnceWith({
      title: 'New task',
      projectId: 'project',
      fields: {
        projectId: 'project',
        title: 'New task',
        eisenhowerQuadrant: null,
        timeEstimate: 0,
        tagIds: [],
        dueDay: null,
        dueWithTime: null,
      },
    });
  });

  it('rejects whitespace-only titles, invalid dates and a time without a date', () => {
    const editor = create();
    editor.title = ' ';
    editor.save();
    editor.title = 'Valid title';
    editor.day = '2026-02-30';
    editor.save();
    editor.day = '';
    editor.time = '18:00';
    editor.save();
    expect(dialog.close).not.toHaveBeenCalled();
  });
});
