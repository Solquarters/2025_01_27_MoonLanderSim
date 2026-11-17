import { Game } from './game.js';
import { Keyboard } from './input/keyboard.js';
import { ShipControls } from './input/shipControls.js';
import { TouchPad } from './input/touchPad.js';
import { LEVELS } from './levels/levels.js';
import { Progress } from './levels/progress.js';
import { MissionRenderer } from './render/missionRenderer.js';
import { SceneRenderer } from './render/sceneRenderer.js';
import { Starfield } from './render/starfield.js';
import { FpsCounter } from './ui/fpsCounter.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { StageScaler } from './ui/stageScaler.js';

const byId = (id) => document.getElementById(id);
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scene = new SceneRenderer(byId('scene'));
const hud = new Hud();
const shipControls = new ShipControls();
const keyboard = new Keyboard(shipControls);
new TouchPad(byId('touch-pad'), shipControls);

const screens = new Screens({
  onSelectLevel: (index) => game.selectLevel(index),
  onLaunch: () => game.launch(),
  onResume: () => game.launch(),
  onRestart: () => game.restart(),
  onNext: () => game.nextLevel(),
  onShowLevels: () => game.showLevels(),
});

const game = new Game({
  scene,
  missionRenderer: new MissionRenderer(),
  starfield: new Starfield(byId('starfield-static'), byId('starfield-flicker'), {
    animate: !prefersReducedMotion,
  }),
  hud,
  shipControls,
  keyboard,
  fpsCounter: new FpsCounter(byId('fps-counter')),
  screens,
  levels: LEVELS,
  progress: new Progress(),
});

// Keep the scene sharp at any window size and pixel density.
new StageScaler(byId('stage-frame'), byId('stage'), (scale) =>
  scene.setResolution(scale * window.devicePixelRatio)
);

hud.onPauseRequested(() => game.pause());
hud.onHelpRequested(() => game.showHelp());
keyboard.onKey('Space', () => game.restart());
keyboard.onKey('KeyR', () => game.restart());
keyboard.onKey('KeyP', () => game.pause());
keyboard.onKey('Escape', () => game.pause());
keyboard.onKey('KeyH', () => game.showHelp());

// Never let the ship fly on unattended.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});
window.addEventListener('blur', () => game.pause());

game.start();
