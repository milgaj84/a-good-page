import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { FindPanel } from '../src/ui/find-panel';

function setup(html: string) {
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K) => document.createElement(tag);
  const root = mk('div'); const query = mk('input'); const replacement = mk('input');
  const checks = [mk('input'), mk('input')]; checks.forEach(c => { c.type = 'checkbox'; });
  const buttons = Array.from({ length: 6 }, () => mk('button'));
  const count = mk('span');
  root.append(query, replacement, count, ...checks, ...buttons);
  const host = mk('div'); document.body.append(root, host);
  const editor = new Editor({ element: host, extensions: [StarterKit], content: html });
  const panel = new FindPanel({ root, query, replacement, count, previous: buttons[0], next: buttons[1], one: buttons[2], all: buttons[3],
    close: buttons[4], matchCase: checks[0], wholeWord: checks[1] }, editor);
  const hits = () => [...host.querySelectorAll('.find-hit')];
  return { panel, query, host, hits, count, editor };
}

afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('FindPanel', () => {
  it('highlights every match and the current one more strongly, while focus is in the query box', () => {
    vi.useFakeTimers();
    const t = setup('<p>cat and cat and cat</p>');
    t.panel.open();
    t.query.value = 'cat'; t.query.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(130);
    expect(t.hits()).toHaveLength(3);
    expect(t.host.querySelectorAll('.find-current')).toHaveLength(1);
    t.panel.hide();
    expect(t.hits()).toHaveLength(0);
  });
  it('waits for a pause in typing before searching', () => {
    vi.useFakeTimers();
    const t = setup('<p>cat</p>');
    t.panel.open();
    t.query.value = 'c'; t.query.dispatchEvent(new Event('input'));
    t.query.value = 'cat'; t.query.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(60);
    expect(t.hits()).toHaveLength(0);
    vi.advanceTimersByTime(80);
    expect(t.hits()).toHaveLength(1);
  });
});
