/*
 * allClear Web – Formen
 * Gemeinsame Formdefinitionen für Layout (Größe, Anschlusspunkte), SVG und draw.io.
 * Nummern für [SHAPE=n] folgen der Palette „All Shapes“ aus dem allCLEAR-Handbuch (Abb. 5.3),
 * zeilenweise gezählt, „None“ = 0. Die Nummerierung ist dort nicht dokumentiert – sie ist abgeleitet.
 */
(function (AC) {
  'use strict';

  var S_MI = 10, D_MO = 12, S_HEX = 15;

  function poly(fn) { return fn; }
  var K = {
    rect: { label: 'Rechteck' },
    rounded: { label: 'Abgerundetes Rechteck', rx: 8, dio: 'rounded=1;arcSize=20;' },
    stadium: { label: 'Terminator (Stadion)', stadium: true, pad: [16, 0], dio: 'rounded=1;arcSize=50;' },
    diamond: { label: 'Raute', fit: 'diamond', poly: poly(function (w, h) { return [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]; }), dio: 'rhombus;' },
    ellipse: { label: 'Ellipse', fit: 'ellipse', ellipse: true, dio: 'ellipse;' },
    trapezoid: { label: 'Trapez (Wahl-Box)', pad: [2 * D_MO, 0], poly: poly(function (w, h) { return [[0, 0], [w, 0], [w - D_MO, h], [D_MO, h]]; }),
      dio: function (b) { return 'shape=manualOperation;size=' + r4(D_MO / b.w) + ';'; } },
    parallelogram: { label: 'Parallelogramm', pad: [24, 0], poly: poly(function (w, h) { return [[12, 0], [w, 0], [w - 12, h], [0, h]]; }),
      dio: 'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;size=12;' },
    parallelogramL: { label: 'Parallelogramm (links geneigt)', pad: [24, 0], poly: poly(function (w, h) { return [[0, 0], [w - 12, 0], [w, h], [12, h]]; }),
      dio: 'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;size=12;flipH=1;' },
    hexagon: { label: 'Sechseck', pad: [2 * S_HEX, 0], poly: poly(function (w, h) { return [[S_HEX, 0], [w - S_HEX, 0], [w, h / 2], [w - S_HEX, h], [S_HEX, h], [0, h / 2]]; }),
      dio: 'shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;size=' + S_HEX + ';' },
    hexagonS: { label: 'Sechseck (flach)', pad: [16, 0], poly: poly(function (w, h) { return [[8, 0], [w - 8, 0], [w, h / 2], [w - 8, h], [8, h], [0, h / 2]]; }),
      dio: 'shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;size=8;' },
    hexagonV: { label: 'Sechseck (stehend)', fit: 'compact', poly: poly(function (w, h) { return [[w / 2, 0], [w, h / 4], [w, 3 * h / 4], [w / 2, h], [0, 3 * h / 4], [0, h / 4]]; }) },
    document: { label: 'Dokument', wave: 'bottom', pad: [0, 10], textDy: -4, dio: 'shape=document;boundedLbl=1;size=0.15;' },
    tape: { label: 'Lochstreifen (Band)', wave: 'both', pad: [0, 14], dio: 'shape=tape;size=0.2;' },
    delay: { label: 'Verzögerung', round: 'right', pad: [14, 0], dio: 'shape=delay;' },
    archTop: { label: 'Rechteck mit Bogen oben', round: 'top', pad: [0, 14], textDy: 6, dio: 'shape=delay;direction=north;' },
    cardTL: { label: 'Karte (Ecke oben links)', poly: poly(function (w, h) { return [[12, 0], [w, 0], [w, h], [0, h], [0, 12]]; }), dio: 'shape=card;size=12;' },
    cardTR: { label: 'Karte (Ecke oben rechts)', poly: poly(function (w, h) { return [[0, 0], [w - 12, 0], [w, 12], [w, h], [0, h]]; }), dio: 'shape=card;size=12;flipH=1;' },
    lineL: { label: 'Rechteck, Doppellinie links', pad: [8, 0], deco: function (w, h) { return [[6, 0, 6, h]]; } },
    lineR: { label: 'Rechteck, Doppellinie rechts', pad: [8, 0], deco: function (w, h) { return [[w - 6, 0, w - 6, h]]; } },
    process: { label: 'Vordefinierter Prozess', pad: [16, 0], deco: function (w, h) { return [[8, 0, 8, h], [w - 8, 0, w - 8, h]]; } },
    internal: { label: 'Interner Speicher', pad: [8, 6], textDy: 3, deco: function (w, h) { return [[8, 0, 8, h], [0, 8, w, 8]]; } },
    lineT: { label: 'Rechteck, Doppellinie oben', pad: [0, 6], textDy: 3, deco: function (w) { return [[0, 6, w, 6]]; } },
    lineB: { label: 'Rechteck, Doppellinie unten', pad: [0, 6], textDy: -3, deco: function (w, h) { return [[0, h - 6, w, h - 6]]; } },
    lineTB: { label: 'Rechteck, Doppellinie oben und unten', pad: [0, 12], deco: function (w, h) { return [[0, 6, w, 6], [0, h - 6, w, h - 6]]; } },
    barL: { label: 'Rechteck, Balken links', pad: [14, 0], deco: function (w, h) { return [[5, 0, 5, h, 4], [w - 6, 0, w - 6, h]]; } },
    barR: { label: 'Rechteck, Balken rechts', pad: [14, 0], deco: function (w, h) { return [[6, 0, 6, h], [w - 5, 0, w - 5, h, 4]]; } },
    pointL: { label: 'Spitze links', pad: [14, 0], poly: poly(function (w, h) { return [[14, 0], [w, 0], [w, h], [14, h], [0, h / 2]]; }) },
    pointR: { label: 'Spitze rechts', pad: [14, 0], poly: poly(function (w, h) { return [[0, 0], [w - 14, 0], [w, h / 2], [w - 14, h], [0, h]]; }) },
    octRect: { label: 'Rechteck mit abgeschrägten Ecken', pad: [8, 0], poly: poly(function (w, h) { return [[8, 0], [w - 8, 0], [w, 8], [w, h - 8], [w - 8, h], [8, h], [0, h - 8], [0, 8]]; }) },
    cylinderH: { label: 'Zylinder (liegend)', cylinder: true, pad: [24, 0], dio: 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=8;direction=south;' },
    manualInput: { label: 'Manuelle Eingabe (Start/Stop)', pad: [0, S_MI], textDy: S_MI / 2, poly: poly(function (w, h) { return [[0, S_MI], [w, 0], [w, h], [0, h]]; }),
      dio: 'shape=manualInput;size=' + S_MI + ';spacingTop=' + S_MI + ';' },
    manualInputR: { label: 'Manuelle Eingabe (gespiegelt)', pad: [0, S_MI], textDy: S_MI / 2, poly: poly(function (w, h) { return [[0, 0], [w, S_MI], [w, h], [0, h]]; }),
      dio: 'shape=manualInput;size=' + S_MI + ';spacingTop=' + S_MI + ';flipH=1;' },
    arrowR: { label: 'Pfeil rechts', pad: [28, 16], poly: poly(function (w, h) { return [[0, h * 0.2], [w - 18, h * 0.2], [w - 18, 0], [w, h / 2], [w - 18, h], [w - 18, h * 0.8], [0, h * 0.8]]; }), textDx: -6 },
    arrowL: { label: 'Pfeil links', pad: [28, 16], poly: poly(function (w, h) { return [[18, 0], [18, h * 0.2], [w, h * 0.2], [w, h * 0.8], [18, h * 0.8], [18, h], [0, h / 2]]; }), textDx: 6 },
    triUp: { label: 'Dreieck (Spitze oben)', fit: 'triangle', textDy: 1 / 6, poly: poly(function (w, h) { return [[w / 2, 0], [w, h], [0, h]]; }), dio: 'triangle;direction=north;' },
    triDown: { label: 'Dreieck (Spitze unten)', fit: 'triangle', textDy: -1 / 6, poly: poly(function (w, h) { return [[0, 0], [w, 0], [w / 2, h]]; }), dio: 'triangle;direction=south;' },
    triLeft: { label: 'Dreieck (Spitze links)', fit: 'triangle', textDx: 1 / 6, poly: poly(function (w, h) { return [[0, h / 2], [w, 0], [w, h]]; }), dio: 'triangle;direction=west;' },
    triRight: { label: 'Dreieck (Spitze rechts)', fit: 'triangle', textDx: -1 / 6, poly: poly(function (w, h) { return [[0, 0], [w, h / 2], [0, h]]; }), dio: 'triangle;' },
    pentagon: { label: 'Fünfeck', fit: 'compact', textDy: 1 / 20, poly: poly(function (w, h) { return [[w / 2, 0], [w, h * 0.38], [w * 0.81, h], [w * 0.19, h], [0, h * 0.38]]; }) },
    octagon: { label: 'Achteck', fit: 'compact', poly: poly(function (w, h) { return [[w * 0.29, 0], [w * 0.71, 0], [w, h * 0.29], [w, h * 0.71], [w * 0.71, h], [w * 0.29, h], [0, h * 0.71], [0, h * 0.29]]; }) },
    desc: { label: 'Beschreibung', dashed: true },
    none: { label: 'ohne Rahmen', none: true }
  };

  /* Reihenfolge der Palette „All Shapes“ (Abb. 5.3), zeilenweise, 6 je Zeile; 0 = None */
  var NUM = ['none', 'rect', 'diamond', 'ellipse', 'trapezoid', 'parallelogram',
    'parallelogramL', 'hexagonS', 'document', 'tape', 'tape', 'rounded',
    'hexagon', 'delay', 'cardTL', 'cardTR', 'lineL', 'lineR',
    'process', 'internal', 'lineT', 'lineB', 'lineTB', 'barL',
    'barR', 'pointL', 'pointR', 'octRect', 'stadium', 'cylinderH',
    'manualInput', 'manualInputR', 'arrowR', 'arrowL', 'archTop', 'triUp',
    'triDown', 'triLeft', 'triRight', 'pentagon', 'hexagonV', 'octagon'];

  var NAMES = {
    rechteck: 'rect', rectangle: 'rect', rect: 'rect', box: 'rect', prozess: 'rect',
    abgerundet: 'rounded', rounded: 'rounded', roundedrectangle: 'rounded',
    terminator: 'stadium', stadium: 'stadium', startende: 'stadium',
    raute: 'diamond', diamond: 'diamond', rhombus: 'diamond', entscheidung: 'diamond', decision: 'diamond',
    ellipse: 'ellipse', oval: 'ellipse', kreis: 'ellipse', circle: 'ellipse',
    trapez: 'trapezoid', trapezoid: 'trapezoid', wahl: 'trapezoid', choice: 'trapezoid',
    parallelogramm: 'parallelogram', parallelogram: 'parallelogram', daten: 'parallelogram', data: 'parallelogram',
    sechseck: 'hexagon', hexagon: 'hexagon', vorbereitung: 'hexagon', preparation: 'hexagon',
    sechseckflach: 'hexagonS', sechseckstehend: 'hexagonV', hexagonvertical: 'hexagonV',
    dokument: 'document', document: 'document', band: 'tape', tape: 'tape', lochstreifen: 'tape',
    verzoegerung: 'delay', delay: 'delay', karte: 'cardTL', card: 'cardTL',
    vordefinierterprozess: 'process', unterprozess: 'process', predefinedprocess: 'process', subprocess: 'process',
    internerspeicher: 'internal', internalstorage: 'internal',
    zylinder: 'cylinderH', cylinder: 'cylinderH',
    manuelleeingabe: 'manualInput', manualinput: 'manualInput', start: 'manualInput', stop: 'manualInput',
    pfeil: 'arrowR', pfeilrechts: 'arrowR', arrow: 'arrowR', arrowright: 'arrowR', pfeillinks: 'arrowL', arrowleft: 'arrowL',
    dreieck: 'triUp', triangle: 'triUp', dreieckoben: 'triUp', triangleup: 'triUp', dreieckunten: 'triDown', triangledown: 'triDown',
    dreiecklinks: 'triLeft', triangleleft: 'triLeft', dreieckrechts: 'triRight', triangleright: 'triRight',
    fuenfeck: 'pentagon', pentagon: 'pentagon', achteck: 'octagon', octagon: 'octagon',
    ohnerahmen: 'none', none: 'none', keine: 'none'
  };

  var ROLE_KIND = {
    process: 'rect', tree: 'rect', fbCause: 'rect', fbEffect: 'rect', start: 'manualInput', stop: 'manualInput',
    choice: 'trapezoid', 'if': 'diamond', 'case': 'hexagon', loop: 'ellipse', assistant: 'ellipse', desc: 'desc', fbLabel: 'none'
  };

  function r4(n) { return String(Math.round(n * 10000) / 10000); }

  AC.SHAPE_DEFS = K;
  AC.SHAPE_NUMBERS = NUM;
  AC.SHAPE_S = { S_MI: S_MI, D_MO: D_MO, S_HEX: S_HEX };

  /* „3“, „S3“, „Ellipse“, „Sechseck“ … → interner Formname oder null */
  AC.resolveShape = function (v) {
    var s = String(v == null ? '' : v).trim().toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[\s_\-.]+/g, '');
    var m = /^s?(\d+)$/.exec(s);
    if (m) return NUM[+m[1]] || null;
    return NAMES[s] || null;
  };

  AC.shapeKind = function (b) { return (b.role !== 'fbLabel' && b.role !== 'desc' && b.shape) || ROLE_KIND[b.role] || 'rect'; };
  AC.shapeDef = function (b) { return K[AC.shapeKind(b)] || K.rect; };
  AC.shapePoints = function (b) {
    var d = AC.shapeDef(b);
    return d.poly ? d.poly(b.w, b.h) : null;
  };
})(typeof window !== 'undefined' ? (window.AC = window.AC || {}) : (globalThis.AC = globalThis.AC || {}));
