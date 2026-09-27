import { describe, expect, it } from 'vitest';
import { layoutSpec } from '../src/export/layout';
import { pdfDocument } from '../src/export/pdf';
describe('export layouts', () => {
  it('provides two distinct A4 presentations', () => {
    const a = layoutSpec('manuscript'), b = layoutSpec('reading');
    expect(a.pageSize).toBe('A4'); expect(b.pageSize).toBe('A4');
    expect(a.margins).not.toEqual(b.margins);
    expect(a.lineHeight).toBeGreaterThan(b.lineHeight);
    expect(a.footer).toBe(false); expect(b.footer).toBe(true);
  });
  it('uses the selected layout in the actual PDF document', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Words' }] }] };
    expect(pdfDocument(doc, 'A', 'manuscript').pageMargins).toEqual(layoutSpec('manuscript').margins);
    expect(pdfDocument(doc, 'A', 'reading').pageMargins).toEqual(layoutSpec('reading').margins);
  });
  it('rejects unknown layout values rather than quietly mislabelling the export', () => {
    expect(() => layoutSpec('poster' as never)).toThrow(RangeError);
  });
});
