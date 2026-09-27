import { describe, expect, it } from 'vitest';
import { pdfDocument, renderPdf } from '../src/export/pdf';

describe('PDF layout', () => {
  it('handles empty manuscripts', () => {
    expect(pdfDocument({ type: 'doc', content: [] }, 'Empty').content).toEqual([]);
  });
  it('retains heading, emphasis, links and lists', () => {
    const doc = pdfDocument({ content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Story' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Read', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.org' } }] }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] }] },
    ] }, 'Story');
    expect(JSON.stringify(doc.content)).toContain('https://example.org');
    expect(JSON.stringify(doc.content)).toContain('First');
    expect(JSON.stringify(doc.content)).toContain('title');
  });
  it('renders a real PDF buffer for each preview layout', async () => {
    const manuscript = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A first page.' }] }] };
    for (const layout of ['manuscript', 'reading'] as const) {
      const bytes = await renderPdf(manuscript, 'First page', layout);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
      expect(bytes.length).toBeGreaterThan(100);
    }
  });
});
