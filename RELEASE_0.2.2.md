# 0.2.2 chapter relink acceptance

Status: source changes staged in HearthCode. Full TypeScript/Rust CI, installer launch and real project repair have NOT been verified for 0.2.2.

## Build and release gate
- [ ] Extract every code row; run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Test the actual installers. Record commit, OS, architecture, package hash, tester and result.

## Project repair checks
- [ ] Rename or move a chapter within the chosen folder. Missing entry blocks compilation; Relink chapter shows old path and suggestions with title, words and excerpt.
- [ ] Test two similarly named replacements. Neither is chosen automatically. Keyboard navigation, Escape and Cancel leave the manifest unchanged.
- [ ] Confirm an unused candidate. Its path replaces the old entry in the same position; no chapter file is renamed, moved or rewritten. Reopen the project and confirm order persists.
- [ ] Select a candidate already used elsewhere, outside the workspace, through a symlink or with an unsafe path. Each must be rejected.
- [ ] Edit the candidate during review; relink must fail and preserve the missing entry. Change .a-good-page.json before confirmation; the guarded write must reject it.
- [ ] Make a candidate unreadable or remove it. Refresh suggestions; no partial or silent repair.
- [ ] Move the entire project folder to a different path or computer. Relative manifest paths resolve to the same chapters; PDF preview still has correct order.
- [ ] After relink, recompile and export. Confirm title, words, chapter boundaries, disk rechecks, Unicode and unchanged source files. Verify at narrow widths, high zoom and with a screen reader.

Keep a separate backup of the chapter folder and .a-good-page.json. Suggestions are hints, not proof of identity.
