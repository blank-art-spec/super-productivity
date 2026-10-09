import { T } from '../../t.const';
import { EisenhowerQuadrant, MatrixGroupId } from './eisenhower-matrix.model';

export const MATRIX_QUADRANTS: ReadonlyArray<{
  id: MatrixGroupId;
  title: string;
  description: string;
  icon: string;
  tone: string;
}> = [
  {
    id: EisenhowerQuadrant.DO_FIRST,
    title: T.F.MATRIX.DO_FIRST,
    description: T.F.MATRIX.IMPORTANT_URGENT,
    icon: 'bolt',
    tone: 'do-first',
  },
  {
    id: EisenhowerQuadrant.SCHEDULE,
    title: T.F.MATRIX.SCHEDULE,
    description: T.F.MATRIX.IMPORTANT_NOT_URGENT,
    icon: 'event',
    tone: 'schedule',
  },
  {
    id: EisenhowerQuadrant.DELEGATE,
    title: T.F.MATRIX.DELEGATE,
    description: T.F.MATRIX.NOT_IMPORTANT_URGENT,
    icon: 'outgoing_mail',
    tone: 'delegate',
  },
  {
    id: EisenhowerQuadrant.ELIMINATE,
    title: T.F.MATRIX.ELIMINATE,
    description: T.F.MATRIX.NOT_IMPORTANT_NOT_URGENT,
    icon: 'eco',
    tone: 'eliminate',
  },
  {
    id: null,
    title: T.F.MATRIX.UNCLASSIFIED,
    description: T.F.MATRIX.UNCLASSIFIED_DESCRIPTION,
    icon: 'inbox',
    tone: 'unclassified',
  },
];
