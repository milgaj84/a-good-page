import { describe, expect, it } from 'vitest';
import { SLASH_ACTIONS, shouldOpenSlash } from '../src/ui/slash-menu';
import { EDITOR_COMMANDS } from '../src/core/commands';
describe('contextual writing actions', () => {
  it('opens only for slash in an empty paragraph, never in ordinary prose', () => {
    expect(shouldOpenSlash('/', 1, 1, 'paragraph', 0)).toBe(true);
    expect(shouldOpenSlash('/', 4, 4, 'paragraph', 3)).toBe(false);
    expect(shouldOpenSlash('/', 1, 3, 'paragraph', 0)).toBe(false);
    expect(shouldOpenSlash('/', 1, 1, 'heading', 0)).toBe(false);
    expect(shouldOpenSlash('a', 1, 1, 'paragraph', 0)).toBe(false);
  });
  it('offers plain-language heading, list, quote and scene break', () => {
    for (const name of ['Heading', 'Scene break', 'Bullet list', 'Quote'])
      expect(SLASH_ACTIONS.some(item => item.label === name)).toBe(true);
  });
  it('maps every item to a real editor command and has no duplicates', () => {
    expect(new Set(SLASH_ACTIONS.map(item => item.command)).size).toBe(SLASH_ACTIONS.length);
    SLASH_ACTIONS.forEach(item => expect(EDITOR_COMMANDS).toContain(item.command));
  });
});
