import { beforeEach, describe, expect, it } from 'vitest';
import {
  DocumentSession,
  describeError,
  type DraftStore,
  type EditorPort,
  type FileGateway,
  type OpenedDocument,
  type Prompter,
  type SessionSnapshot,
} from '../src/core/session';
import { nameFromPath } from '../src/core/paths';
import { FileChangedError } from '../src/core/file-conflict';

class FakeEditor implements EditorPort {
  md = '';
  focusCount = 0;
  getMarkdown() { return this.md; }
  getPlainText() { return this.md.replace(/\*\*/g, ''); }
  setMarkdown(markdown: string) { this.md = markdown; }
  setPlainText(text: string) { this.md = text; }
  focus() { this.focusCount += 1; }
}

class FakeDrafts implements DraftStore {
  value: string | null = null;
  load() { return this.value; }
  save(markdown: string) { this.value = markdown; }
  clear() { this.value = null; }
}

class FakeFiles implements FileGateway {
  disk = new Map<string, string>();
  openPath: string | null = null;
  savePath: string | null = null;
  failWrite: unknown = null;
  gate: Promise<void> | null = null;
  suggested: string[] = [];
  writes = 0;

  async pickOpenPath() { return this.openPath; }
  async pickSavePath(suggestedName: string) {
    this.suggested.push(suggestedName);
    return this.savePath;
  }
  async read(path: string): Promise<OpenedDocument> {
    const content = this.disk.get(path);
    if (content === undefined) throw 'Could not access the file: missing';
    return { path, name: nameFromPath(path), content };
  }
  async write(path: string, content: string, expected?: string | null) {
    if (this.gate) await this.gate;
    if (this.failWrite !== null) throw this.failWrite;
    const finalPath = /\.(md|markdown|txt)$/i.test(path) ? path : path + '.md';
    if (expected !== undefined && (this.disk.get(finalPath) ?? null) !== expected) throw new FileChangedError(finalPath);
    this.disk.set(finalPath, content);
    this.writes += 1;
    return finalPath;
  }
}

