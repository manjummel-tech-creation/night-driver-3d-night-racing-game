// =====================================================================================================
const WORLD_WARN = []; const wwarn = (...a) => { WORLD_WARN.push(a.join(" ")); console.warn(...a); };
// THE LOCAL NETWORK. Old roads between the cities so you never need an expressway unless you want one; lanes between
// hamlets; switchbacks up to the high villages; towns with side streets; housing districts; roads out to the landmarks;
// and dead ends everywhere. New roads meet old ones at real junctions (the old road is split there). A local road may
// cross an expressway only on a bridge (added with the heights).
// =====================================================================================================
const GEN = mulberry(20251004);
// a coarse index of every road sample, rebuilt whenever roads change
const GIDX = new Map(), GC = 60;
function gidxRebuild(){ GIDX.clear(); for (const e of EDGES){ if (!e.x) continue; for (let k = 0; k < e.n; k += 4){ const key = Math.floor(e.x[k] / GC) * 100000 + Math.floor(e.z[k] / GC); let a = GIDX.get(key); if (!a){ a = []; GIDX.set(key, a); } a.push(e, k); } } }
gidxRebuild();
const ATTACHABLE = e => !e.city && !e.ic && (e.cls === 'rd' || e.cls === 'ln' || e.cls === 'mt');
function nearestOn(x, z, R, filter){
  let best = null, bd = R * R; const c0 = Math.floor(x / GC), r0 = Math.floor(z / GC), n = Math.ceil(R / GC);
  for (let ox = -n; ox <= n; ox++) for (let oz = -n; oz <= n; oz++){ const a = GIDX.get((c0 + ox) * 100000 + r0 + oz); if (!a) continue;
    for (let q = 0; q < a.length; q += 2){ const e = a[q], k = a[q + 1]; if (filter && !filter(e)) continue; const d = (e.x[k] - x) ** 2 + (e.z[k] - z) ** 2; if (d < bd){ bd = d; best = [e, k]; } } }
  return best ? { e: best[0], k: best[1], x: best[0].x[best[1]], z: best[0].z[best[1]], dist: Math.sqrt(bd) } : null;
}
// split an edge at sample k: it ends at a new junction there and a second edge carries on
function splitAt(e, k){
  k = clamp(k, 2, e.n - 3);
  const n = addNode(e.x[k], e.z[k], 'x', { gen: true });
  const oldB = e.b, X2 = Array.from(e.x.subarray(k)), Z2 = Array.from(e.z.subarray(k));
  e.x = e.x.slice(0, k + 1); e.z = e.z.slice(0, k + 1); e.n = k + 1; e.len = k * e.ds;
  oldB.links.splice(oldB.links.indexOf(e), 1); e.b = n; n.links.push(e);
  mkEdge(n, oldB, e.cls, X2, Z2, { route: e.route, name: e.name, lit: e.lit, towards: e.towards, towardsA: e.towardsA, gen: e.gen });
  gidxRebuild(); return n;
}
// where a new road can join: the nearest point of a joinable road (an end node if that's within 70 m)
function attachSpec(x, z, R, filter = ATTACHABLE){
  const q = nearestOn(x, z, R, filter); if (!q) return null;
  const s = q.k * q.e.ds, e = q.e, k = q.k;
  const tx = e.x[Math.min(e.n - 1, k + 2)] - e.x[Math.max(0, k - 2)], tz = e.z[Math.min(e.n - 1, k + 2)] - e.z[Math.max(0, k - 2)], tl = Math.hypot(tx, tz) || 1;
  const spec = { x: q.x, z: q.z, tx: tx / tl, tz: tz / tl, dist: q.dist, e };
  if (s < 70 && e.a.type !== 'y'){ spec.node = e.a; spec.x = e.a.x; spec.z = e.a.z; }
  else if (e.len - s < 70 && e.b.type !== 'y'){ spec.node = e.b; spec.x = e.b.x; spec.z = e.b.z; }
  else spec.make = () => { // the sample may have moved if this edge was split meanwhile: find it again
    const q2 = nearestOn(spec.x, spec.z, 10, ATTACHABLE); return q2 ? splitAt(q2.e, q2.k) : null; };
  return spec;
}
// is a planned road clear of every other road? Crossing an expressway is fine (it gets a bridge); nothing else may be touched
let WHY = '';
const KEEPOUT = []; // the grounds of each landmark: roads made after it go round them
function roadClear(X, Z, hw, ends, ign){
  let cwRun = 0; const no = (w, x, z) => { WHY = w + ' @' + Math.round(x) + ',' + Math.round(z); return false; };
  for (let i = 0; i < X.length; i += 2){
    const x = X[i], z = Z[i], dEnd = Math.min(...ends.map(([ax, az]) => Math.hypot(x - ax, z - az)));
    if (dEnd < 12) continue;
    if (x < WB.x0 + 300 || x > WB.x1 - 300 || z < WB.z0 + 300 || z > WB.z1 - 300) return no('edge', x, z);
    for (const L of LAKES) if (lakeQ(L, x, z) < 1.12) return no('lake ' + L.name, x, z);
    for (const K of KEEPOUT) if ((x - K.x) ** 2 + (z - K.z) ** 2 < K.r * K.r) return no('landmark', x, z);
    for (const ic of ICS) if (Math.hypot(x - ic.x, z - ic.z) < 1400) return no('ic', x, z);
    const c0 = Math.floor(x / GC), r0 = Math.floor(z / GC); let nearCw = false;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++){ const a = GIDX.get((c0 + ox) * 100000 + r0 + oz); if (!a) continue;
      for (let q = 0; q < a.length; q += 2){ const e = a[q], k = a[q + 1];
        if (dEnd < 60 && ign.has(e)) continue; // the road we're leaving from
        const d = Math.hypot(e.x[k] - x, e.z[k] - z), need = e.C.hw + hw + (e.city && dEnd > 120 ? 45 : 12);
        if (d >= need) continue;
        if (e.cls === 'cw' || e.cls === 'rp'){ nearCw = true; continue; }
        return no('road ' + e.name, x, z); } }
    cwRun = nearCw ? cwRun + 1 : 0; if (cwRun > 26) return no('alongside cw', x, z);
  }
  return true;
}
// a winding road between two ends, or null if there's no clean way
function planRoad(A, B, o){
  const L = Math.hypot(B.x - A.x, B.z - A.z); if (L < 40) return null;
  const H = Math.min(o.handle ?? 160, L * 0.25);
  for (let tries = 0; tries < (o.tries || 4); tries++){
    const R = mulberry((o.seed || 1) * 31 + tries * 7), wig = (o.wig ?? 220) * (1 - tries * 0.22);
    const Ap = [A.x + A.dx * H, A.z + A.dz * H], Bp = [B.x + B.dx * H, B.z + B.dz * H], anchors = [Ap, ...(o.via || []), Bp], ctrl = [[A.x, A.z]];
    for (let k = 0; k < anchors.length - 1; k++){
      const P = anchors[k], Q = anchors[k + 1], l = Math.hypot(Q[0] - P[0], Q[1] - P[1]) || 1, m = Math.max(1, Math.round(l / (o.wl || 600))), px = -(Q[1] - P[1]) / l, pz = (Q[0] - P[0]) / l;
      ctrl.push(P); for (let j = 1; j < m; j++){ const t = j / m, w = wig * (R() * 2 - 1); ctrl.push([P[0] + (Q[0] - P[0]) * t + px * w, P[1] + (Q[1] - P[1]) * t + pz * w]); }
    }
    ctrl.push(Bp, [B.x, B.z]);
    const d = o.points ? crDense([[A.x, A.z], ...o.points, [B.x, B.z]], 4) : crDense(ctrl, 5), r = resample(d.X, d.Z, 6);
    if (!o.points && minRadius(r, 20) < (o.Rmin ?? 45)){ WHY = "radius"; continue; }
    const ign = new Set(); for (const P of [A, B]){ if (P.node) P.node.links.forEach(e => ign.add(e)); if (P.spec){ ign.add(P.spec.e); if (P.spec.node) P.spec.node.links.forEach(e => ign.add(e)); } }
    if (roadClear(r.x, r.z, CLS[o.cls].hw, [[A.x, A.z], [B.x, B.z]], ign)) return d;
    if (o.points) return null;
  }
  return null;
}
// a road end: an existing node with an outward direction, a place on an existing road, or a brand new node
const atNode = (n, dx, dz) => { const l = Math.hypot(dx, dz) || 1; return { x: n.x, z: n.z, dx: dx / l, dz: dz / l, node: n }; };
function endAttach(spec, tx, tz){ // leave an existing road roughly square to it, toward (tx, tz)
  let px = -spec.tz, pz = spec.tx; if (px * (tx - spec.x) + pz * (tz - spec.z) < 0){ px = -px; pz = -pz; }
  const l = Math.hypot(tx - spec.x, tz - spec.z) || 1, dx = px * 0.75 + (tx - spec.x) / l * 0.45, dz = pz * 0.75 + (tz - spec.z) / l * 0.45, ll = Math.hypot(dx, dz);
  return { x: spec.x, z: spec.z, dx: dx / ll, dz: dz / ll, spec };
}
const endNew = (x, z, dx, dz, type = 'x', extra) => { const l = Math.hypot(dx, dz) || 1; return { x, z, dx: dx / l, dz: dz / l, fresh: [type, extra] }; };
function realize(end){ if (end.node) return end.node; if (end.spec) return end.spec.node || end.spec.make(); return (end.node = addNode(end.x, end.z, end.fresh[0], end.fresh[1] || {})); }
function addRoad(A, B, cls, o){
  const d = planRoad(A, B, Object.assign({ cls }, o)); if (!d) return null;
  const na = realize(A), nb = realize(B); if (!na || !nb) return null;
  d.X[0] = na.x; d.Z[0] = na.z; d.X[d.X.length - 1] = nb.x; d.Z[d.Z.length - 1] = nb.z;
  const e = mkEdge(na, nb, cls, d.X, d.Z, { route: o.route || 'LN', name: o.name || 'FARM LANE', lit: !!o.lit, towards: o.towardsB, towardsA: o.towardsA, gen: o.gen || 'road' });
  gidxRebuild(); return e;
}
const gp = p => atNode(p.node || p.outN, p.dx, p.dz); // a city gate as a road end

