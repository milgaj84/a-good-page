import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeMachine } from '../src/ui/time-machine';
import type { Snapshot } from '../src/core/snapshots';

afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('Time Machine slider', () => {
  it('updates the label at once and parses a version only after the slider pauses', async () => {
    vi.useFakeTimers();
    const shown: string[] = [];
    const versions: Snapshot[] = ['one', 'two', 'three'].map((content, i) => ({ at: 1_000 * (i + 1), content, words: i + 1 }));
    const tm = new TimeMachine(document.body, {
      versions: async () => versions, captureCurrent: async () => 'now', restore() {}, exportCopy: async () => true,
      isPlain: () => false, documentName: () => 'Doc', createReader: () => ({ show: (c: string) => { shown.push(c); } }) as never,
      now: () => 10_000, notify() {},
    });
    await tm.open();
    expect(shown).toEqual(['three']); // first view is immediate
    const slider = document.querySelector('input.time-slider') as HTMLInputElement;
    for (const v of ['1', '0', '1']) { slider.value = v; slider.dispatchEvent(new Event('input')); }
    expect(document.querySelector('.time-when')!.textContent).toContain('2 of 3');
    expect(shown).toEqual(['three']);
    await vi.advanceTimersByTimeAsync(200);
    expect(shown).toEqual(['three', 'two']); // one parse for the burst, the last position
  });
});
