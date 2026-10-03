import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_TAB_KEY, SettingsPanel, asTab } from '../src/ui/settings';

const html = readFileSync('index.html', 'utf8');
const drawer = /<aside class="drawer" id="settings"[\s\S]*?<\/aside>/.exec(html)![0];
const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

function build(): { panel: SettingsPanel; trigger: HTMLButtonElement } {
  document.body.innerHTML = '<button id="btn-settings"></button>' + drawer;
  const trigger = el<HTMLButtonElement>('btn-settings');
  const panel = new SettingsPanel(
    { root: el('settings'), close: el('settings-close'), themeChoice: el('theme-choice'), fontChoice: el('font-choice'), widthChoice: el('width-choice'),
      rhythmChoice: el('rhythm-choice'), sizeRange: el<HTMLInputElement>('size-range'), sizeValue: el('size-value'), goalInput: el<HTMLInputElement>('goal-input'),
      toolbarCheck: el<HTMLInputElement>('toolbar-check'), ghostCheck: el<HTMLInputElement>('ghost-check'), typewriterCheck: el<HTMLInputElement>('typewriter-check'),
      libraryPath: el('library-path'), libraryChange: el('library-change') },
    trigger, () => undefined, () => undefined, () => undefined,
  );
  return { panel, trigger };
}
const visible = () => [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter(p => !p.hidden).map(p => p.id);

describe('Settings drawer sections', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('shows one section at a time and starts on Look', () => {
    const { panel } = build();
    expect(panel.tab).toBe('look');
    expect(visible()).toEqual(['panel-look']);
    expect(el('tab-look').getAttribute('aria-selected')).toBe('true');
    expect(el('tab-writing').getAttribute('aria-selected')).toBe('false');
  });

  it('switches by click and remembers the choice for next time', () => {
    build();
    el('tab-focus').click();
    expect(visible()).toEqual(['panel-focus']);
    expect(window.localStorage.getItem(SETTINGS_TAB_KEY)).toBe('focus');
    expect(build().panel.tab).toBe('focus');
  });

  it('moves between sections with the arrow keys, wrapping at the ends', () => {
    const { panel } = build();
    const key = (k: string) => el('tab-look').parentElement!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key('ArrowLeft'); expect(panel.tab).toBe('library');
    key('ArrowRight'); expect(panel.tab).toBe('look');
    key('End'); expect(panel.tab).toBe('library');
    key('Home'); expect(panel.tab).toBe('look');
  });

  it('ignores an unknown remembered section and keeps every setting in exactly one section', () => {
    window.localStorage.setItem(SETTINGS_TAB_KEY, 'nonsense');
    expect(build().panel.tab).toBe('look');
    expect(asTab(7)).toBe('look');
    for (const id of ['theme-choice', 'font-choice', 'size-range', 'width-choice', 'rhythm-choice', 'indent-check', 'toolbar-check', 'spell-check', 'lang-choice', 'goal-input',
      'ghost-check', 'typewriter-check', 'zen-check', 'library-change', 'backup-now', 'backup-mode', 'effects-choice', 'btn-help']) {
      expect(document.getElementById(id)?.closest('[role="tabpanel"]'), id).not.toBeNull();
    }
  });

  it('opens on the section you were using and gives it focus', () => {
    const { panel } = build();
    panel.select('writing', false);
    panel.open();
    expect(document.activeElement?.id).toBe('tab-writing');
  });
});
