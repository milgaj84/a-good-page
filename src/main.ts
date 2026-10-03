import './stylesheets';
import { DocumentSession, type EditorPort, type SessionSnapshot } from './core/session';
import { Debouncer, browserScheduler } from './core/debounce';
import { ThemeManager, type Theme } from './core/theme';
import { countWords, formatCount, formatSelection, formatStats } from './core/stats';
import { renderPdf } from './export/pdf';
import { compiledMarkdown, parseChapter, renderProjectPdf } from './export/project-pdf';
import { ExportPreview } from './ui/export-preview';
import { DEFAULT_PREFS, PreferencesStore, type Preferences } from './core/prefs';
import { applyTypography, typographyActions } from './core/typography';
import { GoalTracker, goalProgress, type GoalProgress } from './core/goal';
import { resolveShortcut } from './core/keymap';
import { bindButtons, bindShortcuts } from './app/shortcuts';
import { createLongProjects } from './app/long-projects';
import { LibraryController } from './app/library';
import { FileConflictDialog } from './ui/file-conflict';
import { OutsideNotice } from './ui/outside-notice';
import { NamedRecoveryStore } from './core/named-recovery';
import { NamedRecoveryWriter } from './core/named-recovery-writer';
import { RecoveryDialog } from './ui/recovery-dialog';
import { offerNamedRecovery } from './app/named-recovery';
import { protectReload } from './core/file-conflict';
import { snapshotBackend } from './adapters/snapshot-store';
import { createReader } from './editor/reader';
import { isEditorCommand, type Action, type AppAction } from './core/commands';
import { isPlainTextPath, isWritingFile, nameFromPath } from './core/paths';
import { DebouncedDraftStore, LocalDraftStore, SafeStore, browserStorage } from './adapters/storage';
import { ChangeLatch, FrameTask, browserFrames } from './core/frame';
import { bindAutoscroll } from './ui/autoscroll';
import {
  adoptLibrary, currentLibrary, pickBackupFolder, pickLibraryFolder, useLibrary, createEntry, defaultLibrary, exportPdfFile, listWorkingDirectory,
  onCloseRequested, onFileDrop, openWorkingFile, readProjectOrder, renameEntry, setWindowTitle, setWritingFullscreen,
  chooseBackupFile, importPagesFolder, pickWordFile, readWordFile, createBackup, defaultBackupDir, restoreBackup, exportDocumentFile, tauriFiles, tauriPrompter, trashEntry, writeProjectOrder, exportRecoveryCopy, listTrash, restoreEntry, moveEntry,
} from './adapters/tauri';
import { createWriterEditor } from './editor/editor';
import { Chrome } from './ui/chrome';
import { HelpSheet } from './ui/help';
import { LinkBar } from './ui/linkbar';
import { OutlinePanel } from './ui/outline';
import { SettingsPanel } from './ui/settings';
import { CommandButtons, type CommandState } from './ui/toolbar';
import { CommandPalette } from './ui/command-palette';
import { SessionPanel } from './ui/session-panel';
import { WritingSession } from './core/writing-session';
import { FindPanel } from './ui/find-panel';
import { QuitDialog } from './ui/quit';
import { SlashMenu } from './ui/slash-menu';
import { bindFocusControls } from './ui/focus-controls';
import { restoreLastDocument } from './core/startup';
import { bindGhostInterface } from './ui/ghost-interface';
import { Sidebar } from './ui/sidebar';
import { Menu } from './ui/menu';
import { TrashDialog } from './ui/trash';
import { ExportPicker } from './ui/export-picker';
import { ProjectFind } from './ui/project-find';
import { BackupController } from './app/backup';
import type { ReplaceEdit } from './core/project-replace';
import type { ReplaceReport } from './ui/project-find';
import { ExportOptionsStore, FORMAT_INFO, effectiveTitle, sanitizeExportOptions, type ExportOptions } from './core/export-options';
import { docxBytes } from './export/docx';
import { epubBytes } from './export/epub';
import { markdownDocument } from './export/markdown';
import { bookOf, displayName, relativeTo } from './core/library';
import { ViewMemory } from './core/view-memory';
import { describeEffects, detectSoftware, resolveEffects, type EffectMode } from './core/graphics';
import type { ProjectService, ProjectSnapshot } from './core/project-service';
import type { PaletteEntry } from './core/palette';

const LAST_PATH_KEY = 'hearth.lastPath';
const SIDEBAR_KEY = 'agp.sidebar.v1';
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
const SMALL = (): boolean => window.innerWidth <= 760;
function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing element #' + id);
  return node as T;
}

const store = new SafeStore(browserStorage());
const lastPath = store.get(LAST_PATH_KEY);
const root = document.documentElement;
const app = el('app');
const scroller = el('scroller');
const autoscroll = bindAutoscroll(scroller, browserFrames);
const chrome = new Chrome(
  { app, title: el<HTMLInputElement>('doc-title'), saveState: el('save-state'), saveText: el('save-text'), stats: el('stats'),
    goal: el('goal'), goalFill: el('goal-fill'), focusButton: el('btn-focus'), toast: el('toast') },
  browserScheduler,
);
const ghostUI = bindGhostInterface({
  win: window, app, editorEl: el('editor'), scroller, chrome, caretLine: () => editor.caretLine(),
  zenBadge: el<HTMLButtonElement>('zen-badge'), zenCheck: el<HTMLInputElement>('zen-check'),
  isMac: IS_MAC, now: () => Date.now(), notify: (message) => chrome.toast(message, 3200),
});
const themes = new ThemeManager(store, window.matchMedia('(prefers-color-scheme: dark)').matches);
const prefsStore = new PreferencesStore(store);
const goals = new GoalTracker();
let prefs: Preferences = prefsStore.prefs;
let focusMode = false;
let session: DocumentSession | null = null;
let projects: ReturnType<typeof createLongProjects> | null = null;
let library: LibraryController | null = null;

