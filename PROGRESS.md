# ENGR 322 Master Calculator — Finalization Plan

This document is the **persistent, multi-session source of truth** for what is done and what is left before the calculator is considered finalized. Any Cowork (or Claude Code) session can read this file, see exactly where the work is, and pick up.

**Convention:** A box `[x]` means done and verified. A box `[ ]` means open. Every item has a **Check** describing how to objectively verify completion — either a file:line that should exist, or an automated test command.

---

## Status at a glance

| Phase | What | Status |
|---|---|---|
| 0 | Excel parity + GitHub Pages deploy | **DONE** |
| 1 | Critical accessibility (CRITICAL) | **DONE** |
| 2 | Touch target sizes (CRITICAL) | pending — next |
| 3 | Responsive layout fixes (HIGH) | pending |
| 4 | Per-input help text (UX pain point) | pending |
| 5 | Inline diagrams: M30 bolt grid + M60 Soderberg | pending |
| 6 | Style consistency polish | pending |
| 7 | Navigation polish (prev/next, TOC) | pending |

**Live site:** https://ephraimdykstra.github.io/engr322-master-calc/
**Repo:** https://github.com/EphraimDykstra/engr322-master-calc

---

## Phase 0 — Foundation (DONE)

- [x] **Excel parity tests**
  Check: `node /tmp/run-tests.js` reports PASS 62 / FAIL 0
- [x] **Live UI smoke tests**
  Check: `node /tmp/smoke-test.js` reports PASS 178 / FAIL 0 across all 9 modules
- [x] **All Excel sections ported (closes M40 collar/lift, M50 §4-§6+§9, M70 §5b metric)**
  Check: 62 parity tests cover every section listed in the README module table
- [x] **GitHub Pages deployed and serving 200**
  Check: `curl -s -o /dev/null -w "%{http_code}" https://ephraimdykstra.github.io/engr322-master-calc/` returns `200`
- [x] **Math correctness vs Shigley spot-check**
  Check: 8 representative formulas (M30/sym, M40/torque, M50/fillet, M60/marin, M70/de_sod, M70/critspeed, M90/l10, M150/geom) match the textbook expressions

---

## Phase 1 — Critical accessibility

Each item below corresponds to a finding in the UI/UX audit. Acceptance: visual + the automated `scripts/a11y-check.js` regression script reports zero failures.

- [x] **1.1 — `<label for=...>` linked to `<input id=...>`**
  Verified: every `.input-row label` has a `for=` matching its `<input/select id=...>`. `ui.js` builds `inputId = 'in-' + modId + '-' + secId + '-' + key`. Settings modal inputs (`set-fos-safe`, `set-fos-marginal`) also linked.
- [x] **1.2 — `:focus-visible` with visible outline ring**
  Verified: `.input-row input:focus-visible` and `.input-row select:focus-visible` in `style.css` apply `outline: 2px solid var(--accent); outline-offset: 1px`. Old bare `:focus { outline: none }` removed.
- [x] **1.3 — Focus styles on topbar nav buttons and `.math-toggle`**
  Verified: `.topbar .nav a:focus-visible`, `.topbar .nav button:focus-visible`, and `.math-toggle:focus-visible` rules in `style.css`.
- [x] **1.4 — `--text-muted` contrast ≥ 4.5:1 on `--bg-card`**
  Verified: `--text-muted` bumped from `#64748b` (3.4:1) to `#94a3b8` (6.6:1).
- [x] **1.5 — Bolt-grid remove button has `aria-label="Remove row N"`**
  Verified: `ui.js` `renderEditableTable` sets `aria-label='Remove row ' + (rowIdx+1)` and a matching `title`.
- [x] **1.6 — `prefers-reduced-motion` respected**
  Verified: `@media (prefers-reduced-motion: reduce) { *... transition-duration: 0.001ms !important ... }` block at end of `style.css`.
- [x] **1.7 — Heading hierarchy: io-block "Inputs"/"Outputs" promoted to `<h3>`**
  Verified: `ui.js` `renderSection` now emits `el('h3', ...)` for both labels.
- [x] **Phase 1 verification**
  `node scripts/a11y-check.js` reports PASS 427 / FAIL 4 (the 4 are Phase-2 touch-target items, not Phase-1). Parity 62/62, smoke 178/178 still green. Live build is now `v=5`.

---

## Phase 2 — Touch target sizes

- [ ] **2.1 — Inputs ≥ 36px tall** (`style.css` `.input-row input` padding ≥ 8px vertical)
- [ ] **2.2 — Topbar nav buttons ≥ 36px tall**
- [ ] **2.3 — `.math-toggle` ≥ 36px tall**
- [ ] **2.4 — `.rep-btn` (add/remove row) ≥ 36×36 with explicit CSS**
- [ ] **Phase 2 verification:** `node scripts/a11y-check.js` rule "touch-targets" reports zero failures.

---

## Phase 3 — Responsive layout

- [ ] **3.1 — `.input-row` reflows below 380px** (label on its own line)
- [ ] **3.2 — `.test-row` mobile fallback** (no horizontal scroll on phones)
- [ ] **3.3 — `.rep-table` wrapped in `overflow-x:auto` container**
- [ ] **Phase 3 verification:** open the live site at iPhone-width (375px) — inputs and tables fit without horizontal scroll. Documented as a manual screenshot check.

---

## Phase 4 — Per-input help text

The original UX pain point: "hard to know which input is which."

- [ ] **4.1 — `help.js` data file** with `{ moduleId: { sectionId: { inputKey: { symbol, plain, units, range? } } } }`
- [ ] **4.2 — UI renders symbol + plain description as a tooltip on label hover** AND as a small inline hint below the label on touch devices
- [ ] **4.3 — Coverage**: every input across all 9 modules has a help entry
- [ ] **Phase 4 verification:** `node scripts/help-coverage.js` reports 100% input coverage; spot-check m30 visually.

---

## Phase 5 — Inline diagrams

- [ ] **5.1 — M30 §2 bolt grid scatter diagram**: SVG showing bolt (x,y) positions with centroid marked and per-bolt resultant force vector sized by magnitude. Renders below the editable table, updates on input change.
- [ ] **5.2 — M60 §3 Soderberg n_f chart**: SVG with Soderberg failure line, load line, operating point, intersection. Mirrors the chart from the original Excel.
- [ ] **Phase 5 verification:** screenshot test — open both pages, confirm the SVG appears and reflects the current inputs.

---

## Phase 6 — Style consistency polish

- [ ] **6.1 — Border-radius collapsed to a 2-step scale** (e.g. 4px for inputs, 8px for cards)
- [ ] **6.2 — Shadow language consistent** (either both topbar+modal+cards have shadows, or neither does)
- [ ] **6.3 — Output text sizes ≥ 13px and contrast verified**

---

## Phase 7 — Navigation polish

- [ ] **7.1 — Prev/next module arrows in topbar on module pages**
- [ ] **7.2 — In-page section TOC (jump to §1, §2, etc.)**
- [ ] **7.3 — URL hash updates when scrolling between sections** (deep-linkable)

---

## How a future session resumes this

1. Read this file top-to-bottom.
2. Run the verification commands under each completed phase to confirm they still pass.
3. Find the first phase with `IN PROGRESS` or `pending` and start there.
4. After completing items, tick the boxes in this file, commit and push, and move to the next phase.
5. When every box is `[x]`, the calculator is finalized — bump the README to v1.0 and tag a release.
