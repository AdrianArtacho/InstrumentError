import { FAMILIES, INSTRUMENTS, getInstrument } from './instruments.js';
import { generateIntervalQuestion } from './interval-practice.js?v=1.6.0';
import { loadState } from './session.js?v=1.3.0';

const COPY = {
  de: {
    title: 'TRANSPOSITION · INTERVALL WÄHLEN',
    back: '← Fehler erkennen', forward: 'Notiert → Klingend', reverse: 'Klingend → Notiert', current: 'Intervall wählen',
    modes: 'Transpositionsübungen', instrument: 'INSTRUMENT', options: 'ANTWORTMÖGLICHKEITEN',
    reference: 'Von der notierten Note zum klingenden Ton',
    prompt: 'Wie klingt das Instrument im Vergleich zur Notation?',
    help: 'Mit ↑ und ↓ wählen, mit Enter prüfen und weitergehen. Du kannst die Antwort auch anklicken.',
    choose: 'Wähle das Intervall von notiert zu klingend.',
    check: 'Prüfen', next: 'Weiter', correct: 'Richtig.', incorrect: 'Nicht ganz.',
    correctOption: 'Richtig', pickedOption: 'Deine Wahl',
    progress: (correct, total) => `${correct} / ${total} richtig`,
    invalid: 'Keine passenden Instrumente im Link. Es werden alle Instrumente verwendet.',
  },
  en: {
    title: 'TRANSPOSITION · CHOOSE THE INTERVAL',
    back: '← Spot errors', forward: 'Written → Sounding', reverse: 'Sounding → Written', current: 'Choose the interval',
    modes: 'Transposition exercises', instrument: 'INSTRUMENT', options: 'ANSWER CHOICES',
    reference: 'From the written note to the sounding pitch',
    prompt: 'How does this instrument sound compared to the written note?',
    help: 'Use ↑ and ↓ to choose, then Enter to check and continue. You can also click an answer.',
    choose: 'Choose the interval from written to sounding.',
    check: 'Check', next: 'Next', correct: 'Correct.', incorrect: 'Not quite.',
    correctOption: 'Correct', pickedOption: 'Your choice',
    progress: (correct, total) => `${correct} / ${total} correct`,
    invalid: 'No matching instruments in this link. All instruments will be used.',
  },
};

const $ = id => document.getElementById(id);
const group = $('interval-options');
const params = new URLSearchParams(location.search);
const tokens = params.getAll('instruments').flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean);
const selection = INSTRUMENTS.filter(item => tokens.includes(item.id) || tokens.includes(item.family)).map(item => item.id);
const invalidSelection = params.has('instruments') && !selection.length;
const urlLanguage = params.get('lang');
let language = ['de', 'en'].includes(urlLanguage) ? urlLanguage : loadState().state.config.language;
const recentInstrumentIds = [];
let question;
let selected = -1;
let result;
let total = 0;
let correct = 0;

const copy = () => COPY[language];
const radioAt = index => group.children[index]?.querySelector('input');
function updateLinks() {
  const links = [
    ['interval-forward', 'note-entry.html', 'written-to-sounding'],
    ['interval-reverse', 'note-entry.html', 'sounding-to-written'],
    ['interval-current', 'interval-practice.html'],
    ['interval-back', 'index.html'],
  ];
  for (const [id, path, direction] of links) {
    const url = new URL('./' + path, location.href);
    if (direction) url.searchParams.set('direction', direction);
    if (id !== 'interval-back') url.searchParams.set('lang', language);
    if (selection.length) url.searchParams.set('instruments', tokens.join(','));
    if (params.has('errors')) url.searchParams.set('errors', params.get('errors'));
    $(id).href = url.href;
  }
}

function renderOptions() {
  group.replaceChildren(...question.options.map((option, index) => {
    const label = document.createElement('label');
    label.className = 'interval-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'interval';
    radio.value = String(index);
    radio.addEventListener('change', () => select(index));
    const title = document.createElement('span');
    const mark = document.createElement('span');
    mark.className = 'interval-option-mark';
    label.append(radio, title, mark);
    return label;
  }));
}

function updateChoices() {
  question.options.forEach((option, index) => {
    const label = group.children[index];
    const [radio, title, mark] = label.children;
    const key = option.offset === question.correctOffset ? 'correct' : index === selected ? 'incorrect' : '';
    delete label.dataset.result;
    if (result && key) label.dataset.result = key;
    radio.checked = selected === index;
    radio.tabIndex = index === Math.max(0, selected) ? 0 : -1;
    radio.disabled = !!result;
    title.textContent = option.label[language];
    mark.textContent = !result || !key ? '' : key === 'correct' ? copy().correctOption : copy().pickedOption;
  });
  $('interval-check').disabled = selected < 0;
}

function update() {
  const text = copy();
  document.documentElement.lang = language;
  document.title = 'InstrumentError · ' + text.current;
  document.querySelectorAll('[data-copy]').forEach(node => { node.textContent = text[node.dataset.copy]; });
  $('interval-language').textContent = language === 'de' ? 'EN' : 'DE';
  $('interval-language').setAttribute('aria-label', language === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln');
  $('interval-modes').setAttribute('aria-label', text.modes);
  const instrument = getInstrument(question.instrumentId);
  $('interval-instrument').textContent = instrument.names[language];
  $('interval-family').textContent = FAMILIES.find(family => family.id === instrument.family).names[language];
  $('interval-stats').textContent = text.progress(correct, total);
  $('interval-check').hidden = !!result;
  $('interval-next').hidden = !result;
  const feedback = $('interval-feedback');
  feedback.closest('.entry-footer').dataset.result = result ?? '';
  if (result) {
    const heading = document.createElement('strong');
    heading.textContent = text[result];
    feedback.replaceChildren(heading, document.createTextNode(question.explanation[language]));
  } else {
    feedback.textContent = invalidSelection ? text.invalid : text.choose;
  }
  updateChoices();
  updateLinks();
}

function select(index) {
  if (result) return;
  selected = index;
  updateChoices();
}

function check() {
  if (result || selected < 0) return;
  result = question.options[selected].offset === question.correctOffset ? 'correct' : 'incorrect';
  if (result === 'correct') correct++;
  total++;
  update();
  $('interval-next').focus({ preventScroll: true });
}

function next() {
  question = generateIntervalQuestion({ instrumentIds: selection.length ? selection : undefined, recentInstrumentIds });
  recentInstrumentIds.push(question.instrumentId);
  if (recentInstrumentIds.length > 4) recentInstrumentIds.shift();
  selected = -1;
  result = undefined;
  renderOptions();
  update();
  radioAt(0)?.focus({ preventScroll: true });
}

group.addEventListener('keydown', event => {
  if (result || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    if (!event.repeat) check();
    return;
  }
  const delta = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key];
  if (!delta) return;
  event.preventDefault();
  const size = question.options.length;
  const index = selected < 0 ? (delta > 0 ? 0 : size - 1) : (selected + delta + size) % size;
  select(index);
  radioAt(index).focus();
});
$('interval-language').addEventListener('click', () => {
  language = language === 'de' ? 'en' : 'de';
  update();
});
$('interval-check').addEventListener('click', check);
$('interval-next').addEventListener('click', next);
next();
