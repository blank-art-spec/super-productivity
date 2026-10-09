import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { MatrixGroupId } from '../eisenhower-matrix.model';

@Component({
  selector: 'matrix-quadrant',
  imports: [MatIcon, TranslatePipe],
  templateUrl: './matrix-quadrant.component.html',
  styleUrl: './matrix-quadrant.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrixQuadrantComponent {
  readonly groupId = input.required<MatrixGroupId>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly icon = input.required<string>();
  readonly tone = input.required<string>();
  readonly count = input(0);
  readonly compact = input(false);
  readonly add = output<MatrixGroupId>();
  readonly viewAll = output<MatrixGroupId>();
  private readonly _viewAllButton =
    viewChild<ElementRef<HTMLButtonElement>>('viewAllButton');
  private readonly _addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');
  readonly T = T;

  focusViewAll(): void {
    (this._viewAllButton() ?? this._addButton())?.nativeElement.focus();
  }
}
