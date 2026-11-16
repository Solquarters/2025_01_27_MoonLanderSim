/**
 * Central tuning values for the simulation.
 *
 * Units: distances are world pixels, time is physics ticks. The simulation
 * always advances in fixed ticks (see TICKS_PER_SECOND), so "per tick" values
 * behave the same on every display refresh rate.
 */

export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** Upper bound for catch-up after a slow frame, so a background tab does not fast-forward. */
export const MAX_FRAME_MS = 250;

export const WORLD = Object.freeze({ width: 1200, height: 800 });

export const GRAVITY_CONSTANT = 0.5;

export const MOON = Object.freeze({
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  radius: 95,
  mass: 2600,
});

export const SHIP = Object.freeze({
  radius: 6,
  mass: 0.5,
  thrustPerTick: 0.07,
  rotationAccel: 0.002,
  maxRotationVelocity: 0.1,
  stabilizeStrength: 0.005,
});

export const DEFAULT_SPAWN = Object.freeze({
  x: 10,
  y: 10,
  vx: 0,
  vy: 0,
  rotation: Math.PI - 1,
  rotationVelocity: 0.02,
});

export const LANDING = Object.freeze({
  /** Touching down at or above this speed destroys the ship. */
  maxSpeed: 1.5,
  /** Maximum deviation from "feet down" in degrees. */
  maxTiltDeg: 20,
});

/** Tank levels are percentages (0-100). */
export const SUPPLIES = Object.freeze({
  fuel: 80,
  oxygen: 80,
  fuelBurnPerSecond: 6,
  oxygenUsePerSecond: 0.5,
});

export const TRAJECTORY = Object.freeze({ maxSteps: 3000 });

export const TRACE = Object.freeze({ maxLength: 300 });

export const DEBRIS = Object.freeze({
  minCount: 150,
  countSpread: 11,
  colors: Object.freeze(['rgb(63, 63, 255)', 'rgb(153, 153, 153)']),
  /** A slow tilt-crash should still scatter visibly. */
  minBlastSpeed: 1,
});

export const STARFIELD = Object.freeze({
  staticCount: 3000,
  flickerCount: 1000,
  flickerIntensity: 0.1,
  flickerIntervalMs: 1000 / 20,
});

export const MOON_IMAGE = Object.freeze({
  src: './img/full-moon_640.jpg',
  /** The photo has a dark rim; draw it slightly larger than the collision circle. */
  scale: 1.16,
});
