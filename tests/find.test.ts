import { describe, expect, it } from 'vitest';
import { findMatches, nextMatch, matchAtOrAfter } from '../src/core/find';
import type { Node as PMNode } from '@tiptap/pm/model';
// Test with a tiny position-aware document; formatted runs remain adjacent.
function doc(parts: string[]) {
  return { descendants(fn: (node: any, pos: number) => boolean | void) {
    fn({ isTextblock: true, descendants(inner: (n: any, offset: number) => void) {
      let offset = 0; for (const text of parts) { inner({ isText: true, text }, offset); offset += text.length; }
    } }, 0);
  } } as unknown as PMNode;
}
describe('find across styled text', () => {
  it('finds across adjacent runs and ignores case', () => {
    expect(findMatches(doc(['Hello ', 'Wor', 'ld world']), 'WORLD')).toEqual([{ from: 7, to: 12 }, { from: 13, to: 18 }]);
  });
  it('handles empty, absent and repeated matches', () => {
    expect(findMatches(doc(['aaa']), '')).toEqual([]);
    expect(findMatches(doc(['aaa']), 'z')).toEqual([]);
    expect(findMatches(doc(['aaa']), 'a')).toHaveLength(3);
  });
  it('resumes after inserted text and wraps to the first surviving match', () => {
    const matches = [{ from: 3, to: 6 }, { from: 20, to: 23 }];
    expect(matchAtOrAfter(matches, 6)).toBe(1);
    expect(matchAtOrAfter(matches, 24)).toBe(0);
    expect(matchAtOrAfter([], 0)).toBe(-1);
    // A replacement containing the query at position 3 is skipped once.
    expect(matchAtOrAfter([{ from: 3, to: 6 }, { from: 20, to: 23 }], 9)).toBe(1);
  });
  it('supports case, whole-word boundaries and literal punctuation', () => {
    expect(findMatches(doc(['Cat cat catfish cat_cat CAT']), 'cat', { matchCase: true, wholeWord: true })).toHaveLength(1);
    expect(findMatches(doc(['Cat cat catfish cat_cat CAT']), 'cat', { wholeWord: true })).toHaveLength(3);
    expect(findMatches(doc(['a.b a+b a.b']), 'a.b')).toHaveLength(2);
    expect(findMatches(doc(['café caféine café']), 'café', { wholeWord: true })).toHaveLength(2);
  });
  it('cycles forward and backward', () => {
    const matches = [{ from: 1, to: 2 }, { from: 8, to: 9 }];
    expect(nextMatch(matches, 8, 1)).toBe(0);
    expect(nextMatch(matches, 1, -1)).toBe(1);
    expect(nextMatch([], 0, 1)).toBe(-1);
  });
});
