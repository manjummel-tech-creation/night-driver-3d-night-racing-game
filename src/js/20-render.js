// =====================================================================================================
// RENDERER, SCENE, SHARED HELPERS
// =====================================================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const FOG = new THREE.Color(0x121828);
scene.background = FOG.clone();
scene.fog = new THREE.FogExp2(FOG, 0.00125);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 3200);
// environment map for car paint: dark dome with sodium strips
(() => {
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0c1020, side: THREE.BackSide })));
  const stripM = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  for (let i = 0; i < 8; i++){ const m = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 14), stripM); const a = i / 8 * TAU; m.position.set(Math.cos(a) * 18, 14, Math.sin(a) * 18); m.lookAt(0, 0, 0); envScene.add(m); }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0x2a3550 })); top.position.y = 40; top.rotation.x = Math.PI / 2; envScene.add(top);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.03).texture;
})();
const hemi = new THREE.HemisphereLight(0x8c9cc8, 0x1a1712, 0.62); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9fb4e8, 0.32); moon.position.set(-600, 900, 300); scene.add(moon);
const jpFonts = (document.fonts ? Promise.race([document.fonts.load('900 64px "Noto Sans JP"', '東海箱根河口渚北斗中央道出口'), new Promise(res => setTimeout(res, 2500))]) : Promise.resolve()).catch(() => {});
const JP = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';

function boxG(w, h, l, x, y, z){ const g = new THREE.BoxGeometry(w, h, l); g.translate(x, y, z); return g; }
function wheelG(r, w, x, z){ const g = new THREE.CylinderGeometry(r, r, w, 14); g.rotateZ(Math.PI / 2); g.translate(x, r, z); return g; }
// merge geometries (non-indexed); keeps uv and color when every part has them
function merge(geos){
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g); let n = 0; parts.forEach(g => n += g.attributes.position.count);
  const hasUV = parts.every(g => g.attributes.uv), hasC = parts.every(g => g.attributes.color);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = hasUV ? new Float32Array(n * 2) : null, col = hasC ? new Float32Array(n * 3) : null; let o = 0;
  for (const g of parts){
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (uv) uv.set(g.attributes.uv.array, o * 2); if (col) col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}
// collects transformed geometry per material, then adds one merged mesh per material
class Builder {
  constructor(){ this.map = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0){
    const g = geo.clone(); const m4 = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')); m4.setPosition(x, y, z); g.applyMatrix4(m4);
    let a = this.map.get(mat); if (!a){ a = []; this.map.set(mat, a); } a.push(g); return g;
  }
  addM(geo, mat, m4){ const g = geo.clone(); g.applyMatrix4(m4); let a = this.map.get(mat); if (!a){ a = []; this.map.set(mat, a); } a.push(g); }
  flush(parent = scene){ const out = []; for (const [mat, geos] of this.map){ // out in the world, merged into 1.2 km tiles so far-away tiles can be skipped
      const tiles = new Map(); if (parent === scene && geos.length > 1){ for (const g of geos){ g.computeBoundingSphere(); const c = g.boundingSphere.center, k = Math.floor(c.x / 1200) * 100000 + Math.floor(c.z / 1200); let a = tiles.get(k); if (!a){ a = []; tiles.set(k, a); } a.push(g); } } else tiles.set(0, geos);
      for (const gs of tiles.values()){ const m = new THREE.Mesh(merge(gs), mat); m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m); out.push(m); } } this.map.clear(); return out; }
}
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };
const flareTex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,244,220,0.7)'); gr.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });

// ---------- instances that only exist near the player: rebuilt as you move from one 320 m cell to the next
class NearPool {
  constructor(geo, mat, cap, radius = 1500, colors = false){
    this.mesh = new THREE.InstancedMesh(geo, mat, cap); this.mesh.count = 0; this.mesh.frustumCulled = false; this.cap = cap; this.r = radius;
    this.cells = new Map(); this.key = null; this.colors = colors; scene.add(this.mesh); NearPool.all.push(this);
    if (colors) this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  }
  add(m4, color){ const k = Math.floor(m4.elements[12] / 320) * 100000 + Math.floor(m4.elements[14] / 320); let a = this.cells.get(k); if (!a){ a = { m: [], c: [] }; this.cells.set(k, a); } a.m.push(...m4.elements); if (this.colors) a.c.push(color.r, color.g, color.b); }
  update(px, pz, force){
    const cx = Math.floor(px / 320), cz = Math.floor(pz / 320), key = cx * 100000 + cz; if (key === this.key && !force) return; this.key = key;
    const R = Math.ceil(this.r / 320), arr = this.mesh.instanceMatrix.array, carr = this.colors ? this.mesh.instanceColor.array : null; let n = 0;
    const list = [];
    for (let ox = -R; ox <= R; ox++) for (let oz = -R; oz <= R; oz++){ const a = this.cells.get((cx + ox) * 100000 + cz + oz); if (a) list.push([ox * ox + oz * oz, a]); }
    list.sort((p, q) => p[0] - q[0]);
    for (const [, a] of list){ const m = Math.min(a.m.length / 16, this.cap - n); if (m <= 0) break; arr.set(a.m.length === m * 16 ? a.m : a.m.slice(0, m * 16), n * 16); if (carr) carr.set(a.c.slice(0, m * 3), n * 3); n += m; }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (carr) this.mesh.instanceColor.needsUpdate = true;
  }
}
NearPool.all = [];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function m4At(x, y, z, ry, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0){ _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz); return new THREE.Matrix4().compose(_v, _q, _s); }

