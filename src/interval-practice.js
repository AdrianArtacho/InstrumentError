import { INSTRUMENTS, noteName } from './instruments.js';

// Offsets are always from the written note to the sound, including the octave.
const TRANSPOSING_SHARE = 0.85;
const INTERVALS = {
  1: ['eine kleine Sekunde', 'a minor second'],
  2: ['eine große Sekunde', 'a major second'],
  3: ['eine kleine Terz', 'a minor third'],
  4: ['eine große Terz', 'a major third'],
  5: ['eine reine Quarte', 'a perfect fourth'],
  6: ['einen Tritonus', 'a tritone'],
  7: ['eine reine Quinte', 'a perfect fifth'],
  8: ['eine kleine Sexte', 'a minor sixth'],
  9: ['eine große Sexte', 'a major sixth'],
  10: ['eine kleine Septime', 'a minor seventh'],
  11: ['eine große Septime', 'a major seventh'],
  12: ['eine Oktave', 'an octave'],
  13: ['eine kleine None', 'a minor ninth'],
  14: ['eine große None', 'a major ninth'],
  15: ['eine kleine Dezime', 'a minor tenth'],
  16: ['eine große Dezime', 'a major tenth'],
  24: ['zwei Oktaven', 'two octaves'],
};

function optionLabel(offset) {
  if (!offset) return { de: 'Klingt wie notiert', en: 'Sounds as written' };
  const distance = Math.abs(offset);
  const [de, en] = INTERVALS[distance] ?? [`${distance} Halbtöne`, `${distance} semitones`];
  return {
    de: `${de[0].toUpperCase()}${de.slice(1)} ${offset < 0 ? 'tiefer' : 'höher'}`,
    en: `${en[0].toUpperCase()}${en.slice(1)} ${offset < 0 ? 'lower' : 'higher'}`,
  };
}

function relatedOffsets(correctOffset) {
  const distance = Math.abs(correctOffset);
  const simple = distance % 12;
  if (!simple) return [0, -12, 12, -24, 24, correctOffset];

  // A fourth up and a fifth down have the same pitch class but differ by
  // an octave. Use both directions of both variants for fourths and fifths.
  // For seconds and thirds use the same interval in two adjacent octaves.
  const alternative = distance > 12 ? distance - 12
    : simple === 5 || simple === 7 ? 12 - simple : distance + 12;
  return [correctOffset, -correctOffset, -alternative, alternative];
}

function shuffle(items, rng) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function chooseInstrument(instruments, recentInstrumentIds, rng) {
  const transposing = instruments.filter(instrument => instrument.transpose !== 0);
  const untransposed = instruments.filter(instrument => instrument.transpose === 0);
  const pool = !untransposed.length || (transposing.length && rng() < TRANSPOSING_SHARE)
    ? transposing : untransposed;
  const recent = new Map(recentInstrumentIds.map((id, index) => [id, index]));
  const fresh = pool.filter(instrument => !recent.has(instrument.id));
  return fresh.length ? fresh[Math.floor(rng() * fresh.length)] :
    pool.reduce((oldest, instrument) => recent.get(instrument.id) < recent.get(oldest.id) ? instrument : oldest);
}

/** Generate a written-to-sounding interval quiz with distinct, related choices.
 * recentInstrumentIds runs from oldest to newest, and all offsets are signed
 * semitones (zero means the pitch and octave match the written note).
 */
export function generateIntervalQuestion({ instrumentIds, rng = Math.random, recentInstrumentIds = [] } = {}) {
  const instruments = INSTRUMENTS.filter(instrument => instrument.pitched && Number.isInteger(instrument.transpose) &&
    (instrumentIds === undefined || instrumentIds.includes(instrument.id)));
  if (!instruments.length) throw new RangeError('No selected instrument supports this exercise.');
  const instrument = chooseInstrument(instruments, recentInstrumentIds, rng);
  const correctOffset = instrument.transpose;
  const options = shuffle(new Set(relatedOffsets(correctOffset)), rng).map(offset => Object.freeze({
    offset, label: Object.freeze(optionLabel(offset)),
  }));
  const correctLabel = optionLabel(correctOffset);
  const [low, high] = instrument.writtenRange;
  const written = [60, 72, 48].find(pitch => pitch >= low && pitch <= high) ?? low;
  const sounding = written + correctOffset;
  const explanation = {
    de: `${correctLabel.de}. Notiertes ${noteName(written, 'de')} klingt als ${noteName(sounding, 'de')}.`,
    en: `${correctLabel.en}. Written ${noteName(written, 'en')} sounds as ${noteName(sounding, 'en')}.`,
  };
  return Object.freeze({ instrumentId: instrument.id, correctOffset,
    options: Object.freeze(options), explanation: Object.freeze(explanation) });
}
