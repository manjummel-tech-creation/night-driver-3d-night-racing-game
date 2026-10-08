// =====================================================================================================
// HUD, MINIMAP, THE BIG MAP, GPS, MENU, MAIN LOOP
// =====================================================================================================
const compass = h => { const a = ((Math.atan2(Math.sin(h), -Math.cos(h)) * 180 / Math.PI) + 360) % 360; return ['NORTH', 'NORTH-EAST', 'EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST'][Math.round(a / 45) % 8]; };
// ---------- GPS: a route to a city or a gas station, re-planned as you drive
const gps = { path: [], t: 0, total: 0, next: null, arrivedT: 0 };
function destLabel(){ const d = STATE.dest; if (!d) return ''; if (d.type === 'pt') return d.label || 'MARKED SPOT'; if (d.type === 'city') return CITIES.find(c => c.id === d.id)?.name || ''; const st = STATIONS[d.idx]; return st ? (st.kind === 'shop' ? (st.place && st.place.isTown ? st.place.name : st.name) : 'GAS · ' + st.e.name) : ''; }
function destCost(e2, d2){
  const d = STATE.dest; if (!d) return Infinity;
  if (d.type === 'city'){ const c = CITIES.find(q => q.id === d.id), T = c.center; return e2.len + distTo(T)[endNode(e2, d2).id]; }
  if (d.type === 'pt'){ const E = EDGES[d.eId]; if (!E) return Infinity; if (e2 === E) return d2 > 0 ? d.s : E.len - d.s; return e2.len + costToPoint(endNode(e2, d2).id, E, d.s); }
  const st = STATIONS[d.idx]; if (e2 === st.e && d2 > 0) return st.sm;
  return e2.len + costToPoint(endNode(e2, d2).id, st.e, st.sm);
}
function destReached(e, dir, s){ const d = STATE.dest; if (!d) return false; if (d.type === 'pt') return Math.hypot(d.x - car.x, d.z - car.z) < 45; if (d.type === 'city'){ const c = CITIES.find(q => q.id === d.id); return !!inCity(car.x, car.z, 0) && inCity(car.x, car.z, 0) === c; } const st = STATIONS[d.idx]; return Math.hypot(st.pad.cx - car.x, st.pad.cz - car.z) < 60; }
function planPath(maxLen, useDest){ // the roads ahead, as [{ e, dir, s0, s1 }]
  const E = car.lastE; if (!E) return [];
  const out = [], dir = car.lastDir || 1; let len = 0, e = E, d = dir, s = car.lastS;
  for (let k = 0; k < 140 && len < maxLen; k++){
    const s1 = d > 0 ? e.len : 0; out.push({ e, dir: d, s0: s, s1, off: len }); len += Math.abs(s1 - s);
    if (useDest && STATE.dest && STATE.dest.type === 'station' && e === STATIONS[STATE.dest.idx].e && d > 0 && s <= STATIONS[STATE.dest.idx].sm){ out[out.length - 1].s1 = STATIONS[STATE.dest.idx].sm; break; }
    if (useDest && STATE.dest && STATE.dest.type === 'pt' && e === EDGES[STATE.dest.eId] && (d > 0 ? s <= STATE.dest.s : s >= STATE.dest.s)){ out[out.length - 1].s1 = STATE.dest.s; break; }
    const n = endNode(e, d); let best = null, bc = Infinity;
    const arr = headAt(e, d, d > 0 ? e.len - 2 : 2);
    for (const [e2, d2] of n.out){
      if (e2 === e && d2 === -d && n.out.length > 1) continue;
      let c;
      if (useDest && STATE.dest){ c = destCost(e2, d2) + (jHidden(e2) ? 1e7 : 0); }
      else { const dep = headAt(e2, d2, d2 > 0 ? Math.min(6, e2.len) : Math.max(0, e2.len - 6)); c = Math.abs(angWrap(dep - arr)) + (e2.route === e.route ? 0 : 0.35) + (e2.cls === 'rp' ? 0.6 : 0); }
      if (c < bc){ bc = c; best = [e2, d2]; }
    }
    if (!best) break;
    if (useDest && STATE.dest && STATE.dest.type === 'city'){ const c = CITIES.find(q => q.id === STATE.dest.id); if (n.city === c) break; }
    [e, d] = best; s = d > 0 ? 0 : e.len;
  }
  return out;
}
function updateGps(dt){
  gps.t -= dt; if (gps.t > 0) return; gps.t = 0.8;
  if (!STATE.dest){ gps.path = []; gps.next = null; return; }
  if (destReached()){ gps.arrivedT += 0.8; if (gps.arrivedT > 0.8){ toast('ARRIVED', destLabel(), '#3ee07a'); STATE.dest = null; gps.path = []; gps.next = null; gps.arrivedT = 0; } return; }
  gps.path = planPath(80000, true); gps.total = gps.path.reduce((a, p) => a + Math.abs(p.s1 - p.s0), 0);
  // the next thing to do: leave this road
  gps.next = null; const cur = gps.path[0];
  for (let k = 1; k < gps.path.length; k++){
    const p = gps.path[k], q = gps.path[k - 1];
    const arr = headAt(q.e, q.dir, q.dir > 0 ? q.e.len - 2 : 2), dep = headAt(p.e, p.dir, p.dir > 0 ? Math.min(6, p.e.len) : Math.max(0, p.e.len - 6)), da = angWrap(dep - arr);
    const named = p.e.route !== cur.e.route || (p.e.cls === 'rp');
    if (named || Math.abs(da) > 0.6){
      const what = p.e.cls === 'rp' ? 'TAKE THE EXIT' : Math.abs(da) > 0.6 ? (da > 0 ? 'TURN LEFT' : 'TURN RIGHT') : 'KEEP ON';
      let target = p; if (p.e.cls === 'rp'){ for (let j = k; j < gps.path.length; j++) if (gps.path[j].e.cls !== 'rp'){ target = gps.path[j]; break; } }
      gps.next = { dist: p.off, what, onto: target.e.name.replace(/ · .*$/, '') }; break;
    }
  }
}
// ---------- the GPS route drawn on the road ahead: a glowing blue ribbon with arrows flowing the way to go
const GPS_N = 240, GPS_STEP = 4;
const gpsTex = canvasTex(64, 128, g => { g.clearRect(0, 0, 64, 128); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(47,168,255,0)'); gr.addColorStop(0.2, 'rgba(47,168,255,0.65)'); gr.addColorStop(0.8, 'rgba(47,168,255,0.65)'); gr.addColorStop(1, 'rgba(47,168,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  g.fillStyle = 'rgba(215,245,255,0.95)'; g.beginPath(); g.moveTo(10, 92); g.lineTo(32, 46); g.lineTo(54, 92); g.lineTo(42, 92); g.lineTo(32, 70); g.lineTo(22, 92); g.closePath(); g.fill(); });
gpsTex.wrapT = THREE.RepeatWrapping;
const GPS_MAT = new THREE.MeshBasicMaterial({ map: gpsTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const gpsGeo = new THREE.BufferGeometry();
gpsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GPS_N * 2 * 3), 3)); gpsGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(GPS_N * 2 * 2), 2));
{ const idx = []; for (let i = 0; i < GPS_N - 1; i++){ const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } gpsGeo.setIndex(idx); }
const gpsMesh = new THREE.Mesh(gpsGeo, GPS_MAT); gpsMesh.frustumCulled = false; gpsMesh.visible = false; scene.add(gpsMesh);
let gpsLineT = 0;
function updateGpsLine(dt){
  gpsTex.offset.y -= dt * 0.9;
  gpsLineT -= dt; if (gpsLineT > 0) return; gpsLineT = 0.12;
  if (!STATE.dest || !gps.path.length || !car.lastE || inJukai()){ gpsMesh.visible = false; return; }
  const P = []; let skip = 7;
  for (const p of gps.path){
    const L = Math.abs(p.s1 - p.s0); let t = 0;
    if (p === gps.path[0]){ const q = refineOn(p.e, p.e.i0 + clamp(Math.round(car.lastS / p.e.ds), 0, p.e.n - 1), car.x, car.z, {}); t = clamp((q.s - p.s0) * p.dir, 0, L); }
    for (; t <= L && P.length < GPS_N; t += GPS_STEP){
      if (skip > 0){ skip -= GPS_STEP; continue; }
      const s = p.s0 + t * p.dir, r = edgeAt(p.e, s, _ra), d = p.e.oneway ? 0 : laneD(p.e, p.dir, 0);
      P.push([r.x + r.nx * d, r.y + 0.14, r.z + r.nz * d]);
    }
    if (P.length >= GPS_N) break;
  }
  const n = P.length; if (n < 2){ gpsMesh.visible = false; return; }
  const pos = gpsGeo.attributes.position.array, uv = gpsGeo.attributes.uv.array; let dist = 0;
  for (let i = 0; i < n; i++){
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], tz = b[2] - a[2]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const w = 0.7, nx = tz * w, nz = -tx * w;
    if (i) dist += Math.hypot(P[i][0] - P[i - 1][0], P[i][2] - P[i - 1][2]);
    pos.set([P[i][0] + nx, P[i][1], P[i][2] + nz, P[i][0] - nx, P[i][1], P[i][2] - nz], i * 6);
    uv.set([0, dist / 7, 1, dist / 7], i * 4);
  }
  gpsGeo.setDrawRange(0, (n - 1) * 6); gpsGeo.attributes.position.needsUpdate = true; gpsGeo.attributes.uv.needsUpdate = true; gpsMesh.visible = true;
}
// ---------- HUD
const tach = $('tach'), tctx = tach.getContext('2d');
function drawTach(rpm){
  const c = tctx, S = 2; c.setTransform(S, 0, 0, S, 0, 0); c.clearRect(0, 0, 240, 240);
  const cx = 120, cy = 120, R = 104, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, MAX = 8000, ang = v => a0 + (a1 - a0) * v / MAX;
  c.beginPath(); c.arc(cx, cy, R + 10, 0, TAU); c.fillStyle = 'rgba(8,11,20,0.62)'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,0.13)'; c.stroke();
  c.lineWidth = 8; c.lineCap = 'butt';
  c.beginPath(); c.arc(cx, cy, R - 4, ang(7000), a1); c.strokeStyle = 'rgba(255,64,88,0.5)'; c.stroke();
  c.beginPath(); c.arc(cx, cy, R - 4, a0, ang(Math.min(rpm, MAX))); c.strokeStyle = rpm > 7000 ? '#ff4058' : rpm > 6000 ? '#ffb04a' : '#eef1f7'; c.stroke();
  c.fillStyle = '#8d96ab'; c.font = '500 15px Teko, Arial Narrow, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let k = 0; k <= 8; k++){
    const a = ang(k * 1000), ca = Math.cos(a), sa = Math.sin(a);
    c.strokeStyle = k >= 7 ? '#ff4058' : 'rgba(238,241,247,0.7)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx + ca * (R - 12), cy + sa * (R - 12)); c.lineTo(cx + ca * (R - 20), cy + sa * (R - 20)); c.stroke();
    c.fillText(String(k), cx + ca * (R - 30), cy + sa * (R - 30));
  }
  c.fillStyle = '#8d96ab'; c.font = '600 9px "Chakra Petch", sans-serif'; c.fillText('×1000 RPM', cx, cy + 66);
  const a = ang(Math.min(rpm, MAX)); c.strokeStyle = '#ffb04a'; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 44), cy + Math.sin(a) * (R - 44)); c.lineTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); c.stroke();
}
// decimated road polylines for the maps
const EDGE_POLY = EDGES.map(e => { const pts = [], k = Math.max(1, Math.round(20 / e.ds)); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let q = 0; q < e.n; q += k){ const i = e.i0 + q; pts.push(SX[i], SZ[i]); } const i = e.i0 + e.n - 1; pts.push(SX[i], SZ[i]);
  for (let q = 0; q < pts.length; q += 2){ x0 = Math.min(x0, pts[q]); x1 = Math.max(x1, pts[q]); z0 = Math.min(z0, pts[q + 1]); z1 = Math.max(z1, pts[q + 1]); }
  return { pts, x0, x1, z0, z1 }; });
