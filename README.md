# A Good Page

**More page. Less noise.**

A quiet desktop editor for writers. Format as you type, with no Markdown syntax in sight. Everything you write lives in one folder of plain `.md` or `.txt` files, saves by itself, and is never locked in. No account, no cloud.

Built with Tauri 2, Rust and TipTap. Runs on macOS, Windows and Linux.

## How it works

```
┌ Library ─────┬──────────── your page ─────────────┐
│ + New page ▾ │  Page title      Saved   ≡ ⌕ ◷ ⇧ ⚙ │
│ PROJECTS   + │                                    │
│ ▾ My Novel   │  (the writing, and nothing else)   │
│    Light…    │                                    │
│    Tide…     │                                    │
│ ▸ Essays     ├────────────────────────────────────┤
│ UNFILED      │  1,240 words        Focus   Tools  │
└──────────────┴────────────────────────────────────┘
```

- **One Library.** On first launch the app creates `Documents/A Good Page`. Click **Library** at the top of the sidebar to switch to any other folder or a recent one.
- **It remembers where you were.** Each page reopens at your caret and scroll position, and a page you haven't opened yet is ready to type at its end.
- **Nothing to save.** **New page** creates a real file at once and autosaves it. The page names itself from your first heading or line. There is no Save As, no "Untitled draft" and no folder picker.
- **Library → projects → pages.** The Library is your working folder. A **project** is a folder in it (a novel, an essay, a set of notes) with one or many `.md` or `.txt` pages. The **+** beside Projects starts one with a first page; the **+** on a project adds a page. Drag pages into order, or use ⋯ → Move up/down. Pages that sit outside any project are listed under **Unfiled pages**, and ⋯ → Move to puts them in a project. Order is kept in `.a-good-page.json` inside the project.
- **Working with many pages.** Click the tick-box icon beside *Projects* to **select** several pages, then move, export or trash them together. Drag a page onto another project, between its pages, or onto *Unfiled pages*. The sidebar search looks inside every page of every project, including unfiled ones.
- **Find and replace across pages.** **Ctrl/Cmd+Alt+F** (or *All pages…* in Find) searches every page of a project or the whole Library, shows each match with what it would become, lets you tick which to change, and keeps a version of each page in History. Undo puts it all back.
- **Backups.** *Settings → Library → Backups* makes a zip of your Library (only your writing files and project order, never the trash) on demand or every day or week, keeps the newest few, and can **restore** one next to your current work without overwriting it.
- **Bring a book in.** Drop a Word (`.docx`) file on the window, or use **New ▾ → Import a Word document…**: each Heading 1 becomes a page of a new project, with bold, italic, headings, lists and links kept. **Import a folder of pages…** copies a folder of `.md` or `.txt` files into a project. Your original files are never changed.
- **Set up the page your way.** **Settings** (the sliders icon, top right) is four short tabs: **Look** (colours, letters, line length and spacing, book-style indent), **Writing** (spell-check, language, word goal), **Focus** and **Library** (folder, backups, speed). The language you set is also used in Word and e-book exports.
- **Export as PDF, Word, E-book or Markdown.** Add a **title page** (title, subtitle, author), a **contents**, and page numbers; the PDF preview shows exactly what you will get.
- **Export follows your projects.** Export a single page, or a project in page order, and **tick just the pages you want** (All / None / individual). Use ⋯ → **Export project…** on a project or ⋯ → **Export this page…** on a page. Word counts, search, Ctrl+P and History all work across the same structure.
- **Go anywhere.** **Ctrl/Cmd+P** searches pages and every command. The **contents** button (top right) lists the headings on this page. Try "focus", "export" or "theme".
- **Rename, trash.** Click the title, press **F2**, or use a row's ⋯ menu. Move to trash happens at once with an **Undo** button (a restored page returns to its old position), and puts things in a hidden `.trash` folder inside your Library. **Tools → Trash…** lists them and puts each back where it was. Nothing is erased.

## What's where

| You want to… | Do this |
| --- | --- |
| Start writing | **+ New page** (Ctrl/Cmd+N) |
| Start a project | The **+** beside Projects, or ▾ → **New project** (Ctrl/Cmd+Shift+N) |
| Add a page to a project | The **+** on the project |
| Format | The bar under the title: headings, bold, italic, lists, quote, link. Hide it in Settings |
| Carry on to the next page | The **Next chapter** link at the end of a page |
| Find a page or a phrase | The sidebar search, or Ctrl/Cmd+P |
| Jump around this page | The **contents** button, top right (Ctrl/Cmd+Shift+O) |
| Change theme, type, width, goal | **Settings** (the sliders icon), top right |
| Write without distraction | **Focus**: paragraph, sentence, typewriter line, Zen draft, full screen |
| Notes, timed session, sprint ring, typography polish | **Tools** |
| Go back to an earlier version | **History** (the clock, top right) |
| Find on the page | The magnifier, top right (Ctrl/Cmd+F) |
| Share | **Export** (the arrow, top right): this page or a project as **PDF, Word, E-book (EPUB) or Markdown**, with a title page and contents if you like, and a real-page preview |

Select text for a quick formatting bubble, or type `/` on an empty line for headings, lists and scene breaks. **Ctrl/Cmd+/** lists every shortcut.

## Your words are safe

- **History follows renames.** Renaming a page or a project keeps its earlier versions.
- **Fast on any computer.** Heavy parts (PDF and Word export) load only when you export; projects load their pages several at a time; and on a computer that draws the window in software, fades, shadows and animations switch off by themselves (*Settings → Library → Speed*).
- **Autosave** writes to a temporary file, syncs, then renames. If a write fails, the page stays marked and says so.
- **Outside edits.** If a file changes on disk, autosave pauses and you choose: review, keep a safety snapshot and reload, save yours as a copy, or keep writing.
- **Crash recovery.** After a forced quit you can resume, save a copy, or discard. Recovery and History are local safety nets, not backups; back up your Library folder.
- **Plain files.** `.md` keeps headings, lists and links. `.txt` opens and saves as plain text. PDF export is a separate copy and never changes your page.
- **Other files.** Open a file from elsewhere, or drop one on the window. It edits in place and isn't listed in the sidebar.

## Security and privacy

- **Nothing leaves your computer.** There is no account, no cloud, no analytics, and the app is not allowed to contact the internet.
- **The app only touches what you chose.** Your Library folder, the backup folder, and files you opened, saved or dropped on the window. Every file and folder picker runs in the app's trusted core, which remembers your choices and refuses any other path, including `..` and symlink tricks.
- **The window cannot be sent elsewhere.** Links do not open, and nothing can replace the app with another page.
- **Content is treated as text.** Raw HTML in a page is shown as text, unsafe link addresses are dropped, and a strict content policy blocks scripts from anywhere but the app itself.
- **Writes are careful.** Saves go to a temporary file and are renamed into place; special files such as named pipes are refused; backups and restores check every path, size and checksum and never overwrite.

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
2. Work through `RELEASE_CHECKLIST.md` in the installed app on each platform.
3. Commit, then `git tag v0.8.3 && git push origin v0.8.3`.

CI (`.github/workflows/ci.yml`) type-checks, tests and builds on every push, and runs `cargo fmt`, `clippy` and `cargo test` on Linux, macOS and Windows. A `v*` tag runs `release.yml`, which attaches unsigned installers to a **draft** release. A green build is not proof an installer launches. See `CONTRIBUTING.md` and `LICENSE` (MIT).
