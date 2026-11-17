import { configured, localSpeech } from '../../localvoice/engine.js';
import { workerReply } from '../../localvoice/reply.js';
import type { Route } from '../router.js';
import { readBody, sameOrigin, send } from '../util.js';

export const localVoiceRoute: Route = {
  prefix: '/api/local-voice/', auth: 'session',
  async handle(ctx, { req, res, path, session }) {
    // This optional mode is local-only and restricted to the shared office/admin.
    const ip = req.socket.remoteAddress ?? '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) || (session.account && session.account.role !== 'admin')) return send(res, 403, { error: 'Tryb lokalny jest dostępny tylko dla administratora na tym komputerze.' });
    if (req.method !== 'POST' || !sameOrigin(req, ctx.cfg)) return send(res, 403, { error: 'Forbidden' });
    if (!configured()) return send(res, 503, { error: 'Lokalny silnik mowy nie jest skonfigurowany.' });
    try {
      const body = JSON.parse(await readBody(req, 1_200_000));
      const op = path.slice('/api/local-voice/'.length);
      if (op === 'status') return send(res, 200, await localSpeech('status'));
      if (op === 'transcribe') {
        if (typeof body.audio !== 'string' || body.audio.length > 1_100_000) return send(res, 400, { error: 'Nagranie jest za długie.' });
        return send(res, 200, await localSpeech('transcribe', { audio: body.audio }));
      }
      if (op === 'speak') {
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1800) return send(res, 400, { error: 'Nieprawidłowy tekst.' });
        return send(res, 200, await localSpeech('speak', { text: body.text }));
      }
      const floor = ctx.floors.get(body.floor);
      const worker = floor?.workers.get(body.workerId);
      if (!floor || !worker || worker.kind !== 'agent' || worker.provider !== 'codex') return send(res, 404, { error: 'Wybierz aktywnego robota Codex.' });
      if (op === 'reply') {
        const after = Number(body.after);
        if (!Number.isFinite(after) || after < Date.now() - 86400_000) return send(res, 400, { error: 'Nieprawidłowy czas.' });
        return send(res, 200, { reply: worker.sessionId ? workerReply(floor.def.dir, worker.id, worker.sessionId, after) : null, status: worker.status });
      }
      if (op === 'prompt') {
        // Never inject speech into trust/login/permission dialogs or interrupt an active task.
        if (!['idle', 'done'].includes(worker.status) || !worker.sessionId || worker.meeting) return send(res, 409, { error: 'Robot pracuje lub czeka na potwierdzenie w terminalu.' });
        if (typeof body.text !== 'string' || body.text.trim().length < 3 || body.text.length > 3000) return send(res, 400, { error: 'Nieprawidłowe polecenie.' });
        const prompt = 'Rozmowa głosowa po polsku. Odpowiedz po polsku, naturalnie i zwięźle, najlepiej w 2–4 zdaniach. Zachowaj zwykłe zasady bezpieczeństwa i wymagane zgody. Polecenie użytkownika:\n' + body.text.trim();
        const error = floor.workers.prompt(worker.id, prompt, 'Rozmowa głosowa');
        return send(res, error ? 409 : 200, error ? { error } : { ok: true, at: Date.now() });
      }
      send(res, 404, { error: 'Unknown operation' });
    } catch (error) { send(res, 503, { error: error instanceof Error ? error.message : 'Silnik mowy jest niedostępny.' }); }
  },
};
