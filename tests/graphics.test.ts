import { describe, expect, it } from 'vitest';
import { describeEffects, drawsInSoftware, resolveEffects } from '../src/core/graphics';
import { DEFAULT_PREFS, sanitizePrefs } from '../src/core/prefs';

const gl = (renderer: string, withInfo = true) => ({
  RENDERER: 1,
  getExtension: () => (withInfo ? { UNMASKED_RENDERER_WEBGL: 2 } : null),
  getParameter: (name: number) => (name === 2 || !withInfo ? renderer : 'WebKit WebGL'),
});

describe('software drawing detection', () => {
  it('recognises the names software drivers use', () => {
    for (const name of ['llvmpipe (LLVM 15.0.7, 256 bits)', 'Google SwiftShader', 'Mesa softpipe', 'Microsoft Basic Render Driver', 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)'])
      expect(drawsInSoftware(() => gl(name)), name).toBe(true);
  });
  it('does not mistake real graphics cards for software', () => {
    for (const name of ['NVIDIA GeForce RTX 3060/PCIe/SSE2', 'Intel(R) UHD Graphics 620 (CML GT2)', 'AMD Radeon RX 6600 (radeonsi, navi23)', 'Apple M2', 'Mesa Intel(R) Xe Graphics (TGL GT2)'])
      expect(drawsInSoftware(() => gl(name)), name).toBe(false);
  });
  it('treats no graphics context as software, falls back to the plain renderer name, and never throws', () => {
    expect(drawsInSoftware(() => null)).toBe(true);
    expect(drawsInSoftware(() => gl('llvmpipe', false))).toBe(true);
    expect(drawsInSoftware(() => { throw new Error('blocked'); })).toBe(false);
  });
});

describe('visual effects choice', () => {
  it('follows your choice, and only decides by itself on Automatic', () => {
    expect(resolveEffects('full', true)).toBe('full');
    expect(resolveEffects('light', false)).toBe('light');
    expect(resolveEffects('auto', true)).toBe('light');
    expect(resolveEffects('auto', false)).toBe('full');
  });
  it('explains what is happening in plain words', () => {
    expect(describeEffects('auto', true)).toContain('software');
    expect(describeEffects('auto', false)).toContain('acceleration');
    expect(describeEffects('light', false)).toContain('off');
    expect(describeEffects('full', true)).toContain('on');
  });
  it('is remembered, defaults to Automatic, and ignores anything else', () => {
    expect(DEFAULT_PREFS.effects).toBe('auto');
    expect(sanitizePrefs({ effects: 'light' }).effects).toBe('light');
    expect(sanitizePrefs({ effects: 'turbo' }).effects).toBe('auto');
    expect(sanitizePrefs(null).effects).toBe('auto');
  });
});
