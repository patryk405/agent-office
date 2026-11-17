import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jukeboxMedia } from '../src/shared/jukebox-media.js';
import { checkStreamUrl } from '../src/shared/jukebox.js';
import { resolveSoundcloud } from '../src/server/jukebox-media/resolve.js';
import { Jukebox } from '../src/server/jukebox.js';

test('YouTube watch, share, shorts, live and embed links normalize to the same video', () => {
  for (const raw of ['https://youtu.be/M7lc1UVf-VE?si=abc', 'https://www.youtube.com/watch?v=M7lc1UVf-VE', 'https://m.youtube.com/shorts/M7lc1UVf-VE', 'https://www.youtube.com/live/M7lc1UVf-VE', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE']) {
    const media = jukeboxMedia(raw); assert.equal(media?.kind, 'youtube'); assert.equal(media?.url, 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
  }
  const timed = jukeboxMedia('https://youtu.be/M7lc1UVf-VE?t=1h2m3s'); assert.equal(timed?.kind === 'youtube' && timed.start, 3723);
  assert.equal(jukeboxMedia('https://www.youtube.com/playlist?list=PL1234567890')?.kind, 'youtube');
});
test('SoundCloud tracks and playlists work; spoof hosts and malformed provider links do not embed', () => {
  assert.equal(jukeboxMedia('https://soundcloud.com/artist/song?si=tracking')?.url, 'https://soundcloud.com/artist/song');
  assert.equal(jukeboxMedia('https://soundcloud.com/artist/sets/album')?.kind, 'soundcloud');
  for (const url of ['https://youtube.com.attacker.test/watch?v=M7lc1UVf-VE','https://www.youtube.com/watch?v=bad','https://soundcloud.com/artist','javascript:alert(1)','https://user:pass@youtube.com/watch?v=M7lc1UVf-VE']) assert.equal(jukeboxMedia(url), null);
  assert.ok('error' in checkStreamUrl('https://youtube.com/watch?v=bad'));
  assert.deepEqual(checkStreamUrl('https://radio.example/song.mp3'), { url:'https://radio.example/song.mp3' });
});
test('short SoundCloud links follow only allowlisted HTTPS redirects', async () => {
  const visited: string[] = [];
  const request: any = async (u: URL) => { visited.push(u.href); return new Response(null, { status: 302, headers: { location: 'https://soundcloud.com/artist/song?si=tracking' } }); };
  assert.equal(await resolveSoundcloud('https://on.soundcloud.com/abc', request), 'https://soundcloud.com/artist/song'); assert.equal(visited.length, 1);
  const evil: any = async () => new Response(null, { status:302, headers:{location:'http://127.0.0.1/private'} });
  await assert.rejects(resolveSoundcloud('https://on.soundcloud.com/abc', evil));
  await assert.rejects(resolveSoundcloud('https://attacker.test/secret', request)); assert.equal(visited.length,1);
});
test('provider links persist across restarts and skip returns to built-in music', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(),'office-media-'));
  try {
    const j = new Jukebox(dir); assert.deepEqual(j.play({url:'https://youtu.be/M7lc1UVf-VE'},'Patryk'),{changed:true});
    const reloaded = new Jukebox(dir); assert.equal(reloaded.state().url,'https://www.youtube.com/watch?v=M7lc1UVf-VE');
    reloaded.stop('Patryk'); assert.equal(reloaded.state().on,false);
    reloaded.skip('Patryk'); assert.notEqual(reloaded.state().track,'stream'); assert.equal(reloaded.state().url,undefined);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
