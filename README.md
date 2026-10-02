# A Good Page

**More page. Less noise.**

A quiet desktop editor for writers. Format as you type, with no Markdown syntax in sight. Everything you write lives in one folder of plain `.md` or `.txt` files, saves by itself, and is never locked in. No account, no cloud.

Built with Tauri 2, Rust and TipTap. Runs on macOS, Windows and Linux.

## How it works

```
┌ Library ─────┬──────────── your page ─────────────┐
│ + New page   │  Chapter title             Saved   │
│ ▾ My Novel   │                                    │
│   01 Light…  │  (the writing, and nothing else)   │
│   02 Tide…   │                                    │
│ Loose notes  ├────────────────────────────────────┤
│ On this page │  1,240 words        Focus   Tools  │
└──────────────┴────────────────────────────────────┘
```

- **One Library.** On first launch the app creates `Documents/A Good Page`. Change it any time in Settings.
- **Nothing to save.** **New page** creates a real file at once and autosaves it. The page names itself from your first heading or line. There is no Save As, no "Untitled draft" and no folder picker.
- **Pages and books.** A page is a file. A **book** is a folder of chapters. Drag chapters into order, or use ⋯ → Move up/down. Order is kept in `.a-good-page.json` beside them.
- **Go anywhere.** **Ctrl/Cmd+P** searches pages, chapters, headings on this page and every command. Try "focus", "export" or "theme".
- **Rename, trash.** Click the title, press **F2**, or use a row's ⋯ menu. Move to trash puts things in a hidden `.trash` folder inside your Library. **Tools → Trash…** lists them and puts each back where it was. Nothing is erased.

## What's where

| You want to… | Do this |
| --- | --- |
| Start writing | **+ New page** (Ctrl/Cmd+N) |
| Start a book | **New book** (Ctrl/Cmd+Shift+N), then ⋯ → New chapter here |
| Find a page or a phrase | The sidebar search, or Ctrl/Cmd+P |
| Jump around this page | **On this page** in the sidebar |
| Change theme, type, width, goal | **Settings** (the gear), top right |
| Write without distraction | **Focus**: paragraph, sentence, typewriter line, Zen draft, full screen |
| Notes, timed session, sprint ring, typography polish | **Tools** |
| Go back to an earlier version | **History** |
| Share | **Export**: this page or the whole book, with a real-page preview |

Select text for a quick formatting bubble, or type `/` on an empty line for headings, lists and scene breaks. **Ctrl/Cmd+/** lists every shortcut.

## Your words are safe

- **History follows renames.** Renaming a page or a book keeps its earlier versions.
- **Autosave** writes to a temporary file, syncs, then renames. If a write fails, the page stays marked and says so.
- **Outside edits.** If a file changes on disk, autosave pauses and you choose: review, keep a safety snapshot and reload, save yours as a copy, or keep writing.
- **Crash recovery.** After a forced quit you can resume, save a copy, or discard. Recovery and History are local safety nets, not backups; back up your Library folder.
- **Plain files.** `.md` keeps headings, lists and links. `.txt` opens and saves as plain text. PDF export is a separate copy and never changes your page.
- **Other files.** Open a file from elsewhere, or drop one on the window. It edits in place and isn't listed in the sidebar.

## Install

Download the asset for your system from the project's GitHub **Releases** page (not a draft). You don't need Node.js or Rust to run an installer.

Builds are **unsigned**, so macOS and Windows may warn on first launch. Install only from a source you trust. Releases target macOS (Apple silicon and Intel), Windows and Linux. The maintainer has hand-tested Fedora 43 (Wayland and X11); CI passes on macOS and Windows, which isn't a hands-on test of each installer.

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

1. Update `CHANGELOG.md` and the version in those files.
2. Work through `RELEASE_0.6.0.md`, `RELEASE_0.6.1.md` and `RELEASE_CHECKLIST.md`.
3. Commit, then `git tag v0.6.1 && git push origin v0.6.1`.

CI (`.github/workflows/ci.yml`) type-checks, tests and builds on every push, and runs `cargo fmt`, `clippy` and `cargo test` on Linux, macOS and Windows. A `v*` tag runs `release.yml`, which attaches unsigned installers to a **draft** release. A green build is not proof an installer launches. See `CONTRIBUTING.md` and `LICENSE` (MIT).
