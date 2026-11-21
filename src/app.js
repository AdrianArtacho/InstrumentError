import { notationForPitchView } from './pitch-view.js?v=1.4.0';
import { playPitch, stopPitch } from './pitch-audio.js?v=1.3.0';
import { readExerciseLink, makeExerciseLink } from './exercise-link.js?v=1.3.0';
import { FAMILIES, INSTRUMENTS, getInstrument, noteName } from './instruments.js';
import { RULES, getRule, generateQuestion, getEligibleInstruments, validateQuestion } from './engine.js?v=1.3.0';
import { loadState, defaultState, saveState, selectAnswer, resolveAnswer, setQuestion, newSession, aggregateStats } from './session.js?v=1.3.0';
import { renderScore } from './notation.js?v=1.4.1';
import { TEXT } from './i18n.js?v=1.6.0';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const exercise = readExerciseLink(params);
const namespace = JSON.stringify([params.get('preview') === '1', exercise.config ?? null]);
const storage = params.get('preview') === '1' || exercise.config ? {
  getItem: key => localStorage.getItem((exercise.config ? `instrument-error.link.${namespace}.${key}` : `instrument-error.preview.${key}`)),
  setItem: (key,value) => localStorage.setItem((exercise.config ? `instrument-error.link.${namespace}.${key}` : `instrument-error.preview.${key}`),value),
} : undefined;
const loaded = loadState(storage);
let state = loaded.state;
const allInstruments = INSTRUMENTS.map(i => i.id);
const allRules = RULES.map(r => r.id);
const defaultConfig = { language: 'de', instrumentIds: allInstruments, ruleIds: allRules, ...exercise.config };
if (loaded.status !== 'loaded') state = defaultState(defaultConfig);
if (exercise.config && ['instrumentIds','ruleIds'].some(key => JSON.stringify(state.config[key]) !== JSON.stringify(exercise.config[key]))) {
  state = { ...state, config: { ...state.config, ...exercise.config }, active: { ...state.active, current: null }, lastResult: null };
}
state.config.instrumentIds = state.config.instrumentIds.filter(id => getInstrument(id));
state.config.ruleIds = state.config.ruleIds.filter(id => getRule(id));
if (!getEligibleInstruments(state.config).length) state.config = { ...defaultConfig, language: state.config.language };
if (state.active.current && (!getInstrument(state.active.current.question.instrumentId) || validateQuestion(state.active.current.question).length !== (state.active.current.question.answer === 'incorrect' ? 1 : 0) || (state.active.current.phase !== 'resolved' && state.active.current.question.scenario === 'written-range' && !state.active.current.question.rangeContext))) {
  state = { ...state, active: { ...state.active, current: null }, lastResult: null };
}
let draft = { instrumentIds: [...state.config.instrumentIds], ruleIds: [...state.config.ruleIds] };
let showCorrected = false;
let preferredPitchView = 'written';
let busy = true;
let saveFailed = loaded.status === 'unavailable';
let notice = exercise.invalid ? 'invalidExercise' : loaded.status === 'corrupt' ? 'storageCorrupt' : null;
let renderVersion = 0;
const lang = () => state.config.language;
const t = key => TEXT[lang()][key] ?? key;
const name = item => item?.names?.[lang()] ?? '';
const familyName = id => name(FAMILIES.find(f => f.id === id));
const element = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const familyIcons = {
 strings:'<path d="M8 3v18m4-18v18m4-18v18M4 19 20 5"/>',
 woodwinds:'<path d="m8 3 7 18m-3-19 7 18M8 8l5-2m-3 7 5-2m-3 7 5-2"/>',
 brass:'<path d="M3 11h8l7-5v12l-7-5H3m4-2V7h5v4M8 13v5h6v-3"/>',
 percussion:'<path d="m5 20 12-14m2 14L7 6"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="5" r="3"/>'
};

