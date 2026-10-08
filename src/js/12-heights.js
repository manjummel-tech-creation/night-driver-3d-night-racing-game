// =====================================================================================================
// heights: flats and lakes first, then every node, then a smooth grade-limited profile along every edge
// =====================================================================================================
for (const f of FLATS) f.y = baseRaw(f.x, f.z);
for (const c of CITIES) c.y = c.flat ? c.flat.y : roadT(c.x, c.z);
for (const ic of ICS) ic.y = ic.flat.y;
for (const L of LAKES){ L.wl = baseH(L.x, L.z) - 1.5; }
for (const n of NODES){ n.y = n.city && n.city.flat ? n.city.y : n.ic ? n.ic.y : roadT(n.x, n.z); }
// junctions on a hillside: nudge their heights toward each other until no road between two of them has to be steeper than its class allows
{ const GR = { cw: 0.045, rp: 0.07, rd: 0.075, st: 0.07, al: 0.095, mt: 0.11, dt: 0.13, ln: 0.09, rw: 0.004 };
  const fixed = n => !!(n.ic || (n.city && n.city.flat));
  for (let it = 0; it < 80; it++){ let moved = 0;
    for (const e of EDGES){ if (e.ic || e.a === e.b) continue; const lim = (GR[e.cls] || 0.08) * e.len, dy = e.b.y - e.a.y, ex = Math.abs(dy) - lim; if (ex <= 0.01) continue;
      const fa = fixed(e.a), fb = fixed(e.b); if (fa && fb) continue; const sg = Math.sign(dy) * ex * 0.5;
      if (fa) e.b.y -= sg * 2; else if (fb) e.a.y += sg * 2; else { e.a.y += sg; e.b.y -= sg; } moved++; }
    if (!moved) break; } }
function profileEdge(e){
  const n = e.n, y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = roadT(e.x[i], e.z[i]);
  const win = e.cls === 'cw' ? 360 : e.cls === 'rd' ? 150 : e.cls === 'ln' || e.cls === 'mt' || e.cls === 'dt' ? 90 : e.cls === 'rw' ? 600 : 0, w = Math.round(win / e.ds / 2);
  if (w > 0){ const cs = new Float64Array(n + 1); for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + y[i]; for (let i = 0; i < n; i++){ const a = Math.max(0, i - w), b = Math.min(n, i + w + 1); y[i] = (cs[b] - cs[a]) / (b - a); } }
  const g = (e.cls === 'cw' ? 0.05 : e.cls === 'rd' ? 0.085 : e.cls === 'al' ? 0.11 : e.cls === 'mt' ? 0.13 : e.cls === 'dt' ? 0.15 : e.cls === 'ln' ? 0.1 : e.cls === 'rw' ? 0.004 : 0.08) * e.ds;
  const pin = () => { const ca = e.a.y - y[0], cb = e.b.y - y[n - 1]; for (let i = 0; i < n; i++){ const t = i / (n - 1); y[i] += ca * (1 - t) + cb * t; } };
  pin();
  // level ground where roads meet at a junction (before the grade limit, so the ramp off the level bit is never steep)
  const fl = clamp(e.len * 0.1, 16, 28), rmp = clamp(e.len * 0.28, 12, 70); // short streets get short level bits, so there's room left to climb
  const fa = e.a.type === 'x' ? fl : 0, fb = e.b.type === 'x' ? fl : 0;
  const level = () => { for (let i = 0; i < n; i++){ const s = i * e.ds;
    if (fa) y[i] = lerp(e.a.y, y[i], smooth(fa, fa + rmp, s));
    if (fb) y[i] = lerp(e.b.y, y[i], smooth(fb, fb + rmp, e.len - s)); } };
  for (let it = 0; it < 5; it++){ // level the junction ends, then hold the grade, then make the ends meet their junctions exactly
    level();
    for (let i = 1; i < n; i++) y[i] = clamp(y[i], y[i - 1] - g, y[i - 1] + g);
    for (let i = n - 2; i >= 0; i--) y[i] = clamp(y[i], y[i + 1] - g, y[i + 1] + g);
    pin();
  }
  // round off every change of slope (vertical curves), so going over a crest or into a dip is smooth, never a ledge
  if (e.cls !== 'cw' && e.cls !== 'rp'){ const w = 5, tmp = new Float64Array(n);
    for (let pass = 0; pass < 3; pass++){ for (let i = 0; i < n; i++){ let a = 0; for (let j = i - w; j <= i + w; j++) a += j < 0 ? 2 * y[0] - y[Math.min(n - 1, -j)] : j > n - 1 ? 2 * y[n - 1] - y[Math.max(0, 2 * (n - 1) - j)] : y[j]; tmp[i] = a / (2 * w + 1); } for (let i = 1; i < n - 1; i++) y[i] = tmp[i]; }
    pin(); }
  e.y = y;
}
for (const e of EDGES) profileEdge(e);
// the two carriageways of an expressway run side by side at the same level (so the median can open anywhere)
for (const lk of LINKS){
  const [A, B] = lk.edges, ya = A.y.slice(), yb = B.y.slice();
  const at = (y, f) => { const i = Math.min(y.length - 2, Math.floor(f)), t = f - i; return y[i] + (y[i + 1] - y[i]) * t; };
  for (let i = 0; i < A.n; i++) A.y[i] = (ya[i] + at(yb, (1 - i / (A.n - 1)) * (B.n - 1))) / 2;
  for (let i = 0; i < B.n; i++) B.y[i] = (yb[i] + at(ya, (1 - i / (B.n - 1)) * (A.n - 1))) / 2;
}

