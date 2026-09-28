import { describe, expect, it } from 'vitest';
import { chapterInfo } from '../src/core/project';
import { rankRelinks, relinkOrder } from '../src/core/project-relink';
describe('explicit project relinking',()=>{
  it('offers ranked hints but never selects a file automatically',()=>{
    const a=chapterInfo('moved/Chapter 3.md','# Scene\nWords'),b=chapterInfo('drafts/Chapter 3.md','# Different\nWords');
    const hints=rankRelinks('old/Chapter 3.md',[b,a]);
    expect(hints).toHaveLength(2);expect(hints.every(h=>h.reason==='Same filename')).toBe(true);
    expect(hints.map(h=>h.path)).toEqual(['drafts/Chapter 3.md','moved/Chapter 3.md']);
  });
  it('replaces one missing path in place and rejects reuse or traversal',()=>{
    expect(relinkOrder(['a.md','missing.md','b.md'],'missing.md','sub/renamed.md')).toEqual(['a.md','sub/renamed.md','b.md']);
    expect(()=>relinkOrder(['a.md','missing.md'],'missing.md','a.md')).toThrow();
    expect(()=>relinkOrder(['missing.md'],'missing.md','../outside.md')).toThrow();
    expect(()=>rankRelinks('../outside.md',[])).toThrow();
  });
});
