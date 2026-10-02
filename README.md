# A Good Page

**More page. Less noise.**

A quiet desktop editor for writers. Format as you type, with no Markdown syntax in sight. Your work stays in plain `.md` or `.txt` files, with no account and no cloud.

Built with Tauri 2, Rust and TipTap. Runs on macOS, Windows and Linux.

## Why it feels different

- **The page comes first.** The bars fade while you type. Add paragraph or sentence focus, a typewriter line, full screen, five themes and adjustable type.
- **Books, not just files.** Pick a folder and work chapter by chapter. Reorder, search every chapter, relink moved files, then read the whole book through and export one PDF.
- **Momentum without a scoreboard.** A quiet sprint ring, timed sessions and an optional word goal.
- **A way back.** Autosave, crash recovery and Time Machine versions. Outside edits never overwrite you silently.
- **Share clean.** Polish dashes and quotes, preview the real A4 pages, export. Your Markdown stays the original.

## Chapters · Write · Share

One path, always in the top bar: **choose your book, pick a chapter, write, share.**

| Place | Shortcut | What it does |
| --- | --- | --- |
| **Chapters** | Ctrl/Cmd+Shift+1 | Lists your book folder in reading order. Click a title to open it. Search, reorder, refresh, check project health, relink missing files. |
| **Write** | Ctrl/Cmd+Shift+2 | The page itself. Esc returns here from anywhere. |
| **Share** | Ctrl/Cmd+Shift+3 | Tick chapters, then *Read it through* and *Export PDF*. A live overview shows chapters and words selected. |

A **next-step card** names the one thing to do now, with one button. The save dot has words too: *Saved*, *Not saved yet*, *Save failed · press Save*.

**Safety.** Chapter order lives in a portable `.a-good-page.json`. The scan covers four folder levels, 200 folders and 200 chapters. Missing chapters block Share. Health checks are read-only. Export rechecks your files before and after the Save dialog. If a source changed, it blocks until you refresh.

## Quick start

1. Open the app and start typing. An optional guide covers new page, save and PDF.
2. Click **Chapters** and choose your book folder, or just save a single page as `.md`.
3. Click **Share** to read the book through and export a PDF. Ctrl/Cmd+P jumps to any chapter or heading.

The top bar keeps **Save** in view. **More** holds New page, Open file, Browse files and Page PDF. The footer keeps Find, Outline, Focus and Aa. Its **More** holds sessions, themes, commands and help.

## Features

| Need | Use |
| --- | --- |
| Write without distraction | Quiet screen, paragraph or sentence focus, full screen, typewriter line, Zen draft |
| Find your place | Outline, Find and replace, Quick switcher (Ctrl/Cmd+P), command palette (Ctrl/Cmd+Shift+P) |
| Keep research close | Pinned read-only notes beside the page (Ctrl/Cmd+Shift+R) |
| Stay in motion | Sprint ring (Ctrl/Cmd+Shift+A), timed writing session, word goal |
| Recover work | Autosave, named recovery records, Time Machine (Ctrl/Cmd+Shift+I) |
| Tidy typography | Polish dashes, ellipses and quotes in one undoable edit (Ctrl/Cmd+Shift+Q) |
| Make it yours | Aa: typeface, size, column width (60/72/85 characters), spacing, word goal |
| Share pages | Page PDF or book PDF, in Manuscript or Reading copy layout |

Type `/` in an empty paragraph for a block menu. Select text for a floating format bubble. Press **Ctrl/Cmd+/** for every shortcut.

### Common shortcuts (Cmd on macOS)

    Ctrl + N / O / S          New / Open / Save
    Ctrl + Shift + S          Save as
    Ctrl + Shift + E          Export page PDF
    Ctrl + F / H              Find / Find and replace
    Ctrl + B / I / K          Bold / Italic / Link
    Ctrl + Alt + 0..3         Body / Title / Heading / Subheading
    Ctrl + Shift + F / U / G  Paragraph / Sentence / Full-screen focus
    Ctrl + Shift + O          Outline
    Ctrl + Shift + L          Change theme
    Ctrl + Shift + T / D      Typewriter line / Zen draft
    Ctrl + Shift + M / K / Y  Column width / Spacing / Typeface
    Ctrl + = / - / 0          Bigger / smaller / reset text
    Ctrl + /                  All shortcuts
    Esc                       Close panels, leave focus mode

## Your files and your work

- **Plain files.** `.md` keeps headings, lists and links. `.txt` opens literally and saves as plain text. PDF is a separate copy and never marks your draft saved.
- **Autosave with care.** Named files autosave. Saves write to a temporary file, sync, then rename. If a write fails, the page stays marked unsaved. Untitled drafts are kept locally.
- **Crash recovery.** Up to eight named recovery records are kept locally after typing pauses. After a restart you can Resume, Save as a copy, or Discard. The disk file is never replaced automatically.
- **Outside edits.** If a chapter changes on disk, autosave pauses and you choose: Review changes, Keep safety snapshot & reload, Save my version as a copy, or Keep writing. Save As refuses to overwrite an existing file.
- **Time Machine.** Local versions are kept on open, on save and every ten minutes. Preview one, restore it as a single undoable edit, or export it as a separate file.
- **Quitting.** With unsaved words you can Save & quit, Quit without saving, or Keep writing.

Recovery and Time Machine are local safety nets, not backups. Back up your writing folder.

## Install

Open the project's GitHub **Releases** page and download the asset for your system. Don't use a draft release. You don't need Node.js or Rust to run an installer.

Builds are **unsigned**, so macOS and Windows may warn on first launch. Install only from a source you trust.

**Platforms.** Releases are set up for macOS (Apple silicon and Intel), Windows and Linux. The maintainer has hand-tested Fedora 43 (Wayland and X11), and CI passes on macOS and Windows. That isn't a hands-on test of each installer.

**Linux.** WebKitGTK DMABUF rendering is off by default to avoid blank windows on some Wayland desktops. An existing `WEBKIT_DISABLE_DMABUF_RENDERER` setting is respected.

## Build from source

Needs Node.js 20+, stable Rust and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

    npm install
    npm run icons
    npm run tauri dev      # run
    npm run tauri build    # installer

## Test

    npm run typecheck
    npm test
    cd src-tauri && cargo test

## Releasing

`package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` must share one version, and a test checks it.

1. Update `CHANGELOG.md` and the version in those three files.
2. Work through `RELEASE_0.5.0.md` and the earlier release checklists.
3. Commit, then `git tag v0.5.0 && git push origin v0.5.0`.

CI (`.github/workflows/ci.yml`) type-checks, tests and builds on every push, and runs `cargo fmt`, `clippy` and `cargo test` on Linux, macOS and Windows. A `v*` tag runs `release.yml`, which attaches unsigned installers to a **draft** release. A green build is not proof an installer launches. See `CONTRIBUTING.md` and `LICENSE` (MIT).
