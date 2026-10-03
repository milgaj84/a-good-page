import { nameFromPath } from './paths';

/** Names the app gives a brand-new page; the first words you write replace them. */
export function isAutoName(name: string): boolean {
  return /^Untitled( \d+)?$/i.test(name.trim());
}

const MARKUP = /^(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+[.)]\s+|\[[ xX]\]\s+)/;

/** A short title from the first heading, else the first line of the page. Null while the page is empty. */
export function autoTitle(markdown: string, max = 50): string | null {
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) continue;
    let text = line;
    while (MARKUP.test(text)) text = text.replace(MARKUP, '');
    text = text.replace(/[*_`~]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (text.length <= max) return text.replace(/[.,;:!?\s]+$/u, '') || text;
    const cut = text.slice(0, max);
    const space = cut.lastIndexOf(' ');
    return (space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[.,;:!?\s]+$/u, '');
  }
  return null;
}

/** Only pages still carrying the app's placeholder name are renamed automatically. */
export function autoRenameTarget(currentName: string, markdown: string): string | null {
  if (!isAutoName(currentName)) return null;
  const title = autoTitle(markdown);
  return title && !isAutoName(title) ? title : null;
}

const squash = (text: string): string =>
  text.toLocaleLowerCase().replace(/^[\d\s._-]+/, '').replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * What a page is called on screen. A file named after its heading ("03-a-letter-unsent" for "A Letter Unsent")
 * shows the nicely written heading; any other file name is the writer's own and is shown as it is.
 */
export function displayName(stem: string, heading: string | null | undefined): string {
  const title = (heading ?? '').trim();
  return title && squash(title) !== '' && squash(stem) === squash(title) ? title : stem;
}

const sepOf = (path: string): string => (path.includes('\\') ? '\\' : '/');
export const joinPath = (base: string, relative: string): string =>
  (base.endsWith('/') || base.endsWith('\\') ? base : base + sepOf(base)) + relative.split('/').join(sepOf(base));
export const parentOf = (path: string): string => {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return i > 0 ? path.slice(0, i) : path;
};
const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '');

/** The Library path relative to its root, or null when the file lives elsewhere. */
export function relativeTo(root: string, path: string): string | null {
  const r = norm(root), p = norm(path);
  // Windows paths (drive letter or backslashes) are not case-sensitive.
  const windows = /^[a-z]:/i.test(r) || root.includes('\\');
  const same = windows ? p.toLowerCase().startsWith(r.toLowerCase() + '/') : p.startsWith(r + '/');
  return same ? p.slice(r.length + 1) : null;
}

/** The book (first-level folder) a file belongs to, or null for a page sitting directly in the Library. */
export function bookOf(root: string, path: string): string | null {
  const rel = relativeTo(root, path);
  if (!rel || !rel.includes('/')) return null;
  return joinPath(root, rel.split('/')[0]);
}

export interface TreeRow { kind: 'project' | 'loose'; name: string; path: string }

/** Projects (folders) first, then unfiled pages that sit directly in the Library; hidden items never appear. */
export function rootRows(entries: readonly { name: string; path: string; is_dir: boolean }[]): TreeRow[] {
  return entries
    .filter(e => !e.name.startsWith('.'))
    .map<TreeRow>(e => ({ kind: e.is_dir ? 'project' : 'loose', name: e.is_dir ? e.name : nameFromPath(e.path), path: e.path }));
}

export function filterRows<T extends { name: string }>(rows: readonly T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase();
  return q ? rows.filter(r => r.name.toLocaleLowerCase().includes(q)) : [...rows];
}

export const WELCOME_TITLE = 'Welcome to A Good Page';
export const WELCOME_TEXT = `# ${WELCOME_TITLE}

This is your Library. Everything you write is saved here automatically, so there is no Save button to hunt for.

## Start writing

Click anywhere and type. Your page names itself from your first line.

## Projects and pages

Your Library holds **projects**. A project is a folder with one or many pages: a novel, an essay, a set of notes.

- The **+** beside *Projects* starts a project with a first page. The **+** on a project adds a page to it.
- Drag pages to reorder them, into another project, or onto *Unfiled pages*. Or use a page's **⋯** menu.
- **Select** (the tick-box icon beside *Projects*) lets you pick several pages to move, export or trash together.
- Click **Library** at the top to switch to another folder.

## Find your way

- Press **Ctrl/Cmd+P** to jump to any page or run any command: type "focus", "export" or "theme".
- The sidebar search looks inside every page of every project.
- Select some text for quick formatting, or type **/** on an empty line for headings, lists and scene breaks.
- The **contents** button at the top right lists the headings on this page.

## Make it yours

The gear at the top right holds themes, type, goals and the Library folder. **Focus** at the bottom gives you paragraph focus, a typewriter line, Zen draft and full screen.

## Share

**Export** (the arrow) makes a PDF of this page, or of a project. Tick just the pages you want, and preview the real pages first. Your words stay in plain Markdown files you can open anywhere.

To see this guide again, press Ctrl/Cmd+P and type "welcome".
`;
