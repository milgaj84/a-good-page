import type { ProseNode } from './pdf';
import { zipStored, type ZipEntry } from './zip';

export interface DocxChapter {
  /** A chapter title starts a new page and appears in the contents. Omit for a single page that carries its own headings. */
  title?: string;
  doc: ProseNode;
}

export interface DocxOptions {
  title: string;
  subtitle?: string;
  author?: string;
  titlePage?: boolean;
  contents?: boolean;
  pageNumbers?: boolean;
  /** BCP-47 tag for spelling and hyphenation in Word; defaults to English. */
  language?: string;
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Escapes text for XML and drops characters Word rejects. */
export function esc(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface Build {
  body: string[];
  links: Map<string, string>;
  /** Ordered-list instances: each list restarts at 1. */
  numbers: number;
  headings: Array<{ level: number; text: string }>;
}

function plain(node: ProseNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  return (node.content ?? []).map(plain).join('');
}

function run(text: string, marks: Array<{ type: string; attrs?: Record<string, unknown> }> = [], extra = ''): string {
  const props: string[] = [];
  if (marks.some(m => m.type === 'bold')) props.push('<w:b/>');
  if (marks.some(m => m.type === 'italic')) props.push('<w:i/>');
  if (marks.some(m => m.type === 'strike')) props.push('<w:strike/>');
  if (marks.some(m => m.type === 'underline')) props.push('<w:u w:val="single"/>');
  if (marks.some(m => m.type === 'code')) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="21"/>');
  if (extra) props.push(extra);
  const rPr = props.length ? '<w:rPr>' + props.join('') + '</w:rPr>' : '';
  return '<w:r>' + rPr + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>';
}

function inline(nodes: ProseNode[], build: Build): string {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'hardBreak') { out += '<w:r><w:br/></w:r>'; continue; }
    if (node.type !== 'text') { out += inline(node.content ?? [], build); continue; }
    const marks = node.marks ?? [];
    const href = marks.find(m => m.type === 'link')?.attrs?.href;
    if (typeof href === 'string' && /^(https?:|mailto:)/.test(href)) {
      let id = build.links.get(href);
      if (!id) { id = 'rIdLink' + (build.links.size + 1); build.links.set(href, id); }
      out += '<w:hyperlink r:id="' + id + '" w:history="1">' + run(node.text ?? '', marks, '<w:color w:val="0563C1"/><w:u w:val="single"/>') + '</w:hyperlink>';
    } else out += run(node.text ?? '', marks);
  }
  return out;
}

const para = (content: string, style = '', props = ''): string =>
  '<w:p>' + (style || props ? '<w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') + props + '</w:pPr>' : '') + content + '</w:p>';

function blocks(nodes: ProseNode[], build: Build, ctx: { quote?: boolean; list?: { id: number; level: number } } = {}): void {
  for (const node of nodes) {
    const children = node.content ?? [];
    if (node.type === 'heading') {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
      build.headings.push({ level, text: plain(node) });
      build.body.push(para(inline(children, build), 'Heading' + level));
    } else if (node.type === 'paragraph') {
      const content = inline(children, build);
      if (ctx.list) build.body.push(para(content, 'ListParagraph', '<w:numPr><w:ilvl w:val="' + Math.min(ctx.list.level, 8) + '"/><w:numId w:val="' + ctx.list.id + '"/></w:numPr>'));
      else build.body.push(para(content, ctx.quote ? 'Quote' : ''));
    } else if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      const id = node.type === 'orderedList' ? 100 + build.numbers++ : 1;
      const level = ctx.list ? ctx.list.level + 1 : 0;
      for (const item of children) {
        const mark = node.type === 'taskList' ? (item.attrs?.checked ? '☑ ' : '☐ ') : '';
        let first = true;
        for (const child of item.content ?? []) {
          if (child.type === 'paragraph') {
            const content = (first && mark ? run(mark) : '') + inline(child.content ?? [], build);
            build.body.push(para(content, 'ListParagraph', '<w:numPr><w:ilvl w:val="' + Math.min(level, 8) + '"/><w:numId w:val="' + (node.type === 'taskList' ? 0 : id) + '"/></w:numPr>'));
            first = false;
          } else blocks([child], build, { list: { id, level } });
        }
      }
    } else if (node.type === 'blockquote') {
      blocks(children, build, { quote: true });
    } else if (node.type === 'horizontalRule') {
      build.body.push(para(run('⁂', [], '<w:color w:val="9A8674"/>'), 'SceneBreak'));
    } else if (node.type === 'codeBlock') {
      const text = node.text ?? children.map(c => c.text ?? '').join('');
      for (const line of text.split('\n')) build.body.push(para(run(line, [{ type: 'code' }]), 'Code'));
    } else if (children.length) blocks(children, build, ctx);
  }
}

const styles = (lang: string): string => XML + '<w:styles ' + NS + '>' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="' + esc(lang) + '"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="324" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="64"/><w:szCs w:val="64"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="685D51"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Author"><w:name w:val="Author"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="480"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="140"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720" w:right="360"/></w:pPr><w:rPr><w:i/><w:color w:val="685D51"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/><w:ind w:left="720"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="SceneBreak"><w:name w:val="Scene Break"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="360"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="ContentsHeading"><w:name w:val="Contents Heading"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Contents1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Contents2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:ind w:left="360"/></w:pPr><w:rPr><w:color w:val="685D51"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="18"/><w:color w:val="9A9086"/></w:rPr></w:style>' +
  '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
  '</w:styles>';

