import { describe, expect, it } from 'vitest';
import { ProjectService } from '../src/core/project-service';
function fixture() {
  const chapters = new Map([['/book/a.md','# A\nApple moon'],['/book/b.md','# B\nBlue moon']]);
  let raw: string | null = null;
  const io = {
    list: async (_root: string, _folder?: string) => ({ root: '/book', directory: '/book', entries: [...chapters.keys()].map(path => ({ path, name: path.split('/').pop()!, is_dir: false })) }),
    read: async (_root: string, path: string) => { const text=chapters.get(path); if(text===undefined)throw Error('missing');return {content:text}; },
    order: async () => raw,
    saveOrder: async (_root: string, expected: string | null, value: string) => {
      if(expected!==raw)throw Error('AGP_PROJECT_CHANGED'); raw=value;return value;
    },
  };
  return { chapters, io, service: new ProjectService(io), get manifestRaw() { return raw; }, setRaw(value: string) {raw=value;} };
}
describe('project loading and export safety', () => {
  it('loads every chapter and saves order without modifying a chapter', async () => {
    const t=fixture(); await t.service.open('/book');
    expect(t.service.chapters.map(c=>c.path)).toEqual(['a.md','b.md']);
    expect(t.manifestRaw).toContain('a.md');
    await t.service.move('b.md',-1);
    expect(t.service.chapters.map(c=>c.path)).toEqual(['b.md','a.md']);
    expect(t.chapters.get('/book/b.md')).toBe('# B\nBlue moon');
  });
  it('blocks missing chapter instead of silently omitting it', async () => {
    const t=fixture();t.setRaw(JSON.stringify({version:1,chapters:['a.md','lost.md']}));
    await t.service.open('/book');
    expect(t.service.chapters.find(c=>c.path==='lost.md')?.issue).toBeTruthy();
    expect(()=>t.service.preview(['a.md'])).toThrow('missing or unreadable');
    await t.service.omitMissing('lost.md'); expect(t.service.chapters).toHaveLength(2);
  });
  it('fails closed when a subfolder cannot be read', async () => {
    const t=fixture();
    t.io.list=async (_root: string, folder?: string) => {
      if(folder)throw Error('folder disconnected');
      return { root:'/book', directory:'/book', entries:[{path:'/book/drafts',name:'drafts',is_dir:true}] };
    };
    await expect(t.service.open('/book')).rejects.toThrow('folder disconnected');
  });
  it('identifies an unreadable chapter and a changed order file by name', async () => {
    const t=fixture();await t.service.open('/book');const snap=t.service.preview(['a.md','b.md']);
    t.chapters.delete('/book/b.md');
    await expect(t.service.verify(snap)).rejects.toMatchObject({ kind: 'missing', path: 'b.md' });
    t.io.order=async()=>{throw Error('drive unavailable');};
    await expect(t.service.verify(snap)).rejects.toMatchObject({ kind: 'order', path: '.a-good-page.json' });
  });
  it('relinks a missing chapter without moving files or changing its position', async () => {
    const t=fixture();t.setRaw(JSON.stringify({version:1,chapters:['a.md','missing.md','b.md']}));
    t.chapters.set('/book/elsewhere/missing.md','# Recovered\nWords');
    t.io.list=async()=>({root:'/book',directory:'/book',entries:[...t.chapters.keys()].map(path=>({path,name:path.replace('/book/',''),is_dir:false}))});
    await t.service.open('/book');
    const {candidates,files}=await t.service.relinkCandidates('missing.md');
    expect(candidates.map(x=>x.path)).toEqual(['elsewhere/missing.md']);
    await t.service.relink('missing.md',candidates[0].path,files.get(candidates[0].path)!.text);
    expect(t.service.chapters.map(x=>x.path)).toEqual(['a.md','elsewhere/missing.md','b.md']);
    expect(t.chapters.get('/book/elsewhere/missing.md')).toContain('Recovered');
  });
  it('rejects stale replacement contents and a competing order-file edit', async () => {
    const t=fixture();t.setRaw(JSON.stringify({version:1,chapters:['a.md','gone.md']}));
    t.chapters.set('/book/new.md','# Replacement');await t.service.open('/book');
    const {files}=await t.service.relinkCandidates('gone.md');
    t.chapters.set('/book/new.md','# Changed');
    await expect(t.service.relink('gone.md','new.md',files.get('new.md')!.text)).rejects.toThrow('changed during review');
    t.chapters.set('/book/new.md','# Replacement');t.setRaw('outside change');
    await expect(t.service.relink('gone.md','new.md','# Replacement')).rejects.toThrow('AGP_PROJECT_CHANGED');
    expect(t.service.chapters.map(x=>x.path)).toContain('gone.md');
  });
  it('keeps relative paths usable when the project folder moves', async () => {
    const t=fixture();await t.service.open('/book');const order=t.manifestRaw;
    const moved=new ProjectService({list:async()=>({root:'/new-place',directory:'/new-place',entries:[
      {path:'/new-place/a.md',name:'a.md',is_dir:false},{path:'/new-place/b.md',name:'b.md',is_dir:false}]}),
      read:async(_root,path)=>({content:t.chapters.get(path.replace('/new-place','/book'))!}),
      order:async()=>order,saveOrder:async(_root,_expected,value)=>value});
    await moved.open('/new-place');expect(moved.chapters.map(x=>x.path)).toEqual(['a.md','b.md']);
    expect(moved.chapters.every(x=>x.file!==null)).toBe(true);
  });
  it('scans new chapters without saving the manifest in health-check mode', async () => {
    const t=fixture();await t.service.open('/book');const original=t.manifestRaw;
    t.chapters.set('/book/new.md','# Newly arrived');
    await t.service.open('/book',false);
    expect(t.manifestRaw).toBe(original);
    expect(t.service.health().issues.map(x=>x.kind+':'+x.path)).toContain('untracked:new.md');
    await t.service.open('/book');
    expect(t.manifestRaw).toContain('new.md');
    expect(t.service.health().issues).toEqual([]);
  });
  it('rejects export when a source or order changes after preview', async () => {
    const t=fixture();await t.service.open('/book');const snap=t.service.preview(['a.md','b.md']);
    t.chapters.set('/book/a.md','# A\nNew words');
    await expect(t.service.verify(snap)).rejects.toThrow('changed on disk');
    t.chapters.set('/book/a.md','# A\nApple moon');t.setRaw('changed externally');
    await expect(t.service.verify(snap)).rejects.toThrow('Project order changed');
  });
});
