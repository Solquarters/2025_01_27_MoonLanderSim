const MAX_SCALE = 2;

/**
 * Scales the fixed-size stage so it always fits the window. The frame element
 * takes the scaled size in the page layout while the stage itself is transformed.
 */
export class StageScaler {
  #frame;
  #stage;
  #onScale;

  /**
   * @param {HTMLElement} frame
   * @param {HTMLElement} stage
   * @param {(scale: number) => void} [onScale] called whenever the scale changes
   */
  constructor(frame, stage, onScale = () => {}) {
    this.#frame = frame;
    this.#stage = stage;
    this.#onScale = onScale;
    window.addEventListener('resize', () => this.fit());
    this.fit();
  }

  fit() {
    const width = this.#stage.offsetWidth;
    const height = this.#stage.offsetHeight;
    if (width === 0 || height === 0) return; // stage hidden (portrait hint)

    const scale = Math.min(window.innerWidth / width, window.innerHeight / height, MAX_SCALE);
    this.#frame.style.width = `${width * scale}px`;
    this.#frame.style.height = `${height * scale}px`;
    this.#stage.style.setProperty('--stage-scale', String(scale));
    this.#onScale(scale);
  }
}
