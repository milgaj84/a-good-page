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
  toolbarCheck: HTMLInputElement;
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

export const SETTINGS_TABS = ['look', 'writing', 'focus', 'library'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
export const SETTINGS_TAB_KEY = 'agp.settings.tab.v1';
export const asTab = (value: unknown): SettingsTab => ((SETTINGS_TABS as readonly unknown[]).includes(value) ? (value as SettingsTab) : 'look');

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
    this.tabs = [...els.root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    for (const tab of this.tabs) tab.addEventListener('click', () => this.select(asTab(tab.dataset.tab), true));
    els.root.querySelector('[role="tablist"]')?.addEventListener('keydown', (event) => this.tabKey(event as KeyboardEvent));
    let remembered: unknown = null;
    try { remembered = window.localStorage.getItem(SETTINGS_TAB_KEY); } catch { /* the first tab is fine */ }
    this.select(asTab(remembered), false);
    els.sizeRange.min = String(MIN_SIZE);
    els.sizeRange.max = String(MAX_SIZE);
    els.close.addEventListener('click', () => this.close(true));
    els.themeChoice.addEventListener('click', (event) => { const theme = choice(THEMES, event); if (theme) onTheme(theme); });
    els.fontChoice.addEventListener('click', (event) => { const font = choice(FONTS, event); if (font) onChange({ font }); });
    els.widthChoice.addEventListener('click', (event) => { const width = choice(WIDTHS, event); if (width) onChange({ width }); });
    els.rhythmChoice.addEventListener('click', (event) => { const rhythm = choice(RHYTHMS, event); if (rhythm) onChange({ rhythm }); });
    els.sizeRange.addEventListener('input', () => onChange({ size: Number(els.sizeRange.value) }));
    els.goalInput.addEventListener('input', () => onChange({ goal: Number(els.goalInput.value) || 0 }));
    els.toolbarCheck.addEventListener('change', () => onChange({ toolbar: els.toolbarCheck.checked }));
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

  private readonly tabs: HTMLButtonElement[];
  private current: SettingsTab = 'look';

  get tab(): SettingsTab { return this.current; }

  /** Shows one section of the settings. The choice is remembered for next time. */
  select(tab: SettingsTab, focus: boolean): void {
    this.current = tab;
    for (const button of this.tabs) {
      const on = button.dataset.tab === tab;
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
      if (panel) panel.hidden = !on;
      if (on && focus) button.focus();
    }
    this.els.root.scrollTop = 0;
    try { window.localStorage.setItem(SETTINGS_TAB_KEY, tab); } catch { /* not remembered */ }
  }

  private tabKey(event: KeyboardEvent): void {
    const at = SETTINGS_TABS.indexOf(this.current);
    const to = event.key === 'ArrowRight' ? at + 1 : event.key === 'ArrowLeft' ? at - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? SETTINGS_TABS.length - 1 : null;
    if (to === null) return;
    event.preventDefault();
    this.select(SETTINGS_TABS[(to + SETTINGS_TABS.length) % SETTINGS_TABS.length], true);
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
    this.els.toolbarCheck.checked = prefs.toolbar;
    this.els.ghostCheck.checked = prefs.ghost;
    this.els.typewriterCheck.checked = prefs.typewriter;
    this.els.libraryPath.textContent = libraryPath ?? 'No Library folder yet';
  }

  open(): void {
    this.els.root.classList.add('is-open');
    this.els.root.setAttribute('aria-hidden', 'false');
    this.trigger.setAttribute('aria-expanded', 'true');
    (this.tabs.find(t => t.dataset.tab === this.current) ?? this.els.close).focus();
  }

  close(restoreFocus = false): void {
    if (!this.isOpen) return;
    const hadFocus = this.els.root.contains(document.activeElement);
    this.els.root.classList.remove('is-open');
    this.els.root.setAttribute('aria-hidden', 'true');
    this.trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && hadFocus) this.trigger.focus();
  }

  toggle(): void { if (this.isOpen) this.close(true); else this.open(); }
}
