import { LANDING, MAX_FRAME_MS, TICK_MS, TRAJECTORY } from './config.js';
import { altitudeOf, predictTrajectory, speedOf, tiltFromVertical, toDegrees } from './sim/physics.js';
import { ShipStatus, Simulation } from './sim/simulation.js';

/**
 * Owns the main loop: feeds input into the simulation at a fixed tick rate
 * and shows the result through the renderers and the HUD.
 */
export class Game {
  #scene;
  #starfield;
  #hud;
  #keyboard;
  #fpsCounter;
  #sim = new Simulation();
  #lastFrameAt = null;
  #unsimulatedMs = 0;

  /**
   * @param {Object} parts
   * @param {import('./render/sceneRenderer.js').SceneRenderer} parts.scene
   * @param {import('./render/starfield.js').Starfield} parts.starfield
   * @param {import('./ui/hud.js').Hud} parts.hud
   * @param {import('./input/keyboard.js').Keyboard} parts.keyboard
   * @param {import('./ui/fpsCounter.js').FpsCounter} parts.fpsCounter
   */
  constructor({ scene, starfield, hud, keyboard, fpsCounter }) {
    this.#scene = scene;
    this.#starfield = starfield;
    this.#hud = hud;
    this.#keyboard = keyboard;
    this.#fpsCounter = fpsCounter;
  }

  start() {
    requestAnimationFrame(this.#onFrame);
  }

  /** Abandons the current flight and puts a fresh ship on the start position. */
  restart() {
    this.#sim = new Simulation();
    this.#unsimulatedMs = 0;
  }

  #onFrame = (now) => {
    const frameMs = this.#lastFrameAt === null ? 0 : Math.min(now - this.#lastFrameAt, MAX_FRAME_MS);
    this.#lastFrameAt = now;

    this.#unsimulatedMs += frameMs;
    while (this.#unsimulatedMs >= TICK_MS) {
      this.#sim.step(this.#keyboard.controls);
      this.#unsimulatedMs -= TICK_MS;
    }

    this.#render(now);
    this.#fpsCounter.trackFrame(now);
    requestAnimationFrame(this.#onFrame);
  };

  #render(now) {
    const sim = this.#sim;
    const trajectory = sim.isFlying
      ? predictTrajectory(sim.ship, sim.moon, TRAJECTORY.maxSteps)
      : null;

    this.#starfield.update(now);
    this.#scene.draw(sim, trajectory);
    this.#hud.update({
      speed: speedOf(sim.ship),
      altitude: altitudeOf(sim.ship, sim.moon),
      tiltDeg: toDegrees(tiltFromVertical(sim.ship, sim.moon)),
      fuel: sim.fuel,
      oxygen: sim.oxygen,
      elapsedMs: sim.elapsedMs,
      collisionWarning: Boolean(trajectory?.impact && trajectory.impact.speed >= LANDING.maxSpeed),
      landed: sim.isLanded,
      oxygenDepleted: sim.ship.status === ShipStatus.LOST,
      canRestart: !sim.isShipOperational,
    });
  }
}