// interchange levels: the second expressway crosses on a bridge, left-turn ramps fly over on two higher levels
function segX(ax, az, bx, bz, cx2, cz2, dx2, dz2){
  const r1x = bx - ax, r1z = bz - az, r2x = dx2 - cx2, r2z = dz2 - cz2, den = r1x * r2z - r1z * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx2 - ax) * r2z - (cz2 - az) * r2x) / den, u = ((cx2 - ax) * r1z - (cz2 - az) * r1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}
function crossings(e1, e2, step = 4){ // centre lines of two edges: where they cross, as [s1, s2]
  const out = [], k1 = Math.max(1, Math.round(step / e1.ds)), k2 = Math.max(1, Math.round(step / e2.ds));
  for (let i = 0; i + k1 < e1.n; i += k1){
    const ax = e1.x[i], az = e1.z[i], bx = e1.x[i + k1], bz = e1.z[i + k1];
    for (let j = 0; j + k2 < e2.n; j += k2){
      const cx2 = e2.x[j], cz2 = e2.z[j], dx2 = e2.x[j + k2], dz2 = e2.z[j + k2];
      if (Math.max(cx2, dx2) < Math.min(ax, bx) - 1 || Math.min(cx2, dx2) > Math.max(ax, bx) + 1 || Math.max(cz2, dz2) < Math.min(az, bz) - 1 || Math.min(cz2, dz2) > Math.max(az, bz) + 1) continue;
      const r = segX(ax, az, bx, bz, cx2, cz2, dx2, dz2); if (r) out.push([(i + r[0] * k1) * e1.ds, (j + r[1] * k2) * e2.ds]);
    }
  }
  return out;
}
const sampleY = (e, s) => { const f = clamp(s / e.ds, 0, e.n - 1), i = Math.min(e.n - 2, Math.floor(f)); return e.y[i] + (e.y[i + 1] - e.y[i]) * (f - i); };
for (const ic of ICS){
  for (const e of ic.edges) if (e.bump && e.bump.kind === 'cross'){ for (let i = 0; i < e.n; i++){ const d = Math.hypot(e.x[i] - ic.x, e.z[i] - ic.z); e.y[i] += e.bump.h * (1 - smooth(50, 250, d)); } }
  // each left ramp rises once it has peeled away from its carriageway, holds its level over the middle, and comes down before it merges
  const lefts = ic.ramps.filter(e => e.left);
  for (const e of lefts){
    const par = (i, end) => { // distance from the carriageway centre line at the start (or end) of this ramp
      const n0 = end ? e.b : e.a, i0 = end ? e.n - 1 : 0, j = end ? Math.max(0, e.n - 1 - 30) : Math.min(e.n - 1, 30);
      // parent carriageway direction: along the arm through the node
      const arm = ic.arms[end ? e.toArm : e.fromArm], ux = arm.u[0], uz = arm.u[1];
      const dx = e.x[i] - n0.x, dz = e.z[i] - n0.z; return Math.abs(dx * uz - dz * ux);
    };
    let sA = 0; for (let i = 0; i < e.n; i++) if (par(i, false) > 15){ sA = i * e.ds; break; }
    let sB = e.len; for (let i = e.n - 1; i >= 0; i--) if (par(i, true) > 15){ sB = i * e.ds; break; }
    e.sepA = sA; e.sepB = sB;
  }
  // two levels for the left ramps: neighbours cross each other, so alternate them
  lefts.forEach((e, k) => { e.peak = 15.5; });
  for (let k = 0; k < lefts.length; k++) for (let j = 0; j < k; j++) if (crossings(lefts[k], lefts[j]).length && lefts[k].peak <= lefts[j].peak + 1) lefts[k].peak = lefts[j].peak + 6.8;
  for (const e of lefts){
    const up = Math.max(220, e.peak / 0.066);
    for (let i = 0; i < e.n; i++){ const s = i * e.ds; e.y[i] += e.peak * smooth(e.sepA + 5, e.sepA + 5 + up, s) * (1 - smooth(e.sepB - 5 - up, e.sepB - 5, s)); }
  }
  // check the clearance at every crossing inside the interchange
  ic.clear = Infinity;
  for (let a = 0; a < ic.edges.length; a++) for (let b = 0; b < a; b++){
    const e1 = ic.edges[a], e2 = ic.edges[b]; if (e1.pair === e2) continue;
    for (const [s1, s2] of crossings(e1, e2)){
      const shared = (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) && (Math.min(s1, e1.len - s1) < 60 || Math.min(s2, e2.len - s2) < 60);
      if (shared) continue;
      const dy = Math.abs(sampleY(e1, s1) - sampleY(e2, s2)); ic.clear = Math.min(ic.clear, dy);
    }
  }
}

