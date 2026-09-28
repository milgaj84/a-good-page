import { describe, expect, it } from 'vitest';
import { chapterInfo } from '../src/core/project';
import { compiledMarkdown, chapterBody, projectPdfDocument } from '../src/export/project-pdf';

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
  it('removes only a leading Markdown display title, including H2, not literal text', () => {
    const lf=String.fromCharCode(10);
    expect(chapterBody(chapterInfo('a.md',['## Heading','Body','### Later'].join(lf)))).toBe('Body'+lf+'### Later');
    expect(chapterBody(chapterInfo('b.txt','# literal title'))).toBe('# literal title');
  });
  it('starts each later PDF chapter on a new page and retains prose structures', () => {
    const first=chapterInfo('one.md', ['# One','## Heading','- List item','','---','','Café — text'].join(String.fromCharCode(10)));
    const second=chapterInfo('two.md', '# Two'+String.fromCharCode(10)+'Final chapter');
    const pdf=projectPdfDocument([first,second],'Book','reading');
    const blocks=pdf.content as Array<{text?:unknown;pageBreak?:string}>;
    expect(blocks.filter(block=>block.pageBreak==='before')).toHaveLength(1);
    expect(JSON.stringify(blocks)).toContain('Café');
    expect(JSON.stringify(blocks)).toContain('List item');
    expect(JSON.stringify(blocks)).toContain('Heading');
    expect(JSON.stringify(blocks)).toContain('* * *');
  });
  it('keeps .txt Markdown-looking lines literal in the PDF', () => {
    const pdf=projectPdfDocument([chapterInfo('notes.txt','# literal title')],'Book','manuscript');
    expect(JSON.stringify(pdf.content)).toContain('# literal title');
  });
});
