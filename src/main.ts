import './stylesheets';
import { DocumentSession, type EditorPort, type SessionSnapshot } from './core/session';
import { Debouncer, browserScheduler } from './core/debounce';
import { ThemeManager, THEME_LABELS } from './core/theme';
import { countWords, formatCount, formatSelection, formatStats } from './core/stats';
import { statusText } from './core/status';
import { renderPdf } from './export/pdf';
import { ExportPreview } from './ui/export-preview';
import { WritingGuide } from './ui/writing-guide';
import { FirstRunGuide, guideSaveComplete } from './core/first-run';
import { DEFAULT_PREFS, PreferencesStore, type Preferences } from './core/prefs';
import { applyTypography, typographyActions } from './core/typography';
import { GoalTracker, goalProgress, type GoalProgress } from './core/goal';
import { resolveShortcut } from './core/keymap';
import { bindButtons, bindShortcuts } from './app/shortcuts';
import { createLongProjects } from './app/long-projects';
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
import { isPlainTextPath, isWritingFile } from './core/paths';
import { DebouncedDraftStore, LocalDraftStore, SafeStore, browserStorage } from './adapters/storage';
import { ChangeLatch, FrameTask, browserFrames } from './core/frame';
import { bindAutoscroll } from './ui/autoscroll';
import {
  chooseWorkingDirectory, exportPdfFile, filesInWorkingDirectory, listWorkingDirectory, onCloseRequested, onFileDrop,
  openWorkingFile, setWindowTitle, setWritingFullscreen, tauriFiles, tauriPrompter,
  exportRecoveryCopy,
} from './adapters/tauri';
import { createWriterEditor } from './editor/editor';
import { Chrome } from './ui/chrome';
import { HelpSheet } from './ui/help';
import { LinkBar } from './ui/linkbar';
import { OutlinePanel } from './ui/outline';
import { SettingsPanel } from './ui/settings';
import { CommandButtons, StyleSelect, type CommandState } from './ui/toolbar';
import { CommandPalette } from './ui/command-palette';
import { SessionPanel } from './ui/session-panel';
import { WritingSession } from './core/writing-session';
import { FindPanel } from './ui/find-panel';
import { QuitDialog } from './ui/quit';
import { SlashMenu } from './ui/slash-menu';
import { bindFocusControls } from './ui/focus-controls';
import { WorkspaceHistory } from './core/workspace';
import { ThemeTransition } from './ui/theme-transition';
import { WorkspacePanel } from './ui/workspace-panel';
import { restoreLastDocument } from './core/startup';
import { bindGhostInterface } from './ui/ghost-interface';
const LAST_PATH_KEY = 'hearth.lastPath';
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
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
  { app, name: el('doc-name'), saveDot: el('save-dot'), stats: el('stats'), detail: el('status-detail'),
    focusButton: el('btn-focus'), themeButton: el('btn-theme'), toast: el('toast'), goal: el('goal'), goalFill: el('goal-fill') },
  browserScheduler,
);
// Ghost chrome, typewriter line and Zen draft. The caret is read through a closure, so this can precede the editor.
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
let workspace: WorkspacePanel | null = null;
let projects: ReturnType<typeof createLongProjects> | null = null;
// UI pieces reach the editor through closures, so they can be built before it exists.
const commandState: CommandState = {
  isActive: (name) => editor.isActive(name),
  can: (name) => editor.can(name),
  textStyle: () => editor.textStyle(),
};
const toolbar = new CommandButtons(el('toolbar'), commandState, dispatch);
const bubble = new CommandButtons(el('bubble'), commandState, dispatch);
const styleSelect = new StyleSelect(el<HTMLSelectElement>('style-select'), commandState, dispatch);
const outline = new OutlinePanel(
  { root: el('outline'), list: el('outline-list'), empty: el('outline-empty'),
    previous: el<HTMLButtonElement>('chapter-prev'), next: el<HTMLButtonElement>('chapter-next') },
  (pos) => {
    editor.jumpTo(pos);
    centerCaret(0.3);
  },
);
const settings = new SettingsPanel(
  { root: el('settings'), fontChoice: el('font-choice'), widthChoice: el('width-choice'), rhythmChoice: el('rhythm-choice'),
    sizeRange: el<HTMLInputElement>('size-range'), sizeValue: el('size-value'), goalInput: el<HTMLInputElement>('goal-input'),
    toolbarCheck: el<HTMLInputElement>('toolbar-check'), ghostCheck: el<HTMLInputElement>('ghost-check'),
    typewriterCheck: el<HTMLInputElement>('typewriter-check') },
  el('btn-settings'),
  (patch) => applyPrefs(prefsStore.update(patch)),
);
const linkBar = new LinkBar(
  { root: el('linkbar'), input: el<HTMLInputElement>('link-input'), apply: el('link-apply'), remove: el('link-remove') },
  {
    currentHref: () => editor.linkHref(),
    apply: (href) => editor.setLink(href),
    remove: () => editor.unsetLink(),
    caretRect: () => editor.caretRect(),
    restoreFocus: () => editor.restoreFocus(),
  },
);
const slash = new SlashMenu(el('slash-menu'), (command) => editor.run(command));
const help = new HelpSheet(el('help'), el('help-list'), el('help-close'), IS_MAC, () => editor.restoreFocus());
const autosave = new Debouncer(() => void session?.autosave(), 1200, browserScheduler);
const stats = new Debouncer(refreshStats, 150, browserScheduler);
const outlineTimer = new Debouncer(refreshOutline, 250, browserScheduler);
const editor = createWriterEditor({
  element: el('editor'),
  bubble: el('bubble'),
  onEdit: () => {
    slash.close();
    session?.markEdited();
    autosave.trigger();
    stats.trigger();
    if (prefs.outline) outlineTimer.trigger();
  },
  onSlash: (anchor) => slash.open(anchor),
  onSlashKey: (event) => slash.handle(event),
  zen: ghostUI.zen,
  onSelection: () => {
    selectionFrame.schedule();
    stats.trigger();
  },
});
// Toolbar state and caret-follow are layout reads: coalesce them to one run per painted frame.
const controlsFrame = new FrameTask(syncControls, browserFrames);
const selectionFrame = new FrameTask(() => {
  keepCaretCentered();
  if (prefs.outline) outline.highlight(editor.caretPos());
}, browserFrames);
editor.instance.on('transaction', () => controlsFrame.schedule());
const focusUI = bindFocusControls({
  app, panel: el('focus-choices'), trigger: el('btn-focus-choices'), exit: el('fullscreen-exit'),
  focusButton: el('btn-focus'), setFullscreen: setWritingFullscreen,
  setParagraphFocus: on => { focusMode = on; chrome.setFocus(on); },
  setSentenceFocus: on => { editor.sentenceFocus(on); },
  centered: keepCaretCentered, notify: message => chrome.toast(message, 4000),
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
function syncControls(): void {
  toolbar.sync();
  bubble.sync();
  styleSelect.sync();
}
function centerCaret(fraction: number): void {
  const top = editor.caretTop();
  if (top === null) return;
  const box = scroller.getBoundingClientRect();
  const delta = top - (box.top + box.height * fraction);
  // Instant, not smooth: a smooth scroll per keystroke queues animations and feels like lag.
  if (Math.abs(delta) > 4) scroller.scrollTop += delta;
}
function keepCaretCentered(): void {
  // The typewriter line wins over focus mode's follow; neither fights a scroll the writer is making.
  if (autoscroll.active || ghostUI.anchor()) return;
  if (focusMode) centerCaret(0.45);
}
function currentProgress(): GoalProgress | null {
  return goalProgress(countWords(editor.getText()), prefs.goal);
}
function refreshStats(): void {
  const text = editor.getText();
  const total = countWords(text);
  const progress = goalProgress(total, prefs.goal);
  const selected = countWords(editor.selectionText());
  if (selected > 0) {
    chrome.setStats(formatSelection(selected, total));
  } else {
    const goalText = progress ? ' · ' + Math.floor(progress.ratio * 100) + '% of goal' : '';
    chrome.setStats(formatStats(total) + goalText);
  }
  chrome.setGoal(progress);
  sessionPanel.update();
  refreshStatus(total, selected, text.length);
  projects?.statsChanged();
  if (progress && goals.check(progress)) {
    chrome.celebrate('Goal reached: ' + formatCount(prefs.goal) + ' words. Lovely work.');
  }
}
function refreshStatus(words: number, selected: number, characters: number): void {
  const caret = editor.caretPos();
  const section = editor.headings().filter((h) => h.pos < caret).slice(-1)[0]?.text ?? null;
  const snapshot = session?.snapshot();
  chrome.setDetail(statusText({ words, selected, characters,
    goal: prefs.goal, section, filename: snapshot?.path ?? 'Untitled', save: snapshot?.state ?? 'saved' }));
}
function refreshOutline(): void {
  outline.update(editor.headings(), editor.caretPos());
}
const themeShift = new ThemeTransition(root, browserScheduler, 520, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function applyTheme(): void {
  themeShift.apply(themes.theme);
  chrome.setThemeLabel(THEME_LABELS[themes.theme]);
}
function applyPrefs(next: Preferences): void {
  const goalChanged = next.goal !== prefs.goal;
  prefs = next;
  applyTypography(root, next);
  app.classList.toggle('no-toolbar', !next.toolbar);
  ghostUI.setGhost(next.ghost);
  ghostUI.setTypewriter(next.typewriter);
  outline.setVisible(next.outline);
  el('btn-outline').setAttribute('aria-pressed', String(next.outline));
  settings.render(next);
  if (next.outline) refreshOutline();
  if (goalChanged) goals.reset(currentProgress());
  refreshStats();
}
/** Runs whenever the session swaps the page content (open, new, draft restore). */
function onDocumentLoaded(): void {
  if (preview.isOpen) preview.close();
  goals.reset(currentProgress());
  refreshStats();
  if (prefs.outline) refreshOutline();
  syncControls();
  projects?.documentLoaded();
}
const sessionEditor: EditorPort = {
  getMarkdown: () => editor.getMarkdown(),
  getPlainText: () => editor.getPlainText(),
  setPlainText: (text) => { sessionPanel.documentChanged(); editor.setPlainText(text); onDocumentLoaded(); },
  setMarkdown: (markdown) => {
    sessionPanel.documentChanged();
    editor.setMarkdown(markdown);
    onDocumentLoaded();
  },
  focus: () => editor.focus(),
};

// Every keystroke emits a snapshot; window title (IPC), storage and the file list only change on real transitions.
const shown = new ChangeLatch();
function render(snapshot: SessionSnapshot): void {
  stats.trigger();
  namedWriter?.change(snapshot);
  if (!shown.changed(JSON.stringify([snapshot.name, snapshot.path, snapshot.state]))) return;
  chrome.setName(snapshot.name);
  workspace?.markActive(snapshot.path);
  if (snapshot.state === 'saved' && snapshot.path) { void workspace?.refresh(); projects?.saved(); }
  chrome.setSaveState(snapshot.state);
  const marker = snapshot.state === 'dirty' || snapshot.state === 'error' ? '• ' : '';
  void setWindowTitle(marker + snapshot.name + ' — A Good Page');
  if (snapshot.path) store.set(LAST_PATH_KEY, snapshot.path);
  else store.remove(LAST_PATH_KEY);
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
  files: filesInWorkingDirectory(() => workspace?.directory ?? null),
  prompter: tauriPrompter,
  drafts,
  events: { onChange: render, onError: (message) => chrome.toast(message, 4200), onOutside: state => outsideNotice.show(state), onResolved: message => chrome.toast(message, 4200), onDiscard: path => namedWriter.discard(path), onConflict: async info => protectReload(await fileConflict.ask(info), async () => {
      if (!projects) throw new Error('Recovery is not ready; the draft was not reloaded.');
      await projects.preserveBeforeReload();
    }) },
});
const doc = session;
workspace = new WorkspacePanel({
  root: el('workspace-panel'), toggle: el<HTMLButtonElement>('btn-workspace'),
  choose: el<HTMLButtonElement>('workspace-choose'), refresh: el<HTMLButtonElement>('workspace-refresh'), recent: el('workspace-recent'),
  label: el('workspace-location'), up: el<HTMLButtonElement>('workspace-up'),
  contents: el('workspace-contents'), status: el('workspace-status'), search: el<HTMLInputElement>('workspace-search'),
}, new WorkspaceHistory(store), {
  pick: chooseWorkingDirectory, list: listWorkingDirectory,
  open: (root, path) => doc.openWorkspacePath(root, path, openWorkingFile), report: message => chrome.toast(message, 4200), onRefresh: () => doc.checkOutside(),
});
const preview = new ExportPreview({
  root: el('export-preview'), canvas: el<HTMLCanvasElement>('preview-canvas'),
  title: el('preview-title'), status: el('preview-status'), layout: el<HTMLSelectElement>('preview-layout'),
  page: el('preview-page'), previous: el<HTMLButtonElement>('preview-prev'),
  next: el<HTMLButtonElement>('preview-next'), exportButton: el<HTMLButtonElement>('preview-export'),
  close: el<HTMLButtonElement>('preview-close'),
}, layout => renderPdf(editor.getJSON(), doc.snapshot().name, layout),
async bytes => (await exportPdfFile(doc.snapshot().name, bytes)) !== null,
() => {
  chrome.toast(preview.changedDuringSave ? 'PDF exported from an earlier snapshot; later edits are not included.' : 'PDF exported. Your manuscript is unchanged.');
  guide.exported();
}, () => guide.previewClosed());
editor.instance.on('update', () => {
  if (preview.isOpen && preview.manuscriptEdited() === 'close')
    chrome.toast('Preview closed because the manuscript changed. Open a fresh preview.');
});
const longProjects = createLongProjects({
  exportRecoveryCopy: (name, content, path) => exportRecoveryCopy(name, content, path),
  host: document.body, store, snapshotBackend: snapshotBackend(window.indexedDB, store),
  now: () => Date.now(), every: (ms, task) => { window.setInterval(task, ms); },
  current: () => { const s = doc.snapshot(); return { path: s.path, name: s.name, plain: isPlainTextPath(s.path) }; },
  content: () => (isPlainTextPath(doc.snapshot().path) ? editor.getPlainText() : editor.getMarkdown()),
  words: () => countWords(editor.getText()), headings: () => editor.headings(),
  jump: (pos) => { editor.jumpTo(pos); centerCaret(0.3); }, restoreFocus: () => editor.restoreFocus(),
  polish: () => editor.polishTypography(),
  replaceContent: (content) => editor.replaceContent(content, isPlainTextPath(doc.snapshot().path)),
  workspaceRoot: () => new WorkspaceHistory(store).active, listFolder: listWorkingDirectory,
  openWorkspaceFile: (root, path) => { autosave.flush(); void doc.openWorkspacePath(root, path, openWorkingFile); },
  readFile: (path) => tauriFiles.read(path), pickFile: () => tauriFiles.pickOpenPath(),
  createReader, notify: (message) => chrome.toast(message, 4200),
});
projects = longProjects;
longProjects.documentLoaded();
const guide = new WritingGuide({
  root: el('writing-guide'), resume: el<HTMLButtonElement>('guide-resume'), title: el('guide-title'), copy: el('guide-copy'),
  action: el<HTMLButtonElement>('guide-action'), skip: el<HTMLButtonElement>('guide-skip'),
  position: el('guide-position'), error: el('guide-error'),
}, new FirstRunGuide(store), () => doc.newDocument(), async () => guideSaveComplete(await doc.save(), doc.isDirty), () => preview.open(doc.snapshot().name), () => editor.restoreFocus());
el('help-guide').addEventListener('click', () => { help.close(); guide.open(true); });

async function exportPdf(): Promise<void> { await preview.open(doc.snapshot().name); }

async function saveWith(run: () => Promise<boolean>): Promise<void> {
  autosave.cancel();
  if (await run()) chrome.toast(doc.isDirty ? 'Snapshot saved; newer edits remain unsaved.' : 'Saved');
}

function toggleFocus(): void { void focusUI.choose(focusUI.choices.mode === 'paragraph' ? 'off' : 'paragraph'); }

function toggleToolbar(): void {
  const next = prefsStore.update({ toolbar: !prefs.toolbar });
  applyPrefs(next);
  if (!next.toolbar) chrome.toast('Formatting bar hidden. Press ' + (IS_MAC ? '⌘' : 'Ctrl') + '+\\ to bring it back.');
}

function togglePref(key: 'ghost' | 'typewriter', on: string, off: string): void {
  applyPrefs(prefsStore.update({ [key]: !prefs[key] }));
  chrome.toast(prefs[key] ? on : off);
}

function resize(size: number): void { applyPrefs(prefsStore.update({ size })); }

/** Closes the top-most layer; returns false when there was nothing to close. */
function closeLayers(): boolean {
  if (fileConflict.isOpen) { fileConflict.close(); return true; }
  if (quit.cancelChoice()) return true;
  if (preview.isOpen) { preview.close(); return true; }
  if (longProjects.closeLayer()) return true;
  if (guide.isOpen) { guide.close(true); return true; }
  if (slash.isOpen) { slash.close(); return true; }
  if (focusUI.closeMenu()) return true;
  if (finder.isOpen) { finder.hide(); return true; }
  if (palette.isOpen) { palette.close(); return true; }
  if (sessionPanel.isOpen) { sessionPanel.close(); return true; }
  if (linkBar.isOpen) {
    linkBar.close();
    return true;
  }
  if (settings.popover.isOpen) {
    settings.popover.close();
    editor.restoreFocus();
    return true;
  }
  if (help.isOpen) {
    help.close();
    return true;
  }
  if (workspace?.clearFilter() || workspace?.close()) return true;
  if (focusMode) {
    void focusUI.choose('off');
    return true;
  }
  return false;
}

const APP: Record<AppAction, () => void> = {
  new: () => void doc.newDocument(),
  open: () => void doc.open(),
  save: () => void saveWith(() => doc.save()),
  saveAs: () => void saveWith(() => doc.saveAs()),
  exportPdf: () => void exportPdf(),
  palette: () => { if (sessionPanel.isOpen) sessionPanel.close(); palette.toggle(); },
  session: () => { if (palette.isOpen) palette.close(); sessionPanel.toggle(); },
  find: () => finder.open(),
  replace: () => finder.open(true),
  focus: toggleFocus,
  sentenceFocus: () => void focusUI.choose(focusUI.choices.mode === 'sentence' ? 'off' : 'sentence'),
  fullScreen: () => void focusUI.choose(focusUI.choices.mode === 'fullscreen' ? 'off' : 'fullscreen'),
  theme: () => {
    themes.next();
    applyTheme();
  },
  outline: () => applyPrefs(prefsStore.update({ outline: !prefs.outline })),
  toolbar: toggleToolbar,
  ghost: () => togglePref('ghost', 'The bars will fade while you type.', 'The bars stay visible.'),
  typewriter: () => togglePref('typewriter', 'Typewriter line on. Your typing stays mid-screen.', 'Typewriter line off.'),
  zen: () => void ghostUI.toggleZen(),
  settings: () => settings.toggle(),
  help: () => help.toggle(),
  link: () => linkBar.open(),
  bigger: () => resize(prefs.size + 1),
  smaller: () => resize(prefs.size - 1),
  resetSize: () => resize(DEFAULT_PREFS.size),
  ...typographyActions({ get: () => prefs, update: (patch) => applyPrefs(prefsStore.update(patch)), notify: (m) => chrome.toast(m) }),
  ...longProjects.actions,
  switcher: () => { if (palette.isOpen) palette.close(false); longProjects.actions.switcher(); },
  escape: () => void closeLayers(),
};

function dispatch(action: Action): void {
  if (isEditorCommand(action)) editor.run(action);
  else APP[action]();
}

bindShortcuts(window, { resolve: resolveShortcut, closeLayers, dispatch });
bindButtons(el, (action) => APP[action]());

window.addEventListener('blur', () => { namedWriter.flush(); drafts.flush(); if (!quit.isOpen) autosave.flush(); });
window.addEventListener('focus', () => void doc.checkOutside());
window.addEventListener('beforeunload', () => { namedWriter.flush(); drafts.flush(); });

onFileDrop({
  onHover: (active) => app.classList.toggle('is-dropping', active),
  onDrop: (path) => {
    if (!isWritingFile(path)) {
      chrome.toast('A Good Page opens .md, .markdown and .txt files.');
      return;
    }
    autosave.flush();
    void doc.openPath(path);
  },
});

onCloseRequested(async () => {
  namedWriter.flush(); drafts.flush();
  autosave.cancel();
  await doc.settleWrites();
  while (doc.isDirty) {
    const choice = await quit.ask();
    if (choice === 'cancel') return false;
    if (choice === 'discard') { doc.discardDraft(); return true; }
    if (!(await doc.save()) || doc.isDirty) {
      quit.showError('Not saved. Choose Quit without saving, try Save & quit again, or keep writing.');
    }
  }
  return true;
});

applyTheme();
render(doc.snapshot());
applyPrefs(prefs);
syncControls();
void restoreLastDocument(doc, lastPath, message => chrome.toast(message)).then(async recovered => {
  await offerNamedRecovery({ document: doc, store: namedStore, writer: namedWriter, dialog: recoveryDialog,
    probe: path => tauriFiles.probe!(path), exportCopy: exportRecoveryCopy, notify: message => chrome.toast(message, 5200) });
  if (!recovered && guide.shouldOffer && !namedStore.load()) guide.open();
})
  .catch(error => chrome.toast('Could not restore your last document: ' + String(error), 4200));

void workspace.restore();
