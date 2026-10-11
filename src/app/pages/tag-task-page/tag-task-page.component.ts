import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { WorkViewComponent } from '../../features/work-view/work-view.component';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { TODAY_TAG } from '../../features/tag/tag.const';
import { EisenhowerMatrixPageComponent } from '../../features/eisenhower-matrix/eisenhower-matrix-page.component';

@Component({
  selector: 'tag-task-page',
  templateUrl: './tag-task-page.component.html',
  styleUrl: '../project-task-page/project-task-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WorkViewComponent, TranslatePipe, EisenhowerMatrixPageComponent],
})
export class TagTaskPageComponent {
  private _workContextService = inject(WorkContextService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _params = toSignal(this._route.paramMap);
  private readonly _queryParams = toSignal(this._route.queryParamMap);
  readonly T = T;
  readonly tagId = computed(() => this._params()?.get('id') ?? null);
  readonly isMatrixAvailable = computed(
    () => !!this.tagId() && this.tagId() !== TODAY_TAG.id,
  );
  private readonly _viewContext = computed(
    () => `${this.tagId() ?? ''}\0${this._queryParams()?.get('focusItem') ?? ''}`,
  );
  readonly isMatrixView = linkedSignal({
    source: this._viewContext,
    computation: () => false,
  });

  backlogTasks = toSignal(this._workContextService.backlogTasks$, { initialValue: [] });
  doneTasks = toSignal(this._workContextService.doneTasks$, { initialValue: [] });
  undoneTasks = toSignal(this._workContextService.undoneTasks$, { initialValue: [] });
}
