import { describe, expect, it } from 'vitest';
import { tabIndex } from '../src/ui/dialog-focus';
describe('modal focus wraparound', () => {
  it('wraps forward and backward at the edges', () => {
    expect(tabIndex(2, 3, false)).toBe(0);
    expect(tabIndex(0, 3, true)).toBe(2);
    expect(tabIndex(1, 3, false)).toBe(2);
  });
  it('starts at first or last when focus escapes the dialog', () => {
    expect(tabIndex(-1, 3, false)).toBe(0);
    expect(tabIndex(-1, 3, true)).toBe(2);
    expect(tabIndex(-1, 0, true)).toBe(-1);
  });
});
