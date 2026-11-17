import { soundcloudShort } from '../../../shared/jukebox-media';
import './ui.css';
import { JUKEBOX_TUNES, STREAM, checkStreamUrl, trackTitle, tuneById } from '../../../shared/jukebox';
import type { Net } from '../../net';
import { store } from '../../state';
import { h, openModal, toast } from '../../ui/dom';

/** The jukebox: what's on, the tunes to pick from, skip and stop, and a box for a stream. */
export function openJukebox(net: Net, openVolume: () => void) {
  const close = h('button.btn.close', { 'aria-label': 'Close' }, '✕');
  const now = h('div.jb-now');
  const list = h('ul.svc-list');
  const url = h('input', { type: 'text', placeholder: 'YouTube, SoundCloud, radio lub plik .mp3', 'aria-label': 'YouTube, SoundCloud or audio link', spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
  const playUrl = h('button.btn.primary', { type: 'button' }, '📻 Play');
  const volume = h('button.btn', { type: 'button' }, '🔈 Your volume');
  const el = h(
    'div.modal.jukebox',
    { role: 'dialog', 'aria-label': 'Jukebox' },
    h('header', {}, h('h2', {}, '🎵 Jukebox'), close),
    h(
      'div.body',
      {},
      now,
      h('label', { style: 'margin-top:16px' }, 'Put on a tune'),
      list,
      h('label', { style: 'margin-top:16px' }, 'Lub wklej link'),
      h('div.webhook', {}, url, playUrl),
      h('p.setting-note', {}, 'YouTube, SoundCloud, radio lub plik audio. Serwisy otwierają własny odtwarzacz i mogą wymagać kliknięcia Play.'),
    ),
    h('footer', {}, h('span.grow', {}, 'Everyone on this floor hears the same song, louder the closer they are to the lounge.'), volume),
  );

  const button = (label: string, title: string, send: () => void, primary = false) => h(primary ? 'button.btn.primary' : 'button.btn', { type: 'button', title, onclick: send }, label);

  const render = () => {
    const j = store.jukebox;
    const stream = j.track === STREAM;
    now.replaceChildren(
      h('span.jb-disc', { class: j.on ? 'spin' : '' }, stream ? '📻' : '💿'),
      h(
        'div.svc-main',
        {},
        h('div.svc-title', {}, j.on ? trackTitle(j) : 'The jukebox is off'),
        h('div.svc-meta', {}, j.on ? [stream ? 'a stream' : tuneById(j.track)?.mood, j.by && `put on by ${j.by}`].filter(Boolean).join(' · ') : j.by ? `${j.by} turned it off` : 'Pick a tune to put it on'),
      ),
      j.on ? button('⏭️ Skip', 'On to the next tune', () => net.send({ t: 'jukebox.skip' })) : button('▶️ Play', `Put ${trackTitle(j)} back on`, () => net.send({ t: 'jukebox.play' }), true),
      j.on ? button('⏹️ Stop', 'Turn the jukebox off', () => net.send({ t: 'jukebox.stop' })) : '',
    );
    list.replaceChildren(
      ...JUKEBOX_TUNES.map((t) => {
        const playing = j.on && j.track === t.id;
        const li = h(
          'li',
          { class: playing ? 'on' : '', tabindex: 0, role: 'button', 'aria-pressed': String(playing), title: playing ? 'Playing now' : `Put on ${t.title}` },
          h('span.jb-icon', {}, playing ? '🔊' : '🎵'),
          h('div.svc-main', {}, h('div.svc-title', {}, t.title), h('div.svc-meta', {}, t.mood)),
        );
        const pick = () => {
          if (!playing) net.send({ t: 'jukebox.play', track: t.id });
        };
        li.addEventListener('click', pick);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        });
        return li;
      }),
    );
  };

  let resolving = false;
  const play = async () => {
    if (resolving) return;
    let raw = url.value.trim();
    try {
      const parsed = new URL(raw);
      if (soundcloudShort(parsed)) {
        resolving = true; (playUrl as HTMLButtonElement).disabled = true;
        const response = await fetch('/api/jukebox/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: raw }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        raw = result.url;
      }
    } catch (error) {
      if (resolving) { toast(error instanceof Error ? error.message : 'Nie udało się rozwinąć linku.', 'warn'); return; }
    } finally { resolving = false; (playUrl as HTMLButtonElement).disabled = false; }
    if (!el.isConnected) return;
    const u = checkStreamUrl(raw);
    if ('error' in u) {
      toast(u.error, 'warn');
      return url.focus();
    }
    net.send({ t: 'jukebox.play', url: u.url });
    url.value = '';
  };
  playUrl.addEventListener('click', play);
  url.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') play();
  });

  const modal = openModal(el, { doing: '🎵 at the jukebox', onClose: store.on('jukebox', render) });
  close.addEventListener('click', () => modal.close());
  volume.addEventListener('click', () => {
    modal.close();
    openVolume();
  });
  render();
}
