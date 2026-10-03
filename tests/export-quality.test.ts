// @vitest-environment happy-dom
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS, sanitizeExportOptions } from '../src/core/export-options';
import { chapterInfo } from '../src/core/project';
import { docxBytes } from '../src/export/docx';
import { epubBytes } from '../src/export/epub';
import { pdfDocument, type ProseNode } from '../src/export/pdf';
import { chapterBody, parseChapter } from '../src/export/project-pdf';
import { unzipStored } from '../src/export/zip';
import { importDocx, type DocxParts } from '../src/import/docx';

const text = (t: string, marks: Array<{ type: string }> = []): ProseNode => ({ type: 'text', text: t, marks });
const para = (...c: ProseNode[]): ProseNode => ({ type: 'paragraph', content: c });
const item = (...c: ProseNode[]): ProseNode => ({ type: 'listItem', content: c });
const files = (bytes: Uint8Array) => Object.fromEntries(unzipStored(bytes).map(e => [e.name, new TextDecoder().decode(e.data)]));
const wellFormed = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length === 0;
const flat = (d: ReturnType<typeof pdfDocument>) => d.content as unknown as Array<Record<string, any>>;

describe('PDF content', () => {
  it('underlines underlined text and strikes struck text', () => {
    const d = pdfDocument({ type: 'doc', content: [para(text('u', [{ type: 'underline' }]), text('s', [{ type: 'strike' }]))] }, 'T');
    const runs = flat(d)[0].text as Array<Record<string, unknown>>;
    expect(runs[0].decoration).toBe('underline');
    expect(runs[1].decoration).toBe('lineThrough');
  });
  it('nests lists and keeps blockquote paragraphs apart', () => {
    const d = pdfDocument({ type: 'doc', content: [
      { type: 'bulletList', content: [item(para(text('outer')), { type: 'orderedList', content: [item(para(text('inner')))] })] },
      { type: 'blockquote', content: [para(text('one')), para(text('two'))] },
    ] }, 'T');
    const [list, ...quote] = flat(d);
    expect(list.ul[0].stack[1].ol).toHaveLength(1);
    expect(quote).toHaveLength(2);
    expect(quote.every(q => q.italics === true)).toBe(true);
  });
  it('sets code apart with a smaller size and a background', () => {
    const d = pdfDocument({ type: 'doc', content: [para(text('x', [{ type: 'code' }])), { type: 'codeBlock', content: [text('a')] }] }, 'T');
    expect(flat(d)[0].text[0]).toMatchObject({ fontSize: 10, background: expect.any(String) });
    expect(flat(d)[1].background).toEqual(expect.any(String));
  });
});

describe('Word export', () => {
  const chapter = { title: 'One', doc: { type: 'doc', content: [para(text('a'))] } as ProseNode };
  const breaks = (xml: string) => (xml.match(/pageBreakBefore|w:br w:type="page"/g) ?? []).length;
  it('puts exactly one page break between the front matter and the first chapter', () => {
    const d = files(docxBytes([chapter], { title: 'T', titlePage: true }))['word/document.xml'];
    expect(breaks(d)).toBe(1);
    const both = files(docxBytes([chapter, { ...chapter, title: 'Two' }], { title: 'T', titlePage: true, contents: true }))['word/document.xml'];
    expect(breaks(both)).toBe(3); // after title page, after contents, before chapter two
    expect(breaks(files(docxBytes([chapter], { title: 'T' }))['word/document.xml'])).toBe(1);
  });
  it('writes the chosen language, and ignores a malformed one', () => {
    expect(files(docxBytes([chapter], { title: 'T', language: 'sr-Latn' }))['word/styles.xml']).toContain('w:lang w:val="sr-Latn"');
    expect(files(docxBytes([chapter], { title: 'T', language: '"><x' }))['word/styles.xml']).toContain('w:val="en-US"');
  });
});

describe('E-book export', () => {
  const doc: ProseNode = { type: 'doc', content: [
    para(text('Hello.')),
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [para(text('done'))] }, { type: 'taskItem', attrs: { checked: false }, content: [para(text('todo'))] }] },
  ] };
  const build = (options = {}) => epubBytes([{ title: 'One', doc }, { title: 'Two', doc }], { title: 'Book', titlePage: true, contents: true, ...options }, new Date('2026-10-04T10:00:00Z'), 'urn:uuid:t');
  it('carries language, date, accessibility metadata, landmarks and an NCX, all consistent', () => {
    const f = files(build({ language: 'de' }));
    const opf = f['OEBPS/content.opf'];
    expect(opf).toContain('<dc:language>de</dc:language>');
    expect(opf).toContain('<dc:date>2026-10-04T10:00:00Z</dc:date>');
    for (const m of ['accessMode', 'accessModeSufficient', 'accessibilityFeature', 'accessibilityHazard', 'accessibilitySummary']) expect(opf).toContain('property="schema:' + m + '"');
    expect(opf).toContain('<spine toc="ncx">');
    expect(f['OEBPS/chapter-1.xhtml']).toContain('xml:lang="de"');
    expect(f['OEBPS/nav.xhtml']).toMatch(/epub:type="landmarks"[\s\S]*epub:type="titlepage"[\s\S]*epub:type="toc"[\s\S]*epub:type="bodymatter"/);
    expect(f['OEBPS/toc.ncx']).toContain('<navPoint id="np2"');
    for (const [, href] of opf.matchAll(/<item [^>]*href="([^"]+)"/g)) expect(f['OEBPS/' + href], href).toBeTruthy();
    for (const [name, xml] of Object.entries(f)) if (/\.(xhtml|opf|ncx|xml)$/.test(name)) expect(wellFormed(xml), name).toBe(true);
  });
  it('defaults to English, shows task boxes and sets the book typography', () => {
    const f = files(build({ titlePage: false, contents: false }));
    expect(f['OEBPS/content.opf']).toContain('<dc:language>en</dc:language>');
    expect(f['OEBPS/chapter-1.xhtml']).toContain('☑ done');
    expect(f['OEBPS/chapter-1.xhtml']).toContain('☐ todo');
    expect(f['OEBPS/style.css']).toContain('p+p{text-indent:1.2em;margin:0}');
    expect(f['OEBPS/style.css']).toContain('hyphens:auto');
    expect(f['OEBPS/nav.xhtml']).not.toContain('titlepage');
  });
  it.skipIf(!existsSync('/usr/bin/ebook-convert'))('is still readable by Calibre', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agp-epub-'));
    try {
      writeFileSync(join(dir, 'a.epub'), build());
      execFileSync('/usr/bin/ebook-convert', [join(dir, 'a.epub'), join(dir, 'a.txt')], { stdio: 'ignore', timeout: 60000 });
      expect(existsSync(join(dir, 'a.txt'))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 70000);
});

