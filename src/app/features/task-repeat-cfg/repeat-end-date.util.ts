import { getDbDateStr } from '../../util/get-db-date-str';
import { Task } from '../tasks/task.model';
import { TaskRepeatCfg } from './task-repeat-cfg.model';

export type RepeatSubTaskTemplate = NonNullable<
  TaskRepeatCfg['subTaskTemplates']
>[number];

export const isWithinRepeatEndDate = (
  endDate: string | null | undefined,
  day: string,
): boolean => !endDate || day <= endDate;

export const limitRepeatOccurrence = (
  cfg: TaskRepeatCfg,
  date: Date | null,
): Date | null =>
  date && isWithinRepeatEndDate(cfg.endDate, getDbDateStr(date)) ? date : null;

export const getRepeatSubTaskTemplateId = (
  template: RepeatSubTaskTemplate,
  index: number,
  repeatCfgId?: string,
): string => template.id ?? `${repeatCfgId ? `${repeatCfgId}:` : ''}legacy-${index}`;

/** Resolve legacy children without guessing by title (duplicate titles are valid). */
export const findRepeatSubTaskTemplateIndex = (
  task: Task,
  parent: Task,
  templates: readonly RepeatSubTaskTemplate[],
): number => {
  const explicit = templates.findIndex(
    (template) =>
      template.id === task.id ||
      template.sourceTaskId === task.id ||
      (!!task.repeatSubTaskId && template.id === task.repeatSubTaskId),
  );
  if (explicit >= 0) return explicit;
  const prefix = `${parent.id}_sub_`;
  const legacyIndex = task.id.startsWith(prefix)
    ? Number(task.id.slice(prefix.length))
    : parent.subTaskIds.indexOf(task.id);
  if (!Number.isInteger(legacyIndex) || legacyIndex < 0) return -1;
  const stableLegacyIndex = templates.findIndex(
    (template) =>
      template.id === `legacy-${legacyIndex}` ||
      template.id === `${parent.repeatCfgId}:legacy-${legacyIndex}`,
  );
  if (stableLegacyIndex >= 0) return stableLegacyIndex;
  return templates[legacyIndex] && !templates[legacyIndex].id ? legacyIndex : -1;
};

/**
 * Keep expired slots: removing them would shift deterministic child IDs, and
 * an ordinary edit of tomorrow's remaining child would erase the expired rule.
 */
export const buildRepeatSubTaskTemplates = (
  subs: Task[],
  previous: readonly RepeatSubTaskTemplate[] = [],
  parent?: Task,
): RepeatSubTaskTemplate[] => {
  const hasRules = previous.some((template) => template.id || template.repeatEndDate);
  const current = subs.map((sub): RepeatSubTaskTemplate => {
    const index = parent ? findRepeatSubTaskTemplateIndex(sub, parent, previous) : -1;
    const old = previous[index];
    const id = sub.repeatSubTaskId || old?.id || (hasRules ? sub.id : undefined);
    // A row records the rule when it was created/edited. A newer rule may
    // have been saved through another instance, including an explicit clear.
    const endDate =
      old?.repeatEndDate !== undefined ? old.repeatEndDate : sub.repeatEndDate;
    return {
      title: sub.title,
      notes: sub.notes,
      timeEstimate: sub.timeEstimate,
      ...(id ? { id } : {}),
      ...(old?.sourceTaskId ? { sourceTaskId: old.sourceTaskId } : {}),
      ...(endDate !== undefined ? { repeatEndDate: endDate } : {}),
    };
  });
  if (parent) {
    const occurrenceDay = getDbDateStr(parent.created);
    previous.forEach((template, index) => {
      if (
        template.repeatEndDate &&
        template.repeatEndDate < occurrenceDay &&
        !current.some(
          (item) =>
            item.id === getRepeatSubTaskTemplateId(template, index, parent.repeatCfgId),
        )
      ) {
        current.splice(Math.min(index, current.length), 0, template);
      }
    });
  }
  return current;
};