// ---------- the old roads: every city reachable without an expressway
const LOCAL = [];
const cityG = (id, k) => gp(CITY[id].gate[k]);
function local(A, B, o){ const e = addRoad(A, B, 'rd', Object.assign({ wig: 240, wl: 800, Rmin: 60, tries: 6 }, o)); if (!e) wwarn('local road failed', o.name, WHY); else LOCAL.push(e); return e; }
const atRoad = (x, z, tx, tz, R = 900, f) => { const s = attachSpec(x, z, R, f); return s ? endAttach(s, tx, tz) : null; };
local(cityG('hakone', 'NE'), cityG('tokai', 'SE'), { name: 'ROUTE 11 OLD TOKAIDO', seed: 111, via: [[3000, 15200], [3500, 10600], [3100, 6200], [2900, 2200]], towardsB: 'TOKAI', towardsA: 'HAKONE' });
local(cityG('tokai', 'NE'), cityG('hokuto', 'SE'), { name: 'ROUTE 12 OLD NIKKO ROAD', seed: 112, via: [[3700, -6000], [3800, -10200], [3300, -14600], [1500, -19100]], towardsB: 'HOKUTO', towardsA: 'TOKAI' });
{ const a = atRoad(12900, 8000, 11500, 13000, 1200); if (a) local(a, cityG('hakone', 'SE'), { name: 'ROUTE 14 COAST ROAD', seed: 114, via: [[11600, 12800], [7300, 18200]], towardsB: 'HAKONE', towardsA: 'NAGISA' }); }
{ const a = atRoad(-10600, 3700, -10900, 2200, 900), b = atRoad(-12300, -11300, -10600, -9000, 1500); if (a && b) local(a, b, { name: 'ROUTE 15 WEST FOREST ROAD', seed: 115, via: [[-10900, 2200], [-11000, -1500], [-10000, -5000], [-10600, -9000]], towardsB: 'NOHARA', towardsA: 'KAWAGUCHI' }); }
{ const a = atRoad(6000, -300, 6800, -6000, 900), b = atRoad(11950, -6500, 8000, -6000, 1200); if (a && b) local(a, b, { name: 'ROUTE 16 MORI ROAD', seed: 116, via: [[6900, -4600], [8600, -6300]], towardsB: 'KITAHAMA', towardsA: 'TOKAI' }); }
{ const a = atRoad(3100, 6200, -1500, 5000, 900), b = atRoad(-4300, 2300, -1500, 5000, 1200); if (a && b) local(a, b, { name: 'ROUTE 17 SAWA ROAD', seed: 117, via: [[-1500, 5100]], towardsB: 'KAWAGUCHI', towardsA: 'TOKAI' }); }
{ const a = atRoad(-3000, 15100, -2900, 11300, 400), b = atRoad(-1500, 5100, -2900, 11300, 1500); if (a && b) local(a, b, { name: 'ROUTE 21 SAWA PASS', seed: 121, via: [[-2900, 11300]], towardsB: 'SAWA', towardsA: 'TOGE JCT' }); }
{ const a = atRoad(3500, 10600, 8000, 9500, 900), b = atRoad(12500, 9800, 8000, 9500, 1500); if (a && b) local(a, b, { name: 'ROUTE 18 VALLEY ROAD', seed: 118, via: [[8000, 9800]], towardsB: 'COAST ROAD', towardsA: 'OLD TOKAIDO' }); }
{ const d2 = CITY.hokuto.N.D2; d2.type = 'x'; local(atNode(d2, 0.6, -0.8), endNew(8100, -22400, -1, 0, 'e', { label: 'WIND FARM' }), { name: 'ROUTE 19 NORTH FARMS', seed: 119, Rmin: 40, via: [[2500, -24000], [4000, -24100]] }); }

// ---------- towns: on the old roads, each with side streets; the parts garage is at the end of one of them
const TOWN_SITES = [
  { id: 'toge', at: [-5600, 13200] }, { id: 'kitahama', at: [11900, -3600] }, { id: 'kohan', at: [-15000, 8800] }, { id: 'nohara', at: [-14000, -16000] },
  { id: 'shirakaba', at: [-9200, -7600] }, { id: 'misaki', at: [14450, 11000] }, { id: 'sawa', at: [-2900, 11300] }, { id: 'mori', at: [6900, -4800] },
  { id: 'kawakita', at: [4000, -24050] }, { id: 'nishikubo', at: [-11000, -1500] },
];
for (const T of TOWN_SITES){
  const s0 = attachSpec(T.at[0], T.at[1], 1500, e => !e.city && !e.ic && e.cls === 'rd'); if (!s0){ wwarn('no road for town', T.id); continue; }
  const mid = s0.make ? s0.make() : s0.node; if (!mid) continue;
  mid.town = true; T.node = mid; T.x = mid.x; T.z = mid.z; T.sides = [];
  if (!nearestOn(mid.x, mid.z, 650, e => e.cls === 'cw' || e.cls === 'rp')) T.flat = addFlat(mid.x, mid.z, 120, 420); // the village sits on level ground
  // side streets: off the junction, and off two more junctions either side along the road
  const R = mulberry(T.id.length * 977 + Math.round(T.x));
  const tries = [[mid.x, mid.z]];
  for (const off of [-140, 140]) tries.push([mid.x + s0.tx * off, mid.z + s0.tz * off]);
  let made = 0;
  for (const [px, pz] of tries){
    for (const sd of [1, -1]){
      if (made >= 5) break;
      const spec = attachSpec(px, pz, 40, e => !e.city && !e.ic && (e.cls === 'rd')); if (!spec) continue;
      const ang = Math.atan2(-spec.tz * sd, spec.tx * sd) + (R() - 0.5) * 0.6, L = 150 + R() * 170;
      const ex = spec.x + Math.cos(ang) * L * 0 + -spec.tz * sd * L, ez = spec.z + spec.tx * sd * L;
      const e = addRoad(endAttach(spec, ex, ez), endNew(ex, ez, spec.tz * sd, -spec.tx * sd, 'e'), 'al', { name: T.id.toUpperCase() + ' SIDE STREET', wig: 40, wl: 120, Rmin: 20, handle: 30, seed: made * 13 + 5, tries: 3, gen: 'town' });
      if (e){ T.sides.push(e); made++; }
    }
  }
}
const VILLAGES = []; // built further down, once the lanes around the mountains exist
// ---------- landmarks, each at the end of its own road
const LANDMARKS = [];
function landmark(kind, name, x, z, o = {}){
  const L = { kind, name, x, z, o }; LANDMARKS.push(L);
  if (o.existing){ const n = NODES.find(q => q.label === name); if (n){ L.node = n; L.x = n.x; L.z = n.z; } else wwarn('landmark node missing', name); return L; }
  const s = o.from ? null : attachSpec(o.hint ? o.hint[0] : x, o.hint ? o.hint[1] : z, o.R || 6000, e => !e.city && !e.ic && (e.cls === 'rd' || e.cls === 'ln'));
  const A = o.from ? atNode(o.from, x - o.from.x, z - o.from.z) : s ? endAttach(s, x, z) : null; if (!A){ wwarn('landmark unreachable', name); return L; }
  const B = endNew(x, z, -(x - A.x), -(z - A.z), o.endType || 'e', { label: name });
  L.road = addRoad(A, B, 'rd', { name: 'TO ' + name, wig: 140, wl: 500, Rmin: 40, tries: 6, seed: name.length * 17, gen: 'landmark' });
  if (!L.road) wwarn('landmark road failed', name, WHY); else { L.node = L.road.b; KEEPOUT.push({ x: L.node.x, z: L.node.z, r: 240 }); }
  return L;
}
LAKES.push({ name: 'KUROBE LAKE', x: 6300, z: 20700, rx: 700, rz: 420, depth: 20 }, { name: 'SHIRAKAWA LAKE', x: -9100, z: 18600, rx: 560, rz: 380, depth: 14 });
landmark('nuke', 'NUCLEAR POWER PLANT', 14600, -6900);
landmark('dam', 'KUROBE DAM', 6300, 21420, { hint: [4200, 23400], lake: 'KUROBE LAKE' });
landmark('dam', 'SHIRAKAWA DAM', -9100, 19200, { lake: 'SHIRAKAWA LAKE' });
landmark('wind', 'WIND FARM', 8100, -22400, { existing: true });
landmark('obs', 'MOUNTAIN OBSERVATORY', -8200, 24600);
landmark('quarry', 'WEST RIDGE QUARRY', -14000, 1200);
landmark('rail', 'RAIL FREIGHT YARD', -400, -24100);
landmark('radio', 'RADIO MAST', 12300, 16700);
landmark('ski', 'SKI RESORT', -4700, 24100);
landmark('torii', 'GREAT SHRINE', -5200, 1000);
landmark('light', 'LIGHTHOUSE', 15100, 13500, { from: CAPE });
landmark('fort', 'OLD COASTAL FORT', 13600, -16500, { from: E4END });
// the airstrip: a long straight runway you can drive (or fly) down
{ const s = attachSpec(-7600, -24250, 4000, e => !e.city && !e.ic && (e.cls === 'rd' || e.cls === 'ln'));
  if (s){ const L = landmark('air', 'ABANDONED AIRSTRIP', -7500, -24200);
    if (L.node){ const r0 = L.node; r0.type = 'x'; const end = addNode(r0.x + 1150, r0.z, 'e', { label: 'RUNWAY END' }); L.runway = mkEdge(r0, end, 'rw', [r0.x, end.x], [r0.z, end.z], { route: 'LN', name: 'ABANDONED AIRSTRIP · RUNWAY', gen: 'landmark' }); gidxRebuild(); } } }
