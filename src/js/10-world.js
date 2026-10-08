// =====================================================================================================
// THE WORLD. 32 km east-west, 53 km north-south. +x is east and +z is SOUTH, so north is -z (the map draws -z up).
// The south is mountains, the middle is forest and lakes, the north is open farmland. Five cities, four expressways
// with stacked interchanges, and winding two-lane roads in between.
// =====================================================================================================
const WB = { x0: -16000, x1: 16000, z0: -26500, z1: 26500 };
const westK = (x, z) => smooth(-10200, -13200, x) * (1 - smooth(-10500, -14500, z)); // the West Ridge
const mtnK = (x, z) => Math.max(smooth(2500, 9500, z), westK(x, z));
const ruralK = z => 1 - smooth(-15500, -9000, z);
// THE SEA OF TREES (樹海, JUKAI): a huge old forest in the north-west on a bumpy old lava field, thick enough to get lost in
const JUKAI = { x: -12900, z: -17500, rx: 3000, rz: 3400 };
const jukaiK = (x, z) => { const dx = (x - JUKAI.x) / JUKAI.rx, dz = (z - JUKAI.z) / JUKAI.rz, q = dx * dx + dz * dz; if (q > 1.8) return 0; const w = 0.1 * Math.sin(Math.atan2(dz, dx) * 5 + 1.3); return 1 - smooth(0.7 + w, 1.05 + w, q); };
function regionName(x, z){ const m = mtnK(x, z), r = ruralK(z); return jukaiK(x, z) > 0.5 ? 'THE SEA OF TREES' : m > 0.5 ? 'MOUNTAINS' : r > 0.5 ? 'FARMLAND' : 'FOREST'; }

// ---------- flat pads (cities, interchanges) and lakes
const FLATS = [];
function addFlat(x, z, r0, r1, sq){ const f = { x, z, r0, r1, sq: !!sq, y: 0 }; FLATS.push(f); return f; }
let FK = 0, FY = 0;
function flatAt(x, z){
  FK = 0; FY = 0;
  for (let i = 0; i < FLATS.length; i++){ const f = FLATS[i], dx = x - f.x, dz = z - f.z;
    if (dx > f.r1 || dx < -f.r1 || dz > f.r1 || dz < -f.r1) continue;
    const d = f.sq ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.sqrt(dx * dx + dz * dz), k = 1 - smooth(f.r0, f.r1, d);
    if (k > FK){ FK = k; FY = f.y; } }
}
const LAKES = [
  { name: 'LAKE KAWAGUCHI', x: -12150, z: 7400, rx: 1450, rz: 2900, depth: 16 },
  { name: 'LAKE SAGAMI', x: -4300, z: 8500, rx: 650, rz: 1250, depth: 10 },
  { name: 'NAGISA BAY', x: 14200, z: 2000, rx: 1800, rz: 3300, depth: 20 },
  { name: 'LAKE SHIRAKABA', x: -11600, z: -5600, rx: 1300, rz: 1700, depth: 12 },
  { name: 'LAKE ASHI', x: -1400, z: 18700, rx: 900, rz: 620, depth: 12 },
  { name: 'MIRROR POND', x: -11800, z: -15600, rx: 850, rz: 650, depth: 8 },
];
function lakeQ(L, x, z){
  const dx = (x - L.x) / L.rx, dz = (z - L.z) / L.rz, q = Math.sqrt(dx * dx + dz * dz);
  if (q > 2) return q;
  const a = Math.atan2(dz, dx);
  return q / (1 + 0.22 * (vnoise(Math.cos(a) * 1.6 + L.x * 0.001, Math.sin(a) * 1.6 + L.z * 0.001) - 0.5));
}
const HILLS = [{ x: 1540, z: 20420, r: 330, h: 40 }, // Hakone's hillside
  { x: 9400, z: 22600, r: 2600, h: 720, name: 'TENGU' }, { x: -11200, z: 16100, r: 2400, h: 620, name: 'KUMOTORI' }, { x: -14200, z: -3800, r: 1800, h: 480, name: 'ONIDAKE' }, { x: 2600, z: 25350, r: 1400, h: 450, name: 'YUKIDAKE' }]; // lower than they were, so the climbs are kinder
// broad elevation: low forest and farmland, climbing to a 250 m plateau in the mountainous south
function baseRaw(x, z){
  const m = mtnK(x, z), r = ruralK(z);
  let hill = 0; for (const H of HILLS){ const dx = x - H.x, dz = z - H.z, d2 = dx * dx + dz * dz; if (d2 < 9 * H.r * H.r) hill += H.h * Math.exp(-d2 / (H.r * H.r)); }
  return hill + 22 + 250 * smooth(4000, 17500, z) + 240 * westK(x, z) + 80 * m * (fbm(x * 0.00012 + 3.1, z * 0.00012 - 1.7, 3) - 0.5)
    + 50 * (1 - m) * (1 - r) * (fbm(x * 0.00028 - 7, z * 0.00028 + 2, 3) - 0.45) + 12 * r * (vnoise(x * 0.0004, z * 0.0004) - 0.5) + 18 * jukaiK(x, z) * (fbm(x * 0.0035 + 11, z * 0.0035 - 5, 2) - 0.5); // the sea of trees grows on rough old lava
}
function baseH(x, z){ const b = baseRaw(x, z); flatAt(x, z); return FK > 0 ? lerp(b, FY, FK) : b; }
// the height a road wants here: the broad shape of the land, and a bridge deck over any water
function roadT(x, z){
  let h = baseH(x, z);
  if (FK < 0.99) h += (1 - FK) * (1 - ruralK(z) * 0.6) * 14 * (vnoise(x * 0.0021 + 4, z * 0.0021 - 3) - 0.5);
  for (const L of LAKES){ const q = lakeQ(L, x, z); if (q < 1.45) h = Math.max(h, L.wl + 7.5 * (1 - smooth(1.08, 1.45, q))); }
  return h;
}

