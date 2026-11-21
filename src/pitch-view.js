const MIDI_SPELLINGS = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b'];
const LETTERS = 'cdefgab';
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
// Letter displacement for each transposition in instruments.js.
const LETTER_SHIFTS = { '-14': -8, '-12': -7, '-7': -4, '-3': -2, '-2': -1, 12: 7, 24: 14 };
const mod = (n, divisor) => ((n % divisor) + divisor) % divisor;

export function pitchKey(midi) {
  return `${MIDI_SPELLINGS[mod(midi, 12)]}/${Math.floor(midi / 12) - 1}`;
}

export function transposeKey(key, midi, shift) {
  const steps = shift === 0 ? 0 : LETTER_SHIFTS[shift];
  if (steps === undefined) return pitchKey(midi);
  const [written, writtenOctave] = key.split('/');
  const diatonic = Number(writtenOctave) * 7 + LETTERS.indexOf(written[0]) + steps;
  const letter = mod(diatonic, 7);
  const octave = Math.floor(diatonic / 7);
  const accidental = midi - ((octave + 1) * 12 + NATURALS[letter]);
  if (!Number.isInteger(accidental) || Math.abs(accidental) > 2) return pitchKey(midi);
  return `${LETTERS[letter]}${accidental < 0 ? 'b'.repeat(-accidental) : '#'.repeat(accidental)}/${octave}`;
}

function transposeNotes(notes, shift) {
  return notes.map(note => {
    const pitches = note.pitches.map(pitch => pitch + shift);
    return {
      ...note,
      pitches,
      midi: pitches[0],
      pitchKeys: pitches.map((pitch, index) => transposeKey(
        note.pitchKeys?.[index] ?? pitchKey(note.pitches[index]), pitch, shift
      )),
    };
  });
}

function soundingClef(notes, writtenClef) {
  if (!['treble', 'bass'].includes(writtenClef)) return writtenClef;
  const pitches = notes.flatMap(note => note.pitches);
  if (!pitches.length) return writtenClef;
  const middle = (Math.min(...pitches) + Math.max(...pitches)) / 2;
  return middle === 60 ? writtenClef : middle < 60 ? 'bass' : 'treble';
}

/**
 * Adapt notation for display only. Keep the quiz's written-pitch data and
 * proposed reference pitch intact. The correction flag selects a suitable
 * clef; the engraver still applies the correction payload itself.
 */
export function notationForPitchView(question, instrument, view, corrected = false) {
  const shift = instrument?.transpose;
  if (view !== 'sounding' || !Number.isInteger(shift) || shift === 0) return question;

  const notes = transposeNotes(question.notes, shift);
  const correctedNotes = question.corrected?.notes
    ? transposeNotes(question.corrected.notes, shift)
    : undefined;
  return {
    ...question,
    notes,
    clef: soundingClef(corrected && correctedNotes ? correctedNotes : notes, question.clef),
    corrected: correctedNotes ? { ...question.corrected, notes: correctedNotes } : question.corrected,
  };
}
