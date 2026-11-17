# Local Polish conversation

This optional mode uses **faster-whisper small** (Polish recognition, CPU int8) and
**Piper pl_PL-gosia-medium** (Polish speech). There is no paid speech API and no
browser/cloud speech recognition. Models are downloaded once; runtime inference
is offline. Audio stays in memory on the office machine and is not saved. The
recognized text is sent to the existing Codex worker and uses that provider's
normal account/limits. This is not an offline coding model.

## Installation

Use Python 3.11+ with a virtual environment and install
`scripts/local-voice/requirements.txt`. Download `Systran/faster-whisper-small`
with huggingface_hub to `<models>/whisper-small`, then run
`python -m piper.download_voices --data-dir <models> pl_PL-gosia-medium`.
Alternatively run `python scripts/local-voice/download.py <models>` after installing
the requirements. Review the model's license/model card before redistributing voice assets.

Set these environment variables when starting the office:

- `AGENT_OFFICE_VOICE_PYTHON`: absolute virtualenv Python path.
- `AGENT_OFFICE_VOICE_SCRIPT`: absolute path to `scripts/local-voice/worker.py`.
- `AGENT_OFFICE_VOICE_MODELS`: absolute model directory.

The server starts a private Python subprocess over stdio on first use. No second
HTTP port, cloud fallback, or speech API credentials are needed. Routes require
an office session, a loopback connection and shared-password/admin access.

## Using it

Press **F8**, or release the mouse with Escape and click **Włącz rozmowę po polsku**,
then allow microphone access. F8 also turns the microphone off. Approach a
Codex worker (about three meters) and look at it. Its name in the panel identifies
who will receive your speech. Stop speaking for about a second to submit. The
panel shows the recognized text. Workers need a registered session and idle/done
status; speech cannot answer approval, trust or login dialogs. Complete those in
the terminal. Prompts request short Polish answers; only final replies from that
worker's registered root Codex rollout are read aloud. Other providers are not
supported by this initial mode. Unknown rollout formats fail closed.

Idle/done desk workers stroll along existing navigation paths on the office map
and stop near you. Movement is local to this browser, disabled with reduced
motion, and does not alter actual worker jobs. Starting work puts the character
back at its desk. Occasional Polish status remarks are predefined, not fabricated
agent reasoning. Voice volume falls with distance.

During playback, recognition is paused (half duplex) to prevent self-triggering.
Wait until the robot finishes before speaking. This version does not implement
speaker identification or voice interruption. Background speech can be recognized
when you are facing a ready worker; use the visible microphone toggle to pause.
Hide the tab, change floor, or click **Wyłącz mikrofon i rozmowę** to release the
microphone. You can also say **wyłącz mikrofon** while addressing a ready worker.
The mode never resumes the microphone automatically after a page reload.

Audio permission and playback require a secure context (localhost is supported).
A microphone and speakers/headphones must be available to the browser. CPU load
and answer latency depend on the machine. Test real speech with your microphone;
a synthetic audio roundtrip cannot verify room noise or hardware permissions.
