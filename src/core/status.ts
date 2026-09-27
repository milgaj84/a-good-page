import { formatCount } from './stats';
import type { SaveState } from './session';

export interface StatusInput {
  words: number;
  selected: number;
  characters: number;
  goal: number;
  section: string | null;
  filename: string;
  save: SaveState;
}

/** A contextual status line, intentionally free of markdown syntax. */
export function statusText(input: StatusInput): string {
  const parts: string[] = [];
  if (input.selected > 0) parts.push(formatCount(input.selected) + ' selected');
  parts.push(formatCount(input.characters) + ' characters');
  if (input.goal > 0) parts.push(Math.min(100, Math.floor(input.words / input.goal * 100)) + '% of goal');
  if (input.section?.trim()) parts.push(input.section.trim().slice(0, 44));
  parts.push(/\.txt$/i.test(input.filename) ? 'Plain text' : 'Markdown');
  parts.push(({ saved: 'Saved', dirty: 'Editing', saving: 'Saving…', error: 'Save failed' } as const)[input.save]);
  return parts.join(' · ');
}
