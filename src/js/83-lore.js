// =====================================================================================================
// THE STORY. Somewhere at the end of a forgotten road lives the Lore Keeper. Rumours in the towns point the way.
// He hands out the story a chapter at a time; each chapter sends you to places where it happened. Some places only
// speak in the rain, at night, or to drivers with the police on their tail; some start a run against the clock.
// =====================================================================================================
const LS = () => (STATE.lore && typeof STATE.lore === 'object') ? STATE.lore : (STATE.lore = { found: false, ch: 0, done: [], complete: false, best: null });
const landmarkAt = name => { const L = LANDMARKS.find(l => l.name === name && l.node); return L ? { x: L.node.x, z: L.node.z, y: L.node.y } : null; };
const villageAt = name => { const v = VILLAGES.find(q => q.name === name); return v ? { x: v.x, z: v.z, y: v.node.y } : null; };
const cityAt = id => { const c = CITY[id]; return c ? { x: c.center.x, z: c.center.z, y: c.center.y } : null; };
// the story, chapter by chapter. Each spot: where it is, what it needs, what it tells you
const LORE = [
  { title: 'THE LONG RUN', keeper: [
      'So the road brought you here. Most drivers never find the end of this one.',
      'I keep the stories nobody tells any more. There\'s one I\'ve been waiting a long time to pass on. They called it THE LONG RUN: two drivers, one night, Hokuto to Hakone, no stopping. Only one of them ever came back down the mountain.',
      'Go and see where it began. I\'ve marked the places on your map.'],
    spots: [
      { id: 'shrine', at: () => landmarkAt('GREAT SHRINE'), name: 'THE GREAT SHRINE', cond: 'visit',
        page: ['Among the prayer plaques hangs one board, black with age: "KAGE & AKARI. LET THE ROAD DECIDE."', 'Someone has tied a red ribbon to it.', 'The ribbon is new.'] },
      { id: 'circuit', at: () => landmarkAt('MORI RACE CIRCUIT'), name: 'MORI RACE CIRCUIT', cond: 'visit',
        page: ['Scratched into the pit wall: two lap times, a hundredth of a second apart.', 'Underneath, in a different hand: "NOT ON A TRACK. ON THE REAL ROAD. TONIGHT."', 'Next to it, a date. Twenty years ago.'] } ] },
  { title: 'LIGHT', keeper: [
      'Kage and Akari. Shadow and light. The best this land ever had, and they could never settle who was faster.',
      'So they agreed on the Long Run, and that night every police car in the country was out looking for them.',
      'Akari kept a notebook. Some of its pages are still out there, if you know when to look.'],
    spots: [
      { id: 'light', at: () => landmarkAt('LIGHTHOUSE'), name: 'THE LIGHTHOUSE', cond: 'rain', hint: 'The door is locked tight. The keeper said the lighthouse only talks in the rain. (Rain comes and goes on its own: come back when it is pouring.)',
        page: ['In the rain the keeper\'s door swings open. Inside, a page in small neat writing:', '"If I lose him in the hills I\'ll take the coast road. The beam will bring me home."', 'The page is dry. Someone put it here recently.'] },
      { id: 'obs', at: () => landmarkAt('MOUNTAIN OBSERVATORY'), name: 'THE OBSERVATORY', cond: 'night', hint: 'The dome is shut. Astronomers only work in the dead of night, between 22:00 and 04:00.',
        page: ['The night log, open on the desk at the same night twenty years ago:', '"02:14. Two sets of headlights on the mountain road. One stops at the summit. The other turns back."', 'Turns back?'] } ] },
  { title: 'THE CHASE THAT NEVER ENDED', keeper: [
      'Turned back? That isn\'t how I tell it.',
      'In my story Akari went off the road above the dam, and Kage drove on alone into the dark and was never seen again. That\'s what everyone believes.',
      'You don\'t look like you believe it. Go and find out.'],
    spots: [
      { id: 'fort', at: () => landmarkAt('OLD COASTAL FORT'), name: 'THE OLD COASTAL FORT', cond: 'run', run: { to: 'nagisa', pace: 36, pad: 25, title: 'BEFORE THE SIRENS' },
        page: ['Chalk on the old wall: "NAGISA BEFORE THE SIRENS."', 'Somewhere a police scanner crackles: they know you\'re here.', 'Get to Nagisa. Fast.'],
        after: ['You made it before the sirens.', 'In the harbour office the night ledger from twenty years ago is still on the shelf: one car loaded onto the 03:40 ferry, paid in cash.', 'The name in the ledger is AKARI.'] },
      { id: 'dam', at: () => landmarkAt('KUROBE DAM'), name: 'KUROBE DAM', cond: 'wanted', hint: 'The gate stays shut. They say it only opens for drivers who are being hunted. (Come back with at least one wanted star.)',
        page: ['With the sirens behind you the old gate swings wide.', 'On the parapet lies a single headlight lens, cracked. The barrier behind it has never been touched.', 'Nobody went over the edge here. Nobody ever did.'] } ] },
  { title: 'STATIC', keeper: [
      'No crash. A ferry before dawn. So Akari ran, not from Kage, but from the police.',
      'And the story I\'ve told for twenty years is wrong.',
      'There\'s an old radio mast in the hills above the coast. It still picks up things it shouldn\'t.'],
    spots: [
      { id: 'radio', at: () => landmarkAt('RADIO MAST'), name: 'THE RADIO MAST', cond: 'visit',
        page: ['Static. Then a voice, recorded, playing on a loop:', '"This is Akari. If you\'re hearing this, the Long Run isn\'t over. I\'m somewhere high, where the snow comes early. Tell the shadow I\'m still waiting at the finish."'] },
      { id: 'tengu', at: () => villageAt('TENGU'), name: 'TENGU', cond: 'visit',
        page: ['The old man in the Tengu garage looks at you for a long time.', '"The radio? I recorded that the winter I came back." He takes off his cap: a burn scar, and an old racing number stitched inside.', '"I\'m Akari. I didn\'t win and I didn\'t lose. I just stopped. Ask that storyteller of yours why he never came to the finish."'] } ] },
  { title: 'THE LONG RUN, AGAIN', keeper: [
      'So the old fool is alive.',
      'I know why I never came to the finish. Because I\'m the one who turned back. They called me Kage. I went back down the mountain looking for a wreck that was never there, and I\'ve told the wrong story ever since because the right one hurt more.',
      'There\'s one thing left. The Long Run was never finished. Start at Hokuto. End in Hakone. Beat the time we would have set.'],
    spots: [
      { id: 'longrun', at: () => cityAt('hokuto'), name: 'THE START LINE · HOKUTO', cond: 'run', run: { to: 'hakone', pace: 43, pad: 30, title: 'THE LONG RUN', record: true },
        page: ['The start line is a crack in the road outside the Hokuto grain silos. Twenty years of rain haven\'t washed out the chalk.', 'Hokuto to Hakone. No stopping.', 'GO.'],
        after: ['Hakone, under the time.', 'Somewhere up on the mountain, a garage light flicks on.'] } ] },
  { title: 'THE FINISH', keeper: ['The hut is empty. A note is pinned to the door:', '"Gone up the mountain. There\'s someone I owe a race. - K"'],
    spots: [
      { id: 'finish', at: () => villageAt('TENGU'), name: 'TENGU', cond: 'visit', final: true,
        page: ['Two old men are standing outside the Tengu garage when you pull in, arguing about lap times as if it were twenty years ago.', 'Kage presses a set of keys into your hand. Akari tosses you a roll of cash.', '"The Long Run is yours now," says Kage. "Try not to turn back."'] } ] },
];
// where every spot is (worked out once the world is built), and the little markers that glow when a chapter needs them
const LORE_SPOTS = [];
let KEEPER_SPOT = null;
function buildLore(){
  for (const [ci, ch] of LORE.entries()) for (const sp of ch.spots){ const p = sp.at(); if (!p) continue; LORE_SPOTS.push(Object.assign({ ch: ci + 1 }, sp, p)); }
  if (LORE_KEEPER){ const e = LORE_KEEPER.node.links[0], F = endFrame(e, LORE_KEEPER.node), b = new Builder();
    const at = (a, w) => { const [x, z] = F.P(a, w); return [x, shownGround(x, z), z]; };
    { const [x, y, z] = at(20, 0); bld(b, x, y - 2, z, F.h, 7, 6, 4.5, y, 4, 'tile', mulberry(77), { lanterns: -1 }); }
    for (const w of [-6, 6]){ const [x, y, z] = at(10, w); b.add(new THREE.BoxGeometry(0.7, 1.8, 0.7), STONE, x, y + 0.9, z); b.add(new THREE.BoxGeometry(0.5, 0.5, 0.5), MAT.lantern, x, y + 2.1, z); }
    const t = textTex(1024, 256, (g, w, h) => { g.fillStyle = '#1a1010'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c48aff'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#e8d6ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 100px ' + JP; g.fillText('語り部', w / 2, h * 0.38); g.font = '700 50px ' + JP; g.fillText('THE LORE KEEPER', w / 2, h * 0.78); });
    { const [x, y, z] = at(9, -11); b.add(new THREE.BoxGeometry(0.2, 3, 0.2), MAT.wood, x, y + 1.5, z); b.add(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }), x, y + 3.3, z, F.h + Math.PI); }
    b.flush(); const [lx, ly, lz] = at(14, 0); const l = new THREE.PointLight(0xc48aff, 1.8, 40, 2); l.position.set(lx, ly + 3, lz); scene.add(l);
    KEEPER_SPOT = { x: F.x, z: F.z, y: F.y }; }
  // a tall violet lantern at every story spot, lit only while its chapter is open
  for (const sp of LORE_SPOTS){ const grp = new THREE.Group(); grp.position.set(sp.x, shownGround(sp.x, sp.z), sp.z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 8), STONE); m.position.y = 2; grp.add(m);
    const g2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xc48aff })); g2.position.y = 4.6; grp.add(g2);
    const l = new THREE.PointLight(0xc48aff, 2, 30, 2); l.position.y = 5; grp.add(l); grp.visible = false; scene.add(grp); sp.grp = grp; }
}
// which spots the current chapter still needs
const activeSpots = () => { const L = LS(); if (!L.found || L.complete) return []; return LORE_SPOTS.filter(sp => sp.ch === L.ch && !L.done.includes(sp.id)); };
const chapterDone = () => { const L = LS(); return L.ch >= 1 && LORE_SPOTS.filter(sp => sp.ch === L.ch).every(sp => L.done.includes(sp.id)); };
function loreObjective(){
  const L = LS(); if (L.complete) return 'THE STORY IS COMPLETE';
  if (!L.found) return 'FIND THE LORE KEEPER. THE TOWNS HAVE HEARD RUMOURS';
  if (L.ch === 0 || chapterDone()) return 'RETURN TO THE LORE KEEPER';
  return 'CHAPTER ' + L.ch + ' · ' + LORE[L.ch - 1].title + ' · ' + activeSpots().map(s => s.name).join(', ');
}
// the rumour a town has heard: where the keeper lives, from somewhere it knows
function loreRumour(town){
  if (!KEEPER_SPOT || LS().found) return '';
  const refs = [...CITIES.map(c => ({ name: c.name, x: c.x, z: c.z })), ...TOWNS.map(t => ({ name: t.name, x: t.x, z: t.z })), ...LANDMARKS.filter(l => l.node).map(l => ({ name: 'THE ' + l.name, x: l.node.x, z: l.node.z }))];
  const R = mulberry(town.name.length * 131 + Math.round(town.x)), near = refs.map(r => [r, Math.hypot(r.x - KEEPER_SPOT.x, r.z - KEEPER_SPOT.z)]).filter(q => q[1] > 400).sort((a, b) => a[1] - b[1]).slice(0, 6), [ref, d] = near[Math.floor(R() * near.length)];
  const km = Math.max(1, Math.round(d / 1000)), dir = compassXZ(KEEPER_SPOT.x - ref.x, KEEPER_SPOT.z - ref.z);
  return `"Old drivers say somebody keeps all the stories, in a little house where a road just stops. About ${km} km ${dir} of ${ref.name}, if you believe them."`;
}
// ---------- the story box: one page at a time, the game paused while you read
let loreQueue = [], loreAfter = null;
function showLore(title, lines, after){
  loreQueue = lines.slice(); loreAfter = after || null; const el = $('lore'); el.hidden = false; paused = true; $('loreTitle').textContent = title; loreNext();
}
function loreNext(){
  if (!loreQueue.length){ $('lore').hidden = true; paused = false; last = performance.now(); const f = loreAfter; loreAfter = null; if (f) f(); return; }
  $('loreText').textContent = loreQueue.shift(); $('loreBtn').textContent = loreQueue.length ? 'NEXT' : 'CONTINUE';
}
$('loreBtn').addEventListener('click', loreNext);
addEventListener('keydown', e => { if (!$('lore').hidden && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); loreNext(); } }, true);
// ---------- runs against the clock
const RUN = { on: false, t: 0, limit: 0, to: null, sp: null };
function startRun(sp){
  const c = CITY[sp.run.to], n0 = endNode(car.lastE, car.lastDir || 1), D = distTo(c.center)[n0.id] + 300;
  RUN.on = true; RUN.t = 0; RUN.limit = Math.round(D / sp.run.pace + sp.run.pad); RUN.to = c; RUN.sp = sp;
  if (sp.run.record && LS().best) RUN.limit = Math.min(RUN.limit, LS().best);
  STATE.dest = { type: 'city', id: c.id }; gps.t = 0; toast(sp.run.title, 'REACH ' + c.name + ' IN ' + fmtT(RUN.limit), '#c48aff'); sfx.beep(1700);
}
const fmtT = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function updateRun(dt){
  const el = $('loreRun'); if (!RUN.on){ el.hidden = true; return; }
  RUN.t += dt; el.hidden = false; el.innerHTML = '<b>' + RUN.sp.run.title + '</b> ' + fmtT(RUN.t) + ' <span>/ ' + fmtT(RUN.limit) + '</span>';
  el.classList.toggle('late', RUN.t > RUN.limit * 0.85);
  if (inCity(car.x, car.z, 0) === RUN.to){
    const sp = RUN.sp; RUN.on = false; el.hidden = true;
    if (RUN.t <= RUN.limit){ LS().done.push(sp.id); if (sp.run.record) LS().best = Math.round(RUN.t); saveState(); showLore(sp.name, ['TIME ' + fmtT(RUN.t) + ' · BEATEN BY ' + fmtT(RUN.limit - RUN.t), ...sp.after]); }
    else { toast('TOO SLOW', fmtT(RUN.t) + ' · THE TIME TO BEAT WAS ' + fmtT(RUN.limit) + ' · GO BACK TO THE START TO TRY AGAIN', '#ff4058'); }
  }
  if (RUN.t > RUN.limit + 120){ RUN.on = false; el.hidden = true; toast('THE RUN IS OVER', 'GO BACK TO THE START TO TRY AGAIN', '#ff4058'); }
}
// ---------- each frame: the keeper, the spots
let loreHintT = 0;
function updateLore(dt){
  updateRun(dt); loreHintT = Math.max(0, loreHintT - dt);
  const L = LS(), v = Math.hypot(car.vx, car.vy), act = activeSpots();
  for (const sp of LORE_SPOTS) if (sp.grp) sp.grp.visible = act.includes(sp) && Math.abs(car.x - sp.x) < 900 && Math.abs(car.z - sp.z) < 900;
  // the keeper's hut
  if (KEEPER_SPOT && Math.hypot(car.x - KEEPER_SPOT.x, car.z - KEEPER_SPOT.z) < 34 && v < 4 && !RUN.on){
    if (!L.found){ L.found = true; L.ch = 1; saveState(); showLore('THE LORE KEEPER · 語り部', LORE[0].keeper, () => toast('CHAPTER 1 · ' + LORE[0].title, 'THE STORY PLACES ARE ON YOUR MAP (M)', '#c48aff')); return; }
    if (!L.complete && chapterDone() && L.ch < LORE.length){ L.ch++; saveState(); const C = LORE[L.ch - 1]; showLore('THE LORE KEEPER · CHAPTER ' + L.ch, C.keeper, () => toast('CHAPTER ' + L.ch + ' · ' + C.title, 'THE STORY PLACES ARE ON YOUR MAP (M)', '#c48aff')); return; }
  }
  // a story place
  for (const sp of act){
    const d = Math.hypot(car.x - sp.x, car.z - sp.z); if (d > 34 || v > 4) continue;
    if (sp.cond === 'run'){ if (!RUN.on){ showLore(sp.name, sp.page, () => startRun(sp)); } return; }
    const ok = sp.cond === 'visit' || (sp.cond === 'rain' && weather.rain > 0.25) || (sp.cond === 'night' && (DAY.t >= 22 || DAY.t < 4)) || (sp.cond === 'wanted' && STATE.stars >= 1);
    if (!ok){ if (!(sp.hintT > simT)){ sp.hintT = simT + 8; toast(sp.name, sp.hint || 'NOTHING HERE. NOT YET', '#c48aff'); } return; }
    L.done.push(sp.id); saveState(); sfx.beep(1500);
    if (sp.final){ showLore(sp.name, sp.page, finishStory); return; }
    showLore(sp.name, sp.page, () => { STATE.cash += 3000 * sp.ch; popup('+$' + (3000 * sp.ch).toLocaleString(), 0, 'near'); if (chapterDone()) toast('CHAPTER ' + L.ch + ' COMPLETE', 'RETURN TO THE LORE KEEPER', '#c48aff'); saveState(); });
    return;
  }
}
function finishStory(){
  const L = LS(); L.complete = true; STATE.cash += 50000; grantReward('paint:KAGE BLACK'); grantReward('glow:AKARI'); saveState();
  showLore('THE LONG RUN · COMPLETE', ['You found the Lore Keeper, followed the story to the end, and finished the Long Run twenty years late.', 'REWARDS: $50,000 · KAGE BLACK paint · AKARI underglow.', 'Thank you for playing NIGHT DRIVER. The roads are still out there, and so are the secrets you haven\'t found yet.']);
}
// a GPS route to a story place
function routeToLore(sp){ const q = nearestRoadPoint(sp.x, sp.z); STATE.dest = { type: 'pt', x: sp.x, z: sp.z, eId: q.e.id, s: q.s, label: sp.name }; gps.t = 0; saveState(); }
