# 0.7.0 Projects and the Library panel acceptance

Status: staged source, not a verified installer. Complete the 0.6.x gates first.

## Automated gate
- [ ] `npm run typecheck`, `npm test`, `npm run build`; `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` on Linux, macOS and Windows.
- [ ] All version files and the installed package report 0.7.0.

## The panel
- [ ] Projects and Unfiled pages have headings, folder and page icons, and readable names (nothing cut off by controls). Hovering a row shows its actions in place of the count; keyboard focus shows them too.
- [ ] The + beside Projects and ▾ → New project (Ctrl/Cmd+Shift+N) create a project with a first page, open it, and put the name in an editable field: type, Enter, and you are writing. Esc keeps "New project".
- [ ] The + on a project adds a page to it and opens it; New page adds to the project you are in, or to Unfiled pages when you are not in one.
- [ ] An empty Library shows the welcome card with Create your first project.
- [ ] Search finds project names, page names and text inside opened projects.

## Projects and pages
- [ ] A project with one page and a project with many both open, search, export and show word counts correctly.
- [ ] ⋯ → Move to lists the other projects (and Unfiled pages for a page inside a project). The open page stays open and keeps saving after a move; History and your place come with it; a name clash is numbered, never overwritten.
- [ ] Projects cannot be moved into each other or into the trash folder; nothing can be moved outside the Library.
- [ ] Export offers This page and The whole project (disabled for an unfiled page); the whole project exports every readable page in order and refuses if a page changed on disk.
- [ ] Pages left in the Library root by earlier versions appear under Unfiled pages. The first launch of a clean profile creates "Getting started" with the Welcome page.

## Choosing what to export
- [ ] Export → The whole project lists every page ticked, with a summary of pages and words; All, None and single ticks update the preview and its page count; None shows "Tick at least one page" and cannot export.
- [ ] A project's ⋯ → Export project… works even when the open page is in another project (This page is then unavailable); a page's ⋯ → Export this page… opens it and previews just that page. A PDF of 3 ticked pages contains only those pages, in project order, and refuses if a ticked file changed on disk.

## Library folder
- [ ] Clicking Library (top of the panel) offers Choose another folder…, recent folders and the default folder. Switching keeps unsaved words, opens the new folder's first page, and shows its name at the top; an empty folder shows the welcome card and creates nothing.

## Contents
- [ ] The Contents button appears only on pages with headings, lists them, jumps to one and closes; Esc and clicking elsewhere close it.

## Real-window checks still open
- [ ] Everything above in the installed app, in all themes, at a narrow window width (sidebar slides over the page), with the keyboard only and with a screen reader.
- [ ] Typing and scrolling stay smooth in a long page on a software-rendered Linux session.
