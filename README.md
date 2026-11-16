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
| Space | Restart |

Land slower than 1.5 px/tick and within 20° of upright, before fuel and oxygen run out.

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
js/input/keyboard.js    keyboard to ship controls
js/render/              canvas drawing (scene, starfield)
js/ui/                  DOM instruments (HUD, FPS counter, formatting)
tests/                  unit tests for the DOM-free modules
tools/dev-server.mjs    static server behind `npm start`
```

Rule of thumb: `js/sim` decides what happens, `js/render` and `js/ui` only show it.

`gimbal.html`, `gimbal2.html` and `analog_css_button.html` are standalone experiments and not part of the game.

## Roadmap

- [x] Frame-rate independent physics (fixed tick)
- [x] "Oxygen depleted" message
- [ ] "Fuel depleted" message
- [ ] Responsive layout
- [ ] Missions: orbit, land at a given spot
- [ ] Time warp slider (as in Kerbal Space Program)
- [ ] Record the flight path and replay it ("landing with style")
- [ ] Audio: ambience, thrust, explosion
- [ ] Velocity-over-time graph
- [ ] Moon phases
