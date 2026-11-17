import { STARFIELD } from '../config.js';
import { clamp, TAU } from '../sim/physics.js';

/**
 * Two-layer star background: a static layer painted once and a sparse layer
 * of flickering stars that is repainted at a low, fixed rate.
 */
export class Starfield {
  #flickerCtx;
  #flickerStars;
  #lastFlickerAt = -Infinity;

  /**
   * @param {HTMLCanvasElement} staticCanvas
   * @param {HTMLCanvasElement} flickerCanvas
   * @param {Object} [options]
   * @param {boolean} [options.animate] false paints the flicker layer once (reduced motion)
   * @param {() => number} [options.random]
   */
  constructor(staticCanvas, flickerCanvas, { animate = true, random = Math.random } = {}) {
    this.animate = animate;
    this.random = random;
    this.#paintStaticStars(staticCanvas);
    this.#flickerCtx = flickerCanvas.getContext('2d');
    this.#flickerStars = Array.from({ length: STARFIELD.flickerCount }, () => ({
      x: random() * flickerCanvas.width,
      y: random() * flickerCanvas.height,
      radius: random() * 0.7 + 0.3,
      opacity: random(),
    }));
  }

  /** Repaints the flickering layer if enough time has passed. */
  update(now) {
    const painted = this.#lastFlickerAt > -Infinity;
    if (painted && (!this.animate || now - this.#lastFlickerAt < STARFIELD.flickerIntervalMs)) return;
    this.#lastFlickerAt = now;

    const ctx = this.#flickerCtx;
    const jitter = STARFIELD.flickerIntensity;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const star of this.#flickerStars) {
      star.opacity = clamp(star.opacity + (this.random() * 2 - 1) * jitter, 0, 1);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${star.opacity})`;
      ctx.fill();
    }
  }

  #paintStaticStars(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    for (let i = 0; i < STARFIELD.staticCount; i++) {
      ctx.beginPath();
      ctx.arc(
        this.random() * canvas.width,
        this.random() * canvas.height,
        this.random() * 0.4 + 0.01,
        0,
        TAU
      );
      ctx.fill();
    }
  }
}
