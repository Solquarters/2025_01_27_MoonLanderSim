/**
 * On-screen buttons for touch devices. Each button with a `data-control`
 * attribute holds that ship control down while a finger rests on it.
 */
export class TouchPad {
  /**
   * @param {HTMLElement} root element containing the buttons
   * @param {import('./shipControls.js').ShipControls} shipControls
   */
  constructor(root, shipControls) {
    for (const button of root.querySelectorAll('[data-control]')) {
      const control = button.dataset.control;
      const setPressed = (pressed) => {
        shipControls.set(control, pressed);
        button.classList.toggle('is-pressed', pressed);
      };

      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        setPressed(true);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(type, () => setPressed(false));
      }
      // Long-press must not open the context menu in the middle of a burn.
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    }
  }
}
