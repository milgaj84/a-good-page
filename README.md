# A Good Page

A cozy, minimalist, distraction-free WYSIWYG Markdown editor for writers.
Built with Tauri 2 (Rust) and TipTap. You never see Markdown symbols - you just write.
Files stay plain .md so they open anywhere.

## Features

- Quick switcher (Ctrl/Cmd+P): type a few letters to jump to a chapter or open another workspace document
- Pinned notes: keep an outline or research file open, read-only, in a slim panel on the left or right
- Sprint ring: a quiet corner ring for a new-word goal that glows once when you reach it
- Time Machine: scrub through automatic versions of the manuscript and restore one with Undo as a safety net
- Polish typography: -- to —, ... to … and straight to curly quotes, in one command or as you paste

- Workspace panel: choose a working directory, browse its subfolders, and switch among Markdown or text manuscripts
- Five recent working directories, persisted for quick switching; Save As starts in the currently viewed subfolder

- Export preview shows the actual PDF pages, page count, page breaks and typography before saving
- Switch between Manuscript (spacious, restrained) and Reading copy (compact, polished) layouts
- First-run writing guide: three optional steps to create, save and export without knowing Markdown; reopen from Help

- Three focus choices: paragraph, sentence, or a native full-screen writing page without app chrome
- Type / in an empty paragraph for a plain-language formatting menu; selecting text shows descriptive quick actions

- Quit without a save trap: Save & quit, Quit without saving, or Keep writing; cancelling Save never forces an endless dialog
- Search the entire manuscript via Ctrl/Cmd+F; match count, previous/next, replace one or all with Ctrl/Cmd+H
- Collapse subsections in Outline and jump to the previous or next top-level chapter

- Command palette: Ctrl/Cmd+Shift+P or the Commands button; search all actions by name, category or alias, then use arrows and Enter
- Timed writing sessions: set 1–180 minutes and an optional new-word target; focus mode and a quiet countdown support uninterrupted writing, followed by a gentle summary

- Export a paginated A4 PDF from the toolbar or Ctrl/Cmd+Shift+E; Markdown source stays untouched
- Open and save literal UTF-8 .txt files; choose .txt in Save as for plain text
- Five distinct palettes: Paper, Sepia, Sage, Night and Midnight
- Smart footer: characters, selection, goal, current heading, document format and save state
- Help (? or Ctrl/Cmd+/) explains files, formatting, writing preferences and shortcuts

- A soft formatting bar at the top: text style (Body, Title, Heading, Subheading), bold, italic,
  strikethrough, bullet / numbered / checklist, quote, scene break, link, undo and redo
- True WYSIWYG: type "# " for a title, "> " for a quote, "**word**" for bold, "- " for a list, "[ ] " for a checklist
- Floating bubble for quick formatting whenever you select text
- Links without pop-up dialogs: Ctrl+K opens a small inline field; "example.com" or "me@site.com" just work
- Outline panel: every heading in your manuscript, click to jump, current section highlighted
- Display settings (Aa in the footer): typeface (Editorial serif, Humanist sans, Duospace), text size,
  column width (about 60, 72 or 85 characters), spacing (Dense, Balanced, Spacious) and a word goal
- Word goal progress in the footer with a small celebration when you reach it
- Selection word count ("12 of 1,234 words selected")
- Reopens the last file you worked on, or restores your untitled draft
- Drop a .md, .markdown or .txt file onto the window to open it
- Each opened document starts with a fresh undo history
- Shortcut sheet (Ctrl+/); Esc closes whatever is open
- Focus mode: dims every paragraph except the one you are writing, with typewriter scrolling
- Middle-click autoscroll for fast travel through long manuscripts
- Five visual themes: Paper, Sepia, Sage, Night, Midnight (follows your system on first launch)
- Autosave for named files, safety-net draft for untitled writing
- Smart typography: -- becomes an em dash, quotes become curly quotes
- The top bar, status bar and scrollbar fade away while you type and return when you move the mouse or press Esc
- Typewriter line: keep the line you are typing at the middle of the window
- Zen draft: an optional first-draft mode that pauses Backspace and Delete so you keep moving forward
- Atomic saves on disk (write to temp file, then rename) so a crash never corrupts a chapter

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

## Tools for long projects

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
brings back what you had. Nothing is written to disk until you save.
Versions are kept in the app's local storage (IndexedDB, with localStorage as
a fallback), not beside your files: every ten minutes for the last hour, hourly
for a day, then daily for two weeks, up to 40 manuscripts.

**Polish typography.** Ctrl/Cmd+Shift+Q changes -- to an em dash, ... to an
ellipsis and straight quotes to curly ones across the whole manuscript, as one
undoable edit. Code and inline code are left alone. Pasted text gets the same
treatment unless you paste into code. The .md file stays ordinary Markdown with
Unicode punctuation.

## Find, chapters and quitting

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

## Focus and contextual formatting

Use Focus for paragraph emphasis, or the adjacent arrow to choose Sentence or Full screen.
Sentence focus dims words outside the current sentence; Full screen hides the app
chrome and enters native fullscreen. Press Esc or the floating Leave full screen
button to return. These are presentation modes; your document is unchanged.

At the beginning of an empty paragraph, type / to open a compact writing menu.
Choose Heading, Scene break, lists or other blocks with arrows and Enter, or
click a choice. Typing / elsewhere inserts an ordinary slash. Selecting text
shows the familiar floating bubble, now with plain-language block labels.

## Quiet screen, typewriter line and Zen draft

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

## Typography and rhythm

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

