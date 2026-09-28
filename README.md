# A Good Page

**More page. Less noise.**

A Good Page is a quiet writing space for the draft you want to finish. Write and format like a document, without staring at Markdown syntax. Your work stays in ordinary Markdown files you can open elsewhere; plain-text files work too.

Need a calmer screen? Let the bars fade, keep your current line in view, or write full-screen. Need your bearings again? Jump to a chapter, pin your notes beside the draft, and get back to the sentence you were writing.

### Why it feels different

- **The page comes first.** A soft formatting bar and familiar shortcuts stay close when you need them; focus modes, five themes and adjustable typography get out of the way when you do not.
- **Long drafts are easier to navigate.** Use the outline or Quick Switcher to find a chapter or another document in your working folder. Keep research or character notes in a slim, read-only side panel.
- **Momentum without a scoreboard.** Set a small new-word sprint, watch a quiet progress ring fill, or start a timed writing session. The celebration is gentle; the writing is yours.
- **A way back.** Time Machine keeps local versions as you write. Preview an earlier page, restore it, and use Undo if you change your mind. Named files autosave; untitled drafts have a local safety net.
- **A clean copy when it is time to share.** Polish dashes, ellipses and quotes without touching code. Preview paginated A4 pages before exporting a PDF; your editable source stays put.

No account or cloud workflow is needed for the editing and file features described here. This is a desktop app built with Tauri 2, Rust and TipTap.

## A whole manuscript, not just a chapter

Click **Manuscript** beside Workspace. It lists chapters in their chosen order with titles, word counts and headings; reordering writes a guarded `.a-good-page.json` manifest beside the files, never moves or edits the chapters. Search spans the project. Scan limits are four subfolder levels, 200 folders and 200 chapters; missing, unreadable or unscanned chapters block compilation rather than silently disappearing.

Select chapters and **Compile selected chapters** for a read-only combined view. A visible inventory shows every included chapter in order, excluded filenames and selected word total. **Preview whole PDF** uses the actual paginated A4 pages; the editable Markdown and text files remain separate. If a selected file or project order changes, export names the culprit and disables the old PDF. **Refresh preview** re-reads the sources; if refresh fails, old pages remain visible but unexportable. Saving to PDF checks all included files and the order both before and after choosing a destination. The final PDF must be checked on an installed build before release; CI cannot prove printed layout fidelity alone.

## Start here

1. Open the app and start typing. The optional writing guide walks through a new page, a save and a PDF export.
2. Choose **Workspace** if your chapters live in a folder. Open a manuscript, or save your new page as Markdown (`.md`).
3. Use **Ctrl/Cmd+P** to jump to a chapter or file. Choose **Export PDF** when you want to see the actual pages before sharing.

Your `.md` file is the editable original. PDF is a separate copy; a `.txt` file is saved as plain text without formatting.

## Install and supported systems

A Good Page is designed as a desktop app for **macOS, Windows and Linux**. The release workflow is set up to build macOS installers for Apple silicon and Intel, plus Windows and Linux packages. The maintainer reports physical-hardware testing on Fedora 43 (Wayland and X11) and passing macOS and Windows CI; that is not the same as a hands-on installation test for each macOS/Windows package. Confirm the actual installer assets before claiming those platforms are verified.

For a published release, open the project’s GitHub **Releases** page, choose the asset for your operating system and processor, install it using your system’s usual installer, then launch **A Good Page**. You do not need Node.js or Rust to run an installer. Do not download a draft release expecting a finished installer.

Release builds are currently **unsigned**. macOS or Windows may show a security warning on first launch. Only open an installer if you trust where it came from; do not bypass a warning for an unverified download.

**Build from source instead:** the steps below require Node.js 20+, stable Rust and the Tauri 2 system dependencies for your OS. The installer build uses `npm run icons` before `npm run tauri build`.
## At a glance