const edgeAt0 = (e, s) => { const f = clamp(s / e.ds, 0, e.n - 1), i = Math.min(e.n - 2, Math.floor(f)), t = f - i; return [e.x[i] + (e.x[i + 1] - e.x[i]) * t, e.z[i] + (e.z[i + 1] - e.z[i]) * t]; };
// local roads go over the expressways on bridges: lift the road where it crosses, with gentle ramps either side
const OVERPASSES = [];
{ const hi = EDGES.filter(e => (e.cls === 'cw' || e.cls === 'rp')), lo = EDGES.filter(e => !e.ic && e.cls !== 'cw' && e.cls !== 'rp');
  const bb = e => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = 0; i < e.n; i++){ x0 = Math.min(x0, e.x[i]); x1 = Math.max(x1, e.x[i]); z0 = Math.min(z0, e.z[i]); z1 = Math.max(z1, e.z[i]); } return [x0 - 20, x1 + 20, z0 - 20, z1 + 20]; };
  for (const e of hi) e.bb = bb(e);
  // a junction right beside an expressway that one of its roads crosses: lift the junction itself onto the bridge
  const raise = new Map();
  for (const e of lo){ const b = bb(e);
    for (const h of hi){ if (h.bb[0] > b[1] || h.bb[1] < b[0] || h.bb[2] > b[3] || h.bb[3] < b[2]) continue;
      for (const [s1, s2] of crossings(e, h)){ const [cx, cz] = edgeAt0(e, s1); if ([e.a, e.b].some(n => (n === h.a || n === h.b) && Math.hypot(cx - n.x, cz - n.z) < 90)) continue;
        const want = sampleY(h, s2) + 8.6;
        for (const [n, near] of [[e.a, s1 < 60], [e.b, s1 > e.len - 60]]) if (near && !n.ic && !(n.city && n.city.flat)) raise.set(n, Math.max(raise.get(n) || -Infinity, want)); } } }
  for (const [n, y] of raise) if (y > n.y) n.y = y;
  for (const e of EDGES) if (!e.ic && e.cls !== 'cw' && e.cls !== 'rp' && (raise.has(e.a) || raise.has(e.b))) profileEdge(e);
  for (const e of lo){ const b = bb(e); const lifts = [];
    for (const h of hi){ if (h.bb[0] > b[1] || h.bb[1] < b[0] || h.bb[2] > b[3] || h.bb[3] < b[2]) continue;
      const shared = [e.a, e.b].filter(n => n === h.a || n === h.b);
      for (const [s1, s2] of crossings(e, h)){
        if (shared.some(n => Math.hypot(edgeAt0(e, s1)[0] - n.x, edgeAt0(e, s1)[1] - n.z) < 90)) continue; // they meet at a junction, they don't cross
        lifts.push([s1, sampleY(h, s2) + 8.6]); } }
    if (!lifts.length) continue;
    const add = new Float64Array(e.n);
    for (const [sc, yc] of lifts){ const need = yc - sampleY(e, sc); if (need <= 0) continue; const run = Math.max(60, need / 0.07);
      OVERPASSES.push({ e, s: sc, y: yc });
      for (let i = 0; i < e.n; i++){ const d = Math.abs(i * e.ds - sc), k = d < 26 ? 1 : 1 - smooth(26, 26 + run, d); add[i] = Math.max(add[i], need * k); } }
    for (let i = 0; i < e.n; i++){ const s = i * e.ds; e.y[i] += add[i] * smooth(0, 30, s) * smooth(0, 30, e.len - s); }
    if (OVERPASSES.some(o => o.e === e)) e.overpass = true; }
}

