import type { KeyValueStore } from './ports';

export const THEMES = ['paper', 'sepia', 'sage', 'night', 'midnight'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  paper: 'Paper',
  sepia: 'Sepia',
  sage: 'Sage',
  night: 'Night',
  midnight: 'Midnight',
};

export const THEME_KEY = 'hearth.theme';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export class ThemeManager {
  private current: Theme;

  constructor(
    private readonly store: KeyValueStore,
    prefersDark: boolean,
  ) {
    const saved = store.get(THEME_KEY);
    this.current = isTheme(saved) ? saved : prefersDark ? 'night' : 'paper';
  }

  get theme(): Theme {
    return this.current;
  }

  set(theme: Theme): void {
    if (!isTheme(theme)) throw new RangeError('Unknown theme: ' + String(theme));
    this.current = theme;
    this.store.set(THEME_KEY, theme);
  }

  next(): Theme {
    const index = THEMES.indexOf(this.current);
    this.set(THEMES[(index + 1) % THEMES.length]);
    return this.current;
  }
}
