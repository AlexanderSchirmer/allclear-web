# allClear Web

Statische Web-App, die allCLEAR-Textdateien wieder als Diagramme darstellt und neue Diagramme im selben Format erstellt.
Sie kommt ohne Server-Logik, Build-Schritt oder externe Bibliotheken aus.

**Direkt nutzen:** https://alexanderschirmer.github.io/allclear-web/

## Bereitstellung

Diese Dateien auf einen beliebigen statischen Webserver kopieren:

```
index.html
css/
js/
examples/   (optional – für das Menü „Beispiele…“)
```

`index.html` kann auch per Doppelklick lokal geöffnet werden. Dann blockiert der Browser nur das Nachladen der
Beispiele über das Menü; sie lassen sich weiterhin über „Öffnen…“ aus dem Ordner `examples` laden.

Lokal testen:

```bash
python -m http.server 8765
```

## Funktionen

- Live-Editor mit Syntax-Hervorhebung, Zeilennummern, Tab/Umschalt+Tab-Einrückung und automatischer Einrückung nach `?`, `:`, `\`
- Öffnen über Dateidialog oder Drag & Drop; UTF-8 und ANSI (Windows-1252) werden erkannt und beim Speichern beibehalten
- Anzeige als SVG; Klick auf eine Box springt zur Zeile, der Cursor im Editor markiert die Box
- Export als `.drawio.svg`: ein normales SVG mit eingebettetem draw.io-Modell (alle Ebenen als Seiten), in draw.io voll bearbeitbar
- Druck auf A4: jede Ebene auf eine Seite skaliert, Hoch-/Querformat automatisch, keine Vergrößerung kleiner Diagramme
- Unterstützt: IF (`?`), CASE (`:`), Bäume (`\`), Assistenz (`&`), Stop (`!`), Linientexte `( )`, Textbereiche (`;`), Kommentare `{ }`,
  `[HEAD] [FLOW] [TREE] [FISHBONE] [LOOP] [UNTIL] [GOTO] [LABEL] [GOTOLOGIC] [LINKTO] [LINK] [DESCRIPTION] [LINETEXT] [BYLINE]`
- `[SHAPE]`, `[COLOR]`, `[BEGIN]`, `[END]` werden akzeptiert, haben aber keine Wirkung (Schwarz-Weiß)

Die Kurzreferenz der Syntax steht in der App unter „Syntax-Hilfe“.

## Annahmen zur Syntax

Die allCLEAR-Dokumentation lässt einige Punkte offen. allClear Web verhält sich dort so:

- Jede Zeile ist eine Box. Zeilen werden nur über `;` (nächster Textbereich) zusammengefasst.
- Einrückung mit Tabs oder Leerzeichen; die Ebenen ergeben sich aus der Einrückungstiefe.
- Ebenen: allCLEAR speicherte Ebenen nicht im Textformat. Hier beginnt `[LAYER=Nr, Name]` eine neue Ebene (Erweiterung).
- Eine Zeile direkt nach `[UNTIL]` (z. B. `(Ja)Weiter.`) beschriftet den Schleifenausgang und beginnt keinen neuen Zweig.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `js/parser.js` | Text → Strukturmodell (Ebenen, Abläufe, Cluster, Bäume) |
| `js/layout.js` | Strukturmodell → Koordinaten (ein Layout für alle Ausgaben) |
| `js/render.js` | Koordinaten → SVG bzw. draw.io-Modell (mxfile) |
| `js/editor.js` | Texteditor mit Hervorhebung |
| `js/app.js` | Oberfläche, Dateien, Export, Druck |