// =====================================================================================================
// what lies on the road surface: pads (gas stations, shops) and junction patches. Used by the rails, the
// sidewalks and the player's collision: anywhere that is "inside" one of these is drivable.
// =====================================================================================================
const PADS = []; // { e, s0, s1, dIn, dOut, y0, name, kind } in edge coordinates: s0..s1 along, lateral between dIn and dOut (dOut further from the road)
const PATCHES = []; // junction patches: { x, z, y, r, sq (half size, axis-aligned), node }
// coarse grids so "which patches / pads are near here" doesn't scan the whole list
const PG_C = 100, PATCH_GRID = new Map(), PAD_GRID = new Map(), NO_ITEMS = [];
function gridPut(map, x, z, r, o){ for (let gx = Math.floor((x - r) / PG_C); gx <= Math.floor((x + r) / PG_C); gx++) for (let gz = Math.floor((z - r) / PG_C); gz <= Math.floor((z + r) / PG_C); gz++){ const k = gx * 100000 + gz; let a = map.get(k); if (!a){ a = []; map.set(k, a); } a.push(o); } }
const patchesNear = (x, z) => PATCH_GRID.get(Math.floor(x / PG_C) * 100000 + Math.floor(z / PG_C)) || NO_ITEMS;
const padsNear = (x, z) => PAD_GRID.get(Math.floor(x / PG_C) * 100000 + Math.floor(z / PG_C)) || NO_ITEMS;
function addPatch(p){ PATCHES.push(p); gridPut(PATCH_GRID, p.x, p.z, (p.sq || p.r) + 40, p); return p; }
for (const n of NODES){
  if (n.type === 'x' && n.city && n.sq){ n.patch = addPatch({ x: n.x, z: n.z, y: n.y, sq: CLS.st.hw, node: n }); }
  else if (n.type === 'x' || n.type === 'e'){ let hw = 0; for (const e of n.links) hw = Math.max(hw, e.C.hw); n.patch = addPatch({ x: n.x, z: n.z, y: n.y, r: hw * (n.type === 'e' ? 2.6 : n.city ? 1.45 : 1.9), node: n }); }
}
// where ordinary roads meet, the junction is a paved shape reaching every road end (the convex hull of their corners),
// rather than a circle that leaves gaps beside wide streets
function hull2(P){
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = []; for (const p of P){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--){ const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up); // counter-clockwise in (x, z)
}
for (const p of PATCHES){
  const n = p.node; if (p.sq || n.type !== 'x' || n.links.length < 2 || n.links.some(e => ((e.cls === 'cw' || e.cls === 'rp') && !n.exitTerm) || e.a === e.b)) continue;
  p.trimR = p.r; let hw = 0; const pts = [];
  for (const e of n.links) hw = Math.max(hw, e.C.hw);
  // the bigger junctions are roundabouts: a raised island, a ring road round it, give-way lines on every way in
  const real = n.links.filter(e => e.cls === 'st' || e.cls === 'rd').length;
  if (n.rb){ // bigger than they were, so they're easy to drive round (a little less in town, where the buildings are close)
    const sc = n.city ? 1.15 : 1.45, ri = (hw >= 7 ? 6.5 : hw >= 4.5 ? 4.6 : 3.4) * sc, ringW = (hw >= 7 ? 8.2 : 6.6) * (n.city ? 1.1 : 1.3);
    p.rb = { ri, Ro: ri + ringW, rc: ri + ringW * (hw >= 7 ? 0.62 : 0.5), two: hw >= 7 }; p.trimAbs = p.rb.Ro - 0.4;
  }
  else if (!n.city && !n.town && n.links.every(e => e.cls === 'rd' || e.cls === 'ln' || e.cls === 'mt' || e.cls === 'dt')){ // out in the country the corners sweep round in a wide curve instead of a sharp right angle
    let t = clamp(hw * 3.2, 10, 15); // (only as wide as the roads stay level with the junction, so there's never a step onto it)
    for (const e of n.links){ const atB = e.b === n; while (t > 6 && Math.abs(edgeAt(e, clamp(atB ? e.len - t : t, 0, e.len), {}).y - n.y) > 0.15) t -= 0.5; }
    if (t > 6.5) p.trimAbs = t; }
  p.poly = junctionShape(p, n); let R = 0; for (const q of p.poly) R = Math.max(R, Math.hypot(q[0] - n.x, q[1] - n.z)); p.r = R;
  gridPut(PATCH_GRID, p.x, p.z, R + 40, p);
}
// the paved outline of a junction: each road's end, and between neighbouring roads a kerb that curves round the corner
// (or, at a roundabout, follows the ring) - never a block that fills the space between them
function junctionShape(p, n){
  const arms = [];
  for (const e of n.links){
    const atB = e.b === n, t = trimAt(e, atB), sIn = clamp(atB ? e.len - t : t, 0, e.len), sOut = clamp(atB ? e.len - t - 2 : t + 2, 0, e.len);
    const r = edgeAt(e, sIn, {}), ro = edgeAt(e, sOut, {}), u = atB ? [-r.tx, -r.tz] : [r.tx, r.tz];
    const L1 = [r.x + r.nx * r.hl, r.z + r.nz * r.hl], R1 = [r.x - r.nx * r.hr, r.z - r.nz * r.hr], L2 = [ro.x + ro.nx * ro.hl, ro.z + ro.nz * ro.hl], R2 = [ro.x - ro.nx * ro.hr, ro.z - ro.nz * ro.hr];
    const ang = Math.atan2(u[1], u[0]), lx = L1[0] - n.x, lz = L1[1] - n.z, side = u[0] * lz - u[1] * lx; // which way the road leaves, and which corner is on its anticlockwise side
    const aL = side, aR = -side;
    arms.push(aL < aR ? { ang, u, first: L1, firstOut: L2, second: R1, secondOut: R2 } : { ang, u, first: R1, firstOut: R2, second: L1, secondOut: L2 });
  }
  arms.sort((a, b) => a.ang - b.ang);
  const poly = []; p.corners = []; p.open = [];
  for (let i = 0; i < arms.length; i++){
    const A = arms[i], B = arms[(i + 1) % arms.length], P = A.second, Q = B.first;
    poly.push(A.first, A.firstOut, A.secondOut, A.second);
    const curve = [];
    if (p.rb){ // round the ring
      let a0 = Math.atan2(P[1] - n.z, P[0] - n.x), a1 = Math.atan2(Q[1] - n.z, Q[0] - n.x); while (a1 <= a0) a1 += TAU;
      const m = Math.max(2, Math.ceil((a1 - a0) / 0.14)); for (let k = 1; k < m; k++){ const a = a0 + (a1 - a0) * k / m; curve.push([n.x + Math.cos(a) * p.rb.Ro, n.z + Math.sin(a) * p.rb.Ro]); }
    } else { // a kerb that curves round the corner, where the two road edges would meet
      const d1 = [-A.u[0], -A.u[1]], d2 = [-B.u[0], -B.u[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(den) > 0.08){ const qx = Q[0] - P[0], qz = Q[1] - P[1], a = (qx * d2[1] - qz * d2[0]) / den, b = (qx * d1[1] - qz * d1[0]) / den;
        if (a > 0 && b > 0 && a < 45 && b < 45){ const X = [P[0] + d1[0] * a, P[1] + d1[1] * a]; for (let k = 1; k < 10; k++){ const t = k / 10, u = 1 - t; curve.push([u * u * P[0] + 2 * u * t * X[0] + t * t * Q[0], u * u * P[1] + 2 * u * t * X[1] + t * t * Q[1]]); } } }
    }
    for (const c of curve) poly.push(c);
    let gap = B.ang - A.ang; if (arms.length === 1 || gap <= 0) gap += TAU;
    if (curve.length) p.corners.push([P, ...curve, Q]); else if (!p.rb && gap > 2.4 && Math.hypot(Q[0] - P[0], Q[1] - P[1]) > 3) p.open.push([A.secondOut, P, Q, B.firstOut]); // the wide side of a T, where no road goes: it gets a proper edge
  }
  return poly;
}
// is (x, z) on a patch (within margin of its edge)?
function patchContains(p, x, z, m = 0){
  const dx = x - p.x, dz = z - p.z;
  if (p.sq) return Math.abs(dx) <= p.sq + m && Math.abs(dz) <= p.sq + m;
  if (dx * dx + dz * dz > (p.r + m) ** 2) return false;
  if (!p.poly) return true;
  return patchOut(p, x, z).d <= m;
}
// the furthest outside (x, z) is from any side of a polygon patch, and that side's outward normal
const _po = { d: 0, nx: 0, nz: 0 };
function patchOut(p, x, z){ // signed distance to the outline (negative inside) and the outward direction there
  const P = p.poly; let inside = false, bd = Infinity, bx = 0, bz = 0;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++){ const a = P[i], b = P[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    const ex = b[0] - a[0], ez = b[1] - a[1], L = ex * ex + ez * ez || 1, t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / L, 0, 1), px = a[0] + ex * t, pz = a[1] + ez * t, d = Math.hypot(x - px, z - pz);
    if (d < bd){ bd = d; bx = px; bz = pz; } }
  const l = bd || 1; _po.d = inside ? -bd : bd; _po.nx = (inside ? bx - x : x - bx) / l; _po.nz = (inside ? bz - z : z - bz) / l;
  return _po;
}
// gate nodes also carry the expressway: give them a round patch big enough to join both carriageways to the streets
for (const c of CITIES) for (const k in c.gate){ const n = c.gate[k].node; if (n.links.some(e => e.cls === 'cw')){ addPatch({ x: n.x, z: n.z, y: n.y, r: 15, node: n }); n.gateHw = true; } }
const _rn = [];
// is (x, z) at height y on a road surface other than `self` (or a pad / junction patch)?
const _rn2 = [];
function onOtherSurface(x, z, y, self, margin = 0.25){
  roadsNear(x, z, _rn);
  for (const q of _rn){ if (q.e === self || Math.abs(q.y - y) > 2.6 || q.along > 0.3 || q.along < -0.3) continue; if (q.d <= q.hl + margin && q.d >= -q.hr - margin) return true; }
  for (const p of patchesNear(x, z)){ if (Math.abs(p.y - y) > 2.6) continue; if (patchContains(p, x, z, margin)) return true; }
  for (const p of padsNear(x, z)) if (padContains(p, x, z, y, margin)) return true;
  return false;
}
const _pq = {};
function padContains(p, x, z, y, margin = 0){
  if (Math.abs(x - p.cx) > p.rad || Math.abs(z - p.cz) > p.rad) return false;
  const e = p.e; refineOn(e, e.i0 + clamp(Math.round(p.sm / e.ds), 0, e.n - 1), x, z, _pq);
  if (_pq.s < p.s0 - margin || _pq.s > p.s1 + margin || Math.abs(_pq.y - y) > 3) return false;
  const lo = Math.min(p.dIn, p.dOut) - margin, hi = Math.max(p.dIn, p.dOut) + margin; return _pq.d >= lo && _pq.d <= hi;
}
// the land under a pad is levelled to it
function padGround(x, z, h){
  for (const p of padsNear(x, z)){
    if (Math.abs(x - p.cx) > p.rad + 40 || Math.abs(z - p.cz) > p.rad + 40) continue;
    refineOn(p.e, p.e.i0 + clamp(Math.round(p.sm / p.e.ds), 0, p.e.n - 1), x, z, _pq);
    const lo = Math.min(p.dIn, p.dOut), hi = Math.max(p.dIn, p.dOut);
    const ds = Math.max(p.s0 - _pq.s, _pq.s - p.s1, 0), dd = Math.max(lo - _pq.d, _pq.d - hi, 0), dist = Math.hypot(ds, dd);
    if (dist < 34) h = lerp(_pq.y - 0.3, h, smooth(3, 34, dist));
  }
  return h;
}
function addPad(e, sm, len, width, side, o){ // side -1: right of the edge's +s direction
  const r = edgeAt(e, sm, {}), edge = side < 0 ? -r.hr : r.hl;
  const p = Object.assign({ e, sm, s0: sm - len / 2, s1: sm + len / 2, dIn: edge + side * 0.4, dOut: edge + side * width, side, y0: r.y, len, width,
    cx: r.x + r.nx * (edge + side * width / 2), cz: r.z + r.nz * (edge + side * width / 2), rad: Math.hypot(len / 2, width) + 10 }, o || {});
  PADS.push(p); gridPut(PAD_GRID, p.cx, p.cz, p.rad + 45, p); return p;
}

