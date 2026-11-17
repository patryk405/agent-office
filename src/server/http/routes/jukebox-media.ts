import type { Route } from '../router.js';
import { readBody, sameOrigin, send } from '../util.js';
import { resolveSoundcloud } from '../../jukebox-media/resolve.js';
export const jukeboxMediaRoute: Route = {
  method: 'POST', path: '/api/jukebox/resolve', auth: 'session',
  async handle(ctx, { req, res }) {
    if (!sameOrigin(req, ctx.cfg)) return send(res, 403, { error: 'Forbidden' });
    try {
      const body = JSON.parse(await readBody(req, 4096));
      if (typeof body.url !== 'string' || body.url.length > 2048) return send(res, 400, { error: 'Nieprawidłowy link.' });
      return send(res, 200, { url: await resolveSoundcloud(body.url) });
    } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'Nie udało się rozwinąć linku.' }); }
  },
};
