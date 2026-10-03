import type { Action } from './commands';

/** The subset of KeyboardEvent the keymap needs, so it can be tested without a DOM. */
export interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

const PLAIN_KEYS = new Map<string, Action>([
  ['n', 'new'],
  ['o', 'open'],
  ['p', 'palette'],
  ['s', 'save'],
  ['k', 'link'],
  ['f', 'find'],
  ['h', 'replace'],
  ['e', 'code'],
  ['b', 'bold'],
  ['i', 'italic'],
  ['z', 'undo'],
  ['y', 'redo'],
]);

/** Physical keys, so digits and punctuation work on every keyboard layout. */
const PLAIN_CODES = new Map<string, Action>([
  ['Equal', 'bigger'],
  ['NumpadAdd', 'bigger'],
  ['Minus', 'smaller'],
  ['NumpadSubtract', 'smaller'],
  ['Digit0', 'resetSize'],
  ['Numpad0', 'resetSize'],
  ['Slash', 'help'],
  ['Backslash', 'sidebar'],
]);

const SHIFT_KEYS = new Map<string, Action>([
  ['s', 'saveAs'],
  ['n', 'newProject'],
  ['e', 'exportPdf'],
  ['p', 'palette'],
  ['f', 'focus'],
  ['u', 'sentenceFocus'],
  ['g', 'fullScreen'],
  ['l', 'theme'],
  ['o', 'outline'],
  ['x', 'strike'],
  ['b', 'quote'],
  ['h', 'hr'],
  ['z', 'redo'],
  ['d', 'zen'],
  ['t', 'typewriter'],
  ['j', 'ghost'],
  ['m', 'measure'],
  ['k', 'rhythm'],
  ['y', 'typeface'],
  ['r', 'reference'],
  ['i', 'timeMachine'],
  ['a', 'sprint'],
  ['q', 'polish'],
]);

const SHIFT_CODES = new Map<string, Action>([
  ['Digit8', 'bullet'],
  ['Digit7', 'ordered'],
  ['Digit9', 'task'],
  ['Equal', 'bigger'],
  ['Slash', 'help'],
]);

const ALT_CODES = new Map<string, Action>([
  ['Digit0', 'paragraph'],
  ['Digit1', 'h1'],
  ['Digit2', 'h2'],
  ['Digit3', 'h3'],
  ['KeyF', 'findProject'],
]);

/** Latin letter for the key; falls back to the physical key on non-latin layouts (e.g. Cyrillic). */
function letterOf(key: string, code: string): string {
  if (/^[a-z]$/.test(key)) return key;
  const match = /^Key([A-Z])$/.exec(code);
  return match ? match[1].toLowerCase() : key;
}

/** Maps a key press to an action, or null when A Good Page should let the key through. */
export function resolveShortcut(event: KeyLike): Action | null {
  const key = (event.key ?? '').toLowerCase();
  const code = event.code ?? '';
  const mod = event.ctrlKey || event.metaKey;
  if (!mod) {
    if (event.shiftKey || event.altKey) return null;
    return key === 'escape' ? 'escape' : key === 'f2' ? 'rename' : null;
  }
  if (event.altKey) return event.shiftKey ? null : ALT_CODES.get(code) ?? null;
  const letter = letterOf(key, code);
  if (event.shiftKey) return SHIFT_CODES.get(code) ?? SHIFT_KEYS.get(letter) ?? null;
  return PLAIN_CODES.get(code) ?? PLAIN_KEYS.get(letter) ?? null;
}

export interface ShortcutHelp {
  keys: readonly string[];
  label: string;
}

