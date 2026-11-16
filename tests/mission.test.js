import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GRAVITY_CONSTANT, MOON, SHIP, TICKS_PER_SECOND } from '../js/config.js';
import { EventType, LEVELS, ObjectiveType } from '../js/levels/levels.js';
import {
  FailReason,
  FeedbackKind,
  Mission,
  MISSION_RULES,
  MissionStatus,
} from '../js/levels/mission.js';
import { COMBO, SCORE } from '../js/levels/scoring.js';
import { distanceBetween, pointAtBearing } from '../js/sim/physics.js';

const IDLE = Object.freeze({
  thrust: false,
  reverse: false,
  rotateLeft: false,
  rotateRight: false,
  stabilize: false,
});
const SURFACE = MOON.radius + SHIP.radius;
const fixedRandom = () => 0.5;

const above = (altitude, extra = {}) => ({
  x: MOON.x,
  y: MOON.y - SURFACE - altitude,
  vx: 0,
  vy: 0,
  rotation: 0,
  rotationVelocity: 0,
  ...extra,
});

const orbitAbove = (altitude) =>
  above(altitude, {
    vx: Math.sqrt((GRAVITY_CONSTANT * MOON.mass * SHIP.mass) / (SURFACE + altitude)),
  });

const levelWith = (overrides) => ({
  id: 'test',
  name: 'Test',
  briefing: '',
  tip: '',
  spawn: above(5),
  fuel: 100,
  oxygen: 100,
  objectives: [{ type: ObjectiveType.LAND, pad: null }],
  events: [],
  parSeconds: 30,
  comboWindowSeconds: 5,
  stars: [1500, 2500],
  ...overrides,
});

const gateAt = (bearing, altitude, par = 6) => ({
  type: ObjectiveType.GATE,
  bearing,
  altitude,
  radius: 26,
  par,
});

/** Runs the mission until it ends or `until` returns true; returns all feedback. */
function fly(level, { controls = () => IDLE, until = () => false, maxTicks = 6000 } = {}) {
  const mission = new Mission(level, { random: fixedRandom });
  const sim = mission.createSimulation();
  const feedback = [];
  for (let i = 0; i < maxTicks && mission.isActive && !until(mission, sim); i++) {
    feedback.push(...mission.update(sim, sim.step(controls(mission, sim))));
  }
  return { mission, sim, feedback };
}

test('landing anywhere completes a land objective and adds completion bonuses', () => {
  const { mission } = fly(levelWith({}));
  const result = mission.result();

  assert.equal(mission.status, MissionStatus.COMPLETE);
  assert.equal(result.completed, true);
  const labels = result.breakdown.map((entry) => entry.label);
  for (const label of ['Touchdown', 'Soft touch', 'Upright', 'Time bonus', 'Fuel bonus']) {
    assert.ok(labels.includes(label), `missing ${label}`);
  }
  assert.equal(result.score, result.breakdown.reduce((sum, entry) => sum + entry.points, 0));
  assert.ok(result.stars >= 1);
});

test('landing beside the pad does not count', () => {
  const level = levelWith({
    objectives: [{ type: ObjectiveType.LAND, pad: { bearing: 180, halfWidth: 15 } }],
  });
  const { mission, sim, feedback } = fly(level, { until: (_, s) => s.isLanded });

  assert.equal(sim.isLanded, true);
  assert.equal(mission.status, MissionStatus.ACTIVE);
  assert.equal(mission.score, 0);
  assert.ok(feedback.some((item) => item.kind === FeedbackKind.ALERT));
});

test('landing on the pad scores accuracy', () => {
  const level = levelWith({
    objectives: [{ type: ObjectiveType.LAND, pad: { bearing: 0, halfWidth: 15 } }],
  });
  const { mission } = fly(level);
  const accuracy = mission.result().breakdown.find((entry) => entry.label === 'Pad accuracy');

  assert.equal(mission.status, MissionStatus.COMPLETE);
  assert.equal(accuracy.points, SCORE.padCentre);
});

test('a crash fails the mission and earns no stars', () => {
  const { mission } = fly(levelWith({ spawn: above(200) }));
  assert.equal(mission.status, MissionStatus.FAILED);
  assert.equal(mission.failReason, FailReason.CRASH_SPEED);
  assert.equal(mission.result().stars, 0);
});

test('flying out of signal range fails the mission', () => {
  const { mission } = fly(levelWith({ spawn: above(600, { vy: -20 }) }));
  assert.equal(mission.failReason, FailReason.SIGNAL_LOST);
});

test('gates must be taken in order and chain into a combo', () => {
  // Two gates on a circular orbit: coasting passes both.
  const level = levelWith({
    spawn: orbitAbove(150),
    objectives: [gateAt(20, 150), gateAt(45, 150)],
    comboWindowSeconds: 10,
  });
  const { mission, feedback } = fly(level);

  assert.equal(mission.status, MissionStatus.COMPLETE);
  const gates = mission.result().breakdown.find((entry) => entry.label === 'Gates');
  assert.equal(gates.count, 2);
  assert.ok(gates.points >= SCORE.gate + SCORE.gate * (COMBO.start + COMBO.step));
  assert.equal(feedback.filter((item) => item.kind === FeedbackKind.SCORE).length, 2);
});

