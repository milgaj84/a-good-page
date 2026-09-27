import { describe, expect, it } from 'vitest';
import { bubblePlacement } from '../src/core/bubble';

describe('bubblePlacement', () => {
  it('lifts the tippy width cap so labels never collide', () => {
    expect(bubblePlacement().maxWidth).toBe('none');
  });

  it('floats above the selection with a gap', () => {
    const options = bubblePlacement();
    expect(options.placement).toBe('top');
    expect(options.offset[1]).toBeGreaterThan(0);
  });

  it('keeps show and hide quick', () => {
    const [show, hide] = bubblePlacement().duration;
    expect(show).toBeLessThanOrEqual(160);
    expect(hide).toBeLessThanOrEqual(show);
  });

  it('returns a fresh object on every call', () => {
    const first = bubblePlacement();
    first.offset[1] = 99;
    first.duration[0] = 0;
    expect(bubblePlacement().offset[1]).toBe(12);
    expect(bubblePlacement().duration[0]).toBe(140);
    expect(bubblePlacement()).not.toBe(bubblePlacement());
  });

  it('sits above page content but below dialogs', () => {
    const { zIndex } = bubblePlacement();
    expect(zIndex).toBeGreaterThan(3);
    expect(zIndex).toBeLessThan(50);
  });
});