const commandState: CommandState = {
  isActive: (name) => editor.isActive(name),
  can: (name) => editor.can(name),
  textStyle: () => editor.textStyle(),
};
const bubble = new CommandButtons(el('bubble'), commandState, dispatch);
const toolbar = new CommandButtons(el('toolbar'), commandState, dispatch);
const outline = new OutlinePanel(
  { root: el('outline'), list: el('outline-list'), empty: el('outline-empty') },
  (pos) => { closeContents(); editor.jumpTo(pos); centerCaret(0.3); },
);
const settings = new SettingsPanel(
  { root: el('settings'), close: el('settings-close'), themeChoice: el('theme-choice'), fontChoice: el('font-choice'),
    widthChoice: el('width-choice'), rhythmChoice: el('rhythm-choice'), sizeRange: el<HTMLInputElement>('size-range'),
    sizeValue: el('size-value'), goalInput: el<HTMLInputElement>('goal-input'), ghostCheck: el<HTMLInputElement>('ghost-check'),
    typewriterCheck: el<HTMLInputElement>('typewriter-check'), toolbarCheck: el<HTMLInputElement>('toolbar-check'), libraryPath: el('library-path'), libraryChange: el('library-change') },
  el('btn-settings'),
  (patch) => applyPrefs(prefsStore.update(patch)),
  (theme) => setTheme(theme),
  () => void library?.changeFolder().then(() => applyPrefs(prefs)),
);
const linkBar = new LinkBar(
  { root: el('linkbar'), input: el<HTMLInputElement>('link-input'), apply: el('link-apply'), remove: el('link-remove') },
  { currentHref: () => editor.linkHref(), apply: (href) => editor.setLink(href), remove: () => editor.unsetLink(),
    caretRect: () => editor.caretRect(), restoreFocus: () => editor.restoreFocus() },
);
const slash = new SlashMenu(el('slash-menu'), (command) => editor.run(command));
const help = new HelpSheet(el('help'), el('help-list'), el('help-close'), IS_MAC, () => editor.restoreFocus());
const menu = new Menu();
const autosave = new Debouncer(() => void session?.autosave(), 1200, browserScheduler);
const stats = new Debouncer(refreshStats, 150, browserScheduler);
const outlineTimer = new Debouncer(refreshOutline, 250, browserScheduler);
const nameTimer = new Debouncer(() => void library?.maybeAutoRename(), 2500, browserScheduler);
const editor = createWriterEditor({
  element: el('editor'),
  bubble: el('bubble'),
  onEdit: () => {
    slash.close();
    session?.markEdited();
    autosave.trigger();
    stats.trigger();
    outlineTimer.trigger();
    nameTimer.trigger();
  },
  onSlash: (anchor) => slash.open(anchor),
  onSlashKey: (event) => slash.handle(event),
  zen: ghostUI.zen,
  onSelection: () => { selectionFrame.schedule(); stats.trigger(); viewTimer.trigger(); },
});
// Nothing can be typed until a page is open, so words are never written into a page that has no file.
editor.instance.setEditable(false);
const controlsFrame = new FrameTask(() => { bubble.sync(); if (prefs.toolbar) toolbar.sync(); }, browserFrames);
const selectionFrame = new FrameTask(() => {
  keepCaretCentered();
  outline.highlight(editor.caretPos());
}, browserFrames);
editor.instance.on('transaction', () => controlsFrame.schedule());

const focusUI = bindFocusControls({
  app, panel: el('focus-choices'), trigger: el('btn-focus'), exit: el('fullscreen-exit'),
  focusButton: el('btn-focus'), setFullscreen: setWritingFullscreen,
  setParagraphFocus: on => { focusMode = on; chrome.setFocus(on); },
  setSentenceFocus: on => { editor.sentenceFocus(on); },
  centered: keepCaretCentered, notify: message => chrome.toast(message, 4000),
});
el('focus-choices').addEventListener('click', (event) => {
  const toggle = (event.target as HTMLElement).closest<HTMLElement>('[data-toggle]')?.dataset.toggle;
  if (toggle === 'typewriter') APP.typewriter();
  else if (toggle === 'zen') APP.zen();
  if (toggle) focusUI.closeMenu();
});
const finder = new FindPanel({ root: el('find-dialog'), query: el<HTMLInputElement>('find-query'),
  replacement: el<HTMLInputElement>('replace-query'), count: el('find-count'), matchCase: el<HTMLInputElement>('find-case'), wholeWord: el<HTMLInputElement>('find-words'),
  previous: el<HTMLButtonElement>('find-prev'), next: el<HTMLButtonElement>('find-next'),
  one: el<HTMLButtonElement>('replace-one'), all: el<HTMLButtonElement>('replace-all'),
  close: el<HTMLButtonElement>('find-close') }, editor.instance);
const quit = new QuitDialog(el('quit-dialog'), el('quit-error'), el('quit-save'), el('quit-discard'), el('quit-cancel'));
const palette = new CommandPalette(
  { root: el('command-palette'), input: el<HTMLInputElement>('command-input'),
    list: el('command-results'), empty: el('command-empty') },
  dispatch, (action) => !['undo', 'redo'].includes(action) || editor.can(action),
  (query) => places(query),
);
let sessionEnabledFocus = false;
const sessionPanel = new SessionPanel(
  { root: el('session-dialog'), minutes: el<HTMLInputElement>('session-minutes'),
    target: el<HTMLInputElement>('session-target'), setup: el('session-setup'),
    running: el('session-running'), summary: el('session-summary'),
    clock: el('session-clock'), progress: el('session-progress'), message: el('session-message'),
    error: el('session-error'), start: el<HTMLButtonElement>('session-start'),
    stop: el<HTMLButtonElement>('session-stop'), done: el<HTMLButtonElement>('session-done'),
    badge: el('session-badge'), badgeText: el('session-badge-text') },
  new WritingSession({ now: () => Date.now() }),
  () => countWords(editor.getText()),
  () => { sessionEnabledFocus = !focusMode; if (sessionEnabledFocus) toggleFocus(); editor.restoreFocus(); },
  (summary) => { if (sessionEnabledFocus && focusMode) toggleFocus(); sessionEnabledFocus = false; chrome.toast('Session ended · ' + summary, 4200); },
);

function centerCaret(fraction: number): void {
  const top = editor.caretTop();
  if (top === null) return;
  const box = scroller.getBoundingClientRect();
  const delta = top - (box.top + box.height * fraction);
  if (Math.abs(delta) > 4) scroller.scrollTop += delta;
}
function keepCaretCentered(): void {
  if (autoscroll.active || ghostUI.anchor()) return;
  if (focusMode) centerCaret(0.45);
}
function currentProgress(): GoalProgress | null { return goalProgress(countWords(editor.getText()), prefs.goal); }
function refreshStats(): void {
  const text = editor.getText();
  const total = countWords(text);
  const progress = goalProgress(total, prefs.goal);
  const selected = countWords(editor.selectionText());
  if (selected > 0) chrome.setStats(formatSelection(selected, total));
  else chrome.setStats(formatStats(total) + (progress ? ' · ' + Math.floor(progress.ratio * 100) + '% of goal' : ''));
  chrome.setGoal(progress);
  sidebar.setCurrentMeta(total.toLocaleString());
  sessionPanel.update();
  projects?.statsChanged();
  if (progress && goals.check(progress)) chrome.celebrate('Goal reached: ' + formatCount(prefs.goal) + ' words. Lovely work.');
}
function refreshOutline(): void {
  outline.update(editor.headings(), editor.caretPos());
  // The Contents button appears only once the page has headings.
  el('btn-contents').hidden = outline.count === 0;
  if (outline.count === 0) closeContents();
  chrome.setName(shownName());
}

