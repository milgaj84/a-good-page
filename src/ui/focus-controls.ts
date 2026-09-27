import { FocusChoices, type FocusChoice } from './focus-choices';
export interface FocusControls {
  app: HTMLElement; panel: HTMLElement; trigger: HTMLElement; exit: HTMLElement;
  focusButton: HTMLElement; setFullscreen(active: boolean): Promise<void>;
  setParagraphFocus(active: boolean): void; setSentenceFocus(active: boolean): void;
  centered(): void; notify(message: string): void;
}
/** Owns focus-mode buttons and error handling, leaving the manuscript untouched. */
export function bindFocusControls(els: FocusControls) {
  const choices = new FocusChoices({ set: els.setFullscreen }, (mode: FocusChoice) => {
    els.app.classList.toggle('sentence-focus', mode === 'sentence');
    els.app.classList.toggle('fullscreen-writing', mode === 'fullscreen');
    els.setParagraphFocus(mode === 'paragraph' || mode === 'sentence');
    els.setSentenceFocus(mode === 'sentence');
    els.exit.hidden = mode !== 'fullscreen';
    els.focusButton.textContent = mode === 'off' ? 'Focus' : mode === 'fullscreen' ? 'Full screen' : mode === 'sentence' ? 'Sentence' : 'Paragraph';
    closeMenu(); els.centered();
  });
  function closeMenu(): boolean {
    if (!els.panel.classList.contains('is-open')) return false;
    els.panel.classList.remove('is-open'); els.trigger.setAttribute('aria-expanded', 'false');
    return true;
  }
  async function choose(mode: FocusChoice): Promise<void> {
    try { await choices.set(mode); }
    catch (error) { els.notify('Could not change focus mode: ' + String(error)); }
  }
  els.panel.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-mode]');
    if (button && ['off', 'paragraph', 'sentence', 'fullscreen'].includes(button.dataset.mode ?? ''))
      void choose(button.dataset.mode as FocusChoice);
  });
  els.trigger.addEventListener('click', () => {
    const on = els.panel.classList.toggle('is-open'); els.trigger.setAttribute('aria-expanded', String(on));
  });
  els.exit.addEventListener('click', () => void choose('off'));
  return { choices, choose, closeMenu };
}
