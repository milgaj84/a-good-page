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
  it('rejects export when a source or order changes after preview', async () => {
    const t=fixture();await t.service.open('/book');const snap=t.service.preview(['a.md','b.md']);
    t.chapters.set('/book/a.md','# A\nNew words');
    await expect(t.service.verify(snap)).rejects.toThrow('changed on disk');
    t.chapters.set('/book/a.md','# A\nApple moon');t.setRaw('changed externally');
    await expect(t.service.verify(snap)).rejects.toThrow('Project order changed');
  });
});
