import { describe, expect, it } from 'vitest';
import { TYPEWRITER_TOLERANCE, anchorLine, typewriterScroll } from '../src/core/typewriter';

describe('typewriterScroll', () => {
  it('moves the caret line onto the anchor', () => {
    expect(typewriterScroll({ scrollTop: 200, maxScroll: 5000, caretMid: 700, anchorY: 450 })).toBe(450);
    expect(typewriterScroll({ scrollTop: 900, maxScroll: 5000, caretMid: 100, anchorY: 450 })).toBe(550);
  });

  it('does nothing when the caret is already centred or within tolerance', () => {
    expect(typewriterScroll({ scrollTop: 300, maxScroll: 5000, caretMid: 450, anchorY: 450 })).toBeNull();
    expect(typewriterScroll({ scrollTop: 300, maxScroll: 5000, caretMid: 450 + TYPEWRITER_TOLERANCE, anchorY: 450 })).toBeNull();
  });

  it('clamps at the top and bottom of the scrollable range', () => {
    expect(typewriterScroll({ scrollTop: 50, maxScroll: 5000, caretMid: 100, anchorY: 450 })).toBe(0);
    expect(typewriterScroll({ scrollTop: 4900, maxScroll: 5000, caretMid: 900, anchorY: 450 })).toBe(5000);
    expect(typewriterScroll({ scrollTop: 0, maxScroll: 5000, caretMid: 100, anchorY: 450 })).toBeNull();
  });

  it('handles short and empty documents that cannot scroll', () => {
    expect(typewriterScroll({ scrollTop: 0, maxScroll: 0, caretMid: 800, anchorY: 450 })).toBeNull();
    expect(typewriterScroll({ scrollTop: 0, maxScroll: -20, caretMid: 800, anchorY: 450 })).toBeNull();
    expect(typewriterScroll({ scrollTop: 30, maxScroll: -20, caretMid: 450, anchorY: 450 })).toBe(0);
  });

  it('refuses non-finite measurements', () => {
    expect(typewriterScroll({ scrollTop: Number.NaN, maxScroll: 10, caretMid: 1, anchorY: 1 })).toBeNull();
    expect(typewriterScroll({ scrollTop: 0, maxScroll: Number.POSITIVE_INFINITY, caretMid: 900, anchorY: 1 })).toBeNull();
    expect(typewriterScroll({ scrollTop: 0, maxScroll: 10, caretMid: Number.NaN, anchorY: 1 })).toBeNull();
  });
});

describe('anchorLine', () => {
  it('uses the exact middle of the screen when it lies inside the page area', () => {
    expect(anchorLine(60, 900, 1000)).toBe(500);
    expect(anchorLine(500, 900, 1000)).toBe(500);
  });

  it('falls back to the middle of the page area otherwise', () => {
    expect(anchorLine(600, 900, 1000)).toBe(750);
    expect(anchorLine(0, 400, 1000)).toBe(200);
    expect(anchorLine(0, 400, Number.NaN)).toBe(200);
  });
});
