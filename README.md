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
| Esc | Mission select (pauses the flight) |

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
index.html, style.css   page and HUD markup/styles
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
js/input/keyboard.js    keyboard to ship controls
js/render/              canvas drawing (scene, mission markers, starfield)
js/ui/                  DOM: HUD, screens (select, briefing, result), texts
tests/                  unit tests for the DOM-free modules
tools/dev-server.mjs    static server behind `npm start`
```

Rule of thumb: `js/sim` and `js/levels` decide what happens, `js/render` and `js/ui` only show it.

`gimbal.html`, `gimbal2.html` and `analog_css_button.html` are standalone experiments and not part of the game.

## Roadmap

- [x] Frame-rate independent physics (fixed tick)
- [x] "Oxygen depleted" message
- [x] "Fuel depleted" message
- [x] Missions: orbit, gates, land at a given spot
- [ ] Responsive layout
- [ ] More mission types: swing-by, lowest orbit in a given time
- [ ] Time warp slider (as in Kerbal Space Program)
- [ ] Record the flight path and replay it ("landing with style")
- [ ] Audio: ambience, thrust, explosion
- [ ] Velocity-over-time graph
- [ ] Moon phases
