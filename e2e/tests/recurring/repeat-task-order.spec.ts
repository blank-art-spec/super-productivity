import { test, expect } from '../../fixtures/test.fixture';
import { openRecurDialog, saveRecurDialog } from '../../utils/recurring-task-helpers';
import { startTaskDrag } from '../../utils/task-multi-drag';

test.use({ timezoneId: 'UTC' });

test('remembers recurring task drag order after reload and the next day', async ({
  page,
  workViewPage,
  taskPage,
}) => {
  await page.clock.setSystemTime(new Date('2026-06-15T23:55:00Z'));
  await page.reload();
  await workViewPage.waitForTaskList();
  for (const title of ['Daily A', 'Daily B', 'Daily C']) {
    await workViewPage.addTask(title);
    const task = taskPage.getTaskByText(title).first();
    await taskPage.openTaskDetail(task);
    await openRecurDialog(page);
    await saveRecurDialog(page);
    await page.keyboard.press('Escape');
  }
  const titles = page
    .locator('task:not(.isDone) > swipe-block .first-line task-title')
    .filter({ hasText: /Daily [ABC]/ });
  await expect(titles).toHaveText([/Daily C$/, /Daily B$/, /Daily A$/]);
  const source = taskPage.getTaskByText('Daily A').first().locator('done-toggle').first();
  const target = taskPage.getTaskByText('Daily C').first();
  const box = await target.boundingBox();
  if (!box) throw new Error('Missing target task');
  await startTaskDrag(page, source);
  const halfWidth = box.width / 2;
  await page.mouse.move(box.x + halfWidth, box.y + 3, { steps: 25 });
  await page.mouse.up();
  await expect(titles).toHaveText([/Daily A$/, /Daily C$/, /Daily B$/]);
  await page.reload();
  await workViewPage.waitForTaskList();
  await expect(titles).toHaveText([/Daily A$/, /Daily C$/, /Daily B$/]);
  for (const title of ['Daily A', 'Daily C', 'Daily B']) {
    await taskPage.markTaskAsDone(
      taskPage.getUndoneTasks().filter({ hasText: title }).first(),
    );
  }
  await page.clock.setSystemTime(new Date('2026-06-16T00:05:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(titles).toHaveText([/Daily A$/, /Daily C$/, /Daily B$/], {
    timeout: 60000,
  });
});