/** A BCP-47 tag, or the fallback when it is missing or malformed. */
export const safeLanguage = (tag: string | undefined, fallback: string): string => (tag && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(tag) ? tag : fallback);

function numbering(orderedLists: number): string {
  const level = (i: number, fmt: string, text: string): string =>
    '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="' + fmt + '"/><w:lvlText w:val="' + text + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 + i * 360) + '" w:hanging="360"/></w:pPr></w:lvl>';
  const bullets = Array.from({ length: 9 }, (_, i) => level(i, 'bullet', i % 2 ? 'o' : '•')).join('');
  const decimals = Array.from({ length: 9 }, (_, i) => level(i, i % 3 === 0 ? 'decimal' : i % 3 === 1 ? 'lowerLetter' : 'lowerRoman', '%' + (i + 1) + '.')).join('');
  const nums = Array.from({ length: orderedLists }, (_, i) =>
    '<w:num w:numId="' + (100 + i) + '"><w:abstractNumId w:val="2"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>').join('');
  return XML + '<w:numbering ' + NS + '><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>' + bullets + '</w:abstractNum>' +
    '<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/>' + decimals + '</w:abstractNum>' +
    '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>' + nums + '</w:numbering>';
}

const FOOTER = XML + '<w:ftr ' + NS + '><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';

/**
 * Builds a Word document from the same prose the editor holds. Headings, bold, italic, links, lists,
 * quotes and scene breaks keep their meaning. The contents is a plain list of titles (Word cannot know
 * page numbers until it lays the document out); page numbers are a live field in the footer.
 */
export function docxBytes(chapters: readonly DocxChapter[], options: DocxOptions, now: Date = new Date()): Uint8Array {
  const build: Build = { body: [], links: new Map(), numbers: 0, headings: [] };
  const title = options.title.trim() || 'Untitled';
  const bodies: string[][] = [];
  const toc: Array<{ level: number; text: string }> = [];
  for (const chapter of chapters) {
    const before = build.body.length;
    const headingsBefore = build.headings.length;
    if (chapter.title) {
      build.headings.push({ level: 1, text: chapter.title });
      build.body.push(para(run(chapter.title), 'Heading1', '<w:pageBreakBefore/>'));
    }
    blocks(chapter.doc.content ?? [], build);
    bodies.push(build.body.slice(before));
    toc.push(...build.headings.slice(headingsBefore).filter(h => h.level <= 2));
  }
  const front: string[] = [];
  if (options.titlePage) {
    front.push(para('', '', '<w:spacing w:before="3200" w:after="0"/>'));
    front.push(para(run(title), 'Title'));
    if (options.subtitle?.trim()) front.push(para(run(options.subtitle.trim()), 'Subtitle'));
    if (options.author?.trim()) front.push(para(run(options.author.trim()), 'Author'));
    front.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  }
  if (options.contents && toc.length) {
    front.push(para(run('Contents'), 'ContentsHeading'));
    for (const entry of toc) front.push(para(run(entry.text), entry.level === 1 ? 'Contents1' : 'Contents2'));
    front.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  }
  // The title page and contents already end with a page break; the first chapter must not add a second.
  if (front.length && bodies[0]?.[0]) bodies[0][0] = bodies[0][0].replace('<w:pageBreakBefore/>', '');
  const content = [...front, ...bodies.flat()];
  // A chapter heading that opens the document needs no page break of its own after a title page; harmless otherwise.
  const sect = '<w:sectPr>' + (options.pageNumbers !== false ? '<w:footerReference w:type="default" r:id="rIdFooter"/>' : '') +
    '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>' +
    (options.titlePage && options.pageNumbers !== false ? '<w:titlePg/>' : '') + '</w:sectPr>';
  const document = XML + '<w:document ' + NS + '><w:body>' + (content.length ? content.join('') : para('')) + sect + '</w:body></w:document>';
  const rels = ['<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'];
  if (options.pageNumbers !== false) rels.push('<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>');
  for (const [href, id] of build.links) rels.push('<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + esc(href) + '" TargetMode="External"/>');
  const iso = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const encoder = new TextEncoder();
  const file = (name: string, text: string): ZipEntry => ({ name, data: encoder.encode(text) });
  const entries: ZipEntry[] = [
    file('[Content_Types].xml', XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      (options.pageNumbers !== false ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'),
    file('_rels/.rels', XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'),
    file('word/document.xml', document),
    file('word/styles.xml', styles(safeLanguage(options.language, 'en-US'))),
    file('word/numbering.xml', numbering(build.numbers)),
    file('word/_rels/document.xml.rels', XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>'),
    file('docProps/core.xml', XML + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + esc(title) + '</dc:title>' +
      (options.author?.trim() ? '<dc:creator>' + esc(options.author.trim()) + '</dc:creator>' : '') +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created></cp:coreProperties>'),
  ];
  if (options.pageNumbers !== false) entries.splice(5, 0, file('word/footer1.xml', FOOTER));
  return zipStored(entries, now);
}
