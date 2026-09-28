import { describe, expect, it } from 'vitest';
import { chapterInfo } from '../src/core/project';
import { compiledMarkdown } from '../src/export/project-pdf';

describe('compiled manuscript text', () => {
  it('preserves chapter order, inserts visible breaks and avoids repeating a first title', () => {
    const one=chapterInfo('first.md',['# First','A sentence.'].join(String.fromCharCode(10)));
    const two=chapterInfo('second.md',['# Second','Another sentence.'].join(String.fromCharCode(10)));
    const text=compiledMarkdown([two,one]);
    expect(text.indexOf('# Second')).toBeLessThan(text.indexOf('# First'));
    expect(text.match(/# Second/g)).toHaveLength(1);
    expect(text).toContain('---');
    expect(one.text).toContain('# First');
  });
  it('keeps plain-text Markdown-looking characters literal in the compiled view', () => {
    const plain=chapterInfo('notes.txt','# literal title');
    const combined=compiledMarkdown([plain]);
    expect(combined).toContain('\\# literal title');
  });
});
