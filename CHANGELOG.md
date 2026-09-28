# Changelog

All notable changes to A Good Page are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.2] - 2026-09-28

### Added

- **Relink missing chapters.** Choose an unused writing file inside the project; inspect its path, title, word count and excerpt before explicitly replacing the missing entry in place. Suggestions rank matching filenames but never auto-link.
- **Portable project-order repair.** Relative chapter paths continue to work after moving a project folder intact to another location.

### Changed

- Unreadable, already-used, or unsafe replacement paths are not offered. A project-order edit made in another app or changes to the selected replacement during review stop the relink and preserve the original missing entry.
- The repair dialog supports keyboard selection, Escape to cancel, and refreshing suggestions after a failed save.

### Verification

- Focused relink and portability tests are run against the code table. Full app CI, Rust formatting/tests and installer-level relink checks remain required for this version.


## [0.2.1] - 2026-09-28

### Improved

- Compiled preview lists included chapters in export order, per-chapter words, exclusions and selected total.
- Export errors identify the changed or unreadable chapter or project-order file. Stale pages remain visible but cannot be exported, including after switching PDF layouts.
- Refresh preview stages fresh chapters and PDF bytes before replacing the old view; failed refresh preserves the old unexportable pages.
- PDF compilation removes a leading H1–H3 display title only once, keeps later headings and preserves literal .txt source. Added chapter-boundary, Unicode, list and scene-break tests.
- Recheck sources before and after the native Save dialog; a stale source cannot be silently exported.

### Verification

- Focused source tests are not a substitute for the full app build, Rust checks, actual installer launch or inspecting the generated multi-chapter PDF. Record those results before tagging.


## [0.2.0] - 2026-09-28

### Added

- Whole-manuscript project panel with chapter order, title/word-count list, project outline and search across the selected workspace.
- Portable `.a-good-page.json` order manifest with guarded writes. Chapter files are never moved or renamed by reordering.
- Read-only combined preview and paginated A4 whole-manuscript PDF preview/export using the existing PDF engine.
- Missing/unreadable chapter and incomplete scan blockers, and disk/manifest rechecks before PDF export, including after choosing the destination.

### Limits and verification

- Project scan: four subfolder levels, 200 folders, 200 chapters. Search presents the first 100 matching lines with a full result count. No automatic merge, cloud sync or edits to chapter sources.
- Focused project tests are run locally against this workbook; full TypeScript/Rust builds, CI and actual installer checks are pending for 0.2.0.


## [0.1.6] - 2026-09-28

This release hardens local recovery for writers who move between several manuscripts. Recovery records remain separate from the editable files and are never silently discarded to make room for another draft.

### Added

- **Recovery for up to eight named manuscripts.** The local recovery store keeps separate unsaved drafts and refuses a ninth record rather than evicting earlier writing without consent.
- **Migration from 0.1.5.** An existing single-manuscript recovery record is carried into the multi-manuscript store without dropping its words or disk baseline.
- **Individual startup review.** Each recovered manuscript is presented separately, so choosing what to do with one draft does not resolve or erase another.

### Changed

- **More reliable capture timing.** Each edit restarts the typing-pause timer; pending named-file words are also flushed before document content changes, when the window loses focus, and during a normal close.
- **Independent postponed drafts.** Leaving one recovery decision for later does not prevent a different named manuscript from being protected.
- **Deliberate cleanup.** A confirmed save or recovery-copy export clears only the matching record. Explicit Discard removes that record; merely opening a file or closing the recovery dialog does not.

### Fixed

- **Damaged or unavailable storage fails safely.** Invalid paths, text, and timestamps are rejected. Damaged current or legacy data is not overwritten, and failed write-back, full storage, or quota errors prompt a warning instead of a false claim that recovery succeeded.
- **Cancelled recovery exports keep the draft.** Cancelling or failing the Save a copy dialog retains the recovered words without repeatedly reopening the picker. Selecting the original manuscript as the copy destination is rejected.
- **Outside edits remain protected on Resume.** The disk file is checked again before resuming. If it has diverged, the outside version remains on disk and autosave stays paused until the writer resolves the conflict.

