import { describe, expect, it } from 'vitest';
import { activeIndex, adjacentChapter, buildOutline, visibleOutline } from '../src/core/outline';

describe('buildOutline', () => {
  it('returns an empty outline for no headings', () => {
    expect(buildOutline([])).toEqual([]);
  });

  it('drops blank headings and tidies whitespace', () => {
    const items = buildOutline([
      { level: 1, text: '   ', pos: 0 },
      { level: 1, text: '  The   Beginning ', pos: 10 },
    ]);
    expect(items).toEqual([{ level: 1, text: 'The Beginning', pos: 10, depth: 0 }]);
  });

  it('indents relative to the highest heading used', () => {
    const items = buildOutline([
      { level: 2, text: 'Part One', pos: 0 },
      { level: 3, text: 'Scene', pos: 20 },
    ]);
    expect(items.map((i) => i.depth)).toEqual([0, 1]);
  });

  it('caps indentation depth', () => {
    const items = buildOutline([
      { level: 1, text: 'A', pos: 0 },
      { level: 6, text: 'B', pos: 5 },
    ]);
    expect(items[1].depth).toBe(2);
  });

  it('ignores invalid levels and positions', () => {
    const items = buildOutline([
      { level: 0, text: 'Zero', pos: 0 },
      { level: 1.5, text: 'Half', pos: 2 },
      { level: 1, text: 'Bad pos', pos: Number.NaN },
      { level: 1, text: 'Good', pos: 4 },
    ]);
    expect(items.map((i) => i.text)).toEqual(['Good']);
  });
});

describe('activeIndex', () => {
  const items = buildOutline([
    { level: 1, text: 'One', pos: 10 },
    { level: 1, text: 'Two', pos: 50 },
    { level: 1, text: 'Three', pos: 90 },
  ]);

  it('is -1 above the first heading or for an empty outline', () => {
    expect(activeIndex(items, 3)).toBe(-1);
    expect(activeIndex([], 100)).toBe(-1);
    expect(activeIndex(items, Number.NaN)).toBe(-1);
  });

  it('finds the section containing the caret', () => {
    expect(activeIndex(items, 10)).toBe(0);
    expect(activeIndex(items, 70)).toBe(1);
    expect(activeIndex(items, 5000)).toBe(2);
  });
});

 describe('chapter navigation and collapsed outline', () => {
   const items = buildOutline([{ level: 1, text: 'One', pos: 1 }, { level: 2, text: 'A', pos: 5 }, { level: 1, text: 'Two', pos: 20 }, { level: 2, text: 'B', pos: 24 }]);
   it('hides descendants only under collapsed headings', () => {
     expect(visibleOutline(items, new Set([1])).map(x => x.text)).toEqual(['One', 'Two', 'B']);
     expect(visibleOutline(items, new Set()).length).toBe(4);
   });
   it('jumps between top-level chapters without wrapping', () => {
     expect(adjacentChapter(items, 5, 1)?.text).toBe('Two');
     expect(adjacentChapter(items, 20, -1)?.text).toBe('One');
     expect(adjacentChapter(items, 20, 1)).toBeNull();
   });
 });
