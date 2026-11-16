import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeImport, sanitizeState } from '../assets/js/import-guard.js';
import { SAMPLE_CHARACTERS } from '../assets/js/sampleCharacters.js';

test('rejects unknown game lines and non-objects', () => {
  assert.equal(sanitizeImport(null).kind, 'invalid');
  assert.equal(sanitizeImport([]).kind, 'invalid');
  assert.equal(sanitizeImport({ splat: 'demon' }).kind, 'invalid');
  assert.equal(sanitizeImport({ type: 'wod20_roster_backup', roster: [{ state: { splat: 'hunter' } }] }).kind, 'invalid');
});

test('drops foreign keys, clamps dots, blocks unsafe portrait URLs', () => {
  const s = sanitizeState({
    splat: 'vampire',
    inputs: { vampire_char_name: 'A', mortal_char_name: 'B', 'bad key': 'C', vampire_portrait_url: 'javascript:alert(1)' },
    dots: { vampire_attr_str: 99, vampire_attr_dex: -3, vampire_attr_sta: 'x' },
    health: { vampire_hlth_0: 'lethal', vampire_hlth_1: 'on fire' }
  });
  assert.deepEqual(s.inputs, { vampire_char_name: 'A', vampire_portrait_url: '' });
  assert.deepEqual(s.dots, { vampire_attr_str: 10, vampire_attr_dex: 0 });
  assert.deepEqual(s.health, { vampire_hlth_0: 'lethal' });
});

test('every sample character survives the guard unchanged', () => {
  for (const [k, v] of Object.entries(SAMPLE_CHARACTERS)) {
    const s = sanitizeState(v);
    assert.ok(s, k);
    assert.deepEqual(s.inputs, v.inputs, k + ' inputs');
    assert.deepEqual(s.dots, v.dots, k + ' dots');
  }
});

test('roster backups keep valid slots and count skipped ones', () => {
  const r = sanitizeImport({ type: 'wod20_roster_backup', roster: [{ state: { splat: 'mage' } }, { state: { splat: 'nope' } }, 5] });
  assert.equal(r.kind, 'roster');
  assert.equal(r.states.length, 1);
  assert.equal(r.skipped, 2);
});
