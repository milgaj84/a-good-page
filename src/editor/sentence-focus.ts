import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { sentenceAt } from '../core/sentence';

/** Selection-only visual decorations; never changes document content or Markdown. */
export function sentenceFocusExtension(enabled: () => boolean) {
  return Extension.create({ name: 'hearthSentenceFocus', addProseMirrorPlugins() {
    return [new Plugin({ key: new PluginKey('hearthSentenceFocus'), props: {
      decorations(state) {
        if (!enabled()) return null;
        const { $from } = state.selection;
        if (!$from.parent.isTextblock) return null;
        const start = $from.start(), end = $from.end();
        const { from, to } = sentenceAt($from.parent.textContent, state.selection.from - start);
        const decorations = [];
        if (from > 0) decorations.push(Decoration.inline(start, start + from, { class: 'sentence-muted' }));
        if (start + to < end) decorations.push(Decoration.inline(start + to, end, { class: 'sentence-muted' }));
        return DecorationSet.create(state.doc, decorations);
      },
    } })];
  } });
}