// =====================================================================================================
// LAMPS: cities, interchanges, the approaches to cities and the gas stations are lit. The open road is dark.
// =====================================================================================================
const LAMP_HEAD_MAT = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), LAMP_HEAD_ON = new THREE.Color(0xffd9a0);
const LAMPS = []; // { x, y, z, h (facing), e, s, d }
function litAt(e, x, z){
  if (e.city || e.ic || e.cls === 'rp') return true;
  for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < 380) return true;
  for (const c of CITIES) if (Math.hypot(x - c.x, z - c.z) < c.half + (e.cls === 'cw' ? 2600 : 900)) return true;
  for (const ic of ICS) if (Math.hypot(x - ic.x, z - ic.z) < 1400) return true;
  return false;
}
function placeLamps(){
  for (const e of EDGES){
    const sp = e.cls === 'st' ? 34 : e.cls === 'al' ? 28 : e.cls === 'rp' ? 42 : 50, list = [];
    for (let s = sp / 2, k = 0; s < e.len - 4; s += sp, k++){
      const r = edgeAt(e, s, {}); if (!litAt(e, r.x, r.z) && !e.nearStation?.(s)) continue;
      let side = e.cls === 'st' || e.cls === 'al' || e.cls === 'rd' ? (k % 2 ? 1 : -1) : -1; // expressways: on the outside shoulder
      const off = side > 0 ? r.hl + (e.cls === 'st' ? 1.4 : 1.1) : -(r.hr + (e.cls === 'st' ? 1.4 : 1.1));
      const px = r.x + r.nx * off, pz = r.z + r.nz * off;
      if (onOtherSurface(px, pz, r.y, e, 0.6)) continue;
      const head = side > 0 ? r.hl - 1.6 : -(r.hr - 1.6);
      const L = { x: r.x + r.nx * head, y: r.y + 9.6, z: r.z + r.nz * head, px, pz, by: r.y, h: r.h, side, e, s, d: head };
      LAMPS.push(L); list.push(L);
    }
    e.lamps = list;
  }
}

