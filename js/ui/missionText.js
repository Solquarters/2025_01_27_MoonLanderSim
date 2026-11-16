/** Player-facing wording for objectives and outcomes. */

import { LANDING } from '../config.js';
import { ObjectiveType } from '../levels/levels.js';
import { FailReason } from '../levels/mission.js';

const FAILURES = Object.freeze({
  [FailReason.CRASH_SPEED]: {
    title: 'Ship destroyed',
    detail: `Touchdown was too fast. Slow down below ${LANDING.maxSpeed} before you reach the surface.`,
  },
  [FailReason.CRASH_TILT]: {
    title: 'Ship destroyed',
    detail: `The ship tipped over. Land within ${LANDING.maxTiltDeg}° of upright (roll indicator green).`,
  },
  [FailReason.OXYGEN]: {
    title: 'Oxygen depleted',
    detail: 'The crew ran out of air. Fly a more direct route.',
  },
  [FailReason.SIGNAL_LOST]: {
    title: 'Signal lost',
    detail: 'The ship drifted too far from the moon. Turn back when the weak-signal warning appears.',
  },
});

/** @returns {{title: string, detail: string}} */
export function describeFailure(failReason) {
  return FAILURES[failReason];
}

/** One line per objective, for the briefing. */
export function describeObjectives(level) {
  const lines = [];
  const gateCount = level.objectives.filter((o) => o.type === ObjectiveType.GATE).length;
  let gatesListed = false;

  for (const objective of level.objectives) {
    if (objective.type === ObjectiveType.GATE) {
      if (!gatesListed) {
        lines.push(gateCount === 1 ? 'Fly through the gate' : `Fly through ${gateCount} gates in order`);
        gatesListed = true;
      }
    } else if (objective.type === ObjectiveType.ORBIT) {
      lines.push(objective.laps === 1 ? 'Complete one orbit' : `Complete ${objective.laps} orbits`);
    } else {
      lines.push(objective.pad ? 'Land on the marked pad' : 'Land anywhere');
    }
  }
  return lines;
}

/** Short status line for the objective that is currently active. */
export function describeCurrentObjective(mission) {
  const objective = mission.currentObjective;
  if (!objective) return 'Mission complete';

  switch (objective.type) {
    case ObjectiveType.GATE: {
      const gates = mission.objectives.filter((o) => o.type === ObjectiveType.GATE);
      return `Gate ${gates.indexOf(objective) + 1} of ${gates.length}`;
    }
    case ObjectiveType.ORBIT:
      return `Orbit the moon: ${Math.floor(mission.orbitProgress * 100)}%`;
    default:
      return objective.pad ? 'Land on the pad' : 'Land anywhere';
  }
}

/** "x1.5" style multiplier text. */
export function formatCombo(combo) {
  return `x${Number.isInteger(combo) ? combo : combo.toFixed(1)}`;
}

export function formatScore(score) {
  return score.toLocaleString('en-US');
}
