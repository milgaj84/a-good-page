import { describe, expect, it } from 'vitest';
import { placePopover } from '../src/core/placement';

const view = { width: 1000, height: 800 };
const size = { width: 200, height: 100 };

describe('placePopover', () => {
  it('centres below the anchor when there is room', () => {
    const anchor = { left: 100, right: 140, top: 50, bottom: 80 };
    expect(placePopover(anchor, size, view)).toEqual({ left: 20, top: 88, above: false });
  });

  it('keeps a margin from the left edge', () => {
    const anchor = { left: 0, right: 20, top: 50, bottom: 80 };
    expect(placePopover(anchor, size, view).left).toBe(12);
  });

  it('keeps a margin from the right edge', () => {
    const anchor = { left: 960, right: 1000, top: 50, bottom: 80 };
    expect(placePopover(anchor, size, view).left).toBe(788);
  });

  it('flips above when there is no room below', () => {
    const anchor = { left: 400, right: 440, top: 700, bottom: 730 };
    expect(placePopover(anchor, size, view)).toEqual({ left: 320, top: 592, above: true });
  });

  it('clamps inside tiny windows where neither side fits', () => {
    const anchor = { left: 100, right: 120, top: 40, bottom: 60 };
    const spot = placePopover(anchor, { width: 200, height: 120 }, { width: 300, height: 150 });
    expect(spot.above).toBe(false);
    expect(spot.top).toBe(18);
  });

  it('pins popovers wider than the window to the margin', () => {
    const anchor = { left: 180, right: 220, top: 10, bottom: 30 };
    expect(placePopover(anchor, { width: 500, height: 50 }, { width: 400, height: 600 }).left).toBe(12);
  });

  it('honours custom gap and margin', () => {
    const anchor = { left: 100, right: 140, top: 50, bottom: 80 };
    expect(placePopover(anchor, size, view, 0, 0)).toEqual({ left: 20, top: 80, above: false });
  });
});
