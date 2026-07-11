import { bindIfPresent } from './uiUtils.js';

/**
 * Owns keyboard shortcuts: Escape exits to Select tool, Delete removes
 * the current sketch selection (when not editing a text field).
 */
export function setupKeyboardController({ store, sketchService, documentObj = globalThis.document }) {
  bindIfPresent(documentObj, 'keydown', (e) => {
    if (e.key === 'Escape') {
      sketchService.exitToSelect();
      return;
    }

    if (e.key !== 'Delete') return;
    if (!store.get('sketch.isActive')) return;

    const activeEl = documentObj.activeElement;
    const isEditingField = !!activeEl && (
      activeEl.tagName === 'INPUT'
      || activeEl.tagName === 'TEXTAREA'
      || activeEl.tagName === 'SELECT'
      || activeEl.isContentEditable
    );
    if (isEditingField) return;
    if (!sketchService.hasSelection) return;

    e.preventDefault();
    sketchService.deleteSelected();
  });
}