// =====================================================================================================
// ROAD SURFACES
// =====================================================================================================
function roadTexture(C){
  const W = 512, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const tmin = -(C.hw + (C.key === 'cw' ? C.LW : 0)), tmax = C.hw, m = W / (tmax - tmin), U = d => (d - tmin) * m, PPM = H / 12;
  if (C.key === 'dt'){ // packed dirt and gravel: two wheel ruts, a grassy hump down the middle, scruffy edges
    g.fillStyle = '#7a5a36'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 42000; k++){ const r = Math.random(), col = r < 0.45 ? '255,236,200' : r < 0.9 ? '0,0,0' : '120,98,70'; g.fillStyle = `rgba(${col},${Math.random() * 0.16})`; g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 3); }
    for (const d of [-1.05, 1.05]){ const x = U(d), gr = g.createLinearGradient(x - 26, 0, x + 26, 0); gr.addColorStop(0, 'rgba(30,22,14,0)'); gr.addColorStop(0.5, 'rgba(30,22,14,0.45)'); gr.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = gr; g.fillRect(x - 26, 0, 52, H); }
    for (let y = 0; y < H; y += 3){ const w = 10 + Math.random() * 14; g.fillStyle = `rgba(70,96,46,${0.25 + Math.random() * 0.35})`; g.fillRect(U(0) - w / 2, y, w, 3); }
    for (const e0 of [0, W]) for (let y = 0; y < H; y += 2){ const w = 8 + Math.random() * 30; g.fillStyle = `rgba(62,88,42,${0.3 + Math.random() * 0.4})`; g.fillRect(e0 ? W - w : 0, y, w, 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return { t, tmin, tmax };
  }
  g.fillStyle = '#34363c'; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 26000; k++){ const l = Math.random() < 0.5 ? 255 : 0; g.fillStyle = `rgba(${l},${l},${l},${Math.random() * 0.07})`; g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  const lw = 0.15 * m, line = (d, dash, col) => { g.fillStyle = col || 'rgba(240,236,224,0.92)'; if (!dash) g.fillRect(U(d) - lw / 2, 0, lw, H); else for (let y = 0; y < H; y += dash[1] * PPM) g.fillRect(U(d) - lw / 2, y, lw, dash[0] * PPM); };
  const wear = d => { const x = U(d), gr = g.createLinearGradient(x - 14, 0, x + 14, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 14, 0, 28, H); };
  const YEL = 'rgba(240,190,40,0.92)';
  if (C.oneway){
    const half = C.lanes * C.LW / 2;
    for (let i = 0; i < C.lanes; i++){ const cd = half - C.LW * (i + 0.5); wear(cd + 0.8); wear(cd - 0.8); }
    g.fillStyle = '#2b2c31'; g.fillRect(0, 0, U(-half), H); g.fillRect(U(half), 0, W - U(half), H);
    line(half - 0.12); line(-half + 0.12);
    for (let k = 1; k < C.lanes; k++) line(half - k * C.LW, [3, 12]);
    if (C.key === 'cw'){ line(-half - C.LW + 0.12); g.fillStyle = '#303237'; g.fillRect(U(-half - C.LW), 0, U(-half) - U(-half - C.LW), H); line(-half - C.LW + 0.12); for (let y = 0; y < H; y += PPM * 4) g.fillRect(U(-half) - lw, y, lw * 2, PPM * 2); }
    g.fillStyle = 'rgba(240,236,224,0.25)'; for (let y = 0; y < H; y += PPM * 0.6){ g.fillRect(U(half) + 4, y, 10, 4); g.fillRect(U(-half) - 14, y, 10, 4); }
  } else {
    const half = C.med + C.lanes * C.LW;
    for (const sd of [-1, 1]) for (let i = 0; i < C.lanes; i++){ const cd = sd * (C.med + C.LW * (i + 0.5)); wear(cd + 0.8); wear(cd - 0.8); }
    g.fillStyle = '#2b2c31'; g.fillRect(0, 0, U(-half), H); g.fillRect(U(half), 0, W - U(half), H);
    if (C.key === 'rd' || C.key === 'mt'){ line(0.12, null, YEL); line(-0.12, null, YEL); line(half - 0.12); line(-half + 0.12); }
    else if (C.key === 'ln'){ line(half - 0.25, null, 'rgba(200,200,190,0.3)'); line(-half + 0.25, null, 'rgba(200,200,190,0.3)'); }
    else if (C.key === 'rw'){ line(0, [10, 20]); line(0.3, [10, 20]); line(-0.3, [10, 20]); line(half - 0.5); line(-half + 0.5); }
    else { line(0.15, null, YEL); line(-0.15, null, YEL); for (const sd of [-1, 1]) for (let k = 1; k < C.lanes; k++) line(sd * (C.med + k * C.LW), [3, 9]); line(half - 0.2, null, 'rgba(200,200,190,0.5)'); line(-half + 0.2, null, 'rgba(200,200,190,0.5)'); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return { t, tmin, tmax };
}
const ROAD_POWER = { value: 1 }, ROAD_MATS = {};
for (const k in CLS){
  const C = CLS[k], tx = roadTexture(C);
  const mat = new THREE.MeshStandardMaterial({ map: tx.t, vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: -C.rank * 0.5, polygonOffsetUnits: -C.rank * 3 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uPower = ROAD_POWER;
    sh.vertexShader = 'attribute float mark;\nvarying float vMark;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMark = mark;');
    sh.fragmentShader = 'uniform float uPower;\nvarying float vMark;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', 'vec4 texelColor = texture2D( map, vUv ); texelColor.rgb = mix(min(texelColor.rgb, vec3(0.215)), texelColor.rgb, vMark); diffuseColor *= texelColor;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= mix(vec3(0.3, 0.33, 0.42), vColor, uPower);');
  };
  ROAD_MATS[k] = { mat, tmin: tx.tmin, tmax: tx.tmax };
}
const ASPHALT_TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#34363c'; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 3300; k++){ const l = Math.random() < 0.5 ? 255 : 0; g.fillStyle = `rgba(${l},${l},${l},${Math.random() * 0.07})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; })();
const PATCH_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, map: ASPHALT_TEX, vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: 0.5, polygonOffsetUnits: 2 });
PATCH_MAT.onBeforeCompile = sh => { sh.uniforms.uPower = ROAD_POWER; sh.fragmentShader = 'uniform float uPower;\n' + sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb *= mix(vec3(0.3, 0.33, 0.42), vColor, uPower);'); };
const VERGE_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const DECK_MAT = new THREE.MeshLambertMaterial({ color: 0x6d7076 });
const RAIL_MAT = new THREE.MeshStandardMaterial({ color: 0xaab2bc, metalness: 0.85, roughness: 0.38, side: THREE.DoubleSide });
const CURB_MAT = new THREE.MeshLambertMaterial({ color: 0x8e9096, vertexColors: true });

// light falling on the road from lamps: a soft pool under each
function lampLight(lamps, s, d){
  let I = 0; for (const L of lamps){ const ds = s - L.s; if (ds > 40 || ds < -40) continue; const dd = d - L.d; I += Math.exp(-(ds * ds + dd * dd) / 200); }
  return I;
}
const LIT_BASE = [0.42, 0.46, 0.56];
function trimAt(e, end){ // how much of this edge to leave off at a junction (the patch covers it)
  const n = end ? e.b : e.a; if (!n.patch) return 0;
  if (n.patch.trimAbs) return Math.min(n.patch.trimAbs, e.len * 0.45);
  const pr = n.patch.trimR || n.patch.r;
  if (e.cls === 'st' || e.cls === 'al') return n.patch.sq || pr * 0.9;
  if (e.cls === 'rd') return pr ? pr * 0.8 : 6;
  return 0;
}
function markFade(e, s){
  let m = 1; if (e.cls === 'dt') return 1;
  if (e.a.type === 'x' || e.a.type === 'e') m = Math.min(m, smooth(trimAt(e, false) + 2, trimAt(e, false) + 14, s));
  if (e.b.type === 'x' || e.b.type === 'e') m = Math.min(m, smooth(trimAt(e, true) + 2, trimAt(e, true) + 14, e.len - s));
  if (e.cls === 'rp') m = Math.min(m, smooth(10, 60, s), smooth(10, 60, e.len - s));
  return m;
}
const BRIDGE = []; // { x, z, y, g } bridge deck samples, for pillars
const _vgc = [0, 0, 0];
function buildRoads(){
  const b = new Builder();
  const pieces = [];
  for (const e of EDGES){
    const R = ROAD_MATS[e.cls], C = e.C, kStep = Math.max(1, Math.round(C.step / e.ds));
    const sA = trimAt(e, false), sB = e.len - trimAt(e, true); if (sB - sA < 1) continue;
    const kA = Math.ceil(sA / e.ds), kB = Math.floor(sB / e.ds);
    const ks = []; for (let k = kA; k < kB; k += kStep) ks.push(k); ks.push(kB);
    const PIECE = Math.max(4, Math.round(330 / (kStep * e.ds)));
    const fr = [-1, -0.5, 0, 0.5, 1], ncol = fr.length;
    for (let p0 = 0; p0 < ks.length - 1; p0 += PIECE){
      const rows = ks.slice(p0, Math.min(ks.length, p0 + PIECE + 1));
      const pos = [], uv = [], col = [], mark = [], idx = [];
      const vpos = [], vcol = [], vidx = [];
      const dpos = [], didx = [];
      for (const k of rows){
        const i = e.i0 + k, s = k * e.ds, x = SX[i], y = SY[i], z = SZ[i], nx = STZ[i], nz = -STX[i], hl = SHL[i], hr = SHR[i];
        const mk = markFade(e, s);
        for (const f of fr){ const off = f < 0 ? f * hr : f * hl; pos.push(x + nx * off, y, z + nz * off); uv.push((off - R.tmin) / (R.tmax - R.tmin), s / 12);
          const I = e.lamps.length ? lampLight(e.lamps, s, off) : 0; col.push(LIT_BASE[0] + 1.35 * I, LIT_BASE[1] + 0.95 * I, LIT_BASE[2] + 0.5 * I); mark.push(mk); }
        // verges / sidewalks / bridge decks
        const g = natural(x, z), clr = y - g;
        // a bridge only where it really is one: expressways and ramps, water, and a local road crossing over an expressway; everywhere else the land is built up under the road
        const bridge = clr > 2.6 && (e.cls === 'cw' || e.cls === 'rp' || e.ic || LAKES.some(L => lakeQ(L, x, z) < 1.15) || (e.overpass && OVERPASSES.some(o => o.e === e && Math.abs(o.s - s) < 70)));
        if (bridge && k % (kStep * (e.cls === 'cw' ? 4 : 6)) === 0) BRIDGE.push({ x, z, y, g, e, hl, hr, nx, nz, i });
        let vergeNear = true;
        for (const sd of [-1, 1]){
          const hw = sd > 0 ? hl : hr;
          let o1 = hw, y1 = 0, o2, y2, o3 = null, y3 = 0;
          if (e.cls === 'st'){ let cut = (e.a.gateHw && s < 16) || (e.b.gateHw && e.len - s < 16);
            if (!cut && PADS.length){ const mx = x + nx * sd * (hw + 1.6), mz = z + nz * sd * (hw + 1.6); for (const p of padsNear(mx, mz)) if (p.e === e && padContains(p, mx, mz, y, 2)){ cut = true; break; } }
            o1 = hw; y1 = cut ? 0 : 0.16; o2 = cut ? hw + 0.01 : hw + 3.2; y2 = y1; if (!cut) o3 = o2 + 5; }
          else if (bridge){ o2 = hw + 0.7; y2 = -0.02; }
          else if (e.paired && sd > 0){ o2 = hw + Math.max(0.01, SOF[i] - hw + 0.02); y2 = -0.04; }
          else { o2 = hw + 1.1; y2 = -0.1; o3 = hw + 8;
            // no verge over a gas station, shop or lay-by: their forecourt starts right at the road edge
            for (const w of [1, 4, 8]){ const mx = x + nx * sd * (hw + w), mz = z + nz * sd * (hw + w); if (padsNear(mx, mz).some(p => padContains(p, mx, mz, y, 4))){ o2 = hw + 0.01; y2 = -0.02; o3 = null; break; } }
            // and never over another road, a junction or a forecourt beside this one: the grass stops short of it
            if (o3 !== null && sd === -1) vergeNear = roadsNear(x, z, _rn2).some(q => q.e !== e && q.dist < q.hl + q.hr + 22) || patchesNear(x, z).length > 0 || padsNear(x, z).length > 0;
            if (o3 !== null && vergeNear){ let last = 0; for (const w of [1.1, 2.5, 4, 6, 8]){ const mx = x + nx * sd * (hw + w), mz = z + nz * sd * (hw + w); if (onOtherSurface(mx, mz, y, e, 0.6)){ if (last === 0){ o2 = hw + 0.01; y2 = -0.02; o3 = null; } else o3 = hw + last; break; } last = w; } } }
          if (o3 === null){ o3 = o2; y3 = y + y2; } // bridges and the median: no skirt
          else { const gx = x + nx * sd * o3, gz = z + nz * sd * o3; y3 = clamp(natural(gx, gz) - 0.3, y - 7, y + 1.5); }
          vpos.push(x + nx * sd * o1, y + (e.cls === 'st' ? 0 : -0.02), z + nz * sd * o1, x + nx * sd * o1, y + y1, z + nz * sd * o1, x + nx * sd * o2, y + y2, z + nz * sd * o2, x + nx * sd * o3, y3, z + nz * sd * o3);
          const sh = e.cls === 'st' ? 0.62 * 0.56 : 0.09 * (0.9 + 0.2 * hash2(k, sd + 7)), I = e.cls === 'st' && e.lamps.length ? lampLight(e.lamps, s, sd * (hw + 1.5)) * 0.5 : 0;
          groundColor(x + nx * sd * o3, z + nz * sd * o3, y3, _vgc); const gl = 1 + (e.lamps.length ? lampLight(e.lamps, s, sd * (hw + 3)) * 0.6 : 0);
          for (let q = 0; q < 4; q++){
            if (q === 3 || (q === 2 && e.cls !== 'st' && !bridge && !(e.paired && sd > 0))) vcol.push(_vgc[0] * gl, _vgc[1] * gl, _vgc[2] * gl); // grass
            else if (e.cls === 'st') vcol.push(sh * (0.65 + I), sh * (0.66 + I * 0.8), sh * (0.68 + I * 0.5)); else vcol.push(sh, sh * 1.1, sh * 0.95); }
        }
        if (bridge){ // underside of the deck and its fascia
          for (const off of [-hr - 0.5, hl + 0.5]) dpos.push(x + nx * off, y - 0.05, z + nz * off, x + nx * off, y - 1.15, z + nz * off);
        } else for (let q = 0; q < 4; q++) dpos.push(x, -9999, z);
      }
      const nr = rows.length;
      for (let r = 0; r < nr - 1; r++) for (let c2 = 0; c2 < ncol - 1; c2++){ const a = r * ncol + c2, b2 = a + 1, d = a + ncol, f = d + 1; idx.push(a, d, b2, b2, d, f); }
      for (let r = 0; r < nr - 1; r++) for (let sdI = 0; sdI < 2; sdI++) for (let q = 0; q < 3; q++){
        const a = r * 8 + sdI * 4 + q, b2 = a + 1, d = a + 8, f = d + 1; if (sdI === 0) vidx.push(a, b2, d, b2, f, d); else vidx.push(a, d, b2, b2, d, f); }
      for (let r = 0; r < nr - 1; r++){
        if (dpos[r * 12 + 1] < -9000 || dpos[(r + 1) * 12 + 1] < -9000) continue;
        const a = r * 4, n2 = a + 4; // 0,1 = right edge top/bottom, 2,3 = left edge top/bottom
        didx.push(a + 1, n2 + 1, a + 3, a + 3, n2 + 1, n2 + 3); // underside
        didx.push(a, n2, a + 1, a + 1, n2, n2 + 1); didx.push(a + 2, a + 3, n2 + 2, a + 3, n2 + 3, n2 + 2); // fascias
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gg.setAttribute('mark', new THREE.Float32BufferAttribute(mark, 1));
      gg.setIndex(idx); gg.computeVertexNormals();
      const mesh = new THREE.Mesh(gg, R.mat); mesh.matrixAutoUpdate = false; scene.add(mesh); pieces.push(mesh);
      const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(vpos, 3)); vg.setAttribute('color', new THREE.Float32BufferAttribute(vcol, 3)); vg.setIndex(vidx); vg.computeVertexNormals();
      const vm = new THREE.Mesh(vg, VERGE_MAT); vm.matrixAutoUpdate = false; scene.add(vm);
      if (didx.length){ const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3)); dg.setIndex(didx); dg.computeVertexNormals(); const dm = new THREE.Mesh(dg, DECK_MAT); dm.material.side = THREE.DoubleSide; dm.matrixAutoUpdate = false; scene.add(dm); }
    }
  }
  // junction patches, merged into one mesh per 1.6 km square
  const patchCells = new Map();
  for (const p of PATCHES){
    let geo;
    if (p.sq){ geo = new THREE.PlaneGeometry(p.sq * 2 + 0.02, p.sq * 2 + 0.02); geo.rotateX(-Math.PI / 2); }
    else { // a fan of rings out from the centre, so lamp light falls across it the same way it does on the roads
      const B = p.poly ? p.poly.map(q => [q[0] - p.x, q[1] - p.z]) : Array.from({ length: 28 }, (_, k) => [Math.cos(k / 28 * TAU) * p.r, Math.sin(k / 28 * TAU) * p.r]);
      const RINGS = 4, pos = [0, 0, 0], idx = [], m = B.length;
      for (let r = 1; r <= RINGS; r++) for (const q of B) pos.push(q[0] * r / RINGS, 0, q[1] * r / RINGS);
      for (let j = 0; j < m; j++){ const j2 = (j + 1) % m; idx.push(0, 1 + j2, 1 + j);
        for (let r = 1; r < RINGS; r++){ const a0 = 1 + (r - 1) * m, a1 = 1 + r * m; idx.push(a0 + j, a0 + j2, a1 + j, a0 + j2, a1 + j2, a1 + j); } }
      geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      if (geo.attributes.normal.getY(0) < 0){ idx.reverse(); geo.setIndex(idx); geo.computeVertexNormals(); } }
    geo.translate(p.x, p.y + 0.003, p.z);
    const n = geo.attributes.position.count, cc = new Float32Array(n * 3), ps0 = geo.attributes.position, near = LAMPS.filter(L => Math.abs(L.x - p.x) < (p.r || p.sq) + 45 && Math.abs(L.z - p.z) < (p.r || p.sq) + 45);
    for (let i = 0; i < n; i++){ let I = 0; for (const L of near){ const dx = ps0.getX(i) - L.x, dz = ps0.getZ(i) - L.z; I += Math.exp(-(dx * dx + dz * dz) / 200); } // lit exactly like the road surface
      cc[i * 3] = LIT_BASE[0] + 1.35 * I; cc[i * 3 + 1] = LIT_BASE[1] + 0.95 * I; cc[i * 3 + 2] = LIT_BASE[2] + 0.5 * I; }
    geo.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    { const ps = geo.attributes.position, uv = new Float32Array(n * 2); for (let i = 0; i < n; i++){ uv[i * 2] = ps.getX(i) / 12; uv[i * 2 + 1] = ps.getZ(i) / 12; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    if (!p.sq && p.node.type === 'x') junctionDressing(p, b); else if (p.sq) zebraCrossings(p, b);
    const ck = Math.floor(p.x / 1600) * 100000 + Math.floor(p.z / 1600); let pa = patchCells.get(ck); if (!pa) patchCells.set(ck, pa = []); pa.push(geo);
    if (p.sq && p.node.city.grid){ // sidewalk corners where two streets meet
      const n2 = p.node, g = c => n2.city.grid[n2.gi + c[0]] && n2.city.grid[n2.gi + c[0]][n2.gj + c[1]];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (g([sx, 0]) && g([0, sz])) b.add(new THREE.BoxGeometry(3.2, 0.16, 3.2), CURB_MAT_PLAIN, p.x + sx * (p.sq + 1.6), p.y + 0.08, p.z + sz * (p.sq + 1.6));
    }
  }
  for (const geos of patchCells.values()){ const m = new THREE.Mesh(merge(geos), PATCH_MAT); m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); }
  b.flush();
  return pieces;
}
const CURB_MAT_PLAIN = new THREE.MeshLambertMaterial({ color: 0x585a60 });
// paint and islands at junctions
const ISLANDS = [];
const PAINT_MAT = new THREE.MeshLambertMaterial({ color: 0xe9e5d8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
const ISLAND_CURB = new THREE.MeshLambertMaterial({ color: 0xb4b2aa }), ISLAND_GRASS = new THREE.MeshLambertMaterial({ color: 0x2f4a26 }), ISLAND_FLOWER = new THREE.MeshLambertMaterial({ color: 0x7a3554 });
function dash(b, x, z, y, h, len, wid){ b.add(new THREE.BoxGeometry(wid, 0.02, len), PAINT_MAT, x, y + 0.02, z, h); }
const APRON_MAT = new THREE.MeshLambertMaterial({ color: 0x8a3a30, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }), WALK_MAT = new THREE.MeshLambertMaterial({ color: 0x77797f });
// zebra crossings and a stop line on each city street coming into a junction
function zebraCrossings(p, b){
  const n = p.node;
  for (const e of n.links){ if (e.cls !== 'st') continue; const atB = e.b === n, t = trimAt(e, atB);
    if (t + 9 > e.len * 0.45) continue;
    const r = edgeAt(e, atB ? e.len - t - 2.6 : t + 2.6, {}), W = r.hl + r.hr - 1.2;
    for (let d = -r.hr + 0.9; d < r.hl - 0.6; d += 1.15){ b.add(new THREE.BoxGeometry(0.6, 0.02, 3.2), PAINT_MAT, r.x + r.nx * d, r.y + 0.02, r.z + r.nz * d, r.h); }
    const rs = edgeAt(e, atB ? e.len - t - 5.2 : t + 5.2, {}), d0 = atB ? -rs.hr + 0.3 : 0.2, d1 = atB ? -0.2 : rs.hl - 0.3;
    b.add(new THREE.BoxGeometry(d1 - d0, 0.02, 0.4), PAINT_MAT, rs.x + rs.nx * (d0 + d1) / 2, rs.y + 0.02, rs.z + rs.nz * (d0 + d1) / 2, rs.h + Math.PI / 2);
  }
}
// a raised pavement round each curved kerb in town, joining up the pavements of the two streets
function kerbCorners(p, b){
  for (const C of p.corners || []){ const pos = [], idx = []; let v = 0;
    for (let i = 0; i < C.length; i++){ const a = C[Math.max(0, i - 1)], c = C[Math.min(C.length - 1, i + 1)], tx = c[0] - a[0], tz = c[1] - a[1], l = Math.hypot(tx, tz) || 1;
      let nx = tz / l, nz = -tx / l; const mx = C[i][0] - p.x, mz = C[i][1] - p.z; if (nx * mx + nz * mz < 0){ nx = -nx; nz = -nz; } // outward, away from the junction
      const y = p.y + 0.16; pos.push(C[i][0], y, C[i][1], C[i][0] + nx * 3.2, y, C[i][1] + nz * 3.2, C[i][0], p.y, C[i][1]);
      if (i){ const a0 = v - 3, a1 = v; idx.push(a0, a1, a0 + 1, a0 + 1, a1, a1 + 1, a0 + 2, a1 + 2, a0, a0, a1 + 2, a1); } v += 3; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); b.add(g, WALK_MAT); }
}
const BANK_MAT = new THREE.MeshLambertMaterial({ color: 0x18221a, side: THREE.DoubleSide });
function openSides(p, b){
  const n = p.node, y = p.y;
  for (const side of p.open){
    for (let i = 0; i < side.length - 1; i++){
      const P = side[i], Q = side[i + 1], dx = Q[0] - P[0], dz = Q[1] - P[1], L = Math.hypot(dx, dz); if (L < 0.5) continue;
      const h = Math.atan2(dx, dz), mx = (P[0] + Q[0]) / 2, mz = (P[1] + Q[1]) / 2;
      let ox = dz / L, oz = -dx / L; if (ox * (mx - n.x) + oz * (mz - n.z) < 0){ ox = -ox; oz = -oz; } // outward, away from the junction
      b.add(new THREE.BoxGeometry(0.15, 0.02, L), PAINT_MAT, mx - ox * 0.45, y + 0.02, mz - oz * 0.45, h); // the edge line
      if (n.city){ b.add(new THREE.BoxGeometry(3.2, 0.16, L + 0.2), WALK_MAT, mx + ox * 1.6, y + 0.08, mz + oz * 1.6, h); continue; } // town: the pavement carries on round
      // country: a guard rail along the edge, and a grass bank falling away behind it
      b.add(new THREE.BoxGeometry(0.06, 0.38, L + 0.1), RAIL_MAT, mx + ox * 0.35, y + 0.67, mz + oz * 0.35, h);
      for (let t = 0; t <= L; t += 2){ const px = P[0] + dx * t / L + ox * 0.47, pz = P[1] + dz * t / L + oz * 0.47; POSTS.add(m4At(px, y, pz, h)); }
      addStatic(mx + ox * 0.5, mz + oz * 0.5, y, h, 0.25, L / 2, 1.2);
      const gx = mx + ox * 6, gz = mz + oz * 6, gy = Math.min(y - 0.3, natural(gx, gz)), pos = [P[0] + ox * 0.6, y - 0.05, P[1] + oz * 0.6, Q[0] + ox * 0.6, y - 0.05, Q[1] + oz * 0.6, Q[0] + ox * 6, gy, Q[1] + oz * 6, P[0] + ox * 6, gy, P[1] + oz * 6];
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); b.add(g, BANK_MAT);
    }
  }
}
function junctionDressing(p, b){
  const n = p.node, y = p.y;
  if (p.open && p.open.length) openSides(p, b);
  if (n.city){ zebraCrossings(p, b); if (!p.rb) kerbCorners(p, b); }
  // give-way dashes across the lanes coming in (all of them at a roundabout; only the side roads at a plain junction)
  const major = n.links.filter(e => e.cls === 'st' || e.cls === 'rd').length;
  for (const e of n.links){
    if (!p.rb && (major < 2 || e.cls === 'st' || e.cls === 'rd')) continue;
    const atB = e.b === n, t = trimAt(e, atB) + 0.5; if (t > e.len * 0.45) continue;
    const r = edgeAt(e, atB ? e.len - t : t, {}), d0 = atB ? -r.hr + 0.4 : 0.3, d1 = atB ? -0.3 : r.hl - 0.4;
    for (let d = d0; d < d1; d += 1.1){ const dm = d + 0.3; dash(b, r.x + r.nx * dm, r.z + r.nz * dm, r.y, r.h + Math.PI / 2, 0.6, 0.35); }
  }
  if (!p.rb) return;
  const { ri, Ro, rc, two } = p.rb;
  // the island: a kerb, grass, and something in the middle
  b.add(new THREE.CylinderGeometry(ri, ri + 0.15, 0.32, 40), ISLAND_CURB, n.x, y + 0.16, n.z);
  b.add(new THREE.CylinderGeometry(ri - 0.35, ri - 0.35, 0.06, 40), ISLAND_GRASS, n.x, y + 0.34, n.z);
  if (n.city){ b.add(new THREE.CylinderGeometry(ri * 0.55, ri * 0.55, 0.1, 24), ISLAND_FLOWER, n.x, y + 0.4, n.z); b.add(new THREE.CylinderGeometry(0.35, 0.5, 4.5, 8), ISLAND_CURB, n.x, y + 2.6, n.z); b.add(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }), n.x, y + 5.1, n.z); }
  else { b.add(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6), new THREE.MeshLambertMaterial({ color: 0x4a3527 }), n.x, y + 1.5, n.z); b.add(new THREE.IcosahedronGeometry(Math.min(2.4, ri * 0.6), 0), ISLAND_GRASS, n.x, y + 3.6, n.z); }
  ISLANDS.push({ x: n.x, z: n.z, y, r: ri - 0.15 }); // a round kerb you bump off, a little inside the painted edge
  // a red apron round the island (lorries run over it), and a raised splitter island on every road coming in
  { const g = new THREE.RingGeometry(ri, ri + 1.7, 48, 1); g.rotateX(-Math.PI / 2); b.add(g, APRON_MAT, n.x, y + 0.04, n.z); }
  for (const e of n.links){ const atB = e.b === n, t = trimAt(e, atB); if (t + 14 > e.len * 0.5 || e.oneway || e.cls === 'rp') continue;
    const pts = []; for (let k = 0; k <= 6; k++){ const sAlong = t - 1 + k * 2.4, r = edgeAt(e, atB ? e.len - sAlong : sAlong, {}), w = lerp(1.3, 0.25, k / 6); pts.push([r.x + r.nx * w, r.z + r.nz * w, r.y], [r.x - r.nx * w, r.z - r.nz * w, r.y]); }
    const pos = [], idx = []; for (let k = 0; k < pts.length; k++) pos.push(pts[k][0], pts[k][2] + 0.14, pts[k][1]);
    for (let k = 0; k < 6; k++){ const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); b.add(g, ISLAND_CURB); }
  // paint: a solid line round the island, a dashed line between the two ring lanes in town, dashes round the outside
  const ring = (rad, w, segs, dashed) => { for (let k = 0; k < segs; k++){ if (dashed && k % 2) continue; const a0 = k / segs * TAU, a1 = (k + 1) / segs * TAU;
    const g = new THREE.RingGeometry(rad - w / 2, rad + w / 2, 2, 1, a0, a1 - a0); g.rotateX(-Math.PI / 2); b.add(g, PAINT_MAT, n.x, y + 0.02, n.z); } };
  ring(ri + 1.85, 0.15, 48, false);
  if (two) ring(ri + 1.7 + (Ro - ri - 1.7) / 2, 0.13, 56, true);
}

