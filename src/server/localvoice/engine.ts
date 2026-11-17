import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
let child: ChildProcessWithoutNullStreams | undefined;
let serial = 0;
const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
export const configured = () => !!(process.env.AGENT_OFFICE_VOICE_PYTHON && process.env.AGENT_OFFICE_VOICE_SCRIPT && process.env.AGENT_OFFICE_VOICE_MODELS);
export function localSpeech(op: string, data: Record<string, unknown> = {}): Promise<any> {
  if (!configured()) return Promise.reject(new Error('Lokalny silnik mowy nie jest skonfigurowany.'));
  if (pending.size >= 4) return Promise.reject(new Error('Silnik mowy jest zajęty.'));
  if (!child) {
    const proc = spawn(process.env.AGENT_OFFICE_VOICE_PYTHON!, ['-u', process.env.AGENT_OFFICE_VOICE_SCRIPT!], { env: { ...process.env, HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' }, stdio: 'pipe' });
    child = proc;
    // Never print prompts, transcripts or audio in logs.
    proc.stderr.resume();
    const fail = () => {
      if (child !== proc) return;
      child = undefined;
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Lokalny silnik mowy został zatrzymany.')); }
      pending.clear();
    };
    proc.on('error', fail); proc.on('exit', fail); proc.stdin.on('error', fail);
    createInterface({ input: proc.stdout }).on('line', (line) => {
      try {
        const value = JSON.parse(line); const p = pending.get(value.id);
        if (!p) return;
        pending.delete(value.id); clearTimeout(p.timer);
        if (value.error) p.reject(new Error(value.error)); else p.resolve(value.result);
      } catch { /* Only complete RPC replies are accepted. */ }
    });
  }
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Przekroczono czas rozpoznawania mowy.')); child?.kill(); }, 90_000);
    pending.set(id, { resolve, reject, timer });
    child!.stdin.write(JSON.stringify({ id, op, ...data }) + '\n');
  });
}
process.once('exit', () => child?.kill());
