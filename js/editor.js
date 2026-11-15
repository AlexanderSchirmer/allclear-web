/*
 * allClear Web – Editor mit Syntax-Hervorhebung
 * Ein transparentes <textarea> liegt über einem <pre>, das den hervorgehobenen Text anzeigt.
 */
(function (AC) {
  'use strict';

  function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* Zeichenweise Klassen vergeben und zu Spans zusammenfassen */
  function highlight(text, errLines) {
    var lines = text.split('\n');
    var titleEnd = -1, i = 0;
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i < lines.length && !/^\s*\[/.test(lines[i])) {
      var start = i;
      while (i < lines.length && lines[i].trim() !== '' && !/^\s*\[/.test(lines[i])) i++;
      titleEnd = i;
      i = start;
    }
    var inComment = false, out = [];
    lines.forEach(function (line, li) {
      var cls = new Array(line.length).fill('');
      for (var k = 0; k < line.length; k++) {
        var ch = line[k];
        if (inComment) { cls[k] = 'c'; if (ch === '}') inComment = false; continue; }
        if (ch === '{') { cls[k] = 'c'; inComment = true; }
      }
      var code = function (k) { return cls[k] !== 'c'; };
      if (li < titleEnd) {
        for (var t = 0; t < line.length; t++) if (code(t)) cls[t] = 't';
      } else {
        var p = 0;
        var skipWs = function () { while (p < line.length && (/\s/.test(line[p]) || !code(p))) p++; };
        skipWs();
        while (p < line.length && line[p] === '[' && code(p)) {
          var close = line.indexOf(']', p);
          if (close < 0) break;
          for (var d = p; d <= close; d++) if (code(d)) cls[d] = 'd';
          p = close + 1;
          skipWs();
        }
        for (var g = 0; g < 4 && p < line.length; g++) {
          if (line[p] === '!' || line[p] === '&') { cls[p] = 'm'; p++; skipWs(); continue; }
          if (line[p] === '(') {
            var c2 = line.indexOf(')', p);
            if (c2 > p) { for (var q = p; q <= c2; q++) if (code(q)) cls[q] = 'l'; p = c2 + 1; skipWs(); continue; }
          }
          break;
        }
        var e = line.length - 1;
        while (e >= 0 && (/\s/.test(line[e]) || !code(e))) e--;
        if (e >= p && '?:\\;'.indexOf(line[e]) >= 0) cls[e] = 'm';
      }
      var html = '', cur = null, buf = '';
      for (var z = 0; z < line.length; z++) {
        if (cls[z] !== cur) {
          if (buf) html += cur ? '<span class="t-' + cur + '">' + escHtml(buf) + '</span>' : escHtml(buf);
          cur = cls[z]; buf = '';
        }
        buf += line[z];
      }
      if (buf) html += cur ? '<span class="t-' + cur + '">' + escHtml(buf) + '</span>' : escHtml(buf);
      out.push('<div class="ln' + (errLines && errLines.has(li + 1) ? ' err' : '') + '">' + (html || '​') + '</div>');
    });
    return out.join('');
  }

  AC.createEditor = function (root, handlers) {
    root.innerHTML =
      '<div class="ed-gutter"><div class="ed-gutter-inner"></div></div>' +
      '<div class="ed-code"><pre class="ed-hl" aria-hidden="true"></pre>' +
      '<textarea class="ed-ta" spellcheck="false" wrap="off" autocapitalize="off" autocomplete="off" aria-label="allCLEAR-Text"></textarea></div>';
    var gutter = root.querySelector('.ed-gutter-inner');
    var gutterBox = root.querySelector('.ed-gutter');
    var hl = root.querySelector('.ed-hl');
    var ta = root.querySelector('.ed-ta');
    var errLines = new Set();
    var lastLineCount = -1;

    function refresh() {
      var v = ta.value;
      hl.innerHTML = highlight(v, errLines) + '<div class="ln">​</div>';
      var n = v.split('\n').length;
      if (n !== lastLineCount) {
        var s = '';
        for (var i = 1; i <= n; i++) s += '<div>' + i + '</div>';
        gutter.innerHTML = s;
        lastLineCount = n;
      }
      syncScroll();
    }
    function syncScroll() {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
      gutterBox.scrollTop = ta.scrollTop;
    }
    function insert(text) {
      ta.focus();
      var ok = false;
      try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
      if (!ok) {
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    }
    function lineStart(pos) { return ta.value.lastIndexOf('\n', pos - 1) + 1; }
    function lineEnd(pos) { var i = ta.value.indexOf('\n', pos); return i < 0 ? ta.value.length : i; }
    function indentLines(dir) {
      var s = ta.selectionStart, e = ta.selectionEnd;
      if (e > s && ta.value[e - 1] === '\n') e--;
      var ls = lineStart(s), le = lineEnd(e);
      var block = ta.value.slice(ls, le);
      var nb = block.split('\n').map(function (l) { return dir > 0 ? '\t' + l : l.replace(/^(\t| {1,4})/, ''); }).join('\n');
      if (nb === block) return;
      ta.setSelectionRange(ls, le);
      insert(nb);
      ta.setSelectionRange(ls, ls + nb.length);
    }

    ta.addEventListener('input', function () { refresh(); handlers.onChange && handlers.onChange(); });
    ta.addEventListener('scroll', syncScroll);
    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Tab' && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        ev.preventDefault();
        var multi = ta.value.slice(ta.selectionStart, ta.selectionEnd).indexOf('\n') >= 0;
        if (ev.shiftKey || multi) indentLines(ev.shiftKey ? -1 : 1);
        else insert('\t');
      } else if (ev.key === 'Enter' && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey) {
        ev.preventDefault();
        var pos = ta.selectionStart;
        var cur = ta.value.slice(lineStart(pos), pos);
        var ws = cur.match(/^[\t ]*/)[0];
        var extra = /[?:\\]\s*$/.test(cur.replace(/\{[^}]*\}/g, '')) ? '\t' : '';
        insert('\n' + ws + extra);
      }
    });
    var cursorTimer = null;
    function cursorChanged() {
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(function () { handlers.onCursor && handlers.onCursor(api.currentLine()); }, 60);
    }
    ta.addEventListener('keyup', cursorChanged);
    ta.addEventListener('click', cursorChanged);
    ta.addEventListener('focus', cursorChanged);

    var api = {
      textarea: ta,
      getValue: function () { return ta.value; },
      setValue: function (v) { ta.value = v; ta.scrollTop = 0; ta.scrollLeft = 0; refresh(); },
      setErrors: function (lines) { errLines = new Set(lines); refresh(); },
      currentLine: function () { return ta.value.slice(0, ta.selectionStart).split('\n').length; },
      revealLine: function (n) {
        var lines = ta.value.split('\n');
        if (n < 1 || n > lines.length) return;
        var start = 0;
        for (var i = 0; i < n - 1; i++) start += lines[i].length + 1;
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(start, start + lines[n - 1].length);
        var lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
        var y = (n - 1) * lh;
        if (y < ta.scrollTop || y > ta.scrollTop + ta.clientHeight - 2 * lh) ta.scrollTop = Math.max(0, y - ta.clientHeight / 3);
        syncScroll();
      },
      focus: function () { ta.focus(); }
    };
    refresh();
    return api;
  };
})(window.AC = window.AC || {});