// ---------- guard rails: a steel beam on posts along every expressway, ramp and country road; open wherever another road joins
const POSTS = new NearPool(new THREE.BoxGeometry(0.12, 0.85, 0.12).translate(0, 0.42, 0), new THREE.MeshLambertMaterial({ color: 0x6b727c }), 9000, 900);
const REFL = new NearPool(new THREE.BoxGeometry(0.06, 0.1, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }), 2400, 900, true);
const C_WHITE = new THREE.Color(0xffffff), C_AMBER = new THREE.Color(0xffa030);
function buildRails(){
  const rpos = [], ridx = []; let v = 0;
  const flush = () => { if (!ridx.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3)); g.setIndex(ridx); g.computeVertexNormals(); const m = new THREE.Mesh(g, RAIL_MAT); m.matrixAutoUpdate = false; scene.add(m); rpos.length = 0; ridx.length = 0; v = 0; };
  const nearEnd = (e, s) => { const ra = e.cls === 'cw' && !e.ic ? 520 : 140; return s < ra || s > e.len - ra; };
  // guard rails along every expressway, ramp, country road and mountain road, and on every bridge whatever the road;
  // open where another road joins, at forecourts and at junctions. Where there's a rail, you can't drive off (e.rail)
  for (const e of EDGES){
    const railed = e.C.rail && !e.city && !e.jukai;
    if (!railed && e.cls === 'rw') continue;
    const kStep = Math.max(1, Math.round(4 / e.ds));
    e.rail = [new Uint8Array(e.n), new Uint8Array(e.n)];
    for (const sd of [-1, 1]){
      let prev = false, cnt = 0;
      for (let k = 0; k < e.n; k += kStep){
        const i = e.i0 + k, s = k * e.ds, hw = sd > 0 ? SHL[i] : SHR[i], off = sd * (hw + 0.35), x = SX[i] + STZ[i] * off, z = SZ[i] - STX[i] * off, y = SY[i];
        let open = false;
        if (!railed && y - natural(x + STZ[i] * sd * 4, z - STX[i] * sd * 4) < 3) open = true; // lanes, streets and tracks: only where they're up on a bridge
        if (!open && (nearEnd(e, s) || e.ic || e.cls === 'rp' || e.exitNo)) open = onOtherSurface(x, z, y, e, 0.4);
        if (!open && PADS.length){ for (const p of padsNear(x, z)) if (padContains(p, x, z, y, 1.2)){ open = true; break; } }
        if (open){ prev = false; continue; }
        e.rail[sd > 0 ? 1 : 0].fill(1, Math.max(0, k - kStep + 1), Math.min(e.n, k + kStep));
        rpos.push(x, y + 0.48, z, x, y + 0.86, z);
        if (prev) ridx.push(v - 2, v, v - 1, v - 1, v, v + 1);
        v += 2; prev = true;
        if ((cnt++ & 1) === 0) POSTS.add(m4At(SX[i] + STZ[i] * (off + sd * 0.12), y, SZ[i] - STX[i] * (off + sd * 0.12), Math.atan2(STX[i], STZ[i])));
        if (cnt % 6 === 0) REFL.add(m4At(SX[i] + STZ[i] * (off - sd * 0.06), y + 0.67, SZ[i] - STX[i] * (off - sd * 0.06), 0), sd > 0 ? C_AMBER : C_WHITE);
        if (v > 60000) { flush(); prev = false; }
      }
      prev = false;
    }
  }
  // (Hakone's hillside streets used to have rails too: gone, you can drive off anywhere)
  for (const e of EDGES){
    if (true || !e.city || e.city.style !== 'mountain' || (e.cls !== 'st' && e.cls !== 'al')) continue;
    const kStep = Math.max(1, Math.round(3 / e.ds)), side0 = e.cls === 'st' ? 3.2 : 0;
    for (const sd of [-1, 1]){
      let prev = false, cnt = 0;
      for (let k = 0; k < e.n; k += kStep){
        const i = e.i0 + k, hw = (sd > 0 ? SHL[i] : SHR[i]) + side0, off = sd * (hw + 0.35), x = SX[i] + STZ[i] * off, z = SZ[i] - STX[i] * off, y = SY[i] + (e.cls === 'st' ? 0.16 : 0);
        const ox = SX[i] + STZ[i] * sd * (hw + 5), oz = SZ[i] - STX[i] * sd * (hw + 5), drop = y - natural(ox, oz);
        let open = drop < 1.0 || onOtherSurface(x, z, y, e, 1.2) || patchesNear(x, z).some(p => patchContains(p, x, z, 2.5));
        if (!open) for (const p of padsNear(x, z)) if (padContains(p, x, z, y, 1.2)){ open = true; break; }
        if (open){ prev = false; continue; }
        rpos.push(x, y + 0.48, z, x, y + 0.86, z);
        if (prev) ridx.push(v - 2, v, v - 1, v - 1, v, v + 1);
        v += 2; prev = true;
        if ((cnt++ & 1) === 0) POSTS.add(m4At(SX[i] + STZ[i] * (off + sd * 0.12), y, SZ[i] - STX[i] * (off + sd * 0.12), Math.atan2(STX[i], STZ[i])));
        if (cnt % 6 === 0) REFL.add(m4At(SX[i] + STZ[i] * (off - sd * 0.06), y + 0.67, SZ[i] - STX[i] * (off - sd * 0.06), 0), sd > 0 ? C_AMBER : C_WHITE);
      }
    }
  }
  flush();
}

