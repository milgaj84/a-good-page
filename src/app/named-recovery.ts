import type { DocumentSession } from '../core/session';
import type { DiskProbe } from '../core/file-conflict';
import { recoveryFileName } from '../core/recovery';
import { isPlainTextPath, nameFromPath } from '../core/paths';
import { NamedRecoveryStore } from '../core/named-recovery';
import { NamedRecoveryWriter } from '../core/named-recovery-writer';
import { RecoveryDialog } from '../ui/recovery-dialog';

export interface RecoveryDeps {
  document: DocumentSession;
  store: NamedRecoveryStore;
  writer: NamedRecoveryWriter;
  dialog: RecoveryDialog;
  probe(path: string): Promise<DiskProbe>;
  exportCopy(name: string, content: string, livePath: string | null): Promise<boolean>;
  notify(message: string): void;
}
/** Startup recovery is explicit; stale disk reads are rechecked before resuming. */
export async function offerNamedRecovery(deps: RecoveryDeps): Promise<void> {
  const record = deps.store.load();
  if (!record) { deps.writer.arm(); return; }
  let probe: DiskProbe;
  try { probe = await deps.probe(record.path); } catch { probe = { kind: 'unreadable' }; }
  if (probe.kind === 'present' && probe.content === record.content) {
    deps.store.clear(record.path); deps.writer.arm(); return;
  }
  for (;;) {
    const canResume = deps.document.snapshot().path === record.path && probe.kind === 'present';
    const choice = await deps.dialog.ask(record, probe, canResume);
    if (choice === 'later') { deps.writer.defer(record.path); deps.writer.arm(); deps.notify('Recovered words remain stored locally. Reopen the app to review them, or save your work as a separate copy.'); return; }
    if (choice === 'discard') { deps.store.discard(record.path); deps.notify('Recovered words discarded; disk file left unchanged.'); break; }
    if (choice === 'copy') {
      try {
        const name = recoveryFileName(nameFromPath(record.path), record.at, isPlainTextPath(record.path));
        const saved = await deps.exportCopy(name, record.content, deps.document.snapshot().path);
        if (saved) { deps.store.clear(record.path); deps.notify('Recovered words saved as a separate copy. The disk manuscript was not changed.'); break; }
      } catch (error) { deps.notify('Could not save recovery copy: ' + String(error)); }
      continue;
    }
    let latest: DiskProbe;
    try { latest = await deps.probe(record.path); } catch { latest = { kind: 'unreadable' }; }
    if (latest.kind !== 'present' || probe.kind !== 'present' || latest.content !== probe.content) {
      probe = latest;
      deps.notify('The disk file changed during recovery. Review the latest version before choosing.');
      continue;
    }
    if (deps.document.resumeNamedRecovery(record.path, record.content, record.baseline, latest)) {
      deps.notify(latest.content === record.baseline
        ? 'Recovered draft resumed. Save it when ready.'
        : 'Recovered draft resumed. Outside changes remain on disk; autosave is paused.');
      break;
    }
    deps.notify('The open document changed. Save your recovered words as a separate copy.');
    probe = latest;
  }
  deps.writer.arm();
  deps.writer.change(deps.document.snapshot());
}
