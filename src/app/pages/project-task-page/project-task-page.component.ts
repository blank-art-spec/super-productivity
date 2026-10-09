import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { WorkViewComponent } from '../../features/work-view/work-view.component';
import { ProjectService } from '../../features/project/project.service';
import { PlainspaceClaimPoolService } from '../../features/plainspace/plainspace-claim-pool.service';
import { PlainspaceSharedTask } from '../../features/plainspace/plainspace-shared-task.model';
import { T } from '../../t.const';
import { INBOX_PROJECT } from '../../features/project/project.const';
import { InboxCaptureComponent } from '../../features/work-view/inbox-capture/inbox-capture.component';
import { EisenhowerMatrixPageComponent } from '../../features/eisenhower-matrix/eisenhower-matrix-page.component';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'work-view-page',
  templateUrl: './project-task-page.component.html',
  styleUrls: ['./project-task-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    TranslatePipe,
    WorkViewComponent,
    InboxCaptureComponent,
    EisenhowerMatrixPageComponent,
  ],
})
export class ProjectTaskPageComponent {
  workContextService = inject(WorkContextService);
  private readonly _projectService = inject(ProjectService);
  private readonly _plainspaceClaimPoolService = inject(PlainspaceClaimPoolService);

  readonly T = T;

  // Unclaimed Plainspace tasks (only for projects shared on Plainspace); fed
  // into the work view's read-only "claim pool" panel. `currentProject$` re-emits
  // on every task add/complete/reorder (the project entity carries taskIds), so
  // distinct on the id first — otherwise the pool re-fetches `/claimable-tasks`
  // on every task change.
  readonly unclaimedTasks = toSignal(
    this._projectService.currentProject$.pipe(
      map((project) => project?.id ?? null),
      distinctUntilChanged(),
      switchMap((projectId) =>
        projectId
          ? this._plainspaceClaimPoolService.unclaimedTasksForProject$(projectId)
          : of([] as PlainspaceSharedTask[]),
      ),
    ),
    { initialValue: [] as PlainspaceSharedTask[] },
  );

  isShowBacklog = toSignal(
    this.workContextService.activeWorkContext$.pipe(
      map((workContext) => !!workContext.isEnableBacklog),
    ),
    { initialValue: false },
  );

  backlogTasks = toSignal(this.workContextService.backlogTasks$, { initialValue: [] });
  doneTasks = toSignal(this.workContextService.doneTasks$, { initialValue: [] });
  undoneTasks = toSignal(this.workContextService.undoneTasks$, { initialValue: [] });

  readonly currentProject = toSignal(this._projectService.currentProject$, {
    initialValue: null,
  });
  readonly isInbox = computed(() => this.currentProject()?.id === INBOX_PROJECT.id);
  private readonly _queryParams = toSignal(inject(ActivatedRoute).queryParamMap);
  readonly inboxTasks = computed(() => [...this.undoneTasks(), ...this.backlogTasks()]);
  private readonly _viewContext = computed(
    () =>
      `${this.currentProject()?.id ?? ''}\0${this._queryParams()?.get('focusItem') ?? ''}`,
  );
  readonly isMatrixView = linkedSignal({
    source: this._viewContext,
    computation: () => false,
  });

  restoreProject(): void {
    const project = this.currentProject();
    if (project) {
      if (project.isDone) {
        this._projectService.reopen(project.id, project);
      } else {
        this._projectService.unarchive(project.id);
      }
    }
  }
}