// ---------- bridge pillars
const PILLARS = new NearPool(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x7a7d84 }), 1800, 2400);
function buildPillars(){
  const under = [];
  for (const B of BRIDGE){
    const h = B.y - 1.1 - (B.g - 2); if (h < 1) continue;
    roadsNear(B.x, B.z, under); let onRoad = false;
    for (const q of under){ if (q.e === B.e || q.y > B.y - 2.5 || Math.abs(q.along) > 2) continue; if (q.d < q.hl + 2.5 && q.d > -q.hr - 2.5){ onRoad = true; break; } }
    for (const p of patchesNear(B.x, B.z)) if (p.y < B.y - 2.5 && Math.hypot(B.x - p.x, B.z - p.z) < (p.sq || p.r) + 3) onRoad = true;
    if (onRoad) continue;
    const w = B.e.cls === 'cw' ? 2.2 : 1.6;
    // over water the pillars stand in the lake
    PILLARS.add(m4At(B.x, B.g - 2, B.z, Math.atan2(STX[B.i], STZ[B.i]), w, h, w * 1.6));
    if (B.e.cls === 'cw'){ /* a crossbeam under the deck */ PILLARS.add(m4At(B.x, B.y - 1.6, B.z, Math.atan2(STX[B.i], STZ[B.i]), B.hl + B.hr, 0.6, 1.4)); }
  }
}

