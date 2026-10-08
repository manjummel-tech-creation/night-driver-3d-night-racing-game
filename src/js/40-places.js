// =====================================================================================================
// PLACES: what each city and town sells, gas stations, skylines, towns, signs, farms
// =====================================================================================================
const UPG = [ // levels 0..3; price of the next level is base[level] x the place's price factor
  { id: 'engine', name: 'ENGINE', desc: 'More power at every rpm', base: [2600, 6800, 15000] },
  { id: 'turbo', name: 'TURBO & AERO', desc: 'Less drag, higher top speed', base: [2400, 6200, 14000] },
  { id: 'tyres', name: 'TYRES', desc: 'More grip in corners and in the wet', base: [2000, 5200, 12000] },
  { id: 'brakes', name: 'BRAKES', desc: 'Stop shorter', base: [1500, 4000, 9000] },
  { id: 'nitro', name: 'NITRO', desc: 'A bigger bottle and a harder push', base: [2200, 5600, 12500] },
  { id: 'armor', name: 'ARMOR', desc: 'Crashes and scrapes do less damage', base: [1800, 4800, 10500] },
  { id: 'tank', name: 'FUEL TANK', desc: 'Drive further between fill-ups', base: [1600, 4200, 9000] },
];
// the cities are easy to reach and sell the basics; the further a town is off the beaten track, the better its stock
const CITY_INFO = {
  tokai: { tag: 'The capital. Glass towers, neon, and police everywhere.', price: 1.35, max: { engine: 2, turbo: 2, tyres: 2, brakes: 2, nitro: 2, armor: 2, tank: 1 }, off: {},
    pros: ['Sells every part, up to level 2', 'Near misses in the city pay 1.5x'], cons: ['Everything costs 35% more', 'Heavy traffic', 'The most police on the map'], cops: 4, special: [] },
  hakone: { tag: 'A hillside onsen town in the southern peaks. Tuners who live for corners.', price: 1, max: { engine: 0, turbo: 1, tyres: 2, brakes: 2, nitro: 1, armor: 1, tank: 1 }, off: { tyres: 0.7, brakes: 0.7 },
    pros: ['Tyres and brakes 30% off', 'Steep streets and alleys to learn'], cons: ['No engine parts at all', 'Fog rolls in twice as often in the mountains'], cops: 1, special: [] },
  kawaguchi: { tag: 'A lakeside resort in the west. Somewhere to lie low.', price: 1, max: { engine: 1, turbo: 1, tyres: 1, brakes: 1, nitro: 2, armor: 2, tank: 2 }, off: { nitro: 0.75, armor: 0.75 },
    pros: ['Nitro and armor 25% off', 'Level 2 fuel tanks'], cons: ['Everything else stops at level 1', 'Speed limit 60 in town'], cops: 1, special: [] },
  nagisa: { tag: 'A rough port city on the east coast. Fast cars, fast money, angry cops.', price: 1, max: { engine: 2, turbo: 2, tyres: 1, brakes: 1, nitro: 1, armor: 1, tank: 1 }, off: { engine: 0.75, turbo: 0.75 },
    pros: ['Engines and turbos 25% off'], cons: ['The most aggressive police: they see you from further', 'Lots of heavy trucks on the roads around it'], cops: 3, special: [] },
  hokuto: { tag: 'A farm town in the far north. Cheap, slow and friendly.', price: 0.8, max: { engine: 1, turbo: 1, tyres: 1, brakes: 1, nitro: 1, armor: 1, tank: 2 }, off: {},
    pros: ['Everything 20% cheaper', 'Fuel at half price', 'Very few police'], cons: ['Only level 1 parts (level 2 fuel tank)', 'Long, empty roads to anywhere'], cops: 1, special: ['fuelCheap'] },
};
for (const c of CITIES) c.info = CITY_INFO[c.id];
const TOWNS = [];

// ---------- static obstacles (pumps, buildings, parked trucks): oriented boxes the player can hit
const STATIC = []; const staticGrid = new Map();
function addStatic(x, z, y, h, hw, hl, ht = 3){
  const o = { x, z, y, h, hw, hl, ht }; STATIC.push(o);
  const r = Math.hypot(hw, hl), x0 = Math.floor((x - r) / 50), x1 = Math.floor((x + r) / 50), z0 = Math.floor((z - r) / 50), z1 = Math.floor((z + r) / 50);
  for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++){ const k = gx * 100000 + gz; let a = staticGrid.get(k); if (!a){ a = []; staticGrid.set(k, a); } a.push(o); }
}
function staticNear(x, z){ return staticGrid.get(Math.floor(x / 50) * 100000 + Math.floor(z / 50)) || []; }

// ---------- materials shared by places
const LM = c => new THREE.MeshLambertMaterial({ color: c }), BM = c => new THREE.MeshBasicMaterial({ color: c });
const MAT = { white: LM(0xeeeeea), concrete: LM(0x8e9096), dark: LM(0x2a2c30), red: LM(0xc9262b), yellow: LM(0xf2c21a), steel: new THREE.MeshStandardMaterial({ color: 0xaab2bc, metalness: 0.85, roughness: 0.38 }),
  glow: BM(0xfff4dc), green: BM(0x2fd27a), pad: new THREE.MeshLambertMaterial({ color: 0x55575c, polygonOffset: true, polygonOffsetFactor: -0.2, polygonOffsetUnits: -1 }), lot: new THREE.MeshLambertMaterial({ color: 0x3d3f44, polygonOffset: true, polygonOffsetFactor: -0.2, polygonOffsetUnits: -1 }),
  asphalt: new THREE.MeshLambertMaterial({ color: 0x2e3035, polygonOffset: true, polygonOffsetFactor: -0.4, polygonOffsetUnits: -2 }), jersey: LM(0xb9bbbe),
  tile: LM(0x34373d), redTile: LM(0x6e2a22), tin: LM(0x46606e), lantern: BM(0xff7a3a), torii: LM(0xc0281e), wood: LM(0x4a3527), crane: LM(0xd8a21c) };
