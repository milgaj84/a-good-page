import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS, EXPORT_OPTIONS_KEY, ExportOptionsStore, effectiveTitle, sanitizeExportOptions } from '../src/core/export-options';
import { docxBytes, esc } from '../src/export/docx';
import { markdownDocument } from '../src/export/markdown';
import { pdfDocument, type ProseNode } from '../src/export/pdf';
import { projectPdfDocument } from '../src/export/project-pdf';
import { unzipStored } from '../src/export/zip';
import { chapterInfo } from '../src/core/project';

const text = (t: string, marks: Array<{ type: string; attrs?: Record<string, unknown> }> = []): ProseNode => ({ type: 'text', text: t, marks });
const doc: ProseNode = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [text('The Harbour')] },
  { type: 'paragraph', content: [text('Plain, '), text('bold', [{ type: 'bold' }]), text(' & '), text('italic <i>', [{ type: 'italic' }]), text(' and a '), text('link', [{ type: 'link', attrs: { href: 'https://example.com/a?b=1&c=2' } }]), text('.')] },
  { type: 'heading', attrs: { level: 2 }, content: [text('Evening')] },
  { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('one')] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [text('two')] }] }] },
  { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('first')] }] }] },
  { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('again first')] }] }] },
  { type: 'blockquote', content: [{ type: 'paragraph', content: [text('A quote.')] }] },
  { type: 'horizontalRule' },
  { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [text('done')] }] }] },
  { type: 'codeBlock', content: [text('let a = 1;\nlet b = 2;')] },
] };

const parts = (bytes: Uint8Array) => Object.fromEntries(unzipStored(bytes).map(e => [e.name, new TextDecoder().decode(e.data)]));
const wellFormed = (xml: string) => { const d = new DOMParser().parseFromString(xml, 'application/xml'); return d.getElementsByTagName('parsererror').length === 0; };

describe('export options', () => {
  it('cleans anything stored, falls back to defaults, and uses the page name when the title is empty', () => {
    expect(sanitizeExportOptions(null)).toEqual(DEFAULT_EXPORT_OPTIONS);
    expect(sanitizeExportOptions({ format: 'rtf', titlePage: 'yes', author: '  Mara\nQuinn ' }).format).toBe('pdf');
    expect(sanitizeExportOptions({ author: '  Mara\nQuinn ' }).author).toBe('Mara Quinn');
    expect(sanitizeExportOptions({ author: 'x'.repeat(500) }).author).toHaveLength(200);
    expect(effectiveTitle(sanitizeExportOptions({ title: '  ' }), 'Sample Book')).toBe('Sample Book');
    expect(effectiveTitle(sanitizeExportOptions({ title: 'My Title' }), 'Sample Book')).toBe('My Title');
  });
  it('remembers how you like exports, but never the title or subtitle', () => {
    const m = new Map<string, string>();
    const store = new ExportOptionsStore({ get: k => m.get(k) ?? null, set: (k, v) => { m.set(k, v); }, remove: k => { m.delete(k); } });
    store.save({ ...DEFAULT_EXPORT_OPTIONS, format: 'docx', titlePage: true, contents: true, author: 'Mara', title: 'Secret', subtitle: 'Sub' });
    expect(m.get(EXPORT_OPTIONS_KEY)).not.toContain('Secret');
    expect(store.load()).toMatchObject({ format: 'docx', titlePage: true, contents: true, author: 'Mara', title: '', subtitle: '' });
    m.set(EXPORT_OPTIONS_KEY, '{broken');
    expect(store.load()).toEqual(DEFAULT_EXPORT_OPTIONS);
  });
});

