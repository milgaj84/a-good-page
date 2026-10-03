import { describe, expect, it } from 'vitest';
import { docxBytes } from '../src/export/docx';
import { epubBytes } from '../src/export/epub';
import type { ProseNode } from '../src/export/pdf';
import { unzipStored } from '../src/export/zip';
import { importDocx, type DocxParts } from '../src/import/docx';
import { sanitizeExportOptions } from '../src/core/export-options';

const text = (t: string, marks: Array<{ type: string; attrs?: Record<string, unknown> }> = []): ProseNode => ({ type: 'text', text: t, marks });
const para = (...c: ProseNode[]): ProseNode => ({ type: 'paragraph', content: c });
const files = (bytes: Uint8Array) => Object.fromEntries(unzipStored(bytes).map(e => [e.name, new TextDecoder().decode(e.data)]));
const wellFormed = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length === 0;

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const run = (t: string, props = '') => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const p = (inner: string, style = '', extra = '') => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>${inner}</w:p>`;
const word = (body: string, extra: Partial<DocxParts> = {}): DocxParts => ({ document: `<w:document ${NS}><w:body>${body}</w:body></w:document>`, rels: '', numbering: '', ...extra });

describe('Word import', () => {
  it('reads back what A Good Page writes: chapters, emphasis, links, lists and quotes', () => {
    const bytes = docxBytes([
      { title: 'The Harbour', doc: { type: 'doc', content: [
        para(text('Plain, '), text('bold', [{ type: 'bold' }]), text(' and '), text('italic', [{ type: 'italic' }]), text(' with a '), text('link', [{ type: 'link', attrs: { href: 'https://example.com/a' } }]), text('.')),
        { type: 'heading', attrs: { level: 2 }, content: [text('Evening')] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [para(text('one'))] }, { type: 'listItem', content: [para(text('two'))] }] },
        { type: 'orderedList', content: [{ type: 'listItem', content: [para(text('first'))] }] },
        { type: 'blockquote', content: [para(text('A quote.'))] },
        { type: 'horizontalRule' },
      ] } },
      { title: 'Low Tide', doc: { type: 'doc', content: [para(text('Second chapter.'))] } },
    ], { title: 'My Book' });
    const f = files(bytes);
    const book = importDocx({ document: f['word/document.xml'], rels: f['word/_rels/document.xml.rels'], numbering: f['word/numbering.xml'] }, 'fallback');
    expect(book.pages.map(x => x.title)).toEqual(['The Harbour', 'Low Tide']);
    const first = book.pages[0].markdown;
    expect(first).toContain('# The Harbour\n');
    expect(first).toContain('Plain, **bold** and *italic* with a [link](https://example.com/a).');
    expect(first).toContain('## Evening');
    expect(first).toContain('- one\n- two');
    expect(first).toContain('1. first');
    expect(first).toContain('> A quote.');
    expect(first).toContain('---');
    expect(book.pages[1].markdown).toBe('# Low Tide\n\nSecond chapter.\n');
  });

  it('starts a page at each Heading 1, takes a Title paragraph as the book title, and keeps earlier words as front matter', () => {
    const book = importDocx(word(
      p(run('My Novel'), 'Title') + p(run('Dedicated to you.')) +
      p(run('One'), 'Heading1') + p(run('It began.')) + p(run('Night'), 'Heading2') + p(run('Dark.')) +
      p(run('Two'), 'Heading1') + p(run('It went on.')),
    ), 'x');
    expect(book.title).toBe('My Novel');
    expect(book.pages.map(x => x.title)).toEqual(['Front matter', 'One', 'Two']);
    expect(book.pages[1].markdown).toBe('# One\n\nIt began.\n\n## Night\n\nDark.\n');
  });

  it('treats a lone Heading 1 as the book title when chapters are Heading 2', () => {
    const book = importDocx(word(p(run('The Book'), 'Heading1') + p(run('A'), 'Heading2') + p(run('a text')) + p(run('B'), 'Heading2') + p(run('b text')) + p(run('Part'), 'Heading3') + p(run('x'))), 'x');
    expect(book.title).toBe('The Book');
    expect(book.pages.map(x => x.title)).toEqual(['A', 'B']);
    expect(book.pages[1].markdown).toBe('# B\n\nb text\n\n## Part\n\nx\n');
  });

  it('makes one page from a document with no headings, and finds headings by outline level', () => {
    const plain = importDocx(word(p(run('Just words.'))), 'My Notes');
    expect(plain.pages).toEqual([{ title: 'My Notes', markdown: '# My Notes\n\nJust words.\n' }]);
    const outlined = importDocx(word(p(run('Ch 1'), '', '<w:outlineLvl w:val="0"/>') + p(run('Hello'))), 'x');
    expect(outlined.pages[0].title).toBe('Ch 1');
  });

  it('keeps spaces outside emphasis, protects Markdown characters, and turns "* * *" into a scene break', () => {
    const book = importDocx(word(
      p(run('Say ') + run(' loudly ', '<w:b/>') + run('now', '<w:b/><w:i/>') + run(' 2*3_x', '<w:i w:val="0"/>')) +
      p(run('* * *')) + p(run('# 1 is a number')) + p(run('- not a list')),
    ), 'T');
    const md = book.pages[0].markdown;
    expect(md).toContain('Say  **loudly** ***now***');
    expect(md).toContain('**loudly** ***now*** 2\\*3\\_x');
    expect(md).toContain('\n\n---\n\n');
    expect(md).toContain('\\# 1 is a number');
    expect(md).toContain('\\- not a list');
  });

  it('reads Word lists (bullet or numbered, nested), hyperlinks, tables and counts pictures', () => {
    const numbering = `<w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="lowerLetter"/></w:lvl></w:abstractNum><w:num w:numId="5"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="6"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
    const list = (id: string, level: number, t: string) => p(run(t), 'ListParagraph', `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${id}"/></w:numPr>`);
    const rels = `<Relationships><Relationship Id="rId9" Type="x" Target="https://example.com/" TargetMode="External"/><Relationship Id="rId8" Type="x" Target="javascript:alert(1)" TargetMode="External"/></Relationships>`;
    const body = list('5', 0, 'dot') + list('6', 0, 'num') + list('6', 1, 'sub') +
      p(`<w:hyperlink r:id="rId9">${run('site')}</w:hyperlink>` + `<w:hyperlink r:id="rId8">${run('bad')}</w:hyperlink>`) +
      `<w:tbl><w:tr><w:tc>${p(run('cell'))}</w:tc></w:tr></w:tbl><w:p><w:r><w:drawing/></w:r></w:p>`;
    const book = importDocx(word(body, { numbering, rels }), 'T');
    const md = book.pages[0].markdown;
    expect(md).toContain('- dot\n\n1. num\n  1. sub');
    expect(md).toContain('[site](https://example.com/)bad');
    expect(md).toContain('cell');
    expect(book.pictures).toBe(1);
  });

  it('refuses text that is not a Word document', () => {
    expect(() => importDocx(word('', { document: '<not xml' }), 'x')).toThrow(/not a readable/);
  });
});

