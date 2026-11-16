import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANDING, MOON, SHIP, SUPPLIES, TICKS_PER_SECOND } from '../js/config.js';
import { CrashReason, ShipStatus, SimEvent, Simulation } from '../js/sim/simulation.js';

const IDLE = Object.freeze({
  thrust: false,
  reverse: false,
  rotateLeft: false,
  rotateRight: false,
  stabilize: false,
});
const TOUCH_DISTANCE = MOON.radius + SHIP.radius;

/** Spawn point directly above the moon's north pole, feet down. */
const above = (altitude, extra = {}) => ({
  x: MOON.x,
  y: MOON.y - TOUCH_DISTANCE - altitude,
  vx: 0,
  vy: 0,
  rotation: 0,
  rotationVelocity: 0,
  ...extra,
});

function runUntilEvent(sim, controls = IDLE, maxTicks = 5000) {
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.step(controls);
    if (events.length > 0) return events;
  }
  throw new Error('no event within the tick limit');
}

test('a gentle, upright touchdown lands the ship', () => {
  const sim = new Simulation({ spawn: above(5) });
  const [event] = runUntilEvent(sim);

  assert.equal(event.type, SimEvent.LANDED);
  assert.ok(event.speed < LANDING.maxSpeed);
  assert.equal(sim.ship.status, ShipStatus.LANDED);
  assert.deepEqual([sim.ship.vx, sim.ship.vy], [0, 0]);
});

test('a fast touchdown destroys the ship and scatters debris', () => {
  const sim = new Simulation({ spawn: above(200) });
  const [event] = runUntilEvent(sim);

  assert.equal(event.type, SimEvent.CRASHED);
  assert.equal(event.reason, CrashReason.SPEED);
  assert.equal(sim.ship.status, ShipStatus.DESTROYED);
  assert.ok(sim.debris.length > 0);
});

test('touching down on the side destroys the ship even when slow', () => {
  const sim = new Simulation({ spawn: above(5, { rotation: Math.PI / 2 }) });
  const [event] = runUntilEvent(sim);

  assert.equal(event.type, SimEvent.CRASHED);
  assert.equal(event.reason, CrashReason.TILT);
});

test('a landed ship stays put until the main engine lifts it off', () => {
  const sim = new Simulation({ spawn: above(5) });
  runUntilEvent(sim);
  const restingY = sim.ship.y;

  for (let i = 0; i < 60; i++) assert.deepEqual(sim.step(IDLE), []);
  assert.equal(sim.ship.y, restingY);

  const [event] = runUntilEvent(sim, { ...IDLE, thrust: true });
  assert.equal(event.type, SimEvent.LIFTOFF);
  assert.equal(sim.ship.status, ShipStatus.FLYING);
});

test('engines burn fuel and stop when the tank is empty', () => {
  const sim = new Simulation({ spawn: above(5000), fuel: 1 });
  const burning = { ...IDLE, thrust: true };

  sim.step(burning);
  assert.equal(sim.thrusters.main, true);
  assert.ok(sim.fuel < 1);

  for (let i = 0; i < TICKS_PER_SECOND; i++) sim.step(burning);
  assert.equal(sim.fuel, 0);
  assert.equal(sim.thrusters.main, false);
});

test('fuel lasts as long as the configured burn rate says', () => {
  const sim = new Simulation({ spawn: above(5000), fuel: SUPPLIES.fuelBurnPerSecond });
  for (let i = 0; i < TICKS_PER_SECOND - 1; i++) sim.step({ ...IDLE, thrust: true });
  assert.ok(sim.fuel > 0);
});

test('the stabilizer brings rotation to a full stop without overshooting', () => {
  const sim = new Simulation({ spawn: above(5000, { rotationVelocity: 0.02 }) });
  for (let i = 0; i < 10; i++) sim.step({ ...IDLE, stabilize: true });
  assert.equal(sim.ship.rotationVelocity, 0);
});

test('rotation speed is capped', () => {
  const sim = new Simulation({ spawn: above(5000) });
  for (let i = 0; i < 200; i++) sim.step({ ...IDLE, rotateRight: true });
  assert.equal(sim.ship.rotationVelocity, SHIP.maxRotationVelocity);
});

test('running out of oxygen ends the flight', () => {
  const sim = new Simulation({ spawn: above(5000), oxygen: 0.01 });
  const [event] = runUntilEvent(sim);

  assert.equal(event.type, SimEvent.OXYGEN_DEPLETED);
  assert.equal(sim.ship.status, ShipStatus.LOST);
  assert.deepEqual(sim.step({ ...IDLE, thrust: true }), []);
  assert.equal(sim.thrusters.main, false);
});

test('mission time follows simulated ticks', () => {
  const sim = new Simulation({ spawn: above(5000) });
  for (let i = 0; i < TICKS_PER_SECOND * 2; i++) sim.step(IDLE);
  assert.ok(Math.abs(sim.elapsedMs - 2000) < 1e-6);
});
