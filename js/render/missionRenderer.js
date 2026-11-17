import { ObjectiveType } from '../levels/levels.js';
import { distanceBetween, TAU, pointAtBearing, toRadians } from '../sim/physics.js';

const COLORS = Object.freeze({
  activeGate: '0, 229, 255',
  upcomingGate: '255, 255, 255',
  activePad: '0, 255, 80',
  upcomingPad: '255, 255, 255',
  beacon: '255, 208, 0',
  popUp: '255, 230, 120',
});

const POP_UP = Object.freeze({ lifetimeMs: 1600, risePx: 34, font: '700 16px Anta, sans-serif' });
const PULSE_PERIOD_MS = 900;
/** The guide arrow circles the ship at this distance and hides when the target is close. */
const GUIDE = Object.freeze({ orbitRadius: 24, hideWithin: 70 });

/** Draws mission markers: gates, landing pads, the bonus beacon and score pop-ups. */
export class MissionRenderer {
  #popUps = [];

  /** Shows a short text that floats up from a world position. */
  addPopUp(text, x, y, now) {
    this.#popUps.push({ text, x, y, bornAt: now });
  }

  clearPopUps() {
    this.#popUps = [];
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../levels/mission.js').Mission} mission
   * @param {object} moon
   * @param {number} now frame timestamp in ms
   */
  drawMarkers(ctx, mission, moon, now) {
    const pulse = 0.5 + 0.5 * Math.sin((now / PULSE_PERIOD_MS) * TAU);

    mission.objectives.forEach((objective, index) => {
      if (index < mission.objectiveIndex) return;
      const isCurrent = index === mission.objectiveIndex;
      if (objective.type === ObjectiveType.GATE) {
        this.#drawGate(ctx, objective, this.#gateNumber(mission, objective), isCurrent, pulse);
      } else if (objective.type === ObjectiveType.LAND && objective.pad) {
        this.#drawPad(ctx, objective.pad, moon, isCurrent, pulse);
      }
    });

    if (mission.beacon) this.#drawBeacon(ctx, mission.beacon, pulse);
  }

  /**
   * A small arrow next to the ship that points to the current objective,
   * so the next gate or pad is found without searching the screen.
   */
  drawGuide(ctx, mission, sim) {
    const objective = mission.currentObjective;
    if (!mission.isActive || !sim.isFlying || !objective) return;

    let target = null;
    let color = COLORS.activeGate;
    if (objective.type === ObjectiveType.GATE) {
      target = objective;
    } else if (objective.type === ObjectiveType.LAND && objective.pad) {
      target = pointAtBearing(sim.moon, objective.pad.bearing, sim.moon.radius);
      color = COLORS.activePad;
    }
    if (!target || distanceBetween(sim.ship, target) < GUIDE.hideWithin) return;

    const angle = Math.atan2(target.y - sim.ship.y, target.x - sim.ship.x);
    ctx.save();
    ctx.translate(sim.ship.x, sim.ship.y);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(${color}, 0.9)`;
    ctx.beginPath();
    ctx.moveTo(GUIDE.orbitRadius + 9, 0);
    ctx.lineTo(GUIDE.orbitRadius, -5);
    ctx.lineTo(GUIDE.orbitRadius, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Call after the ship is drawn so the texts stay readable. */
  drawPopUps(ctx, now) {
    this.#popUps = this.#popUps.filter((popUp) => now - popUp.bornAt < POP_UP.lifetimeMs);

    ctx.save();
    ctx.font = POP_UP.font;
    ctx.textAlign = 'center';
    for (const popUp of this.#popUps) {
      const age = (now - popUp.bornAt) / POP_UP.lifetimeMs;
      ctx.fillStyle = `rgba(${COLORS.popUp}, ${1 - age * age})`;
      ctx.fillText(popUp.text, popUp.x, popUp.y - 14 - age * POP_UP.risePx);
    }
    ctx.restore();
  }

  #gateNumber(mission, gate) {
    return mission.objectives.filter((o) => o.type === ObjectiveType.GATE).indexOf(gate) + 1;
  }

  #drawGate(ctx, gate, number, isCurrent, pulse) {
    const color = isCurrent ? COLORS.activeGate : COLORS.upcomingGate;
    const alpha = isCurrent ? 0.65 + 0.35 * pulse : 0.3;

    ctx.save();
    ctx.strokeStyle = `rgba(${color}, ${alpha})`;
    ctx.lineWidth = isCurrent ? 3 : 1.5;
    if (!isCurrent) ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(gate.x, gate.y, gate.radius, 0, TAU);
    ctx.stroke();

    if (isCurrent) {
      ctx.fillStyle = `rgba(${color}, 0.12)`;
      ctx.fill();
    }
    ctx.fillStyle = `rgba(${color}, ${isCurrent ? 1 : 0.55})`;
    ctx.font = '700 14px Anta, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), gate.x, gate.y);
    ctx.restore();
  }

  #drawPad(ctx, pad, moon, isCurrent, pulse) {
    const color = isCurrent ? COLORS.activePad : COLORS.upcomingPad;
    const alpha = isCurrent ? 0.7 + 0.3 * pulse : 0.35;
    // Canvas angles start at "3 o'clock"; bearings start at the top.
    const from = toRadians(pad.bearing - pad.halfWidth - 90);
    const to = toRadians(pad.bearing + pad.halfWidth - 90);

    ctx.save();
    ctx.strokeStyle = `rgba(${color}, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, moon.radius + 2, from, to);
    ctx.stroke();

    // Marker posts at both ends of the pad.
    ctx.lineWidth = 2;
    for (const edge of [-pad.halfWidth, pad.halfWidth]) {
      const base = pointAtBearing(moon, pad.bearing + edge, moon.radius);
      const tip = pointAtBearing(moon, pad.bearing + edge, moon.radius + 12);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  #drawBeacon(ctx, beacon, pulse) {
    const remaining = beacon.ticksLeft / beacon.lifetimeTicks;
    const size = 6 + 2 * pulse;

    ctx.save();
    // Countdown ring: the arc shrinks as the beacon runs out.
    ctx.strokeStyle = `rgba(${COLORS.beacon}, 0.9)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(beacon.x, beacon.y, beacon.radius, -TAU / 4, -TAU / 4 + TAU * remaining);
    ctx.stroke();

    ctx.fillStyle = `rgba(${COLORS.beacon}, ${0.7 + 0.3 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(beacon.x, beacon.y - size);
    ctx.lineTo(beacon.x + size, beacon.y);
    ctx.lineTo(beacon.x, beacon.y + size);
    ctx.lineTo(beacon.x - size, beacon.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
