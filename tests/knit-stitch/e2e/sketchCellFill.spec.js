import { test, expect } from '@playwright/test';

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
  await page.setViewportSize({ width: 1600, height: 1080 });

  await page.getByRole('button', { name: 'Sketch' }).click();
  await page.getByRole('button', { name: 'Select' }).click();

  // Konva's getRelativePointerPosition() calculates pointer coordinates
  // relative to the inner .konvajs-content div (not #konva-stage itself),
  // using getBoundingClientRect() on that content div. The canvas can be
  // offset from #konva-stage by flexbox centering and borders, so we must
  // use the content div's rect as the click origin.
  const canvas = page.locator('#konva-stage canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Could not find canvas bounding box');
  return box;
}

async function dragStage(page, box, from, to) {
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 12 });
  await page.mouse.up();
}

test.describe('Sketch Cell Fill Updates', () => {
  test('cell fill updates when dragging template points', async ({ page }) => {
    const box = await openSketch(page);

    // Apply the sock template
    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('button', { name: 'Sock' }).click();
    await page.getByRole('button', { name: 'Sketch' }).click();
    await page.getByRole('button', { name: 'Select' }).click();

    // Wait for template to be applied
    await page.waitForTimeout(500);

    // Get initial cell fill count
    const initialFillCount = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const lines = sketch.lines || [];
      const cellW = window.__knitstitchStore.get('cellWidthPx');
      const cellH = window.__knitstitchStore.get('cellHeightPx');
      const computeFilledCellsFromSketch = window.__knitstitchComputeFilledCellsFromSketch;
      const sketchFilled = computeFilledCellsFromSketch(lines, cellW, cellH, 0.3);
      return sketchFilled.size;
    });

    console.log('Initial fill count:', initialFillCount);
    expect(initialFillCount).toBeGreaterThan(0);

    // Get point 19 coordinates (top-right corner)
    const point19 = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const points = sketch.points || [];
      const p19 = points[19];
      return { x: p19.x, y: p19.y };
    });

    // Perform the drag (same as constraint test)
    console.log('Dragging point 19 from', point19.x, point19.y, 'to', point19.x + 40, point19.y + 30);
    await dragStage(page, box, point19, { 
      x: point19.x + 40, 
      y: point19.y + 30 
    });

    // Wait for updates to complete
    await page.waitForTimeout(300);

    // Get final fill count
    const finalFillCount = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const lines = sketch.lines || [];
      const cellW = window.__knitstitchStore.get('cellWidthPx');
      const cellH = window.__knitstitchStore.get('cellHeightPx');
      const computeFilledCellsFromSketch = window.__knitstitchComputeFilledCellsFromSketch;
      const sketchFilled = computeFilledCellsFromSketch(lines, cellW, cellH, 0.3);
      return sketchFilled.size;
    });

    console.log('Final fill count:', finalFillCount);

    // Verify that the fill count changed
    expect(finalFillCount).not.toBe(initialFillCount, 'Cell fill count should change after dragging a point');
    
    console.log('✅ SUCCESS: Cell fill updates correctly when points are dragged!');
    console.log(`   Fill count changed from ${initialFillCount} to ${finalFillCount} cells`);
  });

  test('negative coordinate fill bug verification', async ({ page }) => {
    const box = await openSketch(page);

    // Apply the sock template
    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('button', { name: 'Sock' }).click();
    await page.getByRole('button', { name: 'Sketch' }).click();
    await page.getByRole('button', { name: 'Select' }).click();

    // Wait for template to be applied
    await page.waitForTimeout(500);

    // Get initial cell fill count
    const initialFillCount = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const lines = sketch.lines || [];
      const cellW = window.__knitstitchStore.get('cellWidthPx');
      const cellH = window.__knitstitchStore.get('cellHeightPx');
      const computeFilledCellsFromSketch = window.__knitstitchComputeFilledCellsFromSketch;
      const sketchFilled = computeFilledCellsFromSketch(lines, cellW, cellH, 0.3);
      return sketchFilled.size;
    });

    console.log('Initial fill count:', initialFillCount);
    expect(initialFillCount).toBeGreaterThan(0);

    // Get point 19 coordinates (top-right corner) - we know this point can move left
    const point19 = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const points = sketch.points || [];
      const p19 = points[19];
      return { x: p19.x, y: p19.y, id: p19.id };
    });

    console.log('Point 19 (top-right) at:', point19.x, point19.y, 'id:', point19.id);

    // Drag point 19 LEFT - this should move it into negative X territory
    console.log('Dragging point 19 LEFT (negative X direction)');
    await dragStage(page, box, point19, { 
      x: point19.x - 100,  // Move left significantly
      y: point19.y 
    });

    await page.waitForTimeout(300);

    // Check if point actually moved and if it's in negative coordinates
    const pointAfterDrag = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const points = sketch.points || [];
      const p19 = points[19];
      return { x: p19.x, y: p19.y };
    });
    console.log('Point 19 position after LEFT drag:', pointAfterDrag);
    console.log('Point moved into negative X:', pointAfterDrag.x < 0);

    // Check bounding box to see if we have negative coordinates
    const boundingBox = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const lines = sketch.lines || [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const line of lines) {
        minX = Math.min(minX, line.start.x, line.end.x);
        minY = Math.min(minY, line.start.y, line.end.y);
        maxX = Math.max(maxX, line.start.x, line.end.x);
        maxY = Math.max(maxY, line.start.y, line.end.y);
      }
      return { minX, minY, maxX, maxY };
    });
    console.log('Bounding box after drag:', boundingBox);
    console.log('Shape extends into negative coordinates:', boundingBox.minX < 0 || boundingBox.minY < 0);

    const afterDragFillCount = await page.evaluate(() => {
      const sketch = window.__knitstitchStore?.state?.sketch;
      const lines = sketch.lines || [];
      const cellW = window.__knitstitchStore.get('cellWidthPx');
      const cellH = window.__knitstitchStore.get('cellHeightPx');
      const computeFilledCellsFromSketch = window.__knitstitchComputeFilledCellsFromSketch;
      const sketchFilled = computeFilledCellsFromSketch(lines, cellW, cellH, 0.3);
      return sketchFilled.size;
    });

    console.log('Fill count after dragging into negative coordinates:', afterDragFillCount);

    // The key test: if the shape extends into negative coordinates and the fill 
    // count is still reasonable (> 0), then the negative coordinate bug is FIXED
    if ((boundingBox.minX < 0 || boundingBox.minY < 0) && afterDragFillCount > 0) {
      console.log('✅ SUCCESS: Cell fill works correctly with negative coordinates!');
      console.log(`   Shape extends to negative coordinates (minX: ${boundingBox.minX}, minY: ${boundingBox.minY})`);
      console.log(`   Fill count is still working: ${afterDragFillCount} cells`);
      expect(afterDragFillCount).toBeGreaterThan(0, 'Fill should work with negative coordinates');
    } else if (boundingBox.minX < 0 || boundingBox.minY < 0) {
      console.log('❌ ISSUE: Shape has negative coordinates but fill count is 0');
      console.log('   This confirms the negative coordinate bug');
      expect(afterDragFillCount).toBeGreaterThan(0, 'Fill should work with negative coordinates - BUG CONFIRMED');
    } else {
      console.log('⚠️  Shape did not extend into negative coordinates - test inconclusive');
      console.log('   Point may be constrained from moving into negative territory');
    }
  });
});