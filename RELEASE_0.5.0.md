# 0.5.0 Interface fixes acceptance

Status: staged source, not a verified installer. Complete the 0.3.x and 0.4.0 release gates first.

## Automated gate
- [ ] Run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Confirm package.json, Cargo.toml, tauri.conf.json and the installed package all report 0.5.0.

## Small windows (about 390 px and 600 px wide)
- [ ] No horizontal scroll. Save, More, Chapters/Write/Share, the whole formatting bar (scrolls inside itself) and Find, Outline, Focus, Aa, More are reachable.
- [ ] Both More menus open fully on screen and close on selection, outside click and Escape.
- [ ] Outline, Browse files and pinned notes start below the top bars and do not cover them.

## Side panels (wide window)
- [ ] Opening Outline or Browse files moves the page aside; the first words are never covered. Closing restores the column.

## Project pages
- [ ] With no book folder: Chapters and Share show only the Choose book folder card, with focus on its button; nothing empty is drawn.
- [ ] After choosing a folder: search, tools, chapter list, health and Share steps return, and Share overview counts are unchanged.
- [ ] At phone width the heading, Back to writing and the place switcher fit without clipping.

## Sheets and settings
- [ ] Shortcuts opens at the top; Show writing guide and Close stay visible while scrolling; Esc closes.
- [ ] Display settings checkboxes are easy to hit. Browse files heading stays on one line and shows no empty Recent folders label.
- [ ] Repeat in Paper, Sepia, Sage, Night and Midnight, with reduced motion on, and with a screen reader.

No project manifest, manuscript file format, storage key or app identifier migration is intended.
