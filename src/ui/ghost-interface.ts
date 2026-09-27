import { GhostChrome, isWritingKey } from '../core/ghost';
import { anchorLine, typewriterScroll } from '../core/typewriter';
import { ZenGuard, type ZenPort } from '../core/zen';

export interface LineBox {
  top: number;
  bottom: number;
}

export interface GhostDeps {
  win: Window;
  app: HTMLElement;
  editorEl: HTMLElement;
  scroller: HTMLElement;
  chrome: { typing(): void; awake(): void };
  caretLine(): LineBox | null;
  zenBadge: HTMLButtonElement;
  zenCheck: HTMLInputElement;
  isMac: boolean;
  now(): number;
  notify(message: string): void;
}

export interface GhostInterface {
  setGhost(on: boolean): void;
  setTypewriter(on: boolean): void;
  /** Centres the typing line when the typewriter is on; returns true when it handled caret placement. */
  anchor(): boolean;
  /** What the editor asks before removing text in Zen draft. */
  readonly zen: ZenPort;
  /** Turns Zen draft on or off (flips it when no value is given) and returns the new state. */
  toggleZen(on?: boolean): boolean;
}

/** Wires typing, pointer and Esc to the ghost chrome, keeps the typing line at mid-screen, and owns Zen draft. */
export function bindGhostInterface(deps: GhostDeps): GhostInterface {
  const ghost = new GhostChrome({ fade: (hidden) => (hidden ? deps.chrome.typing() : deps.chrome.awake()) });
  let typewriter = false;
  // Only keyboard moves re-centre: a click or drag-select should never yank the page away.
  let armed = false;
  deps.editorEl.addEventListener('keydown', (event) => {
    armed = true;
    if (isWritingKey(event)) ghost.input();
  });
  deps.editorEl.addEventListener('beforeinput', () => ghost.input());
  deps.editorEl.addEventListener('pointerdown', () => { armed = false; });
  deps.win.addEventListener('mousemove', (event) => ghost.pointer(event.clientX, event.clientY), { passive: true });
  deps.win.addEventListener('keydown', (event) => { if (event.key === 'Escape') ghost.escape(); }, true);
  const zen = new ZenGuard(deps.now, deps.notify, deps.isMac);
  const toggleZen = (on = !zen.enabled): boolean => {
    if (zen.enabled === on) return on;
    zen.set(on);
    deps.zenBadge.hidden = !on;
    deps.zenCheck.checked = on;
    deps.app.classList.toggle('zen-draft', on);
    deps.notify(on ? 'Zen draft on. Keep moving forward; Backspace and Delete are paused.' : 'Zen draft off. Editing is back.');
    return on;
  };
  deps.zenBadge.addEventListener('click', () => toggleZen(false));
  deps.zenCheck.addEventListener('change', () => toggleZen(deps.zenCheck.checked));

  const api: GhostInterface = {
    zen,
    toggleZen,
    setGhost: (on) => ghost.setEnabled(on),
    setTypewriter: (on) => {
      if (on === typewriter) return;
      typewriter = on;
      armed = on;
      deps.app.classList.toggle('typewriter', on);
      if (on) api.anchor();
    },
    anchor: () => {
      if (!typewriter) return false;
      if (!armed) return true;
      const line = deps.caretLine();
      if (line === null) return true;
      const s = deps.scroller;
      const box = s.getBoundingClientRect();
      const next = typewriterScroll({
        scrollTop: s.scrollTop,
        maxScroll: s.scrollHeight - s.clientHeight,
        caretMid: (line.top + line.bottom) / 2,
        anchorY: anchorLine(box.top, box.bottom, deps.win.innerHeight),
      });
      // Instant, like the focus-mode follow: smooth scrolling per keystroke would lag behind the words.
      if (next !== null) s.scrollTop = next;
      return true;
    },
  };
  return api;
}