const WIN_MAT = new THREE.MeshBasicMaterial({ color: 0xffd69a }), WIN_ON = new THREE.Color(0xffd69a), WIN_OFF = new THREE.Color(0x2e333c);
const BAY_MAT = new THREE.MeshBasicMaterial({ color: 0x3dff8e, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
const BAY_EDGE = new THREE.MeshBasicMaterial({ color: 0x5dffa0 });
const textTex = (w, h, draw) => canvasTex(w, h, draw);

// a frame along an edge: place things by (a = metres along, w = metres sideways, + is left)
function frameAt(e, s){ const r = edgeAt(e, s, {}); return { e, s, r, at(a, w, out = {}){ const q = edgeAt(e, s + a, {}); out.x = q.x + q.nx * w; out.z = q.z + q.nz * w; out.y = q.y; out.h = q.h; return out; } }; }

// ---------- pad surfaces: a ribbon that follows the road
function padSurface(p, mat){
  const pos = [], idx = []; let v = 0;
  for (let s = p.s0; s <= p.s1 + 0.01; s += 3){
    const q = edgeAt(p.e, Math.min(s, p.s1), {});
    for (const d of [p.dIn, p.dOut]) pos.push(q.x + q.nx * d, q.y + 0.02, q.z + q.nz * d);
    if (v > 0) idx.push(v - 2, v, v - 1, v - 1, v, v + 1); v += 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (g.attributes.normal.array[1] < 0) { const n = g.attributes.normal.array; for (let i = 0; i < n.length; i++) n[i] = -n[i]; const ix = g.index.array; for (let i = 0; i < ix.length; i += 3){ const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } }
  const m = new THREE.Mesh(g, mat); m.material.side = THREE.DoubleSide; m.matrixAutoUpdate = false; scene.add(m);
}

// =====================================================================================================
// GAS STATIONS: fuel, repairs, nitro. In pairs, one on each side of the road at about the same point.
// On the expressways each has its own slip lane: it opens beside the carriageway, runs past the station behind
// a barrier with a way in at the start and a way out at the end, then merges back.
// =====================================================================================================
const STATIONS = []; // { pad, name, kind: 'gas' | 'shop', place, bay: {a, w0, w1, len}, spawn, side }
const STATION_LIGHT = new THREE.PointLight(0xfff0dc, 2.2, 60, 1.4); scene.add(STATION_LIGHT);
const BRANDS = ['NIGHT FUEL', 'ENEOS-ish', 'MOON OIL', 'KITSUNE GAS', 'ROUTE 24'];
const stLen = st => st.small ? 80 : 110, stWid = st => st.small ? 24 : 30;
const STATION_LIGHT_POS = [];
function placeStations(){
  const taken = [];
  const free = (x, z, r) => !taken.some(([a, b]) => Math.hypot(a - x, b - z) < r);
  const ok = (e, s, span = 80) => { const r = edgeAt(e, s, {}); flatAt(r.x, r.z); if (FK > 0.05) return false; for (let a = -span; a <= span; a += 10){ const q = edgeAt(e, s + a, {}); if (q.y - natural(q.x, q.z) > 2.5) return false; if (Math.abs(q.slope) > 0.035) return false; if (q.hr > e.C.hw + 0.5) return false; } return free(r.x, r.z, 2600); };
  const pairUp = (st, brand) => { // the matching station across the road
    const e = st.e;
    if (e.pair){ const r = edgeAt(e, st.sm, {}), q = refineOn(e.pair, e.pair.i0 + clamp(Math.round((e.pair.len - st.sm) / e.pair.ds), 0, e.pair.n - 1), r.x, r.z, {});
      if (q.s > 700 && q.s < e.pair.len - 700 && ok(e.pair, q.s, 340) || true){ const m = makeGas(e.pair, q.s, brand, false, -1); m.twin = st; st.twin = m; } }
    else { const m = makeGas(e, st.sm, brand, true, 1); m.twin = st; st.twin = m; }
  };
  // the start: E1 northbound, in the forest just north of the mountains
  { let e = null, best = 0, bd = Infinity; for (const lk of LINKS){ if (lk.route !== 'E1') continue; const e0 = lk.edges[0]; for (let s = 900; s < e0.len - 900; s += 20){ const r = edgeAt(e0, s, {}); const d = Math.abs(r.z - 12900) + Math.abs(r.x - 1300) * 0.2; if (d < bd && r.tz < 0 && ok(e0, s, 340)){ bd = d; best = s; e = e0; } } }
    START_STATION = makeGas(e, best, 'START · ' + BRANDS[0]); taken.push([START_STATION.pad.cx, START_STATION.pad.cz]); pairUp(START_STATION, BRANDS[0]); }
  for (const lk of LINKS){ const e = lk.edges[0];
    for (let s = 700; s < e.len - 700; s += 300){ const r = edgeAt(e, s, {}); if (!free(r.x, r.z, 6000)) continue; if (!ok(e, s, 340)) continue;
      const brand = BRANDS[STATIONS.length % BRANDS.length], st = makeGas(e, s, brand); taken.push([st.pad.cx, st.pad.cz]); pairUp(st, brand); s += 5600; } }
  // a gas station inside every city, on a quiet street away from its tune shop
  for (const c of CITIES){
    let best = null, bs = -Infinity;
    for (const e of c.edges){ if (e.cls !== 'st' || e.len < 150 || e === c.shopEdge || e.a.gateHw || e.b.gateHw) continue;
      const r = edgeAt(e, e.len / 2, {}), d = Math.hypot(r.x - c.shopEdge.a.x, r.z - c.shopEdge.a.z); let steep = 0;
      for (let a = -50; a <= 50; a += 10) steep = Math.max(steep, Math.abs(edgeAt(e, e.len / 2 + a, _ra).slope));
      let blocked = false; const q2 = []; for (let a = -45; a <= 45 && !blocked; a += 15) for (const w of [4, 14, 26]){ const p = edgeAt(e, e.len / 2 + a, {}), x = p.x - p.nx * (p.hr + w), z = p.z - p.nz * (p.hr + w); roadsNear(x, z, q2); for (const o of q2){ if (o.e === e || Math.abs(o.along) > 1) continue; if (Math.abs(o.d) < (o.d >= 0 ? o.hl : o.hr) + 4){ blocked = true; break; } } }
      if (blocked) continue; // the forecourt can't run over another street
      const sc = Math.min(d, 400) - steep * 4000 - Math.hypot(r.x - c.x, r.z - c.z) * 0.3; if (sc > bs){ bs = sc; best = e; } }
    if (best){ const st = makeGas(best, best.len / 2, c.name + ' ' + BRANDS[(STATIONS.length + 1) % BRANDS.length], true, -1); st.cityStation = c; taken.push([st.pad.cx, st.pad.cz]); }
  }
  for (const e of EDGES){ if (e.cls !== 'rd' || e.len < 5000) continue;
    for (let s = 1500; s < e.len - 1500; s += 300){ const r = edgeAt(e, s, {}); if (!free(r.x, r.z, 7500)) continue; if (!ok(e, s)) continue;
      const brand = BRANDS[(STATIONS.length + 2) % BRANDS.length], st = makeGas(e, s, brand, true); taken.push([st.pad.cx, st.pad.cz]); pairUp(st, brand); s += 7500; } }
}
let START_STATION = null;
// a slip lane: the carriageway gets an extra lane on its right for 260 m before and after the station
function widenForStation(e, s0, s1){
  const lw = e.C.LW;
  for (let k = 0; k < e.n; k++){ const s = k * e.ds; if (s < s0 - 280 || s > s1 + 280) continue;
    const a = smooth(s0 - 270, s0 - 170, s) * (1 - smooth(s1 + 170, s1 + 270, s)); const i = e.i0 + k; SHR[i] = Math.max(SHR[i], e.C.hw + lw * a); }
}
function makeGas(e, sm, brand, small, side = -1){
  const len = small ? 80 : 110, wid = small ? 24 : 30;
  if (!small && e.cls === 'cw') widenForStation(e, sm - len / 2, sm + len / 2);
  const pad = addPad(e, sm, len, wid, side, { kind: 'gas', name: brand });
  const st = { pad, name: brand, kind: 'gas', e, sm, side, bay: { a: small ? -22 : -32, w0: 8, w1: 17, len: 9 }, small };
  STATIONS.push(st); e.stations = e.stations || []; e.stations.push(st);
  return st;
}
function buildGas(st){
  const { pad, e, sm, side } = st, F = frameAt(e, sm), b = new Builder(), P = {};
  const fwd = side < 0 ? 1 : -1; // which way along the road drivers on this side travel
  const edge = side < 0 ? -F.r.hr : F.r.hl, W = w => edge + side * w; // sideways from the road edge, into the lot
  padSurface(pad, MAT.pad);
  const put = (geo, mat, a, w, y = 0, rot = 0) => { F.at(a * fwd, W(w), P); b.add(geo, mat, P.x, P.y + y, P.z, P.h + rot + (fwd < 0 ? Math.PI : 0)); return P; };
  // the barrier between the road and the forecourt: a way in at the start, a way out at the end
  for (let a = -stLen(st) / 2 + 24; a <= stLen(st) / 2 - 24; a += 6){ const q = put(new THREE.BoxGeometry(0.55, 0.85, 6), MAT.jersey, a + 3, -0.05, 0.42); addStatic(q.x, q.z, q.y, q.h, 0.3, 3.05, 1); }
  for (const a of [-stLen(st) / 2 + 22, stLen(st) / 2 - 22]) put(new THREE.BoxGeometry(0.7, 1.0, 0.7), MAT.yellow, a, -0.05, 0.5);
  // canopy over the pumps
  const cw2 = st.small ? 18 : 26;
  put(new THREE.BoxGeometry(12, 0.8, cw2), MAT.white, 0, 14, 5.4);
  put(new THREE.BoxGeometry(12.2, 0.25, cw2 + 0.2), MAT.red, 0, 14, 5.0);
  put(new THREE.BoxGeometry(10, 0.05, cw2 - 2), MAT.glow, 0, 14, 4.95);
  for (const a of [-cw2 / 2 + 2, cw2 / 2 - 2]) for (const w of [10, 18]){ const q = put(new THREE.BoxGeometry(0.5, 5, 0.5), MAT.white, a, w, 2.5); addStatic(q.x, q.z, q.y, q.h, 0.35, 0.35); }
  for (const w of [11.5, 16.5]){ for (const a of st.small ? [-3, 3] : [-6, 0, 6]){ const q = put(new THREE.BoxGeometry(0.9, 1.7, 0.7), MAT.white, a, w, 0.85); put(new THREE.BoxGeometry(0.92, 0.35, 0.72), MAT.red, a, w, 1.45); addStatic(q.x, q.z, q.y, q.h, 0.6, 0.5); }
    put(new THREE.BoxGeometry(1.4, 0.18, st.small ? 9 : 16), MAT.concrete, 0, w, 0.09); }
  // the shop
  const shopA = st.small ? 26 : 34;
  { const q = put(new THREE.BoxGeometry(7, 4, 16), MAT.white, shopA, stWid(st) - 4.5, 2); addStatic(q.x, q.z, q.y, q.h, 3.7, 8.2); }
  put(new THREE.BoxGeometry(0.1, 1.6, 12), WIN_MAT, shopA, stWid(st) - 8.06, 1.6);
  put(new THREE.BoxGeometry(0.3, 0.9, 14), MAT.red, shopA, stWid(st) - 8.1, 3.6);
  // brand sign by the road, on a tall pole
  { const q = put(new THREE.BoxGeometry(0.35, 12, 0.35), MAT.dark, st.small ? 36 : 50, 3, 6); addStatic(q.x, q.z, q.y, q.h, 0.3, 0.3); }
  const signT = textTex(512, 256, (g, w, h) => { g.fillStyle = '#c9262b'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 72px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(st.name.replace('START · ', ''), w / 2, h * 0.38); g.font = '700 42px ' + JP; g.fillText('FUEL · REPAIR · NITRO', w / 2, h * 0.75); });
  const signM = new THREE.MeshBasicMaterial({ map: signT });
  for (const rr of [0, Math.PI]) put(new THREE.PlaneGeometry(5.5, 2.75), signM, st.small ? 36 : 50, 3, 11.2, Math.PI / 2 + rr);
  // parked lorries and cars make it feel alive
  const R = mulberry(Math.round(sm) + e.id * 31 + (side > 0 ? 7 : 0));
  for (let k = 0; k < (st.small ? 2 : 4); k++){ const a = -stLen(st) / 2 + 8 + R() * 22, w = stWid(st) - 3, truck = R() < 0.5;
    const q = put(new THREE.BoxGeometry(2.4, truck ? 3.6 : 1.4, truck ? 11 : 4.5), new THREE.MeshLambertMaterial({ color: [0xd8d8d8, 0x2a4b7a, 0x8a1d1d, 0x2d3a2e, 0x6e737a][Math.floor(R() * 5)] }), a, w - (k % 2) * 3.2, truck ? 1.9 : 0.75);
    addStatic(q.x, q.z, q.y, q.h, 1.25, truck ? 5.6 : 2.3); }
  // the green service bay
  { const { a, w0, w1, len: bl } = st.bay; put(new THREE.PlaneGeometry(w1 - w0, bl).rotateX(-Math.PI / 2), BAY_MAT, a, (w0 + w1) / 2, 0.05);
    for (const [da, dw, ww, ll] of [[-bl / 2, 0, w1 - w0, 0.25], [bl / 2, 0, w1 - w0, 0.25], [0, -(w1 - w0) / 2, 0.25, bl], [0, (w1 - w0) / 2, 0.25, bl]]) put(new THREE.BoxGeometry(ww, 0.1, ll), BAY_EDGE, a + da, (w0 + w1) / 2 + dw, 0.06);
    const t = textTex(512, 128, (g, w, h) => { g.fillStyle = '#3dff8e'; g.font = '900 64px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SERVICE', w / 2, h / 2); });
    put(new THREE.PlaneGeometry(6, 1.5).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2 * side * -1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }), a, (w0 + w1) / 2, 0.08);
    put(new THREE.BoxGeometry(0.2, 4, 0.2), MAT.dark, a, w1 + 1, 2);
    put(new THREE.BoxGeometry(0.1, 1.4, 2.6), BAY_EDGE, a, w1 + 1, 3.9);
    st.bayPos = F.at(a * fwd, W((w0 + w1) / 2), {}); }
  b.flush();
  STATION_LIGHT_POS.push(F.at(0, W(14), {}));
  // a blue sign on the shoulder 500 m before it
  { const s = sm - fwd * 500; if (s > 20 && s < e.len - 20){ const G = frameAt(e, s), off = side < 0 ? -G.r.hr - 1.6 : G.r.hl + 1.6, q = G.at(0, off, {}), gb = new Builder();
    const t = textTex(512, 256, (g, w, h) => { g.fillStyle = '#1d4fb8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 70px ' + JP; g.fillText('⛽ GAS 500 m', w / 2, h * 0.38); g.font = '700 40px ' + JP; g.fillText('FUEL · REPAIR · NITRO', w / 2, h * 0.74); });
    gb.add(new THREE.BoxGeometry(0.15, 4, 0.15), MAT.dark, q.x, q.y + 2, q.z, q.h); gb.add(new THREE.PlaneGeometry(3.4, 1.7), new THREE.MeshBasicMaterial({ map: t }), q.x, q.y + 4.3, q.z, q.h + (fwd > 0 ? Math.PI : 0)); gb.flush(); } }
  // spawn: beside the pumps, facing the way out, with a clear run along the forecourt
  st.spawn = (() => { const q = F.at((-stLen(st) / 2 + 12) * fwd, W(5.5), {}); return { x: q.x, z: q.z, h: q.h + (fwd < 0 ? Math.PI : 0), y: q.y }; })();
}

