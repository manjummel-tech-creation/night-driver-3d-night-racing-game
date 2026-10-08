// =====================================================================================================
// TOWNS AND VILLAGES: the harder to reach, the better the parts. Each parts garage sits at the end of a side street.
// The four high villages are at the top of switchback roads; Tengu's old man starts the hunt for the secret map.
// =====================================================================================================
const TOWN_DEFS = {
  sawa: { name: 'SAWA', jp: '沢', style: 'farm', stars: 1, info: { tag: 'A crossroads village on the old pass road between Tokai and the lakes.', price: 1, max: { tyres: 2, nitro: 2 }, off: {}, pros: ['Tyres and nitro up to level 2', 'Ammo'], cons: ['Nothing rare'], cops: 0, special: ['ammo'] } },
  toge: { name: 'TOGE', jp: '峠', style: 'mountain', stars: 2, info: { tag: 'A tea house and a garage halfway up the Hakone pass.', price: 1, max: { tank: 2, brakes: 2 }, off: {}, pros: ['Ammo for the gun', 'Fuel tanks and brakes up to level 2'], cons: ['Nothing else'], cops: 0, special: ['ammo'] } },
  mori: { name: 'MORI', jp: '森', style: 'farm', stars: 2, info: { tag: 'Next to the race circuit. The tuners hang out here after dark.', price: 0.95, max: { engine: 2, turbo: 2 }, off: {}, pros: ['Engines and turbos up to level 2', 'Fuel at half price'], cons: ['Close to Tokai: lots of police about'], cops: 0, special: ['fuelCheap'] } },
  kitahama: { name: 'KITAHAMA', jp: '北浜', style: 'farm', stars: 2, info: { tag: 'A fishing village on the bay road.', price: 1, max: { nitro: 2, armor: 2 }, off: {}, pros: ['Fuel at half price', 'Ammo', 'Nitro and armor up to level 2'], cons: ['Nothing rare'], cops: 0, special: ['ammo', 'fuelCheap'] } },
  nishikubo: { name: 'NISHIKUBO', jp: '西久保', style: 'lake', stars: 3, info: { tag: 'A forest village at the foot of the West Ridge.', price: 1, max: { armor: 3, tank: 3 }, off: {}, pros: ['Level 3 armor', 'Level 3 fuel tank'], cons: ['Only reached by the West Forest Road'], cops: 0, special: [] } },
  kohan: { name: 'KOHAN', jp: '湖畔', style: 'lake', stars: 3, info: { tag: 'Cabins on the far shore of Lake Kawaguchi. Nobody asks questions.', price: 1, max: { brakes: 3 }, off: {}, pros: ['Respray: wipes a wanted star', 'Level 3 brakes'], cons: ['A long way round the lake'], cops: 0, special: ['respray'] } },
  nohara: { name: 'NOHARA', jp: '野原', style: 'farm', stars: 3, info: { tag: 'The last farms before the edge of the map.', price: 1, max: { nitro: 3, tank: 3 }, off: {}, pros: ['Level 3 nitro', 'Level 3 fuel tank', 'Fuel at half price'], cons: ['The far north-west corner'], cops: 0, special: ['fuelCheap'] } },
  kawakita: { name: 'KAWAKITA', jp: '川北', style: 'farm', stars: 3, info: { tag: 'A river village on the north farm road, out past the wind farm.', price: 1, max: { tyres: 3 }, off: {}, pros: ['Level 3 tyres', 'Fuel at half price'], cons: ['The far north'], cops: 0, special: ['fuelCheap'] } },
  shirakaba: { name: 'SHIRAKABA', jp: '白樺', style: 'lake', stars: 4, info: { tag: 'A birch-lined lake village. The tuner here builds turbos by hand.', price: 1, max: { turbo: 3 }, off: {}, pros: ['Level 3 turbo', 'Radar jammer: police spot you from 40% closer'], cons: ['Deep in the forest'], cops: 0, special: ['jammer'] } },
  misaki: { name: 'MISAKI', jp: '岬', style: 'mountain', stars: 4, info: { tag: 'A cape at the end of the coast road. Old racers retire here.', price: 1, max: { engine: 3 }, off: {}, pros: ['Level 3 engine', 'Ammo'], cons: ['At the end of the coast'], cops: 0, special: ['ammo'] } },
  tengu: { name: 'TENGU', jp: '天狗', style: 'village', stars: 5, info: { tag: 'The highest village on the map. The old man in the garage knows things nobody else does.', price: 1.1, max: { brakes: 3 }, off: {}, pros: ['The old man: ask him about the secret map', 'Police scanner', 'Level 3 brakes'], cons: ['A brutal climb'], cops: 0, special: ['quest', 'scanner'] } },
  kumotori: { name: 'KUMOTORI', jp: '雲取', style: 'village', stars: 5, info: { tag: 'A village in the clouds above Kawaguchi.', price: 1, max: { engine: 3, nitro: 3 }, off: {}, pros: ['Level 3 engine and nitro', 'Respray'], cons: ['Switchbacks all the way up'], cops: 0, special: ['respray'] } },
  onidake: { name: 'ONIDAKE', jp: '鬼岳', style: 'village', stars: 5, info: { tag: 'A demon-mask village on the West Ridge.', price: 1, max: { turbo: 3, armor: 3 }, off: {}, pros: ['Level 3 turbo and armor', 'Radar jammer'], cons: ['The far west, up a mountain'], cops: 0, special: ['jammer'] } },
  yukidake: { name: 'YUKIDAKE', jp: '雪岳', style: 'village', stars: 5, info: { tag: 'Snow all year at the southern end of the world.', price: 1, max: { tyres: 3, brakes: 3 }, off: {}, pros: ['Level 3 tyres and brakes', 'Police scanner'], cons: ['The hardest climb on the map'], cops: 0, special: ['scanner'] } },
};
function placeTowns(){
  const sites = TOWN_SITES.filter(t => t.node).map(t => ({ id: t.id, node: t.node, sides: t.sides, flat: t.flat }))
    .concat(VILLAGES.map(v => ({ id: v.name.toLowerCase(), node: v.node, sides: v.sides, village: true })));
  for (const S of sites){
    const D = TOWN_DEFS[S.id]; if (!D) continue;
    const n = S.node, t = Object.assign({ id: S.id, isTown: true, village: !!S.village, x: n.x, z: n.z, y: n.y, half: S.village ? 200 : 300, node: n, sides: S.sides.slice(), main: n.links.filter(e => !S.sides.includes(e)) }, D);
    TOWNS.push(t);
    // the garage: at the end of the longest side street, so you have to look for it
    const side = t.sides.filter(e => e.len > 110).sort((a, b) => b.len - a.len)[0];
    if (side) makeShop(t, side, Math.max(40, side.len - 46), t.name + ' PARTS');
    else { const e = t.main[0], s = e.a === n ? Math.min(e.len - 40, 120) : Math.max(40, e.len - 120); makeShop(t, e, s, t.name + ' PARTS'); }
    // up in the mountains: a little fuel stop on the way in, apart from the parts garage. A third of a tank, and a checkpoint
    if (t.village || t.style === 'mountain' || mtnK(t.x, t.z) > 0.5){ const W2 = townApproach(t, 220), e = W2 && W2.e;
      if (e){ const sm = W2.from === e.a ? 110 : e.len - 110, pad = addPad(e, sm, 46, 18, -1, { kind: 'fuel', name: t.name + ' FUEL STOP' });
        const st = { pad, name: t.name + ' FUEL STOP', kind: 'fuel', place: t, e, sm, side: -1, bay: { a: 0, w0: 4.5, w1: 13, len: 10 }, partial: 1 / 3 }; STATIONS.push(st); t.fuelStop = st; } }
  }
}
// the road leading into a town, past its side streets: { e, from } where 'from' is the end nearer the town
function townApproach(t, minLen){
  let best = null;
  for (const m of t.main){ if (m.cls === 'dt') continue; if (m.len > minLen && (!best || m.len > best.e.len)) best = { e: m, from: t.node };
    const f = m.a === t.node ? m.b : m.a; for (const e of f.links){ if (e === m || t.sides.includes(e) || e.cls === 'al' || e.cls === 'cw' || e.cls === 'rp' || e.cls === 'dt') continue; if (e.len > minLen && (!best || e.len > best.e.len)) best = { e, from: f }; } }
  return best;
}
// the fuel stop: two pumps under a small roof, a sign, a green box to stop in
function buildFuelStop(st, b){
  const F = frameAt(st.e, st.sm), P = {}, edge = -F.r.hr, W = w => edge - w;
  const put = (geo, mat, a, w, yy = 0, rot = 0) => { F.at(a, W(w), P); b.add(geo, mat, P.x, P.y + yy, P.z, P.h + rot); return P; };
  padSurface(st.pad, MAT.pad);
  for (const a of [-6, 6]){ const q = put(new THREE.BoxGeometry(0.9, 1.7, 0.7), MAT.white, a, 15.5, 0.85); put(new THREE.BoxGeometry(0.92, 0.35, 0.72), MAT.yellow, a, 15.5, 1.45); addStatic(q.x, q.z, q.y, q.h, 0.6, 0.5); }
  for (const a of [-9, 9]) for (const w of [13, 18]) put(new THREE.BoxGeometry(0.3, 4.6, 0.3), MAT.dark, a, w, 2.3);
  put(new THREE.BoxGeometry(7, 0.4, 22), MAT.white, 0, 15.5, 4.7); put(new THREE.BoxGeometry(0.2, 0.6, 22.2), MAT.yellow, 0, 12.0, 4.5); put(new THREE.BoxGeometry(0.2, 0.6, 22.2), MAT.yellow, 0, 19.0, 4.5);
  const t = textTex(1024, 256, (g, w, h) => { g.fillStyle = '#10141a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffd23d'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#ffd23d'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 92px ' + JP; g.fillText('FUEL ⅓ TANK', w / 2, h * 0.38); g.fillStyle = '#7fe3ff'; g.font = '700 50px ' + JP; g.fillText('CHECKPOINT · ' + st.place.name, w / 2, h * 0.76); });
  put(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }), 0, 11.85, 5.6, -Math.PI / 2);
  { const { a, w0, w1, len: bl } = st.bay; put(new THREE.PlaneGeometry(w1 - w0, bl).rotateX(-Math.PI / 2), BAY_MAT, a, (w0 + w1) / 2, 0.05);
    for (const [da, dw, ww, ll] of [[-bl / 2, 0, w1 - w0, 0.25], [bl / 2, 0, w1 - w0, 0.25], [0, -(w1 - w0) / 2, 0.25, bl], [0, (w1 - w0) / 2, 0.25, bl]]) put(new THREE.BoxGeometry(ww, 0.1, ll), BAY_EDGE, a + da, (w0 + w1) / 2 + dw, 0.06); }
  STATION_LIGHT_POS.push(F.at(0, W(10), {}));
}
// every town's way in has a banner across the road: you've reached a checkpoint
function buildCheckpointGate(t, b){
  const A = townApproach(t, 200); if (!A) return; const e = A.e;
  const s = A.from === e.a ? 60 : e.len - 60, r = edgeAt(e, s, {}), w = Math.max(r.hl, r.hr) + 1.6;
  for (const sd of [-1, 1]) b.add(new THREE.BoxGeometry(0.5, 6, 0.5), MAT.dark, r.x + r.nx * sd * w, r.y + 3, r.z + r.nz * sd * w);
  const tx = textTex(1024, 128, (g, W2, H2) => { g.fillStyle = '#0c2a44'; g.fillRect(0, 0, W2, H2); g.fillStyle = '#7fe3ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 70px ' + JP; g.fillText('CHECKPOINT · ' + t.name + ' ' + t.jp, W2 / 2, H2 / 2); });
  const m = new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide });
  b.add(new THREE.PlaneGeometry(w * 2, 1.4), m, r.x, r.y + 5.6, r.z, r.h + Math.PI / 2);
}
// the range of an edge within r of a node, in edge coordinates
const nearRange = (e, n, r) => e.a === n ? [0, Math.min(e.len, r)] : [Math.max(0, e.len - r), e.len];
function buildTown(t){
  const b = new Builder(), R = mulberry(Math.round(t.x + t.z * 7)), placed = [[t.shop.pad.cx, t.shop.pad.cz, 42]];
  buildShopVisual(t.shop, b, '#ffb04a');
  if (t.fuelStop){ buildFuelStop(t.fuelStop, b); placed.push([t.fuelStop.pad.cx, t.fuelStop.pad.cz, 34]); }
  buildCheckpointGate(t, b);
  const st = t.style;
  const P = (range) => ({ range, lmin: 9, lmax: 15, dmin: 8, dmax: 12, setback: 3, gmin: 3, gmax: 14,
    height: () => 3.8 + R() * (st === 'lake' ? 7 : 4.5), kind: () => st === 'farm' ? (R() < 0.6 ? 7 : 4) : st === 'lake' ? (R() < 0.5 ? 5 : 4) : 4,
    roof: () => st === 'farm' ? 'tin' : st === 'lake' ? 'red' : 'tile', store: () => R() < 0.3, lanterns: st === 'mountain' || st === 'village' });
  for (const e of t.main) lotsAlong(b, [e], R, placed, P(nearRange(e, t.node, t.village ? 200 : 300)));
  for (const e of t.sides) lotsAlong(b, [e], R, placed, P([0, e.len]));
  // the name on a board where you come in
  const sign = textTex(512, 256, (g, w, h) => { g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1d4fb8'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#1d2b4a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 96px ' + JP; g.fillText(t.jp, w / 2, h * 0.36); g.font = '800 54px ' + JP; g.fillText(t.name, w / 2, h * 0.76); });
  const sm = new THREE.MeshBasicMaterial({ map: sign });
  for (const e of t.main){ if (e.len < 300) continue; const s = e.a === t.node ? 280 : e.len - 280, r = edgeAt(e, s, {}), off = -(r.hr + 1.8), x = r.x + r.nx * off, z = r.z + r.nz * off, face = e.a === t.node ? Math.PI : 0;
    b.add(new THREE.BoxGeometry(0.15, 3, 0.15), MAT.dark, x, r.y + 1.5, z); b.add(new THREE.PlaneGeometry(3, 1.5), sm, x, r.y + 3.4, z, r.h + face + Math.PI); }
  if (t.village){ // a shrine gate and stone lanterns in the high villages
    const e = t.main[0], s = e.a === t.node ? 40 : e.len - 40, r = edgeAt(e, s, {}), w = r.hl + 1.2;
    for (const sd of [-1, 1]) b.add(new THREE.CylinderGeometry(0.3, 0.36, 5.5, 10), MAT.torii, r.x + r.nx * sd * w, r.y + 2.75, r.z + r.nz * sd * w);
    b.add(new THREE.BoxGeometry(w * 2 + 3, 0.45, 0.8), MAT.torii, r.x, r.y + 5.7, r.z, r.h + Math.PI / 2);
  }
  b.flush();
}

