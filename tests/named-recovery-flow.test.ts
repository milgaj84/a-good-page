import { describe, expect, it } from 'vitest';
import { offerNamedRecovery } from '../src/app/named-recovery';
import { NamedRecoveryStore } from '../src/core/named-recovery';
import { DocumentSession } from '../src/core/session';
import type { DiskProbe } from '../src/core/file-conflict';
import type { NamedRecoveryWriter } from '../src/core/named-recovery-writer';
import type { RecoveryDialog, RecoveryChoice } from '../src/ui/recovery-dialog';
function fixture() {
  const raw = new Map<string, string>();
  const disk = new Map([['story.md', 'Original']]);
  const store = new NamedRecoveryStore({ getItem: k => raw.get(k) ?? null,
    setItem: (k, v) => { raw.set(k, v); }, removeItem: k => { raw.delete(k); } }, () => 99);
  let text = '', outcome: RecoveryChoice = 'resume', calls = 0, copies = 0;
  const notifications: string[] = [];
  const doc = new DocumentSession({
    editor: { getMarkdown: () => text, setMarkdown: v => { text = v; }, focus: () => {} },
    files: { pickOpenPath: async () => null, pickSavePath: async () => null,
      read: async path => ({ path, name: 'story', content: disk.get(path)! }),
      write: async (path, value, expected) => { if (expected !== (disk.get(path) ?? null)) throw Error('outside change'); disk.set(path, value); return path; } },
    prompter: { confirmDiscard: async () => false }, drafts: { load: () => null, save: () => {}, clear: () => {} },
    events: { onChange: () => {}, onError: () => {} },
  });
  const writer = { arm: () => { calls++; }, change: () => {}, defer: () => {}, release: () => {} } as unknown as NamedRecoveryWriter;
  const dialog = { ask: async () => outcome } as unknown as RecoveryDialog;
  const deps = { document: doc, store, writer, dialog,
    probe: async (path: string): Promise<DiskProbe> => disk.has(path) ? { kind: 'present', content: disk.get(path)! } : { kind: 'missing' },
    exportCopy: async (_name: string, _content: string, _protectedPath: string | null) => { copies++; return true; }, notify: (m: string) => { notifications.push(m); } };
  return { doc, store, disk, deps, notifications, get text() { return text; },
    set outcome(v: RecoveryChoice) { outcome = v; }, get copies() { return copies; }, get armed() { return calls; } };
}
describe('named startup recovery choices', () => {
  it('resumes recovered words without writing disk, preserving a changed disk guard', async () => {
    const t = fixture(); t.store.save('story.md', 'Original', 'Recovered');
    await t.doc.openPath('story.md'); t.disk.set('story.md', 'Outside');
    await offerNamedRecovery(t.deps);
    expect(t.text).toBe('Recovered'); expect(t.disk.get('story.md')).toBe('Outside');
    expect(t.doc.snapshot().state).toBe('error'); expect(t.doc.recoveryBaseline()).toBe('Original');
    expect(await t.doc.autosave()).toBe(false); expect(t.store.load()?.content).toBe('Recovered');
  });
  it('saves a copy for a missing manuscript without recreating it', async () => {
    const t = fixture(); t.store.save('story.md', 'Original', 'Recovered');
    t.disk.delete('story.md'); t.outcome = 'copy';
    let protectedPath = '';
    t.deps.exportCopy = async (_name, _content, path) => { protectedPath = path ?? ''; return true; };
    await offerNamedRecovery(t.deps);
    expect(protectedPath).toBe('story.md'); expect(t.disk.has('story.md')).toBe(false);
    expect(t.store.load()).toBeNull();
  });
  it('reviews separate records and does not erase one when another is postponed', async () => {
    const t = fixture(); t.store.save('story.md', 'Original', 'Recovered');
    t.store.save('other.md', '', 'Other draft');
    await t.doc.openPath('story.md');
    let calls = 0;
    t.deps.dialog = { ask: async () => (++calls === 1 ? 'later' : 'copy') } as unknown as RecoveryDialog;
    await offerNamedRecovery(t.deps);
    expect(calls).toBe(2);
    expect(t.store.load('story.md')?.content).toBe('Recovered');
    expect(t.store.load('other.md')).toBeNull();
  });
  it('retains recovery after a cancelled copy picker without looping', async () => {
    const t = fixture(); t.store.save('story.md', 'Original', 'Recovered');
    let calls = 0; t.deps.dialog = { ask: async () => { calls++; return 'copy'; } } as unknown as RecoveryDialog;
    t.deps.exportCopy = async () => false;
    await offerNamedRecovery(t.deps);
    expect(calls).toBe(1); expect(t.store.load('story.md')?.content).toBe('Recovered');
  });
  it('clears a stale record only when disk already contains the recovered words', async () => {
    const t = fixture(); t.store.save('story.md', 'Original', 'Recovered');
    t.disk.set('story.md', 'Recovered'); await t.doc.openPath('story.md');
    await offerNamedRecovery(t.deps);
    expect(t.store.load()).toBeNull(); expect(t.text).toBe('Recovered');
  });
  it('rechecks disk before resuming and retains words if it changed during review', async () => {
    const t = fixture(); t.store.save('story.md', 'Original', 'Recovered');
    await t.doc.openPath('story.md');
    let reads = 0, questions = 0;
    t.deps.probe = async () => ({ kind: 'present', content: ++reads === 1 ? 'Original' : 'Another edit' });
    t.deps.dialog = { ask: async () => (++questions === 1 ? 'resume' : 'later') } as unknown as RecoveryDialog;
    await offerNamedRecovery(t.deps);
    expect(questions).toBe(2); expect(t.text).toBe('Original');
    expect(t.store.load()?.content).toBe('Recovered');
  });
  it('Escape keeps recovery, while explicit discard removes it', async () => {
    const t = fixture(); t.store.save('story.md', 'Original', 'Recovered');
    await t.doc.openPath('story.md'); t.outcome = 'later'; await offerNamedRecovery(t.deps);
    expect(t.store.load()?.content).toBe('Recovered');
    const another = fixture(); another.store.save('story.md', 'Original', 'Recovered');
    await another.doc.openPath('story.md'); another.outcome = 'discard'; await offerNamedRecovery(another.deps);
    expect(another.store.load()).toBeNull();
  });
});
