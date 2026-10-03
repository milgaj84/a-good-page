import { describe, expect, it } from 'vitest';
import { DocumentSession, type SessionSnapshot } from '../src/core/session';
import { FileChangedError, type ConflictChoice, type FileConflict, type OutsideState } from '../src/core/file-conflict';

function setup(initial = 'On disk') {
  const disk = new Map([['story.md', initial]]);
  const editor = { text: '', getMarkdown() { return this.text; }, setMarkdown(text: string) { this.text = text; }, focus() {} };
  const events: FileConflict[] = [];
  const states: SessionSnapshot[] = [];
  const outside: (OutsideState | null)[] = [];
  let unavailable = false;
  let choice: ConflictChoice = 'keep';
  let decide: ((info: FileConflict) => Promise<ConflictChoice>) | null = null;
  let savePath: string | null = null;
  let writes = 0;
  let attempts = 0;
  const session = new DocumentSession({
    editor: { getMarkdown: () => editor.text, setMarkdown: text => { editor.text = text; }, focus: () => {} },
    drafts: { load: () => null, save: () => {}, clear: () => {} },
    prompter: { confirmDiscard: async () => false },
    files: {
      pickOpenPath: async () => 'story.md', pickSavePath: async () => savePath,
      probe: async path => unavailable ? { kind: 'unreadable' } : disk.has(path)
        ? { kind: 'present', content: disk.get(path)! } : { kind: 'missing' },
      read: async path => {
        const content = disk.get(path);
        if (content === undefined) throw Error('missing');
        return { path, name: path, content };
      },
      write: async (path, content, expected) => {
        attempts++;
        const now = disk.get(path) ?? null;
        if (expected !== undefined && expected !== now) throw new FileChangedError(path);
        disk.set(path, content); writes++;
        return path;
      },
    },
    events: { onChange: s => states.push(s), onError: () => {}, onOutside: value => outside.push(value), onConflict: async data => { events.push(data); return decide ? decide(data) : choice; } },
  });
  return { session, disk, editor, events, states, outside, set unavailable(value: boolean) { unavailable = value; }, get writes() { return writes; }, get attempts() { return attempts; }, set choice(value: ConflictChoice) { choice = value; }, set decide(value: (info: FileConflict) => Promise<ConflictChoice>) { decide = value; }, set savePath(value: string | null) { savePath = value; } };
}