function setTheme(theme: Theme): void {
  themes.set(theme);
  root.dataset.theme = theme;
  settings.render(prefs, themes.theme, library?.root ?? null);
}
const software = detectSoftware();
function applyEffects(mode: EffectMode): void {
  root.dataset.effects = resolveEffects(mode, software);
  el<HTMLSelectElement>('effects-choice').value = mode;
  el('effects-note').textContent = describeEffects(mode, software);
}
el<HTMLSelectElement>('effects-choice').addEventListener('change', (event) => applyPrefs(prefsStore.update({ effects: (event.target as HTMLSelectElement).value as EffectMode })));
function applyPrefs(next: Preferences): void {
  const goalChanged = next.goal !== prefs.goal;
  prefs = next;
  applyEffects(next.effects);
  applyTypography(root, next);
  app.classList.toggle('no-toolbar', !next.toolbar);
  if (next.toolbar) controlsFrame.schedule();
  ghostUI.setGhost(next.ghost);
  ghostUI.setTypewriter(next.typewriter);
  settings.render(next, themes.theme, library?.root ?? null);
  el('focus-choices').querySelector('[data-toggle="typewriter"]')?.setAttribute('aria-pressed', String(next.typewriter));
  if (goalChanged) goals.reset(currentProgress());
  refreshStats();
}

// ---------- contents (headings on this page) ----------
const contentsPop = el('outline-pop');
const contentsButton = el('btn-contents');
function closeContents(): boolean {
  if (!contentsPop.classList.contains('is-open')) return false;
  contentsPop.classList.remove('is-open');
  contentsPop.setAttribute('aria-hidden', 'true');
  contentsButton.setAttribute('aria-expanded', 'false');
  return true;
}
function toggleContents(): void {
  if (closeContents()) return;
  if (outline.count === 0) { chrome.toast('Headings you write will gather here.'); return; }
  contentsPop.classList.add('is-open');
  contentsPop.setAttribute('aria-hidden', 'false');
  contentsButton.setAttribute('aria-expanded', 'true');
  outline.highlight(editor.caretPos());
}
contentsButton.addEventListener('click', toggleContents);
document.addEventListener('mousedown', (event) => {
  const target = event.target as Node;
  if (!contentsPop.contains(target) && !contentsButton.contains(target)) closeContents();
});

let searchTimer = 0;
// ---------- the sidebar ----------
const sidebar = new Sidebar({ tree: el('tree'), search: el<HTMLInputElement>('side-search') }, {
  open: (row) => { void library?.open(row.path).then(() => { if (SMALL()) setSidebar(false); }); },
  toggle: (row) => void library?.toggleBook(row.path),
  menu: (row, anchor) => library?.rowMenu(row, anchor),
  add: (row) => void library?.newPage(row.path),
  newProject: () => APP.newProject(),
  reorder: (book, path, to) => void library?.reorder(book, path, to),
  query: (text) => { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(() => void library?.search(text), 160); },
  moveInto: (from, project, index) => void library?.moveInto(from, project, index),
  select: (row) => void library?.toggleSelected(row),
  selectMode: () => library?.toggleSelectMode(),
  rename: (row, name) => void library?.commitRename(row, name),
  hit: (hit) => { void library?.open(hit.path, sidebar.query.trim()); if (SMALL()) setSidebar(false); },
});
function setSidebar(show: boolean): void {
  app.classList.toggle('sidebar-hidden', !show);
  el('btn-sidebar').setAttribute('aria-expanded', String(show));
  root.style.setProperty('--sidebar-w', show && !SMALL() ? '272px' : '0px');
  store.set(SIDEBAR_KEY, show ? 'open' : 'closed');
}
function sidebarShown(): boolean { return !app.classList.contains('sidebar-hidden'); }
setSidebar(SMALL() ? false : store.get(SIDEBAR_KEY) !== 'closed');

/** Headings on this page and pages in the Library, for the one "go anywhere" box. */
function places(query: string): PaletteEntry[] {
  const found = library?.places(query) ?? [];
  const headings = editor.headings().filter(h => h.text.trim())
    .map<PaletteEntry>(h => ({ label: h.text.trim(), group: 'On this page', keywords: 'heading jump', run: () => { editor.jumpTo(h.pos); centerCaret(0.3); } }));
  return query.trim() ? [...found, ...headings] : [...found, ...headings.slice(0, 4)];
}

