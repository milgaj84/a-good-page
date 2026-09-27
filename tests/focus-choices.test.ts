import { describe, expect, it } from 'vitest';
import { FocusChoices } from '../src/ui/focus-choices';
describe('focus modes', () => {
  it('switches paragraph and sentence without entering fullscreen', async () => {
    const calls: boolean[] = []; const seen: string[] = [];
    const choices = new FocusChoices({ set: async x => { calls.push(x); } }, x => seen.push(x));
    await choices.toggleParagraph(); await choices.set('sentence'); await choices.toggleParagraph();
    expect(seen).toEqual(['paragraph', 'sentence', 'paragraph']); expect(calls).toEqual([]);
  });
  it('restores window on exit, and does not commit failed fullscreen', async () => {
    const calls: boolean[] = [];
    const choices = new FocusChoices({ set: async x => { calls.push(x); if (x) throw Error('denied'); } }, () => undefined);
    await expect(choices.set('fullscreen')).rejects.toThrow('denied');
    expect(choices.mode).toBe('off'); expect(calls).toEqual([true]);
    const okay = new FocusChoices({ set: async x => { calls.push(x); } }, () => undefined);
    await okay.set('fullscreen'); await okay.set('off'); expect(calls.slice(-2)).toEqual([true, false]);
  });
});
