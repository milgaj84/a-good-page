const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const SAFE_SCHEMES = ['http', 'https', 'mailto'];

/**
 * Turns what a writer pastes into a safe link:
 * "example.com" -> "https://example.com", "me@site.com" -> "mailto:me@site.com".
 * Returns null for empty input, spaces, or unsafe schemes such as javascript:.
 */
export function normalizeUrl(input: string | null | undefined): string | null {
  const value = (input ?? '').trim();
  if (value.length === 0 || /\s/.test(value)) return null;
  const match = SCHEME.exec(value);
  if (match && !/^\d/.test(value.slice(match[0].length))) {
    return SAFE_SCHEMES.includes(match[1].toLowerCase()) ? value : null;
  }
  if (value.includes('@') && !value.includes('/')) return 'mailto:' + value;
  return 'https://' + value;
}
