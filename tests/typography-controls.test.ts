import { describe, expect, it } from 'vitest';
import { APP_ACTIONS, isAppAction, isEditorCommand } from '../src/core/commands';
import { SHORTCUTS, resolveShortcut, type KeyLike } from '../src/core/keymap';
import { PALETTE_ITEMS, searchPalette } from '../src/core/palette';

function press(key: string, extra: Partial<KeyLike> = {}): KeyLike {
  return { key, code: 'Key' + key.toUpperCase(), ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, ...extra };
}

describe('typography actions', () => {
  it('are application actions, not editor commands', () => {
    for (const action of ['measure', 'rhythm', 'typeface']) {
      expect(isAppAction(action)).toBe(true);
      expect(isEditorCommand(action)).toBe(false);
    }
    expect(new Set(APP_ACTIONS).size).toBe(APP_ACTIONS.length);
  });

  it('have Ctrl/Cmd+Shift shortcuts that do not steal existing ones', () => {
    expect(resolveShortcut(press('M'))).toBe('measure');
    expect(resolveShortcut(press('K'))).toBe('rhythm');
    expect(resolveShortcut(press('Y'))).toBe('typeface');
    expect(resolveShortcut(press('y', { ctrlKey: false, metaKey: true }))).toBe('typeface');
    expect(resolveShortcut(press('k', { shiftKey: false }))).toBe('link');
    expect(resolveShortcut(press('y', { shiftKey: false }))).toBe('redo');
    expect(resolveShortcut(press('m', { ctrlKey: false }))).toBeNull();
  });

  it('are listed in the shortcut sheet', () => {
    const labels = SHORTCUTS.map((s) => s.keys.join('+') + ' ' + s.label).join('\n');
    expect(labels).toContain('Mod+Shift+M Column width');
    expect(labels).toContain('Mod+Shift+K Spacing');
    expect(labels).toContain('Mod+Shift+Y Typeface');
  });

  it('can be found in the command palette by plain words', () => {
    expect(searchPalette('line length')[0].action).toBe('measure');
    expect(searchPalette('line height')[0].action).toBe('rhythm');
    expect(searchPalette('duospace')[0].action).toBe('typeface');
    const actions = PALETTE_ITEMS.map((item) => item.action);
    expect(new Set(actions).size).toBe(actions.length);
  });
});
