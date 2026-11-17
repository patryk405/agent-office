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

/** Head-height line of sight: ceilings above the conversation are not walls. */
export function voiceOccluded(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, colliders: { minX: number; maxX: number; minZ: number; maxZ: number; top: number; bottom?: number }[]): boolean {
  return colliders.some((c) => {
    if (c.top <= 1.8) return false;
    let enter = 0, leave = 1;
    for (const [a, b, low, high] of [[from.x, to.x, c.minX, c.maxX], [from.y, to.y, c.bottom ?? 0, c.top], [from.z, to.z, c.minZ, c.maxZ]]) {
      const delta = b - a;
      if (Math.abs(delta) < 1e-8) { if (a < low || a > high) return false; continue; }
      const t1 = (low - a) / delta, t2 = (high - a) / delta;
      enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave) return false;
    }
    return leave > 0.001 && enter < 0.999;
  });
}
