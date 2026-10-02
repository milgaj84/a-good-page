import { describe, expect, it } from 'vitest';
import { autoRenameTarget, autoTitle, bookOf, filterRows, isAutoName, joinPath, relativeTo, rootRows } from '../src/core/library';
import { moveChapterTo, renameInOrder } from '../src/core/project';

describe('automatic page names', () => {
  it('recognises only placeholder names', () => {
    expect(isAutoName('Untitled')).toBe(true);
    expect(isAutoName('Untitled 12')).toBe(true);
    expect(isAutoName('Untitled draft')).toBe(false);
    expect(isAutoName('Chapter One')).toBe(false);
  });
  it('titles a page from its first heading or first line', () => {
    expect(autoTitle('# The Fog\n\nIt rained.')).toBe('The Fog');
    expect(autoTitle('\n\nIt rained all night, and nobody came.')).toBe('It rained all night, and nobody came');
    expect(autoTitle('> **Bold** [link](http://x) text')).toBe('Bold link text');
    expect(autoTitle('---\n\n- first item')).toBe('first item');
    expect(autoTitle('   \n\n')).toBeNull();
  });
  it('shortens long first lines at a word', () => {
    const t = autoTitle('word '.repeat(40), 50)!;
    expect(t.length).toBeLessThanOrEqual(50);
    expect(t.endsWith(' ')).toBe(false);
  });
  it('renames only untouched placeholders and never to another placeholder', () => {
    expect(autoRenameTarget('Untitled', '# Harbour\n')).toBe('Harbour');
    expect(autoRenameTarget('My story', '# Harbour\n')).toBeNull();
    expect(autoRenameTarget('Untitled 2', '')).toBeNull();
    expect(autoRenameTarget('Untitled', 'Untitled 3')).toBeNull();
  });
});

describe('library paths', () => {
  it('joins and relates paths on either separator style', () => {
    expect(joinPath('/lib', 'book/a.md')).toBe('/lib/book/a.md');
    expect(joinPath('C:\\lib', 'book/a.md')).toBe('C:\\lib\\book\\a.md');
    expect(relativeTo('/lib', '/lib/book/a.md')).toBe('book/a.md');
    expect(relativeTo('/lib', '/other/a.md')).toBeNull();
    expect(relativeTo('/lib', '/library2/a.md')).toBeNull();
  });
  it('finds the book a page belongs to', () => {
    expect(bookOf('/lib', '/lib/Novel/01.md')).toBe('/lib/Novel');
    expect(bookOf('/lib', '/lib/Novel/part/01.md')).toBe('/lib/Novel');
    expect(bookOf('/lib', '/lib/Loose.md')).toBeNull();
    expect(bookOf('/lib', '/elsewhere/x.md')).toBeNull();
  });
  it('lists books and pages without hidden items', () => {
    const rows = rootRows([
      { name: 'Novel', path: '/lib/Novel', is_dir: true },
      { name: '.trash', path: '/lib/.trash', is_dir: true },
      { name: 'Loose.md', path: '/lib/Loose.md', is_dir: false },
    ]);
    expect(rows).toEqual([
      { kind: 'book', name: 'Novel', path: '/lib/Novel' },
      { kind: 'page', name: 'Loose', path: '/lib/Loose.md' },
    ]);
    expect(filterRows(rows, 'LOO').map(r => r.name)).toEqual(['Loose']);
  });
});

describe('book order edits', () => {
  const order = { version: 1 as const, chapters: ['a.md', 'b.md', 'c.md', 'd.md'] };
  it('moves a chapter to an exact place in one step', () => {
    expect(moveChapterTo(order, 'a.md', 2).chapters).toEqual(['b.md', 'c.md', 'a.md', 'd.md']);
    expect(moveChapterTo(order, 'd.md', 0).chapters).toEqual(['d.md', 'a.md', 'b.md', 'c.md']);
    expect(moveChapterTo(order, 'b.md', 1)).toBe(order);
    expect(moveChapterTo(order, 'x.md', 1)).toBe(order);
    expect(moveChapterTo(order, 'a.md', 99).chapters[3]).toBe('a.md');
  });
  it('keeps a renamed chapter in place', () => {
    expect(renameInOrder(order, 'b.md', 'beta.md').chapters).toEqual(['a.md', 'beta.md', 'c.md', 'd.md']);
    expect(renameInOrder(order, 'b.md', 'c.md')).toBe(order);
    expect(renameInOrder(order, 'zz.md', 'q.md')).toBe(order);
  });
});
