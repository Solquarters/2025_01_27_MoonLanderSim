/**
 * Pure physics helpers. Nothing in here touches the DOM or mutates its inputs,
 * so everything can be unit-tested in Node.
 *
 * A "body" is anything with { x, y, radius, mass } (plus { vx, vy } when it moves).
 */

import { GRAVITY_CONSTANT } from '../config.js';

export const TAU = Math.PI * 2;

export const toDegrees = (radians) => (radians * 180) / Math.PI;
export const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Wraps an angle into the range [0, 2π). */
export function wrapAngle(radians) {
  return ((radians % TAU) + TAU) % TAU;
}

export function distanceBetween(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function speedOf(body) {
  return Math.hypot(body.vx, body.vy);
}

/**
 * Velocity change a body receives from the attractor in one tick.
 *
 * Arcade physics on purpose: the pull scales with the body's own mass, which
 * makes light debris fall slower than heavy debris and gives explosions their
 * spread. The ship's mass is constant, so for the ship this is plain 1/d².
 */
export function gravityPull(body, attractor) {
  const dx = attractor.x - body.x;
  const dy = attractor.y - body.y;
  const distanceSquared = dx * dx + dy * dy;
  const distance = Math.sqrt(distanceSquared);
  const strength = (GRAVITY_CONSTANT * attractor.mass * body.mass) / distanceSquared;
  return { x: (strength * dx) / distance, y: (strength * dy) / distance };
}

export function isTouching(body, attractor) {
  return distanceBetween(body, attractor) < attractor.radius + body.radius;
}

/** Height of the body's lowest point above the surface; 0 when touching. */
export function altitudeOf(body, attractor) {
  return Math.max(0, distanceBetween(body, attractor) - attractor.radius - body.radius);
}

/** Unit vector pointing from the attractor's centre through the body ("up"). */
export function outwardNormal(body, attractor) {
  const dx = body.x - attractor.x;
  const dy = body.y - attractor.y;
  const distance = Math.hypot(dx, dy);
  return { x: dx / distance, y: dy / distance };
}

/**
 * Where the body would rest on the surface directly below it.
 * `depthFactor` below 1 sinks the point slightly into the ground.
 */
export function surfacePointBelow(body, attractor, depthFactor = 1) {
  const normal = outwardNormal(body, attractor);
  const reach = (attractor.radius + body.radius) * depthFactor;
  return { x: attractor.x + normal.x * reach, y: attractor.y + normal.y * reach };
}

/** Unit vector of the ship's nose. Rotation 0 points to the top of the screen. */
export function headingOf(ship) {
  return { x: Math.sin(ship.rotation), y: -Math.cos(ship.rotation) };
}

/**
 * Signed angle (radians, -π..π) between the ship's nose and local "up".
 * 0 means the feet point straight at the ground.
 */
export function tiltFromVertical(ship, attractor) {
  const up = outwardNormal(ship, attractor);
  const nose = headingOf(ship);
  const cross = up.x * nose.y - up.y * nose.x;
  const dot = up.x * nose.x + up.y * nose.y;
  return Math.atan2(cross, dot);
}

/**
 * Coasts a copy of the body forward under gravity alone.
 * @returns {{ points: {x:number,y:number}[], impact: {x:number,y:number,speed:number}|null }}
 */
export function predictTrajectory(body, attractor, maxSteps) {
  const ghost = {
    x: body.x,
    y: body.y,
    vx: body.vx,
    vy: body.vy,
    radius: body.radius,
    mass: body.mass,
  };
  const points = [];

  for (let step = 0; step < maxSteps; step++) {
    if (isTouching(ghost, attractor)) {
      return { points, impact: { x: ghost.x, y: ghost.y, speed: speedOf(ghost) } };
    }
    const pull = gravityPull(ghost, attractor);
    ghost.vx += pull.x;
    ghost.vy += pull.y;
    ghost.x += ghost.vx;
    ghost.y += ghost.vy;
    points.push({ x: ghost.x, y: ghost.y });
  }
  return { points, impact: null };
}

/** Compass bearing of the body as seen from the attractor: 0° = top of the screen, clockwise, [0, 360). */
export function bearingOf(body, attractor) {
  const degrees = toDegrees(Math.atan2(body.x - attractor.x, -(body.y - attractor.y)));
  return (degrees + 360) % 360;
}

/** Point at the given compass bearing and distance from the attractor's centre. */
export function pointAtBearing(attractor, bearingDeg, distance) {
  const angle = toRadians(bearingDeg);
  return {
    x: attractor.x + Math.sin(angle) * distance,
    y: attractor.y - Math.cos(angle) * distance,
  };
}

/** Shortest signed turn from one bearing to another in degrees, in (-180, 180]. */
export function bearingDelta(fromDeg, toDeg) {
  const delta = (((toDeg - fromDeg) % 360) + 540) % 360 - 180;
  return delta === -180 ? 180 : delta;
}
