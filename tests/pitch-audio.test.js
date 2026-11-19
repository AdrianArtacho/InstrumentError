import assert from 'node:assert/strict';
import test from 'node:test';

function mockAudio({ suspended = false } = {}) {
  const contexts = [];
  class AudioContext {
    constructor() {
      this.state = suspended ? 'suspended' : 'running';
      this.currentTime = 1;
      this.destination = {};
      this.oscillators = [];
      this.resumeListeners = [];
      contexts.push(this);
    }

    resume() {
      return new Promise(resolve => this.resumeListeners.push(resolve));
    }

    unlock() {
      this.state = 'running';
      this.resumeListeners.splice(0).forEach(resolve => resolve());
    }

    createOscillator() {
      const node = {
        frequency: { setValueAtTime: value => { node.hz = value; } },
        connect() {},
        disconnect() { node.disconnected = true; },
        start(time) { node.started = time; },
        stop(time) { node.stopped = time; },
      };
      this.oscillators.push(node);
      return node;
    }

    createGain() {
      return {
        gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} },
        connect() {},
        disconnect() {},
      };
    }
  }
  return { contexts, AudioContext };
}

async function withMockAudio(t, AudioContext, key) {
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = AudioContext;
  t.after(() => { globalThis.AudioContext = previous; });
  return import(`../src/pitch-audio.js?${key}`);
}

test('plays the selected MIDI pitch, shares one context, and releases replaced tones', async t => {
  const { contexts, AudioContext } = mockAudio();
  const { playPitch, stopPitch } = await withMockAudio(t, AudioContext, 'running');
  assert.equal(await playPitch(69), true);
  const [ctx] = contexts;
  const [a4] = ctx.oscillators;
  assert.equal(a4.hz, 440);
  assert.equal(a4.started, 1);
  assert.ok(a4.stopped - a4.started < 1);

  ctx.currentTime = 1.1;
  assert.equal(await playPitch(57), true);
  assert.equal(contexts.length, 1);
  assert.ok(a4.stopped <= 1.12);
  a4.onended();
  assert.equal(a4.disconnected, true);

  const [, a3] = ctx.oscillators;
  assert.equal(a3.hz, 220);
  stopPitch();
  assert.ok(a3.stopped <= 1.12);
  a3.onended();
  assert.equal(a3.disconnected, true);
});

test('rapid clicks and navigation cannot start stale tones while audio unlocks', async t => {
  const { contexts, AudioContext } = mockAudio({ suspended: true });
  const { playPitch, stopPitch } = await withMockAudio(t, AudioContext, 'suspended');
  const first = playPitch(69);
  const latest = playPitch(81);
  const [ctx] = contexts;
  ctx.unlock();
  assert.deepEqual(await Promise.all([first, latest]), [false, true]);
  assert.equal(ctx.oscillators.length, 1);
  assert.equal(ctx.oscillators[0].hz, 880);

  ctx.state = 'suspended';
  const pending = playPitch(57);
  stopPitch();
  ctx.unlock();
  assert.equal(await pending, false);
  assert.equal(ctx.oscillators.length, 1);
});

test('rejects invalid pitches and reports unavailable audio', async t => {
  const { playPitch } = await withMockAudio(t, undefined, 'unavailable');
  await assert.rejects(playPitch(69.5), RangeError);
  await assert.rejects(playPitch(128), RangeError);
  await assert.rejects(playPitch(69), /unavailable/);
});
