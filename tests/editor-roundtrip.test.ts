import { describe, expect, it, vi } from 'vitest';

// The bubble menu needs a real browser (tippy); everything else is the real editor configuration.
vi.mock('@tiptap/extension-bubble-menu', async () => {
  const { Extension } = await import('@tiptap/core');
  return { default: Extension.create({ name: 'bubbleMenu' }) };
});
import { createWriterEditor } from '../src/editor/editor';
import { simplifiesMarkdown } from '../src/core/session';

const zen = { blockKey: () => false, blockInput: () => false, blockCut: () => false, blockDrag: () => false };

function makeEditor() {
  const element = document.createElement('div');
  const bubble = document.createElement('div');
  document.body.append(element, bubble);
  return createWriterEditor({ element, bubble, onEdit() {}, onSelection() {}, onSlash() {}, onSlashKey: () => false, zen });
}

/** Types like the browser does: input rules get first refusal, otherwise the text is inserted. */
function type(editor: ReturnType<typeof makeEditor>, text: string) {
  const view = editor.instance.view;
  for (const ch of text) {
    const { from, to } = view.state.selection;
    if (!view.someProp('handleTextInput', (f) => f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)))) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
}

// What the real editor does to files it cannot represent (finding E0).
const LOSSY: Record<string, string> = {
  table: '| a | b |\n|---|---|\n| 1 | 2 |\n',
  image: 'Look ![a](b.png) here.\n',
  html: 'Before\n\n<div class="x">raw <b>html</b></div>\n\nAfter\n',
  footnote: 'Text[^1] more.\n\n[^1]: The note.\n',
  frontmatter: '---\ntitle: Hi\ntags: [a]\n---\n\nBody text.\n',
  hardwrap: 'one line wrapped\nonto the next line\n\nSecond para.\n',
};
const ORDINARY: Record<string, string> = {
  plain: '# Title\n\nSome *emphasis* and **bold**.\n\n- a\n- b\n',
  star_list_crlf: '# Title\r\n\r\n* a\r\n* b\r\n\r\nEnd.  \r\n',
  link: 'A [link](https://example.com) here.\n\n> quoted\n\n1. one\n2. two\n',
  rule: 'Above\n\n***\n\nBelow\n',
};

describe('E0: what survives load -> getMarkdown through the real editor', () => {
  for (const [name, md] of Object.entries(LOSSY)) {
    it(name + ' is reshaped and detected', () => {
      const e = makeEditor();
      e.setMarkdown(md);
      expect(e.getMarkdown()).not.toBe(md);
      expect(simplifiesMarkdown(md, e.getMarkdown())).toBe(true);
    });
  }
  for (const [name, md] of Object.entries(ORDINARY)) {
    it(name + ' does not raise the notice', () => {
      const e = makeEditor();
      e.setMarkdown(md);
      expect(simplifiesMarkdown(md, e.getMarkdown())).toBe(false);
    });
  }
});

describe('plain text pages', () => {
  it('Markdown pages still turn "# " into a heading and curl quotes', () => {
    const e = makeEditor();
    e.setMarkdown('');
    type(e, '# Title');
    expect(e.instance.getJSON().content?.[0].type).toBe('heading');
    e.setMarkdown('');
    type(e, '"hi"');
    expect(e.instance.getText()).toBe('“hi”');
  });
  it('a .txt page keeps what was typed literally', () => {
    const e = makeEditor();
    e.setPlainText('');
    type(e, '# Title');
    expect(e.instance.getJSON().content?.[0]).toMatchObject({ type: 'paragraph' });
    expect(e.getPlainText()).toBe('# Title');
    e.setPlainText('');
    type(e, '"it\'s" -- 1. a --- *x*');
    expect(e.getPlainText()).toBe('"it\'s" -- 1. a --- *x*');
  });
  it('going back to a Markdown page restores the input rules', () => {
    const e = makeEditor();
    e.setPlainText('');
    e.setMarkdown('');
    type(e, '# Title');
    expect(e.instance.getJSON().content?.[0].type).toBe('heading');
  });
});
