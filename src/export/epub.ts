import type { ProseNode } from './pdf';
import { esc, safeLanguage } from './docx';
import { zipStored, type ZipEntry } from './zip';

export interface EpubChapter {
  /** A chapter title starts a new file and appears in the contents. Omit for a single page that carries its own headings. */
  title?: string;
  doc: ProseNode;
}

export interface EpubOptions {
  title: string;
  subtitle?: string;
  author?: string;
  titlePage?: boolean;
  /** Also show the contents as a page in the book. Readers always have their own contents menu. */
  contents?: boolean;
  /** BCP-47 tag; defaults to English. */
  language?: string;
}

interface Build { headings: Array<{ level: number; text: string; id: string }>; count: number }

function inline(nodes: readonly ProseNode[]): string {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'hardBreak') { out += '<br/>'; continue; }
    if (node.type !== 'text') { out += inline(node.content ?? []); continue; }
    let html = esc(node.text ?? '');
    const marks = node.marks ?? [];
    if (marks.some(m => m.type === 'code')) html = '<code>' + html + '</code>';
    if (marks.some(m => m.type === 'strike')) html = '<s>' + html + '</s>';
    if (marks.some(m => m.type === 'italic')) html = '<em>' + html + '</em>';
    if (marks.some(m => m.type === 'bold')) html = '<strong>' + html + '</strong>';
    const href = marks.find(m => m.type === 'link')?.attrs?.href;
    if (typeof href === 'string' && /^(https?:|mailto:)/.test(href)) html = '<a href="' + esc(href) + '">' + html + '</a>';
    out += html;
  }
  return out;
}

const plain = (node: ProseNode): string => (node.type === 'text' ? node.text ?? '' : (node.content ?? []).map(plain).join(' ')).replace(/\s+/g, ' ').trim();

function blocks(nodes: readonly ProseNode[], build: Build, prefix: string): string {
  let out = '';
  for (const node of nodes) {
    const children = node.content ?? [];
    if (node.type === 'heading') {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
      const id = prefix + 's' + ++build.count;
      build.headings.push({ level, text: plain(node), id });
      out += '<h' + level + ' id="' + id + '">' + inline(children) + '</h' + level + '>\n';
    } else if (node.type === 'paragraph') out += '<p>' + inline(children) + '</p>\n';
    else if (node.type === 'bulletList' || node.type === 'taskList') {
      const task = node.type === 'taskList';
      out += '<ul' + (task ? ' class="tasks"' : '') + '>' + children.map(item => '<li>' + (task ? (item.attrs?.checked ? '☑ ' : '☐ ') : '') + blocks(item.content ?? [], build, prefix).replace(/^<p>([\s\S]*)<\/p>\n$/, '$1') + '</li>').join('') + '</ul>\n';
    }
    else if (node.type === 'orderedList') out += '<ol>' + children.map(item => '<li>' + blocks(item.content ?? [], build, prefix).replace(/^<p>([\s\S]*)<\/p>\n$/, '$1') + '</li>').join('') + '</ol>\n';
    else if (node.type === 'blockquote') out += '<blockquote>' + blocks(children, build, prefix) + '</blockquote>\n';
    else if (node.type === 'horizontalRule') out += '<p class="break">⁂</p>\n';
    else if (node.type === 'codeBlock') out += '<pre>' + esc(node.text ?? children.map(c => c.text ?? '').join('')) + '</pre>\n';
    else if (children.length) out += blocks(children, build, prefix);
  }
  return out;
}

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';
const page = (title: string, body: string, lang: string, extra = ''): string =>
  XML + '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="' + esc(lang) + '"><head><meta charset="utf-8"/><title>' + esc(title) +
  '</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body' + extra + '>' + body + '</body></html>';

const CSS = 'body{font-family:serif;line-height:1.5;margin:0 5%}h1,h2,h3{font-family:sans-serif;line-height:1.2}h1{margin:2em 0 1em}' +
  'p{margin:0;orphans:2;widows:2;hyphens:auto}p+p{text-indent:1.2em;margin:0}.break+p,h1+p,h2+p,h3+p,blockquote p,li p{text-indent:0}blockquote{margin:1em 1.5em;font-style:italic}pre,code{font-family:monospace;font-size:.9em}pre{white-space:pre-wrap}' +
  '.break{text-align:center;margin:1.5em 0}.titlepage{text-align:center;margin-top:30%}.titlepage h1{margin:0 0 .4em}.titlepage .by{margin-top:2em}nav ol{list-style:none;padding-left:0}nav .l2{margin-left:1.2em}ul.tasks{list-style:none;padding-left:0}';

/**
 * Builds an EPUB 3 e-book from the same prose the editor holds. Every chapter is its own file; the book's contents
 * (which every reader shows in its own menu) lists chapter titles and headings. A reader needs only the files below.
 */