// =====================================================================================================
// pack every edge into flat arrays: position, height, tangent and half widths for each 2 m sample
// =====================================================================================================
// which junctions are roundabouts (decided here so the roads into them can widen out)
function isRbNode(n){
  if (n.type !== 'x' || n.links.length < 3 || n.links.some(e => e.a === e.b)) return false;
  if (n.exitTerm) return true;
  if (n.links.some(e => e.cls === 'cw' || e.cls === 'rp') || (n.city && n.sq)) return false;
  const real = n.links.filter(e => e.cls === 'st' || e.cls === 'rd').length;
  return real >= 2 && (real >= 3 || !!n.city || !!n.town) && !(n.city && n.city.grid5);
}
for (const n of NODES) n.rb = isRbNode(n);
let NS = 0; for (const e of EDGES){ e.i0 = NS; NS += e.n; }
const SX = new Float32Array(NS), SZ = new Float32Array(NS), SY = new Float32Array(NS), STX = new Float32Array(NS), STZ = new Float32Array(NS), SHL = new Float32Array(NS), SHR = new Float32Array(NS), SE = new Int32Array(NS), SOF = new Float32Array(NS);
for (const e of EDGES){
  const C = e.C;
  for (let k = 0; k < e.n; k++){
    const i = e.i0 + k, a = Math.max(0, k - 1), b = Math.min(e.n - 1, k + 1);
    let tx = e.x[b] - e.x[a], tz = e.z[b] - e.z[a]; const l = Math.hypot(tx, tz) || 1;
    SX[i] = e.x[k]; SZ[i] = e.z[k]; SY[i] = e.y[k]; STX[i] = tx / l; STZ[i] = tz / l; SE[i] = e.id;
    let hr = C.hw, hl = C.hw;
    if (e.auxF) hr += C.LW * e.auxF(e.x[k], e.z[k]);
    if (e.paired){ // the two carriageways close up where an expressway meets a city: their inside edges meet in the middle
      const s = k * e.ds; let o = CW_O;
      if (e.gateA) o = lerp(CW_GATE_O, o, smooth(30, 420, s));
      if (e.gateB) o = lerp(CW_GATE_O, o, smooth(30, 420, e.len - s));
      SOF[i] = o; hl = Math.min(hl, o);
    }
    { const s = k * e.ds, F = (e.a.rb ? 1 - smooth(14, 62, s) : 0) + (e.b.rb ? 1 - smooth(14, 62, e.len - s) : 0); if (F > 0){ hr += 1.8 * F; if (!e.paired) hl += 1.8 * F; } } // the road widens out as it comes into a roundabout
    SHL[i] = hl; SHR[i] = hr;
  }
  e.x = e.z = null; // freed: the packed arrays are the truth now
}
const edgeOf = i => EDGES[SE[i]];
// a point on an edge by distance s (clamped), with its frame
const RP = { x: 0, y: 0, z: 0, tx: 0, tz: 1, nx: 1, nz: 0, h: 0, slope: 0, hl: 0, hr: 0, i: 0 };
function edgeAt(e, s, out = RP){
  const f = clamp(s / e.ds, 0, e.n - 1.0001), k = Math.floor(f), t = f - k, i = e.i0 + k, j = i + 1;
  out.x = SX[i] + (SX[j] - SX[i]) * t; out.y = SY[i] + (SY[j] - SY[i]) * t; out.z = SZ[i] + (SZ[j] - SZ[i]) * t;
  let tx = STX[i] + (STX[j] - STX[i]) * t, tz = STZ[i] + (STZ[j] - STZ[i]) * t; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
  out.tx = tx; out.tz = tz; out.nx = tz; out.nz = -tx; out.h = Math.atan2(tx, tz); out.slope = (SY[j] - SY[i]) / e.ds;
  out.hl = SHL[i] + (SHL[j] - SHL[i]) * t; out.hr = SHR[i] + (SHR[j] - SHR[i]) * t; out.i = i;
  return out;
}

