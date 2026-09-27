import { describe, expect, it } from 'vitest';
import { fuzzyMatch, fuzzyRank } from '../src/core/fuzzy';

describe('fuzzy matching', () => {
  it('matches letters in order, ignoring case, and reports their positions', () => {
    expect(fuzzyMatch('chp', 'Chapter One')?.positions).toEqual([0, 1, 3]);
    expect(fuzzyMatch('CHAP', 'chapter')).not.toBeNull();
    expect(fuzzyMatch('pc', 'Chapter')).toBeNull();
    expect(fuzzyMatch('xyz', 'Chapter')).toBeNull();
  });
  it('treats an empty or blank query as a neutral match', () => {
    expect(fuzzyMatch('', 'Anything')).toEqual({ score: 0, positions: [] });
    expect(fuzzyMatch('   ', 'Anything')).toEqual({ score: 0, positions: [] });
  });
  it('ignores spaces in the query so words can be typed naturally', () => {
    expect(fuzzyMatch('ch two', 'Chapter Two')).not.toBeNull();
  });
  it('prefers prefixes, word starts and runs over scattered letters', () => {
    const prefix = fuzzyMatch('rain', 'Rain on the roof')!.score;
    const inside = fuzzyMatch('rain', 'The Drain')!.score;
    const scattered = fuzzyMatch('rain', 'Red apples in November')!.score;
    expect(prefix).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(scattered);
    expect(fuzzyMatch('ct', 'Chapter Two')!.score).toBeGreaterThan(fuzzyMatch('ct', 'Chestnut')!.score);
  });
  it('picks the best alignment rather than the first letters found', () => {
    expect(fuzzyMatch('two', 'the tower of two')!.positions).toEqual([13, 14, 15]);
  });
  it('ranks items, keeps input order on ties and respects a limit', () => {
    const items = ['Notes', 'Chapter Two', 'Chapter Ten', 'Epilogue'];
    expect(fuzzyRank('chapter', items, (x) => x).map((r) => r.item)).toEqual(['Chapter Two', 'Chapter Ten']);
    expect(fuzzyRank('', items, (x) => x).map((r) => r.item)).toEqual(items);
    expect(fuzzyRank('', items, (x) => x, 2)).toHaveLength(2);
    expect(fuzzyRank('e', items, (x) => x)[0].item).toBe('Epilogue');
  });
});
