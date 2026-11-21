import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestion, createRng, RULES } from '../src/engine.js';
import { getInstrument, INSTRUMENTS } from '../src/instruments.js';
import { notationDescription } from '../src/notation.js';
import { notationForPitchView } from '../src/pitch-view.js';

test('written view and non-transposing instruments preserve notation', () => {
  const part = { clef: 'alto', notes: [{ pitches: [60] }] };
  assert.equal(notationForPitchView(part, getInstrument('horn-f'), 'written'), part);
  assert.equal(notationForPitchView(part, getInstrument('viola'), 'sounding'), part);
});

test('sounding view spells a downward major second and preserves chords, ties, and marks', () => {
  const part = {
    clef: 'treble',
    notes: [
      { pitches: [68, 72], midi: 68, duration: 'h', articulation: 'accent' },
      { pitches: [68, 72], midi: 68, duration: 'h' },
    ],
    ties: [{ from: 0, to: 1 }],
    issueNoteIndices: [0],
    dynamic: 'f',
  };
  const original = structuredClone(part);
  const view = notationForPitchView(part, getInstrument('clarinet-bb'), 'sounding');
  assert.deepEqual(view.notes.map(note => note.pitches), [[66, 70], [66, 70]]);
  assert.deepEqual(view.notes[0].pitchKeys, ['gb/4', 'bb/4']);
  assert.equal(view.notes[0].midi, 66);
  assert.equal(view.notes[0].duration, 'h');
  assert.equal(view.notes[0].articulation, 'accent');
  assert.deepEqual(view.ties, part.ties);
  assert.deepEqual(view.issueNoteIndices, [0]);
  assert.equal(view.dynamic, 'f');
  assert.match(notationDescription(view, 'de'), /G♭4 und B♭4/);
  assert.deepEqual(part, original);
});

test('range errors transpose too and the correction remains a separate notation payload', () => {
  const part = {
    clef: 'treble',
    notes: [{ pitches: [46] }], // Below the selected bass clarinet's written C3.
    corrected: { notes: [{ pitches: [48] }], ties: [], technique: 'arco' },
  };
  const view = notationForPitchView(part, getInstrument('bass-clarinet'), 'sounding', true);
  assert.equal(view.clef, 'bass');
  assert.deepEqual(view.notes[0].pitches, [32]);
  assert.deepEqual(view.corrected.notes[0].pitches, [34]);
  assert.equal(view.corrected.technique, 'arco');
  assert.match(notationDescription(view, 'en', true), /bass clef.*B♭1/);
});

test('concert view shows true sounding pitch without changing the proposed answer', () => {
  const part = {
    clef: 'treble',
    notes: [{ pitches: [74] }],
    soundingPitch: 74, // An intentionally wrong untransposed proposal.
    corrected: { notes: [{ pitches: [74] }], soundingPitch: 86 },
  };
  const view = notationForPitchView(part, getInstrument('piccolo'), 'sounding');
  assert.equal(view.notes[0].pitches[0], 86);
  assert.equal(view.notes[0].pitchKeys[0], 'd/6');
  assert.equal(view.soundingPitch, 74);
  assert.equal(view.corrected.soundingPitch, 86);
});

test('all generated models and exercise types remain in the engravable MIDI range', () => {
  const rng = createRng(20261121);
  for (const instrument of INSTRUMENTS) {
    for (const rule of RULES.filter(rule => rule.supports(instrument))) {
      for (const answer of ['correct', 'incorrect']) {
        for (let i = 0; i < 20; i++) {
          const question = generateQuestion({ instrumentIds: [instrument.id], ruleIds: [rule.id], answer, rng });
          const view = notationForPitchView(question, instrument, 'sounding', i % 2 === 0);
          for (const note of [...view.notes, ...(view.corrected?.notes ?? [])]) {
            assert.ok(note.pitches.every(pitch => Number.isInteger(pitch) && pitch >= 0 && pitch <= 127),
              `${instrument.id} ${rule.id}: ${note.pitches}`);
            if (instrument.transpose) {
              for (const [index, key] of note.pitchKeys.entries()) {
                const [noteName, octave] = key.split('/');
                const natural = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[noteName[0]];
                const shift = [...noteName.slice(1)].reduce((sum, char) => sum + (char === '#' ? 1 : -1), 0);
                assert.equal((Number(octave) + 1) * 12 + natural + shift, note.pitches[index]);
              }
            }
          }
        }
      }
    }
  }
});
