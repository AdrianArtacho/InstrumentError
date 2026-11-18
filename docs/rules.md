# Instrument models and quiz rules

The quiz judges **ordinary conventional writing for the instrument model named on screen**. It is not a proof that a sound is physically impossible. Extended techniques, multiphonics, singing while playing, scordatura, special equipment, pedal-tone demonstrations and unmentioned register extensions are outside the first version's scope. Explanations make this distinction explicit.

A generated example is one 4/4 bar, performed by one player. Every incorrect example has exactly one of the four enabled findings; every correct example has none. The engine independently checks both the shown notation and its suggested correction before returning a question.

## Pitch convention

All `writtenRange` values and generated note pitches are **written MIDI pitches** (C4 = MIDI 60). `transpose` is added to obtain sounding pitch. In German explanations H means B-natural; B♭ is spelled explicitly to avoid confusion with the English B. The violin, viola and cello upper figures below are orientations for stopped notes; the engine never generates an above-the-ceiling range error for bowed strings. Their range errors are below the lowest normally tuned open string.

| Instrument model | Written reference | Sound relative to notation | Basis / model qualification |
| --- | --- | --- | --- |
| Violin | G3–A7 | as written | Ordinary G–D–A–E tuning; no scordatura/harmonics |
| Viola | C3–A6 | as written | Ordinary C–G–D–A tuning; alto clef in this version |
| Cello | C2–A5 | as written | Ordinary C–G–D–A tuning |
| Four-string double bass | E2–G5 | octave lower | No fifth string or low extension |
| Piccolo in C | D4–C7 | octave higher | No special C foot |
| Flute with C foot | C4–C7 | as written | Conservative practice window, no B foot or extreme high register |
| Oboe | B♭3–G6 | as written | Ordinary orchestral reference, specialist high notes excluded |
| English horn in F | B3–E6 | fifth lower | Sounding E3–A5 |
| Clarinet in B♭ | E3–C7 | major second lower | Ordinary model, no basset extension |
| Clarinet in A | E3–C7 | minor third lower | Ordinary model, no basset extension |
| Low-C bass clarinet in B♭ | C3–A6 | major ninth lower | Modern treble-clef notation; sounding B♭1–G5 practice window |
| Bassoon | B♭1–E♭5 | as written | Specialist upper extensions excluded |
| Contrabassoon | B♭1–C5 | octave lower | No low-A extension; German VSL range resolves the English B/B♭ ambiguity |
| Horn in F | F♯2–C6 | fifth lower | Sounding B1–F5 reference; modern notation, no pedals |
| Trumpet in C | F♯3–C6 | as written | No pedal or jazz high-register extensions |
| Trumpet in B♭ | F♯3–C6 | major second lower | Same conventional written frame; no pedal/extreme register |
| Tenor trombone without attachment | E2–F5 | as written | No F attachment or pedals |
| Two-valve bass trombone | B♭0–F5 | as written | Modern model-dependent VSL orientation |
| Bass tuba in F | D1–G4 | as written | VSL model-dependent orientation, not a universal tuba limit |
| Glockenspiel, G–C 2½-octave model | G3–C6 | two octaves higher | Sounding G5–C8; other models differ |
| Xylophone, 3½-octave model | F3–C7 | octave higher | Sounding F4–C8; other models differ |
| Vibraphone, 3-octave model | F3–F6 | as written | Larger models exist and are explicitly excluded |
| Marimba, 4-octave model | C3–C7 | as written | Larger models exist and are explicitly excluded |

The four mallet models provide the first percussion category. Unpitched percussion, timpani changes, rolls, damping and mallet-count constraints need their own event models and rules before they can be added without ambiguous questions.

## Current rules

- **`written-range`:** Both valid and invalid examples sit at a named model's boundary. A correct anchor is exactly on the edge or 1–2 semitones inside it; an incorrect anchor is exactly 1–2 semitones outside it. Supporting notes remain 0–4 semitones inside the same edge, so a wrong answer has exactly one offending note and never a giveaway octave leap. The correction moves only that note back to the chosen near-edge valid pitch. Bowed-string and woodwind questions use the specified lower boundary; brass questions use the specified upper reference; mallet models may use either edge. The boundary, rhythm, dynamics, articulation and supporting notes are selected independently of the answer: identically seeded valid/invalid pairs differ only at the anchor. The flute, clarinets, brass and upper woodwind boundaries remain teaching orientations, not universal technical maxima; a near-boundary brass example is judged against the declared exercise model rather than labelled physically impossible. Fixed-range mallet questions refer to the explicitly named model.
- **`wind-chord`:** A single ordinary wind part contains a simultaneous three-note chord. All three pitches remain within its range, so there is no second range error. Multiphonics and singing while playing are excluded; arbitrary chord notation without such instructions is the issue. A correction may retain one note or distribute the chord among players.
- **`tied-accent`:** A conventional attack accent is placed on the second note of a tied pair. The intended contrast is a sustained continuation versus a new onset. This is **a notation conflict under the quiz's declared reading**, not a blanket claim that a player cannot swell or emphasize a held note. The correction either moves the accent to the first note or removes the tie if a fresh attack is wanted. The displayed alternative uses the former. This rule is not applied to percussion because tied rolls require a different notation model.
- **`technique-conflict`:** A string part requests `arco + pizz.` at the same onset without allocating hands, notes or a sequence. Ordinary right-hand pizzicato conflicts with ordinary bowing at that onset. Left-hand pizzicato combinations are outside scope; this does not prohibit those techniques. The correction chooses one instruction.