// =====================================================================================================
// LANDMARKS at the ends of their roads
// =====================================================================================================
const LIGHTHOUSE_BEAMS = [];
function endFrame(e, n = e.b){ // the end n of edge e: the way the road was heading there, and a helper for points beyond it
  const atB = e.b === n;
  const r = edgeAt(e, atB ? e.len - 2 : 2, {}), fx = atB ? r.tx : -r.tx, fz = atB ? r.tz : -r.tz, lx = fz, lz = -fx;
  return { n, x: n.x, z: n.z, y: n.y, fx, fz, lx, lz, h: Math.atan2(fx, fz), P: (a, w) => [n.x + fx * a + lx * w, n.z + fz * a + lz * w] };
}
const GREY = LM(0x7d7f84), STONE = LM(0x6a665e), SNOWY = LM(0xdfe3e8), GRAVEL = LM(0x9a8c74), RUST = LM(0x6b3a22), HAZ_Y = LM(0xe8b416);
function landmarkSign(b, F, text, sub){
  const t = textTex(1024, 256, (g, w, h) => { g.fillStyle = '#0e5c3c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8efe9'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#f2f5f2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 84px ' + JP; g.fillText(text, w / 2, h * 0.4); g.font = '700 42px ' + JP; g.fillText(sub || '', w / 2, h * 0.77); });
  const [x, z] = F.P(-6, -16); b.add(new THREE.BoxGeometry(0.2, 3.4, 0.2), MAT.dark, x, F.y + 1.7, z);
  b.add(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }), x, F.y + 3.6, z, F.h + Math.PI);
}
function solid(b, geo, mat, x, y, z, ry, hx, hz, ht){ if (!lotClear(x, z, y, Math.max(hx, hz) * 0.85, null)) return false; b.add(geo, mat, x, y, z, ry); addStatic(x, z, y - 1, ry, hx, hz, ht); return true; } // never on a road
function makeTurbine(x, z, ry){
  const towerM = LM(0x9aa0a8), y = shownGround(x, z), grp = new THREE.Group(); grp.position.set(x, y - 1, z); grp.rotation.y = ry;
  grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 62, 10).translate(0, 31, 0), towerM));
  const nac = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 7), towerM); nac.position.set(0, 63, -0.5); grp.add(nac);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 4), TURB.red); lamp.position.set(0, 64.8, -1.5); grp.add(lamp);
  const rotor = new THREE.Group(); rotor.position.set(0, 63, 3.2); rotor.rotation.z = rnd() * TAU; grp.add(rotor);
  for (let k = 0; k < 3; k++){ const bl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 27, 0.35).translate(0, 13.5, 0), towerM); bl.rotation.z = k * TAU / 3; rotor.add(bl); }
  scene.add(grp); TURB.rotors.push(rotor); addStatic(x, z, y, 0, 1.6, 1.6, 62);
}
function buildLandmark(L){
  if (!L.node) return;
  const e = L.node.links.find(q => q.cls !== 'st' && q.cls !== 'rw') || L.node.links[0]; if (!e) return;
  const F = endFrame(e, L.node), b = new Builder(), y = F.y, g = (a, w) => { const [x, z] = F.P(a, w); return [x, shownGround(x, z), z]; };
  const at = (a, w, dy = 0) => { const [x, z] = F.P(a, w); return [x, y + dy, z]; };
  const subs = { nuke: 'TOKAI ELECTRIC · UNIT 1 & 2', dam: 'HYDROELECTRIC · NO ENTRY', obs: 'NATIONAL ASTRONOMICAL OBSERVATORY', quarry: 'HEAVY VEHICLES', rail: 'JR FREIGHT', radio: 'NHK TRANSMITTER', ski: 'LIFTS CLOSED AT NIGHT', torii: '大社', light: 'NAGISA LIGHT', fort: 'HISTORIC SITE', air: 'NO LANDING', track: 'TRACK DAYS EVERY NIGHT', wind: 'NORTHERN WIND FARM' };
  landmarkSign(b, F, L.name, subs[L.kind]);
  switch (L.kind){
    case 'nuke': {
      const pts = []; for (let k = 0; k <= 16; k++){ const yy = k / 16 * 90, r = 17 * Math.sqrt(1 + ((yy - 62) / 34) ** 2) * 0.82; pts.push(new THREE.Vector2(r, yy)); }
      const tg = new THREE.LatheGeometry(pts, 32), steam = new THREE.SpriteMaterial({ map: flareTex, color: 0x8f98a6, transparent: true, opacity: 0.18, depthWrite: false });
      for (const w of [-55, 55]){ const [x, yy, z] = g(140, w); const m = new THREE.Mesh(tg, MAT.concrete); m.position.set(x, yy - 1, z); scene.add(m); addStatic(x, z, yy, 0, 20, 20, 90); BEACONS.push([x, yy + 91, z]);
        for (let k = 0; k < 3; k++){ const s = new THREE.Sprite(steam); s.position.set(x + k * 6, yy + 100 + k * 14, z); s.scale.setScalar(50 + k * 18); scene.add(s); } }
      { const [x, yy, z] = g(70, 0); solid(b, new THREE.CylinderGeometry(15, 15, 22, 28), MAT.white, x, yy + 11, z, 0, 15, 15, 22); b.add(new THREE.SphereGeometry(15, 24, 10, 0, TAU, 0, Math.PI / 2), MAT.white, x, yy + 22, z); }
      { const [x, yy, z] = g(75, 40); solid(b, new THREE.BoxGeometry(28, 18, 60), GREY, x, yy + 9, z, F.h, 14, 30, 18); }
      { const [x, yy, z] = g(78, -38); solid(b, new THREE.CylinderGeometry(2.4, 3, 80, 12), MAT.red, x, yy + 40, z, 0, 3, 3, 80); BEACONS.push([x, yy + 81, z]); }
      for (let a = 26; a < 190; a += 6) for (const w of [-90, 90]){ const [x, yy, z] = g(a, w); b.add(new THREE.BoxGeometry(0.1, 2.6, 6), MAT.steel, x, yy + 1.3, z, F.h); }
      break; }
    case 'dam': {
      const span = 240, [cx, , cz] = g(34, 0), top = y + 1;
      for (let k = -12; k <= 12; k++){ const w = k * span / 24, a = 34 + 18 * (1 - (k / 12) ** 2); const [x, z] = F.P(a, w); const base = Math.min(shownGround(x, z), top - 4);
        solid(b, new THREE.BoxGeometry(span / 24 + 0.6, top - base + 60, 9), MAT.concrete, x, (top + base - 60) / 2, z, F.h + Math.atan2(-2 * 18 * k / 144 * (24 / span), 1) * 0, span / 48, 4.5, top - base + 4); }
      for (let k = -11; k <= 11; k += 2){ const [x, z] = F.P(34 + 18 * (1 - (k / 12) ** 2), k * span / 24); b.add(new THREE.BoxGeometry(0.4, 0.3, 0.4), MAT.glow, x, top + 1.4, z); b.add(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), MAT.dark, x, top + 0.7, z); }
      { const [x, z] = F.P(46, 0); b.add(new THREE.BoxGeometry(14, 0.2, 60), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35 }), x, top - 30, z, F.h); }
      break; }
    case 'obs': {
      const [x, yy, z] = g(36, 0); solid(b, new THREE.CylinderGeometry(11, 11, 10, 28), MAT.white, x, yy + 5, z, 0, 11, 11, 10);
      b.add(new THREE.SphereGeometry(11, 28, 12, 0, TAU, 0, Math.PI / 2), MAT.steel, x, yy + 10, z); b.add(new THREE.BoxGeometry(2.4, 6, 22), MAT.dark, x, yy + 16, z, F.h);
      const [x2, yy2, z2] = g(30, 34); solid(b, new THREE.CylinderGeometry(6, 6, 6, 20), MAT.white, x2, yy2 + 3, z2, 0, 6, 6, 6); b.add(new THREE.SphereGeometry(6, 20, 8, 0, TAU, 0, Math.PI / 2), MAT.steel, x2, yy2 + 6, z2);
      break; }
    case 'quarry': {
      for (let k = 0; k < 7; k++){ const [x, yy, z] = g(40 + (k % 3) * 34, (k - 3) * 24); const r = 9 + (k % 3) * 3; solid(b, new THREE.ConeGeometry(r, r * 0.8, 12), GRAVEL, x, yy + r * 0.4 - 0.5, z, 0, r * 0.7, r * 0.7, r * 0.8); }
      { const [x, yy, z] = g(60, -60); if (solid(b, new THREE.BoxGeometry(16, 14, 16), RUST, x, yy + 7, z, F.h, 8, 8, 14)) b.add(new THREE.BoxGeometry(2, 1, 50), MAT.dark, x, yy + 14, z, F.h, 0.35); }
      for (const [a, w] of [[34, 30], [48, -30]]){ const [x, yy, z] = g(a, w); solid(b, new THREE.BoxGeometry(3.4, 3.2, 8), HAZ_Y, x, yy + 2.2, z, F.h + 0.4, 1.8, 4.2, 3.6); }
      break; }
    case 'rail': {
      for (let k = 0; k < 6; k++){ const a = 34 + k * 9; for (const o of [-0.75, 0.75]){ const [x, z] = F.P(a + o, 0); b.add(new THREE.BoxGeometry(0.12, 0.15, 520), MAT.steel, x, shownGround(x, z) + 0.15, z, F.h + Math.PI / 2); } }
      const cols = [0x6a3424, 0x3a4a5a, 0x5a5a5a, 0x2a4a3a].map(LM);
      for (let k = 0; k < 6; k++) for (let j = -12; j <= 12; j++){ if (hash2(k * 31 + j, 7) < 0.35) continue; const [x, z] = F.P(34 + k * 9, j * 18); const gy = shownGround(x, z); solid(b, new THREE.BoxGeometry(2.9, 3.6, 16), cols[(k + j + 20) % 4], x, gy + 2.3, z, F.h + Math.PI / 2, 1.5, 8, 4); }
      { const [x, yy, z] = g(100, 0); solid(b, new THREE.BoxGeometry(30, 12, 80), MAT.tin, x, yy + 6, z, F.h, 15, 40, 12); }
      for (const w of [-200, 0, 200]){ const [x, yy, z] = g(70, w); b.add(new THREE.CylinderGeometry(0.3, 0.4, 24, 8), MAT.dark, x, yy + 12, z); b.add(new THREE.BoxGeometry(3, 0.6, 1), MAT.glow, x, yy + 24, z); }
      break; }
    case 'radio': {
      const [x, yy, z] = g(40, 0), H = 170;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(new THREE.BoxGeometry(0.5, H, 0.5), MAT.red, x + sx * 2.2, yy + H / 2, z + sz * 2.2);
      for (let h = 10; h < H; h += 10) b.add(new THREE.BoxGeometry(4.8, 0.3, 4.8), MAT.white, x, yy + h, z);
      for (let h = 40; h <= H; h += 40) BEACONS.push([x, yy + h + 0.5, z]);
      addStatic(x, z, yy, 0, 3, 3, H); { const [x2, yy2, z2] = g(24, 18); solid(b, new THREE.BoxGeometry(10, 4, 8), GREY, x2, yy2 + 2, z2, F.h, 5, 4, 4); }
      break; }
    case 'ski': {
      { const [x, yy, z] = g(36, 0); bld(b, x, yy - 2, z, F.h, 14, 20, 9, yy, 4, 'red', mulberry(5), { lanterns: -1 }); }
      let prev = null; for (let k = 0; k < 14; k++){ const [x, yy, z] = g(70 + k * 70, -40 + k * 3); b.add(new THREE.BoxGeometry(0.8, 12, 0.8), MAT.steel, x, yy + 6, z); b.add(new THREE.BoxGeometry(6, 0.5, 0.6), MAT.steel, x, yy + 12, z, F.h + Math.PI / 2);
        if (prev){ const dx = x - prev[0], dy = yy - prev[1], dz = z - prev[2], L2 = Math.hypot(dx, dy, dz), m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, L2), MAT.dark); m.position.set((x + prev[0]) / 2, (yy + prev[1]) / 2 + 11.5, (z + prev[2]) / 2); m.lookAt(x, yy + 11.5, z); scene.add(m); }
        if (k % 3 === 0) BEACONS.push([x, yy + 12.6, z]); prev = [x, yy, z]; }
      break; }
    case 'torii': {
      const r = edgeAt(e, Math.max(0, e.len - 60), {}), w = r.hl + 2.2, sc = 1.9;
      for (const sd of [-1, 1]) b.add(new THREE.CylinderGeometry(0.55 * sc, 0.65 * sc, 13, 12), MAT.torii, r.x + r.nx * sd * w, r.y + 6.5, r.z + r.nz * sd * w);
      b.add(new THREE.BoxGeometry(w * 2 + 9, 1.1, 1.6), MAT.torii, r.x, r.y + 13.4, r.z, r.h + Math.PI / 2); b.add(new THREE.BoxGeometry(w * 2 + 4, 0.7, 1.1), MAT.torii, r.x, r.y + 11.3, r.z, r.h + Math.PI / 2);
      { const [x, yy, z] = g(42, 0); bld(b, x, yy - 2, z, F.h, 16, 11, 9, yy, 4, 'red', mulberry(9), { lanterns: -1 }); }
      for (let k = -3; k <= 3; k++){ if (!k) continue; const [x, yy, z] = g(14 + Math.abs(k) * 5, k > 0 ? 12 : -12); b.add(new THREE.BoxGeometry(0.8, 2.2, 0.8), STONE, x, yy + 1.1, z); b.add(new THREE.BoxGeometry(0.6, 0.5, 0.6), MAT.lantern, x, yy + 2.4, z); }
      break; }
    case 'light': {
      const [x, yy, z] = g(24, 0);
      for (let k = 0; k < 6; k++) b.add(new THREE.CylinderGeometry(3.2 - k * 0.25, 3.4 - k * 0.25, 6, 18), k % 2 ? MAT.red : MAT.white, x, yy + 3 + k * 6, z);
      addStatic(x, z, yy, 0, 3.4, 3.4, 40); b.add(new THREE.CylinderGeometry(1.9, 1.9, 2.6, 16), MAT.glow, x, yy + 37.3, z); b.add(new THREE.ConeGeometry(2.4, 2, 16), MAT.red, x, yy + 39.6, z);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 140, 16, 1, true).translate(0, -70, 0).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      beam.position.set(x, yy + 37.3, z); scene.add(beam); LIGHTHOUSE_BEAMS.push(beam);
      break; }
    case 'fort': {
      const S = 44; for (const [a0, w0, a1, w1] of [[30, -S, 30, S], [30 + 2 * S, -S, 30 + 2 * S, S], [30, -S, 30 + 2 * S, -S], [30, S, 30 + 2 * S, S]]){
        const n = 10; for (let k = 0; k <= n; k++){ const a = lerp(a0, a1, k / n), w = lerp(w0, w1, k / n); if (a0 === 30 && a1 === 30 && Math.abs(w) < 10) continue; const [x, yy, z] = g(a, w); solid(b, new THREE.BoxGeometry(9.2, 9, 9.2), STONE, x, yy + 3.5, z, F.h, 4.6, 4.6, 8); } }
      for (const [a, w] of [[30, -S], [30, S], [30 + 2 * S, -S], [30 + 2 * S, S]]){ const [x, yy, z] = g(a, w); solid(b, new THREE.CylinderGeometry(6, 7, 16, 12), STONE, x, yy + 7, z, 0, 6, 6, 16); BEACONS.push([x, yy + 16, z]); }
      break; }
    case 'air': {
      const rw = L.runway; const [x, yy, z] = g(30, -60); solid(b, new THREE.CylinderGeometry(18, 18, 50, 20, 1, false, 0, Math.PI), MAT.tin, x, yy, z, F.h, 18, 25, 18);
      { const [x2, yy2, z2] = g(14, 60); solid(b, new THREE.BoxGeometry(5, 18, 5), GREY, x2, yy2 + 9, z2, F.h, 2.5, 2.5, 18); b.add(new THREE.BoxGeometry(8, 3, 8), new THREE.MeshBasicMaterial({ color: 0x2a6a7a }), x2, yy2 + 19.5, z2, F.h); BEACONS.push([x2, yy2 + 21.5, z2]); }
      if (rw){ const re = edgeAt(rw, rw.len - 40, {}), px = re.x + re.nx * 40, pz = re.z + re.nz * 40, py = shownGround(px, pz);
        solid(b, new THREE.CylinderGeometry(1.6, 1.4, 22, 14).rotateX(Math.PI / 2), MAT.white, px, py + 2.2, pz, re.h, 1.6, 11, 3.4); b.add(new THREE.BoxGeometry(26, 0.4, 3.6), MAT.white, px, py + 2.2, pz, re.h); b.add(new THREE.BoxGeometry(0.4, 4.2, 3), MAT.red, px - Math.sin(re.h) * 10, py + 4.4, pz - Math.cos(re.h) * 10, re.h);
        for (let s = 20; s < rw.len; s += 60) for (const sd of [-1, 1]){ const q = edgeAt(rw, s, {}); BEACONS.push([q.x + q.nx * sd * (q.hl + 1), q.y + 0.3, q.z + q.nz * sd * (q.hl + 1)]); } }
      break; }
    case 'track': {
      const n0 = L.node, [x, yy, z] = [n0.x + 310, n0.y, n0.z]; solid(b, new THREE.BoxGeometry(160, 9, 14), GREY, x, yy + 4.5, z + 230, 0, 80, 7, 9); b.add(new THREE.BoxGeometry(160, 0.5, 18), MAT.red, x, yy + 10, z + 230);
      solid(b, new THREE.BoxGeometry(120, 6, 10), MAT.white, x, yy + 3, z - 228, 0, 60, 5, 6);
      for (let k = -4; k <= 4; k++) b.add(new THREE.BoxGeometry(2.2, 0.4, 0.4), MAT.glow, x + k * 16, yy + 6.4, z - 222);
      for (let k = 0; k < 12; k++){ const t2 = k / 12 * TAU; BEACONS.push([n0.x + 310 + Math.cos(t2) * 345, yy + 6, n0.z + Math.sin(t2) * 220]); }
      break; }
    case 'wind': {
      for (let k = 0; k < 9; k++){ const [x, z] = F.P(120 + (k % 3) * 170, (Math.floor(k / 3) - 1) * 210); if (roadDist(x, z) > 60) makeTurbine(x, z, 0.6); }
      break; }
  }
  b.flush();
}