| When you want to… | Use… |
| --- | --- |
| Keep writing without distractions | Quiet screen, paragraph/sentence focus, full screen, typewriter line or Zen draft |
| Find your place | Outline, manuscript Find, command palette or Quick Switcher |
| Keep research nearby | Pinned read-only notes on either side of the page |
| Stay in motion | Sprint ring, timed session and word-goal progress |
| Keep or recover a draft | Autosave, local untitled draft and Time Machine |
| Share clean pages | PDF preview with Manuscript or Reading copy layout |
## Shortcuts (Cmd on macOS)

    Ctrl + N / O / S          New / Open / Save
    Ctrl + Shift + S          Save as
    Ctrl + Shift + E          Export PDF
    Ctrl + Shift + P          Search all commands
    Ctrl + P                  Quick switcher: chapters and files
    Ctrl + Shift + R          Pinned notes
    Ctrl + Shift + A          Sprint goal
    Ctrl + Shift + I          Time Machine
    Ctrl + Shift + Q          Polish typography
    Ctrl + F / H              Find / Find and replace
    Ctrl + B / I / E          Bold / Italic / Inline code
    Ctrl + Z / Y              Undo / Redo
    Ctrl + Shift + Z          Redo
    Ctrl + Shift + X          Strikethrough
    Ctrl + K                  Link
    Ctrl + Alt + 0..3         Body / Title / Heading / Subheading
    Ctrl + Shift + 8 / 7 / 9  Bullet / Numbered / Checklist
    Ctrl + Shift + B / H      Quote / Scene break
    Ctrl + Shift + F          Paragraph focus
    Ctrl + Shift + U          Sentence focus
    Ctrl + Shift + G          Full-screen writing
    Ctrl + Shift + L          Change theme
    Ctrl + Shift + O          Outline
    Ctrl + Shift + J          Fade the bars while typing (on / off)
    Ctrl + Shift + T          Typewriter line (on / off)
    Ctrl + Shift + D          Zen draft (on / off)
    Ctrl + Shift + M          Column width: Narrow, Comfortable, Wide
    Ctrl + Shift + K          Spacing: Dense, Balanced, Spacious
    Ctrl + Shift + Y          Typeface: Editorial serif, Humanist sans, Duospace
    Ctrl + \                  Show / hide formatting bar
    Ctrl + = / - / 0          Bigger / smaller / reset text size
    Ctrl + /                  All shortcuts
    Esc                       Close panels, leave focus mode

## Find your place in a long project

**Quick switcher.** Ctrl/Cmd+P (or "switch" in the command palette) opens one
search box for the headings in this manuscript and the .md, .markdown and .txt
files in the current working directory. Letters only have to appear in order,
so "ch3 fog" finds "Chapter 3: The fog". Headings are listed first. Choosing a
file runs the usual unsaved-work check. Ctrl/Cmd+K stays Link, as before; on
macOS use Cmd+P for the switcher. The file list covers the working directory and
subfolders up to four levels deep (at most 200 folders and 2,000 files), and is
refreshed after 30 seconds or a save. Symlinked entries are skipped.

**Pinned notes.** Ctrl/Cmd+Shift+R opens a slim panel beside the page. Pin the
document you have open, or choose any Markdown or text file. The note is shown
read-only, so it can never be changed by accident; ↻ reloads it after editing
elsewhere. Collapse it to a "Notes" tab, swap it to the other side, or unpin it.
The pin and side are remembered between launches.

**Sprint ring.** Ctrl/Cmd+Shift+A (or click the ring in the lower-left corner)
sets a goal for new words in this sprint. The ring fills quietly as you write,
counting from the moment you start, and glows softly once when you reach the
goal. It belongs to one document: switching manuscripts pauses it until you
return. Reduce motion turns the glow into a still highlight.

**Time Machine.** A Good Page keeps versions of each manuscript when it is
opened, when it is saved, every ten minutes while it is open, and when Time
Machine opens. Ctrl/Cmd+Shift+I shows a slider from the oldest version to now,
labelled "12 minutes ago", "Yesterday at 4:05 PM" and so on, with a read-only
preview. Restore replaces the page with that version as one edit, so Undo
brings back what you had. Nothing is written to the manuscript until you save. **Export recovery copy** writes the selected older version to a separate `.md` or `.txt` file you choose, without restoring it or changing the open manuscript. It cannot replace the open manuscript; keep the exported file in your normal backup folder.
Versions are kept in the app's local storage (IndexedDB, with localStorage as
a fallback), not beside your files: every ten minutes for the last hour, hourly
for a day, then daily for two weeks, up to 40 manuscripts.