class FakePrompter implements Prompter {
  answer = true;
  asked = 0;
  async confirmDiscard() {
    this.asked += 1;
    return this.answer;
  }
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let editor: FakeEditor;
let drafts: FakeDrafts;
let files: FakeFiles;
let prompter: FakePrompter;
let changes: SessionSnapshot[];
let errors: string[];
let session: DocumentSession;

beforeEach(() => {
  editor = new FakeEditor();
  drafts = new FakeDrafts();
  files = new FakeFiles();
  prompter = new FakePrompter();
  changes = [];
  errors = [];
  session = new DocumentSession({
    editor,
    files,
    prompter,
    drafts,
    events: { onChange: (s) => changes.push(s), onError: (m) => errors.push(m) },
  });
});

async function openNamed(path = 'story.md', content = 'Chapter one') {
  files.disk.set(path, content);
  files.openPath = path;
  expect(await session.open()).toBe(true);
}

describe('DocumentSession: new and untitled', () => {
  it('starts untitled and saved', () => {
    expect(session.snapshot()).toEqual({ path: null, name: 'Untitled', state: 'saved' });
    expect(session.isDirty).toBe(false);
  });

  it('keeps a draft of untitled edits', () => {
    editor.md = 'Hello';
    session.markEdited();
    expect(drafts.value).toBe('Hello');
    expect(session.snapshot().state).toBe('dirty');
    expect(changes.length).toBeGreaterThan(0);
  });

  it('save on untitled asks for a path and cancelling changes nothing', async () => {
    editor.md = 'Hello';
    session.markEdited();
    files.savePath = null;
    expect(await session.save()).toBe(false);
    expect(files.suggested).toEqual(['Untitled.md']);
    expect(files.writes).toBe(0);
    expect(session.isDirty).toBe(true);
  });

  it('save on untitled writes, names the document and clears the draft', async () => {
    editor.md = 'Hello';
    session.markEdited();
    files.savePath = 'story';
    expect(await session.save()).toBe(true);
    expect(session.snapshot()).toEqual({ path: 'story.md', name: 'story', state: 'saved' });
    expect(files.disk.get('story.md')).toBe('Hello');
    expect(drafts.value).toBeNull();
  });

  it('autosave never prompts for untitled documents', async () => {
    editor.md = 'Hello';
    session.markEdited();
    expect(await session.autosave()).toBe(false);
    expect(files.suggested).toEqual([]);
  });
});

describe('DocumentSession: named documents', () => {
  it('opens a file and focuses the editor', async () => {
    await openNamed();
    expect(editor.md).toBe('Chapter one');
    expect(session.snapshot()).toEqual({ path: 'story.md', name: 'story', state: 'saved' });
    expect(editor.focusCount).toBe(1);
  });

  it('does not write drafts for named files', async () => {
    await openNamed();
    editor.md = 'Edited';
    session.markEdited();
    expect(drafts.value).toBeNull();
  });

  it('autosaves only when dirty', async () => {
    await openNamed();
    expect(await session.autosave()).toBe(false);
    editor.md = 'More words';
    session.markEdited();
    expect(await session.autosave()).toBe(true);
    expect(files.disk.get('story.md')).toBe('More words');
    expect(session.isDirty).toBe(false);
  });

  it('reports write failures and recovers on the next save', async () => {
    await openNamed();
    editor.md = 'x';
    session.markEdited();
    files.failWrite = new Error('disk full');
    expect(await session.save()).toBe(false);
    expect(errors).toEqual(['disk full']);
    expect(session.snapshot().state).toBe('error');
    expect(session.isDirty).toBe(true);
    files.failWrite = null;
    expect(await session.save()).toBe(true);
    expect(session.snapshot().state).toBe('saved');
  });

  it('settleWrites waits for in-flight autosave before deciding whether to quit', async () => {
    await openNamed();
    let release: () => void = () => undefined;
    files.gate = new Promise<void>(resolve => { release = resolve; });
    editor.md = 'Final paragraph'; session.markEdited();
    const writing = session.autosave();
    await tick();
    let settled = false;
    const waiting = session.settleWrites().then(() => { settled = true; });
    await tick();
    expect(settled).toBe(false);
    release(); await writing; await waiting;
    expect(settled).toBe(true);
    expect(files.disk.get('story.md')).toBe('Final paragraph');
    expect(session.isDirty).toBe(false);
  });

  it('settleWrites returns after a failed autosave and leaves words dirty', async () => {
    await openNamed();
    let release: () => void = () => undefined;
    files.gate = new Promise<void>(resolve => { release = resolve; });
    files.failWrite = new Error('disk full');
    editor.md = 'Do not lose this'; session.markEdited();
    const writing = session.autosave(); await tick();
    const waiting = session.settleWrites();
    release(); await writing; await waiting;
    expect(session.isDirty).toBe(true);
    expect(session.snapshot().state).toBe('error');
    expect(errors).toContain('disk full');
  });

  it('captures each queued save at request time, not when its turn begins', async () => {
    await openNamed();
    let release: () => void = () => undefined;
    files.gate = new Promise<void>(resolve => { release = resolve; });
    editor.md = 'first'; session.markEdited();
    const first = session.save();
    editor.md = 'second'; session.markEdited();
    const second = session.save();
    editor.md = 'third'; session.markEdited();
    await tick(); release();
    expect(await first).toBe(true); expect(await second).toBe(true);
    expect(files.disk.get('story.md')).toBe('second');
    expect(session.isDirty).toBe(true);
    files.gate = null;
    expect(await session.save()).toBe(true);
    expect(files.disk.get('story.md')).toBe('third');
  });

  it('does not let a queued old-path autosave undo Save As', async () => {
    await openNamed('old.md', 'Original');
    files.savePath = 'new.md';
    let release: () => void = () => undefined;
    files.gate = new Promise<void>(resolve => { release = resolve; });
    editor.md = 'Revised'; session.markEdited();
    const saveAs = session.saveAs();
    await tick(); // save dialog resolves and Save As enters the write queue
    const oldAutosave = session.autosave();
    await tick(); release();
    expect(await saveAs).toBe(true);
    expect(await oldAutosave).toBe(false);
    expect(session.snapshot()).toEqual({ path: 'new.md', name: 'new', state: 'saved' });
    expect(files.disk.get('new.md')).toBe('Revised');
    expect(files.disk.get('old.md')).toBe('Original');
  });

  it('keeps a newer untitled draft when edits arrive during its first save', async () => {
    let release: () => void = () => undefined;
    files.gate = new Promise<void>(resolve => { release = resolve; });
    files.savePath = 'story.md'; editor.md = 'first'; session.markEdited();
    const save = session.save(); await tick();
    editor.md = 'first and more'; session.markEdited();
    release(); expect(await save).toBe(true);
    expect(session.isDirty).toBe(true);
    expect(drafts.value).toBe('first and more');
    files.gate = null; expect(await session.save()).toBe(true);
    expect(drafts.value).toBeNull();
  });

  it('stays dirty when edits arrive during an in-flight save', async () => {
    await openNamed();
    let release: () => void = () => undefined;
    files.gate = new Promise<void>((resolve) => { release = resolve; });
    editor.md = 'first';
    session.markEdited();
    const pending = session.save();
    await tick();
    expect(session.snapshot().state).toBe('saving');
    editor.md = 'first and second';
    session.markEdited();
    release();
    expect(await pending).toBe(true);
    expect(files.disk.get('story.md')).toBe('first');
    expect(session.isDirty).toBe(true);
    files.gate = null;
    expect(await session.save()).toBe(true);
    expect(files.disk.get('story.md')).toBe('first and second');
    expect(session.isDirty).toBe(false);
  });
});

describe('DocumentSession: leaving a document', () => {
  it('asks before discarding unsaved untitled words and respects "keep"', async () => {
    editor.md = 'Precious words';
    session.markEdited();
    prompter.answer = false;
    files.disk.set('other.md', 'Other');
    files.openPath = 'other.md';
    expect(await session.open()).toBe(false);
    expect(prompter.asked).toBe(1);
    expect(editor.md).toBe('Precious words');
  });

  it('does not ask when the untitled page is blank', async () => {
    editor.md = '   ';
    session.markEdited();
    await openNamed('other.md', 'Other');
    expect(prompter.asked).toBe(0);
  });

  it('auto-saves a dirty named file instead of asking', async () => {
    await openNamed();
    editor.md = 'Revised';
    session.markEdited();
    await openNamed('next.md', 'Next');
    expect(prompter.asked).toBe(0);
    expect(files.disk.get('story.md')).toBe('Revised');
  });

  it('keeps the current document when reading fails', async () => {
    await openNamed();
    files.openPath = 'ghost.md';
    expect(await session.open()).toBe(false);
    expect(errors).toEqual(['Could not access the file: missing']);
    expect(session.snapshot().path).toBe('story.md');
  });

  it('returns false when the open dialog is cancelled', async () => {
    files.openPath = null;
    expect(await session.open()).toBe(false);
  });

  it('newDocument resets to a blank untitled page', async () => {
    await openNamed();
    expect(await session.newDocument()).toBe(true);
    expect(editor.md).toBe('');
    expect(session.snapshot()).toEqual({ path: null, name: 'Untitled', state: 'saved' });
  });
});

describe('Plain text documents', () => {
  it('opens literal Markdown-looking text without conversion', async () => {
    await openNamed('notes.txt', '# This remains text');
    expect(editor.md).toBe('# This remains text');
  });
  it('writes plain text when saving a .txt file', async () => {
    await openNamed('notes.txt', 'old');
    editor.md = '**New**';
    session.markEdited();
    expect(await session.save()).toBe(true);
    expect(files.disk.get('notes.txt')).toBe('New');
  });
});

describe('Quit draft handling', () => {
  it('keeps the draft until explicitly discarded', () => {
    editor.md = 'Precious words'; session.markEdited();
    expect(drafts.value).toBe('Precious words');
    session.discardDraft(); expect(drafts.value).toBeNull();
  });
  it('does not clear a draft from a named document', async () => {
    await openNamed(); drafts.value = 'Separate draft';
    session.discardDraft(); expect(drafts.value).toBe('Separate draft');
  });
});

describe('DocumentSession: drafts', () => {
  it('restores a non-empty draft as unsaved work', () => {
    drafts.value = 'Yesterday I wrote';
    expect(session.restoreDraft()).toBe(true);
    expect(editor.md).toBe('Yesterday I wrote');
    expect(session.snapshot().state).toBe('dirty');
  });

  it('ignores missing or blank drafts', () => {
    expect(session.restoreDraft()).toBe(false);
    drafts.value = '  \n';
    expect(session.restoreDraft()).toBe(false);
    expect(session.isDirty).toBe(false);
  });
});

describe('helpers', () => {
  it('nameFromPath handles every OS and edge case', () => {
    expect(nameFromPath('/home/me/story.md')).toBe('story');
    expect(nameFromPath('C:\\Books\\Ch 1.markdown')).toBe('Ch 1');
    expect(nameFromPath('notes.v2.md')).toBe('notes.v2');
    expect(nameFromPath('.hidden')).toBe('.hidden');
    expect(nameFromPath('folder/')).toBe('folder');
    expect(nameFromPath('')).toBe('Untitled');
    expect(nameFromPath(null)).toBe('Untitled');
  });

  it('describeError produces a readable message for any value', () => {
    expect(describeError('boom')).toBe('boom');
    expect(describeError(new Error('bad'))).toBe('bad');
    expect(describeError(undefined)).toBe('Something went wrong.');
    expect(describeError('   ')).toBe('Something went wrong.');
  });
});

describe('Open dialog lifecycle', () => {
  it('does not replace edits made while the open picker is pending', async () => {
    let choose: (path: string | null) => void = () => undefined;
    files.pickOpenPath = async () => new Promise<string | null>(resolve => { choose = resolve; });
    files.disk.set('other.md', 'Other');
    const pending = session.open(); await tick();
    editor.md = 'Words typed while choosing'; session.markEdited();
    choose('other.md');
    expect(await pending).toBe(false);
    expect(editor.md).toBe('Words typed while choosing');
    expect(session.snapshot().path).toBeNull();
  });
  it('ignores an older file read after a newer Open succeeds', async () => {
    files.disk.set('old.md', 'Older file'); files.disk.set('new.md', 'Newer file');
    let release: () => void = () => undefined;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const original = files.read.bind(files);
    files.read = async path => { if (path === 'old.md') await waiting; return original(path); };
    const older = session.openPath('old.md'); await tick();
    expect(await session.openPath('new.md')).toBe(true);
    release(); expect(await older).toBe(false);
    expect(session.snapshot().path).toBe('new.md');
    expect(editor.md).toBe('Newer file');
  });
  it('does not replace edits made during a delayed file read', async () => {
    let release: () => void = () => undefined;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    files.disk.set('other.md', 'Other');
    const original = files.read.bind(files);
    files.read = async path => { await waiting; return original(path); };
    const pending = session.openPath('other.md'); await tick();
    editor.md = 'New draft'; session.markEdited(); release();
    expect(await pending).toBe(false);
    expect(editor.md).toBe('New draft');
  });
});

describe('Save dialog lifecycle', () => {
  it('recovers from a native save-dialog failure', async () => {
    files.pickSavePath = async () => { throw new Error('dialog unavailable'); };
    editor.md = 'Keep these words'; session.markEdited();
    expect(await session.save()).toBe(false);
    expect(session.isDirty).toBe(true);
    expect(errors).toContain('dialog unavailable');
  });
  it('ignores a save path chosen after explicit quit without saving', async () => {
    let choose: (path: string | null) => void = () => undefined;
    files.pickSavePath = async () => new Promise<string | null>(resolve => { choose = resolve; });
    editor.md = 'A draft'; session.markEdited();
    const pending = session.saveAs(); await tick();
    session.discardDraft(); // The writer chose Quit without saving.
    choose('late.md');
    expect(await pending).toBe(false);
    expect(files.writes).toBe(0);
    expect(files.disk.has('late.md')).toBe(false);
    expect(drafts.value).toBeNull();
  });
  it('ignores a save path chosen after the manuscript changes', async () => {
    let choose: (path: string | null) => void = () => undefined;
    files.pickSavePath = async () => new Promise<string | null>(resolve => { choose = resolve; });
    editor.md = 'old'; session.markEdited();
    const pending = session.saveAs();
    await tick();
    expect(await session.newDocument()).toBe(true);
    editor.md = 'new'; session.markEdited();
    choose('old.md');
    expect(await pending).toBe(false);
    expect(files.disk.has('old.md')).toBe(false);
    expect(editor.md).toBe('new');
  });
});

describe('DocumentSession: openPath', () => {
  it('opens a known path without a dialog', async () => {
    files.disk.set('/books/novel.md', 'Once');
    expect(await session.openPath('/books/novel.md')).toBe(true);
    expect(session.snapshot()).toEqual({ path: '/books/novel.md', name: 'novel', state: 'saved' });
    expect(editor.md).toBe('Once');
  });

  it('ignores blank paths', async () => {
    expect(await session.openPath('   ')).toBe(false);
    expect(errors).toEqual([]);
  });

  it('stays silent when quiet and the file is gone', async () => {
    expect(await session.openPath('gone.md', { quiet: true })).toBe(false);
    expect(errors).toEqual([]);
    expect(session.snapshot().path).toBeNull();
  });

  it('reports a missing file when not quiet', async () => {
    expect(await session.openPath('gone.md')).toBe(false);
    expect(errors).toEqual(['Could not access the file: missing']);
  });

  it('respects "keep writing" before switching documents', async () => {
    editor.md = 'Unsaved';
    session.markEdited();
    prompter.answer = false;
    files.disk.set('b.md', 'B');
    expect(await session.openPath('b.md')).toBe(false);
    expect(editor.md).toBe('Unsaved');
  });
});