const ROAD_STYLE = { cw: ['rgba(255,170,80,0.85)', 4.2], rp: ['rgba(255,210,130,0.7)', 2.6], rd: ['rgba(238,241,247,0.55)', 2.6], st: ['rgba(200,210,225,0.4)', 2.4], al: ['rgba(200,210,225,0.32)', 1.5], ln: ['rgba(214,198,166,0.5)', 1.6], mt: ['rgba(240,214,188,0.6)', 1.8], rw: ['rgba(220,220,220,0.6)', 4.5], dt: ['rgba(214,150,80,0.85)', 1.8] };
const ROAD_ORDER = ['dt', 'al', 'ln', 'mt', 'rw', 'st', 'rd', 'rp', 'cw'];
const mapC = $('map'), mctx = mapC.getContext('2d');
function drawMinimap(){
  const c = mctx, S = 2, R = 80; c.setTransform(S, 0, 0, S, 0, 0); c.clearRect(0, 0, 160, 160);
  c.save(); c.beginPath(); c.arc(80, 80, R - 1, 0, TAU); c.clip();
  c.fillStyle = 'rgba(8,11,20,0.55)'; c.fillRect(0, 0, 160, 160);
  const sc = 0.075, ch = Math.cos(car.h), sh = Math.sin(car.h), view = 1300;
  const toMap = (x, z) => { const dx = x - car.x, dz = z - car.z, f = dx * sh + dz * ch, l = dx * ch - dz * sh; return [80 - l * sc, 100 - f * sc]; };
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const cls of ROAD_ORDER){
    c.strokeStyle = ROAD_STYLE[cls][0]; c.lineWidth = ROAD_STYLE[cls][1]; c.beginPath();
    EDGES.forEach((e, k) => { if (e.cls !== cls || jHidden(e)) return; const P = EDGE_POLY[k]; if (P.x1 < car.x - view || P.x0 > car.x + view || P.z1 < car.z - view || P.z0 > car.z + view) return;
      for (let q = 0; q < P.pts.length; q += 2){ const [mx, my] = toMap(P.pts[q], P.pts[q + 1]); q ? c.lineTo(mx, my) : c.moveTo(mx, my); } });
    c.stroke();
  }
  if (gps.path.length){ c.strokeStyle = 'rgba(127,227,255,0.95)'; c.lineWidth = 3.2; c.beginPath(); let first = true;
    for (const p of gps.path){ if (p.off > 2500) break; const step = Math.max(10, e2ds(p.e)) * (p.s1 >= p.s0 ? 1 : -1);
      for (let s = p.s0; (step > 0 ? s <= p.s1 : s >= p.s1); s += step){ const r = edgeAt(p.e, s, _ra), [mx, my] = toMap(r.x, r.z); first ? c.moveTo(mx, my) : c.lineTo(mx, my); first = false; } }
    c.stroke(); }
  for (const p of PATCHES){ if (!p.poly || p.node.links.length < 3 || Math.abs(p.x - car.x) > 1100 || Math.abs(p.z - car.z) > 1100) continue; const [mx, my] = toMap(p.x, p.z); if (Math.hypot(mx - 80, my - 80) > R - 4) continue; junctionIcon(c, mx, my, !!p.rb, 0.75); }
  for (const st of STATIONS){ const [mx, my] = toMap(st.pad.cx, st.pad.cz); if (Math.hypot(mx - 80, my - 80) > R) continue; c.fillStyle = st.kind === 'shop' ? '#ff3d9a' : st.kind === 'fuel' ? '#ffd23d' : '#3ee07a'; c.beginPath(); c.arc(mx, my, 4, 0, TAU); c.fill(); }
  for (const t of traffic){ if (t.mode === 'park') continue; const [mx, my] = toMap(t.x, t.z); c.fillStyle = t.truck ? '#ffb04a' : 'rgba(255,90,100,0.9)'; c.fillRect(mx - 1.4, my - 1.4, 2.8, 2.8); }
  heistMarks(c, toMap, false, 0); cluePinMark(c, toMap, false);
  if (inJukai()){ const t = performance.now(); c.fillStyle = 'rgba(6,12,8,0.93)'; c.fillRect(0, 0, 160, 160); for (let k = 0; k < 260; k++){ c.fillStyle = 'rgba(160,220,170,' + (Math.random() * 0.25) + ')'; c.fillRect(Math.random() * 160, Math.random() * 160, 2, 2); } c.fillStyle = '#9affc8'; c.font = '800 13px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.fillText('樹海', 80, 70); c.font = '700 9px "Chakra Petch", sans-serif'; c.fillText('NO SIGNAL', 80, 86); c.restore(); const sp = Math.sin(t / 700) * 2 + Math.sin(t / 290); c.fillStyle = '#ffb04a'; c.font = '700 11px "Chakra Petch", sans-serif'; c.fillText('N', 80 - Math.sin(sp) * 71, 80 + Math.cos(sp) * 71); return; }
  const fl = (performance.now() / 220 | 0) % 2;
  for (const u of police){ if (!u.active && !(UPK.scanner && Math.abs(u.x - car.x) < 1300 && Math.abs(u.z - car.z) < 1300)) continue; const [mx, my] = toMap(u.x, u.z); c.fillStyle = u.state === 'chase' ? (fl ? '#ff2a2a' : '#2f6bff') : '#2f6bff'; c.beginPath(); c.arc(mx, my, u.state === 'chase' ? 4 : 3, 0, TAU); c.fill(); if (UPK.scanner && u.state !== 'chase'){ c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.stroke(); } }
  c.restore();
  c.fillStyle = '#7fe3ff'; c.beginPath(); c.moveTo(80, 94); c.lineTo(75, 106); c.lineTo(85, 106); c.closePath(); c.fill();
  // north marker on the rim: world north (-z) seen in the rotating map
  const rx = 80 - sh * (R - 9), ry = 80 + ch * (R - 9);
  c.fillStyle = '#ffb04a'; c.font = '700 11px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', rx, ry);
}
const e2ds = e => e.cls === 'st' ? 10 : 20;
let hudT = 0;
function updateHud(dt){
  hudT -= dt;
  drawTach(car.rpm);
  { const a = '●'.repeat(Math.min(9, STATE.ammo)) || '—', el = $('ammo'); if (el.textContent !== a) el.textContent = a; }
  $('nitroBar').style.width = (car.nitro * 100).toFixed(1) + '%'; $('nitro').classList.toggle('on', !!car.nosOn);
  $('fuelBar').style.width = (car.fuel * 100).toFixed(1) + '%'; $('fuelBox').classList.toggle('low', car.fuel < 0.2);
  if (hudT > 0) return; hudT = 1 / 15;
  const kmh = Math.round(Math.abs(car.vx) * 3.6);
  { const rb = $('rocketBox'); rb.hidden = !UPK.rocket; if (UPK.rocket){ const t = Math.round((car.rocket ?? 1) * 100) + '%'; if ($('rocketPct').textContent !== t) $('rocketPct').textContent = t; } }
  $('spd').textContent = kmh; $('gear').textContent = car.gear < 0 ? 'R' : car.gear;
  $('cash').textContent = '$' + Math.round(STATE.cash).toLocaleString();
  { const el = $('stars'), t = starText(STATE.stars); if (el.textContent !== t){ el.textContent = t; el.classList.toggle('zero', STATE.stars <= 0); } }
  $('mult').textContent = '×' + run.mult.toFixed(1); $('comboBar').style.width = (run.combo / COMBO * 100) + '%';
  $('odo').textContent = (STATE.odo / 1000).toFixed(1) + ' km';
  $('dmgBar').style.width = Math.round(car.damage * 100) + '%';
  { const hh = Math.floor(DAY.t), mm = Math.floor((DAY.t - hh) * 60); $('clock').textContent = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }
  $('crashes').textContent = run.crashes ? 'CRASH ' + run.crashes + '/5' : '';
  { const st = nearestStation('gas'), d = st ? Math.hypot(st.pad.cx - car.x, st.pad.cz - car.z) : 0; $('gasNext').textContent = st ? (d < 120 ? 'AT A GAS STATION' : 'NEAREST GAS ' + (d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m') + ' ' + compass(Math.atan2(st.pad.cx - car.x, st.pad.cz - car.z))) : ''; }
  // the road you're on, and what the GPS says
  { const e = car.sup && car.sup.e, city = inCity(car.x, car.z, 0);
    const name = car.sup && car.sup.kind === 'pad' ? car.sup.pad.name : e ? e.name : city ? city.name : car.sup && car.sup.kind === 'patch' && car.sup.patch.node.label ? car.sup.patch.node.label : (car.lastE ? car.lastE.name : '');
    const t = name + (car.lastE && car.lastE.cls !== 'st' ? '  ·  ' + compass(car.h) : '') ; if ($('roadName').textContent !== t) $('roadName').textContent = t;
    const g = $('gpsLine');
    if (STATE.dest && inJukai()){ g.hidden = false; g.textContent = 'GPS · NO SIGNAL · 樹海 · FIND YOUR OWN WAY OUT'; }
    else if (STATE.dest){ g.hidden = false; const n = gps.next; g.textContent = 'GPS → ' + destLabel() + ' · ' + (gps.total / 1000).toFixed(1) + ' km' + (n ? '  ·  ' + (n.dist < 1000 ? Math.round(n.dist / 10) * 10 + ' m' : (n.dist / 1000).toFixed(1) + ' km') + ': ' + n.what + (n.what === 'TURN LEFT' || n.what === 'TURN RIGHT' || n.what === 'TAKE THE EXIT' ? ' → ' : ' ') + n.onto : ''); }
    else g.hidden = true; }
  { const lim = speedLimitAt(), el = $('limit'); if (el.textContent !== String(lim)) el.textContent = lim; el.classList.toggle('over', kmh > lim * 1.2); }
  drawAhead();
  drawMinimap();
}
// ---------- the traffic-ahead bar: how busy the next 1.5 km of your road is, with police, gas stations and junctions marked
function drawAhead(){
  const path = gps.path.length ? gps.path : planPath(1600, false);
  const cv = $('trafBar'), g = cv.getContext('2d'), H = cv.height, BIN = 50, NB2 = 30, cnt = new Float32Array(NB2);
  const onPath = (e, dir, s) => { for (const p of path){ if (p.off > 1500) break; if (p.e !== e || p.dir !== dir) continue; const lo = Math.min(p.s0, p.s1), hi = Math.max(p.s0, p.s1); if (s >= lo && s <= hi) return p.off + Math.abs(s - p.s0); } return -1; };
  for (const c of traffic){ if (c.mode !== 'edge') continue; const rel = onPath(c.e, c.dir, c.s); if (rel >= 0 && rel < BIN * NB2) cnt[Math.floor(rel / BIN)] += c.truck ? 1.6 : 1; }
  for (let y = 0; y < H; y += 4){
    const dist = (1 - y / H) * 1500, b = Math.min(NB2 - 1, Math.floor(dist / BIN));
    const live = (cnt[Math.max(0, b - 1)] + cnt[b] * 2 + cnt[Math.min(NB2 - 1, b + 1)]) / 4 / 3;
    let t = live; if (dist > 1100){ const p = path.find(q => q.off + Math.abs(q.s1 - q.s0) > dist); if (p) t = densityAt(p.e, clamp(p.s0 + (dist - p.off) * p.dir, 0, p.e.len)); }
    t = clamp(t, 0, 1);
    const rr = t < 0.5 ? lerp(60, 255, t * 2) : 255, gg = t < 0.5 ? lerp(220, 205, t * 2) : lerp(205, 60, (t - 0.5) * 2), bb = t < 0.5 ? lerp(120, 60, t * 2) : lerp(60, 70, (t - 0.5) * 2);
    g.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`; g.fillRect(0, y, cv.width, 4);
  }
  g.fillStyle = 'rgba(0,0,0,0.5)'; for (const k of [1, 2]) g.fillRect(0, H - H * k / 3, cv.width, 1);
  const fl = (performance.now() / 220 | 0) % 2;
  for (const u of police){ if ((!u.active && !UPK.scanner) || u.mode !== 'edge') continue; const rel = onPath(u.e, u.dir, u.s) >= 0 ? onPath(u.e, u.dir, u.s) : u.e.pair || u.e.oneway ? -1 : onPath(u.e, -u.dir, u.s); if (rel < 0 || rel > 1500) continue;
    const y = H - rel / 1500 * H; g.fillStyle = '#fff'; g.fillRect(0, y - 4, cv.width, 8); g.fillStyle = u.state === 'chase' ? (fl ? '#ff2a2a' : '#2f6bff') : (fl ? '#2f6bff' : '#0a1640'); g.fillRect(1, y - 3, cv.width - 2, 6); }
  const ic = $('trafIcons'), chh = Math.round(ic.clientHeight * 2) || 440; if (ic.height !== chh) ic.height = chh;
  const q = ic.getContext('2d'), W = ic.width, IH = ic.height, k = W / 24; q.clearRect(0, 0, W, IH);
  const box = (rel, fill) => { const s2 = 20 * k, x0 = W - s2 - 2 * k, y0 = clamp(IH - Math.max(0, rel) / 1500 * IH - s2 / 2, 0, IH - s2);
    q.fillStyle = fill; q.beginPath(); if (q.roundRect) q.roundRect(x0, y0, s2, s2, 4 * k); else q.rect(x0, y0, s2, s2); q.fill(); q.strokeStyle = 'rgba(255,255,255,0.85)'; q.lineWidth = 1.2 * k; q.stroke(); return [x0, y0, s2 / 20]; };
  for (const st of STATIONS){ const rel = onPath(st.e, 1, st.sm); if (rel < 0 || rel > 1500) continue;
    const [x0, y0, u] = box(rel, st.kind === 'shop' ? '#c41f72' : '#1d63d8');
    q.fillStyle = '#fff'; q.fillRect(x0 + 4 * u, y0 + 4 * u, 8 * u, 13 * u); q.fillStyle = st.kind === 'shop' ? '#c41f72' : '#1d63d8'; q.fillRect(x0 + 5.5 * u, y0 + 5.5 * u, 5 * u, 3.5 * u);
    q.strokeStyle = '#fff'; q.lineWidth = 1.6 * u; q.beginPath(); q.moveTo(x0 + 12 * u, y0 + 7 * u); q.lineTo(x0 + 15.5 * u, y0 + 9.5 * u); q.lineTo(x0 + 15.5 * u, y0 + 15 * u); q.stroke(); }
  for (let j = 0; j < path.length - 1; j++){ const p = path[j], n = endNode(p.e, p.dir), rel = p.off + Math.abs(p.s1 - p.s0); if (rel > 1500) break;
    if (n.out.length < 2 + (p.e.oneway ? 0 : 1) || (n.city && !n.gateHw && !n.rb && n.links.length < 3)) continue;
    if (n.rb || (n.type === 'x' && n.links.length >= 3)){ // a roundabout or a junction coming up: its own sign
      const [x0, y0, u] = box(rel, n.rb ? '#1a5fb4' : '#20262e'); q.save(); q.translate(x0 + 10 * u, y0 + 10 * u); junctionIcon(q, 0, 0, !!n.rb, u * 1.25); q.restore(); continue; }
    const [x0, y0, u] = box(rel, '#20262e'); q.lineCap = 'round'; q.lineWidth = 3 * u; q.strokeStyle = '#eef1f7';
    q.beginPath(); q.moveTo(x0 + 10 * u, y0 + 17 * u); q.lineTo(x0 + 10 * u, y0 + 11 * u); q.stroke();
    for (const side of [-1, 1]){ q.strokeStyle = '#eef1f7'; q.beginPath(); q.moveTo(x0 + 10 * u, y0 + 11 * u); q.quadraticCurveTo(x0 + 10 * u, y0 + 7 * u, x0 + (10 + side * 5.5) * u, y0 + 3.5 * u); q.stroke(); }
    q.lineCap = 'butt'; }
}

// ---------- the big map
let mapOpen = false;
const BMAP = { cv: $('bigCanvas'), cx: 0, cz: 0, sc: 0.02, sel: null, bg: null, drag: null, moved: 0, W: 0, H: 0 };
function mapBg(){
  if (BMAP.bg) return BMAP.bg;
  const S = 125, W = Math.ceil((WB.x1 - WB.x0) / S), H = Math.ceil((WB.z1 - WB.z0) / S), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), hs = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) hs[j * W + i] = natural(WB.x0 + (i + 0.5) * S, WB.z0 + (j + 0.5) * S);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++){
    const x = WB.x0 + (i + 0.5) * S, z = WB.z0 + (j + 0.5) * S, h = hs[j * W + i], o = (j * W + i) * 4;
    const m = mtnK(x, z), r = ruralK(z);
    let cr = lerp(lerp(22, 60, m), 58, r), cg = lerp(lerp(44, 52, m), 56, r), cb = lerp(lerp(30, 44, m), 32, r);
    const snow = smooth(1250, 1380, h) * m; cr = lerp(cr, 150, snow); cg = lerp(cg, 158, snow); cb = lerp(cb, 172, snow);
    const hx = hs[j * W + Math.min(W - 1, i + 1)] - h, hz = hs[Math.min(H - 1, j + 1) * W + i] - h, shade = clamp(1 + (-hx - hz) * 0.012, 0.55, 1.45);
    let water = false; for (const L of LAKES) if (h < L.wl + 0.2 && lakeQ(L, x, z) < 1.2){ water = true; break; }
    if (water){ cr = 18; cg = 42; cb = 78; } else { cr *= shade; cg *= shade; cb *= shade; }
    img.data[o] = cr; img.data[o + 1] = cg; img.data[o + 2] = cb; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); BMAP.bg = c; return c;
}
function mapSize(){ const r = BMAP.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); BMAP.W = r.width; BMAP.H = r.height; if (BMAP.cv.width !== Math.round(r.width * dpr)){ BMAP.cv.width = Math.round(r.width * dpr); BMAP.cv.height = Math.round(r.height * dpr); } return dpr; }
function openMap(){
  if (!started) return;
  mapOpen = true; paused = true; for (const k in keys) keys[k] = false; $('bigmap').hidden = false; mapBg(); mapSize();
  BMAP.sc = Math.min(BMAP.W / (WB.x1 - WB.x0), BMAP.H / (WB.z1 - WB.z0)) * 0.95; BMAP.cx = (WB.x0 + WB.x1) / 2; BMAP.cz = (WB.z0 + WB.z1) / 2;
  BMAP.sel = null; renderMapSide(); drawBigMap(); try { $('mapClose').focus(); } catch (e) {}
}
function closeMap(){ mapOpen = false; $('bigmap').hidden = true; paused = false; last = performance.now(); sfx.resume(); }
const w2s = (x, z) => [BMAP.W / 2 + (x - BMAP.cx) * BMAP.sc, BMAP.H / 2 + (z - BMAP.cz) * BMAP.sc];
const s2w = (px, py) => [BMAP.cx + (px - BMAP.W / 2) / BMAP.sc, BMAP.cz + (py - BMAP.H / 2) / BMAP.sc];
function junctionIcon(g, x, y, rb, k){
  g.save(); g.translate(x, y); g.scale(k, k);
  if (rb){ g.fillStyle = 'rgba(10,14,24,.85)'; g.beginPath(); g.arc(0, 0, 6.5, 0, TAU); g.fill(); g.strokeStyle = '#ffd282'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 4.2, 0.4, TAU - 0.3); g.stroke(); g.fillStyle = '#ffd282'; g.beginPath(); g.moveTo(4.2, -1); g.lineTo(7, 2.6); g.lineTo(1.6, 2.4); g.closePath(); g.fill(); }
  else { g.fillStyle = 'rgba(10,14,24,.85)'; g.fillRect(-4.5, -4.5, 9, 9); g.strokeStyle = '#ffffff'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.moveTo(0, -3); g.lineTo(0, 3); g.stroke(); }
  g.restore();
}
function drawBigMap(){
  if (!mapOpen) return;
  const dpr = mapSize(), g = BMAP.cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#05070d'; g.fillRect(0, 0, BMAP.W, BMAP.H);
  const [bx, by] = w2s(WB.x0, WB.z0); g.imageSmoothingEnabled = true; g.drawImage(mapBg(), bx, by, (WB.x1 - WB.x0) * BMAP.sc, (WB.z1 - WB.z0) * BMAP.sc);
  // region labels
  g.font = '700 12px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,0.28)';
  for (const [t, x, z] of [['MOUNTAINS', -9000, 21000], ['FOREST & LAKES', -5000, -2500], ['FARMLAND', 6000, -21000]]){ const [px, py] = w2s(x, z); g.fillText(t, px, py); }
  const zoomW = clamp(BMAP.sc * 60, 0.6, 2.2);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const here = car.lastE;
  for (const cls of ROAD_ORDER){
    g.strokeStyle = ROAD_STYLE[cls][0]; g.lineWidth = ROAD_STYLE[cls][1] * 0.5 * zoomW; g.beginPath();
    EDGES.forEach((e, k) => { if (e.cls !== cls || jHidden(e)) return; const P = EDGE_POLY[k]; for (let q = 0; q < P.pts.length; q += 2){ const [px, py] = w2s(P.pts[q], P.pts[q + 1]); q ? g.lineTo(px, py) : g.moveTo(px, py); } });
    g.stroke();
  }
  if (here){ // the road you're on
    g.strokeStyle = 'rgba(255,224,90,0.95)'; g.lineWidth = 3.2 * zoomW; g.beginPath();
    for (const e of EDGES){ if (e.name !== here.name || (here.city && e.city !== here.city)) continue; const P = EDGE_POLY[e.id]; for (let q = 0; q < P.pts.length; q += 2){ const [px, py] = w2s(P.pts[q], P.pts[q + 1]); q ? g.lineTo(px, py) : g.moveTo(px, py); } }
    g.stroke(); }
  const sr = BMAP.sel && BMAP.sel.road;
  if (sr){ g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4 * zoomW; g.shadowColor = '#7fe3ff'; g.shadowBlur = 10; g.beginPath();
    for (const e of EDGES){ if (e.name !== sr.name || (sr.city && e.city !== sr.city) || jHidden(e)) continue; const P = EDGE_POLY[e.id]; for (let q = 0; q < P.pts.length; q += 2){ const [px, py] = w2s(P.pts[q], P.pts[q + 1]); q ? g.lineTo(px, py) : g.moveTo(px, py); } }
    g.stroke(); g.shadowBlur = 0; }
  // street names along the roads once you're zoomed in
  if (BMAP.sc > 0.09){ const placed = []; g.font = '700 ' + (BMAP.sc > 0.25 ? 12 : 10) + 'px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const e of EDGES){ if (jHidden(e) || e.cls === 'rp' || e.len * BMAP.sc < 70) continue; const r = edgeAt(e, e.len / 2, _ra), [px, py] = w2s(r.x, r.z); if (px < 0 || py < 0 || px > BMAP.W || py > BMAP.H) continue;
      if (placed.some(q => q[2] === e.name && Math.hypot(q[0] - px, q[1] - py) < 220) || placed.some(q => Math.hypot(q[0] - px, q[1] - py) < 40)) continue; placed.push([px, py, e.name]);
      let a = Math.atan2(r.tz, r.tx); if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
      g.save(); g.translate(px, py); g.rotate(a); g.lineWidth = 3; g.strokeStyle = 'rgba(5,7,13,0.85)'; g.strokeText(e.name, 0, 0); g.fillStyle = e === sr || (sr && e.name === sr.name) ? '#ffffff' : 'rgba(230,236,245,0.9)'; g.fillText(e.name, 0, 0); g.restore(); }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
  if (gps.path.length){ g.strokeStyle = 'rgba(127,227,255,0.95)'; g.lineWidth = 3.4 * zoomW; g.setLineDash([8, 6]); g.beginPath(); let first = true;
    for (const p of gps.path){ const step = 30 * (p.s1 >= p.s0 ? 1 : -1); for (let s = p.s0; step > 0 ? s <= p.s1 : s >= p.s1; s += step){ const r = edgeAt(p.e, s, _ra), [px, py] = w2s(r.x, r.z); first ? g.moveTo(px, py) : g.lineTo(px, py); first = false; } }
    g.stroke(); g.setLineDash([]); }
  // junction names
  g.font = '600 10px "Chakra Petch", sans-serif'; g.fillStyle = 'rgba(255,200,130,0.8)';
  for (const ic of ICS){ const [px, py] = w2s(ic.x, ic.z); g.fillText(ic.name, px, py - 10); }
  // gas stations and shops
  for (let k = 0; k < STATIONS.length; k++){ const st = STATIONS[k]; if (st.kind === 'shop') continue; const [px, py] = w2s(st.pad.cx, st.pad.cz);
    g.fillStyle = BMAP.sel && BMAP.sel.st === st ? '#ffffff' : st.kind === 'fuel' ? '#ffd23d' : '#3ee07a'; g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill(); g.fillStyle = '#05070d'; g.fillRect(px - 1.5, py - 3, 3, 5); }
  // cities
  for (const c of CITIES){
    const [px, py] = w2s(c.x, c.z), half = Math.max(7, c.half * BMAP.sc);
    g.fillStyle = BMAP.sel && BMAP.sel.city === c ? 'rgba(255,61,154,0.55)' : 'rgba(255,61,154,0.3)'; g.strokeStyle = '#ff3d9a'; g.lineWidth = 2;
    g.fillRect(px - half, py - half, half * 2, half * 2); g.strokeRect(px - half, py - half, half * 2, half * 2);
    g.fillStyle = '#fff'; g.font = '700 16px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText(c.name, px + half + 6, py + 2);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '700 12px ' + JP; g.fillText(c.jp, px + half + 6, py + 17); g.textAlign = 'center';
    if (STATE.dest && STATE.dest.type === 'city' && STATE.dest.id === c.id){ g.strokeStyle = '#7fe3ff'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, half + 9, 0, TAU); g.stroke(); }
  }
  // towns
  for (const t of TOWNS){ const [px, py] = w2s(t.x, t.z), sel = BMAP.sel && BMAP.sel.town === t;
    g.fillStyle = sel ? 'rgba(255,176,74,0.8)' : 'rgba(255,176,74,0.45)'; g.strokeStyle = '#ffb04a'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py - 7); g.lineTo(px + 7, py); g.lineTo(px, py + 7); g.lineTo(px - 7, py); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffe2b8'; g.font = '700 12px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText(t.name + ' ' + '★'.repeat(t.stars), px + 10, py + 4); g.textAlign = 'center';
    if (STATE.dest && STATE.dest.type === 'station' && STATIONS[STATE.dest.idx] === t.shop){ g.strokeStyle = '#7fe3ff'; g.beginPath(); g.arc(px, py, 13, 0, TAU); g.stroke(); } }
  // landmarks, hamlets, and (with the secret map) the secret places
  g.textAlign = 'left';
  for (const L of LANDMARKS){ if (!L.node) continue; const [px, py] = w2s(L.node.x, L.node.z); g.fillStyle = '#d6c6a6'; g.fillRect(px - 4, py - 4, 8, 8); g.fillStyle = 'rgba(240,228,205,0.85)'; g.font = '600 11px "Chakra Petch", sans-serif'; g.fillText(L.name, px + 8, py + 4); }
  if (BMAP.sc > 0.02) for (const X of EXITS){ const [px, py] = w2s(X.nJA.x, X.nJA.z); g.fillStyle = '#ffffff'; g.fillRect(px - 9, py - 6, 18, 12); g.fillStyle = '#0e5c3c'; g.font = '800 9px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillText(String(X.num), px, py + 3); g.textAlign = 'left'; if (BMAP.sc > 0.05){ g.fillStyle = '#e8f5ec'; g.fillText('EXIT ' + X.num + ' · ' + X.name, px + 12, py + 3); } }
  for (const hm of HAMLETS){ const [px, py] = w2s(hm.x, hm.z); g.fillStyle = 'rgba(214,198,166,0.8)'; g.beginPath(); g.arc(px, py, 2.2, 0, TAU); g.fill(); if (BMAP.sc > 0.045){ g.font = '600 10px "Chakra Petch", sans-serif'; g.fillText(hm.name, px + 5, py + 3); } }
  if (STATE.secretMap) SECRETS.forEach((S, i) => { const [px, py] = w2s(S.x, S.z), f = STATE.found.includes(i); g.fillStyle = f ? '#3ee07a' : '#c48aff'; g.beginPath(); g.arc(px, py, 7, 0, TAU); g.fill(); g.fillStyle = '#05070d'; g.font = '900 11px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillText(f ? '✓' : '?', px, py + 4); g.textAlign = 'left'; if (BMAP.sc > 0.04){ g.fillStyle = f ? '#a6f0c0' : '#e0c8ff'; g.fillText(S.name, px + 10, py + 4); } });
  g.textAlign = 'center';
    // junction symbols: a ring with an arrow for a roundabout, a small cross for a junction
  if (BMAP.sc > 0.03) for (const p of PATCHES){ if (!p.poly || p.node.links.length < 3) continue; const [px, py] = w2s(p.x, p.z); if (px < -10 || py < -10 || px > BMAP.W + 10 || py > BMAP.H + 10) continue; junctionIcon(g, px, py, !!p.rb, BMAP.sc > 0.08 ? 1.3 : 1); }
  // the story: the Lore Keeper once you've found him, and the places the current chapter needs
  { const L = STATE.lore || {}; g.textAlign = 'left';
    if (L.found && KEEPER_SPOT){ const [px, py] = w2s(KEEPER_SPOT.x, KEEPER_SPOT.z); g.fillStyle = '#c48aff'; g.beginPath(); g.arc(px, py, 7, 0, TAU); g.fill(); g.fillStyle = '#1a0f2a'; g.font = '900 10px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillText('語', px, py + 4); g.textAlign = 'left'; g.fillStyle = '#e8d6ff'; g.font = '700 12px "Chakra Petch", sans-serif'; g.fillText('THE LORE KEEPER', px + 10, py + 4); }
    for (const sp of activeSpots()){ const [px, py] = w2s(sp.x, sp.z), fl = 7 + 2 * Math.sin(performance.now() / 250); g.strokeStyle = '#c48aff'; g.lineWidth = 2.5; g.beginPath(); g.arc(px, py, fl, 0, TAU); g.stroke(); g.fillStyle = '#c48aff'; g.font = '800 12px "Chakra Petch", sans-serif'; g.fillText('✦ ' + sp.name, px + 12, py + 4); } }
  { const [px, py] = w2s(JUKAI.x, JUKAI.z); g.fillStyle = 'rgba(154,255,200,0.75)'; g.font = '900 ' + Math.round(clamp(BMAP.sc * 900, 14, 40)) + 'px ' + JP; g.textAlign = 'center'; g.fillText('樹海', px, py); g.font = '700 11px "Chakra Petch", sans-serif'; g.fillText('THE SEA OF TREES', px, py + 16); g.textAlign = 'left';
    for (const H of JUKAI_NET.heads){ const [hx, hy] = w2s(H.x, H.z); g.fillStyle = '#9affc8'; g.beginPath(); g.moveTo(hx, hy - 7); g.lineTo(hx + 5, hy + 4); g.lineTo(hx - 5, hy + 4); g.closePath(); g.fill(); if (BMAP.sc > 0.05){ g.font = '700 10px "Chakra Petch", sans-serif'; g.fillText('TRAILHEAD', hx + 8, hy + 4); } } }
  heistMarks(g, w2s, true, BMAP.sc);
  cluePinMark(g, w2s, true);
  // police in a chase, and you
  const fl = (performance.now() / 300 | 0) % 2;
  for (const u of police){ if (u.state !== 'chase') continue; const [px, py] = w2s(u.x, u.z); g.fillStyle = fl ? '#ff2a2a' : '#2f6bff'; g.beginPath(); g.arc(px, py, 4, 0, TAU); g.fill(); }
  { const [px, py] = w2s(car.x, car.z), a = car.h; g.save(); g.translate(px, py); g.rotate(-a + Math.PI); g.fillStyle = '#7fe3ff'; g.strokeStyle = '#05070d'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.stroke(); g.fill(); g.restore();
    g.strokeStyle = 'rgba(127,227,255,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, 16 + 4 * Math.sin(performance.now() / 300), 0, TAU); g.stroke(); }
  // compass
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '700 14px "Chakra Petch", sans-serif'; g.fillText('N ↑', 30, 30);
}
function renderMapSide(){
  const el = $('mapSide'), sel = BMAP.sel;
  const city = inCity(car.x, car.z, 0), e = car.lastE;
  let near = null, nd = Infinity; for (const c of CITIES){ const d = Math.hypot(c.x - car.x, c.z - car.z); if (d < nd){ nd = d; near = c; } }
  let h = '';
  if (!sel){
    h += `<h2>Map<small>CLICK A CITY, A TOWN, A GAS STATION OR ANY ROAD TO SEE ITS NAME · SET A GPS ROUTE OR TELEPORT · DRAG TO MOVE · SCROLL TO ZOOM IN FOR STREET NAMES</small></h2>`;
    h += `<div class="where">YOU ARE ON <b>${e ? e.name : '—'}</b><br>HEADING <b>${compass(car.h)}</b> · <b>${city ? 'IN ' + city.name : regionName(car.x, car.z)}</b><br>NEAREST CITY <b>${near.name}</b> · ${(nd / 1000).toFixed(1)} km<br>WANTED <b>${starText(STATE.stars)}</b> · CASH <b>$${Math.round(STATE.cash).toLocaleString()}</b></div>`;
    if (STATE.quest >= 1 && STATE.quest <= 3) h += `<div class="where quest">THE OLD MAN'S RIDDLE ${STATE.quest} OF 3<br><b>${riddleText(STATE.quest - 1)}</b><br><button class="btn ghost" id="riddlePin" type="button" style="margin-top:8px">${STATE.cluePin === STATE.quest ? 'PINNED ✓ · GPS SET' : 'STUCK? PIN IT ON MY MAP'}</button></div>`;
    h += `<div class="where quest">THE STORY<br><b>${loreObjective()}</b></div>`;
    if (STATE.secretMap) h += `<div class="where quest">SECRET MAP · ${STATE.found.length} OF ${SECRETS.length} SECRETS FOUND · PURPLE ? ON THE MAP</div>`;
    if (STATE.dest) h += `<div class="where">GPS ROUTE TO <b>${destLabel()}</b> · ${(gps.total / 1000).toFixed(1)} km<br><button class="btn ghost" id="clearRoute" type="button" style="margin-top:8px">CLEAR ROUTE</button></div>`;
    h += `<div class="maplegend"><i style="background:#ffaa50"></i>EXPRESSWAY<br><i style="background:#ffd282"></i>INTERCHANGE RAMP<br><i style="background:#cfd4dc"></i>COUNTRY ROAD<br><i style="background:#ffe05a"></i>THE ROAD YOU'RE ON<br><i style="background:#7fe3ff"></i>YOUR GPS ROUTE<br><i style="background:#3ee07a;width:10px;height:10px;border-radius:50%"></i>GAS STATION: REPAIR · NITRO<br><i style="background:#ff3d9a;width:10px;height:10px"></i>CITY: TUNE SHOP · BASIC PARTS<br><i style="background:#ffb04a;width:10px;height:10px;transform:rotate(45deg)"></i>TOWN / VILLAGE: RARE PARTS · ★ = HOW HARD TO REACH<br><i style="background:#d6964f"></i>DIRT SHORTCUT: NO TRAFFIC, NO POLICE<br><i style="background:#9affc8;width:10px;height:10px;clip-path:polygon(50% 0,100% 100%,0 100%)"></i>樹海 SEA OF TREES TRAILHEAD: NO GPS INSIDE, TRAILS SHOW ONCE DRIVEN<br><i style="background:#fff;width:12px;height:5px;border-left:4px solid #d8202c;border-right:4px solid #d8202c"></i>BORDER POST (THE JOB)<br><i style="background:#fff;width:14px;height:9px"></i>HIGHWAY EXIT (NUMBERED)<br><i style="background:transparent;border:2px solid #ffd282;width:9px;height:9px;border-radius:50%"></i>ROUNDABOUT<br><i style="background:#fff;width:8px;height:8px;clip-path:polygon(40% 0,60% 0,60% 40%,100% 40%,100% 60%,60% 60%,60% 100%,40% 100%,40% 60%,0 60%,0 40%,40% 40%)"></i>JUNCTION<br><i style="background:#d6c6a6;width:10px;height:10px"></i>LANDMARK<br><i style="background:#d6c6a6;width:4px;height:4px;border-radius:50%"></i>HAMLET (ZOOM IN FOR NAMES)</div>`;
  } else if (sel.road){
    const e = sel.road, same = EDGES.filter(q => q.name === e.name && (!e.city || q.city === e.city)), km = same.reduce((a, q) => a + q.len, 0) / 1000;
    const kind = { cw: 'EXPRESSWAY', rp: 'SLIP ROAD', rd: 'COUNTRY ROAD', st: 'CITY STREET', al: 'ALLEY', ln: 'LANE', mt: 'MOUNTAIN ROAD', dt: 'DIRT TRACK · NO TRAFFIC, NO POLICE', rw: 'RUNWAY' }[e.cls] || 'ROAD';
    h += `<h2>${e.name}<small>${kind}${e.jukai ? ' · 樹海 TRAIL' : ''}</small></h2><div class="where">${e.city ? 'IN <b>' + e.city.name + '</b><br>' : ''}LENGTH <b>${km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'}</b> · SPEED LIMIT <b>${e.city && e.city.id === 'kawaguchi' ? 60 : e.C.lim} km/h</b>${e.towards ? '<br>TOWARDS <b>' + e.towards + '</b>' : ''}${e.towardsA ? ' · <b>' + e.towardsA + '</b>' : ''}<br>AREA <b>${regionName(sel.wx, sel.wz)}</b></div>
      <button class="btn" id="roadRoute" type="button">GPS ROUTE TO HERE</button> <button class="btn ghost" id="backMap" type="button">BACK</button>`;
  } else if (sel.lore || sel.keeper){
    const sp = sel.lore, L = STATE.lore;
    if (sp) h += `<h2>✦ ${sp.name}<small>CHAPTER ${sp.ch} · ${LORE[sp.ch - 1].title}</small></h2><div class="where">${({ visit: 'Go there and stop.', rain: 'Something here only shows itself in the rain.', night: 'Something here only shows itself late at night.', wanted: 'Something here only opens for the hunted.', run: 'A run against the clock starts here.' })[sp.cond]}</div>`;
    else h += `<h2>語り部 · THE LORE KEEPER<small>${L.complete ? 'THE STORY IS COMPLETE' : chapterDone() ? 'HE HAS THE NEXT CHAPTER FOR YOU' : 'HE KEEPS THE STORIES'}</small></h2>`;
    h += `<button class="btn" id="loreRoute" type="button">SET GPS ROUTE</button><button class="btn ghost" id="backMap" type="button">BACK</button>`;
  } else if (sel.city){
    const c = sel.city, I = c.info;
    h += `<h2>${c.name} <span style="font-family:${JP};font-size:26px;color:var(--dim)">${c.jp}</span><small>${I.tag}</small></h2>`;
    h += `<div class="sec">PROS</div><ul>${I.pros.map(p => `<li class="pro">${p}</li>`).join('')}</ul>`;
    h += `<div class="sec">CONS</div><ul>${I.cons.map(p => `<li class="con">${p}</li>`).join('')}</ul>`;
    h += `<div class="sec">TUNE SHOP · NEXT LEVEL FOR YOUR CAR</div><table>${UPG.map(u => { const pr = priceOf(c, u.id); return `<tr><td>${u.name} <span style="color:var(--dim)">LV ${STATE.up[u.id] || 0}</span></td><td class="${pr.p ? '' : 'na'}">${pr.p ? '$' + pr.p.toLocaleString() : pr.txt}</td></tr>`; }).join('')}${specials(c).map(sp => `<tr><td>${sp.name}</td><td>$${sp.p.toLocaleString()}</td></tr>`).join('')}</table>`;
    h += `<div class="where">${(Math.hypot(c.x - car.x, c.z - car.z) / 1000).toFixed(1)} km AWAY · ${c.info.cops * 2 + 3} POLICE UNITS IN TOWN</div>`;
    h += `<button class="btn ghost" id="teleport" type="button">TELEPORT HERE</button><button class="btn" id="setRoute" type="button">${STATE.dest && STATE.dest.type === 'city' && STATE.dest.id === c.id ? 'ROUTE SET ✓' : 'SET GPS ROUTE'}</button><button class="btn ghost" id="backMap" type="button">BACK</button>`;
  } else if (sel.town){
    const t = sel.town, I = t.info;
    h += `<h2>${t.name} <span style="font-family:${JP};font-size:26px;color:var(--dim)">${t.jp}</span><small>${t.village ? 'MOUNTAIN VILLAGE' : 'TOWN'} · ${'★'.repeat(t.stars)} TO REACH · ${I.tag}</small></h2>`;
    h += `<div class="sec">SELLS</div><ul>${I.pros.map(p => `<li class="pro">${p}</li>`).join('')}</ul><div class="sec">BUT</div><ul>${I.cons.map(p => `<li class="con">${p}</li>`).join('')}</ul>`;
    h += `<div class="sec">PARTS · NEXT LEVEL FOR YOUR CAR</div><table>${UPG.filter(u => (I.max[u.id] || 0) > 0).map(u => { const pr = priceOf(t, u.id); return `<tr><td>${u.name} <span style="color:var(--dim)">LV ${STATE.up[u.id] || 0}</span></td><td class="${pr.p ? '' : 'na'}">${pr.p ? '$' + pr.p.toLocaleString() : pr.txt}</td></tr>`; }).join('')}${specials(t).map(sp => `<tr><td>${sp.name}</td><td>${sp.why || '$' + sp.p.toLocaleString()}</td></tr>`).join('')}</table>`;
    h += `<div class="where">${(Math.hypot(t.x - car.x, t.z - car.z) / 1000).toFixed(1)} km AWAY · ON ${t.main[0] ? t.main[0].name : ''}<br>THE GARAGE IS DOWN ONE OF THE SIDE STREETS</div>`;
    h += `<button class="btn ghost" id="teleport" type="button">TELEPORT HERE</button><button class="btn" id="setRoute" type="button">SET GPS ROUTE</button><button class="btn ghost" id="backMap" type="button">BACK</button>`;
  } else if (sel.st){
    const st = sel.st;
    if (st.kind === 'fuel') h += `<h2>${st.name}<small>MOUNTAIN FUEL STOP · ${st.e.name}</small></h2><ul><li class="pro">Stop in the green box: fuel up to a third of a tank</li><li class="pro">A checkpoint: if you crash out or get busted nearby you're brought back here</li><li class="con">No repairs, no nitro</li></ul>`;
    else h += `<h2>${st.name.replace('START · ', '')}<small>GAS STATION · ${st.e.name}</small></h2><ul><li class="pro">Stop in the green box for 5 seconds: full repair</li><li class="pro">Nitro refilled, crash count reset</li><li class="pro">+1 bullet (up to 5)</li></ul>`;
    h += `<div class="where">${(Math.hypot(st.pad.cx - car.x, st.pad.cz - car.z) / 1000).toFixed(1)} km AWAY</div>`;
    h += `<button class="btn ghost" id="teleport" type="button">TELEPORT HERE</button><button class="btn" id="setRoute" type="button">SET GPS ROUTE</button><button class="btn ghost" id="backMap" type="button">BACK</button>`;
  }
  el.innerHTML = h;
  const sr = $('setRoute'); if (sr) sr.addEventListener('click', () => { STATE.dest = sel.city ? { type: 'city', id: sel.city.id } : { type: 'station', idx: STATIONS.indexOf(sel.town ? sel.town.shop : sel.st) }; gps.t = 0; updateGps(0); saveState(); renderMapSide(); drawBigMap(); });
  const tp = $('teleport'); if (tp) tp.addEventListener('click', () => {
    if (chase.on){ tp.textContent = 'NOT WHILE THE POLICE ARE ON YOU'; return; }
    let st = null;
    if (sel.city) st = STATIONS.find(q => q.cityStation === sel.city) || sel.city.shop;
    else if (sel.town) st = sel.town.fuelStop || sel.town.shop;
    else if (sel.st) st = sel.st;
    if (!st) return;
    closeMap(); spawnAt(st); car.fuel = Math.max(car.fuel, 0.2);
    toast('TELEPORTED', (sel.city ? sel.city.name : sel.town ? sel.town.name : st.name.replace('START · ', '')) + ' · DRIVE SAFE', '#7fe3ff'); saveState(); });
  const lr = $('loreRoute'); if (lr) lr.addEventListener('click', () => { routeToLore(sel.lore || KEEPER_SPOT && { x: KEEPER_SPOT.x, z: KEEPER_SPOT.z, name: 'THE LORE KEEPER' }); renderMapSide(); drawBigMap(); });
  const rp = $('riddlePin'); if (rp) rp.addEventListener('click', () => { const C = CLUES[STATE.quest - 1]; if (!C) return; const q = nearestRoadPoint(C.x, C.z); STATE.cluePin = STATE.quest; STATE.dest = { type: 'pt', x: C.x, z: C.z, eId: q.e.id, s: q.s, label: 'RIDDLE ' + STATE.quest + ' · THE END OF THE TRACK' }; gps.t = 0; updateGps(0); saveState(); BMAP.sc = 0.12; BMAP.cx = C.x; BMAP.cz = C.z; renderMapSide(); drawBigMap(); });
  const cr = $('clearRoute'); if (cr) cr.addEventListener('click', () => { STATE.dest = null; gps.path = []; saveState(); renderMapSide(); drawBigMap(); });
  const bk = $('backMap'); if (bk) bk.addEventListener('click', () => { BMAP.sel = null; renderMapSide(); drawBigMap(); });
  const rr = $('roadRoute'); if (rr) rr.addEventListener('click', () => { const q = nearestRoadPoint(sel.wx, sel.wz); STATE.dest = { type: 'pt', x: q.x, z: q.z, eId: q.e.id, s: q.s, label: q.e.name }; gps.t = 0; updateGps(0); saveState(); renderMapSide(); drawBigMap(); });
}
(() => {
  const cv = BMAP.cv;
  cv.addEventListener('pointerdown', e => { BMAP.drag = { x: e.clientX, y: e.clientY, cx: BMAP.cx, cz: BMAP.cz }; BMAP.moved = 0; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
  cv.addEventListener('pointermove', e => { if (!BMAP.drag) return; const dx = e.clientX - BMAP.drag.x, dy = e.clientY - BMAP.drag.y; BMAP.moved = Math.max(BMAP.moved, Math.hypot(dx, dy)); BMAP.cx = BMAP.drag.cx - dx / BMAP.sc; BMAP.cz = BMAP.drag.cz - dy / BMAP.sc; drawBigMap(); });
  const up = e => { if (!BMAP.drag) return; cv.classList.remove('drag'); const click = BMAP.moved < 5; BMAP.drag = null; if (!click) return;
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let pick = null;
    for (const c of CITIES){ const [x, y] = w2s(c.x, c.z), half = Math.max(7, c.half * BMAP.sc) + 8; if (Math.abs(px - x) < half + 60 && Math.abs(py - y) < half && px > x - half){ pick = { city: c }; break; } }
    if (!pick) for (const sp of activeSpots()){ const [x, y] = w2s(sp.x, sp.z); if (Math.hypot(px - x, py - y) < 14 || (px > x && px < x + 140 && Math.abs(py - y) < 10)){ pick = { lore: sp }; break; } }
    if (!pick && STATE.lore && STATE.lore.found && KEEPER_SPOT){ const [x, y] = w2s(KEEPER_SPOT.x, KEEPER_SPOT.z); if (Math.hypot(px - x, py - y) < 14 || (px > x && px < x + 140 && Math.abs(py - y) < 10)) pick = { keeper: true }; }
    if (!pick) for (const t of TOWNS){ const [x, y] = w2s(t.x, t.z); if (Math.hypot(px - x, py - y) < 12 || (px > x && px < x + 120 && Math.abs(py - y) < 10)){ pick = { town: t }; break; } }
    if (!pick) for (const st of STATIONS){ if (st.kind === 'shop') continue; const [x, y] = w2s(st.pad.cx, st.pad.cz); if (Math.hypot(px - x, py - y) < 11){ pick = { st }; break; } }
    const roadPick = () => { let best = null, bd = 10; for (const e of EDGES){ if (jHidden(e)) continue; const P = EDGE_POLY[e.id]; if (!P) continue; let [ax, ay] = w2s(P.pts[0], P.pts[1]);
        for (let q = 2; q < P.pts.length; q += 2){ const [bx, by] = w2s(P.pts[q], P.pts[q + 1]), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1), d = Math.hypot(ax + dx * t - px, ay + dy * t - py); if (d < bd){ bd = d; best = e; } ax = bx; ay = by; } }
      if (!best) return null; const [wx, wz] = s2w(px, py); return { road: best, wx, wz }; };
    if (BMAP.sc > 0.06){ const rp = roadPick(); if (rp && !(pick && (pick.lore || pick.keeper || pick.town || pick.st))) pick = rp; }
    if (!pick) pick = roadPick();
    BMAP.sel = pick; renderMapSide(); drawBigMap(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { BMAP.drag = null; cv.classList.remove('drag'); });
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, [wx, wz] = s2w(px, py);
    BMAP.sc = clamp(BMAP.sc * Math.exp(-e.deltaY * 0.0015), 0.012, 0.6); BMAP.cx = wx - (px - BMAP.W / 2) / BMAP.sc; BMAP.cz = wz - (py - BMAP.H / 2) / BMAP.sc; drawBigMap(); }, { passive: false });
  $('mapClose').addEventListener('click', closeMap);
  $('mapWrap').addEventListener('click', openMap);
  $('mapWrap').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openMap(); } });
  addEventListener('resize', () => { if (mapOpen) drawBigMap(); });
})();

