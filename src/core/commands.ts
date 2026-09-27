/** Every formatting command the editor understands, shared by toolbar, bubble and keyboard. */
export const EDITOR_COMMANDS = [
  'bold',
  'italic',
  'strike',
  'code',
  'paragraph',
  'h1',
  'h2',
  'h3',
  'bullet',
  'ordered',
  'task',
  'quote',
  'hr',
  'undo',
  'redo',
] as const;
export type EditorCommand = (typeof EDITOR_COMMANDS)[number];

export const TEXT_STYLES = ['paragraph', 'h1', 'h2', 'h3'] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

/** Application-level actions (files, panels, display). */
export const APP_ACTIONS = [
  'new',
  'open',
  'save',
  'saveAs',
  'exportPdf',
  'palette',
  'session',
  'find',
  'replace',
  'focus',
  'sentenceFocus',
  'fullScreen',
  'theme',
  'outline',
  'toolbar',
  'ghost',
  'typewriter',
  'zen',
  'settings',
  'help',
  'link',
  'bigger',
  'smaller',
  'resetSize',
  'measure',
  'rhythm',
  'typeface',
  'switcher',
  'reference',
  'timeMachine',
  'sprint',
  'polish',
  'escape',
] as const;
export type AppAction = (typeof APP_ACTIONS)[number];

export type Action = EditorCommand | AppAction;

function member<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

export function isEditorCommand(value: unknown): value is EditorCommand {
  return member(EDITOR_COMMANDS, value);
}

export function isAppAction(value: unknown): value is AppAction {
  return member(APP_ACTIONS, value);
}
