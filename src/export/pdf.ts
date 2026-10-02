import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { layoutSpec, type ExportLayout } from './layout';

const pdfMakeRuntime = pdfMake as unknown as { addVirtualFileSystem?: (fonts: unknown) => void; vfs?: unknown };
if (typeof pdfMakeRuntime.addVirtualFileSystem === 'function') {
  pdfMakeRuntime.addVirtualFileSystem(pdfFonts);
} else {
  pdfMakeRuntime.vfs = (pdfFonts as unknown as { pdfMake?: { vfs: unknown } }).pdfMake?.vfs ?? pdfFonts;
}

export interface ProseNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: ProseNode[];
}

function inline(node: ProseNode): Content[] {
  if (node.type === 'hardBreak') return [{ text: '\n' }];
  if (node.type === 'text') {
    const marks = node.marks ?? [];
    const link = marks.find((m) => m.type === 'link')?.attrs?.href;
    return [{ text: node.text ?? '', bold: marks.some((m) => m.type === 'bold'),
      italics: marks.some((m) => m.type === 'italic'),
      decoration: marks.some((m) => m.type === 'strike' || m.type === 'underline') ? 'lineThrough' : undefined,
      link: typeof link === 'string' && /^(https?:|mailto:)/.test(link) ? link : undefined }];
  }
  return (node.content ?? []).flatMap(inline);
}

export interface PdfOptions {
  subtitle?: string;
  author?: string;
  titlePage?: boolean;
  contents?: boolean;
  /** Defaults to true, as before. */
  pageNumbers?: boolean;
}

function blocks(nodes: ProseNode[], toc = false): Content[] {
  const result: Content[] = [];
  for (const node of nodes) {
    const children = node.content ?? [];
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level);
      result.push({ text: children.flatMap(inline), style: level === 1 ? 'title' : level === 2 ? 'heading' : 'subheading', ...(toc && level <= 2 ? { tocItem: true } : {}) } as Content);
    } else if (node.type === 'paragraph') {
      const text = children.flatMap(inline);
      result.push({ text: text.length ? text : ' ', margin: [0, 0, 0, 9] });
    } else if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      const entries = children.map((item) => {
        const text = item.content?.flatMap((child) => child.content ? child.content.flatMap(inline) : inline(child)) ?? [];
        const prefix = node.type === 'taskList' ? (item.attrs?.checked ? '[x] ' : '[ ] ') : '';
        return { text: [{ text: prefix }, ...text] };
      });
      result.push(node.type === 'orderedList' ? { ol: entries, margin: [0, 0, 0, 12] } : { ul: entries, margin: [0, 0, 0, 12] });
    } else if (node.type === 'blockquote') {
      result.push({ text: children.flatMap((c) => c.content?.flatMap(inline) ?? inline(c)), style: 'quote' });
    } else if (node.type === 'horizontalRule') {
      result.push({ text: '* * *', alignment: 'center', color: '#9a8674', margin: [0, 12, 0, 18] });
    } else if (node.type === 'codeBlock') {
      result.push({ text: node.text ?? children.map((c) => c.text ?? '').join(''), fontSize: 10, margin: [12, 8, 12, 16] });
    } else if (children.length) result.push(...blocks(children, toc));
  }
  return result;
}

/** The body of a page as PDF content; `toc` marks headings for the table of contents. */
export function proseBlocks(doc: ProseNode, toc = false): Content[] { return blocks(doc.content ?? [], toc); }

/** The title page and the contents, each ending its page, in front of the writing. */
export function frontMatter(title: string, options: PdfOptions = {}): Content[] {
  const front: Content[] = [];
  if (options.titlePage) {
    front.push({ text: title, style: 'coverTitle', alignment: 'center', margin: [0, 170, 0, 14] } as Content);
    if (options.subtitle?.trim()) front.push({ text: options.subtitle.trim(), style: 'coverSubtitle', alignment: 'center' } as Content);
    if (options.author?.trim()) front.push({ text: options.author.trim(), alignment: 'center', fontSize: 14, margin: [0, 40, 0, 0] } as Content);
    front.push({ text: '', pageBreak: 'after' } as Content);
  }
  if (options.contents) front.push({ toc: { title: { text: 'Contents', style: 'heading', margin: [0, 0, 0, 12] } }, pageBreak: 'after' } as Content);
  return front;
}

export function pdfDocument(doc: ProseNode, title: string, layout: ExportLayout = 'reading', options: PdfOptions = {}): TDocumentDefinitions {
  const spec = layoutSpec(layout);
  const numbers = options.pageNumbers !== false;
  return {
    info: { title, ...(options.author?.trim() ? { author: options.author.trim() } : {}) }, pageSize: spec.pageSize, pageMargins: spec.margins,
    content: [...frontMatter(title, options), ...blocks(doc.content ?? [], Boolean(options.contents))],
    defaultStyle: { font: 'Roboto', fontSize: spec.fontSize, lineHeight: spec.lineHeight, color: spec.color },
    styles: {
      title: { fontSize: spec.title, bold: true, margin: [0, 0, 0, 19], color: '#29221e' },
      heading: { fontSize: spec.heading, bold: true, margin: [0, 19, 0, 9] },
      subheading: { fontSize: 13, bold: true, margin: [0, 14, 0, 7] },
      quote: { italics: true, color: '#685d51', margin: [18, 8, 0, 18] },
      coverTitle: { fontSize: 34, bold: true, color: '#29221e' },
      coverSubtitle: { fontSize: 17, italics: true, color: '#685d51' },
    },
    // The title page carries no number; a writer who turns numbers off gets a clean page.
    footer: !numbers ? undefined : (page, pages) => options.titlePage && page === 1 ? { text: '' } : spec.footer ? { text: page + ' / ' + pages, alignment: 'center', color: '#9a9086', fontSize: 9, margin: [0, 18, 0, 0] } : { text: String(page), alignment: 'right', color: '#aaaaaa', fontSize: 9, margin: [0, 18, 68, 0] },
  };
}

export function renderPdfDefinition(definition: TDocumentDefinitions): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try { pdfMake.createPdf(definition).getBuffer(buffer => resolve(new Uint8Array(buffer))); }
    catch (error) { reject(error); }
  });
}
export function renderPdf(doc: ProseNode, title: string, layout: ExportLayout = 'reading', options: PdfOptions = {}): Promise<Uint8Array> {
  return renderPdfDefinition(pdfDocument(doc, title, layout, options));
}
