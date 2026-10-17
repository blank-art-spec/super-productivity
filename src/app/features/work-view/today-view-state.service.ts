import { Injectable, signal } from '@angular/core';

export const DONE_TASK_PAGE_SIZE = 50;

/** Session-only display state. No task data, storage writes or cached DOM. */
@Injectable({ providedIn: 'root' })
export class TodayViewStateService {
  readonly doneTasksHidden = signal(true);
  readonly visibleDoneTaskCount = signal(DONE_TASK_PAGE_SIZE);
  scrollTop = 0;
}
