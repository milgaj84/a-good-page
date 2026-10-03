# 0.7.3 Many pages and backups acceptance

Status: staged source, not a verified installer. Complete the earlier 0.7.x gates first.

## Automated gate
- [ ] `npm run typecheck`, `npm test`, `npm run build`; `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` on Linux, macOS and Windows (the new `flate2` crate must build on all three).
- [ ] All version files and the installed package report 0.7.3.

## Find and replace in many pages
- [ ] Ctrl/Cmd+Alt+F, the go-to box and Find → *All pages…* open the dialog; it starts on *This project* inside a project and on *The whole Library* elsewhere.
- [ ] Matches are listed by page with line and context; Match case, Whole words (with accented words), unticking one match, one page, Tick none/all and the count on the button all behave.
- [ ] Replace changes only ticked matches, leaves the rest of every page byte for byte as it was, and a page edited in another program after the search is skipped and named.
- [ ] The open page changes in the editor: Ctrl+Z undoes it, autosave saves it, no conflict notice appears. Other pages show the change after a refresh and have an earlier version in History.
- [ ] The Undo button after replacing restores every page (skipping any changed since).

## Backups
- [ ] Back up now creates `<Library> backup <date time>.zip` in `<Library> backups` beside the Library (or the folder you chose); the zip opens in the system's archive tool with your projects, pages and order files, and no trash or hidden files.
- [ ] Choosing a folder inside the Library, or one containing it, is refused with a clear message.
- [ ] Automatic backups: set Every day, relaunch after a day (or change the system date): a backup appears; only the newest 7 remain; a failing folder warns once.
- [ ] Restore: pick a backup; its projects arrive as "Name (restored)" next to your own; nothing is overwritten; a damaged or foreign zip is refused without changes.

## Real-window checks still open
- [ ] Folder and file pickers on each platform; speed of a large Library (thousands of pages) for search and backup; a locked or read-only backup folder.
