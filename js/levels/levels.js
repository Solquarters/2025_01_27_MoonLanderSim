/**
 * Campaign definition. Levels are plain data; the Mission class interprets them.
 *
 * Positions are given as a compass bearing around the moon (0° = top of the
 * screen, clockwise) plus an altitude above the surface.
 */

import { DEFAULT_SPAWN, GRAVITY_CONSTANT, MOON, SHIP } from '../config.js';
import { pointAtBearing, toRadians } from '../sim/physics.js';

export const ObjectiveType = Object.freeze({ GATE: 'gate', ORBIT: 'orbit', LAND: 'land' });
export const EventType = Object.freeze({ GYRO_FAULT: 'gyroFault', BEACON: 'beacon' });

const SURFACE_DISTANCE = MOON.radius + SHIP.radius;

// --- spawn helpers -------------------------------------------------------

/** At rest above the surface, feet down. */
function hovering(bearing, altitude) {
  return {
    ...pointAtBearing(MOON, bearing, SURFACE_DISTANCE + altitude),
    vx: 0,
    vy: 0,
    rotation: toRadians(bearing),
    rotationVelocity: 0,
  };
}

/** On a circular clockwise orbit, nose pointing along the flight path. */
function orbiting(bearing, altitude) {
  const distance = SURFACE_DISTANCE + altitude;
  const speed = Math.sqrt((GRAVITY_CONSTANT * MOON.mass * SHIP.mass) / distance);
  const angle = toRadians(bearing);
  return {
    ...pointAtBearing(MOON, bearing, distance),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: angle + Math.PI / 2,
    rotationVelocity: 0,
  };
}

/** Standing on the surface. */
function landedAt(bearing) {
  return { ...hovering(bearing, 0), landed: true };
}

// --- objective helpers ---------------------------------------------------

/** Fly through a ring. `par` is the split time (seconds) that earns no speed bonus. */
const gate = (bearing, altitude, { radius = 26, par = 6 } = {}) => ({
  type: ObjectiveType.GATE,
  bearing,
  altitude,
  radius,
  par,
});

/** Circle the moon without touching down. */
const orbit = (laps = 1) => ({ type: ObjectiveType.ORBIT, laps });

/** Land anywhere. */
const land = () => ({ type: ObjectiveType.LAND, pad: null });

/** Land on a pad; `halfWidth` is the tolerated bearing error in degrees. */
const landOnPad = (bearing, halfWidth = 15) => ({
  type: ObjectiveType.LAND,
  pad: { bearing, halfWidth },
});

// --- event helpers -------------------------------------------------------

/** Events fire at a random moment inside `window` (seconds), so they cannot be memorised. */
const gyroFault = (fromSecond, toSecond) => ({
  type: EventType.GYRO_FAULT,
  window: [fromSecond, toSecond],
});
const beacon = (fromSecond, toSecond) => ({
  type: EventType.BEACON,
  window: [fromSecond, toSecond],
});

/**
 * @typedef {Object} Level
 * @property {string} id                 stable key for saved progress
 * @property {string} name
 * @property {string} briefing
 * @property {string} tip
 * @property {Object} spawn
 * @property {number} fuel               percent
 * @property {number} oxygen             percent
 * @property {Object[]} objectives       completed in order
 * @property {Object[]} events           reaction challenges
 * @property {number} parSeconds         finishing faster earns a time bonus
 * @property {number} comboWindowSeconds time to reach the next gate and keep the chain
 * @property {[number, number]} stars    scores for two and three stars
 */

/** @type {readonly Level[]} */
export const LEVELS = Object.freeze([
  {
    id: 'first-contact',
    name: 'First Contact',
    briefing: 'You are falling towards the moon. Brake with the main engine and touch down gently, anywhere.',
    tip: 'Brake early: close to the surface the engine barely beats gravity.',
    spawn: hovering(0, 240),
    fuel: 100,
    oxygen: 100,
    objectives: [land()],
    events: [],
    parSeconds: 18,
    comboWindowSeconds: 0,
    stars: [1700, 2000],
  },
  {
    id: 'tumble',
    name: 'Tumble',
    briefing: 'The ship arrives spinning. Stop the rotation, then land on the marked pad.',
    tip: 'Hold S to stabilize. The roll indicator turns green when you are upright enough to land.',
    spawn: { ...DEFAULT_SPAWN },
    fuel: 90,
    oxygen: 100,
    objectives: [landOnPad(300, 16)],
    events: [],
    parSeconds: 22,
    comboWindowSeconds: 0,
    stars: [1800, 2200],
  },
  {
    id: 'gate-runner',
    name: 'Gate Runner',
    briefing: 'Fly through the three gates in order, then land. Reaching a gate quickly after the last one builds a combo multiplier.',
    tip: 'Coasting is too slow for the speed bonus. Burn towards the next gate.',
    spawn: orbiting(270, 200),
    fuel: 90,
    oxygen: 100,
    objectives: [gate(0, 200), gate(90, 150), gate(180, 110), land()],
    events: [],
    parSeconds: 36,
    comboWindowSeconds: 7,
    stars: [2400, 2900],
  },
  {
    id: 'gyro-trouble',
    name: 'Gyro Trouble',
    briefing: 'Complete one orbit, then land on the pad. The gyros are failing: when the alarm sounds, stop the spin as fast as you can.',
    tip: 'Keep a finger on S. Reaction time is scored from the alarm until the ship is steady.',
    spawn: orbiting(90, 160),
    fuel: 90,
    oxygen: 100,
    objectives: [orbit(1), landOnPad(0, 16)],
    events: [gyroFault(3, 6), gyroFault(10, 14), gyroFault(19, 24)],
    parSeconds: 45,
    comboWindowSeconds: 0,
    stars: [3000, 3700],
  },
  {
    id: 'slalom',
    name: 'Slalom',
    briefing: 'Five gates, alternating high and low. Keep the chain alive, grab the bonus beacon if you dare, and finish on the pad.',
    tip: 'Small, early burns beat big late ones. The beacon is worth more the faster you reach it.',
    spawn: orbiting(350, 220),
    fuel: 75,
    oxygen: 100,
    objectives: [
      gate(40, 120),
      gate(95, 215),
      gate(150, 115),
      gate(210, 210),
      gate(270, 120),
      landOnPad(330, 14),
    ],
    events: [beacon(8, 14)],
    parSeconds: 48,
    comboWindowSeconds: 7,
    stars: [3200, 4300],
  },
  {
    id: 'crater-hop',
    name: 'Crater Hop',
    briefing: 'Lift off and hop from pad to pad. Expect a gyro fault and a bonus beacon on the way.',
    tip: 'Climb first, then tilt. Near the ground a tilted engine cannot hold the ship up.',
    spawn: landedAt(0),
    fuel: 100,
    oxygen: 100,
    objectives: [landOnPad(75, 13), landOnPad(200, 13)],
    events: [gyroFault(5, 9), beacon(13, 19)],
    parSeconds: 36,
    comboWindowSeconds: 0,
    stars: [3000, 3700],
  },
]);
