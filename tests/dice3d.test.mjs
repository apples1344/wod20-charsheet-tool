import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from '../assets/js/dice3d.js';

const { D10, restingOrientation, qRot } = __test;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

test('d10 mesh: 10 planar kite faces numbered 1-10, opposite faces sum to 11', () => {
  assert.equal(D10.faces.length, 10);
  assert.deepEqual(D10.faces.map(f => f.value).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const f of D10.faces) {
    const p = f.idx.map(i => D10.verts[i]);
    for (const q of p) assert.ok(Math.abs(dot(sub(q, p[0]), f.normal)) < 1e-9, 'planar face ' + f.value);
    const opp = D10.faces.find(g => dot(g.normal, f.normal) < -0.999);
    assert.ok(opp, 'has opposite face');
    assert.equal(opp.value + f.value, 11);
  }
});

test('every value comes to rest facing the viewer', () => {
  let s = 1;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let v = 1; v <= 10; v++) {
    const q = restingOrientation(v, rng);
    const best = D10.faces.reduce((a, f) => (qRot(q, f.normal)[2] > qRot(q, a.normal)[2] ? f : a));
    assert.equal(best.value, v);
    assert.ok(qRot(q, best.up)[1] > 0.5, 'number is upright');
  }
});
