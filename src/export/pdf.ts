import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { layoutSpec, type ExportLayout } from './layout';

type PdfMakeRuntime = { createPdf(definition: TDocumentDefinitions): { getBuffer(done: (buffer: Uint8Array) => void): void } };
let runtime: Promise<PdfMakeRuntime> | null = null;

/** pdfmake and its fonts are large and only needed when you export, so they are loaded then, once. */
function pdfMakeRuntime(): Promise<PdfMakeRuntime> {
  runtime ??= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(([maker, fonts]) => {
    const pdfMake = (maker.default ?? maker) as unknown as PdfMakeRuntime & { addVirtualFileSystem?: (fonts: unknown) => void; vfs?: unknown };
    const vfs = (fonts.default ?? fonts) as unknown;
    if (typeof pdfMake.addVirtualFileSystem === 'function') pdfMake.addVirtualFileSystem(vfs);
    else pdfMake.vfs = (vfs as { pdfMake?: { vfs: unknown } }).pdfMake?.vfs ?? vfs;
    return pdfMake;
  });
  return runtime;
}

export interface ProseNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: ProseNode[];
}

// pdfmake ships only Roboto, so code is set apart by size and a soft background instead of a monospace face.
const CODE_LOOK = { fontSize: 10, background: '#efe9e1' };

function inline(node: ProseNode): Content[] {
  if (node.type === 'hardBreak') return [{ text: '\n' }];
  if (node.type === 'text') {
    const marks = node.marks ?? [];
    const link = marks.find((m) => m.type === 'link')?.attrs?.href;
    return [{ text: node.text ?? '', bold: marks.some((m) => m.type === 'bold'),
      italics: marks.some((m) => m.type === 'italic'),
      decoration: marks.some((m) => m.type === 'underline') ? 'underline' : marks.some((m) => m.type === 'strike') ? 'lineThrough' : undefined,
      ...(marks.some((m) => m.type === 'code') ? CODE_LOOK : {}),
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

function list(node: ProseNode, toc: boolean): Content {
  const entries = (node.content ?? []).map((item) => {
    let first = true;
    const stack: Content[] = [];
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') stack.push(list(child, toc));
      else if (child.type === 'paragraph') {
        const prefix = first && node.type === 'taskList' ? (item.attrs?.checked ? '[x] ' : '[ ] ') : '';
        stack.push({ text: [{ text: prefix }, ...(child.content ?? []).flatMap(inline)] });
        first = false;
      } else stack.push(...blocks([child], toc));
    }
    return { stack };
  });
  return node.type === 'orderedList' ? { ol: entries, margin: [0, 0, 0, 12] } : { ul: entries, margin: [0, 0, 0, 12] };
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
      result.push(list(node, toc));
    } else if (node.type === 'blockquote') {
      result.push(...blocks(children, false).map((b) => ({ ...(b as object), italics: true, color: '#685d51', margin: [18, 0, 0, 9] }) as Content));
    } else if (node.type === 'horizontalRule') {
      result.push({ text: '* * *', alignment: 'center', color: '#9a8674', margin: [0, 12, 0, 18] });
    } else if (node.type === 'codeBlock') {
      result.push({ text: node.text ?? children.map((c) => c.text ?? '').join(''), ...CODE_LOOK, margin: [12, 8, 12, 16] });
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

export async function renderPdfDefinition(definition: TDocumentDefinitions): Promise<Uint8Array> {
  const pdfMake = await pdfMakeRuntime();
  return new Promise((resolve, reject) => {
    try { pdfMake.createPdf(definition).getBuffer(buffer => resolve(new Uint8Array(buffer))); }
    catch (error) { reject(error); }
  });
}
export function renderPdf(doc: ProseNode, title: string, layout: ExportLayout = 'reading', options: PdfOptions = {}): Promise<Uint8Array> {
  return renderPdfDefinition(pdfDocument(doc, title, layout, options));
}
