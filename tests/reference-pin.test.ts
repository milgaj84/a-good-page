import { describe, expect, it } from 'vitest';
import { REFERENCE_KEY, ReferencePin } from '../src/core/reference-pin';
import type { KeyValueStore } from '../src/core/ports';

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => { data.set(k, v); }, remove: (k) => { data.delete(k); } };
}

describe('reference pin', () => {
  it('starts empty on the right and expanded', () => {
    expect(new ReferencePin(memory()).state).toEqual({ path: null, side: 'right', collapsed: false });
  });
  it('pins writing files only and remembers them', () => {
    const s = memory();
    const pin = new ReferencePin(s);
    expect(pin.pin('/book/notes.md')).toBe(true);
    expect(pin.pin('/book/cover.png')).toBe(false);
    expect(new ReferencePin(s).state.path).toBe('/book/notes.md');
    expect(JSON.parse(s.data.get(REFERENCE_KEY)!).path).toBe('/book/notes.md');
  });
  it('pinning expands the panel; unpinning keeps the chosen side', () => {
    const pin = new ReferencePin(memory());
    pin.pin('/a.md');
    pin.setSide('left');
    pin.toggleCollapsed();
    expect(pin.state.collapsed).toBe(true);
    pin.pin('/b.txt');
    expect(pin.state).toEqual({ path: '/b.txt', side: 'left', collapsed: false });
    pin.unpin();
    expect(pin.state).toEqual({ path: null, side: 'left', collapsed: false });
  });
  it('swaps sides', () => {
    const pin = new ReferencePin(memory());
    expect(pin.swapSide()).toBe('left');
    expect(pin.swapSide()).toBe('right');
  });
  it('falls back safely from damaged or unexpected saved data', () => {
    const s = memory();
    s.data.set(REFERENCE_KEY, '{bad');
    expect(new ReferencePin(s).state.path).toBeNull();
    s.data.set(REFERENCE_KEY, JSON.stringify({ path: '/x.exe', side: 'top', collapsed: 'yes' }));
    expect(new ReferencePin(s).state).toEqual({ path: null, side: 'right', collapsed: false });
  });
});
