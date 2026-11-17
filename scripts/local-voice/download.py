"""Run once, online: python download.py /absolute/model/directory."""
import subprocess
import sys
from pathlib import Path
from huggingface_hub import snapshot_download
root = Path(sys.argv[1]).resolve()
root.mkdir(parents=True, exist_ok=True)
snapshot_download('Systran/faster-whisper-small', local_dir=str(root / 'whisper-small'), allow_patterns=['*.json', '*.bin', '*.txt'])
subprocess.run([sys.executable, '-m', 'piper.download_voices', '--data-dir', str(root), 'pl_PL-gosia-medium'], check=True)
