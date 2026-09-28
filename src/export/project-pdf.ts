import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import type { Content } from 'pdfmake/interfaces';
import { pdfDocument, renderPdfDefinition, type ProseNode } from './pdf';
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
export function projectPdfDocument(chapters: readonly ProjectFile[], title: string, layout: ExportLayout) {
  if (!chapters.length) throw Error('Select at least one chapter.');
  const definition = pdfDocument({ type: 'doc', content: [] }, title, layout);
  const content: Content[] = [];
  chapters.forEach((file, i) => {
    content.push({ text: file.title, style: 'title', ...(i ? { pageBreak: 'before' as const } : {}) });
    const body = chapterBody(file);
    const doc = parse(body, /\.txt$/i.test(file.path));
    const pages = pdfDocument(doc, title, layout).content as Content[];
    content.push(...pages);
  });
  definition.content = content;
  return definition;
}
export function renderProjectPdf(chapters: readonly ProjectFile[], title: string, layout: ExportLayout): Promise<Uint8Array> {
  return renderPdfDefinition(projectPdfDocument(chapters, title, layout));
}
