import { describe, expect, it } from 'vitest';
import { BUTTONS, bindShortcuts } from '../src/app/shortcuts';
import type { Action } from '../src/core/commands';

type Listener = (event: KeyboardEvent) => void;

function harness(action: Action | null, layerOpen = false) {
  let listener: Listener | null = null;
  let capture = false;
  const dispatched: Action[] = [];
  const target = { addEventListener: (_: string, fn: Listener, useCapture: boolean) => { listener = fn; capture = useCapture; } };
  bindShortcuts(target as unknown as Window, { resolve: () => action, closeLayers: () => layerOpen, dispatch: (a) => dispatched.push(a) });
  const press = (within: string | null, composing = false) => {
    const state = { prevented: false, stopped: false };
    const origin = { closest: (selector: string) => (within !== null && selector.split(', ').includes(within) ? {} : null) };
    const event = { isComposing: composing, target: origin, preventDefault: () => { state.prevented = true; }, stopPropagation: () => { state.stopped = true; } };
    listener!(event as unknown as KeyboardEvent);
    return state;
  };
  return { press, dispatched, capture: () => capture };
}

describe('global shortcuts', () => {
  it('listens in the capture phase and dispatches a resolved action once', () => {
    const h = harness('palette');
    const state = h.press('.ProseMirror');
    expect(h.capture()).toBe(true);
    expect(h.dispatched).toEqual(['palette']);
    expect(state.prevented).toBe(true);
  });
  it('opens the go-to box even from a text field', () => {
    const h = harness('palette');
    h.press('input');
    expect(h.dispatched).toEqual(['palette']);
  });
  it('leaves other shortcuts to text fields outside the page', () => {
    const h = harness('polish');
    const state = h.press('input');
    expect(h.dispatched).toEqual([]);
    expect(state.prevented).toBe(false);
  });
  it('ignores keys while an input method is composing', () => {
    const h = harness('timeMachine');
    h.press(null, true);
    expect(h.dispatched).toEqual([]);
  });
  it('lets Escape through when no layer was open', () => {
    const closed = harness('escape', false).press(null);
    expect(closed.prevented).toBe(false);
    const open = harness('escape', true).press(null);
    expect(open.prevented).toBe(true);
  });
  it('maps every toolbar button to one action', () => {
    expect(BUTTONS['btn-new']).toBe('new');
    expect(BUTTONS['btn-pdf']).toBe('exportPdf');
    expect(new Set(Object.keys(BUTTONS)).size).toBe(Object.keys(BUTTONS).length);
  });
});
