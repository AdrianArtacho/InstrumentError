/** Ordinary orchestral models. All ranges are WRITTEN MIDI pitches (C4 = 60).
 * transpose is the semitone offset from written to sounding pitch.
 * They are teaching reference ranges, never universal technical maxima.
 */
export const FAMILIES = [
  { id: 'strings', names: { de: 'Streicher', en: 'Strings' } },
  { id: 'woodwinds', names: { de: 'Holzbläser', en: 'Woodwinds' } },
  { id: 'brass', names: { de: 'Blechbläser', en: 'Brass' } },
  { id: 'percussion', names: { de: 'Schlagwerk', en: 'Percussion' } },
];
const vsl = (path) => `https://www.vsl.co.at/academy/${path}`;
const instrument = (id, family, de, en, clef, writtenRange, transpose, path, rangeNotes, extra = {}) => ({
  id, family, names: { de, en }, clef, writtenRange, transpose,
  source: { title: 'VSL Academy', url: vsl(path) }, rangeNotes,
  pitched: true, monophonic: family === 'woodwinds' || family === 'brass',
  ...(family === 'woodwinds' ? { rangeErrorDirection: 'low' } : {}), ...extra,
});
export const INSTRUMENTS = [
  instrument('violin', 'strings', 'Violine', 'Violin', 'treble', [55, 105], 0, 'strings/violin',
    { de: 'Normale Stimmung G3–D4–A4–E5; ohne Skordatur oder Flageoletts.', en: 'Standard tuning G3–D4–A4–E5; no scordatura or harmonics.' }, { rangeErrorDirection: 'low' }),
  instrument('viola', 'strings', 'Viola', 'Viola', 'alto', [48, 93], 0, 'strings/viola',
    { de: 'Normale Stimmung C3–G3–D4–A4; ohne Skordatur oder Flageoletts.', en: 'Standard tuning C3–G3–D4–A4; no scordatura or harmonics.' }, { rangeErrorDirection: 'low' }),
  instrument('cello', 'strings', 'Violoncello', 'Cello', 'bass', [36, 81], 0, 'strings/cello',
    { de: 'Normale Stimmung C2–G2–D3–A3; ohne Skordatur oder Flageoletts.', en: 'Standard tuning C2–G2–D3–A3; no scordatura or harmonics.' }, { rangeErrorDirection: 'low' }),
  instrument('double-bass', 'strings', 'Kontrabass · 4 Saiten', 'Double bass · 4 strings', 'bass', [40, 79], -12, 'strings/double-bass',
    { de: 'Viersaiter ohne C-Verlängerung: notiert E2–G5, klingend eine Oktave tiefer.', en: 'Four strings, no low extension: written E2–G5, sounding one octave lower.' }, { rangeErrorDirection: 'low' }),
  instrument('piccolo', 'woodwinds', 'Piccolo', 'Piccolo', 'treble', [62, 96], 12, 'woodwinds/piccolo',
    { de: 'Übliches Piccolo in C ohne besonderen C-Fuß; klingt eine Oktave höher.', en: 'Ordinary C piccolo, without a special C foot; sounds an octave higher.' }),
  instrument('flute', 'woodwinds', 'Flöte · C-Fuß', 'Flute · C foot', 'treble', [60, 96], 0, 'woodwinds/concert-flute',
    { de: 'C-Fuß, ohne H-Fuß. C4–C7 als Übungsbereich; höhere Speziallagen sind ausgenommen.', en: 'C foot, no B foot. C4–C7 reference range; specialist high-register playing is excluded.' }),
  instrument('oboe', 'woodwinds', 'Oboe', 'Oboe', 'treble', [58, 91], 0, 'woodwinds/oboe',
    { de: 'B3 (international Bb3) bis G6; ohne extreme Sonderlagen.', en: 'Bb3–G6; specialist extremes excluded.' }),
  instrument('english-horn', 'woodwinds', 'Englischhorn in F', 'English horn in F', 'treble', [59, 88], -7, 'woodwinds/english-horn',
    { de: 'Notiert H3–E6; klingt eine reine Quinte tiefer (E3–A5).', en: 'Written B3–E6; sounds a perfect fifth lower (E3–A5).' }),
  instrument('clarinet-bb', 'woodwinds', 'Klarinette in B', 'Clarinet in B♭', 'treble', [52, 96], -2, 'woodwinds/clarinet',
    { de: 'B = B♭. Notiert E3–C7; klingt eine große Sekunde tiefer.', en: 'Written E3–C7; sounds a major second lower.' }),
  instrument('clarinet-a', 'woodwinds', 'Klarinette in A', 'Clarinet in A', 'treble', [52, 96], -3, 'woodwinds/clarinet',
    { de: 'Notiert E3–C7; klingt eine kleine Terz tiefer.', en: 'Written E3–C7; sounds a minor third lower.' }),
  instrument('bass-clarinet', 'woodwinds', 'Bassklarinette in B · tief C', 'Bass clarinet in B♭ · low C', 'treble', [48, 93], -14, 'woodwinds/bass-clarinet',
    { de: 'Moderne Violinschlüsselnotation mit tiefer C-Klappe; klingt eine große None tiefer. Übungsobergrenze A6.', en: 'Modern treble-clef notation, low-C extension; sounds a major ninth lower. Reference upper limit A6.' }),
  instrument('bassoon', 'woodwinds', 'Fagott', 'Bassoon', 'bass', [34, 75], 0, 'woodwinds/bassoon',
    { de: 'Klingende Notation B1 (international Bb1) bis Es5; Sonderlagen ausgenommen.', en: 'Non-transposing; Bb1–Eb5 reference range, specialist extremes excluded.' }),
  instrument('contrabassoon', 'woodwinds', 'Kontrafagott', 'Contrabassoon', 'bass', [34, 72], -12, 'woodwinds/contrabassoon',
    { de: 'Notiert B1 (international Bb1) bis C5; klingt eine Oktave tiefer. Keine tiefe A-Erweiterung.', en: 'Written Bb1–C5; sounds an octave lower. No low-A extension.' }, { source: { title: 'VSL Academy', url: 'https://www.vsl.co.at/de/academy/woodwinds/contrabassoon' } }),
  instrument('horn-f', 'brass', 'Horn in F', 'Horn in F', 'treble', [42, 84], -7, 'brass/horn-f',
    { de: 'Moderne F-Notation, eine Quinte tiefer klingend. Übungsbereich ohne Pedaltöne.', en: 'Modern F notation, sounding a fifth lower. Reference range excludes pedal tones.' }, { rangeErrorDirection: 'high' }),
  instrument('trumpet-c', 'brass', 'Trompete in C', 'Trumpet in C', 'treble', [54, 84], 0, 'brass/trumpet-c',
    { de: 'Nicht transponierend; ohne Pedaltöne oder Jazz-Extremlagen.', en: 'Non-transposing; no pedal notes or jazz high-register extensions.' }, { rangeErrorDirection: 'high' }),
  instrument('trumpet-bb', 'brass', 'Trompete in B', 'Trumpet in B♭', 'treble', [54, 84], -2, 'brass/trumpet-c',
    { de: 'B = B♭. Notiert Fis3–C6, eine große Sekunde tiefer klingend; ohne Pedal-/Extremlagen.', en: 'Written F♯3–C6, sounding a major second lower; no pedal or specialist high-register playing.' }, { rangeErrorDirection: 'high' }),
  instrument('tenor-trombone', 'brass', 'Tenorposaune · ohne Ventil', 'Tenor trombone · no valve', 'bass', [40, 77], 0, 'brass/tenor-trombone',
    { de: 'Klingende Notation; Übungsbereich E2–F5 ohne Zusatzventil oder Pedaltöne.', en: 'Non-transposing; reference E2–F5 without an attachment or pedal tones.' }, { rangeErrorDirection: 'high' }),
  instrument('bass-trombone', 'brass', 'Bassposaune · 2 Ventile', 'Bass trombone · 2 valves', 'bass', [22, 77], 0, 'brass/bass-trombone',
    { de: 'Modernes Instrument mit zwei Ventilen, klingende Notation; VSL-Orientierungsumfang.', en: 'Modern two-valve instrument, non-transposing; VSL reference range.' }, { rangeErrorDirection: 'high' }),
  instrument('tuba-f', 'brass', 'Basstuba in F', 'Bass tuba in F', 'bass', [26, 67], 0, 'brass/bass-tuba',
    { de: 'Klingende Bassschlüsselnotation. D1–G4 als modellabhängiger VSL-Orientierungsumfang.', en: 'Non-transposing bass-clef notation. D1–G4 is the model-dependent VSL reference range.' }, { rangeErrorDirection: 'high' }),
  instrument('glockenspiel', 'percussion', 'Glockenspiel · G–C-Modell', 'Glockenspiel · G–C model', 'treble', [55, 84], 24, 'percussion/glockenspiel',
    { de: 'Hier 2½ Oktaven: klingend G5–C8, notiert G3–C6; Klang zwei Oktaven höher.', en: 'This model spans G5–C8 sounding, G3–C6 written; sounds two octaves higher.' }),
  instrument('xylophone', 'percussion', 'Xylophon · 3½ Oktaven', 'Xylophone · 3½ octaves', 'treble', [53, 96], 12, 'percussion/xylophone',
    { de: 'Hier klingend F4–C8, notiert F3–C7; Klang eine Oktave höher.', en: 'This model spans F4–C8 sounding, F3–C7 written; sounds an octave higher.' }),
  instrument('vibraphone', 'percussion', 'Vibraphon · 3 Oktaven', 'Vibraphone · 3 octaves', 'treble', [53, 89], 0, 'percussion/vibraphone',
    { de: 'Dreioktaviges Modell F3–F6; nicht transponierend.', en: 'Three-octave model F3–F6; non-transposing.' }),
  instrument('marimba', 'percussion', 'Marimba · 4 Oktaven', 'Marimba · 4 octaves', 'treble', [48, 96], 0, 'percussion/marimba',
    { de: 'Vieroktaviges Modell C3–C7; nicht transponierend. Größere Instrumente sind hier ausgenommen.', en: 'Four-octave model C3–C7; non-transposing. Larger models are excluded here.' }),
];
export const getInstrument = (id) => INSTRUMENTS.find((item) => item.id === id);
export function noteName(midi, language = 'de') {
  const names = language === 'de'
    ? ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'H']
    : ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
