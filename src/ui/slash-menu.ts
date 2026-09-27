import type { EditorCommand } from '../core/commands';
import type { Anchor } from '../core/placement';
import { placePopover } from '../core/placement';

/** A slash is a command only at the start of an empty paragraph. */
export function shouldOpenSlash(text: string, from: number, to: number, blockType: string, blockLength: number): boolean {
  return text === '/' && from === to && blockType === 'paragraph' && blockLength === 0;
}

export const SLASH_ACTIONS: readonly { label: string; command: EditorCommand; description: string }[] = [
  { label: 'Body text', command: 'paragraph', description: 'A fresh paragraph' },
  { label: 'Title', command: 'h1', description: 'Main title' },
  { label: 'Heading', command: 'h2', description: 'Start a section' },
  { label: 'Subheading', command: 'h3', description: 'Add a smaller section' },
  { label: 'Bullet list', command: 'bullet', description: 'A simple list' },
  { label: 'Numbered list', command: 'ordered', description: 'Steps in order' },
  { label: 'Checklist', command: 'task', description: 'Items to tick off' },
  { label: 'Quote', command: 'quote', description: 'Set off a passage' },
  { label: 'Scene break', command: 'hr', description: 'A pause between scenes' },
];

/** Slash at the start of an empty paragraph opens a menu without inserting markup. */
export class SlashMenu {
  private index = 0;
  constructor(private readonly root: HTMLElement, private readonly run: (command: EditorCommand) => void) {
    root.setAttribute('aria-hidden', 'true');
    SLASH_ACTIONS.forEach(({ label, command, description }, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.index = String(i);
      button.setAttribute('aria-label', label); button.title = description;
      const title = document.createElement('strong'); title.textContent = label;
      const hint = document.createElement('small'); hint.textContent = description;
      button.append(title, hint);
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => { this.close(); this.run(command); });
      root.append(button);
    });
    document.addEventListener('mousedown', event => {
      if (this.isOpen && !root.contains(event.target as Node)) this.close();
    });
  }
  get isOpen(): boolean { return this.root.classList.contains('is-open'); }
  open(anchor: Anchor): void {
    this.index = 0;
    this.root.classList.add('is-open'); this.root.setAttribute('aria-hidden', 'false');
    const bounds = this.root.getBoundingClientRect();
    const position = placePopover(anchor, { width: bounds.width || 230, height: bounds.height || 330 },
      { width: window.innerWidth, height: window.innerHeight });
    this.root.style.left = position.left + 'px'; this.root.style.top = position.top + 'px';
    this.highlight();
  }
  close(): void { this.root.classList.remove('is-open'); this.root.setAttribute('aria-hidden', 'true'); }
  handle(event: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    if (event.key === 'Escape') { this.close(); return true; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      this.index = (this.index + (event.key === 'ArrowDown' ? 1 : -1) + SLASH_ACTIONS.length) % SLASH_ACTIONS.length;
      this.highlight(); return true;
    }
    if (event.key === 'Enter') { const command = SLASH_ACTIONS[this.index].command; this.close(); this.run(command); return true; }
    return false;
  }
  private highlight(): void {
    this.root.querySelectorAll<HTMLButtonElement>('button').forEach((button, i) => button.setAttribute('aria-selected', String(i === this.index)));
  }
}
