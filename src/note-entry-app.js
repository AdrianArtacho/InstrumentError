import { generateEntryQuestion, entryPitch, parseEntryKey, formatEntryKey, gradeEntryAnswer } from './engine.js?v=1.5.0';
import { INSTRUMENTS, FAMILIES, getInstrument } from './instruments.js';
import { mountEntryStaff } from './entry-staff.js?v=1.6.0';
import { loadState } from './session.js?v=1.3.0';

const COPY = {
  de: {
    back: '← Fehler erkennen', eyebrow: 'TRANSPOSITION · NOTE EINGEBEN', forward: 'Notiert → Klingend', reverse: 'Klingend → Notiert', interval: 'Intervall wählen',
    directions: 'Übungsrichtung', given: 'VORGABE', answer: 'DEINE EINGABE', solution: 'LÖSUNG',
    written: 'Notierte Note', sounding: 'Klingende Note', writtenPrompt: 'Wie klingt diese notierte Note?', soundingPrompt: 'Wie wird diese klingende Note für das Instrument notiert?',
    help: 'Klicke oder tippe auf das Notensystem. Mit ↑ und ↓ setzt und verschiebst du die Note, mit ← und → wählst du das Vorzeichen.',
    start: 'Setze die gesuchte Note ins Antwortsystem.', check: 'Prüfen', next: 'Weiter', showSolution: 'Lösung zeigen', showAnswer: 'Meine Note zeigen',
    good: 'Richtig.', almost: 'Richtige Tonhöhe, andere Schreibweise.', wrong: 'Noch nicht richtig.', expected: 'Gesucht:', entered: 'Deine Note:',
    accidentals: 'Vorzeichen', accidentalNames: ['Be', 'Auflösungszeichen', 'Kreuz'], clefs: { treble: 'Violinschlüssel', bass: 'Bassschlüssel', alto: 'Altschlüssel', tenor: 'Tenorschlüssel' },
    progress: (correct, total) => `${correct} / ${total} richtig`, staff: 'Antwortsystem', emptyStaff: 'Noch keine Note gesetzt', error: 'Das Notenbild konnte nicht geladen werden. Bitte lade die Seite neu.',
    noInstrument: 'Keine passenden Instrumente im Link. Es werden alle Instrumente verwendet.',
  },
  en: {
    back: '← Spot errors', eyebrow: 'TRANSPOSITION · ENTER A NOTE', forward: 'Written → Sounding', reverse: 'Sounding → Written', interval: 'Choose the interval',
    directions: 'Exercise direction', given: 'GIVEN', answer: 'YOUR ENTRY', solution: 'SOLUTION',
    written: 'Written note', sounding: 'Sounding note', writtenPrompt: 'How does this written note sound?', soundingPrompt: 'How is this sounding note written for this instrument?',
    help: 'Click or tap the staff. Use ↑ and ↓ to place and move the note, and ← and → to choose the accidental.',
    start: 'Place the requested note on the answer staff.', check: 'Check', next: 'Next', showSolution: 'Show solution', showAnswer: 'Show my note',
    good: 'Correct.', almost: 'Right pitch, different spelling.', wrong: 'Not quite.', expected: 'Expected:', entered: 'Your note:',
    accidentals: 'Accidentals', accidentalNames: ['Flat', 'Natural', 'Sharp'], clefs: { treble: 'Treble clef', bass: 'Bass clef', alto: 'Alto clef', tenor: 'Tenor clef' },
    progress: (correct, total) => `${correct} / ${total} correct`, staff: 'Answer staff', emptyStaff: 'No note placed yet', error: 'The notation could not be loaded. Please reload the page.',
    noInstrument: 'No matching instruments in this link. All instruments will be used.',
  },
};

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const forward = 'written-to-sounding';
const reverse = 'sounding-to-written';
const direction = params.get('direction') === reverse ? reverse : forward;
const forwardMode = direction === forward;
const tokens = params.getAll('instruments').flatMap(s => s.split(',')).map(s => s.trim()).filter(Boolean);
const selected = INSTRUMENTS.filter(i => tokens.includes(i.id) || (FAMILIES.some(f => f.id === i.family) && tokens.includes(i.family)));
const instrumentIds = selected.length ? selected.map(i => i.id) : INSTRUMENTS.map(i => i.id);
const invalidSelection = params.has('instruments') && !selected.length;
let lang = params.get('lang') === 'en' || params.get('lang') === 'de'
  ? params.get('lang') : loadState().state.config.language;
