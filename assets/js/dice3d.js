// 3D d10 renderer on a plain <canvas> (no WebGL, no libraries).
// The roll result is decided first (dice.js); this module only animates dice that
// tumble and land showing those values. Usage:
//   const stage = createDiceStage(canvas);
//   await stage.roll([{ value: 7, tone: 'success' }, ...]);

// ---------- small vector / quaternion helpers ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

const qMul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]
];
const qAxis = (axis, ang) => { const s = Math.sin(ang / 2); const n = norm(axis); return [Math.cos(ang / 2), n[0] * s, n[1] * s, n[2] * s]; };
const qRot = (q, v) => {
  const [w, x, y, z] = q;
  const t = scale(cross([x, y, z], v), 2);
  return add(add(v, scale(t, w)), cross([x, y, z], t));
};
const qFromTo = (u, v) => {
  const d = dot(u, v);
  if (d < -0.999999) {
    const axis = Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 1, 0]);
    return qAxis(axis, Math.PI);
  }
  const c = cross(u, v);
  const q = [1 + d, c[0], c[1], c[2]];
  const l = Math.hypot(...q);
  return q.map(n => n / l);
};

// ---------- d10 mesh (pentagonal trapezohedron) ----------
const H = 1.0;
const C36 = Math.cos(Math.PI / 5);
const A = H * (1 - C36) / (1 + C36); // ring height that keeps every kite face planar
const RING = 0.95;

function buildD10() {
  const v = [[0, H, 0], [0, -H, 0]];
  for (let k = 0; k < 5; k++) { const a = (2 * Math.PI * k) / 5; v.push([RING * Math.cos(a), A, RING * Math.sin(a)]); }
  for (let k = 0; k < 5; k++) { const a = (2 * Math.PI * k) / 5 + Math.PI / 5; v.push([RING * Math.cos(a), -A, RING * Math.sin(a)]); }
  const U = (k) => 2 + (k % 5);
  const L = (k) => 7 + (k % 5);

  // Opposite faces add up to 11, like a real d10 marked 1-10.
  const topVals = [1, 7, 5, 3, 9];
  const bottomVals = [];
  for (let k = 0; k < 5; k++) bottomVals[(k + 2) % 5] = 11 - topVals[k];

  const faces = [];
  for (let k = 0; k < 5; k++) faces.push({ idx: [0, U(k), L(k), U(k + 1)], apex: 0, value: topVals[k] });
  for (let k = 0; k < 5; k++) faces.push({ idx: [1, L(k), U(k + 1), L(k + 1)], apex: 1, value: bottomVals[k] });

  for (const f of faces) {
    const p = f.idx.map(i => v[i]);
    let n = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    const center = scale(p.reduce((s, q) => add(s, q), [0, 0, 0]), 1 / 4);
    if (dot(n, center) < 0) { f.idx.reverse(); n = scale(n, -1); }
    // Numbers sit a little toward the wide end of the kite, like printed dice.
    const apexPt = v[f.apex];
    f.center = add(center, scale(sub(center, apexPt), 0.12)); // both points lie on the face, so this does too
    f.normal = n;
    const up = sub(apexPt, f.center);
    f.up = norm(sub(up, scale(n, dot(up, n))));
  }
  return { verts: v, faces };
}
const D10 = buildD10();

// ---------- appearance ----------
export const DICE_TONES = {
  rolling: { body: [112, 20, 28], ink: '#f4ead8' },
  success: { body: [31, 110, 67], ink: '#f4ead8' },
  ten: { body: [176, 132, 22], ink: '#1b1405' },
  one: { body: [150, 18, 24], ink: '#fff2f0' },
  miss: { body: [52, 52, 58], ink: '#d8d8dc' },
  neutral: { body: [112, 20, 28], ink: '#f4ead8' }
};
/** Colour group for a rolled value at a difficulty (1s, 10s, successes, misses). */
export function toneFor(val, difficulty) {
  if (val === 1) return 'one';
  if (val === 10) return 'ten';
  if (val >= difficulty) return 'success';
  return 'miss';
}

