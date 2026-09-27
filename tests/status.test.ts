import { describe, expect, it } from 'vitest';
import { statusText } from '../src/core/status';
const base = { words: 0, selected: 0, characters: 0, goal: 0, section: null, filename: 'Untitled', save: 'saved' as const };
describe('contextual status', () => {
  it('describes an empty unsaved Markdown page', () => {
    expect(statusText(base)).toBe('0 characters · Markdown · Saved');
  });
  it('includes selection, goal, section and plain-text format', () => {
    expect(statusText({ ...base, words: 50, selected: 2, characters: 286, goal: 100, section: 'Chapter two', filename: 'chapter.txt', save: 'dirty' }))
      .toBe('2 selected · 286 characters · 50% of goal · Chapter two · Plain text · Editing');
  });
  it('caps goal display and surfaces write failures', () => {
    expect(statusText({ ...base, words: 200, goal: 1, save: 'error' })).toContain('100% of goal');
    expect(statusText({ ...base, save: 'saving' })).toContain('Saving…');
  });
});