// ---------- road classes
const LANE_SHIFT = 7.4; // an auxiliary lane sits this far right of a carriageway's centre
const CLS = {
  cw: { key: 'cw', lanes: 3, LW: 3.7, hw: 7.15, oneway: true, lim: 130, rank: 3, step: 6, rail: true },
  rp: { key: 'rp', lanes: 1, LW: 3.8, hw: 3.7, oneway: true, lim: 90, rank: 2, step: 4, rail: true },
  rd: { key: 'rd', lanes: 1, LW: 3.6, hw: 4.9, med: 0.15, oneway: false, lim: 100, rank: 1, step: 4, rail: true },
  st: { key: 'st', lanes: 2, LW: 3.4, hw: 7.7, med: 0.3, oneway: false, lim: 70, rank: 0, step: 4, rail: false },
  al: { key: 'al', lanes: 1, LW: 3.0, hw: 3.7, med: 0.1, oneway: false, lim: 40, rank: 0, step: 3, rail: false },
  ln: { key: 'ln', lanes: 1, LW: 3.1, hw: 3.9, med: 0.1, oneway: false, lim: 60, rank: 1, step: 4, rail: false },
  mt: { key: 'mt', lanes: 1, LW: 3.6, hw: 4.9, med: 0.1, oneway: false, lim: 50, rank: 1, step: 3, rail: true }, // wide enough to hold a slide
  dt: { key: 'dt', lanes: 1, LW: 3.0, hw: 3.6, med: 0, oneway: false, lim: 60, rank: 1, step: 4, rail: false },
  rw: { key: 'rw', lanes: 1, LW: 12, hw: 22, med: 0, oneway: false, lim: 300, rank: 1, step: 8, rail: false },
};
const CW_O = 8.25, CW_GATE_O = 5.6;

// ---------- graph
const NODES = [], EDGES = [];
function addNode(x, z, type, extra){ const n = Object.assign({ id: NODES.length, x, z, y: 0, type, links: [], city: null, ic: null }, extra || {}); NODES.push(n); return n; }
function resample(X, Z, step){
  const m = X.length, cum = new Float64Array(m);
  for (let i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
  const L = cum[m - 1], n = Math.max(2, Math.round(L / step) + 1), ds = L / (n - 1), x = new Float64Array(n), z = new Float64Array(n);
  let j = 0;
  for (let k = 0; k < n; k++){
    const s = k * ds; while (j < m - 2 && cum[j + 1] < s) j++;
    const t = clamp((s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]), 0, 1);
    x[k] = X[j] + (X[j + 1] - X[j]) * t; z[k] = Z[j] + (Z[j + 1] - Z[j]) * t;
  }
  return { x, z, n, len: L, ds };
}
// centripetal Catmull-Rom through control points [[x,z],...], returned as a dense polyline
function crDense(P, step){
  const n = P.length, X = [], Z = [];
  const get = i => i < 0 ? [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]] : i >= n ? [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]] : P[i];
  const tj = (a, b) => Math.max(1e-3, Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5));
  for (let i = 0; i < n - 1; i++){
    const p0 = get(i - 1), p1 = P[i], p2 = P[i + 1], p3 = get(i + 2);
    const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    const m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < m; k++){
      const t = t1 + (t2 - t1) * k / m, out = [0, 0];
      for (let c = 0; c < 2; c++){
        const A1 = (t1 - t) / (t1 - t0) * p0[c] + (t - t0) / (t1 - t0) * p1[c];
        const A2 = (t2 - t) / (t2 - t1) * p1[c] + (t - t1) / (t2 - t1) * p2[c];
        const A3 = (t3 - t) / (t3 - t2) * p2[c] + (t - t2) / (t3 - t2) * p3[c];
        const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
        const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
        out[c] = (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
      }
      X.push(out[0]); Z.push(out[1]);
    }
  }
  X.push(P[n - 1][0]); Z.push(P[n - 1][1]);
  return { X, Z };
}
function minRadius(r, skip = 30){
  const k = Math.max(4, Math.round(12 / r.ds)); let worst = Infinity;
  for (let i = Math.round(skip / r.ds) + k; i < r.n - k - Math.round(skip / r.ds); i += 2){
    const h0 = Math.atan2(r.x[i] - r.x[i - k], r.z[i] - r.z[i - k]), h1 = Math.atan2(r.x[i + k] - r.x[i], r.z[i + k] - r.z[i]);
    const dh = Math.abs(angWrap(h1 - h0)); if (dh > 1e-6) worst = Math.min(worst, k * r.ds / dh);
  }
  return worst;
}
// left normal of a direction (tx, tz): (tz, -tx). Right-hand traffic keeps to -N.
function polyNormals(x, z){
  const n = x.length, nx = new Float64Array(n), nz = new Float64Array(n);
  for (let i = 0; i < n; i++){ const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); let tx = x[b] - x[a], tz = z[b] - z[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; nx[i] = tz; nz[i] = -tx; }
  return { nx, nz };
}
function mkEdge(a, b, cls, X, Z, o){
  const r = resample(X, Z, 2);
  const e = Object.assign({ id: EDGES.length, a, b, cls, C: CLS[cls], x: r.x, z: r.z, n: r.n, len: r.len, ds: r.ds, oneway: CLS[cls].oneway, lanes: CLS[cls].lanes, LW: CLS[cls].LW,
    name: '', route: '', hwRf: null, hwLf: null, ic: null, city: null, lit: false, bump: null, flatA: 0, flatB: 0 }, o || {});
  EDGES.push(e); a.links.push(e); if (b !== a) b.links.push(e);
  return e;
}