// =====================================================================================================
// HOUSING DISTRICTS: rows of family houses on little closes
// =====================================================================================================
function buildSuburb(S){
  const b = new Builder(), R = mulberry(S.name.length * 991 + Math.round(S.x)), placed = [];
  lotsAlong(b, S.edges, R, placed, { lmin: 10, lmax: 13, dmin: 9, dmax: 12, setback: 4, gmin: 5, gmax: 9, height: () => 5 + R() * 3, kind: () => [4, 5, 7][Math.floor(R() * 3)], roof: () => ['tile', 'red', 'tin'][Math.floor(R() * 3)], store: () => false,
    after: (x, z, y, top, ry) => { if (R() < 0.5){ const fx = x - Math.cos(ry) * 0, tx = x + Math.sin(ry) * 7, tz = z + Math.cos(ry) * 7; tree(b, tx, groundAt(tx, tz), tz, 0.6 + R() * 0.3); } } });
  b.flush();
}

// =====================================================================================================
// SECRETS: hidden garages and caches at the end of a few of the many dead ends. Nothing marks them on the map
// until you own the secret map; even then you have to drive there. Each gives a reward once.
// =====================================================================================================
const REWARD_TEXT = { 'mod:ROCKET': 'ROCKET BOOSTER · HOLD F FOR A HUGE PUSH', 'mod:AERO': 'ACTIVE AERO KIT · FAR MORE GRIP AT SPEED', 'paint:JUKAI MOSS': 'JUKAI MOSS PAINT', 'paint:CHROME': 'CHROME PAINT', 'paint:MATTE BLACK': 'MATTE BLACK PAINT', 'paint:PEARL GOLD': 'PEARL GOLD PAINT', 'glow:CYAN': 'CYAN UNDERGLOW', 'glow:MAGENTA': 'MAGENTA UNDERGLOW', 'rims:GOLD': 'GOLD RIMS', 'rims:NEON': 'NEON RIMS', 'wing:GT': 'GT WING',
  'part:engine4': 'LEVEL 4 ENGINE (RACE BUILD)', 'part:tyres4': 'LEVEL 4 TYRES (SLICKS)', 'part:nitro4': 'LEVEL 4 NITRO (TWIN BOTTLES)', 'part:turbo4': 'LEVEL 4 TURBO (TWIN SCROLL)', 'cash:40000': '$40,000 IN A BAG', 'paint:KAGE BLACK': 'KAGE BLACK PAINT', 'glow:AKARI': 'AKARI UNDERGLOW', 'cash:75000': '$75,000 AND A ROCKET' };
