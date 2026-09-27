import { Fragment, Slice, type Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { polishSegments, type TextSegment } from '../core/smart-text';

/** Inline code and code blocks are never touched. Other inline nodes (breaks, images) act as spaces. */
function segmentsOf(nodes: readonly PMNode[]): TextSegment[] {
  return nodes.map((node) => {
    if (!node.isText) return { text: node.type.name === 'hardBreak' ? '\n' : ' ', code: true };
    const code = node.marks.some((mark) => mark.type.spec.code === true || mark.type.name === 'code');
    return { text: node.text ?? '', code };
  });
}

function polishInline(fragment: Fragment): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((node) => { nodes.push(node); });
  const polished = polishSegments(segmentsOf(nodes));
  let changed = false;
  const next = nodes.map((node, i) => {
    if (!node.isText || polished[i] === node.text) return node;
    changed = true;
    return polished[i].length > 0 ? node.type.schema.text(polished[i], node.marks) : null;
  }).filter((node): node is PMNode => node !== null);
  return changed ? Fragment.fromArray(next) : fragment;
}

function polishFragment(fragment: Fragment): Fragment {
  const first = fragment.firstChild;
  if (first && first.isInline) return polishInline(fragment);
  const nodes: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.type.spec.code) nodes.push(node);
    else if (node.isTextblock) nodes.push(node.copy(polishInline(node.content)));
    else if (node.content.size > 0) nodes.push(node.copy(polishFragment(node.content)));
    else nodes.push(node);
  });
  return Fragment.fromArray(nodes);
}

/** Pasted rich text gets the same polish as typed text. */
export function polishSlice(slice: Slice): Slice {
  return new Slice(polishFragment(slice.content), slice.openStart, slice.openEnd);
}

/** Replaces changed text runs in one transaction, so a single Undo reverts the whole polish. Returns the count. */
export function polishDocument(doc: PMNode, tr: Transaction): number {
  const edits: { from: number; to: number; node: PMNode | null }[] = [];
  doc.descendants((block, pos) => {
    if (block.type.spec.code) return false;
    if (!block.isTextblock) return true;
    const nodes: PMNode[] = [];
    const starts: number[] = [];
    block.forEach((child, offset) => { nodes.push(child); starts.push(pos + 1 + offset); });
    const polished = polishSegments(segmentsOf(nodes));
    nodes.forEach((node, i) => {
      if (!node.isText || polished[i] === node.text) return;
      edits.push({ from: starts[i], to: starts[i] + node.nodeSize,
        node: polished[i].length > 0 ? node.type.schema.text(polished[i], node.marks) : null });
    });
    return false;
  });
  for (const edit of edits.reverse()) {
    if (edit.node) tr.replaceWith(edit.from, edit.to, edit.node);
    else tr.delete(edit.from, edit.to);
  }
  return edits.length;
}
