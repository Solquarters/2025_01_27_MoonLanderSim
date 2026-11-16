import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMissionTime, formatSpeed } from '../js/ui/format.js';

test('mission time is zero-padded', () => {
  assert.equal(formatMissionTime(0), '00:00:00 . 000');
  assert.equal(formatMissionTime(65_432), '00:01:05 . 432');
  assert.equal(formatMissionTime(3_600_000 + 1), '01:00:00 . 001');
});

test('speed keeps two decimals and carries rounding into the whole part', () => {
  assert.equal(formatSpeed(1.456), '1 . 46');
  assert.equal(formatSpeed(0.999), '1 . 00');
  assert.equal(formatSpeed(0), '0 . 00');
});
