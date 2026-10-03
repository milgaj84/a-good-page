import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';

function render(markdown: string): string {
  const element = document.createElement('div');
  const editor = new Editor({ element, extensions: [StarterKit, Link.configure({ openOnClick: false, autolink: false }), Markdown.configure({ html: false, linkify: false })], content: markdown });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

describe('what a page can make a link do', () => {
  it('keeps ordinary links', () => {
    expect(render('[site](https://example.com/a?b=1)')).toContain('href="https://example.com/a?b=1"');
    expect(render('[mail](mailto:me@example.com)')).toContain('href="mailto:me@example.com"');
  });
  it('never produces a link that runs script or opens a local file', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'vbscript:x', 'data:text/html,<script>1</script>', 'file:///etc/passwd']) {
      const html = render('[click](' + bad + ')');
      expect(html.toLowerCase(), bad).not.toMatch(/href="\s*(javascript|vbscript|data|file):/);
    }
  });
  it('does not let raw HTML in a page become real elements', () => {
    const html = render('<img src=x onerror=alert(1)> <script>alert(1)</script> <a href="javascript:alert(1)">x</a>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html.toLowerCase()).not.toMatch(/<a [^>]*href="javascript:/);
    expect(html).toContain('&lt;img'); // shown as plain text, never as an element
  });
});
