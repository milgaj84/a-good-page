const CLOSERS = /[\u201D"\u2019'\)\]\u00BB]/u;
/** Where a sentence ends if a terminator sits at `i`: after any closing quotes or brackets, then whitespace or the end. Otherwise -1. */
function endAt(text: string, i: number): number {
  if (!/[.!?。！？]/u.test(text[i])) return -1;
  let j = i + 1;
  while (j < text.length && CLOSERS.test(text[j])) j++;
  return j === text.length || /\s/u.test(text[j]) ? j : -1;
}

/** Sentence offsets inside the current text block, excluding surrounding whitespace. */
export function sentenceAt(text: string, cursor: number): { from: number; to: number } {
  const pos = Math.max(0, Math.min(text.length, Math.floor(Number.isFinite(cursor) ? cursor : 0)));
  if (!text.length) return { from: 0, to: 0 };
  let from = 0;
  for (let i = 0; i < pos; i++) {
    const end = endAt(text, i);
    if (end > 0 && end <= pos) from = end;
  }
  while (from < text.length && /\s/u.test(text[from])) from++;
  let to = text.length;
  for (let i = from; i < text.length; i++) {
    const end = endAt(text, i);
    if (end > pos) { to = end; break; }
  }
  if (from >= to) { from = Math.max(0, Math.min(pos, text.length - 1)); to = text.length; }
  return { from, to };
}
