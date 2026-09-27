import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('A Good Page branding', () => {
  it('uses the same public name across its app entry points', () => {
    expect(file('index.html')).toContain('<title>A Good Page</title>');
    expect(file('src-tauri/tauri.conf.json')).toContain('"productName": "A Good Page"');
    expect(file('src-tauri/tauri.conf.json')).toContain('"title": "A Good Page"');
    expect(file('README.md')).toMatch(/^# A Good Page/m);
  });
  it('keeps package and Rust library references consistent', () => {
    expect(JSON.parse(file('package.json')).name).toBe('a-good-page');
    expect(file('src-tauri/Cargo.toml')).toContain('name = "a-good-page"');
    expect(file('src-tauri/Cargo.toml')).toContain('name = "a_good_page_lib"');
    expect(file('src-tauri/src/main.rs')).toContain('a_good_page_lib::run()');
  });
  it('uses a page rather than the old flame on the source icon', () => {
    const icon = file('app-icon.svg');
    expect(icon).toContain('<svg');
    expect(icon).toContain('id="page"');
    expect(icon).not.toContain('id="flame"');
  });
  it('preserves installed app identity and existing draft and preference keys', () => {
    expect(file('src-tauri/tauri.conf.json')).toContain('"identifier": "app.hearth.writer"');
    expect(file('src/adapters/storage.ts')).toContain("'hearth.draft'");
    expect(file('src/core/prefs.ts')).toContain("'hearth.prefs'");
  });
});