// ---------- spatial hash of road samples (every 8 m) for "which roads are near this point"
const RH_C = 64, RH_NX = Math.ceil((WB.x1 - WB.x0) / RH_C), RH_NZ = Math.ceil((WB.z1 - WB.z0) / RH_C);
const roadHash = new Map();
for (const e of EDGES){
  const k = Math.max(1, Math.round(8 / e.ds));
  for (let q = 0; q < e.n; q += k){ const i = e.i0 + q, key = Math.floor((SX[i] - WB.x0) / RH_C) * 100000 + Math.floor((SZ[i] - WB.z0) / RH_C);
    let a = roadHash.get(key); if (!a){ a = []; roadHash.set(key, a); } a.push(i); }
  const i = e.i0 + e.n - 1, key = Math.floor((SX[i] - WB.x0) / RH_C) * 100000 + Math.floor((SZ[i] - WB.z0) / RH_C); let a = roadHash.get(key); if (!a){ a = []; roadHash.set(key, a); } a.push(i);
}
// refine a coarse sample on its edge to the nearest point: returns s, signed lateral d (+ = left), height and half widths
function refineOn(e, i0, x, z, out){
  let i = i0; const lo = e.i0, hi = e.i0 + e.n - 1;
  const d2 = j => { const dx = x - SX[j], dz = z - SZ[j]; return dx * dx + dz * dz; };
  let cur = d2(i);
  for (let it = 0; it < 400; it++){ const a = i > lo ? d2(i - 1) : Infinity, b = i < hi ? d2(i + 1) : Infinity; if (a < cur && a <= b){ i--; cur = a; } else if (b < cur){ i++; cur = b; } else break; }
  // project onto the segment toward whichever neighbour is closer
  let j = i < hi ? i + 1 : i - 1; if (i > lo && i < hi && d2(i - 1) < d2(i + 1)) j = i - 1;
  const a = Math.min(i, j), b = Math.max(i, j), sx = SX[b] - SX[a], sz = SZ[b] - SZ[a], L2 = sx * sx + sz * sz || 1;
  let t = ((x - SX[a]) * sx + (z - SZ[a]) * sz) / L2; t = clamp(t, 0, 1);
  const px = SX[a] + sx * t, pz = SZ[a] + sz * t, tx = STX[a], tz = STZ[a];
  out.e = e; out.i = a; out.s = (a - e.i0 + t) * e.ds; out.d = (x - px) * tz + (z - pz) * -tx;
  out.along = (x - px) * tx + (z - pz) * tz; // nonzero only past the ends of the edge
  out.y = SY[a] + (SY[b] - SY[a]) * t; out.hl = SHL[a] + (SHL[b] - SHL[a]) * t; out.hr = SHR[a] + (SHR[b] - SHR[a]) * t;
  out.dist = Math.hypot(x - px, z - pz);
  return out;
}
const _seen = new Map();
// every road edge within ~100 m of (x, z), each with its nearest point
function roadsNear(x, z, list){
  list.length = 0; _seen.clear();
  const cx = Math.floor((x - WB.x0) / RH_C), cz = Math.floor((z - WB.z0) / RH_C);
  for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++){
    const a = roadHash.get((cx + ox) * 100000 + cz + oz); if (!a) continue;
    for (const i of a){ const dx = x - SX[i], dz = z - SZ[i], d2 = dx * dx + dz * dz, e = SE[i], p = _seen.get(e); if (p === undefined || d2 < p[1]) _seen.set(e, [i, d2]); }
  }
  for (const [e, [i]] of _seen){ const q = refineOn(EDGES[e], i, x, z, {}); list.push(q); }
  return list;
}

