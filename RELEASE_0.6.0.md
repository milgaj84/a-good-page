# 0.6.0 Library acceptance

Status: staged source, not a verified installer. Layout and flows were exercised in a headless browser against a simulated file system only; nothing here has run in the real Tauri window yet.

## Automated gate
- [ ] `npm install`, `npm run typecheck`, `npm test`, `npm run build`.
- [ ] `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` on Linux, macOS and Windows.
- [ ] `package.json`, `Cargo.toml`, `Cargo.lock`, `tauri.conf.json` and the installed package all report 0.6.0.

## First launch (clean profile: remove app storage first)
- [ ] The Library folder `Documents/A Good Page` is created; a "Welcome to A Good Page" page opens and is listed in the sidebar.
- [ ] Nothing asks where to save. The save state reads Saved, then "Saving soon…" or "Saving…" while typing, then Saved.

## Pages and books
- [ ] **New page** (button and Ctrl/Cmd+N) creates `Untitled.md` and opens it. After typing a first heading or line, the page renames itself within a few seconds, in the sidebar, title and on disk. A page you named yourself is never renamed.
- [ ] **New book** creates a folder and opens an inline name field; Enter keeps it, Esc cancels the rename and keeps the default name.
- [ ] Row ⋯ menu (and right-click): New chapter here, Rename, Move up/down, Move to trash. Drag a chapter to reorder; the order survives a restart.
- [ ] Rename from the title field, F2 and the sidebar all rename the file; renaming a book that holds the open page keeps the page open and saving.
- [ ] Move to trash asks first, puts the item in `.trash` inside the Library, and opens the neighbouring chapter. Nothing is erased. `.trash` is not listed and not scanned as chapters.
- [ ] Search finds page names, chapter names and text inside opened books.

## Going places and exporting
- [ ] Ctrl/Cmd+P (and Ctrl/Cmd+Shift+P) finds pages, chapters, headings on this page and every command.
- [ ] Export offers This page and The whole book (disabled outside a book); book export previews real pages and refuses to export if a chapter changed on disk.

## Safety (carry over from earlier releases)
- [ ] Outside edits, conflict review, named recovery after a forced quit, History (Time Machine) and quit-with-unsaved-words behave as in 0.1.x.
- [ ] Renaming a page detaches its History (versions are keyed by path); confirm this is acceptable before release.
- [ ] A draft left by an older version becomes a "Recovered draft" page.
- [ ] Open a file from elsewhere and drag a file onto the window: it opens and saves in place, outside the Library.

## Look and feel
- [ ] Sidebar, top bar, bottom bar, settings drawer, Focus and Tools menus in all five themes; narrow window (about 400 px) with the sidebar sliding over the page; reduced motion; keyboard-only; screen reader.
- [ ] On a software-rendered Linux session, typing and scrolling feel smooth with a long chapter open.

No project order file format, manuscript format, storage key or app identifier changes. Existing `.a-good-page.json` book order files are read as before.
