import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANDING } from '../js/config.js';
import {
  beaconScore,
  COMBO,
  completionBonuses,
  gateScore,
  landingScore,
  nextCombo,
  reactionGrade,
  SCORE,
  starsFor,
} from '../js/levels/scoring.js';

const pointsOf = (awards, label) => awards.find((award) => award.label === label)?.points;

test('a gate reached at par time earns the base score only', () => {
  assert.equal(gateScore(6, 6, 1), SCORE.gate);
  assert.equal(gateScore(60, 6, 1), SCORE.gate);
});

test('a faster gate split earns more', () => {
  assert.equal(gateScore(0, 6, 1), SCORE.gate + SCORE.gateSpeedBonus);
  assert.ok(gateScore(2, 6, 1) > gateScore(4, 6, 1));
});

test('the combo multiplies gate points and is capped', () => {
  assert.equal(gateScore(6, 6, 2), SCORE.gate * 2);
  assert.equal(nextCombo(COMBO.start), COMBO.start + COMBO.step);
  assert.equal(nextCombo(COMBO.max), COMBO.max);
});

test('a perfect touchdown on the pad centre earns every landing bonus', () => {
  const awards = landingScore({ speed: 0, tiltDeg: 0, padOffset: 0 });
  assert.equal(pointsOf(awards, 'Touchdown'), SCORE.landing);
  assert.equal(pointsOf(awards, 'Soft touch'), SCORE.softTouchdown);
  assert.equal(pointsOf(awards, 'Upright'), SCORE.uprightTouchdown);
  assert.equal(pointsOf(awards, 'Pad accuracy'), SCORE.padCentre);
});

test('a touchdown at the limits earns only the base landing score', () => {
  const awards = landingScore({ speed: LANDING.maxSpeed, tiltDeg: LANDING.maxTiltDeg, padOffset: 1 });
  const total = awards.reduce((sum, award) => sum + award.points, 0);
  assert.equal(total, SCORE.landing);
});

test('landing without a pad has no accuracy entry', () => {
  const awards = landingScore({ speed: 1, tiltDeg: 5, padOffset: null });
  assert.equal(pointsOf(awards, 'Pad accuracy'), undefined);
});

test('faster reactions get better grades', () => {
  assert.equal(reactionGrade(0.5).label, 'LIGHTNING');
  assert.equal(reactionGrade(1).label, 'SHARP');
  assert.equal(reactionGrade(1.9).label, 'STEADY');
  assert.equal(reactionGrade(5).label, 'SLOW');
  assert.ok(reactionGrade(0.5).points > reactionGrade(5).points);
});

test('a beacon is worth more the earlier it is collected', () => {
  assert.equal(beaconScore(1), SCORE.beaconMax);
  assert.equal(beaconScore(0), SCORE.beaconMin);
  assert.ok(beaconScore(0.8) > beaconScore(0.2));
});

test('completion bonuses reward spare time and fuel, never negative', () => {
  const [time, fuel] = completionBonuses({ elapsedSeconds: 20, parSeconds: 30, fuel: 50 });
  assert.equal(time.points, 10 * SCORE.timeBonusPerSecond);
  assert.equal(fuel.points, 50 * SCORE.fuelBonusPerPercent);

  const [late] = completionBonuses({ elapsedSeconds: 99, parSeconds: 30, fuel: 0 });
  assert.equal(late.points, 0);
});

test('stars follow the level thresholds', () => {
  assert.equal(starsFor(100, [1000, 2000]), 1);
  assert.equal(starsFor(1000, [1000, 2000]), 2);
  assert.equal(starsFor(2500, [1000, 2000]), 3);
});
