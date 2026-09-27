import { FONTS, MAX_SIZE, MIN_SIZE, RHYTHMS, WIDTHS, type Preferences } from '../core/prefs';
import { Popover } from './popover';

export interface SettingsElements {
  root: HTMLElement;
  fontChoice: HTMLElement;
  widthChoice: HTMLElement;
  rhythmChoice: HTMLElement;
  sizeRange: HTMLInputElement;
  sizeValue: HTMLElement;
  goalInput: HTMLInputElement;
  toolbarCheck: HTMLInputElement;
  ghostCheck: HTMLInputElement;
  typewriterCheck: HTMLInputElement;
}

function choice<T extends string>(options: readonly T[], event: Event): T | null {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-value]');
  const value = button?.dataset.value;
  return value !== undefined && (options as readonly string[]).includes(value) ? (value as T) : null;
}

function markPressed(group: HTMLElement, value: string): void {
  group.querySelectorAll<HTMLButtonElement>('button[data-value]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.value === value));
  });
}

/** The "Aa" popover: typeface, size, column width, spacing, word goal and formatting bar. */
export class SettingsPanel {
  readonly popover: Popover;

  constructor(
    private readonly els: SettingsElements,
    private readonly trigger: HTMLElement,
    onChange: (patch: Partial<Preferences>) => void,
  ) {
    this.popover = new Popover(els.root, trigger);
    els.sizeRange.min = String(MIN_SIZE);
    els.sizeRange.max = String(MAX_SIZE);
    els.fontChoice.addEventListener('click', (event) => {
      const font = choice(FONTS, event);
      if (font) onChange({ font });
    });
    els.widthChoice.addEventListener('click', (event) => {
      const width = choice(WIDTHS, event);
      if (width) onChange({ width });
    });
    els.rhythmChoice.addEventListener('click', (event) => {
      const rhythm = choice(RHYTHMS, event);
      if (rhythm) onChange({ rhythm });
    });
    els.sizeRange.addEventListener('input', () => onChange({ size: Number(els.sizeRange.value) }));
    els.goalInput.addEventListener('input', () => onChange({ goal: Number(els.goalInput.value) || 0 }));
    els.toolbarCheck.addEventListener('change', () => onChange({ toolbar: els.toolbarCheck.checked }));
    els.ghostCheck.addEventListener('change', () => onChange({ ghost: els.ghostCheck.checked }));
    els.typewriterCheck.addEventListener('change', () => onChange({ typewriter: els.typewriterCheck.checked }));
  }

  render(prefs: Preferences): void {
    markPressed(this.els.fontChoice, prefs.font);
    markPressed(this.els.widthChoice, prefs.width);
    markPressed(this.els.rhythmChoice, prefs.rhythm);
    this.els.sizeRange.value = String(prefs.size);
    this.els.sizeValue.textContent = String(prefs.size);
    if (document.activeElement !== this.els.goalInput) {
      this.els.goalInput.value = prefs.goal > 0 ? String(prefs.goal) : '';
    }
    this.els.toolbarCheck.checked = prefs.toolbar;
    this.els.ghostCheck.checked = prefs.ghost;
    this.els.typewriterCheck.checked = prefs.typewriter;
  }

  toggle(): void {
    if (this.popover.isOpen) this.popover.close();
    else this.popover.show(this.trigger.getBoundingClientRect());
  }
}
