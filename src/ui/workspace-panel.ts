import { WorkspaceHistory, filterWorkspaceItems, nextWorkspaceIndex } from '../core/workspace';
import type { WorkspaceEntry, WorkspaceListing } from '../adapters/tauri';

export interface WorkspaceElements {
  root: HTMLElement; toggle: HTMLButtonElement; choose: HTMLButtonElement; refresh: HTMLButtonElement;
  recent: HTMLElement; label: HTMLElement; up: HTMLButtonElement; search: HTMLInputElement;
  contents: HTMLElement; status: HTMLElement;
}
export interface WorkspaceServices {
  pick(): Promise<string | null>;
  list(root: string, directory?: string): Promise<WorkspaceListing>;
  open(root: string, path: string): Promise<boolean>;
  report(message: string): void;
}
/** Browse one folder at a time. Opening files delegates dirty-work handling to DocumentSession. */
export class WorkspacePanel {
  private currentRoot: string | null = null;
  private trail: { name: string; path: string }[] = [];
  private activeFile: string | null = null;
  private request = 0;
  private busy = false;
  constructor(private readonly els: WorkspaceElements, private readonly history: WorkspaceHistory,
    private readonly services: WorkspaceServices) {
    els.root.setAttribute('aria-hidden','true');
    els.toggle.addEventListener('click', () => this.toggle());
    els.choose.addEventListener('click', () => void this.choose());
    els.refresh.addEventListener('click', () => void this.refresh());
    els.up.addEventListener('click', () => void this.up());
    els.search.addEventListener('input', () => this.renderItems());
    els.search.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        const first=this.els.contents.querySelector<HTMLButtonElement>('button[data-index]');
        if (first) { event.preventDefault(); first.focus(); }
      } else if (event.key === 'Enter') {
        const choices=this.els.contents.querySelectorAll<HTMLButtonElement>('button[data-index]');
        if (choices.length===1) { event.preventDefault(); choices[0].click(); }
      }
    });
    els.contents.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const buttons=[...els.contents.querySelectorAll<HTMLButtonElement>('button[data-index]')];
      const index=buttons.indexOf(event.target as HTMLButtonElement);
      if (index<0) return;
      event.preventDefault();buttons[nextWorkspaceIndex(index,buttons.length,event.key==='ArrowDown'?1:-1)].focus();
    });
    els.label.addEventListener('click', event => {
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-depth]');
      if (button) void this.goto(Number(button.dataset.depth));
    });
    els.recent.addEventListener('click', e => {
      const remove=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-remove]');
      if (remove) { this.history.forget(remove.dataset.remove ?? ''); this.renderRecent(); return; }
      const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-root]');
      if (button) void this.selectRoot(button.dataset.root ?? '');
    });
    els.contents.addEventListener('click', e => {
      const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
      const item=button ? this.items[Number(button.dataset.index)] : undefined;
      if (item) void this.activate(item);
    });
    this.renderRecent(); this.renderEmpty();
  }
  private items: WorkspaceEntry[] = [];
  get isOpen(): boolean { return this.els.root.classList.contains('is-open'); }
  get directory(): string | null { return this.trail[this.trail.length-1]?.path ?? null; }
  async refresh(): Promise<void> {
    const target=this.directory;
    if (!this.currentRoot || !target) return;
    const ticket=++this.request;
    try { const listing=await this.services.list(this.currentRoot,target);if(ticket===this.request)this.render(listing); }
    catch(error) { if(ticket===this.request)this.fail(error); }
  }
  toggle(): void {
    const open=!this.isOpen;
    this.els.root.classList.toggle('is-open',open);
    this.els.root.setAttribute('aria-hidden',String(!open));
    this.els.toggle.setAttribute('aria-expanded',String(open));
    if (open) this.els.choose.focus(); else this.els.toggle.focus();
  }
  clearFilter(): boolean { if (!this.isOpen || !this.els.search.value) return false; this.els.search.value=''; this.renderItems(); this.els.search.focus(); return true; }
  close(): boolean { if (!this.isOpen) return false; this.toggle(); return true; }
  async restore(): Promise<void> {
    const root=this.history.active;
    if (root) await this.selectRoot(root, false);
  }
  markActive(path: string | null): void {
    this.activeFile=path;
    this.els.contents.querySelectorAll<HTMLButtonElement>('button[data-path]').forEach(button => {
      if (button.dataset.path === path) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }
  private async choose(): Promise<void> {
    const ticket=++this.request;
    try { const path=await this.services.pick(); if (path && ticket===this.request) await this.selectRoot(path); }
    catch (error) { if(ticket===this.request)this.fail(error); }
  }
  private async selectRoot(path: string, persist = true): Promise<void> {
    if (!path.trim()) return;
    const ticket=++this.request;
    this.els.status.textContent='Opening folder…';
    try {
      const listing=await this.services.list(path);
      if (ticket !== this.request) return;
      this.currentRoot=listing.root;this.trail=[{ name:this.basename(listing.root), path:listing.root }];
      if (persist) this.history.select(listing.root);
      this.renderRecent();this.render(listing,true);
    } catch (error) {
      if (ticket===this.request) {
        this.fail(error);
      }
    }
  }
  private async activate(item: WorkspaceEntry): Promise<void> {
    if (item.is_dir) {
      if (!this.currentRoot) return;
      const ticket=++this.request;
      this.els.status.textContent='Opening folder…';
      try {
        const listing=await this.services.list(this.currentRoot,item.path);
        if (ticket!==this.request) return;
        this.trail.push({name:item.name,path:listing.directory});this.render(listing,true);
      } catch (error) { if (ticket===this.request) this.fail(error); }
      return;
    }
    if (this.busy || !this.currentRoot) return;
    this.busy=true;
    const root=this.currentRoot;
    try { if (await this.services.open(root, item.path) && this.currentRoot===root) this.markActive(item.path); }
    catch (error) { this.fail(error); }
    finally { this.busy=false; }
  }
  private async up(): Promise<void> { await this.goto(this.trail.length-2); }
  private async goto(depth: number): Promise<void> {
    if (!this.currentRoot || depth<0 || depth>=this.trail.length-1) return;
    const ticket=++this.request;
    const target=this.trail[depth];
    try {
      const listing=await this.services.list(this.currentRoot,target.path);
      if (ticket!==this.request) return;
      this.trail=this.trail.slice(0,depth+1);this.render(listing,true);
    } catch (error) { if(ticket===this.request)this.fail(error); }
  }
  private render(listing: WorkspaceListing, newFolder = false): void {
    this.items=listing.entries;
    if (newFolder) this.els.search.value='';
    const crumbs=document.createDocumentFragment();
    this.trail.forEach((item,depth) => { const button=document.createElement('button');button.type='button';button.dataset.depth=String(depth);button.textContent=item.name;button.title=item.path;button.disabled=depth===this.trail.length-1;crumbs.append(button); });
    this.els.label.replaceChildren(crumbs);
    this.els.label.title=listing.directory;
    this.els.up.disabled=this.trail.length<2;
    const files=listing.entries.filter(item=>!item.is_dir).length;
    const folders=listing.entries.length-files;
    this.els.status.textContent=listing.entries.length ? folders+' folders · '+files+' writing files' : 'No writing files or subfolders here.';
    this.els.toggle.title='Workspace · '+this.basename(listing.root);
    this.renderItems();
  }
  private renderItems(): void {
    const query=this.els.search.value.trim().toLocaleLowerCase();
    const fragment=document.createDocumentFragment();
    let visible=0;
    const filtered=filterWorkspaceItems(this.items,query);
    this.items.forEach((item,index) => {
      if (!filtered.includes(item)) return;
      visible++;
      const button=document.createElement('button');button.type='button';button.className='workspace-entry';
      button.dataset.index=String(index);button.dataset.path=item.path;
      const icon=document.createElement('span');icon.className='workspace-icon';icon.textContent=item.is_dir?'▸':'·';
      const name=document.createElement('span');name.textContent=item.name;
      button.append(icon,name);
      if (!item.is_dir && item.path===this.activeFile) button.setAttribute('aria-current','page');
      fragment.append(button);
    });
    this.els.contents.replaceChildren(fragment);
    if (query) this.els.status.textContent=visible+' of '+this.items.length+' items match';
  }
  private renderEmpty(): void { this.els.label.textContent='No working directory';this.els.up.disabled=true;this.els.status.textContent='Choose a folder to see its writing files.'; }
  private renderRecent(): void {
    const fragment=document.createDocumentFragment();
    for(const path of this.history.recent) {
      const group=document.createElement('span');group.className='workspace-recent-item';
      const button=document.createElement('button');button.type='button';button.dataset.root=path;
      button.textContent=this.basename(path);button.title=path;
      if(path===this.currentRoot)button.setAttribute('aria-current','true');
      const remove=document.createElement('button');remove.type='button';remove.dataset.remove=path;
      remove.textContent='×';remove.title='Remove '+this.basename(path)+' from recent folders';
      remove.setAttribute('aria-label',remove.title);group.append(button,remove);fragment.append(group);
    }
    this.els.recent.replaceChildren(fragment);
  }
  private basename(path: string): string { return path.split(/[\\/]/).filter(Boolean).pop() ?? path; }
  private fail(error: unknown): void { const message=error instanceof Error?error.message:String(error);this.els.status.textContent=message;this.services.report(message); }
}
