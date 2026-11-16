// Shape and size checks for imported .json files (single character or roster backup).
// This does not judge game rules; it only rejects files that are malformed, oversized,
// or carry fields the sheet would never write.
import { V3_SPLATS, V3_WEREWOLF_FORMS } from './share-codec.js';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_ROSTER_SLOTS = 200;
export const MAX_LINK_BYTES = 1024 * 1024; // a share link may unpack to at most 1 MB
const MAX_FIELDS = 3000;
const MAX_TEXT = 20000;
const MAX_PORTRAIT = 1500000;
export const MAX_ROWS = 60;
const MAX_DOT = 10; // every dot or box row holds at most 10
const ID_RE = /^[A-Za-z0-9_/-]{1,120}$/;
const HEALTH_STATES = ['empty', 'bashing', 'lethal', 'aggravated'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clampInt = (v, lo, hi, dflt) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

function cleanMap(src, splat, valueFn) {
  const out = {};
  if (!isPlainObject(src)) return out;
  const prefix = splat + '_';
  let count = 0;
  for (const [key, val] of Object.entries(src)) {
    if (++count > MAX_FIELDS) break;
    if (!ID_RE.test(key) || !key.startsWith(prefix)) continue;
    const clean = valueFn(key, val);
    if (clean !== undefined) out[key] = clean;
  }
  return out;
}

function cleanCounts(src, keys) {
  const out = {};
  if (!isPlainObject(src)) return out;
  for (const k of keys) if (k in src) out[k] = clampInt(src[k], 0, MAX_ROWS, 0);
  return out;
}

/** Returns a cleaned copy of one character state, or null when it is not usable. */
export function sanitizeState(raw) {
  if (!isPlainObject(raw) || !V3_SPLATS.includes(raw.splat)) return null;
  const splat = raw.splat;
  const state = {
    splat,
    isTenDotMode: raw.isTenDotMode === true,
    meritCount: clampInt(raw.meritCount, 0, MAX_ROWS, 5),
    flawCount: clampInt(raw.flawCount, 0, MAX_ROWS, 5),
    combatCount: clampInt(raw.combatCount, 0, MAX_ROWS, 6),
    dynCounts: cleanCounts(raw.dynCounts, ['adv_0', 'adv_1', 'adv_2']),
    customAbiCounts: cleanCounts(raw.customAbiCounts, ['cat_0', 'cat_1', 'cat_2']),
    inputs: cleanMap(raw.inputs, splat, (key, val) => {
      if (typeof val !== 'string' && typeof val !== 'number') return undefined;
      const s = String(val);
      if (key.endsWith('_portrait_url')) {
        if (s.length > MAX_PORTRAIT) return '';
        if (s && !/^(https:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(s)) return '';
        return s;
      }
      return s.slice(0, MAX_TEXT);
    }),
    dots: cleanMap(raw.dots, splat, (_k, val) => clampInt(val, 0, MAX_DOT, undefined)),
    health: cleanMap(raw.health, splat, (_k, val) => (HEALTH_STATES.includes(val) ? val : undefined))
  };
  if (splat === 'werewolf') {
    state.werewolfForm = V3_WEREWOLF_FORMS.includes(raw.werewolfForm) ? raw.werewolfForm : 'homid';
  }
  return state;
}

/**
 * Classifies and cleans a parsed import.
 * @returns {{kind:'roster', states:object[], skipped:number} | {kind:'single', state:object} | {kind:'invalid', reason:string}}
 */
export function sanitizeImport(parsed) {
  if (!isPlainObject(parsed)) return { kind: 'invalid', reason: 'Not a character file' };
  if (parsed.type === 'wod20_roster_backup') {
    if (!Array.isArray(parsed.roster)) return { kind: 'invalid', reason: 'Backup has no roster' };
    const slots = parsed.roster.slice(0, MAX_ROSTER_SLOTS);
    const states = slots.map(s => (isPlainObject(s) ? sanitizeState(s.state) : null)).filter(Boolean);
    if (!states.length) return { kind: 'invalid', reason: 'No valid character slots in backup' };
    return { kind: 'roster', states, skipped: parsed.roster.length - states.length };
  }
  const state = sanitizeState(parsed);
  return state ? { kind: 'single', state } : { kind: 'invalid', reason: 'Unknown or missing game line' };
}

/**
 * Inflates a deflate-raw payload but stops at `maxBytes`, so a crafted link can't unpack
 * to gigabytes. Throws when the limit is passed.
 */
export async function inflateCapped(bytes, maxBytes = MAX_LINK_BYTES) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { await reader.cancel(); throw new Error('Link unpacks to more than ' + maxBytes + ' bytes'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

/**
 * A portrait given as a web address in someone else's file or link is held back: loading it
 * would let that website see the visitor's IP address. Returns the held address (or '') and
 * blanks it in the state.
 */
export function holdRemotePortrait(state) {
  if (!state || !state.inputs) return '';
  const key = state.splat + '_portrait_url';
  const url = state.inputs[key] || '';
  if (!/^https:\/\//i.test(url)) return '';
  state.inputs[key] = '';
  return url;
}