describe('Word export', () => {
  const bytes = docxBytes([{ doc }], { title: 'Harbour & Co', author: 'Mara <Q>', titlePage: true, contents: true, pageNumbers: true }, new Date(Date.UTC(2026, 9, 2)));
  const p = parts(bytes);
  it('is a zip with the parts Word needs, in the right order, all well-formed XML', () => {
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Object.keys(p)[0]).toBe('[Content_Types].xml');
    for (const name of ['_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels', 'word/footer1.xml', 'docProps/core.xml'])
      expect(p[name], name).toBeTruthy();
    for (const [name, xml] of Object.entries(p)) expect(wellFormed(xml), name).toBe(true);
  });
  it('keeps headings, emphasis, links, lists, quotes, scene breaks and code', () => {
    const d = p['word/document.xml'];
    expect(d).toContain('w:val="Heading1"');
    expect(d).toContain('w:val="Heading2"');
    expect(d).toContain('<w:b/>');
    expect(d).toContain('<w:i/>');
    expect(d).toContain('italic &lt;i&gt;');
    expect(d).toContain('w:val="Quote"');
    expect(d).toContain('w:val="SceneBreak"');
    expect(d).toContain('Consolas');
    expect(d).toContain('☑ ');
    expect(d).toContain('>done<');
    expect(p['word/_rels/document.xml.rels']).toContain('Target="https://example.com/a?b=1&amp;c=2"');
    expect(d).toContain('w:hyperlink');
  });
  it('restarts numbering for each ordered list', () => {
    const d = p['word/document.xml'];
    expect(d).toContain('<w:numId w:val="100"/>');
    expect(d).toContain('<w:numId w:val="101"/>');
    expect(p['word/numbering.xml']).toContain('w:numId="101"');
    expect(p['word/numbering.xml']).toContain('startOverride');
  });
  it('adds a title page, a contents list of headings, and page numbers; metadata is escaped', () => {
    const d = p['word/document.xml'];
    expect(d.indexOf('w:val="Title"')).toBeLessThan(d.indexOf('Contents'));
    expect(d).toContain('Harbour &amp; Co');
    expect(d).toContain('Mara &lt;Q&gt;');
    expect(d).toMatch(/Contents1[\s\S]*The Harbour/);
    expect(d).toMatch(/Contents2[\s\S]*Evening/);
    expect(d).toContain('footerReference');
    expect(p['word/footer1.xml']).toContain('PAGE');
    expect(p['docProps/core.xml']).toContain('<dc:creator>Mara &lt;Q&gt;</dc:creator>');
    expect(p['docProps/core.xml']).toContain('2026-10-02');
  });
  it('leaves out what was not asked for', () => {
    const plain = parts(docxBytes([{ doc }], { title: 'T', pageNumbers: false }));
    expect(plain['word/footer1.xml']).toBeUndefined();
    expect(plain['word/document.xml']).not.toContain('footerReference');
    expect(plain['word/document.xml']).not.toContain('w:val="Title"');
    expect(plain['word/document.xml']).not.toContain('Contents1');
    for (const xml of Object.values(plain)) expect(wellFormed(xml)).toBe(true);
  });
  it('starts each chapter on a new page and lists chapters in the contents', () => {
    const chapters = [{ title: 'One', doc: { type: 'doc', content: [{ type: 'paragraph', content: [text('a')] }] } }, { title: 'Two', doc: { type: 'doc', content: [{ type: 'paragraph', content: [text('b')] }] } }];
    const d = parts(docxBytes(chapters, { title: 'Book', contents: true }))['word/document.xml'];
    expect(d.match(/pageBreakBefore/g)).toHaveLength(2);
    expect(d.indexOf('Contents1')).toBeLessThan(d.indexOf('pageBreakBefore'));
    expect(d).toMatch(/Contents1[\s\S]*One[\s\S]*Contents1[\s\S]*Two/);
  });
  it('survives an empty document and strips characters XML cannot hold', () => {
    expect(wellFormed(parts(docxBytes([{ doc: { type: 'doc', content: [] } }], { title: '' }))['word/document.xml'])).toBe(true);
    expect(esc('a\u0000b\u0008c<&>"')).toBe('abc&lt;&amp;&gt;&quot;');
  });
});

describe('Markdown export', () => {
  it('adds a title block and a linked contents, leaving the words untouched', () => {
    const md = markdownDocument({ title: 'My Book', subtitle: 'A tale', author: 'Mara', titlePage: true, contents: true }, '# One\n\nText.\n\n# One\n\nAgain.', [{ level: 1, text: 'One' }, { level: 2, text: 'Sub [x]' }, { level: 1, text: 'One' }]);
    expect(md.startsWith('# My Book\n\n*A tale*\n\n**Mara**\n\n---')).toBe(true);
    expect(md).toContain('- [One](#one)');
    expect(md).toContain('    - [Sub \\[x\\]](#sub-x)');
    expect(md).toContain('- [One](#one-1)');
    expect(md.endsWith('Again.\n')).toBe(true);
  });
  it('is just the text when nothing extra is asked for', () => {
    expect(markdownDocument({ title: 'T' }, '  # Hi\n\nthere  ', [{ level: 1, text: 'Hi' }])).toBe('# Hi\n\nthere\n');
  });
});

describe('PDF title page, contents and numbers', () => {
  const pageDoc: ProseNode = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [text('Intro')] }, { type: 'paragraph', content: [text('Body')] }] };
  const content = (d: ReturnType<typeof pdfDocument>) => d.content as unknown as Array<Record<string, unknown>>;
  it('is unchanged by default, apart from nothing being added', () => {
    const d = pdfDocument(pageDoc, 'T');
    expect(content(d)).toHaveLength(2);
    expect(d.footer).toBeTypeOf('function');
  });
  it('puts a title page and a contents before the writing, each on its own page, and marks headings', () => {
    const d = pdfDocument(pageDoc, 'My Title', 'reading', { titlePage: true, contents: true, subtitle: 'Sub', author: 'Mara' });
    const c = content(d);
    expect(c[0].text).toBe('My Title');
    expect(c.some(n => n.text === 'Sub')).toBe(true);
    expect(c.find(n => n.pageBreak === 'after' && n.text === '')).toBeTruthy();
    expect(c.find(n => 'toc' in n)?.pageBreak).toBe('after');
    expect(c.find(n => n.text !== undefined && n.tocItem === true)).toBeTruthy();
    expect(d.info?.author).toBe('Mara');
  });
  it('can drop page numbers, and skips the number on the title page', () => {
    expect(pdfDocument(pageDoc, 'T', 'reading', { pageNumbers: false }).footer).toBeUndefined();
    const footer = pdfDocument(pageDoc, 'T', 'reading', { titlePage: true }).footer as (p: number, n: number) => { text: string };
    expect(footer(1, 5).text).toBe('');
    expect(footer(2, 5).text).toContain('2');
  });
  it('builds a project the same way, with chapter titles in the contents', () => {
    const files = [chapterInfo('a.md', '# Alpha\n\nOne'), chapterInfo('b.md', '# Beta\n\nTwo')];
    const d = projectPdfDocument(files, 'Book', 'reading', { titlePage: true, contents: true });
    const c = content(d);
    expect(c[0].text).toBe('Book');
    expect(c.filter(n => n.tocItem === true && (n.text === 'Alpha' || n.text === 'Beta'))).toHaveLength(2);
    expect(c.find(n => n.text === 'Beta')?.pageBreak).toBe('before');
    expect(projectPdfDocument(files, 'Book', 'reading').content).toBeTruthy();
  });
});
