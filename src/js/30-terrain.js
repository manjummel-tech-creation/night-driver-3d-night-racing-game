// =====================================================================================================
// TERRAIN: 400 m chunks streamed in around you, coloured by region (forest, mountain rock and snow, farm fields)
// =====================================================================================================
const CH = 400, CH_STEP = 16, CH_N = CH / CH_STEP, CH_R = 2000;
const TERRAIN_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const chunks = new Map();
const FIELD_COLS = [[0.34, 0.3, 0.12], [0.13, 0.21, 0.08], [0.22, 0.16, 0.09], [0.27, 0.28, 0.15], [0.18, 0.25, 0.1], [0.36, 0.33, 0.16]];
function groundColor(x, z, y, out){
  const m = mtnK(x, z), r = ruralK(z), v = 0.85 + 0.3 * vnoise(x * 0.02, z * 0.02);
  // forest floor
  let cr = 0.07, cg = 0.1, cb = 0.075;
  if (r > 0.01){ // farmland: a patchwork of fields with dark hedgerows between them
    const a = 0.35, fx = x * Math.cos(a) - z * Math.sin(a), fz = x * Math.sin(a) + z * Math.cos(a);
    const gx = Math.floor(fx / 190), gz = Math.floor(fz / 150), c = FIELD_COLS[Math.floor(hash2(gx, gz) * FIELD_COLS.length)];
    const ex = Math.min(fx / 190 - gx, 1 - (fx / 190 - gx)) * 190, ez = Math.min(fz / 150 - gz, 1 - (fz / 150 - gz)) * 150, hedge = smooth(2, 6, Math.min(ex, ez));
    const rows = 0.93 + 0.07 * Math.sin(fx * 0.9);
    cr = lerp(cr, lerp(0.05, c[0] * rows, hedge), r); cg = lerp(cg, lerp(0.08, c[1] * rows, hedge), r); cb = lerp(cb, lerp(0.04, c[2] * rows, hedge), r);
  }
  if (m > 0.01){ // mountains: grass, then bare rock, then snow on the high peaks
    const rock = smooth(1000, 1250, y), snow = smooth(1250, 1380, y + 40 * vnoise(x * 0.01, z * 0.01)); // forest up the slopes, then rock, then snow on the high peaks
    cr = lerp(cr, lerp(lerp(0.08, 0.17, rock), 0.62, snow), m); cg = lerp(cg, lerp(lerp(0.11, 0.16, rock), 0.64, snow), m); cb = lerp(cb, lerp(lerp(0.075, 0.16, rock), 0.7, snow), m);
  }
  const jk = jukaiK(x, z); if (jk > 0){ const moss = vnoise(x * 0.05, z * 0.05); cr = lerp(cr, 0.03 + 0.03 * moss, jk); cg = lerp(cg, 0.06 + 0.05 * moss, jk); cb = lerp(cb, 0.035 + 0.02 * moss, jk); } // moss and black lava rock under the sea of trees
  for (const L of LAKES){ const q = lakeQ(L, x, z); if (q < 1.25){ const sand = 1 - smooth(1.0, 1.25, q); cr = lerp(cr, 0.24, sand * 0.7); cg = lerp(cg, 0.21, sand * 0.7); cb = lerp(cb, 0.15, sand * 0.7); } }
  out[0] = cr * v; out[1] = cg * v; out[2] = cb * v;
}
const _gc = [0, 0, 0];
const _cr = [], _chr = {};
// the ground heights for a chunk's 16 m grid, kept clear of every road, junction and forecourt
function chunkHeights(cx, cz){
  const N = CH_N + 1, x0 = cx * CH, z0 = cz * CH;
  const H = new Float32Array((N + 2) * (N + 2));
  for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) H[(j + 1) * (N + 2) + i + 1] = groundAt(x0 + i * CH_STEP, z0 + j * CH_STEP);
  // the ground mesh is a 16 m grid: any grid point within one step of a forecourt or junction sits under it, so no triangle can poke through
  for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++){
    const x = x0 + i * CH_STEP, z = z0 + j * CH_STEP, k = (j + 1) * (N + 2) + i + 1;
    for (const p of padsNear(x, z)) if (padContains(p, x, z, p.y0, CH_STEP + 1)) H[k] = Math.min(H[k], _pq.y - 0.35);
    for (const p of patchesNear(x, z)) if (patchContains(p, x, z, CH_STEP * 1.45)) H[k] = Math.min(H[k], p.y - 0.4);
    // and every road: a grid point within a step of its edge sits below it, so no ground triangle can reach up through the road
    if (roadDist(x, z) < 60){ roadsNear(x, z, _cr); for (const q of _cr){ const side = q.d >= 0 ? q.hl : q.hr, out = (Math.abs(q.along) > 1 ? q.dist : Math.abs(q.d)) - side; if (out < CH_STEP * 1.45 && Math.abs(q.along) < CH_STEP * 1.5) H[k] = Math.min(H[k], q.y - 0.35 - Math.abs(edgeAt(q.e, q.s, _chr).slope) * 24); } } // on a slope the road a step away along it may be lower: allow for it
  }
  return H;
}
function buildChunk(cx, cz){
  const N = CH_N + 1, x0 = cx * CH, z0 = cz * CH, H = chunkHeights(cx, cz);
  const pos = new Float32Array(N * N * 3), nor = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const o = (j * N + i) * 3, h = (a, b) => H[(b + 1) * (N + 2) + a + 1], y = h(i, j), x = x0 + i * CH_STEP, z = z0 + j * CH_STEP;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
    let nx = h(i - 1, j) - h(i + 1, j), nz = h(i, j - 1) - h(i, j + 1), ny = 2 * CH_STEP; const l = Math.hypot(nx, ny, nz); nor[o] = nx / l; nor[o + 1] = ny / l; nor[o + 2] = nz / l;
    groundColor(x, z, y, _gc); const steep = 1 - ny / l; const k = 1 + steep * 0.6; col[o] = _gc[0] * k; col[o + 1] = _gc[1] * (1 - steep * 0.2); col[o + 2] = _gc[2] * k;
    { const nat = natural(x, z), cut = smooth(1, 4, nat - y), fill = smooth(0.5, 3, y - nat), rv = 0.8 + 0.4 * vnoise(x * 0.05, y * 0.08);
      const cliff = Math.max(cut, smooth(0.45, 0.65, steep) * (1 - fill)) * smooth(0.25, 0.5, steep) * mtnK(x, z); // where the road is cut into the hillside: a rock face
      col[o] = lerp(col[o], 0.27 * rv, cliff); col[o + 1] = lerp(col[o + 1], 0.25 * rv, cliff); col[o + 2] = lerp(col[o + 2], 0.23 * rv, cliff);
      if (fill > 0){ const k2 = fill * 0.85; col[o] = lerp(col[o], 0.11 * rv, k2); col[o + 1] = lerp(col[o + 1], 0.15 * rv, k2); col[o + 2] = lerp(col[o + 2], 0.07 * rv, k2); } } // a bank built up under the road: grassy earth
  }
  const idx = new Uint16Array(CH_N * CH_N * 6); let q = 0;
  for (let j = 0; j < CH_N; j++) for (let i = 0; i < CH_N; i++){ const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, TERRAIN_MAT); mesh.matrixAutoUpdate = false; scene.add(mesh);
  return { mesh, H, x0, z0, trees: null };
}

