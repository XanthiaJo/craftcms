import { expect, test } from '@playwright/test';

async function openSketch(page) {
  await page.goto('/tests/fixtures/knitstitch-playwright.html');
  await page.getByRole('button', { name: 'Sketch' }).click();
  await page.getByRole('button', { name: 'Line' }).click();

  const canvas = page.locator('#konva-stage canvas').first();
  await expect(canvas).toBeVisible();

  return canvas.boundingBox();
}

async function clickStage(page, box, point) {
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

async function dragStage(page, box, from, to) {
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 12 });
  await page.mouse.up();
}

test.describe('Sketch constraints', () => {
  test('clicking a hovered endpoint selects the point instead of the line', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 120, y: 120 });
    await clickStage(page, box, { x: 200, y: 120 });
    await page.getByRole('button', { name: 'Select' }).click();

    await page.mouse.move(box.x + 124, box.y + 120);
    await page.mouse.click(box.x + 124, box.y + 120);

    const selection = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      return {
        selectedPoints: sketch?.points.filter((point) => point.isSelected).map((point) => ({ x: point.x, y: point.y })) ?? [],
        selectedLines: sketch?.lines.filter((line) => line.isSelected).length ?? 0,
      };
    });

    expect(selection.selectedLines).toBe(0);
    expect(selection.selectedPoints).toHaveLength(1);
    expect(Math.round(selection.selectedPoints[0].x)).toBe(120);
    expect(Math.round(selection.selectedPoints[0].y)).toBe(120);
  });

  test('driven dimensions stay locked when a point is dragged', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 120, y: 120 });
    await clickStage(page, box, { x: 200, y: 120 });

    await page.getByRole('button', { name: 'Dimension' }).click();
    await clickStage(page, box, { x: 120, y: 120 });
    await clickStage(page, box, { x: 200, y: 120 });

    const editInput = page.locator('#dim-edit-input');
    await expect(editInput).toBeVisible();
    await editInput.fill('80');
    await editInput.press('Enter');

    const dimItem = page.locator('#sketch-object-list li').filter({ hasText: 'Dim 1' });
    await expect(dimItem).toContainText('80.0');

    await page.getByRole('button', { name: 'Select' }).click();
    await dragStage(page, box, { x: 120, y: 120 }, { x: 160, y: 150 });

    const lineItem = page.locator('#sketch-object-list li').first();
    await expect(lineItem).toContainText('160,150');
    await expect(lineItem).toContainText('240,150');
    await expect(dimItem).toContainText('80.0');
  });

  test('the first dimension point stays highlighted until the second click', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 160, y: 180 });
    await clickStage(page, box, { x: 240, y: 180 });
    await page.getByRole('button', { name: 'Dimension' }).click();
    await clickStage(page, box, { x: 160, y: 180 });

    const selectedPoints = await page.evaluate(() => {
      const points = window.__knitstitchStore?.state?.sketch?.points ?? [];
      return points
        .filter((point) => point.isSelected)
        .map((point) => ({ x: point.x, y: point.y }));
    });

    expect(selectedPoints).toHaveLength(1);
    expect(Math.round(selectedPoints[0].x)).toBe(160);
    expect(Math.round(selectedPoints[0].y)).toBe(180);
  });

  test('cancelling the dimension edit removes the pending dimension entirely', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 160, y: 220 });
    await clickStage(page, box, { x: 240, y: 220 });
    await page.getByRole('button', { name: 'Dimension' }).click();
    await clickStage(page, box, { x: 160, y: 220 });
    await clickStage(page, box, { x: 240, y: 220 });

    await expect(page.locator('#dim-edit-input')).toBeVisible();
    await page.locator('#dim-edit-cancel').click();

    const sketchState = await page.evaluate(() => ({
      dimensions: window.__knitstitchStore?.state?.sketch?.dimensions.length ?? -1,
      hasPendingDimEdit: window.__knitstitchStore?.state?.sketch?.pendingDimEdit != null,
      dimensionObjects: (window.__knitstitchStore?.state?.sketch?.objects ?? []).filter((object) => object.kind === 'Dimension').length,
    }));

    expect(sketchState).toEqual({
      dimensions: 0,
      hasPendingDimEdit: false,
      dimensionObjects: 0,
    });
  });

  test('clicking a dimension label selects it without reopening the edit overlay', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 160, y: 240 });
    await clickStage(page, box, { x: 240, y: 240 });
    await page.getByRole('button', { name: 'Dimension' }).click();
    await clickStage(page, box, { x: 160, y: 240 });
    await clickStage(page, box, { x: 240, y: 240 });

    const editInput = page.locator('#dim-edit-input');
    await expect(editInput).toBeVisible();
    await editInput.fill('80');
    await editInput.press('Enter');
    await expect(editInput).toBeHidden();

    const labelPos = await page.evaluate(() => {
      const dim = window.__knitstitchStore?.state?.sketch?.dimensions?.[0];
      return dim ? { x: dim.labelPos.x, y: dim.labelPos.y } : null;
    });

    await page.getByRole('button', { name: 'Select' }).click();
    const hitOffsets = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: -8, y: 0 },
      { x: 0, y: 8 },
      { x: 0, y: -8 },
    ];
    let stateAfterClick = null;
    for (const offset of hitOffsets) {
      await clickStage(page, box, { x: labelPos.x + offset.x, y: labelPos.y + offset.y });
      stateAfterClick = await page.evaluate(() => ({
        selectedDimensions: (window.__knitstitchStore?.state?.sketch?.dimensions ?? []).filter((dim) => dim.isSelected).length,
        hasPendingDimEdit: window.__knitstitchStore?.state?.sketch?.pendingDimEdit != null,
      }));
      if (stateAfterClick.selectedDimensions === 1) break;
    }

    expect(stateAfterClick).toEqual({
      selectedDimensions: 1,
      hasPendingDimEdit: false,
    });

    await page.keyboard.press('Delete');
    await expect(page.locator('#sketch-object-list')).not.toContainText('Dim 1');
  });

  test('object rows are selectable and deletable from the objects panel', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 160, y: 280 });
    await clickStage(page, box, { x: 240, y: 280 });
    await page.getByRole('button', { name: 'Dimension' }).click();
    await clickStage(page, box, { x: 160, y: 280 });
    await clickStage(page, box, { x: 240, y: 280 });

    const editInput = page.locator('#dim-edit-input');
    await expect(editInput).toBeVisible();
    await editInput.fill('80');
    await editInput.press('Enter');

    const row = page.locator('#sketch-object-list li').filter({ hasText: 'Dim 1' });
    await row.click();
    await expect(row).toHaveClass(/selected/);

    await page.keyboard.press('Delete');

    const remainingDimensions = await page.evaluate(() => window.__knitstitchStore?.state?.sketch?.dimensions.length ?? -1);
    expect(remainingDimensions).toBe(0);
  });

  test('coincident snapping creates a coincident constraint through pointer input', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 120, y: 260 });
    await clickStage(page, box, { x: 220, y: 260 });
    await clickStage(page, box, { x: 360, y: 260 });
    await clickStage(page, box, { x: 460, y: 260 });

    await page.getByRole('button', { name: 'Select' }).click();
    await dragStage(page, box, { x: 360, y: 260 }, { x: 126, y: 264 });

    await expect(page.locator('#sketch-object-list')).toContainText('Coincident');
    await expect(page.locator('#sketch-object-list')).toContainText('P3');
    await expect(page.locator('#sketch-object-list')).toContainText('P1');
  });

  test('perpendicular constraints can be created and keep lines at ninety degrees', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 120, y: 160 });
    await clickStage(page, box, { x: 200, y: 160 });
    await clickStage(page, box, { x: 200, y: 240 });

    await page.getByRole('button', { name: 'Perpendicular' }).click();
    await clickStage(page, box, { x: 200, y: 160 });

    const createdConstraintCount = await page.evaluate(() => (
      window.__knitstitchStore?.state?.sketch?.constraints.filter((constraint) => constraint.type === 'Perpendicular').length ?? 0
    ));
    expect(createdConstraintCount).toBe(1);

    await page.getByRole('button', { name: 'Select' }).click();
    await dragStage(page, box, { x: 200, y: 240 }, { x: 246, y: 210 });

    const geometry = await page.evaluate(() => {
      const [lineA, lineB] = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      const shared = lineA?.end;
      const otherA = lineA?.start;
      const otherB = lineB?.end;
      const vecA = { x: otherA.x - shared.x, y: otherA.y - shared.y };
      const vecB = { x: otherB.x - shared.x, y: otherB.y - shared.y };
      return {
        dot: vecA.x * vecB.x + vecA.y * vecB.y,
        movedX: otherB.x,
      };
    });

    expect(geometry.dot).toBeCloseTo(0, 3);
    expect(Math.round(geometry.movedX)).toBe(200);
  });

  test('deleting a constrained line removes the line, its endpoints, and attached constraints', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 120, y: 320 });
    await clickStage(page, box, { x: 200, y: 320 });

    await page.getByRole('button', { name: 'Dimension' }).click();
    await clickStage(page, box, { x: 120, y: 320 });
    await clickStage(page, box, { x: 200, y: 320 });

    const editInput = page.locator('#dim-edit-input');
    await expect(editInput).toBeVisible();
    await editInput.fill('80');
    await editInput.press('Enter');

    await page.getByRole('button', { name: 'Select' }).click();
    const selectedLineCount = await page.evaluate(() => {
      const lines = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      const service = window.__knitstitchSketchService;
      if (lines[0] && service) {
        service.selectLine(lines[0]);
      }
      return lines.filter((line) => line.isSelected).length;
    });
    expect(selectedLineCount).toBe(1);

    await page.keyboard.press('Delete');

    const sketchState = await page.evaluate(() => ({
      lines: window.__knitstitchStore?.state?.sketch?.lines.length ?? -1,
      points: window.__knitstitchStore?.state?.sketch?.points.length ?? -1,
      dimensions: window.__knitstitchStore?.state?.sketch?.dimensions.length ?? -1,
      constraints: window.__knitstitchStore?.state?.sketch?.constraints.length ?? -1,
    }));

    expect(sketchState).toEqual({
      lines: 0,
      points: 0,
      dimensions: 0,
      constraints: 0,
    });
  });

  test('deleting a selected endpoint removes its attached line and dependent dimensions', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 120, y: 360 });
    await clickStage(page, box, { x: 200, y: 360 });

    await page.getByRole('button', { name: 'Dimension' }).click();
    await clickStage(page, box, { x: 120, y: 360 });
    await clickStage(page, box, { x: 200, y: 360 });

    const editInput = page.locator('#dim-edit-input');
    await expect(editInput).toBeVisible();
    await editInput.fill('80');
    await editInput.press('Enter');

    await page.getByRole('button', { name: 'Select' }).click();
    await page.mouse.move(box.x + 124, box.y + 360);
    await page.mouse.click(box.x + 124, box.y + 360);
    await page.keyboard.press('Delete');

    const sketchState = await page.evaluate(() => ({
      lines: window.__knitstitchStore?.state?.sketch?.lines.length ?? -1,
      points: window.__knitstitchStore?.state?.sketch?.points.length ?? -1,
      dimensions: window.__knitstitchStore?.state?.sketch?.dimensions.length ?? -1,
      constraints: window.__knitstitchStore?.state?.sketch?.constraints.length ?? -1,
    }));

    expect(sketchState).toEqual({
      lines: 0,
      points: 0,
      dimensions: 0,
      constraints: 0,
    });
  });
});
