"""Private stdio RPC: audio/text never leaves this machine; models must already exist."""
import base64, io, json, os, sys, wave
import numpy as np
from pathlib import Path
from faster_whisper import WhisperModel
from piper import PiperVoice

root = Path(os.environ['AGENT_OFFICE_VOICE_MODELS'])
asr = WhisperModel(str(root / 'whisper-small'), device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
voice = PiperVoice.load(str(root / 'pl_PL-gosia-medium.onnx'))
for line in sys.stdin:
    try:
        q = json.loads(line)
        if q['op'] == 'status':
            result = {'ready': True}
        elif q['op'] == 'transcribe':
            audio = base64.b64decode(q['audio'], validate=True)
            with wave.open(io.BytesIO(audio)) as wav:
                if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or wav.getframerate() != 16000 or wav.getnframes() > 16000 * 25:
                    raise ValueError('Nieprawidłowe nagranie')
                pcm = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float32) / 32768.0
            segments, _ = asr.transcribe(pcm, language='pl', beam_size=3, vad_filter=True, condition_on_previous_text=False)
            result = {'text': ' '.join(s.text.strip() for s in segments if s.no_speech_prob < 0.6).strip()[:3000]}
        elif q['op'] == 'speak':
            text = str(q['text'])[:1800]
            buf = io.BytesIO()
            with wave.open(buf, 'wb') as wav:
                voice.synthesize_wav(text, wav)
            result = {'audio': base64.b64encode(buf.getvalue()).decode()}
        else:
            raise ValueError('Nieznana operacja')
        print(json.dumps({'id': q['id'], 'result': result}), flush=True)
    except Exception:
        print(json.dumps({'id': q.get('id'), 'error': 'Lokalny silnik mowy nie wykonał zadania.'}), flush=True)
