import { rankFor } from '../levels/progress.js';
import { describeFailure, describeObjectives, formatScore } from './missionText.js';

const MAX_STARS = 3;

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Screen element not found: #${id}`);
  return element;
}

/** Small DOM builder: el('li', { className: 'x' }, child, 'text', ...). */
function el(tag, props = {}, ...children) {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children.filter((child) => child !== null && child !== undefined));
  return element;
}

/** Star rating as text plus an accessible label. */
function starRating(stars) {
  return el('span', {
    className: 'starsClass',
    role: 'img',
    ariaLabel: `${stars} of ${MAX_STARS} stars`,
    textContent: '★'.repeat(stars) + '☆'.repeat(MAX_STARS - stars),
  });
}

/**
 * The modal screens around a flight: mission select, briefing and result.
 * Uses native <dialog> elements, which trap focus and make the page behind inert.
 *
 * @typedef {Object} ScreenHandlers
 * @property {(levelIndex: number) => void} onSelectLevel
 * @property {() => void} onLaunch
 * @property {() => void} onRetry
 * @property {() => void} onNext
 * @property {() => void} onShowLevels
 * @property {() => void} onResume
 */
export class Screens {
  #handlers;
  #dialogs;
  #el;
  #levelSelectClosable = false;

  /** @param {ScreenHandlers} handlers */
  constructor(handlers) {
    this.#handlers = handlers;
    this.#dialogs = {
      levelSelect: requireElement('levelSelectDialog'),
      briefing: requireElement('briefingDialog'),
      result: requireElement('resultDialog'),
    };
    this.#el = {
      rank: requireElement('rankSummary'),
      levelList: requireElement('levelList'),
      levelSelectClose: requireElement('levelSelectClose'),
      briefingKicker: requireElement('briefingKicker'),
      briefingTitle: requireElement('briefingTitle'),
      briefingText: requireElement('briefingText'),
      briefingObjectives: requireElement('briefingObjectives'),
      briefingTip: requireElement('briefingTip'),
      briefingBest: requireElement('briefingBest'),
      briefingBack: requireElement('briefingBack'),
      briefingStart: requireElement('briefingStart'),
      resultKicker: requireElement('resultKicker'),
      resultTitle: requireElement('resultTitle'),
      resultDetail: requireElement('resultDetail'),
      resultStars: requireElement('resultStars'),
      resultBreakdown: requireElement('resultBreakdown'),
      resultTotal: requireElement('resultTotal'),
      resultBest: requireElement('resultBest'),
      resultLevels: requireElement('resultLevels'),
      resultRetry: requireElement('resultRetry'),
      resultNext: requireElement('resultNext'),
    };
    this.#bindActions();
  }

  get isOpen() {
    return Object.values(this.#dialogs).some((dialog) => dialog.open);
  }

  closeAll() {
    for (const dialog of Object.values(this.#dialogs)) {
      if (dialog.open) dialog.close();
    }
  }

  /**
   * @param {Object} options
   * @param {readonly import('../levels/levels.js').Level[]} options.levels
   * @param {import('../levels/progress.js').Progress} options.progress
   * @param {number} options.currentIndex  level to focus
   * @param {boolean} options.canResume    a flight is in progress behind the menu
   */
  showLevelSelect({ levels, progress, currentIndex, canResume }) {
    const rank = rankFor(progress.totalStars(levels));
    const starTotal = `${progress.totalStars(levels)} / ${levels.length * MAX_STARS} stars`;
    const nextRank = rank.nextTitle
      ? `${rank.starsToNext} more for ${rank.nextTitle}`
      : 'Highest rank reached';
    this.#el.rank.textContent = `Rank: ${rank.title} · ${starTotal} · ${nextRank}`;

    const cards = levels.map((level, index) => this.#levelCard(level, index, progress, levels));
    this.#el.levelList.replaceChildren(...cards);

    this.#levelSelectClosable = canResume;
    this.#el.levelSelectClose.hidden = !canResume;
    this.#open(this.#dialogs.levelSelect);

    const focusTarget =
      cards[currentIndex]?.querySelector('button:not(:disabled)') ??
      this.#el.levelList.querySelector('button:not(:disabled)');
    focusTarget?.focus();
  }

  /**
   * @param {import('../levels/levels.js').Level} level
   * @param {number} index
   * @param {{score: number, stars: number}|null} best
   */
  showBriefing(level, index, best) {
    const elements = this.#el;
    elements.briefingKicker.textContent = `Mission ${index + 1}`;
    elements.briefingTitle.textContent = level.name;
    elements.briefingText.textContent = level.briefing;
    elements.briefingObjectives.replaceChildren(
      ...describeObjectives(level).map((line) => el('li', { textContent: line }))
    );
    elements.briefingTip.textContent = `Tip: ${level.tip}`;
    elements.briefingBest.replaceChildren(
      ...(best
        ? ['Your best: ', formatScore(best.score), ' ', starRating(best.stars)]
        : [`Two stars from ${formatScore(level.stars[0])}, three from ${formatScore(level.stars[1])} points.`])
    );

    this.#open(this.#dialogs.briefing);
    elements.briefingStart.focus();
  }

  /**
   * @param {ReturnType<import('../levels/mission.js').Mission['result']>} result
   * @param {Object} context
   * @param {import('../levels/levels.js').Level} context.level
   * @param {number} context.levelIndex
   * @param {boolean} context.hasNext           a following level exists and is unlocked
   * @param {{isNewBest: boolean, previousBest: number|null}|null} context.record
   */
  showResult(result, { level, levelIndex, hasNext, record }) {
    const elements = this.#el;
    const failure = result.completed ? null : describeFailure(result.failReason);

    elements.resultKicker.textContent = `Mission ${levelIndex + 1}: ${level.name}`;
    elements.resultTitle.textContent = result.completed ? 'Mission complete' : failure.title;
    elements.resultDetail.textContent = result.completed
      ? `Flight time ${result.elapsedSeconds.toFixed(1)} s (par ${level.parSeconds} s).`
      : failure.detail;
    this.#dialogs.result.classList.toggle('is-failure', !result.completed);

    elements.resultStars.replaceChildren(...(result.completed ? [starRating(result.stars)] : []));
    elements.resultBreakdown.replaceChildren(
      ...result.breakdown.map(({ label, points, count }) =>
        el(
          'tr',
          {},
          el('th', { scope: 'row', textContent: count > 1 ? `${label} (${count})` : label }),
          el('td', { textContent: `+${formatScore(points)}` })
        )
      )
    );
    elements.resultTotal.textContent = formatScore(result.score);
    elements.resultBest.textContent = this.#bestText(result, record);

    elements.resultNext.hidden = !hasNext;
    this.#open(this.#dialogs.result);
    (result.completed && hasNext ? elements.resultNext : elements.resultRetry).focus();
  }

  #bestText(result, record) {
    if (!result.completed) return 'Points only count when the mission is completed.';
    if (record?.isNewBest && record.previousBest !== null) {
      return `New personal best! Previous: ${formatScore(record.previousBest)}`;
    }
    if (record?.isNewBest) return 'First completion. Next mission unlocked!';
    return `Personal best: ${formatScore(record.previousBest)}`;
  }

  #levelCard(level, index, progress, levels) {
    const unlocked = progress.isUnlocked(levels, index);
    const best = progress.bestFor(level.id);
    const status = !unlocked
      ? el('span', { className: 'levelStatusClass', textContent: 'Locked: complete the previous mission' })
      : best
        ? el('span', { className: 'levelStatusClass' }, starRating(best.stars), ` Best ${formatScore(best.score)}`)
        : el('span', { className: 'levelStatusClass', textContent: 'Not flown yet' });

    const button = el(
      'button',
      { type: 'button', className: 'levelCardClass', disabled: !unlocked },
      el('span', { className: 'levelNumberClass', textContent: String(index + 1).padStart(2, '0') }),
      el('span', { className: 'levelNameClass', textContent: level.name }),
      status
    );
    button.addEventListener('click', () => this.#handlers.onSelectLevel(index));
    return el('li', {}, button);
  }

  #bindActions() {
    const { levelSelect, briefing, result } = this.#dialogs;
    const elements = this.#el;
    const h = this.#handlers;

    elements.levelSelectClose.addEventListener('click', () => h.onResume());
    elements.briefingBack.addEventListener('click', () => h.onShowLevels());
    elements.briefingStart.addEventListener('click', () => h.onLaunch());
    elements.resultLevels.addEventListener('click', () => h.onShowLevels());
    elements.resultRetry.addEventListener('click', () => h.onRetry());
    elements.resultNext.addEventListener('click', () => h.onNext());

    // Escape: leave a screen only when there is somewhere sensible to go.
    levelSelect.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (this.#levelSelectClosable) h.onResume();
    });
    briefing.addEventListener('cancel', (event) => {
      event.preventDefault();
      h.onShowLevels();
    });
    result.addEventListener('cancel', (event) => {
      event.preventDefault();
      h.onShowLevels();
    });
    result.addEventListener('keydown', (event) => {
      if (event.code === 'KeyR') h.onRetry();
    });
  }

  #open(dialog) {
    for (const other of Object.values(this.#dialogs)) {
      if (other !== dialog && other.open) other.close();
    }
    if (!dialog.open) dialog.showModal();
  }
}