// the race circuit: an oval you can lap, off the Mori road
{ const L = landmark('track', 'MORI RACE CIRCUIT', 7600, -3550, { endType: 'x' });
  if (L.node){ const n0 = L.node, n1 = addNode(n0.x + 620, n0.z, 'x', { label: 'CIRCUIT' });
    const arc = sgn => { const X = [], Z = []; for (let k = 0; k <= 40; k++){ const t = Math.PI * k / 40; X.push(n0.x + 310 - Math.cos(t) * 310); Z.push(n0.z + sgn * Math.sin(t) * 190); } return [X, Z]; };
    for (const sg of [-1, 1]){ const [X, Z] = arc(sg); mkEdge(n0, n1, 'st', X, Z, { route: 'LN', name: 'MORI RACE CIRCUIT', gen: 'landmark', lit: true }); } gidxRebuild(); } }

// ---------- housing districts: a spine road with cul-de-sacs either side
const SUBURBS = [];
for (const [name, x, z] of [['SAKURAGAOKA', 4300, -4700], ['MIDORI-CHO', -1900, 2400], ['KOHAN HEIGHTS', -7600, 3500], ['MINATO NEW TOWN', 8600, 600], ['HOKUTO HILLS', 600, -19900], ['YUMOTO', 8200, 17300]]){
  const s = attachSpec(x, z, 2600, e => !e.city && !e.ic && (e.cls === 'rd' || e.cls === 'ln')); if (!s){ wwarn('no road for suburb', name); continue; }
  const dx = x - s.x, dz = z - s.z, D = Math.hypot(dx, dz) || 1, ux = dx / D, uz = dz / D;
  const entry = addRoad(endAttach(s, x, z), endNew(x, z, -ux, -uz, 'x'), 'st', { name: name + ' AVENUE', wig: 80, wl: 300, Rmin: 40, tries: 4, seed: name.length * 3, gen: 'suburb' });
  if (!entry){ wwarn('suburb road failed', name); continue; }
  const S = { name, x, z, edges: [entry], ux, uz }; SUBURBS.push(S);
  let prev = entry.b; const px = -uz, pz = ux;
  for (let k = 1; k <= 3; k++){
    const jx = x + ux * 160 * k, jz = z + uz * 160 * k, last = k === 3;
    const sp = addRoad(atNode(prev, ux, uz), endNew(jx, jz, -ux, -uz, last ? 'e' : 'x'), 'al', { name: name + ' MAIN STREET', wig: 15, handle: 30, Rmin: 20, tries: 2, gen: 'suburb' });
    if (!sp) break; S.edges.push(sp); prev = sp.b;
    for (const sd of [1, -1]){ const cx = jx + px * sd * 140, cz = jz + pz * sd * 140;
      const cul = addRoad(atNode(sp.b, px * sd, pz * sd), endNew(cx, cz, -px * sd, -pz * sd, 'e'), 'al', { name: name + ' CLOSE', wig: 15, handle: 25, Rmin: 18, tries: 2, gen: 'suburb' }); if (cul) S.edges.push(cul); }
  }
}

