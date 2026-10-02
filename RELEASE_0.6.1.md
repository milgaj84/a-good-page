# 0.6.1 History and trash acceptance

Status: staged source, not a verified installer. Complete the 0.6.0 gate first.

## Automated gate
- [ ] `npm run typecheck`, `npm test`, `npm run build`; `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` on Linux, macOS and Windows.
- [ ] All version files and the installed package report 0.6.1.

## History follows renames
- [ ] Write in a page, wait for a saved version (or use History), rename the page from the title, from F2 and from the sidebar: History still lists the earlier versions.
- [ ] Let a new page rename itself from its first heading: its first words stay in History.
- [ ] Rename a book that contains pages: open a chapter and check its History still lists earlier versions.

## Trash
- [ ] Move a loose page and a chapter to the trash. Tools → Trash… lists both, newest first, with where each came from.
- [ ] Restore the chapter: it returns to its book (even if the book folder was removed in between) and opens. Restore a loose page: it returns to the Library.
- [ ] Create a new page with the same name as a trashed one, then restore the trashed one: both survive; the restored one gets a numbered name.
- [ ] The trash is never listed in the sidebar and its pages are not counted as chapters. Esc closes the dialog; keyboard focus returns to the page.

## Real-window checks still open from 0.6.0
- [ ] Typing and scrolling stay smooth in a long chapter on a software-rendered Linux session. (Headless numbers: about 2 ms per key; painting could not be measured.)
