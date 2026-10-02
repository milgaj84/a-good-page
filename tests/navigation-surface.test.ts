import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const file = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
describe('0.3.4 calm navigation', () => {
  const html = file('index.html');
  it('keeps Save and book navigation prominent, with separately named single-page PDF', () => {
    expect(html).toContain('id="btn-save"');
    expect(html).toContain('id="btn-pdf"');
    expect(html).toContain('Page PDF');
    expect(html).toContain('id="file-more"');
    expect(html).toContain('id="writing-more"');
    expect(file('src/app/manuscript.ts')).toContain("new PlaceTabs('Places', go)");
  });
  it('preserves every existing action ID so shortcut and click wiring survive', () => {
    for (const id of ['btn-new','btn-open','btn-workspace','btn-save','btn-pdf','btn-find',
      'btn-outline','btn-focus','btn-focus-choices','btn-settings','btn-theme',
      'btn-session','btn-palette','btn-help']) {
      expect(html.match(new RegExp('id="' + id + '"', 'g'))).toHaveLength(1);
    }
  });
  it('uses native keyboard-accessible menus with explicit closing behavior', () => {
    expect(html).toContain('<details class="more-menu" id="file-more">');
    expect(html).toContain('<details class="more-menu" id="writing-more">');
    const guide = file('src/ui/project-guide.ts');
    expect(guide).toContain('attachActionMenus');
    expect(guide).toContain("event.key === 'Escape'");
    expect(guide).toContain('button.focus()');
    expect(file('src/app/manuscript.ts')).toContain('attachActionMenus()');
    const panel = file('src/ui/manuscript-panel.ts');
    expect(panel).toContain('this.selectionRoot!==this.deps.root()');
    expect(panel).toContain('this.selectionRoot=null;this.selection.clear();this.loaded=false');
    expect(panel).toContain("make('button','','Select all')");
    expect(panel).toContain("make('button','','Clear')");
  });
  it('keeps focus on the next-step action as save status changes', () => {
    expect(file('src/ui/project-guide.ts')).toContain('document.activeElement === host.querySelector');
    expect(file('src/ui/project-guide.ts')).toContain('if (wasFocused) button.focus()');
  });
});
