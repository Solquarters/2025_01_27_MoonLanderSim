import { Game } from './game.js';
import { Keyboard } from './input/keyboard.js';
import { LEVELS } from './levels/levels.js';
import { Progress } from './levels/progress.js';
import { MissionRenderer } from './render/missionRenderer.js';
import { SceneRenderer } from './render/sceneRenderer.js';
import { Starfield } from './render/starfield.js';
import { FpsCounter } from './ui/fpsCounter.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';

const byId = (id) => document.getElementById(id);

const hud = new Hud();
const keyboard = new Keyboard();
const screens = new Screens({
  onSelectLevel: (index) => game.selectLevel(index),
  onLaunch: () => game.launch(),
  onResume: () => game.launch(),
  onRetry: () => game.restart(),
  onNext: () => game.nextLevel(),
  onShowLevels: () => game.showLevels(),
});

const game = new Game({
  scene: new SceneRenderer(byId('gravityCanvas')),
  missionRenderer: new MissionRenderer(),
  starfield: new Starfield(byId('starryBg'), byId('flickerCanvas')),
  hud,
  keyboard,
  fpsCounter: new FpsCounter(byId('fpsCounterId')),
  screens,
  levels: LEVELS,
  progress: new Progress(),
});

hud.onMenuRequested(() => game.showLevels());
keyboard.onKey('Space', { down: () => game.restart() });
keyboard.onKey('KeyR', { down: () => game.restart() });
keyboard.onKey('Escape', { down: () => game.showLevels() });

game.start();
