import './media.css';
import type { JukeboxMedia } from '../../../shared/jukebox-media';
import { youtubeApi, soundcloudApi, type YoutubePlayer, type SoundcloudPlayer } from './providers';

/** Visible official players; no extraction, hidden videos, downloads or proxy streams. */
export class MediaPlayer {
  private root = document.createElement('section');
  private mount = document.createElement('div');
  private status = document.createElement('div');
  private yt?: YoutubePlayer;
  private sc?: SoundcloudPlayer;
  private dead = false;
  private ready = false;
  private volume = 0;
  private sentVolume = -1;
  private timeout?: number;
  private scEvents: string[] = [];
  playing = false;
  constructor(private media: JukeboxMedia, private elapsed: () => number, private onError: (text: string) => void) {
    this.root.className = 'jb-media-dock'; this.root.dataset.provider = media.kind; this.root.setAttribute('aria-label', 'Odtwarzacz jukeboxa');
    const header = document.createElement('header'), title = document.createElement('strong'), close = document.createElement('button');
    title.textContent = media.kind === 'youtube' ? 'YouTube · Jukebox' : 'SoundCloud · Jukebox';
    close.textContent = '✕'; close.setAttribute('aria-label', 'Zatrzymaj odtwarzanie tylko u mnie'); close.title = 'Zatrzymaj tylko u mnie'; close.onclick = () => this.dispose();
    header.append(title, close); this.status.className = 'jb-media-status'; this.status.setAttribute('role', 'status'); this.status.textContent = 'Ładuję odtwarzacz…';
    const footer = document.createElement('footer'), play = document.createElement('button'), original = document.createElement('a');
    play.textContent = '▶ Odtwórz u mnie'; play.onclick = () => this.play();
    original.textContent = 'Otwórz w serwisie ↗'; original.href = media.url; original.target = '_blank'; original.rel = 'noopener noreferrer';
    footer.append(play, original); this.root.append(header, this.mount, this.status, footer);
    (document.getElementById('hud') ?? document.body).append(this.root);
    this.timeout = window.setTimeout(() => this.fail('Odtwarzacz nie odpowiedział. Spróbuj odtworzyć w serwisie.'), 30000);
    void this.start().catch((error) => this.fail(error instanceof Error ? error.message : 'Nie udało się otworzyć utworu.'));
  }
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    const n = Math.round(this.volume * 100);
    if (!this.ready || this.dead || n === this.sentVolume) return;
    this.sentVolume = n; this.yt?.setVolume(n); this.sc?.setVolume(n);
  }
  private loaded() {
    if (this.dead) return;
    this.ready = true; clearTimeout(this.timeout); this.setVolume(this.volume); this.sync(); this.play();
  }
  private async start() {
    const m = this.media;
    if (m.kind === 'youtube') {
      const YT = await youtubeApi(); if (this.dead) return;
      this.yt = new YT.Player(this.mount, {
        width: '384', height: '216', host: 'https://www.youtube-nocookie.com', videoId: m.id,
        playerVars: { playsinline: 1, controls: 1, origin: location.origin, start: m.start, ...(m.playlist ? { listType: 'playlist', list: m.playlist } : {}) },
        events: {
          onReady: () => this.loaded(),
          onStateChange: (e: { data: number }) => { if (this.dead) return; this.playing = e.data === 1; this.status.textContent = this.playing ? 'Odtwarzanie · głośność zależy od odległości' : 'Kliknij ▶, jeśli odtwarzanie zostało wstrzymane.'; },
          onAutoplayBlocked: () => { if (!this.dead) this.status.textContent = 'Przeglądarka wymaga kliknięcia ▶ w odtwarzaczu.'; },
          onError: (e: { data: number }) => this.fail(`YouTube nie może odtworzyć tego materiału (${e.data}). Może być prywatny, niedostępny lub mieć wyłączone osadzanie.`),
        },
      });
    } else {
      const SC = await soundcloudApi(); if (this.dead) return;
      const frame = document.createElement('iframe'); frame.title = 'SoundCloud jukebox'; frame.allow = 'autoplay'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.src = 'https://w.soundcloud.com/player/?' + new URLSearchParams({ url: m.url, auto_play: 'false', show_artwork: 'true', show_user: 'true', visual: 'false' });
      this.mount.append(frame); this.sc = SC.Widget(frame);
      const bind = (name: string, fn: () => void) => { const event = SC.Widget.Events[name]; this.scEvents.push(event); this.sc!.bind(event, () => { if (!this.dead) fn(); }); };
      bind('READY', () => this.loaded());
      bind('PLAY', () => { this.playing = true; this.status.textContent = 'Odtwarzanie · głośność zależy od odległości'; });
      bind('PAUSE', () => { this.playing = false; this.status.textContent = 'Wstrzymane · kliknij ▶, aby słuchać.'; });
      bind('FINISH', () => { this.playing = false; this.status.textContent = 'Utwór zakończony.'; });
      bind('ERROR', () => this.fail('SoundCloud nie może odtworzyć tego linku. Sprawdź dostępność utworu w serwisie.'));
    }
  }
  play() { if (this.dead || !this.ready) return; this.yt?.playVideo(); this.sc?.play(); }
  sync() {
    if (!this.ready || this.dead) return;
    const at = this.elapsed() + (this.media.kind === 'youtube' ? this.media.start : 0);
    // Seek once on load/reconnect, not on every frame; playlists keep their provider's order.
    if (this.yt && this.media.kind === 'youtube' && !this.media.playlist) {
      const duration = this.yt.getDuration(); this.yt.seekTo(duration > 0 ? at % duration : at, true);
    }
    this.sc?.getDuration((ms) => { if (!this.dead && ms > 0) this.sc?.seekTo((at * 1000) % ms); });
  }
  private fail(text: string) { if (this.dead) return; clearTimeout(this.timeout); this.playing = false; this.status.textContent = text; this.onError(text); }
  dispose() {
    if (this.dead) return;
    this.dead = true; this.playing = false; clearTimeout(this.timeout);
    this.yt?.destroy();
    if (this.sc) { for (const e of this.scEvents) this.sc.unbind(e); this.sc.pause(); }
    this.root.remove();
  }
}
