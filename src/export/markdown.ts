export interface MarkdownOptions {
  title: string;
  subtitle?: string;
  author?: string;
  titlePage?: boolean;
  contents?: boolean;
}

export interface ContentsEntry { level: number; text: string }

/** GitHub-style anchor for a heading, unique within the document. */
function anchors(entries: readonly ContentsEntry[]): string[] {
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const base = entry.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? base + '-' + n : base;
  });
}

/**
 * Wraps compiled Markdown with an optional title block and contents. The words themselves are left exactly as
 * written; the contents links to the headings by their anchors.
 */
export function markdownDocument(options: MarkdownOptions, body: string, contents: readonly ContentsEntry[] = []): string {
  const parts: string[] = [];
  const title = options.title.trim() || 'Untitled';
  if (options.titlePage) {
    parts.push('# ' + title);
    if (options.subtitle?.trim()) parts.push('*' + options.subtitle.trim() + '*');
    if (options.author?.trim()) parts.push('**' + options.author.trim() + '**');
    parts.push('---');
  }
  if (options.contents && contents.length) {
    const links = anchors(contents);
    parts.push('## Contents\n\n' + contents.map((entry, i) => (entry.level > 1 ? '    ' : '') + '- [' + entry.text.replace(/([[\]])/g, '\\$1') + '](#' + links[i] + ')').join('\n'));
    parts.push('---');
  }
  parts.push(body.trim());
  return parts.join('\n\n') + '\n';
}
