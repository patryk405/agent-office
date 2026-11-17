import './ui.css';
import { Vector3 } from 'three';
import type { Ctx } from '../../core/context';
import type { Parts } from '../../core/parts';
import { store } from '../../state';
import { conversationalTarget, wav16k, voiceOccluded } from '../../../shared/local-voice';
import { Roaming } from './roaming';

async function api(op: string, data: object = {}, signal?: AbortSignal) {
  const response = await fetch('/api/local-voice/' + op, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data), signal });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Lokalny silnik mowy jest niedostępny.');
  return value;
}
const encoded = (bytes: Uint8Array) => {
  let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};

export function installLocalVoice(ctx: Ctx, parts: Pick<Parts, 'views'>) {
  const box = document.createElement('section'); box.className = 'local-voice-panel'; box.setAttribute('aria-label', 'Rozmowa z robotami');
  const button = document.createElement('button'); button.textContent = 'Włącz rozmowę po polsku'; button.setAttribute('aria-pressed', 'false');
  const status = document.createElement('div'); status.className = 'local-voice-status'; status.setAttribute('role', 'status'); status.textContent = 'Mikrofon wyłączony';
  const caption = document.createElement('div'); caption.className = 'local-voice-caption';
  const note = document.createElement('small'); note.className = 'local-voice-note'; note.textContent = 'Mowa lokalnie · podejdź do robota i spójrz na niego. Polecenia tekstowe korzystają z Twojego Codexa.';
  box.append(button, status, caption, note); (document.getElementById('hud') ?? document.body).append(box);
  const roaming = new Roaming(ctx, parts);
  let enabled = false, epoch = 0, starting = false, target: string | undefined, busy = false, speaking = false;
  let stream: MediaStream | undefined, audio: AudioContext | undefined, processor: ScriptProcessorNode | undefined, source: MediaStreamAudioSourceNode | undefined;
  let output: AudioBufferSourceNode | undefined, pan: StereoPannerNode | undefined, gain: GainNode | undefined, speakingId: string | undefined;
  let chunks: Float32Array[] = [], samples = 0, voiced = 0, silence = 0, recording: string | undefined;
  let cooldown = 0, pollAt = 0, polling = false, chatterAt = 0;
  let request = new AbortController();
  const pending = new Map<string, { floor: string; after: number; expires: number }>();
  const resetRecording = () => { chunks = []; samples = voiced = silence = 0; recording = undefined; };
  function stop() {
    enabled = false; starting = false; epoch++; request.abort(); request = new AbortController();
    stream?.getTracks().forEach((t) => t.stop()); stream = undefined;
    processor?.disconnect(); source?.disconnect(); processor = undefined; source = undefined;
    output?.stop(); output = undefined; void audio?.close(); audio = undefined;
    speaking = busy = false; target = undefined; pending.clear(); resetRecording(); roaming.reset();
    button.disabled = false; button.textContent = 'Włącz rozmowę po polsku'; button.setAttribute('aria-pressed', 'false'); status.textContent = 'Mikrofon wyłączony';
  }
  async function say(id: string, text: string) {
    if (!enabled || speaking || !audio || !parts.views.workerViews.has(id)) return;
    const generation = epoch; speaking = true; speakingId = id; resetRecording();
    try {
      const value = await api('speak', { text: text.slice(0, 1800), workerId: id, floor: store.floor }, request.signal);
      if (generation !== epoch || !audio) return;
      const bytes = Uint8Array.from(atob(value.audio), (c) => c.charCodeAt(0));
      const buffer = await audio.decodeAudioData(bytes.buffer);
      if (generation !== epoch || !audio) return;
      const s = audio.createBufferSource(); s.buffer = buffer; output = s;
      gain = audio.createGain(); pan = audio.createStereoPanner(); s.connect(gain).connect(pan).connect(audio.destination);
      caption.textContent = `${store.workers.get(id)?.name ?? 'Robot'}: ${text}`;
      await new Promise<void>((resolve) => { s.onended = () => resolve(); s.start(); });
    } catch (error) { if (generation === epoch) status.textContent = String(error instanceof Error ? error.message : error); }
    finally { if (generation === epoch) { speaking = false; speakingId = undefined; cooldown = performance.now() + 1000; } }
  }
  async function submit(id: string, wav: Uint8Array, floor: string, generation: number) {
    busy = true; status.textContent = 'Rozpoznaję mowę na komputerze…';
    try {
      const { text } = await api('transcribe', { audio: encoded(wav) }, request.signal);
      if (generation !== epoch || !enabled || store.floor !== floor || target !== id) return;
      if (!text || text.length < 3) return;
      caption.textContent = `Ty → ${store.workers.get(id)?.name}: ${text}`;
      // Spoken stop always works locally, without sending a prompt.
      if (/^(wyłącz mikrofon|wyłącz rozmowę|koniec rozmowy)[.!?]?$/i.test(text.trim())) { stop(); return; }
      const after = Date.now();
      pending.set(id, { floor, after, expires: Date.now() + 15 * 60_000 });
      try { await api('prompt', { floor, workerId: id, text }, request.signal); }
      catch (error) { pending.delete(id); throw error; }
      if (generation !== epoch) return;
      pending.set(id, { floor, after, expires: Date.now() + 15 * 60_000 });
      status.textContent = 'Wysłano. Czekam na odpowiedź.';
    } catch (error) { if (generation === epoch) { caption.textContent = error instanceof Error ? error.message : String(error); cooldown = performance.now() + 2500; } }
    finally { if (generation === epoch) { busy = false; resetRecording(); } }
  }
  button.onclick = async () => {
    if (enabled || starting) { stop(); return; }
    starting = true; const generation = ++epoch;
    try {
      // Create/resume audio during the user's gesture, before asynchronous model loading.
      audio = new AudioContext(); await audio.resume();
      status.textContent = 'Ładuję lokalne modele mowy…'; button.textContent = 'Anuluj uruchamianie';
      await api('status', {}, request.signal);
      if (generation !== epoch) return;
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (generation !== epoch || !audio) { mic.getTracks().forEach((t) => t.stop()); return; }
      stream = mic; enabled = true; starting = false; chatterAt = performance.now() + 45000;
      button.textContent = 'Wyłącz mikrofon i rozmowę'; button.setAttribute('aria-pressed', 'true');
      source = audio.createMediaStreamSource(mic); processor = audio.createScriptProcessor(2048, 1, 1);
      const silent = audio.createGain(); silent.gain.value = 0; source.connect(processor); processor.connect(silent).connect(audio.destination);
      processor.onaudioprocess = (event) => {
        if (!enabled || !audio || !target || busy || speaking || performance.now() < cooldown || document.hidden || !store.floor) { resetRecording(); return; }
        const w = store.workers.get(target);
        if (!w || !['idle', 'done'].includes(w.status) || pending.has(target)) { resetRecording(); return; }
        if (recording && recording !== target) resetRecording();
        const input = event.inputBuffer.getChannelData(0), ms = input.length / audio.sampleRate * 1000;
        const rms = Math.sqrt(input.reduce((sum, n) => sum + n * n, 0) / input.length), loud = rms > 0.018;
        if (!recording && !loud) return;
        recording = target; chunks.push(new Float32Array(input)); samples += input.length;
        if (loud) { voiced += ms; silence = 0; } else silence += ms;
        status.textContent = `Słucham: ${w.name}…`;
        if (silence > 900 || samples / audio.sampleRate >= 22) {
          const id = recording, length = samples, parts = chunks; const speechMs = voiced; resetRecording();
          if (speechMs < 350) return;
          const joined = new Float32Array(length); let offset = 0; for (const p of parts) { joined.set(p, offset); offset += p.length; }
          void submit(id, wav16k(joined, audio.sampleRate), store.floor, epoch);
        }
      };
      mic.getTracks()[0].onended = () => stop();
    } catch (error) { if (generation === epoch) { stop(); status.textContent = error instanceof Error ? error.message : 'Nie udało się uruchomić mikrofonu.'; } }
  };
  ctx.keys.bind({ code: 'F8', run: () => { button.click(); return true; } });
  button.title = 'F8 — włącz lub wyłącz rozmowę';
  const direction = new Vector3(), relative = new Vector3(), point = new Vector3();
  ctx.ticks.add('world', ({ dt, now }) => {
    if (!enabled) return;
    ctx.camera.getWorldDirection(direction);
    const candidates: { id: string; distance: number; facing: number }[] = [];
    if (!document.hidden && !ctx.trip() && !ctx.upTop()) for (const [id, view] of parts.views.workerViews) {
      const w = store.workers.get(id); if (!view.model.root.visible || !w || w.kind !== 'agent' || w.provider !== 'codex' || w.meeting) continue;
      view.model.root.getWorldPosition(point); point.y += 0.8; relative.copy(point).sub(ctx.camera.position);
      const distance = relative.length(); const facing = relative.normalize().dot(direction);
      // Walls block a conversation; furniture below head height does not.
      const blocked = voiceOccluded(ctx.camera.position, point, ctx.world().colliders);
      if (!blocked) candidates.push({ id, distance, facing });
    }
    target = conversationalTarget(candidates, target);
    roaming.tick(dt, true, target, new Set([...pending.keys(), ...(speakingId ? [speakingId] : [])]));
    if (!busy && !recording && !speaking) {
      const w = target && store.workers.get(target);
      status.textContent = w ? `${w.name} · ${['idle', 'done'].includes(w.status) ? 'możesz mówić' : 'pracuje / czeka na terminal'}` : 'Mikrofon aktywny · podejdź i spójrz na robota';
    }
    if (speakingId && gain && pan) {
      const view = parts.views.workerViews.get(speakingId);
      if (view) { view.model.root.getWorldPosition(point); const distance = point.distanceTo(ctx.player.pos); gain.gain.value = Math.max(0, 1 - distance / 9); point.applyMatrix4(ctx.camera.matrixWorldInverse); pan.pan.value = Math.max(-1, Math.min(1, point.x / 5)); }
      else gain.gain.value = 0;
    }
    if (!polling && now > pollAt && pending.size) {
      pollAt = now + 2000; polling = true; const generation = epoch;
      void (async () => {
        for (const [id, task] of pending) {
          if (Date.now() > task.expires || task.floor !== store.floor || !store.workers.has(id)) { pending.delete(id); continue; }
          try {
            const result = await api('reply', { floor: task.floor, workerId: id, after: task.after }, request.signal);
            if (generation !== epoch) return;
            if (result.reply && target === id && !speaking && !recording && !busy) { pending.delete(id); await say(id, result.reply.text); }
          } catch { /* Disconnection is retried; no duplicate prompts. */ }
        }
      })().finally(() => { polling = false; });
    }
    if (now > chatterAt && !busy && !speaking && !recording && !pending.size) {
      chatterAt = now + 45000 + Math.random() * 45000;
      const nearby = candidates.find((c) => c.distance < 5);
      if (nearby) {
        const w = store.workers.get(nearby.id)!;
        void say(nearby.id, w.status === 'working' ? 'Pracuję nad zadaniem. Dam znać, kiedy skończę.' : w.status === 'needs_input' ? 'Potrzebuję twojej odpowiedzi w terminalu.' : 'Jestem tutaj. Podejdź, jeśli chcesz pogadać.');
      }
    }
  });
  store.on('floor', () => { if (enabled) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (enabled || starting)) stop(); });
  window.addEventListener('pagehide', stop);
}
