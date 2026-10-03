export const EFFECT_MODES = ['auto', 'full', 'light'] as const;
export type EffectMode = (typeof EFFECT_MODES)[number];
export type Effects = 'full' | 'light';

/** Names graphics drivers give themselves when they draw on the processor instead of a graphics card. */
const SOFTWARE = /llvmpipe|swiftshader|softpipe|software|basic render|microsoft basic|mesa offscreen|angle \(.*(llvmpipe|swiftshader)/i;

interface GlLike {
  getExtension(name: string): { UNMASKED_RENDERER_WEBGL: number } | null;
  getParameter(name: number): unknown;
  RENDERER: number;
}

/**
 * True when this computer appears to draw the window on its processor. Fades, shadows and animations then cost
 * real time on every frame, so the app can switch them off. No graphics at all counts as software.
 */
export function drawsInSoftware(create: () => GlLike | null): boolean {
  try {
    const gl = create();
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return SOFTWARE.test(name);
  } catch {
    return false;
  }
}

export function detectSoftware(doc: Document = document): boolean {
  return drawsInSoftware(() => {
    const canvas = doc.createElement('canvas');
    return (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as GlLike | null;
  });
}

/** The effects actually used: your choice, or (on Automatic) light when the computer draws in software. */
export function resolveEffects(mode: EffectMode, software: boolean, reducedMotion = false): Effects {
  if (mode === 'full') return 'full';
  if (mode === 'light') return 'light';
  return software || reducedMotion ? 'light' : 'full';
}

export function describeEffects(mode: EffectMode, software: boolean, reducedMotion = false): string {
  const used = resolveEffects(mode, software, reducedMotion);
  if (mode !== 'auto') return used === 'light' ? 'Fades, shadows and animations are off.' : 'Fades, shadows and animations are on.';
  if (reducedMotion && !software) return 'Light is being used because your system asks for less motion.';
  return software
    ? 'Light is being used because this computer draws the window in software, where effects slow typing and scrolling.'
    : 'Full effects are being used because this computer has graphics acceleration.';
}
