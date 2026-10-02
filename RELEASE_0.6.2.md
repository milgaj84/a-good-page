# 0.6.2 Simpler writing acceptance

Status: staged source, not a verified installer. Complete the 0.6.0 and 0.6.1 gates first.

## Automated gate
- [ ] `npm run typecheck`, `npm test`, `npm run build`; `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` on Linux, macOS and Windows.
- [ ] All version files and the installed package report 0.6.2.

## Formatting bar
- [ ] H1/H2/H3, bold, italic, strikethrough, lists, checklist, quote, scene break, link, undo and redo each work in one click, and show active at the caret.
- [ ] The bar fades while typing and returns on mouse move; Settings → More options and the go-to box hide and show it; it is hidden in full screen.

## Fewer steps
- [ ] "+ New page" is one click; the ▾ offers New book. Moving to trash is immediate with Undo; Undo restores to the original place; Tools → Trash… still works afterwards.
- [ ] Find, History and Export icons have tooltips and accessible names; keyboard focus rings are visible.
- [ ] "On this page" is hidden for a page with no headings and appears after the first heading.
- [ ] A chapter file named after its heading shows the heading in the sidebar, title and go-to box; renaming it edits the file name; a differently named file shows its own name.
- [ ] The Next chapter link appears only at the end of a chapter that has a following chapter, and opens it at the top.

## Where you were
- [ ] Scroll, then switch pages and come back: caret and scroll return. Quit and relaunch: same. A page opened for the first time puts the caret at its end, ready to type.
- [ ] Renaming a page keeps its remembered place. No jump to the end a moment after launch.

## Real-window checks still open from 0.6.0
- [ ] Typing and scrolling stay smooth in a long chapter on a software-rendered Linux session.
