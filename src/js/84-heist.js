// =====================================================================================================
// THE JOB: a fixer in Nagisa's tune shop wants a prototype stolen off a freight train in the north rail yard and
// delivered to a hidden chop shop down in the mountains. Take the job and you get a fake licence. Steal the crate and
// every police car is looking for a car your colour. Border posts on the roads between the north, the middle and the
// mountains stop you and check your licence: respray to get past, and remember they run your ID afterwards.
// =====================================================================================================
const HS = () => (STATE.heist && typeof STATE.heist === 'object') ? STATE.heist : (STATE.heist = { stage: 0 });
const HEIST = { target: null, drop: null, ping: null, crate: null, shed: null };
const BORDERS = [];
const BORDER_LINES = [{ z: -12000, name: 'NORTH BORDER', jp: '北部検問' }, { z: 10100, name: 'MOUNTAIN BORDER', jp: '山岳検問' }];
const heistBolo = () => HS().stage === 2 && STATE.paint === HS().bolo; // a car the colour they're looking for
const heistLock = () => HS().stage === 2;
// ---------- where things are, and the border posts
function buildHeist(){
  const yard = LANDMARKS.find(l => l.name === 'RAIL FREIGHT YARD' && l.node);
  if (yard) HEIST.target = { x: yard.node.x, z: yard.node.z, y: yard.node.y, name: 'THE RAIL FREIGHT YARD' };
  // the drop: the quietest forgotten road in the southern hills that nothing else uses
  { const used = new Set([...SECRETS, ...CLUES]); let best = null, bs = -Infinity;
    const avoid = [...LORE_SPOTS, ...TOWNS, ...SECRETS, ...(KEEPER_SPOT ? [KEEPER_SPOT] : [])];
    for (const d of DEAD_ENDS){ if (used.has(d) || (LORE_KEEPER && d.node === LORE_KEEPER.node) || d.z < 12500 || d.z > 22500 || d.e.len < 450) continue;
      const near = Math.min(...avoid.map(q => Math.hypot(q.x - d.x, q.z - d.z)), ...CITIES.map(c => Math.hypot(c.x - d.x, c.z - d.z) - c.half));
      const sc = Math.min(near, 2500) + d.e.len * 0.4; if (sc > bs){ bs = sc; best = d; } }
    if (best) HEIST.drop = { x: best.x, z: best.z, y: best.node.y, node: best.node, e: best.e, name: 'THE CHOP SHOP' }; }
  // the chop shop: a corrugated shed with a roller door and a green work light
  if (HEIST.drop){ const D = HEIST.drop, F = endFrame(D.e, D.node), b = new Builder(), at = (a, w) => { const [x, z] = F.P(a, w); return [x, shownGround(x, z), z]; };
    { const [x, y, z] = at(16, 0); b.add(new THREE.BoxGeometry(12, 5.5, 9), MAT.tin, x, y + 2.6, z, F.h); b.add(new THREE.BoxGeometry(12.6, 0.3, 9.6), MAT.dark, x, y + 5.5, z, F.h); }
    { const [x, y, z] = at(11.4, 0); b.add(new THREE.BoxGeometry(5, 3.8, 0.15), new THREE.MeshBasicMaterial({ color: 0x3ee07a }), x, y + 1.9, z, F.h); }
    { const [x, y, z] = at(10, -7); b.add(new THREE.BoxGeometry(1.2, 1, 3), LM(0x5a2a22), x, y + 0.5, z, F.h); }
    const t = textTex(512, 128, (g, w, h) => { g.fillStyle = '#10140f'; g.fillRect(0, 0, w, h); g.fillStyle = '#3ee07a'; g.font = '900 64px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('解体屋', w / 2, h / 2); });
    { const [x, y, z] = at(11.2, 0); b.add(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }), x, y + 4.6, z, F.h + Math.PI); }
    b.flush(); const [lx, ly, lz] = at(9, 0), l = new THREE.PointLight(0x3ee07a, 1.6, 34, 2); l.position.set(lx, ly + 3.5, lz); scene.add(l); HEIST.shed = l; }
  // the crate on the freight train: only there while the job is on
  if (HEIST.target){ const T = HEIST.target, g = new THREE.Group(); g.position.set(T.x, shownGround(T.x, T.z), T.z);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 3.4), LM(0x7a5a2a)); crate.position.y = 0.8; g.add(crate);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, 3.5), new THREE.MeshBasicMaterial({ color: 0xffb04a })); band.position.y = 1.2; g.add(band);
    const l = new THREE.PointLight(0xffb04a, 2, 30, 2); l.position.y = 4; g.add(l); g.visible = false; scene.add(g); HEIST.crate = g; }
  // border posts wherever a road crosses one of the lines (not the dirt tracks: smugglers know those)
  const stripe = canvasTex(256, 16, g => { for (let k = 0; k < 8; k++){ g.fillStyle = k % 2 ? '#f4f4f4' : '#d8202c'; g.fillRect(k * 32, 0, 32, 16); } });
  const armMat = new THREE.MeshBasicMaterial({ map: stripe }), boothMat = LM(0xd9dde2), glassMat = new THREE.MeshBasicMaterial({ color: 0xffe6b0 });
  const signTex = {}; const sign = L => signTex[L.name] || (signTex[L.name] = textTex(1024, 256, (g, w, h) => { g.fillStyle = '#1b2a6b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 92px ' + JP; g.fillText(L.jp + '  ' + L.name, w / 2, h * 0.38); g.font = '700 46px ' + JP; g.fillStyle = '#ffd23d'; g.fillText('STOP · LICENCE CHECK', w / 2, h * 0.76); }));
  const b = new Builder();
  for (const L of BORDER_LINES) for (const e of EDGES){
    if (e.ic || e.city || e.cls === 'rp' || e.cls === 'dt' || e.cls === 'rw' || e.cls === 'al' || e.cls === 'st' || e.gen === 'dead' || e.len < 300) continue;
    let sC = -1; for (let k = 1; k < e.n; k++){ const z0 = SZ[e.i0 + k - 1], z1 = SZ[e.i0 + k]; if ((z0 - L.z) * (z1 - L.z) <= 0){ sC = k * e.ds; break; } }
    if (sC < 0) continue;
    let s = -1; for (const o of [0, 40, -40, 80, -80, 120, -120]){ const q = sC + o; if (q < 70 || q > e.len - 70) continue; const r = edgeAt(e, q, {}); if (r.y - shownGround(r.x + r.nx * (r.hl + 6), r.z + r.nz * (r.hl + 6)) > 2.5 || r.y - shownGround(r.x - r.nx * (r.hr + 6), r.z - r.nz * (r.hr + 6)) > 2.5) continue;
      if (PADS.some(p => Math.hypot(p.cx - r.x, p.cz - r.z) < 120) || PATCHES.some(p => Math.abs(p.x - r.x) < 60 && Math.abs(p.z - r.z) < 60)) continue; s = q; break; }
    if (s < 0 || BORDERS.some(B => Math.hypot(B.x - edgeAt(e, s, _ra).x, B.z - _ra.z) < 25)) continue;
    const r = edgeAt(e, s, {}), W = r.hl + r.hr;
    // the booth on the right-hand verge, a sign, cones, and a striped barrier arm across the whole road
    const bx = r.x - r.nx * (r.hr + 2.6), bz = r.z - r.nz * (r.hr + 2.6);
    b.add(new THREE.BoxGeometry(2.4, 2.6, 2.6), boothMat, bx, r.y + 1.3, bz, r.h); b.add(new THREE.BoxGeometry(2.5, 0.9, 2.7), glassMat, bx, r.y + 1.75, bz, r.h); b.add(new THREE.BoxGeometry(3, 0.2, 3.2), MAT.red, bx, r.y + 2.7, bz, r.h);
    addStatic(bx, bz, r.y, r.h, 1.25, 1.35, 2.6);
    { const sx = r.x - r.nx * (r.hr + 3) - r.tx * 60, sz = r.z - r.nz * (r.hr + 3) - r.tz * 60, sy = edgeAt(e, clamp(s - 60, 0, e.len), _ra).y; b.add(new THREE.BoxGeometry(0.2, 3.6, 0.2), MAT.dark, sx, sy + 1.8, sz); b.add(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: sign(L), side: THREE.DoubleSide }), sx, sy + 3.6, sz, r.h + Math.PI); }
    for (const a of [-14, -9, -4]) for (const sd of [-1, 1]){ const d = sd > 0 ? r.hl - 0.4 : -r.hr + 0.4, q = edgeAt(e, clamp(s + a, 0, e.len), _ra); b.add(new THREE.ConeGeometry(0.28, 0.75, 8), MAT.red, q.x + q.nx * d, q.y + 0.37, q.z + q.nz * d); }
    const pv = new THREE.Group(), px = r.x - r.nx * (r.hr + 0.9), pz = r.z - r.nz * (r.hr + 0.9);
    pv.position.set(px, r.y + 1.05, pz); pv.rotation.set(0, Math.atan2(-r.nz, r.nx), 1.35, 'YXZ');
    const arm = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.16, 0.16).translate((W + 1.2) / 2, 0, 0), armMat); pv.add(arm);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.4), MAT.dark); post.position.set(px, r.y + 0.55, pz); scene.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x400000 })); lamp.position.set(bx, r.y + 3.0, bz); scene.add(lamp);
    scene.add(pv);
    BORDERS.push({ e, s, x: r.x, z: r.z, y: r.y, tx: r.tx, tz: r.tz, W, line: L, name: L.name, road: e.name, pv, lamp, lift: 1.35, cleared: false, warned: false, side: 0 });
  }
  b.flush();
}
// ---------- your new identity
const ALIAS_F = ['KENJI', 'RYO', 'SHO', 'DAIKI', 'HARU', 'JUN', 'REN', 'TAKU', 'YUJI', 'KAITO'], ALIAS_L = ['MORITA', 'SAEKI', 'KANDA', 'OGAWA', 'TSUJI', 'HAYAMA', 'IWASE', 'NODA', 'KUDO', 'SHIBATA'];
function makeId(){ const R = mulberry(Date.now() % 100000), pick = a => a[Math.floor(R() * a.length)];
  return { name: pick(ALIAS_L) + ' ' + pick(ALIAS_F), no: String(Math.floor(1e11 + R() * 9e11)), born: (1975 + Math.floor(R() * 25)) + '-' + String(1 + Math.floor(R() * 12)).padStart(2, '0') + '-' + String(1 + Math.floor(R() * 28)).padStart(2, '0'), seed: Math.floor(R() * 1e6) }; }
