# Moon Lander Sim

A fun moon lander simulation in vanilla JavaScript. Side project to explore what Canvas 2D can do and to build up maths and physics basics.

## Run it

The game uses ES modules, which browsers only load from a web server (not from a `file://` path).

```
npm start        # serves the folder at http://localhost:8080
npm test         # runs the unit tests (Node 20+ built-in test runner)
```

There are no dependencies and no build step. Any static server works (for example the VS Code "Live Server" extension).

## Controls

| Key | Action |
| --- | --- |
| Arrow Up | Main engine (pushes along the nose) |
| Arrow Down | Retro engine |
| Arrow Left / Right | Rotate |
| S | Stabilize rotation |
| Space or R | Restart the mission |
| P or Esc | Pause (resume, restart, missions, help) |
| H | Controls and scoring help |

On touch devices, on-screen buttons replace the keys. The flight pauses by itself when the tab or window loses focus.

Land slower than 1.5 px/tick and within 20° of upright, before fuel and oxygen run out.

## Missions and rewards

Six missions unlock one after another. Each is a list of objectives flown in order:

- **Gates**: fly through numbered rings. Reaching a gate faster than its par time earns a speed bonus, and reaching the next gate inside the combo window raises a multiplier (x1.5, x2 ... up to x3).
- **Orbit**: circle the moon without touching down.
- **Landing**: anywhere or on a marked pad. Soft, upright and centred touchdowns score extra.

Two events test reaction:

- **Gyro fault**: the ship is suddenly kicked into a spin at a random moment. The time until it is steady again is graded (LIGHTNING, SHARP, STEADY, SLOW).
- **Bonus beacon**: appears beside your predicted flight path for a few seconds. The sooner you grab it, the more it is worth.

Finishing under par time and with fuel left adds bonuses. The total decides one to three stars per mission; stars add up to a pilot rank. Best scores are stored in the browser (localStorage).

To add a mission, append an entry to `LEVELS` in `js/levels/levels.js`. Scores and grades are tuned in `js/levels/scoring.js`.

## Project layout

```
index.html, style.css   page markup and styles (design tokens at the top of style.css)
js/config.js            every tuning value in one place
js/main.js              wires the parts together
js/game.js              main loop (fixed 60 Hz physics tick)
js/sim/                 game world, no DOM access, unit-tested
  physics.js            pure helpers: gravity, tilt, trajectory prediction
  simulation.js         ship, fuel, oxygen, landing and crash rules
  debris.js             wreckage after a crash
js/levels/              missions, no DOM access, unit-tested
  levels.js             campaign data: spawn, objectives, events, star thresholds
  mission.js            runtime: objective progress, combo, reaction events, score
  scoring.js            pure scoring rules
  progress.js           best scores, unlocks and rank (localStorage)
js/input/               shipControls (shared state), keyboard, touchPad
js/render/              canvas drawing (scene, mission markers, starfield)
js/ui/                  DOM: HUD, screens (dialogs), stage scaling, texts
tests/                  unit tests for the DOM-free modules
tools/dev-server.mjs    static server behind `npm start`
```

Rule of thumb: `js/sim` and `js/levels` decide what happens, `js/render` and `js/ui` only show it.

## Interface notes

- The stage has a fixed layout (1200 x 800 world plus instrument bars) and is scaled to fit the window, so the HUD always lines up with the play field. The world size in `style.css` (`--world-width/height`) must match `WORLD` in `js/config.js`.
- Instruments sit around the world, never on top of it. Only short alerts appear inside it.
- Screens are native `<dialog>` elements: focus is trapped, Escape works, and the page behind is inert.
- Warnings never rely on colour alone (text accompanies every state), gauges expose their values to screen readers, and `prefers-reduced-motion` switches off blinking and star flicker.

`gimbal.html`, `gimbal2.html` and `analog_css_button.html` are standalone experiments and not part of the game.

## Roadmap

- [x] Frame-rate independent physics (fixed tick)
- [x] "Oxygen depleted" message
- [x] "Fuel depleted" message
- [x] Missions: orbit, gates, land at a given spot
- [x] Responsive layout (scaled stage), pause, help, touch controls
- [ ] Dedicated phone layout (portrait currently asks to rotate)
- [ ] More mission types: swing-by, lowest orbit in a given time
- [ ] Time warp slider (as in Kerbal Space Program)
- [ ] Record the flight path and replay it ("landing with style")
- [ ] Audio: ambience, thrust, explosion
- [ ] Velocity-over-time graph
- [ ] Roll-over-time graph
- [ ] Moon phases
- [ ] Rendezvous with orbital station
