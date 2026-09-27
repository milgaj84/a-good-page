import { describe, expect, it } from 'vitest';
import { countWords, formatCount, formatSelection, formatStats, readingMinutes } from '../src/core/stats';

describe('countWords', () => {
  it('returns 0 for empty, blank, null and undefined', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t ')).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords(undefined)).toBe(0);
  });

  it('counts words separated by any whitespace', () => {
    expect(countWords('The quick\nbrown\t\tfox')).toBe(4);
  });

  it('ignores punctuation-only tokens like em dashes', () => {
    expect(countWords('Wait — what ?')).toBe(2);
  });

  it('counts accented and non-latin words and numbers', () => {
    expect(countWords('café naïve Привет 1984')).toBe(4);
  });
});

describe('readingMinutes', () => {
  it('is 0 for zero, negative or NaN words', () => {
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(-5)).toBe(0);
    expect(readingMinutes(Number.NaN)).toBe(0);
  });

  it('rounds up and is at least one minute for any words', () => {
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(230)).toBe(1);
    expect(readingMinutes(231)).toBe(2);
  });

  it('rejects non-positive or invalid wpm', () => {
    expect(() => readingMinutes(10, 0)).toThrow(RangeError);
    expect(() => readingMinutes(10, -1)).toThrow(RangeError);
    expect(() => readingMinutes(10, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('formatStats', () => {
  it('shows only the count when empty', () => {
    expect(formatStats(0)).toBe('0 words');
  });

  it('uses the singular for one word', () => {
    expect(formatStats(1)).toBe('1 word · 1 min read');
  });

  it('adds thousands separators', () => {
    expect(formatStats(1234)).toBe('1,234 words · 6 min read');
  });

  it('treats invalid counts as zero', () => {
    expect(formatStats(-3)).toBe('0 words');
    expect(formatStats(Number.NaN)).toBe('0 words');
  });
});

describe('formatCount', () => {
  it('adds separators and treats invalid values as zero', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(-1)).toBe('0');
    expect(formatCount(Number.NaN)).toBe('0');
  });
});

describe('formatSelection', () => {
  it('shows selected out of total words', () => {
    expect(formatSelection(12, 1234)).toBe('12 of 1,234 words selected');
  });

  it('uses the singular when the total is one', () => {
    expect(formatSelection(1, 1)).toBe('1 of 1 word selected');
  });

  it('never shows more selected than total', () => {
    expect(formatSelection(5, 2)).toBe('5 of 5 words selected');
  });
});