A curve between different pitches is deliberately not classified as an erroneous tie: a student could reasonably read it as a slur. Likewise, difficult but possible double stops, awkward leaps, dynamics, breathing, rapid changes of instrument and subjective balance problems are not silently labelled impossible.

## Sources

Primary reference pages, checked 17 November 2026. The factual range/notation data are paraphrased; the exact practice-window choices and quiz rule applications are editorial decisions for this app.

- Vienna Symphonic Library Academy: [violin](https://www.vsl.co.at/academy/strings/violin), [viola](https://www.vsl.co.at/academy/strings/viola), [cello](https://www.vsl.co.at/academy/strings/cello), [double bass](https://www.vsl.co.at/academy/strings/double-bass). These pages distinguish ordinary bowing, right-hand plucking, left-hand pizzicato, scordatura and harmonics.
- VSL Academy: [piccolo](https://www.vsl.co.at/academy/woodwinds/piccolo), [concert flute](https://www.vsl.co.at/academy/woodwinds/concert-flute), [oboe](https://www.vsl.co.at/academy/woodwinds/oboe), [English horn](https://www.vsl.co.at/academy/woodwinds/english-horn), [clarinet](https://www.vsl.co.at/academy/woodwinds/clarinet), [bass clarinet](https://www.vsl.co.at/academy/woodwinds/bass-clarinet), [bassoon](https://www.vsl.co.at/academy/woodwinds/bassoon), [Kontrafagott (German)](https://www.vsl.co.at/de/academy/woodwinds/contrabassoon).
- VSL Academy: [horn in F](https://www.vsl.co.at/academy/brass/horn-f), [trumpet in C](https://www.vsl.co.at/academy/brass/trumpet-c), [tenor trombone](https://www.vsl.co.at/academy/brass/tenor-trombone), [bass trombone](https://www.vsl.co.at/academy/brass/bass-trombone), [bass tuba](https://www.vsl.co.at/academy/brass/bass-tuba).
- VSL Academy: [glockenspiel](https://www.vsl.co.at/academy/percussion/glockenspiel), [xylophone](https://www.vsl.co.at/academy/percussion/xylophone), [vibraphone](https://www.vsl.co.at/academy/percussion/vibraphone), [marimba](https://www.vsl.co.at/academy/percussion/marimba). Sounding ranges are converted into the explicitly stated written notation convention.
- [UNSW Music Acoustics FAQ, “How can you play two notes at a time on a woodwind instrument?”](https://www.phys.unsw.edu.au/jw/musFAQ.html): multiphonics and singing while playing are real extended techniques, which is why the quiz excludes them instead of claiming winds can never make several pitches.
- Steinberg Dorico documentation: [articulations on tie chains](https://www.steinberg.help/r/dorico-pro/6.2/en/dorico/topics/notation_reference/notation_reference_articulations/notation_reference_articulations_position_tied_notes_changing_t.html), [ties versus slurs](https://www.steinberg.help/r/dorico-se/6.2/en/dorico/topics/notation_reference/notation_reference_ties/notation_reference_ties_versus_slurs_c.html). These document the conventional placement of attack accents at the beginning of a tied event; the quiz's broader explanation preserves the distinction between notation and physical sound.

## Extending the engine

The static ES modules have no build dependency. `src/instruments.js` holds the models. `src/engine.js` exposes the rule registry and generators; the UI owns scoring and storage.

1. Add or refine an instrument with **written** MIDI limits, an explicit notation transposition and model qualifications.
2. Add a rule entry with `id`, bilingual `names`/`description` and `supports(instrument)`.
3. Add its scenario preparation if needed, its injector and independent detector.
4. Provide a mergeable clean `corrected` notation object and bilingual explanations. Keep incorrect examples to exactly one finding.
5. Extend `tests/engine.test.js` with representative hand-authored cases and the exhaustive supported instrument/rule sampling.

`generateQuestion({ instrumentIds, familyIds, ruleIds, rng, recentSignatures, recentAnswers, answer })` returns a fully JSON-serializable question. Every outcome includes bilingual single-sentence `feedback` for the compact resolved view. Range questions additionally return `rangeContext: { direction, boundary, anchorIndex, insideDistance, outsideDistance }`, where pitches/boundaries are written MIDI and distances are semitones; their full explanation identifies why a near-edge correct example succeeds, as well as why an incorrect one fails. Omitted filters mean all; explicit empty lists mean none. Instrument IDs intersect the family filter. Instruments unsupported by every selected rule are excluded from **both** answer types, preventing an instrument-based answer clue. `recentAnswers` balances answer counts and caps identical-answer streaks at three; `recentSignatures` prevents repeat visuals. An optional forced `answer` is useful for tests and teacher demonstrations.

`validateQuestion(question)` inspects notation rather than trusting its answer metadata. The generator checks that its own question has the advertised finding count and that merging `question.corrected` produces zero findings. UI code must hide `feedback`, `explanation`, `correction`, `corrected`, `rangeContext` and error highlighting until the student resolves the question.
