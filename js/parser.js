/*
 * allClear Web – Parser
 * Liest die allCLEAR-Textsyntax (Einrückung + Satzzeichen + Direktiven)
 * und erzeugt ein Strukturmodell (Ebenen -> Startpunkte -> Knoten -> Boxen).
 */
(function (AC) {
  'use strict';

  var KNOWN = ['HEAD', 'FLOW', 'TREE', 'FISHBONE', 'GOTOLOGIC', 'GOTO', 'LABEL', 'LINKTO', 'LINK',
    'SHAPE', 'COLOR', 'BYLINE', 'DESCRIPTION', 'LINETEXT', 'LOOP', 'UNTIL', 'BEGIN', 'END', 'LAYER'];
  var KNOWN_SET = new Set(KNOWN);
  var DIR_RE = /^\[\s*([A-Za-z]+)\s*(?:=([^\]]*))?\]/;
  AC.DIRECTIVES = KNOWN;

  /* Kommentare {..} entfernen (auch mehrzeilig), Zeilenumbrüche bleiben erhalten. */
  function stripComments(text, warn) {
    var out = '', depth = 0, line = 1, openLine = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n') { line++; out += ch; continue; }
      if (ch === '{') { if (depth === 0) openLine = line; depth++; continue; }
      if (ch === '}' && depth > 0) { depth--; continue; }
      if (depth === 0) out += ch;
    }
    if (depth > 0) warn(openLine, 'Kommentar „{“ wird nicht geschlossen – der Rest der Datei wird ignoriert.');
    return out;
  }

  function tokenize(text, warn) {
    var norm = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var orig = norm.split('\n');
    var stripped = stripComments(norm, warn).split('\n');
    return stripped.map(function (s, i) {
      var ws = s.match(/^[\t ]*/)[0];
      var col = 0;
      for (var k = 0; k < ws.length; k++) col = ws[k] === '\t' ? (Math.floor(col / 4) + 1) * 4 : col + 1;
      var body = s.slice(ws.length).trim();
      var origBlank = (orig[i] || '').trim() === '';
      return { no: i + 1, col: col, body: body, blank: body === '' && origBlank, skip: body === '' && !origBlank };
    });
  }

  function splitDirectives(body) {
    var dirs = [], rest = body, m;
    while ((m = rest.match(DIR_RE)) && KNOWN_SET.has(m[1].toUpperCase())) {
      dirs.push({ name: m[1].toUpperCase(), value: m[2] !== undefined ? m[2].trim() : null });
      rest = rest.slice(m[0].length).trim();
    }
    return { dirs: dirs, rest: rest };
  }

  function parseItem(text, byline) {
    var s = text;
    var it = { stop: false, assistant: false, choice: false, linetext: null, kind: 'step', cont: false };
    for (var guard = 0; guard < 4; guard++) {
      if (s[0] === '!') { it.stop = true; s = s.slice(1).trim(); continue; }
      if (s[0] === '&') { it.assistant = true; s = s.slice(1).trim(); continue; }
      if (s[0] === '(' && it.linetext === null) {
        var close = s.indexOf(')');
        if (close > 0) {
          it.choice = true;
          it.linetext = s.slice(1, close).trim();
          s = s.slice(close + 1).trim();
          continue;
        }
      }
      break;
    }
    var last = s.slice(-1);
    if (last === ';') { it.cont = true; s = s.slice(0, -1).trim(); }
    else if (last === '\\') { if (!byline) it.kind = 'tree'; s = s.slice(0, -1).trim(); }
    else if (!byline && last === '?') it.kind = 'if';
    else if (!byline && last === ':') it.kind = 'case';
    it.text = s;
    it.byline = !!byline;
    return it;
  }

  function parseLinkValue(v) {
    v = (v || '').trim();
    var idx = v.lastIndexOf(':');
    if (idx > 0) return { name: v.slice(0, idx).trim(), layer: v.slice(idx + 1).trim() || null };
    return { name: v, layer: null };
  }

  function parseGotoValue(v) {
    return (v || '').split(';').map(function (part) {
      var p = part.trim();
      if (!p) return null;
      var c = p.indexOf(',');
      return c >= 0 ? { label: p.slice(0, c).trim(), text: p.slice(c + 1).trim() } : { label: p, text: '' };
    }).filter(function (g) { return g && g.label; });
  }

  AC.normName = function (s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); };

  AC.parse = function (text) {
    var warnings = [];
    var warn = function (line, msg) { warnings.push({ line: line, msg: msg }); };
    var lines = tokenize(String(text || ''), warn);
    var i = 0;

    /* ---------- Titel ---------- */
    var titleLines = [];
    while (i < lines.length && lines[i].blank) i++;
    while (i < lines.length && !lines[i].blank) {
      if (lines[i].skip) { i++; continue; }
      if (DIR_RE.test(lines[i].body)) break;
      titleLines.push(lines[i].body);
      i++;
    }

    /* ---------- Einträge mit Einrückungsebenen ---------- */
    var entries = [], stack = [], byline = false;
    for (; i < lines.length; i++) {
      var L = lines[i];
      if (L.blank || L.skip) continue;
      while (stack.length && L.col < stack[stack.length - 1]) stack.pop();
      if (!stack.length || L.col > stack[stack.length - 1]) stack.push(L.col);
      var level = stack.length - 1;
      var sd = splitDirectives(L.body);
      sd.dirs.forEach(function (d) {
        if (d.name === 'BYLINE') byline = true;
        if (['HEAD', 'FLOW', 'TREE', 'FISHBONE', 'LAYER'].indexOf(d.name) >= 0) byline = false;
        entries.push({ type: d.name === 'UNTIL' ? 'until' : 'dir', name: d.name, value: d.value, level: level, no: L.no });
      });
      if (sd.rest) {
        if (/^\[[^\]]*\]$/.test(sd.rest)) { warn(L.no, 'Unbekannte Direktive ' + sd.rest + ' wird ignoriert.'); continue; }
        entries.push({ type: 'item', item: parseItem(sd.rest, byline), level: level, no: L.no });
      }
    }

    /* ---------- ';' = nächste Zeile in den nächsten Textbereich derselben Box ---------- */
    for (var k = 0; k < entries.length; k++) {
      var e = entries[k];
      if (e.type !== 'item') continue;
      e.item.areas = [e.item.text];
      while (e.item.cont) {
        var n = entries[k + 1];
        if (!n || n.type !== 'item') { e.item.cont = false; break; }
        e.item.areas.push(n.item.text);
        e.item.kind = n.item.kind;
        e.item.cont = n.item.cont;
        entries.splice(k + 1, 1);
      }
      e.item.text = e.item.areas.join(' ');
    }

    /* ---------- Direktiven zuordnen, Ebenen und Startpunkte bilden ---------- */
    var doc = { title: titleLines.join('\n'), gotologic: false, layers: [], warnings: warnings };
    var layer = null, root = null, pre = {}, lastItem = null, layerHasContent = false;
    function newLayer(ref, name) {
      layer = { ref: String(ref), name: name || ('Ebene ' + ref), roots: [], boxes: [] };
      doc.layers.push(layer);
      root = null; layerHasContent = false;
    }
    function newRoot(mode, no) {
      root = { mode: mode, list: [], no: no };
      layer.roots.push(root);
    }
    newLayer('1');

    entries.forEach(function (e) {
      if (e.type === 'dir') {
        var v = e.value;
        switch (e.name) {
          case 'HEAD': newRoot('auto', e.no); break;
          case 'FLOW': newRoot('flow', e.no); break;
          case 'TREE': newRoot('tree', e.no); break;
          case 'FISHBONE': newRoot('fishbone', e.no); break;
          case 'LAYER': {
            var parts = (v || '').split(',');
            var ref = (parts[0] || '').trim() || String(doc.layers.length + 1);
            var name = parts.slice(1).join(',').trim();
            if (!layerHasContent && doc.layers.length === 1 && !layer.roots.length) {
              layer.ref = ref; layer.name = name || ('Ebene ' + ref);
            } else newLayer(ref, name);
            break;
          }
          case 'GOTOLOGIC': doc.gotologic = true; break;
          case 'GOTO':
            if (!lastItem) warn(e.no, '[GOTO] ohne vorangehende Box.');
            else {
              var gs = parseGotoValue(v);
              if (!gs.length) warn(e.no, '[GOTO] ohne Sprungziel.');
              lastItem.gotos.push.apply(lastItem.gotos, gs);
            }
            break;
          case 'LINKTO':
            if (!lastItem) warn(e.no, '[LINKTO] ohne vorangehende Box.');
            else if (!v) warn(e.no, '[LINKTO] ohne Namen.');
            else lastItem.linkto.push(parseLinkValue(v));
            break;
          case 'DESCRIPTION':
            if (!lastItem) warn(e.no, '[DESCRIPTION] ohne vorangehende Box.');
            else lastItem.description = v || '';
            break;
          case 'LABEL': if (v) pre.label = v; else warn(e.no, '[LABEL] ohne Namen.'); break;
          case 'LINK': if (v) (pre.links = pre.links || []).push(parseLinkValue(v)); else warn(e.no, '[LINK] ohne Namen.'); break;
          case 'LINETEXT': pre.linetext = v || ''; break;
          case 'LOOP': pre.loop = true; break;
          default: break; /* SHAPE, COLOR, BEGIN, END, BYLINE: keine Wirkung (Schwarz-Weiß) */
        }
        return;
      }
      if (!root) newRoot('auto', e.no);
      layerHasContent = true;
      if (e.type === 'until') { root.list.push(e); return; }
      var it = e.item;
      it.label = pre.label || null;
      it.links = pre.links || [];
      it.loop = !!pre.loop;
      if (pre.linetext != null) it.linetext = pre.linetext;
      it.gotos = []; it.linkto = []; it.description = null;
      pre = {};
      lastItem = it;
      root.list.push(e);
    });
    if (Object.keys(pre).length) warn(lines.length, 'Direktive am Dateiende ohne nachfolgende Box.');

    /* ---------- Strukturaufbau ---------- */
    var idc = 0, layerNum = 0, curLayer = null;

    function mkBox(e, role) {
      var it = e.item;
      var b = {
        id: 'b' + (++idc), num: ++layerNum, role: role, areas: it.areas.slice(), text: it.text,
        linetext: it.linetext, line: e.no, label: it.label, links: it.links, linkto: it.linkto,
        gotos: it.gotos, description: it.description, stop: it.stop, choice: it.choice,
        assistant: it.assistant
      };
      curLayer.boxes.push(b);
      return b;
    }

    function markChoice(seq) {
      var f = seq[0];
      if (f && f.type === 'step' && f.box.choice && f.box.role === 'process') f.box.role = 'choice';
    }

    function parseSeq(ctx, level, inBranch) {
      var nodes = [];
      while (ctx.i < ctx.list.length) {
        var e = ctx.list[ctx.i];
        if (e.level < level) break;
        if (e.type === 'until') {
          if (ctx.loopDepth > 0) break;
          warn(e.no, '[UNTIL] ohne vorangehendes [LOOP] wird ignoriert.');
          ctx.i++;
          continue;
        }
        if (inBranch && nodes.length > 0 && e.item.choice && e.level === level && !e.afterUntil) break;
        if (e.item.text === '' && e.item.areas.length === 1) {
          /* Leere Wahl „(Ja)“: Linientext geht auf die folgende Box über */
          ctx.i++;
          var nx = ctx.list[ctx.i];
          if (nx && nx.type === 'item' && nx.level === e.level && !nx.item.choice) {
            if (nx.item.linetext == null) nx.item.linetext = e.item.linetext;
            nx.item.choice = e.item.choice;
            if (!nx.item.label) nx.item.label = e.item.label;
            continue;
          }
          nodes.push({ type: 'empty', linetext: e.item.linetext || '', line: e.no });
          continue;
        }
        nodes.push(parseNode(ctx, e.level));
      }
      return nodes;
    }

    function parseNode(ctx, L) {
      var e = ctx.list[ctx.i++];
      var it = e.item;
      if (it.loop) {
        var head = mkBox(e, 'loop');
        ctx.loopDepth++;
        var body = parseSeq(ctx, L + 1, false);
        ctx.loopDepth--;
        var u = ctx.list[ctx.i];
        if (u && u.type === 'until') {
          ctx.i++;
          var after = ctx.list[ctx.i];
          if (after && after.type === 'item') after.afterUntil = true;
        }
        markChoice(body);
        return { type: 'loop', head: head, body: body };
      }
      if (it.kind === 'if' || it.kind === 'case') {
        var h = mkBox(e, it.kind);
        var branches = [];
        while (ctx.i < ctx.list.length) {
          var n = ctx.list[ctx.i];
          if (n.type === 'until' || n.level <= L) break;
          var before = ctx.i;
          var seq = parseSeq(ctx, n.level, true);
          if (ctx.i === before) { ctx.i++; continue; }
          markChoice(seq);
          branches.push(seq);
        }
        if (!branches.length) warn(e.no, (it.kind === 'if' ? 'Entscheidung' : 'Auswahl') + ' ohne eingerückte Zweige.');
        return { type: 'cluster', kind: it.kind, head: h, branches: branches };
      }
      if (it.kind === 'tree') {
        ctx.i--;
        return { type: 'tree', root: parseTree(ctx, 'tree', 0) };
      }
      return { type: 'step', box: mkBox(e, it.stop ? 'stop' : 'process') };
    }

    function parseTree(ctx, mode, depth) {
      var e = ctx.list[ctx.i++];
      var role;
      if (mode === 'fishbone') role = depth === 0 ? 'fbEffect' : depth === 1 ? 'fbCause' : 'fbLabel';
      else role = e.item.assistant && depth > 0 ? 'assistant' : 'tree';
      var node = { box: mkBox(e, role), children: [], assistants: [] };
      while (ctx.i < ctx.list.length) {
        var n = ctx.list[ctx.i];
        if (n.level <= e.level) break;
        if (n.type !== 'item') { warn(n.no, '[UNTIL] ist in Baumdiagrammen ohne Bedeutung.'); ctx.i++; continue; }
        var child = parseTree(ctx, mode, depth + 1);
        (child.box.role === 'assistant' ? node.assistants : node.children).push(child);
      }
      return node;
    }

    doc.layers.forEach(function (lay) {
      curLayer = lay;
      layerNum = 0;
      lay.roots.forEach(function (r) {
        var list = r.list;
        var first = list.find(function (x) { return x.type === 'item'; });
        if (!first) { r.mode = 'flow'; r.nodes = []; return; }
        var mode = r.mode;
        if (mode === 'auto') mode = first.item.kind === 'tree' ? 'tree' : 'flow';
        var ctx = { list: list, i: 0, loopDepth: 0 };
        if (mode === 'flow') {
          var nodes = [];
          while (ctx.i < list.length) {
            var before = ctx.i;
            nodes.push.apply(nodes, parseSeq(ctx, list[ctx.i].level, false));
            if (ctx.i === before) ctx.i++;
          }
          var f = nodes[0];
          if (f && f.type === 'step' && f.box.role === 'process') f.box.role = 'start';
          r.nodes = nodes;
        } else {
          r.trees = [];
          while (ctx.i < list.length) {
            if (list[ctx.i].type !== 'item') { ctx.i++; continue; }
            r.trees.push(parseTree(ctx, mode, 0));
          }
        }
        r.mode = mode;
      });
    });

    return doc;
  };
})(typeof window !== 'undefined' ? (window.AC = window.AC || {}) : (globalThis.AC = globalThis.AC || {}));
