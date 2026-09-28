import { describe, expect, it } from 'vitest';
import { chapterInfo, manifest, moveChapter, orderFiles, safeChapter, searchProject } from '../src/core/project';

describe('whole manuscript project rules', () => {
  it('rejects traversal, absolute, duplicates, and unsupported paths', () => {
    for (const path of ['../escape.md', '/abs.md', 'a/../b.md', 'image.png', '']) expect(safeChapter(path)).toBe(false);
    expect(() => manifest({ version: 1, chapters: ['a.md','a.md'] })).toThrow();
    expect(() => manifest({ version: 9, chapters: [] })).toThrow();
  });
  it('keeps deliberate order, appends new chapters, and never renames them', () => {
    const old = manifest({ version: 1, chapters: ['b.md','a.md','gone.md'] });
    const next = orderFiles(['a.md','b.md','new.md'], old);
    expect(next.chapters).toEqual(['b.md','a.md','gone.md','new.md']);
    expect(moveChapter(next, 'a.md', -1).chapters).toEqual(['a.md','b.md','gone.md','new.md']);
    expect(moveChapter(next, 'b.md', -1)).toEqual(next);
  });
  it('counts words, headings, and all literal search occurrences across chapters', () => {
    const lf = String.fromCharCode(10);
    const a = chapterInfo('one.md', ['# Chapter one','','Morning fog','More fog'].join(lf));
    const b = chapterInfo('two.md', ['# Chapter two','Fog again'].join(lf));
    expect(a.headings[0].title).toBe('Chapter one');
    expect(a.words).toBeGreaterThan(3);
    expect(searchProject([a,b],'fog')).toHaveLength(3);
    expect(searchProject([a,b],'')).toEqual([]);
    expect(chapterInfo('notes.txt', '# not a heading').headings).toEqual([]);
  });
});
