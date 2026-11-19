/** Local-only practice progress. No accounts, cookies or network requests. */
export const STORAGE_KEY = 'instrument-error.practice.v1';
export const STATE_VERSION = 1;
const MAX_ROUNDS = 250;
const MAX_HISTORY = 20;
const CHOICES = new Set(['correct', 'incorrect']);
const PHASES = new Set(['answer', 'chosen', 'resolved']);
const clone = value => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const emptyStats = () => ({ answered: 0, correct: 0, points: 0, streak: 0, bestStreak: 0 });
const emptySession = () => ({ id: uid(), startedAt: now(), stats: emptyStats(), rounds: [], current: null });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = value => Number.isInteger(value) && value >= 0 && value <= 1e9;
const isStrings = value => Array.isArray(value) && value.length <= 128 && value.every(item => typeof item === 'string' && item.length <= 100);
const validStats = stats => isObject(stats) && ['answered', 'correct', 'points', 'streak', 'bestStreak'].every(key => isCount(stats[key])) && stats.correct <= stats.answered && stats.points === stats.correct * 10 && stats.streak <= stats.bestStreak && stats.bestStreak <= stats.correct;
const withAccuracy = stats => ({ ...stats, accuracy: stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0 });

export function defaultState(config = {}) {
  return {
    version: STATE_VERSION,
    config: { language: 'de', instrumentIds: [], ruleIds: [], ...config },
    active: emptySession(),
    history: [],
    lifetime: { answered: 0, correct: 0, points: 0, bestStreak: 0, sessions: 0 },
    lastResult: null,
  };
}

const validMidi = pitch => Number.isInteger(pitch) && pitch >= 0 && pitch <= 127;

function validNotes(notes) {
  return Array.isArray(notes) && notes.length >= 1 && notes.length <= 16 && notes.every(note =>
    isObject(note) && Array.isArray(note.pitches) && note.pitches.length >= 1 && note.pitches.length <= 8 &&
    note.pitches.every(validMidi) &&
    ['q', 'h', 'w', '8'].includes(note.duration) &&
    (note.articulation == null || ['accent', 'staccato', 'tenuto'].includes(note.articulation)));
}

function validTies(ties, length) {
  return Array.isArray(ties) && ties.every(tie => isObject(tie) && Number.isInteger(tie.from) && Number.isInteger(tie.to) && tie.from >= 0 && tie.to > tie.from && tie.to < length);
}

/** Reject corrupt stored questions before passing them to the engraver. */
export function validStoredQuestion(question) {
  if (!isObject(question) || typeof question.id !== 'string' || !question.id || question.id.length > 300 || typeof question.instrumentId !== 'string' || !CHOICES.has(question.answer)) return false;
  if (!['treble', 'bass', 'alto', 'tenor', 'percussion'].includes(question.clef) || !validNotes(question.notes) || !validTies(question.ties ?? [], question.notes.length)) return false;
  if (question.corrected != null && (!isObject(question.corrected) || (question.corrected.notes && !validNotes(question.corrected.notes)) || (question.corrected.ties && !validTies(question.corrected.ties, question.corrected.notes?.length ?? question.notes.length)))) return false;
  if (question.scenario === 'transposition' || question.ruleId === 'transposition' || question.soundingPitch != null) {
    if (!validMidi(question.soundingPitch) || !validMidi(question.corrected?.soundingPitch) ||
        question.notes.length !== 1 || question.notes[0].pitches.length !== 1) return false;
  }
  return true;
}

function validRound(round) {
  return isObject(round) && validStoredQuestion(round.question) && CHOICES.has(round.answer) && typeof round.correct === 'boolean' && round.correct === (round.answer === round.question.answer) && typeof round.timestamp === 'string';
}

function validState(state) {
  if (!isObject(state) || state.version !== STATE_VERSION || !isObject(state.config) || !['de', 'en'].includes(state.config.language) || !isStrings(state.config.instrumentIds) || !isStrings(state.config.ruleIds)) return false;
  const active = state.active;
  if (!isObject(active) || typeof active.id !== 'string' || typeof active.startedAt !== 'string' || !validStats(active.stats) || !Array.isArray(active.rounds) || active.rounds.length > MAX_ROUNDS || !active.rounds.every(validRound)) return false;
  if (active.stats.answered < active.rounds.length || active.stats.correct < active.rounds.filter(round => round.correct).length || new Set(active.rounds.map(round => round.question.id)).size !== active.rounds.length) return false;
  if (active.current !== null) {
    const current = active.current;
    if (!isObject(current) || !validStoredQuestion(current.question) || !PHASES.has(current.phase) || (current.choice !== null && !CHOICES.has(current.choice))) return false;
    if (current.phase === 'answer' && current.choice !== null || current.phase !== 'answer' && current.choice === null) return false;
    const prior = active.rounds.find(round => round.question.id === current.question.id);
    if (current.phase === 'resolved' ? !prior || prior.answer !== current.choice : Boolean(prior)) return false;
  }
  if (!Array.isArray(state.history) || state.history.length > MAX_HISTORY || !state.history.every(session => isObject(session) && typeof session.id === 'string' && typeof session.startedAt === 'string' && typeof session.endedAt === 'string' && validStats(session.stats) && Array.isArray(session.rounds) && session.rounds.length <= 10 && session.rounds.every(validRound))) return false;
  const lifetime = state.lifetime;
  if (!isObject(lifetime) || !['answered', 'correct', 'points', 'bestStreak', 'sessions'].every(key => isCount(lifetime[key])) || lifetime.correct > lifetime.answered || lifetime.points !== lifetime.correct * 10 || lifetime.bestStreak > lifetime.correct || lifetime.answered < active.stats.answered || lifetime.correct < active.stats.correct || lifetime.bestStreak < active.stats.bestStreak) return false;
  if (state.lastResult !== null && (!isObject(state.lastResult) || !CHOICES.has(state.lastResult.choice) || !CHOICES.has(state.lastResult.expected) || state.lastResult.correct !== (state.lastResult.choice === state.lastResult.expected) || state.lastResult.points !== (state.lastResult.correct ? 10 : 0) || typeof state.lastResult.questionId !== 'string')) return false;
  return true;
}

