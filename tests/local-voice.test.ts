import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationalTarget, wav16k, voiceOccluded } from '../src/shared/local-voice.js';
import { finalReply, spokenText } from '../src/server/localvoice/reply.js';

test('voice only addresses a nearby facing worker, with hysteresis', () => {
  assert.equal(conversationalTarget([{ id: 'a', distance: 2, facing: -1 }, { id: 'b', distance: 4, facing: 1 }]), undefined);
  assert.equal(conversationalTarget([{ id: 'a', distance: 2, facing: 1 }, { id: 'b', distance: 1.8, facing: 1 }], 'a'), 'a');
  assert.equal(conversationalTarget([{ id: 'a', distance: 3.9, facing: 1 }], 'a'), undefined);
});
test('microphone audio is bounded mono 16k PCM with valid RIFF length', () => {
  const wav = wav16k(new Float32Array(48000).fill(0.5), 48000), v = new DataView(wav.buffer);
  assert.equal(wav.length, 32044); assert.equal(v.getUint32(24, true), 16000); assert.equal(v.getUint32(40, true), 32000);
  assert.equal(v.getInt16(44, true), 16383);
});
test('only new final assistant text can be spoken, never tools, user messages or commentary', () => {
  const line = (phase: string, role: string, text: string, timestamp = '2026-11-17T12:00:01Z') => JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'message', role, phase, content: [{ type: 'output_text', text }] } });
  const after = Date.parse('2026-11-17T12:00:00Z');
  assert.equal(finalReply([line('commentary', 'assistant', 'hidden'), line('final_answer', 'user', 'private')].join('\n'), after), null);
  assert.equal(finalReply(line('final_answer', 'assistant', 'stare', '2026-11-17T11:00:00Z'), after), null);
  assert.equal(finalReply('broken\n' + line('final_answer', 'assistant', 'Gotowe.'), after)?.text, 'Gotowe.');
  assert.equal(finalReply(line('', 'assistant', 'unknown format'), after), null);
});
test('spoken responses omit code blocks and links', () => {
  assert.equal(spokenText('**Gotowe** [plik](https://example.org)\n```sh\nsecret command\n```').includes('secret command'), false);
});

import { localVoiceRoute } from '../src/server/http/routes/localvoice.js';

test('voice routes reject cross-origin and permission-dialog injection', async () => {
  const previous = { ...process.env };
  process.env.AGENT_OFFICE_VOICE_PYTHON = 'configured'; process.env.AGENT_OFFICE_VOICE_SCRIPT = 'configured'; process.env.AGENT_OFFICE_VOICE_MODELS = 'configured';
  try {
    const { Readable } = await import('node:stream');
    const calls: unknown[] = [];
    const ctx: any = { cfg: {}, floors: new Map([['sobr', { workers: { get: () => ({ id: 'w', kind: 'agent', provider: 'codex', status: 'needs_input', sessionId: 's' }), prompt: (...args: unknown[]) => calls.push(args) } }]]) };
    for (const origin of ['https://attacker.test', 'http://localhost:4600']) {
      const req: any = Readable.from([Buffer.from(JSON.stringify({ floor: 'sobr', workerId: 'w', text: 'tak zatwierdzam' }))]);
      req.method = 'POST'; req.socket = { remoteAddress: '127.0.0.1' }; req.headers = { origin, host: 'localhost:4600' };
      let status = 0;
      const res: any = { writeHead: (s: number) => { status = s; return res; }, end: () => {} };
      await localVoiceRoute.handle(ctx, { req, res, path: '/api/local-voice/prompt', url: new URL('http://localhost:4600/api/local-voice/prompt'), session: {} } as any);
      assert.equal(status, origin.includes('attacker') ? 403 : 409);
    }
    assert.equal(calls.length, 0);
  } finally {
    for (const k of ['AGENT_OFFICE_VOICE_PYTHON', 'AGENT_OFFICE_VOICE_SCRIPT', 'AGENT_OFFICE_VOICE_MODELS']) {
      if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k];
    }
  }
});

import { Group, Scene, Vector3 } from 'three';
import { Roaming } from '../src/client/features/localvoice/roaming.js';
import { store } from '../src/client/state/index.js';
test('idle robots leave transformed chairs, walk, stop nearby, and restore their original parent', () => {
  const scene = new Scene(), chair = new Group(), root = new Group();
  chair.position.set(5, 0.5, 5); chair.rotation.y = Math.PI / 2; scene.add(chair); chair.add(root); scene.updateMatrixWorld(true);
  const model: any = { root, walking: false };
  const info: any = { id: 'voice-test', status: 'idle' }; store.workers.set(info.id, info);
  const ctx: any = { scene, inOffice: () => true, upTop: () => false, trip: () => null, reduceMotion: { matches: false }, player: { pos: new Vector3(20, 0, 20) }, plan: () => ({ byId: new Map([['desk', { id: 'desk' }]]) }), world: () => ({ ways: { in: () => [[0, 0], [0, 4], [4, 4], [5, 4]] } }) };
  const parts: any = { views: { workerViews: new Map([[info.id, { model, deskId: 'desk' }]]) } };
  const roaming = new Roaming(ctx, parts);
  try {
    roaming.tick(0.1, true); assert.equal(root.parent, scene);
    const start = root.position.clone();
    for (let i = 0; i < 200; i++) roaming.tick(0.1, true);
    assert.ok(root.position.distanceTo(start) > 0.5);
    const stopped = root.position.clone(); roaming.tick(1, true, info.id); assert.deepEqual(root.position, stopped); assert.equal(model.walking, false);
    info.status = 'working'; roaming.tick(0.1, true, info.id, new Set([info.id]));
    assert.equal(root.parent, scene); assert.deepEqual(root.position, stopped);
    roaming.tick(0.1, true); assert.equal(root.parent, chair); assert.deepEqual(root.position, new Vector3());
  } finally { roaming.reset(); store.workers.delete(info.id); }
});


test('proximity hearing ignores overhead ceilings but stops at thin walls', () => {
  const a = { x: 0, y: 1.4, z: 0 }, b = { x: 0, y: 0.8, z: 2 };
  assert.equal(voiceOccluded(a, b, [{ minX: -18, maxX: 18, minZ: -13, maxZ: 13, bottom: 6.8, top: 7.1 }]), false);
  assert.equal(voiceOccluded(a, b, [{ minX: -1, maxX: 1, minZ: 0.91, maxZ: 0.93, top: 3 }]), true);
  assert.equal(voiceOccluded(a, b, [{ minX: -1, maxX: 1, minZ: 0.9, maxZ: 1, top: 0.6 }]), false);
});

import { voiceProfile } from '../src/shared/voice-profiles.js';
test('the six named workers have distinct stable Polish voice profiles', () => {
  assert.equal(new Set(['Pixel', 'Vault', 'Scout', 'Calm', 'Launch', 'Echo'].map((name) => voiceProfile(name, 'id'))).size, 6);
  assert.equal(voiceProfile('Other', 'stable'), voiceProfile('Other', 'stable'));
});
