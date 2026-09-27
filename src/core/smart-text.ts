/**
 * Plain-text typography polish: -- to an em dash, ... to an ellipsis, straight quotes to curly ones.
 * Works on text runs so code can be skipped while its neighbours still decide quote direction.
 */
export interface TextSegment { text: string; code: boolean }

const CODE = '\uE000'; // stands in for code: counts as a visible character, never changed
const OPENERS = new Set(['(', '[', '{', '—', '–', '‘', '“', '-', '/']);

function isSpaceOrStart(ch: string | undefined): boolean {
  return ch === undefined || /\s/u.test(ch);
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
}

function runLength(chars: string[], index: number, mark: string): { start: number; length: number } {
  let start = index;
  while (start > 0 && chars[start - 1] === mark) start--;
  let end = index;
  while (end < chars.length && chars[end] === mark) end++;
  return { start, length: end - start };
}

function opens(prev: string | undefined): boolean {
  return isSpaceOrStart(prev) || OPENERS.has(prev as string);
}

/** Maps each input character to its output (possibly empty), so segment boundaries survive. */
function polishChars(chars: string[]): string[] {
  const out = [...chars];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const prev = i > 0 ? chars[i - 1] : undefined;
    if (ch === '-' || ch === '.') {
      const run = runLength(chars, i, ch);
      const wanted = ch === '-' ? 2 : 3;
      if (run.length === wanted && run.start === i) {
        out[i] = ch === '-' ? '—' : '…';
        for (let k = 1; k < wanted; k++) out[i + k] = '';
      }
      i = run.start + run.length - 1;
    } else if (ch === '"') {
      out[i] = opens(prev) ? '“' : '”';
    } else if (ch === "'") {
      const next = chars[i + 1];
      if (isWordChar(prev) && isWordChar(next)) out[i] = '’';
      else if (opens(prev)) {
        const decade = /\d/.test(next ?? '') && /\d/.test(chars[i + 2] ?? '') && !/\d/.test(chars[i + 3] ?? '');
        out[i] = decade ? '’' : '‘';
      } else out[i] = '’';
    }
  }
  return out;
}

export function polishSegments(segments: readonly TextSegment[]): string[] {
  const chars: string[] = [];
  const owners: number[] = [];
  segments.forEach((segment, index) => {
    if (segment.code) {
      if (segment.text.length > 0) { chars.push(CODE); owners.push(index); }
      return;
    }
    for (const ch of segment.text) { chars.push(ch); owners.push(index); }
  });
  const polished = polishChars(chars);
  const result = segments.map((segment) => (segment.code ? segment.text : ''));
  polished.forEach((text, i) => {
    if (!segments[owners[i]].code) result[owners[i]] += text;
  });
  return result;
}

export function polishText(text: string): string {
  return polishSegments([{ text, code: false }])[0];
}

const CODE_SPANS = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(\n\2[^\n]*(?=\n|$)|$)|`[^`\n]+`/g;

/** For pasted Markdown source: fenced blocks and `inline code` are kept exactly as written. */
export function polishMarkdownSource(text: string): string {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(CODE_SPANS)) {
    const start = match.index + (match[1] ?? '').length;
    if (start > last) segments.push({ text: text.slice(last, start), code: false });
    segments.push({ text: text.slice(start, match.index + match[0].length), code: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), code: false });
  return polishSegments(segments).join('');
}
