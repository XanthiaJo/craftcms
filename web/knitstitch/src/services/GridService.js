export function rebuildPreviewCells(store) {
    const cols = store.get('gridColumns');
    const rows = store.get('gridRows');
    const count = cols * rows;
    const cells = [];
    const old = store.get('previewCells');
    for (let i = 0; i < count; i++) {
        cells.push({ isFilled: old[i]?.isFilled ?? false });
    }
    store.set('previewCells', cells);
}

export function togglePreviewCell(store, index) {
    const cells = store.get('previewCells');
    if (index < 0 || index >= cells.length) return;
    const updated = cells.map((c, i) =>
        i === index ? { isFilled: !c.isFilled } : c
    );
    store.set('previewCells', updated);
}

export function fitGridToCanvas(store, canvasWidthPx, canvasHeightPx) {
    if (canvasWidthPx <= 0 || canvasHeightPx <= 0) return;
    const cellW = store.get('cellWidthPx');
    const cellH = store.get('cellHeightPx');
    const cols = Math.max(1, Math.floor(canvasWidthPx / cellW));
    const rows = Math.max(1, Math.floor(canvasHeightPx / cellH));
    store.set('gridColumns', cols);
    store.set('gridRows', rows);
    rebuildPreviewCells(store);
}

export function updateCellSizing(store, stitchesPer4Inches, rowsPer4Inches) {
    store.set('cellWidthPx', Math.max(1, stitchesPer4Inches));
    store.set('cellHeightPx', Math.max(1, rowsPer4Inches));
}
