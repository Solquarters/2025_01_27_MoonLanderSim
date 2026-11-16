/**
 * Pure scoring rules. Every function returns points (or labelled point lists)
 * and has no side effects, so the reward balance can be tuned and tested here.
 */

import { LANDING } from '../config.js';
import { clamp } from '../sim/physics.js';

export const SCORE = Object.freeze({
  gate: 200,
  /** Extra points for reaching a gate well under its par time. */
  gateSpeedBonus: 200,
  orbit: 600,
  landing: 1000,
  softTouchdown: 400,
  uprightTouchdown: 300,
  padCentre: 300,
  beaconMax: 400,
  beaconMin: 100,
  timeBonusPerSecond: 20,
  fuelBonusPerPercent: 5,
});

export const COMBO = Object.freeze({ start: 1, step: 0.5, max: 3 });

/**
 * Reaction grades for recovering from a gyro fault, fastest first.
 * `maxSeconds` is the time from the fault until the ship is steady again.
 */
export const REACTION_GRADES = Object.freeze([
  Object.freeze({ maxSeconds: 0.75, label: 'LIGHTNING', points: 500 }),
  Object.freeze({ maxSeconds: 1.2, label: 'SHARP', points: 350 }),
  Object.freeze({ maxSeconds: 2, label: 'STEADY', points: 200 }),
  Object.freeze({ maxSeconds: Infinity, label: 'SLOW', points: 75 }),
]);

/** Multiplier after chaining one more gate inside the combo window. */
export function nextCombo(combo) {
  return Math.min(COMBO.max, combo + COMBO.step);
}

/**
 * Points for flying through a gate.
 * @param {number} splitSeconds time since the previous objective (or mission start)
 * @param {number} parSeconds   split time that earns no speed bonus
 * @param {number} combo        current chain multiplier
 */
export function gateScore(splitSeconds, parSeconds, combo) {
  const earliness = clamp(1 - splitSeconds / parSeconds, 0, 1);
  return Math.round((SCORE.gate + SCORE.gateSpeedBonus * earliness) * combo);
}

/**
 * Points for a successful touchdown, split by what earned them.
 * @param {Object} touchdown
 * @param {number} touchdown.speed
 * @param {number} touchdown.tiltDeg         absolute tilt at touchdown
 * @param {number|null} touchdown.padOffset  0 = pad centre, 1 = pad edge, null = no pad
 * @returns {{label: string, points: number}[]}
 */
export function landingScore({ speed, tiltDeg, padOffset }) {
  const softness = clamp(1 - speed / LANDING.maxSpeed, 0, 1);
  const uprightness = clamp(1 - tiltDeg / LANDING.maxTiltDeg, 0, 1);
  const awards = [
    { label: 'Touchdown', points: SCORE.landing },
    { label: 'Soft touch', points: Math.round(SCORE.softTouchdown * softness) },
    { label: 'Upright', points: Math.round(SCORE.uprightTouchdown * uprightness) },
  ];
  if (padOffset !== null) {
    const accuracy = clamp(1 - padOffset, 0, 1);
    awards.push({ label: 'Pad accuracy', points: Math.round(SCORE.padCentre * accuracy) });
  }
  return awards;
}

/** @returns {{label: string, points: number, maxSeconds: number}} */
export function reactionGrade(seconds) {
  return REACTION_GRADES.find((grade) => seconds <= grade.maxSeconds);
}

/** Points for a bonus beacon; `remaining` is the share of its lifetime left (0..1). */
export function beaconScore(remaining) {
  const share = clamp(remaining, 0, 1);
  return Math.round(SCORE.beaconMin + (SCORE.beaconMax - SCORE.beaconMin) * share);
}

/** End-of-mission bonuses for speed and efficiency. */
export function completionBonuses({ elapsedSeconds, parSeconds, fuel }) {
  return [
    {
      label: 'Time bonus',
      points: Math.round(Math.max(0, parSeconds - elapsedSeconds) * SCORE.timeBonusPerSecond),
    },
    { label: 'Fuel bonus', points: Math.round(Math.max(0, fuel) * SCORE.fuelBonusPerPercent) },
  ];
}

/**
 * Star rating for a completed mission.
 * @param {number} score
 * @param {[number, number]} thresholds scores needed for two and three stars
 */
export function starsFor(score, [twoStars, threeStars]) {
  if (score >= threeStars) return 3;
  return score >= twoStars ? 2 : 1;
}
