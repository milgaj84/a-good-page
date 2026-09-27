import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';

/** A read-only page for reference notes and earlier versions. It never saves or edits anything. */
export interface ReaderView {
  show(content: string, plain: boolean): void;
  destroy(): void;
}

export function createReader(element: HTMLElement): ReaderView {
  const editor = new Editor({
    element,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, tightLists: true, linkify: false, breaks: false }),
    ],
    editorProps: { attributes: { class: 'prose reader-prose', 'aria-readonly': 'true' } },
  });
  return {
    show(content, plain) {
      if (plain) {
        const paragraphs = content.replace(/\r\n?/g, '\n').split('\n')
          .map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }));
        editor.commands.setContent({ type: 'doc', content: paragraphs }, false);
      } else {
        editor.commands.setContent(content, false);
      }
    },
    destroy: () => editor.destroy(),
  };
}
