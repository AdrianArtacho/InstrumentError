# [InstrumentError](https://adrianartacho.github.io/InstrumentError/)

A browser quiz for learning instrument ranges and spotting errors in conventional instrumental notation. Read a freshly generated musical example, choose **correct** or **incorrect**, then **Resolve** to see the explanation and one possible correction.

**[Open the quiz →](https://adrianartacho.github.io/InstrumentError/)**

- 23 instrument models: strings, orchestral woodwinds, brass, and four mallet-percussion models.
- Four independently selectable rules: written range, a chord for one ordinary wind player, an attack accent on a tied continuation, and conflicting ordinary arco/pizzicato instructions.
- Properly engraved clefs, notes, accidentals, ties, articulations and dynamics. Transposing instruments use **written pitch**.
- Compact training view: the score, answer buttons and short resolution stay on one screen. Instrument selection and full explanations open in dialogs.
- Range questions sit at the fringes: correct anchors are 0–2 semitones inside a boundary, incorrect anchors 1–2 semitones outside. Supporting notes and corrections stay near the same edge.
- Family and individual-instrument selection, German/English interface, keyboard controls and fullscreen for classroom use.
- 10 points per right answer, accuracy, streaks, ten-question rounds and recent practice history. Current questions and session progress survive a reload in the same browser. New sessions preserve lifetime totals.
- No account or backend. Answers stay in local browser storage. JSON export is available from **Progress**.

The exercise concerns **ordinary playing and conventional notation**, with at most one defined issue in each incorrect question. Model qualifications and explanations distinguish range boundaries from absolute physical impossibility. For example, the tied-accent rule uses the conventional reading of an accent as a new attack; it does not claim that a held note cannot be emphasized. Extended techniques are excluded. Percussion currently means glockenspiel, xylophone, vibraphone and marimba; unpitched percussion is an expansion point.

## Use locally

Serve the repository as static files; no installation or production build is required:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. ES modules need an HTTP server rather than opening `index.html` directly. GitHub Pages serves the repository root. Paths are relative, including the locally bundled notation library and fonts.

Keyboard: **K** = correct, **F** = incorrect, **Enter** = resolve / next. Answers remain changeable until Resolve. Enter then advances to the next example without scrolling. Settings are available through the gear button. There is no timer.

Browser storage is device/browser specific; clearing site data removes saved progress. Private browsing or storage restrictions may prevent saving; the quiz displays a notice and remains usable for the current visit. Recent detail is bounded to 250 questions in the active session and 20 archived session summaries, while lifetime counters are retained. Export is a local backup/report, not an account sync or import feature.

## Development

```sh
npm test
```

For browser checks, append `?preview=1` to the app URL. This uses a separate practice-storage namespace, preserving the normal student session.

The test command uses Node's built-in runner and has no package dependencies. Tests check supported instrument/rule combinations, independent error detection, clean corrections, balanced non-repeating generation, matched near-boundary examples for all 23 models, transpositions, storage recovery, reloads, scoring exactly once and lifetime counters.

- [Instrument models, sources and extension guide](docs/rules.md)
- [Notation renderer and dependency provenance](docs/notation.md)
- [Latest verification and desktop/phone previews](artifacts/verification-2026-11-18.md)
- `src/instruments.js`: named instrument models and written pitch ranges.
- `src/engine.js`: rule registry, generators, independent detectors and explanations.
- `src/notation.js`: responsive SVG engraving with locally vendored VexFlow.
- `src/session.js`: versioned, validated local persistence and scoring.
- `src/app.js` / `src/i18n.js`: interface and translations.

Add new errors as explicit rule generators **and** independent detectors, with a clean correction and tests. This keeps the engine extendable without turning ambiguous or merely difficult writing into a false error.

Concept and development: **Adrián Artacho**. Instrument references: VSL Academy and the linked primary documentation in the rules guide. Music engraving: [VexFlow](https://github.com/vexflow/vexflow), with licenses and font credits in [vendor/](vendor/).

## [ToDo](https://trello.com/c/qWvA7xPH/128-instrumenterror)
