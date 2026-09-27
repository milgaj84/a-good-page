import { describe, expect, it } from 'vitest';
import { GhostChrome, isWritingKey, type WritingKey } from '../src/core/ghost';

function key(key: string, mods: Partial<WritingKey> = {}): WritingKey {
  return { key, code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods };
}

function setup(threshold?: number) {
  const calls: boolean[] = [];
  const ghost = new GhostChrome({ fade: (hidden) => calls.push(hidden) }, threshold);
  return { ghost, calls };
}

describe('isWritingKey', () => {
  it('counts letters, digits, punctuation, space and editing keys', () => {
    for (const k of ['a', 'Z', '7', '.', ' ', 'é', 'Enter', 'Backspace', 'Delete', 'Tab']) expect(isWritingKey(key(k))).toBe(true);
    expect(isWritingKey(key('A', { shiftKey: true }))).toBe(true);
  });

  it('ignores shortcuts, navigation and lone modifiers', () => {
    expect(isWritingKey(key('s', { ctrlKey: true }))).toBe(false);
    expect(isWritingKey(key('b', { metaKey: true }))).toBe(false);
    for (const k of ['Shift', 'Control', 'ArrowDown', 'PageUp', 'Escape', 'F5', '']) expect(isWritingKey(key(k))).toBe(false);
  });

  it('treats AltGr characters and IME composition as writing', () => {
    expect(isWritingKey(key('@', { ctrlKey: true, altKey: true }))).toBe(true);
    expect(isWritingKey(key('Process', { isComposing: true }))).toBe(true);
  });
});

describe('GhostChrome', () => {
  it('fades once on the first input and not again on later keystrokes', () => {
    const { ghost, calls } = setup();
    ghost.input(); ghost.input(); ghost.input();
    expect(ghost.hidden).toBe(true);
    expect(calls).toEqual([true]);
  });

  it('returns on Esc, and Esc while visible does nothing', () => {
    const { ghost, calls } = setup();
    ghost.escape();
    ghost.input(); ghost.escape(); ghost.escape();
    expect(ghost.hidden).toBe(false);
    expect(calls).toEqual([true, false]);
  });

  it('returns on real mouse movement past the threshold', () => {
    const { ghost, calls } = setup(3);
    ghost.pointer(100, 100);
    ghost.input();
    ghost.pointer(102, 101); // within 3px: jitter
    expect(ghost.hidden).toBe(true);
    ghost.pointer(110, 100);
    expect(ghost.hidden).toBe(false);
    expect(calls).toEqual([true, false]);
  });

  it('keeps the baseline frozen while hidden, so slow drift still counts', () => {
    const { ghost } = setup(3);
    ghost.pointer(0, 0); ghost.input();
    ghost.pointer(2, 0); ghost.pointer(3, 0);
    expect(ghost.hidden).toBe(true);
    ghost.pointer(4, 0);
    expect(ghost.hidden).toBe(false);
  });

  it('ignores a scroll-triggered mousemove at the same point and a first move without a baseline', () => {
    const { ghost } = setup();
    ghost.input();
    ghost.pointer(50, 50); // first reading only sets the baseline
    ghost.pointer(50, 50);
    expect(ghost.hidden).toBe(true);
  });

  it('ignores non-finite pointer coordinates', () => {
    const { ghost } = setup();
    ghost.pointer(0, 0); ghost.input();
    ghost.pointer(Number.NaN, 400); ghost.pointer(Number.POSITIVE_INFINITY, 0);
    expect(ghost.hidden).toBe(true);
  });

  it('never fades when disabled and shows the chrome when turned off mid-fade', () => {
    const { ghost, calls } = setup();
    ghost.input();
    ghost.setEnabled(false);
    expect(ghost.hidden).toBe(false);
    ghost.input();
    expect(calls).toEqual([true, false]);
    ghost.setEnabled(true); ghost.input();
    expect(ghost.hidden).toBe(true);
  });

  it('accepts a zero threshold and rejects invalid ones', () => {
    const { ghost } = setup(0);
    ghost.pointer(1, 1); ghost.input(); ghost.pointer(1, 2);
    expect(ghost.hidden).toBe(false);
    expect(() => setup(-1)).toThrow(RangeError);
    expect(() => setup(Number.NaN)).toThrow(RangeError);
  });
});