// ---------- street lamps (instanced near you), plus moving point lights borrowed by the closest few
const LAMP_POLE = new NearPool(new THREE.CylinderGeometry(0.09, 0.14, 10, 8).translate(0, 5, 0), new THREE.MeshLambertMaterial({ color: 0x4a505a }), 3000, 2000);
const LAMP_ARM = new NearPool(new THREE.BoxGeometry(0.12, 0.1, 3.0).translate(0, 9.9, 1.4), new THREE.MeshLambertMaterial({ color: 0x4a505a }), 3000, 2000);
const LAMP_HEAD = new NearPool(new THREE.BoxGeometry(0.42, 0.16, 0.9).translate(0, 9.75, 2.8), LAMP_HEAD_MAT, 3000, 2600);
const lampGrid = new Map();
function buildLamps(){
  for (const L of LAMPS){
    const ry = Math.atan2(L.x - L.px, L.z - L.pz); // the arm reaches out over the road
    const m = m4At(L.px, L.by, L.pz, ry); LAMP_POLE.add(m); LAMP_ARM.add(m); LAMP_HEAD.add(m);
    const k = Math.floor(L.x / 100) * 100000 + Math.floor(L.z / 100); let a = lampGrid.get(k); if (!a){ a = []; lampGrid.set(k, a); } a.push(L);
  }
}
function lampsNear(x, z, out){ out.length = 0; const cx = Math.floor(x / 100), cz = Math.floor(z / 100); for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++){ const a = lampGrid.get((cx + ox) * 100000 + cz + oz); if (a) for (const L of a) out.push(L); } return out; }
