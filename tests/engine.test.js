import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTRUMENTS, FAMILIES, getInstrument, noteName } from '../src/instruments.js';
import { RULES, createRng, generateQuestion, getEligibleInstruments, validateQuestion } from '../src/engine.js';

test('written/sounding pitch models include octave and transposing instruments', () => {
  assert.equal(INSTRUMENTS.length, 23);
  assert.equal(new Set(INSTRUMENTS.map((i) => i.id)).size, INSTRUMENTS.length);
  assert.equal(getInstrument('clarinet-bb').transpose, -2);
  assert.equal(getInstrument('english-horn').transpose, -7);
  assert.equal(getInstrument('bass-clarinet').writtenRange[0] + getInstrument('bass-clarinet').transpose, 34); // sounding Bb1
  assert.equal(getInstrument('double-bass').writtenRange[0] + getInstrument('double-bass').transpose, 28); // sounding E1
  assert.equal(getInstrument('piccolo').transpose, 12);
  assert.equal(getInstrument('glockenspiel').transpose, 24);
  assert.equal(getInstrument('xylophone').transpose, 12);
  assert.equal(noteName(59, 'de'), 'H3');
  assert.equal(noteName(59, 'en'), 'B3');
  assert.equal(noteName(58, 'de'), 'B♭3');
});

test('explicit instrument selections intersect families and applicable rules', () => {
  const config = { instrumentIds: ['violin', 'flute'], familyIds: ['strings'], ruleIds: ['written-range'] };
  assert.deepEqual(getEligibleInstruments(config).map((i) => i.id), ['violin']);
  assert.equal(getEligibleInstruments({ ...config, familyIds: ['woodwinds'] })[0].id, 'flute');
  assert.equal(getEligibleInstruments({ instrumentIds: [] }).length, 0);
  assert.equal(getEligibleInstruments({ familyIds: [] }).length, 0);
  assert.equal(getEligibleInstruments({ ruleIds: [] }).length, 0);
  assert.equal(getEligibleInstruments({ instrumentIds: ['violin'], ruleIds: ['wind-chord'] }).length, 0);
  assert.throws(() => generateQuestion({ instrumentIds: [] }), RangeError);
});

test('a seed reproduces question content and identifiers', () => {
  const a = createRng('instrument-error-class-1');
  const b = createRng('instrument-error-class-1');
  for (let i = 0; i < 30; i += 1) assert.deepEqual(generateQuestion({ rng: a }), generateQuestion({ rng: b }));
});

test('detectors inspect notation, not claimed answer metadata', () => {
  const base = { instrumentId: 'flute', notes: [{ pitches: [60], articulation: null }], ties: [], technique: null, answer: 'incorrect', ruleId: 'wind-chord' };
  assert.deepEqual(validateQuestion(base), []);
  assert.deepEqual(validateQuestion({ ...base, notes: [{ pitches: [48], articulation: null }] }).map((f) => f.ruleId), ['written-range']);
  assert.deepEqual(validateQuestion({ ...base, notes: [{ pitches: [60, 64, 67], articulation: null }] }).map((f) => f.ruleId), ['wind-chord']);
  assert.deepEqual(validateQuestion({ ...base, notes: [{ pitches: [60], articulation: null }, { pitches: [60], articulation: 'accent' }], ties: [{ from: 0, to: 1 }] }).map((f) => f.ruleId), ['tied-accent']);
  assert.deepEqual(validateQuestion({ ...base, instrumentId: 'violin', technique: 'arco + pizz.' }).map((f) => f.ruleId), ['technique-conflict']);
});

test('every instrument/rule/answer combination has exactly the advertised finding and a clean correction', () => {
  const rng = createRng(9147);
  for (const instrument of INSTRUMENTS) {
    assert.ok(FAMILIES.some((f) => f.id === instrument.family));
    for (const rule of RULES.filter((r) => r.supports(instrument))) {
      for (const answer of ['correct', 'incorrect']) {
        for (let i = 0; i < 30; i += 1) {
          const question = generateQuestion({ instrumentIds: [instrument.id], ruleIds: [rule.id], answer, rng });
          assert.equal(question.instrumentId, instrument.id);
          assert.equal(question.answer, answer);
          assert.equal(question.notes.reduce((beats, n) => beats + ({ q: 1, h: 2 }[n.duration]), 0), 4);
          const findings = validateQuestion(question);
          assert.equal(findings.length, answer === 'correct' ? 0 : 1, `${instrument.id}/${rule.id}/${answer}`);
          if (answer === 'incorrect') {
            assert.equal(findings[0].ruleId, rule.id);
            assert.ok(question.issueNoteIndices.length > 0);
          }
          assert.deepEqual(validateQuestion({ ...question, ...question.corrected }), []);
          assert.deepEqual(JSON.parse(JSON.stringify(question)), question);
          if (instrument.family === 'strings' && question.ruleId === 'written-range') {
            assert.ok(question.notes.some((note) => note.pitches[0] < instrument.writtenRange[0]));
            assert.ok(question.notes.every((note) => note.pitches[0] <= instrument.writtenRange[1]));
          }
        }
      }
    }
  }
});