// ---------- expressways: two one-way carriageways side by side, three lanes each, a double guard rail between them
// a port is where a link attaches: { x, z, dx, dz (unit, pointing away from the junction), outN, inN, gate }
function hwLink(pa, pb, o){
  const H = o.handle ?? 520, Rmin = o.Rmin ?? 420;
  const A = [pa.x + pa.dx * H, pa.z + pa.dz * H], B = [pb.x + pb.dx * H, pb.z + pb.dz * H], anchors = [A, ...(o.via || []), B];
  let wig = o.wig ?? 380, best = null;
  for (let tries = 0; tries < 10; tries++){
    const R = mulberry(o.seed || 7), ctrl = [[pa.x, pa.z]];
    for (let k = 0; k < anchors.length - 1; k++){
      const P = anchors[k], Q = anchors[k + 1], L = Math.hypot(Q[0] - P[0], Q[1] - P[1]), m = Math.max(1, Math.round(L / 1800));
      const px = -(Q[1] - P[1]) / L, pz = (Q[0] - P[0]) / L;
      ctrl.push(P);
      for (let j = 1; j < m; j++){ const t = j / m, w = wig * (R() * 2 - 1); ctrl.push([P[0] + (Q[0] - P[0]) * t + px * w, P[1] + (Q[1] - P[1]) * t + pz * w]); }
    }
    ctrl.push(B, [pb.x, pb.z]);
    const d = crDense(ctrl, 8), r = resample(d.X, d.Z, 2), mr = minRadius(r, 60);
    best = { r, mr };
    if (mr >= Rmin || wig < 20) break;
    wig *= 0.62;
  }
  if (o.dry) return best; // just the line, for checking before building anything
  if (best.mr < Rmin * 0.8) console.warn('tight curve on', o.route, Math.round(best.mr));
  const { r } = best, { nx, nz } = polyNormals(r.x, r.z), off = new Float64Array(r.n);
  for (let i = 0; i < r.n; i++){
    const s = i * r.ds; let w = CW_O;
    if (pa.gate) w = lerp(CW_GATE_O, w, smooth(30, 420, s));
    if (pb.gate) w = lerp(CW_GATE_O, w, smooth(30, 420, r.len - s));
    off[i] = w;
  }
  const fx = [], fz = [], bx = [], bz = [];
  for (let i = 0; i < r.n; i++){ fx.push(r.x[i] - nx[i] * off[i]); fz.push(r.z[i] - nz[i] * off[i]); }
  for (let i = r.n - 1; i >= 0; i--){ bx.push(r.x[i] + nx[i] * off[i]); bz.push(r.z[i] + nz[i] * off[i]); }
  const base = { route: o.route, name: o.name, lit: !!o.lit };
  const ef = mkEdge(pa.outN, pb.inN, 'cw', fx, fz, Object.assign({}, base, { towards: o.towardsB }));
  const eb = mkEdge(pb.outN, pa.inN, 'cw', bx, bz, Object.assign({}, base, { towards: o.towardsA }));
  ef.pair = eb; eb.pair = ef; ef.paired = eb.paired = true;
  ef.gateA = !!pa.gate; ef.gateB = !!pb.gate; eb.gateA = !!pb.gate; eb.gateB = !!pa.gate;
  const link = { route: o.route, name: o.name, cx: r.x, cz: r.z, len: r.len, edges: [ef, eb] };
  LINKS.push(link); ef.link = eb.link = link;
  return link;
}
const LINKS = [];

