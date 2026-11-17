import { jukeboxMedia, soundcloudShort } from '../../shared/jukebox-media.js';
/** Resolve only SoundCloud's own short links; never fetch an arbitrary pasted URL. */
export async function resolveSoundcloud(raw: string, request: typeof fetch = fetch): Promise<string> {
  let url = new URL(raw);
  const signal = AbortSignal.timeout(8000);
  for (let i = 0; i < 5; i++) {
    if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Nieprawidłowy link SoundCloud.');
    const media = jukeboxMedia(url.href);
    if (media?.kind === 'soundcloud') return media.url;
    if (!soundcloudShort(url)) throw new Error('Link nie prowadzi do utworu SoundCloud.');
    const response = await request(url, { redirect: 'manual', signal });
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (response.status < 300 || response.status > 399 || !location) throw new Error('Nie udało się rozwinąć linku. Wklej pełny adres utworu z soundcloud.com.');
    url = new URL(location, url);
  }
  throw new Error('Za dużo przekierowań w linku SoundCloud.');
}
