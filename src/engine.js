import { INSTRUMENTS, getInstrument, noteName } from './instruments.js';

/** Rules are independent: add a generator and detector to extend the quiz. */
export const RULES = [
  {
    id: 'written-range', names: { de: 'Tonumfang', en: 'Instrument range' },
    description: { de: 'Notierte Tonhöhe außerhalb des angegebenen Instrumentenmodells.', en: 'A written pitch outside the specified instrument model.' },
    supports: (instrument) => instrument.pitched && Array.isArray(instrument.writtenRange),
  },
  {
    id: 'wind-chord', names: { de: 'Akkord für einen Bläser', en: 'Chord for one wind player' },
    description: { de: 'Mehrere normale Töne gleichzeitig in einer einzelnen Bläserstimme.', en: 'Several ordinary pitches at once in one wind part.' },
    supports: (instrument) => instrument.monophonic,
  },
  {
    id: 'tied-accent', names: { de: 'Akzent nach Haltebogen', en: 'Accent after a tie' },
    description: { de: 'Ein neuer Anschlagsakzent auf der Fortsetzung eines gehaltenen Tons.', en: 'A new attack accent on the continuation of a tied note.' },
    supports: (instrument) => instrument.pitched && instrument.family !== 'percussion',
  },
  {
    id: 'technique-conflict', names: { de: 'Widersprüchliche Spielweisen', en: 'Conflicting techniques' },
    description: { de: 'Arco und gewöhnliches Pizzicato für denselben Einsatz.', en: 'Arco and ordinary pizzicato for the same attack.' },
    supports: (instrument) => instrument.family === 'strings',
  },
];
export const getRule = (id) => RULES.find((rule) => rule.id === id);

