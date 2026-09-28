import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ExportLayout } from '../export/layout';
import { RenderTicket } from '../core/render-ticket';
import { DialogFocus } from './dialog-focus';
import { ExportState } from '../core/export-state';
import { ProjectChangeError } from '../core/project-preview';

GlobalWorkerOptions.workerSrc = workerUrl;
export interface PreviewElements {
  root: HTMLElement; canvas: HTMLCanvasElement; title: HTMLElement; status: HTMLElement;
  layout: HTMLSelectElement; page: HTMLElement; previous: HTMLButtonElement;
  next: HTMLButtonElement; exportButton: HTMLButtonElement; close: HTMLButtonElement;
}

/** Renders the exact generated PDF, not an HTML approximation of its pages. */
export class ExportPreview {
  private pdf: PDFDocumentProxy | null = null;
  private bytes: Uint8Array | null = null;
  private currentPage = 1;
  private requestedPage = 1;
  private readonly renderTicket = new RenderTicket();
  private generation = 0;
  private busy = false;
  private blocked = false;
  private readonly state = new ExportState();
  private readonly focus: DialogFocus;
  constructor(private readonly els: PreviewElements,
    private readonly build: (layout: ExportLayout) => Promise<Uint8Array>,
    private readonly save: (bytes: Uint8Array) => Promise<boolean>,
    private readonly saved: () => void, private readonly closed: () => void,
    private readonly stale?: (error: ProjectChangeError) => void) {
    this.focus = new DialogFocus(els.root);
    els.root.setAttribute('aria-hidden', 'true');
    els.root.tabIndex = -1;
    els.layout.addEventListener('change', () => void this.regenerate());
    els.previous.addEventListener('click', () => void this.navigate(this.requestedPage - 1));
    els.next.addEventListener('click', () => void this.navigate(this.requestedPage + 1));
    els.close.addEventListener('click', () => this.close());
    els.exportButton.addEventListener('click', () => void this.export());
    els.root.addEventListener('mousedown', event => { if (event.target === els.root) this.close(); });
  }
  get isOpen(): boolean { return this.els.root.classList.contains('is-open'); }
  note(message: string): void { if (this.isOpen) this.els.status.textContent = message; }
  get changedDuringSave(): boolean { return this.state.changedDuringSave; }
  manuscriptEdited(): 'close' | 'pending' {
    const action = this.state.manuscriptEdited();
    if (action === 'close') this.close();
    else this.els.status.textContent = 'Exporting the previewed snapshot; later edits are not included.';
    return action;
  }
  async open(title: string): Promise<void> {
    if (this.isOpen) return;
    this.blocked = false; this.state.beginPreview();
    this.els.title.textContent = title;
    this.els.root.classList.add('is-open'); this.els.root.setAttribute('aria-hidden', 'false');
    this.focus.open(this.els.close);
    await this.regenerate();
  }
  close(notify = true): void {
    if (!this.isOpen || this.busy) return;
    this.generation++; this.renderTicket.cancel();
    this.els.root.classList.remove('is-open'); this.els.root.setAttribute('aria-hidden', 'true');
    this.els.canvas.width = 0; this.els.canvas.height = 0;
    this.bytes = null; this.blocked = false; const old = this.pdf; this.pdf = null;
    if (old) void old.destroy();
    this.focus.close();
    if (notify) this.closed();
  }
  private async regenerate(): Promise<void> {
    if (this.blocked) { this.els.status.textContent = 'Source changed. Use Refresh preview before exporting.'; return; }
    const token = ++this.generation;
    this.renderTicket.cancel();
    this.bytes = null;
    this.els.exportButton.disabled = true;
    this.els.status.textContent = 'Preparing pages…';
    const old = this.pdf; this.pdf = null;
    try {
      if (old) await old.destroy();
      if (token !== this.generation || !this.isOpen) return;
      const layout = this.els.layout.value as ExportLayout;
      if (layout !== 'manuscript' && layout !== 'reading') throw Error('Choose a valid layout.');
      const bytes = await this.build(layout);
      if (token !== this.generation) return;
      // PDF.js may transfer the supplied buffer to its worker; retain original bytes for export.
      const pdf = await getDocument({ data: bytes.slice() }).promise;
      if (token !== this.generation) { await pdf.destroy(); return; }
      this.pdf = pdf; this.bytes = bytes; this.currentPage = 1; this.requestedPage = 1;
      await this.showPage(1, token);
      if (token === this.generation) {
        this.els.exportButton.disabled = false;
        this.els.status.textContent = layout === 'reading' ? 'Reading copy · A4' : 'Manuscript · A4';
      }
    } catch (error) {
      if (token === this.generation) this.els.status.textContent = 'Preview failed: ' + String(error);
    }
  }
  private async navigate(pageNumber: number): Promise<void> {
    if (this.busy || !this.pdf || pageNumber < 1 || pageNumber > this.pdf.numPages) return;
    this.requestedPage = pageNumber;
    try { await this.showPage(pageNumber); }
    catch (error) { if (this.isOpen) this.els.status.textContent = 'Could not draw page: ' + String(error); }
  }
  private async showPage(pageNumber: number, generation = this.generation): Promise<void> {
    const pdf = this.pdf;
    if (!pdf || pageNumber < 1 || pageNumber > pdf.numPages) return;
    const ticket = this.renderTicket.next();
    try {
      const page = await pdf.getPage(pageNumber);
      if (generation !== this.generation || !this.renderTicket.valid(ticket) || !this.isOpen) return;
      const width = Math.min(660, Math.max(260, this.els.root.clientWidth - 96));
      const scale = width / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      // Separate surfaces avoid overlapping PDF.js render tasks on the visible canvas.
      const surface = document.createElement('canvas');
      surface.width = Math.floor(viewport.width * ratio);
      surface.height = Math.floor(viewport.height * ratio);
      const context = surface.getContext('2d');
      if (!context) throw Error('Canvas is unavailable.');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvasContext: context, viewport }).promise;
      if (generation !== this.generation || !this.renderTicket.valid(ticket) || !this.isOpen) return;
      const visible = this.els.canvas;
      visible.width = surface.width; visible.height = surface.height;
      visible.style.width = viewport.width + 'px'; visible.style.height = viewport.height + 'px';
      const output = visible.getContext('2d');
      if (!output) throw Error('Canvas is unavailable.');
      output.drawImage(surface, 0, 0);
      this.currentPage = pageNumber;
      this.els.page.textContent = 'Page ' + pageNumber + ' of ' + pdf.numPages;
      this.els.previous.disabled = pageNumber === 1;
      this.els.next.disabled = pageNumber === pdf.numPages;
    } catch (error) {
      if (generation === this.generation && this.renderTicket.valid(ticket) && this.isOpen) throw error;
    }
  }
  private async export(): Promise<void> {
    if (this.busy || !this.bytes || this.blocked) return;
    this.busy = true; this.state.beginSave(); this.els.exportButton.disabled = true;
    this.els.layout.disabled = true; this.els.close.disabled = true;
    this.els.previous.disabled = true; this.els.next.disabled = true;
    try {
      const success = await this.save(this.bytes);
      const changed = this.state.endSave();
      if (success) { this.busy = false; this.close(false); this.saved(); }
      else if (changed) { this.busy = false; this.close(); }
    } catch (error) {
      const changed = this.state.endSave();
      if (changed) { this.busy = false; this.close(); }
      else if (error instanceof ProjectChangeError && this.stale) {
        this.blocked = true; this.stale(error);
        this.els.status.textContent = error.message + ' Old pages remain visible but cannot be exported.';
      } else this.els.status.textContent = 'Export failed: ' + String(error);
    }
    finally {
      this.busy = false; this.state.endSave(); this.els.layout.disabled = false; this.els.close.disabled = false;
      if (this.isOpen) {
        this.els.exportButton.disabled = this.bytes === null || this.blocked;
        this.els.previous.disabled = this.currentPage <= 1;
        this.els.next.disabled = !this.pdf || this.currentPage >= this.pdf.numPages;
      }
    }
  }
}