**Polish typography.** Ctrl/Cmd+Shift+Q changes -- to an em dash, ... to an
ellipsis and straight quotes to curly ones across the whole manuscript, as one
undoable edit. Code and inline code are left alone. Pasted text gets the same
treatment unless you paste into code. The .md file stays ordinary Markdown with
Unicode punctuation.

## Find a word, a chapter, or a way out

Find searches the manuscript, including words split across formatting marks.
Select a short phrase before opening Find to prefill it; Match case and Whole words
narrow the results. Enter / Shift+Enter move through matches and Enter in the
replacement field replaces the current result. Next/Previous
wrap around; Replace changes the current occurrence and Replace all applies one undoable
transaction. Open Outline and click its arrows to jump between top-level chapters,
or click the triangle by a heading to collapse or expand its subheadings.

When you close with unsaved changes, choose Save & quit, Quit without saving, or
Keep writing. If Save is cancelled or fails, the choice remains available. Quitting
without saving clears an unsaved untitled draft; use Save & quit to keep those words.

## Make room for the next sentence

Use Focus for paragraph emphasis, or the adjacent arrow to choose Sentence or Full screen.
Sentence focus dims words outside the current sentence; Full screen hides the app
chrome and enters native fullscreen. Press Esc or the floating Leave full screen
button to return. These are presentation modes; your document is unchanged.

At the beginning of an empty paragraph, type / to open a compact writing menu.
Choose Heading, Scene break, lists or other blocks with arrows and Enter, or
click a choice. Typing / elsewhere inserts an ordinary slash. Selecting text
shows the familiar floating bubble, now with plain-language block labels.

## Find your writing rhythm

**Quiet screen.** When you start typing, the top bar, the status bar and the
scrollbar fade out. They come back when you move the mouse or press Esc.
Shortcuts and scrolling do not wake them, and the small mouse movements that
come from scrolling are ignored. It is on by default. Turn it off in Aa or
with Ctrl/Cmd+Shift+J.

**Typewriter line.** Turn it on with Ctrl/Cmd+Shift+T or in Aa. The line you
are typing stays at the middle of the window, and the page moves up under it.
There is half a screen of space above the first line and below the last one,
so they can sit in the middle too. Clicking or selecting with the mouse does
not move the page; it centres again on your next keystroke. When it is on, it
replaces the scrolling that focus mode uses.

**Zen draft.** For getting a first draft down. Ctrl/Cmd+Shift+D, the palette
("zen", "hemingway") or Aa turns it on. While it is on, Backspace, Delete,
word and line deletion, Cut and dragging text away do nothing. A short
reminder appears, at most once every few seconds. Typing, Enter, arrow keys,
Undo and IME composition still work. A "Zen draft" tag in the status bar shows
it is on; click it or press the shortcut again to edit normally. Zen draft
turns off every time the app starts, so you never open a manuscript you
cannot edit.

## Make the page yours

Three settings in Aa control how the page reads. They change only what you see;
the Markdown file is untouched.

**Column width.** Narrow keeps lines at about 60 characters, Comfortable at about 72
and Wide at about 85. The width is measured in characters of the writing face, so
it stays the same when the window is resized or maximised. On a very small window
the text uses the full width. Saved preferences keep their old keys, so an old
"Medium" setting opens as Comfortable.

**Typeface.** Editorial serif is for narrative, Humanist sans for articles and
notes, and Duospace for drafting, with ligatures off so the character grid stays
even. Each uses a font already on your computer: Literata, Merriweather, Inter,
iA Writer Duo or JetBrains Mono when installed, otherwise the closest system face.
Nothing is bundled or downloaded. Sans and Duospace are scaled down slightly so
all three look about the same size at the same text-size setting.

**Spacing.** Dense (line height 1.5, small paragraph gaps), Balanced (1.75, the
previous look and the default) or Spacious (2.0, generous gaps). Headings follow
the chosen density.

Ctrl/Cmd+Shift+M, K and Y cycle width, spacing and typeface, and the command
palette finds them by words such as "line length", "line height" or "duospace".
PDF export keeps its own Manuscript and Reading copy layouts and does not follow
these screen settings.

## Write for a while

Click Session in the footer or search "session" in the command palette. Set a duration and
optionally a target for new words (not the total words in the file). A discreet countdown
remains visible while you write. Close the session dialog to keep writing; open it again
to see progress or end early. At the end you get a short summary. Switching documents
ends the current session, so a different manuscript's words never inflate its result.
Sessions do not modify, save, or export your manuscript.

