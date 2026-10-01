import { describe, expect, it } from 'vitest';
import { PALETTE_ITEMS, searchPalette } from '../src/core/palette';
import { APP_ACTIONS, EDITOR_COMMANDS } from '../src/core/commands';
describe('command search', () => {
  it('shows all actions for an empty query without duplicates', () => {
    expect(searchPalette('')).toHaveLength(PALETTE_ITEMS.length);
    expect(new Set(PALETTE_ITEMS.map(x => x.action)).size).toBe(PALETTE_ITEMS.length);
  });
  it('ranks label prefixes over aliases and supports multiword searches', () => {
    expect(searchPalette('heading')[0].label).toBe('Heading');
    expect(searchPalette('pdf')[0].action).toBe('exportPdf');
    expect(searchPalette('writing timer')[0].action).toBe('session');
  });
  it('returns empty results for a miss and retains original order on ties', () => {
    expect(searchPalette('zzz no match')).toEqual([]);
    expect(searchPalette('size').map(x => x.action)).toContain('bigger');
  });
  it('finds the long-project tools by everyday words', () => {
    expect(searchPalette('jump chapter')[0].action).toBe('switcher');
    expect(searchPalette('versions')[0].action).toBe('timeMachine');
    expect(searchPalette('curly quotes')[0].action).toBe('polish');
    expect(searchPalette('pin notes')[0].action).toBe('reference');
    expect(searchPalette('ring').map(x => x.action)).toContain('sprint');
    expect(searchPalette('book folder')[0].action).toBe('chapters');
    expect(searchPalette('share your book')[0].action).toBe('share');
    expect(searchPalette('back to the page')[0].action).toBe('writePage');
  });
  it('only lists dispatchable actions', () => {
    PALETTE_ITEMS.forEach(x => expect([...APP_ACTIONS, ...EDITOR_COMMANDS]).toContain(x.action));
  });
});