if (lang !== 'en') lang = 'de';

let question, givenStaff, staff, result;
let step = null;
let accidental = 0;
let showSolution = false;
let loading = false;
let failed = false;
let total = 0;
let correct = 0;
const recentSignatures = [];

const c = () => COPY[lang];
const namedKey = key => formatEntryKey(key, lang);

function updateLinks() {
  for (const [id, dir] of [['entry-forward', forward], ['entry-reverse', reverse]]) {
    const next = new URL(location.href);
    next.searchParams.set('direction', dir);
    next.searchParams.set('lang', lang);
    $(id).href = next.href;
    if (dir === direction) $(id).setAttribute('aria-current', 'page');
    else $(id).removeAttribute('aria-current');
  }
  const intervalLink = $('entry-interval');
  if (intervalLink) {
    const interval = new URL('./interval-practice.html', location.href);
    interval.searchParams.set('lang', lang);
    if (params.has('instruments')) interval.searchParams.set('instruments', tokens.join(','));
    if (params.has('errors')) interval.searchParams.set('errors', params.get('errors'));
    intervalLink.href = interval.href;
  }
  const back = new URL('./index.html', location.href);
  if (selected.length) back.searchParams.set('instruments', tokens.join(','));
  if (params.has('errors')) back.searchParams.set('errors', params.get('errors'));
  $('back-to-quiz').href = back.href;
}

function update() {
  const copy = c();
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-copy]').forEach(node => { node.textContent = copy[node.dataset.copy]; });
  $('entry-language').textContent = lang === 'de' ? 'EN' : 'DE';
  $('entry-language').setAttribute('aria-label', lang === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln');
  $('entry-directions').setAttribute('aria-label', copy.directions);
  $('entry-accidentals').setAttribute('aria-label', copy.accidentals);
  $('entry-instrument').textContent = getInstrument(question.instrumentId).names[lang];
  $('entry-instruction').textContent = forwardMode ? copy.writtenPrompt : copy.soundingPrompt;
  $('given-label').textContent = forwardMode ? copy.written : copy.sounding;
  $('answer-label').textContent = forwardMode ? copy.sounding : copy.written;
  $('given-clef').textContent = copy.clefs[question.given.clef];
  $('answer-clef').textContent = copy.clefs[question.expected.clef];
  $('entry-stats').textContent = copy.progress(correct, total);
  $('entry-answer-kicker').textContent = showSolution ? copy.solution : copy.answer;
  givenStaff?.update({ label: `${$('given-label').textContent} · ${$('given-clef').textContent} · ${namedKey(question.given.key)}` });
  const shown = showSolution ? parseEntryKey(question.expected.key) : { step, accidental };
  const pitch = shown.step == null ? null : entryPitch(shown.step, shown.accidental);
  staff?.update({
    ...shown, locked: loading || !!result, tone: showSolution || result === 'correct' ? 'correct' : result ? 'incorrect' : 'normal',
    label: `${copy.staff} · ${$('answer-label').textContent} · ${$('answer-clef').textContent}`,
    valueText: pitch ? namedKey(pitch.key) : shown.accidental
      ? `${copy.emptyStaff} · ${copy.accidentalNames[shown.accidental + 1]}` : copy.emptyStaff,
  });
  $('entry-note-name').textContent = pitch ? namedKey(pitch.key) : '—';
  $('entry-accidentals').querySelectorAll('button').forEach((button, i) => {
    button.disabled = loading || !!result;
    button.setAttribute('aria-label', copy.accidentalNames[i]);
    button.setAttribute('aria-pressed', String(Number(button.dataset.accidental) === shown.accidental));
  });
  $('entry-check').disabled = loading || failed || step == null;
  $('entry-check').hidden = !!result;
  $('entry-next').hidden = !result;
  $('entry-solution').hidden = !result || result === 'correct';
  $('entry-solution').textContent = showSolution ? copy.showAnswer : copy.showSolution;
  $('entry-solution').setAttribute('aria-pressed', String(showSolution));
  const feedback = $('entry-feedback');
  feedback.closest('.entry-footer').dataset.result = result ?? '';
  if (!result) {
    feedback.textContent = failed ? copy.error : invalidSelection ? copy.noInstrument : copy.start;
  } else {
    const heading = document.createElement('strong');
    const entered = namedKey(entryPitch(step, accidental).key);
    const expected = namedKey(question.expected.key);
    heading.textContent = result === 'correct' ? copy.good : result === 'enharmonic' ? copy.almost : copy.wrong;
    feedback.replaceChildren(heading, document.createTextNode(
      `${result === 'correct' ? '' : `${copy.entered} ${entered}. ${copy.expected} ${expected}. `}${question.explanation[lang]}`
    ));
  }
  updateLinks();
}

