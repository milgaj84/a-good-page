import type { SaveState } from './session';
import type { KeyLike } from './keymap';

/** 0.3.0 organises the whole app around three stable places: choose a chapter, write it, share the book. */
export type Place = 'chapters' | 'write' | 'share';
export const PLACES: readonly { place: Place; label: string; hint: string; digit: string }[] = [
  { place: 'chapters', label: 'Chapters', hint: 'See, find, order and open chapters', digit: '1' },
  { place: 'write', label: 'Write', hint: 'Back to the page', digit: '2' },
  { place: 'share', label: 'Share', hint: 'Choose chapters, preview pages, export a PDF', digit: '3' },
];

export type NextAction = 'save' | 'chooseFolder' | 'openChapters' | 'newChapter' | 'fixChapters'
  | 'chooseChapters' | 'openChapter' | 'preview' | 'refreshPreview' | 'export' | 'write';
export interface NextStep { place: Place; title: string; detail: string; action: NextAction; button: string }
export type PreviewState = 'none' | 'ready' | 'stale';
export interface BookState {
  place: Place;
  save: SaveState;
  /** The open page has a file on disk. */
  named: boolean;
  folder: boolean;
  /** Chapters have been read at least once this session. */
  loaded: boolean;
  chapters: number;
  blocking: number;
  selected: number;
  preview: PreviewState;
}

const plural = (n: number, word: string): string => n + ' ' + word + (n === 1 ? '' : 's');

/** One recommendation at a time, most urgent first. Pure, so every branch is tested. */
export function nextStep(s: BookState): NextStep {
  if (s.save === 'error') return { place: 'write', action: 'save', button: 'Save again',
    title: 'Your last save failed', detail: 'Your words are still on the page. Save again, or choose another place.' };
  if (!s.folder) return { place: 'chapters', action: 'chooseFolder', button: 'Choose book folder',
    title: 'Choose your book folder', detail: 'Pick the folder that holds your chapters. Nothing is moved or renamed.' };
  if (!s.loaded) return { place: 'chapters', action: 'openChapters', button: 'Show chapters',
    title: 'See your chapters', detail: 'Open Chapters to find, order and open any part of the book.' };
  if (!s.chapters) return { place: 'write', action: 'newChapter', button: 'Start a chapter',
    title: 'Start your first chapter', detail: 'Write a page, then Save it into the book folder. It appears in Chapters.' };
  if (s.blocking) return { place: 'chapters', action: 'fixChapters', button: 'Review chapters',
    title: 'Fix ' + plural(s.blocking, 'chapter'), detail: 'Some chapters are missing or unreadable. Relink or remove them; nothing is changed automatically.' };
  if (!s.named && s.save === 'dirty') return { place: 'write', action: 'save', button: 'Save',
    title: 'Name this draft', detail: 'Save it into the book folder so it becomes a chapter and autosaves.' };
  if (s.place === 'share') {
    if (!s.selected) return { place: 'share', action: 'chooseChapters', button: 'Choose chapters',
      title: 'Tick the chapters to share', detail: 'Only ticked chapters go into the PDF, in book order.' };
    if (s.save === 'dirty' || s.save === 'saving') return { place: 'share', action: 'save', button: 'Save',
      title: 'Save the open chapter first', detail: 'Sharing uses the files on disk, so unsaved words would be left out.' };
    if (s.preview === 'stale') return { place: 'share', action: 'refreshPreview', button: 'Refresh pages',
      title: 'A chapter changed', detail: 'Refresh the pages before exporting; the old pages cannot be exported.' };
    if (s.preview === 'none') return { place: 'share', action: 'preview', button: 'Read it through',
      title: 'Read the book through', detail: plural(s.selected, 'chapter') + ' ticked. Check them, then see the PDF pages.' };
    return { place: 'share', action: 'export', button: 'See PDF pages',
      title: 'Ready to export', detail: 'Look through the real pages, then Export whole PDF. Export rechecks every chapter.' };
  }
  if (s.place === 'chapters') return { place: 'chapters', action: 'openChapter', button: 'Choose a chapter',
    title: 'Pick a chapter', detail: 'Choose a title below to open it and keep writing.' };
  return { place: 'write', action: 'write', button: 'Keep writing',
    title: 'Keep writing', detail: s.named ? 'Autosave is on. Share when the book is ready.' : 'This draft is kept on this device until you save it.' };
}

export type StepMark = 'done' | 'current' | 'todo' | 'blocked';
export interface ShareStep { id: 'choose' | 'read' | 'export'; label: string; mark: StepMark }

/** The Share place always shows the same three steps, so the writer knows where they are. */
export function shareSteps(s: Pick<BookState, 'blocking' | 'selected' | 'preview' | 'save'>): ShareStep[] {
  const chosen = s.selected > 0 && s.blocking === 0;
  const read = chosen && s.preview === 'ready';
  return [
    { id: 'choose', label: '1 · Choose chapters', mark: s.blocking ? 'blocked' : chosen ? 'done' : 'current' },
    { id: 'read', label: '2 · Read it through', mark: !chosen ? 'todo' : s.preview === 'stale' ? 'blocked' : read ? 'done' : 'current' },
    { id: 'export', label: '3 · Export PDF', mark: !read ? 'todo' : s.save === 'saved' ? 'current' : 'blocked' },
  ];
}

/** Plain words for the save dot, visible beside the title rather than hidden in a tooltip. */
export function saveWords(state: SaveState, named: boolean): string {
  if (state === 'error') return 'Save failed · press Save';
  if (state === 'saving') return 'Saving…';
  if (state === 'dirty') return named ? 'Saving soon' : 'Not saved yet';
  return named ? 'Saved' : 'Kept on this device';
}

/** Ctrl/Cmd+Shift+1, 2, 3 jump between places on any keyboard layout. */
export function placeShortcut(event: KeyLike): Place | null {
  if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return null;
  return PLACES.find(p => event.code === 'Digit' + p.digit)?.place ?? null;
}

/** Preserve an explicit selection on refresh, including an empty one; a different folder starts fresh. */
export function chapterSelection(paths: readonly string[], readable: readonly string[], previous: ReadonlySet<string>, sameFolder: boolean): Set<string> {
  const available = new Set(paths.filter(path => readable.includes(path)));
  return new Set(paths.filter(path => available.has(path) && (!sameFolder || previous.has(path))));
}
