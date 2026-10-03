import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  MAX_GOAL,
  MAX_SIZE,
  MIN_SIZE,
  PREFS_KEY,
  PreferencesStore,
  clampSize,
  sanitizeGoal,
  sanitizePrefs,
} from '../src/core/prefs';
import type { KeyValueStore } from '../src/core/ports';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  get(key: string) { return this.data.get(key) ?? null; }
  set(key: string, value: string) { this.data.set(key, value); }
  remove(key: string) { this.data.delete(key); }
}

describe('clampSize', () => {
  it('keeps valid sizes and rounds fractions', () => {
    expect(clampSize(20)).toBe(20);
    expect(clampSize(18.6)).toBe(19);
  });

  it('clamps to the allowed range', () => {
    expect(clampSize(5)).toBe(MIN_SIZE);
    expect(clampSize(99)).toBe(MAX_SIZE);
    expect(clampSize(-10)).toBe(MIN_SIZE);
  });

  it('falls back to the default for non-numbers', () => {
    expect(clampSize(Number.NaN)).toBe(DEFAULT_PREFS.size);
    expect(clampSize('22')).toBe(DEFAULT_PREFS.size);
    expect(clampSize(undefined)).toBe(DEFAULT_PREFS.size);
  });
});

describe('sanitizeGoal', () => {
  it('turns empty, zero, negative and invalid values into no goal', () => {
    expect(sanitizeGoal(0)).toBe(0);
    expect(sanitizeGoal(-5)).toBe(0);
    expect(sanitizeGoal(Number.NaN)).toBe(0);
    expect(sanitizeGoal(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitizeGoal('')).toBe(0);
    expect(sanitizeGoal('many')).toBe(0);
    expect(sanitizeGoal(null)).toBe(0);
  });

  it('accepts numeric strings and floors fractions', () => {
    expect(sanitizeGoal('750')).toBe(750);
    expect(sanitizeGoal(1234.9)).toBe(1234);
  });

  it('caps absurdly large goals', () => {
    expect(sanitizeGoal(MAX_GOAL * 10)).toBe(MAX_GOAL);
  });
});

describe('sanitizePrefs', () => {
  it('returns defaults for null or non-objects', () => {
    expect(sanitizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs('nope')).toEqual(DEFAULT_PREFS);
  });

  it('replaces invalid fields individually', () => {
    const result = sanitizePrefs({ font: 'comic', width: 'huge', toolbar: 'yes', size: 22 });
    expect(result.font).toBe('serif');
    expect(result.width).toBe('medium');
    expect(result.toolbar).toBe(true);
    expect(result.size).toBe(22);
  });

  it('keeps a fully valid object', () => {
    const valid = {
      font: 'mono', size: 18, width: 'wide', rhythm: 'spacious', goal: 500, toolbar: false, outline: true, ghost: false, typewriter: true, effects: 'light', spellcheck: false, lang: 'en-GB', indent: true,
    };
    expect(sanitizePrefs(valid)).toEqual(valid);
  });

  it('keeps balanced spacing by default and rejects unknown rhythms', () => {
    expect(DEFAULT_PREFS.rhythm).toBe('balanced');
    expect(sanitizePrefs({ rhythm: 'dense' }).rhythm).toBe('dense');
    expect(sanitizePrefs({ rhythm: 'airy' }).rhythm).toBe('balanced');
    expect(sanitizePrefs({ rhythm: 2 }).rhythm).toBe('balanced');
  });

  it('loads preferences saved before spacing existed', () => {
    const old = { font: 'sans', size: 22, width: 'narrow', goal: 0, toolbar: true, outline: false, ghost: true, typewriter: false };
    expect(sanitizePrefs(old)).toEqual({ ...old, rhythm: 'balanced', effects: 'auto', spellcheck: true, lang: '', indent: false });
  });

  it('fades the bars by default and leaves the typewriter line off', () => {
    expect(DEFAULT_PREFS.ghost).toBe(true);
    expect(DEFAULT_PREFS.typewriter).toBe(false);
  });

  it('ignores non-boolean ghost and typewriter values', () => {
    const result = sanitizePrefs({ ghost: 'no', typewriter: 1 });
    expect(result.ghost).toBe(true);
    expect(result.typewriter).toBe(false);
  });
});

describe('PreferencesStore', () => {
  it('starts with defaults when nothing is saved', () => {
    expect(new PreferencesStore(new MemoryStore()).prefs).toEqual(DEFAULT_PREFS);
  });

  it('loads saved preferences', () => {
    const store = new MemoryStore();
    store.set(PREFS_KEY, JSON.stringify({ font: 'sans', size: 24 }));
    const prefs = new PreferencesStore(store).prefs;
    expect(prefs.font).toBe('sans');
    expect(prefs.size).toBe(24);
  });

  it('survives corrupted JSON', () => {
    const store = new MemoryStore();
    store.set(PREFS_KEY, '{not json');
    expect(new PreferencesStore(store).prefs).toEqual(DEFAULT_PREFS);
  });

  it('persists sanitized updates', () => {
    const store = new MemoryStore();
    const prefs = new PreferencesStore(store);
    const result = prefs.update({ size: 100, goal: 1000 });
    expect(result.size).toBe(MAX_SIZE);
    expect(result.goal).toBe(1000);
    expect(JSON.parse(store.get(PREFS_KEY) ?? '{}').size).toBe(MAX_SIZE);
    expect(new PreferencesStore(store).prefs.goal).toBe(1000);
  });

  it('returns copies that cannot mutate internal state', () => {
    const prefs = new PreferencesStore(new MemoryStore());
    const copy = prefs.prefs;
    copy.size = 27;
    expect(prefs.prefs.size).toBe(DEFAULT_PREFS.size);
  });
});

describe('writing preferences', () => {
  it('defaults to spell-check on, no indent, and the system language', () => {
    expect(sanitizePrefs(null)).toMatchObject({ spellcheck: true, indent: false, lang: '' });
  });
  it('keeps a valid language and drops anything else', () => {
    expect(sanitizePrefs({ lang: 'en-GB' }).lang).toBe('en-GB');
    expect(sanitizePrefs({ lang: 'sr' }).lang).toBe('sr');
    for (const bad of ['english', 'en_GB', '<b>', 5, null, 'x'.repeat(40)]) expect(sanitizePrefs({ lang: bad }).lang).toBe('');
    expect(sanitizePrefs({ spellcheck: 'no', indent: 1 })).toMatchObject({ spellcheck: true, indent: false });
  });
});
