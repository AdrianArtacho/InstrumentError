# Verification — 17 November 2026

This is a synthetic practice session used to check the first release, not student assessment data.

- 15 automated tests pass with Node's built-in test runner. They cover all supported instrument/rule combinations, independent detection, clean corrections, seeded generation, 1,000-question answer balance/repetition checks, written/sounding transpositions, and persistence/scoring invariants.
- Live GitHub Pages app checked in Chrome at desktop width and a 390 × 844 phone viewport.
- Checked correct and incorrect judgments, all four error types, the resolved highlight and corrected notation, German/English, family and individual-instrument filters, invalid empty selections, and keyboard K/Enter.
- Checked recovery of an unfinished choice after reload, resolved-state recovery without duplicate points, a wrong answer resetting the streak, the ten-question milestone/new-round counter, and starting a fresh session while retaining lifetime history.
- Checked written-versus-sounding range feedback on the explicitly named glockenspiel model.
- Engraving reviewed for treble, alto and bass clefs. Renderer smoke fixtures also cover C8/F0 extremes, chord accidentals, sharp-to-natural cancellation, ties and conflicting technique text.
- The responsive score host releases VexFlow's fixed pixel width, keeping the complete staff within the phone card. Normal examples use a compact canvas; extreme ledger lines expand its vertical bounds.

The browser automation environment did not enter native fullscreen; the app displayed its fallback notice. A Blob-download observation timed out, so the JSON export's download completion was not verified through that automation interface. Core training, scoring and recovery checks completed successfully.

Preview images show resolved examples. Source and font/library provenance are documented in `docs/` and `vendor/`.

[Desktop preview](preview-desktop.jpg) · [Phone preview](preview-mobile.jpg)
