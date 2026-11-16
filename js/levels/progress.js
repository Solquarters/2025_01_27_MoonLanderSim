const STORAGE_KEY = 'moonLander.progress.v1';

/** Pilot ranks by total stars, lowest first. */
export const RANKS = Object.freeze([
  Object.freeze({ stars: 0, title: 'Cadet' }),
  Object.freeze({ stars: 3, title: 'Pilot' }),
  Object.freeze({ stars: 7, title: 'Flight Officer' }),
  Object.freeze({ stars: 11, title: 'Commander' }),
  Object.freeze({ stars: 15, title: 'Ace' }),
  Object.freeze({ stars: 18, title: 'Lunar Legend' }),
]);

/** Rank for a star total, plus what is needed for the next one. */
export function rankFor(totalStars) {
  const index = RANKS.findLastIndex((rank) => totalStars >= rank.stars);
  const next = RANKS[index + 1] ?? null;
  return {
    title: RANKS[index].title,
    nextTitle: next?.title ?? null,
    starsToNext: next ? next.stars - totalStars : 0,
  };
}

/**
 * Best results per level, kept in localStorage.
 * Works without storage too (private mode, Node): progress then lasts for the session.
 */
export class Progress {
  #storage;
  #best = {};

  /** @param {Pick<Storage, 'getItem'|'setItem'>|null} storage */
  constructor(storage = safeLocalStorage()) {
    this.#storage = storage;
    this.#best = this.#load();
  }

  /** @returns {{score: number, stars: number}|null} */
  bestFor(levelId) {
    return this.#best[levelId] ?? null;
  }

  /** A level unlocks once the one before it has been completed. */
  isUnlocked(levels, index) {
    return index === 0 || this.bestFor(levels[index - 1].id) !== null;
  }

  totalStars(levels) {
    return levels.reduce((sum, level) => sum + (this.bestFor(level.id)?.stars ?? 0), 0);
  }

  /**
   * Stores a completed attempt if it beats the previous best.
   * @returns {{isNewBest: boolean, previousBest: number|null}}
   */
  record(levelId, { score, stars }) {
    const previous = this.bestFor(levelId);
    const isNewBest = previous === null || score > previous.score;
    this.#best[levelId] = {
      score: Math.max(score, previous?.score ?? 0),
      stars: Math.max(stars, previous?.stars ?? 0),
    };
    this.#save();
    return { isNewBest, previousBest: previous?.score ?? null };
  }

  #load() {
    try {
      const parsed = JSON.parse(this.#storage?.getItem(STORAGE_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  #save() {
    try {
      this.#storage?.setItem(STORAGE_KEY, JSON.stringify(this.#best));
    } catch {
      // Storage full or blocked: keep playing with in-memory progress.
    }
  }
}

function safeLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