const SECRET_SPOTS = []; // { kind: 'secret' | 'clue', i, x, z, y, grp, F }
function buildSecretSpot(S, kind, i){
  const e = S.node.links[0], F = endFrame(e, S.node), grp = new THREE.Group(); grp.visible = false; scene.add(grp);
  const add = (geo, mat, a, w, dy, ry = 0) => { const [x, z] = F.P(a, w); const m = new THREE.Mesh(geo, mat); m.position.set(x, shownGround(x, z) + dy, z); m.rotation.y = F.h + ry; grp.add(m); return m; };
  if (kind === 'clue'){ // a stone lantern with a glowing note right where the road ends, and a beam of light you can see from far off
    add(new THREE.BoxGeometry(0.9, 1.6, 0.9), STONE, 3, -6, 0.8); add(new THREE.BoxGeometry(1.3, 0.3, 1.3), STONE, 3, -6, 1.75);
    const note = add(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }), 3, -6, 2.25);
    add(new THREE.CylinderGeometry(0.6, 1.4, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xc48aff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }), 3, -6, 31);
    { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(128, 128, (g, w, h) => { g.fillStyle = '#c48aff'; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.fill(); g.fillStyle = '#1a0f2a'; g.font = '900 86px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 64, 70); }), fog: false, depthWrite: false, transparent: true })); const [sx, sz] = F.P(3, -6); sp.position.set(sx, shownGround(sx, sz) + 5, sz); sp.scale.set(2.4, 2.4, 1); grp.add(sp); }
    const lt = new THREE.PointLight(0xffb85a, 2.2, 26, 2); lt.position.copy(note.position); lt.position.y += 1; grp.add(lt);
    SECRET_SPOTS.push({ kind, i, x: F.x, z: F.z, y: F.y, grp, note, light: lt });
    return; }
  const glowCol = [0x3dffb0, 0xff3d9a, 0x3dd8ff, 0xffd23d][i % 4];
  if (S.house){ // the crazy house: a rocket on a launch tower in the back garden
    add(new THREE.CylinderGeometry(1.6, 1.6, 22, 16), MAT.white, 26, 8, 11 + 3); add(new THREE.ConeGeometry(1.6, 5, 16), MAT.red, 26, 8, 27.5);
    for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.2, 4, 3), MAT.red, 26, 8 + sd * 1.8, 4.5);
    add(new THREE.BoxGeometry(1, 30, 1), MAT.steel, 26, 12, 15); add(new THREE.BoxGeometry(6, 3, 0.2), new THREE.MeshBasicMaterial({ color: glowCol }), 14, 0, 1.8, Math.PI);
  } else if (S.hangar){ // an arched hangar with its doors open a crack and light pouring out
    const arch = new THREE.CylinderGeometry(8, 8, 26, 24, 1, true, 0, Math.PI).applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)); // a half tube lying along the road, round side up
    add(arch, new THREE.MeshLambertMaterial({ color: 0x5d6f7a, side: THREE.DoubleSide }), 25, 0, 0);
    const endM = new THREE.MeshLambertMaterial({ color: 0x8e9096, side: THREE.DoubleSide }); add(new THREE.CircleGeometry(8, 24, 0, Math.PI), endM, 12.05, 0, 0); add(new THREE.CircleGeometry(8, 24, 0, Math.PI), endM, 37.95, 0, 0);
    add(new THREE.BoxGeometry(5, 6, 0.2), new THREE.MeshBasicMaterial({ color: glowCol }), 11.9, 0, 3);
    add(new THREE.BoxGeometry(0.15, 7, 0.15), MAT.steel, 9, 10, 3.5); add(new THREE.ConeGeometry(0.6, 2.2, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xff7a20 }), 9, 11.1, 6.6);
    for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.5, 0.06, 2.5), new THREE.MeshBasicMaterial({ color: 0xffd23d }), 2 + k * 1.2, 0, 0.04, 0);
  } else if (S.tunnel){ // a boarded-up portal into the hillside, light leaking out
    add(new THREE.BoxGeometry(12, 9, 3), MAT.concrete, 16, 0, 4.5); add(new THREE.BoxGeometry(8, 6, 0.4), new THREE.MeshBasicMaterial({ color: 0x050506 }), 14.4, 0, 3);
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(8.4, 0.35, 0.2), MAT.wood, 14.1, 0, 1 + k * 1.4, 0.04 * (k - 1.5));
    add(new THREE.BoxGeometry(7, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: glowCol }), 14.0, 0, 0.2);
    add(new THREE.BoxGeometry(30, 14, 18), STONE, 30, 0, 6);
  } else { // a shed with a glowing door and something under a tarp
    add(new THREE.BoxGeometry(10, 5, 8), MAT.wood, 18, 0, 2.5); add(new THREE.BoxGeometry(10.6, 0.3, 8.6), MAT.tin, 18, 0, 5.15);
    add(new THREE.BoxGeometry(4.5, 3.6, 0.15), new THREE.MeshBasicMaterial({ color: glowCol }), 13.9, 0, 1.8, Math.PI / 2 * 0);
    add(new THREE.BoxGeometry(2.1, 1.1, 4.6), LM(0x2a3a2c), 9, 6, 0.6);
  }
  const lt = new THREE.PointLight(glowCol, 2.2, 30, 2); const [lx, lz] = F.P(12, 0); lt.position.set(lx, shownGround(lx, lz) + 2, lz); grp.add(lt);
  SECRET_SPOTS.push({ kind, i, x: F.x, z: F.z, y: F.y, grp });
}
function buildSecrets(){ SECRETS.forEach((S, i) => buildSecretSpot(S, 'secret', i)); CLUES.forEach((S, i) => buildSecretSpot(S, 'clue', i)); }
// the riddles: where each clue spot is, in words, from the nearest named place on the big map
function compassXZ(dx, dz){ const a = Math.atan2(dx, -dz), k = Math.round(a / (Math.PI / 4)); return ['NORTH', 'NORTH-EAST', 'EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST'][(k + 8) % 8]; }
function namedPlaces(){ return [...CITIES.map(c => ({ name: c.name, x: c.x, z: c.z })), ...TOWNS.map(t => ({ name: t.name, x: t.x, z: t.z })), ...LANDMARKS.filter(l => l.node).map(l => ({ name: 'THE ' + l.name, x: l.node.x, z: l.node.z })), ...HAMLETS.map(h => ({ name: h.name, x: h.x, z: h.z }))]; }
// riddles, not directions: the place they hang off is described, never named outright; the way there is the sun's
const KENNING = { 'RAIL FREIGHT YARD': 'where the iron snakes sleep in rows', 'WIND FARM': 'the white giants that wave all night and never take a step', 'NUCLEAR POWER PLANT': 'the house that boils its water with stones', 'LIGHTHOUSE': 'the tall one with a single turning eye',
  'OLD COASTAL FORT': 'the walls that still guard the sea from nobody', 'ABANDONED AIRSTRIP': 'the road that once wanted to fly', 'WEST RIDGE QUARRY': 'the hill that is being eaten a bite at a time', 'GREAT SHRINE': 'the gate that is only a door for gods',
  'MORI RACE CIRCUIT': 'the road that runs in circles and never arrives', 'RADIO MAST': 'the needle that listens to the whole sky', 'KUROBE DAM': 'the wall that holds a lake in its arms', 'SHIRAKAWA DAM': 'the grey wall that keeps a river waiting',
  'MOUNTAIN OBSERVATORY': 'the white dome that stares at the night', 'SKI RESORT': 'where people pay to fall down the snow',
  HOKUTO: 'the town of tall grain towers', NAGISA: 'the port where iron cranes fish for boxes', KAWAGUCHI: 'the city that looks at itself in a lake', HAKONE: 'the steaming town of hot springs high on the mountain', TOKAI: 'the capital that never switches its lights off' };
