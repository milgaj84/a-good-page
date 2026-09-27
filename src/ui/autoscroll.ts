import type { FrameClock } from '../core/frame';

/** Tuning for middle-click autoscroll, in CSS pixels and pixels per second. */
export interface AutoscrollTuning {
  deadzone: number;
  gain: number;
  maxSpeed: number;
}

export const AUTOSCROLL_TUNING: AutoscrollTuning = { deadzone: 10, gain: 9, maxSpeed: 7000 };

/**
 * Scroll speed (px/s) for a pointer that is `offset` px away from the anchor.
 * Zero inside the dead zone, grows gently (slightly faster than linear) and is clamped to maxSpeed.
 */
export function autoscrollVelocity(offset: number, tuning: AutoscrollTuning = AUTOSCROLL_TUNING): number {
  if (!Number.isFinite(offset)) return 0;
  if (tuning.deadzone < 0 || tuning.gain < 0 || tuning.maxSpeed < 0) throw new RangeError('Autoscroll tuning must be non-negative');
  const distance = Math.abs(offset) - tuning.deadzone;
  if (distance <= 0) return 0;
  const speed = Math.min(tuning.maxSpeed, tuning.gain * distance * (1 + distance / 250));
  return Math.sign(offset) * speed;
}

export interface ScrollTarget {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

export interface AutoscrollIndicator {
  show(x: number, y: number): void;
  direction(dir: -1 | 0 | 1): void;
  hide(): void;
}

/**
 * Browser-style middle-click autoscroll (WebView2 and WebKitGTK do not provide it).
 * Click the wheel to toggle; or hold the wheel and drag, releasing stops.
 */
export class Autoscroll {
  private anchorY = 0;
  private pointerY = 0;
  private dragged = false;
  private isActive = false;
  private frame: unknown = null;
  private lastTime: number | null = null;
  private carry = 0;

  constructor(
    private readonly target: ScrollTarget,
    private readonly indicator: AutoscrollIndicator,
    private readonly frames: FrameClock,
    private readonly tuning: AutoscrollTuning = AUTOSCROLL_TUNING,
  ) {}

  get active(): boolean {
    return this.isActive;
  }

  get scrollable(): boolean {
    return this.target.scrollHeight > this.target.clientHeight + 1;
  }

  /** Returns true when the event was consumed and its default (e.g. Linux primary paste) must be prevented. */
  pointerDown(button: number, x: number, y: number): boolean {
    if (this.isActive) {
      this.stop();
      return true;
    }
    if (button !== 1 || !this.scrollable) return false;
    this.isActive = true;
    this.dragged = false;
    this.anchorY = y;
    this.pointerY = y;
    this.carry = 0;
    this.lastTime = null;
    this.indicator.show(x, y);
    this.indicator.direction(0);
    this.request();
    return true;
  }

  pointerMove(y: number): void {
    if (!this.isActive) return;
    this.pointerY = y;
    if (Math.abs(y - this.anchorY) > this.tuning.deadzone) this.dragged = true;
  }

  /** Hold-and-drag mode ends on release; a plain click keeps scrolling until the next click. */
  pointerUp(button: number): void {
    if (this.isActive && button === 1 && this.dragged) this.stop();
  }

  stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
    this.lastTime = null;
    this.carry = 0;
    this.indicator.hide();
  }

  private request(): void {
    this.frame = this.frames.request((time) => this.tick(time));
  }

  private tick(time: number): void {
    this.frame = null;
    if (!this.isActive) return;
    const velocity = autoscrollVelocity(this.pointerY - this.anchorY, this.tuning);
    this.indicator.direction(velocity === 0 ? 0 : velocity < 0 ? -1 : 1);
    if (this.lastTime !== null && velocity !== 0) {
      const elapsed = Math.min(64, Math.max(0, time - this.lastTime));
      this.carry += (velocity * elapsed) / 1000;
      const whole = this.carry < 0 ? Math.ceil(this.carry) : Math.floor(this.carry);
      if (whole !== 0) {
        this.carry -= whole;
        const max = Math.max(0, this.target.scrollHeight - this.target.clientHeight);
        this.target.scrollTop = Math.min(max, Math.max(0, this.target.scrollTop + whole));
      }
    }
    this.lastTime = time;
    this.request();
  }
}

/** DOM indicator: a small anchored ring that shows the scroll direction. */
export function domIndicator(host: HTMLElement): AutoscrollIndicator {
  const node = document.createElement('div');
  node.className = 'autoscroll-anchor';
  node.setAttribute('aria-hidden', 'true');
  host.append(node);
  return {
    show: (x, y) => {
      node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      node.classList.add('is-on');
      document.documentElement.classList.add('is-autoscrolling');
    },
    direction: (dir) => { node.dataset.dir = dir < 0 ? 'up' : dir > 0 ? 'down' : 'idle'; },
    hide: () => {
      node.classList.remove('is-on');
      document.documentElement.classList.remove('is-autoscrolling');
    },
  };
}

/** Wires middle-click autoscroll to a scroll container. Returns the controller for state checks. */
export function bindAutoscroll(scroller: HTMLElement, frames: FrameClock): Autoscroll {
  const auto = new Autoscroll(scroller, domIndicator(document.body), frames);
  scroller.addEventListener('mousedown', (event) => {
    if (auto.pointerDown(event.button, event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  window.addEventListener('mousedown', (event) => { if (auto.active && !scroller.contains(event.target as Node)) auto.stop(); }, true);
  window.addEventListener('mousemove', (event) => auto.pointerMove(event.clientY), { passive: true });
  window.addEventListener('mouseup', (event) => auto.pointerUp(event.button), true);
  // Middle-click must never paste the primary selection or open anything while scrolling.
  scroller.addEventListener('auxclick', (event) => { if (event.button === 1) event.preventDefault(); }, true);
  window.addEventListener('keydown', (event) => {
    if (!auto.active) return;
    auto.stop();
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  scroller.addEventListener('wheel', () => auto.stop(), { passive: true });
  window.addEventListener('blur', () => auto.stop());
  return auto;
}
