import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import type { Content } from 'pdfmake/interfaces';
import { frontMatter, pdfDocument, proseBlocks, renderPdfDefinition, type PdfOptions, type ProseNode } from './pdf';
import type { ExportLayout } from './layout';
import type { ProjectFile } from '../core/project';

/** Remove only a leading display title; later headings stay in the chapter. */
export function chapterBody(file: ProjectFile): string {
  if (/\.txt$/i.test(file.path)) return file.text;
  return file.text.replace(/^\uFEFF?\s*#{1,3}\s+[^\n]*\n?/, '');
}
/** Compile a fixed, ordered snapshot; never modify chapter sources. */
export function compiledMarkdown(chapters: readonly ProjectFile[]): string {
  return chapters.map(file => {
    const title = file.title.replace(/[\r\n#]/g, ' ').trim();
    const body = /\.txt$/i.test(file.path)
      ? file.text.split(String.fromCharCode(10)).map(line => line.replace(/[\\\x60*_{}\[\]<>#+.!|~-]/g, '\\$&')).join('  ' + String.fromCharCode(10))
      : chapterBody(file);
    return '# ' + title + String.fromCharCode(10,10) + body;
  }).join(String.fromCharCode(10,10) + '---' + String.fromCharCode(10,10));
}
/** Chapter text as prose, the same way for PDF and Word. */
export function parseChapter(file: ProjectFile): ProseNode { return parse(chapterBody(file), /\.txt$/i.test(file.path)); }

function parse(text: string, plain: boolean): ProseNode {
  const element = document.createElement('div');
  const editor = new Editor({ element, editable: false, extensions: [StarterKit, Link, TaskList,
    TaskItem.configure({ nested: true }), Markdown.configure({ html: false, tightLists: true, linkify: false })] });
  try {
    if (plain) {
      const content = text.split(String.fromCharCode(10)).map(line => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }));
      editor.commands.setContent({ type: 'doc', content }, false);
    } else editor.commands.setContent(text, false);
    return editor.getJSON();
  } finally { editor.destroy(); }
}
export function projectPdfDocument(chapters: readonly ProjectFile[], title: string, layout: ExportLayout, options: PdfOptions = {}) {
  if (!chapters.length) throw Error('Select at least one chapter.');
  const definition = pdfDocument({ type: 'doc', content: [] }, title, layout, options);
  const content: Content[] = [...frontMatter(title, options)];
  chapters.forEach((file, i) => {
    content.push({ text: file.title, style: 'title', ...(options.contents ? { tocItem: true } : {}), ...(i ? { pageBreak: 'before' as const } : {}) } as Content);
    content.push(...proseBlocks(parseChapter(file), Boolean(options.contents)));
  });
  definition.content = content;
  return definition;
}
export function renderProjectPdf(chapters: readonly ProjectFile[], title: string, layout: ExportLayout, options: PdfOptions = {}): Promise<Uint8Array> {
  return renderPdfDefinition(projectPdfDocument(chapters, title, layout, options));
}