// ---------- your car, frame by frame
let flashT = 0;
const lampLights = []; for (let i = 0; i < 4; i++){ const l = new THREE.PointLight(0xffb36a, 1.5, 32, 1.6); scene.add(l); lampLights.push(l); }
const _lamps = [];
let lampT = 0;
function updateVisuals(dt, t){
  // the body follows the road's tilt smoothly, so a change of slope never jolts it
  car.vSlope = car.vSlope === undefined ? (car.slope || 0) : lerp(car.vSlope, car.slope || 0, Math.min(1, dt * 9));
  player.position.set(car.x, car.y, car.z);
  player.rotation.set(-Math.atan(car.vSlope), car.h, 0, 'YXZ');
  pBody.rotation.x = lerp(pBody.rotation.x, clamp(-car.axF * 0.0075, -0.06, 0.06), Math.min(1, dt * 6));
  pBody.rotation.z = lerp(pBody.rotation.z, clamp(car.ayF * 0.006, -0.06, 0.06), Math.min(1, dt * 6));
  pBody.position.y = -Math.abs(car.ayF) * 0.002;
  car.wheelRot += car.vx / PHYS.rw * dt;
  for (const w of pWheels){ w.pivot.rotation.y = w.front ? car.delta : 0; w.spin.rotation.x = w.front ? car.wheelRot : (car.spin ? car.wheelRot * 1.6 : car.locked ? w.spin.rotation.x : car.wheelRot); }
  const braking = input.brk > 0.05 && car.gear > 0 || car.gear < 0 && input.thr > 0.05;
  pTail.color.copy(braking ? TAIL_BRAKE : TAIL_DIM); glowL.intensity = braking ? 1.4 : 0.4;
  headLamp.intensity = highBeam ? 6.5 : 2.6; headLamp.distance = highBeam ? 280 : 140; headLamp.angle = highBeam ? 0.6 : 0.48; flareMat.opacity = highBeam ? 0.55 : 0; flareMat.visible = highBeam;
  flameT = Math.max(0, flameT - dt); FLAME_MAT.visible = flameT > 0; if (flameT > 0) FLAME_MAT.rotation = rnd() * TAU;
  const spd = Math.hypot(car.vx, car.vy);
  const slide = Math.abs(car.slipR) > 0.16 && spd > 5 && input.hb > 0.1, amt = clamp((Math.abs(car.slipR) - 0.16) * 3, 0, 1);
  if ((slide || (car.locked && spd > 6) || (car.drift > 0.3 && spd > 8)) && rnd() < 0.85){
    const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
    for (const sd of [-1, 1]) puff(car.x - fx * 1.35 + lx * 0.8 * sd, car.y + 0.25, car.z - fz * 1.35 + lz * 0.8 * sd, (fx * car.vx + lx * car.vy) * 0.2, (fz * car.vx + lz * car.vy) * 0.2, Math.max(amt, 0.4));
  }
  if (weather.rain > 0.15 && spd > 12 && rnd() < weather.rain * 0.3){ const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h), sd = rnd() < 0.5 ? -1 : 1;
    puff(car.x - fx * 1.9 + lx * 0.8 * sd, car.y + 0.3, car.z - fz * 1.9 + lz * 0.8 * sd, fx * car.vx * 0.55, fz * car.vx * 0.55, 0.3 * weather.rain, 0.45); }
  for (const p of smoke){
    if (p.life <= 0) continue; p.life -= dt / p.max; if (p.life <= 0){ p.sp.visible = false; continue; }
    p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt; p.sp.position.y += dt * 0.6; p.vx *= 0.96; p.vz *= 0.96;
    p.sp.scale.setScalar(0.8 + (1 - p.life) * 4.5 * p.grow); p.sp.material.opacity = p.a * p.life;
  }
  // street lamps near you light the cars too
  lampT -= dt; if (lampT <= 0){ lampT = 0.1; lampsNear(car.x, car.z, _lamps); _lamps.sort((a, b) => (a.x - car.x) ** 2 + (a.z - car.z) ** 2 - (b.x - car.x) ** 2 - (b.z - car.z) ** 2);
    lampLights.forEach((L, i) => { const lp = _lamps[i]; if (lp){ L.position.set(lp.x, lp.y - 0.4, lp.z); L.visible = true; } else L.visible = false; }); }
  for (const L of lampLights) L.intensity = 1.5 * weather.lights * (weather.power < 0.98 && rnd() < 0.15 ? 0.2 : 1);
  { const dv = Math.round(car.damage * 20) / 20; if (dv !== DMGV.level){ DMGV.level = dv; applyDamageVisual(dv); } }
  if (car.damage > 0.45 && rnd() < (car.damage - 0.35) * 0.5){ const fx = Math.sin(car.h), fz = Math.cos(car.h); puff(car.x + fx * 1.7, car.y + 0.95, car.z + fz * 1.7, 0, 0, 0.15 + car.damage * 0.3, 0.6); }
  if (STATION_LIGHT_POS.length){ let bp = STATION_LIGHT_POS[0], bd = Infinity; for (const q of STATION_LIGHT_POS){ const d2 = (q.x - car.x) ** 2 + (q.z - car.z) ** 2; if (d2 < bd){ bd = d2; bp = q; } } STATION_LIGHT.position.set(bp.x, bp.y + 4.4, bp.z); }
  BEACON_MAT.color.setHex(Math.sin(t * 3.1) > 0.2 ? 0xff2020 : 0x300404);
  TURB.red.color.setHex((t % 2) < 1 ? 0xff2020 : 0x2a0404);
  for (const rt of TURB.rotors) rt.rotation.z += dt * 0.55;
}