// ---------- the document ----------
const views = new ViewMemory(store);
const viewTimer = new Debouncer(() => saveView(), 600, browserScheduler);
let pendingRestore = false;
let restoredView: { caret: number; scroll: number } | null = null;
function saveView(): void {
  const path = doc.snapshot().path;
  if (path && editor.instance.isEditable) views.set(path, { caret: editor.caretPos(), scroll: scroller.scrollTop }, Date.now());
}
scroller.addEventListener('scroll', () => viewTimer.trigger(), { passive: true });
/** The page's own first heading, so a chapter file called "03-a-letter-unsent" reads "A Letter Unsent". */
function shownName(): string {
  const heading = editor.headings().find(h => h.level === 1)?.text;
  return displayName(doc.snapshot().name, heading);
}
function updateNext(): void {
  const button = el<HTMLButtonElement>('next-chapter');
  const next = lib.nextChapter();
  button.hidden = !next;
  if (!next) return;
  button.replaceChildren();
  const small = document.createElement('small');
  small.textContent = 'Next chapter';
  const name = document.createElement('span');
  name.textContent = next.label + ' →';
  button.append(small, name);
  button.onclick = () => { void lib.open(next.path).then(() => { scroller.scrollTop = 0; }); };
}
const sessionEditor: EditorPort = {
  getMarkdown: () => editor.getMarkdown(),
  getPlainText: () => editor.getPlainText(),
  setPlainText: (text) => { viewTimer.flush(); namedWriter.flush(); sessionPanel.documentChanged(); editor.setPlainText(text); onDocumentLoaded(); },
  setMarkdown: (markdown) => { viewTimer.flush(); sessionPanel.documentChanged(); namedWriter.flush(); editor.setMarkdown(markdown); onDocumentLoaded(); },
  // A page you have been in opens where you left off; a page you have not been in opens ready to type at its end.
  focus: () => {
    const view = restoredView;
    restoredView = null;
    if (!view) { editor.focus(); return; }
    const place = (): void => { editor.restoreCaret(view.caret); scroller.scrollTop = view.scroll; };
    editor.restoreFocus();
    place();
    // The editor can become editable in this same moment; once more on the next frame so the browser cannot move the caret.
    requestAnimationFrame(place);
  },
};
/** Runs whenever the session swaps the page content (open, new, restore). */
function onDocumentLoaded(): void {
  if (preview.isOpen) preview.close();
  editor.instance.setEditable(true);
  goals.reset(currentProgress());
  refreshStats();
  refreshOutline();
  controlsFrame.schedule();
  projects?.documentLoaded();
  scroller.scrollTop = 0;
  pendingRestore = true;
  void library?.documentLoaded();
}
const shown = new ChangeLatch();
function render(snapshot: SessionSnapshot): void {
  stats.trigger();
  if (pendingRestore && snapshot.path) {
    pendingRestore = false;
    const view = views.get(snapshot.path);
    restoredView = view ? { caret: view.caret, scroll: view.scroll } : null;
    if (view) editor.restoreCaret(view.caret);
  }
  namedWriter?.change(snapshot);
  if (!shown.changed(JSON.stringify([snapshot.name, snapshot.path, snapshot.state]))) return;
  chrome.setName(shownName());
  chrome.setSaveState(snapshot.state, IS_MAC);
  updateNext();
  if (snapshot.state === 'saved' && snapshot.path) projects?.saved();
  const marker = snapshot.state === 'dirty' || snapshot.state === 'error' ? '• ' : '';
  void setWindowTitle(marker + snapshot.name + ' — A Good Page');
  if (snapshot.path) store.set(LAST_PATH_KEY, snapshot.path);
  else store.remove(LAST_PATH_KEY);
  sidebar.setCurrentMeta(countWords(editor.getText()).toLocaleString());
}
const drafts = new DebouncedDraftStore(new LocalDraftStore(store), browserScheduler, 500);
const namedStore = new NamedRecoveryStore(browserStorage(), () => Date.now());
const namedWriter = new NamedRecoveryWriter(namedStore, browserScheduler, () => {
  const path = session?.snapshot().path;
  return { baseline: session?.recoveryBaseline() ?? null, content: path && isPlainTextPath(path) ? editor.getPlainText() : editor.getMarkdown() };
}, message => chrome.toast(message, 5200));
const recoveryDialog = new RecoveryDialog(document.body);
const fileConflict = new FileConflictDialog(document.body);
const outsideNotice = new OutsideNotice(document.body, () => void session?.reviewOutside(), () => outsideNotice.remind());
session = new DocumentSession({
  editor: sessionEditor,
  files: tauriFiles,
  prompter: tauriPrompter,
  drafts,
  events: { onChange: render, onError: (message) => chrome.toast(message, 4200), onOutside: state => outsideNotice.show(state), onResolved: message => chrome.toast(message, 4200), onDiscard: path => namedWriter.discard(path), onConflict: async info => protectReload(await fileConflict.ask(info), async () => {
      if (!projects) throw new Error('Recovery is not ready; the draft was not reloaded.');
      await projects.preserveBeforeReload();
    }) },
});
const doc = session;

library = new LibraryController({
  store, doc, sidebar, menu,
  io: {
    defaultLibrary, list: listWorkingDirectory, open: openWorkingFile, order: readProjectOrder, saveOrder: writeProjectOrder,
    create: createEntry, rename: renameEntry, trash: trashEntry,
    write: (path, content) => tauriFiles.write(path, content),
    writeGuarded: (path, content, expected) => tauriFiles.write(path, content, expected),
    pickFolder: pickLibraryFolder,
    current: currentLibrary, adopt: adoptLibrary, use: useLibrary,
    listTrash, restore: restoreEntry, move: moveEntry,
    pickWord: pickWordFile, readWord: readWordFile, importFolder: importPagesFolder,
  },
  offerUndo: (message, label, run) => chrome.toastAction(message, label, run),
  notify: (message) => chrome.toast(message, 4200),
  markdown: () => editor.getMarkdown(),
  jumpToPhrase: (phrase) => {
    const needle = phrase.toLocaleLowerCase();
    let pos: number | null = null;
    editor.instance.state.doc.descendants((node, at) => {
      if (pos === null && node.isText) { const offset = (node.text ?? '').toLocaleLowerCase().indexOf(needle); if (offset >= 0) pos = at + offset; }
    });
    if (pos !== null) editor.jumpTo(pos);
  },
  focusEditor: () => editor.focus(),
  flushAutosave: () => autosave.flush(),
  words: () => countWords(editor.getText()),
  changed: () => {
    settings.render(prefs, themes.theme, library?.root ?? null);
    const folder = library?.root ? nameFromPath(library.root) : '';
    el('library-name').textContent = folder === 'Untitled' ? '' : folder;
    el('library-menu').title = library?.root ? library.root + ' — click to change your Library folder' : 'Choose your Library folder';
  },
  moved: (from, to) => { projects?.historyMoved(from, to); views.move(from, to); },
  rendered: () => updateNext(),
  exportProject: (path) => void exportPdf(path),
  exportSelection: (project, pages) => void exportPdf(project, pages),
  selectionChanged: (count, selecting) => updateSelectBar(count, selecting),
  exportPage: (path) => void lib.open(path).then(ok => { if (ok) return exportPdf(); }),
});
const lib = library;

const trashDialog = new TrashDialog(
  { root: el('trash-dialog'), list: el('trash-list'), close: el('trash-close') },
  () => lib.trashItems(), (item) => lib.restore(item), () => Date.now(),
);