// ---------- interchanges: four arms; through carriageways cross on two levels, right turns peel off at grade,
// left turns fly over the middle on two higher levels (a four-level stack)
const ICS = [];
const IC_PORT = 780, IC_DL = 490, IC_DR = 330;
function interchange(name, cx, cz, route1, route2){
  const ic = { name, x: cx, z: cz, arms: {}, edges: [], ramps: [], y: 0 };
  ICS.push(ic);
  ic.flat = addFlat(cx, cz, 1050, 1900);
  const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const Nl = (u) => [u[1], -u[0]];
  for (const k of ['N', 'S', 'E', 'W']){
    const u = DIRS[k], nl = Nl(u), P = (d, side) => [cx + u[0] * d + nl[0] * side, cz + u[1] * d + nl[1] * side];
    const A = { k, u, nl, route: k === 'N' || k === 'S' ? route1 : route2 };
    // incoming carriageway (travels -u, sits at +nl*o); outgoing (travels +u, sits at -nl*o)
    A.inPort = addNode(...P(IC_PORT, CW_O), 'y', { ic }); A.inDL = addNode(...P(IC_DL, CW_O), 'y', { ic }); A.inDR = addNode(...P(IC_DR, CW_O), 'y', { ic });
    A.outDR = addNode(...P(IC_DR, -CW_O), 'y', { ic }); A.outDL = addNode(...P(IC_DL, -CW_O), 'y', { ic }); A.outPort = addNode(...P(IC_PORT, -CW_O), 'y', { ic });
    ic.arms[k] = A;
  }
  const opp = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const straight = (n1, n2) => [[n1.x, n2.x], [n1.z, n2.z]];
  const dc = (x, z) => Math.hypot(x - cx, z - cz);
  const auxIn = (x, z) => { const d = dc(x, z); return d < IC_DR - 1 ? 0 : smooth(IC_PORT - 50, IC_PORT - 130, d); };
  const auxOut = (x, z) => { const d = dc(x, z); return d < IC_DR - 1 ? 0 : 1 - smooth(IC_PORT - 130, IC_PORT - 50, d); };
  for (const k of ['N', 'S', 'E', 'W']){
    const A = ic.arms[k], nm = A.route.name;
    for (const [n1, n2, f] of [[A.inPort, A.inDL, auxIn], [A.inDL, A.inDR, auxIn], [A.outDR, A.outDL, auxOut], [A.outDL, A.outPort, auxOut]]){
      const [X, Z] = straight(n1, n2); const e = mkEdge(n1, n2, 'cw', X, Z, { route: A.route.id, name: nm, ic, auxF: f, lit: true, paired: true }); ic.edges.push(e);
    }
    const B = ic.arms[opp[k]], [X, Z] = straight(A.inDR, B.outDR);
    const e = mkEdge(A.inDR, B.outDR, 'cw', X, Z, { route: A.route.id, name: nm, ic, lit: true, through: true, paired: true }); ic.edges.push(e);
    if (k === 'E' || k === 'W') e.bump = { kind: 'cross', h: 8.5 };
  }
  // ramps
  for (const k of ['N', 'S', 'E', 'W']){
    const A = ic.arms[k], t = [-A.u[0], -A.u[1]], tn = Nl(t), r = [-tn[0], -tn[1]]; // travel direction toward the middle, and its right
    for (const j of ['N', 'S', 'E', 'W']){
      if (j === k || j === opp[k]) continue;
      const B = ic.arms[j], uj = B.u, left = uj[0] * tn[0] + uj[1] * tn[1] > 0, rj = [-Nl(uj)[0], -Nl(uj)[1]];
      let ctrl, from, to;
      if (!left){
        from = A.inDR; to = B.outDR;
        const P0 = [from.x + r[0] * LANE_SHIFT, from.z + r[1] * LANE_SHIFT], P3 = [to.x + rj[0] * LANE_SHIFT, to.z + rj[1] * LANE_SHIFT];
        // a cubic Bezier that leaves along the carriageway and arrives along the other one
        let bestR = 0, bestPts = null;
        for (const h of [150, 175, 200, 225, 250]){
          const X = [], Z = [];
          for (let q = 0; q <= 120; q++){ const s = q / 120, u1 = 1 - s;
            const p1 = [P0[0] + t[0] * h, P0[1] + t[1] * h], p2 = [P3[0] - uj[0] * h, P3[1] - uj[1] * h];
            X.push(u1 * u1 * u1 * P0[0] + 3 * u1 * u1 * s * p1[0] + 3 * u1 * s * s * p2[0] + s * s * s * P3[0]);
            Z.push(u1 * u1 * u1 * P0[1] + 3 * u1 * u1 * s * p1[1] + 3 * u1 * s * s * p2[1] + s * s * s * P3[1]); }
          const rr = resample(X, Z, 2), mr = minRadius(rr, 10); if (mr > bestR){ bestR = mr; bestPts = { X, Z }; } }
        ctrl = bestPts;
      } else {
        from = A.inDL; to = B.outDL;
        const C = [cx, cz], P0 = [from.x + r[0] * LANE_SHIFT, from.z + r[1] * LANE_SHIFT], P3 = [to.x + rj[0] * LANE_SHIFT, to.z + rj[1] * LANE_SHIFT];
        const V1 = [P0[0] + t[0] * 95 + r[0] * 22, P0[1] + t[1] * 95 + r[1] * 22];
        const V2 = [C[0] - t[0] * 150 + r[0] * 38 + A.u[0] * 0, C[1] - t[1] * 150 + r[1] * 38];
        const V3 = [C[0] + uj[0] * 150 + rj[0] * 38, C[1] + uj[1] * 150 + rj[1] * 38];
        const V4 = [P3[0] - uj[0] * 95 + rj[0] * 22, P3[1] - uj[1] * 95 + rj[1] * 22];
        const d = crDense([P0, V1, V2, V3, V4, P3], 4); ctrl = d;
      }
      const e = mkEdge(from, to, 'rp', ctrl.X, ctrl.Z, { route: 'RAMP', name: A.route.short + ' → ' + B.route.short, ic, lit: true, left, offA: LANE_SHIFT, offB: LANE_SHIFT, fromArm: k, toArm: j });
      ic.edges.push(e); ic.ramps.push(e);
    }
  }
  for (const k of ['N', 'S', 'E', 'W']){ const A = ic.arms[k];
    A.port = { x: cx + A.u[0] * IC_PORT, z: cz + A.u[1] * IC_PORT, dx: A.u[0], dz: A.u[1], outN: A.outPort, inN: A.inPort, gate: false, ic }; }
  return ic;
}

