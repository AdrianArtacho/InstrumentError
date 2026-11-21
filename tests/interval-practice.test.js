import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine.js';
import { INSTRUMENTS } from '../src/instruments.js';
import { generateIntervalQuestion } from '../src/interval-practice.js';

const pitchClass = offset => (offset % 12 + 12) % 12;

test('each instrument has exactly one correct offset and only related choices', () => {
  for (const instrument of INSTRUMENTS) {
    const question = generateIntervalQuestion({ instrumentIds: [instrument.id], rng: createRng(43) });
    assert.equal(question.instrumentId, instrument.id);
    assert.equal(question.correctOffset, instrument.transpose);
    const offsets = question.options.map(option => option.offset);
    assert.equal(new Set(offsets).size, offsets.length);
    assert.equal(offsets.filter(offset => offset === instrument.transpose).length, 1);
    const relatedClasses = [pitchClass(instrument.transpose), pitchClass(-instrument.transpose)];
    assert.ok(offsets.every(offset => relatedClasses.includes(pitchClass(offset))), instrument.id);
    for (const language of ['de', 'en']) {
      assert.equal(new Set(question.options.map(option => option.label[language])).size, offsets.length);
    }
  }
});

test('horn and bass clarinet exercise the octave as well as the direction', () => {
  const horn = generateIntervalQuestion({ instrumentIds: ['horn-f'], rng: createRng(3) });
  assert.equal(horn.correctOffset, -7);
  assert.deepEqual(new Set(horn.options.map(option => option.offset)), new Set([-7, -5, 5, 7]));
  assert.match(horn.explanation.de, /Quinte tiefer.*C4.*F3/);

  const bassClarinet = generateIntervalQuestion({ instrumentIds: ['bass-clarinet'], rng: createRng(3) });
  assert.equal(bassClarinet.correctOffset, -14);
  assert.deepEqual(new Set(bassClarinet.options.map(option => option.offset)), new Set([-14, -2, 2, 14]));

  const glockenspiel = generateIntervalQuestion({ instrumentIds: ['glockenspiel'], rng: createRng(3) });
  assert.equal(glockenspiel.correctOffset, 24);
  assert.ok(glockenspiel.options.some(option => option.offset === 12));
  assert.ok(glockenspiel.options.some(option => option.offset === -24));
});

test('mixed practice favors transposing instruments, and explicit filters are respected', () => {
  const rng = createRng(548);
  const allowed = ['trumpet-c', 'trumpet-bb'];
  const rounds = Array.from({ length: 200 }, () => generateIntervalQuestion({ instrumentIds: allowed, rng }));
  assert.ok(rounds.every(round => allowed.includes(round.instrumentId)));
  const transposing = rounds.filter(round => round.correctOffset !== 0).length;
  assert.ok(transposing > 150 && transposing < 200);

  const nonTransposing = generateIntervalQuestion({ instrumentIds: ['trumpet-c'] });
  assert.equal(nonTransposing.correctOffset, 0);
  assert.ok(nonTransposing.options.some(option => option.offset === -12));
  assert.throws(() => generateIntervalQuestion({ instrumentIds: ['missing-instrument'] }), RangeError);
});

test('limited pools cycle to the least recent instrument and shuffle the choices reproducibly', () => {
  const instrumentIds = ['piccolo', 'english-horn', 'clarinet-a'];
  const recentInstrumentIds = ['english-horn', 'piccolo', 'clarinet-a'];
  const generate = seed => generateIntervalQuestion({ instrumentIds, recentInstrumentIds, rng: createRng(seed) });
  assert.equal(generate(5).instrumentId, 'english-horn');
  assert.deepEqual(generate(4), generate(4));
  assert.ok(new Set(Array.from({ length: 12 }, (_, seed) => {
    const question = generate(seed + 1);
    return question.options.findIndex(option => option.offset === question.correctOffset);
  })).size > 1);
});