// ---------- find and replace in many pages ----------
const projectFind = new ProjectFind({
  root: el('project-find'), query: el<HTMLInputElement>('pf-query'), replacement: el<HTMLInputElement>('pf-replace'),
  matchCase: el<HTMLInputElement>('pf-case'), wholeWord: el<HTMLInputElement>('pf-words'), scope: el<HTMLSelectElement>('pf-scope'),
  results: el('pf-results'), summary: el('pf-summary'), replace: el<HTMLButtonElement>('pf-do'), all: el('pf-all'), none: el('pf-none'), close: el('pf-close'),
}, {
  inProject: () => Boolean(lib.currentBook()),
  // The open page is searched as it is on screen, including words not saved yet.
  load: async (scope) => {
    const open = doc.snapshot().path;
    return (await lib.filesForSearch(scope)).map(f => (f.path === open ? { ...f, text: isPlainTextPath(open) ? editor.getPlainText() : editor.getMarkdown() } : f));
  },
  apply: (edits) => applyReplacements(edits, false),
});

/** Applies replacements page by page. The open page changes inside the editor (one undoable edit, kept by autosave);
 *  every other page is written only if it is still exactly as it was searched, after a version is kept in History. */
async function applyReplacements(edits: ReplaceEdit[], undoing: boolean): Promise<ReplaceReport> {
  const open = doc.snapshot().path;
  const skipped: string[] = [];
  const done: ReplaceEdit[] = [];
  for (const edit of edits) {
    const from = undoing ? edit.newText : edit.oldText;
    const to = undoing ? edit.oldText : edit.newText;
    if (edit.path === open) {
      const plain = isPlainTextPath(open);
      if ((plain ? editor.getPlainText() : editor.getMarkdown()) !== from) { skipped.push(edit.label); continue; }
      if (!undoing) void projects?.keepVersion(edit.path, from);
      editor.replaceQuietly(to, plain);
      done.push(edit);
      continue;
    }
    if (!undoing) await projects?.keepVersion(edit.path, from);
    if (await lib.writeReplaced(edit.path, to, from)) done.push(edit); else skipped.push(edit.label);
  }
  await lib.afterBulkEdit();
  const pages = done.length + (done.length === 1 ? ' page' : ' pages');
  if (undoing) chrome.toast(done.length ? 'Put back ' + pages + '.' : 'Nothing could be put back.');
  else if (done.length) chrome.toastAction('Replaced in ' + pages + '. A version of each is in History.', 'Undo', () => void applyReplacements(done, true));
  return { changed: done.length, skipped };
}
el('find-many').addEventListener('click', () => {
  const typed = el<HTMLInputElement>('find-query').value;
  finder.hide();
  void projectFind.open(typed);
});

// ---------- backup ----------
const backup = new BackupController({
  store, root: () => lib.root,
  io: { create: createBackup, restore: restoreBackup, defaultDir: defaultBackupDir, pickFolder: pickBackupFolder, pickZip: chooseBackupFile },
  notify: (message) => chrome.toast(message, 5200), changed: () => renderBackup(), refreshLibrary: () => lib.refresh(), now: () => Date.now(),
});
function renderBackup(): void {
  el('backup-status').textContent = backup.status();
  el<HTMLSelectElement>('backup-mode').value = backup.settings.mode;
  void backup.folder().then((dir) => { el('backup-dir').textContent = dir ? 'Backups go to ' + dir + ' (the newest ' + backup.settings.keep + ' are kept).' : ''; });
}
el('backup-now').addEventListener('click', () => void backup.backupNow());
el('backup-folder').addEventListener('click', () => void backup.chooseFolder());
el('backup-restore').addEventListener('click', () => void backup.restore());
el<HTMLSelectElement>('backup-mode').addEventListener('change', (event) => backup.setMode((event.target as HTMLSelectElement).value as 'off' | 'daily' | 'weekly'));

// ---------- selecting several pages ----------
const selectBar = el('select-bar');
function updateSelectBar(count: number, selecting: boolean): void {
  selectBar.hidden = !selecting;
  el('sel-count').textContent = count === 0 ? 'Tick pages to choose them' : count + (count === 1 ? ' page selected' : ' pages selected');
  for (const id of ['sel-move', 'sel-export', 'sel-trash']) (el(id) as HTMLButtonElement).disabled = count === 0;
}
el('sel-done').addEventListener('click', () => lib.endSelect());
el('sel-export').addEventListener('click', () => lib.exportSelected());
el('sel-trash').addEventListener('click', () => void lib.trashSelected());
el('sel-move').addEventListener('click', () => {
  const button = el('sel-move');
  menu.open([
    { heading: true, label: 'Move to' },
    ...lib.projectList().map(project => ({ label: project.name, run: () => void lib.moveSelected(project.path) })),
    { label: 'Unfiled pages', run: () => void lib.moveSelected(null) },
  ], button.getBoundingClientRect(), button, true);
});
updateSelectBar(0, false);

// ---------- export ----------
const previewScope = el<HTMLSelectElement>('preview-scope');
const previewLayout = el<HTMLSelectElement>('preview-layout');
const picker = new ExportPicker(
  { root: el('export-pick'), summary: el('pick-summary'), list: el('pick-list'), all: el('pick-all'), none: el('pick-none') },
  () => previewLayout.dispatchEvent(new Event('change')),
  store,
);
let exportProjectPath: string | null = null;
let exportPreset: string[] | null = null;
let bookExport: { service: ProjectService; snapshot: ProjectSnapshot; title: string; fileName: string } | null = null;
// ---------- export options: format, title page, contents, page numbers ----------
const optionsStore = new ExportOptionsStore(store);
let exportOpts: ExportOptions = optionsStore.load();
const optEls = {
  format: el<HTMLSelectElement>('export-format'), titlePage: el<HTMLInputElement>('opt-titlepage'), contents: el<HTMLInputElement>('opt-contents'),
  pages: el<HTMLInputElement>('opt-pages'), title: el<HTMLInputElement>('opt-title'), subtitle: el<HTMLInputElement>('opt-subtitle'),
  author: el<HTMLInputElement>('opt-author'), meta: el('export-meta'), hint: el('export-hint'),
};
const HINTS = {
  pdf: '',
  docx: 'The preview shows the PDF layout. The Word file keeps headings, emphasis, lists and links; its contents lists titles, and page numbers are live.',
  epub: 'The preview shows the PDF layout. The e-book keeps headings, emphasis, lists and links; each page is a chapter, and your reader shows its own contents.',
  md: 'The preview shows the PDF layout. The Markdown file keeps your words exactly as written.',
} as const;
function optionsToUi(o: ExportOptions): void {
  optEls.format.value = o.format; optEls.titlePage.checked = o.titlePage; optEls.contents.checked = o.contents; optEls.pages.checked = o.pageNumbers;
  optEls.title.value = o.title; optEls.subtitle.value = o.subtitle; optEls.author.value = o.author;
  optionsChrome();
}
function optionsFromUi(): ExportOptions {
  return sanitizeExportOptions({ format: optEls.format.value, titlePage: optEls.titlePage.checked, contents: optEls.contents.checked,
    pageNumbers: optEls.pages.checked, title: optEls.title.value, subtitle: optEls.subtitle.value, author: optEls.author.value });
}
function optionsChrome(): void {
  const o = exportOpts;
  optEls.meta.hidden = !o.titlePage;
  const fixedPages = o.format === 'md' || o.format === 'epub';
  optEls.pages.disabled = fixedPages;
  optEls.pages.closest('label')?.classList.toggle('is-disabled', fixedPages);
  previewLayout.disabled = o.format !== 'pdf';
  el('preview-export').textContent = FORMAT_INFO[o.format].button;
  optEls.hint.textContent = HINTS[o.format];
}
let optionsTimer = 0;
function optionsChanged(delay = 0): void {
  exportOpts = optionsFromUi();
  optionsStore.save(exportOpts);
  optionsChrome();
  window.clearTimeout(optionsTimer);
  optionsTimer = window.setTimeout(() => previewLayout.dispatchEvent(new Event('change')), delay);
}
for (const input of [optEls.format, optEls.titlePage, optEls.contents, optEls.pages]) input.addEventListener('change', () => optionsChanged());
for (const input of [optEls.title, optEls.subtitle, optEls.author]) input.addEventListener('input', () => optionsChanged(400));
function pdfOptions(o: ExportOptions) {
  return { titlePage: o.titlePage, contents: o.contents, pageNumbers: o.pageNumbers, subtitle: o.subtitle, author: o.author };
}
/** What this export is called by default: the typed title, else the page or project name. */
let exportDefaultTitle = '';
const exportTitle = (): string => effectiveTitle(exportOpts, exportDefaultTitle);
optionsToUi(exportOpts);

