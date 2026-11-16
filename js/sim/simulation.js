import {
  DEFAULT_SPAWN,
  LANDING,
  MOON,
  SHIP,
  SUPPLIES,
  TICK_MS,
  TICKS_PER_SECOND,
  TRACE,
} from '../config.js';
import { createDebrisField, stepDebris } from './debris.js';
import {
  clamp,
  gravityPull,
  headingOf,
  isTouching,
  outwardNormal,
  speedOf,
  surfacePointBelow,
  tiltFromVertical,
  toDegrees,
  wrapAngle,
} from './physics.js';

export const ShipStatus = Object.freeze({
  FLYING: 'flying',
  LANDED: 'landed',
  DESTROYED: 'destroyed',
  /** Crew ran out of oxygen; the ship keeps drifting but no longer responds. */
  LOST: 'lost',
});

export const SimEvent = Object.freeze({
  LANDED: 'landed',
  LIFTOFF: 'liftoff',
  CRASHED: 'crashed',
  OXYGEN_DEPLETED: 'oxygenDepleted',
});

export const CrashReason = Object.freeze({ SPEED: 'speed', TILT: 'tilt' });

/** Wrecks are pushed slightly into the ground so the explosion starts at the surface. */
const WRECK_DEPTH_FACTOR = 0.99;

const NO_THRUSTERS = Object.freeze({
  main: false,
  reverse: false,
  rotateLeft: false,
  rotateRight: false,
  stabilizer: false,
});

/**
 * @typedef {Object} Controls
 * @property {boolean} thrust       main engine, pushes along the nose
 * @property {boolean} reverse      retro engine, pushes against the nose
 * @property {boolean} rotateLeft
 * @property {boolean} rotateRight
 * @property {boolean} stabilize    damp rotation towards zero
 */

/**
 * The complete game world for one flight: ship, supplies, wreckage and flight trace.
 * It has no knowledge of rendering or input devices; call step() once per tick.
 */
export class Simulation {
  /**
   * @param {Object} [options]
   * @param {Partial<typeof DEFAULT_SPAWN>} [options.spawn]
   * @param {number} [options.fuel]     starting fuel in percent
   * @param {number} [options.oxygen]   starting oxygen in percent
   * @param {() => number} [options.random]
   */
  constructor({ spawn = {}, fuel = SUPPLIES.fuel, oxygen = SUPPLIES.oxygen, random = Math.random } = {}) {
    this.moon = MOON;
    this.ship = {
      ...DEFAULT_SPAWN,
      ...spawn,
      radius: SHIP.radius,
      mass: SHIP.mass,
      status: ShipStatus.FLYING,
    };
    this.fuel = fuel;
    this.oxygen = oxygen;
    this.ticks = 0;
    this.debris = [];
    this.trace = [];
    /** Which thrusters actually fired during the last tick (for rendering). */
    this.thrusters = NO_THRUSTERS;
    this.random = random;
  }

  get elapsedMs() {
    return this.ticks * TICK_MS;
  }

  get isFlying() {
    return this.ship.status === ShipStatus.FLYING;
  }

  get isLanded() {
    return this.ship.status === ShipStatus.LANDED;
  }

  /** True while the crew can still fly the ship. */
  get isShipOperational() {
    return this.isFlying || this.isLanded;
  }

  /**
   * Advances the world by one tick.
   * @param {Controls} controls
   * @returns {{type: string}[]} things that happened during this tick
   */
  step(controls) {
    const events = [];
    stepDebris(this.debris, this.moon);

    if (!this.isShipOperational) {
      this.thrusters = NO_THRUSTERS;
      return events;
    }

    this.ticks++;
    if (this.isLanded) {
      this.#stepLanded(controls, events);
    } else {
      this.#stepFlying(controls, events);
    }

    if (this.isShipOperational) {
      this.#consumeOxygen(events);
    }
    this.#recordTrace();
    return events;
  }

  #stepFlying(controls, events) {
    const { ship } = this;
    const rotation = this.#applyRotation(controls);
    const thrust = this.#fireEngines(controls);
    const pull = gravityPull(ship, this.moon);

    ship.vx += pull.x + thrust.x;
    ship.vy += pull.y + thrust.y;
    ship.x += ship.vx;
    ship.y += ship.vy;
    this.thrusters = { ...rotation, main: thrust.main, reverse: thrust.reverse };

