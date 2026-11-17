# YouTube and SoundCloud in the jukebox

At the lounge jukebox press **E**, paste a link and press **Play**. Supported links:

- YouTube `watch`, `youtu.be`, `shorts`, `live`, embed and playlist URLs. A `t=` or
  `start=` offset is retained. Video IDs and provider hosts are validated.
- Public SoundCloud tracks and playlists. `on.soundcloud.com` / `snd.sc` short
  links are expanded by an authenticated, same-origin server route that follows
  only HTTPS SoundCloud redirects. Other redirects are rejected.
- Existing direct audio URLs, internet radio and the built-in music still work.

Playback uses the official [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
and [SoundCloud Widget API](https://developers.soundcloud.com/docs/api/html5-widget).
A visible player stays in the lower-right corner after closing the jukebox dialog.
There are no audio downloads, extraction services, API keys or paid integrations.
These services require internet access and receive browser requests. They can show
ads, consent screens, geographic restrictions or require sign-in. Owners can
prevent embedding. Errors appear next to an **Open in service** link.

If autoplay is blocked, click **Odtwórz u mnie** or Play inside the provider's
player. Office music settings and distance from the jukebox control local volume.
The same link is shared with everyone on the floor. Single tracks seek to the
shared elapsed time when loaded/reconnected; playlists follow the provider's
playlist controls and are not guaranteed to remain synchronized across people.
Provider pause/seek controls affect your player only. **Stop** and **Skip** in the
jukebox affect the whole floor. The player's ✕ stops it only for you; paste the
link again to reopen it. Changing floor/track tears down the previous player.

YouTube's player remains visible at its supported size; this is not a hidden
YouTube audio player. SoundCloud/YouTube embeds do not pass through Web Audio,
so their volume is adjusted through the provider SDK instead of a 3D audio filter.
