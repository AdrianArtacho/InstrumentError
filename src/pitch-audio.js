const ATTACK = 0.025;
const HOLD = 0.47;
const RELEASE = 0.155;
const LEVEL = 0.16;

let context;
let active;
let revision = 0;

function envelopeLevel(elapsed) {
  if (elapsed <= 0) return 0;
  if (elapsed < ATTACK) return LEVEL * elapsed / ATTACK;
  if (elapsed < ATTACK + HOLD) return LEVEL;
  return LEVEL * Math.max(0, 1 - (elapsed - ATTACK - HOLD) / RELEASE);
}

/** Cancel a pending start or fade out the current tone. */
export function stopPitch() {
  revision++;
  if (!active) return;
  const { oscillator, gain, ctx, start, end } = active;
  active = undefined;
  if (ctx.state === 'closed' || ctx.currentTime >= end) return;
  const now = ctx.currentTime;
  const release = Math.min(end, now + 0.02);
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(envelopeLevel(now - start), now);
  gain.gain.linearRampToValueAtTime(0, release);
  oscillator.stop(release);
}

/** Call from a user gesture. Returns false if superseded before playback starts. */
export async function playPitch(midi) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError('Expected a MIDI pitch from 0 to 127');
  }
  stopPitch();
  const ticket = revision;
  if (!context || context.state === 'closed') {
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error('Web Audio is unavailable');
    context = new AudioContext();
  }
  const ctx = context;
  if (ctx.state !== 'running') await ctx.resume();
  if (ticket !== revision) return false;
  if (ctx.state !== 'running') throw new Error('Audio playback could not start');

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime;
  const end = start + ATTACK + HOLD + RELEASE;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(LEVEL, start + ATTACK);
  gain.gain.setValueAtTime(LEVEL, start + ATTACK + HOLD);
  gain.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const tone = { oscillator, gain, ctx, start, end };
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
    if (active === tone) active = undefined;
  };
  active = tone;
  oscillator.start(start);
  oscillator.stop(end);
  return true;
}
