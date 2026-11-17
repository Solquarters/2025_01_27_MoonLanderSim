const CONTROL_NAMES = Object.freeze(['thrust', 'reverse', 'rotateLeft', 'rotateRight', 'stabilize']);

const allReleased = () => Object.fromEntries(CONTROL_NAMES.map((name) => [name, false]));

/**
 * The held-down ship controls, shared by every input device (keyboard, touch).
 * The simulation reads `state` once per tick.
 */
export class ShipControls {
  #state = allReleased();

  /** @returns {import('../sim/simulation.js').Controls} */
  get state() {
    return this.#state;
  }

  /**
   * @param {string} name one of thrust, reverse, rotateLeft, rotateRight, stabilize
   * @param {boolean} pressed
   */
  set(name, pressed) {
    if (!CONTROL_NAMES.includes(name)) throw new Error(`Unknown ship control: ${name}`);
    this.#state[name] = pressed;
  }

  releaseAll() {
    this.#state = allReleased();
  }
}