async function nextQuestion(focus = true) {
  if (loading) return;
  loading = true;
  givenStaff?.destroy();
  givenStaff = null;
  staff?.destroy();
  staff = null;
  result = undefined;
  step = null;
  accidental = 0;
  showSolution = false;
  failed = false;
  try {
    question = generateEntryQuestion({ direction, instrumentIds, recentSignatures });
    recentSignatures.push(question.signature);
    if (recentSignatures.length > 12) recentSignatures.shift();
    update();
    [givenStaff, staff] = await Promise.all([
      mountEntryStaff($('entry-given-score'), { clef: question.given.clef, ...parseEntryKey(question.given.key), readOnly: true }),
      mountEntryStaff($('entry-answer-score'), {
        clef: question.expected.clef, label: c().staff, describedBy: 'entry-staff-help',
        step, accidental, locked: true, onAccidental: setAccidental,
        onStep(value) { if (!loading && !result) { step = value; update(); } },
      }),
    ]);
  } catch (error) {
    console.error(error);
    failed = true;
  } finally {
    loading = false;
    if (question) update();
    else $('entry-feedback').textContent = c().error;
    if (focus && !failed) staff?.focus();
  }
}

function checkAnswer() {
  if (loading || failed || result || step == null) return;
  result = gradeEntryAnswer(question, { step, accidental });
  total++;
  if (result === 'correct') correct++;
  update();
  $('entry-next').focus({ preventScroll: true });
}

function setAccidental(value) {
  if (loading || failed || result || ![-1, 0, 1].includes(value) || accidental === value) return;
  accidental = value;
  update();
}

$('entry-accidentals').addEventListener('click', event => {
  const button = event.target.closest('[data-accidental]');
  if (loading || failed || result || !button) return;
  setAccidental(Number(button.dataset.accidental));
  staff?.focus();
});
$('entry-check').addEventListener('click', checkAnswer);
$('entry-next').addEventListener('click', () => nextQuestion());
$('entry-solution').addEventListener('click', () => { showSolution = !showSolution; update(); });
$('entry-language').addEventListener('click', () => {
  lang = lang === 'de' ? 'en' : 'de';
  if (question) update();
});
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey ||
      event.key !== 'Enter' || event.target.closest?.('a, button, input, select, textarea')) return;
  event.preventDefault();
  if (result) nextQuestion();
  else checkAnswer();
});

await nextQuestion();
