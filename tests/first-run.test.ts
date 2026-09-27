import { describe, expect, it } from 'vitest';
import { FirstRunGuide, FIRST_RUN_KEY, guideSaveComplete } from '../src/core/first-run';
import type { KeyValueStore } from '../src/core/ports';
function store(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: key => data.get(key) ?? null, set: (key, value) => { data.set(key, value); }, remove: key => { data.delete(key); } };
}
describe('first-run guide', () => {
  it('does not finish Save when newer words remain unsaved', () => {
    expect(guideSaveComplete(true, true)).toBe(false);
    expect(guideSaveComplete(false, false)).toBe(false);
    expect(guideSaveComplete(true, false)).toBe(true);
  });
  it('offers a new user the create step and waits for successful actions', () => {
    const s = store(), guide = new FirstRunGuide(s);
    expect(guide.shouldOffer).toBe(true); expect(guide.step).toBe('create');
    expect(guide.next(false)).toBe('create');
    expect(guide.next(true)).toBe('save');
    expect(guide.next(true)).toBe('export');
    expect(guide.next(false)).toBe('export');
    expect(guide.next(true)).toBe('done');
    expect(s.get(FIRST_RUN_KEY)).toBe('done');
  });
  it('stays dismissed after restart but can be opened manually', () => {
    const s = store(); new FirstRunGuide(s).dismiss();
    const guide = new FirstRunGuide(s); expect(guide.shouldOffer).toBe(false);
    guide.restart(); expect(guide.step).toBe('create');
  });
});
