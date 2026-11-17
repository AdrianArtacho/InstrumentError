/** Self-contained SVG music engraving. VexFlow is loaded by vendor/vexflow.js. */
const renderTokens = new WeakMap();
let fontsReady;
const INK = '#172f35';
const ERROR = '#b33f34';
const CORRECTION = '#26735d';
const PITCHES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b'];

function vexflow() {
  const vf = window.VexFlow;
  if (!vf?.Renderer) throw new Error('The local notation library could not be loaded.');
  return vf;
}

async function prepareFonts() {
  if (!fontsReady) {
    const vf = vexflow();
    vf.setFonts('Bravura', 'Academico');
    fontsReady = Promise.all([
      document.fonts.load('40px Bravura'),
      document.fonts.load('16px Academico'),
    ]).then(() => document.fonts.ready);
  }
  return fontsReady;
}

function pitchKey(midi) {
  const pitch = PITCHES[((midi % 12) + 12) % 12];
  return `${pitch}/${Math.floor(midi / 12) - 1}`;
}

function pitchName(midi, language = 'de') {
  const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const name = names[((midi % 12) + 12) % 12];
  return `${name}${Math.floor(midi / 12) - 1}${language === 'de' && midi % 12 === 11 ? ' (H)' : ''}`;
}

function correctedQuestion(question, corrected) {
  return corrected && question.corrected ? { ...question, ...question.corrected } : question;
}

/** Text equivalent of the visible notation; deliberately contains no answer. */
export function notationDescription(question, language = 'de', corrected = false) {
  const q = correctedQuestion(question, corrected);
  const de = language !== 'en';
  const clefs = de
    ? { treble: 'Violinschlüssel', bass: 'Bassschlüssel', alto: 'Altschlüssel', tenor: 'Tenorschlüssel', percussion: 'Schlagzeugschlüssel' }
    : { treble: 'treble clef', bass: 'bass clef', alto: 'alto clef', tenor: 'tenor clef', percussion: 'percussion clef' };
  const notes = (q.notes || []).map((note, i) => {
    const duration = note.duration === 'h' ? (de ? 'halbe Note' : 'half note') : (de ? 'Viertelnote' : 'quarter note');
    const pitches = note.pitches.map(p => pitchName(p, language)).join(de ? ' und ' : ' and ');
    const chord = note.pitches.length > 1 ? (de ? 'Akkord ' : 'chord ') : '';
    const articulation = note.articulation === 'accent' ? (de ? ', Akzent' : ', accent')
      : note.articulation === 'staccato' ? ', staccato' : '';
    return `${i + 1}: ${chord}${pitches}, ${duration}${articulation}`;
  });
  const ties = (q.ties || []).map(tie => de
    ? `Haltebogen von Note ${tie.from + 1} zu ${tie.to + 1}`
    : `Tie from note ${tie.from + 1} to ${tie.to + 1}`);
  return [clefs[q.clef] || q.clef, ...notes, ...ties,
    q.dynamic ? `${de ? 'Dynamik' : 'Dynamic'}: ${q.dynamic}` : '',
    q.technique ? `${de ? 'Spielanweisung' : 'Technique'}: ${q.technique}` : '',
  ].filter(Boolean).join('. ') + '.';
}

/**
 * Render a generated question. Await the promise before exposing answer controls.
 * The SVG scales with its container; no canvas, remote fonts or CDN is needed.
 */
