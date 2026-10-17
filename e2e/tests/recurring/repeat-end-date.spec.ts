import { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test.fixture';
import { openRecurDialog, saveRecurDialog } from '../../utils/recurring-task-helpers';
import { waitForStatePersistence } from '../../utils/waits';

test.use({ timezoneId: 'UTC' });

const coldOpenOnDay = async (page: Page, date: string): Promise<void> => {
  await waitForStatePersistence(page);
  // Close the running app before jumping days. Changing its clock while RxJS
  // timers are flushing can execute an already cancelled scheduled action.
  await page.goto('about:blank');
  await page.clock.setSystemTime(new Date(`${date}T10:00:00Z`));
  await page.goto('/');
};

const selectEndDay = async (page: Page, picker: Locator, day: number): Promise<void> => {
  await picker.locator('mat-datepicker-toggle button').click();
  await page
    .locator('mat-datepicker-content mat-calendar')
    .getByText(String(day), { exact: true })
    .click();
  await page.locator('mat-datepicker-content').waitFor({ state: 'hidden' });
};

const openParentDetail = async (parent: Locator): Promise<void> => {
  // The parent locator also contains its children. Hover its own row so the
  // global hover toolbar does not select one of those children instead.
  await parent.hover({ position: { x: 200, y: 20 } });
  await parent.locator('.show-additional-info-btn').first().click();
};

test('parent and child end dates include their last day and can be cleared without changing older tasks', async ({
  page,
  workViewPage,
  taskPage,
}) => {
  await coldOpenOnDay(page, '2026-10-18');
  await workViewPage.waitForTaskList();
  await workViewPage.addTask('Bounded parent');
  const initialParent = taskPage.getTaskByText('Bounded parent').first();
  const originalId = await initialParent.getAttribute('data-task-id');
  await workViewPage.addSubTask(initialParent, 'Stops on 18');
  await workViewPage.addSubTask(initialParent, 'Continues with parent');
  await openParentDetail(initialParent);
  const repeatDialog = await openRecurDialog(page);
  await expect(repeatDialog.getByLabel('End date (optional)')).toBeVisible();
  await selectEndDay(page, repeatDialog.locator('date-picker-input'), 19);
  await saveRecurDialog(page);
  await page.keyboard.press('Escape');

  const originalChild = page
    .locator(`task[data-task-id="${originalId}"] .sub-tasks task`)
    .filter({ hasText: 'Stops on 18' });
  await originalChild.locator('task-title').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Repeat end date', exact: true }).click();
  const childDialog = page.locator('dialog-sub-task-repeat-end');
  await selectEndDay(page, childDialog.locator('date-picker-input'), 18);
  await childDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(originalChild.locator('.repeat-end-date')).toContainText('Repeat until');

  await coldOpenOnDay(page, '2026-10-19');
  await workViewPage.waitForTaskList();
  const on19 = page
    .locator('task[data-task-id$="_2026-10-19"]')
    .filter({ hasText: 'Bounded parent' });
  await expect(on19).toBeVisible();
  await expect(on19.locator('.sub-tasks task')).toHaveCount(1);
  await expect(on19.locator('.sub-tasks task')).toContainText('Continues with parent');
  await expect(on19.locator('.sub-tasks task')).toHaveAttribute(
    'data-task-id',
    /_sub_1$/,
  );

  await coldOpenOnDay(page, '2026-10-20');
  await workViewPage.waitForTaskList();
  await expect(on19).toBeVisible();
  await expect(page.locator('task[data-task-id$="_2026-10-20"]')).toHaveCount(0);
  await expect(originalChild).toBeVisible();

  await originalChild.locator('task-title').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Repeat end date', exact: true }).click();
  await childDialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await openParentDetail(on19);
  const editDialog = await openRecurDialog(page);
  await editDialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await saveRecurDialog(page);
  await page.keyboard.press('Escape');

  await coldOpenOnDay(page, '2026-10-21');
  await workViewPage.waitForTaskList();
  const on21 = page.locator('task[data-task-id$="_2026-10-21"]');
  await expect(on21).toBeVisible();
  await expect(on21.locator('.sub-tasks task')).toHaveCount(2);
  await expect(
    on21.locator('.sub-tasks task').filter({ hasText: 'Stops on 18' }),
  ).toBeVisible();
  await expect(on19.locator('.sub-tasks task')).toHaveCount(1);
});

test('rejects a parent end date before its start date', async ({
  page,
  workViewPage,
  taskPage,
}) => {
  await coldOpenOnDay(page, '2026-10-18');
  await workViewPage.waitForTaskList();
  await workViewPage.addTask('Invalid end date');
  await taskPage.openTaskDetail(taskPage.getTaskByText('Invalid end date').first());
  const dialog = await openRecurDialog(page);
  await dialog.getByLabel('End date (optional)').fill('not-a-date');
  await dialog.getByLabel('End date (optional)').blur();
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await selectEndDay(page, dialog.locator('date-picker-input'), 17);
  await expect(dialog.getByRole('alert')).toContainText(
    'The end date must be on or after the start date.',
  );
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await selectEndDay(page, dialog.locator('date-picker-input'), 19);
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
});
