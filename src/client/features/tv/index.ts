import type { Ctx } from '../../core/context';
import { hintTitle, key, onE } from '../../core/hint';
import { tvBrowser } from './browser';

declare module '../../world/types' {
  interface InteractKinds { tv: true; }
}
export interface TvDeps {
  shares(): [string, MediaStream][];
  watch(): void;
}
export function installTv(ctx: Ctx, _deps: TvDeps) {
  const browser = tvBrowser(ctx);
  ctx.interactions.define('tv', {
    reach: 10,
    hint: () => ({ k: 'browser', parts: [hintTitle('📺 Office TV'), key('E', 'Otwórz przeglądarkę')] }),
    use: onE(browser.open),
  });
  // Human screen sharing remains available separately, without replacing the web preview.
  return { show(_stream: MediaStream | null) {} };
}
