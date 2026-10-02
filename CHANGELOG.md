# Changelog

All notable changes to A Good Page are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.2] - 2026-10-02

Simpler, with fewer decisions between you and the page.

### Added

- **The formatting bar is back**, as a quiet strip under the title: H1 H2 H3, bold, italic, strikethrough, bullet, numbered and checklist, quote, scene break, link, undo and redo. Buttons show what is active at the caret and fade with the other bars while you type. Show or hide it in Settings → More options, or with "Show or hide the formatting bar" in the go-to box. The selection bubble and `/` menu stay.
- **Next chapter** link at the end of a chapter, naming the chapter that follows.
- **It remembers where you were.** Each page reopens at your caret and scroll position, also after a restart, and a rename keeps the memory. A page you have not opened yet is ready to type at its end.
- **Undo for trash.** Moving a page, chapter or book to the trash happens at once and shows an Undo button for several seconds. The Trash view still restores anything later.

### Changed

- **One start button.** "+ New page" is one click; a ▾ beside it holds "New book" (Ctrl/Cmd+Shift+N still works). Moving to the trash no longer asks first.
- **Find, History and Export are icons** (magnifier, clock, arrow) with tooltips, leaving the title and save state as the only words on top.
- **"On this page" appears only once the page has headings.**
- **Readable names.** A chapter file named after its heading ("03-a-letter-unsent") shows the heading ("A Letter Unsent") in the sidebar, the title and the go-to box; a name you chose yourself is shown as it is, with the file name in the tooltip. Renaming still edits the file name.
- **Settings regrouped:** Theme, Text (typeface, size), Distraction-free (fade bars, typewriter, Zen), Goal, and one collapsed "More options" (column width, spacing, formatting bar, Library folder, shortcuts).

### Fixed

- The editor no longer jumps to the end of the page a moment after launch: its delayed `autofocus` could fire after a page had loaded.

## [0.6.1] - 2026-10-02

### Fixed

- **Renaming no longer loses History.** Earlier versions of a page move with it when it is renamed, including by the automatic naming of a new page. Renaming a book moves the History of every chapter inside it. Versions already at the new name are merged, never replaced.

### Added

- **Trash, with Restore.** Tools → Trash… (or "Open the trash" in the go-to box) lists everything moved to the trash, newest first, with where it came from. Restore puts it back in its original place, recreating the book if needed, and opens it if it is a page. Nothing is ever overwritten: a name clash restores under a new name. The trash now remembers each item's original location (`.trash/<time>/` with a short `origin.txt` note).
- Rust commands `list_trash` and `restore_entry`, both confined to the Library's own `.trash`.

### Measured

- Typing in a 3,000-word chapter cost about 2 ms per key with no long tasks, even with the CPU slowed 4×, and scrolling did almost no layout work, so the page's scripts are not a bottleneck. Painting on a software-rendered session could not be measured outside the real window.

### Known limits

- A restored chapter returns to its book but is added at the end of the chapter order.
- Trash is not emptied automatically; delete the `.trash` folder yourself to reclaim space.

## [0.6.0] - 2026-10-02

The writing app was rebuilt around one idea: a **Library**. Everything lives in one folder, saves by itself, and is reached from one sidebar.

### Changed

- **No more saving or choosing locations.** On first launch the app creates `Documents/A Good Page`. New pages are real files from the moment you press New page; there is no "Untitled draft", Save As or Open step. The page names itself from your first heading or line, once, and only while it still has its placeholder name. Save stays available (Ctrl/Cmd+S) as "save now".
- **One sidebar for everything you can open.** Pages and books (folders of chapters) with live word counts, search across names and the text of opened books, and "On this page" headings beneath. Chapters reorder by drag or Move up/down and keep their order in `.a-good-page.json`. Rename inline, from the title, or with F2. Move to trash keeps items in a hidden `.trash` folder inside the Library and never erases anything.
- **Chapters · Write · Share is gone.** Export is one button: this page or the whole book, with a real-page preview that rechecks the chapters on disk before exporting.
- **One box to go anywhere.** Ctrl/Cmd+P (and Ctrl/Cmd+Shift+P) searches pages, chapters, headings on this page and every command. The old quick switcher is merged into it.
- **A calmer top and bottom.** Title (the file name) and plain save words on top with Find, History, Export and Settings; word count with Focus and Tools below. Focus holds paragraph, sentence, typewriter line, Zen draft and full screen. Tools holds notes, writing session, sprint goal and typography polish. Themes, type, goals and the Library folder live in one Settings drawer. Everything stays reachable by shortcut and from the go-to box.
- The formatting bar is replaced by the quick bubble on selection, the `/` menu and shortcuts. The first-run guide is replaced by a short Welcome page in your Library. New shortcuts: Ctrl/Cmd+Shift+N (new book), F2 (rename), Ctrl/Cmd+\ now shows or hides the sidebar.
- Styles rebuilt as three lean sheets (19 removed): no grain overlay, scroll masks, blur or blend modes, and fewer shadows and animations, to help software-rendered Linux sessions.