// ---------- menu, pause, boot
let started = false, paused = false;
const paintsEl = $('paints');
function renderPaints(){ paintsEl.innerHTML = ''; PAINTS.forEach((p, i) => { if (p.secret && !STATE.unlocked.includes(p.secret)) return; paintsEl.insertAdjacentHTML('beforeend', `<input type="radio" name="paint" id="paint${i}" value="${i}"><label for="paint${i}" title="${p.name}" style="background:#${p.hex.toString(16).padStart(6, '0')}"></label>`); }); const el = $('paint' + STATE.paint); if (el) el.checked = true; }
renderPaints(); renderCosmetics();
// the car picker: three cars, each with its own look and stats
{ const el = $('carPick'); if (el){ el.innerHTML = Object.entries(CAR_MODELS).map(([id, K]) => `<input type="radio" name="carpick" id="car-${id}" value="${id}"><label for="car-${id}"><b>${K.name}</b><span class="k">${K.kind}</span><div class="d">${K.desc}</div>${Object.entries(K.bars).map(([n, v]) => `<div class="bar"><span>${n}</span><i style="--v:${v * 10}%"></i></div>`).join('')}</label>`).join('');
  el.addEventListener('change', e => { if (heistLock()){ $('car-' + CARV.id).checked = true; toast('ON THE JOB', 'SWAP CARS WHEN THE JOB IS DONE', '#ffb04a'); return; } STATE.car = e.target.value; setCar(STATE.car); saveState(); toast(CAR_MODELS[STATE.car].name, CAR_MODELS[STATE.car].kind, '#ffb04a'); }); } }
