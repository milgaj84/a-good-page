import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Focus from '@tiptap/extension-focus';
import BubbleMenu from '@tiptap/extension-bubble-menu';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { EditorState } from '@tiptap/pm/state';
import { Markdown } from 'tiptap-markdown';
import type { EditorPort } from '../core/session';
import type { EditorCommand, TextStyle } from '../core/commands';
import type { HeadingInfo } from '../core/outline';
import type { Anchor } from '../core/placement';
import { toPlainText } from '../core/plaintext';
import { sentenceFocusExtension } from './sentence-focus';
import { shouldOpenSlash } from '../ui/slash-menu';
import { bubblePlacement } from '../core/bubble';
import type { ZenPort } from '../core/zen';
import { zenGuardExtension } from './zen-guard';
import { polishDocument, polishSlice } from './polish';
import { polishMarkdownSource } from '../core/smart-text';

export interface WriterEditor extends EditorPort {
  readonly instance: Editor;
  getText(): string;
  getPlainText(): string;
  getJSON(): import('../export/pdf').ProseNode;
  selectionText(): string;
  caretPos(): number;
  caretTop(): number | null;
  caretRect(): Anchor | null;
  /** Top and bottom of the line holding the caret, in window pixels. */
  caretLine(): { top: number; bottom: number } | null;
  restoreFocus(): void;
  run(command: EditorCommand): void;
  isActive(name: string): boolean;
  can(name: string): boolean;
  textStyle(): TextStyle | null;
  headings(): HeadingInfo[];
  jumpTo(pos: number): void;
  /** Replaces the whole page as one undoable edit without taking focus (used while a dialog is open). */
  replaceQuietly(content: string, plain: boolean): void;
  /** Puts the caret at an exact document position without scrolling; clamps to the page. */
  restoreCaret(pos: number): void;
  linkHref(): string | null;
  setLink(href: string): void;
  unsetLink(): void;
  setPlainText(text: string): void;
  sentenceFocus(active?: boolean): boolean;
  /** Curls quotes and sets dashes and ellipses across the page in one undoable step; returns the runs changed. */
  polishTypography(): number;
  /** Replaces the page but keeps undo history, so a restored version can be undone. */
  replaceContent(content: string, plain: boolean): void;
}

export interface WriterEditorOptions {
  element: HTMLElement;
  bubble: HTMLElement;
  onEdit(): void;
  onSelection(): void;
  onSlash(anchor: Anchor): void;
  onSlashKey(event: KeyboardEvent): boolean;
  /** Zen draft decides whether a deletion may go through. */
  zen: ZenPort;
}

type Check = (editor: Editor) => boolean;

const RUN: Record<EditorCommand, Check> = {
  bold: (e) => e.chain().focus().toggleBold().run(),
  italic: (e) => e.chain().focus().toggleItalic().run(),
  strike: (e) => e.chain().focus().toggleStrike().run(),
  code: (e) => e.chain().focus().toggleCode().run(),
  paragraph: (e) => e.chain().focus().setParagraph().run(),
  h1: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  h2: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  h3: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  bullet: (e) => e.chain().focus().toggleBulletList().run(),
  ordered: (e) => e.chain().focus().toggleOrderedList().run(),
  task: (e) => e.chain().focus().toggleTaskList().run(),
  quote: (e) => e.chain().focus().toggleBlockquote().run(),
  hr: (e) => e.chain().focus().setHorizontalRule().run(),
  undo: (e) => e.chain().focus().undo().run(),
  redo: (e) => e.chain().focus().redo().run(),
};

const ACTIVE: Record<string, Check> = {
  bold: (e) => e.isActive('bold'),
  italic: (e) => e.isActive('italic'),
  strike: (e) => e.isActive('strike'),
  code: (e) => e.isActive('code'),
  h1: (e) => e.isActive('heading', { level: 1 }),
  h2: (e) => e.isActive('heading', { level: 2 }),
  h3: (e) => e.isActive('heading', { level: 3 }),
  bullet: (e) => e.isActive('bulletList'),
  ordered: (e) => e.isActive('orderedList'),
  task: (e) => e.isActive('taskList'),
  quote: (e) => e.isActive('blockquote'),
  link: (e) => e.isActive('link'),
};

const CAN: Record<string, Check> = {
  undo: (e) => e.can().undo(),
  redo: (e) => e.can().redo(),
};

const LEVELS = [1, 2, 3] as const;

function extensions(bubble: HTMLElement, sentenceEnabled: () => boolean, zen: ZenPort) {
  return [
    zenGuardExtension(zen),
    StarterKit.configure({ heading: { levels: [...LEVELS] } }),
    sentenceFocusExtension(sentenceEnabled),
    Placeholder.configure({ placeholder: 'Begin your story…' }),
    Typography,
    Focus.configure({ className: 'has-focus', mode: 'shallowest' }),
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: true,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: null },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    BubbleMenu.configure({
      element: bubble,
      tippyOptions: bubblePlacement(),
    }),
    Markdown.configure({
      html: false,
      tightLists: true,
      bulletListMarker: '-',
      linkify: false,
      breaks: false,
      transformPastedText: true,
      transformCopiedText: false,
    }),
  ];
}

