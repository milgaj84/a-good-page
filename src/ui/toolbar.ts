import {
  TEXT_STYLES,
  isAppAction,
  isEditorCommand,
  type Action,
  type TextStyle,
} from '../core/commands';

/** What the buttons need to know about the editor; injected so the UI stays decoupled. */
export interface CommandState {
  isActive(name: string): boolean;
  can(name: string): boolean;
  textStyle(): TextStyle | null;
}

const TOGGLES = new Set([
  'bold', 'italic', 'strike', 'code', 'h1', 'h2', 'h3',
  'bullet', 'ordered', 'task', 'quote', 'link',
]);

/** Wires every button with a data-cmd attribute inside a container (top bar or bubble). */
export class CommandButtons {
  private readonly buttons: HTMLButtonElement[];

  constructor(
    root: HTMLElement,
    private readonly state: CommandState,
    dispatch: (action: Action) => void,
  ) {
    this.buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-cmd]'));
    // Keep the writer's selection: buttons never steal focus from the page.
    root.addEventListener('mousedown', (event) => {
      if ((event.target as HTMLElement).closest('button')) event.preventDefault();
    });
    root.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-cmd]');
      const cmd = button?.dataset.cmd;
      if (isEditorCommand(cmd) || isAppAction(cmd)) dispatch(cmd);
    });
  }

  sync(): void {
    for (const button of this.buttons) {
      const cmd = button.dataset.cmd ?? '';
      if (TOGGLES.has(cmd)) {
        const on = this.state.isActive(cmd);
        button.classList.toggle('is-active', on);
        button.setAttribute('aria-pressed', String(on));
      }
      button.disabled = !this.state.can(cmd);
    }
  }
}

/** The Body / Title / Heading / Subheading dropdown. */
export class StyleSelect {
  constructor(
    private readonly select: HTMLSelectElement,
    private readonly state: CommandState,
    dispatch: (action: Action) => void,
  ) {
    select.addEventListener('change', () => {
      const style = TEXT_STYLES.find((candidate) => candidate === select.value);
      if (style) dispatch(style);
    });
  }

  sync(): void {
    const value = this.state.textStyle() ?? '';
    if (this.select.value !== value) this.select.value = value;
  }
}
