import { DialogFocus } from './dialog-focus';
import { findMatches, nextMatch, matchAtOrAfter, type Match } from '../core/find';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Debouncer, browserScheduler } from '../core/debounce';

const HIGHLIGHTS = new PluginKey<DecorationSet>('goodPageFindHighlights');
/** Softly marks every match and the current one more strongly; works while focus sits in the query box. */
const highlightPlugin = () => new Plugin<DecorationSet>({
  key: HIGHLIGHTS,
  state: {
    init: () => DecorationSet.empty,
    apply(tr, set) {
      const next = tr.getMeta(HIGHLIGHTS) as DecorationSet | undefined;
      return next ?? (tr.docChanged ? set.map(tr.mapping, tr.doc) : set);
    },
  },
  props: { decorations: (state) => HIGHLIGHTS.getState(state) },
});

export interface FindElements {
  root: HTMLElement; query: HTMLInputElement; replacement: HTMLInputElement; count: HTMLElement;
  previous: HTMLButtonElement; next: HTMLButtonElement; one: HTMLButtonElement; all: HTMLButtonElement; close: HTMLButtonElement;
  matchCase: HTMLInputElement; wholeWord: HTMLInputElement;
}
/** Searches the whole ProseMirror manuscript. Reverse-order replacement keeps offsets stable. */
export class FindPanel {
  private matches: Match[] = [];
  private index = -1;
  private replacing = false;
  private readonly typing = new Debouncer(() => this.refresh(), 120, browserScheduler);
  private readonly focus: DialogFocus;
  constructor(private readonly els: FindElements, private readonly editor: Editor) {
    this.focus = new DialogFocus(els.root);
    els.root.tabIndex = -1;
    els.root.setAttribute('aria-hidden', 'true');
    editor.registerPlugin(highlightPlugin());
    els.query.addEventListener('input', () => this.typing.trigger());
    els.matchCase.addEventListener('change', () => this.refresh());
    els.wholeWord.addEventListener('change', () => this.refresh());
    els.replacement.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); this.replaceOne(); this.els.replacement.focus(); }
    });
    els.query.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); this.typing.flush(); this.move(event.shiftKey ? -1 : 1); }
    });
    els.previous.addEventListener('click', () => this.move(-1));
    els.next.addEventListener('click', () => this.move(1));
    els.one.addEventListener('click', () => this.replaceOne());
    els.all.addEventListener('click', () => this.replaceAll());
    els.close.addEventListener('click', () => this.hide());
    els.root.addEventListener('mousedown', event => { if (event.target === els.root) this.hide(); });
    editor.on('update', () => { if (this.isOpen && !this.replacing) this.refresh(false); });
  }
  get isOpen(): boolean { return this.els.root.classList.contains('is-open'); }
  open(replace = false): void {
    if (!this.isOpen) {
      this.els.root.classList.add('is-open'); this.els.root.setAttribute('aria-hidden', 'false');
    }
    const { from, to, empty, $from, $to } = this.editor.state.selection;
    if (!empty && $from.parent === $to.parent && $from.parent.isTextblock) {
      const selected = this.editor.state.doc.textBetween(from, to, ' ');
      if (selected.trim() && selected.length <= 100) this.els.query.value = selected;
    }
    this.focus.open(replace ? this.els.replacement : this.els.query);
    this.refresh();
    if (replace) this.els.replacement.focus();
    if (!replace) this.els.query.select();
  }
  hide(): void {
    if (!this.isOpen) return;
    this.typing.cancel();
    this.paint(true);
    this.els.root.classList.remove('is-open'); this.els.root.setAttribute('aria-hidden', 'true');
    this.focus.close();
  }
  private find(): Match[] {
    return findMatches(this.editor.state.doc, this.els.query.value,
      { matchCase: this.els.matchCase.checked, wholeWord: this.els.wholeWord.checked });
  }
  /** Draws the highlights for the current matches; `clear` removes them. */
  private paint(clear = false): void {
    const doc = this.editor.state.doc;
    const marks = clear ? [] : this.matches.map((m, i) =>
      Decoration.inline(m.from, m.to, { class: i === this.index ? 'find-hit find-current' : 'find-hit' }));
    this.editor.view.dispatch(this.editor.state.tr.setMeta(HIGHLIGHTS, DecorationSet.create(doc, marks)).setMeta('addToHistory', false));
  }
  private refresh(jump = true): void {
    this.typing.cancel();
    this.matches = this.find();
    const cursor = this.editor.state.selection.from;
    this.index = matchAtOrAfter(this.matches, cursor);
    this.updateCount();
    if (jump && this.matches.length) this.reveal();
    this.paint();
  }
  private updateCount(): void {
    this.els.count.textContent = !this.els.query.value ? 'Type to find' : this.matches.length ? (this.index + 1) + ' of ' + this.matches.length + ' matches' : 'No matches';
    for (const button of [this.els.previous, this.els.next, this.els.one, this.els.all]) button.disabled = !this.matches.length;
  }
  private move(direction: 1 | -1): void {
    if (!this.matches.length) return;
    this.index = nextMatch(this.matches, this.matches[this.index]?.from ?? this.editor.state.selection.from, direction);
    this.els.count.textContent = (this.index + 1) + ' of ' + this.matches.length + ' matches';
    this.reveal();
    this.paint();
  }
  private reveal(): void {
    const match = this.matches[this.index]; if (!match) return;
    this.editor.commands.setTextSelection(match);
    this.editor.commands.scrollIntoView();
    this.els.query.focus();
  }
  private replaceOne(): void {
    const match = this.matches[this.index]; if (!match) return;
    const replacement = this.els.replacement.value;
    this.replacing = true;
    try { this.editor.view.dispatch(this.editor.state.tr.insertText(replacement, match.from, match.to)); }
    finally { this.replacing = false; }
    this.matches = this.find();
    this.index = matchAtOrAfter(this.matches, match.from + replacement.length);
    this.updateCount();
    if (this.index >= 0) this.reveal();
    this.paint();
  }
  private replaceAll(): void {
    if (!this.matches.length) return;
    const count = this.matches.length; const replacement = this.els.replacement.value;
    let tr = this.editor.state.tr;
    for (const match of [...this.matches].reverse()) tr = tr.insertText(replacement, match.from, match.to);
    this.replacing = true;
    try { this.editor.view.dispatch(tr); }
    finally { this.replacing = false; }
    this.refresh(false);
    this.els.count.textContent = count + (count === 1 ? ' match replaced' : ' matches replaced');
  }
}
