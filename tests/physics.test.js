import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GRAVITY_CONSTANT, MOON, SHIP } from '../js/config.js';
import {
  altitudeOf,
  gravityPull,
  predictTrajectory,
  surfacePointBelow,
  tiltFromVertical,
  toDegrees,
  wrapAngle,
} from '../js/sim/physics.js';

const shipAt = (x, y, extra = {}) => ({
  x,
  y,
  vx: 0,
  vy: 0,
  rotation: 0,
  radius: SHIP.radius,
  mass: SHIP.mass,
  ...extra,
});

const closeTo = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not close to ${expected}`);

test('gravity pulls towards the moon with inverse-square strength', () => {
  const near = gravityPull(shipAt(MOON.x, MOON.y - 200), MOON);
  const far = gravityPull(shipAt(MOON.x, MOON.y - 400), MOON);

  closeTo(near.x, 0);
  closeTo(near.y, (GRAVITY_CONSTANT * MOON.mass * SHIP.mass) / 200 ** 2);
  closeTo(near.y / far.y, 4);
});

test('altitude is measured from the feet and never negative', () => {
  const touching = MOON.radius + SHIP.radius;
  closeTo(altitudeOf(shipAt(MOON.x + touching + 50, MOON.y), MOON), 50);
  assert.equal(altitudeOf(shipAt(MOON.x + 10, MOON.y), MOON), 0);
});

test('tilt is zero when the feet point at the ground, wherever the ship is', () => {
  closeTo(tiltFromVertical(shipAt(MOON.x, MOON.y - 200, { rotation: 0 }), MOON), 0);
  closeTo(tiltFromVertical(shipAt(MOON.x + 200, MOON.y, { rotation: Math.PI / 2 }), MOON), 0);
  closeTo(tiltFromVertical(shipAt(MOON.x, MOON.y + 200, { rotation: Math.PI }), MOON), 0);
});

test('tilt is signed: clockwise rotation is positive', () => {
  const above = (rotation) => shipAt(MOON.x, MOON.y - 200, { rotation });
  closeTo(toDegrees(tiltFromVertical(above(Math.PI / 6), MOON)), 30);
  closeTo(toDegrees(tiltFromVertical(above(-Math.PI / 6), MOON)), -30);
});

test('wrapAngle keeps angles in [0, 2π)', () => {
  closeTo(wrapAngle(-Math.PI / 2), 1.5 * Math.PI);
  closeTo(wrapAngle(5 * Math.PI), Math.PI);
});

test('surface point lies directly below the body', () => {
  const point = surfacePointBelow(shipAt(MOON.x, MOON.y - 300), MOON);
  closeTo(point.x, MOON.x);
  closeTo(point.y, MOON.y - MOON.radius - SHIP.radius);
});

test('a ship dropped from rest is predicted to hit the surface', () => {
  const ship = shipAt(MOON.x, MOON.y - 300);
  const { points, impact } = predictTrajectory(ship, MOON, 3000);

  assert.ok(impact, 'expected an impact');
  assert.ok(impact.speed > 0);
  assert.ok(points.length > 0 && points.length < 3000);
  assert.deepEqual(
    [ship.x, ship.y, ship.vx, ship.vy],
    [MOON.x, MOON.y - 300, 0, 0],
    'input must not be mutated'
  );
});

test('a circular orbit never hits the surface', () => {
  const radius = 300;
  const orbitalSpeed = Math.sqrt((GRAVITY_CONSTANT * MOON.mass * SHIP.mass) / radius);
  const orbiting = shipAt(MOON.x, MOON.y - radius, { vx: orbitalSpeed });
  const { impact, points } = predictTrajectory(orbiting, MOON, 3000);

  assert.equal(impact, null);
  assert.equal(points.length, 3000);
});
