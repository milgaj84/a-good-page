import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '../src/core/links';

describe('normalizeUrl', () => {
  it('returns null for empty or blank input', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
  });

  it('rejects input containing spaces', () => {
    expect(normalizeUrl('not a link')).toBeNull();
  });

  it('keeps safe absolute links', () => {
    expect(normalizeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(normalizeUrl('HTTP://example.com')).toBe('HTTP://example.com');
    expect(normalizeUrl('mailto:me@example.com')).toBe('mailto:me@example.com');
  });

  it('adds https to bare domains, including ports', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('  example.com/path ')).toBe('https://example.com/path');
    expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000');
  });

  it('turns bare email addresses into mailto links', () => {
    expect(normalizeUrl('me@example.com')).toBe('mailto:me@example.com');
  });

  it('rejects unsafe schemes', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,hi')).toBeNull();
    expect(normalizeUrl('file:///etc/passwd')).toBeNull();
  });
});
