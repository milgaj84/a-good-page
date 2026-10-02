import { describe, expect, it } from 'vitest';
import { PLACES, chapterSelection, nextStep, placeShortcut, saveWords, shareSteps, type BookState } from '../src/core/workflow';

const book = (over: Partial<BookState> = {}): BookState => ({
  place: 'write', save: 'saved', named: true, folder: true, loaded: true,
  chapters: 3, blocking: 0, selected: 3, preview: 'none', ...over,
});
const key = (code: string, over: Record<string, boolean> = {}) =>
  ({ key: '', code, ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, ...over });

describe('0.3.0 places', () => {
  it('has exactly three stable places with unique shortcuts', () => {
    expect(PLACES.map(p => p.place)).toEqual(['chapters', 'write', 'share']);
    expect(new Set(PLACES.map(p => p.digit)).size).toBe(3);
  });
  it('maps Ctrl/Cmd+Shift+1..3 by physical key and ignores other combinations', () => {
    expect(placeShortcut(key('Digit1'))).toBe('chapters');
    expect(placeShortcut(key('Digit2', { ctrlKey: false, metaKey: true }))).toBe('write');
    expect(placeShortcut(key('Digit3'))).toBe('share');
    expect(placeShortcut(key('Digit4'))).toBe(null);
    expect(placeShortcut(key('Digit1', { shiftKey: false }))).toBe(null);
    expect(placeShortcut(key('Digit1', { altKey: true }))).toBe(null);
    expect(placeShortcut(key('Digit1', { ctrlKey: false }))).toBe(null);
  });
});

describe('next step', () => {
  it('puts a failed save above everything else', () => {
    expect(nextStep(book({ save: 'error', folder: false, blocking: 2 })).action).toBe('save');
  });
  it('guides an empty start: folder, then chapters, then a first chapter', () => {
    expect(nextStep(book({ folder: false })).action).toBe('chooseFolder');
    expect(nextStep(book({ loaded: false })).action).toBe('openChapters');
    expect(nextStep(book({ chapters: 0 })).action).toBe('newChapter');
  });
  it('sends blocking chapter problems to Chapters with a plural-aware title', () => {
    expect(nextStep(book({ blocking: 1 })).title).toBe('Fix 1 chapter');
    const step = nextStep(book({ blocking: 2, place: 'share' }));
    expect(step.title).toBe('Fix 2 chapters');
    expect(step.place).toBe('chapters');
  });
  it('asks to name an unsaved untitled draft', () => {
    expect(nextStep(book({ named: false, save: 'dirty' })).action).toBe('save');
    expect(nextStep(book({ named: false, save: 'saved' })).action).toBe('write');
  });
  it('walks Share in order: choose, save, refresh, read, export', () => {
    const share = { place: 'share' as const };
    expect(nextStep(book({ ...share, selected: 0 })).action).toBe('chooseChapters');
    expect(nextStep(book({ ...share, save: 'dirty' })).action).toBe('save');
    expect(nextStep(book({ ...share, save: 'saving' })).action).toBe('save');
    expect(nextStep(book({ ...share, preview: 'stale' })).action).toBe('refreshPreview');
    expect(nextStep(book({ ...share, preview: 'none' })).detail).toContain('3 chapters ticked');
    expect(nextStep(book({ ...share, selected: 1 })).detail).toContain('1 chapter ticked');
    expect(nextStep(book({ ...share, preview: 'ready' })).action).toBe('export');
  });
  it('keeps writing as the calm default', () => {
    expect(nextStep(book()).action).toBe('write');
    expect(nextStep(book({ place: 'chapters' })).title).toBe('Pick a chapter');
    expect(nextStep(book({ place: 'chapters' })).action).toBe('openChapter');
    expect(nextStep(book({ named: false })).detail).toContain('kept on this device');
  });
});

describe('share steps', () => {
  it('starts on choosing when nothing is ticked', () => {
    expect(shareSteps({ blocking: 0, selected: 0, preview: 'none', save: 'saved' }).map(s => s.mark)).toEqual(['current', 'todo', 'todo']);
  });
  it('moves to reading, then export', () => {
    expect(shareSteps({ blocking: 0, selected: 2, preview: 'none', save: 'saved' }).map(s => s.mark)).toEqual(['done', 'current', 'todo']);
    expect(shareSteps({ blocking: 0, selected: 2, preview: 'ready', save: 'saved' }).map(s => s.mark)).toEqual(['done', 'done', 'current']);
  });
  it('blocks export while the open chapter is not saved', () => {
    for (const save of ['dirty', 'saving', 'error'] as const) {
      expect(shareSteps({ blocking: 0, selected: 2, preview: 'ready', save }).map(s => s.mark))
        .toEqual(['done', 'done', 'blocked']);
    }
    expect(shareSteps({ blocking: 0, selected: 2, preview: 'ready', save: 'saved' }).map(s => s.mark))
      .toEqual(['done', 'done', 'current']);
    expect(shareSteps({ blocking: 0, selected: 2, preview: 'none', save: 'dirty' }).map(s => s.mark))
      .toEqual(['done', 'current', 'todo']);
    expect(shareSteps({ blocking: 0, selected: 2, preview: 'stale', save: 'dirty' }).map(s => s.mark))
      .toEqual(['done', 'blocked', 'todo']);
  });
  it('shows blocked steps for chapter problems and stale pages', () => {
    expect(shareSteps({ blocking: 1, selected: 2, preview: 'ready', save: 'saved' }).map(s => s.mark)).toEqual(['blocked', 'todo', 'todo']);
    expect(shareSteps({ blocking: 0, selected: 2, preview: 'stale', save: 'saved' }).map(s => s.mark)).toEqual(['done', 'blocked', 'todo']);
  });
});

describe('save words', () => {
  it('says what is happening in plain language', () => {
    expect(saveWords('saved', true)).toBe('Saved');
    expect(saveWords('saved', false)).toBe('Kept on this device');
    expect(saveWords('dirty', true)).toBe('Saving soon');
    expect(saveWords('dirty', false)).toBe('Not saved yet');
    expect(saveWords('saving', true)).toBe('Saving…');
    expect(saveWords('error', false)).toBe('Save failed · press Save');
  });
});

describe('0.3.1 chapter selection', () => {
  it('preserves a deliberate empty selection on a same-folder refresh', () => {
    expect([...chapterSelection(['a.md', 'b.md'], ['a.md', 'b.md'], new Set(), true)]).toEqual([]);
  });
  it('keeps only readable selections in book order on refresh', () => {
    expect([...chapterSelection(['b.md', 'a.md', 'gone.md'], ['b.md', 'a.md'], new Set(['a.md', 'gone.md', 'b.md']), true)]).toEqual(['b.md', 'a.md']);
  });
  it('starts a different folder with its readable chapters despite matching relative paths', () => {
    expect([...chapterSelection(['a.md', 'b.md'], ['b.md'], new Set(['a.md']), false)]).toEqual(['b.md']);
  });
});
