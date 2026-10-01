import { ManuscriptPanel } from '../ui/manuscript-panel';
import { PlaceTabs } from '../ui/project-guide';
import { chooseWorkingDirectory, listWorkingDirectory, openWorkingFile, readProjectOrder, writeProjectOrder, exportPdfFile } from '../adapters/tauri';
import type { AppAction } from '../core/commands';
import type { DocumentSession } from '../core/session';
import type { WriterEditor } from '../editor/editor';
import { WorkspaceHistory } from '../core/workspace';
import { SafeStore, browserStorage } from '../adapters/storage';
import { placeShortcut, saveWords, type NextAction, type Place } from '../core/workflow';

/** Palette/command entries for the three places; they share the tab and shortcut path. */
export type PlaceAction = Extract<AppAction, 'chapters' | 'writePage' | 'share'>;

const press = (id: string): void => document.getElementById(id)?.click();

/** 0.3.0 composition seam: one project page with three places, wired without growing main.ts.
 *  Chapters and Share reuse the hardened ManuscriptPanel; Write is the page itself. */
export function attachManuscript(host: HTMLElement, doc: DocumentSession, editor: WriterEditor,
  root: () => string | null, notify: (message: string) => void): ManuscriptPanel & { places: Record<PlaceAction, () => void> } {
  const session = () => { const snap = doc.snapshot(); return { save: snap.state, named: Boolean(snap.path) }; };
  const go = (place: Place): void => {
    if (place === 'write') { panel.close(); editor.focus(); }
    else void panel.show(place);
  };
  const act = (action: NextAction): void => {
    if (action === 'save') press('btn-save');
    else if (action === 'newChapter') { go('write'); press('btn-new'); }
    else go('write');
  };
  const panel: ManuscriptPanel = new ManuscriptPanel({ host, root, chooseRoot: async () => {
    const selected = await chooseWorkingDirectory();
    if(selected)new WorkspaceHistory(new SafeStore(browserStorage())).select(selected);
    return selected;
  },
    ports: { list: listWorkingDirectory,
      read: (base,path) => openWorkingFile(base,path), order: readProjectOrder, saveOrder: writeProjectOrder },
    dirty: () => doc.isDirty,
    savePdf: exportPdfFile,
    notify, session, act, go,
    openChapter: async (base,relative,heading,phrase) => {
      const sep = base.includes(String.fromCharCode(92)) ? String.fromCharCode(92) : '/';
      const full = (base.endsWith(sep) ? base : base+sep)+relative.split('/').join(sep);
      if(!await doc.openWorkspacePath(base,full,openWorkingFile)) return;
      go('write');
      if(heading){const target=editor.headings().find(x=>x.text===heading);if(target)editor.jumpTo(target.pos);}
      else if(phrase){
        const needle=phrase.toLocaleLowerCase();let pos:number|null=null;
        editor.instance.state.doc.descendants((node,at)=>{if(pos===null&&node.isText){const offset=(node.text??'').toLocaleLowerCase().indexOf(needle);if(offset>=0)pos=at+offset;}});
        if(pos!==null)editor.jumpTo(pos);
      }
    },
  });
  const top = new PlaceTabs('Places', go);
  top.root.classList.add('places--top');
  document.querySelector('.chrome--top .doc-title')?.after(top.root);
  // The top tabs follow the panel however it opens or closes (tabs, Esc, Back to writing, main-menu buttons).
  const follow = (): void => top.mark(panel.current);
  new MutationObserver(follow).observe(panel.root, { attributes: true, attributeFilter: ['class', 'data-place'] });
  follow();

  // Plain words beside the title; follows the save dot, which main.ts already keeps current.
  const words = document.createElement('span');
  words.id = 'save-words'; words.className = 'save-words'; words.setAttribute('role', 'status');
  const dot = document.getElementById('save-dot');
  document.getElementById('doc-name')?.after(words);
  const update = (): void => { const s = session(); words.textContent = saveWords(s.save, s.named); words.dataset.state = s.save; panel.guide(); };
  if (dot) new MutationObserver(update).observe(dot, { attributes: true, attributeFilter: ['data-state'] });
  const name = document.getElementById('doc-name');
  if (name) new MutationObserver(update).observe(name, { childList: true, characterData: true, subtree: true });
  update();

  // Ctrl/Cmd+Shift+1/2/3; the main keymap leaves these free, so nothing runs twice.
  window.addEventListener('keydown', event => {
    if (event.isComposing) return;
    const place = placeShortcut(event);
    if (!place) return;
    event.preventDefault(); event.stopPropagation(); go(place);
  }, true);
  return Object.assign(panel, { places: { chapters: () => go('chapters'), writePage: () => go('write'), share: () => go('share') } });
}
