# Music engraving

The quiz uses the locally vendored **VexFlow 5.2.0 Bravura build**. It includes Bravura and Academico font data, so engraving makes no CDN or remote font requests. The browser waits for those embedded fonts before displaying a question. The app has no production dependency installation or build step.

Load `vendor/vexflow.js` before the module entry point. Then import:

```js
import { renderScore, notationDescription } from './src/notation.js';
await renderScore(container, question, { language: 'de' });
await renderScore(container, question, { reveal: true, language: 'de' });
await renderScore(container, question, { corrected: true, language: 'de' });
await renderScore(container, question, { fit: true, language: 'de' });
```

`renderScore` accepts the engine's serialized question schema. Notes contain written MIDI pitches, quarter/half-note durations and optional accent/staccato marks. Clefs, explicit accidentals, dynamic glyphs, technique annotations, chords and equal-pitch ties are engraved as SVG. All snippets deliberately omit a time signature: they are isolated examples of instrumental writing rather than incomplete measures in a specified meter. The main app labels the instrument and clarifies written versus sounding pitch.

The SVG uses a responsive `viewBox`, expanding its vertical extent when extreme ledger lines require more room. A text equivalent of the **visible notation only** is attached as an accessible label. It does not expose the answer before resolution. Error notes are highlighted only for a resolved original; a corrected example uses green notation. `issueNoteIndices` in the question specifies the notes to highlight.

For a bounded classroom or phone layout, pass `fit: true` and give the container its available height in CSS (`min-height: 0` for a shrinking grid child). The SVG fills that width and height with `preserveAspectRatio="xMidYMid meet"`; it scales all notation into the available space without scrolling or stretching. VexFlow's inline host dimensions are removed. Hosts narrower than 560px use a 440-unit logical canvas to keep notes readable; wider hosts use 650 units. The caller should render again after a resize or device rotation. Omitting `fit` preserves the standalone, width-responsive SVG with automatic height and a 900px maximum width.

The unchanged bundle comes from `vexflow@5.2.0/build/cjs/vexflow-bravura.js`, renamed to `vendor/vexflow.js`. Its SHA-256 is recorded in `vendor/README.md`. VexFlow's MIT license and the fonts' SIL Open Font Licenses are included alongside the bundle.

Primary documentation consulted:

- [VexFlow getting started](https://vexflow.github.io/vexflow-examples/guides/getting-started/)
- [VexFlow tutorial: notes, voices and modifiers](https://vexflow.github.io/vexflow-examples/guides/tutorial/)
- [VexFlow source and releases](https://github.com/vexflow/vexflow)
- [VexFlow font packages](https://github.com/vexflow/vexflow-fonts)

Smoke-check a written-range example (especially a low double-bass note and a high piccolo note), a wind chord, an accented tied continuation and a conflicting technique annotation, then switch to the corrected examples. Verify all clefs at desktop/projector width and a narrow phone viewport. A reload should show music immediately after the local fonts load.
