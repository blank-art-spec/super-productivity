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

  test('取消父任务完成时只恢复联动完成的子任务，重新加载后规则仍然有效', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Selective reopen parent');
    const parent = taskPage.getTaskByText('Selective reopen parent').first();
    await workViewPage.addSubTask(parent, 'Manually completed child');
    await workViewPage.addSubTask(parent, 'Parent completed child');
    const manualChild = parent
      .locator('.sub-tasks task')
      .filter({ hasText: 'Manually completed child' });
    const automaticChild = parent
      .locator('.sub-tasks task')
      .filter({ hasText: 'Parent completed child' });

    // 先独立完成一个子任务，再完成父任务，制造两种不同的完成来源。
    await manualChild.locator('done-toggle').click();
    await expect(manualChild).toHaveClass(/isDone/);
    await parent.locator('done-toggle').first().click();
    await expect(parent).toHaveClass(/isDone/);
    await expect(automaticChild).toHaveClass(/isDone/);
    await page.reload();
    await workViewPage.waitForTaskList();
    await expect(parent).toHaveClass(/isDone/);

    await parent.locator('done-toggle').first().click();
    await expect(parent).not.toHaveClass(/isDone/);
    await expect(manualChild).toHaveClass(/isDone/);
    await expect(automaticChild).not.toHaveClass(/isDone/);
    await page.reload();
    await workViewPage.waitForTaskList();
    await expect(parent).not.toHaveClass(/isDone/);
    await expect(manualChild).toHaveClass(/isDone/);
    await expect(automaticChild).not.toHaveClass(/isDone/);

    // 再次切换，确认取消完成时的来源清理不会破坏下一轮联动。
    await parent.locator('done-toggle').first().click();
    await expect(parent).toHaveClass(/isDone/);
    await parent.locator('done-toggle').first().click();
    await expect(parent).not.toHaveClass(/isDone/);
    await expect(manualChild).toHaveClass(/isDone/);
    await expect(automaticChild).not.toHaveClass(/isDone/);
  });

  test('联动完成的子任务被手动取消并重新完成后，取消父任务会保留它', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Manual override parent');
    const parent = taskPage.getTaskByText('Manual override parent').first();
    await workViewPage.addSubTask(parent, 'Manually changed child');
    await workViewPage.addSubTask(parent, 'Unchanged automatic child');
    const manualChild = parent
      .locator('.sub-tasks task')
      .filter({ hasText: 'Manually changed child' });
    const automaticChild = parent
      .locator('.sub-tasks task')
      .filter({ hasText: 'Unchanged automatic child' });
    await parent.locator('done-toggle').first().click();
    await expect(parent).toHaveClass(/isDone/);
    await manualChild.locator('done-toggle').click();
    await expect(manualChild).not.toHaveClass(/isDone/);
    await manualChild.locator('done-toggle').click();
    await expect(manualChild).toHaveClass(/isDone/);
    await page.reload();
    await workViewPage.waitForTaskList();
    await expect(parent).toHaveClass(/isDone/);
    await parent.locator('done-toggle').first().click();

    await expect(parent).not.toHaveClass(/isDone/);
    await expect(manualChild).toHaveClass(/isDone/);
    await expect(automaticChild).not.toHaveClass(/isDone/);
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