// ---------- distance from anywhere to the nearest road, on a 40 m grid (vector-propagated)
const DF_C = 40, DF_NX = Math.ceil((WB.x1 - WB.x0) / DF_C) + 1, DF_NZ = Math.ceil((WB.z1 - WB.z0) / DF_C) + 1;
const DF_D = new Float32Array(DF_NX * DF_NZ).fill(1e9), DF_I = new Int32Array(DF_NX * DF_NZ).fill(-1);
(() => {
  for (let i = 0; i < NS; i += 2){
    const cx = Math.round((SX[i] - WB.x0) / DF_C), cz = Math.round((SZ[i] - WB.z0) / DF_C);
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++){
      const gx = cx + ox, gz = cz + oz; if (gx < 0 || gz < 0 || gx >= DF_NX || gz >= DF_NZ) continue;
      const c = gz * DF_NX + gx, d = Math.hypot(WB.x0 + gx * DF_C - SX[i], WB.z0 + gz * DF_C - SZ[i]); if (d < DF_D[c]){ DF_D[c] = d; DF_I[c] = i; } }
  }
  const relax = (c, gx, gz, n) => { const j = DF_I[n]; if (j < 0) return; const d = Math.hypot(WB.x0 + gx * DF_C - SX[j], WB.z0 + gz * DF_C - SZ[j]); if (d < DF_D[c]){ DF_D[c] = d; DF_I[c] = j; } };
  for (let pass = 0; pass < 2; pass++){
    for (let gz = 0; gz < DF_NZ; gz++) for (let gx = 0; gx < DF_NX; gx++){ const c = gz * DF_NX + gx;
      if (gx > 0) relax(c, gx, gz, c - 1); if (gz > 0){ relax(c, gx, gz, c - DF_NX); if (gx > 0) relax(c, gx, gz, c - DF_NX - 1); if (gx < DF_NX - 1) relax(c, gx, gz, c - DF_NX + 1); } }
    for (let gz = DF_NZ - 1; gz >= 0; gz--) for (let gx = DF_NX - 1; gx >= 0; gx--){ const c = gz * DF_NX + gx;
      if (gx < DF_NX - 1) relax(c, gx, gz, c + 1); if (gz < DF_NZ - 1){ relax(c, gx, gz, c + DF_NX); if (gx < DF_NX - 1) relax(c, gx, gz, c + DF_NX + 1); if (gx > 0) relax(c, gx, gz, c + DF_NX - 1); } }
  }
})();
function roadDist(x, z){
  const fx = clamp((x - WB.x0) / DF_C, 0, DF_NX - 1.001), fz = clamp((z - WB.z0) / DF_C, 0, DF_NZ - 1.001), gx = Math.floor(fx), gz = Math.floor(fz), tx = fx - gx, tz = fz - gz, c = gz * DF_NX + gx;
  return lerp(lerp(DF_D[c], DF_D[c + 1], tx), lerp(DF_D[c + DF_NX], DF_D[c + DF_NX + 1], tx), tz);
}

