import { LANDING } from '../config.js';
import { formatMissionTime, formatSpeed } from './format.js';
import { formatCombo, formatScore } from './missionText.js';

const VELOCITY_TAPE = Object.freeze({ unitsPerStep: 1, maxValue: 6 });
const ALTITUDE_TAPE = Object.freeze({ unitsPerStep: 100, maxValue: 600 });
const LOW_ALTITUDE = 50;

function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`HUD element not found: ${selector}`);
  return element;
}

/** Writes to the DOM only when the value actually changed. */
function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function setVisible(element, visible) {
  const display = visible ? 'flex' : 'none';
  if (element.style.display !== display) element.style.display = display;
}

/**
 * A vertical instrument strip that scrolls behind a fixed centre marker.
 * The strip's bottom edge represents the value 0.
 */
class Tape {
  #viewport;
  #strip;
  #step;
  #scale;
  #viewportHeight = 0;
  #stripHeight = 0;
  #stepHeight = 0;

  /**
   * @param {HTMLElement} viewport  clipping container
   * @param {HTMLElement} strip     scrolling element
   * @param {HTMLElement} step      one labelled segment of the strip
   * @param {{unitsPerStep:number, maxValue:number}} scale
   */
  constructor(viewport, strip, step, scale) {
    this.#viewport = viewport;
    this.#strip = strip;
    this.#step = step;
    this.#scale = scale;
    this.measure();
  }

  measure() {
    this.#viewportHeight = this.#viewport.offsetHeight;
    this.#stripHeight = this.#strip.offsetHeight;
    this.#stepHeight = this.#step.offsetHeight;
  }

  show(value) {
    const steps = Math.min(value, this.#scale.maxValue) / this.#scale.unitsPerStep;
    const offset = this.#viewportHeight / 2 - this.#stripHeight + steps * this.#stepHeight;
    this.#strip.style.transform = `translateY(${offset}px)`;
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
 * @property {boolean} collisionWarning
 * @property {boolean} landed
 * @property {boolean} oxygenDepleted
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
  #attitudeOk = null;

  constructor() {
    this.#el = {
      speed: requireElement('#velocityInfoId'),
      missionTime: requireElement('#missionTimerId'),
      altitude: requireElement('#altitudeNumbericId'),
      roll: requireElement('#rollNumbericId'),
      rollRotator: requireElement('#rollIndicatorRotatorId'),
      rollFrame: requireElement('.mainFDAIDisplayContainerClass'),
      fuel: requireElement('#fuelAmountDivId'),
      oxygen: requireElement('#oxygenAmountDivId'),
      collisionWarning: requireElement('#collisionMainDivId'),
      landingSuccess: requireElement('#landingSuccessMainDivId'),
      oxygenDepleted: requireElement('#oxygenDepletedMainDivId'),
      levelName: requireElement('#missionNameId'),
      objective: requireElement('#missionObjectiveId'),
      score: requireElement('#missionScoreId'),
      combo: requireElement('#missionComboId'),
      comboValue: requireElement('#missionComboValueId'),
      comboBar: requireElement('#missionComboBarId'),
      alert: requireElement('#missionAlertId'),
      menuButton: requireElement('#missionMenuButtonId'),
    };

    this.#velocityTape = new Tape(
      requireElement('#velocityMainDivId .overflowHiddenWrapperClass'),
      requireElement('#velocityStepsDivId'),
      requireElement('.single-speed-div-class'),
      VELOCITY_TAPE
    );
    this.#altitudeTape = new Tape(
      requireElement('#altitudeMainDivId .overflowHiddenWrapperClass'),
      requireElement('#altitudeStepsDivId'),
      requireElement('.single-altitude-div-class'),
      ALTITUDE_TAPE
    );

    window.addEventListener('resize', () => {
      this.#velocityTape.measure();
      this.#altitudeTape.measure();
    });
  }

  /** @param {() => void} handler */
  onMenuRequested(handler) {
    this.#el.menuButton.addEventListener('click', handler);
  }

  /** @param {HudView} view */
  update(view) {
    const el = this.#el;

    setText(el.speed, formatSpeed(view.speed));
    setText(el.missionTime, formatMissionTime(view.elapsedMs));
    this.#velocityTape.show(view.speed);

    setText(el.altitude, `${Math.floor(view.altitude)} px`);
    el.altitude.classList.toggle('is-low', view.altitude < LOW_ALTITUDE);
    this.#altitudeTape.show(view.altitude);

    this.#showAttitude(view.tiltDeg);
    el.fuel.style.height = `${view.fuel}%`;
    el.oxygen.style.height = `${view.oxygen}%`;

    setVisible(el.collisionWarning, view.collisionWarning);
    setVisible(el.landingSuccess, view.landed);
    setVisible(el.oxygenDepleted, view.oxygenDepleted);
    this.#showMission(view.mission);
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

  #showAttitude(tiltDeg) {
    const el = this.#el;
    // The indicator's coloured half points down when the ship is upright.
    el.rollRotator.style.transform = `rotate(${tiltDeg + 180}deg)`;
    setText(el.roll, String(Math.round(tiltDeg)));

    const attitudeOk = Math.abs(tiltDeg) <= LANDING.maxTiltDeg;
    if (attitudeOk === this.#attitudeOk) return;
    this.#attitudeOk = attitudeOk;
    for (const element of [el.rollRotator, el.rollFrame]) {
      element.classList.toggle('green-pulse', attitudeOk);
      element.classList.toggle('warning-blink', !attitudeOk);
    }
  }
}