const SUNWAY = { NORTH: 'towards the cold star that never moves', SOUTH: 'towards the snow on the high peaks', EAST: 'towards where the sun climbs out of bed', WEST: 'towards where the sun goes down to sleep',
  'NORTH-EAST': 'between the cold star and the sunrise', 'NORTH-WEST': 'between the cold star and the sunset', 'SOUTH-EAST': 'between the high snow and the sunrise', 'SOUTH-WEST': 'between the high snow and the sunset' };
function riddle(S){
  const cands = [...CITIES.map(c => ({ name: c.name, x: c.x, z: c.z, k: KENNING[c.name] })), ...LANDMARKS.filter(l => l.node).map(l => ({ name: l.name, x: l.node.x, z: l.node.z, k: KENNING[l.name] })),
    ...TOWNS.map(t => ({ name: t.name, x: t.x, z: t.z, k: t.jp ? 'the little town whose sign is written ' + t.jp : 'the little town at the end of the bus line' })), ...HAMLETS.map(h => ({ name: h.name, x: h.x, z: h.z, k: 'a handful of roofs the map calls ' + h.name }))];
  let best = null, bd = Infinity; for (const p of cands){ const d = Math.hypot(p.x - S.x, p.z - S.z) * (KENNING[p.name] ? 0.6 : 1); if (d < bd && d > 300 * (KENNING[p.name] ? 0.6 : 1)){ bd = d; best = p; } }
  const d = Math.hypot(best.x - S.x, best.z - S.z), dir = compassXZ(S.x - best.x, S.z - best.z);
  const far = d < 1500 ? 'Not far: a song on the radio will get you there' : d < 3500 ? 'A few songs on the radio away' : 'A whole album on the radio away';
  const track = /FARM/.test((S.e && S.e.name) || '') ? 'a farm track that tractors gave up on' : 'a forest road the loggers forgot';
  const alt = S.node.y, high = alt > 500 ? 'up where your breath turns to cloud' : alt > 200 ? 'up in the hills where the air goes thin and cool' : alt > 60 ? 'out in the low rolling country' : 'down low, where the frogs sing';
  return `Find ${best.k}. ${far}, ${SUNWAY[dir]}, ${track} runs out of reasons to go on, ${high}. Where it stops, so must you.`;
}
const QUEST_TEXT = () => CLUES.map(riddle);

