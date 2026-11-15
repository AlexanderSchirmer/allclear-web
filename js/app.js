/*
 * allClear Web – Anwendung: Dateien, Darstellung, Export, Druck
 */
(function (AC) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORE = 'allclearweb.v1';
  var EXAMPLES = [
    { file: '01-jahrestreffen.txt', title: 'Ablauf mit IF, CASE und Schleife' },
    { file: '02-urlaubsantrag.txt', title: 'Verschachtelung, GOTO, Beschreibung' },
    { file: '03-reklamation.txt', title: 'Schleife im Zweig, Sprung zurück' },
    { file: '04-organigramm.txt', title: 'Organigramm mit Assistenz' },
    { file: '05-fishbone-lieferverzug.txt', title: 'Fishbone (Ursache-Wirkung)' },
    { file: '06-ebenen-auftrag.txt', title: 'Mehrere Ebenen mit LINK/LINKTO' },
    { file: '07-sonderfaelle.txt', title: 'Textbereiche, BYLINE, Kommentare' }
  ];
  var DEFAULT_TEXT = 'Neues Diagramm\n\n[HEAD]\nErster Schritt.\nIst alles in Ordnung?\n\t(Ja)Weiter machen.\n\t(Nein)Problem beheben.\n!Fertig.\n';

  var state = {
    fileName: 'diagramm.txt', encoding: 'utf-8', eol: '\r\n', handle: null, dirty: false,
    doc: null, layouts: [], layer: 0, zoom: 1, fit: true, selLine: 0,
    opts: { numbers: false, hidePunct: false }
  };

  var editor = AC.createEditor($('editor'), { onChange: onEdit, onCursor: syncSelection });

  /* ---------- Rendering ---------- */
  var renderTimer = null;
  function onEdit() {
    state.dirty = true;
    updateTitle();
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 150);
  }

  function render() {
    var text = editor.getValue();
    var doc;
    try {
      doc = AC.parse(text);
      state.layouts = AC.layout(doc, state.opts);
      state.doc = doc;
    } catch (err) {
      console.error(err);
      showProblems([{ line: 0, msg: 'Interner Fehler beim Zeichnen: ' + err.message }]);
      return;
    }
    if (state.layer >= state.layouts.length) state.layer = 0;
    drawTabs();
    drawDiagram();
    showProblems(doc.warnings);
    updatePrintArea();
    persist();
  }

  function drawTabs() {
    var nav = $('layerTabs');
    nav.innerHTML = '';
    nav.hidden = state.layouts.length < 2;
    state.layouts.forEach(function (L, i) {
      var b = document.createElement('button');
      b.textContent = L.ref + ': ' + L.name;
      b.className = i === state.layer ? 'active' : '';
      b.onclick = function () { state.layer = i; drawTabs(); drawDiagram(); };
      nav.appendChild(b);
    });
  }

  function currentLayout() { return state.layouts[state.layer]; }

  function drawDiagram() {
    var host = $('svgHost');
    var L = currentLayout();
    if (!L || !L.boxes.length) {
      host.innerHTML = '<div class="empty">Noch kein Diagramm – Text links eingeben, eine Datei hierher ziehen oder ein Beispiel wählen.</div>';
      return;
    }
    host.innerHTML = AC.renderSVG(L, state.opts);
    applyZoom();
    highlightLine(state.selLine);
  }

  function applyZoom() {
    var L = currentLayout(), svg = $('svgHost').querySelector('svg');
    if (!L || !svg) return;
    if (state.fit) {
      var c = $('canvas');
      var pad = 2 * (parseFloat(getComputedStyle(c).paddingLeft) || 0) + 4;
      var z = Math.min((c.clientWidth - pad) / L.w, (c.clientHeight - pad) / L.h);
      state.zoom = Math.max(0.1, Math.min(1.5, z));
    }
    svg.style.width = (L.w * state.zoom) + 'px';
    svg.style.height = (L.h * state.zoom) + 'px';
    $('zoomLabel').textContent = Math.round(state.zoom * 100) + ' %';
    $('btnFit').classList.toggle('active', state.fit);
  }

  function setZoom(z) {
    state.fit = false;
    state.zoom = Math.max(0.1, Math.min(4, z));
    applyZoom();
  }

  function highlightLine(line) {
    var host = $('svgHost');
    host.querySelectorAll('.ac-box.sel').forEach(function (g) { g.classList.remove('sel'); });
    if (!line) return;
    host.querySelectorAll('.ac-box[data-line="' + line + '"]').forEach(function (g) { g.classList.add('sel'); });
  }

  function syncSelection(line) {
    state.selLine = line;
    if (!state.doc) return;
    var li = state.doc.layers.findIndex(function (l) { return l.boxes.some(function (b) { return b.line === line; }); });
    if (li >= 0 && li !== state.layer) { state.layer = li; drawTabs(); drawDiagram(); }
    else highlightLine(line);
  }

  function showProblems(list) {
    var box = $('problems');
    var items = list.slice().sort(function (a, b) { return a.line - b.line; });
    editor.setErrors(items.map(function (w) { return w.line; }));
    if (!items.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<div class="ph">Hinweise (' + items.length + ')</div>' + items.map(function (w) {
      return '<div class="pi" data-line="' + w.line + '"><b>Zeile ' + w.line + ':</b> ' + AC.escapeXml(w.msg) + '</div>';
    }).join('');
  }

  /* ---------- Dateien ---------- */
  var CP1252 = { 0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030,
    0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022,
    0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178 };

  function decode(buf) {
    var bytes = new Uint8Array(buf);
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), enc: 'utf-16le' };
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, ''), enc: 'utf-8' }; }
    catch (e) { return { text: new TextDecoder('windows-1252').decode(bytes), enc: 'windows-1252' }; }
  }
  function encode(text, enc) {
    if (enc !== 'windows-1252') return new TextEncoder().encode(text);
    var rev = {};
    Object.keys(CP1252).forEach(function (k) { rev[CP1252[k]] = +k; });
    var out = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      out[i] = (c < 0x80 || (c >= 0xA0 && c < 0x100)) ? c : (rev[c] !== undefined ? rev[c] : 0x3F);
    }
    return out;
  }

  function loadText(text, name, enc, handle) {
    state.eol = /\r\n/.test(text) ? '\r\n' : (/\n/.test(text) ? '\n' : '\r\n');
    state.fileName = name || 'diagramm.txt';
    state.encoding = enc || 'utf-8';
    state.handle = handle || null;
    state.layer = 0;
    state.fit = true;
    state.selLine = 0;
    editor.setValue(text.replace(/\r\n?/g, '\n'));
    state.dirty = false;
    updateTitle();
    render();
  }

  function confirmDiscard() {
    return !state.dirty || confirm('Ungespeicherte Änderungen verwerfen?');
  }

  function openFile(file, handle) {
    if (!confirmDiscard()) return;
    file.arrayBuffer().then(function (buf) {
      var d = decode(buf);
      loadText(d.text, file.name, d.enc, handle);
    }).catch(function (e) { alert('Datei konnte nicht gelesen werden: ' + e.message); });
  }

  function pickFile() {
    if (window.showOpenFilePicker) {
      window.showOpenFilePicker({ types: [{ description: 'allCLEAR-Text', accept: { 'text/plain': ['.txt'] } }], excludeAcceptAllOption: false })
        .then(function (hs) { return hs[0].getFile().then(function (f) { openFile(f, hs[0]); }); })
        .catch(function (e) { if (e.name !== 'AbortError') $('fileInput').click(); });
    } else $('fileInput').click();
  }

  function download(name, data, type) {
    var url = URL.createObjectURL(new Blob([data], { type: type }));
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function saveFile() {
    var text = editor.getValue().replace(/\n/g, state.eol);
    var data = encode(text, state.encoding);
    var done = function () { state.dirty = false; updateTitle(); };
    var write = function (h) {
      return h.createWritable().then(function (w) { return w.write(data).then(function () { return w.close(); }); }).then(function () { state.handle = h; state.fileName = h.name; done(); });
    };
    if (state.handle && state.handle.createWritable) {
      write(state.handle).catch(function (e) { if (e.name !== 'AbortError') alert('Speichern fehlgeschlagen: ' + e.message); });
    } else if (window.showSaveFilePicker) {
      window.showSaveFilePicker({ suggestedName: state.fileName, types: [{ description: 'allCLEAR-Text', accept: { 'text/plain': ['.txt'] } }] })
        .then(write).catch(function (e) { if (e.name !== 'AbortError') alert('Speichern fehlgeschlagen: ' + e.message); });
    } else {
      download(state.fileName, data, 'text/plain;charset=' + state.encoding);
      done();
    }
  }

  function baseName() { return state.fileName.replace(/\.[^.]*$/, '') || 'diagramm'; }

  function exportDrawio() {
    if (!currentLayout() || !currentLayout().boxes.length) { alert('Es gibt noch kein Diagramm zum Exportieren.'); return; }
    var svg = AC.buildDrawioSvg(state.layouts, state.layer, state.opts);
    download(baseName() + '.drawio.svg', svg, 'image/svg+xml');
  }

  /* ---------- Druck (A4, auf eine Seite pro Ebene skaliert) ---------- */
  /* Der Druckbereich wird nach jedem Zeichnen aktualisiert. So enthält er auch dann das Diagramm,
     wenn über das Browser-Menü gedruckt wird oder window.print() sofort zurückkehrt (iOS). */
  function updatePrintArea() {
    var pa = $('printArea');
    pa.innerHTML = '';
    var PX2MM = 25.4 / 96;
    var layouts = state.layouts.filter(function (L) { return L.boxes.length; });
    layouts.forEach(function (L) {
      var wmm = L.w * PX2MM, hmm = L.h * PX2MM;
      var sP = Math.min(1, 188 / wmm, 273 / hmm), sL = Math.min(1, 275 / wmm, 186 / hmm);
      var landscape = sL > sP + 1e-6;
      var s = landscape ? sL : sP;
      var page = document.createElement('div');
      page.className = 'print-page ' + (landscape ? 'quer' : 'hoch');
      page.innerHTML = AC.renderSVG(L, state.opts);
      var svg = page.firstElementChild;
      svg.setAttribute('width', (wmm * s).toFixed(2) + 'mm');
      svg.setAttribute('height', (hmm * s).toFixed(2) + 'mm');
      pa.appendChild(page);
    });
    return layouts.length;
  }
  function printA4() {
    if (!updatePrintArea()) { alert('Es gibt noch kein Diagramm zum Drucken.'); return; }
    window.print();
  }
  window.addEventListener('beforeprint', updatePrintArea);

  /* ---------- Beispiele ---------- */
  function initExamples() {
    var sel = $('selExample');
    EXAMPLES.forEach(function (ex) {
      var o = document.createElement('option');
      o.value = ex.file;
      o.textContent = ex.file.replace(/\.txt$/, '') + ' – ' + ex.title;
      sel.appendChild(o);
    });
    sel.onchange = function () {
      var f = sel.value;
      sel.value = '';
      if (!f || !confirmDiscard()) return;
      fetch('examples/' + encodeURIComponent(f)).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      }).then(function (buf) {
        var d = decode(buf);
        state.dirty = false;
        loadText(d.text, f, d.enc);
      }).catch(function () {
        alert('Das Beispiel konnte nicht geladen werden. Beim direkten Öffnen der HTML-Datei (file://) blockiert der Browser das Nachladen – bitte über „Öffnen…“ aus dem Ordner „examples“ laden oder die App über einen Webserver aufrufen.');
      });
    };
  }

  /* ---------- Speicher im Browser ---------- */
  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ text: editor.getValue(), fileName: state.fileName, encoding: state.encoding, eol: state.eol, opts: state.opts, dirty: state.dirty }));
    } catch (e) { /* z. B. privater Modus */ }
  }
  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && typeof s.text === 'string') {
        if (s.opts) state.opts = Object.assign(state.opts, s.opts);
        loadText(s.text, s.fileName, s.encoding);
        state.eol = s.eol || state.eol;
        state.dirty = !!s.dirty;
        updateTitle();
        return true;
      }
    } catch (e) { /* ignorieren */ }
    return false;
  }

  function updateTitle() {
    $('fileName').textContent = state.fileName + (state.dirty ? ' •' : '') + (state.encoding === 'windows-1252' ? ' (ANSI)' : '');
    document.title = (state.dirty ? '• ' : '') + state.fileName + ' – allClear Web';
  }

  /* ---------- Bedienelemente ---------- */
  $('btnNew').onclick = function () { if (confirmDiscard()) { state.dirty = false; loadText(DEFAULT_TEXT, 'diagramm.txt', 'utf-8'); editor.focus(); } };
  $('btnOpen').onclick = pickFile;
  $('fileInput').onchange = function (e) { var f = e.target.files[0]; if (f) openFile(f); e.target.value = ''; };
  $('btnSave').onclick = saveFile;
  $('btnExport').onclick = exportDrawio;
  $('btnPrint').onclick = printA4;
  $('btnZoomIn').onclick = function () { setZoom(state.zoom * 1.25); };
  $('btnZoomOut').onclick = function () { setZoom(state.zoom / 1.25); };
  $('btnFit').onclick = function () { state.fit = true; applyZoom(); };
  $('btn100').onclick = function () { setZoom(1); };
  $('btnHelp').onclick = function () { $('helpDialog').showModal(); };
  $('optNumbers').onchange = function (e) { state.opts.numbers = e.target.checked; render(); };
  $('optPunct').onchange = function (e) { state.opts.hidePunct = e.target.checked; render(); };

  $('problems').addEventListener('click', function (e) {
    var it = e.target.closest('.pi');
    if (it && +it.dataset.line) editor.revealLine(+it.dataset.line);
  });
  $('svgHost').addEventListener('click', function (e) {
    var lk = e.target.closest('.ac-link');
    if (lk) {
      var L = currentLayout(), t = L && L.links[+lk.dataset.idx] && L.links[+lk.dataset.idx].target;
      if (t) {
        state.layer = t.layer;
        drawTabs(); drawDiagram();
        var g = $('svgHost').querySelector('.ac-box[data-id="' + t.boxId + '"]');
        if (g) {
          $('svgHost').querySelectorAll('.ac-box.sel').forEach(function (x) { x.classList.remove('sel'); });
          g.classList.add('sel');
          g.scrollIntoView({ block: 'center', inline: 'center' });
          if (g.dataset.line) editor.revealLine(+g.dataset.line);
        }
      }
      return;
    }
    var box = e.target.closest('.ac-box');
    if (box && box.dataset.line) { editor.revealLine(+box.dataset.line); highlightLine(+box.dataset.line); }
  });
  $('canvas').addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });
  if (window.ResizeObserver) new ResizeObserver(function () { if (state.fit) applyZoom(); }).observe($('canvas'));
  else window.addEventListener('resize', function () { if (state.fit) applyZoom(); });

  /* Menü auf schmalen Bildschirmen */
  $('btnMenu').onclick = function () {
    var open = $('toolbar').classList.toggle('menu-open');
    $('btnMenu').setAttribute('aria-expanded', String(open));
  };
  $('toolbar').addEventListener('click', function (e) {
    var b = e.target.closest('button.m-more');
    if (b && $('toolbar').classList.contains('menu-open')) {
      $('toolbar').classList.remove('menu-open');
      $('btnMenu').setAttribute('aria-expanded', 'false');
    }
  });

  /* Vollbild: echtes Fullscreen, sonst (z. B. iPhone) Ersatz per CSS */
  var pane = $('diagramPane');
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function isFs() { return fsElement() === pane || pane.classList.contains('fs'); }
  function updateFsButton() {
    var on = isFs();
    $('btnFullscreen').querySelector('.ico').textContent = on ? '✕' : '⛶';
    $('btnFullscreen').querySelector('.lbl').textContent = on ? 'Schließen' : 'Vollbild';
    $('btnFullscreen').title = on ? 'Vollbild beenden (Esc)' : 'Diagramm im Vollbild anzeigen';
    document.body.classList.toggle('fs-open', on);
    state.fit = true;
    applyZoom();
  }
  function enterFs() {
    var req = pane.requestFullscreen || pane.webkitRequestFullscreen;
    var fallback = function () { if (!fsElement() && !pane.classList.contains('fs')) { pane.classList.add('fs'); updateFsButton(); } };
    if (!req) { fallback(); return; }
    try {
      var p = req.call(pane);
      if (p && p.catch) p.catch(fallback);
    } catch (e) { fallback(); return; }
    /* Manche eingebetteten Browser lehnen Fullscreen stillschweigend ab */
    setTimeout(fallback, 600);
  }
  function exitFs() {
    if (pane.classList.contains('fs')) { pane.classList.remove('fs'); updateFsButton(); return; }
    var ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (fsElement() && ex) ex.call(document);
  }
  $('btnFullscreen').onclick = function () { if (isFs()) exitFs(); else enterFs(); };
  document.addEventListener('fullscreenchange', updateFsButton);
  document.addEventListener('webkitfullscreenchange', updateFsButton);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pane.classList.contains('fs')) exitFs(); });

  /* Pinch-Zoom mit zwei Fingern im Diagramm */
  (function () {
    var c = $('canvas'), pinch = null;
    var dist = function (t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); };
    c.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 2) return;
      var r = c.getBoundingClientRect();
      var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      var my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      pinch = { d: dist(e.touches), z: state.zoom, mx: mx, my: my, px: (c.scrollLeft + mx) / state.zoom, py: (c.scrollTop + my) / state.zoom };
    }, { passive: true });
    c.addEventListener('touchmove', function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      setZoom(pinch.z * dist(e.touches) / pinch.d);
      c.scrollLeft = pinch.px * state.zoom - pinch.mx;
      c.scrollTop = pinch.py * state.zoom - pinch.my;
    }, { passive: false });
    c.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; });
    c.addEventListener('touchcancel', function () { pinch = null; });
  })();
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      var k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); saveFile(); }
      else if (k === 'o') { e.preventDefault(); pickFile(); }
      else if (k === 'p') { e.preventDefault(); printA4(); }
    }
  });

  /* Drag & Drop */
  var dragDepth = 0;
  var hasFiles = function (e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0; };
  window.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('dropOverlay').classList.add('show'); });
  window.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('dropOverlay').classList.remove('show'); } });
  window.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    $('dropOverlay').classList.remove('show');
    var f = e.dataTransfer.files[0];
    if (!f) return;
    var item = e.dataTransfer.items && e.dataTransfer.items[0];
    if (item && item.getAsFileSystemHandle) {
      item.getAsFileSystemHandle().then(function (h) { openFile(f, h && h.kind === 'file' ? h : null); }).catch(function () { openFile(f); });
    } else openFile(f);
  });

  /* Teiler zwischen Editor und Diagramm */
  (function () {
    var sp = $('splitter'), main = $('main'), dragging = false;
    try { var w = localStorage.getItem(STORE + '.split'); if (w) main.style.setProperty('--editor-w', w); } catch (e) { /* */ }
    sp.addEventListener('pointerdown', function (e) { dragging = true; sp.setPointerCapture(e.pointerId); document.body.classList.add('resizing'); });
    sp.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var r = main.getBoundingClientRect();
      var pct = Math.max(15, Math.min(80, (e.clientX - r.left) / r.width * 100));
      main.style.setProperty('--editor-w', pct + '%');
      if (state.fit) applyZoom();
    });
    sp.addEventListener('pointerup', function () {
      dragging = false;
      document.body.classList.remove('resizing');
      try { localStorage.setItem(STORE + '.split', main.style.getPropertyValue('--editor-w')); } catch (e) { /* */ }
    });
  })();

  initExamples();
  if (!restore()) loadText(DEFAULT_TEXT, 'diagramm.txt', 'utf-8');
  $('optNumbers').checked = state.opts.numbers;
  $('optPunct').checked = state.opts.hidePunct;
})(window.AC = window.AC || {});
