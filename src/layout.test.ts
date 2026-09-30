import { describe, expect, it } from 'vitest';
import { fitColumns, scrollOffset } from './layout.js';

describe('scrollOffset', () => {
    it('keeps the offset while the selection stays inside the window', () => {
        expect(scrollOffset({ previous: 2, selected: 4, visible: 3, total: 10 })).toBe(2);
    });

    it('moves the window down just enough to show a selection below it', () => {
        expect(scrollOffset({ previous: 0, selected: 5, visible: 3, total: 10 })).toBe(3);
    });

    it('moves the window up just enough to show a selection above it', () => {
        expect(scrollOffset({ previous: 4, selected: 1, visible: 3, total: 10 })).toBe(1);
    });

    it('pulls the window back when the list shrinks, so no empty rows remain at the end', () => {
        expect(scrollOffset({ previous: 6, selected: 3, visible: 3, total: 5 })).toBe(2);
    });

    it('returns 0 when everything fits', () => {
        expect(scrollOffset({ previous: 3, selected: 2, visible: 8, total: 5 })).toBe(0);
    });
});

describe('fitColumns', () => {
    it('keeps fixed widths and shares the rest by grow weight', () => {
        expect(fitColumns([{ width: 10 }, { grow: 1 }, { grow: 3 }], 50)).toEqual([10, 10, 30]);
    });

    it('gives the rounding remainder to the last growing column so the row fills the total', () => {
        const widths = fitColumns([{ grow: 1 }, { width: 4 }, { grow: 1 }], 11);
        expect(widths).toEqual([3, 4, 4]);
    });

    it('never gives a growing column a negative width when the total is too small', () => {
        expect(fitColumns([{ width: 10 }, { grow: 1 }], 6)).toEqual([10, 0]);
    });
});
