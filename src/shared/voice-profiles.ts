/** Stable Polish voices; a sixth profile uses a deliberately brighter Gosia variant. */
const names = ['Pixel', 'Vault', 'Scout', 'Calm', 'Launch', 'Echo'];
export function voiceProfile(name: string, id: string): number {
  const known = names.findIndex((n) => n.toLowerCase() === name?.toLowerCase());
  if (known >= 0) return known;
  return [...id].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0) % names.length;
}