// =====================================================================================================
// BUILDINGS: boxes with lit windows, turned to face their street, with flat or pitched roofs
// =====================================================================================================
function facade(kind, seed){
  const R = mulberry(seed), W = 256, H = 512, c1 = document.createElement('canvas'), c2 = document.createElement('canvas'); c1.width = c2.width = W; c1.height = c2.height = H;
  const g = c1.getContext('2d'), e = c2.getContext('2d');
  // 0 glass, 1 concrete, 2 brick, 3 dark, 4 wood, 5 cream hotel, 6 warehouse, 7 shophouse
  const wall = ['#1a2430', '#3a3c41', '#3d2b25', '#2b2f36', '#3b2a1e', '#8c8576', '#4a5560', '#5b5147'][kind], glass = ['#0e1a26', '#0d1117', '#141012', '#10141a', '#1a120c', '#22262c', '#1c2228', '#151313'][kind];
  g.fillStyle = wall; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  if (kind === 6){ g.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 0; x < W; x += 6) g.fillRect(x, 0, 2, H); }
  if (kind === 4){ g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < H; y += 8) g.fillRect(0, y, W, 1); }
  const cols = 8, rows = 16, cw = W / cols, rh = H / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++){
    if (kind === 6 && (R() < 0.85 || j % 4)) continue; // warehouses: a few high windows
    if (kind === 4 && i % 2) continue;
    const x = i * cw + (kind === 0 ? 1 : 4), y = j * rh + (kind === 0 ? 2 : 6), w = cw - (kind === 0 ? 2 : 8) + (kind === 4 ? cw * 0.6 : 0), h = rh - (kind === 0 ? 4 : 11);
    const lit = R() < (kind === 0 ? 0.32 : kind === 4 ? 0.55 : 0.42), tint = R();
    g.fillStyle = glass; g.fillRect(x, y, w, h);
    if (kind === 5){ g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 3, y + h, w + 6, 3); }
    if (lit){ const col = kind === 4 ? '#ffc27a' : tint < 0.65 ? '#ffd9a0' : tint < 0.9 ? '#d6e8ff' : '#9fffd0'; const a = 0.55 + R() * 0.45; e.fillStyle = col; e.globalAlpha = a; e.fillRect(x, y, w, h); e.globalAlpha = 1; g.fillStyle = col; g.globalAlpha = 0.3; g.fillRect(x, y, w, h); g.globalAlpha = 1; }
  }
  if (kind === 0){ g.fillStyle = 'rgba(120,160,200,0.08)'; for (let i = 0; i < cols; i++) g.fillRect(i * cw, 0, 1, H); }
  const map = new THREE.CanvasTexture(c1), em = new THREE.CanvasTexture(c2); for (const t of [map, em]){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return new THREE.MeshLambertMaterial({ map, emissiveMap: em, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1 });
}
const FACADES = [facade(0, 11), facade(1, 12), facade(2, 13), facade(3, 14), facade(4, 15), facade(5, 16), facade(6, 17), facade(7, 18), facade(0, 19), facade(1, 20)];
const ROOF_MAT = new THREE.MeshLambertMaterial({ color: 0x24262b });
const STORE_MAT = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); const cols = ['#ff3d6e', '#3dd8ff', '#ffd23d', '#8aff6a', '#ff8a2a', '#c48aff', '#ffffff'];
  for (let i = 0; i < 16; i++){ g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85; g.fillRect(i * 32 + 2, 8, 28, 52); g.globalAlpha = 1; g.fillStyle = '#111'; g.fillRect(i * 32 + 2, 4, 28, 6); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return new THREE.MeshBasicMaterial({ map: t }); })();
