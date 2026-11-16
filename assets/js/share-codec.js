/** Pure binary / base79 / dictionary primitives for the #v3~ share-link format. DOM-free. */
export const V3_SPLATS = ['mortal', 'vampire', 'werewolf', 'mage', 'changeling', 'wraith'];
export const V3_WEREWOLF_FORMS = ['homid', 'glabro', 'crinos', 'hispo', 'lupus'];
export const V3_B79_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._~!$()*+,;=:@/?";
const V3_B79_BASE = BigInt(V3_B79_ALPHABET.length); // 79
const V3_B79_REV = Object.fromEntries([...V3_B79_ALPHABET].map((c, i) => [c, BigInt(i)]));

const V3_TOKEN_BYTES = Array.from({ length: 31 }, (_, i) => i + 1).filter(b => b !== 9 && b !== 10 && b !== 13);
const V3_DICT_STRINGS = [
  "aggravated", "Willpower", "Strength", "Dexterity", "Stamina",
  "Charisma", "Manipulation", "Appearance", "Perception", "Intelligence",
  "Generation", "Discipline", "Background", "Resources", "Allies",
  "Contacts", "Retainers", "Influence", "Mentor", "Status",
  " the ", " and ", " of ", " to ", " in ", " with ", " for ", "ing "
];

export function bytesToBase79(bytes) {
  if (!bytes || bytes.length === 0) return '';
  let n = 1n; // 0x01 sentinel preserves leading 0x00 bytes
  for (let i = 0; i < bytes.length; i++) {
    n = (n << 8n) | BigInt(bytes[i]);
  }
  const chars = [];
  while (n > 0n) {
    const rem = Number(n % V3_B79_BASE);
    n = n / V3_B79_BASE;
    chars.push(V3_B79_ALPHABET[rem]);
  }
  return chars.reverse().join('');
}

export function base79ToBytes(str) {
  if (!str) return new Uint8Array(0);
  let n = 0n;
  for (let i = 0; i < str.length; i++) {
    const v = V3_B79_REV[str[i]];
    if (v === undefined) throw new Error('Invalid Base79 character');
    n = n * V3_B79_BASE + v;
  }
  const hex = n.toString(16).padStart(2, '0');
  const paddedHex = hex.length % 2 ? '0' + hex : hex;
  const out = new Uint8Array(paddedHex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(paddedHex.slice(i * 2, i * 2 + 2), 16);
  }
  if (out[0] !== 1) throw new Error('Invalid sentinel byte');
  return out.slice(1);
}

export function writeVarint(arr, val) {
  let v = val >>> 0;
  while (v >= 0x80) {
    arr.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  arr.push(v);
}

export function readVarint(bytes, state) {
  let val = 0;
  let shift = 0;
  while (state.pos < bytes.length) {
    const b = bytes[state.pos++];
    val |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return val >>> 0;
    shift += 7;
  }
  throw new Error('Truncated varint');
}

export function dictEncodeUtf8(str) {
  const raw = new TextEncoder().encode(str);
  const tokenSet = new Set(V3_TOKEN_BYTES);
  const escaped = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    if (b === 0 || tokenSet.has(b)) escaped.push(0);
    escaped.push(b);
  }
  let latin = '';
  for (let i = 0; i < escaped.length; i++) latin += String.fromCharCode(escaped[i]);
  const pairs = V3_DICT_STRINGS
    .map((word, idx) => ({ word, tok: String.fromCharCode(V3_TOKEN_BYTES[idx]) }))
    .sort((a, b) => b.word.length - a.word.length);
  for (const { word, tok } of pairs) {
    latin = latin.split(word).join(tok);
  }
  const out = new Uint8Array(latin.length);
  for (let i = 0; i < latin.length; i++) out[i] = latin.charCodeAt(i);
  return out;
}

export function dictDecodeUtf8(bytes) {
  const tokMap = new Map();
  V3_TOKEN_BYTES.forEach((b, idx) => tokMap.set(b, new TextEncoder().encode(V3_DICT_STRINGS[idx])));
  const out = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0) {
      out.push(bytes[++i]);
    } else if (tokMap.has(b)) {
      const seq = tokMap.get(b);
      for (let j = 0; j < seq.length; j++) out.push(seq[j]);
    } else {
      out.push(b);
    }
  }
  return new TextDecoder().decode(new Uint8Array(out));
}
