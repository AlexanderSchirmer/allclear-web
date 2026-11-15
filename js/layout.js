/*
 * allClear Web – Layout
 * Berechnet aus dem Strukturmodell absolute Positionen für Boxen, Linien und Texte.
 * Das Ergebnis wird sowohl für die SVG-Darstellung als auch für das draw.io-Modell verwendet.
 */
(function (AC) {
  'use strict';

  var FS = 12, LH = 15, AREA_GAP = 9, VG = 34, HG = 24, LBL = 11;
  AC.GEOM = { FS: FS, LH: LH, AREA_GAP: AREA_GAP };

  /* ---------- Textmessung ---------- */
  var ctx2d = null, cache = new Map();
  function measure(text, size, bold) {
    size = size || FS;
    var key = (bold ? 'b' : '') + size + '|' + text;
    if (cache.has(key)) return cache.get(key);
    var w;
    if (AC.measureOverride) w = AC.measureOverride(text, size, bold);
    else {
      if (!ctx2d) ctx2d = document.createElement('canvas').getContext('2d');
      ctx2d.font = (bold ? 'bold ' : '') + size + 'px Arial, Helvetica, sans-serif';
      w = ctx2d.measureText(text).width;
    }
    if (cache.size > 20000) cache.clear();
    cache.set(key, w);
    return w;
  }
  AC.measure = measure;

  function wrap(text, maxW, size) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(''); return; }
      var cur = '';
      words.forEach(function (w) {
        while (measure(w, size) > maxW && w.length > 1) {
          var k = w.length - 1;
          while (k > 1 && measure(w.slice(0, k), size) > maxW) k--;
          if (cur) { out.push(cur); cur = ''; }
          out.push(w.slice(0, k));
          w = w.slice(k);
        }
        var t = cur ? cur + ' ' + w : w;
        if (cur && measure(t, size) > maxW) { out.push(cur); cur = w; } else cur = t;
      });
      out.push(cur);
    });
    return out;
  }
  AC.wrap = wrap;

  /* ---------- Geometrie der Formen (aus js/shapes.js) ---------- */
  function ellipseAt(b, v, horizontal, sign) {
    var rx = b.w / 2, ry = b.h / 2;
    if (horizontal) { var dx = (v - b.x - rx) / rx; return b.y + ry - ry * Math.sqrt(Math.max(0, 1 - dx * dx)); }
    var dy = (v - b.y - ry) / ry;
    return b.x + rx + sign * rx * Math.sqrt(Math.max(0, 1 - dy * dy));
  }
  /* Oberkante der Form an der Stelle x */
  function topAt(b, x) {
    var d = AC.shapeDef(b);
    if (d.ellipse) return ellipseAt(b, x, true);
    var P = AC.shapePoints(b);
    if (!P) return b.y;
    var rx = x - b.x, best = Infinity;
    for (var i = 0; i < P.length; i++) {
      var p = P[i], q = P[(i + 1) % P.length];
      if (rx < Math.min(p[0], q[0]) - 1e-6 || rx > Math.max(p[0], q[0]) + 1e-6) continue;
      var y = Math.abs(q[0] - p[0]) < 1e-9 ? Math.min(p[1], q[1]) : p[1] + (q[1] - p[1]) * (rx - p[0]) / (q[0] - p[0]);
      if (y < best) best = y;
    }
    return b.y + (best === Infinity ? 0 : best);
  }
  /* rechte bzw. linke Kante der Form auf Höhe y */
  function sideAt(b, y, right) {
    var d = AC.shapeDef(b);
    if (d.ellipse) return ellipseAt(b, y, false, right ? 1 : -1);
    var P = AC.shapePoints(b);
    if (!P) return right ? b.x + b.w : b.x;
    var ry = y - b.y, best = right ? -Infinity : Infinity;
    for (var i = 0; i < P.length; i++) {
      var p = P[i], q = P[(i + 1) % P.length];
      if (ry < Math.min(p[1], q[1]) - 1e-6 || ry > Math.max(p[1], q[1]) + 1e-6) continue;
      var xs = Math.abs(q[1] - p[1]) < 1e-9 ? [p[0], q[0]] : [p[0] + (q[0] - p[0]) * (ry - p[1]) / (q[1] - p[1])];
      xs.forEach(function (x) { best = right ? Math.max(best, x) : Math.min(best, x); });
    }
    if (!isFinite(best)) return right ? b.x + b.w : b.x;
    return b.x + best;
  }
  function rightAt(b, y) { return sideAt(b, y, true); }
  function leftAt(b, y) { return sideAt(b, y, false); }
  AC.topAt = topAt; AC.rightAt = rightAt; AC.leftAt = leftAt;

  /* ---------- Boxgröße ---------- */
  var WRAP = { process: 120, start: 120, stop: 120, choice: 112, 'if': 96, 'case': 116, loop: 104,
    tree: 124, assistant: 100, fbEffect: 100, fbCause: 104, fbLabel: 220, desc: 150 };
  var FIT_WRAP = { diamond: 96, ellipse: 104, compact: 90, triangle: 80 };

  function displayText(t, opts) {
    if (opts && opts.hidePunct) t = t.replace(/\s*[.:]$/, '');
    return t;
  }

  function sizeBox(box, opts) {
    var d = AC.shapeDef(box);
    var ww = (d.fit && FIT_WRAP[d.fit]) || WRAP[box.role] || 120;
    box.disp = box.areas.map(function (a) { return displayText(a, opts); });
    box.lines = box.disp.map(function (a) {
      /* Bewusst umbrochener Text (mehrzeilige Box): Kasten wächst mit den Zeilen bis 260 px mit */
      var aw = ww;
      if (a.indexOf('\n') >= 0) {
        a.split('\n').forEach(function (p) { aw = Math.max(aw, Math.min(260, measure(p.trim(), FS))); });
      }
      return wrap(a, aw, FS);
    });
    var all = [].concat.apply([], box.lines);
    var tw = Math.max.apply(null, [1].concat(all.map(function (l) { return measure(l, FS); })));
    var nl = box.lines.reduce(function (s, a) { return s + Math.max(1, a.length); }, 0);
    var th = nl * LH + (box.lines.length - 1) * AREA_GAP;
    var iw = tw + 16, ih = th + 12, w, h;
    if (box.role === 'fbLabel') { w = tw + 4; h = th; }
    else if (box.role === 'desc') { w = iw; h = Math.max(28, ih); }
    else {
      switch (d.fit) {
        case 'diamond': w = Math.max(116, tw * 1.9 + 24); h = Math.max(56, th * 1.9 + 16); break;
        case 'ellipse': w = Math.max(110, iw * 1.4); h = Math.max(44, ih * 1.45); break;
        case 'compact': w = Math.max(90, iw * 1.4); h = Math.max(60, ih * 1.7); break;
        case 'triangle': w = Math.max(110, tw * 2.2 + 16); h = Math.max(70, th * 2.4 + 16); break;
        default: {
          var pad = d.pad || [0, 0];
          w = Math.max(110, iw + pad[0]);
          h = Math.max(box.role === 'start' || box.role === 'stop' ? 46 : 36, ih + pad[1]);
        }
      }
    }
    box.w = Math.round(w);
    box.h = Math.round(h);
    box.tw = tw;
  }

  /* ---------- Blöcke ---------- */
  function newBlock() {
    return { w: 0, h: 0, ax: 0, boxes: [], edges: [], lines: [], texts: [], pend: [], ghosts: [], entry: null };
  }
  function shift(b, dx, dy) {
    if (!dx && !dy) return;
    var sp = function (p) { p.x += dx; p.y += dy; };
    b.ax += dx;
    b.boxes.forEach(sp);
    b.edges.forEach(function (e) { e.pts.forEach(sp); (e.labels || []).forEach(sp); });
    b.lines.forEach(function (l) { l.pts.forEach(sp); });
    b.texts.forEach(sp);
    b.ghosts.forEach(sp);
    b.pend.forEach(function (p) { p.pts.forEach(sp); (p.labels || []).forEach(sp); });
  }
  function absorb(dst, src) {
    ['boxes', 'edges', 'lines', 'texts', 'ghosts'].forEach(function (k) { Array.prototype.push.apply(dst[k], src[k]); });
    src.parent = dst;
  }
  function labelBox(l) {
    var x = l.align === 'left' ? l.x : l.align === 'right' ? l.x - l.w : l.x - l.w / 2;
    return { x0: x, x1: x + l.w, y0: l.y - l.size * 0.7, y1: l.y + l.size * 0.7 };
  }
  function bbox(b) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    function add(x, y) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    function addL(l) { var r = labelBox(l); add(r.x0, r.y0); add(r.x1, r.y1); }
    b.boxes.forEach(function (o) { add(o.x, o.y); add(o.x + o.w, o.y + o.h); });
    b.edges.forEach(function (e) { e.pts.forEach(function (p) { add(p.x, p.y); }); (e.labels || []).forEach(addL); });
    b.lines.forEach(function (l) { l.pts.forEach(function (p) { add(p.x, p.y); }); });
    b.texts.forEach(addL);
    b.ghosts.forEach(function (g) { add(g.x, g.y); });
    b.pend.forEach(function (p) { p.pts.forEach(function (q) { add(q.x, q.y); }); (p.labels || []).forEach(addL); });
    if (x0 === Infinity) return { x0: 0, y0: 0, x1: 0, y1: 0 };
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function finalize(b) {
    var bb = bbox(b);
    shift(b, -bb.x0, 0);
    b.w = bb.x1 - bb.x0;
    b.h = Math.max(b.h || 0, bb.y1);
    return b;
  }
  function mkLabel(text, x, y, align, size) {
    size = size || LBL;
    return { text: text, x: x, y: y, align: align || 'center', size: size, w: measure(text, size) + 2 };
  }
  function simplify(pts) {
    var out = [];
    pts.forEach(function (p) {
      var l = out[out.length - 1];
      if (l && Math.abs(l.x - p.x) < 0.5 && Math.abs(l.y - p.y) < 0.5) return;
      out.push({ x: p.x, y: p.y });
    });
    for (var i = out.length - 2; i >= 1; i--) {
      var a = out[i - 1], c = out[i + 1], m = out[i];
      if ((Math.abs(a.x - m.x) < 0.5 && Math.abs(m.x - c.x) < 0.5) || (Math.abs(a.y - m.y) < 0.5 && Math.abs(m.y - c.y) < 0.5)) out.splice(i, 1);
    }
    return out;
  }

  /* Anschlusshöhe für Sprunglinien: bei Entscheidungen und Schleifenköpfen abseits der Zweiglinien */
  function attachY(b, side, entry) {
    var f = 0.5;
    if (b.role === 'if') f = entry ? 0.15 : 0.8;
    else if (b.role === 'loop' && side === 'right') f = entry ? 0.75 : 0.88;
    return b.y + b.h * f;
  }

  /* Sprungmarke (Konnektor) für Sprünge zwischen Abläufen */
  var connSeq = 0;
  function mkConn(name, line) {
    var w = Math.max(26, Math.round(measure(name, FS) + 12));
    return { id: 'k' + (++connSeq), role: 'conn', conn: name, areas: [name], disp: [name], lines: [[name]], w: w, h: 26, tw: measure(name, FS), line: line, num: 0 };
  }

  /* Einzelne Box (plus evtl. Beschreibung und Sprungmarken) */
  function boxBlock(box, ctx, withPend, noReserve) {
    var b = newBlock();
    box.x = 0; box.y = 0;
    box.blk = b;
    b.node = box;
    b.boxes.push(box);
    b.entry = box;
    b.ax = box.w / 2;
    var right = box.w;
    if (box.description) {
      var d = { id: box.id + 'd', role: 'desc', areas: [box.description], line: box.line, num: 0 };
      sizeBox(d, ctx.opts);
      d.x = box.w + 34;
      d.y = Math.max(0, Math.round((box.h - d.h) / 2));
      b.boxes.push(d);
      var y = box.h / 2;
      b.edges.push({ from: d, to: box, pts: [{ x: d.x, y: y }, { x: rightAt(box, y), y: y }], labels: [] });
      right = d.x + d.w;
    }
    var cn = ctx.conns && ctx.conns.get(box);
    if (cn) {
      if (cn.inName) {
        var iy = attachY(box, 'left', true);
        var mi = mkConn(cn.inName, box.line);
        mi.x = -mi.w - 22; mi.y = iy - mi.h / 2;
        b.boxes.push(mi);
        b.edges.push({ from: mi, to: box, pts: [{ x: mi.x + mi.w, y: iy }, { x: leftAt(box, iy), y: iy }], labels: [] });
      }
      cn.out.forEach(function (o, i) {
        var oy = attachY(box, 'right', false) + i * 32;
        var mo = mkConn(o.name, box.line);
        mo.x = right + 22; mo.y = oy - mo.h / 2;
        b.boxes.push(mo);
        b.edges.push({ from: box, to: mo, kind: 'goto', pts: [{ x: right === box.w ? rightAt(box, oy) : right, y: oy }, { x: mo.x, y: oy }],
          labels: o.text ? [mkLabel(o.text, mo.x + mo.w + 4, oy, 'left')] : [] });
      });
    }
    if (withPend && !box.stop && !(ctx.gotologic && box.gotos && box.gotos.length)) {
      b.pend.push({ from: box, pts: [{ x: box.w / 2, y: box.h }], labels: [] });
    }
    b.h = box.h;
    if (!noReserve) reserveLanes(b, ctx);
    return finalize(b);
  }

  /* Platz für Sprung-Spuren neben einem Block reservieren (zweiter Layout-Durchgang) */
  function bboxList(blocks) {
    var r = null;
    blocks.forEach(function (k) {
      var q = bbox(k);
      r = r ? { x0: Math.min(r.x0, q.x0), y0: Math.min(r.y0, q.y0), x1: Math.max(r.x1, q.x1), y1: Math.max(r.y1, q.y1) } : q;
    });
    return r || { x0: 0, y0: 0, x1: 0, y1: 0 };
  }
  function laneRange(b, e) {
    if (e.seq && b.kids) return bboxList(b.kids.slice(Math.min(e.i0, e.i1), Math.max(e.i0, e.i1) + 1));
    return bbox(b);
  }
  function reserveLanes(b, ctx) {
    var list = ctx.res && ctx.res.get(b.node);
    if (!list) return;
    var last = { left: null, right: null };
    list.forEach(function (e) {
      var r = laneRange(b, e), lane;
      if (e.side === 'right') {
        lane = r.x1 + 16;
        e.gotos.forEach(function (gg) {
          if (gg.labelW && gg.src.blk) lane = Math.max(lane, rightAt(gg.src, attachY(gg.src, 'right', false)) + gg.labelW + 14);
        });
        if (last.right !== null) lane = Math.max(lane, last.right + 14);
        last.right = lane;
      } else {
        lane = r.x0 - 16;
        e.gotos.forEach(function (gg) {
          if (gg.labelW && gg.src.blk) lane = Math.min(lane, leftAt(gg.src, attachY(gg.src, 'left', false)) - gg.labelW - 14);
        });
        if (last.left !== null) lane = Math.min(lane, last.left - 14);
        last.left = lane;
      }
      var gp = { x: lane, y: (r.y0 + r.y1) / 2 };
      b.ghosts.push(gp, { x: lane + (e.side === 'right' ? 6 : -6), y: gp.y });
      ctx.lanePts.set(e, gp);
    });
  }

  /* Offene Linien (pend) mit der Eingangsbox des nächsten Blocks verbinden */
  function connect(b, pend, target, gapTop) {
    var tx = target.x + target.w / 2, ty = topAt(target, tx);
    var mergeY = gapTop - VG / 2;
    var labeled = false;
    pend.forEach(function (p) {
      var pts = p.pts.slice();
      var last = pts[pts.length - 1];
      if (Math.abs(last.x - tx) < 0.5) pts.push({ x: tx, y: ty });
      else pts.push({ x: last.x, y: mergeY }, { x: tx, y: mergeY }, { x: tx, y: ty });
      var labels = (p.labels || []).slice();
      if (!labeled && target.linetext) {
        labels.push(mkLabel(target.linetext, tx + 5, ty - 10, 'left'));
        labeled = true;
      }
      b.edges.push({ from: p.from, to: target, pts: simplify(pts), labels: labels });
    });
  }

  function layoutSeq(nodes, ctx) {
    var b = newBlock();
    if (nodes.length === 1 && nodes[0].type === 'empty') {
      var t = nodes[0].linetext;
      b.emptyBranch = true;
      b.inLabel = t;
      b.w = Math.max(30, measure(t, LBL) + 10);
      b.ax = b.w / 2;
      return b;
    }
    var blocks = nodes.filter(function (n) { return n.type !== 'empty'; }).map(function (n) { return layoutNode(n, ctx); });
    if (!blocks.length) { b.emptySeq = true; return b; }
    b.ax = Math.max.apply(null, blocks.map(function (x) { return x.ax; }));
    var y = 0, pend = null;
    blocks.forEach(function (c, i) {
      if (i > 0) y += VG;
      shift(c, b.ax - c.ax, y);
      if (pend && pend.length && c.entry) connect(b, pend, c.entry, y);
      absorb(b, c);
      pend = c.pend;
      y += c.h;
    });
    b.pend = pend || [];
    b.entry = blocks[0].entry;
    b.h = y;
    b.kids = blocks;
    b.node = nodes;
    reserveLanes(b, ctx);
    return finalize(b);
  }

  function layoutNode(n, ctx) {
    switch (n.type) {
      case 'step': return boxBlock(n.box, ctx, true);
      case 'cluster': return layoutCluster(n, ctx);
      case 'loop': return layoutLoop(n, ctx);
      case 'tree': return layoutTree(n.root, ctx, 0);
      default: return newBlock();
    }
  }

  function labelOf(br) {
    if (br.inLabel != null) return br.inLabel;
    return (br.entry && br.entry.linetext) || '';
  }

  /* IF- und CASE-Cluster */
  function layoutCluster(n, ctx) {
    var head = n.head;
    var brs = n.branches.map(function (s) { return layoutSeq(s, ctx); })
      .filter(function (br) { return !br.emptySeq; });
    if (!brs.length) return boxBlock(head, ctx, true);
    var hb = boxBlock(head, ctx, false);
    var b = newBlock();
    var cy = head.h / 2;
    var lw = function (t) { return t ? measure(t, LBL) + 12 : 0; };

    function branchEdge(br, pts, top, label) {
      var last = pts[pts.length - 1];
      var labels = label ? [label] : [];
      if (br.emptyBranch) {
        pts.push({ x: last.x, y: top });
        b.pend.push({ from: head, pts: pts, labels: labels });
      } else {
        pts.push({ x: last.x, y: topAt(br.entry, last.x) });
        b.edges.push({ from: head, to: br.entry, pts: simplify(pts), labels: labels });
      }
    }

    if (n.kind === 'if' && brs.length === 2) {
      var Lb = brs[0], Rb = brs[1];
      var top = Math.round(head.h + 24);
      var t0 = labelOf(Lb), t1 = labelOf(Rb);
      var needL = Math.max(20, lw(t0)), needR = Math.max(20, lw(t1));
      shift(Lb, 0, top);
      shift(Rb, Lb.w + HG, top);
      var a0 = Lb.ax, a1 = Rb.ax;
      var hx = Math.max((a0 + a1) / 2, a0 + needL + head.w / 2);
      var deficit = hx + head.w / 2 + needR - a1;
      if (deficit > 0) { shift(Rb, deficit, 0); a1 = Rb.ax; }
      shift(hb, hx - head.w / 2, 0);
      absorb(b, hb); absorb(b, Lb); absorb(b, Rb);
      var hl = head.x, hr = head.x + head.w;
      branchEdge(Lb, [{ x: hl, y: cy }, { x: a0, y: cy }], top, t0 ? mkLabel(t0, (hl + a0) / 2, cy - 9) : null);
      branchEdge(Rb, [{ x: hr, y: cy }, { x: a1, y: cy }], top, t1 ? mkLabel(t1, (hr + a1) / 2, cy - 9) : null);
      b.pend.push.apply(b.pend, Lb.pend.concat(Rb.pend));
    } else if (n.kind === 'if' && brs.length === 1) {
      var R = brs[0], tr = labelOf(R);
      var top1 = Math.round(head.h + 24);
      absorb(b, hb);
      var ar = Math.max(head.w + Math.max(20, lw(tr)), head.w / 2 + 24 + R.ax);
      shift(R, ar - R.ax, top1);
      absorb(b, R);
      branchEdge(R, [{ x: head.w, y: cy }, { x: ar, y: cy }], top1, tr ? mkLabel(tr, (head.w + ar) / 2, cy - 9) : null);
      b.pend.push({ from: head, pts: [{ x: head.w / 2, y: head.h }], labels: [] });
      b.pend.push.apply(b.pend, R.pend);
    } else {
      var busY = Math.round(head.h + 14), topc = busY + 22, x = 0;
      brs.forEach(function (br) { shift(br, x, topc); x += br.w + HG; });
      var as = brs.map(function (br) { return br.ax; });
      var hxc = (as[0] + as[as.length - 1]) / 2;
      shift(hb, hxc - head.w / 2, 0);
      absorb(b, hb);
      brs.forEach(function (br, i) {
        absorb(b, br);
        var t = labelOf(br);
        branchEdge(br, [{ x: hxc, y: head.y + head.h }, { x: hxc, y: busY }, { x: as[i], y: busY }], topc,
          t ? mkLabel(t, as[i] + 5, busY + 11, 'left') : null);
        b.pend.push.apply(b.pend, br.pend);
      });
    }
    b.entry = head;
    b.ax = head.x + head.w / 2;
    b.node = n;
    reserveLanes(b, ctx);
    return finalize(b);
  }

  /* Schleife [LOOP] ... [UNTIL] */
  function layoutLoop(n, ctx) {
    var head = n.head;
    var body = layoutSeq(n.body, ctx);
    if (body.emptySeq || body.emptyBranch || !body.entry) return boxBlock(head, ctx, true);
    var hb = boxBlock(head, ctx, false);
    var b = newBlock();
    absorb(b, hb);
    b.entry = head;
    b.ax = head.w / 2;
    var cy = head.h / 2;
    var t = labelOf(body);
    var lw = t ? measure(t, LBL) + 12 : 0;
    var bodyAx = Math.max(head.w + Math.max(24, lw), head.w / 2 + 24 + body.ax);
    var top = Math.round(Math.max(head.h + 16, cy + 30));
    shift(body, bodyAx - body.ax, top);
    b.edges.push({
      from: head, to: body.entry,
      pts: simplify([{ x: head.w, y: cy }, { x: bodyAx, y: cy }, { x: bodyAx, y: topAt(body.entry, bodyAx) }]),
      labels: t ? [mkLabel(t, (head.w + bodyAx) / 2, cy - 9)] : []
    });
    absorb(b, body);
    var bottom = top + body.h;
    var bb = bbox(body);
    var laneX = bb.x1 + 18;
    var ey = head.y + cy - head.h * 0.3;
    var ex = rightAt(head, ey);
    body.pend.forEach(function (p) {
      var last = p.pts[p.pts.length - 1];
      var pts = p.pts.concat([{ x: last.x, y: bottom + 12 }, { x: laneX, y: bottom + 12 }, { x: laneX, y: ey }, { x: ex, y: ey }]);
      b.edges.push({ from: p.from, to: head, pts: simplify(pts), labels: p.labels || [] });
    });
    b.pend = [{ from: head, pts: [{ x: head.w / 2, y: head.h }], labels: [] }];
    b.h = bottom + 16;
    b.node = n;
    reserveLanes(b, ctx);
    return finalize(b);
  }

  /* Baum / Organigramm */
  function layoutTree(node, ctx, depth) {
    var box = node.box;
    var b = boxBlock(box, ctx, false, true);
    var kids = node.children.map(function (c) { return layoutTree(c, ctx, depth + 1); });
    var assts = node.assistants.map(function (c) { return layoutTree(c, ctx, depth + 1); });
    if (!kids.length && !assts.length) { b.leaf = true; reserveLanes(b, ctx); return finalize(b); }
    var tx = box.w / 2;
    var y = box.h + 16;
    for (var i = 0; i < assts.length; i += 2) {
      var rowH = 0;
      assts.slice(i, i + 2).forEach(function (a, j) {
        var ab = a.entry;
        if (j === 0) shift(a, tx + 24 - ab.x, y - ab.y);
        else shift(a, tx - 24 - (ab.x + ab.w), y - ab.y);
        var ay = ab.y + ab.h / 2;
        b.edges.push({ from: box, to: ab, pts: [{ x: tx, y: box.h }, { x: tx, y: ay }, { x: j === 0 ? leftAt(ab, ay) : rightAt(ab, ay), y: ay }], labels: [] });
        absorb(b, a);
        rowH = Math.max(rowH, a.h);
      });
      y += rowH + 14;
    }
    if (!kids.length) { reserveLanes(b, ctx); return finalize(b); }
    var allLeaves = kids.every(function (k) { return k.leaf; });
    if (depth > 0 && allLeaves && kids.length > 1 && !assts.length) {
      var railX = Math.min(14, box.w / 4);
      var cy = y;
      kids.forEach(function (k) {
        var kb = k.entry;
        shift(k, railX + 18 - kb.x, cy - kb.y);
        var my = kb.y + kb.h / 2;
        b.edges.push({ from: box, to: kb, pts: [{ x: railX, y: box.h }, { x: railX, y: my }, { x: leftAt(kb, my), y: my }], labels: [] });
        absorb(b, k);
        cy += k.h + 12;
      });
    } else if (depth > 0 && kids.length >= 4) {
      /* Viele Kinder: paarweise links und rechts einer senkrechten Mittellinie (wie allCLEAR) */
      var ry = y;
      for (var p = 0; p < kids.length; p += 2) {
        var top2 = ry + 18, rowH2 = 0;
        [kids[p], kids[p + 1]].forEach(function (k, j) {
          if (!k) return;
          shift(k, j === 0 ? tx - 10 - k.w : tx + 10, top2);
          var kb = k.entry, ax2 = kb.x + kb.w / 2;
          b.edges.push({ from: box, to: kb, pts: simplify([{ x: tx, y: box.h }, { x: tx, y: ry }, { x: ax2, y: ry }, { x: ax2, y: topAt(kb, ax2) }]), labels: [] });
          absorb(b, k);
          rowH2 = Math.max(rowH2, k.h);
        });
        ry = top2 + rowH2 + 16;
      }
    } else {
      var busY = y, top = busY + 18, x = 0;
      kids.forEach(function (k) { shift(k, x, top); x += k.w + HG; });
      var a0 = kids[0].ax, a1 = kids[kids.length - 1].ax;
      var cx = (a0 + a1) / 2;
      shift(b, cx - tx, 0);
      tx = cx;
      kids.forEach(function (k) {
        var kb = k.entry, ax = kb.x + kb.w / 2;
        b.edges.push({ from: box, to: kb, pts: simplify([{ x: tx, y: box.y + box.h }, { x: tx, y: busY }, { x: ax, y: busY }, { x: ax, y: topAt(kb, ax) }]), labels: [] });
        absorb(b, k);
      });
    }
    b.entry = box;
    b.ax = box.x + box.w / 2;
    reserveLanes(b, ctx);
    return finalize(b);
  }

  /* Fishbone (Ursache-Wirkung) */
  function layoutFishbone(root, ctx) {
    var b = newBlock();
    var eff = root.box;
    var causes = root.children.concat(root.assistants);
    var SL = 0.55;
    var bones = causes.map(function (c, i) {
      var sg = i % 2 === 0 ? -1 : 1;
      var rows = [];
      (function walk(nd, depth, parent) {
        nd.children.concat(nd.assistants).forEach(function (ch) {
          var r = { box: ch.box, depth: depth, parent: parent };
          rows.push(r);
          walk(ch, depth + 1, r);
        });
      })(c, 1, null);
      var acc = 14;
      for (var j = rows.length - 1; j >= 0; j--) {
        var rh = Math.max(20, rows[j].box.h + 6);
        rows[j].d = acc + rh / 2;
        acc += rh;
      }
      var H = rows.length ? acc + 10 : 40;
      var ex = -H * SL;
      var cb = c.box;
      cb.x = ex - cb.w / 2;
      cb.y = sg < 0 ? -H - cb.h : H;
      var minX = cb.x, maxX = Math.max(0, cb.x + cb.w);
      var lines = [{ pts: [{ x: ex, y: sg * H }, { x: 0, y: 0 }], from: cb, arrow: false }];
      var labels = [];
      rows.forEach(function (r) {
        var y = sg * r.d, x1;
        if (r.depth === 1) x1 = -r.d * SL;
        else {
          x1 = r.parent.x0 + 8;
          lines.push({ pts: [{ x: x1, y: sg * r.parent.d }, { x: x1, y: y }], arrow: false });
        }
        r.x0 = x1 - 24;
        lines.push({ pts: [{ x: r.x0, y: y }, { x: x1, y: y }], arrow: false });
        var lb = r.box;
        lb.x = r.x0 - 3 - lb.w;
        lb.y = y - lb.h / 2;
        labels.push(lb);
        minX = Math.min(minX, lb.x);
      });
      return { cb: cb, labels: labels, lines: lines, minX: minX, maxX: maxX };
    });

    eff.x = 0; eff.y = -eff.h / 2;
    b.boxes.push(eff);
    var sx = null, prevLeft = 0;
    for (var k = 0; k < bones.length; k += 2) {
      var pair = bones.slice(k, k + 2);
      var colRight = Math.max.apply(null, pair.map(function (p) { return p.maxX; }));
      var colLeft = Math.min.apply(null, pair.map(function (p) { return p.minX; }));
      sx = (sx === null ? -28 : sx + prevLeft - 28) - colRight;
      pair.forEach(function (p) {
        var mv = function (o) { o.x += sx; };
        mv(p.cb); p.labels.forEach(mv);
        p.lines.forEach(function (l) { l.pts.forEach(mv); });
        b.boxes.push(p.cb);
        Array.prototype.push.apply(b.boxes, p.labels);
        Array.prototype.push.apply(b.lines, p.lines);
      });
      prevLeft = colLeft;
    }
    if (sx !== null) {
      b.edges.push({ from: null, to: eff, pts: [{ x: sx + prevLeft * 0.25 - 20, y: 0 }, { x: 0, y: 0 }], labels: [] });
    }
    var bb = bbox(b);
    shift(b, 0, -bb.y0);
    b.entry = null;
    return finalize(b);
  }

  /* ---------- Sprünge (GOTO) ---------- */
  function ancestors(blk) { var a = []; while (blk) { a.push(blk); blk = blk.parent; } return a; }

  /* Kosten einer Seite: waagerechte Strecken von Quelle bzw. Ziel bis zur Spur – Boxen zählen viel, Linien wenig */
  function sideCost(L, bb, src, t, side) {
    var c = 0;
    [[src, false], [t, true]].forEach(function (pr) {
      var bx = pr[0], y = attachY(bx, side, pr[1]);
      var x0 = side === 'right' ? rightAt(bx, y) : bb.x0 - 16;
      var x1 = side === 'right' ? bb.x1 + 16 : leftAt(bx, y);
      L.boxes.forEach(function (o) {
        if (o !== bx && o.y < y && o.y + o.h > y && o.x < x1 && o.x + o.w > x0) c += 10;
      });
      L.edges.forEach(function (e) {
        for (var i = 1; i < e.pts.length; i++) {
          var p = e.pts[i - 1], q = e.pts[i];
          if (Math.abs(p.x - q.x) < 0.5 && p.x > x0 && p.x < x1 && y > Math.min(p.y, q.y) && y < Math.max(p.y, q.y)) c += 1;
        }
      });
    });
    return c;
  }

  /* Erster Durchgang: für jeden Sprung den kleinsten gemeinsamen Block und die Seite bestimmen */
  function analyzeGotos(layer, ctx, labelMap, warn) {
    var res = new Map(), conns = new Map(), connNames = new Map(), nConn = 0;
    function conn(b) { var c = conns.get(b); if (!c) { c = { inName: null, out: [] }; conns.set(b, c); } return c; }
    layer.boxes.forEach(function (src) {
      (src.gotos || []).forEach(function (g) {
        var t = labelMap.get(AC.normName(g.label));
        if (!t) { warn(src.line, 'Sprungziel [LABEL=' + g.label + '] wurde nicht gefunden.'); return; }
        if (!src.blk || !t.blk) { warn(src.line, 'Sprünge in Fishbone-Diagrammen werden nicht gezeichnet.'); return; }
        var A = ancestors(src.blk), T = ancestors(t.blk), L = null;
        for (var i = 0; i < T.length && !L; i++) if (A.indexOf(T[i]) >= 0) L = T[i];
        if (!L) {
          /* verschiedene Abläufe: Sprungmarke statt Linie */
          var name = connNames.get(t);
          if (!name) { name = 'S' + (++nConn); connNames.set(t, name); conn(t).inName = name; }
          conn(src).out.push({ name: name, text: g.text });
          return;
        }
        var isSeq = Array.isArray(L.node) && !!L.kids, i0 = null, i1 = null;
        if (isSeq) { i0 = L.kids.indexOf(A[A.indexOf(L) - 1]); i1 = L.kids.indexOf(T[T.indexOf(L) - 1]); }
        var bb = isSeq ? bboxList(L.kids.slice(Math.min(i0, i1), Math.max(i0, i1) + 1)) : bbox(L);
        var cl = sideCost(L, bb, src, t, 'left'), cr = sideCost(L, bb, src, t, 'right'), side;
        if (cl !== cr) side = cl < cr ? 'left' : 'right';
        else side = (src.x + src.w / 2 < (bb.x0 + bb.x1) / 2 - 2) ? 'left' : 'right';
        var list = res.get(L.node);
        if (!list) { list = []; res.set(L.node, list); }
        var e = list.find(function (x) { return x.side === side && x.key === t.id; });
        if (!e) { e = { side: side, key: t.id, seq: isSeq, i0: i0, i1: i1, gotos: [] }; list.push(e); }
        else if (isSeq) { var lo = Math.min(e.i0, e.i1, i0, i1), hi = Math.max(e.i0, e.i1, i0, i1); e.i0 = lo; e.i1 = hi; }
        e.gotos.push({ src: src, t: t, g: g, labelW: g.text ? measure(g.text, LBL) + 2 : 0 });
      });
    });
    ctx.res = res;
    ctx.conns = conns;
    ctx.lanePts = new Map();
  }

  function routeLane(blk, gg, side, lane) {
    var src = gg.src, t = gg.t, self = src === t;
    var sy = self ? src.y + src.h * 0.35 : attachY(src, side, false);
    var ty = self ? t.y + t.h * 0.7 : attachY(t, side, true);
    var sx = side === 'right' ? rightAt(src, sy) : leftAt(src, sy);
    var tx = side === 'right' ? rightAt(t, ty) : leftAt(t, ty);
    var lbl = gg.g.text ? mkLabel(gg.g.text, side === 'right' ? sx + 6 : sx - 6, sy - 8, side === 'right' ? 'left' : 'right') : null;
    blk.edges.push({
      from: src, to: t, kind: 'goto', labels: lbl ? [lbl] : [],
      pts: simplify([{ x: sx, y: sy }, { x: lane, y: sy }, { x: lane, y: ty }, { x: tx, y: ty }])
    });
  }

  /* Brücken: wo eine waagerechte Sprunglinie eine senkrechte Linie kreuzt, springt sie darüber */
  function addHops(all) {
    var vert = [];
    function collect(owner, pts) {
      for (var i = 1; i < pts.length; i++) {
        var p = pts[i - 1], q = pts[i];
        if (Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) > 0.5) vert.push({ owner: owner, x: p.x, y0: Math.min(p.y, q.y), y1: Math.max(p.y, q.y) });
      }
    }
    all.edges.forEach(function (e) { collect(e, e.pts); });
    all.lines.forEach(function (l) { collect(l, l.pts); });
    all.edges.forEach(function (e) {
      if (e.kind !== 'goto') return;
      var hops = [];
      for (var i = 1; i < e.pts.length; i++) {
        var p = e.pts[i - 1], q = e.pts[i];
        if (Math.abs(p.y - q.y) > 0.5) continue;
        var lo = Math.min(p.x, q.x) + 7, hi = Math.max(p.x, q.x) - 7;
        vert.forEach(function (v) {
          if (v.owner !== e && v.x > lo && v.x < hi && p.y > v.y0 + 2 && p.y < v.y1 - 2) hops.push({ seg: i - 1, x: v.x });
        });
      }
      e.hops = hops;
    });
  }

  /* ---------- Ebene ---------- */
  function layoutLayer(doc, layer, opts, warn) {
    var ctx = { opts: opts, gotologic: doc.gotologic };
    layer.boxes.forEach(function (bx) { sizeBox(bx, opts); });
    function layoutRoots() {
      var blocks = [];
      layer.roots.forEach(function (r) {
        if (r.mode === 'flow') {
          var bk = layoutSeq(r.nodes || [], ctx);
          if (!bk.emptySeq && !bk.emptyBranch) blocks.push(bk);
        } else {
          (r.trees || []).forEach(function (t) {
            blocks.push(r.mode === 'fishbone' ? layoutFishbone(t, ctx) : layoutTree(t, ctx, 0));
          });
        }
      });
      return blocks;
    }

    var labelMap = new Map();
    layer.boxes.forEach(function (bx) {
      bx.blk = null;
      if (!bx.label) return;
      var key = AC.normName(bx.label);
      if (labelMap.has(key)) warn(bx.line, 'Sprungmarke [LABEL=' + bx.label + '] ist mehrfach vergeben.');
      else labelMap.set(key, bx);
    });
    var hasGoto = layer.boxes.some(function (bx) { return bx.gotos && bx.gotos.length; });
    var blocks = layoutRoots();
    if (hasGoto) {
      /* 1. Durchgang ergibt Lage und gemeinsame Blöcke, im 2. Durchgang wird Platz für die Spuren reserviert */
      analyzeGotos(layer, ctx, labelMap, warn);
      blocks = layoutRoots();
    }

    var all = newBlock(), x = 0;
    blocks.forEach(function (bk) { shift(bk, x, 0); absorb(all, bk); x += bk.w + 60; });
    if (hasGoto) {
      ctx.res.forEach(function (list) {
        list.forEach(function (e) {
          var gp = ctx.lanePts.get(e);
          if (gp) e.gotos.forEach(function (gg) { routeLane(all, gg, e.side, gp.x); });
        });
      });
    }

    var placed = all.boxes.filter(function (bx) { return bx.role !== 'desc'; });
    if (opts.numbers) {
      placed.forEach(function (bx) {
        if (bx.role === 'fbLabel' || !bx.num) return;
        all.texts.push(Object.assign(mkLabel(String(bx.num), bx.x + 1, bx.y - 6, 'left', 9), { kind: 'num' }));
      });
    }

    var links = [];
    placed.forEach(function (bx) {
      (bx.linkto || []).forEach(function (lk, i) {
        links.push({ kind: 'out', box: bx, name: lk.name, layerRef: lk.layer, cx: bx.x + bx.w + 1 + i * 15, cy: bx.y + bx.h - 1, r: 6 });
      });
      (bx.links || []).forEach(function (lk, i) {
        links.push({ kind: 'in', box: bx, name: lk.name, layerRef: lk.layer, cx: bx.x - 1 - i * 15, cy: bx.y + 1, r: 6 });
      });
    });
    links.forEach(function (l) {
      var t = l.name + (l.layerRef ? ':' + l.layerRef : '');
      l.label = l.kind === 'out' ? mkLabel(t, l.cx + 9, l.cy + 4, 'left', 9) : mkLabel(t, l.cx - 9, l.cy - 4, 'right', 9);
      all.texts.push(Object.assign(l.label, { kind: 'link' }));
    });

    var title = doc.title || '';
    if (doc.layers.length > 1) title = title ? title + ' – ' + layer.name : layer.name;
    var bb2 = bbox(all);
    links.forEach(function (l) {
      bb2.x0 = Math.min(bb2.x0, l.cx - 7); bb2.x1 = Math.max(bb2.x1, l.cx + 7);
      bb2.y0 = Math.min(bb2.y0, l.cy - 7); bb2.y1 = Math.max(bb2.y1, l.cy + 7);
    });
    if (bb2.x1 < bb2.x0) bb2 = { x0: 0, y0: 0, x1: 0, y1: 0 };
    var M = 20;
    var contentW = bb2.x1 - bb2.x0, contentH = bb2.y1 - bb2.y0;
    var tLines = title ? wrap(title, Math.max(420, contentW), 14) : [];
    var tW = Math.max.apply(null, [0].concat(tLines.map(function (l) { return measure(l, 14); })));
    var tH = tLines.length ? tLines.length * 18 + 16 : 0;
    var W = Math.max(contentW, tW, 120) + 2 * M;
    var dx = M - bb2.x0 + (W - 2 * M - contentW) / 2, dy = M + tH - bb2.y0;
    shift(all, dx, dy);
    links.forEach(function (l) { l.cx += dx; l.cy += dy; });
    /* Auf ganze Pixel runden: deckungsgleiche Linien bleiben scharf statt verwaschen-dick */
    var rp = function (p) { p.x = Math.round(p.x); p.y = Math.round(p.y); };
    all.boxes.forEach(rp);
    all.edges.forEach(function (e) { e.pts.forEach(rp); });
    all.lines.forEach(function (l) { l.pts.forEach(rp); });
    addHops(all);

    return {
      ref: layer.ref, name: layer.name, w: Math.ceil(W), h: Math.ceil(contentH + tH + 2 * M),
      title: tLines.length ? { lines: tLines, cx: W / 2, y: M, size: 14, w: tW } : null,
      boxes: all.boxes, edges: all.edges, lines: all.lines, texts: all.texts, links: links
    };
  }

  AC.layout = function (doc, opts) {
    opts = opts || {};
    var warn = function (line, msg) { doc.warnings.push({ line: line, msg: msg }); };
    var layouts = doc.layers.map(function (layer) { return layoutLayer(doc, layer, opts, warn); });
    /* Link-Ziele auflösen */
    function findLayer(ref, fallback) {
      if (ref == null) return fallback;
      var idx = doc.layers.findIndex(function (l) { return AC.normName(l.ref) === AC.normName(ref) || AC.normName(l.name) === AC.normName(ref); });
      return idx;
    }
    layouts.forEach(function (L, li) {
      L.links.forEach(function (lk) {
        var ti = findLayer(lk.layerRef, lk.kind === 'out' ? li : -1);
        if (ti < 0) {
          if (lk.kind === 'out') warn(lk.box.line, 'Ebene „' + lk.layerRef + '“ für [LINKTO=' + lk.name + '] nicht gefunden.');
          return;
        }
        var key = AC.normName(lk.name);
        var tb = doc.layers[ti].boxes.find(function (bx) {
          var arr = lk.kind === 'out' ? bx.links : bx.linkto;
          return (arr || []).some(function (x) { return AC.normName(x.name) === key; });
        });
        if (!tb) {
          if (lk.kind === 'out') warn(lk.box.line, 'Link-Ziel [LINK=' + lk.name + '] wurde nicht gefunden.');
          return;
        }
        lk.target = { layer: ti, boxId: tb.id };
      });
    });
    return layouts;
  };
})(typeof window !== 'undefined' ? (window.AC = window.AC || {}) : (globalThis.AC = globalThis.AC || {}));
