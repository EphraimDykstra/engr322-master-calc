#!/usr/bin/env node
/* a11y-check.js — automated accessibility regression check
 *
 * Loads modules.js + ui.js into JSDOM, renders every module, and asserts the
 * accessibility invariants enforced by Phase 1 of PROGRESS.md.
 *
 * Run from the project root:
 *   node scripts/a11y-check.js
 *
 * Exits 0 on all-pass, 1 on any failure.
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  // Fall back to a /tmp install if local node_modules doesn't have jsdom yet.
  try { ({ JSDOM } = require('/tmp/node_modules/jsdom')); }
  catch (e2) { console.error('jsdom not installed. Run: npm install --no-save jsdom'); process.exit(2); }
}

const ROOT = path.resolve(__dirname, '..');
const modulesJS = fs.readFileSync(path.join(ROOT, 'modules.js'), 'utf8');
const uiJS      = fs.readFileSync(path.join(ROOT, 'ui.js'),      'utf8');
const styleCSS  = fs.readFileSync(path.join(ROOT, 'style.css'),  'utf8');

let totalChecks = 0, failures = [];
function assert(name, cond, detail) {
  totalChecks++;
  if (!cond) failures.push({ name, detail: detail || '' });
}

// --------------------------- Static CSS checks ---------------------------

// 1.2 :focus-visible exists for inputs/selects, and bare :focus { outline:none } is gone or scoped
assert('1.2 focus-visible-inputs',
  /:focus-visible[^{}]*\{[^}]*outline\s*:\s*[^0]/i.test(styleCSS) ||
  /input:focus-visible|select:focus-visible/i.test(styleCSS),
  'expected :focus-visible rule with non-zero outline for form controls');

assert('1.2 no-bare-outline-none',
  // bare ":focus { outline: none }" without a corresponding focus-visible replacement is the bug we're fixing
  !/:focus\s*\{\s*[^}]*outline\s*:\s*none/i.test(styleCSS) ||
  /:focus-visible/i.test(styleCSS),
  'remove `outline: none` on :focus, or pair it with a :focus-visible rule that puts the outline back');

// 1.3 focus styles on topbar nav and math-toggle
assert('1.3 focus-topbar-nav',
  /\.topbar\s+\.nav\s+(a|button):focus-visible/i.test(styleCSS),
  '.topbar .nav a/button needs a :focus-visible rule');
assert('1.3 focus-math-toggle',
  /\.math-toggle:focus-visible/i.test(styleCSS),
  '.math-toggle needs a :focus-visible rule');

// 1.4 --text-muted contrast
function hexToRgb(h) {
  h = h.replace('#','');
  if (h.length === 3) h = h.split('').map(c=>c+c).join('');
  return [0,2,4].map(i => parseInt(h.substr(i,2),16));
}
function relLum(rgb) {
  const [r,g,b] = rgb.map(c=>{ c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); });
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function contrast(hexA, hexB) {
  const la = relLum(hexToRgb(hexA)), lb = relLum(hexToRgb(hexB));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
const tokenMatch = (tok) => (styleCSS.match(new RegExp(`--${tok}\\s*:\\s*(#[0-9a-f]{3,6})`, 'i')) || [])[1];
const bgCard    = tokenMatch('bg-card');
const textMuted = tokenMatch('text-muted');
const textDim   = tokenMatch('text-dim');
if (bgCard && textMuted) {
  const r = contrast(textMuted, bgCard);
  assert('1.4 text-muted-contrast', r >= 4.5, `--text-muted (${textMuted}) on --bg-card (${bgCard}) = ${r.toFixed(2)}:1, need ≥ 4.5:1`);
}
if (bgCard && textDim) {
  const r = contrast(textDim, bgCard);
  assert('1.4 text-dim-contrast', r >= 4.5, `--text-dim (${textDim}) on --bg-card (${bgCard}) = ${r.toFixed(2)}:1, need ≥ 4.5:1`);
}

// 1.6 prefers-reduced-motion is referenced somewhere
assert('1.6 prefers-reduced-motion',
  /prefers-reduced-motion/i.test(styleCSS),
  'add @media (prefers-reduced-motion: reduce) {...} or wrap transitions in (prefers-reduced-motion: no-preference)');

// --------------------------- DOM checks (render every module) ---------------------------

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>',
  { runScripts: 'outside-only', pretendToBeVisual: true });
dom.window.eval(modulesJS);
dom.window.eval(uiJS);
const win = dom.window, doc = win.document;

const moduleIds = Object.keys(win.MODULES);

moduleIds.forEach(function (modId) {
  doc.getElementById('app').innerHTML = '';
  win.UI.renderModule(win.MODULES[modId], doc.getElementById('app'));

  // 1.1 every input has a label linked via for=/id=
  doc.querySelectorAll('.input-row').forEach(function (row, i) {
    const lbl = row.querySelector('label');
    const ctl = row.querySelector('input, select');
    if (!ctl || !lbl) return;
    const id = ctl.getAttribute('id');
    const fr = lbl.getAttribute('for');
    assert(`1.1 ${modId} input-${i} label-linked`,
      !!id && !!fr && id === fr,
      `input #${i} ("${lbl.textContent}") needs id="..." matching label for="..."`);
  });

  // 1.5 every <button> has accessible text (textContent OR aria-label)
  doc.querySelectorAll('button').forEach(function (btn, i) {
    const text = (btn.textContent || '').trim();
    const aria = btn.getAttribute('aria-label');
    const hasName = (text && text !== '−' && text !== '+') || (aria && aria.trim());
    assert(`1.5 ${modId} button-${i} has-name`,
      hasName,
      `button "${text}" needs textContent or aria-label`);
  });

  // 1.7 io-block headings should be h3 (not h4)
  doc.querySelectorAll('.io-block').forEach(function (block, i) {
    const h = block.querySelector('h2, h3, h4, h5, h6');
    if (!h) return;
    assert(`1.7 ${modId} io-block-${i} heading-h3`,
      h.tagName === 'H3',
      `expected <h3> for "${h.textContent}", got <${h.tagName.toLowerCase()}>`);
  });

  // 2.1 / 2.2 / 2.3 / 2.4 — touch target hints (CSS-static check; we look for min-height in style.css)
  // (Phase 2 will add CSS rules; until then this just records the gap.)
});

// 2.x touch target presence in CSS
const phase2Touches = [
  { name: '2.1 input-min-height', re: /\.input-row\s+input[^{}]*\{[^}]*min-height\s*:\s*(3[6-9]|[4-9]\d)px/i },
  { name: '2.2 nav-button-min-height', re: /\.topbar\s+\.nav\s+(a|button)[^{}]*\{[^}]*min-height\s*:\s*(3[6-9]|[4-9]\d)px/i },
  { name: '2.3 math-toggle-min-height', re: /\.math-toggle[^{}]*\{[^}]*min-height\s*:\s*(3[6-9]|[4-9]\d)px/i },
  { name: '2.4 rep-btn-min-size', re: /\.rep-btn[^{}]*\{[^}]*min-(width|height)\s*:\s*(3[6-9]|[4-9]\d)px/i }
];
phase2Touches.forEach(function (t) {
  assert(t.name, t.re.test(styleCSS), 'Phase 2: missing min-height/width rule');
});

// --------------------------- Report ---------------------------

const passed = totalChecks - failures.length;
console.log('');
console.log('=== a11y / Phase 1+2 Regression Check ===');
console.log(`PASS: ${passed}  FAIL: ${failures.length}  TOTAL: ${totalChecks}`);
if (failures.length) {
  console.log('');
  console.log('Failures:');
  failures.forEach(function (f) {
    console.log('  - ' + f.name + (f.detail ? '  -> ' + f.detail : ''));
  });
  process.exit(1);
}
process.exit(0);