const NEON_WORDS = ['ラーメン', 'BAR', 'HOTEL', '24H', 'カラオケ', 'GARAGE', '寿司', 'PACHINKO', 'CAFE', 'TUNE', '居酒屋', 'NEON'];
const NEON_COLS = ['#ff3d6e', '#3dd8ff', '#ffd23d', '#8aff6a', '#ff8a2a', '#c48aff'];
let NEON_ATLAS = null;
function neonAtlas(){
  if (NEON_ATLAS) return NEON_ATLAS;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#05060a'; g.fillRect(0, 0, 1024, 512);
  NEON_WORDS.forEach((w, k) => { const x = (k % 4) * 256, y = Math.floor(k / 4) * 170; const col = NEON_COLS[k % NEON_COLS.length];
    g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(x + 10, y + 12, 236, 146); g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col; g.font = '900 ' + (w.length > 5 ? 44 : 64) + 'px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(w, x + 128, y + 85); g.shadowBlur = 0; });
  const t = new THREE.CanvasTexture(c); NEON_ATLAS = new THREE.MeshBasicMaterial({ map: t }); return NEON_ATLAS;
}
const BEACON_MAT = new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false });
const IDENT = new THREE.Matrix4();
const BEACONS = [];
const SHOPS = [];
const ROOF_PRISM = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 0.42); s.lineTo(-0.5, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; })();
// one building, centred at (x, z), turned by ry; hx across, hz along its street (half sizes); y0 is its base, h its height above y1
function bld(b, x, y0, z, ry, hx, hz, h, y1, kind, roof, R, opt = {}){
  const mat = FACADES[kind], ou = R() * 4, ov = Math.floor(R() * 8) / 16, m4 = new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
  const quad = (ax, az, bx, bz, ya, yb, u0, u1) => { const g = new THREE.BufferGeometry(); const p = [ax, ya, az, bx, ya, bz, bx, yb, bz, ax, ya, az, bx, yb, bz, ax, yb, az];
    const v0 = (ya - y1) / 57.6 + ov, v1 = (yb - y1) / 57.6 + ov, uv = [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  const box = (sx, sz, ya, yb, m, top) => {
    const w = sx * 2, d = sz * 2, u = ou;
    b.addM(quad(-sx, sz, sx, sz, ya, yb, u, u + w / 25.6), m, m4); b.addM(quad(sx, sz, sx, -sz, ya, yb, u + w / 25.6, u + (w + d) / 25.6), m, m4);
    b.addM(quad(sx, -sz, -sx, -sz, ya, yb, u, u + w / 25.6), m, m4); b.addM(quad(-sx, -sz, -sx, sz, ya, yb, u + w / 25.6, u + (w + d) / 25.6), m, m4);
    if (top) b.addM(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(0, yb, 0), ROOF_MAT, m4);
  };
  const top = y1 + h;
  box(hx, hz, y0, top, mat, roof === 'flat');
  let H2 = top;
  if (roof === 'flat' && h > 60 && R() < 0.6){ const h2 = h * (0.15 + R() * 0.25); box(hx * 0.72, hz * 0.72, top, top + h2, mat, true); H2 = top + h2; }
  if (roof !== 'flat'){ const rm = roof === 'red' ? MAT.redTile : roof === 'tin' ? MAT.tin : MAT.tile, rh = Math.min(hx, hz) * 0.9; // pitched, ridge along the longer side
    const g = ROOF_PRISM.clone(); if (hz >= hx) g.scale(hx * 2.2, rh, hz * 2.1); else { g.rotateY(Math.PI / 2); g.scale(hx * 2.1, rh, hz * 2.2); } g.translate(0, top, 0); b.addM(g, rm, m4); H2 = top + rh * 0.42; }
  else if (R() < 0.5) b.addM(new THREE.BoxGeometry(2.5, 1.6, 2.5).translate((R() - 0.5) * hx, top + 0.8, (R() - 0.5) * hz), MAT.dark, m4);
  if (opt.store){ const sy = Math.min(top, y1 + 4.2); b.addM(quad(-hx - 0.05, hz + 0.05, hx + 0.05, hz + 0.05, y1, sy, R(), R() + hx / 16), STORE_MAT, m4); }
  if (opt.storeX){ const sy = Math.min(top, y1 + 4.2), sgn = opt.storeX; b.addM(quad(sgn * (hx + 0.05), sgn * hz, sgn * (hx + 0.05), -sgn * hz, y1, sy, R(), R() + hz / 16), STORE_MAT, m4); }
  if (opt.lanterns){ for (const k of [-0.5, 0.5]){ const p = new THREE.Vector3(opt.lanterns * (hx + 0.4), y1 + 2.6, k * hz * 1.2).applyMatrix4(m4); b.add(new THREE.BoxGeometry(0.35, 0.5, 0.35), MAT.lantern, p.x, p.y, p.z); } }
  if (H2 - y1 > 85) BEACONS.push([x, H2 + 1.5, z]);
  addStatic(x, z, y0, ry, hx, hz, H2 - y0);
  return H2;
}
// the land just in front of a building's door is its street's height; behind, it follows the hillside
const _pl = [];
function lotFree(placed, x, z, rad){ for (const p of placed) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < (p[2] + rad) ** 2) return false; return true; }
function lotClear(x, z, y, rad, self){
  roadsNear(x, z, _pl);
  for (const q of _pl){ if (q.e === self && Math.abs(q.along) < 1) continue; const side = q.d >= 0 ? q.hl : q.hr; if (Math.abs(q.d) < side + (q.e.cls === 'st' ? 3.6 : 1.2) + rad && Math.abs(q.along) < rad + 2) return false; }
  for (const p of patchesNear(x, z)){ if (Math.hypot(x - p.x, z - p.z) < (p.sq || p.r) + rad + 3) return false; }
  for (const p of padsNear(x, z)){ if (Math.hypot(x - p.cx, z - p.cz) < p.rad + rad) { if (padContains(p, x, z, y, rad + 2)) return false; } }
  for (const L of LAKES){ if (lakeQ(L, x, z) < 1.06) return false; }
  return true;
}
// buildings lined up along streets, both sides, each turned to face the road
function lotsAlong(b, edges, R, placed, P){
  for (const e of edges) for (const side of [-1, 1]){
    let s = Math.max((e.a.R || 10) + 4, P.range ? P.range[0] : 0) + R() * 6;
    while (s < e.len - 8){
      const L = lerp(P.lmin, P.lmax, R()), D = lerp(P.dmin, P.dmax, R()), sm = s + L / 2;
      if (sm + L / 2 > e.len - (e.b.R || 10) - 4 || (P.range && sm > P.range[1])) break;
      const r = edgeAt(e, sm, {}), hw = side > 0 ? r.hl : r.hr, off = hw + (e.cls === 'st' ? 3.2 : 0.6) + (P.setback || 1.2) + D / 2;
      const x = r.x + r.nx * side * off, z = r.z + r.nz * side * off, rad = 0.5 * Math.hypot(L, D);
      if (P.skip && P.skip(x, z, side, e)){ s += L + 2; continue; }
      if (lotFree(placed, x, z, rad * 0.92) && lotClear(x, z, r.y, rad * 0.8, e)){
        const g = Math.min(r.y, groundAt(x, z)), h = P.height(x, z, R);
        const ry = side > 0 ? r.h : r.h + Math.PI; // local +z runs along the street, local +x points back from it
        const top = bld(b, x, g - 1.5, z, ry, D / 2, L / 2, h, r.y, P.kind(R, h), P.roof(R, h), R, { storeX: P.store && P.store(R) ? -1 : 0, lanterns: P.lanterns && R() < 0.5 ? -1 : 0 });
        placed.push([x, z, rad]);
        if (P.after) P.after(x, z, r.y, top, ry, D, L, side);
      }
      s += L + lerp(P.gmin ?? 1.5, P.gmax ?? 5, R());
    }
  }
}

// =====================================================================================================
// SHOPS: every city and town has one (fuel, repairs, nitro and its own parts)
// =====================================================================================================
function makeShop(place, e, sm, label){
  const pad = addPad(e, sm, 64, 24, -1, { kind: 'shop', name: label });
  const shop = { pad, name: label, kind: 'shop', place, city: place.isTown ? null : place, e, sm, side: -1, bay: { a: -8, w0: 6, w1: 15, len: 10 } };
  STATIONS.push(shop); SHOPS.push(shop); place.shop = shop;
  return shop;
}
function buildShopVisual(shop, b, neon = '#ff3d9a'){
  const place = shop.place, F = frameAt(shop.e, shop.sm), P = {}, edge = -F.r.hr, W = w => edge - w;
  const put = (geo, mat, a, w, yy = 0, rot = 0) => { F.at(a, W(w), P); b.add(geo, mat, P.x, P.y + yy, P.z, P.h + rot); return P; };
  padSurface(shop.pad, MAT.lot);
  { const q = put(new THREE.BoxGeometry(9, 7, 30), MAT.dark, 8, 19.5, 3.5); addStatic(q.x, q.z, q.y, q.h, 4.6, 15.2, 7); }
  for (const a of [-2, 18]) put(new THREE.BoxGeometry(0.15, 4.5, 8), new THREE.MeshBasicMaterial({ color: 0x3a4b5c }), a, 14.96, 2.4);
  const neonT = textTex(1024, 256, (g, w, h) => { g.fillStyle = '#07080c'; g.fillRect(0, 0, w, h); g.shadowColor = '#3dd8ff'; g.shadowBlur = 24; g.strokeStyle = '#3dd8ff'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = neon; g.shadowColor = neon; g.font = '900 96px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(place.name + (place.isTown ? ' PARTS' : ' TUNE'), w / 2, h * 0.42); g.fillStyle = '#7fe3ff'; g.shadowColor = '#7fe3ff'; g.font = '700 48px ' + JP; g.fillText('PARTS · FUEL · REPAIR · ' + place.jp, w / 2, h * 0.78); });
  put(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: neonT }), 8, 14.9, 8.4, -Math.PI / 2);
  for (const a of [22, 28]){ const q = put(new THREE.BoxGeometry(0.9, 1.7, 0.7), MAT.white, a, 6, 0.85); put(new THREE.BoxGeometry(0.92, 0.35, 0.72), MAT.red, a, 6, 1.45); addStatic(q.x, q.z, q.y, q.h, 0.6, 0.5); }
  { const { a, w0, w1, len: bl } = shop.bay; put(new THREE.PlaneGeometry(w1 - w0, bl).rotateX(-Math.PI / 2), BAY_MAT, a, (w0 + w1) / 2, 0.05);
    for (const [da, dw, ww, ll] of [[-bl / 2, 0, w1 - w0, 0.25], [bl / 2, 0, w1 - w0, 0.25], [0, -(w1 - w0) / 2, 0.25, bl], [0, (w1 - w0) / 2, 0.25, bl]]) put(new THREE.BoxGeometry(ww, 0.1, ll), BAY_EDGE, a + da, (w0 + w1) / 2 + dw, 0.06);
    const t = textTex(512, 128, (g, w, h) => { g.fillStyle = '#3dff8e'; g.font = '900 60px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('UPGRADE BAY', w / 2, h / 2); });
    put(new THREE.PlaneGeometry(8, 2).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }), a, (w0 + w1) / 2, 0.08);
    shop.bayPos = F.at(a, W((w0 + w1) / 2), {}); }
  STATION_LIGHT_POS.push(F.at(0, W(10), {}));
}

// =====================================================================================================
// CITIES, each in its own style
// =====================================================================================================
const PLAZA_TREE = { trunk: new THREE.CylinderGeometry(0.25, 0.35, 3, 6).translate(0, 1.5, 0), crown: new THREE.IcosahedronGeometry(2.6, 0).translate(0, 4.6, 0), leaf: LM(0x1f3a1c) };
function tree(b, x, y, z, s = 1){ b.add(PLAZA_TREE.trunk.clone().scale(s, s, s), MAT.wood, x, y, z); b.add(PLAZA_TREE.crown.clone().scale(s, s, s), PLAZA_TREE.leaf, x, y, z); }
function buildCityPlaces(c){
  const b = new Builder(), nb = new Builder(), R = mulberry(Math.round(c.x * 3 + c.z)), placed = [];
  const shop = makeShop(c, c.shopEdge, c.shopEdge.len / 2, c.name + ' TUNE & GAS');
  buildShopVisual(shop, b);
  placed.push([shop.pad.cx, shop.pad.cz, 42]);
  for (const st of STATIONS) if (st.cityStation === c) placed.push([st.pad.cx, st.pad.cz, 52]);
  const dist = (x, z) => Math.hypot(x - c.x, z - c.z) / Math.max(200, c.half);
  const neonOn = (x, y, z, ry, R2) => { const k = Math.floor(R2() * NEON_WORDS.length), u0 = (k % 4) / 4, v0 = 1 - (Math.floor(k / 4) + 1) * 170 / 512, u1 = u0 + 0.25, v1 = v0 + 170 / 512;
    const g = new THREE.PlaneGeometry(6, 4); const uv = g.attributes.uv; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); nb.add(g, neonAtlas(), x, y, z, ry); };
  if (c.style === 'grid'){ // TOKAI: towers block by block, tallest in the middle, a park plaza by the centre
    const P = c.P, NB = P.length - 1, inset = CLS.st.hw + 3.2 + 1.2, y = c.y;
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++){
      const bx0 = c.x + P[i] + inset, bz0 = c.z + P[j] + inset, bx1 = c.x + P[i + 1] - inset, bz1 = c.z + P[j + 1] - inset;
      if (i === c.plazaIdx[0] && j === c.plazaIdx[1]){ // the plaza: lawn, trees, a lit fountain
        const lawn = new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0).rotateX(-Math.PI / 2); b.add(lawn, LM(0x1c2a1a), (bx0 + bx1) / 2, y + 0.05, (bz0 + bz1) / 2);
        for (let k = 0; k < 26; k++) tree(b, lerp(bx0 + 6, bx1 - 6, R()), y, lerp(bz0 + 6, bz1 - 6, R()), 0.8 + R() * 0.5);
        const fx = (bx0 + bx1) / 2, fz = (bz0 + bz1) / 2; b.add(new THREE.CylinderGeometry(9, 9.5, 0.8, 24), MAT.concrete, fx, y + 0.4, fz); b.add(new THREE.CylinderGeometry(8.2, 8.2, 0.1, 24), BM(0x6ec8ff), fx, y + 0.82, fz); b.add(new THREE.CylinderGeometry(0.6, 0.9, 3.5, 10), MAT.concrete, fx, y + 2, fz);
        addStatic(fx, fz, y, 0, 9, 9, 2); continue;
      }
      const nl = (bx1 - bx0) > 120 ? 3 : 2, nm = (bz1 - bz0) > 120 ? 3 : 2;
      for (let p = 0; p < nl; p++) for (let q = 0; q < nm; q++){
        const lx0 = lerp(bx0, bx1, p / nl) + 2, lx1 = lerp(bx0, bx1, (p + 1) / nl) - 2, lz0 = lerp(bz0, bz1, q / nm) + 2, lz1 = lerp(bz0, bz1, (q + 1) / nm) - 2;
        const cx = (lx0 + lx1) / 2, cz = (lz0 + lz1) / 2, rad = Math.hypot(lx1 - lx0, lz1 - lz0) / 2;
        if (!lotFree(placed, cx, cz, rad * 0.6)) continue;
        if (R() < 0.08) continue; // a little car park
        const center = Math.pow(clamp(1 - dist(cx, cz), 0, 1), 1.3), h = 14 + (20 + 230 * center) * (0.45 + R() * 0.75);
        const sx = (lx1 - lx0) * 0.1 * R(), sz = (lz1 - lz0) * 0.1 * R(), kind = center > 0.35 && R() < 0.6 ? (R() < 0.5 ? 0 : 8) : [1, 2, 3, 9][Math.floor(R() * 4)];
        const H = bld(b, cx, y - 2, cz, 0, (lx1 - lx0) / 2 - sx, (lz1 - lz0) / 2 - sz, h, y, kind, 'flat', R, { store: true });
        if (R() < 0.45){ const face = Math.floor(R() * 4), yy = y + 6 + R() * Math.min(30, H - y - 10), hx = (lx1 - lx0) / 2 - sx + 0.3, hz = (lz1 - lz0) / 2 - sz + 0.3;
          neonOn(cx + [0, hx, 0, -hx][face], yy, cz + [hz, 0, -hz, 0][face], [0, Math.PI / 2, Math.PI, -Math.PI / 2][face], R); }
      }
    }
    const g = new THREE.PlaneGeometry(c.half * 2 + 30, c.half * 2 + 30).rotateX(-Math.PI / 2).translate(c.x, c.y - 0.25, c.z); const m = new THREE.Mesh(g, LM(0x1d1f23)); m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m);
  }
  if (c.style === 'mountain'){ // HAKONE: wooden houses with tiled roofs packed along climbing streets, lanterns, a big ryokan, a torii
    lotsAlong(b, c.edges, R, placed, { lmin: 8, lmax: 15, dmin: 7, dmax: 11, setback: 0.8, gmin: 0.8, gmax: 3, height: () => 5 + R() * 6, kind: () => R() < 0.78 ? 4 : 5, roof: () => R() < 0.85 ? 'tile' : 'red', store: () => R() < 0.25, lanterns: true });
    // the ryokan, up the hill north-west of the centre
    { let best = null; for (let k = 0; k < 80 && !best; k++){ const x = c.x - 110 + (R() - 0.5) * 160, z = c.z - 110 + (R() - 0.5) * 120, y = groundAt(x, z); if (lotFree(placed, x, z, 26) && lotClear(x, z, y, 24, null)) best = [x, y, z]; }
      if (best){ bld(b, best[0], best[1] - 2, best[2], 0.3, 14, 22, 11, best[1], 4, 'tile', R, { lanterns: -1 }); placed.push([best[0], best[2], 28]); } }
    // a red torii at the end of Torii Alley
    { const n = c.N.D4, y = n.y, e = n.links[0], r = edgeAt(e, e.b === n ? e.len - 12 : 12, {}), w = 4.6;
      for (const sd of [-1, 1]) b.add(new THREE.CylinderGeometry(0.32, 0.38, 6, 10), MAT.torii, r.x + r.nx * sd * w, y + 3, r.z + r.nz * sd * w);
      b.add(new THREE.BoxGeometry(12.5, 0.5, 0.9), MAT.torii, r.x, y + 6.2, r.z, r.h + Math.PI / 2); b.add(new THREE.BoxGeometry(10.5, 0.35, 0.6), MAT.torii, r.x, y + 5.2, r.z, r.h + Math.PI / 2); }
  }
  if (c.style === 'resort'){ // KAWAGUCHI: hotels along the lakeside boulevard, a promenade and a pier with a little lighthouse
    const lakeSide = (x, z) => x < c.N.GW.x + 10; // the lake side of the boulevard stays open: a promenade
    lotsAlong(b, c.edges, R, placed, { lmin: 18, lmax: 34, dmin: 13, dmax: 20, setback: 2, gmin: 3, gmax: 10, skip: (x, z) => lakeSide(x, z),
      height: (x, z) => 12 + (x < c.N.GW.x + 120 ? 30 : 14) * R() + 10 * (1 - dist(x, z)), kind: () => R() < 0.55 ? 5 : R() < 0.5 ? 0 : 1, roof: () => 'flat', store: () => R() < 0.5 });
    // promenade trees and a pier into the lake west of the boulevard
    const gw = c.N.GW, L = LAKES[0];
    for (let k = -8; k <= 8; k++){ const x = gw.x - 24, z = gw.z + k * 34; if (lakeQ(L, x, z) > 1.05) tree(b, x, groundAt(x, z), z, 0.9); }
    let px = gw.x - 30; while (lakeQ(L, px, gw.z) > 1.0 && px > gw.x - 900) px -= 10;
    const pierLen = 120, py = L.wl + 1.2; b.add(new THREE.BoxGeometry(pierLen, 0.4, 5), MAT.wood, px - pierLen / 2 + 10, py, gw.z);
    for (let k = 0; k < pierLen; k += 12) for (const sd of [-2.2, 2.2]) b.add(new THREE.CylinderGeometry(0.2, 0.2, 6, 6), MAT.wood, px - k + 10, py - 3, gw.z + sd);
    b.add(new THREE.CylinderGeometry(1.6, 2.2, 14, 12), MAT.white, px - pierLen + 10, py + 7, gw.z); b.add(new THREE.CylinderGeometry(1.7, 1.7, 1.6, 12), MAT.red, px - pierLen + 10, py + 14.5, gw.z);
    BEACONS.push([px - pierLen + 10, py + 15.8, gw.z]);
  }
  if (c.style === 'port'){ // NAGISA: offices to the west, warehouses to the east, then container yards and cranes on the bay
    const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0), U = (x, z) => (x - c.x) * cs + (z - c.z) * sn;
    lotsAlong(b, c.edges, R, placed, { lmin: 18, lmax: 30, dmin: 13, dmax: 20, setback: 1.5, gmin: 2, gmax: 6, skip: (x, z) => U(x, z) > 60,
      height: (x, z) => 12 + 45 * Math.pow(clamp(1 - dist(x, z), 0, 1), 1.2) * (0.5 + R() * 0.8), kind: () => [1, 2, 3, 9, 0][Math.floor(R() * 5)], roof: () => 'flat', store: () => R() < 0.6,
      after: (x, z, y, top, ry, D, L, side) => { if (top - y > 22 && R() < 0.35) neonOn(x - Math.cos(ry) * (D / 2 + 0.3), y + 7 + R() * 10, z + Math.sin(ry) * (D / 2 + 0.3), ry - Math.PI / 2, R); } });
    lotsAlong(b, c.edges, R, placed, { lmin: 34, lmax: 58, dmin: 22, dmax: 30, setback: 3, gmin: 4, gmax: 10, skip: (x, z) => U(x, z) <= 60,
      height: () => 8 + R() * 5, kind: () => 6, roof: () => 'flat' });
    // the docks: east of town to the water
    const bay = LAKES.find(L => L.name === 'NAGISA BAY'); let sx = c.x + c.half; while (lakeQ(bay, sx, c.z) > 1.0 && sx < c.x + 3000) sx += 10;
    const cols = [0x8a3a2a, 0x2a4a6a, 0x3a5a3a, 0xa8822c, 0x6a6d72, 0x2a6a6a].map(LM), x1 = sx - 60, x0 = Math.max(c.x + c.half + 70, x1 - 520), y = groundAt((x0 + x1) / 2, c.z);
    for (let x = x0; x < x1; x += 15) for (let z = c.z - 200; z < c.z + 200; z += (Math.floor((z - c.z) / 7) % 4 === 3 ? 14 : 7)){ if (R() < 0.3) continue; const n = 1 + Math.floor(R() * 4), gy = groundAt(x, z);
      for (let k = 0; k < n; k++) b.add(new THREE.BoxGeometry(12.2, 2.6, 2.45), cols[Math.floor(R() * cols.length)], x, gy + 1.3 + k * 2.6, z); addStatic(x, z, gy, 0, 6.2, 1.3, n * 2.6); }
    for (const dz of [-160, 0, 160]){ const cx2 = sx - 25, cz2 = c.z + dz, gy = groundAt(cx2, cz2);
      for (const lx of [-8, 8]) for (const lz of [-6, 6]) b.add(new THREE.BoxGeometry(1.2, 30, 1.2), MAT.crane, cx2 + lx, gy + 15, cz2 + lz);
      b.add(new THREE.BoxGeometry(70, 2.4, 3), MAT.crane, cx2 + 15, gy + 31, cz2); b.add(new THREE.BoxGeometry(8, 5, 8), MAT.crane, cx2 - 4, gy + 34, cz2);
      BEACONS.push([cx2 + 49, gy + 33, cz2]); BEACONS.push([cx2 - 4, gy + 37.5, cz2]); }
    const g = new THREE.PlaneGeometry(c.half * 2 + 60, c.half * 2 + 60).rotateX(-Math.PI / 2).rotateY(-(c.rot || 0)).translate(c.x, c.y - 0.25, c.z); const m = new THREE.Mesh(g, LM(0x24262a)); m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m);
  }
  if (c.style === 'farm'){ // HOKUTO: low shops along one main street, grain silos, a water tower, a little station
    lotsAlong(b, c.edges, R, placed, { lmin: 9, lmax: 16, dmin: 9, dmax: 13, setback: 1.5, gmin: 2, gmax: 12, height: () => 3.6 + R() * 4, kind: () => R() < 0.7 ? 7 : 4, roof: () => R() < 0.6 ? 'tin' : 'red', store: () => R() < 0.55 });
    const sil = c.N.D2, sy = groundAt(sil.x + 40, sil.z - 20);
    for (let k = 0; k < 3; k++){ const x = sil.x + 34 + k * 9, z = sil.z - 30; b.add(new THREE.CylinderGeometry(3.6, 3.6, 18, 16), MAT.concrete, x, sy + 9, z); b.add(new THREE.ConeGeometry(3.8, 2.4, 16), MAT.tin, x, sy + 19.2, z); addStatic(x, z, sy, 0, 3.6, 3.6, 20); }
    { const x = c.x + 60, z = c.z + 60, y = groundAt(x, z); for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.add(new THREE.BoxGeometry(0.4, 16, 0.4), MAT.dark, x + lx, y + 8, z + lz);
      b.add(new THREE.CylinderGeometry(4.5, 4.5, 6, 16), MAT.white, x, y + 19, z); b.add(new THREE.ConeGeometry(4.8, 2, 16), MAT.red, x, y + 23, z); addStatic(x, z, y, 0, 3.5, 3.5, 22); BEACONS.push([x, y + 24.5, z]); }
    { const n = c.N.D2, y = n.y; b.add(new THREE.BoxGeometry(60, 1, 6), MAT.concrete, n.x, y + 0.5, n.z - 16); b.add(new THREE.BoxGeometry(60, 0.3, 7), MAT.tin, n.x, y + 4.5, n.z - 16);
      for (let k = -2; k <= 2; k++) b.add(new THREE.BoxGeometry(0.3, 4, 0.3), MAT.dark, n.x + k * 14, y + 2.5, n.z - 16);
      for (const dz of [-21, -23]) b.add(new THREE.BoxGeometry(900, 0.15, 0.15), MAT.steel, c.x, y + 0.1, n.z + dz); }
  }
  // parks and gardens fill the gaps (not in Tokai's or Nagisa's paved centres)
  if (c.style !== 'grid' && c.style !== 'port') for (let k = 0; k < 160; k++){
    const x = c.x + (R() - 0.5) * 2 * c.half, z = c.z + (R() - 0.5) * 2 * c.half, y = groundAt(x, z);
    if (lotFree(placed, x, z, 3) && lotClear(x, z, y, 3, null)){ tree(b, x, y, z, 0.8 + R() * 0.6); placed.push([x, z, 3]); }
  }
  b.flush(); nb.flush();
}
let BEACON_MESH = null;
function buildBeacons(){ const g = new THREE.SphereGeometry(0.6, 6, 4); BEACON_MESH = new THREE.InstancedMesh(g, BEACON_MAT, Math.max(1, BEACONS.length)); BEACONS.forEach((p, k) => BEACON_MESH.setMatrixAt(k, m4At(p[0], p[1], p[2], 0))); BEACON_MESH.count = BEACONS.length; scene.add(BEACON_MESH); }

