import { test, expect } from '../../fixtures/test.fixture';
import { Locator, Page } from '@playwright/test';
import { waitForMenuSettled } from '../../utils/waits';

const holdTask = async (page: Page, task: Locator, move = false): Promise<void> => {
  const title = task.locator('task-title').first();
  await title.scrollIntoViewIfNeeded();
  const box = await title.boundingBox();
  if (!box) throw new Error('Task title is not visible');
  const cdp = await page.context().newCDPSession(page);
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  const point = { x: box.x + halfWidth, y: box.y + halfHeight };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point],
  });
  if (move) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y + 30 }],
    });
  }
  // This duration is the gesture itself: hold longer than the 500 ms threshold.
  await page.waitForTimeout(750);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
};

const swipeTaskLeft = async (page: Page, task: Locator): Promise<void> => {
  const title = task.locator('task-title').first();
  await title.scrollIntoViewIfNeeded();
  const titleBox = await title.boundingBox();
  const rowBox = await task.locator('swipe-block').first().boundingBox();
  if (!titleBox || !rowBox) throw new Error('Task row is not visible');
  const halfWidth = titleBox.width / 2;
  const halfHeight = titleBox.height / 2;
  const point = {
    x: titleBox.x + halfWidth,
    y: titleBox.y + halfHeight,
  };
  // The menu activates after a swipe exceeds one quarter of the row width.
  const distance = rowBox.width * 0.35;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point],
  });
  for (let step = 1; step <= 6; step++) {
    const offset = (distance * step) / 6;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x - offset, y: point.y }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
};

test.describe('Task touch gestures', () => {
  test.use({
    contextOptions: {
      viewport: { width: 1024, height: 900 },
      hasTouch: true,
      isMobile: true,
    },
  });

  test('swiping left opens abandonment for the selected child and for its parent', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Touch parent');
    const parent = taskPage.getTaskByText('Touch parent').first();
    await workViewPage.addSubTask(parent, 'Touch child');
    await workViewPage.addSubTask(parent, 'Unfinished sibling');
    const child = parent.locator('.sub-tasks task').filter({ hasText: 'Touch child' });
    await swipeTaskLeft(page, child);
    await waitForMenuSettled(page);
    await page.getByRole('menuitem', { name: /Abandon task/ }).tap();
    await expect(child).toHaveClass(/isAbandoned/);
    await expect(parent).not.toHaveClass(/isDone/);
    await expect(parent.locator('.sub-tasks task.isAbandoned')).toHaveCount(1);

    await swipeTaskLeft(page, parent);
    await waitForMenuSettled(page);
    await page.getByRole('menuitem', { name: /Abandon task/ }).tap();
    await page.getByRole('button', { name: /^Completed Tasks \(/ }).tap();
    await expect(parent).toHaveClass(/isAbandoned/);
    await expect(parent.locator('.sub-tasks task.isAbandoned')).toHaveCount(2);
  });

  test('holding and releasing without moving keeps the menu closed', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Hold without menu');
    const task = taskPage.getTaskByText('Hold without menu').first();
    await holdTask(page, task);
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(task).not.toHaveClass(/isDragReady/);
  });

  test('moving during a hold keeps the menu closed', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Scrollable task');
    await holdTask(page, taskPage.getTaskByText('Scrollable task').first(), true);
    await expect(page.getByRole('menuitem', { name: /Abandon task/ })).toBeHidden();
  });

  test('holding and then dragging still reorders tasks', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Drag first');
    await workViewPage.addTask('Drag second');
    const titles = page.locator('task:not(.isDone) > swipe-block .first-line task-title');
    await expect(titles).toHaveText([/Drag second$/, /Drag first$/]);
    const source = taskPage.getTaskByText('Drag second').first().locator('task-title');
    const target = taskPage.getTaskByText('Drag first').first();
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error('Drag tasks are not visible');
    const halfWidth = sourceBox.width / 2;
    const halfHeight = sourceBox.height / 2;
    const x = sourceBox.x + halfWidth;
    const startY = sourceBox.y + halfHeight;
    const endY = targetBox.y + targetBox.height - 3;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: startY }],
    });
    await page.waitForTimeout(600);
    for (let step = 1; step <= 12; step++) {
      const offset = ((endY - startY) * step) / 12;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: startY + offset }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await expect(titles).toHaveText([/Drag first$/, /Drag second$/]);
    await expect(page.getByRole('menuitem', { name: /Abandon task/ })).toBeHidden();
  });
});