/** Small serializable/reproducible PRNG; accepts numbers or text seeds. */
export function createRng(seed) {
  let value = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pick = (values, rng) => values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
const integer = (min, max, rng) => min + Math.floor(rng() * (max - min + 1));
const clone = (value) => JSON.parse(JSON.stringify(value));
const activeRules = (config) => config.ruleIds === undefined ? RULES : RULES.filter((rule) => config.ruleIds.includes(rule.id));

/** Empty explicit selections mean empty; omitted filters mean all.
 * Instruments without any selected applicable rule are excluded for BOTH answer
 * types, so the chosen instrument can never itself reveal a correct answer.
 */
export function getEligibleInstruments(config = {}) {
  const rules = activeRules(config);
  return INSTRUMENTS.filter((instrument) =>
    (config.instrumentIds === undefined || config.instrumentIds.includes(instrument.id)) &&
    (config.familyIds === undefined || config.familyIds.includes(instrument.family)) &&
    rules.some((rule) => rule.supports(instrument)));
}

function playablePitches(instrument) {
  // Keep routine examples readable. Written ranges and generated error notes are
  // independent of this comfortable working window.
  const window = { treble: [60, 81], alto: [48, 72], bass: [36, 60] }[instrument.clef] || [60, 81];
  const [low, high] = instrument.writtenRange;
  const start = Math.max(low, window[0]);
  const stop = Math.min(high, window[1]);
  const pitches = [];
  for (let midi = start; midi <= stop; midi += 1) {
    if ([0, 2, 4, 5, 7, 9, 11].includes(midi % 12)) pitches.push(midi);
  }
  return pitches;
}
const makeNote = (midi, duration = 'q', articulation = null) => ({ pitches: [midi], midi, duration, articulation });
function setPitches(note, pitches) { note.pitches = pitches; note.midi = pitches[0]; }
function baseQuestion(instrument, rng) {
  const choices = playablePitches(instrument);
  const center = integer(1, Math.max(1, choices.length - 3), rng);
  const melodic = [center, center + pick([-1, 0, 1], rng), center + pick([-1, 0, 1, 2], rng)];
  const notes = melodic.map((index, i) => makeNote(choices[Math.max(0, Math.min(choices.length - 1, index))], i === 2 ? 'h' : 'q'));
  const dynamic = pick(['p', 'mf', 'f'], rng);
  return {
    instrumentId: instrument.id, clef: instrument.clef,
    notes, ties: [], technique: instrument.family === 'strings' ? pick(['arco', 'pizz.'], rng) : null,
    dynamic, dynamics: dynamic, timeSignature: '4/4', issueNoteIndices: [],
  };
}
function prepareScenario(question, rule, instrument, rng) {
  if (rule.id === 'tied-accent') {
    const pitch = question.notes[0].pitches[0];
    question.notes = [makeNote(pitch), makeNote(pitch), makeNote(question.notes[1].pitches[0]), makeNote(question.notes[2].pitches[0])];
    question.ties = [{ from: 0, to: 1 }];
    if (instrument.family === 'strings') question.technique = 'arco';
    question.notes[pick([0, 2, 3], rng)].articulation = 'accent';
  } else {
    const articulationIndex = integer(0, question.notes.length - 1, rng);
    if (rng() < 0.65) question.notes[articulationIndex].articulation = pick(['accent', 'staccato'], rng);
  }
}

function injectRange(question, instrument, rng) {
  const [low, high] = instrument.writtenRange;
  const direction = instrument.rangeErrorDirection || pick(['low', 'high'], rng);
  const distance = instrument.family === 'brass' ? integer(12, 16, rng) : integer(3, 7, rng);
  const pitch = direction === 'low' ? low - distance : high + distance;
  const index = integer(0, question.notes.length - 1, rng);
  setPitches(question.notes[index], [pitch]);
  question.issueNoteIndices = [index];
  const reference = { de: `${noteName(low, 'de')}–${noteName(high, 'de')}`, en: `${noteName(low, 'en')}–${noteName(high, 'en')}` };
  return {
    explanation: {
      de: `${noteName(pitch, 'de')} liegt außerhalb des hier angegebenen notierten Umfangs (${reference.de}). ${instrument.rangeNotes.de} Die Grenzen sind ein Übungsmodell, keine universellen technischen Maxima.`,
      en: `${noteName(pitch, 'en')} lies outside this model's written range (${reference.en}). ${instrument.rangeNotes.en} These are teaching boundaries, not universal technical maxima.`,
    },
    correction: {
      de: `Den markierten Ton in den notierten Modellumfang ${reference.de} legen. Die alternative Fassung zeigt eine mögliche Lösung.`,
      en: `Move the highlighted pitch into the model's written range ${reference.en}. The alternative shows one possible solution.`,
    },
  };
}
function injectWindChord(question, instrument, rng) {
  const [low, high] = instrument.writtenRange;
  const index = integer(0, question.notes.length - 1, rng);
  const root = Math.max(low, Math.min(high - 7, question.notes[index].pitches[0]));
  setPitches(question.notes[index], [root, root + 4, root + 7]);
  question.issueNoteIndices = [index];
  return {
    explanation: {
      de: 'Hier ist ein einzelner Bläser mit gewöhnlicher Tonerzeugung gemeint. Drei gleichzeitig ausnotierte normale Töne ergeben dafür keinen regulären Akkord. Multiphonics, Mitsingen und andere erweiterte Techniken sind in dieser Runde ausgeschlossen.',
      en: 'This is one wind player using ordinary tone production. Three simultaneous ordinary written pitches do not form a regular playable chord for that player. Multiphonics, singing while playing and other extended techniques are excluded in this round.',
    },
    correction: {
      de: 'Einen Ton behalten, die übrigen Töne nacheinander schreiben oder auf mehrere Spielende verteilen. Die alternative Fassung behält einen Ton.',
      en: 'Keep one pitch, write the pitches successively, or distribute them among several players. The alternative keeps one pitch.',
    },
  };
}
function injectTiedAccent(question) {
  question.notes.forEach((note) => { note.articulation = null; });
  question.notes[1].articulation = 'accent';
  question.issueNoteIndices = [1];
  return {
    explanation: {
      de: 'Der Haltebogen verbindet beide Noten zu einem Ton ohne neuen Ansatz. Der Anschlagsakzent auf der zweiten Note verlangt in dieser konventionellen Lesart einen neuen Einsatz. Das ist ein Notationswiderspruch, keine allgemeine Aussage über die Möglichkeit dynamischer Betonungen im gehaltenen Ton.',
      en: 'The tie joins both notes into one sustained event without a new attack. In this conventional reading, the attack accent on the second note asks for a new onset. This is a notation conflict, not a general claim that a sustained sound cannot be dynamically emphasized.',
    },
    correction: {
      de: 'Den Akzent auf den ersten Einsatz verschieben. Soll die zweite Note neu angespielt werden, stattdessen den Haltebogen entfernen.',
      en: 'Move the accent to the first attack. If a new attack on the second note is intended, remove the tie instead.',
    },
  };
}
function injectTechnique(question) {
  question.technique = 'arco + pizz.';
  question.issueNoteIndices = [0];
  return {
    explanation: {
      de: 'Für denselben Einsatz stehen gleichzeitig arco (mit dem Bogen) und gewöhnliches Pizzicato (mit der rechten Hand zupfen). Ohne nähere Aufteilung widersprechen sich diese Anweisungen. Besondere Kombinationen mit linkem-Hand-Pizzicato sind ausdrücklich nicht gemeint.',
      en: 'Arco (bowing) and ordinary right-hand pizzicato are requested at the same onset. Without a more specific allocation these instructions conflict. Special combinations involving left-hand pizzicato are expressly excluded.',
    },
    correction: {
      de: 'Für diesen Einsatz eine Spielweise wählen. Die alternative Fassung verwendet arco; ein späterer Wechsel braucht eine eigene Anweisung.',
      en: 'Choose one technique for this onset. The alternative uses arco; a later change needs its own instruction.',
    },
  };
}
const injectors = { 'written-range': injectRange, 'wind-chord': injectWindChord, 'tied-accent': injectTiedAccent, 'technique-conflict': injectTechnique };

/** Independent detectors; metadata such as answer/ruleId is never trusted. */
export function validateQuestion(question) {
  const instrument = getInstrument(question.instrumentId);
  if (!instrument) return [{ ruleId: 'unknown-instrument', issueNoteIndices: [] }];
  const findings = [];
  const [low, high] = instrument.writtenRange;
  const outside = question.notes.flatMap((note, i) => note.pitches.some((pitch) => pitch < low || pitch > high) ? [i] : []);
  if (outside.length) findings.push({ ruleId: 'written-range', issueNoteIndices: outside });
  const chords = question.notes.flatMap((note, i) => note.pitches.length > 1 ? [i] : []);
  if (instrument.monophonic && chords.length) findings.push({ ruleId: 'wind-chord', issueNoteIndices: chords });
  const accents = (question.ties || []).flatMap((tie) => question.notes[tie.to]?.articulation === 'accent' ? [tie.to] : []);
  if (accents.length) findings.push({ ruleId: 'tied-accent', issueNoteIndices: [...new Set(accents)] });
  if (instrument.family === 'strings' && question.technique === 'arco + pizz.') findings.push({ ruleId: 'technique-conflict', issueNoteIndices: [0] });
  return findings;
}
function signature(question) {
  return JSON.stringify({ instrumentId: question.instrumentId, clef: question.clef, notes: question.notes, ties: question.ties, technique: question.technique, dynamic: question.dynamic });
}
/** Returns data only. UI must hide explanation/correction until Resolve.
 * Optional answer forces a type; otherwise 50/50 random. Pass recentAnswers to
 * keep a session balanced and cap streaks at three. Pass recentSignatures to
 * prevent repeat visuals. Generated questions always contain zero or ONE rule.
 */
export function generateQuestion(config = {}) {
  const rng = config.rng || Math.random;
  const eligible = getEligibleInstruments(config);
  if (!eligible.length) throw new RangeError('No instruments support the selected rules and filters.');
  const rules = activeRules(config);
  const recent = new Set(config.recentSignatures || []);
  const recentAnswers = config.recentAnswers || [];
  let answer = config.answer;
  if (answer === undefined) {
    const lastThree = recentAnswers.slice(-3);
    if (lastThree.length === 3 && lastThree.every((item) => item === lastThree[0])) answer = lastThree[0] === 'correct' ? 'incorrect' : 'correct';
    else {
      const correctCount = recentAnswers.filter((item) => item === 'correct').length;
      const delta = correctCount * 2 - recentAnswers.length;
      answer = delta >= 2 ? 'incorrect' : delta <= -2 ? 'correct' : rng() < 0.5 ? 'correct' : 'incorrect';
    }
  }
  if (!['correct', 'incorrect'].includes(answer)) throw new TypeError('answer must be correct or incorrect');
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const instrument = pick(eligible, rng);
    const rule = pick(rules.filter((candidate) => candidate.supports(instrument)), rng);
    const question = baseQuestion(instrument, rng);
    prepareScenario(question, rule, instrument, rng);
    const corrected = clone({ notes: question.notes, ties: question.ties, technique: question.technique });
    if (answer === 'incorrect') {
      const details = injectors[rule.id](question, instrument, rng);
      Object.assign(question, details);
      if (rule.id === 'tied-accent') {
        corrected.notes.forEach((note) => { note.articulation = null; });
        corrected.notes[0].articulation = 'accent';
      }
      if (rule.id === 'technique-conflict') corrected.technique = 'arco';
    } else {
      question.explanation = {
        de: 'Im angegebenen Instrumentenmodell ist diese Fassung in Ordnung: Tonhöhen, normale Tonerzeugung, Haltebögen und Spielanweisungen enthalten keinen der geübten Fehler. Ein Akzent an einem neuen Einsatz ist zulässig.',
        en: 'For the specified instrument model, this example is valid: pitches, ordinary tone production, ties and technique instructions contain none of the errors practised here. An accent on a fresh attack is allowed.',
      };
      question.correction = { de: 'Keine Korrektur nötig.', en: 'No correction needed.' };
    }
    Object.assign(question, {
      answer, ruleId: answer === 'incorrect' ? rule.id : null,
      scenario: rule.id, corrected,
      prompt: { de: 'Stimmt diese Instrumentenstimme im angegebenen Modell?', en: 'Is this instrument part valid for the specified model?' },
      scope: {
        de: 'Einzelne spielende Person; konventionelle Notation und gewöhnliche Tonerzeugung. Erweiterte Techniken, Skordatur, Spezialausstattung und nicht genannte Registererweiterungen sind ausgenommen.',
        en: 'One player; conventional notation and ordinary tone production. Extended techniques, scordatura, special equipment and unspecified register extensions are excluded.',
      },
    });
    question.signature = signature(question);
    question.id = `q-${hash(question.signature).toString(36)}`;
    const findings = validateQuestion(question);
    const correctionFindings = validateQuestion({ ...question, ...corrected });
    if (findings.length !== (answer === 'incorrect' ? 1 : 0) || (findings[0] && findings[0].ruleId !== question.ruleId) || correctionFindings.length) throw new Error('Question invariant failed');
    if (!recent.has(question.signature)) return question;
  }
  throw new RangeError('The selected question pool is exhausted. Broaden the selection or start a new session.');
}