const preview = new ExportPreview({
  root: el('export-preview'), canvas: el<HTMLCanvasElement>('preview-canvas'),
  title: el('preview-title'), status: el('preview-status'), layout: previewLayout,
  page: el('preview-page'), previous: el<HTMLButtonElement>('preview-prev'),
  next: el<HTMLButtonElement>('preview-next'), exportButton: el<HTMLButtonElement>('preview-export'),
  close: el<HTMLButtonElement>('preview-close'),
}, async layout => {
  if (previewScope.value === 'book') {
    const info = await lib.bookForExport(exportProjectPath);
    if (!info) throw new Error('This page is not inside a project.');
    const readable = info.service.chapters.filter(c => c.file);
    if (!readable.length) throw new Error('This project has no readable pages yet.');
    picker.setPages(info.service.path ?? info.title, readable.map(c => ({
      path: c.path, label: displayName(nameFromPath(c.path), c.file!.title), words: c.file!.words })));
    if (exportPreset) { picker.choose(exportPreset); exportPreset = null; }
    const chosen = picker.selected();
    if (!chosen.length) throw new Error('Tick at least one page to export.');
    const snapshot = await info.service.previewVerified(chosen);
    // A partial export says so in the file name, so it is never mistaken for the whole project.
    const fileName = chosen.length < readable.length ? info.title + ' - ' + chosen.length + ' of ' + readable.length + ' pages' : info.title;
    bookExport = { service: info.service, snapshot, title: info.title, fileName };
    exportDefaultTitle = info.title;
    optEls.title.placeholder = info.title;
    return renderProjectPdf(snapshot.chapters, exportTitle(), layout, pdfOptions(exportOpts));
  }
  bookExport = null;
  exportDefaultTitle = doc.snapshot().name;
  optEls.title.placeholder = exportDefaultTitle;
  return renderPdf(editor.getJSON(), exportTitle(), layout, pdfOptions(exportOpts));
},
async bytes => {
  const o = exportOpts;
  const base = { title: exportTitle(), subtitle: o.subtitle, author: o.author, titlePage: o.titlePage, contents: o.contents };
  if (previewScope.value === 'book' && bookExport) {
    const book = bookExport;
    const recheck = (): Promise<void> => book.service.verify(book.snapshot);
    await recheck();
    if (o.format === 'pdf') return (await exportPdfFile(book.fileName, bytes, recheck)) !== null;
    const files = book.snapshot.chapters;
    const out = o.format === 'docx'
      ? docxBytes(files.map(f => ({ title: f.title, doc: parseChapter(f) })), { ...base, pageNumbers: o.pageNumbers })
      : o.format === 'epub'
        ? epubBytes(files.map(f => ({ title: f.title, doc: parseChapter(f) })), base)
        : new TextEncoder().encode(markdownDocument(base, compiledMarkdown(files), files.map(f => ({ level: 1, text: f.title }))));
    return (await exportDocumentFile(book.fileName, out, o.format, recheck)) !== null;
  }
  const name = doc.snapshot().name;
  if (o.format === 'pdf') return (await exportPdfFile(name, bytes)) !== null;
  const out = o.format === 'docx'
    ? docxBytes([{ doc: editor.getJSON() }], { ...base, pageNumbers: o.pageNumbers })
    : o.format === 'epub'
      ? epubBytes([{ doc: editor.getJSON() }], base)
      : new TextEncoder().encode(markdownDocument(base, editor.getMarkdown(), editor.headings().filter(h => h.level <= 2).map(h => ({ level: h.level, text: h.text }))));
  return (await exportDocumentFile(name, out, o.format)) !== null;
},
() => chrome.toast(preview.changedDuringSave ? 'Exported from an earlier snapshot; later edits are not included.' : FORMAT_INFO[exportOpts.format].label.replace(/ \(.*/, '') + ' exported. Your pages are unchanged.'),
() => editor.restoreFocus(),
error => chrome.toast(error.message + ' Close and reopen Export to refresh.', 5200));
previewScope.addEventListener('change', () => { picker.show(previewScope.value === 'book'); previewLayout.dispatchEvent(new Event('change')); });
editor.instance.on('update', () => {
  if (preview.isOpen && previewScope.value === 'page' && preview.manuscriptEdited() === 'close')
    chrome.toast('Preview closed because the page changed. Open Export again.');
});
/** Opens the PDF preview: the open page by default, or a whole project when one is named. */
async function exportPdf(project: string | null = null, pages: string[] | null = null): Promise<void> {
  autosave.cancel();
  if (doc.isDirty && !(await doc.save())) { chrome.toast('Save failed, so nothing was exported.'); return; }
  const path = doc.snapshot().path;
  const here = path && lib.root ? bookOf(lib.root, path) : null;
  exportProjectPath = project;
  exportPreset = pages;
  // The title and subtitle belong to one export; a new export starts from the page or project name again.
  optEls.title.value = '';
  optEls.subtitle.value = '';
  exportOpts = optionsFromUi();
  optionsChrome();
  const target = project ?? here;
  previewScope.value = project ? 'book' : 'page';
  (previewScope.querySelector('option[value="book"]') as HTMLOptionElement).disabled = !target;
  (previewScope.querySelector('option[value="page"]') as HTMLOptionElement).disabled = Boolean(project && project !== here);
  picker.show(previewScope.value === 'book');
  await preview.open(project ? nameFromPath(project) : doc.snapshot().name);
}

const longProjects = createLongProjects({
  exportRecoveryCopy: (name, content, path) => exportRecoveryCopy(name, content, path),
  host: document.body, store, snapshotBackend: snapshotBackend(window.indexedDB, store),
  now: () => Date.now(), every: (ms, task) => { window.setInterval(task, ms); },
  current: () => { const s = doc.snapshot(); return { path: s.path, name: s.name, plain: isPlainTextPath(s.path) }; },
  content: () => (isPlainTextPath(doc.snapshot().path) ? editor.getPlainText() : editor.getMarkdown()),
  words: () => countWords(editor.getText()),
  restoreFocus: () => editor.restoreFocus(),
  polish: () => editor.polishTypography(),
  replaceContent: (content) => editor.replaceContent(content, isPlainTextPath(doc.snapshot().path)),
  readFile: (path) => tauriFiles.read(path), pickFile: () => tauriFiles.pickOpenPath(),
  createReader, notify: (message) => chrome.toast(message, 4200),
});
projects = longProjects;

// ---------- actions ----------
async function saveWith(run: () => Promise<boolean>): Promise<void> {
  autosave.cancel();
  if (await run()) chrome.toast(doc.isDirty ? 'Snapshot saved; newer edits remain unsaved.' : 'Saved');
}
function toggleFocus(): void { void focusUI.choose(focusUI.choices.mode === 'paragraph' ? 'off' : 'paragraph'); }
function togglePref(key: 'ghost' | 'typewriter', on: string, off: string): void {
  applyPrefs(prefsStore.update({ [key]: !prefs[key] }));
  chrome.toast(prefs[key] ? on : off);
}
function resize(size: number): void { applyPrefs(prefsStore.update({ size })); }
function rename(): void {
  if (!doc.snapshot().path) return;
  const input = el<HTMLInputElement>('doc-title');
  input.focus();
  input.select();
}
function trashCurrent(): void {
  const path = doc.snapshot().path;
  if (!path || !lib.root) return;
  if (relativeTo(lib.root, path) === null) { chrome.toast('This file is outside your Library, so the app will not move it.'); return; }
  const kind = bookOf(lib.root, path) ? 'file' : 'loose';
  void lib.trash(path, kind, doc.snapshot().name);
}
function openTools(): void {
  const button = el('btn-tools');
  const k = (keys: string): string => keys.replace('Mod', IS_MAC ? '⌘' : 'Ctrl');
  menu.open([
    { label: 'Notes beside the page', hint: k('Mod+Shift+R'), run: () => APP.reference() },
    { label: 'Writing session', run: () => APP.session() },
    { label: 'Sprint goal', hint: k('Mod+Shift+A'), run: () => APP.sprint() },
    { label: 'Polish dashes and quotes', hint: k('Mod+Shift+Q'), run: () => APP.polish() },
    { separator: true, label: '' },
    { label: 'Find in many pages…', hint: k('Mod+Alt+F'), run: () => APP.findProject() },
    { label: 'Back up the Library now', run: () => APP.backupNow() },
    { label: 'Trash…', run: () => APP.openTrash() },
    { label: 'Go to a page or command', hint: k('Mod+P'), run: () => APP.palette() },
    { label: 'Shortcuts and tips', hint: k('Mod+/'), run: () => APP.help() },
  ], button.getBoundingClientRect(), button, true);
}

/** Closes the top-most layer; returns false when there was nothing to close. */
function closeLayers(): boolean {
  if (menu.close()) return true;
  if (closeContents()) return true;
  if (lib.endSelect()) return true;
  if (recoveryDialog.isOpen) { recoveryDialog.close(); return true; }
  if (fileConflict.isOpen) { fileConflict.close(); return true; }
  if (quit.cancelChoice()) return true;
  if (trashDialog.isOpen) { trashDialog.close(); return true; }
  if (preview.isOpen) { preview.close(); return true; }
  if (longProjects.closeLayer()) return true;
  if (slash.isOpen) { slash.close(); return true; }
  if (focusUI.closeMenu()) return true;
  if (projectFind.isOpen) { projectFind.close(); return true; }
  if (finder.isOpen) { finder.hide(); return true; }
  if (palette.isOpen) { palette.close(); return true; }
  if (sessionPanel.isOpen) { sessionPanel.close(); return true; }
  if (linkBar.isOpen) { linkBar.close(); return true; }
  if (help.isOpen) { help.close(); return true; }
  if (settings.isOpen) { settings.close(); editor.restoreFocus(); return true; }
  if (SMALL() && sidebarShown()) { setSidebar(false); return true; }
  if (focusMode) { void focusUI.choose('off'); return true; }
  return false;
}

const APP: Record<AppAction, () => void> = {
  new: () => void lib.newPage(),
  newProject: () => { setSidebar(true); void lib.newProject(); },
  open: () => void doc.open(),
  save: () => void saveWith(() => doc.save()),
  saveAs: () => void saveWith(() => doc.saveAs()),
  rename,
  trash: trashCurrent,
  openTrash: () => void trashDialog.open(),
  selectPages: () => { setSidebar(true); lib.toggleSelectMode(); },
  welcome: () => { setSidebar(true); void lib.openWelcome(); },
  exportPdf: () => void exportPdf(null),
  palette: () => { if (sessionPanel.isOpen) sessionPanel.close(); palette.toggle(); },
  session: () => { if (palette.isOpen) palette.close(); sessionPanel.toggle(); },
  find: () => finder.open(),
  replace: () => finder.open(true),
  focus: toggleFocus,
  sentenceFocus: () => void focusUI.choose(focusUI.choices.mode === 'sentence' ? 'off' : 'sentence'),
  fullScreen: () => void focusUI.choose(focusUI.choices.mode === 'fullscreen' ? 'off' : 'fullscreen'),
  theme: () => setTheme(themes.next()),
  outline: toggleContents,
  sidebar: () => setSidebar(!sidebarShown()),
  toolbar: () => { const next = prefsStore.update({ toolbar: !prefs.toolbar }); applyPrefs(next); chrome.toast(next.toolbar ? 'Formatting bar shown.' : 'Formatting bar hidden. Turn it back on in Settings.'); },
  ghost: () => togglePref('ghost', 'The bars will fade while you type.', 'The bars stay visible.'),
  typewriter: () => togglePref('typewriter', 'Typewriter line on. Your typing stays mid-screen.', 'Typewriter line off.'),
  zen: () => void ghostUI.toggleZen(),
  settings: () => { settings.toggle(); renderBackup(); },
  findProject: () => void projectFind.open(editor.selectionText() || el<HTMLInputElement>('find-query').value),
  backupNow: () => void backup.backupNow(),
  restoreBackup: () => void backup.restore(),
  importWord: () => { setSidebar(true); void lib.importWord(); },
  importFolder: () => { setSidebar(true); void lib.importFolder(); },
  help: () => help.toggle(),
  link: () => linkBar.open(),
  bigger: () => resize(prefs.size + 1),
  smaller: () => resize(prefs.size - 1),
  resetSize: () => resize(DEFAULT_PREFS.size),
  ...typographyActions({ get: () => prefs, update: (patch) => applyPrefs(prefsStore.update(patch)), notify: (m) => chrome.toast(m) }),
  ...longProjects.actions,
  escape: () => void closeLayers(),
};

function dispatch(action: Action): void {
  if (isEditorCommand(action)) editor.run(action);
  else APP[action]();
}

bindShortcuts(window, { resolve: resolveShortcut, closeLayers, dispatch });
bindButtons(el, (action) => APP[action]());
el('btn-sidebar').addEventListener('click', () => APP.sidebar());
el('library-menu').addEventListener('click', () => lib.libraryMenu(el('library-menu')));
el('btn-tools').addEventListener('click', openTools);
el('btn-new-more').addEventListener('click', () => {
  const more = el('btn-new-more');
  menu.open([
    { label: 'New page', hint: IS_MAC ? '⌘N' : 'Ctrl+N', run: () => APP.new() },
    { label: 'New project', hint: IS_MAC ? '⇧⌘N' : 'Ctrl+Shift+N', run: () => APP.newProject() },
    { separator: true, label: '' },
    { label: 'Import a Word document…', run: () => APP.importWord() },
    { label: 'Import a folder of pages…', run: () => APP.importFolder() },
  ], more.getBoundingClientRect(), more);
});
el('btn-history').addEventListener('click', () => APP.timeMachine());
el('btn-help').addEventListener('click', () => { settings.close(); APP.help(); });

// The title is the file name: edit it to rename; Esc puts it back.
const titleInput = el<HTMLInputElement>('doc-title');
titleInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); titleInput.blur(); editor.focus(); }
  else if (event.key === 'Escape') { event.stopPropagation(); titleInput.value = shownName(); editor.restoreFocus(); }
});
titleInput.addEventListener('blur', () => {
  const next = titleInput.value.trim();
  if (next && next !== shownName()) void lib.renameCurrent(next).then(() => chrome.setName(shownName()));
  else titleInput.value = shownName();
});