**Verification:** Focused recovery tests were run locally against the code table. Full TypeScript and Rust CI, plus installed-app force-quit and restart checks, remained required for 0.1.6; previously reported green CI results applied to earlier versions.

## [0.1.5] - 2026-09-28

### Added

- Named-file crash recovery: a verified, debounced local record of unsaved words and their disk baseline. Restart offers explicit review, resume, separate copy or discard; Escape retains the record.
- Outside edits remain on disk when a recovered draft is resumed; autosave stays paused. Missing/unreadable files can be exported as a separate copy without recreating the original.
- Focused tests for recovery storage failures, delayed writes, startup choices and disk divergence.

### Limitations

- The local recovery slot holds one named manuscript; it is not a backup. A crash inside the 500 ms debounce window can lose the last keystrokes. Full 0.1.5 CI and installer checks must be rerun; earlier reported green results concerned 0.1.3.


## [0.1.4] - 2026-09-28

### Added

- Read-only check of the open file on window focus and manual Workspace refresh, with a persistent, specific notice for changed, missing, or unreadable files. No automatic reload or dialog stacking.
- Review checks disk contents again before Reload or Save a copy; a changed disk version cancels the stale choice. Save a copy suggests a distinct filename and still refuses an occupied destination.
- Queued autosaves remain paused after a detected conflict; explicit Save continues to recheck disk contents.

### Fixed

- Synchronized the 0.1.3 Rust test-helper fix: unique atomic test counter, canonical macOS temporary directory, and distinct test filenames. Maintainer reported commit e051a37 and green CI run 36386040057 for that earlier release; this workbook has not rerun 0.1.4 CI.

### Limitation

- Disk probes and writes are separate operations; other applications do not participate in a cross-process lock. Keep backups. Installer and hardware verification of these 0.1.4 changes remains pending.


## [0.1.3] - 2026-09-28

### Changed

- Conflict dialog names the affected file, distinguishes a file that cannot be read from an occupied copy destination, and labels Reload as keeping a safety snapshot first.
- Already queued autosaves stop once a conflict is found; deliberate Save still rechecks disk contents.
- Linux startup defaults to disabling WebKitGTK DMABUF rendering on affected desktops; an explicitly set environment value is respected. macOS and Windows startup are unchanged.

### Verification

- Focused source-level checks and conflict scenarios can be run from this code table; a full application build, Rust checks and installer launch must be repeated after extracting these 0.1.3 changes. Maintainer-reported earlier CI results are not 0.1.3 results.


## [0.1.2] - 2026-09-28

### Added

- Protected saves compare the on-disk manuscript with the version last opened or saved. If it changed or disappeared, the writer sees both versions before choosing Reload, Save my version as a copy, or Keep writing. Reload first preserves the current draft in local Time Machine; if preservation fails, the page stays put. Autosave pauses after a conflict.
- Paragraph-level comparison highlights differences without sending writing to a service. Save As refuses to replace an already-existing destination.
- Tests cover outside changes, deletion, explicit reload, a separate copy and a competing Save As destination.

### Notes

- The app compares content immediately before writing; other applications do not participate in its process lock, so simultaneous cross-app writes are not a fully atomic compare-and-swap.
- The 0.1.1 hands-on installer checks remain pending until performed on actual machines.


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

[Unreleased]: https://github.com/OWNER/a-good-page/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/OWNER/a-good-page/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/OWNER/a-good-page/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/OWNER/a-good-page/compare/v0.1.6...v0.2.0
[0.1.6]: https://github.com/OWNER/a-good-page/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/OWNER/a-good-page/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/OWNER/a-good-page/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/OWNER/a-good-page/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/OWNER/a-good-page/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/OWNER/a-good-page/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/OWNER/a-good-page/releases/tag/v0.1.0
