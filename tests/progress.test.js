import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Progress, rankFor, RANKS } from '../js/levels/progress.js';

const LEVELS = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('only the first level is unlocked at the start', () => {
  const progress = new Progress(fakeStorage());
  assert.equal(progress.isUnlocked(LEVELS, 0), true);
  assert.equal(progress.isUnlocked(LEVELS, 1), false);
});

test('completing a level unlocks the next one', () => {
  const progress = new Progress(fakeStorage());
  progress.record('one', { score: 1200, stars: 1 });
  assert.equal(progress.isUnlocked(LEVELS, 1), true);
  assert.equal(progress.isUnlocked(LEVELS, 2), false);
});

test('only improvements replace the best result', () => {
  const progress = new Progress(fakeStorage());
  assert.deepEqual(progress.record('one', { score: 2000, stars: 2 }), {
    isNewBest: true,
    previousBest: null,
  });
  assert.deepEqual(progress.record('one', { score: 1500, stars: 1 }), {
    isNewBest: false,
    previousBest: 2000,
  });
  assert.deepEqual(progress.bestFor('one'), { score: 2000, stars: 2 });
});

test('progress survives a reload', () => {
  const storage = fakeStorage();
  new Progress(storage).record('one', { score: 900, stars: 3 });
  assert.deepEqual(new Progress(storage).bestFor('one'), { score: 900, stars: 3 });
});

test('broken or missing storage falls back to an empty record', () => {
  assert.equal(new Progress(fakeStorage({ 'moonLander.progress.v1': '{oops' })).bestFor('one'), null);
  const sessionOnly = new Progress(null);
  sessionOnly.record('one', { score: 1, stars: 1 });
  assert.equal(sessionOnly.totalStars(LEVELS), 1);
});

test('rank rises with total stars', () => {
  assert.equal(rankFor(0).title, RANKS[0].title);
  assert.equal(rankFor(RANKS[1].stars).title, RANKS[1].title);
  assert.equal(rankFor(RANKS[1].stars - 1).starsToNext, 1);

  const top = rankFor(999);
  assert.equal(top.title, RANKS.at(-1).title);
  assert.equal(top.nextTitle, null);
});
