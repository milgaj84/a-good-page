import { describe, expect, it } from 'vitest';
import { SHORTCUTS, formatKeys, resolveShortcut, type KeyLike } from '../src/core/keymap';
import { APP_ACTIONS, EDITOR_COMMANDS, isAppAction, isEditorCommand } from '../src/core/commands';

type Mods = Partial<Pick<KeyLike, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>>;

function press(key: string, code: string, mods: Mods = {}): KeyLike {
  return { key, code, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods };
}

const ctrl: Mods = { ctrlKey: true };
const ctrlShift: Mods = { ctrlKey: true, shiftKey: true };
const ctrlAlt: Mods = { ctrlKey: true, altKey: true };

describe('resolveShortcut', () => {
  it('maps file shortcuts with Ctrl or Cmd', () => {
    expect(resolveShortcut(press('n', 'KeyN', ctrl))).toBe('new');
    expect(resolveShortcut(press('o', 'KeyO', { metaKey: true }))).toBe('open');
    expect(resolveShortcut(press('s', 'KeyS', ctrl))).toBe('save');
    expect(resolveShortcut(press('S', 'KeyS', ctrlShift))).toBe('saveAs');
  });

  it('maps formatting, history and PDF export', () => {
    expect(resolveShortcut(press('b', 'KeyB', ctrl))).toBe('bold');
    expect(resolveShortcut(press('i', 'KeyI', ctrl))).toBe('italic');
    expect(resolveShortcut(press('z', 'KeyZ', ctrl))).toBe('undo');
    expect(resolveShortcut(press('y', 'KeyY', ctrl))).toBe('redo');
    expect(resolveShortcut(press('Z', 'KeyZ', ctrlShift))).toBe('redo');
    expect(resolveShortcut(press('H', 'KeyH', ctrlShift))).toBe('hr');
    expect(resolveShortcut(press('E', 'KeyE', ctrlShift))).toBe('exportPdf');
    expect(resolveShortcut(press('P', 'KeyP', ctrlShift))).toBe('palette');
    expect(resolveShortcut(press('f', 'KeyF', ctrl))).toBe('find');
    expect(resolveShortcut(press('h', 'KeyH', ctrl))).toBe('replace');
  });

  it('maps shifted letters case-insensitively', () => {
    expect(resolveShortcut(press('F', 'KeyF', ctrlShift))).toBe('focus');
    expect(resolveShortcut(press('U', 'KeyU', ctrlShift))).toBe('sentenceFocus');
    expect(resolveShortcut(press('G', 'KeyG', ctrlShift))).toBe('fullScreen');
    expect(resolveShortcut(press('L', 'KeyL', ctrlShift))).toBe('theme');
    expect(resolveShortcut(press('O', 'KeyO', ctrlShift))).toBe('outline');
    expect(resolveShortcut(press('X', 'KeyX', ctrlShift))).toBe('strike');
    expect(resolveShortcut(press('B', 'KeyB', ctrlShift))).toBe('quote');
  });

  it('uses physical keys for list shortcuts', () => {
    expect(resolveShortcut(press('*', 'Digit8', ctrlShift))).toBe('bullet');
    expect(resolveShortcut(press('&', 'Digit7', ctrlShift))).toBe('ordered');
    expect(resolveShortcut(press('(', 'Digit9', ctrlShift))).toBe('task');
  });

  it('maps Alt + digits to text styles on any layout', () => {
    expect(resolveShortcut(press('º', 'Digit0', ctrlAlt))).toBe('paragraph');
    expect(resolveShortcut(press('¡', 'Digit1', ctrlAlt))).toBe('h1');
    expect(resolveShortcut(press('™', 'Digit2', ctrlAlt))).toBe('h2');
    expect(resolveShortcut(press('£', 'Digit3', ctrlAlt))).toBe('h3');
  });

  it('maps text size, help, sidebar, link and code', () => {
    expect(resolveShortcut(press('=', 'Equal', ctrl))).toBe('bigger');
    expect(resolveShortcut(press('+', 'Equal', ctrlShift))).toBe('bigger');
    expect(resolveShortcut(press('-', 'Minus', ctrl))).toBe('smaller');
    expect(resolveShortcut(press('0', 'Digit0', ctrl))).toBe('resetSize');
    expect(resolveShortcut(press('/', 'Slash', ctrl))).toBe('help');
    expect(resolveShortcut(press('?', 'Slash', ctrlShift))).toBe('help');
    expect(resolveShortcut(press('\\', 'Backslash', ctrl))).toBe('sidebar');
    expect(resolveShortcut(press('k', 'KeyK', ctrl))).toBe('link');
    expect(resolveShortcut(press('e', 'KeyE', ctrl))).toBe('code');
  });

  it('falls back to the physical letter on non-latin layouts', () => {
    expect(resolveShortcut(press('ы', 'KeyS', ctrl))).toBe('save');
    expect(resolveShortcut(press('Ы', 'KeyS', ctrlShift))).toBe('saveAs');
  });

  it('recognises Escape only without modifiers', () => {
    expect(resolveShortcut(press('Escape', 'Escape'))).toBe('escape');
    expect(resolveShortcut(press('Escape', 'Escape', { shiftKey: true }))).toBeNull();
    expect(resolveShortcut(press('Escape', 'Escape', ctrl))).toBeNull();
  });

  it('ignores plain typing and unknown combinations', () => {
    expect(resolveShortcut(press('a', 'KeyA'))).toBeNull();
    expect(resolveShortcut(press('S', 'KeyS', { shiftKey: true }))).toBeNull();
    expect(resolveShortcut(press('q', 'KeyQ', ctrl))).toBeNull();
    expect(resolveShortcut(press('1', 'Digit1', { ctrlKey: true, altKey: true, shiftKey: true }))).toBeNull();
    expect(resolveShortcut(press('s', 'KeyS', ctrlAlt))).toBeNull();
  });

  it('tolerates synthetic events without key or code', () => {
    const odd = { ...press('', '', ctrl), key: undefined, code: undefined } as unknown as KeyLike;
    expect(resolveShortcut(odd)).toBeNull();
  });

  it('only ever returns known actions', () => {
    const codes = [
      ...Array.from({ length: 10 }, (_, i) => 'Digit' + i),
      ...Array.from({ length: 26 }, (_, i) => 'Key' + String.fromCharCode(65 + i)),
      'Equal', 'Minus', 'Slash', 'Backslash', 'Escape', 'Enter',
    ];
    const combos: Mods[] = [{}, ctrl, ctrlShift, ctrlAlt, { metaKey: true }];
    for (const code of codes) {
      const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code.replace('Digit', '');
      for (const mods of combos) {
        const action = resolveShortcut(press(key, code, mods));
        if (action !== null) expect(isEditorCommand(action) || isAppAction(action)).toBe(true);
      }
    }
  });

  it('maps the library and long-project tools without taking over Link', () => {
    expect(resolveShortcut(press('p', 'KeyP', ctrl))).toBe('palette');
    expect(resolveShortcut(press('p', 'KeyP', { metaKey: true }))).toBe('palette');
    expect(resolveShortcut(press('k', 'KeyK', { metaKey: true }))).toBe('link');
    expect(resolveShortcut(press('R', 'KeyR', ctrlShift))).toBe('reference');
    expect(resolveShortcut(press('I', 'KeyI', ctrlShift))).toBe('timeMachine');
    expect(resolveShortcut(press('A', 'KeyA', ctrlShift))).toBe('sprint');
    expect(resolveShortcut(press('Q', 'KeyQ', ctrlShift))).toBe('polish');
    expect(resolveShortcut(press('a', 'KeyA', ctrl))).toBeNull();
  });

  it('maps new page, new book and rename', () => {
    expect(resolveShortcut(press('n', 'KeyN', ctrl))).toBe('new');
    expect(resolveShortcut(press('N', 'KeyN', ctrlShift))).toBe('newProject');
    expect(resolveShortcut(press('F2', 'F2', {}))).toBe('rename');
    expect(resolveShortcut(press('P', 'KeyP', ctrlShift))).toBe('palette');
    expect(resolveShortcut(press('F2', 'F2', { shiftKey: true }))).toBeNull();
  });

  it('maps the ghost interface toggles with Shift', () => {
    expect(resolveShortcut(press('D', 'KeyD', ctrlShift))).toBe('zen');
    expect(resolveShortcut(press('T', 'KeyT', { metaKey: true, shiftKey: true }))).toBe('typewriter');
    expect(resolveShortcut(press('J', 'KeyJ', ctrlShift))).toBe('ghost');
    expect(resolveShortcut(press('d', 'KeyD', ctrl))).toBeNull();
    expect(resolveShortcut(press('t', 'KeyT', ctrl))).toBeNull();
  });
});

