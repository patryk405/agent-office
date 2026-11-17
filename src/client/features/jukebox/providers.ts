/** Official iframe SDKs, loaded only when someone selects that provider. */
export interface YoutubePlayer {
  playVideo(): void; pauseVideo(): void; destroy(): void; setVolume(n: number): void;
  seekTo(n: number, allowSeekAhead: boolean): void; getDuration(): number;
}
export interface SoundcloudPlayer {
  bind(event: string, fn: (...args: any[]) => void): void; unbind(event: string): void;
  play(): void; pause(): void; seekTo(n: number): void; setVolume(n: number): void;
  getDuration(fn: (ms: number) => void): void;
}
type APIs = Window & { YT?: { Player: new (element: HTMLElement, config: any) => YoutubePlayer }; SC?: { Widget: ((frame: HTMLIFrameElement) => SoundcloudPlayer) & { Events: Record<string, string> } }; onYouTubeIframeAPIReady?: () => void };
const w = () => window as APIs;
let youtube: Promise<NonNullable<APIs['YT']>> | undefined;
let soundcloud: Promise<NonNullable<APIs['SC']>> | undefined;
function script(src: string, failed: () => void): HTMLScriptElement {
  const s = document.createElement('script'); s.src = src; s.async = true; s.onerror = failed; document.head.append(s); return s;
}
export function youtubeApi() {
  if (w().YT?.Player) return Promise.resolve(w().YT!);
  return youtube ??= new Promise<NonNullable<APIs['YT']>>((resolve, reject) => {
    const previous = w().onYouTubeIframeAPIReady;
    const fail = () => { youtube = undefined; reject(new Error('Nie udało się załadować YouTube. Sprawdź połączenie lub blokadę treści.')); };
    const timer = setTimeout(fail, 20000);
    w().onYouTubeIframeAPIReady = () => { clearTimeout(timer); previous?.(); if (w().YT) resolve(w().YT!); else fail(); };
    script('https://www.youtube.com/iframe_api', () => { clearTimeout(timer); fail(); });
  });
}
export function soundcloudApi() {
  if (w().SC?.Widget) return Promise.resolve(w().SC!);
  return soundcloud ??= new Promise<NonNullable<APIs['SC']>>((resolve, reject) => {
    const fail = () => { soundcloud = undefined; reject(new Error('Nie udało się załadować SoundCloud. Sprawdź połączenie lub blokadę treści.')); };
    const timer = setTimeout(fail, 20000);
    const s = script('https://w.soundcloud.com/player/api.js', () => { clearTimeout(timer); fail(); });
    s.onload = () => { clearTimeout(timer); if (w().SC) resolve(w().SC!); else fail(); };
  });
}
