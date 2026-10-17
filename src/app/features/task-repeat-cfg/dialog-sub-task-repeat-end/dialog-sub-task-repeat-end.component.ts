import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { DatePickerInputComponent } from '../../../ui/date-picker-input/date-picker-input.component';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { T } from '../../../t.const';

@Component({
  selector: 'dialog-sub-task-repeat-end',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    TranslatePipe,
    DatePickerInputComponent,
  ],
  template: `
    <h2 mat-dialog-title>{{ T.F.TASK_REPEAT.F.SUB_TASK_END_DATE | translate }}</h2>
    <mat-dialog-content>
      <date-picker-input
        [label]="T.F.TASK_REPEAT.F.SUB_TASK_END_DATE | translate"
        [ngModel]="endDate()"
        (ngModelChange)="setDate($event)"
        (isValidChange)="isDateValid.set($event)"
      ></date-picker-input>
      <p>{{ T.F.TASK_REPEAT.F.SUB_TASK_END_DATE_DESCRIPTION | translate }}</p>
      @if (data.parentEndDate) {
        <p>{{ T.F.TASK_REPEAT.F.END_DATE | translate }}: {{ data.parentEndDate }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        (click)="dialogRef.close()"
      >
        {{ T.G.CANCEL | translate }}
      </button>
      <button
        mat-button
        (click)="dialogRef.close(null)"
      >
        {{ T.G.CLEAR | translate }}
      </button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!isDateValid()"
        (click)="dialogRef.close(endDate())"
      >
        {{ T.G.SAVE | translate }}
      </button>
    </mat-dialog-actions>
  `,
})
export class DialogSubTaskRepeatEndComponent {
  readonly data = inject<{ endDate: string | null; parentEndDate: string | null }>(
    MAT_DIALOG_DATA,
  );
  readonly dialogRef =
    inject<MatDialogRef<DialogSubTaskRepeatEndComponent, string | null>>(MatDialogRef);
  readonly T = T;
  readonly endDate = signal(this.data.endDate);
  readonly isDateValid = signal(true);
  setDate(date: Date | null): void {
    this.endDate.set(date ? getDbDateStr(date) : null);
  }
}
