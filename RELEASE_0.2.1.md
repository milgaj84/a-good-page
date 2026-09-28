# 0.2.1 — preview fidelity and stale-source acceptance

Status: changes staged in HearthCode; native CI, installers and rendered PDFs NOT verified in this workbook. Prior 0.2.0 checks do not validate 0.2.1.

## Build and source checks
- [ ] Extract the full table and run npm install, npm run typecheck, npm test and npm run build.
- [ ] In src-tauri run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Install the actual macOS, Windows and Linux assets; record commit, OS, CPU, artifact hash and result.

## Reader journey
- [ ] Compile a subset of 3+ chapters. Inventory must name selected chapters in order with per-chapter and total words; name all exclusions.
- [ ] Compare read-only view and both generated PDF layouts: chapter boundaries and one new-page start per subsequent chapter, heading hierarchy, lists, scene breaks, Unicode/curly punctuation and literal .txt lines. Confirm no duplicate leading display title and no source-file edits.
- [ ] Change a selected chapter and attempt export. Error must name the file; old pages remain visible but export disabled. Switching PDF layout must not re-enable export.
- [ ] Delete/unmount a selected chapter or change .a-good-page.json; each error must name the affected chapter or order file. Test while the native Save dialog is open too.
- [ ] Click Refresh preview. On success, included chapters, word counts, PDF pages and the inventory all update together. On read/PDF failure, old pages remain visible but unexportable; retry after fixing the source.
- [ ] Cancel the Save dialog; leave preview intact and sources untouched. Test source changing again during the refresh, keyboard access, focus restoration, reduced motion, high zoom and small screens.

Do not publish based solely on the focused source tests. Attach sample compiled PDFs and human review notes to the release draft.