## See the pages before you share

Choose Export PDF in the top bar (or Ctrl/Cmd+Shift+E). The preview renders the
actual A4 PDF pages, with Previous/Next page controls and a layout switch.
Manuscript uses wider margins and airy leading; Reading copy is a more compact
shareable layout. Export PDF in the preview saves exactly the layout shown. If the manuscript changes
while preview is open, or a different document is loaded, the preview closes
so you can generate fresh pages.
Cancelling the file picker keeps the preview open unless the manuscript changed
while the dialog was pending; then the stale preview closes. If export completes
after newer edits, A Good Page labels the PDF as an earlier snapshot so you know those
words were not included. Nothing is written to disk until you confirm an export
path, and exporting never saves the source document.

On a new installation, the optional guide offers three actions: create a new
page, save it, then preview and export a PDF. Steps advance only after the
requested action succeeds (Save also requires no newer unsaved edits). Skip persists your choice; you can reopen the guide
from Help → Show writing guide at any time. No Markdown knowledge is needed.

## Keep your files yours

A .txt file opens literally: # and * remain text, not formatting instructions.
Saving a .txt writes only readable text; styles are deliberately not retained in plain text.
Save as .md to retain headings, lists and other rich formatting. PDF export produces a
separate styled, paginated file with embedded fonts and does not mark the current draft
as saved. Keep the Markdown manuscript as your editable original.

## Bring your whole folder

Click **Workspace → Choose folder** to browse one level of the folder at a time.
Open subfolders, click breadcrumbs or ↑ to return to a parent, filter the visible
folder by name without searching the disk (↓ enters results, arrows move between
results, Enter opens a sole filtered result, and Esc clears the filter before
closing Workspace), or ↻ to refresh files created in
A Good Page or another app. A Good Page lists folders and .md, .markdown and .txt files;
click a file to open it. If the current manuscript has unsaved changes, the
existing save/discard check runs before switching files. Changing which folder
you are viewing does not close or change the open manuscript.

The five most recently chosen working directories are saved locally and listed
in the Workspace panel, newest first. Remove a recent shortcut with × without
deleting its files; the last active folder is reopened on
launch. Save As defaults to the directory or subfolder currently being viewed.
Selecting a different path in the native Save As dialog is still allowed.
Browsing is one folder at a time, never a recursive scan, and symlinked entries
are not shown in the workspace. Workspace file clicks are rechecked against
the selected root before opening, including file type and symlinked paths.
Folders over 2,000 entries show an error rather than a partial list. This is
not a sandbox against a compromised renderer: the existing ordinary Open
dialog remains available for user-selected files anywhere on disk. If a
recent directory was moved or deleted,
choose it again at its new location. Files are still plain Markdown or UTF-8
text on disk; selecting a workspace does not copy or import them.

## Small details, quieter writing

Themes, buttons, focus rings and motion share a consistent polish layer. Animations respect reduced-motion settings. Word counts and outline updates are debounced; long pages skip off-screen layout, and untitled drafts flush after typing pauses. Middle-click autoscroll is built in for WebViews that lack it.

## What you need to build from source

- Node.js 20+
- Rust (stable) via rustup
- Tauri 2 system dependencies for your OS: https://v2.tauri.app/start/prerequisites/

## Run from source

    npm install
    npm run icons
    npm run tauri dev

## Pick up where you left off

Named manuscripts keep local records of unsaved words after typing pauses (about 500 ms), flushed on window blur and normal close. On restart, review recovered words beside the disk copy; choose Resume, Save as a copy, explicit Discard, or Esc to keep the record for later. The disk file is never replaced automatically. A changed disk copy keeps autosave paused after Resume; missing or unreadable files can still be exported as copies. A cancelled Save dialog keeps the record.

0.1.6 supports **up to eight named recovery records** without evicting unsaved words, and migrates the earlier single-record format. A full or damaged store warns instead of overwriting other drafts. Each edit restarts the pause timer; changing documents, blur and normal close flush the pending record. Only a confirmed save/copy or explicit discard clears its matching record. Recovery is local, not a backup; a crash before the pause can still lose the newest keystrokes. Keep separate backups.

## Working alongside another editor

