// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('0.5.0 interface fixes', () => {
  const css = file('src/ui-fixes.css');
  it('loads last so it wins the cascade', () => {
    const sheets = file('src/stylesheets.ts').trim().split('\n');
    expect(sheets[sheets.length - 1]).toBe("import './ui-fixes.css';");
  });
  it('keeps the page grid inside the window and never clips the More menus', () => {
    expect(css).toContain('.app { grid-template-columns: minmax(0, 1fr); }');
    expect(css).toMatch(/\.actions, \.toggles \{ overflow: visible/);
  });
  it('makes room for side panels instead of covering the page', () => {
    expect(css).toContain('body:has(.outline.is-open) .scroller');
    expect(css).toContain('body:has(.workspace-panel.is-open) .scroller');
  });
  it('shows only the next step on project pages without a book folder', () => {
    expect(css).toContain('.manuscript-panel[data-folder="none"]');
    const panel = file('src/ui/manuscript-panel.ts');
    expect(panel).toContain("this.root.dataset.folder=this.deps.root()?'set':'none'");
    expect(panel).toContain("place==='share'||!this.deps.root()?this.next.querySelector('button'):this.query");
  });
  it('opens the shortcut sheet at its title', () => {
    expect(file('src/ui/help.ts')).toContain("querySelector('.sheet')?.scrollTo(0, 0)");
    expect(css).toContain('.help-footer { position: sticky;');
  });
});
