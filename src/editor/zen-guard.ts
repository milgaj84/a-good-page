import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { ZenPort } from '../core/zen';

function stop(event: Event, blocked: boolean): boolean {
  if (blocked) event.preventDefault();
  return blocked;
}

/** Zen draft: stops deletions before ProseMirror or the browser removes any text. Runs ahead of every keymap. */
export function zenGuardExtension(guard: ZenPort) {
  return Extension.create({ name: 'goodPageZenGuard', priority: 1000, addProseMirrorPlugins() {
    return [new Plugin({ key: new PluginKey('goodPageZenGuard'), props: {
      handleKeyDown: (_view, event) => guard.blockKey(event),
      handleDOMEvents: {
        beforeinput: (_view, event) => stop(event, guard.blockInput(event.inputType)),
        cut: (_view, event) => stop(event, guard.blockCut()),
        dragstart: (_view, event) => stop(event, guard.blockDrag()),
      },
    } })];
  } });
}
