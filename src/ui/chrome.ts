import type { Scheduler } from '../core/debounce';
import type { GoalProgress } from '../core/goal';
import type { SaveState } from '../core/session';

export interface ChromeElements {
  app: HTMLElement;
  name: HTMLElement;
  saveDot: HTMLElement;
  stats: HTMLElement;
  detail: HTMLElement;
  focusButton: HTMLElement;
  themeButton: HTMLElement;
  toast: HTMLElement;
  goal: HTMLElement;
  goalFill: HTMLElement;
}

const STATE_LABELS: Record<SaveState, string> = {
  saved: 'All words saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Could not save',
};

/** The quiet UI around the page: it fades while you type and returns when you move the mouse. */
export class Chrome {
  private toastHandle: unknown = null;
  private celebrateHandle: unknown = null;
  private isTyping = false;

  constructor(
    private readonly els: ChromeElements,
    private readonly scheduler: Scheduler,
  ) {}

  // Called on every keystroke and mouse move: only touch the DOM when the state flips.
  typing(): void {
    if (this.isTyping) return;
    this.isTyping = true;
    this.els.app.classList.add('is-typing');
  }

  awake(): void {
    if (!this.isTyping) return;
    this.isTyping = false;
    this.els.app.classList.remove('is-typing');
  }

  setName(name: string): void {
    this.els.name.textContent = name;
  }

  setSaveState(state: SaveState): void {
    this.els.saveDot.dataset.state = state;
    this.els.saveDot.title = STATE_LABELS[state];
  }

  setDetail(text: string): void {
    this.els.detail.textContent = text;
  }

  setStats(text: string): void {
    this.els.stats.textContent = text;
  }

  setGoal(progress: GoalProgress | null): void {
    const { goal, goalFill } = this.els;
    goal.classList.toggle('is-visible', progress !== null);
    goal.classList.toggle('is-reached', progress?.reached ?? false);
    goalFill.style.transform = 'scaleX(' + (progress?.ratio ?? 0) + ')';
    goal.title = progress ? progress.label + ' words' : '';
  }

  celebrate(message: string): void {
    const app = this.els.app;
    app.classList.remove('celebrate');
    void app.offsetWidth; // restart the glow animation
    app.classList.add('celebrate');
    if (this.celebrateHandle !== null) this.scheduler.clear(this.celebrateHandle);
    this.celebrateHandle = this.scheduler.set(() => {
      app.classList.remove('celebrate');
      this.celebrateHandle = null;
    }, 1800);
    this.toast(message, 4200);
  }

  setFocus(on: boolean): void {
    this.els.app.classList.toggle('focus-mode', on);
    this.els.focusButton.setAttribute('aria-pressed', String(on));
  }

  setThemeLabel(label: string): void {
    this.els.themeButton.textContent = label;
  }

  toast(message: string, durationMs = 2600): void {
    this.els.toast.textContent = message;
    this.els.toast.classList.add('is-visible');
    if (this.toastHandle !== null) this.scheduler.clear(this.toastHandle);
    this.toastHandle = this.scheduler.set(() => {
      this.els.toast.classList.remove('is-visible');
      this.toastHandle = null;
    }, durationMs);
  }
}