export function createWriterEditor(opts: WriterEditorOptions): WriterEditor {
  let sentenceEnabled = false;
  const editor = new Editor({
    element: opts.element,
    autofocus: false,
    extensions: extensions(opts.bubble, () => sentenceEnabled, opts.zen),
    editorProps: {
      handleKeyDown: (_view, event) => opts.onSlashKey(event),
      // Pasted text gets the same dashes, ellipses and curly quotes as typed text; code stays literal.
      transformPastedText: (text, inCode) => (inCode ? text : polishMarkdownSource(text)),
      transformPasted: (slice, view) => (view.state.selection.$from.parent.type.spec.code ? slice : polishSlice(slice)),
      handleTextInput: (view, from, to, text) => {
        const $from = view.state.doc.resolve(from);
        if (!$from.parent.isTextblock || !shouldOpenSlash(text, from, to, $from.parent.type.name, $from.parent.textContent.length)) return false;
        const rect = view.coordsAtPos(from);
        opts.onSlash({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
        return true;
      },
      attributes: { class: 'prose', spellcheck: 'true', 'aria-label': 'Your writing' },
    },
    onUpdate: () => opts.onEdit(),
    onSelectionUpdate: () => opts.onSelection(),
  });

  const coords = (pos: number) => editor.view.coordsAtPos(pos);
  const plainDoc = (text: string) => ({ type: 'doc', content: text.replace(/\r\n?/g, '\n').split('\n').map((line) => ({
    type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [],
  })) });
  // A freshly loaded document gets a fresh undo history.
  const resetHistory = () => {
    const { schema, doc, plugins } = editor.state;
    editor.view.updateState(EditorState.create({ schema, doc, plugins }));
  };

  return {
    instance: editor,
    sentenceFocus: (active?: boolean) => {
      sentenceEnabled = active ?? !sentenceEnabled;
      editor.view.dispatch(editor.state.tr.setMeta('sentenceFocus', sentenceEnabled));
      return sentenceEnabled;
    },
    getMarkdown: () => (editor.storage.markdown as { getMarkdown(): string }).getMarkdown(),
    getPlainText: () => toPlainText(editor.getJSON()),
    getJSON: () => editor.getJSON(),
    setPlainText: (text: string) => {
      editor.commands.setContent(plainDoc(text), false);
      resetHistory();
    },
    replaceContent: (content: string, plain: boolean) => {
      editor.chain().focus().setContent(plain ? plainDoc(content) : content, true).run();
    },
    replaceQuietly: (content: string, plain: boolean) => {
      editor.commands.setContent(plain ? plainDoc(content) : content, true);
    },
    polishTypography: () => {
      const tr = editor.state.tr;
      const changed = polishDocument(editor.state.doc, tr);
      if (changed > 0) editor.view.dispatch(tr.scrollIntoView());
      return changed;
    },
    setMarkdown: (markdown: string) => {
      editor.commands.setContent(markdown, false);
      resetHistory();
    },
    focus: () => {
      editor.commands.focus('end');
    },
    restoreFocus: () => {
      editor.commands.focus();
    },
    getText: () => editor.getText(),
    selectionText: () => {
      const { from, to, empty } = editor.state.selection;
      return empty ? '' : editor.state.doc.textBetween(from, to, ' ');
    },
    caretPos: () => editor.state.selection.from,
    caretTop: () => {
      try {
        return coords(editor.state.selection.head).top;
      } catch {
        return null;
      }
    },
    caretLine: () => {
      try {
        const { top, bottom } = coords(editor.state.selection.head);
        return { top, bottom };
      } catch {
        return null;
      }
    },
    caretRect: () => {
      try {
        const { from, to } = editor.state.selection;
        const start = coords(from);
        const end = coords(to);
        return {
          left: Math.min(start.left, end.left),
          right: Math.max(start.right, end.right),
          top: Math.min(start.top, end.top),
          bottom: Math.max(start.bottom, end.bottom),
        };
      } catch {
        return null;
      }
    },
    run: (command: EditorCommand) => {
      RUN[command](editor);
    },
    isActive: (name: string) => ACTIVE[name]?.(editor) ?? false,
    can: (name: string) => CAN[name]?.(editor) ?? true,
    textStyle: () => {
      for (const level of LEVELS) {
        if (editor.isActive('heading', { level })) return ('h' + level) as TextStyle;
      }
      return editor.isActive('paragraph') ? 'paragraph' : null;
    },
    headings: () => {
      const found: HeadingInfo[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          found.push({ level: Number(node.attrs.level), text: node.textContent, pos });
          return false;
        }
        return node.isBlock;
      });
      return found;
    },
    restoreCaret: (pos: number) => {
      const size = editor.state.doc.content.size;
      const target = Math.min(Math.max(Math.floor(pos), 1), Math.max(1, size - 1));
      editor.commands.setTextSelection(target);
    },
    jumpTo: (pos: number) => {
      const size = editor.state.doc.content.size;
      const target = Math.min(Math.max(Math.floor(pos) + 1, 0), size);
      editor.chain().focus().setTextSelection(target).run();
    },
    linkHref: () => {
      const href: unknown = editor.getAttributes('link').href;
      return typeof href === 'string' && href.length > 0 ? href : null;
    },
    setLink: (href: string) => {
      if (editor.isActive('link')) {
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      } else if (editor.state.selection.empty) {
        const label = href.replace(/^mailto:/i, '');
        editor
          .chain()
          .focus()
          .insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] })
          .run();
      } else {
        editor.chain().focus().setLink({ href }).run();
      }
    },
    unsetLink: () => {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    },
  };
}