window.addEventListener('blur', () => { viewTimer.flush(); namedWriter.flush(); drafts.flush(); if (!quit.isOpen) autosave.flush(); });
window.addEventListener('focus', () => void doc.checkOutside());
window.addEventListener('beforeunload', () => { viewTimer.flush(); namedWriter.flush(); drafts.flush(); });

onFileDrop({
  onHover: (active) => app.classList.toggle('is-dropping', active),
  onDrop: (path) => {
    if (/\.docx$/i.test(path)) { setSidebar(true); void lib.importWord(path); return; }
    if (!isWritingFile(path)) { chrome.toast('A Good Page opens .md, .markdown and .txt files, and imports Word (.docx) documents.'); return; }
    autosave.flush();
    void doc.openPath(path);
  },
});

onCloseRequested(async () => {
  if (recoveryDialog.isOpen) { recoveryDialog.close(); return false; }
  namedWriter.flush(); drafts.flush();
  autosave.cancel();
  await doc.settleWrites();
  while (doc.isDirty) {
    const choice = await quit.ask();
    if (choice === 'cancel') return false;
    if (choice === 'discard') { doc.discardDraft(); return true; }
    if (!(await doc.save()) || doc.isDirty) quit.showError('Not saved. Choose Quit without saving, try Save & quit again, or keep writing.');
  }
  return true;
});

