import { describe, expect, it } from 'vitest';
import { DocumentSession, simplifiesMarkdown } from '../src/core/session';

function setup(initial = 'On disk', serialize: (md: string) => string = (md) => md) {
  const disk = new Map([['story.md', initial]]);
  const editor = { text: '', raw: '' };
  const kept: Array<[string, string]> = [];
  const resolved: string[] = [];
  const errors: string[] = [];
  const simplified: string[] = [];
  let failWrite = false;
  const session = new DocumentSession({
    editor: { getMarkdown: () => serialize(editor.text), setMarkdown: (t) => { editor.text = t; editor.raw = t; }, focus() {} },
    drafts: { load: () => null, save: () => {}, clear: () => {} },
    prompter: { confirmDiscard: async () => false },
    files: {
      pickOpenPath: async () => 'story.md', pickSavePath: async () => null,
      probe: async (p) => (disk.has(p) ? { kind: 'present', content: disk.get(p)! } : { kind: 'missing' }),
      read: async (path) => ({ path, name: path, content: disk.get(path)! }),
      write: async (path, content) => { if (failWrite) throw new Error('disk full'); disk.set(path, content); return path; },
    },
    events: {
      onChange() {}, onError: (m) => errors.push(m), onResolved: (m) => resolved.push(m),
      onKeepVersion: (p, c) => kept.push([p, c]), onSimplified: (p) => simplified.push(p),
    },
  });
  return { session, disk, editor, kept, resolved, errors, simplified, set failWrite(v: boolean) { failWrite = v; } };
}

describe('clean page changed on disk', () => {
  it('reloads silently, keeps the old version and says so once', async () => {
    const t = setup(); await t.session.open();
    t.disk.set('story.md', 'Changed outside');
    expect(await t.session.checkOutside()).toBeNull();
    expect(t.editor.text).toBe('Changed outside');
    expect(t.kept).toEqual([['story.md', 'On disk']]);
    expect(t.resolved).toHaveLength(1);
    expect(t.session.snapshot().state).toBe('saved');
  });
  it('a page with unsaved words still gets the conflict path, not a reload', async () => {
    const t = setup(); await t.session.open();
    t.editor.text = 'mine'; t.session.markEdited(); t.disk.set('story.md', 'Changed outside');
    expect(await t.session.checkOutside()).toMatchObject({ kind: 'changed' });
    expect(t.editor.text).toBe('mine');
    expect(t.resolved).toHaveLength(0);
  });
});

describe('repeated autosave failures', () => {
  it('toast on the first failure and then rarely, and again after a success', async () => {
    const t = setup(); await t.session.open();
    t.failWrite = true;
    for (let i = 0; i < 6; i++) { t.editor.text = 'x' + i; t.session.markEdited(); await t.session.autosave(); }
    expect(t.errors).toHaveLength(2); // 1st and 5th
    t.failWrite = false; t.editor.text = 'ok'; t.session.markEdited(); await t.session.autosave();
    t.failWrite = true; t.editor.text = 'again'; t.session.markEdited(); await t.session.autosave();
    expect(t.errors).toHaveLength(3);
  });
  it('an explicit save always reports', async () => {
    const t = setup(); await t.session.open(); t.failWrite = true;
    t.editor.text = 'a'; t.session.markEdited();
    await t.session.save(); await t.session.save();
    expect(t.errors).toHaveLength(2);
  });
});

describe('files the editor would simplify', () => {
  it('keeps the original and flags it when the serialised form loses content', async () => {
    const original = '| a | b |\n|---|---|\n| 1 | 2 |\n';
    const t = setup(original, () => 'ab12'); await t.session.open();
    expect(t.session.simplified).toBe(true);
    expect(t.kept).toEqual([['story.md', original]]);
    expect(t.simplified).toEqual(['story.md']);
  });
  it('does not fire for ordinary differences in whitespace, line endings, blank lines or list markers', async () => {
    const original = '# Title\r\n\r\nSome text.  \r\n\r\n\r\n* one\r\n* two\r\n';
    const t = setup(original, () => '# Title\n\nSome text.\n\n- one\n- two'); await t.session.open();
    expect(t.session.simplified).toBe(false);
    expect(t.kept).toEqual([]);
  });
  it('detects the usual losses', () => {
    expect(simplifiesMarkdown('Look ![a](b.png) here.', 'Look here.')).toBe(true);
    expect(simplifiesMarkdown('<div>x</div>', '&lt;div&gt;x&lt;/div&gt;')).toBe(true);
    expect(simplifiesMarkdown('one\nwrapped', 'one wrapped')).toBe(true);
    expect(simplifiesMarkdown('***', '---')).toBe(false);
  });
});
