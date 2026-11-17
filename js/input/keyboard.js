/** Physical keys (KeyboardEvent.code) that are held down to steer the ship. */
const HELD_BINDINGS = Object.freeze({
  ArrowUp: 'thrust',
  ArrowDown: 'reverse',
  ArrowLeft: 'rotateLeft',
  ArrowRight: 'rotateRight',
  KeyS: 'stabilize',
});

/**
 * Translates keyboard events into ship controls and one-shot actions.
 * Uses physical key codes, so Caps Lock and keyboard layouts do not matter.
 */
export class Keyboard {
  #shipControls;
  #actions = new Map();
  #enabled = true;

  /**
   * @param {import('./shipControls.js').ShipControls} shipControls
   * @param {EventTarget} [target]
   */
  constructor(shipControls, target = window) {
    this.#shipControls = shipControls;
    target.addEventListener('keydown', (event) => this.#onKeyDown(event));
    target.addEventListener('keyup', (event) => this.#onKeyUp(event));
    // Keys released while the window is unfocused never send keyup.
    target.addEventListener('blur', () => shipControls.releaseAll());
  }

  /** While disabled (a dialog is open) keys are left to the browser. */
  set enabled(enabled) {
    this.#enabled = enabled;
  }

  /**
   * Registers a one-shot key.
   * @param {string} code KeyboardEvent.code, e.g. "Space"
   * @param {() => void} handler called once per key press
   */
  onKey(code, handler) {
    this.#actions.set(code, handler);
  }

  #onKeyDown(event) {
    if (!this.#enabled || event.ctrlKey || event.metaKey || event.altKey) return;

    const control = HELD_BINDINGS[event.code];
    if (control) {
      event.preventDefault(); // arrow keys would scroll the page
      this.#shipControls.set(control, true);
      return;
    }

    const action = this.#actions.get(event.code);
    if (action) {
      event.preventDefault();
      if (!event.repeat) action();
    }
  }

  #onKeyUp(event) {
    // Releases always count, or a key let go behind a dialog would stay "held".
    const control = HELD_BINDINGS[event.code];
    if (control) {
      this.#shipControls.set(control, false);
    } else if (this.#enabled && this.#actions.has(event.code)) {
      event.preventDefault(); // Space would otherwise "click" a focused button
    }
  }
}
