import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bytesToBase79, base79ToBytes, writeVarint, readVarint, dictEncodeUtf8, dictDecodeUtf8, V3_B79_ALPHABET
} from '../assets/js/share-codec.js';

test('base79 round-trips arbitrary bytes, including leading zeros', () => {
  const cases = [[0], [0, 0, 1], [255], [1, 2, 3, 4, 5], Array.from({ length: 200 }, (_, i) => (i * 37) % 256)];
  for (const c of cases) {
    const bytes = Uint8Array.from(c);
    assert.deepEqual([...base79ToBytes(bytesToBase79(bytes))], c);
  }
});

test('base79 output uses only URL-fragment-safe alphabet characters', () => {
  const out = bytesToBase79(Uint8Array.from(Array.from({ length: 64 }, (_, i) => i * 4)));
  for (const ch of out) assert.ok(V3_B79_ALPHABET.includes(ch));
});

test('varint round-trips', () => {
  for (const v of [0, 1, 127, 128, 300, 16384, 2 ** 21]) {
    const arr = [];
    writeVarint(arr, v);
    assert.equal(readVarint(Uint8Array.from(arr), { pos: 0 }), v);
  }
});

test('dictionary UTF-8 round-trips text, accents and emoji', () => {
  const samples = [
    '', 'Strength', 'Dexterity and Stamina of the Resources with Allies',
    'The aggravated Willpower of the Contacts', 'Café Zoë — naïve 日本語 🐺'
  ];
  for (const s of samples) assert.equal(dictDecodeUtf8(dictEncodeUtf8(s)), s);
});
