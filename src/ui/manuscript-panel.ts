import { ProjectService, type ProjectPorts, type ProjectSnapshot } from '../core/project-service';
import { searchProject } from '../core/project';
import { compiledMarkdown, renderProjectPdf } from '../export/project-pdf';
import { createReader, type ReaderView } from '../editor/reader';
import { ExportPreview, type PreviewElements } from './export-preview';
import type { ExportLayout } from '../export/layout';
import { previewInventory, ProjectChangeError } from '../core/project-preview';
import { ProjectRelinkDialog } from './project-relink';
import type { SaveState } from '../core/session';
import { chapterSelection, nextStep, shareSteps, type BookState, type NextAction, type Place } from '../core/workflow';
import { PlaceTabs, drawNextStep, drawShareSteps, drawShareOverview } from './project-guide';
import { shareOverview } from '../core/share-overview';

export interface ManuscriptDeps {
  host: HTMLElement;
  root(): string | null;
  chooseRoot(): Promise<string | null>;
  ports: ProjectPorts;
  openChapter(root: string, relative: string, heading?: string, phrase?: string): Promise<void>;
  dirty(): boolean;
  savePdf(name: string, bytes: Uint8Array, recheck?: () => Promise<void>): Promise<string | null>;
  notify(message: string): void;
  /** Save state of the open page, for the next-step card. */
  session(): { save: SaveState; named: boolean };
  /** Actions that belong to the page rather than the project: save, new chapter, back to writing. */
  act(action: NextAction): void;
  /** Called when the writer picks a place; 'write' means leave the project page. */
  go(place: Place): void;
}
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
};
function previewElements(host: HTMLElement): PreviewElements & { refresh: HTMLButtonElement; layout: HTMLSelectElement } {
  const root = make('div','overlay preview-overlay');
  const sheet=make('div','preview-sheet');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','Whole manuscript PDF pages');
  const top=make('header','preview-top');const title=make('h2','');const refresh=make('button','ghost','Refresh preview');refresh.type='button';refresh.hidden=true;const close=make('button','ghost','Close');close.type='button';top.append(title,refresh,close);
  const tools=make('div','preview-tools');const label=make('label','','Layout');const layout=make('select','');layout.id='manuscript-layout';label.htmlFor=layout.id;
  for(const key of ['reading','manuscript']) {const option=make('option','',key==='reading'?'Reading copy':'Manuscript');option.value=key;layout.add(option);}
  const status=make('span','');status.setAttribute('role','status');tools.append(label,layout,status);
  const pages=make('div','preview-pages');const canvas=make('canvas','');pages.append(canvas);
  const footer=make('footer','preview-bottom');const previous=make('button','','← Previous');const page=make('span','');const next=make('button','','Next →');const exportButton=make('button','preview-primary','Export whole PDF');
  for(const btn of [previous,next,exportButton])btn.type='button';footer.append(previous,page,next,exportButton);
  sheet.append(top,tools,pages,footer);root.append(sheet);host.append(root);
  return {root,canvas,title,status,layout,page,previous,next,exportButton,close,refresh};
}
/** Project home for 0.3.0: Chapters (find, order, open, repair) and Share (choose, read, export).
 *  All project data is disk-backed; a preview is an immutable selection of chapters. */
