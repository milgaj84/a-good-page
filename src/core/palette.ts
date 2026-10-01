import type { Action } from './commands';

export interface PaletteItem { action: Action; label: string; group: string; keywords?: string; shortcut?: string }
/** Every command points to the same action used by toolbar and keyboard. */
export const PALETTE_ITEMS: readonly PaletteItem[] = [
  { action: 'new', label: 'New document', group: 'File', shortcut: 'Mod+N' },
  { action: 'open', label: 'Open document', group: 'File', shortcut: 'Mod+O' },
  { action: 'save', label: 'Save', group: 'File', shortcut: 'Mod+S' },
  { action: 'saveAs', label: 'Save as', group: 'File', shortcut: 'Mod+Shift+S' },
  { action: 'exportPdf', label: 'Export PDF', group: 'File', keywords: 'print pages', shortcut: 'Mod+Shift+E' },
  { action: 'paragraph', label: 'Body text', group: 'Style', keywords: 'normal paragraph', shortcut: 'Mod+Alt+0' },
  { action: 'h1', label: 'Title', group: 'Style', keywords: 'heading 1', shortcut: 'Mod+Alt+1' },
  { action: 'h2', label: 'Heading', group: 'Style', keywords: 'heading 2', shortcut: 'Mod+Alt+2' },
  { action: 'h3', label: 'Subheading', group: 'Style', keywords: 'heading 3', shortcut: 'Mod+Alt+3' },
  { action: 'bold', label: 'Bold', group: 'Format', shortcut: 'Mod+B' },
  { action: 'italic', label: 'Italic', group: 'Format', shortcut: 'Mod+I' },
  { action: 'strike', label: 'Strikethrough', group: 'Format', shortcut: 'Mod+Shift+X' },
  { action: 'code', label: 'Inline code', group: 'Format', shortcut: 'Mod+E' },
  { action: 'link', label: 'Insert link', group: 'Format', keywords: 'url hyperlink', shortcut: 'Mod+K' },
  { action: 'bullet', label: 'Bullet list', group: 'Blocks', shortcut: 'Mod+Shift+8' },
  { action: 'ordered', label: 'Numbered list', group: 'Blocks', shortcut: 'Mod+Shift+7' },
  { action: 'task', label: 'Checklist', group: 'Blocks', keywords: 'tasks', shortcut: 'Mod+Shift+9' },
  { action: 'quote', label: 'Quote', group: 'Blocks', shortcut: 'Mod+Shift+B' },
  { action: 'hr', label: 'Scene break', group: 'Blocks', shortcut: 'Mod+Shift+H' },
  { action: 'undo', label: 'Undo', group: 'Edit', shortcut: 'Mod+Z' },
  { action: 'redo', label: 'Redo', group: 'Edit', shortcut: 'Mod+Shift+Z' },
  { action: 'find', label: 'Find in manuscript', group: 'Edit', keywords: 'search', shortcut: 'Mod+F' },
  { action: 'replace', label: 'Find and replace', group: 'Edit', keywords: 'search change all', shortcut: 'Mod+H' },
  { action: 'chapters', label: 'Chapters: your book folder', group: 'Go', keywords: 'book project manuscript folder order health relink', shortcut: 'Mod+Shift+1' },
  { action: 'writePage', label: 'Write: back to the page', group: 'Go', keywords: 'editor return close panel', shortcut: 'Mod+Shift+2' },
  { action: 'share', label: 'Share your book', group: 'Go', keywords: 'compile preview whole book pdf export', shortcut: 'Mod+Shift+3' },
  { action: 'switcher', label: 'Quick switcher', group: 'Go', keywords: 'jump chapter document file goto fuzzy', shortcut: 'Mod+P' },
  { action: 'reference', label: 'Reference notes', group: 'Writing', keywords: 'pin notes research side panel', shortcut: 'Mod+Shift+R' },
  { action: 'timeMachine', label: 'Time Machine', group: 'File', keywords: 'history versions snapshots restore earlier', shortcut: 'Mod+Shift+I' },
  { action: 'sprint', label: 'Sprint goal', group: 'Writing', keywords: 'ring progress words target', shortcut: 'Mod+Shift+A' },
  { action: 'polish', label: 'Polish typography', group: 'Edit', keywords: 'smart quotes curly em dash ellipsis', shortcut: 'Mod+Shift+Q' },
  { action: 'session', label: 'Start writing session', group: 'Writing', keywords: 'timer sprint target pomodoro' },
  { action: 'focus', label: 'Paragraph focus', group: 'Writing', shortcut: 'Mod+Shift+F' },
  { action: 'sentenceFocus', label: 'Sentence focus', group: 'Writing', shortcut: 'Mod+Shift+U' },
  { action: 'fullScreen', label: 'Full-screen writing', group: 'Writing', shortcut: 'Mod+Shift+G' },
  { action: 'outline', label: 'Show outline', group: 'Writing', shortcut: 'Mod+Shift+O' },
  { action: 'zen', label: 'Zen draft', group: 'Writing', keywords: 'hemingway first draft no backspace delete forward', shortcut: 'Mod+Shift+D' },
  { action: 'typewriter', label: 'Typewriter line', group: 'Writing', keywords: 'center middle anchor scroll', shortcut: 'Mod+Shift+T' },
  { action: 'ghost', label: 'Fade bars while typing', group: 'Writing', keywords: 'ghost hide chrome distraction immersion', shortcut: 'Mod+Shift+J' },
  { action: 'theme', label: 'Change theme', group: 'Display', shortcut: 'Mod+Shift+L' },
  { action: 'settings', label: 'Display settings', group: 'Display', keywords: 'font typeface column width spacing size goal' },
  { action: 'measure', label: 'Change column width', group: 'Display', keywords: 'line length measure narrow comfortable wide characters', shortcut: 'Mod+Shift+M' },
  { action: 'rhythm', label: 'Change spacing', group: 'Display', keywords: 'line height leading paragraph rhythm dense balanced spacious', shortcut: 'Mod+Shift+K' },
  { action: 'typeface', label: 'Change typeface', group: 'Display', keywords: 'font serif sans mono duospace editorial humanist', shortcut: 'Mod+Shift+Y' },
  { action: 'toolbar', label: 'Toggle formatting bar', group: 'Display', shortcut: 'Mod+\\' },
  { action: 'bigger', label: 'Increase text size', group: 'Display', shortcut: 'Mod+=' },
  { action: 'smaller', label: 'Decrease text size', group: 'Display', shortcut: 'Mod+-' },
  { action: 'resetSize', label: 'Reset text size', group: 'Display', shortcut: 'Mod+0' },
  { action: 'help', label: 'Help and shortcuts', group: 'Help', shortcut: 'Mod+/' },
];

/** Stable ranked search; all words must match label, group, action or aliases. */
export function searchPalette(query: string, items: readonly PaletteItem[] = PALETTE_ITEMS): PaletteItem[] {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [...items];
  return items.map((item, index) => {
    const label = item.label.toLocaleLowerCase();
    const hay = [label, item.group, item.action, item.keywords ?? ''].join(' ').toLocaleLowerCase();
    if (!tokens.every((token) => hay.includes(token))) return null;
    const score = tokens.reduce((n, token) => n + (label.startsWith(token) ? 3 : label.includes(token) ? 2 : 1), 0);
    return { item, index, score };
  }).filter((x): x is { item: PaletteItem; index: number; score: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index).map((x) => x.item);
}
