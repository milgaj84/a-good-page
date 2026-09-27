import { describe, expect, it } from 'vitest';
import { collectWorkspaceFiles, searchSwitcher, switcherEntries, type ListFolder } from '../src/core/quick-switch';

const headings = [
  { level: 1, text: 'Part One', pos: 0 },
  { level: 2, text: 'The Harbour', pos: 40 },
  { level: 3, text: '', pos: 90 },
];
const files = [
  { name: 'harbour-notes.md', path: '/book/notes/harbour-notes.md', folder: 'notes' },
  { name: 'draft.md', path: '/book/draft.md', folder: '' },
];

describe('quick switcher entries', () => {
  it('lists named chapters first, then documents, and skips empty headings', () => {
    const entries = switcherEntries(headings, files, '/book/draft.md');
    expect(entries.map((e) => e.label)).toEqual(['Part One', 'The Harbour', 'harbour-notes', 'draft']);
    expect(entries[1]).toEqual({ kind: 'chapter', label: 'The Harbour', detail: 'Heading', level: 2, pos: 40 });
    expect(entries[2].detail).toBe('notes');
    expect(entries[3].detail).toBe('Open now');
  });
  it('finds chapters and documents with one fuzzy query', () => {
    const entries = switcherEntries(headings, files, null);
    const found = searchSwitcher('harb', entries);
    expect(found.map((e) => e.label).sort()).toEqual(['The Harbour', 'harbour-notes'].sort());
    expect(searchSwitcher('zzz', entries)).toEqual([]);
    expect(searchSwitcher('', entries, 2)).toHaveLength(2);
  });
  it('can find a document by its folder name', () => {
    const entries = switcherEntries([], files, null);
    expect(searchSwitcher('notes harb', entries)[0].label).toBe('harbour-notes');
  });
});

describe('collecting workspace documents', () => {
  const tree: Record<string, { name: string; path: string; is_dir: boolean }[]> = {
    '/book': [
      { name: 'notes', path: '/book/notes', is_dir: true },
      { name: 'draft.md', path: '/book/draft.md', is_dir: false },
      { name: 'cover.png', path: '/book/cover.png', is_dir: false },
    ],
    '/book/notes': [
      { name: 'deep', path: '/book/notes/deep', is_dir: true },
      { name: 'ideas.txt', path: '/book/notes/ideas.txt', is_dir: false },
    ],
    '/book/notes/deep': [{ name: 'far.md', path: '/book/notes/deep/far.md', is_dir: false }],
  };
  const list: ListFolder = async (root, directory) => ({ root, directory: directory ?? root, entries: tree[directory ?? root] ?? [] });

  it('walks folders breadth first and keeps only writing files', async () => {
    const found = await collectWorkspaceFiles(list, '/book');
    expect(found.files.map((f) => f.path)).toEqual(['/book/draft.md', '/book/notes/ideas.txt', '/book/notes/deep/far.md']);
    expect(found.files[1].folder).toBe('notes');
    expect(found.files[2].folder).toBe('notes/deep');
    expect(found.truncated).toBe(false);
  });
  it('stops at the depth, folder and file limits and says so', async () => {
    expect((await collectWorkspaceFiles(list, '/book', { maxDepth: 1 })).files).toHaveLength(2);
    const few = await collectWorkspaceFiles(list, '/book', { maxFiles: 1 });
    expect(few.files).toHaveLength(1);
    expect(few.truncated).toBe(true);
    expect((await collectWorkspaceFiles(list, '/book', { maxFolders: 1 })).truncated).toBe(true);
  });
  it('skips folders that cannot be read instead of failing the whole list', async () => {
    const flaky: ListFolder = async (root, directory) => {
      if (directory === '/book/notes') throw new Error('denied');
      return list(root, directory);
    };
    expect((await collectWorkspaceFiles(flaky, '/book')).files.map((f) => f.name)).toEqual(['draft.md']);
  });
});
