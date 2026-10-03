/** What Rust hands over for a Word file: the three XML parts that matter. Nothing else is read. */
export interface DocxParts { document: string; rels: string; numbering: string }
export interface ImportedPage { title: string; markdown: string }
export interface ImportedBook {
  /** The document's Title paragraph, or its only Heading 1 when chapters are Heading 2. Null when it has none. */
  title: string | null;
  pages: ImportedPage[];
  /** Pictures and drawings are not imported. */
  pictures: number;
}

// Names are matched without their prefix (w:, r:), so any producer's spelling reads the same.
const local = (name: string): string => name.replace(/^.*:/, '');
const all = (doc: Document | Element, name: string): Element[] => [...doc.getElementsByTagName('*')].filter(e => local(e.nodeName) === name);
const attr = (node: Element, name: string): string | null => {
  for (const a of node.attributes) if (local(a.name) === name) return a.value;
  return null;
};

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'text'; md: string; list?: 'bullet' | 'ordered'; depth: number; quote: boolean };

const kids = (node: Element, name: string): Element[] => [...node.children].filter(c => local(c.nodeName) === name);
const first = (node: Element, name: string): Element | undefined => kids(node, name)[0];
const val = (node: Element | undefined): string | null => (node ? attr(node, 'val') : null);
/** A toggle like <w:b/> is on unless it says val="0" or "false". */
const on = (node: Element | undefined): boolean => Boolean(node) && !['0', 'false', 'off'].includes(val(node) ?? '');

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('That is not a readable Word document.');
  return doc;
}

/** For each numbering instance and level: is it a bullet, or numbered? */
function listKinds(numbering: string): (numId: string, level: number) => 'bullet' | 'ordered' {
  const formats = new Map<string, string>();
  const abstractOf = new Map<string, string>();
  if (numbering) {
    const doc = xml(numbering);
    for (const a of all(doc, 'abstractNum'))
      for (const lvl of kids(a, 'lvl')) formats.set(attr(a, 'abstractNumId') + ':' + attr(lvl, 'ilvl'), val(first(lvl, 'numFmt')) ?? '');
    for (const n of all(doc, 'num')) abstractOf.set(attr(n, 'numId') ?? '', val(first(n, 'abstractNumId')) ?? '');
  }
  return (numId, level) => {
    const format = formats.get(abstractOf.get(numId) + ':' + level);
    return format === undefined || format === 'bullet' || format === 'none' ? 'bullet' : 'ordered';
  };
}

function links(rels: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!rels) return out;
  for (const r of xml(rels).getElementsByTagName('Relationship'))
    if (r.getAttribute('TargetMode') === 'External' && /^(https?:|mailto:)/i.test(r.getAttribute('Target') ?? '')) out.set(r.getAttribute('Id') ?? '', r.getAttribute('Target')!);
  return out;
}

interface Run { text: string; bold: boolean; italic: boolean; strike: boolean; href: string | null }

function collect(node: Element, href: string | null, out: Run[], hyperlinks: Map<string, string>): void {
  for (const child of node.children) {
    const name = local(child.nodeName);
    if (name === 'r') {
      const props = first(child, 'rPr');
      const flags = { bold: on(props && first(props, 'b')), italic: on(props && first(props, 'i')), strike: on(props && first(props, 'strike')) };
      let text = '';
      for (const part of child.children) {
        const kind = local(part.nodeName);
        if (kind === 't') text += part.textContent ?? '';
        else if (kind === 'tab') text += ' ';
        else if (kind === 'br' && !attr(part, 'type')) text += '\n';
      }
      if (text) out.push({ text, ...flags, href });
    } else if (name === 'hyperlink') {
      const id = attr(child, 'id');
      collect(child, (id && hyperlinks.get(id)) || href, out, hyperlinks);
    } else if (name !== 'pPr' && name !== 'del' && name !== 'moveFrom') collect(child, href, out, hyperlinks);
  }
}

