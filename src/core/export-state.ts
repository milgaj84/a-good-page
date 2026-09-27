/** The PDF preview is a fixed snapshot; later edits cannot change its bytes. */
export class ExportState {
  private saving = false;
  private changed = false;
  beginPreview(): void { this.changed = false; this.saving = false; }
  beginSave(): void { this.saving = true; }
  manuscriptEdited(): 'close' | 'pending' {
    if (this.saving) { this.changed = true; return 'pending'; }
    return 'close';
  }
  endSave(): boolean { this.saving = false; return this.changed; }
  get changedDuringSave(): boolean { return this.changed; }
}