describe('commands', () => {
  it('guards editor commands and app actions', () => {
    expect(isEditorCommand('bold')).toBe(true);
    expect(isEditorCommand('save')).toBe(false);
    expect(isEditorCommand(null)).toBe(false);
    expect(isAppAction('save')).toBe(true);
    expect(isAppAction('bold')).toBe(false);
    expect(isAppAction(42)).toBe(false);
  });

  it('keeps command and action names distinct', () => {
    EDITOR_COMMANDS.forEach((command) => expect(isAppAction(command)).toBe(false));
    APP_ACTIONS.forEach((action) => expect(isEditorCommand(action)).toBe(false));
  });
});

describe('shortcut help', () => {
  it('lists every shortcut with keys and a label', () => {
    expect(SHORTCUTS.length).toBeGreaterThan(10);
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.keys.length).toBeGreaterThan(0);
      expect(shortcut.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('formats keys for macOS and other systems', () => {
    expect(formatKeys(['Mod', 'Shift', 'S'], true)).toEqual(['⌘', '⇧', 'S']);
    expect(formatKeys(['Mod', 'Alt', '1'], false)).toEqual(['Ctrl', 'Alt', '1']);
    expect(formatKeys(['Esc'], true)).toEqual(['esc']);
    expect(formatKeys([], false)).toEqual([]);
  });
});
