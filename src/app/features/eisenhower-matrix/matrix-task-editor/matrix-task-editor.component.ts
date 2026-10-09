import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { Project } from '../../project/project.model';
import { Tag } from '../../tag/tag.model';
import { Task, TaskCopy } from '../../tasks/task.model';
import { getDbDateStr, isValidDBDateStr } from '../../../util/get-db-date-str';
import { MATRIX_QUADRANTS } from '../eisenhower-matrix.const';
import { MatrixGroupId } from '../eisenhower-matrix.model';

export interface MatrixTaskEditorData {
  task?: Task;
  projects: readonly Project[];
  tags: readonly Tag[];
  projectId: string;
  tagId: string;
  quadrant: MatrixGroupId;
  day: string;
}

export interface MatrixTaskEditorResult {
  title: string;
  projectId: string;
  fields: Partial<Task>;
}

@Component({
  selector: 'matrix-task-editor',
  imports: [FormsModule, MatDialogModule, MatButton, TranslatePipe],
  templateUrl: './matrix-task-editor.component.html',
  styleUrl: './matrix-task-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrixTaskEditorComponent {
  readonly data = inject<MatrixTaskEditorData>(MAT_DIALOG_DATA);
  private readonly _dialogRef =
    inject<MatDialogRef<MatrixTaskEditorComponent, MatrixTaskEditorResult>>(MatDialogRef);
  readonly T = T;
  readonly quadrants = MATRIX_QUADRANTS;
  title = this.data.task?.title ?? '';
  projectId = this.data.task?.projectId ?? this.data.projectId;
  quadrant = this.data.task?.eisenhowerQuadrant ?? this.data.quadrant;
  tagIds = this.data.task
    ? [...this.data.task.tagIds]
    : this.data.tagId
      ? [this.data.tagId]
      : [];
  day = this.data.task
    ? this.data.task.dueWithTime != null
      ? getDbDateStr(this.data.task.dueWithTime)
      : (this.data.task.dueDay ?? '')
    : this.data.day;
  time =
    this.data.task?.dueWithTime != null
      ? `${String(new Date(this.data.task.dueWithTime).getHours()).padStart(2, '0')}:${String(new Date(this.data.task.dueWithTime).getMinutes()).padStart(2, '0')}`
      : '';
  minutes = (this.data.task?.timeEstimate ?? 0) / 60000;
  private readonly _initialDay = this.day;
  private readonly _initialTime = this.time;
  private readonly _initialMinutes = this.minutes;

  save(): void {
    const title = this.title.trim();
    if (!title || !this.projectId || !Number.isFinite(this.minutes) || this.minutes < 0)
      return;
    if (this.day && !isValidDBDateStr(this.day)) return;
    if (this.time && (!this.day || !/^([01]\d|2[0-3]):[0-5]\d$/.test(this.time))) return;

    const task = this.data.task;
    const fields: Partial<TaskCopy> = {};
    if (!task || this.projectId !== task.projectId) fields.projectId = this.projectId;
    if (!task || title !== task.title) fields.title = title;
    if (!task || this.quadrant !== (task.eisenhowerQuadrant ?? null)) {
      fields.eisenhowerQuadrant = this.quadrant;
    }
    if (!task || this.minutes !== this._initialMinutes)
      fields.timeEstimate = this.minutes * 60000;
    if (!task || this.tagIds.join('\0') !== task.tagIds.join('\0'))
      fields.tagIds = [...this.tagIds];
    if (!task || this.day !== this._initialDay || this.time !== this._initialTime) {
      fields.dueWithTime =
        this.day && this.time ? new Date(`${this.day}T${this.time}`).getTime() : null;
      fields.dueDay = this.day && !this.time ? this.day : null;
    }
    // Send only changed fields, preserving concurrent edits and sub-minute scheduled times.
    this._dialogRef.close({ title, projectId: this.projectId, fields });
  }
}
