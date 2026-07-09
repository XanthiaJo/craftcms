import { expect, test } from '@playwright/test';

async function openSketch(page) {
  // The live site shows a cookie consent banner that overlays the page and
  // intercepts clicks. Pre-set the consent cookie so it never appears.
  await page.context().addCookies([{
    name: 'cookieconsent_status',
    value: 'allow',
    domain: 'craftcms.ddev.site',
    path: '/',
    sameSite: 'Lax',
  }]);

  await page.goto('/knit-stitch');

  // The live site sizes the canvas via flexbox, so the canvas height depends
  // on the viewport. Set a large viewport so all test coordinates fit.
  await page.setViewportSize({ width: 1600, height: 1400 });

  await page.getByRole('button', { name: 'Sketch' }).click();
  await page.getByRole('button', { name: 'Line' }).click();

  // Konva's getRelativePointerPosition() calculates pointer coordinates
  // relative to the inner .konvajs-content div (not #konva-stage itself),
  // using getBoundingClientRect() on that content div. The canvas can be
  // offset from #konva-stage by flexbox centering and borders, so we must
  // use the content div's rect as the click origin.
  const canvas = page.locator('#konva-stage canvas').first();
  await expect(canvas).toBeVisible();

  const box = await page.evaluate(() => {
    const stage = document.getElementById('konva-stage');
    const content = stage?.querySelector('.konvajs-content');
    const el = content ?? stage;
    const rect = el.getBoundingClientRect();
    const store = window.__knitstitchStore;
    const panX = store?.get('panOffsetX') ?? rect.width / 2;
    const panY = store?.get('panOffsetY') ?? rect.height / 2;
    const scale = store?.get('zoomLevel') ?? 1;
    return {
      x: Math.round(rect.left + panX),
      y: Math.round(rect.top + panY),
      width: rect.width,
      height: rect.height,
      scale,
    };
  });

  return box;
}

async function clickStage(page, box, point) {
  await page.mouse.click(box.x + point.x * box.scale, box.y + point.y * box.scale);
}