describe('conflict-aware session', () => {
  it('notices an outside edit before saving and does not open a modal automatically', async () => {
    const t = setup(); await t.session.open(); t.editor.text = 'My unsaved words'; t.session.markEdited(); t.disk.set('story.md', 'New outside text');
    expect(await t.session.checkOutside()).toMatchObject({ kind: 'changed', disk: 'New outside text' });
    expect(t.events).toHaveLength(0);
    expect(t.outside[t.outside.length - 1]).toMatchObject({ kind: 'changed' });
    expect(t.session.snapshot().state).toBe('error');
    expect(await t.session.autosave()).toBe(false);
  });
  it('distinguishes missing and unreadable files, and clears the notice on recovery', async () => {
    const t = setup(); await t.session.open(); t.unavailable = true;
    expect(await t.session.checkOutside()).toMatchObject({ kind: 'unreadable' });
    t.unavailable = false; t.disk.delete('story.md');
    expect(await t.session.checkOutside()).toMatchObject({ kind: 'missing' });
    t.disk.set('story.md', 'On disk');
    expect(await t.session.checkOutside()).toBeNull();
    expect(t.outside[t.outside.length - 1]).toBeNull();
  });
  it('rejects a stale review without losing the draft', async () => {
    const t = setup(); await t.session.open();
    t.editor.text = 'Draft'; t.session.markEdited(); t.disk.set('story.md', 'Outside one');
    await t.session.checkOutside();
    let finish: (choice: ConflictChoice) => void = () => undefined;
    t.decide = async () => new Promise(resolve => { finish = resolve; });
    const pending = t.session.reviewOutside();
    for (let n = 0; n < 5 && !t.events.length; n++) await new Promise(resolve => setTimeout(resolve, 0));
    t.disk.set('story.md', 'Outside two'); finish('reload');
    expect(await pending).toBe(false);
    expect(t.editor.text).toBe('Draft');
    expect(t.outside[t.outside.length - 1]).toMatchObject({ kind: 'changed', disk: 'Outside two' });
  });
  it('does not Save a copy from a stale review', async () => {
    const t = setup(); await t.session.open(); t.editor.text = 'Mine'; t.session.markEdited();
    t.disk.set('story.md', 'Outside one'); await t.session.checkOutside();
    let finish: (choice: ConflictChoice) => void = () => undefined;
    t.decide = async () => new Promise(resolve => { finish = resolve; });
    t.savePath = 'my-copy.md'; const pending = t.session.reviewOutside();
    for (let n = 0; n < 5 && !t.events.length; n++) await new Promise(resolve => setTimeout(resolve, 0));
    t.disk.set('story.md', 'Outside two'); finish('copy');
    expect(await pending).toBe(false);
    expect(t.disk.has('my-copy.md')).toBe(false);
    expect(t.editor.text).toBe('Mine');
  });
  it('keeps both edits on disk conflict and pauses autosave after Keep writing', async () => {
    const t = setup();
    await t.session.open();
    t.editor.text = 'My scene'; t.session.markEdited();
    t.disk.set('story.md', 'Outside scene');
    expect(await t.session.autosave()).toBe(false);
    expect(t.events[0]).toMatchObject({ mine: 'My scene', disk: 'Outside scene', deleted: false });
    expect(t.disk.get('story.md')).toBe('Outside scene');
    expect(t.session.snapshot().state).toBe('error');
    expect(await t.session.autosave()).toBe(false);
    expect(t.events).toHaveLength(1);
    expect(t.writes).toBe(0);
  });
  it('stops already queued autosaves once the first discovers a conflict', async () => {
    const t = setup();
    await t.session.open(); t.editor.text = 'My draft'; t.session.markEdited();
    t.disk.set('story.md', 'Edited outside');
    const first = t.session.autosave();
    const queued = t.session.autosave();
    expect(await first).toBe(false);
    expect(await queued).toBe(false);
    expect(t.attempts).toBe(1);
    expect(t.events).toHaveLength(1);
    expect(t.disk.get('story.md')).toBe('Edited outside');
  });
  it('reloads disk content only when the user chooses it', async () => {
    const t = setup(); t.choice = 'reload';
    await t.session.open(); t.editor.text = 'Mine'; t.session.markEdited();
    t.disk.set('story.md', 'Theirs');
    expect(await t.session.save()).toBe(true);
    expect(t.editor.text).toBe('Theirs');
    expect(t.session.isDirty).toBe(false);
    expect(t.writes).toBe(0);
  });
  it('saves my version to a separate new file without touching the outside edit', async () => {
    const t = setup(); t.choice = 'copy'; t.savePath = 'safe-copy.md';
    await t.session.open(); t.editor.text = 'Mine'; t.session.markEdited();
    t.disk.set('story.md', 'Theirs');
    expect(await t.session.save()).toBe(true);
    expect(t.disk.get('story.md')).toBe('Theirs');
    expect(t.disk.get('safe-copy.md')).toBe('Mine');
    expect(t.session.snapshot().path).toBe('safe-copy.md');
  });
  it('does not overwrite a pre-existing Save As target', async () => {
    const t = setup(); t.savePath = 'taken.md'; t.disk.set('taken.md', 'Someone else');
    await t.session.open(); t.editor.text = 'Mine'; t.session.markEdited();
    expect(await t.session.saveAs()).toBe(false);
    expect(t.disk.get('taken.md')).toBe('Someone else');
  });
  it('allows an explicit retry after Keep writing when the outside copy is restored', async () => {
    const t = setup(); await t.session.open(); t.editor.text = 'Mine'; t.session.markEdited();
    t.disk.set('story.md', 'Theirs'); expect(await t.session.save()).toBe(false);
    t.disk.set('story.md', 'On disk');
    expect(await t.session.save()).toBe(true);
    expect(t.disk.get('story.md')).toBe('Mine');
  });
  it('preserves fresh typing while the decision is open and waits before closing', async () => {
    const t = setup();
    let finish: (choice: ConflictChoice) => void = () => undefined;
    t.decide = async () => new Promise(resolve => { finish = resolve; });
    await t.session.open(); t.editor.text = 'My first edit'; t.session.markEdited();
    t.disk.set('story.md', 'Their edit');
    const saving = t.session.save();
    for (let n = 0; n < 5 && !t.events.length; n++) await new Promise(resolve => setTimeout(resolve, 0));
    expect(t.events).toHaveLength(1);
    let settled = false;
    const waiting = t.session.settleWrites().then(() => { settled = true; });
    await Promise.resolve(); expect(settled).toBe(false);
    t.editor.text = 'New words typed during review'; t.session.markEdited();
    finish('reload');
    expect(await saving).toBe(false);
    await waiting;
    expect(t.editor.text).toBe('New words typed during review');
    expect(t.disk.get('story.md')).toBe('Their edit');
  });
  it('does not recreate a deleted manuscript without an explicit new destination', async () => {
    const t = setup(); await t.session.open(); t.editor.text = 'Mine'; t.session.markEdited();
    t.disk.delete('story.md');
    expect(await t.session.autosave()).toBe(false);
    expect(t.events[0].deleted).toBe(true);
    expect(t.disk.has('story.md')).toBe(false);
  });
});