export const SHORTCUTS: readonly ShortcutHelp[] = [
  { keys: ['Mod', 'N'], label: 'New page' },
  { keys: ['Mod', 'Shift', 'N'], label: 'New project' },
  { keys: ['F2'], label: 'Rename this page' },
  { keys: ['Mod', 'O'], label: 'Open a file from elsewhere' },
  { keys: ['Mod', 'S'], label: 'Save now (it also saves by itself)' },
  { keys: ['Mod', 'Shift', 'S'], label: 'Save a copy somewhere else' },
  { keys: ['Mod', 'B'], label: 'Bold' },
  { keys: ['Mod', 'I'], label: 'Italic' },
  { keys: ['Mod', 'Shift', 'X'], label: 'Strikethrough' },
  { keys: ['Mod', 'E'], label: 'Inline code' },
  { keys: ['Mod', 'K'], label: 'Add or edit a link' },
  { keys: ['Mod', 'Alt', '0'], label: 'Body text' },
  { keys: ['Mod', 'Alt', '1'], label: 'Title' },
  { keys: ['Mod', 'Alt', '2'], label: 'Heading' },
  { keys: ['Mod', 'Alt', '3'], label: 'Subheading' },
  { keys: ['Mod', 'Shift', '8'], label: 'Bullet list' },
  { keys: ['Mod', 'Shift', '7'], label: 'Numbered list' },
  { keys: ['Mod', 'Shift', '9'], label: 'Checklist' },
  { keys: ['Mod', 'Shift', 'B'], label: 'Quote' },
  { keys: ['Mod', 'Shift', 'H'], label: 'Scene break' },
  { keys: ['Mod', 'Shift', 'E'], label: 'Export PDF' },
  { keys: ['Mod', 'P'], label: 'Go to any page, or run any command' },
  { keys: ['Mod', 'Shift', 'P'], label: 'Go to any page, or run any command' },
  { keys: ['Mod', 'Shift', 'R'], label: 'Reference notes beside the page' },
  { keys: ['Mod', 'Shift', 'I'], label: 'Time Machine: earlier versions' },
  { keys: ['Mod', 'Shift', 'A'], label: 'Sprint goal ring' },
  { keys: ['Mod', 'Shift', 'Q'], label: 'Polish dashes, ellipses and quotes' },
  { keys: ['Mod', 'F'], label: 'Find in manuscript' },
  { keys: ['Mod', 'H'], label: 'Find and replace' },
  { keys: ['Mod', 'Alt', 'F'], label: 'Find and replace in many pages' },
  { keys: ['Mod', 'Z'], label: 'Undo' },
  { keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
  { keys: ['Mod', 'Shift', 'F'], label: 'Paragraph focus' },
  { keys: ['Mod', 'Shift', 'U'], label: 'Sentence focus' },
  { keys: ['Mod', 'Shift', 'G'], label: 'Full-screen writing' },
  { keys: ['Mod', 'Shift', 'L'], label: 'Change theme' },
  { keys: ['Mod', 'Shift', 'O'], label: 'On this page: headings' },
  { keys: ['Mod', 'Shift', 'T'], label: 'Typewriter line (keep typing at mid-screen)' },
  { keys: ['Mod', 'Shift', 'J'], label: 'Fade the bars while typing' },
  { keys: ['Mod', 'Shift', 'D'], label: 'Zen draft (pause Backspace and Delete)' },
  { keys: ['Mod', 'Shift', 'M'], label: 'Column width: Narrow, Comfortable, Wide' },
  { keys: ['Mod', 'Shift', 'K'], label: 'Spacing: Dense, Balanced, Spacious' },
  { keys: ['Mod', 'Shift', 'Y'], label: 'Typeface: Editorial serif, Humanist sans, Duospace' },
  { keys: ['Mod', '\\'], label: 'Show or hide the sidebar' },
  { keys: ['Mod', '='], label: 'Bigger text' },
  { keys: ['Mod', '-'], label: 'Smaller text' },
  { keys: ['Mod', '0'], label: 'Reset text size' },
  { keys: ['Mod', '/'], label: 'This list' },
  { keys: ['Esc'], label: 'Close panels, leave focus mode' },
];

const MAC_LABELS = new Map([
  ['Mod', '⌘'],
  ['Shift', '⇧'],
  ['Alt', '⌥'],
  ['Esc', 'esc'],
]);
const PC_LABELS = new Map([['Mod', 'Ctrl']]);

export function formatKeys(keys: readonly string[], isMac: boolean): string[] {
  const labels = isMac ? MAC_LABELS : PC_LABELS;
  return keys.map((key) => labels.get(key) ?? key);
}