// ---------- trees: pines in the forest and mountains, broadleaf trees and hedgerows on the farms
const TREE_K = 520, TREE_BLOCKS = 100;
const pineCrown = new THREE.ConeGeometry(2.4, 8, 7).translate(0, 6.5, 0), pineTrunk = new THREE.CylinderGeometry(0.25, 0.35, 2.6, 5).translate(0, 1.3, 0);
const leafCrown = new THREE.IcosahedronGeometry(3.2, 0).scale(1, 0.85, 1).translate(0, 5.6, 0);
const TREES = {
  pine: { crown: new THREE.InstancedMesh(pineCrown, new THREE.MeshLambertMaterial({ color: 0xffffff }), TREE_K * TREE_BLOCKS), trunk: new THREE.InstancedMesh(pineTrunk, new THREE.MeshLambertMaterial({ color: 0x2a2018 }), TREE_K * TREE_BLOCKS) },
  leaf: { crown: new THREE.InstancedMesh(leafCrown, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), TREE_K * TREE_BLOCKS), trunk: new THREE.InstancedMesh(pineTrunk, new THREE.MeshLambertMaterial({ color: 0x2a2018 }), TREE_K * TREE_BLOCKS) },
};
for (const k in TREES){ const T2 = TREES[k]; for (const m of [T2.crown, T2.trunk]){ m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); } T2.crown.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TREE_K * TREE_BLOCKS * 3), 3); }
const freeBlocks = []; for (let b = TREE_BLOCKS - 1; b >= 0; b--) freeBlocks.push(b);
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
const _tc = new THREE.Color();
const _treeQ = [];
// never on (or hanging over) a road, a junction, a forecourt or a building
function treeBlocked(x, z){
  if (roadDist(x, z) < 70){ roadsNear(x, z, _treeQ); for (const q of _treeQ){ const side = q.d >= 0 ? q.hl : q.hr, out = (Math.abs(q.along) > 1 ? q.dist : Math.abs(q.d)) - side; if (out < (q.e.jukai ? 2.2 : 6)) return true; } } // the forest trails run through a tunnel of trees
  for (const p of patchesNear(x, z)) if (patchContains(p, x, z, p.node.jukai ? 3 : 7)) return true;
  for (const c of JUKAI_NET.clear) if (Math.hypot(x - c.x, z - c.z) < c.r) return true;
  for (const p of padsNear(x, z)) if (Math.abs(x - p.cx) < p.rad + 8 && Math.abs(z - p.cz) < p.rad + 8) return true;
  for (const o of staticNear(x, z)) if (Math.hypot(x - o.x, z - o.z) < Math.hypot(o.hw, o.hl) + 3) return true;
  return false;
}
function treeSpots(ch, cx, cz){ // deterministic per chunk
  const R = mulberry(cx * 7919 + cz * 104729 + 17), out = { pine: [], leaf: [] };
  const zc = cz * CH + CH / 2, m = mtnK(cx * CH + CH / 2, zc), jk = Math.max(jukaiK(cx * CH + CH / 2, zc), jukaiK(cx * CH, cz * CH), jukaiK(cx * CH + CH, cz * CH + CH)), r = ruralK(zc) * (1 - jk);
  const tries = jk > 0.02 ? 1150 : Math.round(lerp(lerp(270, 430, m), 70, r)); // the mountains are thick with forest; the sea of trees is solid with it
  for (let t = 0; t < tries; t++){
    const x = ch.x0 + R() * CH, z = ch.z0 + R() * CH, rv = R(), sc = 0.7 + R() * 0.9, ry = R() * TAU, cv = R();
    const jx = jk > 0.02 ? jukaiK(x, z) : 0;
    if (jx < 0.3 && jk > 0.02 && R() < 0.6) continue; // thinning out towards the edge of the sea of trees
    if (roadDist(x, z) < (jx > 0.3 ? 4 : m > 0.5 ? 13 : 30)) continue; // in the mountains the forest comes right down to the road
    if (treeBlocked(x, z)) continue;
    let onPad = false; for (const p of padsNear(x, z)) if (Math.abs(x - p.cx) < p.rad + 8 && Math.abs(z - p.cz) < p.rad + 8){ onPad = true; break; } if (onPad) continue;
    flatAt(x, z); if (FK > 0.25) continue;
    let wet = false; for (const L of LAKES) if (lakeQ(L, x, z) < 1.12){ wet = true; break; } if (wet) continue;
    const i = clamp(Math.round((x - ch.x0) / CH_STEP), 0, CH_N), j = clamp(Math.round((z - ch.z0) / CH_STEP), 0, CH_N), y = ch.H[(j + 1) * (CH_N + 3) + i + 1];
    if (y > 1280 + 60 * vnoise(x * 0.01, z * 0.01)) continue; // tree line
    if (jx > 0.3){ // the sea of trees: huge dark cedars and firs, mossy broadleaves underneath, no clearings at all
      (cv < 0.42 ? out.leaf : out.pine).push([x, y, z, (cv < 0.42 ? 1.15 : 1.35) * (0.9 + rv * 1.1), ry, cv, 1]); continue; }
    if (ruralK(z) * (1 - jx) > 0.5){ // farmland: trees only along hedgerows and around farms
      const a = 0.35, fx = x * Math.cos(a) - z * Math.sin(a), fz = x * Math.sin(a) + z * Math.cos(a);
      const ex = Math.min(fx / 190 % 1 + (fx < 0 ? 1 : 0), 1) * 190, ez = (fz / 150 % 1 + (fz < 0 ? 1 : 0)) * 150;
      const nearHedge = Math.min(ex, 190 - ex, ez, 150 - ez) < 5; if (!nearHedge && rv > 0.08) continue;
      out.leaf.push([x, y, z, sc, ry, cv]);
    } else {
      if (fbm(x * 0.004, z * 0.004, 3) < (m > 0.5 ? 0.34 : 0.4)) continue; // a few clearings, mostly forest
      (cv < (m > 0.5 ? (y < 600 ? 0.3 : 0.12) : 0.22) ? out.leaf : out.pine).push([x, y, z, sc * (m > 0.5 ? 1.15 : 1), ry, cv]); // broadleaf lower down, conifers higher up
    }
  }
  return out;
}
function placeTrees(ch, cx, cz){
  if (!freeBlocks.length) return;
  const b = freeBlocks.pop(); ch.block = b;
  const spots = treeSpots(ch, cx, cz), dm = new THREE.Object3D();
  ch.trees = []; for (const k of ['pine', 'leaf']) for (const t of spots[k].slice(0, TREE_K)) ch.trees.push(t[0], t[2]); // trunk positions, for driving into the forest
  for (const k of ['pine', 'leaf']){
    const T2 = TREES[k], list = spots[k];
    for (let n = 0; n < TREE_K; n++){
      const slot = b * TREE_K + n;
      if (n < list.length){ const [x, y, z, sc, ry, cv] = list[n];
        dm.position.set(x, y - 0.3, z); dm.rotation.set(0, ry, 0); dm.scale.set(sc, sc * (0.85 + cv * 0.5), sc); dm.updateMatrix();
        T2.crown.setMatrixAt(slot, dm.matrix); T2.trunk.setMatrixAt(slot, dm.matrix);
        if (list[n][6]) _tc.setRGB(0.025 + cv * 0.02, 0.06 + cv * 0.04, 0.04 + cv * 0.02); else if (k === 'pine') _tc.setRGB(0.05 + cv * 0.03, 0.1 + cv * 0.05, 0.07 + cv * 0.03); else if (ruralK(z) > 0.5) _tc.setRGB(0.1 + cv * 0.05, 0.16 + cv * 0.05, 0.06); else _tc.setRGB(0.09 + cv * 0.04, 0.13 + cv * 0.06, 0.05);
        T2.crown.setColorAt(slot, _tc);
      } else { T2.crown.setMatrixAt(slot, ZERO_M); T2.trunk.setMatrixAt(slot, ZERO_M); }
    }
    const top = (Math.max(...[...chunks.values()].map(c2 => c2.block ?? -1), b) + 1) * TREE_K;
    T2.crown.count = T2.trunk.count = top;
    T2.crown.instanceMatrix.needsUpdate = T2.trunk.instanceMatrix.needsUpdate = true; T2.crown.instanceColor.needsUpdate = true;
  }
}
function freeTrees(ch){
  if (ch.block === undefined) return;
  for (const k of ['pine', 'leaf']){ const T2 = TREES[k]; for (let n = 0; n < TREE_K; n++){ const slot = ch.block * TREE_K + n; T2.crown.setMatrixAt(slot, ZERO_M); T2.trunk.setMatrixAt(slot, ZERO_M); } T2.crown.instanceMatrix.needsUpdate = T2.trunk.instanceMatrix.needsUpdate = true; }
  freeBlocks.push(ch.block); ch.block = undefined; ch.trees = null;
}
const TREE_R = 1450;
// load what's near, drop what's far; at most `budget` new chunks per call
function updateChunks(px, pz, budget){ const treeR = Math.min(TREE_R - 800 * (weather.jk || 0), 2.4 / Math.max(1e-4, scene.fog.density) + 250); // in the misty sea of trees you can't see far anyway, so trees stop sooner

  const cx0 = Math.floor(px / CH), cz0 = Math.floor(pz / CH), R = Math.ceil(CH_R / CH);
  const want = [];
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++){
    const cx = cx0 + dx, cz = cz0 + dz, ccx = (cx + 0.5) * CH, ccz = (cz + 0.5) * CH, d = Math.hypot(ccx - px, ccz - pz);
    if (d > CH_R + CH * 0.7) continue; if (cx * CH > WB.x1 + 2000 || (cx + 1) * CH < WB.x0 - 2000 || cz * CH > WB.z1 + 2000 || (cz + 1) * CH < WB.z0 - 2000) continue;
    want.push([d, cx, cz]);
  }
  want.sort((a, b) => a[0] - b[0]);
  let made = 0;
  for (const [d, cx, cz] of want){
    const key = cx * 100000 + cz; let ch = chunks.get(key);
    if (!ch){ if (made >= budget) continue; ch = buildChunk(cx, cz); chunks.set(key, ch); made++; }
    ch.seen = true;
    if (d < treeR && ch.block === undefined && made < budget + 2){ placeTrees(ch, cx, cz); made += 0.5; }
    else if (d > treeR + 300 && ch.block !== undefined) freeTrees(ch);
  }
  for (const [key, ch] of chunks){ if (!ch.seen){ freeTrees(ch); scene.remove(ch.mesh); ch.mesh.geometry.dispose(); chunks.delete(key); } ch.seen = false; }
  return made;
}
// fix the chunk-local height lookup: H has (N + 2) per row where N = CH_N + 1
function chunkH(ch, i, j){ return ch.H[(j + 1) * (CH_N + 3) + i + 1]; }

