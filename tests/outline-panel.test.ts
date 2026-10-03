import { describe, expect, it } from 'vitest';
import { OutlinePanel } from '../src/ui/outline';

function setup() {
  const root = document.createElement('div'); const list = document.createElement('div'); const empty = document.createElement('p');
  root.append(list, empty); document.body.append(root);
  const jumps: number[] = [];
  const panel = new OutlinePanel({ root, list, empty }, pos => jumps.push(pos));
  return { panel, list, jumps };
}
const heads = (shift = 0) => [
  { level: 1, text: 'One', pos: 1 + shift }, { level: 2, text: 'A', pos: 10 + shift },
  { level: 1, text: 'Two', pos: 30 + shift }, { level: 2, text: 'B', pos: 40 + shift },
];

describe('OutlinePanel', () => {
  it('renders a real toggle button beside the heading button, with aria-expanded only where there are children', () => {
    const t = setup(); t.panel.update(heads(), 0);
    const rows = [...t.list.querySelectorAll('.outline-row')];
    expect(rows).toHaveLength(4);
    const toggles = t.list.querySelectorAll('button.outline-toggle[aria-expanded]');
    expect(toggles).toHaveLength(2); // One and Two have children; A and B do not
    expect(t.list.querySelector('.outline-item')!.hasAttribute('aria-expanded')).toBe(false);
    expect(t.list.querySelector('.outline-toggle')!.parentElement).toBe(t.list.querySelector('.outline-item')!.parentElement);
  });
  it('keeps a section collapsed when text is typed above it', () => {
    const t = setup(); t.panel.update(heads(), 0);
    (t.list.querySelector('button[data-toggle="0"]') as HTMLButtonElement).click();
    expect(t.list.querySelectorAll('.outline-item')).toHaveLength(3);
    t.panel.update(heads(25), 0); // every position moved
    expect(t.list.querySelectorAll('.outline-item')).toHaveLength(3);
    expect(t.list.querySelector('button[data-toggle="0"]')!.getAttribute('aria-expanded')).toBe('false');
  });
  it('clicking the heading jumps; clicking the toggle does not', () => {
    const t = setup(); t.panel.update(heads(), 0);
    (t.list.querySelector('button[data-toggle="0"]') as HTMLButtonElement).click();
    expect(t.jumps).toEqual([]);
    (t.list.querySelector('.outline-item') as HTMLButtonElement).click();
    expect(t.jumps).toEqual([1]);
  });
  it('does not rebuild the list while hidden, and catches up when shown', () => {
    const t = setup(); t.panel.update(heads(), 0); t.panel.setVisible(false);
    const before = t.list.firstElementChild;
    t.panel.update([{ level: 1, text: 'Only', pos: 1 }], 0);
    expect(t.list.firstElementChild).toBe(before);
    expect(t.panel.count).toBe(1);
    t.panel.setVisible(true);
    expect(t.list.querySelectorAll('.outline-item')).toHaveLength(1);
  });
});
