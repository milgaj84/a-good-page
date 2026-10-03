# 0.8.0 Security and speed acceptance

Status: staged source, not a verified installer. This release changes how the app reaches your files, so **run this checklist in the installed app on every platform** before publishing.

## Automated gate
- [ ] `npm run typecheck`, `npm test`, `npm run build`; `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` on Linux, macOS and Windows.
- [ ] All version files and the installed package report 0.8.0.

## First launch after updating (use a profile that has a custom Library folder)
- [ ] A native question appears: "Keep using this folder as your Library?" showing the folder. "Keep using it" opens that Library as before; "Choose another" falls back to `Documents/A Good Page`. With the default folder there is no question.
- [ ] A second launch asks nothing and opens the same Library. `access.json` exists in the app's config folder and lists the Library.

## Everything that picks a place still works (native dialogs open from Rust)
- [ ] Open a file from elsewhere (Ctrl/Cmd+O), edit it, quit and relaunch: it reopens at launch.
- [ ] Save a copy somewhere else (Ctrl/Cmd+Shift+S) and keep editing it.
- [ ] Drag a `.md` file from the file manager onto the window: it opens (on Windows, check this one carefully).
- [ ] Change Library folder from the sidebar and from Settings; pick a recent folder from the menu.
- [ ] Export PDF, Word and Markdown (each opens a save dialog, saves, and the file opens in its program).
- [ ] Choose a backup folder, back up, restore a backup. Export a History version as a copy.
- [ ] Cancelling any dialog changes nothing and shows no error.

## Refusals (these should fail safely)
- [ ] Rename/move your `access.json` away, relaunch: the Library question appears again; nothing outside the chosen folder is reachable.
- [ ] Open a Library page through a symlink that points outside the Library: it is refused.
- [ ] Create a named pipe called `x.md` in a project folder (Linux/macOS: `mkfifo x.md`) and refresh: the app does not hang.
- [ ] Click a link inside a page: nothing happens, one explanation appears, and the app stays put with unsaved words intact.

## Content policy and permissions
- [ ] The installed app shows no blank panels or missing styles (a CSP problem would show as unstyled menus or a blank PDF preview); PDF preview, Word export, selection bubble, settings and the command box all work.

## Speed
- [ ] On a computer with no graphics acceleration (or a VM), Settings → Visual effects says Light is in use, and typing and scrolling in a long page feel smooth; switching to Full makes fades return.
- [ ] Startup is visibly quicker than 0.7.3; opening a project of 100+ pages shows its pages promptly.
- [ ] First Export takes a moment to open (the PDF code loads once); later exports are immediate.
