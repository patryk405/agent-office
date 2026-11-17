/** Only known providers become embeds; arbitrary URLs remain ordinary audio streams. */
export type JukeboxMedia =
  | { kind: 'youtube'; id?: string; playlist?: string; start: number; url: string }
  | { kind: 'soundcloud'; url: string };
const YOUTUBE = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be']);
const SOUND = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com']);
export const soundcloudShort = (u: URL) => ['on.soundcloud.com', 'snd.sc'].includes(u.hostname);
function seconds(value: string | null): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Math.min(86400, Number(value));
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? Math.min(86400, Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) : 0;
}
export function jukeboxMedia(raw: string): JukeboxMedia | null {
  let u: URL; try { u = new URL(raw); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port) return null;
  if (YOUTUBE.has(u.hostname)) {
    const parts = u.pathname.split('/').filter(Boolean);
    const video = u.hostname.endsWith('youtu.be') ? parts[0] : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : u.searchParams.get('v');
    const id = video && /^[\w-]{11}$/.test(video) ? video : undefined;
    const list = u.searchParams.get('list');
    const playlist = list && /^[\w-]{10,100}$/.test(list) ? list : undefined;
    if (!id && !playlist) return null;
    const start = seconds(u.searchParams.get('t') || u.searchParams.get('start'));
    const canonical = new URL(id ? 'https://www.youtube.com/watch' : 'https://www.youtube.com/playlist');
    if (id) canonical.searchParams.set('v', id);
    if (playlist) canonical.searchParams.set('list', playlist);
    if (start) canonical.searchParams.set('t', String(start));
    return { kind: 'youtube', id, playlist, start, url: canonical.href };
  }
  if (SOUND.has(u.hostname)) {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || ['discover', 'search', 'you', 'charts'].includes(parts[0])) return null;
    u.protocol = 'https:'; u.hostname = 'soundcloud.com'; u.search = ''; u.hash = '';
    return { kind: 'soundcloud', url: u.href };
  }
  return null;
}
export function knownMediaHost(u: URL): boolean { return YOUTUBE.has(u.hostname) || SOUND.has(u.hostname) || soundcloudShort(u); }
