/** Layout numbers for one typewriter step, all in CSS pixels. */
export interface TypewriterMetrics {
  scrollTop: number;
  maxScroll: number;
  caretMid: number;
  anchorY: number;
}

/** Sub-pixel differences are ignored so the page never jitters by rounding. */
export const TYPEWRITER_TOLERANCE = 0.5;

/** The scrollTop that puts the caret's line on the anchor, clamped to what can scroll; null when nothing should move. */
export function typewriterScroll(m: TypewriterMetrics): number | null {
  if (![m.scrollTop, m.maxScroll, m.caretMid, m.anchorY].every(Number.isFinite)) return null;
  const max = Math.max(0, m.maxScroll);
  const next = Math.min(max, Math.max(0, m.scrollTop + m.caretMid - m.anchorY));
  return Math.abs(next - m.scrollTop) > TYPEWRITER_TOLERANCE ? next : null;
}

/** The optical centre of the screen, or the middle of the page area when the screen centre falls outside it. */
export function anchorLine(top: number, bottom: number, viewportHeight: number): number {
  const centre = viewportHeight / 2;
  if (Number.isFinite(centre) && centre >= top && centre <= bottom) return centre;
  return (top + bottom) / 2;
}
