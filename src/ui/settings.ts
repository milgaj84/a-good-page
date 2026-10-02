import { FONTS, MAX_SIZE, MIN_SIZE, RHYTHMS, WIDTHS, type Preferences } from '../core/prefs';
import { THEMES, type Theme } from '../core/theme';

export interface SettingsElements {
  root: HTMLElement;
  close: HTMLElement;
  themeChoice: HTMLElement;
  fontChoice: HTMLElement;
  widthChoice: HTMLElement;
  rhythmChoice: HTMLElement;
  sizeRange: HTMLInputElement;
  sizeValue: HTMLElement;
  goalInput: HTMLInputElement;
  ghostCheck: HTMLInputElement;
  typewriterCheck: HTMLInputElement;
  libraryPath: HTMLElement;
  libraryChange: HTMLElement;
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

/** One panel for everything that is a preference. It slides in from the right and never blocks the page. */
export class SettingsPanel {
  constructor(
    private readonly els: SettingsElements,
    private readonly trigger: HTMLElement,
    onChange: (patch: Partial<Preferences>) => void,
    onTheme: (theme: Theme) => void,
    onChangeLibrary: () => void,
  ) {
    els.root.setAttribute('aria-hidden', 'true');
    els.sizeRange.min = String(MIN_SIZE);
    els.sizeRange.max = String(MAX_SIZE);
    els.close.addEventListener('click', () => this.close());
    els.themeChoice.addEventListener('click', (event) => { const theme = choice(THEMES, event); if (theme) onTheme(theme); });
    els.fontChoice.addEventListener('click', (event) => { const font = choice(FONTS, event); if (font) onChange({ font }); });
    els.widthChoice.addEventListener('click', (event) => { const width = choice(WIDTHS, event); if (width) onChange({ width }); });
    els.rhythmChoice.addEventListener('click', (event) => { const rhythm = choice(RHYTHMS, event); if (rhythm) onChange({ rhythm }); });
    els.sizeRange.addEventListener('input', () => onChange({ size: Number(els.sizeRange.value) }));
    els.goalInput.addEventListener('input', () => onChange({ goal: Number(els.goalInput.value) || 0 }));
    els.ghostCheck.addEventListener('change', () => onChange({ ghost: els.ghostCheck.checked }));
    els.typewriterCheck.addEventListener('change', () => onChange({ typewriter: els.typewriterCheck.checked }));
    els.libraryChange.addEventListener('click', onChangeLibrary);
    document.addEventListener('mousedown', (event) => {
      if (!this.isOpen) return;
      const target = event.target as Node;
      if (els.root.contains(target) || trigger.contains(target)) return;
      this.close();
    });
  }

  get isOpen(): boolean { return this.els.root.classList.contains('is-open'); }

  render(prefs: Preferences, theme: Theme, libraryPath: string | null): void {
    markPressed(this.els.themeChoice, theme);
    markPressed(this.els.fontChoice, prefs.font);
    markPressed(this.els.widthChoice, prefs.width);
    markPressed(this.els.rhythmChoice, prefs.rhythm);
    this.els.sizeRange.value = String(prefs.size);
    this.els.sizeValue.textContent = String(prefs.size);
    if (document.activeElement !== this.els.goalInput) this.els.goalInput.value = prefs.goal > 0 ? String(prefs.goal) : '';
    this.els.ghostCheck.checked = prefs.ghost;
    this.els.typewriterCheck.checked = prefs.typewriter;
    this.els.libraryPath.textContent = libraryPath ?? 'No Library folder yet';
  }

  open(): void {
    this.els.root.classList.add('is-open');
    this.els.root.setAttribute('aria-hidden', 'false');
    this.trigger.setAttribute('aria-expanded', 'true');
    this.els.close.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.els.root.classList.remove('is-open');
    this.els.root.setAttribute('aria-hidden', 'true');
    this.trigger.setAttribute('aria-expanded', 'false');
  }

  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
}
