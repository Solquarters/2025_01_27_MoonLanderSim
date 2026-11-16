import { Game } from './game.js';
import { Keyboard } from './input/keyboard.js';
import { SceneRenderer } from './render/sceneRenderer.js';
import { Starfield } from './render/starfield.js';
import { FpsCounter } from './ui/fpsCounter.js';
import { Hud } from './ui/hud.js';

const canvas = (id) => document.getElementById(id);

const hud = new Hud();
const keyboard = new Keyboard();
const game = new Game({
  scene: new SceneRenderer(canvas('gravityCanvas')),
  starfield: new Starfield(canvas('starryBg'), canvas('flickerCanvas')),
  hud,
  keyboard,
  fpsCounter: new FpsCounter(document.getElementById('fpsCounterId')),
});

hud.onRestartRequested(() => game.restart());
keyboard.onKey('Space', {
  down: () => hud.setRestartPressed(true),
  up: () => {
    hud.setRestartPressed(false);
    game.restart();
  },
});

game.start();
