# 0.7.1 Working with many pages acceptance

Status: staged source, not a verified installer. Complete the 0.7.0 gate first.

## Automated gate
- [ ] `npm run typecheck`, `npm test`, `npm run build`; `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` on Linux, macOS and Windows.
- [ ] All version files and the installed package report 0.7.1.

## Selecting
- [ ] The tick-box icon beside Projects turns selection on and off; Esc and Done leave it. Rows show tick boxes; a project ticks and unticks all its pages; partial ticks show a dash. Clicking a page ticks it instead of opening it.
- [ ] Move to… lists your projects and Unfiled pages and moves every ticked page (the open page stays open and saving). Trash moves them all with one Undo that restores each to its old place.
- [ ] Export with pages from one project opens the preview with exactly those pages ticked and the suggested file name "Project - N of M pages"; a mix of projects or unfiled pages explains why it cannot.

## Dragging
- [ ] Drag a page onto another project (end), between another project's pages (that place) and onto Unfiled pages; drag an unfiled page into a project. Dropping on a page's own project does nothing. Reordering inside a project still works. (Skip on Windows if the platform blocks it; the menus still work.)

## Restore in place
- [ ] Trash a page from the middle of a project, restore it from Undo and from Tools → Trash…: it returns to the same position. Trash several pages of one project and Undo: the order is as before.

## Search and welcome
- [ ] Search finds words inside projects and inside unfiled pages, quickly on the second letter, and notices a page edited elsewhere after a minute.
- [ ] "Show the welcome guide" (Ctrl/Cmd+P) opens or recreates the guide in Getting started and never overwrites an edited copy.

## Export memory
- [ ] Tick some pages, close the preview, quit and relaunch, open Export for the same project: the same pages are ticked.

## Real-window checks still open
- [ ] Everything above in the installed app on each platform; the Library folder picker; typing and scrolling in a long page on a software-rendered Linux session.
