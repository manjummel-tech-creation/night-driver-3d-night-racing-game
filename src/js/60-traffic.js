// =====================================================================================================
// TRAFFIC: cars live on the road graph (edge, distance along it, direction, lane). They follow the car ahead,
// change lanes to overtake, line up for exit ramps, merge from on-ramps, take turns at city crossings and pick a
// new road at every junction. Only the cars within about a kilometre of you exist; the rest are recycled.
// =====================================================================================================
const _ra = {}, _rb = {};
function laneD(e, dir, lane){ const C = e.C; if (e.oneway) return ((C.lanes - 1) / 2 - lane) * C.LW; return -dir * ((C.med || 0) + C.LW * (lane + 0.5)); }
function auxAt(e, s){ if (!e.auxF) return false; const r = edgeAt(e, s, _rb); return r.hr > e.C.hw + e.C.LW * 0.8; }
function lanesAt(e, s){ return e.C.lanes + (e.oneway && e.auxF && auxAt(e, s) ? 1 : 0); }
const endNode = (e, dir) => dir > 0 ? e.b : e.a;
const startNode = (e, dir) => dir > 0 ? e.a : e.b;
function headAt(e, dir, s){ const r = edgeAt(e, s, _rb); return dir > 0 ? r.h : r.h + Math.PI; }
// how far from a junction's centre a car leaves its road and starts its turn
for (const n of NODES){ let R = 0; if (n.type === 'x' || n.type === 'e'){ for (const p of patchesNear(n.x, n.z)) if (p.node === n) R = Math.max(R, p.sq ? p.sq + 1.5 : p.r + 1); } n.R = R; n.lock = { occ: new Set(), queue: [], qT: new Map(), green: -1, greenUntil: 0 }; }
const nodeR = (n, e) => n.R ? (e.cls === 'cw' ? Math.max(n.R, 16) : n.R) : 0;
// pick the road to take at the end of this one: mostly straight on, sometimes a turn, never back the way it came
function chooseNext(e, dir, rng = Math.random){
  const n = endNode(e, dir), arr = headAt(e, dir, dir > 0 ? e.len - 2 : 2);
  const opts = [];
  for (const [e2, d2] of n.out){
    if (e2 === e && d2 === -dir && n.out.length > 1) continue;
    if (e2.cls === 'dt' && e.cls !== 'dt') continue; // traffic never takes the dirt tracks
    const dep = headAt(e2, d2, d2 > 0 ? Math.min(6, e2.len) : Math.max(0, e2.len - 6)), da = Math.abs(angWrap(dep - arr));
    let w = da > 2.4 ? (n.out.length === 1 ? 1 : 0.0) : da < 0.4 ? 1 : da < 1.1 ? 0.7 : 0.5;
    if (e.cls === 'cw' && e2.cls === 'cw') w *= 3.2;
    if (e.cls === 'cw' && e2.cls === 'rp') w *= 0.28;
    if (e.cls === 'st' && e2.cls === 'cw') w *= 0.6;
    if (e2.cls === 'rd' && e.cls === 'st') w *= 0.5;
    if (w > 0) opts.push([e2, d2, w]);
  }
  if (!opts.length){ for (const [e2, d2] of n.out) opts.push([e2, d2, 1]); }
  let t = 0; for (const o of opts) t += o[2]; let r = rng() * t;
  for (const o of opts){ r -= o[2]; if (r <= 0) return { e: o[0], dir: o[1] }; }
  const o = opts[opts.length - 1]; return { e: o[0], dir: o[1] };
}
const startsInAux = (e2, d2) => d2 > 0 && e2.cls === 'rp' && e2.offA; // a ramp that peels off from the auxiliary lane
// the speed a car can take the road ahead at (lateral acceleration about 4.5 m/s²)
function curveLimit(e, s, dir){
  if (e.cls === 'st') return 99;
  let k = 0; const step = 10;
  for (let o = 0; o <= 60; o += step){
    const s1 = s + dir * o, s2 = s1 + dir * step; if (s1 < 0 || s2 < 0 || s1 > e.len || s2 > e.len) break;
    const h1 = edgeAt(e, s1, _rb).h, h2 = edgeAt(e, s2, _rb).h; k = Math.max(k, Math.abs(angWrap(h2 - h1)) / step);
  }
  return k < 1e-4 ? 99 : Math.sqrt(4.5 / k);
}
// traffic density: busy near cities and on expressways, quiet in the mountains and the far north, and it changes along the road
const DENS_SEED = Math.random() * 500;
function densityAt(e, s){
  const r = edgeAt(e, s, _rb);
  let d = e.cls === 'cw' ? 1 : e.cls === 'rp' ? 0.6 : e.cls === 'rd' ? 0.45 : e.cls === 'al' ? 0.5 : 1;
  d *= lerp(lerp(1, e.cls === 'rd' ? 0.7 : 0.75, mtnK(r.x, r.z)), 0.6, ruralK(r.z));
  for (const c of CITIES){ const dc = Math.hypot(r.x - c.x, r.z - c.z); if (dc < c.half + 6000){
    d *= lerp(1, c.id === 'tokai' ? 1.9 : c.id === 'nagisa' ? 1.6 : 1.4, 1 - smooth(c.half, c.half + 3500, dc)); // busier the nearer the city
    if (dc < c.half) d *= lerp(1.9, 1.3, dc / c.half); // and packed in the centre
    if (e.cls === 'cw' && dc < c.half + 6000) d *= lerp(1.45, 1, smooth(c.half, c.half + 6000, dc)); } } // the expressways into a city fill up as they get close
  d *= 1.32; // busier everywhere
  if (e.route === 'E1') d *= e.cls === 'cw' ? 1.85 : 1.4; // the E1, Hakone to Tokai to Hokuto, is the country's busiest road
  const n = vnoise(s / 2400 + e.id * 7.31, DENS_SEED + (e.pair ? Math.min(e.id, e.pair.id) : e.id) * 0.37);
  d *= lerp(0.5, 1.5, smooth(0.25, 0.8, n));
  return clamp(d, 0.03, 2.6);
}
const densityLabel = d => d > 0.95 ? 'JAM' : d > 0.65 ? 'HEAVY' : d > 0.3 ? 'MODERATE' : 'LIGHT';

