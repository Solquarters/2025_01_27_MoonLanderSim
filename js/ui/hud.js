import { LANDING } from '../config.js';
import { formatMissionTime, formatSpeed } from './format.js';
import { formatCombo, formatScore } from './missionText.js';

const VELOCITY_TAPE = Object.freeze({ unitsPerStep: 1, maxValue: 6 });
const ALTITUDE_TAPE = Object.freeze({ unitsPerStep: 100, maxValue: 600 });
const LOW_SUPPLY_PERCENT = 20;

export const FlightStatus = Object.freeze({
  COLLISION: 'collision',
  LANDED: 'landed',
  OXYGEN_DEPLETED: 'oxygen',
});

const FLIGHT_STATUS_TEXT = Object.freeze({
  [FlightStatus.COLLISION]: 'On collision course',
  [FlightStatus.LANDED]: 'Touchdown confirmed',
  [FlightStatus.OXYGEN_DEPLETED]: 'Oxygen depleted',
});

function requireElement(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`HUD element not found: ${selector}`);
  return element;
}

/** Writes to the DOM only when the value actually changed. */
function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

/**
 * A vertical instrument strip that scrolls behind a fixed centre marker.
 * The strip's bottom edge represents the value 0.
 */
class Tape {
  #strip;
  #scale;
  #windowHeight;
  #stripHeight;
  #stepHeight;

  /**
   * @param {HTMLElement} root the `.tape` element
   * @param {{unitsPerStep:number, maxValue:number}} scale
   */
  constructor(root, scale) {
    this.#strip = requireElement('.tape__strip', root);
    this.#scale = scale;
    // Layout sizes are in stage pixels and do not change when the stage is scaled.
    this.#windowHeight = root.clientHeight;
    this.#stripHeight = this.#strip.offsetHeight;
    this.#stepHeight = requireElement('.tape__step', root).offsetHeight;
  }

  show(value) {
    const steps = Math.min(value, this.#scale.maxValue) / this.#scale.unitsPerStep;
    const offset = this.#windowHeight / 2 - this.#stripHeight + steps * this.#stepHeight;
    this.#strip.style.transform = `translateY(${offset}px)`;
  }
}

/** A tank level bar that also reports its value to assistive technology. */
class Gauge {
  #root;
  #fill;
  #value;
  #shownPercent = null;

  /** @param {HTMLElement} root the `.gauge` element */
  constructor(root) {
    this.#root = root;
    this.#fill = requireElement('.gauge__fill', root);
    this.#value = requireElement('.gauge__value', root);
  }

  show(percent) {
    this.#fill.style.height = `${percent}%`;

    const rounded = Math.ceil(percent);
    if (rounded === this.#shownPercent) return;
    this.#shownPercent = rounded;
    this.#value.textContent = String(rounded);
    this.#root.setAttribute('aria-valuenow', String(rounded));
    this.#root.classList.toggle('is-low', percent < LOW_SUPPLY_PERCENT);
  }
}

/**
 * @typedef {Object} HudView
 * @property {number} speed
 * @property {number} altitude
 * @property {number} tiltDeg            signed deviation from "feet down"
 * @property {number} fuel               percent
 * @property {number} oxygen             percent
 * @property {number} elapsedMs
 * @property {string|null} flightStatus  one of FlightStatus, or null
 * @property {MissionView} mission
 */

/**
 * @typedef {Object} MissionView
 * @property {string} levelName
 * @property {string} objective           what to do right now
 * @property {number} score
 * @property {number} combo               gate chain multiplier, 1 = no chain
 * @property {number} comboTimeLeft       share of the combo window left (0..1)
 * @property {{text: string, tone: string}|null} alert
 */

/** All instruments and status messages that live in the DOM. */
export class Hud {
  #el;
  #velocityTape;
  #altitudeTape;
  #fuelGauge;
  #oxygenGauge;
  #attitudeOk = null;