export function epubBytes(chapters: readonly EpubChapter[], options: EpubOptions, now: Date = new Date(), id: string = 'urn:uuid:' + crypto.randomUUID()): Uint8Array {
  const title = options.title.trim() || 'Untitled';
  const lang = safeLanguage(options.language, 'en');
  const build: Build = { headings: [], count: 0 };
  const files: Array<{ name: string; id: string; title: string; html: string; toc: Array<{ level: number; text: string; id: string }> }> = [];
  chapters.forEach((chapter, i) => {
    build.headings = [];
    const prefix = 'c' + (i + 1);
    const body = blocks(chapter.doc.content ?? [], build, prefix + '-');
    const toc = build.headings.filter(h => h.level <= 2);
    const heading = chapter.title ? '<h1>' + esc(chapter.title) + '</h1>\n' : '';
    const name = 'chapter-' + (i + 1) + '.xhtml';
    files.push({ name, id: 'chapter-' + (i + 1), title: chapter.title || toc[0]?.text || title, html: page(chapter.title || title, heading + body, lang), toc: chapter.title ? [{ level: 1, text: chapter.title, id: '' }, ...toc.filter(h => h.level === 2).map(h => ({ ...h, level: 2 }))] : toc });
  });
  const front: Array<{ name: string; id: string; title: string; html: string }> = [];
  if (options.titlePage) {
    const by = options.author?.trim() ? '<p class="by">' + esc(options.author.trim()) + '</p>' : '';
    const sub = options.subtitle?.trim() ? '<p><em>' + esc(options.subtitle.trim()) + '</em></p>' : '';
    front.push({ name: 'titlepage.xhtml', id: 'titlepage', title, html: page(title, '<div class="titlepage"><h1>' + esc(title) + '</h1>' + sub + by + '</div>', lang, ' epub:type="titlepage"') });
  }
  const entries = files.flatMap(f => f.toc.map(h => ({ ...h, href: f.name + (h.id ? '#' + h.id : '') })));
  const list = entries.length ? '<ol>' + entries.map(e => '<li class="l' + e.level + '"><a href="' + e.href + '">' + esc(e.text) + '</a></li>').join('') + '</ol>' : '<ol><li><a href="' + (files[0]?.name ?? 'titlepage.xhtml') + '">' + esc(title) + '</a></li></ol>';
  const marks = [...(front.length ? [['titlepage', front[0].name, 'Title page']] : []), ...(options.contents ? [['toc', 'nav.xhtml', 'Contents']] : []), ...(files.length ? [['bodymatter', files[0].name, 'Start of the book']] : [])];
  const landmarks = '<nav epub:type="landmarks" hidden="hidden"><h2>Guide</h2><ol>' + marks.map(([type, href, label]) => '<li><a epub:type="' + type + '" href="' + href + '">' + label + '</a></li>').join('') + '</ol></nav>';
  const nav = page('Contents', '<nav epub:type="toc" id="toc"><h1>Contents</h1>' + list + '</nav>' + landmarks, lang);
  // The older NCX contents, for readers that predate EPUB 3.
  const points = entries.length ? entries.map(e => ({ text: e.text, href: e.href })) : [{ text: title, href: files[0]?.name ?? 'nav.xhtml' }];
  const ncx = XML + '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="' + esc(id) + '"/></head><docTitle><text>' + esc(title) + '</text></docTitle><navMap>' +
    points.map((e, i) => '<navPoint id="np' + (i + 1) + '" playOrder="' + (i + 1) + '"><navLabel><text>' + esc(e.text) + '</text></navLabel><content src="' + e.href + '"/></navPoint>').join('') + '</navMap></ncx>';
  const spine = [...front.map(f => f.id), ...(options.contents ? ['nav'] : []), ...files.map(f => f.id)];
  const iso = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const opf = XML + '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:identifier id="book-id">' + esc(id) + '</dc:identifier><dc:title>' + esc(title) + '</dc:title><dc:language>' + esc(lang) + '</dc:language>' +
    (options.author?.trim() ? '<dc:creator>' + esc(options.author.trim()) + '</dc:creator>' : '') +
    '<dc:date>' + iso + '</dc:date><meta property="dcterms:modified">' + iso + '</meta>' +
    '<meta property="schema:accessMode">textual</meta><meta property="schema:accessModeSufficient">textual</meta>' +
    '<meta property="schema:accessibilityFeature">structuralNavigation</meta><meta property="schema:accessibilityHazard">none</meta>' +
    '<meta property="schema:accessibilitySummary">Text only, with a table of contents and headings for navigation.</meta></metadata><manifest>' +
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' +
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>' +
    [...front, ...files].map(f => '<item id="' + f.id + '" href="' + f.name + '" media-type="application/xhtml+xml"/>').join('') +
    '</manifest><spine toc="ncx">' + spine.map(ref => '<itemref idref="' + ref + '"/>').join('') + '</spine></package>';
  const encoder = new TextEncoder();
  const file = (name: string, text: string): ZipEntry => ({ name, data: encoder.encode(text) });
  return zipStored([
    // The first entry is the stored "mimetype" file, byte for byte, as the format requires.
    file('mimetype', 'application/epub+zip'),
    file('META-INF/container.xml', XML + '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    file('OEBPS/content.opf', opf),
    file('OEBPS/nav.xhtml', nav),
    file('OEBPS/toc.ncx', ncx),
    file('OEBPS/style.css', CSS),
    ...[...front, ...files].map(f => file('OEBPS/' + f.name, f.html)),
  ], now);
}
