import { FONTS, RHYTHMS, WIDTHS, type Font, type Preferences, type Rhythm, type Width } from './prefs';

/** Characters per line for each column width; ch units keep the measure steady at any window size. */
export const MEASURE_CHARS: Readonly<Record<Width, number>> = Object.freeze({ narrow: 60, medium: 72, wide: 85 });

export const WIDTH_LABELS: Readonly<Record<Width, string>> = Object.freeze({
  narrow: 'Narrow', medium: 'Comfortable', wide: 'Wide',
});

export interface FontPreset {
  label: string;
  purpose: string;
  /** Font stack: the named writer faces when installed, then close system equivalents. Nothing is downloaded. */
  stack: string;
  /** Optical size correction: wide mono and sans faces look larger than a serif at the same px size. */
  scale: number;
}

export const FONT_PRESETS: Readonly<Record<Font, FontPreset>> = Object.freeze({
  mono: {
    label: 'Duospace',
    purpose: 'for drafting',
    stack: '"iA Writer Duo S", "iA Writer Mono S", "JetBrains Mono", "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
    scale: 0.9,
  },
  serif: {
    label: 'Editorial serif',
    purpose: 'for narrative',
    stack: '"Literata", "Merriweather", "Lora", "Source Serif 4", "Iowan Old Style", Charter, "Palatino Linotype", Georgia, serif',
    scale: 1,
  },
  sans: {
    label: 'Humanist sans',
    purpose: 'for articles and notes',
    stack: '"Inter", "Source Sans 3", "Segoe UI Variable Text", "Segoe UI", -apple-system, system-ui, Ubuntu, sans-serif',
    scale: 0.95,
  },
});

export interface RhythmPreset {
  label: string;
  /** Unitless line height. */
  leading: number;
  /** Space after each paragraph, in em. */
  gap: number;
}

export const RHYTHM_PRESETS: Readonly<Record<Rhythm, RhythmPreset>> = Object.freeze({
  dense: { label: 'Dense', leading: 1.5, gap: 0.6 },
  balanced: { label: 'Balanced', leading: 1.75, gap: 1.1 },
  spacious: { label: 'Spacious', leading: 2, gap: 1.6 },
});

export type TypographyVars = Record<'--measure' | '--writing' | '--optical' | '--leading' | '--para-gap' | '--font-size', string>;

/** CSS custom properties for the writing page. Pure, so the mapping is testable without a DOM. */
export function typographyVars(prefs: Preferences): TypographyVars {
  const font = FONT_PRESETS[prefs.font];
  const rhythm = RHYTHM_PRESETS[prefs.rhythm];
  return {
    '--measure': MEASURE_CHARS[prefs.width] + 'ch',
    '--writing': font.stack,
    '--optical': String(font.scale),
    '--leading': String(rhythm.leading),
    '--para-gap': rhythm.gap + 'em',
    '--font-size': prefs.size + 'px',
  };
}

/** The part of the document root this module touches; injected so tests need no DOM. */
export interface StyleTarget {
  dataset: Record<string, string | undefined>;
  style: { setProperty(name: string, value: string): void };
}

export function applyTypography(root: StyleTarget, prefs: Preferences): void {
  root.dataset.font = prefs.font;
  root.dataset.rhythm = prefs.rhythm;
  for (const [name, value] of Object.entries(typographyVars(prefs))) root.style.setProperty(name, value);
}

export type TypographySetting = 'width' | 'rhythm' | 'font';

const OPTIONS = { width: WIDTHS, rhythm: RHYTHMS, font: FONTS } as const;

/** The next option for a quick toggle, wrapping from the last back to the first. */
export function nextTypography(prefs: Preferences, setting: TypographySetting): Partial<Preferences> {
  const options: readonly string[] = OPTIONS[setting];
  const next = options[(options.indexOf(prefs[setting]) + 1) % options.length];
  return { [setting]: next } as Partial<Preferences>;
}

export function describeTypography(prefs: Preferences, setting: TypographySetting): string {
  if (setting === 'width') {
    return `Column: ${WIDTH_LABELS[prefs.width]}, about ${MEASURE_CHARS[prefs.width]} characters per line`;
  }
  if (setting === 'rhythm') return 'Spacing: ' + RHYTHM_PRESETS[prefs.rhythm].label;
  const font = FONT_PRESETS[prefs.font];
  return `Typeface: ${font.label}, ${font.purpose}`;
}

export interface TypographyDeps {
  get(): Preferences;
  update(patch: Partial<Preferences>): void;
  notify(message: string): void;
}

/** Quick-toggle actions for the keyboard and command palette. */
export function typographyActions(deps: TypographyDeps): Record<'measure' | 'rhythm' | 'typeface', () => void> {
  const cycle = (setting: TypographySetting) => () => {
    deps.update(nextTypography(deps.get(), setting));
    deps.notify(describeTypography(deps.get(), setting));
  };
  return { measure: cycle('width'), rhythm: cycle('rhythm'), typeface: cycle('font') };
}