export async function renderScore(container, question, options = {}) {
  const token = Symbol('score render');
  renderTokens.set(container, token);
  const { reveal = false, corrected = false, language = 'de' } = options;
  await prepareFonts();
  if (renderTokens.get(container) !== token) return;

  const q = correctedQuestion(question, corrected);
  const vf = vexflow();
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Articulation, Annotation, StaveTie, ModifierPosition } = vf;
  container.replaceChildren();
  // A compact logical canvas enlarges the engraving when the SVG fills the
  // quiz card, keeping notation legible at classroom projection distances.
  const width = 650;
  const height = 240;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(width, height);
  // VexFlow also fixes its host element to the logical pixel width. Release
  // that size so the SVG can shrink inside a phone card and center on desktop.
  container.style.width = '100%';
  container.style.removeProperty('height');
  const context = renderer.getContext();
  context.setFillStyle(INK).setStrokeStyle(INK);

  const clef = q.clef || 'treble';
  const staveWidth = q.notes.length === 1 ? 300 : q.notes.length === 2 ? 430 : width - 70;
  const stave = new Stave((width - staveWidth) / 2, 70, staveWidth)
    .addClef(clef)
    .setContext(context);
  stave.setBegBarType(vf.Barline.type.SINGLE);
  stave.setEndBarType(vf.Barline.type.SINGLE);
  stave.draw();

  const issues = new Set(question.issueNoteIndices || []);
  // Altered pitches remain active within this isolated measure. Explicit
  // naturals are essential after an altered pitch on the same staff position.
  const accidentalState = new Map();
  const notes = q.notes.map((item, index) => {
    const note = new StaveNote({
      clef,
      keys: item.pitches.map(pitchKey),
      duration: item.duration || 'q',
      autoStem: true,
    });
    item.pitches.forEach((midi, keyIndex) => {
      const pitch = PITCHES[((midi % 12) + 12) % 12];
      const accidental = pitch.slice(1) || 'n';
      const position = `${pitch[0]}/${Math.floor(midi / 12) - 1}`;
      const prior = accidentalState.get(position) || 'n';
      if (accidental !== prior) note.addModifier(new Accidental(accidental), keyIndex);
      accidentalState.set(position, accidental);
    });
    if (item.articulation) {
      const code = item.articulation === 'accent' ? 'a>' : 'a.';
      const articulation = new Articulation(code).setPosition(ModifierPosition.ABOVE);
      if (reveal && !corrected && issues.has(index)) articulation.setStyle({ fillStyle: ERROR, strokeStyle: ERROR });
      note.addModifier(articulation, 0);
    }
    if (index === 0 && q.technique) {
      const instruction = new Annotation(q.technique)
        .setFont('Academico', 14)
        .setVerticalJustification(Annotation.VerticalJustify.TOP)
        .setJustification(Annotation.HorizontalJustify.LEFT);
      if (reveal && !corrected && question.ruleId === 'technique-conflict') {
        instruction.setStyle({ fillStyle: ERROR, strokeStyle: ERROR });
      }
      note.addModifier(instruction, 0);
    }
    const color = corrected ? CORRECTION : reveal && issues.has(index) ? ERROR : INK;
    note.setStyle({ fillStyle: color, strokeStyle: color });
    note.setStemStyle({ fillStyle: color, strokeStyle: color });
    note.setAttribute('class', `quiz-note${reveal && !corrected && issues.has(index) ? ' notation-error' : ''}`);
    return note;
  });
  const beats = q.notes.reduce((sum, note) => sum + (note.duration === 'h' ? 2 : 1), 0);
  const voice = new Voice({ numBeats: Math.max(1, beats), beatValue: 4 }).addTickables(notes);
  // A time signature is intentionally omitted: these are isolated writing examples.
  new Formatter().joinVoices([voice]).formatToStave([voice], stave, { alignRests: true });
  voice.draw(context, stave);

  for (const tie of q.ties || []) {
    if (!notes[tie.from] || !notes[tie.to]) continue;
    const count = Math.min(q.notes[tie.from].pitches.length, q.notes[tie.to].pitches.length);
    const indices = Array.from({ length: count }, (_, i) => i);
    const curve = new StaveTie({ firstNote: notes[tie.from], lastNote: notes[tie.to], firstIndexes: indices, lastIndexes: indices })
      .setContext(context);
    curve.setStyle({ fillStyle: corrected ? CORRECTION : INK, strokeStyle: corrected ? CORRECTION : INK });
    curve.drawWithStyle();
  }

  if (q.dynamic && notes[0]) {
    // Render SMuFL dynamic glyphs in the embedded music font, not italic text.
    const dynamics = { p: vf.Glyphs.dynamicPiano, f: vf.Glyphs.dynamicForte, m: vf.Glyphs.dynamicMezzo };
    const glyphs = [...q.dynamic].map(char => dynamics[char] || char).join('');
    const x = notes[0].getAbsoluteX() - 2;
    const lowestNote = Math.max(stave.getBottomLineY(), ...notes.flatMap(note => note.getYs()));
    context.save();
    context.setFont('Bravura', 31).setFillStyle(INK);
    context.fillText(glyphs, x, lowestNote + 44);
    context.restore();
  }

  const svg = container.querySelector('svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.maxWidth = '900px';
  svg.style.height = 'auto';
  svg.style.overflow = 'visible';
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', notationDescription(question, language, corrected));
  svg.setAttribute('focusable', 'false');

  // Music fonts have large text bounding boxes outside their visible ink.
  // Fit extreme pitches from their engraved staff coordinates instead, keeping
  // ordinary snippets compact while reserving space for stems, marks and text.
  const noteYs = notes.flatMap(note => note.getYs()).filter(Number.isFinite);
  const top = Math.min(0, ...noteYs.map(y => y - 75));
  const bottom = Math.max(height, stave.getBottomLineY() + 80, ...noteYs.map(y => y + 80));
  svg.setAttribute('viewBox', `0 ${top} ${width} ${bottom - top}`);
  return svg;
}