// ---------- cities: each one laid out by hand. Tokai is a dense downtown grid; Hakone climbs a hillside with winding streets
// and alleys; Kawaguchi wraps a lakeside boulevard round a plaza; Nagisa is a tilted port grid by the bay; Hokuto is one main street
const CITY_DEFS = [
  { id: 'hakone', name: 'HAKONE', jp: '箱根', x: 1500, z: 20500, style: 'mountain' },
  { id: 'kawaguchi', name: 'KAWAGUCHI', jp: '河口', x: -9500, z: 6500, style: 'resort' },
  { id: 'tokai', name: 'TOKAI', jp: '東海', x: 1500, z: -1500, style: 'grid' },
  { id: 'nagisa', name: 'NAGISA', jp: '渚', x: 11300, z: 3300, style: 'port', rot: 0.26 },
  { id: 'hokuto', name: 'HOKUTO', jp: '北斗', x: -2500, z: -21500, style: 'farm' },
];
const CITIES = [];
function buildCity(D){
  const c = Object.assign({ nodes: [], edges: [], gate: {}, N: {} }, D); CITIES.push(c);
  const rot = D.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
  const W = (u, v) => [D.x + u * cs - v * sn, D.z + u * sn + v * cs];
  const node = (name, u, v, type = 'x', extra) => { const [x, z] = W(u, v); const n = addNode(x, z, type, Object.assign({ city: c }, extra || {})); c.nodes.push(n); if (name) c.N[name] = n; return n; };
  const street = (A, Bn, cls, name, via) => { const a = typeof A === 'string' ? c.N[A] : A, b = typeof Bn === 'string' ? c.N[Bn] : Bn;
    const pts = [[a.x, a.z], ...(via || []).map(([u, v]) => W(u, v)), [b.x, b.z]];
    const d = pts.length > 2 ? crDense(pts, 3) : { X: [a.x, b.x], Z: [a.z, b.z] };
    const e = mkEdge(a, b, cls || 'st', d.X, d.Z, { city: c, route: 'ST', name: D.name + ' · ' + name, lit: true }); c.edges.push(e); return e; };
  const gate = (key, n, du, dv) => { n = typeof n === 'string' ? c.N[n] : n; const dx = du * cs - dv * sn, dz = du * sn + dv * cs, l = Math.hypot(dx, dz); c.gate[key] = { x: n.x, z: n.z, dx: dx / l, dz: dz / l, outN: n, inN: n, gate: true, city: c, node: n }; };
  CITY_LAYOUTS[D.id](c, node, street, gate);
  c.center = c.N.C;
  let half = 0; for (const n of c.nodes) half = Math.max(half, Math.abs(n.x - D.x), Math.abs(n.z - D.z)); c.half = half + 30;
  c.flat = addFlat(D.x, D.z, c.half + 120, c.half + (D.style === 'mountain' ? 700 : 900), D.style === 'grid'); // every city, Hakone included, sits on level ground
  return c;
}
const CITY_LAYOUTS = {
  tokai(c, node, street, gate){ // a big downtown grid, wider blocks in the middle, a park plaza by the centre
    const P = [-950, -740, -540, -350, -170, 0, 170, 350, 540, 740, 950], N = P.length, g = [], mid = 5;
    for (let i = 0; i < N; i++){ g.push([]); for (let j = 0; j < N; j++) g[i].push(node(i === mid && j === mid ? 'C' : null, P[i], P[j], 'x', { sq: true, gi: i, gj: j })); }
    const AV = ['KANDA', 'MINATO', 'GINZA', 'CHUO', 'SHOWA', 'HIBIYA', 'AOYAMA', 'AKASAKA', 'UENO', 'ASAKUSA', 'SHIBA'];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++){
      if (i < N - 1) street(g[i][j], g[i + 1][j], 'st', (j + 1) + '-CHOME STREET');
      if (j < N - 1) street(g[i][j], g[i][j + 1], 'st', AV[i] + ' AVENUE');
    }
    c.grid = g; c.P = P; c.plazaIdx = [mid, mid];
    gate('N', g[mid][0], 0, -1); gate('S', g[mid][N - 1], 0, 1); gate('W', g[0][mid], -1, 0); gate('E', g[N - 1][mid], 1, 0);
    gate('NE', g[N - 1][0], 0.707, -0.707); gate('NW', g[0][0], -0.707, -0.707); gate('SE', g[N - 1][N - 1], 0.707, 0.707); gate('SW', g[0][N - 1], -0.707, 0.707);
    c.shopEdge = c.edges.find(e => (e.a === g[mid][N - 1] && e.b === g[mid][N - 2]) || (e.a === g[mid][N - 2] && e.b === g[mid][N - 1]));
  },
  hakone(c, node, street, gate){ // a hillside onsen town: winding streets that climb, narrow alleys
    node('GN', 0, -300); node('GS', 40, 330); node('GE', 330, 30); node('GW', -320, -20); node('NE', 330, -290); node('SE', 360, 290);
    node('C', 0, 0); node('JN', -30, -150); node('JE', 150, 40); node('JS', 60, 160); node('JW', -160, -40);
    node('D1', -205, -235, 'e'); node('D2', 235, 205); node('D3', -215, 150, 'e'); node('D4', 160, -185); node('D5', -70, 250, 'e'); node('D6', -300, -150, 'e');
    street('GN', 'JN', 'st', 'HONMACHI-DORI', [[-28, -230]]); street('JN', 'C', 'st', 'HONMACHI-DORI', [[12, -80]]);
    street('C', 'JS', 'st', 'HONMACHI-DORI', [[45, 80]]); street('JS', 'GS', 'st', 'HONMACHI-DORI', [[10, 245]]);
    c.shopEdge = street('C', 'JE', 'st', 'ONSEN-DORI', [[80, 4]]); street('JE', 'GE', 'st', 'ONSEN-DORI', [[250, 52]]);
    street('C', 'JW', 'st', 'SAKA-DORI', [[-80, -32]]); street('JW', 'GW', 'st', 'SAKA-DORI', [[-240, -18]]);
    street('JN', 'D1', 'al', 'KITSUNE ALLEY', [[-110, -205]]); street('JE', 'D2', 'al', 'YU ALLEY', [[205, 120]]);
    street('JW', 'D3', 'al', 'SUGI ALLEY', [[-195, 55]]); street('JN', 'D4', 'al', 'TORII ALLEY', [[70, -195]]);
    street('JS', 'JE', 'al', 'LANTERN ALLEY', [[125, 125]]); street('D4', 'NE', 'al', 'KUMO ALLEY', [[250, -240]]); street('D2', 'SE', 'al', 'TAKI ALLEY', [[300, 250]]);
    street('JS', 'D5', 'al', 'ISHI STEPS', [[0, 215]]); street('JW', 'D6', 'al', 'MOMIJI ALLEY', [[-240, -110]]);
    gate('N', 'GN', 0, -1); gate('S', 'GS', 0.1, 1); gate('E', 'GE', 1, 0.1); gate('W', 'GW', -1, 0); gate('NE', 'NE', 0.6, -0.8); gate('SE', 'SE', 0.7, 0.7);
  },
  kawaguchi(c, node, street, gate){ // a lakeside resort: a curving boulevard along the water, avenues from a plaza, a newer quarter to the south-east
    node('C', 60, 0); node('M', 230, 0); node('GE', 400, 0); node('GN', 40, -340); node('GS', 0, 340); node('GW', -420, 0); node('NE', 310, -285);
    node('N1', 50, -170); node('S1', 30, 170); node('Q1', 230, 160); node('Q3', 200, 300); node('H1', -200, -215, 'e'); node('H2', -200, 215, 'e'); node('Q2', 390, 175, 'e'); node('Q4', 340, 305, 'e');
    street('GW', 'GN', 'st', 'LAKESIDE BOULEVARD', [[-418, -170], [-270, -320]]); street('GW', 'GS', 'st', 'LAKESIDE BOULEVARD', [[-418, 170], [-260, 325]]);
    street('C', 'GW', 'st', 'HOTEL AVENUE', [[-180, 6]]); street('C', 'M', 'st', 'STATION ROAD'); c.shopEdge = street('M', 'GE', 'st', 'STATION ROAD');
    street('C', 'N1', 'st', 'NORTH AVENUE'); street('N1', 'GN', 'st', 'NORTH AVENUE'); street('C', 'S1', 'st', 'SOUTH AVENUE'); street('S1', 'GS', 'st', 'SOUTH AVENUE');
    street('C', 'NE', 'st', 'SAKURA-DORI', [[185, -150]]); street('M', 'Q1', 'st', 'MINAMI STREET'); street('Q1', 'Q3', 'st', 'MINAMI STREET'); street('S1', 'Q3', 'st', 'SHINMACHI', [[110, 260]]);
    street('N1', 'H1', 'al', 'VILLA LANE', [[-80, -205]]); street('S1', 'H2', 'al', 'GARDEN LANE', [[-80, 205]]); street('Q1', 'Q2', 'al', 'PINE LANE'); street('Q3', 'Q4', 'al', 'WILLOW LANE');
    gate('N', 'GN', 0, -1); gate('S', 'GS', 0, 1); gate('E', 'GE', 1, 0); gate('W', 'GW', -1, 0); gate('NE', 'NE', 0.707, -0.707);
  },
  nagisa(c, node, street, gate){ // a port on a grid tilted to the bay
    const P = [-540, -360, -180, 0, 180, 360, 540], N = P.length, g = [];
    for (let i = 0; i < N; i++){ g.push([]); for (let j = 0; j < N; j++) g[i].push(node(i === 3 && j === 3 ? 'C' : null, P[i], P[j])); }
    const AV = ['QUAY', 'WHARF', 'ANCHOR', 'HARBOR', 'TIDE', 'DOCK', 'PIER'], ST = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH'];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++){
      if (i < N - 1) street(g[i][j], g[i + 1][j], 'st', ST[j] + ' STREET');
      if (j < N - 1) street(g[i][j], g[i][j + 1], 'st', AV[i] + ' AVENUE');
    }
    c.grid5 = g;
    gate('N', g[3][0], 0, -1); gate('S', g[3][N - 1], 0, 1); gate('W', g[0][3], -1, 0); gate('E', g[N - 1][3], 1, 0); gate('N2', g[2][0], 0, -1); gate('NE', g[N - 1][0], 0.707, -0.707);
    gate('SW', g[0][N - 1], -0.707, 0.707); gate('SE', g[N - 1][N - 1], 0.707, 0.707);
    c.shopEdge = c.edges.find(e => (e.a === g[0][3] && e.b === g[1][3]));
  },
  hokuto(c, node, street, gate){ // a farm town: a long main street with a back street either side
    node('GW', -470, 0); node('J1', -230, 0); node('C', 0, 0); node('J2', 230, 0); node('GE', 470, 0); node('GN', 0, -300); node('GS', 0, 300);
    node('n1', -230, -150); node('n2', 0, -150); node('n3', 230, -150); node('s1', -230, 150); node('s2', 0, 150); node('s3', 230, 150);
    node('D1', -230, 300, 'e'); node('D2', 230, -310, 'e');
    street('GW', 'J1', 'st', 'EKIMAE-DORI'); street('J1', 'C', 'st', 'EKIMAE-DORI'); street('C', 'J2', 'st', 'EKIMAE-DORI'); street('J2', 'GE', 'st', 'EKIMAE-DORI');
    street('GN', 'n2', 'st', 'KITA-DORI'); street('n2', 'C', 'st', 'KITA-DORI'); street('C', 's2', 'st', 'MINAMI-DORI'); c.shopEdge = street('GS', 's2', 'st', 'MINAMI-DORI');
    street('n1', 'n2', 'al', 'URA-DORI'); street('n2', 'n3', 'al', 'URA-DORI'); street('s1', 's2', 'al', 'OMOTE LANE'); street('s2', 's3', 'al', 'OMOTE LANE');
    street('J1', 'n1', 'al', 'MILL LANE'); street('J1', 's1', 'al', 'MILL LANE'); street('J2', 'n3', 'al', 'GRAIN LANE'); street('J2', 's3', 'al', 'GRAIN LANE');
    street('s1', 'D1', 'al', 'SCHOOL LANE'); street('n3', 'D2', 'al', 'STATION LANE');
    gate('N', 'GN', 0, -1); gate('S', 'GS', 0, 1); gate('W', 'GW', -1, 0); gate('E', 'GE', 1, 0); gate('SE', 's3', 0.707, 0.707);
  },
};
// ---------- two-lane roads, one lane each way: wind through the hills
function rdLink(pa, pb, o){
  const H = o.handle ?? 200, Rmin = o.Rmin ?? 110;
  const A = [pa.x + pa.dx * H, pa.z + pa.dz * H], B = [pb.x + pb.dx * H, pb.z + pb.dz * H], anchors = [A, ...(o.via || []), B];
  let wig = o.wig ?? 260, best = null;
  for (let tries = 0; tries < 10; tries++){
    const R = mulberry(o.seed || 3), ctrl = [[pa.x, pa.z]];
    for (let k = 0; k < anchors.length - 1; k++){
      const P = anchors[k], Q = anchors[k + 1], L = Math.hypot(Q[0] - P[0], Q[1] - P[1]), m = Math.max(1, Math.round(L / (o.wl || 900)));
      const px = -(Q[1] - P[1]) / L, pz = (Q[0] - P[0]) / L;
      ctrl.push(P);
      for (let j = 1; j < m; j++){ const t = j / m, w = wig * (R() * 2 - 1); ctrl.push([P[0] + (Q[0] - P[0]) * t + px * w, P[1] + (Q[1] - P[1]) * t + pz * w]); }
    }
    ctrl.push(B, [pb.x, pb.z]);
    const d = crDense(ctrl, 6), r = resample(d.X, d.Z, 2), mr = minRadius(r, 25);
    best = d;
    if (mr >= Rmin || wig < 15) break;
    wig *= 0.66;
  }
  return mkEdge(pa.outN, pb.inN, 'rd', best.X, best.Z, { route: o.route, name: o.name, towards: o.towardsB, towardsA: o.towardsA, lit: !!o.lit });
}
const jport = (n, dx, dz) => { const l = Math.hypot(dx, dz); return { x: n.x, z: n.z, dx: dx / l, dz: dz / l, outN: n, inN: n, gate: true, node: n }; };