### Added

- Rust commands `default_library`, `create_entry`, `rename_entry` and `trash_entry`. Each re-validates the path against the Library root and refuses symlinks; hidden (dot) items are no longer listed.
- An unsaved untitled draft from an older version is kept as a "Recovered draft" page.

### Removed

- The Chapters, Write and Share screens, the share overview and next-step card, project health and relink dialogs, the workspace panel, the formatting toolbar, the writing guide and the quick switcher window. Per-chapter include/exclude for PDF export is gone: whole-book export includes every readable chapter in order.

### Known limits

- Renaming a page detaches its History, because versions are keyed by path.
- Files opened from outside the Library (Open, drag and drop) are edited in place and are not listed in the sidebar.
- Layout and flows were verified in a headless browser against a simulated file system, not yet in an installed app; see `RELEASE_0.6.0.md`.

## [0.5.0] - 2026-10-02

### Fixed (staged; not yet installer-verified)

- Small windows: the page grid no longer grows wider than the window, so Save, More, the formatting bar and every footer button stay on screen. The top and footer bars wrap, and their More menus are no longer clipped.
- The Outline and Browse files panels make room beside the page on wide windows instead of covering the first words. On narrow windows, panels start below the wrapped bars.
- Chapters and Share without a book folder show only the Choose book folder card: no empty bordered boxes, no duplicate message, no search box, and focus lands on the main button. Panels fit their content, and their header and place switcher fit phone widths.
- The shortcut sheet opens at its title instead of scrolled to the bottom, and Show writing guide and Close stay visible while it scrolls.
- Display settings checkboxes are spaced and sized for easier targets. Browse files keeps its heading on one line and hides the empty Recent folders label. The sprint ring no longer sits on the word count on phones.

### Changed

- README rewritten to be shorter and scannable: one-screen pitch, Chapters · Write · Share table, feature table, condensed file-safety summary, install and build steps. The release steps now push the matching `v0.5.0` tag.

### Verification required

- Source checks cover the stylesheet wiring and rules. Layout was inspected in a headless browser at 1280 and 390 px wide only; installed-app checks on all themes and platforms remain pending; see `RELEASE_0.5.0.md`.

## [0.4.0] - 2026-10-01

### Added (staged; not yet installer-verified)

- Share now has a live book-PDF overview showing the number of readable chapters selected, their combined word count and the next safe stage: choose, repair, read, refresh or export. The overview does not estimate PDF pages or claim that cached chapter text is current.
- Read it through verifies the selected chapters and project order against disk before assembling a reading view. Concurrent selection changes invalidate a pending result; verification failures clear stale reading content and direct the writer to Refresh chapters. Export and PDF-preview rechecks remain in place.

### Verification required

- Pure overview tests cover empty, blocked, selected and preview states; project-service tests cover content and read failures before compilation. Full web/Rust builds, suite runs, installer launches and real PDF inspection remain pending; see `RELEASE_0.4.0.md`.


## [0.3.5] - 2026-10-01

### Changed (staged; not yet installer-verified)

- Chapter titles now do one predictable thing per place: in Chapters they open the file; in Share they label the Include checkbox and toggle PDF inclusion without leaving Share. Checkboxes are hidden in Chapters.
- Returning to Share from Write redraws rows for that place without discarding a same-book selection or preview. A different book still reloads.
- Share shows a short instruction above the chapter list. An unavailable chapter stays unselectable; a no-op selection change does not discard a compiled preview.

### Verification required

- Source regression checks cover contextual row controls and switching places. Full TypeScript/Vitest/Rust tests and installed-app keyboard, screen-reader and PDF checks remain pending; see `RELEASE_0.3.5.md`.


## [0.3.4] - 2026-10-01

### Changed (staged; not yet installer-verified)

- One primary Chapters · Write · Share path remains visible. The top bar keeps Save prominent and moves New page, Open file, Browse files and Page PDF into a labeled More menu. The footer retains Find, Outline, Focus and typography settings; session, theme, commands and help move to its More menu. No command or shortcut is removed.
- Explicit Page PDF versus the book PDF in Share avoids two actions named Export PDF. Both menus close on selection, outside click or Escape, and remain keyboard focusable.
- The Chapters next-step button now focuses a chapter title rather than returning to the page without selecting anything. The next-step button retains focus during save-state updates.
- Returning to a loaded book keeps its chapter selection and reading view until explicitly refreshed or changed. Share adds Select all and Clear for long books; inaccessible chapters are never selected.
- In-app help leads with the three-step path and uses concise recovery guidance.