## Writing sessions

Click Session in the footer or search "session" in the command palette. Set a duration and
optionally a target for new words (not the total words in the file). A discreet countdown
remains visible while you write. Close the session dialog to keep writing; open it again
to see progress or end early. At the end you get a short summary. Switching documents
ends the current session, so a different manuscript's words never inflate its result.
Sessions do not modify, save, or export your manuscript.

## PDF preview and first-run guide

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

## Text and PDF

A .txt file opens literally: # and * remain text, not formatting instructions.
Saving a .txt writes only readable text; styles are deliberately not retained in plain text.
Save as .md to retain headings, lists and other rich formatting. PDF export produces a
separate styled, paginated file with embedded fonts and does not mark the current draft
as saved. Keep the Markdown manuscript as your editable original.

## Working directories

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

## Look and feel

All stylesheets share one polish layer (src/polish.css): a common radius, motion and
focus-ring scale, themed danger/success colours, and unified primary and secondary
buttons. Switching themes cross-fades softly; light themes carry a faint paper grain.
Dialogs, popovers, menus and toasts ease in, lists fade in gently, and the save dot
settles when your words are safe. Everything respects the system "reduce motion" setting.

## Performance

A Good Page is tuned to stay at full frame rate while you type and scroll, even in long manuscripts:

- Keystrokes do the minimum: word counts, the status line and outline are debounced; toolbar state and caret-follow run at most once per frame; the window title, storage and file list only update when the name or save state really changes.
- Untitled drafts are serialised once typing pauses (500 ms) and flushed on blur, reload and quit, never per keystroke.
- Scrolling stays on the compositor: no live blur, no filters, no scroll masks; off-screen paragraphs skip layout via `content-visibility`.
- Middle-click autoscroll (which WebView2 and WebKitGTK do not provide) is built in: click the wheel and move the pointer, or hold and drag. The wheel click never pastes on Linux.
- Release builds use `opt-level = 3`, LTO, one codegen unit and `panic = "abort"`.

## Prerequisites

- Node.js 20+
- Rust (stable) via rustup
- Tauri 2 system dependencies for your OS: https://v2.tauri.app/start/prerequisites/

## Run

    npm install
    npm run icons
    npm run tauri dev

## Save safety

Each requested save captures its document, destination, revision and contents before it
joins the write queue. Only an explicit Save As may adopt a new file path; a queued
autosave for the previous file cannot switch the manuscript back.
An explicitly discarded draft also invalidates any still-open Save As picker; if
the native picker fails, A Good Page reports the error and keeps the manuscript dirty. Edits arriving during a save remain marked unsaved, and a stale
Save As dialog cannot redirect a different document. Disk writes create exclusive,
uniquely named temporary files, sync their bytes and clean up after failures.
Confirm the save/quit regressions with the tests below before shipping.

## Close and session reliability

Closing waits for any in-flight save before deciding whether to prompt. Failed writes
remain dirty and the writer can retry, discard, or keep writing. A writing session
uses elapsed wall-clock time across laptop sleep, does not emit a second summary,
and ends quietly with a status message when switching manuscripts.

## Preview and search reliability

Page preview renders off-screen and displays only the most recently requested page;
layout changes and closing invalidate pending renders. Find and replace continues
from after inserted text, even if the replacement contains the search phrase.
Replace all remains one undoable editor transaction. Run the regression tests below.

## Open and export reliability

An Open picker or file read is ignored if the writer edits or switches manuscripts
before it finishes; the newer words remain untouched. A competing older Open
cannot replace a newer one. PDF exports now use exclusive, uniquely named
synced temporary files, avoiding a shared-temp collision during concurrent saves.
These cases have regression tests but require a local build before release.

## Keyboard and welcome-flow reliability

Existing dialogs keep Tab navigation inside the open panel and return focus to the
invoking control when closed. The welcome guide waits for a Create or Save action
to settle before allowing Skip, never advances on a failed action, and does not
auto-appear over a recovered draft or reopened manuscript. The PDF preview closes
before reporting a successful export to the guide, avoiding a double handoff.

## Test

    npm test
    cd src-tauri
    cargo test

## Build an installer

    npm run tauri build

## Releases

Version 0.1.0 is the first public release; see `CHANGELOG.md`. Earlier internal
builds went up to 0.4.0 and were renumbered. `package.json`,
`src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` must carry the same
version, which a test checks.

- `.github/workflows/ci.yml` type-checks, runs the tests and builds on every
  push and pull request, and runs `cargo fmt`, `clippy` and `cargo test` on
  Linux, macOS and Windows.
- `.github/workflows/release.yml` runs on a `v*` tag. It builds installers for
  macOS (Apple silicon and Intel), Windows and Linux with tauri-action and
  attaches them to a draft GitHub release to check before publishing.

To release: update `CHANGELOG.md`, set the version in the three files, commit,
then `git tag v0.1.0 && git push origin v0.1.0`. Installers are unsigned, so
macOS and Windows show a warning on first launch until signing secrets are
added. See `CONTRIBUTING.md` for the checks to run first, and `LICENSE` (MIT).

## Rebranding and existing data

The app is now called A Good Page. Its Tauri bundle identifier remains
`app.hearth.writer` and its `hearth.*` local-storage keys remain unchanged
so updates can still find existing drafts, display settings, and recent folders.
These are compatibility identifiers, not the name shown to writers. Do not
change them without a tested data migration. Before building a release, run
`npm run icons` to regenerate platform icons from `app-icon.svg`. Rebuild
the installer and verify a previously installed copy retains its drafts.