export class ManuscriptPanel {
  readonly root=make('aside','manuscript-panel');
  private service: ProjectService;
  private readonly status=make('p','manuscript-status');
  private readonly list=make('div','manuscript-list');
  private readonly shareHint=make('p','share-hint','Choose chapters for the book PDF. Select a title to include or exclude it.');
  private readonly health=make('section','manuscript-health');
  private readonly results=make('div','manuscript-results');
  private readonly page=make('div','manuscript-page');
  private readonly inventory=make('section','manuscript-inventory');
  private readonly query=make('input','manuscript-query');
  private readonly pdfButton=make('button','','See PDF pages');
  private readonly preview: ExportPreview;
  private readonly relink: ProjectRelinkDialog;
  private reader: ReaderView | null=null;
  private selection=new Set<string>();
  private selectionRoot: string | null=null;
  private snapshot: ProjectSnapshot | null=null;
  private busy=false;
  private refreshing=false;
  private openingPreview=false;
  private compiling=false;
  private previewRevision=0;
  private returnFocus: HTMLElement | null=null;
  private refreshPdf: HTMLButtonElement | null=null;
  private pdfLayout: HTMLSelectElement | null=null;
  private place: Place='chapters';
  private stale=false;
  private loaded=false;
  private readonly next=make('section','next-step');
  private readonly steps=make('ol','share-steps');
  private readonly overview=make('section','share-overview');
  private readonly heading=make('h2','','Chapters');
  readonly tabs: PlaceTabs;
  constructor(private readonly deps: ManuscriptDeps) {
    this.service=new ProjectService(deps.ports);
    this.relink=new ProjectRelinkDialog(deps.host,this.service,deps.notify,()=>{this.clearPreview();this.draw();this.drawHealth();});
    const close=make('button','','Back to writing');close.type='button';
    this.tabs=new PlaceTabs('Project places',place=>deps.go(place));
    const head=make('div','manuscript-head');head.append(this.heading,this.tabs.root,close);
    const refresh=make('button','','Refresh chapters');refresh.type='button';
    const check=make('button','','Check project health');check.type='button';
    const folder=make('button','','Change book folder');folder.type='button';
    const tools=make('div','chapter-tools');tools.append(refresh,check,folder);
    const compile=make('button','share-primary','Read it through');compile.type='button';compile.title='Compile selected chapters into one reading page';
    const shareTools=make('div','share-tools');
    const selectAll=make('button','','Select all'),clearSelection=make('button','','Clear');
    for(const button of [selectAll,clearSelection])button.type='button';
    selectAll.addEventListener('click',()=>this.selectChapters(true));
    clearSelection.addEventListener('click',()=>this.selectChapters(false));
    shareTools.append(selectAll,clearSelection,compile,this.pdfButton);
    this.pdfButton.type='button';this.pdfButton.disabled=true;
    this.query.type='search';this.query.placeholder='Find in any chapter';this.query.setAttribute('aria-label','Search the whole manuscript');
    this.status.setAttribute('role','status');this.inventory.setAttribute('aria-live','polite');
    this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
    this.root.setAttribute('aria-label','Your book');this.root.setAttribute('aria-hidden','true');
    this.inventory.setAttribute('aria-label','Compiled chapter inventory');
    this.health.setAttribute('aria-label','Project health');this.health.setAttribute('aria-live','polite');
    this.next.setAttribute('aria-live','polite');this.steps.setAttribute('aria-label','Share steps');this.overview.setAttribute('aria-label','Book PDF selection');this.root.dataset.place='chapters';
    this.root.append(head,this.next,this.steps,this.overview,this.query,this.results,this.status,tools,this.health,this.shareHint,this.list,shareTools,this.inventory,this.page);
    deps.host.append(this.root);
    const elements=previewElements(deps.host);
    this.refreshPdf=elements.refresh;this.pdfLayout=elements.layout;
    elements.refresh.addEventListener('click',()=>void this.refreshPreview());
    this.preview=new ExportPreview(elements,async(layout: ExportLayout)=>{
      if(!this.snapshot)throw Error('Compile a manuscript first.');
      return renderProjectPdf(this.snapshot.chapters,this.title(),layout);
    },async bytes=>{
      if(!this.snapshot)throw Error('The preview is no longer current.');
      if(this.deps.dirty())throw Error('Save the open chapter before exporting the manuscript.');
      await this.service.verify(this.snapshot);
      return (await deps.savePdf(this.title()+'-manuscript',bytes,async()=>{
        if(this.deps.dirty())throw Error('Save the open chapter before exporting.');
        await this.service.verify(this.snapshot!);
      }))!==null;
    },()=>deps.notify('Whole manuscript PDF exported; chapter sources are unchanged.'),()=>{},
      error => this.markStale(error));
    close.addEventListener('click',()=>deps.go('write'));
    folder.addEventListener('click',()=>void this.load(true,true));
    refresh.addEventListener('click',()=>void this.load());
    check.addEventListener('click',()=>void this.load(false));
    compile.addEventListener('click',()=>void this.compile());
    this.pdfButton.addEventListener('click',()=>void this.openCheckedPreview());
    this.query.addEventListener('input',()=>this.search());
  }
  get isOpen(): boolean {return this.root.classList.contains('is-open');}
  private markStale(error: ProjectChangeError): void {
    if(this.refreshPdf)this.refreshPdf.hidden=false;
    this.stale=true;this.pdfButton.disabled=true;this.guide();
    this.status.textContent='PDF pages and export blocked: '+error.message+' Refresh pages to continue.';
    this.deps.notify(this.status.textContent);
  }
  /** Recheck source files before showing compiled pages; export rechecks them again. */
  private async openCheckedPreview(): Promise<void> {
    if(this.openingPreview||this.preview.isOpen||!this.snapshot||this.stale)return;
    const snapshot=this.snapshot;this.openingPreview=true;
    try {
      if(this.deps.dirty()||this.deps.session().save!=='saved')throw Error('Save the open chapter before viewing PDF pages.');
      await this.service.verify(snapshot);
      if(snapshot!==this.snapshot||this.stale)return;
      await this.preview.open(this.title());
    } catch(error) {
      if(snapshot!==this.snapshot)return;
      if(error instanceof ProjectChangeError)this.markStale(error);
      else {this.status.textContent='Cannot open PDF pages: '+String(error);this.deps.notify(this.status.textContent);}
    } finally {this.openingPreview=false;}
  }
  private showInventory(): void {
    this.inventory.replaceChildren();if(!this.snapshot)return;
    const info=previewInventory(this.service.chapters,this.snapshot);
    const title=make('h3','','Included · '+info.included.length+' chapters · '+info.totalWords.toLocaleString()+' words');
    const list=make('ol','');for(const item of info.included)list.append(make('li','',item.title+' · '+item.words.toLocaleString()+' words · '+item.path));
    this.inventory.append(title,list);
    if(info.excluded.length)this.inventory.append(make('p','',info.excluded.length+' excluded: '+info.excluded.join(', ')));
    else this.inventory.append(make('p','','No chapters excluded.'));
  }
  private async refreshPreview(): Promise<void> {
    if(this.refreshing||!this.snapshot)return;
    this.refreshing=true;const previous=this.snapshot;
    let staged: ReaderView | null=null;let stage: HTMLElement | null=null;
    if(this.refreshPdf)this.refreshPdf.disabled=true;
    try {
      if(this.deps.dirty())throw Error('Save the open chapter before refreshing the preview.');
      const nextService=new ProjectService(this.deps.ports);await nextService.open(previous.root);
      const next=nextService.preview(previous.chapters.map(file=>file.path));
      const text=compiledMarkdown(next.chapters);
      await renderProjectPdf(next.chapters,this.title(), this.pdfLayout?.value === 'manuscript' ? 'manuscript' : 'reading');
      stage=make('div','manuscript-stage');stage.hidden=true;this.page.append(stage);
      staged=createReader(stage);staged.show(text,false);
      this.preview.close();this.reader?.destroy();this.page.replaceChildren(stage);stage.hidden=false;
      this.service=nextService;this.relink.setService(nextService);this.snapshot=next;this.reader=staged;staged=null;stage=null;
      this.showInventory();this.draw();this.pdfButton.disabled=false;
      if(this.refreshPdf)this.refreshPdf.hidden=true;
      this.stale=false;this.guide();
      this.status.textContent='Preview refreshed · '+next.chapters.length+' chapters. Export will recheck the sources.';
      await this.preview.open(this.title());
    }catch(error){staged?.destroy();stage?.remove();this.status.textContent='Refresh failed: '+String(error)+' Old pages remain visible and cannot be exported.';this.preview.note(this.status.textContent);this.deps.notify(this.status.textContent);}
    finally {this.refreshing=false;if(this.refreshPdf)this.refreshPdf.disabled=false;}
  }
  private clearPreview(): void { this.previewRevision++;this.stale=false;this.snapshot=null;this.pdfButton.disabled=true;this.reader?.destroy();this.reader=null;this.page.replaceChildren();this.inventory.replaceChildren();this.guide(); }
  get current(): Place {return this.isOpen?this.place:'write';}
  /** Opens (or switches) the project page. Chapters reloads from disk; Share keeps the chosen chapters. */
  async show(place: 'chapters' | 'share'): Promise<void> {
    const wasOpen=this.isOpen;this.place=place;this.root.dataset.place=place;
    this.heading.textContent=place==='share'?'Share your book':'Chapters';this.tabs.mark(place);
    if(!wasOpen){
      this.returnFocus=document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.root.classList.add('is-open');this.root.setAttribute('aria-hidden','false');
    }
    this.guide();
    if(this.loaded&&this.selectionRoot===this.deps.root())this.draw();
    if(!this.loaded||this.selectionRoot!==this.deps.root())await this.load();
    (place==='share'||!this.deps.root()?this.next.querySelector('button'):this.query)?.focus();
  }
  async open(): Promise<void> { await this.show('chapters'); }
  /** Where the book stands, for the next-step card and the Share steps. */
  book(): Omit<BookState,'place'|'save'|'named'> {
    const blocking=this.loaded?this.service.health().issues.filter(x=>x.blocking).length:0;
    const readable=new Set(this.service.chapters.filter(x=>x.file).map(x=>x.path));
    return { folder: Boolean(this.deps.root()), loaded: this.loaded, chapters: this.service.chapters.length, blocking,
      selected: [...this.selection].filter(p=>readable.has(p)).length, preview: this.stale?'stale':this.snapshot?'ready':'none' };
  }
  /** Redraws the next-step card; also called when the open page's save state changes. */
  guide(): void {
    if(!this.isOpen)return;
    this.root.dataset.folder=this.deps.root()?'set':'none';
    const state: BookState={ ...this.book(), ...this.deps.session(), place: this.place };
    drawNextStep(this.next,nextStep(state),action=>this.act(action));
    drawShareSteps(this.steps,shareSteps(state));
    drawShareOverview(this.overview,shareOverview(this.service.chapters,this.selection,state.preview));
  }
  private act(action: NextAction): void {
    if(action==='chooseFolder'){void this.load(true,true);return;}
    if(action==='openChapters'){void this.load();return;}
    if(action==='fixChapters'){if(this.place!=='chapters')void this.show('chapters');this.health.scrollIntoView({block:'nearest'});return;}
    if(action==='chooseChapters'){this.list.querySelector<HTMLElement>('input:not(:disabled)')?.focus();return;}
    if(action==='openChapter'){this.list.querySelector<HTMLElement>('button.manuscript-name:not(:disabled)')?.focus();return;}
    if(action==='preview'){void this.compile();return;}
    if(action==='refreshPreview'){void this.refreshPreview();return;}
    if(action==='export'){void this.openCheckedPreview();return;}
    this.deps.act(action);
  }
  close(): boolean {
    if(this.relink.isOpen){this.relink.close();return true;}
    if(this.preview.isOpen){this.preview.close();return true;}
    if(!this.isOpen)return false;
    this.tabs.mark('write');
    this.root.classList.remove('is-open');this.root.setAttribute('aria-hidden','true');
    if(this.returnFocus?.isConnected)this.returnFocus.focus();this.returnFocus=null;return true;
  }
  private title(): string {return this.service.path?.split(String.fromCharCode(92)).pop()?.split('/').pop()||'Manuscript';}
  private async load(persistOrder = true, ask = false): Promise<void> {
    if(this.busy)return;this.busy=true;const oldStatus=this.status.textContent;this.status.textContent='Reading the project…';
    try {
      const root=ask?await this.deps.chooseRoot():this.deps.root();
      if(ask&&!root){this.status.textContent=oldStatus;return;}
      if(!root){
        this.service=new ProjectService(this.deps.ports);this.relink.setService(this.service);
        this.selectionRoot=null;this.selection.clear();this.loaded=false;this.clearPreview();
        this.list.replaceChildren();this.health.replaceChildren();this.results.replaceChildren();
        this.status.textContent='';return;
      }
      await this.service.open(root,persistOrder);
      const paths=this.service.chapters.map(x=>x.path);
      const readable=this.service.chapters.filter(x=>x.file).map(x=>x.path);
      this.selection=chapterSelection(paths,readable,this.selection,this.selectionRoot===root);
      this.selectionRoot=root;
      this.clearPreview();
      this.status.textContent=paths.length+' chapters · '+this.service.chapters.reduce((sum,x)=>sum+(x.file?.words??0),0).toLocaleString()+' words'+(this.service.chapters.some(x=>x.issue)?' · Resolve missing or unreadable files':'');
      this.loaded=true;this.draw();this.drawHealth();this.search();
    } catch(e){this.loaded=false;this.health.replaceChildren();this.status.textContent='Could not check manuscript: '+String(e);this.deps.notify(this.status.textContent);}
    finally{this.busy=false;this.guide();}
  }
  private selectChapters(all: boolean): void {
    this.selection=all?new Set(this.service.chapters.filter(entry=>entry.file).map(entry=>entry.path)):new Set<string>();
    this.clearPreview();this.draw();this.guide();
    this.status.textContent=all?'All readable chapters selected.':'No chapters selected.';
  }
  private drawHealth(): void {
    const report=this.service.health();this.health.replaceChildren();
    this.health.append(make('h3','',report.ready?'Project ready to compile':'Project needs attention'));
    this.health.append(make('p','',report.readable+'/'+report.total+' readable chapters · '+report.words.toLocaleString()+' words · '+report.issues.length+' notices'));
    if(!report.issues.length){this.health.append(make('p','','No missing, unreadable, empty or untracked chapters detected.'));return;}
    const list=make('ul','');
    for(const issue of report.issues){
      list.append(make('li',issue.blocking?'health-blocking':'health-advisory',
        issue.kind.toUpperCase()+' · '+issue.path+' — '+issue.advice));
    }
    this.health.append(list);
  }
  private draw(): void {
    this.list.replaceChildren();const root=this.service.path;if(!root)return;
    for(const [index,entry] of this.service.chapters.entries()){
      const row=make('div','manuscript-row');const check=make('input','');check.type='checkbox';check.id='chapter-check-'+index;
      check.checked=this.selection.has(entry.path);check.disabled=!entry.file;
      check.setAttribute('aria-label','Include '+entry.path+' in book PDF');
      check.addEventListener('change',()=>{
        if(check.checked===this.selection.has(entry.path))return;
        if(check.checked)this.selection.add(entry.path);else this.selection.delete(entry.path);
        this.clearPreview();this.guide();
      });
      let label: HTMLLabelElement | HTMLButtonElement;
      if(this.place==='share'){
        label=make('label','manuscript-name',entry.file?.title??entry.path);
        label.htmlFor=check.id;
      } else {
        label=make('button','manuscript-name',entry.file?.title??entry.path);
        label.type='button';label.disabled=!entry.file;
        label.setAttribute('aria-label','Open '+entry.path);
        label.addEventListener('click',()=>void this.deps.openChapter(root,entry.path));
      }
      const meta=make('small','',entry.issue??(entry.file!.words.toLocaleString()+' words · '+entry.path));
      const up=make('button','','↑'),down=make('button','','↓');for(const button of [up,down])button.type='button';
      up.setAttribute('aria-label','Move '+entry.path+' earlier');down.setAttribute('aria-label','Move '+entry.path+' later');
      up.addEventListener('click',()=>void this.reorder(entry.path,-1));down.addEventListener('click',()=>void this.reorder(entry.path,1));
      row.append(check,label,meta,up,down);
      if(entry.issue){const repair=make('button','','Relink chapter');repair.type='button';repair.addEventListener('click',()=>void this.relink.open(entry.path));const remove=make('button','','Remove missing entry');remove.type='button';remove.addEventListener('click',()=>void this.remove(entry.path));row.append(repair,remove);}
      this.list.append(row);
      if(this.place==='share')continue;
      for(const h of entry.file?.headings??[]){const jump=make('button','manuscript-heading',h.title);jump.type='button';jump.style.marginLeft=(h.level*12)+'px';jump.addEventListener('click',()=>void this.deps.openChapter(root,entry.path,h.title));this.list.append(jump);}
    }
  }
  private async reorder(path:string,direction:-1|1):Promise<void>{try{await this.service.move(path,direction);this.clearPreview();this.draw();this.drawHealth();}catch(e){this.deps.notify('Project order was not saved: '+String(e));}}
  private async remove(path:string):Promise<void>{try{await this.service.omitMissing(path);this.selection.delete(path);this.clearPreview();this.draw();this.drawHealth();}catch(e){this.deps.notify('Could not update project order: '+String(e));}}
  private search():void{
    this.results.replaceChildren();const files=this.service.chapters.flatMap(x=>x.file?[x.file]:[]),hits=searchProject(files,this.query.value);
    if(this.query.value.trim())this.results.append(make('p','',hits.length+' matches'+(hits.length>100?' · first 100 shown':'')));
    for(const hit of hits.slice(0,100)){const button=make('button','manuscript-result',hit.title+' · line '+hit.line+' · '+hit.context);button.type='button';button.addEventListener('click',()=>{const root=this.service.path;if(root)void this.deps.openChapter(root,hit.path,undefined,this.query.value.trim());});this.results.append(button);}
  }
  private async compile():Promise<void>{
    if(this.compiling)return;
    this.compiling=true;
    const revision=this.previewRevision;
    try {
      if(this.deps.dirty()||this.deps.session().save!=='saved')throw Error('Save the open chapter before reading the book through.');
      const selected=this.service.chapters.map(x=>x.path).filter(p=>this.selection.has(p));
      const verified=await this.service.previewVerified(selected);
      if(revision!==this.previewRevision)return;
      const text=compiledMarkdown(verified.chapters);
      this.reader??=createReader(this.page);
      this.reader.show(text,false);
      this.snapshot=verified;
      this.showInventory();this.pdfButton.disabled=false;this.guide();
      this.status.textContent='Previewing '+selected.length+' chapters · '+verified.chapters.reduce((n,x)=>n+x.words,0).toLocaleString()+' words. Export rechecks every source.';
    }catch(e){
      if(revision===this.previewRevision){this.clearPreview();this.status.textContent='Cannot read it through: '+String(e)+' Refresh chapters and try again.';}
    }finally{this.compiling=false;}
  }
}