  constructor() {
    this.#el = {
      speed: requireElement('#speed-readout'),
      missionTime: requireElement('#mission-time'),
      altitude: requireElement('#altitude-readout'),
      attitude: requireElement('#attitude'),
      attitudeGround: requireElement('#attitude-ground'),
      attitudeState: requireElement('#attitude-state'),
      roll: requireElement('#roll-readout'),
      flightStatus: requireElement('#flight-status'),
      levelName: requireElement('#mission-name'),
      objective: requireElement('#mission-objective'),
      score: requireElement('#mission-score'),
      combo: requireElement('#mission-combo'),
      comboValue: requireElement('#mission-combo-value'),
      comboBar: requireElement('#mission-combo-bar'),
      alert: requireElement('#mission-alert'),
      pauseButton: requireElement('#pause-button'),
      helpButton: requireElement('#help-button'),
    };
    this.#velocityTape = new Tape(requireElement('#velocity-tape'), VELOCITY_TAPE);
    this.#altitudeTape = new Tape(requireElement('#altitude-tape'), ALTITUDE_TAPE);
    this.#fuelGauge = new Gauge(requireElement('#fuel-gauge'));
    this.#oxygenGauge = new Gauge(requireElement('#oxygen-gauge'));
  }

  /** @param {() => void} handler */
  onPauseRequested(handler) {
    this.#onButton(this.#el.pauseButton, handler);
  }

  /** @param {() => void} handler */
  onHelpRequested(handler) {
    this.#onButton(this.#el.helpButton, handler);
  }

  /** @param {HudView} view */
  update(view) {
    const el = this.#el;

    setText(el.speed, formatSpeed(view.speed));
    setText(el.missionTime, formatMissionTime(view.elapsedMs));
    setText(el.altitude, String(Math.floor(view.altitude)));
    this.#velocityTape.show(view.speed);
    this.#altitudeTape.show(view.altitude);
    this.#fuelGauge.show(view.fuel);
    this.#oxygenGauge.show(view.oxygen);

    this.#showAttitude(view.tiltDeg);
    this.#showFlightStatus(view.flightStatus);
    this.#showMission(view.mission);
  }

  #onButton(button, handler) {
    button.addEventListener('click', () => {
      // Keep keyboard focus off the HUD so Space keeps meaning "restart".
      button.blur();
      handler();
    });
  }

  #showAttitude(tiltDeg) {
    const el = this.#el;
    // The yellow "underside" half points down when the ship is upright.
    el.attitudeGround.style.transform = `rotate(${tiltDeg + 180}deg)`;
    setText(el.roll, `${Math.round(tiltDeg)}°`);

    const attitudeOk = Math.abs(tiltDeg) <= LANDING.maxTiltDeg;
    if (attitudeOk === this.#attitudeOk) return;
    this.#attitudeOk = attitudeOk;
    el.attitude.classList.toggle('is-ok', attitudeOk);
    el.attitude.classList.toggle('is-tilted', !attitudeOk);
    setText(el.attitudeState, attitudeOk ? 'OK to land' : 'Too tilted to land');
  }

  #showFlightStatus(status) {
    const el = this.#el.flightStatus;
    const state = status ?? '';
    if (el.dataset.state === state) return;
    el.dataset.state = state;
    el.textContent = FLIGHT_STATUS_TEXT[status] ?? '';
    el.classList.toggle('is-visible', status !== null);
  }

  /** @param {MissionView} mission */
  #showMission(mission) {
    const el = this.#el;
    setText(el.levelName, mission.levelName);
    setText(el.objective, mission.objective);
    setText(el.score, formatScore(mission.score));

    const chaining = mission.combo > 1;
    el.combo.classList.toggle('is-active', chaining);
    if (chaining) {
      setText(el.comboValue, formatCombo(mission.combo));
      el.comboBar.style.width = `${Math.round(mission.comboTimeLeft * 100)}%`;
    }

    setText(el.alert, mission.alert?.text ?? '');
    el.alert.dataset.tone = mission.alert?.tone ?? '';
    el.alert.classList.toggle('is-visible', mission.alert !== null);
  }
}