describe('export options and chapters', () => {
  it('remembers a valid language and drops a bad one', () => {
    expect(DEFAULT_EXPORT_OPTIONS.language).toBe('en');
    expect(sanitizeExportOptions({ language: ' pt-BR ' }).language).toBe('pt-BR');
    expect(sanitizeExportOptions({ language: 'english please' }).language).toBe('en');
  });
  it('strips a leading heading only when it is the chapter title', () => {
    expect(chapterBody(chapterInfo('a.md', '# Alpha\n\nBody'))).toBe('\nBody');
    const f = { ...chapterInfo('a.md', '## Real section\n\nBody'), title: 'Other' };
    expect(chapterBody(f)).toBe('## Real section\n\nBody');
  });
  it('parses an unchanged chapter once', () => {
    const f = chapterInfo('c.md', '# C\n\nWords here.');
    expect(parseChapter(f)).toBe(parseChapter({ ...f }));
    expect(parseChapter({ ...f, text: '# C\n\nChanged.' })).not.toBe(parseChapter(f));
  });
});

describe('Word import details', () => {
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const word = (body: string, extra: Partial<DocxParts> = {}): DocxParts => ({ document: `<w:document ${NS}><w:body>${body}</w:body></w:document>`, rels: '', numbering: '', ...extra });
  const p = (inner: string, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${inner}</w:p>`;
  const styles = (...defs: string[]) => `<w:styles ${NS}>${defs.join('')}</w:styles>`;
  const style = (id: string, name: string, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>${extra}</w:style>`;

  it('keeps hyphens and tabs', () => {
    const body = p('<w:r><w:t>well</w:t><w:noBreakHyphen/><w:t>known</w:t><w:softHyphen/><w:tab/><w:t>x</w:t></w:r>');
    expect(importDocx(word(body), 'T').pages[0].markdown).toContain('well-known x');
  });
  it('counts footnotes and comments without importing them', () => {
    const notes = `<w:footnotes ${NS}><w:footnote w:type="separator" w:id="-1"/><w:footnote w:type="continuationSeparator" w:id="0"/><w:footnote w:id="1"/><w:footnote w:id="2"/></w:footnotes>`;
    const comments = `<w:comments ${NS}><w:comment w:id="0"/></w:comments>`;
    const book = importDocx(word(p('<w:r><w:t>Hi</w:t></w:r>'), { footnotes: notes, comments }), 'T');
    expect(book).toMatchObject({ footnotes: 2, comments: 1 });
    const plain = importDocx(word(p('<w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:t>Hi</w:t></w:r>')), 'T');
    expect(plain).toMatchObject({ footnotes: 1, comments: 0 });
  });
  it('reads custom heading styles by name, outline level and "based on" chains', () => {
    const s = styles(style('Cap', 'Chapter'), style('N2', 'Naslov 2'), style('U1', 'Überschrift 1'),
      style('Out', 'Fancy', '<w:pPr><w:outlineLvl w:val="0"/></w:pPr>'), style('Kid', 'Kid', '<w:basedOn w:val="Out"/>'),
      style('A', 'A', '<w:basedOn w:val="B"/>'), style('B', 'B', '<w:basedOn w:val="A"/>'));
    const body = p('<w:r><w:t>One</w:t></w:r>', 'Cap') + p('<w:r><w:t>sub</w:t></w:r>', 'N2') + p('<w:r><w:t>Two</w:t></w:r>', 'U1') +
      p('<w:r><w:t>Three</w:t></w:r>', 'Kid') + p('<w:r><w:t>loop</w:t></w:r>', 'A') + p('<w:r><w:t>Four</w:t></w:r>', 'Out');
    const book = importDocx(word(body, { styles: s }), 'T');
    expect(book.pages.map(x => x.title)).toEqual(['One', 'Two', 'Three', 'Four']);
    expect(book.pages[0].markdown).toContain('## sub');
    expect(book.pages[2].markdown).toContain('loop');
  });
});
