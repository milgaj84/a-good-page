import { describe, expect, it } from 'vitest';
import { chapterInfo } from '../src/core/project';
import { shareOverview } from '../src/core/share-overview';
const a=chapterInfo('a.md','# A\nOne two three');
const b=chapterInfo('b.md','# B\nFour five');
const entries=[{path:'a.md',file:a,issue:null},{path:'b.md',file:b,issue:null},{path:'lost.md',file:null,issue:'Missing'}];
describe('share overview',()=>{
  it('counts selected readable words, not whole-book words',()=>{
    const result=shareOverview(entries,new Set(['b.md','lost.md']),'none');
    expect(result).toEqual({selected:1,words:b.words,available:2,blocked:1,state:'repair'});
  });
  it('handles empty selection and preview transitions without rounding or guessing',()=>{
    const readable=entries.slice(0,2);
    expect(shareOverview(readable,new Set(),'ready').state).toBe('choose');
    expect(shareOverview(readable,new Set(['a.md']),'none')).toMatchObject({selected:1,words:a.words,state:'read'});
    expect(shareOverview(readable,new Set(['a.md']),'stale').state).toBe('refresh');
    expect(shareOverview(readable,new Set(['a.md']),'ready').state).toBe('export');
  });
  it('does not mutate the source selection',()=>{
    const selection=new Set(['a.md']);shareOverview(entries,selection,'ready');
    expect([...selection]).toEqual(['a.md']);
  });
});
