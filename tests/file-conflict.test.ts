import { describe, expect, it } from 'vitest';
import { compareParagraphs, FileChangedError, protectReload, conflictCopy } from '../src/core/file-conflict';
describe('outside edits', () => {
  it('keeps both texts and marks missing disk separately', () => {
    const blank = String.fromCharCode(10, 10);
    expect(compareParagraphs('One' + blank + 'Mine', 'One' + blank + 'Theirs')).toEqual({ mine: ['One', 'Mine'], disk: ['One', 'Theirs'] });
    expect(compareParagraphs('', null)).toEqual({ mine: [''], disk: [] });
    expect(new FileChangedError('story.md').path).toBe('story.md');
  });
  it('distinguishes a changed manuscript, an unavailable file and an occupied copy destination', () => {
    expect(conflictCopy({ deleted: false, canReload: true, disk: 'Other edit' }).title).toBe('This file changed elsewhere');
    expect(conflictCopy({ deleted: true, canReload: false, disk: null }).message).toContain('could not be found or read');
    expect(conflictCopy({ deleted: false, canReload: false, disk: 'Existing copy' }).title).toBe('That filename is already in use');
  });
  it('blocks Reload on storage failure and does not capture for Keep', async () => {
    let calls = 0;
    expect(await protectReload('keep', async () => { calls++; })).toBe('keep');
    expect(calls).toBe(0);
    await expect(protectReload('reload', async () => { throw new Error('snapshot unavailable'); })).rejects.toThrow('snapshot unavailable');
    expect(await protectReload('reload', async () => { calls++; })).toBe('reload');
    expect(calls).toBe(1);
  });
});
