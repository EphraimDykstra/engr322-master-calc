/* ENGR 322 Master Calculator - UI rendering engine
   Provides rendering, persistence, and verdict logic.
*/
(function (global) {
  'use strict';

  // ------------------------- Storage -------------------------
  // Use localStorage when available; otherwise fall back to in-memory store
  var memStore = {};
  function hasLS() {
    try { var k = '__test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  }
  var LS = hasLS();
  function lsGet(key, fallback) {
    try {
      var v = LS ? localStorage.getItem(key) : memStore[key];
      if (v == null) return fallback;
      return JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    var s = JSON.stringify(value);
    if (LS) localStorage.setItem(key, s);
    else memStore[key] = s;
  }

  // ------------------------- Settings (FoS thresholds) -------------------------
  var DEFAULT_SETTINGS = { FoS_Safe: 2.0, FoS_Marginal: 1.0 };

  function loadSettings() {
    var s = lsGet('engr322_settings', null);
    if (!s) return Object.assign({}, DEFAULT_SETTINGS);
    return Object.assign({}, DEFAULT_SETTINGS, s);
  }
  function saveSettings(s) { lsSet('engr322_settings', s); }

  // ------------------------- Module input persistence -------------------------
  // UI_BUILD is the human-visible build label shown in the topbar; bump whenever
  // ui.js / modules.js change so the user can confirm fresh code loaded.
  // STATE_VERSION is bumped only when the saved-state SHAPE changes (purges localStorage).
  var UI_BUILD = 5;
  var STATE_VERSION = 2;
  var VERSION_KEY = 'engr322_state_version';

  function migrateIfNeeded() {
    var v = lsGet(VERSION_KEY, null);
    if (v === STATE_VERSION) return;
    // Wipe any engr322_* keys -- they may be from the broken build with a different shape.
    try {
      if (LS) {
        var toDel = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('engr322_') === 0) toDel.push(k);
        }
        toDel.forEach(function (k) { localStorage.removeItem(k); });
      } else {
        for (var k2 in memStore) { if (k2.indexOf('engr322_') === 0) delete memStore[k2]; }
      }
    } catch (e) { /* ignore */ }
    lsSet(VERSION_KEY, STATE_VERSION);
  }
  migrateIfNeeded();

  function inputKey(modId) { return 'engr322_inputs_' + modId; }
  function loadInputs(modId) { return lsGet(inputKey(modId), {}); }
  function saveInputs(modId, state) { lsSet(inputKey(modId), state); }
  function clearInputs(modId) {
    if (LS) localStorage.removeItem(inputKey(modId));
    else delete memStore[inputKey(modId)];
  }

  // ------------------------- Helpers -------------------------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'on' && typeof attrs[k] === 'object') {
          for (var ev in attrs[k]) node.addEventListener(ev, attrs[k][ev]);
        }
        else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c == null) continue;
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      }
    }
    return node;
  }

  function fmt(v, decimals) {
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return '—';
    if (typeof v === 'string') return v;
    if (typeof v !== 'number') return String(v);
    var d = decimals == null ? 3 : decimals;
    if (Math.abs(v) >= 100000 || (Math.abs(v) > 0 && Math.abs(v) < 0.001)) {
      return v.toExponential(2);
    }
    return v.toFixed(d).replace(/\.?0+$/, function (m) {
      return m === '' ? '' : '';
    });
  }

  function fmtFixed(v, d) {
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return '—';
    if (typeof v !== 'number') return String(v);
    return v.toFixed(d == null ? 3 : d);
  }

  // verdict('fos', 1.6, settings)  →  { kind: 'marginal', label: 'MARGINAL', text: '1.60' }
  // verdict('safe'|'fail'|'info', label)  →  forced verdict
  function verdict(kind, value, settings) {
    if (kind === 'fos') {
      var s = settings || loadSettings();
      if (value == null || !isFinite(value)) return { kind: 'info', label: 'N/A', value: value };
      if (value >= s.FoS_Safe) return { kind: 'safe', label: 'SAFE', value: value };
      if (value >= s.FoS_Marginal) return { kind: 'marginal', label: 'MARGINAL', value: value };
      return { kind: 'fail', label: 'FAILS', value: value };
    }
    return { kind: kind, label: value, value: null };
  }

  function renderVerdictBanner(v, label) {
    var k = v && v.kind ? v.kind : 'info';
    var lbl = v && v.label != null ? v.label : '—';
    var content;
    if (label) {
      content = el('span', {}, label + ': ' + lbl + (v && typeof v.value === 'number' ? ' (n = ' + fmtFixed(v.value, 2) + ')' : ''));
    } else {
      content = el('span', {}, lbl + (v && typeof v.value === 'number' ? ' (n = ' + fmtFixed(v.value, 2) + ')' : ''));
    }
    return el('div', { class: 'verdict ' + k }, [
      el('span', { class: 'v-label' }, k.toUpperCase()),
      content
    ]);
  }

  // ------------------------- Section rendering -------------------------
  // Map output fmt strings to decimal counts.
  function fmtDecimals(fmt) {
    if (typeof fmt === 'string') {
      var m = /^fixed(\d+)$/.exec(fmt);
      if (m) return Number(m[1]);
    }
    return null;
  }

  // Normalize an input's options into [{value, label}, ...].
  function normOptions(opts) {
    if (!opts) return [];
    return opts.map(function (o) {
      if (o && typeof o === 'object') {
        return { value: o.value != null ? o.value : o.label, label: o.label != null ? o.label : o.value };
      }
      return { value: o, label: String(o) };
    });
  }

  // Map module-defined input types to HTML <input type="..."> values.
  function htmlInputType(t) {
    if (t === 'text') return 'text';
    return 'number'; // 'int', undefined, null, anything numeric -> number
  }

  function renderSection(modId, sec, state, settings, onChange) {
    var card = el('div', { class: 'section', id: 'sec-' + sec.id });
    card.appendChild(el('h2', {}, sec.title));
    if (sec.blurb) card.appendChild(el('p', { class: 'blurb' }, sec.blurb));

    // initialize state for this section
    var secState = state[sec.id] = state[sec.id] || {};
    (sec.inputs || []).forEach(function (inp) {
      if (secState[inp.key] == null) {
        var opts = normOptions(inp.options);
        secState[inp.key] = inp.default != null ? inp.default : (opts.length ? opts[0].value : '');
      }
    });

    // ---------- repeating editable table (e.g. m30/grid bolt list) ----------
    // sec.repeating is a CONFIG object: { key, label, columns:[{key,label}], minRows, defaultRows }
    var repHost = null;
    if (sec.repeating && typeof sec.repeating === 'object') {
      var rep = sec.repeating;
      // initialize state[rep.key] from defaultRows if missing/empty
      if (!Array.isArray(secState[rep.key]) || !secState[rep.key].length) {
        secState[rep.key] = (rep.defaultRows || []).map(function (r) {
          var copy = {}; for (var k in r) copy[k] = r[k]; return copy;
        });
      }
      repHost = el('div', { class: 'rep-host' });
      card.appendChild(repHost);
      renderEditableTable(repHost, rep, secState, onChange);
    }

    // input/output two-column grid
    var grid = el('div', { class: 'io-grid' });
    var inBlock = el('div', { class: 'io-block' });
    inBlock.appendChild(el('h3', {}, 'Inputs'));
    var outBlock = el('div', { class: 'io-block' });
    outBlock.appendChild(el('h3', {}, 'Outputs'));

    // render inputs
    (sec.inputs || []).forEach(function (inp) {
      var row = el('div', { class: 'input-row' });
      // Stable, unique id per input — ties <label for> to <input/select id> for screen readers.
      var inputId = 'in-' + modId + '-' + sec.id + '-' + inp.key;
      row.appendChild(el('label', { for: inputId, title: inp.label }, inp.label));
      var control;
      if (inp.options || inp.type === 'select') {
        var opts = normOptions(inp.options);
        control = el('select', {
          id: inputId,
          on: { change: function (e) { secState[inp.key] = e.target.value; onChange(); } }
        });
        opts.forEach(function (o) {
          var opt = el('option', { value: o.value }, o.label);
          if (String(secState[inp.key]) === String(o.value)) opt.selected = true;
          control.appendChild(opt);
        });
      } else {
        var ht = htmlInputType(inp.type);
        var step = inp.step != null ? inp.step : (inp.type === 'int' ? '1' : 'any');
        control = el('input', {
          id: inputId,
          type: ht,
          step: step,
          value: secState[inp.key],
          on: {
            input: function (e) {
              var v = e.target.value;
              if (ht === 'text') secState[inp.key] = v;
              else secState[inp.key] = (v === '' ? '' : Number(v));
              onChange();
            }
          }
        });
      }
      row.appendChild(control);
      row.appendChild(el('span', { class: 'unit' }, inp.unit || ''));
      inBlock.appendChild(row);
    });

    // compute & render outputs (placeholders, populated by update())
    var outputRows = {};
    (sec.outputs || []).forEach(function (out) {
      var row = el('div', { class: 'output-row' });
      row.appendChild(el('label', { title: out.label }, out.label));
      var val = el('div', { class: 'value' }, '—');
      row.appendChild(val);
      row.appendChild(el('span', { class: 'unit' }, out.unit || ''));
      outBlock.appendChild(row);
      outputRows[out.key] = val;
    });

    grid.appendChild(inBlock);
    grid.appendChild(outBlock);
    card.appendChild(grid);

    // verdict banner placeholder
    var verdictHost = el('div');
    card.appendChild(verdictHost);

    // math toggle (always present; populated only when compute returns math)
    var mathBtn = el('button', {
      class: 'math-toggle',
      on: { click: function () { mathHost.classList.toggle('show'); mathBtn.textContent = mathHost.classList.contains('show') ? 'Hide math' : 'Show math'; } }
    }, 'Show math');
    var mathHost = el('div', { class: 'math-panel' });

    // We'll attach the button + panel only if the section produces math (decided in update()).
    var mathAttached = false;
    function ensureMathAttached() {
      if (!mathAttached) {
        card.appendChild(mathBtn);
        card.appendChild(mathHost);
        mathAttached = true;
      }
    }

    // optional note
    if (sec.note) card.appendChild(el('div', { class: 'note', html: sec.note }));

    // update() - recomputes outputs, verdict, math, repeating tables
    function update() {
      var calc;
      try { calc = sec.compute(secState, settings) || {}; }
      catch (e) { calc = { _error: e.message, outputs: {} }; }
      var outputs = calc.outputs || {};

      // outputs
      (sec.outputs || []).forEach(function (out) {
        var v = outputs[out.key];
        var d = fmtDecimals(out.fmt);
        if (d == null) d = (out.decimals != null ? out.decimals : 3);
        outputRows[out.key].textContent = (typeof v === 'number') ? fmtFixed(v, d) : (v == null ? '—' : v);
      });

      // verdict: sec.verdict is a flag string ('fos') or null; the verdict object comes from compute()
      verdictHost.innerHTML = '';
      if (sec.verdict && calc.verdict) {
        verdictHost.appendChild(renderVerdictBanner(calc.verdict, sec.verdictLabel || 'FoS'));
      }

      // math
      var m = calc.math;
      if (m && (m.symbolic || m.substituted || m.intermediate)) {
        ensureMathAttached();
        var html = '';
        if (m.symbolic) {
          html += '<div class="math-block"><h5>Symbolic</h5>';
          (Array.isArray(m.symbolic) ? m.symbolic : [String(m.symbolic)]).forEach(function (line) {
            html += '<div class="math-row">' + line + '</div>';
          });
          html += '</div>';
        }
        if (m.substituted) {
          html += '<div class="math-block"><h5>Substituted</h5>';
          (Array.isArray(m.substituted) ? m.substituted : [String(m.substituted)]).forEach(function (line) {
            html += '<div class="math-row">' + line + '</div>';
          });
          html += '</div>';
        }
        if (m.intermediate) {
          html += '<div class="math-block"><h5>Intermediate</h5>';
          (Array.isArray(m.intermediate) ? m.intermediate : [String(m.intermediate)]).forEach(function (line) {
            html += '<div class="math-row">' + line + '</div>';
          });
          html += '</div>';
        }
        mathHost.innerHTML = html;
      }

      // surface compute errors (non-fatal)
      if (calc._error) {
        verdictHost.appendChild(el('div', { class: 'verdict fail' }, [
          el('span', { class: 'v-label' }, 'ERROR'),
          el('span', {}, calc._error)
        ]));
      }
    }

    return { node: card, update: update };
  }

  // ------------------------- Editable repeating table -------------------------
  // rep config: { key, label, columns:[{key,label}], minRows, defaultRows }
  // rows live in secState[rep.key] as an array of plain objects.
  function renderEditableTable(host, rep, secState, onChange) {
    host.innerHTML = '';
    if (rep.label) host.appendChild(el('h4', {}, rep.label));
    var table = el('table', { class: 'rep-table' });
    var thead = el('thead');
    var trh = el('tr');
    rep.columns.forEach(function (c) { trh.appendChild(el('th', {}, c.label || c.key)); });
    trh.appendChild(el('th', {}, ''));
    thead.appendChild(trh);
    table.appendChild(thead);

    var tbody = el('tbody');
    var rows = secState[rep.key] || [];
    rows.forEach(function (rowObj, rowIdx) {
      var tr = el('tr');
      rep.columns.forEach(function (col) {
        var td = el('td');
        var inputEl = el('input', {
          type: 'number', step: 'any',
          value: rowObj[col.key] != null ? rowObj[col.key] : '',
          on: {
            input: function (e) {
              var v = e.target.value;
              rowObj[col.key] = (v === '' ? '' : Number(v));
              onChange();
            }
          }
        });
        td.appendChild(inputEl);
        tr.appendChild(td);
      });
      var actionTd = el('td');
      var minRows = rep.minRows != null ? rep.minRows : 1;
      var removeBtn = el('button', {
        class: 'rep-btn',
        'aria-label': 'Remove row ' + (rowIdx + 1),
        title: 'Remove this row',
        on: {
          click: function () {
            if (secState[rep.key].length > minRows) {
              secState[rep.key].splice(rowIdx, 1);
              renderEditableTable(host, rep, secState, onChange);
              onChange();
            }
          }
        }
      }, '−');
      actionTd.appendChild(removeBtn);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    host.appendChild(table);

    var addBtn = el('button', {
      class: 'rep-btn add',
      on: {
        click: function () {
          var blank = {};
          rep.columns.forEach(function (c) { blank[c.key] = 0; });
          secState[rep.key].push(blank);
          renderEditableTable(host, rep, secState, onChange);
          onChange();
        }
      }
    }, '+ Add row');
    host.appendChild(addBtn);
  }

  // ------------------------- Module page rendering -------------------------
  function renderModule(mod, host) {
    host = host || document.getElementById('app');
    host.innerHTML = '';

    var settings = loadSettings();
    var state = loadInputs(mod.id);

    // top bar
    host.appendChild(buildTopbar(mod));

    var container = el('div', { class: 'container' });

    // header
    var header = el('div', { class: 'mod-header' });
    header.appendChild(el('div', { class: 'crumb' }, 'ENGR 322 / Master Calculator'));
    header.appendChild(el('h1', {}, mod.heading || mod.title));
    if (mod.subtitle) header.appendChild(el('p', { class: 'subtitle' }, mod.subtitle));
    if (mod.covers) header.appendChild(el('p', { class: 'covers' }, 'Covers: ' + mod.covers));
    container.appendChild(header);

    // sections
    var sectionUpdaters = [];
    function onChange() {
      saveInputs(mod.id, state);
      sectionUpdaters.forEach(function (u) { u(); });
    }

    mod.sections.forEach(function (sec) {
      var rendered = renderSection(mod.id, sec, state, settings, onChange);
      container.appendChild(rendered.node);
      sectionUpdaters.push(rendered.update);
    });

    // examples
    if (mod.examples && mod.examples.length) {
      var exDet = el('details', { class: 'collapse' });
      exDet.appendChild(el('summary', {}, 'Examples'));
      var body = el('div', { class: 'collapse-body' });
      mod.examples.forEach(function (ex) {
        var exDet2 = el('details');
        exDet2.appendChild(el('summary', {}, ex.title));
        var b2 = el('div', { class: 'collapse-body', html: ex.html });
        exDet2.appendChild(b2);
        body.appendChild(exDet2);
      });
      exDet.appendChild(body);
      container.appendChild(exDet);
    }

    // reference
    if (mod.reference) {
      var refDet = el('details', { class: 'collapse' });
      refDet.appendChild(el('summary', {}, 'Reference / Tables'));
      var rb = el('div', { class: 'collapse-body', html: mod.reference });
      refDet.appendChild(rb);
      container.appendChild(refDet);
    }

    host.appendChild(container);
    host.appendChild(buildSettingsModal());

    // initial compute
    sectionUpdaters.forEach(function (u) { u(); });
  }

  // ------------------------- Home page rendering -------------------------
  function renderHome(modules, host) {
    host = host || document.getElementById('app');
    host.innerHTML = '';
    host.appendChild(buildTopbar(null));

    var container = el('div', { class: 'container' });

    var header = el('div', { class: 'home-header' });
    header.appendChild(el('h1', {}, 'ENGR 322 Master Calculator'));
    header.appendChild(el('p', {}, 'Calvin University · Machine Component Design · Choose a module to begin.'));
    container.appendChild(header);

    var grid = el('div', { class: 'module-grid' });
    modules.forEach(function (m) {
      var card = el('a', { class: 'module-card', href: m.id + '.html' });
      card.appendChild(el('div', { class: 'num' }, 'Module ' + m.id.replace(/^m/i, '').toUpperCase()));
      card.appendChild(el('h3', {}, m.title));
      card.appendChild(el('p', {}, m.subtitle || (m.covers ? 'Covers: ' + m.covers : '')));
      grid.appendChild(card);
    });
    container.appendChild(grid);

    host.appendChild(container);
    host.appendChild(buildSettingsModal());
  }

  // ------------------------- Topbar & Settings modal -------------------------
  function buildTopbar(currentMod) {
    var bar = el('div', { class: 'topbar' });
    var brand = el('a', { class: 'brand', href: 'index.html' }, 'ENGR 322');
    brand.appendChild(el('span', { class: 'sub' }, 'Master Calculator'));
    brand.appendChild(el('span', { class: 'build', title: 'UI build version' }, 'v' + UI_BUILD));
    bar.appendChild(brand);

    var nav = el('div', { class: 'nav' });
    nav.appendChild(el('a', { href: 'index.html' }, 'Home'));
    nav.appendChild(el('a', { href: 'tests.html' }, 'Tests'));
    if (currentMod) {
      var resetBtn = el('button', {
        title: 'Discard saved inputs for this module and reload defaults',
        on: { click: function () {
          if (confirm('Reset all inputs on this page to defaults?')) {
            clearInputs(currentMod.id);
            location.reload();
          }
        } }
      }, 'Reset inputs');
      nav.appendChild(resetBtn);
    }
    var settingsBtn = el('button', {
      on: { click: function () { document.getElementById('settings-modal').classList.add('show'); } }
    }, 'Settings');
    nav.appendChild(settingsBtn);
    bar.appendChild(nav);
    return bar;
  }

  function buildSettingsModal() {
    var s = loadSettings();
    var backdrop = el('div', { class: 'modal-backdrop', id: 'settings-modal' });
    var modal = el('div', { class: 'modal' });
    modal.appendChild(el('h2', {}, 'Factor of Safety Thresholds'));
    modal.appendChild(el('p', {}, 'Verdict mapping: SAFE if n ≥ Safe threshold; MARGINAL if Marginal ≤ n < Safe; FAILS if n < Marginal. These persist across all modules.'));

    var safeRow = el('div', { class: 'input-row' });
    safeRow.appendChild(el('label', { for: 'set-fos-safe' }, 'Safe threshold (≥)'));
    var safeInput = el('input', { id: 'set-fos-safe', type: 'number', step: '0.1', value: s.FoS_Safe });
    safeRow.appendChild(safeInput);
    safeRow.appendChild(el('span', { class: 'unit' }, 'n'));

    var margRow = el('div', { class: 'input-row' });
    margRow.appendChild(el('label', { for: 'set-fos-marginal' }, 'Marginal threshold (≥)'));
    var margInput = el('input', { id: 'set-fos-marginal', type: 'number', step: '0.1', value: s.FoS_Marginal });
    margRow.appendChild(margInput);
    margRow.appendChild(el('span', { class: 'unit' }, 'n'));

    modal.appendChild(safeRow);
    modal.appendChild(margRow);

    var actions = el('div', { class: 'actions' });
    actions.appendChild(el('button', {
      on: { click: function () { backdrop.classList.remove('show'); } }
    }, 'Cancel'));
    actions.appendChild(el('button', {
      class: 'primary',
      on: {
        click: function () {
          saveSettings({ FoS_Safe: Number(safeInput.value), FoS_Marginal: Number(margInput.value) });
          backdrop.classList.remove('show');
          location.reload();
        }
      }
    }, 'Save & Reload'));
    modal.appendChild(actions);

    backdrop.appendChild(modal);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) backdrop.classList.remove('show');
    });
    return backdrop;
  }

  // ------------------------- Global error surfacing -------------------------
  // If anything throws while rendering, show a visible banner at the top of the
  // page so the user doesn't have to open DevTools to see what's wrong.
  function showErrorBanner(msg, src) {
    try {
      var existing = document.getElementById('engr322-error');
      if (existing) existing.remove();
      var b = document.createElement('div');
      b.id = 'engr322-error';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#b91c1c;color:#fff;padding:10px 16px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)';
      b.innerHTML = '<strong>JavaScript error (UI build v' + UI_BUILD + '):</strong> ' +
                    String(msg).replace(/[<>&]/g, function (c) { return ({ '<':'&lt;','>':'&gt;','&':'&amp;' })[c]; }) +
                    (src ? '<div style="opacity:.85;margin-top:4px">at ' + src + '</div>' : '') +
                    '<div style="opacity:.85;margin-top:4px">Try the Reset Inputs button or hard reload (Cmd/Ctrl+Shift+R).</div>';
      document.body.appendChild(b);
    } catch (e) { /* nothing more we can do */ }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('error', function (e) {
      showErrorBanner(e.message || 'Unknown error', e.filename ? (e.filename + ':' + e.lineno) : null);
    });
    window.addEventListener('unhandledrejection', function (e) {
      showErrorBanner((e.reason && e.reason.message) || String(e.reason), 'unhandledrejection');
    });
  }

  // ------------------------- Public API -------------------------
  global.UI = {
    build: UI_BUILD,
    stateVersion: STATE_VERSION,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadInputs: loadInputs,
    saveInputs: saveInputs,
    clearInputs: clearInputs,
    renderModule: renderModule,
    renderHome: renderHome,
    fmt: fmt,
    fmtFixed: fmtFixed,
    verdict: verdict,
    el: el
  };
})(window);