When you return to A Good Page or refresh Workspace, it checks the open chapter without saving or reloading. A persistent notice names a file that **changed**, **went missing**, or **cannot currently be read** (for example, an unavailable drive). Choose Review changes for the latest side-by-side view, or Keep writing to retain your draft and leave autosave paused. The notice stays until the disk state is resolved. Returning to the app repeatedly does not stack dialogs.

If a chapter changes on disk after A Good Page opens or saves it, autosave stops instead of silently replacing the outside edit. A conflict dialog lets you **Review changes** side by side, **Keep safety snapshot & reload** (first keeping the current draft in local Time Machine, then replacing the in-memory page), **Save my version as a copy** to a different new file, or **Keep writing**. While a conflict is unresolved, autosave stays paused; an explicit Save checks the file again. If Time Machine cannot preserve the draft, Reload is cancelled. If the file is missing or cannot be read, Reload is unavailable; your draft stays open. Save As refuses a destination that already exists, to avoid overwriting an unrelated document; choose a new filename instead.

Before acting on a review choice the app checks the disk again; if it changed during review, the choice is cancelled and a fresh review is required. Save a copy suggests a distinct `-my-copy` filename without overwriting an existing file. After resolution the notice clears when the file matches the open version or the new copy is saved. The dialog names the affected file and distinguishes an unavailable manuscript from an occupied Save As filename. The comparison shows up to 300 paragraphs per side and highlights paragraphs unique to either version; the saved documents themselves are not truncated. Keep a backup of your writing folder. The pre-write content check prevents ordinary silent overwrites, but another program writing the same file at the exact instant A Good Page writes it is not a cross-application atomic lock. Already queued autosaves stop once a conflict is detected; explicit Save still rechecks.

## Linux window troubleshooting

On Linux, A Good Page disables WebKitGTK DMABUF rendering by default to avoid a blank window or protocol error on affected Wayland desktops. It does not override an existing `WEBKIT_DISABLE_DMABUF_RENDERER` setting. This does not affect macOS or Windows.

## How your work is protected

Writing is hard enough without worrying about the Save button. Named files autosave unless an outside edit creates a conflict; an untitled draft is kept locally. On disk, saves use an exclusive temporary file, sync it, then rename it into place. If a write fails, the page stays marked unsaved so you can try again.

A delayed Open or Save As dialog cannot silently replace newer words or switch the active manuscript. Closing waits for an in-flight save and lets you save, discard or keep writing. A previewed PDF is a snapshot: edits made afterward are not secretly added to that export. Time Machine versions are local recovery points, not a replacement for a separate backup of your writing folder. In Time Machine, select an older version and choose **Export recovery copy** to keep an independent file.

For maintainers: tests cover the stale-dialog, save, preview, replacement, focus and welcome-flow cases; run them and a local build before publishing.
## Run the tests

    npm test
    cd src-tauri
    cargo test

## Build an installer yourself

    npm run tauri build

## Releases

Version 0.2.1 improves whole-manuscript preview and PDF fidelity; 0.2.0 added compilation; 0.1.6 hardens recovery across multiple manuscripts; 0.1.5 adds explicit crash recovery for unsaved named manuscripts; 0.1.4 warns about outside changes on return to the app; 0.1.3 polishes conflict recovery and Linux startup; 0.1.2 protects manuscripts edited in other tools; 0.1.1 was a recovery and release-readiness update; 0.1.0 was the first public release. See `CHANGELOG.md`. Earlier internal
builds went up to 0.4.0 and were renumbered. `package.json`,
`src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` must carry the same
version, which a test checks.

- `.github/workflows/ci.yml` type-checks, runs the tests and builds on every
  push and pull request, and runs `cargo fmt`, `clippy` and `cargo test` on
  Linux, macOS and Windows.
- `.github/workflows/release.yml` runs on a `v*` tag. It builds installers for
  macOS (Apple silicon and Intel), Windows and Linux with tauri-action and
  attaches them to a draft GitHub release after CI verification. Follow `RELEASE_0.2.1.md` and the historical release checklists before publishing; a green CI build is not proof an installer launches.

To release: update `CHANGELOG.md`, set the version in the three files, commit,
then `git tag v0.2.1 && git push origin v0.2.1`. Installers are unsigned, so
macOS and Windows show a warning on first launch until signing secrets are
added. See `CONTRIBUTING.md` for the checks to run first, and `LICENSE` (MIT).

