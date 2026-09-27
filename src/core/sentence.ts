/** Sentence offsets inside the current text block, excluding surrounding whitespace. */
export function sentenceAt(text: string, cursor: number): { from: number; to: number } {
  const pos = Math.max(0, Math.min(text.length, Math.floor(Number.isFinite(cursor) ? cursor : 0)));
  if (!text.length) return { from: 0, to: 0 };
  let from = 0;
  for (let i = 0; i < pos; i++) {
    if (/[.!?。！？]/u.test(text[i]) && (i + 1 === text.length || /\s/u.test(text[i + 1]))) from = i + 1;
  }
  while (from < text.length && /\s/u.test(text[from])) from++;
  let to = text.length;
  for (let i = Math.max(from, pos); i < text.length; i++) {
    if (/[.!?。！？]/u.test(text[i]) && (i + 1 === text.length || /\s/u.test(text[i + 1]))) { to = i + 1; break; }
  }
  if (from >= to) { from = Math.max(0, Math.min(pos, text.length - 1)); to = text.length; }
  return { from, to };
}
