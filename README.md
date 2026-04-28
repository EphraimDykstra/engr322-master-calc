# ENGR 322 Master Calculator

A static web calculator covering the topics of Calvin University's **ENGR 322 — Machine Component Design**. Built as a vanilla HTML/JS port of a working Excel workbook so the same calculations are available from any browser, on any device, with no install.

**Live site:** https://ephraimdykstra.github.io/engr322-master-calc/

## Modules

| # | Module | Sections covered |
|---|---|---|
| M30 | Eccentric Bolts | symmetric pattern, non-symmetric grid, proof loading, riveted joints |
| M40 | Screw Jacks | thread geometry & friction, raise/lower torque, efficiency, self-locking, power |
| M50 | Welding & Adhesives | fillet weld basics, weld group as a line (Iu/Ju), electrode allowables, adhesive bond |
| M60 | Fatigue | mean & alternating stress, Marin endurance limit, Soderberg n_f |
| M70 | Shafts | static combined stress, DE-Soderberg n_f, set-screw holding torque, press fit, critical speed |
| M90 | Bearings | basic L₁₀ life, reliability-adjusted life, catalog rating from required life, equivalent radial load |
| M110 | Drive Trains | power/speed/torque, spur gear geometry, Lewis bending stress, belt/chain, helical, bevel, worm |
| M130 | Hydraulics | cylinder forces, flow & cycle time, hydraulic power, Darcy-Weisbach pressure drop, hoop stress, column buckling, pneumatics |
| M150 | Springs | geometry & rate, compression stress, tension hook, torsion, energy storage, Goodman fatigue |

## Conventions

- US customary units throughout (in, lb, ksi, RPM) unless a section is explicitly metric.
- Verdict thresholds (configurable in **Settings**): SAFE n ≥ 2.0, MARGINAL 1.0 ≤ n < 2.0, FAILS n < 1.0.
- Inputs are persisted in `localStorage` per module so values survive page reloads.
- Fatigue calculations assume infinite life (10⁶ cycles) unless noted.

## Project layout

```
index.html          Home page — links to each module
m30.html ... m150.html   Module page shells (all load modules.js + ui.js)
modules.js          All compute logic (one section per object, pure functions)
ui.js               Rendering engine, persistence, verdict logic, error banner
style.css           All styling
tests.html          Browser-based parity-test harness against the original Excel
```

## Verifying calculations

`tests.html` runs ~50 parity tests against numerical results from the original Excel workbook. Open it in a browser, or run headlessly:

```bash
node run-tests.js     # if you've copied the Node test runner alongside
```

A green PASS row means every spot-checked output matches the spreadsheet within tolerance.

## Local development

There is no build step. Open any `mXX.html` directly in a browser, or serve the folder over a tiny local HTTP server for nicer behavior with `localStorage`:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/m30.html
```

## Deployment (GitHub Pages)

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Deploy from a branch** → select `main` branch, root folder.
3. Visit `https://YOUR-USERNAME.github.io/engr322-master-calc/`.

## License & attribution

Personal coursework project for Calvin University ENGR 322. Formulas come from the course textbook and class notes; this site is a calculator over those formulas, not a substitute for them.