test('the combo expires when the next gate takes too long', () => {
  const level = levelWith({
    spawn: orbitAbove(150),
    objectives: [gateAt(20, 150), gateAt(120, 150)],
    comboWindowSeconds: 1,
  });
  const { mission } = fly(level, { until: (m) => m.objectiveIndex === 2 });
  assert.equal(mission.combo, COMBO.start);
});

test('a later gate is ignored until the earlier ones are done', () => {
  const level = levelWith({
    spawn: orbitAbove(150),
    objectives: [gateAt(200, 150), gateAt(10, 150)],
  });
  const { mission } = fly(level, { maxTicks: 3 * TICKS_PER_SECOND });
  assert.equal(mission.objectiveIndex, 0);
});

test('one full orbit completes the orbit objective', () => {
  const level = levelWith({
    spawn: orbitAbove(150),
    objectives: [{ type: ObjectiveType.ORBIT, laps: 1 }],
  });
  const halfway = fly(level, { until: (m) => m.orbitProgress >= 0.5 });
  assert.equal(halfway.mission.status, MissionStatus.ACTIVE);

  const { mission } = fly(level);
  assert.equal(mission.status, MissionStatus.COMPLETE);
  assert.ok(mission.result().breakdown.some((entry) => entry.label === 'Orbit'));
});

test('a gyro fault spins the ship and rewards a quick recovery', () => {
  const level = levelWith({
    spawn: orbitAbove(200),
    objectives: [{ type: ObjectiveType.ORBIT, laps: 5 }],
    events: [{ type: EventType.GYRO_FAULT, window: [1, 1] }],
  });
  let faultSeen = false;
  const { mission, feedback } = fly(level, {
    controls: (m) => {
      faultSeen ||= m.fault !== null;
      return m.fault ? { ...IDLE, stabilize: true } : IDLE;
    },
    maxTicks: 4 * TICKS_PER_SECOND,
  });

  assert.equal(faultSeen, true);
  assert.equal(mission.fault, null);
  assert.ok(mission.score > 0, 'expected a reaction award');
  assert.ok(feedback.some((item) => item.text?.includes('LIGHTNING')));
});

test('an ignored gyro fault times out without points', () => {
  const level = levelWith({
    spawn: orbitAbove(200),
    objectives: [{ type: ObjectiveType.ORBIT, laps: 5 }],
    events: [{ type: EventType.GYRO_FAULT, window: [0.5, 0.5] }],
  });
  const ticks = (MISSION_RULES.gyroFault.timeoutSeconds + 2) * TICKS_PER_SECOND;
  const { mission, sim } = fly(level, { maxTicks: ticks });

  assert.equal(mission.fault, null);
  assert.equal(mission.score, 0);
  assert.notEqual(sim.ship.rotationVelocity, 0);
});

test('gyro faults wait until the ship has room to recover', () => {
  const level = levelWith({
    spawn: { ...above(0), landed: true },
    events: [{ type: EventType.GYRO_FAULT, window: [0.1, 0.1] }],
  });
  const { mission, sim } = fly(level, { maxTicks: 2 * TICKS_PER_SECOND });

  assert.equal(mission.fault, null);
  assert.equal(sim.ship.rotationVelocity, 0);
});

test('a bonus beacon appears off the flight path and can expire', () => {
  const level = levelWith({
    spawn: orbitAbove(200),
    objectives: [{ type: ObjectiveType.ORBIT, laps: 5 }],
    events: [{ type: EventType.BEACON, window: [0.5, 0.5] }],
  });
  const spawned = fly(level, { until: (m) => m.beacon !== null });
  const { beacon } = spawned.mission;
  assert.ok(beacon, 'expected a beacon');
  assert.ok(distanceBetween(beacon, MOON) > MOON.radius + MISSION_RULES.beacon.minAltitude);

  const ticks = (MISSION_RULES.beacon.lifetimeSeconds + 2) * TICKS_PER_SECOND;
  const expired = fly(level, { maxTicks: ticks });
  assert.equal(expired.mission.beacon, null);
  assert.equal(expired.mission.score, 0);
});

test('every campaign level is well-formed', () => {
  const ids = new Set();
  for (const level of LEVELS) {
    assert.ok(!ids.has(level.id), `duplicate id ${level.id}`);
    ids.add(level.id);

    assert.ok(level.name && level.briefing && level.tip, `${level.id}: texts`);
    assert.ok(level.objectives.length > 0, `${level.id}: objectives`);
    assert.ok(level.stars[0] < level.stars[1], `${level.id}: star thresholds`);
    assert.ok(distanceBetween(level.spawn, MOON) >= SURFACE - 1e-9, `${level.id}: spawn inside moon`);

    for (const objective of level.objectives) {
      assert.ok(Object.values(ObjectiveType).includes(objective.type), `${level.id}: objective type`);
      if (objective.type === ObjectiveType.GATE) {
        const position = pointAtBearing(MOON, objective.bearing, SURFACE + objective.altitude);
        assert.ok(position.x > 0 && position.x < 1200 && position.y > 0 && position.y < 800, `${level.id}: gate off screen`);
      }
    }
    if (level.objectives.some((objective) => objective.type === ObjectiveType.GATE)) {
      assert.ok(level.comboWindowSeconds > 0, `${level.id}: gates need a combo window`);
    }

    const mission = new Mission(level, { random: fixedRandom });
    const sim = mission.createSimulation();
    assert.deepEqual(mission.update(sim, sim.step(IDLE)), []);
    assert.equal(mission.status, MissionStatus.ACTIVE);
  }
});