function getStorage(storage) {
  // Accessing localStorage itself may throw in a restricted/private iframe.
  try { return storage === undefined ? globalThis.localStorage : storage; } catch { return null; }
}

export function loadState(storage) {
  const target = getStorage(storage);
  if (!target || typeof target.getItem !== 'function') return { state: defaultState(), status: 'unavailable' };
  let serialized;
  try { serialized = target.getItem(STORAGE_KEY); } catch { return { state: defaultState(), status: 'unavailable' }; }
  if (serialized === null) return { state: defaultState(), status: 'empty' };
  try {
    const state = JSON.parse(serialized);
    return validState(state) ? { state, status: 'loaded' } : { state: defaultState(), status: 'corrupt' };
  } catch { return { state: defaultState(), status: 'corrupt' }; }
}

export function saveState(state, storage) {
  const target = getStorage(storage);
  if (!target || typeof target.setItem !== 'function') return false;
  try {
    if (!validState(state)) return false;
    target.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}

/** Choosing is reversible until the answer is resolved. */
export function selectAnswer(state, choice) {
  const current = state.active.current;
  if (!CHOICES.has(choice) || !current || current.phase === 'resolved') return state;
  return { ...state, active: { ...state.active, current: { ...current, choice, phase: 'chosen' } } };
}

/** Score once, on Resolve. Reloading or pressing Resolve twice cannot add points. */
export function resolveAnswer(state) {
  const current = state.active.current;
  if (!current || current.phase !== 'chosen' || !CHOICES.has(current.choice)) return state;
  if (state.active.rounds.some(round => round.question.id === current.question.id)) return state;
  const correct = current.choice === current.question.answer;
  const stats = state.active.stats;
  const streak = correct ? stats.streak + 1 : 0;
  const nextStats = { answered: stats.answered + 1, correct: stats.correct + Number(correct), points: stats.points + (correct ? 10 : 0), streak, bestStreak: Math.max(stats.bestStreak, streak) };
  const round = { question: current.question, answer: current.choice, correct, timestamp: now(), ruleId: current.question.ruleId ?? null };
  return {
    ...state,
    active: { ...state.active, stats: nextStats, rounds: [...state.active.rounds, round].slice(-MAX_ROUNDS), current: { ...current, phase: 'resolved' } },
    lifetime: { ...state.lifetime, answered: state.lifetime.answered + 1, correct: state.lifetime.correct + Number(correct), points: state.lifetime.points + (correct ? 10 : 0), bestStreak: Math.max(state.lifetime.bestStreak, streak) },
    lastResult: { correct, points: correct ? 10 : 0, expected: current.question.answer, choice: current.choice, questionId: current.question.id },
  };
}

/** A configuration change may replace an unresolved question without a penalty. */
export function setQuestion(state, question) {
  if (!validStoredQuestion(question)) throw new TypeError('Invalid quiz question');
  if (state.active.rounds.some(round => round.question.id === question.id)) return state;
  return { ...state, active: { ...state.active, current: { question: clone(question), choice: null, phase: 'answer' } }, lastResult: null };
}

export function newSession(state) {
  const active = state.active;
  const completed = active.stats.answered > 0;
  const summary = { id: active.id, startedAt: active.startedAt, endedAt: now(), stats: { ...active.stats }, rounds: active.rounds.slice(-10) };
  return { ...state, active: emptySession(), history: completed ? [summary, ...state.history].slice(0, MAX_HISTORY) : state.history, lifetime: { ...state.lifetime, sessions: state.lifetime.sessions + Number(completed) }, lastResult: null };
}

export function aggregateStats(state) {
  return {
    ...withAccuracy(state.lifetime),
    streak: state.active.stats.streak,
    sessions: state.lifetime.sessions + Number(state.active.stats.answered > 0),
    session: withAccuracy(state.active.stats),
  };
}
