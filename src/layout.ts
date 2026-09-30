export interface ColumnSize {
    /** Fixed width in characters. */
    width?: number;
    /** Share of the space the fixed columns leave. */
    grow?: number;
}

export function fitColumns(columns: ColumnSize[], total: number): number[] {
    const fixed = columns.reduce((sum, c) => sum + (c.width ?? 0), 0);
    const weights = columns.reduce((sum, c) => sum + (c.grow ?? 0), 0);
    const free = Math.max(0, total - fixed);
    const widths = columns.map((c) => c.width ?? Math.floor((free * (c.grow ?? 0)) / weights));

    const lastGrowing = columns.findLastIndex((c) => c.width === undefined);
    if (lastGrowing >= 0) widths[lastGrowing] += Math.max(0, total - widths.reduce((a, b) => a + b, 0));
    return widths;
}

/** First visible row: moves only as much as needed to keep the selected row on screen. */
export function scrollOffset({
    previous,
    selected,
    visible,
    total,
}: {
    previous: number;
    selected: number;
    visible: number;
    total: number;
}): number {
    let offset = previous;
    if (selected < offset) offset = selected;
    if (selected >= offset + visible) offset = selected - visible + 1;
    return Math.max(0, Math.min(offset, total - visible));
}
