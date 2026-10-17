import { test, expect } from '../../fixtures/test.fixture';

test.describe('Task completion and abandonment', () => {
  test('completing a parent checks all its subtasks and survives reload', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Complete parent');
    const parent = taskPage.getTaskByText('Complete parent').first();
    await workViewPage.addSubTask(parent, 'First child');
    await workViewPage.addSubTask(parent, 'Second child');
    await parent.locator('done-toggle').first().click();
    await expect(parent).toHaveClass(/isDone/);
    await expect(parent.locator('.sub-tasks task.isDone')).toHaveCount(2);
    await page.reload();
    await workViewPage.waitForTaskList();
    await expect(parent).toHaveClass(/isDone/);
    await expect(parent.locator('.sub-tasks task.isDone')).toHaveCount(2);
  });

  test('abandoning a parent dims it and its children like completed tasks with red lines', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Completed reference');
    const completed = taskPage.getTaskByText('Completed reference').first();
    await completed.locator('done-toggle').first().click();
    await expect(completed).toHaveClass(/isDone/);
    const completedOpacity = await completed
      .locator('.title-and-left-btns-wrapper')
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(completedOpacity)).toBeLessThan(1);
    await workViewPage.addTask('Abandon parent');
    const parent = taskPage.getTaskByText('Abandon parent').first();
    await workViewPage.addSubTask(parent, 'First abandoned child');
    await workViewPage.addSubTask(parent, 'Second abandoned child');
    await parent.locator('task-title').first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Abandon task', exact: true }).click();
    await expect(parent).toHaveClass(/isAbandoned/);
    await expect(parent.locator('.sub-tasks task.isAbandoned')).toHaveCount(2);
    const title = parent.locator('task-title .display-value').first();
    await expect(title).toHaveCSS('text-decoration-line', 'line-through');
    await expect(title).toHaveCSS('text-decoration-color', 'rgb(244, 67, 54)');
    for (const row of await parent.locator('.title-and-left-btns-wrapper').all()) {
      await expect(row).toHaveCSS('opacity', completedOpacity);
    }
    await page.reload();
    await workViewPage.waitForTaskList();
    await expect(parent).toHaveClass(/isAbandoned/);
    await expect(parent.locator('.sub-tasks task.isAbandoned')).toHaveCount(2);
    await page.screenshot({ path: test.info().outputPath('abandoned-parent.png') });
    await parent.locator('done-toggle').first().click();
    await expect(parent).not.toHaveClass(/isAbandoned/);
    await expect(parent).not.toHaveClass(/isDone/);
    await expect(parent.locator('.sub-tasks task.isAbandoned')).toHaveCount(2);
  });

  test('abandoning one child leaves its parent and sibling unfinished', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Independent parent');
    const parent = taskPage.getTaskByText('Independent parent').first();
    await workViewPage.addSubTask(parent, 'Unable child');
    await workViewPage.addSubTask(parent, 'Keep child');
    const child = parent.locator('.sub-tasks task').filter({ hasText: 'Unable child' });
    await child.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Abandon task/ }).click();
    await expect(child).toHaveClass(/isAbandoned/);
    await expect(parent).not.toHaveClass(/isDone/);
    await expect(
      parent.locator('.sub-tasks task').filter({ hasText: 'Keep child' }),
    ).not.toHaveClass(/isDone/);
    await child.locator('done-toggle').click();
    await expect(child).not.toHaveClass(/isAbandoned/);
    await expect(child).not.toHaveClass(/isDone/);
  });
});
