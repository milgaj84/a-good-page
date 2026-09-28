import { describe, expect, it } from 'vitest';
import { previewInventory, ProjectChangeError } from '../src/core/project-preview';
import { chapterInfo } from '../src/core/project';
describe('manuscript preview inventory', () => {
  it('reports precise chapter order, exclusions and numeric words', () => {
    const a = chapterInfo('a.md', '# A\nOnce upon a time');
    const b = chapterInfo('b.md', '# B\nThe end');
    const x = previewInventory([{path:'a.md',file:a,issue:null},{path:'b.md',file:b,issue:null}],
      {root:'/book',orderRaw:null,chapters:[b]});
    expect(x.included.map(v=>v.path)).toEqual(['b.md']);
    expect(x.included[0].order).toBe(1);
    expect(x.excluded).toEqual(['a.md']);
    expect(x.totalWords).toBe(b.words);
  });
  it('identifies changed file or order explicitly', () => {
    expect(new ProjectChangeError('content','a.md').message).toContain('a.md');
    expect(new ProjectChangeError('missing','b.md').path).toBe('b.md');
    expect(new ProjectChangeError('order','.a-good-page.json').message).toContain('order changed');
  });
});
