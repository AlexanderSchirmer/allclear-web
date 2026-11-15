/*
 * allClear Web – Ausgabe
 * Ein einziger Renderer: erzeugt aus dem Layout ein SVG. Für den Export wird zusätzlich das
 * draw.io-Modell (mxfile) im Attribut "content" eingebettet → Datei *.drawio.svg.
 */
(function (AC) {
  'use strict';

  var G = AC.GEOM;
  var FONT = 'Arial, Helvetica, sans-serif';

  function F(n) { return String(Math.round(n * 10) / 10); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  AC.escapeXml = esc;

  /* ---------- SVG ---------- */
  var ST = ' fill="#ffffff" stroke="#000000"';
  function shapeSvg(b) {
    var d = AC.shapeDef(b), x = b.x, y = b.y, w = b.w, h = b.h, out;
    if (d.none) return '';
    if (d.ellipse) return '<ellipse cx="' + F(x + w / 2) + '" cy="' + F(y + h / 2) + '" rx="' + F(w / 2) + '" ry="' + F(h / 2) + '"' + ST + '/>';
    var P = AC.shapePoints(b);
    if (P) out = '<path d="M' + P.map(function (p) { return F(x + p[0]) + ' ' + F(y + p[1]); }).join(' L') + ' Z"' + ST + '/>';
    else if (d.wave) {
      var a = Math.max(3, h * 0.1);
      out = d.wave === 'bottom'
        ? '<path d="M' + F(x) + ' ' + F(y) + ' H' + F(x + w) + ' V' + F(y + h - a) + ' C' + F(x + w * 0.75) + ' ' + F(y + h + a) + ' ' + F(x + w * 0.25) + ' ' + F(y + h - 3 * a) + ' ' + F(x) + ' ' + F(y + h - a) + ' Z"' + ST + '/>'
        : '<path d="M' + F(x) + ' ' + F(y + a) + ' C' + F(x + w * 0.25) + ' ' + F(y + 3 * a) + ' ' + F(x + w * 0.75) + ' ' + F(y - a) + ' ' + F(x + w) + ' ' + F(y + a) +
          ' V' + F(y + h - a) + ' C' + F(x + w * 0.75) + ' ' + F(y + h - 3 * a) + ' ' + F(x + w * 0.25) + ' ' + F(y + h + a) + ' ' + F(x) + ' ' + F(y + h - a) + ' Z"' + ST + '/>';
    } else if (d.round === 'right') {
      var r = Math.min(h / 2, w / 2);
      out = '<path d="M' + F(x) + ' ' + F(y) + ' H' + F(x + w - r) + ' A' + F(r) + ' ' + F(h / 2) + ' 0 0 1 ' + F(x + w - r) + ' ' + F(y + h) + ' H' + F(x) + ' Z"' + ST + '/>';
    } else if (d.round === 'top') {
      var t = Math.min(h * 0.35, 16);
      out = '<path d="M' + F(x) + ' ' + F(y + h) + ' V' + F(y + t) + ' A' + F(w / 2) + ' ' + F(t) + ' 0 0 1 ' + F(x + w) + ' ' + F(y + t) + ' V' + F(y + h) + ' Z"' + ST + '/>';
    } else if (d.cylinder) {
      var c = 8;
      out = '<path d="M' + F(x + w - c) + ' ' + F(y) + ' H' + F(x + c) + ' A' + c + ' ' + F(h / 2) + ' 0 0 0 ' + F(x + c) + ' ' + F(y + h) + ' H' + F(x + w - c) + ' Z"' + ST + '/>' +
        '<ellipse cx="' + F(x + w - c) + '" cy="' + F(y + h / 2) + '" rx="' + c + '" ry="' + F(h / 2) + '"' + ST + '/>';
    } else {
      var rx = d.stadium ? h / 2 : (d.rx || 0);
      out = '<rect x="' + F(x) + '" y="' + F(y) + '" width="' + F(w) + '" height="' + F(h) + '"' + (rx ? ' rx="' + F(rx) + '"' : '') + ST +
        (d.dashed ? ' stroke-dasharray="4 3"' : '') + '/>';
    }
    if (d.deco) d.deco(w, h).forEach(function (l) {
      out += '<path d="M' + F(x + l[0]) + ' ' + F(y + l[1]) + ' L' + F(x + l[2]) + ' ' + F(y + l[3]) + '" stroke="#000000" fill="none"' + (l[4] ? ' stroke-width="' + l[4] + '"' : '') + '/>';
    });
    return out;
  }
  function frac(v, size) { return v ? (Math.abs(v) < 1 ? v * size : v) : 0; }
  function textSvg(b) {
    var d = AC.shapeDef(b);
    var lines = b.lines || [];
    var nl = lines.reduce(function (s, a) { return s + Math.max(1, a.length); }, 0);
    var th = nl * G.LH + (lines.length - 1) * G.AREA_GAP;
    var cy = b.y + b.h / 2 + (b.role === 'fbLabel' ? 0 : frac(d.textDy, b.h));
    var top = cy - th / 2;
    var anchor = 'middle', tx = b.x + b.w / 2 + frac(d.textDx, b.w);
    if (b.role === 'fbLabel') { anchor = 'end'; tx = b.x + b.w; }
    if (b.role === 'desc') { anchor = 'start'; tx = b.x + 8; }
    var out = '', yy = top;
    var withSep = !d.ellipse && !d.none && d.fit !== 'diamond' && d.fit !== 'triangle';
    lines.forEach(function (area, ai) {
      if (ai > 0) {
        var sy = yy + G.AREA_GAP / 2;
        if (withSep) out += '<path d="M' + F(AC.leftAt(b, sy)) + ' ' + F(sy) + ' L' + F(AC.rightAt(b, sy)) + ' ' + F(sy) + '" stroke="#000000" fill="none"/>';
        yy += G.AREA_GAP;
      }
      (area.length ? area : ['']).forEach(function (ln) {
        if (ln) out += '<text x="' + F(tx) + '" y="' + F(yy + G.LH / 2 + G.FS * 0.35) + '" text-anchor="' + anchor + '" font-size="' + G.FS + '" fill="#000000" stroke="none">' + esc(ln) + '</text>';
        yy += G.LH;
      });
    });
    return out;
  }
  function arrowHead(p1, p2) {
    var dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy) || 1;
    var ux = dx / L, uy = dy / L, s = 8, hw = 3.5;
    var bx = p2.x - ux * s, by = p2.y - uy * s;
    return '<path d="M' + F(p2.x) + ' ' + F(p2.y) + ' L' + F(bx - uy * hw) + ' ' + F(by + ux * hw) + ' L' + F(bx + uy * hw) + ' ' + F(by - ux * hw) + ' Z" fill="#000000" stroke="#000000"/>';
  }
  function pathSvg(pts, arrow, cls) {
    var d = 'M' + pts.map(function (p) { return F(p.x) + ' ' + F(p.y); }).join(' L');
    var s = '<path' + (cls ? ' class="' + cls + '"' : '') + ' d="' + d + '" fill="none" stroke="#000000"/>';
    if (arrow && pts.length > 1) s += arrowHead(pts[pts.length - 2], pts[pts.length - 1]);
    return s;
  }
  function labelSvg(l) {
    var anchor = { left: 'start', right: 'end', center: 'middle' }[l.align || 'center'];
    return '<text x="' + F(l.x) + '" y="' + F(l.y + l.size * 0.35) + '" text-anchor="' + anchor + '" font-size="' + l.size +
      '" fill="#000000" stroke="#ffffff" stroke-width="3" paint-order="stroke" stroke-linejoin="round">' + esc(l.text) + '</text>';
  }

  AC.renderSVG = function (L, opts, content) {
    var W = Math.ceil(L.w), H = Math.ceil(L.h);
    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="' + W + 'px" height="' + H +
      'px" viewBox="-0.5 -0.5 ' + W + ' ' + H + '"' + (content ? ' content="' + esc(content) + '"' : '') + '>');
    o.push('<rect x="-0.5" y="-0.5" width="' + W + '" height="' + H + '" fill="#ffffff"/>');
    o.push('<g font-family="' + FONT + '" stroke-width="1">');
    L.lines.forEach(function (l) { o.push(pathSvg(l.pts, l.arrow)); });
    L.edges.forEach(function (e) { o.push(pathSvg(e.pts, e.arrow !== false, e.kind === 'goto' ? 'ac-goto' : null)); });
    L.boxes.forEach(function (b) {
      o.push('<g class="ac-box" data-id="' + b.id + '" data-line="' + (b.line || '') + '">' + shapeSvg(b) + textSvg(b) + '</g>');
    });
    L.edges.forEach(function (e) { (e.labels || []).forEach(function (l) { o.push(labelSvg(l)); }); });
    L.texts.forEach(function (t) { o.push(labelSvg(t)); });
    L.links.forEach(function (lk, i) {
      var c = lk.cx, y = lk.cy, r = lk.r;
      var arrow = lk.kind === 'out'
        ? '<path d="M' + F(c - 2.5) + ' ' + F(y + 2.5) + ' L' + F(c + 2.5) + ' ' + F(y - 2.5) + ' M' + F(c - 0.5) + ' ' + F(y - 2.5) + ' L' + F(c + 2.5) + ' ' + F(y - 2.5) + ' L' + F(c + 2.5) + ' ' + F(y + 0.5) + '" fill="none" stroke="#000000"/>'
        : '<path d="M' + F(c - 2.5) + ' ' + F(y - 2.5) + ' L' + F(c + 2.5) + ' ' + F(y + 2.5) + ' M' + F(c - 0.5) + ' ' + F(y + 2.5) + ' L' + F(c + 2.5) + ' ' + F(y + 2.5) + ' L' + F(c + 2.5) + ' ' + F(y - 0.5) + '" fill="none" stroke="#000000"/>';
      o.push('<g class="ac-link' + (lk.target ? ' ac-link-active' : '') + '" data-idx="' + i + '"><circle cx="' + F(c) + '" cy="' + F(y) + '" r="' + r + '" fill="#ffffff" stroke="#000000"/>' + arrow + '</g>');
    });
    if (L.title) {
      L.title.lines.forEach(function (t, i) {
        o.push('<text x="' + F(L.title.cx) + '" y="' + F(L.title.y + 14 + i * 18) + '" text-anchor="middle" font-size="14" font-weight="bold" fill="#000000" stroke="none">' + esc(t) + '</text>');
      });
    }
    o.push('</g></svg>');
    return o.join('');
  };

  /* ---------- draw.io-Modell ---------- */
  var BASE = 'whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;fontFamily=Helvetica;fontSize=12;';
  var TEXT = 'text;html=1;strokeColor=none;fillColor=none;fontColor=#000000;fontFamily=Helvetica;spacing=0;';
  function r4(n) { return String(Math.round(n * 10000) / 10000); }
  function htmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }

  function sideSpacing(b) {
    var s = Math.max(2, Math.floor((b.w - (b.tw || 0)) / 2) - 6);
    return 'spacingLeft=' + s + ';spacingRight=' + s + ';';
  }
  function styleOf(b) {
    var d = AC.shapeDef(b);
    if (b.role === 'fbLabel') return TEXT + 'align=right;verticalAlign=middle;whiteSpace=nowrap;fontSize=12;';
    if (b.role === 'desc') return 'rounded=0;dashed=1;align=left;spacingLeft=6;' + BASE;
    if (d.none) return TEXT + 'align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=12;';
    var s;
    if (d.dio) s = typeof d.dio === 'function' ? d.dio(b) : d.dio;
    else if (d.poly) {
      var P = d.poly(b.w, b.h);
      s = 'shape=mxgraph.basic.polygon;polyline=0;polyCoords=[' + P.map(function (p) { return '[' + r4(p[0] / b.w) + ',' + r4(p[1] / b.h) + ']'; }).join(',') + '];';
    } else s = 'rounded=0;';
    if (d.fit === 'diamond' || d.fit === 'ellipse' || d.fit === 'compact' || d.fit === 'triangle') s += sideSpacing(b);
    var dy = frac(d.textDy, b.h);
    if (dy && !/spacingTop/.test(s)) s += (dy > 0 ? 'spacingTop=' : 'spacingBottom=') + Math.round(Math.abs(dy) * 2) + ';';
    return s + BASE;
  }
  /* Zierlinien (z. B. Doppellinien) als Linien innerhalb der Box – sie bewegen sich in draw.io mit */
  function decoXml(b) {
    var d = AC.shapeDef(b);
    if (!d.deco || d.dio) return '';
    return d.deco(b.w, b.h).map(function (l, k) {
      return '<mxCell id="' + b.id + '-d' + k + '" value="" style="endArrow=none;html=1;strokeColor=#000000;' + (l[4] ? 'strokeWidth=' + l[4] + ';' : '') + '" edge="1" parent="' + b.id + '">' +
        '<mxGeometry relative="1" as="geometry"><mxPoint x="' + F(l[0]) + '" y="' + F(l[1]) + '" as="sourcePoint"/><mxPoint x="' + F(l[2]) + '" y="' + F(l[3]) + '" as="targetPoint"/></mxGeometry></mxCell>';
    }).join('');
  }
  function vertex(id, value, style, x, y, w, h) {
    return '<mxCell id="' + id + '" value="' + esc(value) + '" style="' + style + '" vertex="1" parent="1"><mxGeometry x="' + F(x) +
      '" y="' + F(y) + '" width="' + F(w) + '" height="' + F(h) + '" as="geometry"/></mxCell>';
  }
  function labelCenter(l) {
    var cx = l.align === 'left' ? l.x + l.w / 2 : l.align === 'right' ? l.x - l.w / 2 : l.x;
    return { x: cx, y: l.y };
  }
  function edgeXml(id, e, arrow) {
    var p = e.pts, s = e.from, t = e.to, p0 = p[0], pn = p[p.length - 1];
    var st = 'edgeStyle=none;rounded=0;html=1;strokeColor=#000000;fontColor=#000000;' +
      (arrow ? 'endArrow=block;endFill=1;endSize=6;' : 'endArrow=none;');
    if (s) st += 'exitX=' + r4((p0.x - s.x) / s.w) + ';exitY=' + r4((p0.y - s.y) / s.h) + ';exitDx=0;exitDy=0;exitPerimeter=0;';
    if (t) st += 'entryX=' + r4((pn.x - t.x) / t.w) + ';entryY=' + r4((pn.y - t.y) / t.h) + ';entryDx=0;entryDy=0;entryPerimeter=0;';
    var xml = '<mxCell id="' + id + '" value="" style="' + st + '" edge="1" parent="1"' + (s ? ' source="' + s.id + '"' : '') + (t ? ' target="' + t.id + '"' : '') + '>' +
      '<mxGeometry relative="1" as="geometry"><mxPoint x="' + F(p0.x) + '" y="' + F(p0.y) + '" as="sourcePoint"/><mxPoint x="' + F(pn.x) + '" y="' + F(pn.y) + '" as="targetPoint"/>';
    if (p.length > 2) xml += '<Array as="points">' + p.slice(1, -1).map(function (q) { return '<mxPoint x="' + F(q.x) + '" y="' + F(q.y) + '"/>'; }).join('') + '</Array>';
    xml += '</mxGeometry></mxCell>';
    (e.labels || []).forEach(function (l, k) {
      var c = labelCenter(l);
      xml += '<mxCell id="' + id + '-l' + k + '" value="' + esc(htmlEsc(l.text)) + '" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];labelBackgroundColor=#FFFFFF;fontColor=#000000;fontFamily=Helvetica;fontSize=' + l.size + ';" vertex="1" connectable="0" parent="' + id + '">' +
        '<mxGeometry x="-1" relative="1" as="geometry"><mxPoint x="' + F(c.x - p0.x) + '" y="' + F(c.y - p0.y) + '" as="offset"/></mxGeometry></mxCell>';
    });
    return xml;
  }
  function textCell(id, l, extra) {
    var c = labelCenter(l), w = l.w + 6, h = l.size + 6;
    return vertex(id, htmlEsc(l.text), TEXT + 'align=center;verticalAlign=middle;fontSize=' + l.size + ';' + (extra || ''), c.x - w / 2, c.y - h / 2, w, h);
  }

  AC.toDrawioXml = function (layouts) {
    var out = ['<mxfile host="allClearWeb" agent="allClear Web" type="device">'];
    layouts.forEach(function (L, li) {
      var P = 'L' + li + '-';
      out.push('<diagram id="ac-layer-' + li + '" name="' + esc(L.name) + '"><mxGraphModel dx="1000" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>');
      L.lines.forEach(function (l, k) { out.push(edgeXml(P + 'f' + k, l, !!l.arrow)); });
      L.edges.forEach(function (e, k) { out.push(edgeXml(P + 'e' + k, e, e.arrow !== false)); });
      L.boxes.forEach(function (b) {
        var val = (b.disp || b.areas).map(htmlEsc).join('<hr>');
        out.push(vertex(b.id, val, styleOf(b), b.x, b.y, b.w, b.h) + decoXml(b));
      });
      L.texts.forEach(function (t, k) { out.push(textCell(P + 't' + k, t)); });
      L.links.forEach(function (lk, k) {
        var id = P + 'k' + k;
        var cell = '<mxCell style="ellipse;html=1;fillColor=#FFFFFF;strokeColor=#000000;" vertex="1" parent="1"><mxGeometry x="' + F(lk.cx - lk.r) + '" y="' + F(lk.cy - lk.r) + '" width="' + 2 * lk.r + '" height="' + 2 * lk.r + '" as="geometry"/></mxCell>';
        var link = lk.target ? 'data:page/id,ac-layer-' + lk.target.layer : '';
        out.push('<UserObject label="" id="' + id + '"' + (link ? ' link="' + esc(link) + '"' : '') + ' tooltip="' + esc((lk.kind === 'out' ? 'LINKTO ' : 'LINK ') + lk.name) + '">' + cell + '</UserObject>');
      });
      if (L.title) {
        var tw = L.title.w + 20, th = L.title.lines.length * 18 + 4;
        out.push(vertex(P + 'title', L.title.lines.map(htmlEsc).join('<br>'), TEXT + 'align=center;verticalAlign=middle;fontSize=14;fontStyle=1;', L.title.cx - tw / 2, L.title.y, tw, th));
      }
      out.push('</root></mxGraphModel></diagram>');
    });
    out.push('</mxfile>');
    return out.join('');
  };

  AC.buildDrawioSvg = function (layouts, idx, opts) {
    var xml = AC.toDrawioXml(layouts);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
      AC.renderSVG(layouts[idx], opts, xml);
  };
})(typeof window !== 'undefined' ? (window.AC = window.AC || {}) : (globalThis.AC = globalThis.AC || {}));
