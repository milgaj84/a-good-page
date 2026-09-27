import { describe, expect, it } from 'vitest';
import { polishSegments, polishText, polishMarkdownSource } from '../src/core/smart-text';

describe('smart punctuation', () => {
  it('turns double hyphens into em dashes and three dots into an ellipsis', () => {
    expect(polishText('Wait -- listen...')).toBe('Wait — listen…');
    expect(polishText('so--then')).toBe('so—then');
  });
  it('leaves longer runs of hyphens and dots alone', () => {
    expect(polishText('---')).toBe('---');
    expect(polishText('a ---- b')).toBe('a ---- b');
    expect(polishText('hmm....')).toBe('hmm....');
  });
  it('curls double quotes by position', () => {
    expect(polishText('He said "hello" twice.')).toBe('He said “hello” twice.');
    expect(polishText('"Go," she said.')).toBe('“Go,” she said.');
    expect(polishText('("quoted")')).toBe('(“quoted”)');
  });
  it('curls single quotes and apostrophes', () => {
    expect(polishText("don't")).toBe('don’t');
    expect(polishText("'Quiet,' he said.")).toBe('‘Quiet,’ he said.');
    expect(polishText("the '90s")).toBe('the ’90s');
    expect(polishText("the writers' room")).toBe('the writers’ room');
  });
  it('is idempotent and leaves text without straight marks unchanged', () => {
    const once = polishText('"It\'s -- well..." she said.');
    expect(once).toBe('“It’s — well…” she said.');
    expect(polishText(once)).toBe(once);
    expect(polishText('Plain words.')).toBe('Plain words.');
  });
});

describe('segments with code', () => {
  it('never touches code but uses its neighbours for quote direction', () => {
    const out = polishSegments([
      { text: 'Run "', code: false },
      { text: 'npm --help "x"', code: true },
      { text: '" now...', code: false },
    ]);
    expect(out).toEqual(['Run “', 'npm --help "x"', '” now…']);
  });
  it('joins a double hyphen split across formatting', () => {
    expect(polishSegments([{ text: 'yes -', code: false }, { text: '- no', code: false }])).toEqual(['yes —', ' no']);
  });
  it('returns the same number of segments', () => {
    expect(polishSegments([])).toEqual([]);
    expect(polishSegments([{ text: '', code: false }])).toEqual(['']);
  });
});

describe('polishMarkdownSource', () => {
  it('polishes pasted Markdown but leaves inline code and fenced code alone', () => {
    const source = 'He said "wait..." -- then `"raw" -- x`\n```\nlet s = "a" -- b...\n```\nDone...';
    expect(polishMarkdownSource(source)).toBe('He said “wait…” — then `"raw" -- x`\n```\nlet s = "a" -- b...\n```\nDone…');
  });
  it('treats an unclosed fence as code to the end', () => {
    expect(polishMarkdownSource('"a"\n```\n"b"')).toBe('“a”\n```\n"b"');
  });
});