// ---------- traffic cars: instanced, one set of meshes per vehicle type
const TRAFFIC_N = 320;
const HAZ_OFF = new THREE.Color(0.15, 0.08, 0.02);
const HALO_TEX = canvasTex(128, 64, g => { const gr = g.createRadialGradient(64, 32, 0, 64, 32, 60); gr.addColorStop(0, 'rgba(255,60,50,0.9)'); gr.addColorStop(0.35, 'rgba(255,30,30,0.35)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 64); });
const HALO_MAT = new THREE.MeshBasicMaterial({ map: HALO_TEX, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0, side: THREE.DoubleSide });
const HEADGLOW_MAT = new THREE.MeshBasicMaterial({ map: flareTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.6, side: THREE.DoubleSide });
const TINST = {};
const TRAFFIC_BODY_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.35 });
const TRAFFIC_TAIL_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
for (const k in TYPES){
  const g = TYPE_GEO[k], mk = (geo, mat, col) => { const m = new THREE.InstancedMesh(geo, mat, TRAFFIC_N); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); if (col) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TRAFFIC_N * 3), 3); scene.add(m); return m; };
  const t = TYPES[k];
  TINST[k] = { body: mk(g.body, TRAFFIC_BODY_MAT, true), glass: mk(g.glass, M_GLASS), wheels: mk(g.wheels, M_TIRE), tail: mk(g.tail, TRAFFIC_TAIL_MAT, true), head: mk(g.head, M_HEAD),
    halo: mk(new THREE.PlaneGeometry(t.wid * 1.5, 0.9).translate(0, t.len > 8 ? 1.0 : 0.85, -t.len / 2 - 0.4), HALO_MAT), glow: mk(new THREE.PlaneGeometry(t.wid * 1.3, 0.8).translate(0, t.len > 8 ? 1.1 : 0.7, t.len / 2 + 0.3), HEADGLOW_MAT) };
}
const typeBag = []; for (const k in TYPES) for (let i = 0; i < Math.round(TYPES[k].w * 100); i++) typeBag.push(k);
const traffic = [];
// online (see 87-net): the room's host runs the traffic for everyone. On the host, `centers` are the other players (so
// cars spawn round them and brake for them); on everyone else `remote` is on and `step` shows the host's cars instead.
// `off` is the solo-only switch that empties the roads
const TRAFFIC_NET = { remote: false, step: null, centers: [], off: false };
const nearAnyone = (x, z, r) => { if ((x - car.x) ** 2 + (z - car.z) ** 2 < r * r) return true; for (const p of TRAFFIC_NET.centers) if ((x - p.x) ** 2 + (z - p.z) ** 2 < r * r) return true; return false; };
for (let i = 0; i < TRAFFIC_N; i++){
  const type = typeBag[Math.floor(rnd() * typeBag.length)], t = TYPES[type];
  const pal = TYPE_COLORS[type] || TRAFFIC_COLORS, color = new THREE.Color(pal[Math.floor(rnd() * pal.length)]);
  traffic.push({ id: i, type, color, len: t.len, wid: t.wid, mass: t.mass, truck: !!t.big, mode: 'park', parkT: rnd() * 0.5,
    e: null, s: 0, dir: 1, lane: 0, tlane: 0, d: 0, latV: 0, v: 0, v0: 25, acc: 0, next: null, conn: null, wait: 0, stuck: 0,
    lc: 3 + rnd() * 6, hit: false, wreck: 0, rbT: 0, x: 0, y: 0, z: 0, h: 0, prevRel: 0, tailC: TAIL_DIM });
}
function setType(c, type){ if (!c.wasType) c.wasType = c.type; const t = TYPES[type]; c.type = type; c.len = t.len; c.wid = t.wid; c.mass = t.mass; c.truck = !!t.big; const pal = TYPE_COLORS[type] || TRAFFIC_COLORS; c.color = new THREE.Color(pal[Math.floor(rnd() * pal.length)]); }
function laneSpeed(c){
  const e = c.e, k = e.cls;
  if (k === 'cw'){ if (c.truck) return 21 + rnd() * 3.5; return [31.5, 27, 23, 22][Math.min(c.lane, 3)] + rnd() * 3.2; }
  if (k === 'rp') return 18 + rnd() * 2;
  if (k === 'rd'){ const m = mtnK(c.x, c.z); return (c.truck ? 16 : 19) + rnd() * 3 - m * 3; }
  if (k === 'al') return 7.5 + rnd() * 2;
  return (c.truck ? 10 : 12) + rnd() * 2.5;
}
// ---------- where cars may spawn: road samples every 25 m, bucketed on a 250 m grid
const SPAWN_GRID = new Map();
for (const e of EDGES){ if (e.cls === 'dt' || e.cls === 'rw') continue; for (let s = 30; s < e.len - 30; s += 25){ const r = edgeAt(e, s, _ra), k = Math.floor(r.x / 250) * 100000 + Math.floor(r.z / 250); let a = SPAWN_GRID.get(k); if (!a){ a = []; SPAWN_GRID.set(k, a); } a.push([e, s]); } }
const EDGE_CARS = new Map(); // edge id -> movers on it this frame (traffic and police)
function bucketMovers(){
  EDGE_CARS.clear();
  const add = c => { if (c.mode !== 'edge') return; let a = EDGE_CARS.get(c.e.id); if (!a){ a = []; EDGE_CARS.set(c.e.id, a); } a.push(c); };
  for (const c of traffic) add(c);
  for (const P of police) if (P.active) add(P);
}
// is this lane clear around s? (for spawning and lane changes)
function laneFree(e, dir, lane, s, self, ahead, behind, pBehind = 30){
  const cd = laneD(e, dir, lane);
  const a = EDGE_CARS.get(e.id);
  if (a) for (const o of a){
    if (o === self || o.dir !== dir) continue;
    if (Math.abs(o.d - cd) > 2.6 && Math.abs(laneD(e, dir, o.tlane) - cd) > 0.5) continue;
    const ds = (o.s - s) * dir; if (ds > -behind - o.len && ds < ahead + o.len) return false;
  }
  if (car.sup && car.sup.e === e && Math.abs(car.sup.d - cd) < 2.6){ const ds = (car.sup.s - s) * dir; if (ds > -behind - pBehind && ds < ahead + 4) return false; }
  return true;
}
function spawnCar(c, px, pz){
  for (let tries = 0; tries < 5; tries++){
    const a = rnd() * TAU, R = 430 + rnd() * 680, k = Math.floor((px + Math.cos(a) * R) / 250) * 100000 + Math.floor((pz + Math.sin(a) * R) / 250);
    const list = SPAWN_GRID.get(k); if (!list) continue;
    const [e, s] = list[Math.floor(rnd() * list.length)];
    if (rnd() * 1.6 > densityAt(e, s)) continue;
    const dir = e.oneway ? 1 : rnd() < 0.5 ? 1 : -1;
    if (c.truck && (e.cls === 'st' || e.cls === 'rp' || e.cls === 'al')) continue;
    const lane = c.truck && e.cls === 'cw' ? 1 + Math.floor(rnd() * 2) : Math.floor(rnd() * e.C.lanes);
    const r = edgeAt(e, s, _ra); if (nearAnyone(r.x, r.z, 380)) continue; // never pops in in front of anybody
    if (!laneFree(e, dir, lane, s, c, 45, 45)) continue;
    c.mode = 'edge'; c.e = e; c.s = s; c.dir = dir; c.lane = c.tlane = lane; c.d = laneD(e, dir, lane); c.latV = 0; c.x = r.x; c.z = r.z;
    // around Nagisa the port fills the roads with lorries
    if (!c.truck && e.cls === 'cw' && Math.hypot(r.x - CITY.nagisa.x, r.z - CITY.nagisa.z) < 6000 && rnd() < 0.35 && lane > 0) setType(c, 'truck');
    else if (c.truck && c.wasType && rnd() < 0.5) setType(c, c.wasType);
    c.v0 = laneSpeed(c); c.v = c.v0 * 0.92; c.next = chooseNext(e, dir); c.conn = null; c.hit = false; c.wreck = 0; c.rbT = 0; c.stuck = 0; c.wait = 0; c.ghost = 0; c.jamT = 0; c.heldT = 0; c.lc = 2 + rnd() * 8;
    c.prevRel = 0; c.careless = 0;
    let a2 = EDGE_CARS.get(e.id); if (!a2){ a2 = []; EDGE_CARS.set(e.id, a2); } a2.push(c);
    return true;
  }
  c.mode = 'park'; c.parkT = 0.15 + rnd() * 0.4; return false;
}
function parkCar(c){ if (c.conn) releaseLock(c); c.mode = 'park'; c.parkT = 0.2 + rnd() * 0.6; c.conn = null; }
// junction turn-taking, like traffic lights: each approach gets a few seconds of green in the order cars arrived
const lockKey = c => c.e.id * 2 + (c.dir > 0 ? 1 : 0);
function canEnter(n, c){
  if (c.police || !n.R) return true;
  const L = n.lock, key = lockKey(c);
  if (n.type === 'e'){ for (const o of L.occ){ if (o.mode !== 'conn' || !o.conn || o.conn.node !== n){ L.occ.delete(o); continue; } return false; } return true; } // turning round at a dead end: one at a time
  if (n.links.length < 3) return true;
  for (const o of L.occ){ if (o.mode !== 'conn' || !o.conn || o.conn.node !== n){ L.occ.delete(o); continue; } if (o.lockFrom !== key) return false; }
  if (L.green === key && simT < L.greenUntil){ L.lastUse = simT; return true; }
  if (simT < L.greenUntil && simT - (L.lastUse || 0) < 1.2) return false; // someone else's green, still in use
  while (L.queue.length && simT - (L.qT.get(L.queue[0]) || 0) > 1.2) L.queue.shift(); // nobody waiting there any more
  if (!L.queue.length || L.queue[0] === key){ if (L.queue[0] === key) L.queue.shift(); L.green = key; L.greenUntil = simT + 5; L.lastUse = simT; return true; }
  return false;
}
function waitAt(n, c){ const L = n.lock, key = lockKey(c); L.qT.set(key, simT); if (L.green !== key && !L.queue.includes(key)) L.queue.push(key); }
function releaseLock(c){ if (c.conn && c.conn.node) c.conn.node.lock.occ.delete(c); }
// a curve through the junction from where the car is to its lane on the next road
function buildConn(c){
  const n = endNode(c.e, c.dir), nx = c.next, e2 = nx.e, d2 = nx.dir;
  const R2 = Math.min(nodeR(n, e2), e2.len / 2 - 1), s2 = d2 > 0 ? R2 : e2.len - R2;
  const lanes2 = e2.C.lanes, lane2 = Math.min(c.lane, lanes2 - 1);
  const r2 = edgeAt(e2, s2, {}), dd = laneD(e2, d2, lane2), p3x = r2.x + r2.nx * dd, p3z = r2.z + r2.nz * dd, h3 = d2 > 0 ? r2.h : r2.h + Math.PI;
  const p0x = c.x, p0z = c.z, h0 = c.h, Ld = Math.hypot(p3x - p0x, p3z - p0z), uturn = Math.abs(angWrap(h3 - h0)) > 2.5, k = uturn ? Math.max(9, Ld * 0.9) : Ld * 0.42;
  const P = [p0x, p0z, p0x + Math.sin(h0) * k, p0z + Math.cos(h0) * k, p3x - Math.sin(h3) * k, p3z - Math.cos(h3) * k, p3x, p3z];
  let len = 0, px = p0x, pz = p0z; for (let i = 1; i <= 12; i++){ const q = bez(P, i / 12); len += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }
  let pl = null; const rb = n.patch && n.patch.rb;
  if (rb){ // round the island, anticlockwise (traffic keeps right)
    const ang = (x, z) => Math.atan2(-(z - n.z), x - n.x), a0 = ang(p0x, p0z); let da = ang(p3x, p3z) - a0; while (da < 0.5) da += TAU;
    const off = Math.min(0.5, da * 0.3), m = Math.max(3, Math.ceil(da / 0.22)), rc = rb.rc + (rb.two && da < 2 ? 1.6 : 0), X = [p0x], Z = [p0z];
    for (let i = 0; i <= m; i++){ const a = a0 + off + (da - 2 * off) * i / m; X.push(n.x + Math.cos(a) * rc); Z.push(n.z - Math.sin(a) * rc); }
    X.push(p3x); Z.push(p3z); const cum = [0]; for (let i = 1; i < X.length; i++) cum.push(cum[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]));
    pl = { X, Z, cum }; len = cum[cum.length - 1];
  }
  c.conn = { P, pl, len: Math.max(1, len), u: 0, y0: c.y, y3: r2.y, node: n, e2, d2, s2, lane2 };
  c.mode = 'conn'; c.lockFrom = lockKey(c); n.lock.occ.add(c);
}
function bez(P, t){ const u = 1 - t, a = u * u * u, b = 3 * u * u * t, cc = 3 * u * t * t, d = t * t * t; return [a * P[0] + b * P[2] + cc * P[4] + d * P[6], a * P[1] + b * P[3] + cc * P[5] + d * P[7]]; }
function bezD(P, t){ const u = 1 - t; return [3 * u * u * (P[2] - P[0]) + 6 * u * t * (P[4] - P[2]) + 3 * t * t * (P[6] - P[4]), 3 * u * u * (P[3] - P[1]) + 6 * u * t * (P[5] - P[3]) + 3 * t * t * (P[7] - P[5])]; }
// move a car from the end of its road onto the next one without a jump (for junctions without a patch: splits and merges)
function switchEdge(c, over){
  const nx = c.next, e2 = nx.e, d2 = nx.dir, s2 = d2 > 0 ? Math.min(over, e2.len) : Math.max(0, e2.len - over);
  const r2 = edgeAt(e2, s2, _ra), d = (c.x - r2.x) * r2.nx + (c.z - r2.z) * r2.nz;
  c.e = e2; c.dir = d2; c.s = s2; c.d = d;
  // lane on the new road: whichever is closest (a car arriving off a ramp lands in the auxiliary lane)
  const nl = lanesAt(e2, s2); let best = 0, bd = Infinity; for (let l = 0; l < nl; l++){ const q = Math.abs(laneD(e2, d2, l) - d); if (q < bd){ bd = q; best = l; } }
  c.lane = c.tlane = best; c.v0 = laneSpeed(c); c.next = chooseNext(e2, d2);
}

