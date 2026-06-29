import { describe, it, expect } from 'vitest';
import { Store } from '../../../web/knitstitch/src/state/store.js';
import { rebuildPreviewCells, togglePreviewCell, fitGridToCanvas, updateCellSizing } from '../../../web/knitstitch/src/services/gridService.js';

describe('GridService', () => {
  function makeStore() {
    return new Store();
  }

  describe('rebuildPreviewCells', () => {
    it('should create cells matching gridColumns x gridRows', () => {
      const store = makeStore();
      store.set('gridColumns', 4);
      store.set('gridRows', 5);
      rebuildPreviewCells(store);
      expect(store.get('previewCells').length).toBe(20);
    });

    it('should preserve existing isFilled values', () => {
      const store = makeStore();
      store.set('gridColumns', 2);
      store.set('gridRows', 2);
      store.set('previewCells', [
        { isFilled: true },
        { isFilled: false },
        { isFilled: false },
        { isFilled: true },
      ]);
      // Shrink then grow back
      store.set('gridColumns', 3);
      store.set('gridRows', 2);
      rebuildPreviewCells(store);
      const cells = store.get('previewCells');
      expect(cells[0].isFilled).toBe(true);
      expect(cells[1].isFilled).toBe(false);
      expect(cells[2].isFilled).toBe(false);
    });
  });

  describe('togglePreviewCell', () => {
    it('should flip isFilled for the indexed cell', () => {
      const store = makeStore();
      store.set('gridColumns', 3);
      store.set('gridRows', 3);
      rebuildPreviewCells(store);
      togglePreviewCell(store, 4);
      expect(store.get('previewCells')[4].isFilled).toBe(true);
      togglePreviewCell(store, 4);
      expect(store.get('previewCells')[4].isFilled).toBe(false);
    });

    it('should ignore out-of-bounds indices', () => {
      const store = makeStore();
      store.set('gridColumns', 2);
      store.set('gridRows', 2);
      rebuildPreviewCells(store);
      togglePreviewCell(store, -1);
      togglePreviewCell(store, 10);
      expect(store.get('previewCells').every(c => !c.isFilled)).toBe(true);
    });
  });

  describe('fitGridToCanvas', () => {
    it('should compute columns from width / cellWidthPx', () => {
      const store = makeStore();
      // default cellWidthPx = 20
      fitGridToCanvas(store, 100, 200);
      expect(store.get('gridColumns')).toBe(5);
      expect(store.get('gridRows')).toBe(7); // 200 / 28 = 7.14 → floor 7
    });

    it('should clamp to at least 1', () => {
      const store = makeStore();
      fitGridToCanvas(store, 1, 1);
      expect(store.get('gridColumns')).toBe(1);
      expect(store.get('gridRows')).toBe(1);
    });

    it('should ignore zero or negative canvas size', () => {
      const store = makeStore();
      fitGridToCanvas(store, 0, 200);
      expect(store.get('gridColumns')).toBe(30); // unchanged
    });
  });

  describe('updateCellSizing', () => {
    it('should set cell dimensions from gauge', () => {
      const store = makeStore();
      updateCellSizing(store, 24, 32);
      expect(store.get('cellWidthPx')).toBe(24);
      expect(store.get('cellHeightPx')).toBe(32);
    });

    it('should clamp to minimum of 1', () => {
      const store = makeStore();
      updateCellSizing(store, 0, 0);
      expect(store.get('cellWidthPx')).toBe(1);
      expect(store.get('cellHeightPx')).toBe(1);
    });
  });
});