test('session generation balances answers, caps streaks and respects the full recent-signature list', () => {
  const rng = createRng('long-session');
  const recentSignatures = [];
  const recentAnswers = [];
  for (let i = 0; i < 1000; i += 1) {
    const question = generateQuestion({ rng, recentSignatures, recentAnswers });
    assert.ok(!recentSignatures.includes(question.signature));
    recentSignatures.push(question.signature);
    recentAnswers.push(question.answer);
    const delta = recentAnswers.filter((answer) => answer === 'correct').length * 2 - recentAnswers.length;
    assert.ok(Math.abs(delta) <= 2);
    const last = recentAnswers.slice(-4);
    assert.ok(last.length < 4 || !last.every((answer) => answer === last[0]));
  }
});

test('range fringes are matched near-edge examples for both outcomes across all 23 models', () => {
  for (const instrument of INSTRUMENTS) {
    const seenDirections = new Set();
    const seenInsideDistances = new Set();
    const seenOutsideDistances = new Set();
    const seenAnchorPositions = new Set();
    for (let seed = 0; seed < 180; seed += 1) {
      const config = { instrumentIds: [instrument.id], ruleIds: ['written-range'] };
      const correct = generateQuestion({ ...config, answer: 'correct', rng: createRng(seed) });
      const incorrect = generateQuestion({ ...config, answer: 'incorrect', rng: createRng(seed) });
      const { direction, boundary, anchorIndex, insideDistance, outsideDistance } = correct.rangeContext;
      const inward = direction === 'low' ? 1 : -1;
      seenDirections.add(direction);
      seenInsideDistances.add(insideDistance);
      seenOutsideDistances.add(outsideDistance);
      seenAnchorPositions.add(anchorIndex);
      assert.deepEqual(incorrect.rangeContext, correct.rangeContext);
      assert.equal(boundary, instrument.writtenRange[direction === 'low' ? 0 : 1]);
      assert.equal((correct.notes[anchorIndex].pitches[0] - boundary) * inward + 0, insideDistance);
      assert.equal((incorrect.notes[anchorIndex].pitches[0] - boundary) * inward, -outsideDistance);
      assert.ok(insideDistance >= 0 && insideDistance <= 2);
      assert.ok(outsideDistance === 1 || outsideDistance === 2);
      assert.deepEqual(incorrect.issueNoteIndices, [anchorIndex]);
      assert.deepEqual(correct.issueNoteIndices, []);
      assert.deepEqual(incorrect.corrected, correct.corrected);
      assert.deepEqual(incorrect.corrected.notes, correct.notes);
      assert.equal(correct.dynamic, incorrect.dynamic);
      assert.equal(correct.technique, incorrect.technique);
      assert.deepEqual(correct.ties, incorrect.ties);
      for (let i = 0; i < correct.notes.length; i += 1) {
        assert.equal(correct.notes[i].duration, incorrect.notes[i].duration);
        assert.equal(correct.notes[i].articulation, incorrect.notes[i].articulation);
        if (i !== anchorIndex) {
          assert.deepEqual(correct.notes[i], incorrect.notes[i]);
          const supportDistance = (correct.notes[i].pitches[0] - boundary) * inward;
          assert.ok(supportDistance >= 0 && supportDistance <= 4);
        }
      }
      for (const question of [correct, incorrect]) {
        const pitches = question.notes.flatMap((note) => note.pitches);
        assert.ok(Math.max(...pitches) - Math.min(...pitches) <= 6, `${instrument.id}: no giveaway register leap`);
        assert.ok(question.feedback.de.includes(noteName(question.notes[anchorIndex].pitches[0], 'de')));
        assert.ok(question.feedback.en.includes(noteName(question.notes[anchorIndex].pitches[0], 'en')));
        assert.ok(question.feedback.de.includes(noteName(boundary, 'de')));
        assert.ok(question.feedback.en.includes(noteName(boundary, 'en')));
      }
      assert.match(correct.explanation.en, /edge-of-range example is valid/);
      assert.deepEqual(validateQuestion(correct), []);
      assert.deepEqual(validateQuestion(incorrect).map((finding) => finding.ruleId), ['written-range']);
      assert.deepEqual(validateQuestion({ ...incorrect, ...incorrect.corrected }), []);
    }
    assert.deepEqual(seenInsideDistances, new Set([0, 1, 2]), instrument.id);
    assert.deepEqual(seenOutsideDistances, new Set([1, 2]), instrument.id);
    assert.deepEqual(seenAnchorPositions, new Set([0, 1, 2]), instrument.id);
    assert.deepEqual(seenDirections, new Set(instrument.rangeErrorDirection ? [instrument.rangeErrorDirection] : ['low', 'high']), instrument.id);
  }
});

test('fringe-only sessions retain balanced answers and avoid repeated visuals', () => {
  const rng = createRng('near-edge-session');
  const recentSignatures = [];
  const recentAnswers = [];
  const seen = new Set();
  for (let i = 0; i < 1000; i += 1) {
    const question = generateQuestion({ ruleIds: ['written-range'], rng, recentSignatures, recentAnswers });
    assert.ok(!seen.has(question.signature));
    seen.add(question.signature);
    recentSignatures.push(question.signature);
    recentAnswers.push(question.answer);
    assert.ok(Math.abs(recentAnswers.filter((answer) => answer === 'correct').length * 2 - recentAnswers.length) <= 2);
    const last = recentAnswers.slice(-4);
    assert.ok(last.length < 4 || !last.every((answer) => answer === last[0]));
  }
});
