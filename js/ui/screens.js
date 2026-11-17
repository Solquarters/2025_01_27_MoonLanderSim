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
    className: 'stars',
    role: 'img',
    ariaLabel: `${stars} of ${MAX_STARS} stars`,
    textContent: '★'.repeat(stars) + '☆'.repeat(MAX_STARS - stars),
  });
}

/**
 * The modal screens around a flight: mission select, briefing, pause, result
 * and help. Uses native <dialog> elements, which trap focus, make the page
 * behind inert and return focus when they close.
 *
 * @typedef {Object} ScreenHandlers
 * @property {(levelIndex: number) => void} onSelectLevel
 * @property {() => void} onLaunch       start the briefed mission
 * @property {() => void} onResume       continue the paused flight
 * @property {() => void} onRestart      fly the current mission again
 * @property {() => void} onNext
 * @property {() => void} onShowLevels
 */
export class Screens {
  #handlers;
  #dialogs;
  #el;
  #canResume = false;

  /** @param {ScreenHandlers} handlers */
  constructor(handlers) {
    this.#handlers = handlers;
    this.#dialogs = {
      levelSelect: requireElement('level-select-dialog'),
      briefing: requireElement('briefing-dialog'),
      result: requireElement('result-dialog'),
      pause: requireElement('pause-dialog'),
      help: requireElement('help-dialog'),
    };
    this.#el = {
      rank: requireElement('rank-summary'),
      levelList: requireElement('level-list'),
      levelSelectClose: requireElement('level-select-close'),
      briefingKicker: requireElement('briefing-kicker'),
      briefingTitle: requireElement('briefing-title'),
      briefingText: requireElement('briefing-text'),
      briefingObjectives: requireElement('briefing-objectives'),
      briefingTip: requireElement('briefing-tip'),
      briefingBest: requireElement('briefing-best'),
      briefingStart: requireElement('briefing-start'),
      resultKicker: requireElement('result-kicker'),
      resultTitle: requireElement('result-title'),
      resultDetail: requireElement('result-detail'),
      resultStars: requireElement('result-stars'),
      resultBreakdown: requireElement('result-breakdown'),
      resultTotal: requireElement('result-total'),
      resultBest: requireElement('result-best'),
      resultRetry: requireElement('result-retry'),
      resultNext: requireElement('result-next'),
      pauseSummary: requireElement('pause-summary'),
      pauseResume: requireElement('pause-resume'),
      helpClose: requireElement('help-close'),
    };
    this.#bindActions();
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
   * @param {boolean} options.canResume    a flight is paused behind the menu
   */
  showLevelSelect({ levels, progress, currentIndex, canResume }) {
    const totalStars = progress.totalStars(levels);
    const rank = rankFor(totalStars);
    const nextRank = rank.nextTitle
      ? `${rank.starsToNext} more for ${rank.nextTitle}`
      : 'Highest rank reached';
    this.#el.rank.textContent =
      `Rank: ${rank.title} · ${totalStars} of ${levels.length * MAX_STARS} stars · ${nextRank}`;

    const cards = levels.map((level, index) => this.#levelCard(level, index, progress, levels));
    this.#el.levelList.replaceChildren(...cards);

    this.#canResume = canResume;
    this.#el.levelSelectClose.hidden = !canResume;
    this.#show(this.#dialogs.levelSelect);

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
        : [`Two stars from ${formatScore(level.stars[0])} points, three from ${formatScore(level.stars[1])}.`])
    );

    this.#show(this.#dialogs.briefing);
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

    // The suggested next step is the highlighted, focused button.
    const suggestNext = result.completed && hasNext;
    elements.resultNext.hidden = !hasNext;
    elements.resultNext.classList.toggle('button--primary', suggestNext);
    elements.resultRetry.classList.toggle('button--primary', !suggestNext);
    this.#show(this.#dialogs.result);
    (suggestNext ? elements.resultNext : elements.resultRetry).focus();
  }

  /** @param {{ levelName: string, objective: string, score: number }} flight */
  showPause({ levelName, objective, score }) {
    this.#el.pauseSummary.textContent = `${levelName} · ${objective} · Score ${formatScore(score)}`;
    this.#show(this.#dialogs.pause);
    this.#el.pauseResume.focus();
  }

  /** Opens help on top of whatever screen is showing; closing it returns there. */
  showHelp() {
    const { help } = this.#dialogs;
    if (!help.open) help.showModal();
    this.#el.helpClose.focus();
  }

  #bestText(result, record) {
    if (!result.completed) return 'Points only count when the mission is completed.';
    if (record?.isNewBest && record.previousBest !== null) {
      return `New personal best! Previous: ${formatScore(record.previousBest)}`;
    }
    if (record?.isNewBest) return 'First completion!';
    return `Personal best: ${formatScore(record.previousBest)}`;
  }

  #levelCard(level, index, progress, levels) {
    const unlocked = progress.isUnlocked(levels, index);
    const best = progress.bestFor(level.id);
    const status = el('span', { className: 'level-card__status' });
    if (!unlocked) {
      status.textContent = 'Locked: complete the previous mission';
    } else if (best) {
      status.append(starRating(best.stars), ` Best ${formatScore(best.score)}`);
    } else {
      status.textContent = 'Not flown yet';
    }

    const button = el(
      'button',
      { type: 'button', className: 'button level-card', disabled: !unlocked },
      el('span', { className: 'digits', textContent: String(index + 1).padStart(2, '0') }),
      el('span', { textContent: level.name }),
      status
    );
    button.addEventListener('click', () => this.#handlers.onSelectLevel(index));
    return el('li', {}, button);
  }

  #bindActions() {
    const { levelSelect, briefing, result, pause, help } = this.#dialogs;
    const h = this.#handlers;
    const onClick = (id, handler) => requireElement(id).addEventListener('click', handler);

    onClick('level-select-close', () => h.onResume());
    onClick('level-select-help', () => this.showHelp());
    onClick('briefing-back', () => h.onShowLevels());
    onClick('briefing-help', () => this.showHelp());
    onClick('briefing-start', () => h.onLaunch());
    onClick('result-levels', () => h.onShowLevels());
    onClick('result-retry', () => h.onRestart());
    onClick('result-next', () => h.onNext());
    onClick('pause-resume', () => h.onResume());
    onClick('pause-restart', () => h.onRestart());
    onClick('pause-help', () => this.showHelp());
    onClick('pause-levels', () => h.onShowLevels());
    onClick('help-close', () => help.close());

    // Escape leaves a screen only when there is somewhere sensible to go.
    const onEscape = (dialog, handler) =>
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        handler();
      });
    onEscape(levelSelect, () => this.#canResume && h.onResume());
    onEscape(briefing, () => h.onShowLevels());
    onEscape(result, () => h.onShowLevels());
    onEscape(pause, () => h.onResume());
    onEscape(help, () => help.close());

    const onKey = (dialog, code, handler) =>
      dialog.addEventListener('keydown', (event) => {
        if (event.code === code && !event.repeat) handler();
      });
    onKey(result, 'KeyR', () => h.onRestart());
    onKey(pause, 'KeyP', () => h.onResume());
  }

  /** Shows one main screen, replacing any other. */
  #show(dialog) {
    for (const other of Object.values(this.#dialogs)) {
      if (other !== dialog && other.open) other.close();
    }
    if (!dialog.open) dialog.showModal();
  }
}