// =====================================================================================================
// GAPS IN THE MEDIAN: every couple of kilometres the double rail between the carriageways opens for 30 m so you can turn round
// =====================================================================================================
function placeCrossovers(){
  // a gap at every pair of expressway gas stations, so you can fill up and head back the way you came
  for (const st of STATIONS){
    const e = st.e; if (st.kind !== 'gas' || e.cls !== 'cw' || !e.pair || !st.twin || e.id > e.pair.id) continue;
    const p = e.pair;
    for (const off of [0, 60, -60, 120, -120, 180, -180, 240, -240, 300, -300, 360, -360]){
      const s = st.sm + off; let okHere = true;
      for (let a = -20; a <= 20 && okHere; a += 10){ const k = clamp(Math.round((s + a) / e.ds), 0, e.n - 1); if (SOF[e.i0 + k] < CW_O - 0.01) okHere = false; }
      if (!okHere) continue;
      const r = edgeAt(e, s, {}), q = refineOn(p, p.i0 + clamp(Math.round((p.len - s) / p.ds), 0, p.n - 1), r.x, r.z, {});
      if (Math.abs(q.y - r.y) > 0.35) continue;
      const k = Math.round(s / e.ds), gap = SOF[e.i0 + k] - SHL[e.i0 + k];
      st.gap = addPad(e, s, 30, gap * 2 + 0.9, 1, { kind: 'gap', name: 'U-TURN' }); break;
    }
  }
  for (const lk of LINKS){
    const e = lk.edges[0], p = e.pair;
    for (let s = 1700; s < e.len - 1700; s += 2300){
      let okHere = true;
      for (let a = -40; a <= 40 && okHere; a += 10){ const k = clamp(Math.round((s + a) / e.ds), 0, e.n - 1), i = e.i0 + k; if (SOF[i] < CW_O - 0.01 || SHR[i] > e.C.hw + 0.2) okHere = false; const r = edgeAt(e, s + a, _ra); if (r.y - natural(r.x, r.z) > 1.5) okHere = false; }
      if (!okHere) continue;
      if ((e.stations || []).some(st => Math.abs(st.sm - s) < 700) || (p.stations || []).some(st => Math.abs((p.len - st.sm) - s) < 700)) continue;
      const r = edgeAt(e, s, {}), q = refineOn(p, p.i0 + clamp(Math.round((p.len - s) / p.ds), 0, p.n - 1), r.x, r.z, {});
      if (Math.abs(q.y - r.y) > 0.35) continue;
      const k = Math.round(s / e.ds), gap = SOF[e.i0 + k] - SHL[e.i0 + k];
      addPad(e, s, 30, gap * 2 + 0.9, 1, { kind: 'gap', name: 'U-TURN' });
    }
  }
}
function buildCrossovers(){ for (const p of PADS) if (p.kind === 'gap') padSurface(p, MAT.asphalt); }
// =====================================================================================================
// SIGNS: green gantries before every interchange and city, saying which lane goes where
// =====================================================================================================
function signTex(lines, wide){
  const c = document.createElement('canvas'); c.width = wide ? 1024 : 768; c.height = 256; const g = c.getContext('2d'), W = c.width;
  g.fillStyle = '#0e5c3c'; g.fillRect(0, 0, W, 256); g.strokeStyle = '#e8efe9'; g.lineWidth = 8; g.strokeRect(12, 12, W - 24, 232);
  g.fillStyle = '#f2f5f2'; g.textBaseline = 'middle';
  g.font = '900 86px ' + JP; g.fillText(lines[0], 44, 96);
  g.font = '700 46px ' + JP; g.fillText(lines[1], 44, 190);
  if (lines[2]){ g.textAlign = 'right'; g.font = '900 120px ' + JP; g.fillText(lines[2], W - 40, 130); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return new THREE.MeshBasicMaterial({ map: t, color: 0xb8c2bc });
}
const GANTRY_M = LM(0x5b626c);
function gantry(e, s, panels){
  const r = edgeAt(e, s, {}), grp = new THREE.Group(); grp.position.set(r.x, r.y, r.z); grp.rotation.y = r.h;
  const L1 = r.hl + 1.0, R1 = r.hr + 1.1;
  for (const x of [L1, -R1]){ const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.6, 0.4), GANTRY_M); p.position.set(x, 3.8, 0); grp.add(p); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(L1 + R1 + 0.6, 0.6, 0.6), GANTRY_M); beam.position.set((L1 - R1) / 2, 7.3, 0); grp.add(beam);
  const total = r.hl + r.hr, w = total / panels.length;
  panels.forEach((pn, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 2.7), signTex(pn, w > 6)); m.position.set(r.hl - w * (k + 0.5), 7.0, -0.35); m.rotation.y = Math.PI; grp.add(m); });
  grp.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); grp.updateMatrixWorld(true);
  scene.add(grp);
}
function buildSigns(){
    for (const ic of ICS) for (const k in ic.arms){
    const A = ic.arms[k], into = A.inPort.links.find(e => e.b === A.inPort && !e.ic); if (!into) continue;
    const opp = { N: 'S', S: 'N', E: 'W', W: 'E' }[k];
    const t = [-A.u[0], -A.u[1]], tn = [t[1], -t[0]];
    const panels = [];
    for (const j of ['N', 'S', 'E', 'W']){ if (j === k) continue; const B = ic.arms[j]; const out = B.outPort.links.find(e => e.a === B.outPort && !e.ic); if (!out) continue;
      const left = B.u[0] * tn[0] + B.u[1] * tn[1] > 0, straight = j === opp;
      panels.push({ order: straight ? 0 : left ? -1 : 1, lines: [(straight ? '↑ ' : left ? '↖ ' : '↗ ') + (out.towards || ''), B.route.short + '  ' + B.route.jp, straight ? '' : 'EXIT'] }); }
    panels.sort((a, b) => a.order - b.order);
    gantry(into, into.len - 900, panels.map(p => p.lines)); // left-to-right as seen from the driver
    gantry(into, into.len - 300, [['EXIT  ' + ic.name, 'KEEP RIGHT FOR EXITS', '']]);
  }
  for (const c of CITIES) for (const k in c.gate){ const n = c.gate[k].node; for (const e of n.links){ if (e.cls !== 'cw' || e.b !== n || e.len < 800) continue; gantry(e, e.len - 700, [[c.name + '  ' + c.jp, 'CITY CENTRE · TUNE SHOP', '0.7 km']]); } }
  // the local exits: a sign a kilometre out and another where the extra lane opens
  for (const X of EXITS) for (const d of [X.nDA, X.nDB]){ const e = d.links.find(q => q.cls === 'cw' && q.b === d); if (!e) continue;
    if (e.len > 1100) gantry(e, e.len - 1000, [['EXIT ' + X.num + '  ' + X.name, 'LOCAL ROADS', '1 km']]);
    if (e.len > 450) gantry(e, e.len - 330, [['EXIT ' + X.num + '  ' + X.name, 'KEEP RIGHT', '↗']]); }
}