### Verification required

- Source checks cover action IDs, menu behavior and the Chapters action; full TypeScript/Vitest/Rust checks, installed-app keyboard/screen-reader review, narrow layouts and theme inspection remain pending. See `RELEASE_0.3.4.md`.


## [0.3.3] - 2026-10-01

### Fixed (staged; not yet installer-verified)

- Before opening whole-book PDF pages from either Share entry point, recheck the compiled selection against chapter files and project order on disk. If a source changed, block the stale preview and guide the writer to Refresh pages.
- Keep the existing export-time checks before and after the native Save dialog; prevent duplicate preview-opening requests while a recheck is running.

### Verification required

- Regression tests cover changed chapter content and order at the preflight boundary. Full app builds, tests, installer launch and hands-on preview checks remain pending; see `RELEASE_0.3.3.md`.


## [0.3.2] - 2026-10-01

### Fixed (staged; not yet installer-verified)

- The Share step indicator blocks Export PDF while the open chapter is dirty, saving, or has a failed save; it returns to current after a successful save.
- Existing disk and source rechecks still guard the actual export.

### Verification required

- Regression cases cover dirty, saving, failed and saved states. Full builds, tests and installed-app checks remain pending; see `RELEASE_0.3.2.md`.


## [0.3.1] - 2026-10-01

### Fixed (staged; not yet installer-verified)

- Share keeps an explicitly unticked chapter selection when the same book is refreshed; it no longer silently reticks every chapter.
- Changing book folders starts a fresh readable-chapter selection, even when relative chapter names happen to match.
- Cancelling Change book folder leaves the current book and selection untouched.

### Verification required

- Source-level regression cases cover empty selection, refreshed selection and another folder with a matching relative path. Full TypeScript/Vitest/Rust checks and installed-app testing remain pending; see `RELEASE_0.3.1.md`.

## [0.3.0] - 2026-09-28

### Changed

- **Three stable places: Chapters · Write · Share.** The app is reorganised around choosing a book, picking a chapter, writing and sharing. Tabs in the top bar and on the project page switch places; Ctrl/Cmd+Shift+1/2/3 do the same. Esc and **Back to writing** always return to the page.
- **Chapters** gathers finding, ordering, opening, refresh, the read-only health check, relink and a new **Change book folder** button. Opening Chapters no longer pops up a folder picker by surprise; the next-step card offers it.
- **Share** shows three steps, *Choose chapters → Read it through → Export PDF*, each marked done, current, to do or blocked. "Compile selected chapters" is now **Read it through**; "Preview whole PDF" is **See PDF pages**.

### Added

- **Next-step card.** One suggestion at a time, most urgent first: a failed save, choosing a book folder, fixing missing chapters, naming an untitled draft, saving before sharing, refreshing changed pages, or simply keep writing. It never acts on its own.
- **Places in the command palette and shortcut sheet.** Search for "Chapters", "Write" or "Share your book" in Ctrl/Cmd+Shift+P; the All shortcuts list (Ctrl/Cmd+/) shows Ctrl/Cmd+Shift+1/2/3.
- **Save state in words** beside the title: Saved, Saving soon, Saving…, Not saved yet, Kept on this device, or Save failed · press Save.

### Preserved

- No file format, manifest, storage key or app identifier changed. Guarded saves, conflict review, outside-change notices, eight-record named recovery, Save As refusal, Time Machine, manifest limits, symlink rejection, compile blockers, explicit relink, read-only health and stale-export rechecks behave as in 0.2.3.

### Verification

- New workflow tests (12) and updated palette/keymap tests ran against the workbook code in an isolated harness. Full TypeScript/Rust CI, installer launch and hands-on usability checks remain release gates for 0.3.0; see `RELEASE_0.3.0.md`.

## [0.2.3] - 2026-09-28

### Added

- **Project health check.** A read-only rescan reports missing, unreadable, empty and newly discovered untracked chapters with paths and suggested next steps. It shows readable/total chapter counts and word count without changing prose or project order.
- **Clear readiness signal.** Missing or unreadable chapters remain compilation blockers; empty and newly discovered chapters are advisories, not automatic exclusions or relinks.

### Fixed

- **Health checks no longer save the manifest.** Refresh chapters can append newly found files when safe, but Check project health reports them without writing `.a-good-page.json`. Reorder, relink and remove actions refresh the health display after a successful guarded change.

### Verification

- Focused project-health and project-service tests were run against the workbook code. Full TypeScript/Rust CI, installer launch and multi-chapter PDF inspection remain release gates for 0.2.3.


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

[Unreleased]: https://github.com/OWNER/a-good-page/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/OWNER/a-good-page/compare/v0.2.2...v0.2.3
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