// =====================================================================================================
// EASTER EGGS: odd roadside attractions just off some of the highway exits. Stop beside one for a bonus, once each
// =====================================================================================================
const EGGS = [];
const EGG_KINDS = [['cat', 'GIANT LUCKY CAT'], ['ufo', 'CRASHED UFO'], ['dino', 'CONCRETE DINOSAUR'], ['ramen', 'WORLD\'S BIGGEST RAMEN'], ['vend', 'VENDING MACHINE WALL'], ['duck', 'GIANT RUBBER DUCK'], ['robot', 'GIANT ROBOT'], ['moai', 'MYSTERY STONE HEADS'], ['kaiju', 'KAIJU FOOTPRINT'], ['torii', 'THOUSAND TORII']];
function buildEasterEggs(){
  const S = c => LM(c), B = c => new THREE.MeshBasicMaterial({ color: c });
  let k = 0;
  for (const X of EXITS){
    if (X.num % 3 !== 1 || k >= EGG_KINDS.length) continue;
    let spot = null;
    for (const [J, sd] of [[X.nJA, 1], [X.nJB, -1]]) for (const [a, w] of [[60, 70], [-60, 70], [90, 110], [-90, 110]]){
      const x = J.x + X.tx * a + X.rx * sd * w, z = J.z + X.tz * a + X.rz * sd * w, y = shownGround(x, z);
      if (!spot && roadDist(x, z) > 32 && lotClear(x, z, y, 14, null)) spot = { x, z, y, J };
    }
    if (!spot) continue;
    const [kind, name] = EGG_KINDS[k++], b = new Builder(), { x, z, y } = spot, h = Math.atan2(spot.J.x - x, spot.J.z - z); // facing the junction
    const at = (dx, dz) => [x + Math.cos(h) * dx + Math.sin(h) * dz, z - Math.sin(h) * dx + Math.cos(h) * dz];
    const put = (geo, mat, dx, dy, dz, ry = 0, rx = 0, rz = 0) => { const [px, pz] = at(dx, dz); b.add(geo, mat, px, y + dy, pz, h + ry, rx, rz); };
    switch (kind){
      case 'cat': put(new THREE.CylinderGeometry(3.2, 3.8, 6, 20), S(0xf4f1ea), 0, 3, 0); put(new THREE.SphereGeometry(3.4, 20, 14), S(0xf4f1ea), 0, 8.4, 0);
        for (const sx of [-1, 1]) put(new THREE.ConeGeometry(1, 1.8, 4), S(0xf4f1ea), sx * 2, 11.3, 0); put(new THREE.TorusGeometry(2.9, 0.35, 8, 24), S(0xc9262b), 0, 6.1, 0, 0, Math.PI / 2);
        put(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 20), B(0xffd23d), 0, 4.6, 3.3, 0, Math.PI / 2); put(new THREE.BoxGeometry(1.2, 3.4, 1.2), S(0xf4f1ea), 2.6, 10, 1.4, 0, 0, -0.3);
        for (const sx of [-1, 1]) put(new THREE.SphereGeometry(0.35, 8, 6), B(0x111111), sx * 1.2, 9, 3.1); break;
      case 'ufo': put(new THREE.SphereGeometry(7, 28, 10).scale(1, 0.28, 1), S(0x9aa3ad), 0, 1.6, 0, 0, 0.25); put(new THREE.SphereGeometry(2.6, 18, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.55 }), 0, 2.6, -0.6, 0, 0.25);
        for (let q = 0; q < 10; q++){ const a = q / 10 * TAU; put(new THREE.SphereGeometry(0.35, 8, 6), B(q % 2 ? 0x3dffb0 : 0xff3d9a), Math.cos(a) * 6.6, 1.6 + Math.sin(a) * 1.6, Math.sin(a) * 6.6); }
        { const [px, pz] = at(0, 0); const l = new THREE.PointLight(0x5dffb0, 2.5, 40, 2); l.position.set(px, y + 4, pz); scene.add(l); } break;
      case 'dino': { const g = S(0x3e7a3a); put(new THREE.BoxGeometry(4, 4.5, 9), g, 0, 5, 0); put(new THREE.CylinderGeometry(1.1, 1.6, 7, 10), g, 0, 9.5, 4.5, 0, 0.5); put(new THREE.BoxGeometry(2.2, 2, 4), g, 0, 13, 7.6);
        put(new THREE.ConeGeometry(1.8, 9, 10), g, 0, 4.5, -8.5, 0, -Math.PI / 2 - 0.2); for (const [lx, lz] of [[-1.5, 3], [1.5, 3], [-1.5, -3], [1.5, -3]]) put(new THREE.BoxGeometry(1.2, 3.2, 1.2), g, lx, 1.6, lz);
        for (let q = 0; q < 6; q++) put(new THREE.ConeGeometry(0.6, 1.4, 4), S(0xc96a2a), 0, 7.6, 3 - q * 1.6); break; }
      case 'ramen': put(new THREE.CylinderGeometry(6, 3.5, 4.5, 28, 1, true), new THREE.MeshLambertMaterial({ color: 0xb3261e, side: THREE.DoubleSide }), 0, 2.25, 0); put(new THREE.CylinderGeometry(5.7, 5.7, 0.3, 28), S(0xd99a3a), 0, 4.2, 0);
        for (let q = 0; q < 14; q++){ const a = q * 2.4, r = 1 + (q % 4); put(new THREE.TorusGeometry(0.8, 0.12, 6, 12), S(0xf2d77a), Math.cos(a) * r, 4.4, Math.sin(a) * r, a, Math.PI / 2); }
        put(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16), S(0xf4f1ea), 2, 4.45, -1.5); put(new THREE.CylinderGeometry(0.15, 0.2, 12, 6), S(0x8a5a2a), -1, 7, 1, 0, 0.5, 0.2); put(new THREE.CylinderGeometry(0.15, 0.2, 12, 6), S(0x8a5a2a), -0.3, 7, 1.2, 0, 0.45, 0.3); break;
      case 'vend': { const cols = [0xff3d6e, 0x3dd8ff, 0xffd23d, 0x8aff6a, 0xff8a2a, 0xc48aff]; for (let q = 0; q < 12; q++){ const col = q % 6, row = Math.floor(q / 6); put(new THREE.BoxGeometry(1.8, 2.6, 1.2), B(cols[(q * 5) % 6]), (col - 2.5) * 1.95, 1.3 + row * 2.65, 0); put(new THREE.BoxGeometry(1.2, 1.2, 0.05), B(0xffffff), (col - 2.5) * 1.95, 1.8 + row * 2.65, 0.63); }
        const [px, pz] = at(0, 3); const l = new THREE.PointLight(0xffffff, 2, 26, 2); l.position.set(px, y + 3, pz); scene.add(l); break; }
      case 'duck': put(new THREE.SphereGeometry(5, 22, 16).scale(1.3, 0.85, 1), S(0xffd21a), 0, 4, 0); put(new THREE.SphereGeometry(3, 18, 14), S(0xffd21a), 0, 9, 3.2); put(new THREE.ConeGeometry(1.1, 2.6, 12).rotateX(Math.PI / 2), S(0xff7a1a), 0, 8.6, 6.4);
        for (const sx of [-1, 1]) put(new THREE.SphereGeometry(0.4, 8, 6), B(0x111111), sx * 1.2, 9.8, 5.6); break;
      case 'robot': { const w = S(0xe8e8ec), bl = S(0x2a4fb8), r = S(0xc9262b); for (const sx of [-1, 1]){ put(new THREE.BoxGeometry(2, 7, 2.2), w, sx * 1.6, 3.5, 0); put(new THREE.BoxGeometry(1.6, 6, 1.8), w, sx * 4.2, 11, 0); }
        put(new THREE.BoxGeometry(6, 6, 3.5), bl, 0, 10, 0); put(new THREE.BoxGeometry(3, 2.6, 2.6), w, 0, 14.4, 0); put(new THREE.BoxGeometry(3.4, 0.6, 0.4), B(0x3dffb0), 0, 14.6, 1.35); put(new THREE.BoxGeometry(0.4, 2, 0.4), r, 0, 16.4, 0); break; }
      case 'moai': for (const dx of [-7, 0, 7]){ put(new THREE.BoxGeometry(3, 7, 3), S(0x6e6a62), dx, 3.5, 0); put(new THREE.BoxGeometry(1, 3, 1.4), S(0x5e5a52), dx, 4.5, 1.8); put(new THREE.BoxGeometry(3.2, 1, 3.2), S(0x5e5a52), dx, 7.2, 0); } break;
      case 'kaiju': for (const [dx, dz, sc] of [[0, 0, 1], [-6, 18, 1], [3, 36, 1]]){ put(new THREE.CylinderGeometry(4 * sc, 4 * sc, 0.4, 16).scale(1, 1, 1.6), S(0x2a2620), dx, 0.05, dz); for (const t of [-2.5, 0, 2.5]) put(new THREE.ConeGeometry(0.8, 2.4, 6).rotateX(-Math.PI / 2), S(0x2a2620), dx + t, 0.4, dz + 6.4); } break;
      case 'torii': for (let q = 0; q < 14; q++){ for (const sx of [-1, 1]) put(new THREE.CylinderGeometry(0.25, 0.3, 4.5, 8), MAT.torii, sx * 2.2, 2.25, q * 3); put(new THREE.BoxGeometry(5.6, 0.35, 0.5), MAT.torii, 0, 4.6, q * 3); } break;
    }
    addStatic(x, z, y, h, 5, 5, 8);
    b.flush();
    const q = nearestRoadPoint(x, z); EGGS.push({ name, kind, x, z, y, exit: X.num, reach: Math.hypot(q.x - x, q.z - z) + 25 }); // you only have to get as close as the road goes
  }
}

