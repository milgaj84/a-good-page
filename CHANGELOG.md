# Changelog

All notable changes to A Good Page are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-09-27

### Fixed

- Corrected the PDF font virtual-file-system TypeScript compatibility call and PDF.js render parameters.
- Canonicalized the macOS temporary workspace test directory before symlink checks.

### Added

- Time Machine exports the selected earlier version as a separate Markdown or plain-text recovery copy without restoring it or marking the current page saved. Cancelling the dialog leaves the page alone; the currently open manuscript cannot be chosen as the destination.
- A cross-platform release checklist covers installer launch, interrupted saves, recovery after restart, the first ten minutes, keyboard focus, reduced motion and PDF export. Drafts remain unpublished until these checks pass.
- Draft installer builds wait for three-OS Rust and web verification.

### Limitations

- CI alone does not prove installers launch on macOS, Windows or Linux; builds remain unsigned. App-local Time Machine history does not replace writing-folder backups.


## [0.1.0] - 2026-09-27

First public release. Earlier internal builds were numbered up to 0.4.0; the
public version line starts again at 0.1.0. Installed copies keep their drafts
and settings because the bundle identifier (`app.hearth.writer`) and the
`hearth.*` storage keys are unchanged.

### Added

- WYSIWYG Markdown editing with TipTap. Files stay plain `.md`, and `.txt` files open and save literally.
- Formatting bar, selection bubble, `/` block menu, inline link field and a command palette (Ctrl/Cmd+Shift+P).
- Quick switcher (Ctrl/Cmd+P): fuzzy search across the chapters of the open manuscript and the documents in the working directory.
- Pinned notes: a slim, read-only panel beside the page for an outline, research or character notes. It collapses to a tab and can sit on the left or right.
- Sprint ring: a muted progress ring in the lower-left corner for a new-word goal, with a single soft glow when the goal is reached.
- Time Machine: versions kept on save, on open and every ten minutes while writing. Scrub through them with a slider labelled "2 hours ago", "Yesterday at 4 PM" and so on, then restore one as an undoable edit.
- Polish typography: one command turns `--` into an em dash, `...` into an ellipsis and straight quotes into curly quotes, leaving code untouched. Pasted text gets the same treatment.
- Workspace panel with five recent working directories, folder browsing and filtering.
- Outline panel with collapsible sections and chapter jumps; find and replace across formatting.
- Paragraph, sentence and full-screen focus; quiet screen; typewriter line; Zen draft.
- Display settings for typeface, text size, column width, spacing and a word goal.
- Timed writing sessions with a new-word target.
- Paginated A4 PDF export with a live page preview and two layouts.
- Five themes: Paper, Sepia, Sage, Night and Midnight.
- A three-step first-run guide.

### Reliability

- Atomic saves: exclusive, uniquely named temporary files, synced before rename.
- Stale Open, Save As and autosave results cannot overwrite newer words or switch the open file.
- Closing waits for in-flight saves; failed saves stay marked unsaved.

[Unreleased]: https://github.com/OWNER/a-good-page/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/OWNER/a-good-page/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/OWNER/a-good-page/releases/tag/v0.1.0
