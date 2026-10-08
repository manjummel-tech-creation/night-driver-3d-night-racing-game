// =====================================================================================================
// THE SECRET MAP QUEST, SECRET PLACES AND THEIR REWARDS (paints, underglow, rims, a GT wing, level 4 parts, cash)
// Tengu's old man gives you a riddle; each clue spot gives the next riddle; the third gives the secret map,
// which marks the secret places on the big map. Secrets can be found without the map too, if you're patient.
// =====================================================================================================
for (const k of ['found', 'unlocked', 'eggs', 'mods']) if (!Array.isArray(STATE[k])) STATE[k] = [];
for (const i of STATE.found){ const r = SECRETS[i] && SECRETS[i].reward; if (r && r.startsWith('mod:') && !STATE.mods.includes(r.slice(4))) STATE.mods.push(r.slice(4)); } // places found before they held these upgrades
applyUpgrades();
STATE.quest = STATE.quest || 0; STATE.secretMap = !!STATE.secretMap;
let QUEST_RIDDLES = null;
const riddleText = i => (QUEST_RIDDLES || (QUEST_RIDDLES = QUEST_TEXT()))[i] || '';
function questBlock(c){
  if (!c.info.special.includes('quest')) return '';
  let h = '<div class="quest"><div class="nm">THE OLD MAN</div>';
  if (STATE.quest === 0){ STATE.quest = 1; saveState(); }
  if (STATE.quest === 1) h += '<p>"A map? There is one. I hid the pieces of the trail myself, a long time ago. Three places, each one points to the next. The last one has the map. It shows you what nobody else can see."</p>';
  if (STATE.quest >= 1 && STATE.quest <= 3) h += `<p>"Riddle ${STATE.quest} of 3:"</p><p class="riddle">${riddleText(STATE.quest - 1)}</p><p class="dim">The riddle stays on your big map (M). Stop at the very end of the road to read what's there.</p>`;
  if (STATE.quest >= 4) h += `<p>"You found it. Good. Now go and see." · SECRETS FOUND ${STATE.found.length} / ${SECRETS.length}</p>`;
  return h + '</div>';
}
// rewards
function grantReward(r){
  const [type, val] = r.split(':');
  if (type === 'paint'){ if (!STATE.unlocked.includes(r)) STATE.unlocked.push(r); const k = PAINTS.findIndex(p => p.secret === r); if (k >= 0){ STATE.paint = k; renderPaints(); setPaint(k); } }
  if (type === 'glow'){ if (!STATE.unlocked.includes(r)) STATE.unlocked.push(r); STATE.glow = val; }
  if (type === 'rims'){ if (!STATE.unlocked.includes(r)) STATE.unlocked.push(r); STATE.rims = val; }
  if (type === 'wing'){ if (!STATE.unlocked.includes(r)) STATE.unlocked.push(r); STATE.wing = true; }
  if (type === 'part'){ const id = val.replace(/\d$/, ''); STATE.up[id] = Math.max(STATE.up[id] || 0, 4); applyUpgrades(); }
  if (type === 'cash'){ STATE.cash += +val; }
  if (type === 'mod'){ if (!STATE.mods.includes(val)) STATE.mods.push(val); applyUpgrades(); }
  if (type === 'fox'){ if (!STATE.unlocked.includes(r)) STATE.unlocked.push(r); STATE.fox = true; }
  applyCosmetics(); renderCosmetics(); saveState();
}
// ---------- cosmetics on your car only
const COSM = (() => {
  const glowTex = canvasTex(128, 128, g => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x3dd8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.4).rotateX(-Math.PI / 2), glowMat); glowPlane.position.y = 0.04; glowPlane.visible = false; player.add(glowPlane);
  const glowLight = new THREE.PointLight(0x3dd8ff, 0, 7, 2); glowLight.position.set(0, 0.2, 0); player.add(glowLight);
  const wing = new THREE.Group(); wing.visible = false; pBody.add(wing);
  { const plate = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.05, 0.42), CARBON); plate.position.set(0, 1.62, -2.0); plate.rotation.x = -0.12; wing.add(plate);
    for (const x of [-1, 1]){ const up = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.22), CARBON); up.position.set(x * 0.55, 1.32, -2.0); wing.add(up); const end = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.56), CARBON); end.position.set(x * 1.03, 1.62, -2.0); wing.add(end); } }
  // the player's own wheel meshes (traffic cars were cloned before this, so they keep their rims)
  const rimMeshes = [], spokeMeshes = [];
  for (const w of pWheels){ const ch = w.spin.children; rimMeshes.push(ch[1]); for (let k = 2; k < ch.length; k++) spokeMeshes.push(ch[k]); }
  const orig = { rim: rimMeshes[0].material, spoke: spokeMeshes[0].material };
  const RIMS = { GOLD: [new THREE.MeshStandardMaterial({ color: 0x8a6414, metalness: 1, roughness: 0.25 }), new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.18 })],
    NEON: [new THREE.MeshStandardMaterial({ color: 0x0a1a20, metalness: 0.6, roughness: 0.4 }), new THREE.MeshBasicMaterial({ color: 0x3dffd0 })] };
  return { glowMat, glowPlane, glowLight, wing, rimMeshes, spokeMeshes, orig, RIMS };
})();
const GLOW_COLS = { CYAN: 0x3dd8ff, MAGENTA: 0xff3dd2, AKARI: 0xffa040 };
function applyCosmetics(){
  const g = STATE.glow && GLOW_COLS[STATE.glow];
  COSM.glowPlane.visible = !!g; COSM.glowLight.intensity = g ? 1.6 : 0; if (g){ COSM.glowMat.color.setHex(g); COSM.glowLight.color.setHex(g); }
  COSM.wing.visible = !!STATE.wing || (STATE.mods || []).includes('AERO');
  const rm = STATE.rims && COSM.RIMS[STATE.rims];
  for (const m of COSM.rimMeshes) m.material = rm ? rm[0] : COSM.orig.rim;
  for (const m of COSM.spokeMeshes) m.material = rm ? rm[1] : COSM.orig.spoke;
}
// the garage line in the menu: switch what you've unlocked on and off
function renderCosmetics(){
  const el = $('cosm'); if (!el) return;
  const have = STATE.unlocked.filter(r => !r.startsWith('paint:'));
  if (!have.length){ el.innerHTML = '<span class="dim">Secret places hide paints, underglow, rims, a wing and something stranger</span>'; return; }
  el.innerHTML = have.map(r => { const [t, v] = r.split(':'), on = t === 'glow' ? STATE.glow === v : t === 'rims' ? STATE.rims === v : t === 'fox' ? !!STATE.fox : !!STATE.wing; return `<button type="button" class="chip${on ? ' on' : ''}" data-cos="${r}">${REWARD_TEXT[r] || r}</button>`; }).join('');
  el.querySelectorAll('[data-cos]').forEach(b => b.addEventListener('click', () => { const [t, v] = b.dataset.cos.split(':');
    if (t === 'glow') STATE.glow = STATE.glow === v ? null : v; if (t === 'rims') STATE.rims = STATE.rims === v ? null : v; if (t === 'wing') STATE.wing = !STATE.wing; if (t === 'fox') STATE.fox = !STATE.fox;
    applyCosmetics(); renderCosmetics(); saveState(); }));
}
applyCosmetics();
// KITSUNE-BI: nine blue fox-fires circle your car, a trail of ghost fire streams behind you at speed and the pipes burn blue
const FOX = (() => {
  const tex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(160,230,255,0.85)'); gr.addColorStop(1, 'rgba(60,140,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const mk = (col, op) => new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const orbM = mk(0x8fdcff, 0.95), orbs = [], trail = [];
  for (let i = 0; i < 9; i++){ const s = new THREE.Sprite(orbM); s.scale.setScalar(0.75); s.visible = false; scene.add(s); orbs.push(s); }
  for (let i = 0; i < 70; i++){ const s = new THREE.Sprite(mk(0x4aa8ff, 0)); s.visible = false; scene.add(s); trail.push({ s, life: 0 }); }
  return { orbs, trail, i: 0, t: 0, emit: 0 };
})();
function updateFox(dt){
  const on = !!STATE.fox && started; FOX.t += dt;
  FOX.orbs.forEach((s, i) => { s.visible = on; if (!on) return; const a = FOX.t * 1.5 + i / 9 * TAU, r = 2.9 + Math.sin(FOX.t * 2 + i) * 0.25;
    s.position.set(car.x + Math.cos(a) * r, car.y + 1.0 + Math.sin(FOX.t * 3 + i * 1.7) * 0.35, car.z + Math.sin(a) * r); s.scale.setScalar(0.62 + 0.18 * Math.sin(FOX.t * 9 + i * 2.3)); });
  const v = Math.hypot(car.vx, car.vy);
  if (on && v > 8){ FOX.emit += dt * Math.min(60, v * 1.1); while (FOX.emit >= 1){ FOX.emit--; const p = FOX.trail[FOX.i = (FOX.i + 1) % FOX.trail.length], side = (FOX.i & 1) ? 1 : -1;
      p.life = 1; p.s.visible = true; p.s.position.set(car.x - Math.sin(car.h) * 2.3 + Math.cos(car.h) * side * 0.7 + (rnd() - 0.5) * 0.3, car.y + 0.45 + rnd() * 0.3, car.z - Math.cos(car.h) * 2.3 - Math.sin(car.h) * side * 0.7 + (rnd() - 0.5) * 0.3); } }
  for (const p of FOX.trail){ if (p.life <= 0) continue; p.life -= dt * 1.4; if (p.life <= 0){ p.s.visible = false; continue; } p.s.material.opacity = p.life * 0.8; p.s.scale.setScalar(0.5 + (1 - p.life) * 1.3); p.s.position.y += dt * 0.8; }
  if (on && flameT <= 0.01 && !car.nosOn){ flameT = 0.04; FLAME_MAT.color.setHex(0x5ab8ff); } // blue fire from the pipes
}
// the first clue is always pinned on the map (and set as the GPS route on a fresh game) so you know where the trail starts
let CLUE1_TOLD = false;
if (STATE.quest <= 1 && !STATE.cluePin && CLUES[0]){ const C = CLUES[0], q = nearestRoadPoint(C.x, C.z); STATE.cluePin = 1; if (q && !STATE.dest) STATE.dest = { type: 'pt', x: C.x, z: C.z, eId: q.e.id, s: q.s, label: 'CLUE 1 · THE END OF THE TRACK' }; }
// ---------- finding things: stop at the end of the right dead end
function updateSecrets(dt, t){
  if (!CLUE1_TOLD && STATE.quest <= 1 && t > 4){ CLUE1_TOLD = true; toast('CLUE 1 IS ON YOUR MAP', 'THE PURPLE PIN · PRESS M · FOLLOW THE GPS', '#c48aff'); }
  const v = Math.hypot(car.vx, car.vy);
  for (const P of SECRET_SPOTS){
    const d = Math.hypot(P.x - car.x, P.z - car.z);
    if (P.kind === 'clue'){
      const live = Math.max(1, STATE.quest) === P.i + 1; P.grp.visible = d < 700 && live; if (!live) continue;
      if (P.light) P.light.intensity = 1.6 + 0.6 * Math.sin(t * 3);
      if (d < 80 && !P.near){ P.near = true; toast('THE RIDDLE\'S PLACE', 'THIS IS IT · STOP AT THE GLOWING LANTERN WHERE THE ROAD ENDS', '#c48aff'); } else if (d > 160) P.near = false;
      if (d < 28 && v < 5 && Math.abs(car.y - P.y) < 6){
        STATE.quest = Math.max(1, STATE.quest) + 1; sfx.beep(1800);
        if (STATE.quest >= 4){ STATE.secretMap = true; toast('THE SECRET MAP', 'EVERY SECRET PLACE IS NOW ON YOUR BIG MAP (M)', '#c48aff'); }
        else toast('CLUE ' + (P.i + 1) + ' OF 3', 'A NEW RIDDLE · READ IT ON THE BIG MAP (M)', '#c48aff');
        saveState();
      }
      continue;
    }
    const found = STATE.found.includes(P.i); P.grp.visible = d < 170;
    if (!found && d < 20 && v < 5 && Math.abs(car.y - P.y) < 6){
      const S = SECRETS[P.i]; STATE.found.push(P.i); grantReward(S.reward); sfx.beep(2000);
      toast('SECRET · ' + S.name, (REWARD_TEXT[S.reward] || S.reward) + ' · ' + STATE.found.length + ' OF ' + SECRETS.length + ' FOUND', '#c48aff');
    }
  }
  for (const b of LIGHTHOUSE_BEAMS) b.rotation.y += dt * 0.9;
  // reaching a town: a checkpoint
  for (const T2 of TOWNS){ if (Math.abs(car.x - T2.x) > 300 || Math.abs(car.z - T2.z) > 300) continue;
    if (Math.hypot(car.x - T2.x, car.z - T2.z) < 250 && STATE.checkpoint !== T2.id){ STATE.checkpoint = T2.id; toast('CHECKPOINT · ' + T2.name, 'CRASH OUT, GET BUSTED OR RUN DRY AND YOU\'RE TOWED TO THE NEAREST CHECKPOINT', '#7fe3ff'); saveState(); } }
  // easter eggs: pull over beside one
  for (const E of EGGS){ if (STATE.eggs.includes(E.name)) continue; if (Math.abs(car.x - E.x) > E.reach || Math.abs(car.z - E.z) > E.reach) continue;
    if (Math.hypot(car.x - E.x, car.z - E.z) < E.reach && v < 4){ STATE.eggs.push(E.name); STATE.cash += 2500; sfx.beep(1600); toast('EASTER EGG · ' + E.name, '+$2,500 · ' + STATE.eggs.length + ' OF ' + EGGS.length + ' FOUND', '#ffd23d'); saveState(); } }
}
