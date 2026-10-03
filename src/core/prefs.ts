import type { KeyValueStore } from './ports';

export const FONTS = ['serif', 'sans', 'mono'] as const;
export type Font = (typeof FONTS)[number];

/** Stored keys stay 'narrow' | 'medium' | 'wide' so older preferences load; 'medium' is shown as Comfortable. */
export const WIDTHS = ['narrow', 'medium', 'wide'] as const;
export type Width = (typeof WIDTHS)[number];

/** Line height and paragraph spacing, from notes to fiction. */
export const RHYTHMS = ['dense', 'balanced', 'spacious'] as const;
export type Rhythm = (typeof RHYTHMS)[number];

import { EFFECT_MODES, type EffectMode } from './graphics';

export const MIN_SIZE = 15;
export const MAX_SIZE = 28;
export const MAX_GOAL = 1_000_000;
export const PREFS_KEY = 'hearth.prefs';

export interface Preferences {
  font: Font;
  size: number;
  width: Width;
  rhythm: Rhythm;
  goal: number;
  toolbar: boolean;
  outline: boolean;
  /** Fade the bars and scrollbars while typing. */
  ghost: boolean;
  /** Keep the typing line at the middle of the window. */
  typewriter: boolean;
  /** Fades, shadows and animations: automatic, always on, or off for the fastest drawing. */
  effects: EffectMode;
}

export const DEFAULT_PREFS: Readonly<Preferences> = Object.freeze({
  font: 'serif',
  size: 20,
  width: 'medium',
  rhythm: 'balanced',
  goal: 0,
  toolbar: true,
  outline: false,
  ghost: true,
  typewriter: false,
  effects: 'auto',
});

export function clampSize(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_PREFS.size;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, n));
}

export function sanitizeGoal(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_GOAL, Math.floor(n));
}

function pick<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return (options as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function sanitizePrefs(raw: unknown): Preferences {
  const o = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    font: pick(FONTS, o.font, DEFAULT_PREFS.font),
    size: clampSize(o.size),
    width: pick(WIDTHS, o.width, DEFAULT_PREFS.width),
    rhythm: pick(RHYTHMS, o.rhythm, DEFAULT_PREFS.rhythm),
    goal: sanitizeGoal(o.goal),
    toolbar: bool(o.toolbar, DEFAULT_PREFS.toolbar),
    outline: bool(o.outline, DEFAULT_PREFS.outline),
    ghost: bool(o.ghost, DEFAULT_PREFS.ghost),
    typewriter: bool(o.typewriter, DEFAULT_PREFS.typewriter),
    effects: pick(EFFECT_MODES, o.effects, DEFAULT_PREFS.effects),
  };
}

/** Loads, validates and persists display preferences. Storage is injected. */
export class PreferencesStore {
  private current: Preferences;

  constructor(private readonly store: KeyValueStore) {
    this.current = PreferencesStore.load(store);
  }

  private static load(store: KeyValueStore): Preferences {
    const raw = store.get(PREFS_KEY);
    if (raw === null) return sanitizePrefs(null);
    try {
      return sanitizePrefs(JSON.parse(raw));
    } catch {
      return sanitizePrefs(null);
    }
  }

  get prefs(): Preferences {
    return { ...this.current };
  }

  update(patch: Partial<Preferences>): Preferences {
    this.current = sanitizePrefs({ ...this.current, ...patch });
    this.store.set(PREFS_KEY, JSON.stringify(this.current));
    return this.prefs;
  }
}
