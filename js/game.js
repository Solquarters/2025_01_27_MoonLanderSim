import { LANDING, MAX_FRAME_MS, TICK_MS, TICKS_PER_SECOND, TRAJECTORY } from './config.js';
import { FeedbackKind, Mission, MissionStatus, Tone } from './levels/mission.js';
import { altitudeOf, predictTrajectory, speedOf, tiltFromVertical, toDegrees } from './sim/physics.js';
import { ShipStatus } from './sim/simulation.js';
import { describeCurrentObjective } from './ui/missionText.js';

const GameState = Object.freeze({
  /** Mission select is open. */
  MENU: 'menu',
  /** Level is loaded and frozen behind the briefing. */
  BRIEFING: 'briefing',
  PLAYING: 'playing',
  /** Mission is decided; the world keeps moving briefly before the result appears. */
  ENDING: 'ending',
  RESULT: 'result',
});

const IDLE_CONTROLS = Object.freeze({
  thrust: false,
  reverse: false,
  rotateLeft: false,
  rotateRight: false,
  stabilize: false,
});

const RESULT_DELAY_TICKS = Object.freeze({
  [MissionStatus.COMPLETE]: Math.round(1.2 * TICKS_PER_SECOND),
  [MissionStatus.FAILED]: Math.round(1.8 * TICKS_PER_SECOND),
});

const ALERT_DURATION_MS = 2600;

/**
 * Owns the main loop and the flow between screens: feeds input into the
 * simulation at a fixed tick rate, lets the mission judge the result and
 * shows everything through the renderers, the HUD and the screens.
 */
export class Game {
  #scene;
  #missionRenderer;
  #starfield;
  #hud;
  #keyboard;
  #fpsCounter;
  #screens;
  #levels;
  #progress;

  #state = GameState.MENU;
  #levelIndex = 0;
  #mission;
  #sim;
  #lastFrameAt = null;
  #unsimulatedMs = 0;
  #resultCountdown = 0;
  #outcome = null;
  #alert = null;
  /** A flight is waiting behind the mission select screen. */
  #flightPaused = false;

  /**
   * @param {Object} parts
   * @param {import('./render/sceneRenderer.js').SceneRenderer} parts.scene
   * @param {import('./render/missionRenderer.js').MissionRenderer} parts.missionRenderer
   * @param {import('./render/starfield.js').Starfield} parts.starfield
   * @param {import('./ui/hud.js').Hud} parts.hud
   * @param {import('./input/keyboard.js').Keyboard} parts.keyboard
   * @param {import('./ui/fpsCounter.js').FpsCounter} parts.fpsCounter
   * @param {import('./ui/screens.js').Screens} parts.screens
   * @param {readonly import('./levels/levels.js').Level[]} parts.levels
   * @param {import('./levels/progress.js').Progress} parts.progress
   */
  constructor({ scene, missionRenderer, starfield, hud, keyboard, fpsCounter, screens, levels, progress }) {
    this.#scene = scene;
    this.#missionRenderer = missionRenderer;
    this.#starfield = starfield;
    this.#hud = hud;
    this.#keyboard = keyboard;
    this.#fpsCounter = fpsCounter;
    this.#screens = screens;
    this.#levels = levels;
    this.#progress = progress;
  }

