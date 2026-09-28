import { DialogFocus } from './dialog-focus';
import type { NamedRecovery } from '../core/named-recovery';
import type { DiskProbe } from '../core/file-conflict';
export type RecoveryChoice = 'resume' | 'copy' | 'discard' | 'later';
/** A recovered named draft never replaces a disk file without a writer's choice. */
export class RecoveryDialog {
  readonly root = document.createElement('div');
  private readonly focus = new DialogFocus(this.root);
  private readonly description = document.createElement('p');
  private readonly comparison = document.createElement('div');
  private readonly toggle = document.createElement('button');
  private readonly resume = document.createElement('button');
  private readonly copy = document.createElement('button');
  private readonly leave = document.createElement('button');
  private resolve: ((choice: RecoveryChoice) => void) | null = null;
  constructor(host: HTMLElement) {
    this.root.className = 'overlay recovery-overlay';
    this.root.tabIndex = -1;
    this.root.setAttribute('aria-hidden', 'true');
    const sheet = document.createElement('section');
    sheet.className = 'recovery-sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'recovery-title');
    const title = document.createElement('h2'); title.id = 'recovery-title'; title.textContent = 'Words from your last session';
    this.description.setAttribute('role', 'status');
    this.comparison.className = 'recovery-comparison'; this.comparison.hidden = true;
    for (const [button, text] of [[this.toggle, 'Review recovered words'], [this.resume, 'Resume draft'],
      [this.copy, 'Save as a copy'], [this.leave, 'Discard recovered words & leave disk file as is']] as const) {
      button.type = 'button'; button.textContent = text;
    }
    const actions = document.createElement('div'); actions.className = 'recovery-actions';
    actions.append(this.toggle, this.resume, this.copy, this.leave);
    sheet.append(title, this.description, this.comparison, actions); this.root.append(sheet); host.append(this.root);
    this.toggle.addEventListener('click', () => { this.comparison.hidden = !this.comparison.hidden; });
    this.resume.addEventListener('click', () => this.finish('resume'));
    this.copy.addEventListener('click', () => this.finish('copy'));
    this.leave.addEventListener('click', () => this.finish('discard'));
    this.root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); this.finish('later'); } event.stopPropagation(); });
  }
  get isOpen(): boolean { return this.resolve !== null; }
  ask(record: NamedRecovery, disk: DiskProbe, canResume: boolean): Promise<RecoveryChoice> {
    if (this.isOpen) return Promise.resolve('later');
    this.resume.disabled = !canResume;
    const name = record.path.split(String.fromCharCode(92)).pop()?.split('/').pop() || 'Manuscript';
    this.description.textContent = disk.kind === 'present' && disk.content !== record.baseline
      ? name + ' changed on disk after your unsaved words were recorded. Review both versions; autosave will remain paused if you resume.'
      : disk.kind === 'present' ? name + ' has unsaved words from your last session. Your disk file has not been changed.'
      : name + ' is unavailable. Your recovered words are still here; save them as a separate copy.';
    this.comparison.replaceChildren(); this.comparison.hidden = true;
    for (const [label, text] of [['Recovered words', record.content], ['File on disk', disk.kind === 'present' ? disk.content : 'Unavailable']] as const) {
      const column = document.createElement('div'); const heading = document.createElement('h3');
      const preview = document.createElement('pre'); heading.textContent = label;
      preview.textContent = text.length > 12000 ? text.slice(0, 12000) + String.fromCharCode(10) + '[Preview shortened; the full draft is retained.]' : text;
      column.append(heading, preview); this.comparison.append(column);
    }
    this.root.classList.add('is-open'); this.root.setAttribute('aria-hidden', 'false');
    this.focus.open(this.toggle);
    return new Promise(resolve => { this.resolve = resolve; });
  }
  close(): void { this.finish('later'); }
  private finish(choice: RecoveryChoice): void {
    const resolve = this.resolve; if (!resolve) return;
    this.resolve = null; this.root.classList.remove('is-open'); this.root.setAttribute('aria-hidden', 'true');
    this.focus.close(); resolve(choice);
  }
}
