import { describe, expect, it } from 'vitest';
import { buildEdits, findInText, replaceMatches, searchFiles } from '../src/core/project-replace';

const loose = { matchCase: false, wholeWord: false };

describe('finding text in a page', () => {
  it('finds every occurrence with its line and a little context', () => {
    const text = 'The fog came in.\nMore fog, and then fog again.';
    const found = findInText(text, 'fog', loose);
    expect(found.map(m => [m.start, m.line])).toEqual([[4, 1], [22, 2], [36, 2]]);
    expect(found[1]).toMatchObject({ before: 'More ', hit: 'fog', after: ', and then fog again.' });
  });
  it('trims long lines with an ellipsis on the cut side', () => {
    const text = 'a'.repeat(80) + ' needle ' + 'b'.repeat(80);
    const [m] = findInText(text, 'needle', loose);
    expect(m.before.startsWith('…')).toBe(true);
    expect(m.after.endsWith('…')).toBe(true);
    expect(m.before.length).toBeLessThan(45);
  });
  it('can match case and whole words, including accented letters', () => {
    expect(findInText('Fog fog FOG', 'fog', { matchCase: true, wholeWord: false })).toHaveLength(1);
    expect(findInText('fog foggy fog_x', 'fog', { matchCase: false, wholeWord: true })).toHaveLength(1);
    expect(findInText('šuma šumarak', 'šuma', { matchCase: false, wholeWord: true })).toHaveLength(1);
    expect(findInText('Ćirilica ćirilica', 'ćirilica', loose)).toHaveLength(2);
  });
  it('treats the query as plain text, not a pattern, and ignores empty queries', () => {
    expect(findInText('a.b a+b (a)', '.', loose)).toHaveLength(1);
    expect(findInText('a+b', 'a+b', loose)).toHaveLength(1);
    expect(findInText('(a) [b]', '(a)', loose)).toHaveLength(1);
    expect(findInText('anything', '', loose)).toEqual([]);
  });
  it('stops at the limit', () => {
    expect(findInText('x '.repeat(1000), 'x', loose, 50)).toHaveLength(50);
  });
});

describe('replacing', () => {
  it('replaces the chosen matches only, keeping everything else byte for byte', () => {
    const text = '# Fog\n\nThe fog came. Fog again.\n';
    const found = findInText(text, 'fog', loose);
    expect(replaceMatches(text, found, 'mist')).toBe('# mist\n\nThe mist came. mist again.\n');
    expect(replaceMatches(text, [found[1]], 'mist')).toBe('# Fog\n\nThe mist came. Fog again.\n');
    expect(replaceMatches(text, found, '')).toBe('# \n\nThe  came.  again.\n');
    expect(replaceMatches(text, [], 'x')).toBe(text);
  });
  it('handles replacements of a different length and special characters', () => {
    const text = 'a cat, a cat.';
    expect(replaceMatches(text, findInText(text, 'cat', loose), '$& \\1 dog')).toBe('a $& \\1 dog, a $& \\1 dog.');
  });
});

describe('searching and editing many pages', () => {
  const files = [
    { path: '/lib/A/1.md', label: 'One', group: 'A', text: 'fog and Fog' },
    { path: '/lib/A/2.md', label: 'Two', group: 'A', text: 'clear skies' },
    { path: '/lib/B/3.md', label: 'Three', group: 'B', text: 'fog' },
  ];
  const key = (path: string, m: { start: number }) => path + '@' + m.start;
  it('lists only pages that have matches, and caps the total', () => {
    const results = searchFiles(files, 'fog', loose);
    expect(results.map(r => r.file.label)).toEqual(['One', 'Three']);
    expect(searchFiles(files, 'fog', loose, 500, 2).flatMap(r => r.matches)).toHaveLength(2);
  });
  it('builds one edit per page from the ticked matches', () => {
    const results = searchFiles(files, 'fog', loose);
    const all = new Set(results.flatMap(r => r.matches.map(m => key(r.file.path, m))));
    const edits = buildEdits(results, 'mist', all, key);
    expect(edits.map(e => [e.label, e.count, e.newText])).toEqual([['One', 2, 'mist and mist'], ['Three', 1, 'mist']]);
    all.delete(key('/lib/A/1.md', results[0].matches[1]));
    const some = buildEdits(results, 'mist', all, key);
    expect(some[0].newText).toBe('mist and Fog');
    expect(buildEdits(results, 'mist', new Set(), key)).toEqual([]);
  });
  it('makes no edit when replacing a word with itself', () => {
    const results = searchFiles(files, 'fog', { matchCase: true, wholeWord: false });
    const all = new Set(results.flatMap(r => r.matches.map(m => key(r.file.path, m))));
    expect(buildEdits(results, 'fog', all, key)).toEqual([]);
  });
});
