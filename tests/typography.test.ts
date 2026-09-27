import { describe, expect, it } from 'vitest';
import {
  FONT_PRESETS, MEASURE_CHARS, RHYTHM_PRESETS, applyTypography, describeTypography, nextTypography, typographyActions,
  typographyVars, type StyleTarget,
} from '../src/core/typography';
import { DEFAULT_PREFS, FONTS, RHYTHMS, WIDTHS, type Preferences } from '../src/core/prefs';

const prefs = (patch: Partial<Preferences> = {}): Preferences => ({ ...DEFAULT_PREFS, ...patch });

function target(): StyleTarget & { vars: Map<string, string> } {
  const vars = new Map<string, string>();
  return { vars, dataset: {}, style: { setProperty: (name: string, value: string) => void vars.set(name, value) } };
}

describe('line measure', () => {
  it('maps the three column widths to about 60, 72 and 85 characters', () => {
    expect(MEASURE_CHARS).toEqual({ narrow: 60, medium: 72, wide: 85 });
    expect(typographyVars(prefs({ width: 'narrow' }))['--measure']).toBe('60ch');
    expect(typographyVars(prefs({ width: 'medium' }))['--measure']).toBe('72ch');
    expect(typographyVars(prefs({ width: 'wide' }))['--measure']).toBe('85ch');
  });

  it('keeps the stored width keys, so saved preferences still load', () => {
    expect(Object.keys(MEASURE_CHARS)).toEqual([...WIDTHS]);
  });
});

describe('font personalities', () => {
  it('offers a drafting duospace, an editorial serif and a humanist sans', () => {
    expect(FONT_PRESETS.mono.stack).toMatch(/^"iA Writer Duo S".*"JetBrains Mono".*monospace$/);
    expect(FONT_PRESETS.serif.stack).toMatch(/^"Literata".*"Merriweather".*"Lora".*serif$/);
    expect(FONT_PRESETS.sans.stack).toMatch(/^"Inter".*"Source Sans 3".*sans-serif$/);
  });

  it('gives every preset a label, a purpose and a sane optical scale', () => {
    for (const font of FONTS) {
      const preset = FONT_PRESETS[font];
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.purpose.length).toBeGreaterThan(0);
      expect(preset.scale).toBeGreaterThan(0.85);
      expect(preset.scale).toBeLessThanOrEqual(1);
    }
  });

  it('sets the writing stack and optical scale for the chosen face', () => {
    const vars = typographyVars(prefs({ font: 'mono' }));
    expect(vars['--writing']).toBe(FONT_PRESETS.mono.stack);
    expect(vars['--optical']).toBe(String(FONT_PRESETS.mono.scale));
  });
});

describe('paragraph rhythm', () => {
  it('orders line height and paragraph gap from dense to spacious', () => {
    const [dense, balanced, spacious] = RHYTHMS.map((r) => RHYTHM_PRESETS[r]);
    expect(dense.leading).toBeLessThan(balanced.leading);
    expect(balanced.leading).toBeLessThan(spacious.leading);
    expect(dense.gap).toBeLessThan(balanced.gap);
    expect(balanced.gap).toBeLessThan(spacious.gap);
  });

  it('keeps the previous page look as the balanced default', () => {
    expect(DEFAULT_PREFS.rhythm).toBe('balanced');
    const vars = typographyVars(prefs());
    expect(vars['--leading']).toBe('1.75');
    expect(vars['--para-gap']).toBe('1.1em');
  });

  it('stays readable at both ends', () => {
    expect(RHYTHM_PRESETS.dense.leading).toBeGreaterThanOrEqual(1.4);
    expect(RHYTHM_PRESETS.spacious.leading).toBeLessThanOrEqual(2.1);
  });
});

describe('applyTypography', () => {
  it('writes the data-font attribute and every variable to the injected root', () => {
    const root = target();
    applyTypography(root, prefs({ font: 'sans', width: 'wide', rhythm: 'dense' }));
    expect(root.dataset.font).toBe('sans');
    expect(root.dataset.rhythm).toBe('dense');
    expect(root.vars.get('--measure')).toBe('85ch');
    expect(root.vars.get('--leading')).toBe(String(RHYTHM_PRESETS.dense.leading));
    expect(root.vars.get('--writing')).toBe(FONT_PRESETS.sans.stack);
    expect(root.vars.get('--font-size')).toBe(DEFAULT_PREFS.size + 'px');
  });
});

describe('quick toggles', () => {
  it('cycles each setting through its options and wraps around', () => {
    expect(nextTypography(prefs({ width: 'narrow' }), 'width')).toEqual({ width: 'medium' });
    expect(nextTypography(prefs({ width: 'wide' }), 'width')).toEqual({ width: 'narrow' });
    expect(nextTypography(prefs({ rhythm: 'spacious' }), 'rhythm')).toEqual({ rhythm: 'dense' });
    expect(nextTypography(prefs({ font: 'serif' }), 'font')).toEqual({ font: 'sans' });
  });

  it('describes the current choice in plain words', () => {
    expect(describeTypography(prefs({ width: 'medium' }), 'width')).toBe('Column: Comfortable, about 72 characters per line');
    expect(describeTypography(prefs({ rhythm: 'dense' }), 'rhythm')).toBe('Spacing: Dense');
    expect(describeTypography(prefs({ font: 'mono' }), 'font')).toBe('Typeface: Duospace, for drafting');
  });
});

describe('typographyActions', () => {
  it('cycles a setting through the injected store and announces the new value', () => {
    let current = prefs({ width: 'narrow' });
    const messages: string[] = [];
    const actions = typographyActions({
      get: () => current,
      update: (patch) => { current = { ...current, ...patch }; },
      notify: (message) => messages.push(message),
    });
    actions.measure();
    actions.rhythm();
    actions.typeface();
    expect(current.width).toBe('medium');
    expect(current.rhythm).toBe('spacious');
    expect(current.font).toBe('sans');
    expect(messages).toEqual([
      'Column: Comfortable, about 72 characters per line',
      'Spacing: Spacious',
      'Typeface: Humanist sans, for articles and notes',
    ]);
  });
});
