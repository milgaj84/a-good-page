import { ManuscriptPanel } from '../ui/manuscript-panel';
import { chooseWorkingDirectory, listWorkingDirectory, openWorkingFile, readProjectOrder, writeProjectOrder, exportPdfFile } from '../adapters/tauri';
import type { DocumentSession } from '../core/session';
import type { WriterEditor } from '../editor/editor';
import { WorkspaceHistory } from '../core/workspace';
import { SafeStore, browserStorage } from '../adapters/storage';
/** One integration seam keeps the main writing composition root below its file limit. */
export function attachManuscript(host: HTMLElement, doc: DocumentSession, editor: WriterEditor,
  root: () => string | null, notify: (message: string) => void): ManuscriptPanel {
  const panel = new ManuscriptPanel({ host, root, chooseRoot: async () => {
    const selected = await chooseWorkingDirectory();
    if(selected)new WorkspaceHistory(new SafeStore(browserStorage())).select(selected);
    return selected;
  },
    ports: { list: listWorkingDirectory,
      read: (base,path) => openWorkingFile(base,path), order: readProjectOrder, saveOrder: writeProjectOrder },
    dirty: () => doc.isDirty,
    savePdf: exportPdfFile,
    notify,
    openChapter: async (base,relative,heading,phrase) => {
      const sep = base.includes(String.fromCharCode(92)) ? String.fromCharCode(92) : '/';
      const full = (base.endsWith(sep) ? base : base+sep)+relative.split('/').join(sep);
      if(!await doc.openWorkspacePath(base,full,openWorkingFile)) return;
      if(heading){const target=editor.headings().find(x=>x.text===heading);if(target)editor.jumpTo(target.pos);}
      else if(phrase){
        const needle=phrase.toLocaleLowerCase();let pos:number|null=null;
        editor.instance.state.doc.descendants((node,at)=>{if(pos===null&&node.isText){const offset=(node.text??'').toLocaleLowerCase().indexOf(needle);if(offset>=0)pos=at+offset;}});
        if(pos!==null)editor.jumpTo(pos);
      }
    },
  });
  const button=document.createElement('button');button.type='button';button.className='ghost';
  button.textContent='Manuscript';button.title='Whole manuscript: chapter order, search and PDF';
  const anchor=document.getElementById('btn-workspace');anchor?.parentElement?.insertBefore(button,anchor.nextSibling);
  button.addEventListener('click',()=>{if(panel.isOpen)panel.close();else void panel.open();});
  return panel;
}
