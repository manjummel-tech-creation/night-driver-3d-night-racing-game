// =====================================================================================================
// POLICE: roughly one unit every 4 km of road, spread out, plus a few in each city. Parked on the shoulder or on patrol.
// Speed past one (or let one see you once you're wanted) and it chases you through the road network.
// Get 300 m away and it gives up and goes back to patrolling. Lose every unit and you've escaped: +0.5 wanted stars.
// Your stars stay with you: more stars, faster and more numerous police who recognise you on sight.
// =====================================================================================================
const COP_CAP = [66, 72, 78, 85, 92, 100]; // chase top speed by whole stars, m/s (220 km/h at no stars, about 345 at five), more when they're falling behind
const BACKUP_WANT = [1, 2, 2, 3, 4, 5];
const SPIKES = []; // { e, s, d0, d1, mesh, t }
const police = [];
const chase = { on: false, t: 0, busted: 0, heliMsg: 0, backupT: 0, near: Infinity };
// the wanted level wears off: half a star every two minutes while nobody is chasing you. From four stars there's a tracker on your car:
// every 30 s the police get your position and the nearest units come for you. KNOWN is the last place they know you were
const WANT = { t: 0, ping: 30 }, KNOWN = { x: 0, z: 0, t: 0, why: '' };
function wantedTick(dt){
  KNOWN.t = Math.max(0, KNOWN.t - dt);
  if (STATE.stars <= 0){ WANT.t = 0; WANT.ping = 30; wantedHud(); return; }
  if (!chase.on){ WANT.t += dt; if (WANT.t >= 120){ WANT.t = 0; STATE.stars = Math.max(0, STATE.stars - 0.5); popup(STATE.stars > 0 ? 'WANTED LEVEL DOWN · ' + starText(STATE.stars) : 'NO LONGER WANTED', 0, 'near'); saveState(); } }
  if (STATE.stars >= 4 && car.graceT <= 0){ WANT.ping -= dt; if (WANT.ping <= 0){ WANT.ping = 30; policeKnow(car.x, car.z, 'TRACKER PING'); } } else WANT.ping = 30;
  wantedHud();
}
function wantedHud(){
  const el = $('wantInfo'); if (!el) return; let t = '';
  if (STATE.stars > 0) t = chase.on ? 'WEARS OFF ONCE YOU LOSE THEM' : '−½ ★ IN ' + fmtT(120 - WANT.t);
  if (STATE.stars >= 4) t += ' · TRACKER PING ' + Math.ceil(WANT.ping) + ' S';
  if (el.textContent !== t) el.textContent = t;
  el.classList.toggle('hot', STATE.stars >= 4);
}
// the police learn where you are (a tracker ping, a border post that ran your ID): if you're still near, the closest units come for you
function policeKnow(x, z, why){
  KNOWN.x = x; KNOWN.z = z; KNOWN.t = 75; KNOWN.why = why;
  if (Math.hypot(car.x - x, car.z - z) > 1200){ popup(why + ' · POLICE SEARCHING WHERE YOU WERE', 0, 'bad'); return; }
  toast(why, 'THE POLICE KNOW WHERE YOU ARE · UNITS ON THE WAY', '#ff4058');
  let n = 0;
  for (const u of police){ if (n >= 2) break; if (!u.active || u.state === 'chase' || u.state === 'wreck' || u.blocker || u.dist > 1500) continue; u.cool = 0; if (!chase.on) startChase(u, why); else { u.state = 'chase'; u.lostT = 0; u.next = null; } n++; }
  if (n < 2){ const a = callInterceptor(); if (a && !chase.on) startChase(a, why); }
  if (n < 1){ const b = callBackup(); if (b && !chase.on) startChase(b, why); }
}
// ---------- the meshes: a small pool shared by whichever units are near you
const COP_POOL = [];
(() => {
  const glowTex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,80,80,1)'); gr.addColorStop(0.3, 'rgba(255,20,20,0.6)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const blueTex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(90,140,255,1)'); gr.addColorStop(0.3, 'rgba(30,80,255,0.6)'); gr.addColorStop(1, 'rgba(0,0,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  for (let k = 0; k < 7; k++){
    const P = makeAICar(0x101114);
    P.lightA = new THREE.MeshBasicMaterial({ color: 0x2a0000, fog: false }); P.lightB = new THREE.MeshBasicMaterial({ color: 0x00002a, fog: false });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), P.lightA); bar.position.set(0.28, 1.42, -0.45); P.mesh.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), P.lightB); bar2.position.set(-0.28, 1.42, -0.45); P.mesh.add(bar2);
    const door = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.4, roughness: 0.35 });
    for (const x of [-0.99, 0.99]){ const d = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 1.5), door); d.position.set(x, 0.68, 0.0); P.mesh.add(d); }
    const gm = t => new THREE.SpriteMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    P.glowA = new THREE.Sprite(gm(glowTex)); P.glowA.position.set(0.3, 1.5, -0.45); P.glowA.scale.set(3, 3, 1); P.mesh.add(P.glowA);
    P.glowB = new THREE.Sprite(gm(blueTex)); P.glowB.position.set(-0.3, 1.5, -0.45); P.glowB.scale.set(3, 3, 1); P.mesh.add(P.glowB);
    P.mark.visible = false;
    P.fire = new THREE.Group(); P.fire.visible = false; P.mesh.add(P.fire);
    for (let q = 0; q < 4; q++){ const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: q % 2 ? 0xff7a20 : 0xffb040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); f.position.set((q - 1.5) * 0.45, 1.2 + (q % 2) * 0.4, (q % 2 - 0.5) * 1.2); f.scale.setScalar(1.8); P.fire.add(f); }
    P.unit = null; COP_POOL.push(P);
  }
})();
function makeUnit(home, patrol, city){
  const u = { police: true, home, patrol, city, state: 'dormant', active: false, look: null, cool: 0, lostT: 0, wreckT: 0,
    e: home.e, s: home.s, dir: home.dir, lane: 0, tlane: 0, d: home.d, latV: 0, v: 0, v0: 25, acc: 0, mode: 'edge', next: null, conn: null,
    len: 4.6, wid: 1.9, x: 0, y: 0, z: 0, h: 0, slope: 0, stuck: 0, wait: 0, wheel: 0, lc: 2, rbT: 0, wreck: 0, hit: false, truck: false };
  placeMover(u); police.push(u); return u;
}
function placePolice(){
  const R = mulberry(777); let acc = 1800;
  for (const e of EDGES){
    if (e.ic || e.city || e.cls === 'rp' || e.cls === 'st' || e.cls === 'al' || e.cls === 'rw' || e.cls === 'dt' || e.gen === 'dead') continue;
    if (e.pair && e.id > e.pair.id) continue; // one carriageway of each expressway; alternate which side below
    for (let s = 400; s < e.len - 400; s += 50){
      acc -= 50; if (acc > 0) continue;
      acc = 4000 + (R() - 0.5) * 2600;
      const useE = e.pair && R() < 0.5 ? e.pair : e, ss = useE === e ? s : e.len - s;
      { const r = edgeAt(useE, ss, _ra), st = START_STATION; if (st && Math.hypot(r.x - st.pad.cx, r.z - st.pad.cz) < 2000) continue; // a quiet start
        if (mtnK(r.x, r.z) > 0.45 && (useE.cls !== 'cw' || R() < 0.8)) continue; } // the mountains are nearly empty of police: only the odd unit on the expressway
      if (useE.cls === 'cw'){ const patrol = R() < 0.3; makeUnit({ e: useE, s: ss, dir: 1, d: patrol ? laneD(useE, 1, 2) : -(useE.C.hw - 0.9) }, patrol); }
      else { const dir = R() < 0.5 ? 1 : -1; makeUnit({ e: useE, s: ss, dir, d: laneD(useE, dir, 0) }, true); }
    }
  }
  for (const c of CITIES) for (let k = 0; k < c.info.cops * 2 + 3; k++){ const e = c.edges[Math.floor(R() * c.edges.length)], dir = R() < 0.5 ? 1 : -1; makeUnit({ e, s: e.len / 2, dir, d: laneD(e, dir, 0) }, true, c); }
}
function speedLimitAt(){
  const e = car.sup && car.sup.e; if (!e) return 70;
  let lim = e.C.lim;
  if (e.cls === 'rd' && mtnK(car.x, car.z) > 0.5) lim = 80;
  for (const t of TOWNS) if (Math.hypot(car.x - t.x, car.z - t.z) < 340) lim = Math.min(lim, 50);
  if (e.city && e.city.id === 'kawaguchi') lim = 60;
  return lim;
}
const inCity = (x, z, m = 60) => CITIES.find(c => Math.abs(x - c.x) < c.half + m && Math.abs(z - c.z) < c.half + m) || null;
// ---------- activation: units near you get a car from the pool
let polT = 0;
function activatePolice(){
  const cand = [];
  for (const u of police){
    const d = Math.hypot(u.x - car.x, u.z - car.z); u.dist = d;
    if (u.active && u.state !== 'chase' && u.state !== 'wreck' && d > 1900) deactivate(u);
    if (!u.active && d < 1500) cand.push(u);
  }
  cand.sort((a, b) => a.dist - b.dist);
  for (const u of cand){
    let m = COP_POOL.find(p => !p.unit);
    if (!m){ // take the furthest non-chasing unit's car
      let far = null; for (const p of COP_POOL){ const v = p.unit; if (v.state === 'chase' || v.state === 'wreck') continue; if (!far || v.dist > far.unit.dist) far = p; }
      if (!far || far.unit.dist < u.dist + 200) break; deactivate(far.unit); m = far;
    }
    m.unit = u; u.look = m; u.active = true; m.mesh.visible = true;
    if (u.state === 'dormant') u.state = u.patrol ? 'patrol' : 'parked';
    if (u.state === 'patrol'){ u.v = Math.max(u.v, 15); u.v0 = laneSpeed(u); if (!u.next) u.next = chooseNext(u.e, u.dir); }
  }
}
function deactivate(u){
  if (u.look){ u.look.unit = null; u.look.mesh.visible = false; u.look.fire.visible = false; }
  u.look = null; u.active = false; if (u.conn){ u.mode = 'edge'; u.e = u.conn.e2; u.dir = u.conn.d2; u.s = u.conn.s2; u.conn = null; }
  if (u.state === 'parked' || u.state === 'wreck'){ u.e = u.home.e; u.s = u.home.s; u.dir = u.home.dir; u.d = u.home.d; u.v = 0; u.mode = 'edge'; }
  u.state = 'dormant'; placeMover(u);
}
// ---------- the chase
function startChase(u, why){
  if (u.cool > 0) return;
  const first = !chase.on;
  u.state = 'chase'; u.lostT = 0; u.next = null; u.mode = u.mode === 'conn' ? 'conn' : 'edge';
  if (first){
    chase.on = true; chase.t = 0; chase.busted = 0; chase.backupT = 6; chase.blockT = 12; sfx.siren(true);
    toast('POLICE', why + ' · GET 300 M AWAY TO LOSE THEM', '#ff4058');
    const rr = 700 + 300 * STATE.stars; // the radio call: nearby units join in
    for (const q of police) if (q !== u && q.active && q.cool <= 0 && q.state !== 'chase' && q.state !== 'wreck' && q.dist < rr){ q.state = 'chase'; q.lostT = 0; q.next = null; }
    if (Math.hypot(car.vx, car.vy) > 38 || STATE.stars >= 1) callInterceptor(); // fast or wanted: a unit up ahead is radioed in at once
  } else popup('POLICE BACKUP', 0, 'bad');
}
function endChase(escaped){
  for (const u of police) if (u.state === 'chase'){ u.state = 'patrol'; u.cool = 25; u.next = null; u.v0 = 22; }
  chase.on = false; $('chase').hidden = true; $('heat').hidden = true; sfx.siren(false);
  if (escaped){
    const before = STATE.stars; STATE.stars = Math.min(5, STATE.stars + 0.5);
    const pts = Math.round((1200 + 900 * before) * (1 + chase.t / 60)); addCash(pts, 'ESCAPED');
    toast('ESCAPED', '+½ ★  ·  WANTED ' + starText(STATE.stars) + '  ·  +$' + pts.toLocaleString(), '#3ee07a'); saveState();
  }
}
function busted(why){
  const fine = Math.min(STATE.cash, Math.round(800 + 1500 * STATE.stars));
  STATE.cash -= fine; STATE.stars = 0; STATE.busts = (STATE.busts || 0) + 1;
  endChase(false); heistBusted(); for (const u of police) if (u.state === 'patrol' && u.cool > 0) u.cool = 40;
  towToStation('BUSTED', why + ' · FINE $' + fine.toLocaleString() + ' · WANTED LEVEL CLEARED');
  saveState();
}
// route a chasing unit: at the end of its road, the next road that gets it to you fastest
function routeNext(u){
  const n = endNode(u.e, u.dir), E = car.lastE, sP = car.lastS;
  let best = null, bc = Infinity;
  for (const [e2, d2] of n.out){
    if (e2.cls === 'dt' && u.e.cls !== 'dt') continue; // police cars won't follow you onto the dirt
    let c;
    if (E && e2 === E){ c = d2 > 0 ? sP : e2.len - sP; }
    else { c = e2.len + (E ? costToPoint(endNode(e2, d2).id, E, sP) : 0); }
    if (e2 === u.e && d2 === -u.dir) c += 60; // turning round costs a little
    if (c < bc){ bc = c; best = { e: e2, dir: d2 }; }
  }
  return best || chooseNext(u.e, u.dir);
}
function chaseMove(u, dt){
  const E = car.lastE, sP = car.lastS, pv = Math.hypot(car.vx, car.vy), dP = Math.hypot(car.x - u.x, car.z - u.z);
  const e = u.e, cap = (COP_CAP[Math.floor(STATE.stars)] || 62) * lerp(0.8, 1, weather.power) * (1 - 0.08 * weather.wet) + clamp((dP - 80) * 0.12, 0, 24); // they push harder when they're dropping back
  const capT = dP < 260 ? Math.max(cap, Math.min(pv + 5, 108)) : cap; // with you in sight they always have a little more than you
  const same = E === e, ahead = same ? (sP - u.s) * u.dir : Infinity;
  if (same && ahead < -12 && !e.oneway && u.v < 7){ u.dir = -u.dir; u.d = laneD(e, u.dir, 0); u.tlane = u.lane = 0; u.next = null; } // turn round on a two-lane road
  if (!u.next) u.next = routeNext(u);
  let vT = capT;
  if (same && ahead > 0) vT = ahead > 220 ? capT : ahead > 35 ? Math.min(capT, pv + 7 + (ahead - 35) * 0.2) : Math.max(8, pv + (ahead > 6 ? 8 : 2));
  else if (same && ahead < 0 && e.oneway && u.block){ vT = pv < 12 ? 0 : clamp(pv * 0.55, 8, 40); } // an interceptor ahead of you: it sits in your lane and brakes
  else if (same && ahead < 0 && e.oneway){ // you're behind it on a one-way road: pull onto the shoulder and wait for you to come past
    if (ahead > -260){ vT = 0; u.waitShoulder = true; } else vT = Math.min(cap, 30); }
  vT = Math.min(vT, Math.sqrt(9.5 / Math.max(1e-4, (() => { let k = 0; for (let o = 0; o <= 50; o += 10){ const s1 = u.s + u.dir * o, s2 = s1 + u.dir * 10; if (s1 < 0 || s2 < 0 || s1 > e.len || s2 > e.len) break; k = Math.max(k, Math.abs(angWrap(edgeAt(e, s2, _rb).h - edgeAt(e, s1, _rb).h)) / 10); } return k; })())));
  // traffic in the way: find a clearer lane, or ease off
  let [gap, lv] = leaderOnEdge(u, e, u.dir, u.s, u.d, 220);
  const close = same && ahead > 0 && ahead < 70;
  if (close) u.tdOverride = clamp(car.sup && car.sup.e === e ? car.sup.d : u.d, -(edgeAt(e, u.s, _rb).hr - 1.2), edgeAt(e, u.s, _rb).hl - 1.2);
  else if (same && ahead < 0 && ahead > -400 && e.oneway && u.block) u.tdOverride = clamp(car.sup && car.sup.e === e ? car.sup.d : u.d, -(edgeAt(e, u.s, _rb).hr - 1.2), edgeAt(e, u.s, _rb).hl - 1.2);
  else if (same && ahead < 0 && ahead > -260 && e.oneway) u.tdOverride = -(edgeAt(e, u.s, _rb).hr - 1.3);
  else u.tdOverride = null;
  if (gap < 60 + u.v * 1.3 && lv < vT - 4 && !close){
    const lanes = e.oneway ? lanesAt(e, u.s) : e.C.lanes; let bestL = u.tlane, bestG = gap;
    for (let l = 0; l < lanes; l++){ if (l === u.tlane) continue; const [g2] = leaderOnEdge(u, e, u.dir, u.s - u.dir * 6, laneD(e, u.dir, l), 220); if (g2 > bestG + 5){ bestG = g2; bestL = l; } }
    if (!e.oneway && bestL === u.tlane){ // overtake on the other side of a two-lane road when it's clear
      const a = EDGE_CARS.get(e.id); let clear = true; if (a) for (const o of a) if (o.dir !== u.dir && (o.s - u.s) * u.dir > -10 && (o.s - u.s) * u.dir < 160) clear = false;
      if (clear) u.tdOverride = -laneD(e, u.dir, 0);
    }
    if (bestL !== u.tlane) u.tlane = u.lane = bestL;
  }
  if (gap < 120 && u.tdOverride === null) vT = Math.min(vT, lv + Math.max(0, gap - 6) * 0.9); // sirens on: traffic gets out of the way, so they only ease off when right behind someone
  if (dP < 9 && pv < 3) vT = Math.min(vT, 2);
  u.v += clamp(vT - u.v, -20 * dt, (u.v < 40 ? 13 : 10) * dt); u.v = Math.max(0, u.v); u.acc = vT < u.v ? -3 : 1;
  const tdv = u.tdOverride !== null ? u.tdOverride : laneD(e, u.dir, u.tlane);
  const want = clamp((tdv - u.d) * 2.2, -4, 4); u.latV += (want - u.latV) * Math.min(1, dt * 5); u.d += u.latV * dt;
  u.s += u.v * dt * u.dir;
  const n = endNode(e, u.dir), R = nodeR(n, e), rem = u.dir > 0 ? e.len - u.s : u.s;
  if (R && rem < R + 0.5){ placeMover(u); buildConn(u); return; }
  if (u.s > e.len || u.s < 0){ const over = u.s > e.len ? u.s - e.len : -u.s; placeMover(u); switchEdge(u, over); u.next = null; u.v0 = cap; }
  placeMover(u);
}
function updatePolice(dt){
  polT -= dt; if (polT <= 0){ polT = 0.4; activatePolice(); }
  const kmh = Math.hypot(car.vx, car.vy) * 3.6, lim = speedLimitAt(), jam = UPK.jammer ? 0.6 : 1;
  const overK = inCity(car.x, car.z, 300)?.id === 'nagisa' ? 1.1 : 1.2;
  for (const u of police){
    if (u.blocker){ u.blocker -= dt; if (u.blocker <= 0 || u.state !== 'parked'){ u.blocker = 0; if (u.origHome){ u.home = u.origHome; u.origHome = null; } if (u.active && u.state === 'parked') deactivate(u); } }
    if (!u.active) continue;
    u.cool = Math.max(0, u.cool - dt); if (u.ramT) u.ramT = Math.max(0, u.ramT - dt);
    if (u.state === 'wreck'){ u.wreckT -= dt; u.v = Math.max(0, u.v - 8 * dt); if (rnd() < dt * 6) puff(u.x, u.y + 1.6, u.z, (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 1.5, 0.6, 1.4); if (u.wreckT <= 0){ u.look.fire.visible = false; u.state = 'dormant'; u.cool = 60; deactivate(u); } continue; }
    if (u.state === 'parked' || u.state === 'patrol'){
      // does it see you?
      // if a unit sees you, it comes after you: further when you're speeding, wanted, or in Nagisa; less far in fog or a blackout
      // not wanted: they leave you alone unless they catch you breaking the law. Wanted (or in a car they're looking for): they come after you on sight
      if (u.cool <= 0 && started && car.graceT <= 0 && Math.abs(car.y - u.y) < 10){
        const speeding = kmh > lim * overK, bolo = heistBolo(), known = STATE.stars >= 0.5 || bolo;
        if (speeding || known){
          const sight = (160 + 30 * STATE.stars + (speeding ? kmh * 0.7 : 0)) * jam * lerp(0.6, 1, weather.power) * (1 - 0.4 * weather.fog) * (overK < 1.2 ? 1.3 : 1) * (bolo ? 1.5 : 1);
          if (u.dist < sight){
            if (!known){ STATE.stars = 0.5; WANT.t = 0; }
            startChase(u, speeding ? 'CLOCKED AT ' + Math.round(kmh) + ' KM/H · WANTED ' + starText(STATE.stars) : bolo && STATE.stars < 0.5 ? 'THEY RECOGNISE THE CAR' : 'SPOTTED · WANTED ' + starText(STATE.stars));
          }
        }
      }
    }
    if (u.state === 'parked'){ placeMover(u); continue; }
    if (u.state === 'chase'){ if (u.mode === 'conn'){ moveConn(u, dt); if (u.mode === 'edge') u.next = null; } else chaseMove(u, dt); }
    else { if (u.mode === 'conn') moveConn(u, dt); else moveOnEdge(u, dt); }
  }
  wantedTick(dt);
  // chase bookkeeping
  const units = police.filter(u => u.state === 'chase');
  if (!chase.on){ if (units.length) chase.on = true; else return; }
  if (!units.length){ endChase(true); return; }
  chase.t += dt;
  const heliLock = STATE.stars >= 4 && weather.power > 0.5 && weather.fog < 0.5 && !inCity(car.x, car.z, 40);
  let near = Infinity;
  for (const u of units){
    const d = Math.hypot(u.x - car.x, u.z - car.z); near = Math.min(near, d);
    const ahead = (u.x - car.x) * Math.sin(car.h) + (u.z - car.z) * Math.cos(car.h); // a unit waiting up the road hasn't lost you
    if (d > 300 && !heliLock && !(ahead > 0 && d < 1100)){ u.lostT += dt; if (u.lostT > 3){ u.state = 'patrol'; u.block = false; u.cool = 25; u.next = null; u.v0 = 22; popup('UNIT LOST YOU', 0, 'near'); } } else u.lostT = 0;
  }
  chase.near = near;
  if (heliLock && !chase.heliMsg){ chase.heliMsg = 1; popup('HELICOPTER ON YOU · HIDE IN A CITY OR WAIT FOR FOG / BLACKOUT', 0, 'bad'); }
  if (!heliLock) chase.heliMsg = 0;
  // backup from behind when there are too few on you
  chase.backupT -= dt;
  if (chase.backupT <= 0){ chase.backupT = 8;
    const want = BACKUP_WANT[Math.floor(STATE.stars)] || 1;
    if (units.length < want) (rnd() < 0.5 || STATE.stars < 1 ? callBackup : callInterceptor)();
    else if (STATE.stars >= 2 && near > 120 && rnd() < 0.5) callInterceptor(); }
  chase.blockT = (chase.blockT ?? 25) - dt;
  if (chase.blockT <= 0){ chase.blockT = 30 - 3 * STATE.stars; if (STATE.stars >= 2) roadblock(); }
  // the siren is only heard with a cop within 10 m of you
  sfx.sirenVol(near < 10 ? 0.1 * (1 - near / 20) : 0);
  $('chase').hidden = false;
  $('chase').textContent = '★ ' + starText(STATE.stars) + '  ·  ' + units.length + (units.length > 1 ? ' UNITS' : ' UNIT') + '  ·  NEAREST ' + Math.round(near) + ' M' + (near < 300 ? '  ·  LOSE THEM AT 300 M' : '');
  $('heat').hidden = STATE.stars < 4;
  // pinned: stopped with a cop on top of you
  if (near < 7 && Math.hypot(car.vx, car.vy) < 2){ chase.busted += dt; if (chase.busted > 2) busted('PINNED BY THE POLICE'); } else chase.busted = Math.max(0, chase.busted - dt);
}
// a unit comes the other way, or waits ahead in your lane, a few hundred metres down the road you're on
function grabUnit(){
  let u = police.filter(q => q.state !== 'chase' && q.state !== 'wreck' && !q.blocker).sort((a, b) => b.dist - a.dist)[0]; if (!u) return null;
  if (!u.active){ const m = COP_POOL.find(p => !p.unit) || COP_POOL.find(p => p.unit.state !== 'chase' && p.unit.state !== 'wreck'); if (!m) return null; if (m.unit) deactivate(m.unit); m.unit = u; u.look = m; u.active = true; m.mesh.visible = true; }
  if (u.conn) releaseLock(u); u.mode = 'edge'; u.conn = null; return u;
}
function callInterceptor(){
  const E = car.lastE; if (!E || E.cls === 'dt') return; const dirP = car.lastDir || 1, s0 = car.lastS + dirP * (480 + rnd() * 200);
  if (s0 < 40 || s0 > E.len - 40) return;
  const u = grabUnit(); if (!u) return;
  if (E.oneway){ u.e = E; u.s = s0; u.dir = dirP; u.tlane = u.lane = 0; u.d = laneD(E, dirP, Math.floor(rnd() * lanesAt(E, s0))); u.v = Math.max(20, Math.hypot(car.vx, car.vy) * 0.5); u.block = true; }
  else { u.e = E; u.s = s0; u.dir = -dirP; u.tlane = u.lane = 0; u.d = laneD(E, -dirP, 0); u.v = 25; u.block = false; }
  u.state = 'chase'; u.lostT = 0; u.next = null; u.cool = 0; placeMover(u);
  popup('POLICE AHEAD', 0, 'bad'); return u;
}
// roadblocks (two cars across the road, a gap at one side) and, from three stars, a stinger across the lanes
function roadblock(){
  const E = car.lastE; if (!E || E.ic || E.cls === 'dt') return; const dirP = car.lastDir || 1, s0 = car.lastS + dirP * (620 + rnd() * 200);
  if (s0 < 60 || s0 > E.len - 60) return;
  const r = edgeAt(E, s0, {}), hl = r.hl, hr = r.hr, width = hl + hr;
  if (STATE.stars >= 3){ const d0 = E.oneway ? -hr : (dirP > 0 ? -hr : 0), d1 = E.oneway ? hl : (dirP > 0 ? 0 : hl); addSpikes(E, s0 - dirP * 35, d0, d1); }
  const gapLeft = rnd() < 0.5, n = Math.max(1, Math.min(3, Math.floor(width / 5.2)));
  for (let k = 0; k < n; k++){
    const u = grabUnit(); if (!u) break;
    const frac = (k + 0.5) / (n + 1) + (gapLeft ? 1 / (n + 1) : 0), d = -hr + width * frac;
    if (!u.origHome) u.origHome = u.home; u.e = E; u.s = s0 + (rnd() - 0.5) * 3; u.dir = dirP; u.d = d; u.v = 0; u.state = 'parked'; u.blocker = 40; u.cool = 0; u.skew = (k % 2 ? 1 : -1) * 1.1;
    u.home = { e: E, s: u.s, dir: dirP, d }; placeMover(u);
  }
  popup('ROADBLOCK AHEAD', 0, 'bad');
}
const SPIKE_GEO = new THREE.BoxGeometry(1, 0.08, 0.5), SPIKE_MAT = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
function addSpikes(e, s, d0, d1){
  const r = edgeAt(e, s, {}), m = new THREE.Mesh(SPIKE_GEO, SPIKE_MAT), dm = (d0 + d1) / 2;
  m.position.set(r.x + r.nx * dm, r.y + 0.05, r.z + r.nz * dm); m.rotation.y = r.h + Math.PI / 2; m.scale.x = Math.abs(d1 - d0); scene.add(m);
  SPIKES.push({ e, s, d0: Math.min(d0, d1), d1: Math.max(d0, d1), mesh: m, t: 60 });
}
function updateSpikes(dt){
  for (let i = SPIKES.length - 1; i >= 0; i--){ const S = SPIKES[i]; S.t -= dt;
    if (car.sup && car.sup.e === S.e && Math.abs(car.sup.s - S.s) < 1.6 && car.sup.d > S.d0 - 0.8 && car.sup.d < S.d1 + 0.8 && !car.flat){
      car.flat = 25; toast('SPIKE STRIP', 'TYRES SHREDDED · SLOWER FOR 25 S OR UNTIL A GAS STATION', '#ff4058'); sfx.crash(4); cam.shake += 0.05; }
    if (S.t <= 0){ scene.remove(S.mesh); SPIKES.splice(i, 1); } }
  if (car.flat){ car.flat = Math.max(0, car.flat - dt); if (!car.flat) popup('TYRES OK AGAIN', 0, 'near'); }
}
function callBackup(){
  const E = car.lastE; if (!E || E.len < 700 || E.cls === 'dt') return;
  const dirP = car.lastDir || 1, s0 = car.lastS - dirP * (420 + rnd() * 120); if (s0 < 30 || s0 > E.len - 30) return;
  if (E.oneway && dirP < 0) return;
  const u = grabUnit(); if (!u) return; u.block = false;
  u.mode = 'edge'; u.conn = null; u.e = E; u.s = s0; u.dir = dirP; u.tlane = u.lane = 0; u.d = laneD(E, dirP, 0); u.v = Math.max(26, Math.hypot(car.vx, car.vy) * 0.9); u.state = 'chase'; u.lostT = 0; u.next = null; u.cool = 0; placeMover(u);
  popup('POLICE BACKUP BEHIND YOU', 0, 'bad'); return u;
}
// cops shove civilians out of the way (and slow down for them)
function copBumps(){
  for (const u of police){
    if (!u.active || u.state !== 'chase') continue;
    for (const c of traffic){
      if (c.mode === 'park') continue;
      const dx = c.x - u.x, dz = c.z - u.z; if (dx * dx + dz * dz > 100) continue;
      const hit = obb(u.x, u.z, u.h, 0.96, 2.28, c.x, c.z, c.h, c.wid / 2, c.len / 2); if (!hit) continue;
      if (c.mode === 'edge'){ const side = (dx * Math.cos(c.h) - dz * Math.sin(c.h)); c.d += clamp(hit.depth, 0, 0.6) * (side > 0 ? -1 : 1) * (c.dir > 0 ? -1 : 1) * 0.5; }
      if (!c.hit || c.wreck <= 0){ c.hit = true; c.wreck = Math.max(c.wreck, 1.4); if (Math.hypot(c.x - car.x, c.z - car.z) < 90) sfx.bump(3.5); }
      u.v = Math.min(u.v, Math.max(c.v, u.v * 0.7));
    }
  }
}
function drawPolice(dt, t){
  const fast = STATE.stars >= 4;
  for (const u of police){
    if (!u.active || !u.look) continue;
    const L = u.look, m = L.mesh;
    m.position.set(u.x, u.y, u.z); m.rotation.set(-Math.atan(u.slope || 0), u.h + (u.blocker && u.state === 'parked' ? u.skew : 0), 0, 'YXZ');
    u.wheel += u.v / PHYS.rw * dt; for (const w of L.wheels){ w.spin.rotation.x = u.wheel; w.pivot.rotation.y = w.front ? clamp(u.latV * 0.05, -0.25, 0.25) : 0; }
    L.tail.color.copy(u.acc < -1.5 || u.v < 1 ? TAIL_BRAKE : TAIL_DIM);
    const on = u.state === 'chase' && (t * (fast ? 9 : 5)) % 1 < 0.5, on2 = u.state === 'chase' && !on;
    L.lightA.color.setHex(on ? 0xff1a1a : 0x2a0000); L.lightB.color.setHex(on2 ? 0x2a5aff : 0x00002a); L.glowA.visible = on; L.glowB.visible = on2;
    if (L.fire.visible) L.fire.children.forEach((f, i) => f.scale.setScalar(1.5 + Math.sin(t * 19 + i * 2.1) * 0.45 + rnd() * 0.35));
  }
}
// ---------- the helicopter: at four stars it hangs over you and keeps the units on your tail
const heli = (() => {
  const grp = new THREE.Group(); grp.visible = false;
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), dark); body.scale.set(1, 0.8, 1.6); grp.add(body);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 5), dark); boom.position.set(0, 0.2, -4); grp.add(boom);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.4), dark); rotor.position.y = 1.5; grp.add(rotor);
  const rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2; grp.add(rotor2);
  const blink = new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false }); const bl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), blink); bl.position.set(0, -1.1, 0); grp.add(bl);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 1, 20, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  scene.add(grp, beam); beam.visible = false;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(8, 28), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.visible = false; scene.add(pool);
  return { grp, beam, pool, rotor, rotor2, blink, x: 0, y: 0, z: 0 };
})();
function updateHeli(dt, t){
  const on = chase.on && STATE.stars >= 4;
  heli.grp.visible = heli.beam.visible = heli.pool.visible = on;
  if (!on){ heli.x = car.x - 200; heli.z = car.z - 200; heli.y = car.y + 80; return; }
  const lock = weather.power > 0.5 && weather.fog < 0.5 && !inCity(car.x, car.z, 40);
  const fx = Math.sin(car.h), fz = Math.cos(car.h), tx = car.x - fx * 25, tz = car.z - fz * 25, ty = car.y + 55;
  const k = Math.min(1, dt * (lock ? 0.8 : 0.15));
  heli.x = lerp(heli.x, lock ? tx : tx + 120, k); heli.z = lerp(heli.z, lock ? tz : tz - 90, k); heli.y = lerp(heli.y, ty + (lock ? 0 : 30), k);
  heli.grp.position.set(heli.x, heli.y, heli.z); heli.grp.rotation.y = car.h;
  heli.rotor.rotation.y += dt * 40; heli.rotor2.rotation.y += dt * 40;
  heli.blink.color.setHex((t % 1) < 0.5 ? 0xff2020 : 0x300404);
  heli.beam.visible = heli.pool.visible = lock;
  const beamCol = STATE.stars >= 5 ? 0xff5a6a : 0xdfe8ff; heli.beam.material.color.setHex(beamCol); heli.pool.material.color.setHex(beamCol);
  const lx = car.x + Math.sin(t * 0.9) * 2, lz = car.z + Math.cos(t * 1.1) * 2, ly = car.y + 0.05;
  heli.pool.position.set(lx, ly + 0.03, lz);
  const dx = lx - heli.x, dy = ly - heli.y, dz = lz - heli.z, len = Math.hypot(dx, dy, dz);
  heli.beam.position.set(heli.x, heli.y - 0.8, heli.z); heli.beam.scale.set(1, len, 1);
  heli.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
}
// ---------- the gun: click a police car and it blows up. Ammo is bought in Nagisa (and you get one at every repair)
const GUN = { cool: 0 };
const BOOM = []; let boomI = 0;
for (let k = 0; k < 28; k++){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: 0xff8a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.visible = false; scene.add(sp); BOOM.push({ sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 }); }
function fireball(x, y, z, n){
  for (let k = 0; k < n; k++){ const b = BOOM[boomI = (boomI + 1) % BOOM.length]; b.life = b.max = 0.6 + rnd() * 0.9; b.vx = (rnd() - 0.5) * 10; b.vz = (rnd() - 0.5) * 10; b.vy = 2 + rnd() * 8; b.size = 2.5 + rnd() * 4.5;
    b.sp.position.set(x + (rnd() - 0.5) * 2, y + 0.8, z + (rnd() - 0.5) * 2); b.sp.material.color.setHex(rnd() < 0.5 ? 0xffb040 : 0xff5a20); b.sp.visible = true; }
}
function updateBoom(dt){
  GUN.cool = Math.max(0, GUN.cool - dt);
  for (const b of BOOM){ if (b.life <= 0) continue; b.life -= dt; const t = 1 - b.life / b.max;
    b.sp.position.x += b.vx * dt; b.sp.position.y += b.vy * dt; b.sp.position.z += b.vz * dt; b.vy -= 3 * dt; b.vx *= 0.97; b.vz *= 0.97;
    b.sp.scale.setScalar(b.size * (0.5 + t * 1.7)); b.sp.material.opacity = Math.max(0, 1 - t); if (b.life <= 0) b.sp.visible = false; }
}
function blowUp(u){
  fireball(u.x, u.y, u.z, 22); for (let k = 0; k < 8; k++) puff(u.x, u.y + 1.2, u.z, (rnd() - 0.5) * 3, (rnd() - 0.5) * 3, 0.9, 1.6);
  sfx.crash(10); cam.shake += 0.1;
  u.state = 'wreck'; u.wreckT = 16; u.look.fire.visible = true; u.v *= 0.35; u.tdOverride = null;
  const pts = Math.round(600 * run.mult); addCash(pts, 'COP DOWN');
}
function shoot(cx, cy){
  if (GUN.cool > 0) return;
  if (STATE.ammo <= 0){ popup('OUT OF AMMO · BUY MORE IN NAGISA', 0, 'bad'); sfx.beep(220); GUN.cool = 0.4; return; }
  GUN.cool = 0.35; STATE.ammo--; sfx.pop(); sfx.bump(6); cam.shake += 0.02;
  const rect = renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((cx - rect.left) / rect.width * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), camera);
  let best = null, bd = Infinity; const v = new THREE.Vector3();
  for (const u of police){
    if (!u.active || u.state === 'wreck') continue;
    v.set(u.x, u.y + 0.8, u.z); const along = v.clone().sub(ray.ray.origin).dot(ray.ray.direction);
    if (along < 0 || along > 450) continue;
    if (ray.ray.distanceToPoint(v) < 2.8 + along * 0.012 && along < bd){ bd = along; best = u; }
  }
  if (best) blowUp(best); else popup('MISS · ' + STATE.ammo + (STATE.ammo === 1 ? ' SHOT' : ' SHOTS') + ' LEFT', 0, 'bad');
  saveState();
}