// =====================================================================================================
// WARNING SIGNS: a red-edged triangle on the way into every country junction and roundabout. A roundabout sign shows
// the circling arrows; a junction sign shows the shape of the junction as you'll meet it
// =====================================================================================================
const WARN_TEX = new Map();
function warnTex(key, draw){
  let m = WARN_TEX.get(key); if (m) return m;
  const t = textTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w - 12, h - 26); g.lineTo(12, h - 26); g.closePath(); g.fillStyle = '#f4f2ec'; g.fill(); g.lineWidth = 22; g.strokeStyle = '#d0202a'; g.stroke();
    g.strokeStyle = '#111'; g.fillStyle = '#111'; draw(g, w / 2, h * 0.6); });
  m = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }); WARN_TEX.set(key, m); return m;
}
function buildJunctionSigns(){
  const b = new Builder();
  for (const p of PATCHES){
    const n = p.node; if (!p.poly || n.city || n.links.length < 3) continue;
    for (const e of n.links){
      if (e.len < 160 || e.cls === 'al') continue;
      const atB = e.b === n, t = trimAt(e, atB) + 65, r = edgeAt(e, atB ? e.len - t : t, {});
      // which way the other roads leave, relative to the way you're arriving
      const here = edgeAt(e, atB ? e.len - 2 : 2, {}), inH = atB ? here.h : here.h + Math.PI;
      const rel = n.links.filter(o => o !== e).map(o => { const oa = o.a === n, q = edgeAt(o, oa ? 6 : o.len - 6, {}); return Math.round(angWrap((oa ? q.h : q.h + Math.PI) - inH) / (Math.PI / 4)); });
      const key = p.rb ? 'rb' : 'j' + rel.sort().join(',');
      const mat = warnTex(key, (g, cx, cy) => {
        if (p.rb){ g.lineWidth = 9; for (let k = 0; k < 3; k++){ const a0 = k * 2.09 + 0.3, a1 = a0 + 1.5; g.beginPath(); g.arc(cx, cy, 34, a0, a1); g.stroke(); const ax = cx + Math.cos(a1) * 34, ay = cy + Math.sin(a1) * 34; g.beginPath(); g.moveTo(ax + Math.cos(a1 + 1.57) * 14, ay + Math.sin(a1 + 1.57) * 14); g.lineTo(ax - 9, ay - 9 * Math.sign(Math.cos(a1))); g.lineTo(ax + Math.cos(a1 - 1.57) * 4, ay + Math.sin(a1 - 1.57) * 4); g.fill(); } return; }
        g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy + 50); g.lineTo(cx, cy); g.stroke(); // your road, coming up from the bottom
        g.lineWidth = 11; for (const k of rel){ const a = -Math.PI / 2 + k * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46); g.stroke(); } });
      const d = atB ? -(r.hr + 1.6) : r.hl + 1.6, x = r.x + r.nx * d, z = r.z + r.nz * d, face = atB ? r.h + Math.PI : r.h;
      b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), MAT.dark, x, r.y + 1.3, z);
      b.add(new THREE.PlaneGeometry(1.5, 1.5), mat, x, r.y + 3.0, z, face);
    }
  }
  b.flush();
}