const escapeText = (text: string): string => text.replace(/([\\*_`[\]<>])/g, '\\$1');

/** Marks never sit against spaces in Markdown, so the spaces step outside them. */
function wrap(text: string, run: Run): string {
  const [, lead, inner, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  if (!inner) return text;
  let out = escapeText(inner);
  if (run.strike) out = '~~' + out + '~~';
  if (run.bold) out = '**' + out + '**';
  if (run.italic) out = '*' + out + '*';
  if (run.href) out = '[' + out + '](' + run.href.replace(/[()\s]/g, c => encodeURIComponent(c)) + ')';
  return lead + out + trail;
}

function inline(p: Element, hyperlinks: Map<string, string>): { md: string; plain: string } {
  const runs: Run[] = [];
  collect(p, null, runs, hyperlinks);
  const merged: Run[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italic === run.italic && last.strike === run.strike && last.href === run.href) last.text += run.text;
    else merged.push({ ...run });
  }
  return {
    md: merged.map(r => wrap(r.text, r).replace(/\n/g, '  \n')).join(''),
    plain: runs.map(r => r.text).join('').replace(/\s+/g, ' ').trim(),
  };
}

const SCENE_BREAK = /^\s*(?:[*#~_•⁂-]\s*){3,}$|^\s*[#⁂]\s*$/;

function blocksOf(parts: DocxParts): { blocks: Block[]; title: string | null; pictures: number } {
  const doc = xml(parts.document);
  const hyperlinks = links(parts.rels);
  const kindOf = listKinds(parts.numbering);
  const blocks: Block[] = [];
  let title: string | null = null;
  for (const p of all(doc, 'p')) {
    let inside = false;
    for (let up = p.parentElement; up && !inside; up = up.parentElement) inside = local(up.nodeName) === 'p';
    if (inside) continue; // text boxes repeat their words inside another paragraph
    const props = first(p, 'pPr');
    const style = val(props && first(props, 'pStyle')) ?? '';
    const { md, plain } = inline(p, hyperlinks);
    if (!plain) continue;
    if (/^title$/i.test(style)) { title ??= plain; continue; }
    if (/^subtitle$/i.test(style)) continue;
    const outline = val(props && first(props, 'outlineLvl'));
    const named = /^heading ?([1-9])$/i.exec(style);
    const level = named ? Number(named[1]) : outline !== null && Number(outline) < 9 ? Number(outline) + 1 : 0;
    if (level) { blocks.push({ kind: 'heading', level, text: plain }); continue; }
    if (SCENE_BREAK.test(plain)) { blocks.push({ kind: 'text', md: '---', depth: 0, quote: false }); continue; }
    const numPr = props && first(props, 'numPr');
    const numId = val(numPr && first(numPr, 'numId'));
    const depth = Math.min(Number(val(numPr && first(numPr, 'ilvl')) ?? 0) || 0, 5);
    let list: 'bullet' | 'ordered' | undefined;
    if (numId && numId !== '0') list = kindOf(numId, depth);
    else if (/^list ?bullet/i.test(style)) list = 'bullet';
    else if (/^list ?number/i.test(style)) list = 'ordered';
    const quote = /quote/i.test(style);
    // A line that would read as Markdown syntax is protected: "# 1" stays a number, "- yes" stays a dash.
    const safe = list ? md : md.replace(/^(\s*)([#>+-]|\d+[.)])(?=\s)/, '$1\\$2');
    blocks.push({ kind: 'text', md: safe, list, depth, quote });
  }
  const pictures = all(doc, 'drawing').length + all(doc, 'pict').length;
  return { blocks, title, pictures };
}

function render(blocks: readonly Block[], shift: number): string {
  const out: string[] = [];
  let list: string[] = [];
  let listKind = '';
  const flush = (): void => { if (list.length) out.push(list.join('\n')); list = []; listKind = ''; };
  for (const block of blocks) {
    if (block.kind === 'heading') { flush(); out.push('#'.repeat(Math.min(6, Math.max(1, block.level - shift))) + ' ' + block.text); continue; }
    if (block.list) {
      if (block.depth === 0 && listKind && listKind !== block.list) flush();
      listKind ||= block.list;
      list.push('  '.repeat(block.depth) + (block.list === 'bullet' ? '- ' : '1. ') + block.md);
      continue;
    }
    flush();
    out.push(block.quote ? block.md.split('\n').map(line => '> ' + line).join('\n') : block.md);
  }
  flush();
  return out.join('\n\n');
}

/**
 * Turns a Word document into pages. Every Heading 1 starts a page. If the document has a single Heading 1 (the
 * book's title) and several Heading 2s, those are the chapters instead. Words before the first chapter become
 * "Front matter"; a document with no chapters is one page called `fallback`.
 */
export function importDocx(parts: DocxParts, fallback: string): ImportedBook {
  const { blocks, title: styled, pictures } = blocksOf(parts);
  const count = (level: number): number => blocks.filter(b => b.kind === 'heading' && b.level === level).length;
  const split = count(1) <= 1 && count(2) >= 2 ? 2 : 1;
  let title = styled;
  const pages: ImportedPage[] = [];
  let front: Block[] = [];
  let current: { title: string; body: Block[] } | null = null;
  const close = (): void => { if (current) pages.push({ title: current.title, markdown: ('# ' + current.title + '\n\n' + render(current.body, split - 1)).trimEnd() + '\n' }); };
  for (const block of blocks) {
    if (block.kind === 'heading' && block.level < split) { title ??= block.text; continue; }
    if (block.kind === 'heading' && block.level === split) { close(); current = { title: block.text, body: [] }; continue; }
    (current ? current.body : front).push(block);
  }
  close();
  if (front.length) {
    const body = render(front, split - 1);
    if (pages.length) pages.unshift({ title: 'Front matter', markdown: '# Front matter\n\n' + body + '\n' });
    else pages.push({ title: fallback, markdown: '# ' + fallback + '\n\n' + body + '\n' });
  }
  return { title, pages, pictures };
}
