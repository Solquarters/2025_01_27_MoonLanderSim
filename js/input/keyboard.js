/** Physical keys (KeyboardEvent.code) that are held down to steer the ship. */
const HELD_BINDINGS = Object.freeze({
  ArrowUp: 'thrust',
  ArrowDown: 'reverse',
  ArrowLeft: 'rotateLeft',
  ArrowRight: 'rotateRight',
  KeyS: 'stabilize',
});

const releasedControls = () => ({
  thrust: false,
  reverse: false,
  rotateLeft: false,
  rotateRight: false,
  stabilize: false,
});

/**
 * Translates keyboard events into ship controls and one-shot actions.
 * Uses physical key codes, so Caps Lock and keyboard layouts do not matter.
 */
export class Keyboard {
  #controls = releasedControls();
  #actions = new Map();
  #enabled = true;

  /** @param {EventTarget} target */
  constructor(target = window) {
    target.addEventListener('keydown', (event) => this.#onKeyDown(event));
    target.addEventListener('keyup', (event) => this.#onKeyUp(event));
    // Keys released while the window is unfocused never send keyup.
    target.addEventListener('blur', () => this.releaseAll());
  }

  /** While disabled (e.g. a dialog is open) keys are left to the browser. */
  set enabled(enabled) {
    this.#enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  /** Current state of the held controls. */
  get controls() {
    return this.#controls;
  }

  /**
   * Registers handlers for a one-shot key.
   * @param {string} code KeyboardEvent.code, e.g. "Space"
   * @param {{ down?: () => void, up?: () => void }} handlers
   */
  onKey(code, handlers) {
    this.#actions.set(code, handlers);
  }

  releaseAll() {
    this.#controls = releasedControls();
  }

  #onKeyDown(event) {
    if (!this.#enabled || event.ctrlKey || event.metaKey || event.altKey) return;

    const control = HELD_BINDINGS[event.code];
    if (control) {
      event.preventDefault(); // arrow keys would scroll the page
      this.#controls[control] = true;
      return;
    }

    const action = this.#actions.get(event.code);
    if (action) {
      event.preventDefault();
      if (!event.repeat) action.down?.();
    }
  }

  #onKeyUp(event) {
    if (!this.#enabled) return;
    const control = HELD_BINDINGS[event.code];
    if (control) {
      this.#controls[control] = false;
      return;
    }

    const action = this.#actions.get(event.code);
    if (action) {
      event.preventDefault();
      action.up?.();
    }
  }
}