const STRIPES = [0xf2f2f2, 0xf2f2f2, 0xf2f2f2, 0x15161a, 0xff8a1e, 0x15161a, 0x15161a, 0xc9262b, 0x15161a, 0xc48aff, 0xc8ff7a];
function setPaint(k){ if (!PAINTS[k]) k = 0; pPaint.color.setHex(PAINTS[k].hex); pPaint.metalness = PAINTS[k].metal ?? 0.6; pPaint.roughness = PAINTS[k].rough ?? 0.26; STRIPE.color.setHex(STRIPES[k] ?? 0xf2f2f2); const el = $('paint' + k); if (el) el.checked = true; }
paintsEl.addEventListener('change', e => { if (heistLock()){ setPaint(STATE.paint); toast('ON THE JOB', 'A NEW COLOUR NEEDS A RESPRAY: ANY GARAGE OR TUNE SHOP, $1,500', '#ffb04a'); return; } STATE.paint = +e.target.value; setPaint(STATE.paint); saveState(); });
document.querySelectorAll('input[name=trans]').forEach(el => el.addEventListener('change', () => { opts.auto = $('tAuto').checked; STATE.trans = opts.auto ? 'auto' : 'manual'; flags(); }));
document.querySelectorAll('input[name=assist]').forEach(el => el.addEventListener('change', () => { opts.assist = $('aOn').checked; STATE.assist = opts.assist; flags(); }));
function saveLine(){ const s = STATE; $('saveLine').innerHTML = `SAVED: <b>$${Math.round(s.cash).toLocaleString()}</b> · WANTED <i>${starText(s.stars)}</i> · UPGRADES ${Object.values(s.up).reduce((a, b) => a + b, 0)}/21 · ${(s.odo / 1000).toFixed(0)} km DRIVEN · STORY: ${STATE.lore && STATE.lore.complete ? 'COMPLETE' : STATE.lore && STATE.lore.found ? 'CHAPTER ' + STATE.lore.ch + ' / ' + LORE.length : 'NOT STARTED'}`; }
$('go').addEventListener('click', () => {
  sfx.init(); sfx.resume();
  started = true; $('menu').hidden = true; $('hud').hidden = false; cam.init = false;
  run.mult = 1; run.combo = 0; run.crashes = 0; car.damage = 0; car.nitro = 1; car.fuel = Math.max(0.25, STATE.fuel ?? 1);
  spawnAt(START_STATION);
  toast('NIGHT DRIVER', 'E1 CENTRAL EXPRESSWAY · PULL OUT AND HEAD NORTH · M FOR THE MAP', '#7fe3ff');
});
// players and saves
{ const sel = $('playerSel'); for (const n of PLAYERS){ const o = document.createElement('option'); o.value = o.textContent = n; if (n === PLAYER) o.selected = true; sel.appendChild(o); }
  sel.addEventListener('change', () => switchPlayer(sel.value));
  $('newPlayer').addEventListener('click', () => { const n = prompt('Name for the new player (their own save, starting fresh):'); if (n) switchPlayer(n); });
  const hint = t => { $('saveHint').textContent = t; };
  $('expFile').addEventListener('click', () => { saveState(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([saveBlob()], { type: 'application/json' })); a.download = 'Night-Driver-save-' + PLAYER.replace(/[^A-Z0-9]+/gi, '-') + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); hint('Saved to a file. Open the game on the other device and press LOAD FILE.'); });
  $('expCode').addEventListener('click', async () => { saveState(); const code = toCode(saveBlob()); let ok = false; try { await navigator.clipboard.writeText(code); ok = true; } catch (e) {} if (!ok) prompt('Copy this save code:', code); hint(ok ? 'Save code copied. On the other device press PASTE CODE and paste it.' : 'Copy the code from the box, then PASTE CODE on the other device.'); });
  $('impFile').addEventListener('click', () => $('impInput').click());
  $('impInput').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const st = readSave(r.result); if (!st){ hint('That file isn\'t a Night Driver save.'); return; } if (confirm('Load this save into ' + PLAYER + '? It replaces ' + PLAYER + '\'s current progress.')) loadSaveState(st); }; r.readAsText(f); });
  $('impCode').addEventListener('click', () => { const t = prompt('Paste a save code (it starts with ND1-):'); if (!t) return; const st = readSave(t); if (!st){ hint('That code didn\'t work. Copy the whole code and try again.'); return; } if (confirm('Load this save into ' + PLAYER + '? It replaces ' + PLAYER + '\'s current progress.')) loadSaveState(st); });
}
$('wipe').addEventListener('click', () => { if (!confirm('Wipe your saved cash, upgrades and wanted level and start over?')) return; STATE = STATE_DEFAULT(); applyUpgrades(); saveState(); setPaint(0); saveLine(); });
function toggleMute(){ sfx.setMuted(!sfx.muted); muteLabel(); }
function muteLabel(){ for (const b of [$('muteBtn'), $('pauseMute')]){ b.textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON'; b.classList.toggle('off', sfx.muted); b.setAttribute('aria-pressed', String(sfx.muted)); } }
$('pauseMute').addEventListener('click', () => toggleMute());
$('muteBtn').addEventListener('click', e => { toggleMute(); e.currentTarget.blur(); });
muteLabel();
function setPaused(v){ if (!started || mapOpen) return; paused = v; $('pause').hidden = !v; if (!v){ sfx.resume(); last = performance.now(); } }
$('resume').addEventListener('click', () => setPaused(false));
renderer.domElement.style.cursor = 'crosshair';
// the mouse on the road: drag to look around the car (any button), scroll to zoom, a quick click (no drag) shoots
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', e => { if (!started || paused) return; ORB.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, b: e.button, t: performance.now(), moved: false }; try { renderer.domElement.setPointerCapture(e.pointerId); } catch (er) {} });
renderer.domElement.addEventListener('pointermove', e => { const D = ORB.drag; if (!D) return; const dx = e.clientX - D.x, dy = e.clientY - D.y; D.x = e.clientX; D.y = e.clientY;
  if (!D.moved && Math.hypot(e.clientX - D.sx, e.clientY - D.sy) > 6) D.moved = true;
  if (D.moved){ ORB.yaw -= dx * 0.0065; ORB.pitch = clamp(ORB.pitch + dy * 0.004, -0.35, 1.0); ORB.idle = 0; } });
const orbUp = e => { const D = ORB.drag; ORB.drag = null; if (!D || !started || paused) return; if (!D.moved && D.b === 0 && performance.now() - D.t < 400) shoot(e.clientX, e.clientY); };
renderer.domElement.addEventListener('pointerup', orbUp); renderer.domElement.addEventListener('pointercancel', () => { ORB.drag = null; });
renderer.domElement.addEventListener('wheel', e => { if (!started || paused || mapOpen) return; e.preventDefault(); ORB.zoom = clamp(ORB.zoom + e.deltaY * 0.01, -2.5, 14); }, { passive: false });

// adaptive quality: if frames start dropping, lower resolution first, then switch off the glow pass
const QUALITY = [{ pr: Math.min(window.devicePixelRatio || 1, 1.5), bloom: true }, { pr: 1.15, bloom: true }, { pr: 1, bloom: false }, { pr: 0.8, bloom: false }];
const quality = { level: 0, ema: 60, slow: 0, fast: 0, bloom: true };
function applyQuality(){ const q = QUALITY[quality.level]; quality.bloom = q.bloom && !!composer; renderer.setPixelRatio(Math.min(q.pr, window.devicePixelRatio || 1)); renderer.setSize(innerWidth, innerHeight); if (composer){ composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); } }
function watchQuality(raw){
  if (document.hidden || raw > 0.5 || paused) return;
  quality.ema = lerp(quality.ema, 1 / Math.max(raw, 1e-3), 0.05);
  if (quality.ema < 45){ quality.slow += raw; quality.fast = 0; } else if (quality.ema > 58){ quality.fast += raw; quality.slow = 0; } else { quality.slow = quality.fast = 0; }
  if (quality.slow > 2 && quality.level < QUALITY.length - 1){ quality.level++; quality.slow = 0; quality.ema = 55; applyQuality(); }
  if (quality.fast > 15 && quality.level > 0){ quality.level--; quality.fast = 0; applyQuality(); }
}
let last = performance.now(), simT = 0, acc = 0;
const SUB = 1 / 240;
let wasPaused = false;
function frame(now){
  // paused (menu, map, shop text, story): no drawing, no sound, and only a few wake-ups a second, so the rest of the computer stays fast
  if (paused || mapOpen){ paused = true; if (!wasPaused){ wasPaused = true; sfx.update({ rpm: car.rpm, thr: 0, spd: 0, slip: 0, paused: true }); sfx.pause(); } last = now; setTimeout(() => requestAnimationFrame(frame), 200); return; }
  if (wasPaused){ wasPaused = false; sfx.resume(); }
  if (started) requestAnimationFrame(frame); else setTimeout(() => requestAnimationFrame(frame), 33); // the menu's slow turn round the car doesn't need 60 fps
  const rawDt = (now - last) / 1000; let dt = Math.min(0.05, rawDt); last = now;
  watchQuality(rawDt);
  stepGame(dt);
  if (composer && quality.bloom) composer.render(); else renderer.render(scene, camera);
  drawMirror();
}
function stepGame(dt){
  simT += dt; car.graceT = Math.max(0, (car.graceT || 0) - dt);
  if (started) readInput(dt); else { input.thr = 0; input.brk = 0.3; input.hb = 0; input.nos = 0; car.steerIn = 0; }
  const spd = Math.hypot(car.vx, car.vy);
  car.drift = input.hb > 0.1 && spd > 6 ? Math.min(1, car.drift + dt * 5) : Math.max(0, car.drift - dt * (Math.abs(car.slipR) > 0.15 ? 1.2 : 4));
  updateWeather(dt);
  const gripSteer = Math.min(0.56, PHYS.muF * weather.grip * 9.81 * PHYS.L / Math.max(spd * spd, 1) + 0.055 * weather.grip + 0.012), maxSteer = lerp(gripSteer, 0.45, car.drift * 0.7);
  car.delta = 0; car.shiftT = Math.max(0, car.shiftT - dt);
  const [thr0, brk] = updateGearbox(dt, input.thr, input.brk), thr = car.fuel > 0 ? thr0 : 0; // no fuel, no power
  if (started) burnFuel(dt, thr);
  acc += dt;
  while (acc >= SUB){ physStep(SUB, thr, brk, 0, car.slope || 0); arcadeStep(SUB, input.hb); acc -= SUB; }
  car.delta = car.steerIn * Math.min(0.5, maxSteer * 1.5); // front wheels on screen only
  car.nosOn = started && !!input.nos && input.thr > 0.2 && car.nitro > 0 && car.vx > 3;
  if (car.nosOn){ car.nitro = Math.max(0, car.nitro - dt / UPK.nitroCap); if (car.vx < 92) car.vx += UPK.nitroPush * dt; flameT = 0.06; cam.shake = Math.max(cam.shake, 0.01); }
  if (car.nosOn) FLAME_MAT.color.setHex(0x7fb8ff);
  if (UPK.rocket){ // the rocket booster: three seconds of shove, then it recharges
    const want = started && (keys.KeyF || input.rocket) && car.rocket > 0.02 && car.vx > 2 && car.fuel > 0;
    if (want){ if (!car.rocketOn){ sfx.whoosh(2); popup('ROCKET', 0, 'insane'); } car.rocketOn = true; car.rocket = Math.max(0, car.rocket - dt / 3); if (car.vx < 128) car.vx += 24 * dt; flameT = 0.09; FLAME_MAT.color.setHex(0xfff0c8); cam.shake = Math.max(cam.shake, 0.035); }
    else { car.rocketOn = false; car.rocket = Math.min(1, (car.rocket ?? 1) + dt / 22); } }
  if (car.flat && car.vx > 33) car.vx -= (car.vx - 33) * Math.min(1, dt * 1.5);
  if (car.sup && car.sup.kind === 'ground'){ // off the road: grass and dirt hold you back and shake you about
    const v = car.vx; car.vx -= Math.sign(v) * Math.min(Math.abs(v), (1.4 + 0.0055 * v * v) * dt); cam.shake = Math.max(cam.shake, Math.min(0.012, Math.abs(v) * 0.0004));
    if (car.wet){ car.vx *= Math.max(0, 1 - dt * 2.5); car.vy *= Math.max(0, 1 - dt * 2.5); if (!car.wetMsg){ car.wetMsg = 1; toast('IN THE WATER', 'PRESS R TO GET BACK ON THE ROAD', '#7fe3ff'); } } else car.wetMsg = 0; }
  supportUpdate(false);
  collideStatic(); collideIslands();
  collideMovers();
  if (car.sup && car.sup.e){ car.lastE = car.sup.e; car.lastS = clamp(car.sup.s, 0, car.sup.e.len); const r = edgeAt(car.lastE, car.lastS, _ra); car.lastDir = car.lastE.oneway ? 1 : (Math.cos(angWrap(car.h - r.h)) >= 0 ? 1 : -1); }
  updateTraffic(dt);
  if (started){ updatePolice(dt); copBumps(); updateSpikes(dt); updateSecrets(dt, simT); updateLore(dt); updateHeist(dt); updateJukai(dt); }
  updateNdNet(dt);
  updateHeli(dt, simT); updateBoom(dt);
  if (started){ scoring(dt); stations(dt); updateGps(dt); updateGpsLine(dt); }
  updateVisuals(dt, simT); updateCockpit(dt); perfTick(dt);
  drawTraffic(simT); drawPolice(dt, simT);
  updateChunks(car.x, car.z, 1);
  for (const p of NearPool.all) p.update(car.x, car.z);
  if (started) updateCamera(dt);
  else { const a = simT * 0.15 + car.h + 2.4, R = 7.5; camera.position.set(car.x + Math.sin(a) * R, car.y + 2.2, car.z + Math.cos(a) * R); camera.lookAt(car.x, car.y + 0.7, car.z); sky.position.copy(camera.position); stars.position.copy(camera.position); }
  if (toastT > 0){ toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
  if (started) updateHud(dt);
  updateRainFx(dt);
  const thrNow = car.shiftT > 0 ? 0 : thr;
  car.boost = (car.boost || 0) + ((thrNow > 0.3 && car.rpm > 2800 ? thrNow * Math.min(1, (car.rpm - 2800) / 3000) : 0) - (car.boost || 0)) * Math.min(1, dt * (thrNow > 0.3 ? 1.6 : 7));
  if (started){
    if ((car.lastThr || 0) > 0.6 && thrNow < 0.15 && car.boost > 0.4) sfx.bov();
  }
  car.lastThr = thrNow;
  const edgeD = car.sup && car.sup.kind === 'edge' ? Math.max(car.sup.d - car.sup.hl, -car.sup.hr - car.sup.d) : -9;
  const pops = sfx.update({ dt, rpm: car.rpm, thr: thrNow, spd, slip: Math.max(Math.abs(car.slipR) * (input.hb > 0.1 ? 1 : 0.4), car.locked ? 0.4 : 0), paused: !started, boost: car.boost, tunnel: 0, rain: weather.rain, wet: weather.wet, rumble: edgeD > -1.6 || (car.sup && ((car.sup.e && car.sup.e.cls === 'dt') || car.sup.kind === 'ground')) ? 1 : 0 });
  if (pops && started && !car.nosOn){ flameT = 0.05 + 0.04 * Math.min(pops, 2); FLAME_MAT.color.setHex(0xffb060); } // a flame out of the pipes with every bang
}
addEventListener('beforeunload', saveState);
setInterval(() => { if (started) saveState(); }, 5000);
// build the world behind a loading screen, then show the menu
function boot(){
  const times = buildWorld();
  placePolice(); perfSetup();
  setCar(STATE.car || 'raijin'); { const r = $('car-' + CARV.id); if (r) r.checked = true; }
  setPaint(STATE.paint); opts.auto = STATE.trans !== 'manual'; opts.assist = STATE.assist !== false; $('tAuto').checked = opts.auto; $('tMan').checked = !opts.auto; $('aOn').checked = opts.assist; $('aOff').checked = !opts.assist; flags();
  spawnAt(START_STATION);
  updateChunks(car.x, car.z, 999);
  for (const p of NearPool.all) p.update(car.x, car.z, true);
  saveLine();
  $('loading').hidden = true; $('menu').hidden = false;
  window.__nd = { times };
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
}
setTimeout(boot, 60);

// a pin on the spot a riddle points to, once you've asked for one
function cluePinMark(g, toXY, big){
  const qi = Math.max(1, STATE.quest); if (STATE.quest > 1 && STATE.cluePin !== STATE.quest) return; const C = CLUES[qi - 1]; if (!C) return;
  const [px, py] = toXY(C.x, C.z), k = big ? 1.4 : 0.9;
  g.fillStyle = '#c48aff'; g.strokeStyle = '#05070d'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); g.bezierCurveTo(px - 9 * k, py - 12 * k, px - 9 * k, py - 24 * k, px, py - 24 * k); g.bezierCurveTo(px + 9 * k, py - 24 * k, px + 9 * k, py - 12 * k, px, py); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px, py - 17 * k, 3.5 * k, 0, TAU); g.fill();
  if (big){ g.fillStyle = '#e8d6ff'; g.font = '800 12px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText((STATE.quest < 1 ? 'CLUE 1' : 'RIDDLE ' + qi) + ' · STOP AT THE END OF THIS TRACK', px + 14, py - 14); }
}

// ---------- the rear-view mirror strip at the top of the screen: a camera on the roof looking back, shown flipped like a
// real mirror. B turns it off and on
const VM = { on: true, n: 0, rt: new THREE.WebGLRenderTarget(480, 114), cam: new THREE.PerspectiveCamera(40, 480 / 114, 0.5, 450), scene: new THREE.Scene(), ocam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
try { VM.on = localStorage.getItem('nd-vmir') !== '0'; } catch (e) {}
VM.cam.position.set(0, 1.6, -1.0); player.add(VM.cam); VM.rt.texture.wrapS = THREE.RepeatWrapping; VM.rt.texture.repeat.x = -1; VM.rt.texture.offset.x = 1;
VM.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: VM.rt.texture, depthTest: false })));
addEventListener('keydown', e => { if (e.code === 'KeyB' && !e.repeat && started && !(e.target && e.target.tagName === 'INPUT')){ VM.on = !VM.on; try { localStorage.setItem('nd-vmir', VM.on ? '1' : '0'); } catch (er) {} toast(VM.on ? 'MIRROR ON' : 'MIRROR OFF', 'B', '#9fd6ff'); } });
function drawMirror(){ const el = $('vmir'), show = VM.on && started && !paused; if (el.hidden === show) el.hidden = !show; if (!show) return;
  const b = el.getBoundingClientRect(); if (b.width < 10) return;
  if ((VM.n++ & 1) === 0){ VM.cam.updateMatrixWorld(); const keep = renderer.getRenderTarget(); renderer.setRenderTarget(VM.rt); renderer.render(scene, VM.cam); renderer.setRenderTarget(keep); } // the view behind is redrawn every other frame
  const ac = renderer.autoClear; renderer.autoClear = false; renderer.setViewport(b.left + 3, innerHeight - b.bottom + 3, b.width - 6, b.height - 6); renderer.setScissor(b.left + 3, innerHeight - b.bottom + 3, b.width - 6, b.height - 6); renderer.setScissorTest(true);
  renderer.render(VM.scene, VM.ocam); renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.autoClear = ac; }
