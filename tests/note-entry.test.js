import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTRUMENTS } from '../src/instruments.js';
import {
  ENTRY_DIRECTIONS, createRng, entryPitch, entryStaffBounds, formatEntryKey,
  generateEntryQuestion, gradeEntryAnswer, parseEntryKey,
} from '../src/engine.js';

const [forward, reverse] = ENTRY_DIRECTIONS;

test('both directions preserve the instrument interval and enharmonic spelling', () => {
  const fixture = new Map([
    ['clarinet-bb', ['c/4', 'bb/3']],
    ['clarinet-a', ['c#/4', 'a#/3']],
    ['horn-f', ['f#/4', 'b/3']],
    ['bass-clarinet', ['c/4', 'bb/2']],
    ['piccolo', ['d/4', 'd/5']],
    ['glockenspiel', ['g/3', 'g/5']],
    ['double-bass', ['g/3', 'g/2']],
    ['viola', ['b/3', 'b/3']],
  ]);
  const letterSteps = { '-14': -8, '-12': -7, '-7': -4, '-3': -2, '-2': -1, 0: 0, 12: 7, 24: 14 };
  for (const model of INSTRUMENTS.filter(instrument => instrument.pitched)) {
    const a = createRng(2016);
    const b = createRng(2016);
    const recentForward = [];
    const recentReverse = [];
    const spellings = new Set();
    const clefsByDirection = new Set();
    let fixtureSeen = !fixture.has(model.id);
    for (;;) {
      const config = { instrumentIds: [model.id] };
      const write = generateEntryQuestion({ ...config, direction: forward, rng: a, recentSignatures: recentForward });
      const hear = generateEntryQuestion({ ...config, direction: reverse, rng: b, recentSignatures: recentReverse });
      assert.deepEqual(hear.given, write.expected, model.id);
      assert.deepEqual(hear.expected, write.given, model.id);
      if (recentForward.includes(write.signature)) break;
      assert.ok(!recentReverse.includes(hear.signature));
      recentForward.push(write.signature);
      recentReverse.push(hear.signature);
      const [low, high] = model.writtenRange;
      assert.ok(write.given.midi >= low && write.given.midi <= high, model.id);
      assert.equal(write.expected.midi, write.given.midi + model.transpose, model.id);
      assert.equal(write.given.clef, model.clef, model.id);
      const written = parseEntryKey(write.given.key);
      const sounding = parseEntryKey(write.expected.key);
      assert.equal(sounding.step - written.step, letterSteps[model.transpose], model.id);
      for (const [note, position] of [[write.given, written], [write.expected, sounding]]) {
        const { minStep, maxStep } = entryStaffBounds(note.clef);
        assert.ok(position.step >= minStep + 2 && position.step <= maxStep - 2, model.id);
        assert.ok(Math.abs(position.accidental) <= 1, model.id);
        assert.equal(entryPitch(position.step, position.accidental).midi, note.midi);
      }
      assert.equal(gradeEntryAnswer(write, sounding), 'correct');
      assert.equal(gradeEntryAnswer(hear, written), 'correct');
      assert.deepEqual(JSON.parse(JSON.stringify(write)), write);
      const [given, expected] = fixture.get(model.id) ?? [];
      if (write.given.key === given && write.expected.key === expected) fixtureSeen = true;
      spellings.add(written.accidental);
      clefsByDirection.add(`${write.given.clef}:${write.expected.clef}`);
    }
    assert.ok(fixtureSeen, `expected example for ${model.id}`);
    assert.equal(clefsByDirection.size, 1, model.id);
    assert.equal(spellings.size, 3, model.id);
  }
});

test('grading distinguishes an enharmonic answer from an incorrect octave', () => {
  const question = { expected: { key: 'bb/4', midi: 70 } };
  assert.equal(gradeEntryAnswer(question, parseEntryKey('bb/4')), 'correct');
  assert.equal(gradeEntryAnswer(question, parseEntryKey('a#/4')), 'enharmonic');
  assert.equal(gradeEntryAnswer(question, parseEntryKey('bb/3')), 'incorrect');
  assert.equal(gradeEntryAnswer(question, null), 'incorrect');
  assert.equal(gradeEntryAnswer(question, { step: 34, accidental: 3 }), 'incorrect');
  assert.equal(formatEntryKey('b/4'), 'H4');
  assert.equal(formatEntryKey('bb/4'), 'B♭4');
  assert.equal(formatEntryKey('a#/4', 'en'), 'A♯4');
});

test('practice can continue when the selected instrument has exhausted its pool', () => {
  const recentSignatures = [];
  const rng = createRng('repeat-note-entry');
  const seenIds = new Set();
  const config = { instrumentIds: ['glockenspiel'], direction: forward, rng, recentSignatures };
  for (let i = 0; i < 60; i++) {
    const question = generateEntryQuestion(config);
    assert.ok(!seenIds.has(question.id));
    seenIds.add(question.id);
    recentSignatures.push(question.signature);
  }
  assert.ok(new Set(recentSignatures).size < seenIds.size, 'the finite pool was exercised');
  assert.throws(() => generateEntryQuestion({ ...config, instrumentIds: [] }), RangeError);
});
