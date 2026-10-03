export const UNTITLED = 'Untitled';

/** Derives a friendly document name from a path on any OS ("C:\\a\\Ch 1.md" -> "Ch 1"). */
export function nameFromPath(path: string | null | undefined): string {
  if (!path) return UNTITLED;
  const segments = path.split(/[\\/]/).filter((s) => s.length > 0);
  const last = segments.length > 0 ? segments[segments.length - 1] : '';
  const dot = last.lastIndexOf('.');
  const stem = dot > 0 ? last.slice(0, dot) : last;
  return stem.trim().length > 0 ? stem : UNTITLED;
}

export const WRITING_EXTENSIONS = ['md', 'markdown', 'txt'] as const;

/** True for files A Good Page can open: .md, .markdown or .txt (any case). */
export function isWritingFile(path: string | null | undefined): boolean {
  const name = (path ?? '').split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  return (WRITING_EXTENSIONS as readonly string[]).includes(name.slice(dot + 1).toLowerCase());
}

/** .txt stays plain, even if its contents resemble Markdown. */
export function isPlainTextPath(path: string | null | undefined): boolean {
  return /\.txt$/i.test(path ?? '');
}

const EXTRA_FOLD: Record<string, string> = { 'đ': 'd', 'ł': 'l', 'ø': 'o', 'ħ': 'h' };

/**
 * Lower-cases and strips accents for MATCHING only ("Što" -> "sto", "Café" -> "cafe"). Each character is folded
 * on its own and always stays one character, so an index in the folded text is the same index in the original.
 */
export function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    let low = ch.toLowerCase();
    if (low.length !== ch.length) low = ch;
    const plain = EXTRA_FOLD[low] ?? low.normalize('NFD').replace(/\p{M}/gu, '');
    out += plain.length === ch.length ? plain : low;
  }
  return out;
}
