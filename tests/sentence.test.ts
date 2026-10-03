import { describe, expect, it } from 'vitest';
import { sentenceAt } from '../src/core/sentence';
describe('sentence focus boundaries', () => {
  it('handles empty blocks and clamps out-of-range cursors', () => {
    expect(sentenceAt('', 99)).toEqual({ from: 0, to: 0 });
    expect(sentenceAt('Hello.', -4)).toEqual({ from: 0, to: 6 });
  });
  it('chooses the sentence at the caret', () => {
    expect(sentenceAt('First sentence. Second one! Third?', 19)).toEqual({ from: 16, to: 27 });
  });
  it('does not split decimal punctuation or marks inside words', () => {
    expect(sentenceAt('Pi is 3.14 today. Next.', 8)).toEqual({ from: 0, to: 17 });
  });
});
describe('sentence ends followed by closing quotes or brackets', () => {
  it('splits dialogue after a closing quote', () => {
    const text = '“I’m done.” She left.';
    expect(sentenceAt(text, 3)).toEqual({ from: 0, to: 11 });
    expect(sentenceAt(text, 16)).toEqual({ from: 12, to: text.length });
    expect(sentenceAt('"I\'m done." She left.', 3)).toEqual({ from: 0, to: 11 });
  });
  it('splits after a closing bracket', () => {
    expect(sentenceAt('(See above.) Next one.', 14)).toEqual({ from: 13, to: 22 });
    expect(sentenceAt('(See above.) Next one.', 3)).toEqual({ from: 0, to: 12 });
  });
});