// ---------- the land: broad shape + relief that rises away from the roads (so roads run along valleys) + lakes
function reliefAt(x, z, m){
  const hills = fbm(x * 0.0016 - 2, z * 0.0016 + 9, 4);
  if (m < 0.01) return hills;
  const rg = 1 - Math.abs(2 * fbm(x * 0.0008 + 13, z * 0.0008 - 5, 5) - 1);
  return lerp(hills, rg * rg * 1.25 + hills * 0.25, m);
}
function natural(x, z){
  const m = mtnK(x, z), r = ruralK(z);
  let h = baseH(x, z); const fk = FK;
  const amp = lerp(lerp(70, 560, m), 15, r), wv = lerp(lerp(340, 1250, m), 260, r);
  const dist = roadDist(x, z);
  h += amp * reliefAt(x, z, m) * Math.pow(smooth(16, wv, dist), 1.25) * (1 - fk);
  for (const L of LAKES){ const q = lakeQ(L, x, z); if (q < 1.7){ const bed = L.wl - 1.8 - L.depth * Math.pow(clamp(1 - q, 0, 1), 0.6); h = lerp(bed, Math.max(h, L.wl + 0.6), smooth(0.92, 1.7, q)); } }
  return h;
}
const _near = [];
// the ground the player sees: natural land, cut down or built up to every road nearby (bridges stay bridges)
function groundAt(x, z){
  let h = natural(x, z);
  if (typeof PADS !== 'undefined' && PADS.length) h = padGround(x, z, h);
  if (roadDist(x, z) > 150) return h;
  roadsNear(x, z, _near);
  let fill = -Infinity, wet = false; for (const L of LAKES) if (lakeQ(L, x, z) < 1.15){ wet = true; break; }
  for (const q of _near){ // embankments first: ordinary roads sit on the land (a bank of earth under them), only expressways and water crossings are bridges
    const side = q.d >= 0 ? q.hl : q.hr, dd = Math.abs(q.along) > 1 ? q.dist : Math.abs(q.d), over = q.y - h, e = q.e;
    const banked = !wet && !e.ic && e.cls !== 'cw' && e.cls !== 'rp' && !(e.overpass && OVERPASSES.some(o => o.e === e && Math.abs(o.s - q.s) < 70));
    if (over > 0 && (over < 9 || banked)){ const t = smooth(side + 4, side + 5 + over * 1.6 + 8, dd); fill = Math.max(fill, lerp(q.y - 0.45, h, t)); }
  }
  if (fill > h) h = fill;
  for (const q of _near){ // then cuttings: never let the land cover a road
    const side = q.d >= 0 ? q.hl : q.hr, dd = Math.abs(q.along) > 1 ? q.dist : Math.abs(q.d), under = h - q.y;
    if (under > -0.6){ const t = smooth(side + 9, side + 16 + Math.max(0, under) * 1.3, dd); h = Math.min(h, lerp(q.y - 0.6, h, t)); }
  }
  if (typeof PATCHES !== 'undefined') for (const p of patchesNear(x, z)){ // junction and dead-end discs: level ground around them, never buried
    const r = p.sq ? p.sq * 1.42 : p.r, d = Math.hypot(x - p.x, z - p.z); if (d > r + 40) continue;
    const t = smooth(r + 3, r + 16 + Math.abs(h - p.y) * 1.2, d); h = lerp(p.y - 0.6, h, t);
  }
  return h;
}

// =====================================================================================================
// routing: shortest paths over the directed road graph (one-way edges only go a -> b)
// =====================================================================================================
function outEdges(n){ const out = []; for (const e of n.links){ if (e.a === n) out.push([e, 1]); if (!e.oneway && e.b === n && e.a !== n) out.push([e, -1]); else if (!e.oneway && e.a === n && e.b === n) out.push([e, -1]); } return out; }
for (const n of NODES) n.out = outEdges(n);
// distance from every node to a target node (reverse Dijkstra), cached
const _dCache = new Map();
function distTo(target){
  let d = _dCache.get(target.id); if (d) return d;
  d = new Float64Array(NODES.length).fill(Infinity); d[target.id] = 0;
  const heap = [[0, target.id]];
  const push = (v, n) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length){
    const [dv, v] = pop(); if (dv > d[v]) continue;
    const nv = NODES[v];
    for (const e of nv.links){ // edges arriving at v: from e.a (forward) or, if two-way, from e.b
      if (e.b === nv){ const u = e.a.id, nd = dv + e.len; if (nd < d[u]){ d[u] = nd; push(nd, u); } }
      if (!e.oneway && e.a === nv){ const u = e.b.id, nd = dv + e.len; if (nd < d[u]){ d[u] = nd; push(nd, u); } }
    }
  }
  _dCache.set(target.id, d); return d;
}
// cost to reach a point (edge e at s) from a node: through either end the road allows
function costToPoint(nodeId, e, s){
  const da = distTo(e.a)[nodeId], db = distTo(e.b)[nodeId];
  let best = Infinity;
  if (isFinite(da)) best = Math.min(best, da + s); // arrive at a, drive forward to s (always allowed)
  if (isFinite(db) && !e.oneway) best = Math.min(best, db + e.len - s);
  return best;
}