const LIGHT = norm([-0.45, 0.65, 0.9]);
const lerp = (a, b, t) => a + (b - a) * t;
const mixRgb = (a, b, t) => [0, 1, 2].map(i => Math.round(lerp(a[i], b[i], t)));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Orientation that shows `value` toward the viewer, upright, with a little tilt. */
function restingOrientation(value, rng) {
  const face = D10.faces.find(f => f.value === value) || D10.faces[0];
  const q1 = qFromTo(face.normal, [0, 0, 1]);
  const up1 = qRot(q1, face.up);
  const spin = Math.atan2(up1[0], up1[1]); // angle from +y
  const jitter = (rng() - 0.5) * 0.7;
  const q2 = qAxis([0, 0, 1], spin + jitter);
  const tilt = qAxis([1, 0, 0], -0.32 + (rng() - 0.5) * 0.12);
  return qMul(tilt, qMul(q2, q1));
}

export function createDiceStage(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const rng = opts.rng || Math.random;
  let dice = [];
  let raf = 0;
  let resolveCurrent = null;
  let cssW = 0, cssH = 0, dpr = 1;
  const camDist = 14;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = Math.max(1, r.width);
    cssH = Math.max(1, r.height);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    draw(performance.now());
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);

  function layout(n) {
    const aspect = cssW / cssH || 2;
    const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * aspect))));
    const rows = Math.ceil(n / cols);
    const cell = 3.0;
    const focal = Math.min(cssW / (cols * cell), cssH / (rows * cell)) * camDist;
    const slots = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const rowCount = r === rows - 1 ? n - r * cols : cols;
      const x = (c - (rowCount - 1) / 2) * cell;
      const y = ((rows - 1) / 2 - r) * cell;
      slots.push([x + (rng() - 0.5) * 0.5, y + (rng() - 0.5) * 0.4]);
    }
    return { slots, focal: Math.min(focal, cssH * 4.2) };
  }

  let focal = 300;
  const project = (p) => {
    const k = focal / (camDist - p[2]);
    return [cssW / 2 + p[0] * k, cssH / 2 - p[1] * k];
  };

  function drawBackground() {
    const g = ctx.createRadialGradient(cssW / 2, cssH * 0.45, 10, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.75);
    g.addColorStop(0, opts.feltInner || '#2b1416');
    g.addColorStop(1, opts.feltOuter || '#0d0708');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function drawDie(d) {
    const pos = d.pos;
    // shadow on the table
    const sh = project([pos[0] + 0.25, pos[1] - 0.3, 0]);
    const shK = focal / camDist;
    ctx.save();
    ctx.globalAlpha = Math.max(0.12, 0.45 - pos[2] * 0.08);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sh[0], sh[1], 1.05 * shK * (1 + pos[2] * 0.06), 0.8 * shK * (1 + pos[2] * 0.06), 0, 0, Math.PI * 2);
    ctx.filter = 'blur(4px)';
    ctx.fill();
    ctx.restore();

    const world = D10.verts.map(v => add(qRot(d.q, v), pos));
    const screen = world.map(project);
    const tone = d.revealT > 0 ? DICE_TONES[d.tone] || DICE_TONES.neutral : DICE_TONES.rolling;
    const body = mixRgb(DICE_TONES.rolling.body, tone.body, d.revealT);
    const ink = d.revealT > 0.5 ? tone.ink : DICE_TONES.rolling.ink;

    for (const f of D10.faces) {
      const n = qRot(d.q, f.normal);
      const c = add(qRot(d.q, f.center), pos);
      const toCam = norm(sub([0, 0, camDist], c));
      if (dot(n, toCam) <= 0.02) continue;
      const shade = 0.42 + 0.58 * Math.max(0, dot(n, LIGHT));
      const rim = Math.pow(1 - Math.max(0, dot(n, toCam)), 3) * 0.25;
      const col = body.map(ch => Math.min(255, Math.round(ch * shade + 255 * rim)));
      ctx.beginPath();
      f.idx.forEach((vi, i) => { const p = screen[vi]; if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
      ctx.closePath();
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(0,0,0,0.35)`;
      ctx.stroke();

      // number, drawn in the face plane with an affine fit of the projection
      const facing = dot(n, toCam);
      if (facing < 0.18) continue;
      const up = qRot(d.q, f.up);
      const right = cross(up, n);
      const u = 0.01; // world units per text pixel
      const p0 = project(c);
      const pr = project(add(c, scale(right, u)));
      const pu = project(add(c, scale(up, u)));
      ctx.save();
      ctx.setTransform(
        dpr * (pr[0] - p0[0]), dpr * (pr[1] - p0[1]),
        -dpr * (pu[0] - p0[0]), -dpr * (pu[1] - p0[1]),
        dpr * p0[0], dpr * p0[1]
      );
      ctx.globalAlpha = Math.min(1, (facing - 0.18) * 4);
      const label = String(f.value);
      ctx.font = `bold ${label.length > 1 ? 34 : 42}px Georgia, 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ink;
      ctx.fillText(label, 0, 2);
      if (f.value === 6 || f.value === 9) ctx.fillRect(-11, 22, 22, 4); // tell 6 and 9 apart
      ctx.restore();
    }

    if (d.revealT > 0 && (d.tone === 'one' || d.tone === 'ten')) {
      const center = project(pos);
      ctx.save();
      ctx.globalAlpha = 0.55 * d.revealT;
      ctx.strokeStyle = d.tone === 'ten' ? '#ffd56b' : '#ff5a5a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center[0], center[1], 1.22 * focal / camDist, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    if (!dice.length && opts.emptyText) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.emptyText, cssW / 2, cssH / 2);
      return true;
    }
    let done = true;
    for (const d of dice) {
      const t = Math.min(1, Math.max(0, (now - d.start) / d.duration));
      if (t < 1) done = false;
      const e = easeOutCubic(t);
      d.pos = [
        lerp(d.from[0], d.to[0], e),
        lerp(d.from[1], d.to[1], e),
        d.hop * Math.pow(1 - t, 2) * Math.abs(Math.cos(2.5 * Math.PI * t))
      ];
      d.q = qMul(qAxis(d.axis, d.spin * (1 - e)), d.qEnd);
      const rt = Math.min(1, Math.max(0, (now - d.start - d.duration) / 260));
      d.revealT = d.revealOn ? rt : 0;
      if (d.revealOn && rt < 1) done = false;
    }
    // back-to-front: lower on screen (smaller y) and lower z drawn first
    [...dice].sort((a, b) => (b.pos[1] - a.pos[1]) || (a.pos[2] - b.pos[2])).forEach(drawDie);
    return done;
  }

  function loop(now) {
    const done = draw(now);
    if (!done) raf = requestAnimationFrame(loop);
    else {
      raf = 0;
      if (resolveCurrent) { const r = resolveCurrent; resolveCurrent = null; r(); }
    }
  }

  /**
   * @param {{value:number, tone?:string}[]} values  1-10 each; tone = success|ten|one|miss|neutral
   * @param {{reveal?:boolean}} o  reveal: tint dice by tone after they land (default true)
   * @returns {Promise<void>} resolves when every die has landed
   */
  function roll(values, o = {}) {
    if (raf) cancelAnimationFrame(raf);
    if (resolveCurrent) { const r = resolveCurrent; resolveCurrent = null; r(); }
    resize();
    const list = values.slice(0, 50);
    const { slots, focal: f } = layout(Math.max(1, list.length));
    focal = f;
    const now = performance.now();
    const still = prefersReducedMotion() || o.instant;
    dice = list.map((v, i) => {
      const to = slots[i];
      const fromSide = rng() < 0.5 ? -1 : 1;
      return {
        value: v.value,
        tone: v.tone || 'neutral',
        revealOn: o.reveal !== false,
        from: still ? to : [to[0] + fromSide * (6 + rng() * 4), to[1] - 5 - rng() * 3],
        to,
        hop: still ? 0 : 2.2 + rng() * 1.6,
        start: still ? now - 2000 : now + i * Math.min(35, 500 / list.length) + rng() * 60,
        duration: still ? 1 : 950 + rng() * 450,
        axis: norm([rng() - 0.5, rng() - 0.5, rng() - 0.5]),
        spin: still ? 0 : (5 + rng() * 5) * Math.PI,
        qEnd: restingOrientation(v.value, rng),
        pos: [0, 0, 0],
        q: [1, 0, 0, 0],
        revealT: 0
      };
    });
    canvas.setAttribute('aria-label', list.length ? `Dice: ${list.map(v => v.value).join(', ')}` : 'No dice');
    return new Promise((resolve) => {
      resolveCurrent = resolve;
      raf = requestAnimationFrame(loop);
    });
  }

  function clear() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    dice = [];
    draw(performance.now());
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
  }

  resize();
  return { roll, clear, resize, destroy };
}

// exported for tests
export const __test = { D10, restingOrientation, qRot };
