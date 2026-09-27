import { describe, expect, it } from 'vitest';
import { THEME_KEY, ThemeManager, isTheme, type Theme } from '../src/core/theme';
import { SafeStore, type StorageLike } from '../src/adapters/storage';

class MapStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

const broken: StorageLike = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('quota'); },
  removeItem: () => { throw new Error('denied'); },
};

describe('ThemeManager', () => {
  it('defaults to paper, or night when the system prefers dark', () => {
    expect(new ThemeManager(new SafeStore(new MapStorage()), false).theme).toBe('paper');
    expect(new ThemeManager(new SafeStore(new MapStorage()), true).theme).toBe('night');
  });

  it('restores a saved theme over the system preference', () => {
    const backend = new MapStorage();
    backend.setItem(THEME_KEY, 'sepia');
    expect(new ThemeManager(new SafeStore(backend), true).theme).toBe('sepia');
  });

  it('ignores a corrupted saved value', () => {
    const backend = new MapStorage();
    backend.setItem(THEME_KEY, 'neon');
    expect(new ThemeManager(new SafeStore(backend), false).theme).toBe('paper');
  });

  it('cycles through all themes and persists the choice', () => {
    const backend = new MapStorage();
    const themes = new ThemeManager(new SafeStore(backend), false);
    expect(themes.next()).toBe('sepia');
    expect(themes.next()).toBe('sage');
    expect(themes.next()).toBe('night');
    expect(themes.next()).toBe('midnight');
    expect(themes.next()).toBe('paper');
    expect(backend.getItem(THEME_KEY)).toBe('paper');
  });

  it('rejects unknown themes', () => {
    const themes = new ThemeManager(new SafeStore(new MapStorage()), false);
    expect(() => themes.set('neon' as Theme)).toThrow(RangeError);
  });

  it('keeps working when storage throws', () => {
    const themes = new ThemeManager(new SafeStore(broken), false);
    expect(themes.theme).toBe('paper');
    expect(themes.next()).toBe('sepia');
  });

  it('isTheme guards non-strings', () => {
    expect(isTheme(null)).toBe(false);
    expect(isTheme(3)).toBe(false);
    expect(isTheme('night')).toBe(true);
    expect(isTheme('sage')).toBe(true);
    expect(isTheme('midnight')).toBe(true);
  });
});
