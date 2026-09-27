import { describe, expect, it } from 'vitest';
import { DocumentSession, type OpenedDocument } from '../src/core/session';
function setup() {
  let content='Draft'; let allow=false; let asked=0;
  const editor={ getMarkdown:()=>content,setMarkdown:(text:string)=>{content=text;},focus:()=>undefined };
  const session=new DocumentSession({ editor,
    files:{pickOpenPath:async()=>null,pickSavePath:async()=>null,read:async()=>{throw Error('unscoped read');},write:async path=>path},
    prompter:{confirmDiscard:async()=>{asked++;return allow;}},
    drafts:{load:()=>null,save:()=>undefined,clear:()=>undefined},
    events:{onChange:()=>undefined,onError:()=>undefined},
  });
  return { session,editor,content:()=>content,allow:()=>{allow=true;},asked:()=>asked };
}
describe('workspace-scoped document switches', () => {
  it('refuses to invoke a scoped read while dirty words are kept', async () => {
    const x=setup();x.session.markEdited();let reads=0;
    expect(await x.session.openWorkspacePath('/books','/books/new.md',async()=>{reads++;throw Error('unexpected');})).toBe(false);
    expect(reads).toBe(0);expect(x.content()).toBe('Draft');expect(x.asked()).toBe(1);
  });
  it('hands the exact root and path to the scoped reader after confirmation', async () => {
    const x=setup();x.session.markEdited();x.allow();
    const requests:string[]=[];
    const read=async(root:string,path:string):Promise<OpenedDocument>=>{
      requests.push(root,path);return {path,name:'new',content:'New manuscript'};
    };
    expect(await x.session.openWorkspacePath('/books','/books/new.md',read)).toBe(true);
    expect(requests).toEqual(['/books','/books/new.md']);expect(x.content()).toBe('New manuscript');
  });
  it('rejects a late scoped read after new edits', async () => {
    const x=setup();let release:((doc:OpenedDocument)=>void)=()=>undefined;
    const waiting=new Promise<OpenedDocument>(resolve=>{release=resolve;});
    const pending=x.session.openWorkspacePath('/books','/books/new.md',async()=>waiting);
    await Promise.resolve();x.editor.setMarkdown('Newest words');x.session.markEdited();
    release({path:'/books/new.md',name:'new',content:'Older result'});
    expect(await pending).toBe(false);expect(x.content()).toBe('Newest words');
  });
});
