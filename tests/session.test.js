import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, defaultState, loadState, saveState, selectAnswer, resolveAnswer, setQuestion, newSession, aggregateStats } from '../src/session.js';

const question = (id = 'q1', answer = 'correct') => ({ id, signature: id, instrumentId: 'violin', clef: 'treble', notes: [{ pitches: [69], duration: 'q', articulation: null }], ties: [], answer, ruleId: answer === 'incorrect' ? 'written-range' : null });
const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const score = (state, id, expected = 'correct', selected = expected) => resolveAnswer(selectAnswer(setQuestion(state, question(id, expected)), selected));

test('unfinished choice and current question survive reload without being scored', () => {
  const storage = memoryStorage();
  let state = setQuestion(defaultState({ instrumentIds: ['violin'], ruleIds: ['written-range'] }), question());
  state = selectAnswer(state, 'incorrect');
  state = selectAnswer(state, 'correct');
  assert.equal(state.active.current.phase, 'chosen');
  assert.equal(aggregateStats(state).answered, 0);
  assert.equal(saveState(state, storage), true);
  const loaded = loadState(storage);
  assert.equal(loaded.status, 'loaded');
  assert.deepEqual(loaded.state, state);
  assert.equal(loaded.state.active.current.choice, 'correct');
});

test('Resolve scores exactly once across duplicate actions and a reload', () => {
  const storage = memoryStorage();
  let state = score(defaultState(), 'q1');
  assert.deepEqual(state.lastResult, { correct: true, points: 10, expected: 'correct', choice: 'correct', questionId: 'q1' });
  assert.equal(resolveAnswer(state), state);
  assert.equal(selectAnswer(state, 'incorrect'), state);
  assert.equal(setQuestion(state, question()), state);
  assert.equal(saveState(state, storage), true);
  state = loadState(storage).state;
  state = resolveAnswer(state);
  assert.equal(aggregateStats(state).points, 10);
  assert.equal(aggregateStats(state).session.answered, 1);
});

test('incorrect answers reset streak, preserve best, and add no points', () => {
  let state = score(defaultState(), '1');
  state = score(state, '2', 'incorrect');
  state = score(state, '3', 'correct', 'incorrect');
  const stats = aggregateStats(state);
  assert.equal(stats.session.answered, 3);
  assert.equal(stats.session.correct, 2);
  assert.equal(stats.session.points, 20);
  assert.equal(stats.session.accuracy, 67);
  assert.equal(stats.session.streak, 0);
  assert.equal(stats.session.bestStreak, 2);
});

test('new sessions preserve lifetime totals and bound archived detail', () => {
  let state = defaultState({ language: 'en' });
  for (let i = 0; i < 25; i++) state = newSession(score(state, String(i)));
  assert.equal(state.history.length, 20);
  assert.equal(aggregateStats(state).sessions, 25);
  assert.equal(aggregateStats(state).answered, 25);
  assert.equal(aggregateStats(state).points, 250);
  assert.equal(aggregateStats(state).session.answered, 0);
  assert.equal(aggregateStats(state).streak, 0);
  assert.equal(state.config.language, 'en');
  assert.equal(newSession(state).history.length, 20);
  assert.equal(newSession(state).lifetime.sessions, 25);
  const storage = memoryStorage();
  assert.equal(saveState(state, storage), true);
  assert.equal(loadState(storage).status, 'loaded');
});

test('round detail is bounded while session and lifetime totals remain complete', () => {
  let state = defaultState();
  for (let i = 0; i < 270; i++) state = score(state, String(i));
  assert.equal(state.active.rounds.length, 250);
  assert.equal(aggregateStats(state).session.answered, 270);
  assert.equal(aggregateStats(state).points, 2700);
  state = newSession(state);
  assert.equal(state.history[0].rounds.length, 10);
  assert.equal(state.history[0].stats.answered, 270);
  assert.equal(aggregateStats(state).answered, 270);
});

test('corrupt JSON, versions, impossible phase, counters and notation are rejected', () => {
  const storage = memoryStorage();
  for (const serialized of ['{', '{}', JSON.stringify({ ...defaultState(), version: 999 })]) {
    storage.setItem(STORAGE_KEY, serialized);
    assert.equal(loadState(storage).status, 'corrupt');
  }
  let state = setQuestion(defaultState(), question());
  state.active.current.phase = 'resolved';
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  assert.equal(loadState(storage).status, 'corrupt');
  state = score(defaultState(), '1');
  state.lifetime.points = 900;
  assert.equal(saveState(state, storage), false);
  state = setQuestion(defaultState(), question());
  state.active.current.question.notes[0].pitches[0] = -100;
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  assert.equal(loadState(storage).status, 'corrupt');
});

test('storage denial and quota exhaustion are nonfatal', () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } };
  assert.equal(loadState(denied).status, 'unavailable');
  assert.equal(loadState(null).status, 'unavailable');
  assert.equal(saveState(defaultState(), denied), false);
  assert.equal(saveState(defaultState(), null), false);
  assert.equal(loadState(memoryStorage()).status, 'empty');
});

test('transitions are immutable and invalid choices cannot score', () => {
  const original = defaultState();
  const current = setQuestion(original, question());
  const selected = selectAnswer(current, 'correct');
  const resolved = resolveAnswer(selected);
  assert.equal(original.active.current, null);
  assert.equal(current.active.current.choice, null);
  assert.equal(selected.active.current.phase, 'chosen');
  assert.equal(resolved.active.current.phase, 'resolved');
  assert.equal(resolveAnswer(current), current);
  assert.equal(selectAnswer(current, 'maybe'), current);
});

test('real generated questions from every instrument survive persistence in all phases', async () => {
  const { INSTRUMENTS } = await import('../src/instruments.js');
  const { createRng, generateQuestion } = await import('../src/engine.js');
  for (const instrument of INSTRUMENTS) {
    for (const answer of ['correct', 'incorrect']) {
      const storage = memoryStorage();
      let state = setQuestion(defaultState(), generateQuestion({ instrumentIds: [instrument.id], answer, rng: createRng(`${instrument.id}-${answer}`) }));
      assert.equal(saveState(state, storage), true, instrument.id);
      state = selectAnswer(loadState(storage).state, answer);
      assert.equal(saveState(state, storage), true, instrument.id);
      state = resolveAnswer(loadState(storage).state);
      assert.equal(saveState(state, storage), true, instrument.id);
      assert.equal(loadState(storage).state.active.current.phase, 'resolved');
      assert.equal(aggregateStats(state).session.points, 10);
    }
  }
});