// how many cars the roads around you should hold right now: busy roads near cities, almost nobody on a mountain pass
const PER_SAMPLE = { cw: 0.42, rp: 0.12, rd: 0.16, st: 0.3, al: 0.1, ln: 0.05, mt: 0.035, rw: 0, dt: 0 }; // cars per 25 m of road at density 1
let trafficTarget = TRAFFIC_N, targetT = 0;
function computeTarget(px, pz){
  const R = 1100, cx = Math.floor(px / 250), cz = Math.floor(pz / 250), n = Math.ceil(R / 250); let sum = 0;
  for (let ox = -n; ox <= n; ox++) for (let oz = -n; oz <= n; oz++){
    const list = SPAWN_GRID.get((cx + ox) * 100000 + cz + oz); if (!list) continue;
    const mx = (cx + ox + 0.5) * 250, mz = (cz + oz + 0.5) * 250; if (Math.hypot(mx - px, mz - pz) > R + 180) continue;
    for (let k = 0; k < list.length; k += 4){ const [e, s] = list[k]; sum += densityAt(e, s) * PER_SAMPLE[e.cls] * 4; }
  }
  return Math.min(TRAFFIC_N, Math.round(sum));
}
let spawnRR = 0;
function updateTraffic(dt){
  if (TRAFFIC_NET.off){ for (const c of traffic) if (c.mode !== 'park') parkCar(c); bucketMovers(); return; } // traffic switched off (solo only)
  if (TRAFFIC_NET.remote && TRAFFIC_NET.step){ TRAFFIC_NET.step(dt); return; }                               // showing the room host's traffic
  bucketMovers();
  const px = car.x, pz = car.z, C = [[px, pz]]; for (const p of TRAFFIC_NET.centers) C.push([p.x, p.z]);
  const dMin = (x, z) => { let d = Infinity; for (const [cx, cz] of C) d = Math.min(d, Math.hypot(x - cx, z - cz)); return d; };
  targetT -= dt; if (targetT <= 0){ targetT = 1.5; let sum = 0; C.forEach(([cx, cz], i) => { if (i === 0 || C.slice(0, i).every(([ax, az]) => Math.hypot(ax - cx, az - cz) > 1500)) sum += computeTarget(cx, cz); }); trafficTarget = Math.min(TRAFFIC_N, sum); }
  let active = 0; for (const c of traffic) if (c.mode !== 'park') active++;
  let spawns = 0;
  for (const c of traffic){
    if (c.mode === 'net'){ parkCar(c); continue; } // left over from showing a host's traffic
    if (c.mode === 'park'){ c.parkT -= dt; if (c.parkT <= 0 && spawns < 8 && active < trafficTarget){ spawns++; const [sx, sz] = C[spawnRR++ % C.length]; if (spawnCar(c, sx, sz)) active++; } else if (c.parkT <= 0) c.parkT = 0.3 + rnd() * 0.5; continue; }
    // too many for this stretch: quietly drop ones that are far away
    const dp = dMin(c.x, c.z);
    if (active > trafficTarget * 1.15 + 2 && dp > 800){ parkCar(c); active--; continue; }
    // far away from everybody: recycle
    if (dp > 1350 || (c.stuck > 20 && dp > 120)){ parkCar(c); continue; }
    if (c.mode === 'conn'){ moveConn(c, dt); continue; }
    moveOnEdge(c, dt);
  }
}
function leaderOnEdge(c, e, dir, sFrom, lat, range){ // nearest mover ahead on (e, dir) whose lane overlaps lat
  let gap = Infinity, lv = 0; const a = EDGE_CARS.get(e.id); if (!a) return [gap, lv];
  for (const o of a){
    if (o === c || o.dir !== dir) continue;
    if (Math.abs(o.d - lat) > (o.wid + c.wid) / 2 + 0.45) continue;
    const ds = (o.s - sFrom) * dir; if (ds <= 0 || ds > range) continue;
    const g = ds - (o.len + c.len) / 2; if (g < gap){ gap = g; lv = o.v; }
  }
  return [gap, lv];
}
function moveOnEdge(c, dt){
  if (!c.next) c.next = chooseNext(c.e, c.dir);
  const e = c.e, rem = c.dir > 0 ? e.len - c.s : c.s, n = endNode(e, c.dir);
  // lane plan: get into the auxiliary lane for an exit, get out of it before it ends
  const nl = lanesAt(e, c.s), auxL = e.C.lanes;
  let wantLane = c.tlane;
  const exiting = c.next && startsInAux(c.next.e, c.next.dir) && n.type === 'y';
  if (exiting){
    if (rem < 900 && c.tlane < auxL - 1 && rem > 120) wantLane = c.tlane + 1;
    if (nl > auxL && c.tlane >= auxL - 1) wantLane = auxL;
    if (rem < 70 && c.tlane !== auxL) c.next = { e: n.out.find(([e2, d2]) => !startsInAux(e2, d2) && e2 !== e)?.[0] || c.next.e, dir: 1 };
  } else if (c.tlane >= auxL && e.oneway){
    const endsSoon = lanesAt(e, c.s + c.dir * (50 + c.v * 2.5)) <= auxL || rem < 140;
    if (endsSoon) wantLane = auxL - 1;
  }
  if (c.tlane >= lanesAt(e, c.s) && !exiting) wantLane = Math.max(0, lanesAt(e, c.s) - 1);
  // following: the car ahead in this lane, then on the next road, then you
  let [gap, lv] = leaderOnEdge(c, e, c.dir, c.s, c.d, 260);
  if (rem < 140 && c.next){
    const e2 = c.next.e, d2 = c.next.dir, s0 = d2 > 0 ? -rem : e2.len + rem;
    const [g2, l2] = leaderOnEdge(c, e2, d2, s0, laneD(e2, d2, Math.min(c.lane, e2.C.lanes - 1)), 260); if (g2 < gap){ gap = g2; lv = l2; }
    for (const o of n.lock.occ){ if (o === c) continue; const dd = Math.hypot(o.x - c.x, o.z - c.z) - (o.len + c.len) / 2; const fw = (o.x - c.x) * Math.sin(c.h) + (o.z - c.z) * Math.cos(c.h); if (fw > 0 && dd < gap){ gap = dd; lv = 0; } }
  }
  // you: on the same road, or anywhere just in front
  let byPlayer = false;
  { const sp = car.sup; let g = Infinity;
    if (sp && sp.e === e){ const ds = (sp.s - c.s) * c.dir; if (ds > 0 && Math.abs(sp.d - c.d) < c.wid / 2 + 1.35) g = ds - c.len / 2 - 2.3; }
    else { const fw = (car.x - c.x) * Math.sin(c.h) + (car.z - c.z) * Math.cos(c.h), lt = (car.x - c.x) * Math.cos(c.h) - (car.z - c.z) * Math.sin(c.h); if (fw > 0 && fw < 40 && Math.abs(lt) < c.wid / 2 + 1.4 && Math.abs(car.y - c.y) < 3) g = fw - c.len / 2 - 2.3; }
    if (c.ghost > 0){ gap = Infinity; lv = 0; } // squeezing past a jam: only you count
    if (g < gap){ gap = g; lv = Math.max(0, Math.hypot(car.vx, car.vy) * Math.cos(angWrap(car.h - c.h))); byPlayer = g < 25; }
  }
  // friends in an online room: brake for them the same way
  for (const p of TRAFFIC_NET.centers){ const fw = (p.x - c.x) * Math.sin(c.h) + (p.z - c.z) * Math.cos(c.h); if (fw <= 0 || fw > 40) continue;
    const lt = (p.x - c.x) * Math.cos(c.h) - (p.z - c.z) * Math.sin(c.h); if (Math.abs(lt) > c.wid / 2 + 1.4 || Math.abs(p.y - c.y) > 3) continue;
    const g = fw - c.len / 2 - 2.3; if (g < gap){ gap = g; lv = Math.max(0, p.v * Math.cos(angWrap(p.h - c.h))); } }
  // the junction ahead: wait your turn
  const R = nodeR(n, e);
  let stopAt = Infinity;
  if (R && c.next){
    if (rem < R + 0.5){ if (c.ghost > 0 || canEnter(n, c)){ buildConn(c); moveConn(c, dt); return; } }
    if (rem < R + 40 && !(c.ghost > 0) && !canEnter(n, c)){ waitAt(n, c); stopAt = rem - R - 1.0; }
  }
  if (stopAt < gap){ gap = Math.max(0, stopAt); lv = 0; }
  // speed
  let v0 = c.v0 * (1 - 0.15 * weather.wet);
  v0 = Math.min(v0, curveLimit(e, c.s, c.dir));
  if (R && rem < 60){ const turn = Math.abs(angWrap(headAt(c.next.e, c.next.dir, c.next.dir > 0 ? 3 : c.next.e.len - 3) - c.h)); if (turn > 0.5) v0 = Math.min(v0, lerp(14, 7, clamp((turn - 0.5) / 1.2, 0, 1)) + rem * 0.15); }
  let a;
  if (c.wreck > 0){ c.wreck -= dt; a = -6; }
  else {
    const s0 = 4, T = 1.2, am = c.truck ? 1.0 : 1.8, bm = 3.2, dv = c.v - lv, sStar = s0 + Math.max(0, c.v * T + c.v * dv / (2 * Math.sqrt(am * bm)));
    a = am * (1 - Math.pow(c.v / Math.max(1, v0), 4) - (gap < 1e8 ? (sStar / Math.max(gap, 0.5)) ** 2 : 0));
    a = Math.max(a, -9);
    if (c.rbT > 0){ c.rbT -= dt; a = Math.min(a, -3.8); } else if (c.v > 15 && Math.random() < dt * (0.012 + weather.fog * 0.01)) c.rbT = 0.6 + Math.random() * 1.4; // now and then someone taps the brakes
  }
  c.acc = a; c.v = Math.max(0, c.v + a * dt);
  if (gap < 0.3) c.v = Math.min(c.v, lv);
  c.stuck = c.v < 0.5 && c.wreck <= 0 ? c.stuck + dt : 0;
  if (unjam(c, byPlayer, dt)) return;
  // lane changes: overtake slower cars, otherwise drift back to the right; follow the lane plan
  c.lc -= dt;
  const nlanes = lanesAt(e, c.s);
  if (Math.abs(c.d - laneD(e, c.dir, c.tlane)) < 0.25 && c.wreck <= 0){
    if (wantLane !== c.tlane){ const l = c.tlane + Math.sign(wantLane - c.tlane); if (l >= 0 && l < Math.max(nlanes, lanesAt(e, c.s + c.dir * 25)) && laneFree(e, c.dir, l, c.s, c, 22, 14, 6)){ c.tlane = l; c.lane = l; } else if (exiting === false && c.tlane >= auxL && rem < 60) c.v = Math.max(0, c.v - 4 * dt); }
    else if (c.lc <= 0 && e.C.lanes > 1 && rem > 120){
      c.lc = 3 + rnd() * 7;
      const blocked = gap < 55 && lv < c.v0 - 2, L1 = c.tlane - 1, R1 = c.tlane + 1, top = e.C.lanes, minL = c.truck && e.cls === 'cw' ? 1 : 0;
      if (blocked && L1 >= minL && laneFree(e, c.dir, L1, c.s, c, 28, 18)) c.tlane = L1;
      else if (blocked && R1 < top && laneFree(e, c.dir, R1, c.s, c, 28, 18)) c.tlane = R1;
      else if (!blocked && R1 < top && rnd() < 0.3 && laneFree(e, c.dir, R1, c.s, c, 40, 20)) c.tlane = R1;
      if (c.tlane !== c.lane){ c.lane = c.tlane; c.v0 = laneSpeed(c); }
    }
  }
  const want = clamp((laneD(e, c.dir, c.tlane) - c.d) * 1.4, -1.5, 1.5);
  c.latV += (want - c.latV) * Math.min(1, dt * 3);
  c.d += c.latV * dt;
  // advance; at the end of the road, on to the next one
  c.s += c.v * dt * c.dir;
  if (c.s > e.len || c.s < 0){
    const over = c.s > e.len ? c.s - e.len : -c.s;
    if (!c.next) c.next = chooseNext(e, c.dir);
    placeMover(c); switchEdge(c, over);
  }
  placeMover(c);
}
function moveConn(c, dt){
  const K = c.conn;
  // brake for whatever is in front inside the junction, and for you
  let v0 = 13, byPlayer = false;
  { const sh = Math.sin(c.h), ch = Math.cos(c.h), ahead = (x, z, len) => { const fw = (x - c.x) * sh + (z - c.z) * ch, lt = (x - c.x) * ch - (z - c.z) * sh; if (fw > 0 && fw < 16 && Math.abs(lt) < 2.2) v0 = Math.min(v0, Math.max(0, (fw - len / 2 - c.len / 2 - 1.2) * 1.3)); };
    ahead(car.x, car.z, 4.6); if (v0 < 2) byPlayer = true;
    if (!(c.ghost > 0)) for (const o of traffic){ if (o === c || o.mode === 'park') continue; const dx = o.x - c.x, dz = o.z - c.z; if (dx * dx + dz * dz < 400) ahead(o.x, o.z, o.len); } }
  const turn = Math.abs(angWrap((K.d2 > 0 ? edgeAt(K.e2, K.s2, _ra).h : edgeAt(K.e2, K.s2, _ra).h + Math.PI) - c.h));
  v0 = Math.min(v0, K.pl ? 8.5 : lerp(16, 6, clamp(turn / 1.5, 0, 1)));
  if (c.wreck > 0){ c.wreck -= dt; v0 = 0; }
  c.v += clamp(v0 - c.v, -8 * dt, 2.5 * dt); c.v = Math.max(0, c.v); c.acc = 0;
  K.u = Math.min(1, K.u + c.v * dt / K.len);
  if (K.pl){ const L = K.pl, sd = K.u * K.len; let i = 1; while (i < L.cum.length - 1 && L.cum[i] < sd) i++; const t = clamp((sd - L.cum[i - 1]) / Math.max(1e-6, L.cum[i] - L.cum[i - 1]), 0, 1);
    c.x = lerp(L.X[i - 1], L.X[i], t); c.z = lerp(L.Z[i - 1], L.Z[i], t); const hT = Math.atan2(L.X[i] - L.X[i - 1], L.Z[i] - L.Z[i - 1]); c.h += angWrap(hT - c.h) * Math.min(1, dt * 9); }
  else { const q = bez(K.P, K.u), dq = bezD(K.P, K.u); c.x = q[0]; c.z = q[1]; c.h = Math.atan2(dq[0], dq[1]); }
  c.y = lerp(K.y0, K.y3, K.u); c.slope = 0;
  c.stuck = c.v < 0.5 ? c.stuck + dt : 0;
  if (unjam(c, byPlayer, dt)) return;
  if (K.u >= 1){
    releaseLock(c);
    c.mode = 'edge'; c.e = K.e2; c.dir = K.d2; c.s = K.s2; c.lane = c.tlane = K.lane2; c.d = laneD(K.e2, K.d2, K.lane2); c.latV = 0; c.conn = null;
    c.v0 = c.police ? c.v0 : laneSpeed(c); c.next = c.police ? c.next : chooseNext(c.e, c.dir);
    placeMover(c);
  }
}
// a car that has sat still for a while with nobody but other traffic in its way squeezes on through, so jams always clear
// (only you can hold a car up for good). One stuck for long and out of your sight is quietly recycled
function unjam(c, byPlayer, dt){
  if (c.ghost > 0) c.ghost -= dt;
  if (c.police || c.wreck > 0) return false;
  if (byPlayer){ // waiting for you: if you're stuck too (boxed in), it gives up and leaves rather than wait for ever
    c.jamT = 0; c.heldT = Math.hypot(car.vx, car.vy) < 2 ? (c.heldT || 0) + dt : 0;
    if (c.heldT > 4 && Math.hypot(c.x - car.x, c.z - car.z) < 16){ c.heldT = 0; parkCar(c); return true; }
    return false; }
  c.heldT = 0;
  c.jamT = c.v < 0.5 ? (c.jamT || 0) + dt : 0;
  if (c.jamT > 5){ c.jamT = 0; c.ghost = 4; }
  return false;
}
function placeMover(c){
  const r = edgeAt(c.e, clamp(c.s, 0, c.e.len), _ra);
  c.x = r.x + r.nx * c.d; c.z = r.z + r.nz * c.d; c.y = r.y; c.slope = r.slope * c.dir;
  c.h = (c.dir > 0 ? r.h : r.h + Math.PI) + clamp(c.dir * Math.atan2(c.latV, Math.max(c.v, 3)), -0.3, 0.3); // turned slightly into a lane change
}
// draw: write every live car into its type's instanced meshes
const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _te = new THREE.Euler(), _tp = new THREE.Vector3(), _ts = new THREE.Vector3(1, 1, 1);
function drawTraffic(t){
  const cnt = {}; for (const k in TINST) cnt[k] = 0;
  const blink = (t * 2.2) % 1 < 0.5, glowOn = 1 - DAY.dayF;
  for (const c of traffic){
    if (c.mode === 'park') continue;
    const I = TINST[c.type], i = cnt[c.type]++;
    _te.set(-Math.atan(c.slope || 0), c.h, 0, 'YXZ'); _tq.setFromEuler(_te); _tp.set(c.x, c.y, c.z); _tm.compose(_tp, _tq, _ts);
    for (const k of ['body', 'glass', 'wheels', 'tail', 'head', 'halo', 'glow']) I[k].setMatrixAt(i, _tm);
    I.body.setColorAt(i, c.color);
    const br = c.acc < -0.9 || c.v < 0.5;
    I.tail.setColorAt(i, c.wreck > 0 ? (blink ? HAZ : HAZ_OFF) : br ? TAIL_BRAKE : TAIL_DIM);
  }
  for (const k in TINST){ const I = TINST[k], n = cnt[k];
    for (const p of ['body', 'glass', 'wheels', 'tail', 'head', 'halo', 'glow']){ I[p].count = n; I[p].instanceMatrix.needsUpdate = true; }
    if (n){ I.body.instanceColor.needsUpdate = true; I.tail.instanceColor.needsUpdate = true; }
    I.halo.visible = weather.fog > 0.02; I.glow.visible = glowOn > 0.2; }
  HALO_MAT.opacity = 0.75 * weather.fog; HEADGLOW_MAT.opacity = 0.55 * (1 - DAY.dayF) * (0.6 + 0.4 * weather.fog);
}
// horn and high beams: slower cars in your lane move over if they can
function yieldFrom(e, s, d, dir, range){
  const a = EDGE_CARS.get(e.id); if (!a) return;
  for (const c of a){
    if (c.police || c.dir !== dir || c.wreck > 0) continue;
    const rel = (c.s - s) * dir; if (rel < 5 || rel > range || Math.abs(c.d - d) > 2.2) continue;
    for (const l of [c.tlane + 1, c.tlane - 1]) if (l >= 0 && l < c.e.C.lanes && laneFree(c.e, c.dir, l, c.s, c, 20, 10, 2)){ c.tlane = c.lane = l; c.lc = 5 + rnd() * 4; break; }
  }
}
