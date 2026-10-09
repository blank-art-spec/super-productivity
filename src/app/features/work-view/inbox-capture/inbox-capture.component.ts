import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { T } from '../../../t.const';
import { TaskWithSubTasks } from '../../tasks/task.model';
import { INBOX_PROJECT } from '../../project/project.const';
import { selectUnarchivedProjects } from '../../project/store/project.selectors';
import { selectAllTagsWithoutMyDay } from '../../tag/store/tag.reducer';
import { EisenhowerMatrixService } from '../../eisenhower-matrix/eisenhower-matrix.service';
import {
  MatrixTaskEditorComponent,
  MatrixTaskEditorData,
  MatrixTaskEditorResult,
} from '../../eisenhower-matrix/matrix-task-editor/matrix-task-editor.component';

@Component({
  selector: 'inbox-capture',
  imports: [FormsModule, MatIcon, TranslatePipe],
  providers: [EisenhowerMatrixService],
  templateUrl: './inbox-capture.component.html',
  styleUrl: './inbox-capture.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxCaptureComponent {
  private readonly _matrix = inject(EisenhowerMatrixService);
  private readonly _dialog = inject(MatDialog);
  private readonly _store = inject(Store);
  private readonly _projects = this._store.selectSignal(selectUnarchivedProjects);
  private readonly _tags = this._store.selectSignal(selectAllTagsWithoutMyDay);
  readonly tasks = input.required<TaskWithSubTasks[]>();
  readonly taskId = signal('');
  readonly selectedTask = computed(() =>
    this.tasks().find((task) => task.id === this.taskId()),
  );
  readonly T = T;
  title = '';

  capture(): void {
    const title = this.title.trim();
    if (!title) return;
    this._matrix.add(title, { projectId: INBOX_PROJECT.id });
    this.title = '';
  }

  async organize(): Promise<void> {
    const task = this.selectedTask();
    if (!task) return;
    const result = await firstValueFrom(
      this._dialog
        .open<MatrixTaskEditorComponent, MatrixTaskEditorData, MatrixTaskEditorResult>(
          MatrixTaskEditorComponent,
          {
            width: '520px',
            maxWidth: '95vw',
            restoreFocus: true,
            data: {
              task,
              projects: this._projects(),
              tags: this._tags(),
              projectId: INBOX_PROJECT.id,
              tagId: '',
              quadrant: task.eisenhowerQuadrant ?? null,
              day: '',
            },
          },
        )
        .afterClosed(),
    );
    if (result && Object.keys(result.fields).length)
      this._matrix.update(task, result.fields);
  }
}