// ---------- the page stays put ----------
// Nothing may replace the app with another page: links do not open from here, no new windows, no stray drops.
let linkNoted = false;
document.addEventListener('click', (event) => {
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!link) return;
  event.preventDefault();
  if (!linkNoted) { linkNoted = true; chrome.toast('Links do not open from inside the app. Select the link and press ' + (IS_MAC ? '⌘' : 'Ctrl') + '+K to copy its address.', 5000); }
}, true);
window.open = () => null;
document.addEventListener('drop', (event) => {
  if (!event.defaultPrevented && !(event.target as Element | null)?.closest?.('.ProseMirror')) event.preventDefault();
}, true);

// ---------- start ----------
root.dataset.theme = themes.theme;
render(doc.snapshot());
applyPrefs(prefs);
void (async () => {
  try { await lib.start(); } catch (error) { chrome.toast('Could not open your Library: ' + String(error), 6000); }
  backup.start();
  renderBackup();
  const draft = drafts.load();
  if (draft && draft.trim()) {
    try {
      const rescued = await lib.rescueDraft(draft);
      if (rescued) { drafts.clear(); await lib.open(rescued); chrome.toast('Your unsaved draft is now a page in your Library.', 5000); return; }
    } catch (error) { chrome.toast('Could not keep your draft as a page: ' + String(error), 6000); }
  }
  const recovered = await restoreLastDocument(doc, lastPath, message => chrome.toast(message, 3000)).catch(() => false);
  if (recovered) {
    await offerNamedRecovery({ document: doc, store: namedStore, writer: namedWriter, dialog: recoveryDialog,
      probe: path => tauriFiles.probe!(path), exportCopy: exportRecoveryCopy, notify: message => chrome.toast(message, 5200) });
    return;
  }
  try {
    const welcome = await lib.welcomeIfNew();
    if (welcome) await lib.open(welcome);
    else await lib.openSomething();
  } catch (error) { chrome.toast('Could not open a page: ' + String(error), 5000); }
})();
