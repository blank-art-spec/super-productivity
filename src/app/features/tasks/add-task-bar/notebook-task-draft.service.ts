import { Injectable, signal } from '@angular/core';
import { EisenhowerQuadrant } from '../../eisenhower-matrix/eisenhower-matrix.model';
import { SS } from '../../../core/persistence/storage-keys.const';

interface NotebookDraft {
  quadrant: EisenhowerQuadrant | null;
  children: string[];
  pendingTaskId: string | null;
}

const loadDraft = (): NotebookDraft => {
  const empty: NotebookDraft = { quadrant: null, children: [], pendingTaskId: null };
  try {
    const saved: Partial<NotebookDraft> | null = JSON.parse(
      sessionStorage.getItem(SS.NOTEBOOK_TASK_DRAFT) || 'null',
    );
    if (!saved) return empty;
    return {
      quadrant:
        saved.quadrant && Object.values(EisenhowerQuadrant).includes(saved.quadrant)
          ? saved.quadrant
          : null,
      children: Array.isArray(saved.children)
        ? saved.children.filter((title) => typeof title === 'string' && !!title.trim())
        : [],
      pendingTaskId: typeof saved.pendingTaskId === 'string' ? saved.pendingTaskId : null,
    };
  } catch {
    return empty;
  }
};

/** Transient composer choices. Persisted tasks still use the existing task model. */
@Injectable()
export class NotebookTaskDraftService {
  private readonly _saved = loadDraft();
  private readonly _quadrant = signal(this._saved.quadrant);
  private readonly _children = signal(this._saved.children);
  private readonly _pendingTaskId = signal(this._saved.pendingTaskId);
  readonly quadrant = this._quadrant.asReadonly();
  readonly children = this._children.asReadonly();
  readonly pendingTaskId = this._pendingTaskId.asReadonly();

  selectQuadrant(quadrant: EisenhowerQuadrant | null): void {
    this._quadrant.set(quadrant);
    this._save();
  }

  setPendingTaskId(taskId: string | null): void {
    this._pendingTaskId.set(taskId);
    this._save();
  }

  addChild(title: string): boolean {
    const trimmed = title.trim();
    if (!trimmed) return false;
    this._children.update((children) => [...children, trimmed]);
    this._save();
    return true;
  }

  removeChild(index: number): void {
    this._children.update((children) => children.filter((_, i) => i !== index));
    this._save();
  }

  reset(): void {
    this._quadrant.set(null);
    this._children.set([]);
    this._pendingTaskId.set(null);
    sessionStorage.removeItem(SS.NOTEBOOK_TASK_DRAFT);
  }

  private _save(): void {
    sessionStorage.setItem(
      SS.NOTEBOOK_TASK_DRAFT,
      JSON.stringify({
        quadrant: this.quadrant(),
        children: this.children(),
        pendingTaskId: this.pendingTaskId(),
      } satisfies NotebookDraft),
    );
  }
}
