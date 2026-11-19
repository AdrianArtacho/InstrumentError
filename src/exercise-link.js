import { INSTRUMENTS } from './instruments.js';
import { RULES, getEligibleInstruments } from './engine.js?v=1.3.0';

export function readExerciseLink(params) {
  const list = key => params.getAll(key).flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean);
  const instruments = list('instruments');
  const errors = list('errors');
  const fullscreen = ['1', 'true'].includes(params.get('fullscreen'));
  if (!params.has('instruments') && !params.has('errors')) return { fullscreen };
  const instrumentIds = INSTRUMENTS.filter(i => !params.has('instruments') || instruments.includes(i.id) || instruments.includes(i.family)).map(i => i.id);
  const ruleIds = RULES.filter(r => !params.has('errors') || errors.includes(r.id)).map(r => r.id);
  const config = { instrumentIds, ruleIds };
  if (instruments.some(id => !INSTRUMENTS.some(i => i.id === id || i.family === id)) ||
      errors.some(id => !RULES.some(r => r.id === id)) || !getEligibleInstruments(config).length) return { fullscreen, invalid: true };
  return { fullscreen, config };
}

export function makeExerciseLink(base, config, fullscreen) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('instruments', config.instrumentIds.join(','));
  url.searchParams.set('errors', config.ruleIds.join(','));
  if (fullscreen) url.searchParams.set('fullscreen', '1');
  return url.href;
}
