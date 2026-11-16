import { MOON, SHIP, TICKS_PER_SECOND, WORLD } from '../config.js';
import {
  altitudeOf,
  bearingDelta,
  bearingOf,
  distanceBetween,
  pointAtBearing,
  predictTrajectory,
} from '../sim/physics.js';
import { CrashReason, SimEvent, Simulation } from '../sim/simulation.js';
import { EventType, ObjectiveType } from './levels.js';
import {
  beaconScore,
  COMBO,
  completionBonuses,
  gateScore,
  landingScore,
  nextCombo,
  reactionGrade,
  SCORE,
  starsFor,
} from './scoring.js';

export const MissionStatus = Object.freeze({
  ACTIVE: 'active',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

export const FailReason = Object.freeze({
  CRASH_SPEED: 'crashSpeed',
  CRASH_TILT: 'crashTilt',
  OXYGEN: 'oxygen',
  SIGNAL_LOST: 'signalLost',
});

/** What Mission.update() reports back for the UI to show. */
export const FeedbackKind = Object.freeze({ SCORE: 'score', ALERT: 'alert' });
export const Tone = Object.freeze({ GOOD: 'good', WARN: 'warn', INFO: 'info' });

export const MISSION_RULES = Object.freeze({
  /** Flying further than this from the moon's centre fails the mission. */
  signalRange: 900,
  signalWarningRange: 780,
  gyroFault: Object.freeze({
    kickVelocity: 0.09,
    /** Rotation slower than this counts as "steady again". */
    steadyBelow: 0.01,
    /** The kick itself needs a moment before recovery can be judged. */
    minTicks: 6,
    timeoutSeconds: 6,
    /** Faults wait until the ship has room to recover. */
    minAltitude: 35,
  }),
  beacon: Object.freeze({
    radius: 18,
    lifetimeSeconds: 7,
    /** How far ahead on the predicted path the beacon appears. */
    lookaheadTicks: 150,
    /** Sideways distance from the predicted path. */
    pathOffset: 55,
    minAltitude: 30,
    worldMargin: 40,
    retrySeconds: 0.5,
  }),
});

const seconds = (ticks) => ticks / TICKS_PER_SECOND;
const ticksOf = (secs) => Math.round(secs * TICKS_PER_SECOND);

/**
 * Runtime state of one attempt at a level: objective progress, reaction
 * events, combo chain and score. Has no DOM access.
 */
export class Mission {
  #random;
  #pendingEvents;
  #feedback = [];
  #awards = new Map();
  #splitStartTick = 0;
  #comboTicksLeft = 0;
  #orbit = { lastBearing: null, sweptDeg: 0 };

  /**
   * @param {import('./levels.js').Level} level
   * @param {{ random?: () => number }} [options]
   */
  constructor(level, { random = Math.random } = {}) {
    this.level = level;
    this.#random = random;
    this.status = MissionStatus.ACTIVE;
    this.failReason = null;
    this.score = 0;
    this.combo = COMBO.start;
    this.objectiveIndex = 0;
    this.objectives = level.objectives.map((objective) => resolveObjective(objective));
    /** Active gyro fault, or null. */
    this.fault = null;
    /** Active bonus beacon, or null. */
    this.beacon = null;
    this.signalWeak = false;
    this.elapsedSeconds = 0;
    this.finalFuel = 0;

    this.#pendingEvents = level.events.map((event) => ({
      type: event.type,
      dueTick: ticksOf(event.window[0] + random() * (event.window[1] - event.window[0])),
    }));
  }

  /** A fresh world set up for this level. */
  createSimulation() {
    const { spawn, fuel, oxygen } = this.level;
    return new Simulation({ spawn, fuel, oxygen, random: this.#random });
  }

  get currentObjective() {
    return this.objectives[this.objectiveIndex] ?? null;
  }

  get isActive() {
    return this.status === MissionStatus.ACTIVE;
  }

  /** Share of the combo window that is left (0..1); 0 when no chain is running. */
  get comboTimeLeft() {
    const windowTicks = ticksOf(this.level.comboWindowSeconds);
    return windowTicks > 0 ? this.#comboTicksLeft / windowTicks : 0;
  }

  /** Progress of the current orbit objective (0..1). */
  get orbitProgress() {
    const objective = this.currentObjective;
    if (objective?.type !== ObjectiveType.ORBIT) return 0;
    return Math.min(1, Math.abs(this.#orbit.sweptDeg) / (360 * objective.laps));
  }

  /**
   * Call once per tick, after Simulation.step().
   * @param {Simulation} sim
   * @param {{type: string}[]} simEvents events returned by sim.step()
   * @returns {Object[]} feedback for the UI (score pop-ups and alerts)
   */
  update(sim, simEvents) {
    this.#feedback = [];
    if (!this.isActive) return this.#feedback;

    for (const event of simEvents) {
      this.#handleSimEvent(sim, event);
      if (!this.isActive) return this.#feedback;
    }

    this.#checkSignal(sim);
    if (!this.isActive) return this.#feedback;

    this.#tickCombo();
    this.#trackFlightObjective(sim);
    this.#triggerDueEvents(sim);
    this.#updateFault(sim);
    this.#updateBeacon(sim);

    if (this.objectiveIndex >= this.objectives.length) {
      this.#complete(sim);
    }
    return this.#feedback;
  }

  /** Summary for the result screen. */
  result() {
    const completed = this.status === MissionStatus.COMPLETE;
    return {
      completed,
      failReason: this.failReason,
      score: this.score,
      stars: completed ? starsFor(this.score, this.level.stars) : 0,
      elapsedSeconds: this.elapsedSeconds,
      breakdown: [...this.#awards].map(([label, { points, count }]) => ({ label, points, count })),
    };
  }

  // --- simulation events -------------------------------------------------

  #handleSimEvent(sim, event) {
    switch (event.type) {
      case SimEvent.CRASHED:
        this.#fail(
          sim,
          event.reason === CrashReason.TILT ? FailReason.CRASH_TILT : FailReason.CRASH_SPEED
        );
        break;
      case SimEvent.OXYGEN_DEPLETED:
        this.#fail(sim, FailReason.OXYGEN);
        break;
      case SimEvent.LANDED:
        this.#handleLanding(sim, event);
        break;
      default:
        break;
    }
  }

  #handleLanding(sim, touchdown) {
    this.#orbit.sweptDeg = 0;
    const objective = this.currentObjective;
    if (objective?.type !== ObjectiveType.LAND) {
      this.#alert('Not yet! Lift off and finish the flight objectives first.', Tone.WARN);
      return;
    }

    let padOffset = null;
    if (objective.pad) {
      const error = Math.abs(bearingDelta(objective.pad.bearing, bearingOf(sim.ship, sim.moon)));
      padOffset = error / objective.pad.halfWidth;
      if (padOffset > 1) {
        this.#alert('Missed the pad. Lift off and try again.', Tone.WARN);
        return;
      }
    }

    for (const award of landingScore({ ...touchdown, padOffset })) {
      this.#award(award.label, award.points);
    }
    this.#popUp(`TOUCHDOWN +${SCORE.landing}`, sim.ship);
    this.#advanceObjective(sim);
  }

  #checkSignal(sim) {
    const distance = distanceBetween(sim.ship, sim.moon);
    this.signalWeak = distance > MISSION_RULES.signalWarningRange;
    if (distance > MISSION_RULES.signalRange) {
      this.#fail(sim, FailReason.SIGNAL_LOST);
    }
  }

  // --- objectives --------------------------------------------------------

  #trackFlightObjective(sim) {
    const objective = this.currentObjective;
    if (objective?.type === ObjectiveType.GATE) {
      if (distanceBetween(sim.ship, objective) < objective.radius) {
        this.#passGate(sim, objective);
      }
    } else if (objective?.type === ObjectiveType.ORBIT) {
      this.#trackOrbit(sim, objective);
    }
  }

  #passGate(sim, gate) {
    const chained = this.#comboTicksLeft > 0;
    if (chained) this.combo = nextCombo(this.combo);
    this.#comboTicksLeft = ticksOf(this.level.comboWindowSeconds);

    const split = seconds(sim.ticks - this.#splitStartTick);
    const points = gateScore(split, gate.par, this.combo);
    const comboText = this.combo > COMBO.start ? ` x${this.combo}` : '';
    this.#award('Gates', points);
    this.#popUp(`+${points}${comboText}`, gate);
    this.#advanceObjective(sim);
  }

  #trackOrbit(sim, objective) {
    const bearing = bearingOf(sim.ship, sim.moon);
    if (this.#orbit.lastBearing !== null && sim.isFlying) {
      this.#orbit.sweptDeg += bearingDelta(this.#orbit.lastBearing, bearing);
    }
    this.#orbit.lastBearing = bearing;

    if (Math.abs(this.#orbit.sweptDeg) >= 360 * objective.laps) {
      this.#award('Orbit', SCORE.orbit);
      this.#popUp(`ORBIT +${SCORE.orbit}`, sim.ship);
      this.#advanceObjective(sim);
    }
  }

  #advanceObjective(sim) {
    this.objectiveIndex++;
    this.#splitStartTick = sim.ticks;
    this.#orbit = { lastBearing: null, sweptDeg: 0 };
  }

  #tickCombo() {
    if (this.#comboTicksLeft === 0) return;
    this.#comboTicksLeft--;
    if (this.#comboTicksLeft === 0) this.combo = COMBO.start;
  }

  // --- reaction events ---------------------------------------------------

  #triggerDueEvents(sim) {
    for (const event of this.#pendingEvents) {
      if (event.done || sim.ticks < event.dueTick) continue;
      const started =
        event.type === EventType.GYRO_FAULT ? this.#startFault(sim) : this.#spawnBeacon(sim);
      if (started) {
        event.done = true;
      } else {
        event.dueTick = sim.ticks + ticksOf(MISSION_RULES.beacon.retrySeconds);
      }
    }
  }

  #startFault(sim) {
    const hasRoom = altitudeOf(sim.ship, sim.moon) >= MISSION_RULES.gyroFault.minAltitude;
    if (!sim.isFlying || !hasRoom || this.fault) return false;
    const direction = this.#random() < 0.5 ? -1 : 1;
    sim.kickRotation(direction * MISSION_RULES.gyroFault.kickVelocity);
    this.fault = { startTick: sim.ticks };
    this.#alert('GYRO FAULT! Stabilize!', Tone.WARN);
    return true;
  }

  #updateFault(sim) {
    if (!this.fault) return;
    const rules = MISSION_RULES.gyroFault;
    const faultTicks = sim.ticks - this.fault.startTick;
    const steady = Math.abs(sim.ship.rotationVelocity) < rules.steadyBelow;

    if (faultTicks >= rules.minTicks && steady) {
      const grade = reactionGrade(seconds(faultTicks));
      this.fault = null;
      this.#award('Reaction', grade.points);
      this.#popUp(`${grade.label} ${seconds(faultTicks).toFixed(2)}s +${grade.points}`, sim.ship);
    } else if (seconds(faultTicks) > rules.timeoutSeconds) {
      this.fault = null;
      this.#alert('Gyro fault not contained. No reaction bonus.', Tone.INFO);
    }
  }

  /** Places a beacon beside the predicted flight path, where a quick burn can reach it. */
  #spawnBeacon(sim) {
    if (!sim.isFlying || this.beacon) return false;
    const rules = MISSION_RULES.beacon;
    const { points } = predictTrajectory(sim.ship, sim.moon, rules.lookaheadTicks);
    if (points.length < rules.lookaheadTicks) return false;

    const ahead = points[points.length - 1];
    const before = points[points.length - 10];
    const length = distanceBetween(before, ahead) || 1;
    const sideways = { x: -(ahead.y - before.y) / length, y: (ahead.x - before.x) / length };
    const firstSide = this.#random() < 0.5 ? -1 : 1;

    for (const side of [firstSide, -firstSide]) {
      const spot = {
        x: ahead.x + sideways.x * rules.pathOffset * side,
        y: ahead.y + sideways.y * rules.pathOffset * side,
      };
      if (isValidBeaconSpot(spot, sim.moon)) {
        const lifetimeTicks = ticksOf(rules.lifetimeSeconds);
        this.beacon = { ...spot, radius: rules.radius, ticksLeft: lifetimeTicks, lifetimeTicks };
        this.#alert('Bonus beacon detected!', Tone.GOOD);
        return true;
      }
    }
    return false;
  }

  #updateBeacon(sim) {
    const beacon = this.beacon;
    if (!beacon) return;

    if (distanceBetween(sim.ship, beacon) < beacon.radius + sim.ship.radius) {
      const points = beaconScore(beacon.ticksLeft / beacon.lifetimeTicks);
      this.beacon = null;
      this.#award('Beacons', points);
      this.#popUp(`BEACON +${points}`, beacon);
      return;
    }
    beacon.ticksLeft--;
    if (beacon.ticksLeft <= 0) {
      this.beacon = null;
      this.#alert('Beacon lost.', Tone.INFO);
    }
  }

  // --- outcome -----------------------------------------------------------

  #complete(sim) {
    this.#finish(sim, MissionStatus.COMPLETE);
    const bonuses = completionBonuses({
      elapsedSeconds: this.elapsedSeconds,
      parSeconds: this.level.parSeconds,
      fuel: sim.fuel,
    });
    for (const bonus of bonuses) this.#award(bonus.label, bonus.points);
  }

  #fail(sim, reason) {
    this.failReason = reason;
    this.#finish(sim, MissionStatus.FAILED);
  }

  #finish(sim, status) {
    this.status = status;
    this.elapsedSeconds = seconds(sim.ticks);
    this.finalFuel = sim.fuel;
    this.fault = null;
    this.beacon = null;
  }

  // --- bookkeeping -------------------------------------------------------

  #award(label, points) {
    this.score += points;
    const entry = this.#awards.get(label) ?? { points: 0, count: 0 };
    entry.points += points;
    entry.count++;
    this.#awards.set(label, entry);
  }

  #popUp(text, at) {
    this.#feedback.push({ kind: FeedbackKind.SCORE, text, x: at.x, y: at.y });
  }

  #alert(text, tone) {
    this.#feedback.push({ kind: FeedbackKind.ALERT, text, tone });
  }
}

/** Adds world coordinates to objectives that have a fixed place. */
function resolveObjective(objective) {
  if (objective.type !== ObjectiveType.GATE) return { ...objective };
  const distance = MOON.radius + SHIP.radius + objective.altitude;
  return { ...objective, ...pointAtBearing(MOON, objective.bearing, distance) };
}

function isValidBeaconSpot(spot, moon) {
  const { minAltitude, worldMargin } = MISSION_RULES.beacon;
  const highEnough = distanceBetween(spot, moon) >= moon.radius + minAltitude;
  const onScreen =
    spot.x >= worldMargin &&
    spot.x <= WORLD.width - worldMargin &&
    spot.y >= worldMargin &&
    spot.y <= WORLD.height - worldMargin;
  return highEnough && onScreen;
}
