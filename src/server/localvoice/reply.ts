import { openSync, closeSync, readSync, fstatSync, realpathSync, constants, readFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

export function spokenText(text: string): string {
  return text.replace(/```[\s\S]*?```/g, ' Fragment kodu znajdziesz w terminalu. ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/[*#`_]/g, '').trim().slice(0, 1800);
}
export function finalReply(lines: string, after: number): { text: string; at: number } | null {
  let last: { text: string; at: number } | null = null;
  for (const line of lines.split('\n')) {
    try {
      const r = JSON.parse(line), p = r.payload, at = Date.parse(r.timestamp);
      if (!(at > after) || r.type !== 'response_item' || p?.type !== 'message' || p.role !== 'assistant' || p.phase !== 'final_answer') continue;
      const text = spokenText((p.content ?? []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text).join('\n'));
      if (text) last = { text, at };
    } catch { /* A bounded tail may start in the middle of a JSON line. */ }
  }
  return last;
}
/** Only the explicitly registered worker's root session; no scan of unrelated chats. */
export function workerReply(dir: string, workerId: string, sessionId: string, after: number) {
  let fd: number | undefined;
  try {
    const saved = JSON.parse(readFileSync(path.join(dir, '.agent-office/workers.json'), 'utf8'));
    const w = saved.find((v: any) => v.id === workerId && v.sessionId === sessionId);
    if (!w?.codexTranscript || !/^[\w-]{1,160}$/.test(sessionId)) return null;
    const root = realpathSync(process.env.CODEX_HOME || path.join(homedir(), '.codex'));
    const target = realpathSync(w.codexTranscript);
    const rel = path.relative(root, target).split(path.sep);
    if (!['sessions', 'archived_sessions'].includes(rel[0]) || rel.includes('..') || !target.endsWith(`-${sessionId}.jsonl`)) return null;
    fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd); if (!stat.isFile()) return null;
    const head = Buffer.alloc(Math.min(1024 * 1024, stat.size)); readSync(fd, head, 0, head.length, 0);
    const meta = JSON.parse(head.toString().split('\n')[0]);
    if (meta.type !== 'session_meta' || meta.payload?.id !== sessionId) return null;
    const tail = Buffer.alloc(Math.min(stat.size, 2 * 1024 * 1024)); readSync(fd, tail, 0, tail.length, stat.size - tail.length);
    return finalReply(tail.toString(), after);
  } catch { return null; } finally { if (fd !== undefined) closeSync(fd); }
}