function persist() {
  saveFailed = !saveState(state,storage);
  updateStorageNotice();
}
function updateStorageNotice() {
  const key = saveFailed ? 'storageUnavailable' : notice;
  $('storage-notice').hidden = !key;
  if (key) $('storage-notice').textContent = t(key);
}
function translatePage() {
  document.documentElement.lang = lang();
  document.title = `InstrumentError · ${lang() === 'de' ? 'Instrumentationsquiz' : 'Orchestration quiz'}`;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $('language-button').textContent = lang() === 'de' ? 'EN' : 'DE';
  $('language-button').setAttribute('aria-label', lang() === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln');
  $('fullscreen-button').setAttribute('aria-label', t(document.fullscreenElement ? 'exitFullscreen' : 'fullscreen'));
  $('fullscreen-button').title = t(document.fullscreenElement ? 'exitFullscreen' : 'fullscreen');
  for(const [id,key] of [['settings-button','settings'],['progress-button','progress']]) { $(id).setAttribute('aria-label',t(key)); $(id).title=t(key); }
  document.querySelector('.answer-section').setAttribute('aria-label',t('answerPrompt'));
  document.querySelectorAll('.icon-button.dialog-close').forEach(el => el.setAttribute('aria-label', t('close')));
  updateStorageNotice();
}
function entryPracticeUrl(direction, instrumentIds) {
  const url = new URL(direction ? './note-entry.html' : './interval-practice.html', location.href);
  if (direction) url.searchParams.set('direction', direction);
  url.searchParams.set('lang', lang());
  if (instrumentIds.length) url.searchParams.set('instruments', instrumentIds.join(','));
  if (params.has('errors')) url.searchParams.set('errors', state.config.ruleIds.join(','));
  return url.href;
}
function renderFilters() {
  const active=document.activeElement;
  const restoreFamily=active?.dataset?.family;
  const restoreInput=active?.tagName==='INPUT'?active.value:null;
  const families = $('family-filters'); families.replaceChildren();
  for (const family of FAMILIES) {
    const members = INSTRUMENTS.filter(i => i.family === family.id);
    const selected = members.filter(i => draft.instrumentIds.includes(i.id)).length;
    const button = element('button', `family-button${selected && selected < members.length ? ' partial' : ''}`);
    button.type = 'button'; button.dataset.family = family.id;
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.setAttribute('aria-label', `${name(family)} (${selected}/${members.length})`);
    const icon = element('span', 'family-icon'); icon.setAttribute('aria-hidden','true');
    icon.innerHTML = `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${familyIcons[family.id]}</svg>`;
    button.append(icon, element('span', '', name(family)), element('span', 'family-check', selected < members.length ? '−' : '✓'));
    button.addEventListener('click', () => {
      const ids = members.map(i => i.id);
      draft.instrumentIds = selected === members.length ? draft.instrumentIds.filter(id => !ids.includes(id)) : [...new Set([...draft.instrumentIds, ...ids])];
      renderFilters();
    });
    families.append(button);
  }
  const instruments = $('instrument-filters'); const scrollTop = instruments.scrollTop; instruments.replaceChildren();
  for (const family of FAMILIES) {
    instruments.append(element('p','instrument-group',name(family)));
    for (const item of INSTRUMENTS.filter(i => i.family === family.id)) {
      const label = element('label'); const input = element('input'); input.type='checkbox'; input.value=item.id; input.checked=draft.instrumentIds.includes(item.id);
      input.addEventListener('change', () => { draft.instrumentIds = input.checked ? [...draft.instrumentIds,item.id] : draft.instrumentIds.filter(id => id !== item.id); renderFilters(); });
      label.append(input, element('span','',name(item))); instruments.append(label);
    }
  }
  instruments.scrollTop = scrollTop;
  const rules = $('rule-filters'); rules.replaceChildren();
  for (const rule of RULES) {
    const label = element('label'); label.title=rule.description[lang()];
    const input = element('input'); input.type='checkbox';input.value=rule.id;input.checked=draft.ruleIds.includes(rule.id);
    input.addEventListener('change',()=>{draft.ruleIds=input.checked?[...draft.ruleIds,rule.id]:draft.ruleIds.filter(id=>id!==rule.id);renderFilters();});
    label.append(input,element('span','',name(rule)));rules.append(label);
  }
  $('entry-forward-link').href = entryPracticeUrl('written-to-sounding', draft.instrumentIds);
  $('entry-reverse-link').href = entryPracticeUrl('sounding-to-written', draft.instrumentIds);
  $('entry-interval-link').href = entryPracticeUrl(null, draft.instrumentIds);
  $('selected-count').textContent=draft.instrumentIds.length;
  const eligible=getEligibleInstruments(draft);
  $('filter-note').textContent=eligible.length?`${eligible.length} ${t('validSelection')}${eligible.length<draft.instrumentIds.length?' '+t('noApplicable'):''}`:t('noSelection');
  const changed=JSON.stringify([...draft.instrumentIds].sort())!==JSON.stringify([...state.config.instrumentIds].sort())||JSON.stringify([...draft.ruleIds].sort())!==JSON.stringify([...state.config.ruleIds].sort());
  $('apply-filters').hidden=!changed;
  $('apply-filters').disabled=!eligible.length;
  $('share-url').disabled=!eligible.length;
  $('share-url').value=eligible.length ? makeExerciseLink(location.href,draft,$('share-fullscreen').checked) : '';
  $('selection-status').textContent=changed&&eligible.length?t('pendingFilters'):'';
  if(restoreFamily)families.querySelector(`[data-family="${CSS.escape(restoreFamily)}"]`)?.focus({preventScroll:true});
  else if(restoreInput)document.querySelector(`.settings-content input[value="${CSS.escape(restoreInput)}"]`)?.focus({preventScroll:true});
}
function updateStats() {
  const stats=aggregateStats(state).session;
  $('points-stat').textContent=stats.points;
  $('accuracy-stat').textContent=stats.answered?`${stats.accuracy}%`:'—';
  $('streak-stat').textContent=stats.streak;
  $('streak-stat').title=`${stats.streak} ${t('inARow')}`;
  const inRound=stats.answered>0&&stats.answered%10===0&&state.active.current?.phase==='resolved'?10:stats.answered%10;
  $('round-stat').textContent=`${inRound}/10`;
  $('round-bar').style.width=`${inRound*10}%`;
}
function makeQuestion() {
  const rounds=state.active.rounds;
  const question=generateQuestion({...state.config,recentSignatures:rounds.map(r=>r.question.signature),recentAnswers:rounds.slice(-12).map(r=>r.question.answer)});
  state=setQuestion(state,question);showCorrected=false;persist();updateStats();
}
let shownConcertPitch;
let shownConcertQuestion;
function concertPitch(question) {
  return showCorrected ? question.corrected?.soundingPitch ?? question.soundingPitch : question.soundingPitch;
}
function updateConcertPitch(question, phase) {
  const midi = concertPitch(question);
  if (midi !== shownConcertPitch || question.id !== shownConcertQuestion) {
    stopPitch();
    $('concert-audio-status').textContent = '';
    $('play-concert').classList.remove('audio-unavailable');
  }
  shownConcertPitch = midi;
  shownConcertQuestion = question.id;
  const panel = $('concert-pitch');
  const active = Number.isInteger(midi);
  panel.hidden = !active;
  panel.closest('.score-display').classList.toggle('with-concert', active);
  if (!active) return;
  panel.classList.toggle('concert-corrected', showCorrected);
  panel.classList.toggle('concert-mismatch', phase === 'resolved' && question.answer === 'incorrect' && !showCorrected);
  $('concert-label').textContent = t(showCorrected ? 'concertCorrected' : 'concertReference');
  $('concert-note-name').textContent = noteName(midi,lang());
  $('play-concert').disabled = !globalThis.AudioContext && !globalThis.webkitAudioContext;
  const unavailable = $('play-concert').disabled || $('play-concert').classList.contains('audio-unavailable');
  $('play-concert').title = t(unavailable ? 'audioUnavailable' : 'playConcert');
  $('play-concert').querySelector('[data-i18n]').textContent = t(unavailable ? 'audioUnavailableShort' : 'playConcert');
  return { clef: midi < 60 ? 'bass' : 'treble', notes: [{ pitches: [midi], duration: 'q' }] };
}
function updatePitchView(question, phase) {
  const locked = Number.isInteger(question.soundingPitch) && phase !== 'resolved';
  const view = locked ? 'written' : preferredPitchView;
  $('pitch-view-group').setAttribute('aria-label', t('viewLabel'));
  $('view-written').setAttribute('aria-pressed', String(view === 'written'));
  $('view-sounding').setAttribute('aria-pressed', String(view === 'sounding'));
  $('view-sounding').disabled = locked;
  $('view-sounding').title = locked ? t('viewAfterResolve') : '';
  $('pitch-view-hint').hidden = !locked;
  return view;
}
async function drawQuestion() {
  const current=state.active.current;if(!current)return;
  const version=++renderVersion;busy=true;
  const {question,phase}=current;const instrument=getInstrument(question.instrumentId);
  const answered=aggregateStats(state).session.answered;
  $('question-number').textContent=`${t('question')} ${String(answered+(phase==='resolved'?0:1)).padStart(2,'0')}`;
  $('instrument-family').textContent=familyName(instrument.family);
  $('question-heading').textContent=name(instrument);
  const view = updatePitchView(question, phase);
  const correctedNotation = showCorrected && !Number.isInteger(question.soundingPitch);
  $('question-card').classList.toggle('is-corrected',correctedNotation);
  const displayQuestion = notationForPitchView(question, instrument, view, correctedNotation);
  $('clef-label').textContent = t(displayQuestion.clef);
  document.querySelector('.notation-badge').textContent = t(view === 'sounding'
    ? (correctedNotation ? 'soundingCorrected' : 'soundingPitch')
    : (correctedNotation ? 'writtenCorrected' : 'writtenPitch'));
  $('entry-current-link').hidden = !Number.isInteger(question.soundingPitch);
  $('entry-current-link').href = entryPracticeUrl('written-to-sounding', state.config.instrumentIds);
  $('interval-current-link').hidden = $('entry-current-link').hidden;
  $('interval-current-link').href = entryPracticeUrl(null, state.config.instrumentIds);
  $('score').setAttribute('aria-busy','true');
  const concert = updateConcertPitch(question,phase);
  updateAnswerControls();
  try {
    const engraving = renderScore($('score'),displayQuestion,{reveal:phase==='resolved',corrected:correctedNotation,language:lang(),fit:true});
    if (concert) {
      await Promise.all([engraving, renderScore($('concert-score'),concert,{language:lang(),fit:true,miniature:true})]);
    } else {
      await engraving;
    }
    if(version!==renderVersion)return;
    busy=false;$('score').setAttribute('aria-busy','false');
  } catch(error) {
    console.error('Notation rendering failed:',error);
    if(version!==renderVersion)return;
    $('score').replaceChildren(element('p','error-message',t('renderError')));
    $('score').setAttribute('aria-busy','false');busy=true;
  }
  updateAnswerControls();
}
function updateAnswerControls() {
  const current=state.active.current;const resolved=current?.phase==='resolved';
  for(const [id,choice] of [['answer-correct','correct'],['answer-incorrect','incorrect']]) {
    $(id).disabled=busy||resolved;$(id).setAttribute('aria-pressed',current?.choice===choice?'true':'false');
  }
  $('resolve-button').hidden=resolved;
  $('next-button').hidden=!resolved;
  $('resolve-button').disabled=busy||current?.phase!=='chosen';
  $('next-button').disabled=busy;
  $('feedback-placeholder').hidden=resolved;
  $('main').dataset.phase=current?.phase??'answer';
  const prompt = t(Number.isInteger(current?.question.soundingPitch) ? 'transpositionPrompt' : 'answerPrompt');
  $('answer-prompt').textContent = prompt;
  document.querySelector('.answer-section').setAttribute('aria-label',prompt);
  $('answer-instruction').textContent=t(current?.phase==='chosen'?'changeChoice':'answerInstruction');
  $('feedback').hidden=!resolved;
  if(resolved)renderFeedback();
}
function renderFeedback() {
  const {question,choice}=state.active.current;
  const correct=choice===question.answer;const erroneous=question.answer==='incorrect';
  const instrument=getInstrument(question.instrumentId);const rule=getRule(question.ruleId);
  $('feedback').classList.toggle('missed',!correct);
  $('feedback-icon').textContent=correct?'✓':'↗';
  $('feedback-result').textContent=t(correct?'nice':'missed');
  $('feedback-title').textContent=erroneous?name(rule):t('noError');
  $('details-title').textContent=$('feedback-title').textContent;
  $('feedback-summary').textContent=question.feedback?.[lang()]??t(erroneous?`summary_${question.ruleId}`:'noIssues');
  $('point-pill').textContent=`+${correct?10:0} ${t('earned')}`;
  $('explanation').textContent=question.explanation?.[lang()]??t(erroneous?'ruleError':'noIssues');
  $('correction-note').textContent=question.correction?.[lang()]??'';
  $('correction-note').hidden=!erroneous;
  $('correction-toggle').hidden=!erroneous;
  $('correction-toggle').textContent=t(showCorrected?'hideCorrectionShort':'showCorrectionShort');
  const [low,high]=instrument.writtenRange;
  $('range-reference').textContent=`${t('rangeModel')}: ${t('rangeWritten')} ${noteName(low,lang())}–${noteName(high,lang())}; ${t('rangeSounding')} ${noteName(low+instrument.transpose,lang())}–${noteName(high+instrument.transpose,lang())}. ${instrument.rangeNotes[lang()]}`;
  const links=$('source-links');links.replaceChildren();
  if(instrument.source?.url){const link=element('a','',`${instrument.source.title} ↗`);link.href=instrument.source.url;link.target='_blank';link.rel='noopener';links.append(link);}
  if (question.scenario === 'written-range' || question.ruleId === 'written-range') {
    const label = lang() === 'de' ? 'Tonumfangstabellen von Adrián Artacho (MUK Drive) ↗' : 'Instrument range charts by Adrián Artacho (MUK Drive) ↗';
    const chartLink = element('a', '', label);
    chartLink.href = 'https://mukuni-my.sharepoint.com/:f:/g/personal/a_artacho_muk_ac_at/IgBVvBVP6pwGQ7s0uGhQiRvqAb90Msb3DzYXnXqyjsv2p8c?e=pzRmT0';
    chartLink.target = '_blank';
    chartLink.rel = 'noopener noreferrer';
    links.append(chartLink);
  }
  const ruleLink=element('a','',t('sourcesRules'));ruleLink.href='./docs/rules.md';ruleLink.target='_blank';ruleLink.rel='noopener';links.append(ruleLink);
  const stats=aggregateStats(state).session;
  $('milestone').hidden=!stats.answered||stats.answered%10!==0;
  $('milestone').textContent=t('milestoneShort');
}
async function refresh() {
  translatePage();renderFilters();updateStats();
  if(!state.active.current)makeQuestion();
  await drawQuestion();
}
function choose(choice) {
  if(busy||state.active.current?.phase==='resolved')return;
  state=selectAnswer(state,choice);persist();updateAnswerControls();
  $('resolve-button').focus({preventScroll:true});
}
async function resolve() {
  if(busy||state.active.current?.phase!=='chosen')return;
  state=resolveAnswer(state);showCorrected=false;persist();updateStats();
  await drawQuestion();$('feedback-title').focus({preventScroll:true});
}
async function next() {
  if(busy||state.active.current?.phase!=='resolved')return;
  makeQuestion();await drawQuestion();
  $('question-heading').focus({preventScroll:true});
}
function openDialog(id) { $(id).showModal(); }
function renderProgress() {
  const total=aggregateStats(state);const grid=$('lifetime-stats');grid.replaceChildren();
  for(const [value,label] of [[total.answered,'totalQuestions'],[total.answered?`${total.accuracy}%`:'—','totalAccuracy'],[total.bestStreak,'bestStreak']]) {
    const box=element('div');box.append(element('strong','',value),element('span','',t(label)));grid.append(box);
  }
  const rounds=[...[...state.history].reverse().flatMap(s=>s.rounds),...state.active.rounds].slice(-10).reverse();
  const list=$('round-history');list.replaceChildren();
  if(!rounds.length)list.append(element('p','',t('emptyHistory')));
  for(const round of rounds) {
    const row=element('div',`history-row${round.correct?'':' missed'}`);
    const details=element('div');details.append(element('span','',name(getInstrument(round.question.instrumentId))));
    details.append(element('small','',round.question.ruleId?name(getRule(round.question.ruleId)):t('noError')));
    row.append(element('span','',round.correct?'✓':'×'),details,element('span','',round.correct?'+10':'0'));
    list.append(row);
  }
}
for (const view of ['written', 'sounding']) {
  $(`view-${view}`).addEventListener('click', () => {
    if (busy || $(`view-${view}`).disabled) return;
    preferredPitchView = view;
    drawQuestion();
  });
}
$('play-concert').addEventListener('click',async()=>{
  const question = state.active.current?.question;
  if (!question || busy) return;
  const midi = concertPitch(question);
  if (!Number.isInteger(midi)) return;
  try {
    if (!await playPitch(midi) || shownConcertQuestion !== question.id || shownConcertPitch !== midi) return;
    $('play-concert').querySelector('[data-i18n]').textContent = t('playConcert');
    $('play-concert').title = t('playConcert');
    $('concert-audio-status').textContent = '';
    $('play-concert').classList.remove('audio-unavailable');
  } catch {
    if (shownConcertQuestion !== question.id || shownConcertPitch !== midi) return;
    $('concert-audio-status').textContent = t('audioUnavailable');
    $('play-concert').classList.add('audio-unavailable');
    $('play-concert').querySelector('[data-i18n]').textContent = t('audioUnavailableShort');
    $('play-concert').title = t('audioUnavailable');
  }
});
$('answer-correct').addEventListener('click',()=>choose('correct'));
$('answer-incorrect').addEventListener('click',()=>choose('incorrect'));
$('resolve-button').addEventListener('click',resolve);
$('next-button').addEventListener('click',next);
$('correction-toggle').addEventListener('click',async()=>{if(busy)return;showCorrected=!showCorrected;await drawQuestion();});
$('language-button').addEventListener('click',async()=>{state={...state,config:{...state.config,language:lang()==='de'?'en':'de'}};persist();await refresh();if($('progress-dialog').open)renderProgress();});
$('apply-filters').addEventListener('click',async()=>{
  if(!getEligibleInstruments(draft).length)return;
  state={...state,config:{...state.config,instrumentIds:[...draft.instrumentIds],ruleIds:[...draft.ruleIds]}};
  makeQuestion();renderFilters();$('settings-dialog').close();await drawQuestion();
  $('question-heading').focus({preventScroll:true});
});
$('settings-button').addEventListener('click',()=>{draft={instrumentIds:[...state.config.instrumentIds],ruleIds:[...state.config.ruleIds]};renderFilters();openDialog('settings-dialog');});
$('settings-dialog').addEventListener('close',()=>{draft={instrumentIds:[...state.config.instrumentIds],ruleIds:[...state.config.ruleIds]};renderFilters();});
$('details-button').addEventListener('click',()=>openDialog('details-dialog'));
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));
$('progress-button').addEventListener('click',()=>{renderProgress();openDialog('progress-dialog');});
$('new-session').addEventListener('click',()=>openDialog('new-session-dialog'));
$('confirm-new-session').addEventListener('click',async()=>{state=newSession(state);makeQuestion();$('new-session-dialog').close();if($('settings-dialog').open)$('settings-dialog').close();updateStats();await drawQuestion();$('question-heading').focus({preventScroll:true});});
$('export-button').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({app:'InstrumentError',exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=element('a');link.href=url;link.download=`${t('exportName')}-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('share-fullscreen').checked=exercise.fullscreen;
$('share-fullscreen').addEventListener('change',renderFilters);
$('share-url').addEventListener('focus',()=> $('share-url').select());
$('fullscreen-start').hidden=!exercise.fullscreen;
$('fullscreen-start').addEventListener('click',()=> $('fullscreen-button').click());
$('fullscreen-button').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw new Error('Fullscreen unavailable');}
  catch{notice='noFullscreen';updateStorageNotice();}
});
document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement)$('fullscreen-start').hidden=true;
  const key=document.fullscreenElement?'exitFullscreen':'fullscreen';
  $('fullscreen-button').setAttribute('aria-label',t(key));
  $('fullscreen-button').title=t(key);
});
document.querySelectorAll('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
document.addEventListener('keydown',event=>{
  if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA','SUMMARY','A'].includes(event.target.tagName)||event.target.isContentEditable)return;
  const key=event.key.toLowerCase();
  if(key==='k'){event.preventDefault();choose('correct');}
  else if(key==='f'){event.preventDefault();choose('incorrect');}
  else if(key==='enter'&&(event.target.tagName!=='BUTTON'||event.target.id.startsWith('answer-'))){event.preventDefault();state.active.current?.phase==='resolved'?next():resolve();}
});
let resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.active.current)drawQuestion();},120);});
await refresh();
persist();