    if (isTouching(ship, this.moon)) {
      this.#resolveTouchdown(events);
    }
  }

  /** On the ground the ship cannot rotate; it lifts off once thrust beats gravity. */
  #stepLanded(controls, events) {
    const { ship } = this;
    ship.rotationVelocity = 0;

    const thrust = this.#fireEngines(controls);
    this.thrusters = { ...NO_THRUSTERS, main: thrust.main, reverse: thrust.reverse };

    const pull = gravityPull(ship, this.moon);
    const up = outwardNormal(ship, this.moon);
    const netLift = (thrust.x + pull.x) * up.x + (thrust.y + pull.y) * up.y;
    if (netLift <= 0) return;

    ship.vx = thrust.x + pull.x;
    ship.vy = thrust.y + pull.y;
    ship.x += ship.vx;
    ship.y += ship.vy;
    ship.status = ShipStatus.FLYING;
    events.push({ type: SimEvent.LIFTOFF });
  }

  #applyRotation(controls) {
    const { ship } = this;
    const rotateLeft = controls.rotateLeft && !controls.rotateRight;
    const rotateRight = controls.rotateRight && !controls.rotateLeft;

    if (rotateLeft) ship.rotationVelocity -= SHIP.rotationAccel;
    if (rotateRight) ship.rotationVelocity += SHIP.rotationAccel;
    ship.rotationVelocity = clamp(
      ship.rotationVelocity,
      -SHIP.maxRotationVelocity,
      SHIP.maxRotationVelocity
    );

    const stabilizer = controls.stabilize && ship.rotationVelocity !== 0;
    if (stabilizer) {
      const damping = Math.min(Math.abs(ship.rotationVelocity), SHIP.stabilizeStrength);
      ship.rotationVelocity -= Math.sign(ship.rotationVelocity) * damping;
    }

    ship.rotation = wrapAngle(ship.rotation + ship.rotationVelocity);
    return { rotateLeft, rotateRight, stabilizer };
  }

  /** Burns fuel for the requested engines and returns the resulting velocity change. */
  #fireEngines(controls) {
    const wantsMain = controls.thrust && !controls.reverse;
    const wantsReverse = controls.reverse && !controls.thrust;
    if ((!wantsMain && !wantsReverse) || this.fuel <= 0) {
      return { x: 0, y: 0, main: false, reverse: false };
    }

    this.fuel = Math.max(0, this.fuel - SUPPLIES.fuelBurnPerSecond / TICKS_PER_SECOND);
    const nose = headingOf(this.ship);
    const direction = wantsMain ? 1 : -1;
    return {
      x: nose.x * SHIP.thrustPerTick * direction,
      y: nose.y * SHIP.thrustPerTick * direction,
      main: wantsMain,
      reverse: wantsReverse,
    };
  }

  #resolveTouchdown(events) {
    const { ship, moon } = this;
    const speed = speedOf(ship);
    const tiltDeg = Math.abs(toDegrees(tiltFromVertical(ship, moon)));
    const tooFast = speed >= LANDING.maxSpeed;
    const tooTilted = tiltDeg > LANDING.maxTiltDeg;

    if (tooFast || tooTilted) {
      Object.assign(ship, surfacePointBelow(ship, moon, WRECK_DEPTH_FACTOR));
      this.debris.push(...createDebrisField(ship, speed, this.random));
      ship.status = ShipStatus.DESTROYED;
      this.thrusters = NO_THRUSTERS;
      events.push({
        type: SimEvent.CRASHED,
        reason: tooFast ? CrashReason.SPEED : CrashReason.TILT,
        speed,
        tiltDeg,
      });
      return;
    }

    Object.assign(ship, surfacePointBelow(ship, moon));
    ship.vx = 0;
    ship.vy = 0;
    ship.rotationVelocity = 0;
    ship.status = ShipStatus.LANDED;
    events.push({ type: SimEvent.LANDED, speed, tiltDeg });
  }

  #consumeOxygen(events) {
    this.oxygen = Math.max(0, this.oxygen - SUPPLIES.oxygenUsePerSecond / TICKS_PER_SECOND);
    if (this.oxygen > 0) return;

    this.ship.status = ShipStatus.LOST;
    this.thrusters = NO_THRUSTERS;
    events.push({ type: SimEvent.OXYGEN_DEPLETED });
  }

  #recordTrace() {
    this.trace.push({ x: this.ship.x, y: this.ship.y });
    if (this.trace.length > TRACE.maxLength) {
      this.trace.shift();
    }
  }
}