// =====================================================================================================
// COUNTRYSIDE: farmhouses with lit windows, barns, silos and wind turbines in the north; cabins in the forest
// =====================================================================================================
const HOUSE = new NearPool(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), 1400, 1800, true);
const ROOF = (() => { const s = new THREE.Shape(); s.moveTo(-0.55, 0); s.lineTo(0.55, 0); s.lineTo(0, 0.45); s.lineTo(-0.55, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 1.1, bevelEnabled: false }); g.translate(0, 0, -0.55); return g; })();
const ROOFS = new NearPool(ROOF, new THREE.MeshLambertMaterial({ color: 0xffffff }), 1400, 1800, true);
const HWIN = new NearPool(new THREE.BoxGeometry(1, 1, 1), WIN_MAT, 2800, 2200);
const SILO = new NearPool(new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }), 300, 1800);
const TURB = { rotors: [], red: new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false }) };
function buildCountryside(){
  const R = mulberry(4242), cols = [0xcfc6b0, 0x9a8f7a, 0xd8d2c4, 0x6d5a4a], rcols = [0x6a2a24, 0x2f3a46, 0x3e3e40, 0x7a3a22], c = new THREE.Color(), c2 = new THREE.Color();
  for (const e of EDGES){
    if (e.city || e.ic || e.cls === 'st' || e.cls === 'rp') continue;
    if (e.cls === 'cw' && e.pair && e.id > e.pair.id) continue;
    for (let s = 300; s < e.len - 300; s += 170){
      const r = edgeAt(e, s, {}), rk = ruralK(r.z), m = mtnK(r.x, r.z), p = lerp(lerp(0.09, 0.04, m), 0.42, rk);
      if (R() > p) continue;
      const side = R() < 0.5 ? -1 : 1, off = side * ((side < 0 ? r.hr : r.hl) + 34 + R() * 45), x = r.x + r.nx * off, z = r.z + r.nz * off;
      if (roadDist(x, z) < 26) continue; flatAt(x, z); if (FK > 0.1) continue;
      let wet = false; for (const L2 of LAKES) if (lakeQ(L2, x, z) < 1.2) wet = true; if (wet) continue;
      let bad = false; for (const p2 of PADS) if (Math.hypot(x - p2.cx, z - p2.cz) < p2.rad + 20) bad = true; if (bad) continue;
      const y = shownGround(x, z), h = r.h + (R() < 0.5 ? 0 : Math.PI / 2), w = 8 + R() * 5, d = 6 + R() * 4, hh = 3 + R() * 3.5;
      c.setHex(cols[Math.floor(R() * cols.length)]); c2.setHex(rcols[Math.floor(R() * rcols.length)]);
      HOUSE.add(m4At(x, y - 0.5, z, h, w, hh + 0.5, d), c); ROOFS.add(m4At(x, y + hh, z, h, w * 1.05, d * 0.9, d * 1.0, 0, 0), c2);
      addStatic(x, z, y, h, w / 2, d / 2, hh);
      for (let k = 0; k < 2; k++) if (R() < 0.7){ const fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h), a = (k - 0.5) * w * 0.5;
        HWIN.add(m4At(x + lx * a + fx * (d / 2 + 0.03), y + hh * 0.55, z + lz * a + fz * (d / 2 + 0.03), h, 1.4, 1.0, 0.05)); }
      if (rk > 0.5 && R() < 0.6){ // a barn and a silo
        const bx = x + Math.cos(h) * (w + 9), bz = z - Math.sin(h) * (w + 9), by = shownGround(bx, bz);
        c.setHex(0x7a2620); HOUSE.add(m4At(bx, by - 0.5, bz, h, 12, 7, 9), c); c2.setHex(0x3a3a3c); ROOFS.add(m4At(bx, by + 6.5, bz, h, 12.6, 8, 9), c2); addStatic(bx, bz, by, h, 6, 4.5, 7);
        if (R() < 0.6){ const sx = bx + Math.sin(h) * 9, sz = bz + Math.cos(h) * 9; SILO.add(m4At(sx, shownGround(sx, sz) - 0.5, sz, 0, 3, 14, 3)); addStatic(sx, sz, by, 0, 3, 3, 14); }
      }
    }
  }
  // wind turbines on the farmland ridges
  const towerM = LM(0x9aa0a8), towerG = new THREE.CylinderGeometry(0.9, 1.6, 62, 10).translate(0, 31, 0), nacG = new THREE.BoxGeometry(2.6, 2.6, 7), bladeG = new THREE.BoxGeometry(1.1, 27, 0.35).translate(0, 13.5, 0);
  for (let tries = 0; tries < 4000 && TURB.rotors.length < 26; tries++){
    const x = WB.x0 + 1000 + R() * (WB.x1 - WB.x0 - 2000), z = -25000 + R() * 15000;
    const d = roadDist(x, z); if (d < 320 || d > 1300) continue;
    flatAt(x, z); if (FK > 0) continue;
    let wet = false; for (const L2 of LAKES) if (lakeQ(L2, x, z) < 1.4) wet = true; if (wet) continue;
    if (TURB.rotors.some(t => Math.hypot(t.parent.position.x - x, t.parent.position.z - z) < 260)) continue;
    const y = shownGround(x, z), grp = new THREE.Group(); grp.position.set(x, y - 1, z); grp.rotation.y = 0.6;
    grp.add(new THREE.Mesh(towerG, towerM));
    const nac = new THREE.Mesh(nacG, towerM); nac.position.set(0, 63, -0.5); grp.add(nac);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 4), TURB.red); lamp.position.set(0, 64.8, -1.5); grp.add(lamp);
    const rotor = new THREE.Group(); rotor.position.set(0, 63, 3.2); rotor.rotation.z = R() * TAU; grp.add(rotor);
    for (let k = 0; k < 3; k++){ const bl = new THREE.Mesh(bladeG, towerM); bl.rotation.z = k * TAU / 3; rotor.add(bl); }
    scene.add(grp); TURB.rotors.push(rotor);
  }
}