// ---------- the map
const ROUTES = {
  E1: { id: 'E1', short: 'E1', name: 'E1 CENTRAL EXPRESSWAY', jp: '中央道', color: '#ff9a3c' },
  E2: { id: 'E2', short: 'E2', name: 'E2 EAST COAST EXPRESSWAY', jp: '東海岸道', color: '#ff9a3c' },
  E3: { id: 'E3', short: 'E3', name: 'E3 LAKES EXPRESSWAY', jp: '湖畔道', color: '#ff9a3c' },
  E4: { id: 'E4', short: 'E4', name: 'E4 NORTHERN EXPRESSWAY', jp: '北部道', color: '#ff9a3c' },
  E5: { id: 'E5', short: 'E5', name: 'E5 EXPRESSWAY', jp: '支線', color: '#ff9a3c' }, E6: { id: 'E6', short: 'E6', name: 'E6 EXPRESSWAY', jp: '支線', color: '#ff9a3c' }, E7: { id: 'E7', short: 'E7', name: 'E7 EXPRESSWAY', jp: '支線', color: '#ff9a3c' },
};
const CITY = {}; for (const D of CITY_DEFS) CITY[D.id] = buildCity(D);
const IC_S = interchange('MINAMI JCT', 1200, 9500, ROUTES.E1, ROUTES.E3);
const IC_N = interchange('KITA JCT', 1000, -11500, ROUTES.E1, ROUTES.E4);
const IC_NE = interchange('HIGASHI JCT', 10500, -11500, ROUTES.E2, ROUTES.E4);
const J1 = addNode(-3000, 15100, 'x', { label: 'TOGE JCT' });
const J2 = addNode(-9500, 9300, 'x', { label: 'KOHAN JCT' });
const J3 = addNode(-7000, -12200, 'x', { label: 'SHIRAKABA JCT' });
const CAPE = addNode(14700, 11600, 'e', { label: 'CAPE NAGISA' });
const E4END = addNode(15200, -11500, 'x', { label: 'E4 END' });
const cH = CITY.hakone, cK = CITY.kawaguchi, cT = CITY.tokai, cNG = CITY.nagisa, cHK = CITY.hokuto;
// E1 south to north, through the start in the forest
const E1a = hwLink(cH.gate.N, IC_S.arms.S.port, { route: 'E1', name: ROUTES.E1.name, seed: 11, via: [[1350, 15600]], towardsB: 'TOKAI', towardsA: 'HAKONE' });
const E1b = hwLink(IC_S.arms.N.port, cT.gate.S, { route: 'E1', name: ROUTES.E1.name, seed: 12, via: [[1900, 4200]], towardsB: 'TOKAI', towardsA: 'HAKONE', lit: false });
const E1c = hwLink(cT.gate.N, IC_N.arms.S.port, { route: 'E1', name: ROUTES.E1.name, seed: 13, via: [[700, -6500]], towardsB: 'HOKUTO', towardsA: 'TOKAI' });
const E1d = hwLink(IC_N.arms.N.port, cHK.gate.S, { route: 'E1', name: ROUTES.E1.name, seed: 14, via: [[-600, -16800]], towardsB: 'HOKUTO', towardsA: 'TOKAI' });
// E2 down the east side
const E2a = hwLink(cNG.gate.S, cH.gate.E, { route: 'E2', name: ROUTES.E2.name, seed: 21, via: [[10450, 7400], [5600, 16200]], towardsB: 'HAKONE', towardsA: 'NAGISA' });
const E2b = hwLink(cNG.gate.N, IC_NE.arms.S.port, { route: 'E2', name: ROUTES.E2.name, seed: 22, via: [[11300, -2600], [10900, -7300]], wig: 250, towardsB: 'HOKUTO', towardsA: 'NAGISA' });
const E2c = hwLink(IC_NE.arms.N.port, cHK.gate.E, { route: 'E2', name: ROUTES.E2.name, seed: 23, via: [[9600, -18500], [3000, -21500]], towardsB: 'HOKUTO', towardsA: 'NAGISA' });
// E3 across the lakes
const E3a = hwLink(IC_S.arms.W.port, cK.gate.E, { route: 'E3', name: ROUTES.E3.name, seed: 31, via: [[-4300, 8450]], wig: 180, towardsB: 'KAWAGUCHI', towardsA: 'TOKAI' });
const E3b = hwLink(IC_S.arms.E.port, cNG.gate.W, { route: 'E3', name: ROUTES.E3.name, seed: 32, via: [[6000, 6300]], towardsB: 'NAGISA', towardsA: 'TOKAI' });
// E4 across the north and down the west side
const E4a = hwLink(IC_N.arms.W.port, cK.gate.N, { route: 'E4', name: ROUTES.E4.name, seed: 41, via: [[-6200, -8300], [-9700, -1200]], towardsB: 'KAWAGUCHI', towardsA: 'HOKUTO' });
const E4b = hwLink(IC_N.arms.E.port, IC_NE.arms.W.port, { route: 'E4', name: ROUTES.E4.name, seed: 42, wig: 300, towardsB: 'NAGISA', towardsA: 'HOKUTO' });
const E4c = hwLink(IC_NE.arms.E.port, jport(E4END, -1, 0), { route: 'E4', name: ROUTES.E4.name, seed: 43, wig: 200, towardsB: 'NAGISA', towardsA: 'HOKUTO' });
// country roads
const RD = [];
RD.push(rdLink(cH.gate.W, jport(J1, 0.6, 0.8), { route: 'R1', name: 'ROUTE 1 HAKONE PASS', seed: 51, Rmin: 60, wig: 300, wl: 700, towardsB: 'KAWAGUCHI', towardsA: 'HAKONE' }));
RD.push(rdLink(jport(J1, -0.75, -0.66), jport(J2, 0.4, 0.92), { route: 'R1', name: 'ROUTE 1 HAKONE PASS', seed: 52, Rmin: 70, wig: 320, via: [[-6200, 12600]], towardsB: 'KAWAGUCHI', towardsA: 'HAKONE' }));
RD.push(rdLink(jport(J2, 0, -1), cK.gate.S, { route: 'R1', name: 'ROUTE 1 HAKONE PASS', seed: 53, wig: 60, towardsB: 'KAWAGUCHI', towardsA: 'HAKONE' }));
RD.push(rdLink(cH.gate.S, jport(J1, -0.5, 0.86), { route: 'R2', name: 'ROUTE 2 SUMMIT LOOP', seed: 54, Rmin: 55, wig: 330, wl: 650, via: [[3600, 23900], [-1400, 25200], [-5300, 21300]], towardsB: 'TOGE JCT', towardsA: 'HAKONE' }));
RD.push(rdLink(cK.gate.W, jport(J2, -1, 0), { route: 'R3', name: 'ROUTE 3 LAKESHORE', seed: 55, wig: 160, via: [[-10500, 3900], [-13000, 3500], [-15300, 6900], [-14500, 10900], [-11700, 10700]], towardsB: 'KOHAN JCT', towardsA: 'KAWAGUCHI' }));
RD.push(rdLink(cT.gate.W, cK.gate.NE, { route: 'R4', name: 'ROUTE 4 WESTWOOD ROAD', seed: 56, wig: 300, via: [[-4300, 2300]], towardsB: 'KAWAGUCHI', towardsA: 'TOKAI' }));
RD.push(rdLink(cT.gate.E, cNG.gate.N2, { route: 'R5', name: 'ROUTE 5 BAYSIDE ROAD', seed: 57, wig: 280, via: [[6000, -300], [9900, 1900]], towardsB: 'NAGISA', towardsA: 'TOKAI' }));
RD.push(rdLink(cNG.gate.E, jport(CAPE, -0.3, -0.95), { route: 'R6', name: 'ROUTE 6 CAPE ROAD', seed: 58, wig: 200, via: [[12500, 6400], [13300, 9400]], towardsB: 'CAPE NAGISA', towardsA: 'NAGISA' }));
RD.push(rdLink(cHK.gate.W, jport(J3, 0.3, -0.95), { route: 'R7', name: 'ROUTE 7 SHIRAKABA ROAD', seed: 59, wig: 260, via: [[-6200, -17900]], towardsB: 'SHIRAKABA JCT', towardsA: 'HOKUTO' }));
RD.push(rdLink(jport(J3, -1, 0.1), cHK.gate.N, { route: 'R8', name: 'ROUTE 8 FARM LOOP', seed: 60, wig: 300, via: [[-12400, -11300], [-14300, -18600], [-9500, -24900]], towardsB: 'HOKUTO', towardsA: 'SHIRAKABA JCT' }));
RD.push(rdLink(jport(E4END, 0, 1), cNG.gate.NE, { route: 'R9', name: 'ROUTE 9 BAY ROAD', seed: 61, wig: 150, via: [[11950, -6500], [11850, 600]], towardsB: 'NAGISA', towardsA: 'E4' }));
RD.push(rdLink(jport(J3, 0.2, 1), jport(addNode(-9400, -7400, 'e', { label: 'SHIRAKABA LAKE' }), 0.6, -0.8), { route: 'R10', name: 'ROUTE 10 LAKE SPUR', seed: 62, wig: 120, towardsB: 'SHIRAKABA LAKE', towardsA: 'SHIRAKABA JCT' }));

