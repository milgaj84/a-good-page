import type { Action, AppAction } from '../core/commands';

/** Actions that still work while the writer is typing in a text field (for example the palette's search box). */
const FROM_INPUTS: ReadonlySet<Action> = new Set<Action>(['escape', 'palette', 'switcher']);

export interface ShortcutDeps {
  resolve(event: KeyboardEvent): Action | null;
  closeLayers(): boolean;
  dispatch(action: Action): void;
}

/** Capture phase: A Good Page's shortcuts win over the editor's built-in ones, so nothing runs twice. */
export function bindShortcuts(target: Window, deps: ShortcutDeps): void {
  target.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    const action = deps.resolve(event);
    if (action === null) return;
    const origin = event.target as HTMLElement | null;
    if (!FROM_INPUTS.has(action) && origin?.closest('input, textarea, select, [contenteditable]') && !origin.closest('.ProseMirror')) return;
    if (action === 'escape') {
      if (deps.closeLayers()) { event.preventDefault(); event.stopPropagation(); }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    deps.dispatch(action);
  }, true);
}

export const BUTTONS: Readonly<Record<string, AppAction>> = {
  'btn-new': 'new', 'btn-open': 'open', 'btn-save': 'save', 'btn-pdf': 'exportPdf',
  'btn-palette': 'palette', 'btn-session': 'session', 'btn-find': 'find', 'btn-focus': 'focus',
  'btn-theme': 'theme', 'btn-outline': 'outline', 'btn-settings': 'settings', 'btn-help': 'help',
};

export function bindButtons(find: (id: string) => HTMLElement, run: (action: AppAction) => void): void {
  Object.entries(BUTTONS).forEach(([id, action]) => find(id).addEventListener('click', () => run(action)));
}
