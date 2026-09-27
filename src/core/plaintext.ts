import type { ProseNode } from '../export/pdf';

function inline(node: ProseNode): string {
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(inline).join('');
}

function lines(node: ProseNode): string[] {
  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') {
    return [(node.content ?? []).map(inline).join('')];
  }
  if (node.type === 'horizontalRule') return ['* * *'];
  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    return (node.content ?? []).flatMap((item, i) => {
      const text = (item.content ?? []).flatMap(lines);
      const prefix = node.type === 'orderedList' ? (i + 1) + '. ' :
        node.type === 'taskList' ? (item.attrs?.checked ? '[x] ' : '[ ] ') : '- ';
      return [prefix + (text.shift() ?? ''), ...text];
    });
  }
  return (node.content ?? []).flatMap(lines);
}

/** Preserve exact text line breaks; formatting marks vanish for .txt output. */
export function toPlainText(document: ProseNode): string {
  return lines(document).join('\n');
}
