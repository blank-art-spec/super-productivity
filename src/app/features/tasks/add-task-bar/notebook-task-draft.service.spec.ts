import { TestBed } from '@angular/core/testing';
import { NotebookTaskDraftService } from './notebook-task-draft.service';
import { EisenhowerQuadrant } from '../../eisenhower-matrix/eisenhower-matrix.model';
import { SS } from '../../../core/persistence/storage-keys.const';

describe('NotebookTaskDraftService', () => {
  let draft: NotebookTaskDraftService;
  beforeEach(() => {
    sessionStorage.removeItem(SS.NOTEBOOK_TASK_DRAFT);
    TestBed.configureTestingModule({ providers: [NotebookTaskDraftService] });
    draft = TestBed.inject(NotebookTaskDraftService);
  });

  it('ignores blank children and trims real titles', () => {
    expect(draft.addChild(' \n ')).toBeFalse();
    expect(draft.addChild('  Read  ')).toBeTrue();
    expect(draft.children()).toEqual(['Read']);
  });

  it('keeps duplicate titles as separate subtasks and removes only the chosen one', () => {
    draft.addChild('Read');
    draft.addChild('Read');
    draft.removeChild(1);
    expect(draft.children()).toEqual(['Read']);
  });

  it('clears quadrant and children after a successful add', () => {
    draft.selectQuadrant(EisenhowerQuadrant.SCHEDULE);
    draft.addChild('Read');
    draft.reset();
    expect(draft.quadrant()).toBeNull();
    expect(draft.children()).toEqual([]);
  });

  it('restores remaining children and a pending parent when reopening the composer', () => {
    draft.addChild('One');
    draft.addChild('Two');
    draft.setPendingTaskId('parent');
    draft.removeChild(0);
    const reopened = new NotebookTaskDraftService();
    expect(reopened.pendingTaskId()).toBe('parent');
    expect(reopened.children()).toEqual(['Two']);
    draft.reset();
    expect(new NotebookTaskDraftService().pendingTaskId()).toBeNull();
  });
});
