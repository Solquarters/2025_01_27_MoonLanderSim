import { LANDING, MOON_IMAGE, WORLD } from '../config.js';
import { clamp, TAU } from '../sim/physics.js';
import { ShipStatus } from '../sim/simulation.js';

const COLORS = Object.freeze({
  hull: 'blue',
  hullOutline: 'gray',
  moonFallback: '#1a1a1a',
  pathClear: 'rgba(255, 255, 0, 0.6)',
  pathSafeLanding: 'rgba(0, 255, 0, 0.6)',
  pathCrash: 'rgba(255, 0, 0, 0.6)',
  safeImpactMarker: 'green',
  offScreenMarker: 'rgba(255, 255, 255, 0.9)',
});

/** Sharper than this brings no visible gain and costs fill rate. */
const MAX_RESOLUTION = 2.5;
const OFF_SCREEN_MARKER_INSET = 22;

/** Draws the moon, the ship and everything that moves onto the main canvas. */
export class SceneRenderer {
  #ctx;
  #moonImage = new Image();
  #resolution = 1;

  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.#ctx = canvas.getContext('2d');
    this.#moonImage.src = MOON_IMAGE.src;
  }

  /**
   * Matches the canvas bitmap to its on-screen size so the scene stays sharp
   * when the stage is scaled up or shown on a high-density display.
   * @param {number} pixelsPerWorldUnit
   */
  setResolution(pixelsPerWorldUnit) {
    const resolution = clamp(pixelsPerWorldUnit, 1, MAX_RESOLUTION);
    if (resolution === this.#resolution) return;
    this.#resolution = resolution;
    const { canvas } = this.#ctx;
    canvas.width = Math.round(WORLD.width * resolution);
    canvas.height = Math.round(WORLD.height * resolution);
  }

  /**
   * @param {import('../sim/simulation.js').Simulation} sim
   * @param {{points: {x:number,y:number}[], impact: object|null}|null} trajectory
   * @param {Object} [layers] extra drawing passes supplied by the caller
   * @param {(ctx: CanvasRenderingContext2D) => void} [layers.belowShip]
   * @param {(ctx: CanvasRenderingContext2D) => void} [layers.aboveAll]
   */
  draw(sim, trajectory, { belowShip, aboveAll } = {}) {
    const ctx = this.#ctx;
    ctx.setTransform(this.#resolution, 0, 0, this.#resolution, 0, 0);
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);

    this.#drawTrace(sim.trace);
    this.#drawMoon(sim.moon);
    if (trajectory) this.#drawTrajectory(trajectory);
    belowShip?.(ctx);
    if (sim.ship.status !== ShipStatus.DESTROYED) {
      this.#drawShip(sim.ship);
      this.#drawThrusterFlames(sim.ship, sim.thrusters);
      this.#drawOffScreenMarker(sim.ship);
    }
    this.#drawDebris(sim.debris);
    aboveAll?.(ctx);
  }

  #drawMoon(moon) {
    const ctx = this.#ctx;
    const image = this.#moonImage;
    const imageReady = image.complete && image.naturalWidth > 0;

    if (!imageReady) {
      this.#fillCircle(moon.x, moon.y, moon.radius, COLORS.moonFallback);
      return;
    }

    const size = moon.radius * 2 * MOON_IMAGE.scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, moon.radius, 0, TAU);
    ctx.clip();
    ctx.drawImage(image, moon.x - size / 2, moon.y - size / 2, size, size);
    ctx.restore();
  }

  /** Flight trace that fades and thins towards its oldest point. */
  #drawTrace(trace) {
    const ctx = this.#ctx;
    const lastIndex = trace.length - 1;
    for (let i = 0; i < lastIndex; i++) {
      const age = i / lastIndex; // 0 = oldest, 1 = newest
      ctx.beginPath();
      ctx.moveTo(trace[i].x, trace[i].y);
      ctx.lineTo(trace[i + 1].x, trace[i + 1].y);
      ctx.strokeStyle = `rgba(255,255,255,${age / 1.5})`;
      ctx.lineWidth = 0.1 + 2 * age;
      ctx.stroke();
    }
  }

  #drawTrajectory({ points, impact }) {
    const ctx = this.#ctx;
    const willCrash = impact !== null && impact.speed >= LANDING.maxSpeed;

    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = this.#trajectoryColor(impact, willCrash);
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!impact) return;
    if (willCrash) {
      ctx.font = '20px Arial';
      ctx.fillText('💥', impact.x - 10, impact.y + 10);
    } else {
      this.#fillCircle(impact.x, impact.y, 4, COLORS.safeImpactMarker);
    }
  }

  #trajectoryColor(impact, willCrash) {
    if (!impact) return COLORS.pathClear;
    return willCrash ? COLORS.pathCrash : COLORS.pathSafeLanding;
  }

  #drawShip(ship) {
    const ctx = this.#ctx;
    const r = ship.radius;

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.rotation);

    // Landing legs
    ctx.beginPath();
    ctx.moveTo(-r / 2, r / 2);
    ctx.lineTo(-r * 1.4, r * 1.6);
    ctx.moveTo(r / 2, r / 2);
    ctx.lineTo(r * 1.4, r * 1.6);
    ctx.strokeStyle = COLORS.hullOutline;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hull
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = COLORS.hull;
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  #drawThrusterFlames(ship, thrusters) {
    const ctx = this.#ctx;
    const flicker = 0.3 + 0.5 * Math.random();
    const offset = ship.radius + 2;

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.rotation);
    ctx.fillStyle = `rgba(255, 255, 0, ${flicker})`;

    if (thrusters.main) this.#fillTriangle(0, offset + 4, -5, offset + 8, 5, offset + 8);
    if (thrusters.reverse) this.#fillTriangle(0, -offset - 4, -5, -offset - 8, 5, -offset - 8);
    if (thrusters.rotateLeft) this.#fillTriangle(-offset, 5, -offset - 6, 3, -offset - 6, 7);
    if (thrusters.rotateRight) this.#fillTriangle(offset, 5, offset + 6, 3, offset + 6, 7);

    if (thrusters.stabilizer) {
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius + 10, 0, TAU);
      ctx.strokeStyle = `rgba(255, 255, 255, ${flicker})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** An arrow at the edge of the world pointing to a ship that has left the view. */
  #drawOffScreenMarker(ship) {
    const onScreen = ship.x >= 0 && ship.x <= WORLD.width && ship.y >= 0 && ship.y <= WORLD.height;
    if (onScreen) return;

    const ctx = this.#ctx;
    const inset = OFF_SCREEN_MARKER_INSET;
    const x = clamp(ship.x, inset, WORLD.width - inset);
    const y = clamp(ship.y, inset, WORLD.height - inset);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(ship.y - y, ship.x - x));
    ctx.fillStyle = COLORS.offScreenMarker;
    this.#fillTriangle(12, 0, -6, -8, -6, 8);
    ctx.restore();
  }

  #drawDebris(debris) {
    for (const piece of debris) {
      this.#fillCircle(piece.x, piece.y, piece.radius, piece.color);
    }
  }

  #fillCircle(x, y, radius, color) {
    const ctx = this.#ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }

  #fillTriangle(x1, y1, x2, y2, x3, y3) {
    const ctx = this.#ctx;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  }
}
