export enum EisenhowerQuadrant {
  DO_FIRST = 'DO_FIRST',
  SCHEDULE = 'SCHEDULE',
  DELEGATE = 'DELEGATE',
  ELIMINATE = 'ELIMINATE',
}

export type MatrixTimeFilter = 'all' | 'today' | 'week' | 'day';
export type MatrixGroupId = EisenhowerQuadrant | null;

export interface MatrixFilter {
  time: MatrixTimeFilter;
  projectId: string;
  tagId: string;
  /** View-only calendar anchor; never written to a task. */
  day?: string;
}