async function dragStage(page, box, from, to) {
  await page.mouse.move(box.x + from.x * box.scale, box.y + from.y * box.scale);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x * box.scale, box.y + to.y * box.scale, { steps: 12 });
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
    await expect(page.locator('#sketch-object-list')).toContainText('P2');
  });

  test('perpendicular constraints can be created and keep lines at ninety degrees', async ({ page }) => {
    const box = await openSketch(page);

    await clickStage(page, box, { x: 120, y: 160 });
    await clickStage(page, box, { x: 200, y: 160 });
    await clickStage(page, box, { x: 230, y: 200 });

    await page.getByRole('button', { name: 'Perpendicular' }).click();
    await page.evaluate(() => {
      const service = window.__knitstitchSketchService;
      const lines = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      service.onConstraintLineClick(lines[0]);
      service.onConstraintLineClick(lines[1]);
    });

    const createdState = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const [lineA, lineB] = sketch?.lines ?? [];
      const shared = lineA?.end;
      const otherA = lineA?.start;
      const otherB = lineB?.end;
      const vecA = { x: otherA.x - shared.x, y: otherA.y - shared.y };
      const vecB = { x: otherB.x - shared.x, y: otherB.y - shared.y };
      return {
        constraintCount: sketch?.constraints.filter((constraint) => constraint.type === 'Perpendicular').length ?? 0,
        dot: vecA.x * vecB.x + vecA.y * vecB.y,
      };
    });
    expect(createdState.constraintCount).toBe(1);
    expect(createdState.dot).toBeCloseTo(0, 1);

    await page.getByRole('button', { name: 'Select' }).click();
    await dragStage(page, box, { x: 200, y: 190 }, { x: 246, y: 210 });

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

    expect(geometry.dot).toBeCloseTo(0, 1);
  });

  test('perpendicular constraint is maintained when moving a non-anchor endpoint', async ({ page }) => {
    const box = await openSketch(page);

    // Draw an L-shape: P1(120,400) -> P2(200,400) -> P3(200,480)
    await clickStage(page, box, { x: 120, y: 400 });
    await clickStage(page, box, { x: 200, y: 400 });
    await clickStage(page, box, { x: 200, y: 480 });

    // Add perpendicular constraint between line 0 (P1→P2) and line 1 (P2→P3)
    await page.getByRole('button', { name: 'Perpendicular' }).click();
    await page.evaluate(() => {
      const service = window.__knitstitchSketchService;
      const lines = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      service.onConstraintLineClick(lines[0]);
      service.onConstraintLineClick(lines[1]);
    });

    // Verify it was created and is perpendicular
    let state = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const [lineA, lineB] = sketch?.lines ?? [];
      const shared = lineA?.end;
      const otherA = lineA?.start;
      const otherB = lineB?.end;
      const vecA = { x: otherA.x - shared.x, y: otherA.y - shared.y };
      const vecB = { x: otherB.x - shared.x, y: otherB.y - shared.y };
      return {
        count: sketch?.constraints.filter((c) => c.type === 'Perpendicular').length ?? 0,
        dot: vecA.x * vecB.x + vecA.y * vecB.y,
      };
    });
    expect(state.count).toBe(1);
    expect(state.dot).toBeCloseTo(0, 1);

    // Switch to Select and drag P1 (the non-anchor endpoint of line 0)
    await page.getByRole('button', { name: 'Select' }).click();
    await dragStage(page, box, { x: 120, y: 400 }, { x: 140, y: 430 });

    // Perpendicular should still hold
    state = await page.evaluate(() => {
      const [lineA, lineB] = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      const shared = lineA?.end;
      const otherA = lineA?.start;
      const otherB = lineB?.end;
      const vecA = { x: otherA.x - shared.x, y: otherA.y - shared.y };
      const vecB = { x: otherB.x - shared.x, y: otherB.y - shared.y };
      return { dot: vecA.x * vecB.x + vecA.y * vecB.y };
    });
    expect(state.dot).toBeCloseTo(0, 1);
  });

  test('perpendicular constraint is maintained when a driven dimension moves a constrained point', async ({ page }) => {
    const box = await openSketch(page);

    // Draw an L-shape: P1(120,520) -> P2(200,520) -> P3(200,600)
    await clickStage(page, box, { x: 120, y: 520 });
    await clickStage(page, box, { x: 200, y: 520 });
    await clickStage(page, box, { x: 200, y: 600 });

    // Add perpendicular constraint between line 0 (P1→P2) and line 1 (P2→P3)
    await page.getByRole('button', { name: 'Perpendicular' }).click();
    await page.evaluate(() => {
      const service = window.__knitstitchSketchService;
      const lines = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      service.onConstraintLineClick(lines[0]);
      service.onConstraintLineClick(lines[1]);
    });

    // Add a driven dimension on line 0 (P1→P2) = 80px
    await page.getByRole('button', { name: 'Dimension' }).click();
    await clickStage(page, box, { x: 120, y: 520 });
    await clickStage(page, box, { x: 200, y: 520 });
    const editInput = page.locator('#dim-edit-input');
    await expect(editInput).toBeVisible();
    await editInput.fill('80');
    await editInput.press('Enter');

    // Verify perpendicular holds before drag
    let state = await page.evaluate(() => {
      const [lineA, lineB] = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      const shared = lineA?.end;
      const otherA = lineA?.start;
      const otherB = lineB?.end;
      const vecA = { x: otherA.x - shared.x, y: otherA.y - shared.y };
      const vecB = { x: otherB.x - shared.x, y: otherB.y - shared.y };
      return { dot: vecA.x * vecB.x + vecA.y * vecB.y };
    });
    expect(state.dot).toBeCloseTo(0, 1);

    // Switch to Select and drag P3 (the non-anchor endpoint of line 1).
    // This should NOT break the perpendicular at P2.
    await page.getByRole('button', { name: 'Select' }).click();
    await dragStage(page, box, { x: 200, y: 600 }, { x: 230, y: 640 });

    state = await page.evaluate(() => {
      const [lineA, lineB] = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      const shared = lineA?.end;
      const otherA = lineA?.start;
      const otherB = lineB?.end;
      const vecA = { x: otherA.x - shared.x, y: otherA.y - shared.y };
      const vecB = { x: otherB.x - shared.x, y: otherB.y - shared.y };
      return { dot: vecA.x * vecB.x + vecA.y * vecB.y };
    });
    expect(state.dot).toBeCloseTo(0, 1);
  });

  test('sock template: perpendicular at top-left holds when top-right corner is dragged', async ({ page }) => {
    const box = await openSketch(page);

    // Apply the sock template
    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('button', { name: 'Sock' }).click();
    await page.getByRole('button', { name: 'Sketch' }).click();
    await page.getByRole('button', { name: 'Select' }).click();

    // Verify perpendicular constraints exist
    const perpCount = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      return sketch?.constraints.filter((c) => c.type === 'Perpendicular').length ?? 0;
    });
    expect(perpCount).toBe(4);

    // Check perpendicular at top-left (point 0) before drag
    // Line 19 = top edge (19→0), Line 0 = left edge (0→1), anchor = point 0
    let state = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const points = sketch?.points ?? [];
      const lines = sketch?.lines ?? [];
      // point 0 = top-left, point 19 = top-right
      const p0 = points[0];
      const p1 = points[1];   // below p0 on left edge
      const p19 = points[19]; // top-right
      const vecTop = { x: p19.x - p0.x, y: p19.y - p0.y };
      const vecLeft = { x: p1.x - p0.x, y: p1.y - p0.y };
      return {
        dot: vecTop.x * vecLeft.x + vecTop.y * vecLeft.y,
        p0: { x: p0.x, y: p0.y },
        p19: { x: p19.x, y: p19.y },
      };
    });
    expect(state.dot).toBeCloseTo(0, 1);

    // Drag the top-right corner (point 19) down and to the right
    const p19 = state.p19;
    await dragStage(page, box, { x: p19.x, y: p19.y }, { x: p19.x + 40, y: p19.y + 30 });

    // Check perpendicular at top-left still holds
    state = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const points = sketch?.points ?? [];
      const p0 = points[0];
      const p1 = points[1];
      const p19 = points[19];
      const vecTop = { x: p19.x - p0.x, y: p19.y - p0.y };
      const vecLeft = { x: p1.x - p0.x, y: p1.y - p0.y };
      return { dot: vecTop.x * vecLeft.x + vecTop.y * vecLeft.y };
    });
    expect(state.dot).toBeCloseTo(0, 1);
  });

  test('sock template: perpendicular at top-left holds when top-left corner is dragged', async ({ page }) => {
    const box = await openSketch(page);

    // Apply the sock template
    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('button', { name: 'Sock' }).click();
    await page.getByRole('button', { name: 'Sketch' }).click();
    await page.getByRole('button', { name: 'Select' }).click();

    // Check perpendicular at top-left (point 0) before drag
    // Line 19 = top edge (19→0), Line 0 = left edge (0→1), anchor = point 0
    let state = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const points = sketch?.points ?? [];
      const p0 = points[0];
      const p1 = points[1];   // below p0 on left edge
      const p19 = points[19]; // top-right
      const vecTop = { x: p19.x - p0.x, y: p19.y - p0.y };
      const vecLeft = { x: p1.x - p0.x, y: p1.y - p0.y };
      return {
        dot: vecTop.x * vecLeft.x + vecTop.y * vecLeft.y,
        p0: { x: p0.x, y: p0.y },
      };
    });
    expect(state.dot).toBeCloseTo(0, 1);

    // Drag the top-left corner (point 0) down and to the right
    const p0 = state.p0;
    await dragStage(page, box, { x: p0.x, y: p0.y }, { x: p0.x + 30, y: p0.y + 40 });

    // Check perpendicular at top-left still holds
    state = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const points = sketch?.points ?? [];
      const p0 = points[0];
      const p1 = points[1];
      const p19 = points[19];
      const vecTop = { x: p19.x - p0.x, y: p19.y - p0.y };
      const vecLeft = { x: p1.x - p0.x, y: p1.y - p0.y };
      return { dot: vecTop.x * vecLeft.x + vecTop.y * vecLeft.y };
    });
    expect(state.dot).toBeCloseTo(0, 1);
  });

  test('impossible perpendicular combinations are rejected', async ({ page }) => {
    const box = await openSketch(page);

    // Draw a triangle: P1(120,320) -> P2(200,320) -> P3(240,380) -> P1
    await clickStage(page, box, { x: 120, y: 320 });
    await clickStage(page, box, { x: 200, y: 320 });
    await clickStage(page, box, { x: 240, y: 380 });
    await clickStage(page, box, { x: 120, y: 320 });

    await page.getByRole('button', { name: 'Perpendicular' }).click();

    // perp(line0, line1) is valid — they share P2 and have no conflicting
    // constraints yet.
    await page.evaluate(() => {
      const service = window.__knitstitchSketchService;
      const lines = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      service.onConstraintLineClick(lines[0]);
      service.onConstraintLineClick(lines[1]);
    });

    let constraintCount = await page.evaluate(() => (
      window.__knitstitchStore?.state?.sketch?.constraints.filter((constraint) => constraint.type === 'Perpendicular').length ?? 0
    ));
    expect(constraintCount).toBe(1);

    // perp(line1, line2) is impossible: with line0 ⊥ line1 already present,
    // adding line1 ⊥ line2 would force line0 ∥ line2, but line0 and line2
    // share P1 — they cannot be parallel unless they are the same line.
    await page.evaluate(() => {
      const service = window.__knitstitchSketchService;
      const lines = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      service.onConstraintLineClick(lines[1]);
      service.onConstraintLineClick(lines[2]);
    });

    constraintCount = await page.evaluate(() => (
      window.__knitstitchStore?.state?.sketch?.constraints.filter((constraint) => constraint.type === 'Perpendicular').length ?? 0
    ));
    expect(constraintCount).toBe(1);

    // perp(line0, line2) is also impossible for the same reason: with
    // line0 ⊥ line1, adding line0 ⊥ line2 would force line1 ∥ line2, but
    // they share P3.
    await page.evaluate(() => {
      const service = window.__knitstitchSketchService;
      const lines = window.__knitstitchStore?.state?.sketch?.lines ?? [];
      service.onConstraintLineClick(lines[0]);
      service.onConstraintLineClick(lines[2]);
    });

    constraintCount = await page.evaluate(() => (
      window.__knitstitchStore?.state?.sketch?.constraints.filter((constraint) => constraint.type === 'Perpendicular').length ?? 0
    ));
    expect(constraintCount).toBe(1);
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
      points: 1,
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
      points: 1,
      dimensions: 0,
      constraints: 0,
    });
  });

  test('sock template: driven dimensions stay locked when a corner is dragged', async ({ page }) => {
    const box = await openSketch(page);

    // Apply the sock template
    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('button', { name: 'Sock' }).click();
    await page.getByRole('button', { name: 'Sketch' }).click();
    await page.getByRole('button', { name: 'Select' }).click();

    // Verify every driven dimension matches its locked pixel value before dragging.
    let state = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const dims = sketch?.dimensions ?? [];
      const errors = dims
        .filter((dim) => dim?.isConstrained)
        .map((dim) => {
          const dx = dim.b.x - dim.a.x;
          const dy = dim.b.y - dim.a.y;
          let actual;
          if (dim.kind === 'Horizontal') actual = Math.abs(dx);
          else if (dim.kind === 'Vertical') actual = Math.abs(dy);
          else actual = Math.hypot(dx, dy);
          return Math.abs(actual - dim.drivenValue);
        });
      return {
        maxErrorBefore: errors.length ? Math.max(...errors) : 0,
        p19: { x: sketch?.points?.[19]?.x ?? 0, y: sketch?.points?.[19]?.y ?? 0 },
      };
    });

    expect(state.maxErrorBefore).toBeLessThan(1);

    // Drag the top-right corner (point 19) a long way from the template.
    const p19 = state.p19;
    await dragStage(page, box, { x: p19.x, y: p19.y }, { x: p19.x + 120, y: p19.y + 90 });

    // After the drag, no driven dimension should be violated: every measured
    // distance must stay within a small tolerance of its locked driven value.
    state = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const dims = sketch?.dimensions ?? [];
      const errors = [];
      for (const dim of dims) {
        if (!dim?.isConstrained) continue;
        const dx = dim.b.x - dim.a.x;
        const dy = dim.b.y - dim.a.y;
        let actual;
        if (dim.kind === 'Horizontal') actual = Math.abs(dx);
        else if (dim.kind === 'Vertical') actual = Math.abs(dy);
        else actual = Math.hypot(dx, dy);
        errors.push(Math.abs(actual - dim.drivenValue));
      }
      return {
        maxErrorAfter: errors.length ? Math.max(...errors) : 0,
      };
    });

    expect(state.maxErrorAfter).toBeLessThan(2);
  });

  test('sock template: top width stays locked when right-edge ribbing point is dragged', async ({ page }) => {
    const box = await openSketch(page);

    // Apply the sock template
    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('button', { name: 'Sock' }).click();
    await page.getByRole('button', { name: 'Sketch' }).click();
    await page.getByRole('button', { name: 'Select' }).click();

    // Point 18 is the end of the top ribbing on the right edge. Dragging it
    // causes both the width dimension (0→19) and the right top-rib dimension
    // (19→18) to drive point 19, which exposes the sequential-dimension bug.
    let state = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const widthDim = sketch?.dimensions?.[0];
      const p18 = sketch?.points?.[18];
      const p19 = sketch?.points?.[19];
      const p0 = sketch?.points?.[0];
      return {
        expectedWidth: widthDim?.drivenValue,
        p18: { x: p18?.x ?? 0, y: p18?.y ?? 0 },
        initialWidth: Math.hypot((p19?.x ?? 0) - (p0?.x ?? 0), (p19?.y ?? 0) - (p0?.y ?? 0)),
      };
    });

    expect(state.expectedWidth).toBeGreaterThan(0);
    expect(state.initialWidth).toBeCloseTo(state.expectedWidth, 1);

    await dragStage(page, box, { x: state.p18.x, y: state.p18.y }, { x: state.p18.x + 120, y: state.p18.y + 90 });

    state = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const widthDim = sketch?.dimensions?.[0];
      const p19 = sketch?.points?.[19];
      const p0 = sketch?.points?.[0];
      return {
        expectedWidth: widthDim?.drivenValue,
        actualWidth: Math.hypot((p19?.x ?? 0) - (p0?.x ?? 0), (p19?.y ?? 0) - (p0?.y ?? 0)),
      };
    });

    expect(state.actualWidth).toBeCloseTo(state.expectedWidth, 1);
  });
});
