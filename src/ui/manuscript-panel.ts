import { ProjectService, type ProjectPorts, type ProjectSnapshot } from '../core/project-service';
import { searchProject } from '../core/project';
import { compiledMarkdown, renderProjectPdf } from '../export/project-pdf';
import { createReader, type ReaderView } from '../editor/reader';
import { ExportPreview, type PreviewElements } from './export-preview';
import type { ExportLayout } from '../export/layout';
import { previewInventory, type ProjectChangeError } from '../core/project-preview';
import { ProjectRelinkDialog } from './project-relink';

export interface ManuscriptDeps {
  host: HTMLElement;
  root(): string | null;
  chooseRoot(): Promise<string | null>;
  ports: ProjectPorts;
  openChapter(root: string, relative: string, heading?: string, phrase?: string): Promise<void>;
  dirty(): boolean;
  savePdf(name: string, bytes: Uint8Array, recheck?: () => Promise<void>): Promise<string | null>;
  notify(message: string): void;
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
/** All project data is disk-backed; a preview is an immutable selection of chapters. */
export class ManuscriptPanel {
  readonly root=make('aside','manuscript-panel');
  private service: ProjectService;
  private readonly status=make('p','manuscript-status','Choose a working folder to begin.');
  private readonly list=make('div','manuscript-list');
  private readonly health=make('section','manuscript-health');
  private readonly results=make('div','manuscript-results');
  private readonly page=make('div','manuscript-page');
  private readonly inventory=make('section','manuscript-inventory');
  private readonly query=make('input','manuscript-query');
  private readonly pdfButton=make('button','','Preview whole PDF');
  private readonly preview: ExportPreview;
  private readonly relink: ProjectRelinkDialog;
  private reader: ReaderView | null=null;
  private selection=new Set<string>();
  private snapshot: ProjectSnapshot | null=null;
  private busy=false;
  private refreshing=false;
  private returnFocus: HTMLElement | null=null;
  private refreshPdf: HTMLButtonElement | null=null;
  private pdfLayout: HTMLSelectElement | null=null;
  constructor(private readonly deps: ManuscriptDeps) {
    this.service=new ProjectService(deps.ports);
    this.relink=new ProjectRelinkDialog(deps.host,this.service,deps.notify,()=>{this.clearPreview();this.draw();this.drawHealth();});
    const heading=make('h2','','Manuscript');const close=make('button','','Close');close.type='button';
    const head=make('div','manuscript-head');head.append(heading,close);
    const refresh=make('button','','Refresh chapters');refresh.type='button';
    const check=make('button','','Check project health');check.type='button';
    const compile=make('button','','Compile selected chapters');compile.type='button';
    this.pdfButton.type='button';this.pdfButton.disabled=true;
    this.query.type='search';this.query.placeholder='Search every chapter';this.query.setAttribute('aria-label','Search the whole manuscript');
    this.status.setAttribute('role','status');this.inventory.setAttribute('aria-live','polite');
    this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
    this.root.setAttribute('aria-label','Whole manuscript');this.root.setAttribute('aria-hidden','true');
    this.inventory.setAttribute('aria-label','Compiled chapter inventory');
    this.health.setAttribute('aria-label','Project health');this.health.setAttribute('aria-live','polite');
    this.root.append(head,refresh,check,this.status,this.health,this.list,this.query,this.results,compile,this.pdfButton,this.inventory,this.page);
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
    close.addEventListener('click',()=>this.close());
    refresh.addEventListener('click',()=>void this.load());
    check.addEventListener('click',()=>void this.load(false));
    compile.addEventListener('click',()=>this.compile());
    this.pdfButton.addEventListener('click',()=>{if(this.snapshot)void this.preview.open(this.title());});
    this.query.addEventListener('input',()=>this.search());
  }
  get isOpen(): boolean {return this.root.classList.contains('is-open');}
  private markStale(error: ProjectChangeError): void {
    if(this.refreshPdf)this.refreshPdf.hidden=false;
    this.status.textContent='Export blocked: '+error.message+' Refresh preview to update the pages.';
    this.deps.notify(this.status.textContent);
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
      this.status.textContent='Preview refreshed · '+next.chapters.length+' chapters. Export will recheck the sources.';
      await this.preview.open(this.title());
    }catch(error){staged?.destroy();stage?.remove();this.status.textContent='Refresh failed: '+String(error)+' Old pages remain visible and cannot be exported.';this.preview.note(this.status.textContent);this.deps.notify(this.status.textContent);}
    finally {this.refreshing=false;if(this.refreshPdf)this.refreshPdf.disabled=false;}
  }
  private clearPreview(): void { this.snapshot=null;this.pdfButton.disabled=true;this.reader?.destroy();this.reader=null;this.page.replaceChildren();this.inventory.replaceChildren(); }
  async open(): Promise<void> {
    if(this.isOpen)return;
    this.returnFocus=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.root.classList.add('is-open');this.root.setAttribute('aria-hidden','false');
    await this.load();this.query.focus();
  }
  close(): boolean {
    if(this.relink.isOpen){this.relink.close();return true;}
    if(this.preview.isOpen){this.preview.close();return true;}
    if(!this.isOpen)return false;
    this.root.classList.remove('is-open');this.root.setAttribute('aria-hidden','true');
    if(this.returnFocus?.isConnected)this.returnFocus.focus();this.returnFocus=null;return true;
  }
  private title(): string {return this.service.path?.split(String.fromCharCode(92)).pop()?.split('/').pop()||'Manuscript';}
  private async load(persistOrder = true): Promise<void> {
    if(this.busy)return;this.busy=true;this.status.textContent='Reading the project…';
    const root=this.deps.root()??await this.deps.chooseRoot();
    try {
      if(!root){this.status.textContent='Choose a working folder to begin.';return;}
      await this.service.open(root,persistOrder);
      const paths=this.service.chapters.map(x=>x.path);
      this.selection=new Set([...this.selection].filter(p=>paths.includes(p)));
      if(!this.selection.size) this.selection=new Set(paths.filter(p=>this.service.chapters.find(x=>x.path===p)?.file));
      this.clearPreview();
      this.status.textContent=paths.length+' chapters · '+this.service.chapters.reduce((sum,x)=>sum+(x.file?.words??0),0).toLocaleString()+' words'+(this.service.chapters.some(x=>x.issue)?' · Resolve missing or unreadable files':'');
      this.draw();this.drawHealth();this.search();
    } catch(e){this.health.replaceChildren();this.status.textContent='Could not check manuscript: '+String(e);this.deps.notify(this.status.textContent);}
    finally{this.busy=false;}
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
    for(const entry of this.service.chapters){
      const row=make('div','manuscript-row');const check=make('input','');check.type='checkbox';check.checked=this.selection.has(entry.path);check.disabled=!entry.file;
      check.setAttribute('aria-label','Include '+entry.path);check.addEventListener('change',()=>{if(check.checked)this.selection.add(entry.path);else this.selection.delete(entry.path);this.clearPreview();});
      const label=make('button','manuscript-name',entry.file?.title??entry.path);label.type='button';label.disabled=!entry.file;
      label.addEventListener('click',()=>void this.deps.openChapter(root,entry.path));
      const meta=make('small','',entry.issue??(entry.file!.words.toLocaleString()+' words · '+entry.path));
      const up=make('button','','↑'),down=make('button','','↓');for(const button of [up,down])button.type='button';
      up.setAttribute('aria-label','Move '+entry.path+' earlier');down.setAttribute('aria-label','Move '+entry.path+' later');
      up.addEventListener('click',()=>void this.reorder(entry.path,-1));down.addEventListener('click',()=>void this.reorder(entry.path,1));
      row.append(check,label,meta,up,down);
      if(entry.issue){const repair=make('button','','Relink chapter');repair.type='button';repair.addEventListener('click',()=>void this.relink.open(entry.path));const remove=make('button','','Remove missing entry');remove.type='button';remove.addEventListener('click',()=>void this.remove(entry.path));row.append(repair,remove);}
      this.list.append(row);
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
  private compile():void{
    try {
      if(this.deps.dirty())throw Error('Save the open chapter before compiling.');
      const selected=this.service.chapters.map(x=>x.path).filter(p=>this.selection.has(p));
      this.snapshot=this.service.preview(selected);
      const text=compiledMarkdown(this.snapshot.chapters);
      this.reader??=createReader(this.page);
      this.reader.show(text,false);
      this.showInventory();this.pdfButton.disabled=false;
      this.status.textContent='Previewing '+selected.length+' chapters · '+this.snapshot.chapters.reduce((n,x)=>n+x.words,0).toLocaleString()+' words. Export rechecks every source.';
    }catch(e){this.snapshot=null;this.pdfButton.disabled=true;this.status.textContent='Cannot compile: '+String(e);}
  }
}
