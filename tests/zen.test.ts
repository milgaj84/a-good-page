import { describe, expect, it } from 'vitest';
import { ZEN_COOLDOWN_MS, ZenGuard, isDeletionInput, isDeletionKey, zenNudge, type ZenKey } from '../src/core/zen';

function key(key: string, mods: Partial<ZenKey> = {}): ZenKey {
  return { key, code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods };
}

function setup(isMac = false, cooldown?: number) {
  let t = 0;
  const messages: string[] = [];
  const guard = new ZenGuard(() => t, (m) => messages.push(m), isMac, cooldown);
  return { guard, messages, tick: (ms: number) => { t += ms; } };
}

describe('deletion detection', () => {
  it('treats Backspace and Delete with any modifier as deletion', () => {
    expect(isDeletionKey(key('Backspace'), false)).toBe(true);
    expect(isDeletionKey(key('Delete'), false)).toBe(true);
    expect(isDeletionKey(key('Backspace', { ctrlKey: true }), false)).toBe(true);
    expect(isDeletionKey(key('Backspace', { altKey: true }), true)).toBe(true);
    expect(isDeletionKey(key('Backspace', { metaKey: true }), true)).toBe(true);
  });

  it('covers the macOS Ctrl+H and Ctrl+D delete keys only on macOS', () => {
    expect(isDeletionKey(key('h', { ctrlKey: true }), true)).toBe(true);
    expect(isDeletionKey(key('d', { ctrlKey: true }), true)).toBe(true);
    expect(isDeletionKey(key('h', { ctrlKey: true }), false)).toBe(false);
    expect(isDeletionKey(key('H', { ctrlKey: true, shiftKey: true }), true)).toBe(false);
  });

  it('leaves writing, navigation, undo and IME composition alone', () => {
    for (const k of ['a', ' ', 'Enter', 'ArrowLeft', 'Escape', '']) expect(isDeletionKey(key(k), false)).toBe(false);
    expect(isDeletionKey(key('z', { ctrlKey: true }), false)).toBe(false);
    expect(isDeletionKey(key('Backspace', { isComposing: true }), false)).toBe(false);
  });

  it('recognises browser delete inputs but not composition or typing', () => {
    for (const t of ['deleteContentBackward', 'deleteContentForward', 'deleteWordBackward', 'deleteByCut', 'deleteByDrag']) expect(isDeletionInput(t)).toBe(true);
    for (const t of ['deleteCompositionText', 'insertText', 'insertParagraph', 'historyUndo', '']) expect(isDeletionInput(t)).toBe(false);
  });
});

describe('ZenGuard', () => {
  it('blocks nothing while off', () => {
    const { guard, messages } = setup();
    expect(guard.blockKey(key('Backspace'))).toBe(false);
    expect(guard.blockInput('deleteContentBackward')).toBe(false);
    expect(guard.blockCut()).toBe(false);
    expect(guard.blockDrag()).toBe(false);
    expect(messages).toEqual([]);
  });

  it('blocks deletions, cut and drag-moves while on, and lets writing through', () => {
    const { guard } = setup();
    guard.set(true);
    expect(guard.blockKey(key('Backspace'))).toBe(true);
    expect(guard.blockKey(key('Delete'))).toBe(true);
    expect(guard.blockInput('deleteWordBackward')).toBe(true);
    expect(guard.blockCut()).toBe(true);
    expect(guard.blockDrag()).toBe(true);
    expect(guard.blockKey(key('a'))).toBe(false);
    expect(guard.blockInput('insertText')).toBe(false);
  });

  it('nudges once per cooldown, not on every blocked key', () => {
    const { guard, messages, tick } = setup(false, 1000);
    guard.set(true);
    guard.blockKey(key('Backspace')); guard.blockKey(key('Backspace'));
    tick(999); guard.blockKey(key('Backspace'));
    expect(messages).toHaveLength(1);
    tick(1); guard.blockKey(key('Backspace'));
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe(zenNudge(false));
  });

  it('does not nudge for keys it lets through, and resets the cooldown when toggled', () => {
    const { guard, messages } = setup();
    guard.set(true); guard.blockKey(key('a'));
    expect(messages).toEqual([]);
    guard.blockKey(key('Backspace')); guard.set(false); guard.set(true); guard.blockKey(key('Backspace'));
    expect(messages).toHaveLength(2);
    expect(guard.enabled).toBe(true);
  });

  it('names the platform shortcut to turn it off', () => {
    expect(zenNudge(true)).toContain('⌘⇧D');
    expect(zenNudge(false)).toContain('Ctrl+Shift+D');
  });

  it('accepts a zero cooldown and rejects invalid ones', () => {
    const { guard, messages } = setup(false, 0);
    guard.set(true); guard.blockCut(); guard.blockCut();
    expect(messages).toHaveLength(2);
    expect(ZEN_COOLDOWN_MS).toBeGreaterThan(0);
    expect(() => setup(false, -1)).toThrow(RangeError);
    expect(() => setup(false, Number.NaN)).toThrow(RangeError);
  });
});
