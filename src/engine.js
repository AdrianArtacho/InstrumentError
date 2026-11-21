import { INSTRUMENTS, getInstrument, noteName } from './instruments.js';
import { transposeKey } from './pitch-view.js?v=1.5.0';

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
  {
    id: 'transposition', names: { de: 'Transposition', en: 'Transposition' },
    description: { de: 'Passt die angegebene klingende Tonhöhe zur notierten Note?', en: 'Does the proposed concert pitch match the written note?' },
    supports: (instrument) => instrument.pitched && Number.isInteger(instrument.transpose),
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
function prepareRangeScenario(question, instrument, rng) {
  const direction = instrument.rangeErrorDirection || pick(['low', 'high'], rng);
  const boundary = instrument.writtenRange[direction === 'low' ? 0 : 1];
  const inward = direction === 'low' ? 1 : -1;
  const anchorIndex = integer(0, question.notes.length - 1, rng);
  const insideDistance = integer(0, 2, rng);
  // Pick BOTH offsets before choosing the visible outcome. With an identical
  // seed, correct/incorrect examples differ only at this preselected anchor.
  const outsideDistance = integer(1, 2, rng);
  question.notes.forEach((note) => {
    setPitches(note, [boundary + inward * integer(0, 4, rng)]);
  });
  setPitches(question.notes[anchorIndex], [boundary + inward * insideDistance]);
  question.rangeContext = { direction, boundary, anchorIndex, insideDistance, outsideDistance };
}
function prepareScenario(question, rule, instrument, rng) {
  if (rule.id === 'transposition') {
    prepareTransposition(question, instrument, rng);
    return;
  }
  if (rule.id === 'written-range') prepareRangeScenario(question, instrument, rng);
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

// Letter steps are distinct from semitone steps: e.g. a minor third descends
// two letters. Choose pitches whose default spelling preserves that interval
// in the MIDI-based renderer (avoids writing A-flat for an expected G-sharp).
const transpositionIntervals = {
  '-14': [-8, 'eine große None', 'a major ninth'],
  '-12': [-7, 'eine Oktave', 'an octave'],
  '-7': [-4, 'eine reine Quinte', 'a perfect fifth'],
  '-3': [-2, 'eine kleine Terz', 'a minor third'],
  '-2': [-1, 'eine große Sekunde', 'a major second'],
  0: [0, '', ''],
  12: [7, 'eine Oktave', 'an octave'],
  24: [14, 'zwei Oktaven', 'two octaves'],
};
function prepareTransposition(question, instrument, rng) {
  const [start, end] = { treble: [55, 84], alto: [48, 72], bass: [36, 64] }[instrument.clef] || [55, 84];
  const [low, high] = instrument.writtenRange;
  const shift = instrument.transpose;
  const interval = transpositionIntervals[shift];
  const letter = midi => 'CDEFGAB'.indexOf(noteName(midi, 'en')[0]);
  const choices = [];
  for (let midi = Math.max(low, start); midi <= Math.min(high, end); midi += 1) {
    if (!interval || (letter(midi + shift) - letter(midi) - interval[0]) % 7 === 0) choices.push(midi);
  }
  const written = pick(choices.length ? choices : playablePitches(instrument), rng);
  question.notes = [makeNote(written, pick(['q', 'h'], rng))];
  question.technique = null;
  question.dynamic = null;
  question.dynamics = null;
  delete question.timeSignature;
  question.soundingPitch = written + shift;
}

function transpositionExplanation(question, instrument) {
  const written = question.notes[0].pitches[0];
  const shift = instrument.transpose;
  const actual = written + shift;
  if (!shift) return {
    de: `Notiert ${noteName(written, 'de')} klingt als ${noteName(actual, 'de')}: Das Instrument klingt wie notiert.`,
    en: `Written ${noteName(written, 'en')} sounds as ${noteName(actual, 'en')}: the instrument sounds as written.`,
  };
  const [, deInterval, enInterval] = transpositionIntervals[shift] ??
    [0, `${Math.abs(shift)} Halbtöne`, `${Math.abs(shift)} semitones`];
  return {
    de: `Notiert ${noteName(written, 'de')} klingt als ${noteName(actual, 'de')} (${deInterval} ${shift < 0 ? 'tiefer' : 'höher'}).`,
    en: `Written ${noteName(written, 'en')} sounds as ${noteName(actual, 'en')} (${enInterval} ${shift < 0 ? 'lower' : 'higher'}).`,
  };
}

function injectTransposition(question, instrument, rng) {
  const written = question.notes[0].pitches[0];
  const shift = instrument.transpose;
  const actual = written + shift;
  const [low, high] = instrument.writtenRange;
  // Try familiar mistakes (ignoring/reversing the shift, wrong octave,
  // neighbouring interval), keeping the proposed pitch in the concert range.
  const alternatives = [...new Set([written, written - shift, actual - 12, actual + 12, actual - 2, actual - 1, actual + 1, actual + 2])]
    .filter(pitch => pitch !== actual && pitch >= low + shift && pitch <= high + shift);
  question.soundingPitch = pick(alternatives, rng);
  const explanation = transpositionExplanation(question, instrument);
  return {
    explanation: {
      de: `Angegeben ist ${noteName(question.soundingPitch, 'de')}. ${explanation.de}`,
      en: `The proposed pitch is ${noteName(question.soundingPitch, 'en')}. ${explanation.en}`,
    },
    correction: {
      de: `Die klingende Tonhöhe auf ${noteName(actual, 'de')} korrigieren.`,
      en: `Change the concert pitch to ${noteName(actual, 'en')}.`,
    },
  };
}

function rangeReference(instrument, language) {
  return instrument.writtenRange.map((pitch) => noteName(pitch, language)).join('–');
}
function correctRangeExplanation(question, instrument) {
  const { direction, boundary, anchorIndex, insideDistance } = question.rangeContext;
  const pitch = question.notes[anchorIndex].pitches[0];
  const germanPosition = insideDistance === 0
    ? `genau auf der ${direction === 'low' ? 'unteren' : 'oberen'} Grenze ${noteName(boundary, 'de')}`
    : `${insideDistance} ${insideDistance === 1 ? 'Halbton' : 'Halbtöne'} innerhalb der ${direction === 'low' ? 'unteren' : 'oberen'} Grenze ${noteName(boundary, 'de')}`;
  const englishPosition = insideDistance === 0
    ? `exactly on the ${direction === 'low' ? 'lower' : 'upper'} boundary ${noteName(boundary, 'en')}`
    : `${insideDistance} semitone${insideDistance === 1 ? '' : 's'} inside the ${direction === 'low' ? 'lower' : 'upper'} boundary ${noteName(boundary, 'en')}`;
  return {
    de: `Diese Grenzlage ist gültig: ${noteName(pitch, 'de')} liegt ${germanPosition}. Auch die benachbarten Töne bleiben im notierten Modellumfang ${rangeReference(instrument, 'de')}. ${instrument.rangeNotes.de} Der Modellumfang ist keine universelle technische Grenze.`,
    en: `This edge-of-range example is valid: ${noteName(pitch, 'en')} lies ${englishPosition}. The neighbouring notes also remain within the model's written range ${rangeReference(instrument, 'en')}. ${instrument.rangeNotes.en} The reference range is not a universal technical limit.`,
  };
}
function injectRange(question, instrument) {
  const { direction, boundary, anchorIndex, outsideDistance } = question.rangeContext;
  const pitch = boundary + (direction === 'low' ? -outsideDistance : outsideDistance);
  setPitches(question.notes[anchorIndex], [pitch]);
  question.issueNoteIndices = [anchorIndex];
  return {
    explanation: {
      de: `${noteName(pitch, 'de')} liegt ${outsideDistance} ${outsideDistance === 1 ? 'Halbton' : 'Halbtöne'} ${direction === 'low' ? 'unter' : 'über'} der ${direction === 'low' ? 'unteren' : 'oberen'} Modellgrenze ${noteName(boundary, 'de')}. Die übrigen Töne liegen knapp innerhalb des notierten Umfangs ${rangeReference(instrument, 'de')}. ${instrument.rangeNotes.de} Die Grenzen sind ein Übungsmodell, keine universellen technischen Maxima.`,
      en: `${noteName(pitch, 'en')} lies ${outsideDistance} semitone${outsideDistance === 1 ? '' : 's'} ${direction === 'low' ? 'below' : 'above'} the model's ${direction === 'low' ? 'lower' : 'upper'} boundary ${noteName(boundary, 'en')}. The other notes sit just inside the written range ${rangeReference(instrument, 'en')}. ${instrument.rangeNotes.en} These are teaching boundaries, not universal technical maxima.`,
    },
    correction: {
      de: `Nur den markierten Ton knapp auf die zulässige Seite der Modellgrenze ${noteName(boundary, 'de')} verschieben. Die alternative Fassung bleibt in derselben Grenzlage.`,
      en: `Move only the highlighted note just onto the valid side of the boundary ${noteName(boundary, 'en')}. The alternative stays in the same edge-of-range register.`,
    },
  };
}
function questionFeedback(question, instrument, answer, ruleId) {
  if (ruleId === 'transposition') return transpositionExplanation(question, instrument);
  if (ruleId === 'written-range') {
    const { direction, boundary, anchorIndex } = question.rangeContext;
    const pitch = question.notes[anchorIndex].pitches[0];
    const distance = Math.abs(pitch - boundary);
    if (answer === 'correct' && distance === 0) return {
      de: `${noteName(pitch, 'de')} ist die ${direction === 'low' ? 'tiefste' : 'höchste'} notierte Tonhöhe dieses Modells.`,
      en: `${noteName(pitch, 'en')} is this model's ${direction === 'low' ? 'lowest' : 'highest'} written pitch.`,
    };
    return {
      de: `${noteName(pitch, 'de')} liegt ${distance} ${distance === 1 ? 'Halbton' : 'Halbtöne'} ${pitch < boundary ? 'unter' : 'über'} der ${direction === 'low' ? 'unteren' : 'oberen'} Modellgrenze ${noteName(boundary, 'de')}${answer === 'correct' ? ' und damit innerhalb des Umfangs' : ' und damit außerhalb des Umfangs'}.`,
      en: `${noteName(pitch, 'en')} is ${distance} semitone${distance === 1 ? '' : 's'} ${pitch < boundary ? 'below' : 'above'} the model's ${direction === 'low' ? 'lower' : 'upper'} boundary ${noteName(boundary, 'en')}, so it is ${answer === 'correct' ? 'inside' : 'outside'} the range.`,
    };
  }
  if (answer === 'correct') return {
    de: 'Tonhöhen, Haltebögen und Spielanweisungen enthalten keinen der geübten Fehler.',
    en: 'The pitches, ties and playing instructions contain none of the practised errors.',
  };
  return {
    'wind-chord': {
      de: 'Ein einzelner Bläser kann diesen Dreiklang mit der vorausgesetzten gewöhnlichen Tonerzeugung nicht gleichzeitig spielen.',
      en: 'One wind player cannot play this simultaneous triad with the ordinary tone production assumed here.',
    },
    'tied-accent': {
      de: 'Der Anschlagsakzent steht auf der Fortsetzung eines gehaltenen Tons statt auf einem neuen Einsatz.',
      en: 'The attack accent is on the continuation of a tied note rather than a fresh onset.',
    },
    'technique-conflict': {
      de: 'Arco und gewöhnliches Pizzicato widersprechen sich hier als gleichzeitige Anweisungen für denselben Einsatz.',
      en: 'Arco and ordinary pizzicato conflict here as simultaneous instructions for the same onset.',
    },
  }[ruleId];
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
const injectors = { 'written-range': injectRange, 'wind-chord': injectWindChord, 'tied-accent': injectTiedAccent, 'technique-conflict': injectTechnique, transposition: injectTransposition };

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
  if (question.soundingPitch !== undefined &&
      question.soundingPitch !== question.notes[0]?.pitches[0] + instrument.transpose) {
    findings.push({ ruleId: 'transposition', issueNoteIndices: [] });
  }
  return findings;
}
function signature(question) {
  return JSON.stringify({ instrumentId: question.instrumentId, clef: question.clef, notes: question.notes, ties: question.ties, technique: question.technique, dynamic: question.dynamic, soundingPitch: question.soundingPitch });
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
  const recent = new Map((config.recentSignatures || []).map((value, index) => [value, index]));
  let oldestTransposition;
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
    const corrected = clone({ notes: question.notes, ties: question.ties, technique: question.technique, soundingPitch: question.soundingPitch });
    if (answer === 'incorrect') {
      const details = injectors[rule.id](question, instrument, rng);
      Object.assign(question, details);
      if (rule.id === 'tied-accent') {
        corrected.notes.forEach((note) => { note.articulation = null; });
        corrected.notes[0].articulation = 'accent';
      }
      if (rule.id === 'technique-conflict') corrected.technique = 'arco';
    } else {
      question.explanation = rule.id === 'written-range' ? correctRangeExplanation(question, instrument) :
        rule.id === 'transposition' ? transpositionExplanation(question, instrument) : {
        de: 'Im angegebenen Instrumentenmodell ist diese Fassung in Ordnung: Tonhöhen, normale Tonerzeugung, Haltebögen und Spielanweisungen enthalten keinen der geübten Fehler. Ein Akzent an einem neuen Einsatz ist zulässig.',
        en: 'For the specified instrument model, this example is valid: pitches, ordinary tone production, ties and technique instructions contain none of the errors practised here. An accent on a fresh attack is allowed.',
      };
      question.correction = { de: 'Keine Korrektur nötig.', en: 'No correction needed.' };
    }
    Object.assign(question, {
      answer, ruleId: answer === 'incorrect' ? rule.id : null,
      scenario: rule.id, corrected, feedback: questionFeedback(question, instrument, answer, rule.id),
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
    if (rule.id === 'transposition' && (!oldestTransposition ||
        recent.get(question.signature) < recent.get(oldestTransposition.signature))) oldestTransposition = question;
  }
  // A single-instrument transposition link has few distinct one-note correct
  // examples. Let practice continue after that pool is exhausted, with a fresh
  // round ID so the session store can score the repeated visual separately.
  if (oldestTransposition) {
    oldestTransposition.id += `-repeat-${(rng() * 2 ** 32 >>> 0).toString(36)}`;
    return oldestTransposition;
  }
  throw new RangeError('The selected question pool is exhausted. Broaden the selection or start a new session.');
}

export const ENTRY_DIRECTIONS = Object.freeze(['written-to-sounding', 'sounding-to-written']);

const STAFF_BOTTOM = { bass: 18, alto: 24, treble: 30, tenor: 22 };
const ENTRY_LETTERS = 'cdefgab';
const ENTRY_NATURALS = [0, 2, 4, 5, 7, 9, 11];

/** Absolute staff step: C0 = 0, C4 = 28. Accidentals are signed semitones. */
export function parseEntryKey(key) {
  const match = typeof key === 'string' && /^([a-g])(bb|##|b|#)?\/(-?\d+)$/.exec(key);
  if (!match) return null;
  const [, letter, suffix = '', octave] = match;
  const step = Number(octave) * 7 + ENTRY_LETTERS.indexOf(letter);
  const accidental = suffix.startsWith('b') ? -suffix.length : suffix.length;
  return entryPitch(step, accidental) ? { step, accidental } : null;
}

export function entryPitch(step, accidental = 0) {
  if (!Number.isInteger(step) || !Number.isInteger(accidental) || Math.abs(accidental) > 2) return null;
  const octave = Math.floor(step / 7);
  const letter = ((step % 7) + 7) % 7;
  const midi = (octave + 1) * 12 + ENTRY_NATURALS[letter] + accidental;
  if (midi < 0 || midi > 127) return null;
  const suffix = accidental < 0 ? 'b'.repeat(-accidental) : '#'.repeat(accidental);
  return { midi, key: `${ENTRY_LETTERS[letter]}${suffix}/${octave}` };
}

export function entryStaffBounds(clef) {
  const bottom = STAFF_BOTTOM[clef] ?? STAFF_BOTTOM.treble;
  return { minStep: bottom - 8, maxStep: bottom + 16 };
}

export function formatEntryKey(key, language = 'de') {
  const [name, octave] = key.split('/');
  const [letter, ...suffix] = name;
  const base = language === 'de' && letter === 'b' && suffix[0] !== 'b' ? 'H' : letter.toUpperCase();
  const symbol = suffix.join('').replaceAll('b', '♭').replaceAll('#', '♯');
  return `${base}${symbol}${octave}`;
}

export function gradeEntryAnswer(question, answer) {
  const pitch = entryPitch(answer?.step, answer?.accidental);
  if (!pitch || pitch.midi !== question.expected.midi) return 'incorrect';
  return pitch.key === question.expected.key ? 'correct' : 'enharmonic';
}

// Choose fixed clefs before generating any pitches, so the answer staff
// does not offer an unintended cue about the octave of the required note.
function entrySoundingClef(instrument) {
  return instrument.clef === 'treble' && instrument.transpose <= -12 ? 'bass' : instrument.clef;
}

function isCommonEntrySpelling({ key, accidental }) {
  return Math.abs(accidental) <= 1 && !/^(cb|fb|b#|e#)\//.test(key);
}

const entryPools = new Map();
function entryPairs(instrument) {
  if (entryPools.has(instrument.id)) return entryPools.get(instrument.id);
  const writtenClef = instrument.clef;
  const soundingClef = entrySoundingClef(instrument);
  const writtenStaff = STAFF_BOTTOM[writtenClef] ?? STAFF_BOTTOM.treble;
  const soundingStaff = STAFF_BOTTOM[soundingClef] ?? STAFF_BOTTOM.treble;
  const [low, high] = instrument.writtenRange;
  const pairs = [];
  // Stay within three ledger lines of either staff. This includes the
  // double-octave glockenspiel, whose low written and high concert ranges
  // leave a smaller overlap than on the other instrument models.
  for (let step = writtenStaff - 6; step <= writtenStaff + 14; step++) {
    for (const accidental of [0, -1, 1]) {
      const written = entryPitch(step, accidental);
      if (!written || written.midi < low || written.midi > high || !isCommonEntrySpelling({ ...written, accidental })) continue;
      const midi = written.midi + instrument.transpose;
      if (midi < 0 || midi > 127) continue;
      const key = transposeKey(written.key, midi, instrument.transpose);
      const sounding = parseEntryKey(key);
      if (!sounding || !isCommonEntrySpelling({ key, accidental: sounding.accidental }) ||
          sounding.step < soundingStaff - 6 || sounding.step > soundingStaff + 14) continue;
      pairs.push({ written: { ...written, clef: writtenClef }, sounding: { midi, key, clef: soundingClef } });
    }
  }
  entryPools.set(instrument.id, pairs);
  return pairs;
}

/** A constructive drill, separate from the correct/incorrect detector. */
export function generateEntryQuestion({ instrumentIds, direction, rng = Math.random, recentSignatures = [] } = {}) {
  if (!ENTRY_DIRECTIONS.includes(direction)) throw new RangeError('Unknown transposition direction.');
  const instruments = INSTRUMENTS.filter(instrument => instrument.pitched && Number.isInteger(instrument.transpose) &&
    (instrumentIds === undefined || instrumentIds.includes(instrument.id)));
  const writtenToSounding = direction === 'written-to-sounding';
  const recent = new Map(recentSignatures.map((signature, index) => [signature, index]));
  const rows = instruments.map(instrument => entryPairs(instrument).map(({ written, sounding }) => {
    const given = writtenToSounding ? written : sounding;
    const expected = writtenToSounding ? sounding : written;
    const signature = `${direction}:${instrument.id}:${given.key}`;
    return { instrument, written, sounding, given, expected, signature };
  })).filter(row => row.length);
  if (!rows.length) throw new RangeError('No selected instrument supports this exercise.');
  const fresh = rows.map(row => row.filter(({ signature }) => !recent.has(signature))).filter(row => row.length);
  // Weight instrument models equally, even when their ranges differ.
  const candidate = fresh.length ? pick(pick(fresh, rng), rng) :
    rows.flat().reduce((oldest, next) => recent.get(next.signature) < recent.get(oldest.signature) ? next : oldest);
  const { instrument, written, sounding, given, expected, signature } = candidate;
  const shift = instrument.transpose;
  const [, deInterval, enInterval] = transpositionIntervals[shift] ??
    [0, `${Math.abs(shift)} Halbtöne`, `${Math.abs(shift)} semitones`];
  const explanation = Object.freeze({
    de: `Notiert ${formatEntryKey(written.key, 'de')} klingt als ${formatEntryKey(sounding.key, 'de')}${shift ? ` (${deInterval} ${shift < 0 ? 'tiefer' : 'höher'})` : ' (klingt wie notiert)'}.`,
    en: `Written ${formatEntryKey(written.key, 'en')} sounds as ${formatEntryKey(sounding.key, 'en')}${shift ? ` (${enInterval} ${shift < 0 ? 'lower' : 'higher'})` : ' (sounds as written)'}.`,
  });
  const id = `entry-${hash(signature).toString(36)}${fresh.length ? '' : `-repeat-${(rng() * 2 ** 32 >>> 0).toString(36)}`}`;
  return Object.freeze({ id, signature, instrumentId: instrument.id, direction,
    given: Object.freeze({ ...given }), expected: Object.freeze({ ...expected }), explanation });
}
