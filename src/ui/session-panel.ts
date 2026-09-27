import { WritingSession, type SessionSnapshot } from '../core/writing-session';
import { DialogFocus } from './dialog-focus';

export interface SessionElements {
  root: HTMLElement; minutes: HTMLInputElement; target: HTMLInputElement;
  setup: HTMLElement; running: HTMLElement; summary: HTMLElement;
  clock: HTMLElement; progress: HTMLElement; message: HTMLElement; error: HTMLElement;
  start: HTMLButtonElement; stop: HTMLButtonElement; done: HTMLButtonElement;
  badge: HTMLElement; badgeText: HTMLElement;
}

function time(seconds: number): string {
  const m = Math.floor(seconds / 60); const s = seconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/** Session state is independent of the document; no manuscript text is stored here. */
export class SessionPanel {
  private ticker: ReturnType<typeof setInterval> | null = null;
  private readonly focus: DialogFocus;
  private lastWords = 0;
  private lastSummary = false;
  constructor(private readonly els: SessionElements, private readonly model: WritingSession,
    private readonly countWords: () => number, private readonly onStart: () => void,
    private readonly onFinish: (message: string) => void) {
    this.focus = new DialogFocus(els.root);
    els.root.tabIndex = -1;
    els.root.setAttribute('aria-hidden', 'true');
    els.start.addEventListener('click', () => this.start());
    els.stop.addEventListener('click', () => this.stop());
    els.done.addEventListener('click', () => this.close());
    els.root.addEventListener('mousedown', (event) => { if (event.target === els.root) this.close(); });
  }
  get isOpen(): boolean { return this.els.root.classList.contains('is-open'); }
  get isActive(): boolean { return this.model.active; }
  open(): void {
    this.els.root.classList.add('is-open'); this.els.root.setAttribute('aria-hidden', 'false');
    this.show(this.model.active ? 'running' : this.lastSummary ? 'summary' : 'setup');
    this.focus.open(this.model.active ? this.els.stop : this.lastSummary ? this.els.done : this.els.minutes);
    if (this.model.active) this.update();
  }
  close(): void {
    this.els.root.classList.remove('is-open'); this.els.root.setAttribute('aria-hidden', 'true');
    this.focus.close();
  }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  start(): void {
    const minutes = Number(this.els.minutes.value);
    const target = this.els.target.value.trim() === '' ? 0 : Number(this.els.target.value);
    try { this.model.start(minutes, target, this.countWords()); }
    catch (error) { this.els.error.textContent = error instanceof Error ? error.message : 'Check the session settings.'; return; }
    this.els.error.textContent = ''; this.lastSummary = false;
    this.show('running'); this.update(); this.close(); this.onStart();
    if (this.ticker !== null) clearInterval(this.ticker);
    this.ticker = setInterval(() => this.update(), 1000);
  }
  update(): void {
    if (!this.model.active) return;
    this.lastWords = this.countWords();
    const state = this.model.snapshot(this.lastWords);
    if (!state) return;
    this.els.clock.textContent = time(state.remainingSeconds);
    this.els.badgeText.textContent = time(state.remainingSeconds) + ' · ' + state.wordsWritten + ' words';
    this.els.progress.style.width = (state.progress * 100) + '%';
    this.els.badge.hidden = false;
    if (state.finished) this.finish(state, true);
  }
  stop(): void {
    const state = this.model.stop(this.countWords());
    if (state) this.finish(state, false);
  }
  /** Switching documents stops the sprint so words from two manuscripts are never mixed. */
  documentChanged(): void {
    if (!this.model.active) return;
    const state = this.model.stop(this.countWords());
    if (state) this.finish(state, false, false);
  }
  private finish(state: SessionSnapshot, timedOut: boolean, showDialog = true): void {
    if (this.ticker !== null) { clearInterval(this.ticker); this.ticker = null; }
    this.els.badge.hidden = true;
    const written = state.wordsWritten;
    const goal = state.targetWords ? ' of ' + state.targetWords + ' target words' : ' words';
    const summary = written + goal + ' in ' + Math.max(1, Math.ceil(state.elapsedSeconds / 60)) + ' min';
    this.els.message.textContent = (timedOut ? 'Time is up. ' : 'Session ended. ') + summary + '. A little progress is still progress.';
    this.lastSummary = showDialog;
    if (showDialog) { this.show('summary'); this.open(); }
    else if (this.isOpen) this.close();
    this.onFinish(summary);
  }
  private show(mode: 'setup' | 'running' | 'summary'): void {
    this.els.setup.hidden = mode !== 'setup'; this.els.running.hidden = mode !== 'running';
    this.els.summary.hidden = mode !== 'summary';
  }
}
