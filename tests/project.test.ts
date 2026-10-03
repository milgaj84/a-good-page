import { describe, expect, it } from 'vitest';
import { fold } from '../src/core/paths';
import { fuzzyMatch } from '../src/core/fuzzy';
import { savedAsNotice, nextName } from '../src/core/library';
import { chapterInfo, manifest, moveChapter, orderFiles, safeChapter, searchProject } from '../src/core/project';

describe('whole manuscript project rules', () => {
  it('allows up to 2000 chapters and no more', () => {
    const many = Array.from({ length: 2000 }, (_, i) => 'c' + i + '.md');
    expect(manifest({ version: 1, chapters: many }).chapters).toHaveLength(2000);
    expect(orderFiles(many, null).chapters).toHaveLength(2000);
    expect(() => orderFiles([...many, 'x.md'], null)).toThrow();
  });
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

describe('search snippets', () => {
  it('keeps the match in view in a long paragraph', () => {
    const line = 'x'.repeat(400) + ' the lighthouse ' + 'y'.repeat(400);
    const [hit] = searchProject([chapterInfo('a.md', line)], 'lighthouse');
    expect(hit.context).toContain('lighthouse');
    expect(hit.context.length).toBeLessThan(260);
    expect(hit.context.startsWith('…') && hit.context.endsWith('…')).toBe(true);
  });
  it('leaves a short line whole', () => {
    expect(searchProject([chapterInfo('a.md', 'A short lighthouse line.')], 'light')[0].context).toBe('A short lighthouse line.');
  });
});

describe('accent-insensitive matching', () => {
  it('folds one character at a time, so indexes stay aligned', () => {
    expect(fold('Što Žuč Ćevap Đak Café')).toBe('sto zuc cevap dak cafe');
    expect(fold('Š').length).toBe(1);
  });
  it('finds što by sto and keeps the original text in the snippet', () => {
    const [hit] = searchProject([chapterInfo('a.md', 'Reci mi, ŠTO je to?')], 'sto');
    expect(hit.context).toBe('Reci mi, ŠTO je to?');
    expect(searchProject([chapterInfo('a.md', 'café')], 'cafe')).toHaveLength(1);
    expect(searchProject([chapterInfo('a.md', 'Đurđa i čaj')], 'durda')).toHaveLength(1);
    expect(searchProject([chapterInfo('a.md', 'Đurđa i čaj')], 'durd')).toHaveLength(1);
    expect(searchProject([chapterInfo('a.md', 'kaša')], 'kasa')).toHaveLength(1);
  });
  it('numbers occurrences across lines', () => {
    const hits = searchProject([chapterInfo('a.md', 'fog fog\nnone\nfog')], 'fog');
    expect(hits.map(h => [h.line, h.occurrence])).toEqual([[1, 0], [3, 2]]);
  });
  it('the palette matcher ignores accents too', () => {
    expect(fuzzyMatch('sto', 'Što je to')).not.toBeNull();
  });
});

describe('name notices', () => {
  it('explains changed names and stays quiet otherwise', () => {
    expect(savedAsNotice('Chapter 3: Fog', 'Chapter 3- Fog')).toBe('Saved as “Chapter 3- Fog” because file names cannot contain :.');
    expect(savedAsNotice('  Chapter   3 ', 'Chapter 3')).toBeNull();
    expect(savedAsNotice('Draft.md', 'Draft')).toBeNull();
    expect(nextName('Draft')).toBe('Draft 2');
    expect(nextName('Draft 2')).toBe('Draft 3');
  });
});
