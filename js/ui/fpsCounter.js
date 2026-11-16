const SAMPLE_COUNT = 100;
const DISPLAY_INTERVAL_MS = 250;

/** Shows the average frame rate over the last frames. */
export class FpsCounter {
  #element;
  #samples = [];
  #lastFrameAt = null;
  #lastDisplayAt = -Infinity;

  /** @param {HTMLElement} element */
  constructor(element) {
    this.#element = element;
  }

  /** Call once per rendered frame with the frame timestamp. */
  trackFrame(now) {
    if (this.#lastFrameAt !== null && now > this.#lastFrameAt) {
      this.#samples.push(1000 / (now - this.#lastFrameAt));
      if (this.#samples.length > SAMPLE_COUNT) this.#samples.shift();
    }
    this.#lastFrameAt = now;

    if (this.#samples.length === 0 || now - this.#lastDisplayAt < DISPLAY_INTERVAL_MS) return;
    const average = this.#samples.reduce((sum, fps) => sum + fps, 0) / this.#samples.length;
    this.#element.textContent = String(Math.round(average)).padStart(2, '0');
    this.#lastDisplayAt = now;
  }
}
