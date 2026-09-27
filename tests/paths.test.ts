import { describe, expect, it } from 'vitest';
import { isPlainTextPath, isWritingFile } from '../src/core/paths';

describe('isWritingFile', () => {
  it('accepts markdown and text files in any case', () => {
    expect(isWritingFile('/home/me/story.md')).toBe(true);
    expect(isWritingFile('C:\\Books\\Chapter 1.MARKDOWN')).toBe(true);
    expect(isWritingFile('notes.v2.Txt')).toBe(true);
  });

  it('rejects other files, folders and hidden dot-files', () => {
    expect(isWritingFile('cover.png')).toBe(false);
    expect(isWritingFile('README')).toBe(false);
    expect(isWritingFile('.md')).toBe(false);
    expect(isWritingFile('drafts.md/')).toBe(false);
  });

  it('handles empty and missing input', () => {
    expect(isWritingFile('')).toBe(false);
    expect(isWritingFile(null)).toBe(false);
    expect(isWritingFile(undefined)).toBe(false);
  });
});

describe('isPlainTextPath', () => {
  it('recognizes txt case-insensitively', () => { expect(isPlainTextPath('a.TXT')).toBe(true); });
  it('leaves Markdown unchanged', () => { expect(isPlainTextPath('a.md')).toBe(false); });
});