describe('E-book (EPUB) export', () => {
  const chapters = [
    { title: 'One & Two', doc: { type: 'doc', content: [para(text('Hello '), text('world', [{ type: 'bold' }]), text(' <3', [{ type: 'link', attrs: { href: 'https://example.com/?a=1&b=2' } }])), { type: 'heading', attrs: { level: 2 }, content: [text('Inside')] }, { type: 'bulletList', content: [{ type: 'listItem', content: [para(text('x'))] }] }, { type: 'horizontalRule' }] } },
    { title: 'Three', doc: { type: 'doc', content: [para(text('Next.'))] } },
  ];
  const build = (options = {}) => epubBytes(chapters, { title: 'Sea & Sky', author: 'Mara', ...options }, new Date('2026-10-04T10:00:00Z'), 'urn:uuid:test');

  it('starts with the stored mimetype, the way readers require', () => {
    const bytes = build();
    expect(new TextDecoder().decode(bytes.slice(30, 30 + 8 + 20))).toBe('mimetypeapplication/epub+zip');
    expect(unzipStored(bytes).map(e => e.name)[0]).toBe('mimetype');
  });

  it('is a well-formed package: every file is XML, every manifest item exists, the spine and contents point at real files', () => {
    const f = files(build({ titlePage: true, contents: true, subtitle: 'A story' }));
    for (const [name, content] of Object.entries(f)) if (/\.(xml|xhtml|opf)$/.test(name)) expect(wellFormed(content), name).toBe(true);
    const opf = new DOMParser().parseFromString(f['OEBPS/content.opf'], 'application/xml');
    const manifest = new Map([...opf.getElementsByTagName('item')].map(i => [i.getAttribute('id')!, i.getAttribute('href')!]));
    for (const href of manifest.values()) expect(f['OEBPS/' + href], href).toBeDefined();
    const spine = [...opf.getElementsByTagName('itemref')].map(i => i.getAttribute('idref')!);
    expect(spine).toEqual(['titlepage', 'nav', 'chapter-1', 'chapter-2']);
    spine.forEach(id => expect(manifest.has(id)).toBe(true));
    expect(opf.getElementsByTagName('dc:title')[0].textContent).toBe('Sea & Sky');
    expect(opf.getElementsByTagName('dc:creator')[0].textContent).toBe('Mara');
    const nav = new DOMParser().parseFromString(f['OEBPS/nav.xhtml'], 'application/xml');
    const targets = [...nav.getElementsByTagName('a')].map(a => a.getAttribute('href')!);
    expect(targets).toEqual(['chapter-1.xhtml', 'chapter-1.xhtml#c1-s1', 'chapter-2.xhtml']);
    for (const target of targets) {
      const [file, id] = target.split('#');
      expect(f['OEBPS/' + file], target).toBeDefined();
      if (id) expect(f['OEBPS/' + file]).toContain(`id="${id}"`);
    }
    expect(f['OEBPS/titlepage.xhtml']).toContain('A story');
  });

  it('keeps chapters, emphasis and links, escapes text, and leaves out optional pages unless asked', () => {
    const f = files(build());
    expect(f['OEBPS/chapter-1.xhtml']).toContain('<h1>One &amp; Two</h1>');
    expect(f['OEBPS/chapter-1.xhtml']).toContain('<strong>world</strong>');
    expect(f['OEBPS/chapter-1.xhtml']).toContain('<a href="https://example.com/?a=1&amp;b=2">');
    expect(f['OEBPS/chapter-1.xhtml']).toContain('&lt;3');
    expect(f['OEBPS/chapter-1.xhtml']).toContain('<li>x</li>');
    const spine = [...new DOMParser().parseFromString(f['OEBPS/content.opf'], 'application/xml').getElementsByTagName('itemref')].map(i => i.getAttribute('idref'));
    expect(spine).toEqual(['chapter-1', 'chapter-2']);
  });

  it('exports a single page by its own headings', () => {
    const f = files(epubBytes([{ doc: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [text('Solo')] }, para(text('Words.'))] } }], { title: 'Solo' }));
    expect(f['OEBPS/nav.xhtml']).toContain('chapter-1.xhtml#c1-s1');
    expect(wellFormed(f['OEBPS/chapter-1.xhtml'])).toBe(true);
  });

  it('is a format you can choose and remember', () => {
    expect(sanitizeExportOptions({ format: 'epub' }).format).toBe('epub');
  });
});