let idPhoto = null;
function licenceHtml(){ const H = HS(), I = H.id; if (!I) return '';
  if (!idPhoto){ const c = document.createElement('canvas'); c.width = 90; c.height = 110; const g = c.getContext('2d'), R = mulberry(I.seed);
    g.fillStyle = '#9bb4c8'; g.fillRect(0, 0, 90, 110); g.fillStyle = '#20242c'; g.beginPath(); g.ellipse(45, 46, 21, 26, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(45, 112, 38, 34, 0, 0, TAU); g.fill();
    g.fillStyle = R() < 0.5 ? '#0c0d10' : '#3a2a1c'; g.beginPath(); g.ellipse(45, 30, 23, 13, 0, Math.PI, TAU); g.fill(); if (R() < 0.6){ g.fillStyle = '#0a0a0a'; g.fillRect(28, 42, 34, 6); } idPhoto = c.toDataURL(); }
  return `<div class="lic"><div class="licTop">運転免許証 · DRIVER'S LICENCE</div><div class="licBody"><img src="${idPhoto}" alt="Licence photo"><div><div class="licRow"><span>NAME</span><b>${I.name}</b></div><div class="licRow"><span>BORN</span><b>${I.born}</b></div><div class="licRow"><span>NO.</span><b>${I.no}</b></div><div class="licRow"><span>CLASS</span><b>普通 · ORDINARY</b></div><div class="licRow"><span>ISSUED</span><b>NAGISA PREFECTURE</b></div></div></div><div class="licBand">VALID</div></div>`; }
// the ID box: your licence, some words, and buttons. The game waits while it's open
let idOpen = false, idWasPaused = false;
function showId(kick, title, text, btns){
  idOpen = true; idWasPaused = paused; paused = true; $('idcard').hidden = false;
  $('idKick').textContent = kick; $('idTitle').textContent = title; $('license').innerHTML = licenceHtml(); $('idText').textContent = text;
  const box = $('idBtns'); box.innerHTML = ''; for (const [label, fn] of btns){ const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn'; bt.textContent = label; bt.addEventListener('click', () => fn()); box.appendChild(bt); }
  try { box.firstChild.focus(); } catch (e) {}
}
function closeId(){ idOpen = false; $('idcard').hidden = true; paused = false; last = performance.now(); }
addEventListener('keydown', e => {
  if (!started) return;
  if (idOpen && (e.code === 'Escape' || e.code === 'KeyI') && !HEIST.check){ e.preventDefault(); e.stopPropagation(); closeId(); return; }
  if (e.code === 'KeyI' && !idOpen && !mapOpen && !helpOpen && HS().id && $('lore').hidden){ e.preventDefault(); const H = HS(); showId('YOUR LICENCE · PRESS I TO CLOSE', H.id.name, H.stage === 2 ? 'Police are looking for a ' + PAINTS[H.bolo].name.toUpperCase() + ' car. ' + (STATE.paint === H.bolo ? 'That\'s yours: respray at any garage or tune shop before the next border post.' : 'Yours isn\'t that colour any more.') : H.stage === 1 ? 'Nobody knows this name yet. Keep it that way.' : 'A souvenir from the job.', [['CLOSE', closeId]]); }
}, true);
// ---------- the shop: the fixer in Nagisa, and a quick respray anywhere while the job is on
function heistShopBlock(c){
  const H = HS(); let h = '';
  if (c.id === 'nagisa'){
    h += '<div class="quest"><div class="nm">THE FIXER · 仕事</div>';
    if (H.stage === 0) h += '<p>A man in a dock jacket leans on the counter. "You drive like you\'ve got nothing to lose. There\'s a crate on a freight train up at the RAIL YARD in the far north, a factory prototype nobody\'s supposed to know about. Bring it to my people at THE CHOP SHOP in the southern hills and they\'ll fit you something special."</p><p>"You\'ll need a new name. And a new colour, once they\'re looking for you. The borders check licences."</p><button type="button" class="btn" data-heist="accept">TAKE THE JOB</button>';
    else if (H.stage === 1) h += '<p>"The crate\'s at the rail yard. What are you waiting for?"</p>';
    else if (H.stage === 2) h += '<p>"Don\'t bring that heat in here. The chop shop, in the southern hills. Go."</p>';
    else h += '<p>"Nice work. Come back when I\'ve got something else."</p>';
    h += '</div>';
  }
  if (H.stage === 2){
    const opts = PAINTS.map((p, i) => [p, i]).filter(([p, i]) => i !== STATE.paint && (!p.secret || STATE.unlocked.includes(p.secret)));
    h += `<div class="quest"><div class="nm">QUICK RESPRAY · $1,500</div><p>Police are looking for a <b>${PAINTS[H.bolo].name.toUpperCase()}</b> car. ${STATE.paint === H.bolo ? 'That\'s yours.' : 'Yours is ' + PAINTS[STATE.paint].name.toUpperCase() + ' now.'}</p><div class="swatches">${opts.map(([p, i]) => `<button type="button" class="sw" data-hpaint="${i}" title="${p.name}" style="background:#${p.hex.toString(16).padStart(6, '0')}" ${STATE.cash >= 1500 ? '' : 'disabled'}></button>`).join('')}</div></div>`;
  }
  return h;
}
function heistWire(el){
  el.querySelectorAll('[data-heist]').forEach(bt => bt.addEventListener('click', () => { if (HS().stage !== 0) return; acceptJob(); renderShop(); }));
  el.querySelectorAll('[data-hpaint]').forEach(bt => bt.addEventListener('click', () => { if (STATE.cash < 1500 || !heistLock()) return; STATE.cash -= 1500; STATE.paint = +bt.dataset.hpaint; setPaint(STATE.paint); saveState(); sfx.beep(1500); popup('RESPRAYED · ' + PAINTS[STATE.paint].name.toUpperCase(), 0, 'near'); renderShop(); }));
}
function heistRoute(P, label){ const q = nearestRoadPoint(P.x, P.z); STATE.dest = { type: 'pt', x: P.x, z: P.z, eId: q.e.id, s: q.s, label }; gps.t = 0; saveState(); }
function acceptJob(){
  const H = HS(); H.stage = 1; H.id = makeId(); idPhoto = null; saveState(); sfx.beep(1700);
  if (HEIST.target) heistRoute(HEIST.target, 'THE JOB · RAIL YARD');
  showId('THE JOB · 仕事', 'YOUR NEW NAME', 'The fixer slides a licence across the counter. Your face, somebody else\'s name. "Show this at the borders, never your own." GPS set to the rail yard. Press I any time to look at your licence.', [['GOT IT', closeId]]);
}
// ---------- each frame
function updateHeist(dt){
  const H = HS(), v = Math.hypot(car.vx, car.vy);
  if (HEIST.crate) HEIST.crate.visible = H.stage === 1 && Math.abs(car.x - HEIST.target.x) < 800 && Math.abs(car.z - HEIST.target.z) < 800;
  // the steal
  if (H.stage === 1 && HEIST.target && v < 4 && Math.hypot(car.x - HEIST.target.x, car.z - HEIST.target.z) < 30){
    H.stage = 2; H.bolo = STATE.paint; H.flags = 0; STATE.stars = Math.max(STATE.stars, 3); saveState(); sfx.beep(900);
    if (HEIST.drop) heistRoute(HEIST.drop, 'THE JOB · THE CHOP SHOP');
    showLore('THE RAIL YARD', ['You back up to the wagon, cut the seal and slide the crate into the car. PROTOTYPE · DO NOT OPEN is stencilled on the side.', 'Somewhere an alarm starts howling. Every police car in the country now knows to look for a ' + PAINTS[H.bolo].name.toUpperCase() + ' car.', 'Get it to the chop shop in the southern hills. Border posts will want your licence: change your colour at any garage before you reach one.'], () => policeKnow(car.x, car.z, 'ALARM AT THE RAIL YARD'));
    return;
  }
  // the delivery
  if (H.stage === 2 && HEIST.drop && v < 4 && Math.hypot(car.x - HEIST.drop.x, car.z - HEIST.drop.z) < 30){
    H.stage = 3; STATE.proto = true; STATE.cash += 20000; applyUpgrades(); if (chase.on) endChase(false); saveState(); sfx.beep(2000);
    showLore('THE CHOP SHOP · 解体屋', ['The roller door rattles up and two mechanics wave you inside. The crate is open before the door is down again.', 'An hour later your car has a PROTOTYPE TWIN-TURBO KIT: more power, less drag and a bigger nitro bottle. Nobody else has one.', 'REWARD: PROTOTYPE KIT · +$20,000. Your fake licence is yours to keep.']);
    return;
  }
  // the border posts
  for (const B of BORDERS){
    const want = H.stage === 2 && !B.cleared ? 0 : 1.35; if (Math.abs(B.lift - want) > 0.01){ B.lift += clamp(want - B.lift, -dt * 1.2, dt * 1.2); B.pv.rotation.z = B.lift; }
    if (Math.abs(car.x - B.x) > 340 || Math.abs(car.z - B.z) > 340){ if (B.cleared || B.warned){ B.cleared = false; B.warned = false; } B.side = 0; continue; }
    B.lamp.material.color.setHex(H.stage === 2 && !B.cleared ? ((simT * 3 | 0) % 2 ? 0xff2020 : 0x400000) : 0x20ff60);
    if (H.stage !== 2) continue;
    const d = Math.hypot(car.x - B.x, car.z - B.z), along = (car.x - B.x) * B.tx + (car.z - B.z) * B.tz, side = along >= 0 ? 1 : -1;
    if (d < 280 && !B.warned && !B.cleared){ B.warned = true; toast(B.name + ' · ' + B.line.jp, 'BORDER CONTROL AHEAD · STOP AT THE BARRIER AND SHOW YOUR LICENCE', '#7fa8ff'); }
    if (d < 30 && Math.abs(car.y - B.y) < 5){
      if (B.side && side !== B.side && !B.cleared){ // straight through the barrier
        B.cleared = true; H.bolo = STATE.paint; STATE.stars = Math.min(5, Math.max(STATE.stars + 1, 3)); saveState(); sfx.crash(4); cam.shake += 0.05;
        policeKnow(B.x, B.z, 'YOU RAN THE ' + B.name);
      }
      B.side = side;
      if (d < 16 && v < 2.5 && !B.cleared && !idOpen) borderCheck(B);
    } else B.side = 0;
  }
  // a border post that let you through runs your licence a little later
  if (H.ping){ H.ping.t -= dt; if (H.ping.t <= 0){ const P = H.ping; H.ping = null; H.bolo = STATE.paint; H.flags = (H.flags || 0) + 1; STATE.stars = Math.min(5, STATE.stars + 0.5); saveState();
    popup('THE ' + P.name + ' RAN YOUR LICENCE', 0, 'bad'); popup('THEY KNOW YOUR CAR IS ' + PAINTS[STATE.paint].name.toUpperCase() + ' NOW', 0, 'bad'); policeKnow(P.x, P.z, P.name + ' FLAGGED YOUR ID'); } }
  const el = $('job'); if (el){ const t = H.stage === 1 ? 'THE JOB · STEAL THE CRATE AT THE RAIL YARD' : H.stage === 2 ? 'THE JOB · CRATE TO THE CHOP SHOP · POLICE WANT A ' + PAINTS[H.bolo].name.toUpperCase() + ' CAR' + (STATE.paint === H.bolo ? ' (YOURS!)' : '') + ' · I = LICENCE' : ''; if (el.textContent !== t){ el.textContent = t; el.hidden = !t; } el.classList.toggle('hot', heistBolo()); }
}
function borderCheck(B){
  const H = HS(); car.vx = car.vy = 0; HEIST.check = B; sfx.beep(700);
  showId(B.name + ' · ' + B.line.jp, 'LICENCE, PLEASE', 'An officer in a reflective jacket taps on your window. "Evening. Licence, please. Where are you headed?"', [['HAND OVER YOUR LICENCE', () => {
    if (STATE.paint === H.bolo){
      showId(B.name, 'THAT\'S THE CAR', 'He glances at your licence, then at your car, then at the alert on the booth screen. His hand goes to his radio. "Step out of the vehicle. Now."', [['FLOOR IT', () => { HEIST.check = null; closeId(); B.cleared = true; STATE.stars = Math.max(STATE.stars, 4); saveState(); policeKnow(car.x, car.z, 'THE ' + B.name + ' RECOGNISED YOUR CAR'); }]]);
    } else {
      showId(B.name, 'DRIVE SAFE, MR ' + H.id.name.split(' ')[0], 'He scans the licence and hands it back. "Drive safe." The barrier lifts. Behind you, he picks up the phone and reads your number to somebody.', [['DRIVE ON', () => { HEIST.check = null; closeId(); B.cleared = true; H.ping = { t: 25, x: B.x, z: B.z, name: B.name }; }]]);
    }
  }]]);
}
// busted with the crate: they take it back to the yard
function heistBusted(){ const H = HS(); if (H.stage !== 2) return; H.stage = 1; H.ping = null; if (HEIST.target) heistRoute(HEIST.target, 'THE JOB · RAIL YARD'); popup('THE POLICE TOOK THE CRATE BACK TO THE RAIL YARD', 0, 'bad'); }
// ---------- on the maps: border posts, the job's next stop, and where the police last placed you
function heistMarks(g, toXY, big, sc){
  const H = HS(), fl = (performance.now() / 300 | 0) % 2;
  if (!big || sc > 0.02) for (const B of BORDERS){ const [px, py] = toXY(B.x, B.z); if (px < -20 || py < -20 || px > 2000 || py > 2000) continue;
    const k = big ? 1 : 0.8; g.fillStyle = '#ffffff'; g.fillRect(px - 6 * k, py - 2.5 * k, 12 * k, 5 * k); g.fillStyle = '#d8202c'; g.fillRect(px - 6 * k, py - 2.5 * k, 4 * k, 5 * k); g.fillRect(px + 2 * k, py - 2.5 * k, 4 * k, 5 * k);
    if (big && sc > 0.06){ g.fillStyle = '#ffd0d6'; g.font = '700 10px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText(B.line.jp + ' ' + B.name, px + 9, py + 3); } }
  const P = H.stage === 1 ? HEIST.target : H.stage === 2 ? HEIST.drop : null;
  if (P){ const [px, py] = toXY(P.x, P.z), r = (big ? 8 : 5) + (big ? 2 : 1) * Math.sin(performance.now() / 250); g.strokeStyle = '#ffb04a'; g.lineWidth = big ? 2.5 : 2; g.beginPath(); g.arc(px, py, r, 0, TAU); g.stroke();
    if (big){ g.fillStyle = '#ffb04a'; g.font = '800 12px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText('仕事 ' + P.name, px + 12, py + 4); } }
  if (KNOWN.t > 0){ const [px, py] = toXY(KNOWN.x, KNOWN.z); g.strokeStyle = fl ? '#ff2a2a' : '#2f6bff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(px, py, big ? 22 : 12, 0, TAU); g.stroke(); g.setLineDash([]);
    if (big){ g.fillStyle = '#ff8a96'; g.font = '800 11px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText('POLICE: LAST KNOWN', px + 26, py + 4); } }
}
