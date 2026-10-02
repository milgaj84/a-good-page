# 0.7.2 Better exports acceptance

Status: staged source, not a verified installer. Complete the 0.7.0 and 0.7.1 gates first.

## Automated gate
- [ ] `npm run typecheck`, `npm test`, `npm run build`; `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` on Linux, macOS and Windows.
- [ ] All version files and the installed package report 0.7.2.

## Formats
- [ ] Export a page and a project as PDF, Word and Markdown. Each saves with the right extension, refuses a wrong one, and the save dialog's suggested name is the page or project name (with "N of M pages" for a partial project).
- [ ] **Open the .docx in Microsoft Word and in LibreOffice**: headings appear in the navigation pane; bold, italic, links, lists (each numbered list starts at 1), quotes and scene breaks look right; each chapter starts on a new page; the footer shows page numbers; File → Properties shows the title and author.
- [ ] The .md file opens in a text editor with the words exactly as written.

## Title page, contents, page numbers
- [ ] Title page: PDF, Word and Markdown each show the title (defaults to the page or project name; the typed title wins), subtitle and author. The title page has no page number.
- [ ] Contents: the PDF lists chapters and headings with correct page numbers; Word lists titles; Markdown links jump to the headings.
- [ ] Page numbers off removes them from PDF and Word. The format, toggles and author are remembered after a restart; the title and subtitle start empty for the next export.

## Dialog
- [ ] The preview updates when you change options (text fields after a short pause); switching to Word or Markdown shows the hint and disables Layout; the button reads Export PDF / Word / Markdown.
- [ ] On a short window the controls scroll and the preview stays usable; keyboard-only use works; a screen reader announces the fields.

## Real-window checks still open
- [ ] The save dialogs on each platform, and a very large project (hundreds of pages) for speed and memory.
