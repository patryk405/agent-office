/** Pure proximity/VAD rules, shared with deterministic tests. */
export function conversationalTarget(candidates: { id: string; distance: number; facing: number }[], previous?: string): string | undefined {
  const eligible = candidates.filter((c) => c.distance < (c.id === previous ? 3.8 : 3.2) && c.facing > 0.35).sort((a, b) => a.distance - b.distance);
  const held = eligible.find((c) => c.id === previous);
  return held && (!eligible[0] || held.distance < eligible[0].distance + 0.6) ? held.id : eligible[0]?.id;
}
export function wav16k(samples: Float32Array, rate: number): Uint8Array {
  const count = Math.floor(samples.length * 16000 / rate);
  const out = new Uint8Array(44 + count * 2), v = new DataView(out.buffer);
  const str = (offset: number, s: string) => [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + count * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * rate / 16000), end = Math.max(start + 1, Math.floor((i + 1) * rate / 16000));
    let sum = 0; for (let j = start; j < end; j++) sum += samples[j] ?? 0;
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sum / (end - start))) * 32767, true);
  }
  return out;
}