  start() {
    this.#loadLevel(this.#firstOpenLevel());
    this.showLevels();
    requestAnimationFrame(this.#onFrame);
  }

  // --- flow between screens ----------------------------------------------

  /** Opens mission select; a running flight is paused behind it. */
  showLevels() {
    const canResume = this.#state === GameState.PLAYING || this.#flightPaused;
    this.#flightPaused = canResume;
    this.#setState(GameState.MENU);
    this.#screens.showLevelSelect({
      levels: this.#levels,
      progress: this.#progress,
      currentIndex: this.#levelIndex,
      canResume,
    });
  }

  selectLevel(index) {
    if (!this.#progress.isUnlocked(this.#levels, index)) return;
    this.#loadLevel(index);
    this.#setState(GameState.BRIEFING);
    const level = this.#levels[index];
    this.#screens.showBriefing(level, index, this.#progress.bestFor(level.id));
  }

  /** Starts (or resumes) flying the loaded level. */
  launch() {
    this.#screens.closeAll();
    this.#flightPaused = false;
    this.#setState(GameState.PLAYING);
  }

  /** Starts the current level again from its spawn point, without the briefing. */
  restart() {
    this.#loadLevel(this.#levelIndex);
    this.launch();
  }

  nextLevel() {
    this.selectLevel(Math.min(this.#levelIndex + 1, this.#levels.length - 1));
  }

  #setState(state) {
    this.#state = state;
    const flying = state === GameState.PLAYING || state === GameState.ENDING;
    this.#keyboard.enabled = flying;
    this.#unsimulatedMs = 0;
  }

  #loadLevel(index) {
    this.#levelIndex = index;
    this.#mission = new Mission(this.#levels[index]);
    this.#sim = this.#mission.createSimulation();
    this.#alert = null;
    this.#flightPaused = false;
    this.#missionRenderer.clearPopUps();
  }

  /** The furthest level the player may fly. */
  #firstOpenLevel() {
    const firstUnplayed = this.#levels.findIndex((level) => !this.#progress.bestFor(level.id));
    return firstUnplayed === -1 ? this.#levels.length - 1 : firstUnplayed;
  }

  // --- main loop ---------------------------------------------------------

  #onFrame = (now) => {
    const frameMs = this.#lastFrameAt === null ? 0 : Math.min(now - this.#lastFrameAt, MAX_FRAME_MS);
    this.#lastFrameAt = now;

    this.#unsimulatedMs += frameMs;
    while (this.#unsimulatedMs >= TICK_MS) {
      this.#tick(now);
      this.#unsimulatedMs -= TICK_MS;
    }

    this.#render(now);
    this.#fpsCounter.trackFrame(now);
    requestAnimationFrame(this.#onFrame);
  };

  #tick(now) {
    if (this.#state === GameState.PLAYING) {
      const simEvents = this.#sim.step(this.#keyboard.controls);
      this.#showFeedback(this.#mission.update(this.#sim, simEvents), now);
      if (!this.#mission.isActive) this.#endMission();
      return;
    }

    const missionOver = this.#state === GameState.ENDING || this.#state === GameState.RESULT;
    if (!missionOver) return;

    // Only wreckage keeps moving once the mission is decided.
    if (!this.#sim.isShipOperational) this.#sim.step(IDLE_CONTROLS);
    if (this.#state === GameState.ENDING && --this.#resultCountdown <= 0) {
      this.#showResult();
    }
  }

  #showFeedback(feedback, now) {
    for (const item of feedback) {
      if (item.kind === FeedbackKind.SCORE) {
        this.#missionRenderer.addPopUp(item.text, item.x, item.y, now);
      } else {
        this.#alert = { text: item.text, tone: item.tone, expiresAt: now + ALERT_DURATION_MS };
      }
    }
  }

  /** Saves the outcome right away, so leaving early cannot lose a completed mission. */
  #endMission() {
    const result = this.#mission.result();
    const levelId = this.#levels[this.#levelIndex].id;
    this.#outcome = {
      result,
      record: result.completed ? this.#progress.record(levelId, result) : null,
    };
    this.#resultCountdown = RESULT_DELAY_TICKS[this.#mission.status];
    this.#setState(GameState.ENDING);
  }

  #showResult() {
    const level = this.#levels[this.#levelIndex];
    const { result, record } = this.#outcome;
    const nextIndex = this.#levelIndex + 1;
    const hasNext =
      nextIndex < this.#levels.length && this.#progress.isUnlocked(this.#levels, nextIndex);

    this.#setState(GameState.RESULT);
    this.#screens.showResult(result, { level, levelIndex: this.#levelIndex, hasNext, record });
  }

  // --- presentation ------------------------------------------------------

  #render(now) {
    const sim = this.#sim;
    const mission = this.#mission;
    const trajectory =
      sim.isFlying && mission.isActive
        ? predictTrajectory(sim.ship, sim.moon, TRAJECTORY.maxSteps)
        : null;

    this.#starfield.update(now);
    this.#scene.draw(sim, trajectory, {
      belowShip: (ctx) => this.#missionRenderer.drawMarkers(ctx, mission, sim.moon, now),
      aboveAll: (ctx) => this.#missionRenderer.drawPopUps(ctx, now),
    });
    this.#hud.update({
      speed: speedOf(sim.ship),
      altitude: altitudeOf(sim.ship, sim.moon),
      tiltDeg: toDegrees(tiltFromVertical(sim.ship, sim.moon)),
      fuel: sim.fuel,
      oxygen: sim.oxygen,
      elapsedMs: sim.elapsedMs,
      collisionWarning: Boolean(trajectory?.impact && trajectory.impact.speed >= LANDING.maxSpeed),
      landed: sim.isLanded,
      oxygenDepleted: sim.ship.status === ShipStatus.LOST,
      mission: {
        levelName: `${this.#levelIndex + 1}. ${mission.level.name}`,
        objective: describeCurrentObjective(mission),
        score: mission.score,
        combo: mission.combo,
        comboTimeLeft: mission.comboTimeLeft,
        alert: this.#currentAlert(now),
      },
    });
  }

  /** Ongoing dangers outrank one-off messages. */
  #currentAlert(now) {
    const mission = this.#mission;
    if (mission.isActive) {
      if (mission.fault) return { text: 'GYRO FAULT! Stabilize!', tone: Tone.WARN };
      if (mission.signalWeak) return { text: 'Weak signal. Turn back!', tone: Tone.WARN };
    }
    if (this.#alert && now < this.#alert.expiresAt) return this.#alert;
    if (mission.isActive && this.#sim.fuel <= 0) return { text: 'Fuel depleted', tone: Tone.INFO };
    return null;
  }
}
