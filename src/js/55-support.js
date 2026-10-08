// =====================================================================================================
// WHERE YOU ARE: which road surface holds the car up, and the walls around it.
// Every road, junction patch and pad is a drivable surface. A corner of the car that isn't over any surface
// at about the car's height has hit a rail (or a kerb): the car is pushed back and bounces off like in Midnight Weave.
// =====================================================================================================
const RAIL_OUT = 0.3; // the rail stands just outside the pavement edge
const _sq = [], _corner = {};
// the surface under (x, z) closest to height y, or null
function surfaceAt(x, z, y, prefer, out){
  roadsNear(x, z, _sq);
  let best = null, bd = Infinity;
  // where roads overlap (a ramp peeling off, a junction) the one whose lanes you're actually in wins; the current one is a little sticky
  let bestDy = Infinity;
  for (const q of _sq){
    if (q.along > 0.6 || q.along < -0.6) continue;
    if (q.d > q.hl + RAIL_OUT || q.d < -q.hr - RAIL_OUT) continue;
    const dy = Math.abs(q.y - y); if (dy > 3.2) continue;
    const score = dy * 1.5 + Math.abs(q.d) / Math.max(1, q.d >= 0 ? q.hl : q.hr) - (prefer && q.e === prefer ? 0.3 : 0);
    if (score < bd){ bd = score; best = q; bestDy = dy; }
  }
  if (best){ Object.assign(out, best); out.kind = 'edge'; out.dy = bestDy; }
  else { out.kind = null; out.dy = Infinity; }
  for (const p of patchesNear(x, z)){
    const dx = x - p.x, dz = z - p.z, dy = Math.abs(p.y - y);
    if (dy > 3.2 || dy >= out.dy) continue;
    if (patchContains(p, x, z, RAIL_OUT)){ out.kind = 'patch'; out.patch = p; out.y = p.y; out.dy = dy; out.e = null; }
  }
  for (const p of padsNear(x, z)){
    if (Math.abs(x - p.cx) > p.rad || Math.abs(z - p.cz) > p.rad) continue;
    if (padContains(p, x, z, y, RAIL_OUT)){ const dy = Math.abs(_pq.y - y); if (dy < out.dy){ out.kind = 'pad'; out.pad = p; out.y = _pq.y + 0.02; out.dy = dy; out.e = p.e; out.s = _pq.s; out.d = _pq.d; } }
  }
  return out.kind ? out : null;
}
const SUP = {}, _sup2 = {};
// called after every physics frame: find the surface, keep the car on it and inside the rails
function supportUpdate(force){
  const prevE = car.sup && car.sup.e;
  let s = surfaceAt(car.x, car.z, car.y, prevE, SUP);
  if (!s && !force){ // off the road: you're driving on the land itself
    const gy = terrainAt(car.x, car.z);
    if (gy > car.y + 1.6 && car.good){ // straight into a bank or a cliff: it stops you
      const dx = car.x - car.good.x, dz = car.z - car.good.z, l = Math.hypot(dx, dz) || 1; car.x = car.good.x; car.z = car.good.z; hitWall(-dx / l, -dz / l, true); return; }
    const wasFall = car.fall || 0; car.fall = car.y - gy > 0.4 ? Math.min(30, wasFall + 0.33) : 0; // over an edge: you drop
    if (!car.fall && wasFall > 12) crash(wasFall * 0.8); // a long drop hurts when you land
    const ty = car.fall ? Math.max(gy, car.y - car.fall / 30) : gy, wl = waterAt(car.x, car.z);
    Object.assign(SUP, { kind: 'ground', e: null, patch: null, pad: null, y: wl !== null ? Math.max(ty, wl - 0.7) : ty, dy: 0, d: 0, s: 0 });
    car.sup = SUP; car.y = SUP.y; car.wet = wl !== null && gy < wl - 0.2;
    const fx = Math.sin(car.h), fz = Math.cos(car.h); car.slope = (terrainAt(car.x + fx * 2.2, car.z + fz * 2.2) - terrainAt(car.x - fx * 2.2, car.z - fz * 2.2)) / 4.4; car.th = car.h;
    car.good = car.good || {}; car.good.x = car.x; car.good.z = car.z; car.good.y = car.y;
    collideTrees(); car.vs = car.vx; return;
  }
  car.wet = false; if (s && car.fall){ if (car.fall > 12) crash(car.fall * 0.8); car.fall = 0; }
  if (!s){ // pushed off everything (a teleport, or a very fast hit into a corner): back onto the nearest road
    const q = nearestRoadPoint(car.x, car.z, force ? undefined : car.y);
    const dx = q.x - car.x, dz = q.z - car.z, l = Math.hypot(dx, dz) || 1;
    car.x = q.x; car.z = q.z; car.y = q.y;
    if (!force && l > 0.01) hitWall(dx / l, dz / l, true);
    s = surfaceAt(car.x, car.z, car.y, null, SUP); if (!s) return;
  }
  car.sup = SUP; car.y = SUP.y; car.good = car.good || {}; car.good.x = car.x; car.good.z = car.z; car.good.y = car.y;
  if (SUP.e){ const r = edgeAt(SUP.e, SUP.s, _sup2); car.slope = r.slope * Math.cos(car.h - r.h); car.th = r.h; } else car.slope = 0;
  // the four corners: each must be over some surface at about the same height
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
  const HW = 0.96, HL = 2.28;
  for (let iter = 0; iter < 2; iter++){
    let worst = null, wpen = 0;
    for (const [sl, sf] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]){
      const cx = car.x + lx * HW * sl + fx * HL * sf, cz = car.z + lz * HW * sl + fz * HL * sf;
      if (surfaceAt(cx, cz, car.y, SUP.e, _corner)) continue;
      { let wall = false; if (SUP.kind === 'edge' && SUP.e){ const E = SUP.e; refineOn(E, SUP.i, cx, cz, _pq);
          if (E.paired && _pq.d > 0) wall = true; // the expressway's central barrier
          else if (E.rail && Math.abs(_pq.along) < 0.6){ const k = clamp(Math.round(_pq.s / E.ds), 0, E.n - 1); wall = !!E.rail[_pq.d > 0 ? 1 : 0][k]; } } // a guard rail
        const gy = terrainAt(cx, cz); if (!wall && gy < car.y + 1.2) continue; } // no rail here: drive (or fall) off onto the land
      // off every surface: how far, and which way is back? Measured against the surface the car is on
      const pb = pushBack(cx, cz);
      if (pb && pb.pen > wpen){ wpen = pb.pen; worst = pb; }
    }
    if (!worst) break;
    car.x += worst.nx * (worst.pen + 0.01); car.z += worst.nz * (worst.pen + 0.01);
    hitWall(worst.nx, worst.nz, false);
  }
  car.vs = car.vx * Math.cos(angWrap(car.h - (car.th ?? car.h)));
}
// for a corner off the edge of the current surface: the push back onto it
function pushBack(cx, cz){
  if (SUP.kind === 'patch'){ const p = SUP.patch;
    if (p.sq){ const dx = cx - p.x, dz = cz - p.z, ox = Math.abs(dx) - p.sq - RAIL_OUT, oz = Math.abs(dz) - p.sq - RAIL_OUT;
      if (ox > oz && ox > 0) return { pen: ox, nx: -Math.sign(dx), nz: 0 }; if (oz > 0) return { pen: oz, nx: 0, nz: -Math.sign(dz) }; return null; }
    if (p.poly){ const o = patchOut(p, cx, cz), pen = o.d - RAIL_OUT; return pen > 0 ? { pen, nx: -o.nx, nz: -o.nz } : null; }
    const dx = cx - p.x, dz = cz - p.z, l = Math.hypot(dx, dz), pen = l - p.r - RAIL_OUT; return pen > 0 ? { pen, nx: -dx / l, nz: -dz / l } : null; }
  if (SUP.kind === 'pad'){ const p = SUP.pad; refineOn(p.e, p.e.i0 + clamp(Math.round(p.sm / p.e.ds), 0, p.e.n - 1), cx, cz, _pq);
    const r = edgeAt(p.e, _pq.s, {}), lo = Math.min(p.dIn, p.dOut) - RAIL_OUT, hi = Math.max(p.dIn, p.dOut) + RAIL_OUT;
    if (_pq.s < p.s0 - RAIL_OUT) return { pen: p.s0 - RAIL_OUT - _pq.s, nx: r.tx, nz: r.tz };
    if (_pq.s > p.s1 + RAIL_OUT) return { pen: _pq.s - p.s1 - RAIL_OUT, nx: -r.tx, nz: -r.tz };
    if (_pq.d > hi) return { pen: _pq.d - hi, nx: -r.nx, nz: -r.nz }; if (_pq.d < lo) return { pen: lo - _pq.d, nx: r.nx, nz: r.nz }; return null; }
  const e = SUP.e; refineOn(e, SUP.i, cx, cz, _pq);
  const r = edgeAt(e, _pq.s, {});
  if (_pq.d > _pq.hl + RAIL_OUT) return { pen: _pq.d - _pq.hl - RAIL_OUT, nx: -r.nx, nz: -r.nz };
  if (_pq.d < -_pq.hr - RAIL_OUT) return { pen: -_pq.hr - RAIL_OUT - _pq.d, nx: r.nx, nz: r.nz };
  if (_pq.along > 0.6) return { pen: _pq.along, nx: -r.tx, nz: -r.tz }; // the end of a dead-end road
  if (_pq.along < -0.6) return { pen: -_pq.along, nx: r.tx, nz: r.tz };
  return null;
}
// bounce off a wall whose normal (nx, nz) points back onto the road. From Midnight Weave's guard rails
function hitWall(nx, nz, hard){
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
  let Vx = car.vx * fx + car.vy * lx, Vz = car.vx * fz + car.vy * lz;
  const vn = Vx * nx + Vz * nz;
  if (vn < 0){
    const e = -vn < 3 ? 0.02 : 0.15; Vx -= (1 + e) * vn * nx; Vz -= (1 + e) * vn * nz;
    const tx = -nz, tz = nx, vt = Vx * tx + Vz * tz, fr = Math.min(Math.abs(vt), 0.45 * (1 + e) * -vn) * Math.sign(vt);
    Vx -= fr * tx; Vz -= fr * tz;
    car.vx = Vx * fx + Vz * fz; car.vy = Vx * lx + Vz * lz;
    car.r *= 0.6;
    if (-vn > 10) crash(-vn); else if (-vn > 1.2) wallScrape(-vn);
    if (Math.hypot(car.vx, car.vy) > 8 && rnd() < 0.5) puff(car.x - nx * 1.1, car.y + 0.6, car.z - nz * 1.1, 0, 0, 0.1);
  }
}
// the nearest point on any road (falls back on the distance grid when nothing is close)
function nearestRoadPoint(x, z, y){
  roadsNear(x, z, _sq);
  let best = null, bd = Infinity;
  for (const q of _sq){ const dd = q.dist + (y !== undefined ? Math.abs(q.y - y) * 2 : 0); if (dd < bd){ bd = dd; best = q; } }
  if (best){ const r = edgeAt(best.e, best.s, {}), d = clamp(best.d, -best.hr + 1.2, best.hl - 1.2); return { x: r.x + r.nx * d, z: r.z + r.nz * d, y: r.y, e: best.e, s: best.s }; }
  const fx = clamp(Math.round((x - WB.x0) / DF_C), 0, DF_NX - 1), fz = clamp(Math.round((z - WB.z0) / DF_C), 0, DF_NZ - 1), i = DF_I[fz * DF_NX + fx];
  return { x: SX[i], z: SZ[i], y: SY[i], e: edgeOf(i), s: (i - edgeOf(i).i0) * edgeOf(i).ds };
}
// static obstacles: pumps, buildings, parked lorries
function collideStatic(){
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
  for (const o of staticNear(car.x, car.z)){
    if (car.y < o.y - 2 || car.y > o.y + o.ht + 1) continue;
    const hit = obb(car.x, car.z, car.h, 0.96, 2.28, o.x, o.z, o.h, o.hw, o.hl); if (!hit) continue;
    car.x -= hit.nx * hit.depth; car.z -= hit.nz * hit.depth;
    let Vx = car.vx * fx + car.vy * lx, Vz = car.vx * fz + car.vy * lz; const vn = Vx * hit.nx + Vz * hit.nz;
    if (vn > 0){ Vx -= 1.1 * vn * hit.nx; Vz -= 1.1 * vn * hit.nz; car.vx = Vx * fx + Vz * fz; car.vy = Vx * lx + Vz * lz; car.r *= 0.5; if (vn > 8) crash(vn); else if (vn > 1.2) contact(vn); else sfx.bump(vn); }
  }
}
// roundabout islands: a round kerb. You slide off it; it never counts as a crash
function collideIslands(){
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
  for (const I of ISLANDS){
    const dx0 = car.x - I.x, dz0 = car.z - I.z; if (dx0 * dx0 + dz0 * dz0 > (I.r + 4) ** 2 || Math.abs(car.y - I.y) > 3) continue;
    for (const a of [1.6, 0, -1.6]){ // the car as three overlapping discs along its length
      const px = car.x + fx * a, pz = car.z + fz * a, dx = px - I.x, dz = pz - I.z, d = Math.hypot(dx, dz) || 0.01, pen = I.r + 0.95 - d; if (pen <= 0) continue;
      const nx = dx / d, nz = dz / d; car.x += nx * pen; car.z += nz * pen;
      let Vx = car.vx * fx + car.vy * lx, Vz = car.vx * fz + car.vy * lz; const vn = -(Vx * nx + Vz * nz);
      if (vn > 0){ Vx += vn * nx; Vz += vn * nz; car.vx = Vx * fx + Vz * fz; car.vy = Vx * lx + Vz * lz; car.r *= 0.7; sfx.bump(Math.min(vn, 4)); }
    }
  }
}
// the land under (x, z), exactly as it's drawn (from the loaded ground mesh when there is one)
function terrainAt(x, z){
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH), ch = chunks.get(cx * 100000 + cz);
  if (!ch || !ch.H) return groundAt(x, z);
  const N = CH_N + 1, lx = (x - cx * CH) / CH_STEP, lz = (z - cz * CH) / CH_STEP, i = clamp(Math.floor(lx), 0, N - 2), j = clamp(Math.floor(lz), 0, N - 2), fx = lx - i, fz = lz - j, H = ch.H, h = (a, b) => H[(b + 1) * (N + 2) + a + 1];
  return fx + fz < 1 ? h(i, j) + (h(i + 1, j) - h(i, j)) * fx + (h(i, j + 1) - h(i, j)) * fz : h(i + 1, j + 1) + (h(i, j + 1) - h(i + 1, j + 1)) * (1 - fx) + (h(i + 1, j) - h(i + 1, j + 1)) * (1 - fz);
}
function waterAt(x, z){ for (const L of LAKES) if (lakeQ(L, x, z) < 0.97) return L.wl; return null; }
// tree trunks are solid
function collideTrees(){
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
  for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++){
    const ch = chunks.get((Math.floor(car.x / CH) + ox) * 100000 + Math.floor(car.z / CH) + oz); if (!ch || !ch.trees) continue;
    const T = ch.trees;
    for (let k = 0; k < T.length; k += 2){ const dx = T[k] - car.x, dz = T[k + 1] - car.z; if (dx * dx + dz * dz > 16) continue;
      const along = dx * fx + dz * fz, side = dx * lx + dz * lz, R = 0.55, pa = 2.28 + R - Math.abs(along), ps = 0.96 + R - Math.abs(side); if (pa <= 0 || ps <= 0) continue;
      let nx, nz, pen; if (pa < ps){ nx = fx * Math.sign(along); nz = fz * Math.sign(along); pen = pa; } else { nx = lx * Math.sign(side); nz = lz * Math.sign(side); pen = ps; }
      car.x -= nx * pen; car.z -= nz * pen; hitWall(-nx, -nz, false); } }
}
function obb(ax, az, ah, ahw, ahl, bx, bz, bh, bhw, bhl){
  const axes = [[Math.sin(ah), Math.cos(ah)], [Math.cos(ah), -Math.sin(ah)], [Math.sin(bh), Math.cos(bh)], [Math.cos(bh), -Math.sin(bh)]];
  const af = axes[0], al = axes[1], bf = axes[2], bl = axes[3];
  const dx = bx - ax, dz = bz - az; let best = Infinity, nx = 0, nz = 0;
  for (const [ux, uz] of axes){
    const pa = ahw * Math.abs(al[0] * ux + al[1] * uz) + ahl * Math.abs(af[0] * ux + af[1] * uz);
    const pb = bhw * Math.abs(bl[0] * ux + bl[1] * uz) + bhl * Math.abs(bf[0] * ux + bf[1] * uz);
    const dist = dx * ux + dz * uz, ov = pa + pb - Math.abs(dist);
    if (ov <= 0) return null;
    if (ov < best){ best = ov; const sg = dist >= 0 ? 1 : -1; nx = ux * sg; nz = uz * sg; }
  }
  return { nx, nz, depth: best };
}
