import { DEBRIS } from '../config.js';
import { gravityPull, isTouching, surfacePointBelow } from './physics.js';

/**
 * Creates the wreckage of a ship that hit the ground.
 * @param {{x:number,y:number,vx:number,vy:number}} ship state at impact
 * @param {number} impactSpeed
 * @param {() => number} random source of randomness in [0, 1)
 */
export function createDebrisField(ship, impactSpeed, random = Math.random) {
  const blastSpeed = Math.max(impactSpeed, DEBRIS.minBlastSpeed);
  const count = DEBRIS.minCount + Math.floor(random() * DEBRIS.countSpread);
  const pieces = [];

  for (let i = 0; i < count; i++) {
    const radius = random() + 0.15;
    pieces.push({
      x: ship.x,
      y: ship.y,
      // Biased slightly against the direction of travel so wreckage bounces back off the ground.
      vx: (random() - 0.6 + ship.vx * 0.05) * blastSpeed,
      vy: (random() - 0.6 + ship.vy * 0.05) * blastSpeed,
      radius,
      mass: random() * 0.16 * radius + 0.1,
      color: DEBRIS.colors[Math.floor(random() * DEBRIS.colors.length)],
      settled: false,
    });
  }
  return pieces;
}

/** Advances every loose piece by one tick; pieces that reach the ground stay there. */
export function stepDebris(pieces, attractor) {
  for (const piece of pieces) {
    if (piece.settled) continue;

    if (isTouching(piece, attractor)) {
      const rest = surfacePointBelow(piece, attractor);
      piece.x = rest.x;
      piece.y = rest.y;
      piece.vx = 0;
      piece.vy = 0;
      piece.settled = true;
      continue;
    }

    const pull = gravityPull(piece, attractor);
    piece.vx += pull.x;
    piece.vy += pull.y;
    piece.x += piece.vx;
    piece.y += piece.vy;
  }
}