// ---------- lakes
const WATER_MAT = new THREE.MeshStandardMaterial({ color: 0x0b1724, metalness: 0.55, roughness: 0.12, envMapIntensity: 0.9 });
for (const L of LAKES){
  const pts = [];
  for (let k = 0; k < 96; k++){ const a = k / 96 * TAU; let r1 = 0.6, r2 = 1.6; for (let it = 0; it < 20; it++){ const rm = (r1 + r2) / 2; if (lakeQ(L, L.x + Math.cos(a) * L.rx * rm, L.z + Math.sin(a) * L.rz * rm) < 1.06) r1 = rm; else r2 = rm; } pts.push(new THREE.Vector2(Math.cos(a) * L.rx * r1 * 1.04, -Math.sin(a) * L.rz * r1 * 1.04)); }
  pts.reverse(); const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1); g.rotateX(-Math.PI / 2); g.translate(L.x, L.wl, L.z);
  const m = new THREE.Mesh(g, WATER_MAT); m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m);
}
// the height of the ground you actually see (the 16 m grass grid), for standing things on it so nothing sinks into the grass
const SHOWN_H = new Map();
function shownGround(x, z){
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH), key = cx * 100000 + cz, live = chunks.get(key);
  let H = live && live.H || SHOWN_H.get(key); if (!H){ H = chunkHeights(cx, cz); SHOWN_H.set(key, H); }
  const N = CH_N + 1, lx = (x - cx * CH) / CH_STEP, lz = (z - cz * CH) / CH_STEP, i = clamp(Math.floor(lx), 0, N - 2), j = clamp(Math.floor(lz), 0, N - 2), fx = lx - i, fz = lz - j, h = (a, b) => H[(b + 1) * (N + 2) + a + 1];
  // the same two triangles per grid square the ground mesh is built from (a, c, b and b, c, d)
  return fx + fz < 1 ? h(i, j) + (h(i + 1, j) - h(i, j)) * fx + (h(i, j + 1) - h(i, j)) * fz : h(i + 1, j + 1) + (h(i, j + 1) - h(i + 1, j + 1)) * (1 - fx) + (h(i + 1, j) - h(i + 1, j + 1)) * (1 - fz);
}
