// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const config = JSON.parse(file('src-tauri/tauri.conf.json'));
const csp: string = config.app.security.csp;
const directive = (name: string): string => (csp.split(';').map(d => d.trim()).find(d => d.startsWith(name + ' ')) ?? '');

describe('content security policy', () => {
  it('allows scripts from the app only, and no plugins, frames, forms or base changes', () => {
    expect(directive('script-src')).toBe("script-src 'self'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'none'");
    expect(directive('form-action')).toBe("form-action 'none'");
    expect(directive('frame-src')).toBe("frame-src 'none'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
  });
  it('never allows eval or remote code, and cannot fetch anything from the internet', () => {
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/https?:\/\/(?!ipc\.localhost)/);
    expect(csp).not.toContain('*');
    expect(directive('connect-src')).toBe('connect-src ipc: http://ipc.localhost');
    expect(directive('img-src')).not.toMatch(/https?:/);
    expect(directive('default-src')).toBe("default-src 'self'");
  });
  it('allows inline styles only for the editor\'s own injected stylesheet, which cannot load anything remote', () => {
    expect(directive('style-src')).toContain("'unsafe-inline'");
    expect(directive('font-src')).toBe("font-src 'self' data:");
  });
});

describe('what the window may ask the system to do', () => {
  const permissions: string[] = JSON.parse(file('src-tauri/capabilities/default.json')).permissions;
  it('has no file-system or shell permissions, and opens no pickers of its own', () => {
    for (const p of permissions) expect(p, p).not.toMatch(/^(fs|shell|http|opener|process|os):/);
    expect(permissions).not.toContain('dialog:default');
    expect(permissions).not.toContain('dialog:allow-open');
    expect(permissions).not.toContain('dialog:allow-save');
  });
  it('keeps the window locked to the app and created in Rust so navigation can be checked', () => {
    expect(config.app.windows[0].create).toBe(false);
    const lib = file('src-tauri/src/lib.rs');
    expect(lib).toContain('.on_navigation(navigation_allowed)');
    expect(lib).toContain('"tauri" => true');
    expect(config.app.withGlobalTauri).not.toBe(true);
  });
});

describe('the page does not hold the keys', () => {
  const sources = (dir: string): string[] => readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? sources(dir + '/' + e.name) : e.name.endsWith('.ts') ? [dir + '/' + e.name] : []));
  it('opens no file or folder picker from the page', () => {
    for (const path of sources('src')) {
      const text = file(path);
      expect(text, path).not.toMatch(/from '@tauri-apps\/plugin-dialog'.*\b(open|save)\b/);
    }
    expect(file('src/adapters/tauri.ts')).toContain("import { ask } from '@tauri-apps/plugin-dialog'");
  });
  it('never writes HTML from text or runs code from strings', () => {
    for (const path of sources('src')) {
      const text = file(path).split('\n').filter(l => !l.includes('ICONS') && !l.includes('constant markup')).join('\n');
      expect(text, path).not.toMatch(/\.innerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/);
    }
  });
  it('checks every path in Rust against what you chose', () => {
    const commands = file('src-tauri/src/commands.rs');
    for (const name of ['open_document', 'save_document', 'guarded_save_document', 'probe_document', 'export_pdf', 'export_document', 'list_workspace', 'open_workspace_file', 'create_backup', 'restore_backup', 'create_entry', 'trash_entry'])
      expect(commands, name).toMatch(new RegExp('pub (async )?fn ' + name + '[\\s\\S]*?access\\.(file|library_dir|library_root|granted_dir)'));
    expect(file('src-tauri/src/lib.rs')).toContain('commands::pick_save_file');
  });
});