// ---------- hamlets and the lanes between them
const HAMLETS = [];
{ const R = GEN, names = ['KOYA', 'HATA', 'SUGI', 'ISHI', 'OKA', 'NOGI', 'KAMI', 'SHIMO', 'TANI', 'HARA', 'MIZU', 'KUBO', 'YAMA', 'SAKA', 'ICHI', 'FUJI', 'MATSU', 'UME', 'KIRI', 'SENA', 'AOI', 'KUMA', 'TAKA', 'HOSO', 'NAKA', 'MINE', 'URA', 'KITA', 'NISHI', 'HIGA', 'MINA', 'TOMI', 'YANA', 'KOMA', 'HIRA', 'IWA', 'TSUJI', 'NIKA', 'OGI', 'SHIBA', 'KASA', 'HAYA', 'TOGO', 'ASA'];
  const busy = (x, z, r) => CITIES.some(c => Math.abs(x - c.x) < c.half + r && Math.abs(z - c.z) < c.half + r) || ICS.some(ic => Math.hypot(x - ic.x, z - ic.z) < 1500 + r) || TOWN_SITES.some(t => t.x !== undefined && Math.hypot(x - t.x, z - t.z) < r + 600) || VILLAGES.some(v => Math.hypot(x - v.x, z - v.z) < r + 600) || LANDMARKS.some(l => Math.hypot(x - l.x, z - l.z) < r + 400) || SUBURBS.some(s => Math.hypot(x - s.x, z - s.z) < r + 700) || HILLS.some(h => h.name && Math.hypot(x - h.x, z - h.z) < h.r * 1.1);
  for (let tries = 0; tries < 3000 && HAMLETS.length < 44; tries++){
    const x = WB.x0 + 900 + R() * (WB.x1 - WB.x0 - 1800), z = WB.z0 + 900 + R() * (WB.z1 - WB.z0 - 1800);
    if (busy(x, z, 600) || LAKES.some(L => lakeQ(L, x, z) < 1.3) || HAMLETS.some(h => Math.hypot(h.x - x, h.z - z) < 2300)) continue;
    const near = nearestOn(x, z, 60, null); if (near) continue;
    const s = attachSpec(x, z, 4500); if (!s || s.dist < 500) continue;
    const name = names[HAMLETS.length % names.length];
    const e = addRoad(endAttach(s, x, z), endNew(x, z, s.x - x, s.z - z, 'x', { label: name }), 'ln', { name: name + ' LANE', wig: 200, wl: 450, Rmin: 35, tries: 4, seed: HAMLETS.length * 7 + 3, gen: 'lane' });
    if (!e) continue;
    HAMLETS.push({ name, x, z, node: e.b });
  }
  // and lanes from each hamlet to its nearest neighbour, where they don't cross anything
  for (const h of HAMLETS){
    const others = HAMLETS.filter(o => o !== h).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z)).slice(0, 2);
    for (const o of others){ if (Math.hypot(o.x - h.x, o.z - h.z) > 6000) continue; if (h.node.links.some(e => e.a === o.node || e.b === o.node)) continue;
      addRoad(atNode(h.node, o.x - h.x, o.z - h.z), atNode(o.node, h.x - o.x, h.z - o.z), 'ln', { name: h.name + '–' + o.name + ' LANE', wig: 220, wl: 450, Rmin: 35, tries: 4, seed: Math.round(h.x + o.z) % 997, gen: 'lane' }); }
  }
}
// ---------- the high villages: three scenic roads up each peak, from different sides, each winding all the way round
// the mountain as it climbs (like a corkscrew), so the views keep changing and the climb is gentle. They meet at the top.
for (const H of HILLS){
  if (!H.name) continue;
  const V = addNode(H.x, H.z, 'x', { label: H.name });
  // how far out the spiral starts: well up the mountain's flanks, but inside the map and clear of the roads around it
  const edgeRoom = Math.min(H.x - WB.x0, WB.x1 - H.x, H.z - WB.z0, WB.z1 - H.z) - 170;
  let Rc = Math.min(1700, 0.62 * H.r + 280, edgeRoom); for (let k = 0; k < GC; k++){ const q = nearestOn(H.x, H.z, Rc + 120, null); if (!q) break; Rc = q.dist - 160; if (Rc < 500) break; }
  if (Rc < 450){ wwarn('no room for roads up', H.name); continue; }
  // three ways in from the roads around it, from different directions
  const cands = []; for (let a = 0; a < TAU; a += TAU / 72){ for (let d = Rc + 300; d < 9500; d += 250){ const x = H.x + Math.cos(a) * d, z = H.z + Math.sin(a) * d; const q = nearestOn(x, z, 160, e => ATTACHABLE(e) && e.gen !== 'dead'); if (q){ cands.push({ a, d: Math.hypot(q.x - H.x, q.z - H.z), q }); break; } } }
  cands.sort((p, q) => p.d - q.d); const picks = [];
  const nameDir = a => ['EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST', 'NORTH', 'NORTH-EAST'][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  const ROADNAMES = ['SKYLINE', 'PANORAMA ROAD', 'FOREST DRIVE'];
  const arms = [];
  // each road climbs its own face of the mountain: long sweeps across the slope, a wide hairpin at each end, never leaving its side
  const buildArm = (c, i, halfW) => {
    const spec = attachSpec(c.q.x, c.q.z, 30, e => ATTACHABLE(e) && e.gen !== 'dead'); if (!spec) return null;
    for (const [rcK, hwK] of [[1, 1], [0.85, 0.85], [1, 0.65], [0.7, 0.75], [0.55, 0.6]]){
      const rc = Rc * rcK, hw = halfW * hwK, a0 = Math.atan2(spec.z - H.z, spec.x - H.x), pts = [];
      const sx = H.x + Math.cos(a0) * rc, sz = H.z + Math.sin(a0) * rc, L0 = Math.hypot(spec.x - sx, spec.z - sz), nA = Math.max(0, Math.floor(L0 / 260));
      for (let k = 1; k <= nA; k++){ const t = k / (nA + 1), w = 45 * Math.sin(t * 6 + i); pts.push([spec.x + (sx - spec.x) * t - Math.sin(a0) * w, spec.z + (sz - spec.z) * t + Math.cos(a0) * w]); }
      const sweeps = Math.max(2, Math.round((rc - 140) / 300)), step = (rc - 140) / sweeps, P = (ang, rr) => [H.x + Math.cos(ang) * rr, H.z + Math.sin(ang) * rr];
      let ang = a0, rr = rc, dir = i % 2 ? 1 : -1;
      // first half-sweep out to one edge of this road's side
      for (let k = 1; k <= 6; k++){ const t = k / 6; pts.push(P(a0 + dir * hw * t, rc - step * 0.35 * t)); }
      ang = a0 + dir * hw; rr = rc - step * 0.35;
      for (let sw = 0; sw < sweeps; sw++){
        // a wide hairpin: half a circle that turns you back across the slope, a little higher up
        const drop = step * 0.3, rho = drop / 2, mid = rr - rho, ux = Math.cos(ang), uz = Math.sin(ang), tx = -Math.sin(ang) * dir, tz = Math.cos(ang) * dir;
        const cx = H.x + ux * mid, cz = H.z + uz * mid;
        for (let k = 1; k <= 8; k++){ const ph = Math.PI * k / 8; pts.push([cx + rho * (Math.cos(ph) * ux + Math.sin(ph) * tx), cz + rho * (Math.cos(ph) * uz + Math.sin(ph) * tz)]); }
        rr -= drop; dir = -dir;
        // then the long sweep back across this side, climbing as it goes
        const last = sw === sweeps - 1, a1 = last ? a0 : ang + dir * 2 * hw, r1 = last ? 120 : rr - step * 0.7, n = Math.max(4, Math.ceil(Math.abs(a1 - ang) * rr / 110));
        for (let k = 1; k <= n; k++){ const t = k / n; pts.push(P(ang + (a1 - ang) * t, rr + (r1 - rr) * t + 25 * Math.sin(t * Math.PI) * Math.sin(sw + i))); }
        ang = a1; rr = r1; if (last) break;
      }
      const B = atNode(V, Math.cos(a0), Math.sin(a0));
      const made = addRoad(endAttach(spec, sx, sz), B, 'mt', { name: H.name + ' ' + ROADNAMES[i % 3] + ' (' + nameDir(a0) + ' SIDE)', points: pts, gen: 'village' });
      if (made) return made;
    }
    return null;
  };
  // choose the sides: nearest roads first, each new side well away from the ones already used
  for (const c of cands){
    if (arms.length >= 3) break; if (picks.some(p => Math.abs(angWrap(p.a - c.a)) < 1.05)) continue;
    const gaps = picks.map(p => Math.abs(angWrap(p.a - c.a))), halfW = Math.min(0.62, ...(gaps.length ? gaps.map(g => g / 2 - 0.2) : [0.62]));
    const made = buildArm(c, arms.length, Math.max(0.25, halfW)); if (made){ arms.push(made); picks.push(c); }
  }
  if (arms.length < 3) wwarn('only ' + arms.length + ' roads up', H.name);
  if (!arms.length) continue;
  const v = { name: H.name, node: V, x: V.x, z: V.z, sides: [], hill: H, arms, dbg: { Rc: Rc | 0, cands: cands.length, picks: picks.map(p => [(p.a * 57.3) | 0, p.d | 0]) } }; VILLAGES.push(v);
  addFlat(v.x, v.z, 120, 330); // a little level ground at the top
  // village lanes between the roads in
  const used = V.links.map(e => { const k = e.a === V ? 2 : e.n - 3; const [x, z] = [e.x[clamp(k, 0, e.n - 1)], e.z[clamp(k, 0, e.n - 1)]]; return Math.atan2(z - V.z, x - V.x); });
  for (let a = 0; a < TAU && v.sides.length < 3; a += TAU / 12){ if (used.some(u => Math.abs(angWrap(u - a)) < 0.7) || v.sides.some(e => Math.abs(angWrap(e.ang - a)) < 0.9)) continue;
    const L = 140 + 20 * v.sides.length; const e = addRoad(atNode(V, Math.cos(a), Math.sin(a)), endNew(V.x + Math.cos(a) * L, V.z + Math.sin(a) * L, -Math.cos(a), -Math.sin(a), 'e'), 'al', { name: H.name + ' LANE', wig: 25, handle: 20, Rmin: 15, tries: 3, gen: 'village' }); if (e){ e.ang = a; v.sides.push(e); } }
}
// ---------- dead ends: farm tracks, logging roads and forgotten spurs, so the secret places can't be found by trying every road
// ---------- MIDNIGHT DRIFT ROAD: a mountain road built for sliding. It crosses a quiet hillside between two roads as one
// long chain of linked bends, each about 45 m round and flowing straight into the next, wide, railed, and double points
const DRIFT = { edge: null };
{ const clearAt = (x, z, R) => !nearestOn(x, z, R) && x > WB.x0 + 600 && x < WB.x1 - 600 && z > WB.z0 + 600 && z < WB.z1 - 600;
  for (let t = 0; t < 600 && !DRIFT.edge; t++){
    const cx = lerp(WB.x0 + 2500, WB.x1 - 2500, hash2(t, 91)), cz = lerp(6000, WB.z1 - 2500, hash2(t, 92)); if (mtnK(cx, cz) < 0.35 || !clearAt(cx, cz, 650)) continue;
    const A = attachSpec(cx, cz, 2600, e => ATTACHABLE(e) && e.gen !== 'dead' && e.gen !== 'jukai'); if (!A || A.dist < 700) continue;
    const ux = (cx - A.x) / A.dist, uz = (cz - A.z) / A.dist, tx = A.x + ux * A.dist * 2, tz = A.z + uz * A.dist * 2;
    const B = attachSpec(tx, tz, 1400, e => ATTACHABLE(e) && e.gen !== 'dead' && e.gen !== 'jukai' && e !== A.e); if (!B) continue;
    const L = Math.hypot(B.x - A.x, B.z - A.z); if (L < 1600 || L > 4800) continue;
    const dx = (B.x - A.x) / L, dz = (B.z - A.z) / L, px = -dz, pz = dx, lam = 360, amp = 78, pts = []; let ok = true;
    for (let d = 160; d < L - 160; d += 22){ const ramp = smooth(160, 420, d) * smooth(160, 420, L - d), w = amp * ramp * Math.sin((d - 160) / lam * TAU), x = A.x + dx * d + px * w, z = A.z + dz * d + pz * w;
      if (!clearAt(x, z, 75)){ ok = false; break; } pts.push([x, z]); }
    if (!ok) continue;
    const e = addRoad(endAttach(A, pts[0][0], pts[0][1]), endAttach(B, pts[pts.length - 1][0], pts[pts.length - 1][1]), 'mt', { name: 'MIDNIGHT DRIFT ROAD', points: pts, gen: 'drift', towardsB: 'DRIFT ROAD', towardsA: 'DRIFT ROAD' });
    if (e){ e.drift = true; DRIFT.edge = e; } }
  if (!DRIFT.edge) wwarn('no room for the drift road'); }
const DEAD_ENDS = [];
{ const R = mulberry(777);
  for (let tries = 0; tries < 4000 && DEAD_ENDS.length < 92; tries++){
    const cand = EDGES.filter(e => e.x && ATTACHABLE(e) && e.len > 400); const e = cand[Math.floor(R() * cand.length)];
    const k = Math.floor(R() * e.n), x = e.x[k], z = e.z[k];
    if (CITIES.some(c => Math.abs(x - c.x) < c.half + 400 && Math.abs(z - c.z) < c.half + 400)) continue;
    const s = attachSpec(x, z, 20); if (!s || !s.make) continue;
    const ang = R() * TAU, L = 450 + R() * 1300, ex = x + Math.cos(ang) * L, ez = z + Math.sin(ang) * L;
    if (Math.abs(Math.cos(ang) * -s.tz + Math.sin(ang) * s.tx) < 0.35) continue; // off at an angle, not along the road
    const d = addRoad(endAttach(s, ex, ez), endNew(ex, ez, -Math.cos(ang), -Math.sin(ang), 'e'), R() < 0.5 ? 'ln' : 'rd', { name: R() < 0.5 ? 'FARM TRACK' : 'FOREST ROAD', wig: 160, wl: 350, Rmin: 30, tries: 2, seed: tries, gen: 'dead' });
    if (d) DEAD_ENDS.push({ e: d, node: d.b, x: d.b.x, z: d.b.z });
  }
}
// ---------- secret places and the map quest. Nothing marks them; Tengu's old man starts you on the trail
const SECRETS = [], CLUES = [];
{ const R = mulberry(4040), pool = DEAD_ENDS.slice().sort(() => R() - 0.5), far = (x, z, list, d) => list.every(q => Math.hypot(q.x - x, q.z - z) > d);
  const pick = (test, list, d) => { const i = pool.findIndex(p => test(p) && far(p.x, p.z, SECRETS.concat(CLUES), d)); if (i < 0) return null; const p = pool.splice(i, 1)[0]; list.push(p); return p; };
  // the three clues: north farmland, the east coast, the West Ridge
  pick(p => p.z < -14000, CLUES, 6000); pick(p => p.x > 8000 && p.z > -12000, CLUES, 6000); pick(p => p.x < -9000 && p.z > -12000, CLUES, 6000);
  const REWARDS = ['paint:CHROME', 'glow:CYAN', 'part:engine4', 'rims:GOLD', 'wing:GT', 'mod:AERO', 'part:tyres4', 'mod:ROCKET', 'cash:40000', 'part:nitro4', 'paint:PEARL GOLD', 'rims:NEON'];
  const NAMES = ['HIDDEN BARN', 'OLD MINE', 'LOGGING CAMP', 'SMUGGLERS\' SHED', 'FORGOTTEN GARAGE', 'RACING TEAM HANGAR', 'HUNTERS\' CABIN', 'OLD AIRFIELD HANGAR', 'ORCHARD STORE', 'BURIED CONTAINER'];
  let k = 0; for (let t = 0; t < 60 && SECRETS.length < 10; t++){ const p = pick(q => true, SECRETS, 3500); if (!p) break; p.name = NAMES[k % NAMES.length]; p.reward = REWARDS[k % REWARDS.length]; p.tunnel = /MINE|TUNNEL|BUNKER/.test(p.name); p.hangar = /HANGAR/.test(p.name); k++; }
  // in the cities: down the quietest alleys
  for (const [cid, nn, name, reward, tunnel] of [['hakone', 'D6', 'ONSEN CELLAR', 'rims:NEON', true], ['kawaguchi', 'H2', 'OLD BOATHOUSE', 'paint:PEARL GOLD', false], ['hokuto', 'D1', 'SCHOOL BASEMENT', 'part:turbo4', true]]){
    const n = CITY[cid].N[nn]; if (n && n.type === 'e' && n.links.length === 1) SECRETS.push({ x: n.x, z: n.z, node: n, e: n.links[0], name, reward, tunnel, city: cid });
  }
  // one house in one housing district hides something crazy
  const sub = SUBURBS[2] || SUBURBS[0]; if (sub){ const cul = sub.edges[sub.edges.length - 1]; SECRETS.push({ x: cul.b.x, z: cul.b.z, node: cul.b, e: cul, name: 'THE HOUSE AT THE END OF THE CLOSE', reward: 'cash:75000', house: true }); }
}
// ---------- the Lore Keeper: at the end of the loneliest of the forgotten roads, far from any town
let LORE_KEEPER = null;
{ let best = null, bs = -Infinity;
  for (const d of DEAD_ENDS){
    if (SECRETS.includes(d) || CLUES.includes(d) || d.e.len < 500 || mtnK(d.x, d.z) > 0.55) continue;
    const near = Math.min(...CITIES.map(c => Math.hypot(d.x - c.x, d.z - c.z) - c.half), ...TOWN_SITES.filter(t => t.node).map(t => Math.hypot(d.x - t.x, d.z - t.z)), ...LANDMARKS.filter(l => l.node).map(l => Math.hypot(d.x - l.node.x, d.z - l.node.z)), ...SECRETS.map(q => Math.hypot(d.x - q.x, d.z - q.z) * 1.5));
    const edge = Math.min(d.x - WB.x0, WB.x1 - d.x, d.z - WB.z0, WB.z1 - d.z); if (edge < 900) continue;
    const sc = near + d.e.len * 0.3; if (sc > bs){ bs = sc; best = d; } }
  if (best) LORE_KEEPER = { x: best.x, z: best.z, node: best.node, e: best.e }; else wwarn('no spot for the lore keeper'); }
// ---------- dirt shortcuts: unpaved tracks straight over the hills where the roads make you go the long way round.
// No traffic uses them and no police follow you onto them.
const TRACKS = [];
{
  // shortest road distance between nodes (one-way roads respected), cached per start node
  const dCache = new Map();
  const dist = from => { let d = dCache.get(from.id); if (d) return d; d = new Float64Array(NODES.length).fill(Infinity); d[from.id] = 0; const open = [[0, from]];
    while (open.length){ let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i; const [dv, n] = open[bi]; open[bi] = open[open.length - 1]; open.pop(); if (dv > d[n.id]) continue;
      for (const e of n.links){ if (!e.len) continue; let m = null; if (e.a === n) m = e.b; else if (!e.oneway) m = e.a; if (!m) continue; const nd = dv + e.len; if (nd < d[m.id]){ d[m.id] = nd; open.push([nd, m]); } } }
    dCache.set(from.id, d); return d; };
  const ok = e => !e.city && !e.ic && (e.cls === 'rd' || e.cls === 'ln' || e.cls === 'mt') && e.gen !== 'dead' && e.len > 260;
  const pts = []; for (const e of EDGES){ if (!e.x || !ok(e)) continue; for (let s = 120; s < e.len - 120; s += 380){ const k = Math.round(s / e.ds); pts.push({ e, k, s, x: e.x[k], z: e.z[k] }); } }
  const roadKm = (A, B) => { // by road from A to B, through either end of A's road and either end of B's
    if (A.e === B.e) return Math.abs(A.s - B.s);
    let best = Infinity; for (const [na, da] of [[A.e.a, A.s], [A.e.b, A.e.len - A.s]]){ const D = dist(na); for (const [nb, db] of [[B.e.a, B.s], [B.e.b, B.e.len - B.s]]) best = Math.min(best, da + D[nb.id] + db); }
    return best; };
  // candidate pairs: close as the crow flies, far apart by road
  const cand = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++){
    const A = pts[i], B = pts[j], L = Math.hypot(A.x - B.x, A.z - B.z); if (L < 1300 || L > 5200) continue;
    const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2; if (CITIES.some(c => Math.hypot(mx - c.x, mz - c.z) < c.half + 600)) continue;
    if (Math.abs(baseRaw(A.x, A.z) - baseRaw(B.x, B.z)) > L * 0.075) continue; // a track has to be climbable: no straight drop from a high road to the valley
    cand.push({ A, B, L, mtn: mtnK(mx, mz) > 0.4, mx, mz });
  }
  for (const c of cand) c.road = roadKm(c.A, c.B);
  cand.sort((p, q) => (q.road - q.L * 1.4) - (p.road - p.L * 1.4));
  const names = ['KITSUNE', 'KUMA', 'TANUKI', 'SARU', 'SHIKA', 'TAKA', 'INOSHISHI', 'KARASU', 'FUKURO', 'USAGI', 'KAMOSHIKA', 'TSURU', 'HEBI', 'KIJI', 'MUJINA', 'ITACHI', 'NEKO', 'SAGI', 'KAERU', 'HOTARU'];
  let nMtn = 0, nCountry = 0, dirty = false;
  for (const c of cand){
    if (TRACKS.length >= 18) break;
    if (c.mtn ? nMtn >= 10 : nCountry >= 8) continue;
    if (TRACKS.some(t => Math.hypot(t.mx - c.mx, t.mz - c.mz) < 2600 || [t.ax, t.bx].some((x, q) => Math.hypot(x - c.A.x, [t.az, t.bz][q] - c.A.z) < 1500 || Math.hypot(x - c.B.x, [t.az, t.bz][q] - c.B.z) < 1500))) continue;
    if (dirty){ dCache.clear(); dirty = false; } c.road = roadKm(c.A, c.B); if (c.road < c.L * 2.2 || c.road - c.L < 2500) continue; // still a real shortcut with the tracks built so far?
    const mk = P => { const e = P.e, k = clamp(P.k, 2, e.n - 3), tx = e.x[k + 2] - e.x[k - 2], tz = e.z[k + 2] - e.z[k - 2], tl = Math.hypot(tx, tz) || 1;
      return { x: e.x[k], z: e.z[k], tx: tx / tl, tz: tz / tl, dist: 0, e, make(){ const q2 = nearestOn(this.x, this.z, 10, ATTACHABLE); return q2 ? splitAt(q2.e, q2.k) : null; } }; };
    const SA = mk(c.A), SB = mk(c.B);
    const name = names[TRACKS.length % names.length] + (c.mtn ? ' MOUNTAIN TRAIL' : ' FARM TRACK');
    const tr = addRoad(endAttach(SA, SB.x, SB.z), endAttach(SB, SA.x, SA.z), 'dt', { name, route: 'DT', wig: c.mtn ? 260 : 180, wl: 420, Rmin: 28, tries: 6, seed: TRACKS.length * 13 + 7, gen: 'track' });
    if (!tr) continue;
    TRACKS.push({ e: tr, ax: SA.x, az: SA.z, bx: SB.x, bz: SB.z, mx: c.mx, mz: c.mz, saved: c.road - tr.len, mtn: c.mtn, name });
    if (c.mtn) nMtn++; else nCountry++; dirty = true;
  }
}
// ---------- highway exits: every few kilometres a pair of slip roads off each carriageway to a junction beside the
// expressway, a bridge across to the other side, and a road from each side into the local network (towns, hamlets, lanes)
const EXITS = [], FORKS = [];
{
  const splitCw = (e, k, at) => { // split a carriageway at sample k with a 'y' node; the second half keeps the rest of its life
    k = clamp(k, 3, e.n - 4);
    const n = addNode(e.x[k], e.z[k], 'y', { exitNode: true }), oldB = e.b, X2 = Array.from(e.x.subarray(k)), Z2 = Array.from(e.z.subarray(k));
    e.x = e.x.slice(0, k + 1); e.z = e.z.slice(0, k + 1); e.n = k + 1; e.len = k * e.ds;
    oldB.links.splice(oldB.links.indexOf(e), 1); e.b = n; n.links.push(e);
    const e2 = mkEdge(n, oldB, 'cw', X2, Z2, { route: e.route, name: e.name, lit: e.lit, towards: e.towards, paired: true, gateA: false, gateB: e.gateB, auxF: e.auxF });
    e.gateB = false; return [n, e2];
  };
  const nearestK = (e, x, z) => { let bk = 0, bd = Infinity; for (let k = 0; k < e.n; k++){ const d = (e.x[k] - x) ** 2 + (e.z[k] - z) ** 2; if (d < bd){ bd = d; bk = k; } } return bk; };
  const tangent = (e, k) => { const a = Math.max(0, k - 3), b = Math.min(e.n - 1, k + 3), tx = e.x[b] - e.x[a], tz = e.z[b] - e.z[a], l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; };
  const bezPts = (P0, P1, P2, P3) => { const X = [], Z = []; for (let q = 0; q <= 60; q++){ const s = q / 60, u = 1 - s; X.push(u * u * u * P0[0] + 3 * u * u * s * P1[0] + 3 * u * s * s * P2[0] + s * s * s * P3[0]); Z.push(u * u * u * P0[1] + 3 * u * u * s * P1[1] + 3 * u * s * s * P2[1] + s * s * s * P3[1]); } return { X, Z }; };
  const auxNear = (n, r0, r1) => (x, z) => 1 - smooth(r0, r1, Math.hypot(x - n.x, z - n.z));
  const orF = (f, g) => f ? (x, z) => Math.max(f(x, z), g(x, z)) : g;
  const clearOf = (X, Z, hw, ign) => { // like roadClear, but a slip road may run right beside its expressway
    for (let i = 0; i < X.length; i += 2){ const x = X[i], z = Z[i];
      for (const L of LAKES) if (lakeQ(L, x, z) < 1.1) return false;
      for (const K of KEEPOUT) if ((x - K.x) ** 2 + (z - K.z) ** 2 < K.r * K.r) return false;
      const c0 = Math.floor(x / GC), r0 = Math.floor(z / GC);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++){ const a = GIDX.get((c0 + ox) * 100000 + r0 + oz); if (!a) continue;
        for (let q = 0; q < a.length; q += 2){ const e = a[q], k = a[q + 1]; if (e.cls === 'cw' || e.cls === 'rp' || ign.has(e)) continue; if (Math.hypot(e.x[k] - x, e.z[k] - z) < e.C.hw + hw + 10) return false; } } }
    return true; };
  const placeName = (x, z) => { let best = null, bd = 4500; for (const p of [...TOWN_SITES.filter(t => t.node).map(t => ({ name: t.id.toUpperCase(), x: t.x, z: t.z })), ...VILLAGES, ...LANDMARKS.filter(l => l.node).map(l => ({ name: l.name, x: l.node.x, z: l.node.z })), ...HAMLETS]){ const d = Math.hypot(p.x - x, p.z - z); if (d < bd){ bd = d; best = p.name; } } return best; };
  const startXZ = (() => { const e = E1a.edges[0]; let bk = 0, bd = Infinity; for (let k = 0; k < e.n; k++){ const d = Math.abs(e.z[k] - 12900); if (d < bd){ bd = d; bk = k; } } return [e.x[bk], e.z[bk]]; })();
  const SPAN = 320, OFF = 230;
  const POIS = [...TOWN_SITES.filter(t => t.node).map(t => ({ name: t.id.toUpperCase(), x: t.x, z: t.z, kind: 'town' })), ...SUBURBS.map(S => ({ name: S.name, x: S.x, z: S.z, kind: 'suburb' })),
    ...LANDMARKS.filter(l => l.node).map(l => ({ name: l.name, x: l.node.x, z: l.node.z, kind: 'landmark' })), ...HAMLETS.map(h => ({ name: h.name, x: h.x, z: h.z, kind: 'hamlet' }))];
  const links0 = LINKS.slice(); let num = 1;
  for (const lk0 of links0){
    let cur = lk0, A = lk0.edges[0];
    for (let s = 1700; s < A.len - 1700; s += 250){
      if (EXITS.length >= 40) break;
      const kC = Math.round(s / A.ds), cx = A.x[kC], cz = A.z[kC];
      if (ICS.some(ic => Math.hypot(cx - ic.x, cz - ic.z) < 2300) || CITIES.some(c => Math.hypot(cx - c.x, cz - c.z) < c.half + 1400)) continue;
      if (Math.hypot(cx - startXZ[0], cz - startXZ[1]) < 2500) continue; // leave the start station's stretch alone
      if (EXITS.some(x => Math.hypot(x.x - cx, x.z - cz) < 3600)) continue;
      const [tx, tz] = tangent(A, kC), rx = -tz, rz = tx; // A's direction and its right
      const B = A.pair, kB = nearestK(B, cx, cz), [bx, bz] = [B.x[kB], B.z[kB]];
      const JA = [cx + rx * OFF, cz + rz * OFF], JB = [bx - rx * OFF, bz - rz * OFF];
      // the diverge and merge points on each carriageway
      const kDA = Math.round((s - SPAN) / A.ds), kMA = Math.round((s + SPAN) / A.ds), kDB = nearestK(B, cx + tx * SPAN, cz + tz * SPAN), kMB = nearestK(B, cx - tx * SPAN, cz - tz * SPAN);
      if (kDB >= kMB || kMB > B.n - 30 || kDB < 30) continue;
      const LS = LANE_SHIFT, pA = k => [A.x[k] + rx * LS, A.z[k] + rz * LS], pB = k => [B.x[k] - rx * LS, B.z[k] - rz * LS];
      const offA = bezPts(pA(kDA), [pA(kDA)[0] + tx * 140, pA(kDA)[1] + tz * 140], [JA[0] - tx * 90, JA[1] - tz * 90], JA);
      const onA = bezPts(JA, [JA[0] + tx * 90, JA[1] + tz * 90], [pA(kMA)[0] - tx * 140, pA(kMA)[1] - tz * 140], pA(kMA));
      const offB = bezPts(pB(kDB), [pB(kDB)[0] - tx * 140, pB(kDB)[1] - tz * 140], [JB[0] + tx * 90, JB[1] + tz * 90], JB);
      const onB = bezPts(JB, [JB[0] - tx * 90, JB[1] - tz * 90], [pB(kMB)[0] + tx * 140, pB(kMB)[1] + tz * 140], pB(kMB));
      const ign = new Set();
      if (![offA, onA, offB, onB].every(p => clearOf(p.X, p.Z, CLS.rp.hw, ign))) continue;
      if (!clearOf([JA[0], JB[0]], [JA[1], JB[1]], CLS.rd.hw, ign)) continue;
      // a road out from each side into the local network, if there's one within reach
      // each side's road heads for somewhere worth going: a town, a housing district, a landmark's road or a hamlet; else the nearest lane
      const outSpec = (J, sx, sz) => {
        let best = null, bd = 3400;
        for (const P of POIS){ const dx = P.x - J[0], dz = P.z - J[1], d = Math.hypot(dx, dz); if (d < 300 || d > bd || (dx * sx + dz * sz) < d * 0.2) continue;
          const sp = attachSpec(P.x, P.z, 450, e => ATTACHABLE(e) && e.gen !== 'dead'); if (sp && Math.hypot(sp.x - J[0], sp.z - J[1]) > 250){ bd = d; best = sp; best.poi = P; } }
        const s0 = attachSpec(J[0] + sx * 700, J[1] + sz * 700, 2600, e => ATTACHABLE(e) && e.gen !== 'dead'); const near = !s0 || Math.hypot(s0.x - J[0], s0.z - J[1]) < 250 ? null : s0;
        return [best, near].filter(Boolean); };
      const optA = outSpec(JA, rx, rz), optB = outSpec(JB, -rx, -rz);
      const planOut = (J, dx, dz, spec) => spec ? planRoad({ x: J[0], z: J[1], dx, dz }, endAttach(spec, J[0], J[1]), { cls: 'rd', wig: 160, wl: 500, Rmin: 45, tries: 5, seed: num * 17 }) : null;
      let sA = null, sB = null, dOA = null, dOB = null;
      for (const sp of optA){ dOA = planOut(JA, rx, rz, sp); if (dOA){ sA = sp; break; } }
      for (const sp of optB){ dOB = planOut(JB, -rx, -rz, sp); if (dOB){ sB = sp; break; } }
      if (!dOA || !dOB) continue; // both sides lead somewhere: off the slip road you can go left, right or back on
      // build it: split both carriageways twice, add the slip roads, the junctions, the bridge and the roads out
      const poi = (dOA && sA.poi) || (dOB && sB.poi), name = (poi && poi.name) || placeName(cx, cz) || 'LOCAL ROADS', label = 'EXIT ' + num;
      const [nDA, A2] = splitCw(A, kDA); const [nMA, A3] = splitCw(A2, kMA - kDA);
      const [nDB, B2] = splitCw(B, kDB); const [nMB, B3] = splitCw(B2, kMB - kDB);
      // pairs and links: A, A2, A3 run beside B3, B2, B
      A.pair = B3; B3.pair = A; A2.pair = B2; B2.pair = A2; A3.pair = B; B.pair = A3;
      cur.edges = [A, B3]; A.link = B3.link = cur;
      const l2 = { route: cur.route, name: cur.name, edges: [A2, B2] }, l3 = { route: cur.route, name: cur.name, edges: [A3, B] }; LINKS.push(l2, l3); A2.link = B2.link = l2; A3.link = B.link = l3;
      // the extra lane: it opens before each slip road off and runs on after each slip road on
      A.auxF = orF(A.auxF, auxNear(nDA, 380, 520)); A3.auxF = orF(A3.auxF, auxNear(nMA, 300, 440));
      B.auxF = orF(B.auxF, auxNear(nDB, 380, 520)); B3.auxF = orF(B3.auxF, auxNear(nMB, 300, 440)); // B runs the other way: its diverge ends B, its merge starts B3
      const nJA = addNode(JA[0], JA[1], 'x', { label: label + ' · ' + name, exitTerm: true }), nJB = addNode(JB[0], JB[1], 'x', { label: label + ' · ' + name, exitTerm: true });
      const toward = A.towards, back = B.towards;
      mkEdge(nDA, nJA, 'rp', offA.X, offA.Z, { route: 'RAMP', name: label + ' · ' + name, offA: LS, lit: true, gen: 'exit', exitNo: num });
      mkEdge(nJA, nMA, 'rp', onA.X, onA.Z, { route: 'RAMP', name: cur.name.split(' ')[0] + ' → ' + (toward || ''), offB: LS, lit: true, gen: 'exit', exitNo: num });
      mkEdge(nDB, nJB, 'rp', offB.X, offB.Z, { route: 'RAMP', name: label + ' · ' + name, offA: LS, lit: true, gen: 'exit', exitNo: num });
      mkEdge(nJB, nMB, 'rp', onB.X, onB.Z, { route: 'RAMP', name: cur.name.split(' ')[0] + ' → ' + (back || ''), offB: LS, lit: true, gen: 'exit', exitNo: num });
      mkEdge(nJA, nJB, 'rd', [JA[0], JB[0]], [JA[1], JB[1]], { route: 'LN', name: label + ' BRIDGE', lit: true, gen: 'exit' });
      const outs = [];
      if (dOA){ const nb = realize(endAttach(sA, JA[0], JA[1])); if (nb){ dOA.X[dOA.X.length - 1] = nb.x; dOA.Z[dOA.Z.length - 1] = nb.z; outs.push(mkEdge(nJA, nb, 'rd', dOA.X, dOA.Z, { route: 'LN', name: label + ' · ' + name + ' ROAD', gen: 'exit' })); } }
      gidxRebuild();
      if (dOB){ const sB2 = attachSpec(sB.x, sB.z, 30, e => ATTACHABLE(e) && e.gen !== 'dead'); const nb = sB2 && realize(endAttach(sB2, JB[0], JB[1])); if (nb){ dOB.X[dOB.X.length - 1] = nb.x; dOB.Z[dOB.Z.length - 1] = nb.z; outs.push(mkEdge(nJB, nb, 'rd', dOB.X, dOB.Z, { route: 'LN', name: label + ' · ' + name + ' ROAD', gen: 'exit' })); } }
      gidxRebuild();
      EXITS.push({ num, name, label, x: cx, z: cz, nJA, nJB, nDA, nDB, route: cur.route, poi: poi && poi.kind, rx, rz, tx, tz });
      num++;
      A = A3; cur = l3; s = SPAN + 250; // carry on down the rest of this expressway
    }
  }
  // ---------- forks: three new expressways branching off the network to towns it doesn't reach. Each leaves through an
  // exit (slip roads to a roundabout beside the main line), runs on its own carriageways over the local roads, and ends at
  // a roundabout outside its town
  const cwSamples = () => { const pts = []; for (const e of EDGES) if (e.cls === 'cw' && e.x) for (let k = 0; k < e.n; k += 20) pts.push([e.x[k], e.z[k]]); return pts; };
  const FDBG = []; let LWHY = ''; let CWP = cwSamples(); const cwDist = (x, z) => { let d = Infinity; for (const [px, pz] of CWP){ const q = (px - x) ** 2 + (pz - z) ** 2; if (q < d) d = q; } return Math.sqrt(d); };
  const targets = [...TOWN_SITES.filter(t => t.node).map(t => ({ t, d: cwDist(t.x, t.z) })).filter(q => q.d > 2500 && q.d < 15000 && jukaiK(q.t.x, q.t.z) < 0.2).sort((a, b) => b.d - a.d),
    ...LANDMARKS.filter(l => l.node && mtnK(l.node.x, l.node.z) < 0.6).map(l => ({ t: { id: l.name.replace(/^(THE|OLD|ABANDONED|MOUNTAIN) /, '').split(' ')[0].toLowerCase(), x: l.node.x, z: l.node.z, lm: true }, d: cwDist(l.node.x, l.node.z) })).filter(q => q.d > 3000 && q.d < 15000).sort((a, b) => b.d - a.d)];
  const lineOK = (r, from, to, town) => { // the planned expressway: clear of cities, lakes, landmarks, the forest, other expressways, and not running along a road
    let along = 0;
    for (let i = 0; i < r.n; i += 10){ const x = r.x[i], z = r.z[i], s = i * r.ds, ends = Math.min(s, r.len - s);
      if (x < WB.x0 + 500 || x > WB.x1 - 500 || z < WB.z0 + 500 || z > WB.z1 - 500){ LWHY = 'edge'; return false; }
      if (LAKES.some(L => lakeQ(L, x, z) < 1.25) || KEEPOUT.some(K => Math.hypot(x - K.x, z - K.z) < K.r + 40 && !(town.lm && ends < 900)) || jukaiK(x, z) > 0.15){ LWHY = 'lake/keep/jukai'; return false; }
      if (CITIES.some(c => Math.abs(x - c.x) < c.half + 350 && Math.abs(z - c.z) < c.half + 350) || ICS.some(ic => Math.hypot(x - ic.x, z - ic.z) < 1500)){ LWHY = 'city/ic'; return false; }
      if (TOWN_SITES.some(t => t !== town && t.id !== town.id && Math.hypot(x - t.x, z - t.z) < 450) || (ends > 700 && Math.hypot(x - town.x, z - town.z) < 380)){ LWHY = 'town'; return false; }
      if (ends > 600 && Math.hypot(x - from[0], z - from[1]) > 1800 && cwDist(x, z) < 120){ LWHY = 'cw'; return false; }
      const q = nearestOn(x, z, 22, e => e.cls !== 'cw' && e.cls !== 'rp'); along = q ? along + 1 : 0; if (along > 12){ LWHY = 'along'; return false; } }
    return true; };
  const forkNames = [['E5', 'E5 '], ['E6', 'E6 '], ['E7', 'E7 ']];
  let made = 0;
  for (const { t: town } of targets){
    if (made >= 3) break;
    if (FORKS.some(F => Math.hypot(F.town.x - town.x, F.town.z - town.z) < 5000)) continue;
    // the best place to leave: an expressway stretch with the town off to its right, as close as possible
    const sites = [];
    for (const lk of LINKS) for (const A of lk.edges){ if (!A || A.cls !== 'cw' || A.ic || !A.x || !A.pair) continue;
      for (let s = 1700; s < A.len - 1700; s += 200){ const k = Math.round(s / A.ds), cx = A.x[k], cz = A.z[k];
        if (ICS.some(ic => Math.hypot(cx - ic.x, cz - ic.z) < 2300) || CITIES.some(c => Math.hypot(cx - c.x, cz - c.z) < c.half + 1400) || EXITS.some(X => Math.hypot(X.x - cx, X.z - cz) < 2200)) continue;
        const [tx, tz] = tangent(A, k), rx = -tz, rz = tx, dx = town.x - cx, dz = town.z - cz, d = Math.hypot(dx, dz);
        if (d < 3000 || d > 16000 || (dx * rx + dz * rz) < d * 0.35) continue;
        sites.push({ A, lk, s, k, cx, cz, tx, tz, rx, rz, d }); } }
    if (!sites.length){ FDBG.push(town.id + ':nosite'); continue; }
    sites.sort((a, b) => a.d - b.d);
    let built = false;
    for (const site of sites.filter((q, i) => i % 3 === 0).slice(0, 12)){ if (built) break;
    const { A, lk, s, cx, cz, tx, tz, rx, rz } = site, B = A.pair, kB = nearestK(B, cx, cz), JA = [cx + rx * OFF, cz + rz * OFF], JB = [B.x[kB] - rx * OFF, B.z[kB] - rz * OFF];
    const kDA = Math.round((s - SPAN) / A.ds), kMA = Math.round((s + SPAN) / A.ds), kDB = nearestK(B, cx + tx * SPAN, cz + tz * SPAN), kMB = nearestK(B, cx - tx * SPAN, cz - tz * SPAN);
    if (kDB >= kMB || kMB > B.n - 30 || kDB < 30 || kDA < 3 || kMA > A.n - 4){ FDBG.push(town.id + ':kB'); continue; }
    const pA = k => [A.x[k] + rx * LANE_SHIFT, A.z[k] + rz * LANE_SHIFT], pB = k => [B.x[k] - rx * LANE_SHIFT, B.z[k] - rz * LANE_SHIFT];
    const offA = bezPts(pA(kDA), [pA(kDA)[0] + tx * 140, pA(kDA)[1] + tz * 140], [JA[0] - tx * 90, JA[1] - tz * 90], JA), onA = bezPts(JA, [JA[0] + tx * 90, JA[1] + tz * 90], [pA(kMA)[0] - tx * 140, pA(kMA)[1] - tz * 140], pA(kMA));
    const offB = bezPts(pB(kDB), [pB(kDB)[0] - tx * 140, pB(kDB)[1] - tz * 140], [JB[0] + tx * 90, JB[1] + tz * 90], JB), onB = bezPts(JB, [JB[0] - tx * 90, JB[1] - tz * 90], [pB(kMB)[0] + tx * 140, pB(kMB)[1] + tz * 140], pB(kMB));
    if (![offA, onA, offB, onB].every(p => clearOf(p.X, p.Z, CLS.rp.hw, new Set()))){ FDBG.push(town.id + ':slips'); continue; }
    // the terminal roundabout outside town, on the way in from the fork
    const ux = (town.x - JA[0]) / Math.hypot(town.x - JA[0], town.z - JA[1]), uz = (town.z - JA[1]) / Math.hypot(town.x - JA[0], town.z - JA[1]);
    let plan = null;
    for (const back of [650, 900, 1200]){ const TP = [town.x - ux * back, town.z - uz * back];
      const sp = attachSpec(TP[0] + ux * 300, TP[1] + uz * 300, 900, e => ATTACHABLE(e) && e.gen !== 'dead'); if (!sp || Math.hypot(sp.x - TP[0], sp.z - TP[1]) < 120){ FDBG.push(town.id + ':nospec'); continue; }
      for (const seed of [1, 2, 3, 4]){ const pa = { x: JA[0], z: JA[1], dx: ux, dz: uz, gate: true }, pb = { x: TP[0], z: TP[1], dx: -ux, dz: -uz, gate: true };
        const o = { route: forkNames[made][0], name: forkNames[made][1] + town.id.toUpperCase() + ' EXPRESSWAY', seed: 700 + made * 31 + seed * 7, wig: 260 - seed * 50, handle: 320, Rmin: 380, towardsB: town.id.toUpperCase(), towardsA: A.towards || cur0(lk) };
        const dry = hwLink(pa, pb, Object.assign({ dry: true }, o)); if (!dry || !lineOK(dry.r, JA, TP, town)){ FDBG.push(town.id + ':line:' + LWHY); continue; }
        const road = planRoad({ x: TP[0], z: TP[1], dx: ux, dz: uz }, endAttach(sp, TP[0], TP[1]), { cls: 'rd', wig: 80, wl: 300, Rmin: 40, tries: 5, seed: 900 + made });
        if (!road){ FDBG.push(town.id + ':road'); continue; } plan = { TP, pa, pb, o, road, sp }; break; }
      if (plan) break; }
    if (!plan) continue;
    // build it: the exit off the main line (as for any exit), then the new expressway, then the road into town
    const num = EXITS.length + 1, label = 'EXIT ' + num, name = town.id.toUpperCase() + ' · ' + forkNames[made][0];
    const [nDA, A2] = splitCw(A, kDA); const [nMA, A3] = splitCw(A2, kMA - kDA); const [nDB, B2] = splitCw(B, kDB); const [nMB, B3] = splitCw(B2, kMB - kDB);
    A.pair = B3; B3.pair = A; A2.pair = B2; B2.pair = A2; A3.pair = B; B.pair = A3;
    lk.edges = [A, B3]; A.link = B3.link = lk; const l2 = { route: lk.route, name: lk.name, edges: [A2, B2] }, l3 = { route: lk.route, name: lk.name, edges: [A3, B] }; LINKS.push(l2, l3); A2.link = B2.link = l2; A3.link = B.link = l3;
    A.auxF = orF(A.auxF, auxNear(nDA, 380, 520)); A3.auxF = orF(A3.auxF, auxNear(nMA, 300, 440)); B.auxF = orF(B.auxF, auxNear(nDB, 380, 520)); B3.auxF = orF(B3.auxF, auxNear(nMB, 300, 440));
    const nJA = addNode(JA[0], JA[1], 'x', { label: label + ' · ' + name, exitTerm: true }), nJB = addNode(JB[0], JB[1], 'x', { label: label + ' · ' + name, exitTerm: true });
    mkEdge(nDA, nJA, 'rp', offA.X, offA.Z, { route: 'RAMP', name: label + ' · ' + forkNames[made][0] + ' ' + town.id.toUpperCase(), offA: LANE_SHIFT, lit: true, gen: 'exit', exitNo: num });
    mkEdge(nJA, nMA, 'rp', onA.X, onA.Z, { route: 'RAMP', name: lk.name.split(' ')[0] + ' → ' + (A.towards || ''), offB: LANE_SHIFT, lit: true, gen: 'exit', exitNo: num });
    mkEdge(nDB, nJB, 'rp', offB.X, offB.Z, { route: 'RAMP', name: label + ' · ' + forkNames[made][0] + ' ' + town.id.toUpperCase(), offA: LANE_SHIFT, lit: true, gen: 'exit', exitNo: num });
    mkEdge(nJB, nMB, 'rp', onB.X, onB.Z, { route: 'RAMP', name: lk.name.split(' ')[0] + ' → ' + (B.towards || ''), offB: LANE_SHIFT, lit: true, gen: 'exit', exitNo: num });
    mkEdge(nJA, nJB, 'rd', [JA[0], JB[0]], [JA[1], JB[1]], { route: 'LN', name: label + ' BRIDGE', lit: true, gen: 'exit' });
    const nT = addNode(plan.TP[0], plan.TP[1], 'x', { label: forkNames[made][0] + ' · ' + town.id.toUpperCase(), exitTerm: true });
    plan.pa.outN = plan.pa.inN = nJA; plan.pb.outN = plan.pb.inN = nT;
    const link = hwLink(plan.pa, plan.pb, plan.o); link.edges.forEach(e => { e.fork = true; e.lit = true; });
    gidxRebuild();
    const sp2 = attachSpec(plan.sp.x, plan.sp.z, 40, e => ATTACHABLE(e) && e.gen !== 'dead'), nb = sp2 && realize(endAttach(sp2, plan.TP[0], plan.TP[1]));
    if (nb){ plan.road.X[0] = nT.x; plan.road.Z[0] = nT.z; plan.road.X[plan.road.X.length - 1] = nb.x; plan.road.Z[plan.road.Z.length - 1] = nb.z; mkEdge(nT, nb, 'rd', plan.road.X, plan.road.Z, { route: 'LN', name: town.id.toUpperCase() + ' ROAD', gen: 'exit', lit: true }); }
    gidxRebuild(); CWP = cwSamples();
    EXITS.push({ num, name, label, x: cx, z: cz, nJA, nJB, nDA, nDB, route: lk.route, poi: 'town', rx, rz, tx, tz, fork: forkNames[made][0] });
    FORKS.push({ town, route: forkNames[made][0], nJA, nT, link }); made++; built = true;
    } }
  if (made < 3) wwarn('only ' + made + ' highway forks: ' + FDBG.slice(0, 40).join(' '));
}
function cur0(lk){ return lk.edges[0] && lk.edges[0].towards || ''; }
// ---------- the sea of trees: a maze of old forest trails, loops and dead ends that only show on your map once you've driven
// them. At its middle, at the end of a short spur, the heart of the forest; a few strange things wait at other dead ends
const JUKAI_NET = { pts: [], edges: [], heart: null, heartE: null, ends: [], heads: [], clear: [] };
{
  const R = mulberry(8128), pts = JUKAI_NET.pts;
  const okPt = (x, z, k) => jukaiK(x, z) > k && LAKES.every(L => lakeQ(L, x, z) > 1.4) && TOWN_SITES.every(t => Math.hypot(t.x - x, t.z - z) > 520) && !nearestOn(x, z, 110);
  // the middle first, then points spread through the forest
  for (let r = 0; r < 1500 && !pts.length; r += 60) for (let a = 0; a < TAU; a += 0.5){ const x = JUKAI.x + Math.cos(a) * r, z = JUKAI.z + Math.sin(a) * r; if (okPt(x, z, 0.9)){ pts.push({ x, z, node: null, mid: true }); break; } }
  for (let t = 0; t < 900 && pts.length < 30; t++){ const a = R() * TAU, rr = Math.sqrt(R()) * 0.95, x = JUKAI.x + Math.cos(a) * rr * JUKAI.rx, z = JUKAI.z + Math.sin(a) * rr * JUKAI.rz;
    if (!okPt(x, z, 0.75) || pts.some(p => Math.hypot(p.x - x, p.z - z) < 560)) continue; pts.push({ x, z, node: null }); }
  // which pairs to join: a spanning tree (so it all connects) plus some loops to get lost in
  const pairs = []; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++){ const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z); if (d < 1500) pairs.push([d, i, j]); }
  pairs.sort((a, b) => a[0] - b[0]);
  const par = pts.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
  const tree = [], extra = []; for (const P of pairs){ const a = find(P[1]), b = find(P[2]); if (a !== b){ par[a] = b; tree.push(P); } else if (P[0] < 1050 && R() < 0.4) extra.push(P); }
  const NAMES = ['KODAMA TRAIL', 'KITSUNE PATH', 'MOSS ROAD', 'LANTERN WAY', 'BLACK CEDAR TRAIL', 'HOLLOW ROAD', 'WHISPER TRAIL', 'ROOT ROAD', 'LAVA TUBE TRAIL', 'OLD CHARCOAL ROAD', 'COLD WIND PATH', 'NO-NAME TRAIL'];
  const end = (p, q) => { const dx = q.x - p.x, dz = q.z - p.z; return p.node ? atNode(p.node, dx, dz) : endNew(p.x, p.z, dx, dz, 'x', { jukai: true }); };
  const join = (i, j, k) => { const p = pts[i], q = pts[j], A = end(p, q), B = end(q, p);
    const e = addRoad(A, B, 'dt', { name: NAMES[k % NAMES.length], route: 'DT', wig: 140, wl: 240, Rmin: 22, tries: 6, seed: 900 + k, gen: 'jukai' });
    if (!e) return null; p.node = e.a; q.node = e.b; e.jukai = true; JUKAI_NET.edges.push(e); return e; };
  let k = 0; for (const P of [...tree, ...extra]) join(P[1], P[2], k++);
  // trailheads: from the outer points to the nearest ordinary road
  const outer = pts.filter(p => p.node).map(p => [p, ((p.x - JUKAI.x) / JUKAI.rx) ** 2 + ((p.z - JUKAI.z) / JUKAI.rz) ** 2]).sort((a, b) => b[1] - a[1]);
  for (const [p] of outer){ if (JUKAI_NET.heads.length >= 6) break;
    if (JUKAI_NET.heads.some(h => Math.hypot(h.x - p.x, h.z - p.z) < 1500)) continue;
    const sp = attachSpec(p.x, p.z, 1600, e => ATTACHABLE(e) && !e.jukai && e.gen !== 'dead'); if (!sp || Math.hypot(sp.x - p.x, sp.z - p.z) < 150) continue;
    const e = addRoad(endAttach(sp, p.x, p.z), atNode(p.node, sp.x - p.x, sp.z - p.z), 'dt', { name: 'TRAIL INTO THE TREES', route: 'DT', wig: 120, wl: 260, Rmin: 22, tries: 6, seed: 1300 + JUKAI_NET.heads.length, gen: 'jukai' });
    if (!e){ continue; } e.jukai = true; JUKAI_NET.edges.push(e); const r = { x: e.a.x, z: e.a.z, e, node: e.a }; JUKAI_NET.heads.push(r); }
  // the heart: a short spur off the middle point into a clearing
  const M = pts.find(p => p.mid && p.node);
  if (M) for (let a = 0; a < TAU && !JUKAI_NET.heart; a += 0.4){ const x = M.x + Math.cos(a) * 190, z = M.z + Math.sin(a) * 190; if (!okPt(x, z, 0.8)) continue;
    const e = addRoad(atNode(M.node, Math.cos(a), Math.sin(a)), endNew(x, z, -Math.cos(a), -Math.sin(a), 'e', { jukai: true }), 'dt', { name: 'THE LAST TRAIL', route: 'DT', wig: 50, wl: 120, Rmin: 20, tries: 4, seed: 77, gen: 'jukai' });
    if (e){ e.jukai = true; JUKAI_NET.edges.push(e); JUKAI_NET.heart = { x: e.b.x, z: e.b.z, node: e.b, e }; JUKAI_NET.heartE = e; } }
  if (!JUKAI_NET.heart) wwarn('no heart for the sea of trees');
  // a trail that goes nowhere is a dead end
  for (const p of pts) if (p.node && p.node.links.length === 1){ p.node.type = 'e'; JUKAI_NET.ends.push({ x: p.node.x, z: p.node.z, node: p.node, e: p.node.links[0] }); }
  if (JUKAI_NET.heart) JUKAI_NET.clear.push({ x: JUKAI_NET.heart.x, z: JUKAI_NET.heart.z, r: 34 });
  if (JUKAI_NET.edges.length < 20) wwarn('sea of trees: only ' + JUKAI_NET.edges.length + ' trails');
}
