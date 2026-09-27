import { describe, expect, it } from 'vitest';
import { toPlainText } from '../src/core/plaintext';

describe('plain text serialization', () => {
  it('preserves Markdown-looking text and empty lines', () => {
    expect(toPlainText({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '# Literal' }] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: '**word**' }] },
    ] })).toBe('# Literal\n\n**word**');
  });
  it('strips marks and uses list markers for formatted documents', () => {
    expect(toPlainText({ type: 'doc', content: [{ type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }] }] }] },
    ] }] })).toBe('- Hello');
  });
  it('accepts an empty document', () => expect(toPlainText({ type: 'doc' })).toBe(''));
});
