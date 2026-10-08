// =====================================================================================================
// THE SEA OF TREES (樹海): trailhead signs, stone lanterns that quietly point the way to the heart, fireflies, strange
// things at the dead ends and the great cedar at the heart. Inside, the GPS loses its signal and the trails only
// appear on your map once you've driven them.
// =====================================================================================================
STATE.jukai = (STATE.jukai && typeof STATE.jukai === 'object') ? STATE.jukai : { seen: [], found: [], heart: false };
const JSEEN = new Set(STATE.jukai.seen);
const JFINDS = [];
const JFIND_KINDS = [['car', 'THE ABANDONED CAR'], ['hut', 'THE HERMIT\'S HUT'], ['train', 'THE LOST LOGGING TRAIN'], ['jizo', 'THE WATCHERS']];
const jHidden = e => e.jukai && !JSEEN.has(e.id);
const inJukai = () => jukaiK(car.x, car.z) > 0.62 && !(car.sup && car.sup.e && !car.sup.e.jukai && car.sup.e.cls !== 'dt' && jukaiK(car.x, car.z) < 0.8);
function buildJukai(){
  const b = new Builder(), stoneM = LM(0x5d5a52), mossM = LM(0x2c3d22), glowM = new THREE.MeshBasicMaterial({ color: 0xffb860 }), barkM = LM(0x3a2618), redM = LM(0xa8261c), whiteM = LM(0xe8e6dc);
  const lantern = (x, z, s = 1) => { const y = shownGround(x, z); b.add(new THREE.BoxGeometry(0.5 * s, 0.9 * s, 0.5 * s), stoneM, x, y + 0.45 * s, z); b.add(new THREE.BoxGeometry(0.42 * s, 0.32 * s, 0.42 * s), glowM, x, y + 1.06 * s, z); b.add(new THREE.ConeGeometry(0.55 * s, 0.4 * s, 4), stoneM, x, y + 1.42 * s, z, Math.PI / 4); };
  // trailhead signs: a weathered board where each trail leaves the ordinary road
  const sign = textTex(1024, 384, (g, w, h) => { g.fillStyle = '#2a1e14'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6b5236'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24); g.fillStyle = '#e8dcc0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 120px ' + JP; g.fillText('樹 海', w / 2, h * 0.3); g.font = '800 52px ' + JP; g.fillText('THE SEA OF TREES', w / 2, h * 0.6); g.font = '700 34px ' + JP; g.fillStyle = '#d0a070'; g.fillText('NO SIGNAL BEYOND THIS POINT · STAY ON THE TRAIL', w / 2, h * 0.84); });
  for (const H of JUKAI_NET.heads){ const e = H.e, r = edgeAt(e, Math.min(16, e.len * 0.3), {}), x = r.x + r.nx * (r.hl + 2.2), z = r.z + r.nz * (r.hl + 2.2), y = shownGround(x, z);
    for (const o of [-1.3, 1.3]) b.add(new THREE.BoxGeometry(0.18, 2.6, 0.18), barkM, x + r.tx * o, y + 1.3, z + r.tz * o);
    b.add(new THREE.PlaneGeometry(3, 1.1), new THREE.MeshBasicMaterial({ map: sign, side: THREE.DoubleSide }), x, y + 2.2, z, r.h + Math.PI / 2); }
  // the lanterns: at each fork, one stands beside the trail that leads closer to the heart
  const hn = JUKAI_NET.heart && JUKAI_NET.heart.node;
  if (hn){ const dist = new Map([[hn, 0]]), q = [hn];
    while (q.length){ const n = q.shift(); for (const e of n.links){ if (!e.jukai) continue; const m = e.a === n ? e.b : e.a; if (!dist.has(m)){ dist.set(m, dist.get(n) + e.len); q.push(m); } } }
    // (breadth-first by hops then corrected by length is close enough for a forest)
    for (const [n] of dist){ if (n.links.length < 3) continue; let best = null, bd = Infinity;
      for (const e of n.links){ if (!e.jukai) continue; const m = e.a === n ? e.b : e.a, d = (dist.get(m) ?? Infinity) + e.len; if (d < bd){ bd = d; best = e; } }
      if (!best) continue; const atB = best.b === n, r = edgeAt(best, atB ? Math.max(0, best.len - 22) : Math.min(best.len, 22), {}); lantern(r.x + r.nx * (r.hl + 1.4), r.z + r.nz * (r.hl + 1.4)); } }
  // the heart: a vast old cedar with a sacred rope round it, a ring of lanterns, a little torii and glowing mushrooms
  if (JUKAI_NET.heart){ const Hh = JUKAI_NET.heart, F = endFrame(Hh.e, Hh.node), [cx, cz] = F.P(20, 0), cy = shownGround(cx, cz);
    b.add(new THREE.CylinderGeometry(2.0, 3.0, 34, 14), barkM, cx, cy + 17, cz);
    for (let k = 0; k < 6; k++){ const r = 13 - k * 1.8; b.add(new THREE.ConeGeometry(r, 10, 12), mossM, cx, cy + 22 + k * 6.5, cz, k * 0.4); }
    { const g = new THREE.TorusGeometry(3.05, 0.28, 8, 28); g.rotateX(Math.PI / 2); b.add(g, LM(0xcbb98a), cx, cy + 3.2, cz); for (let k = 0; k < 8; k++){ const a = k / 8 * TAU; b.add(new THREE.BoxGeometry(0.3, 0.8, 0.04), whiteM, cx + Math.cos(a) * 3.2, cy + 2.6, cz + Math.sin(a) * 3.2, -a); } }
    for (let k = 0; k < 8; k++){ const a = k / 8 * TAU + 0.2; lantern(cx + Math.cos(a) * 10, cz + Math.sin(a) * 10, 1.1); }
    { const [tx, tz] = F.P(8, 0), ty = shownGround(tx, tz); for (const w of [-1.6, 1.6]){ const [px, pz] = [tx + F.lx * w, tz + F.lz * w]; b.add(new THREE.CylinderGeometry(0.16, 0.18, 3.4, 8), redM, px, ty + 1.7, pz); } b.add(new THREE.BoxGeometry(4.6, 0.25, 0.3), redM, tx, ty + 3.3, tz, F.h + Math.PI / 2); b.add(new THREE.BoxGeometry(3.6, 0.18, 0.22), redM, tx, ty + 2.8, tz, F.h + Math.PI / 2); }
    const shroom = new THREE.MeshBasicMaterial({ color: 0x5affc8 }); const Rm = mulberry(31);
    for (let k = 0; k < 40; k++){ const a = Rm() * TAU, r = 5 + Rm() * 14, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; b.add(new THREE.SphereGeometry(0.12 + Rm() * 0.14, 6, 4), shroom, x, shownGround(x, z) + 0.12, z); }
    const l = new THREE.PointLight(0x7affd0, 1.6, 40, 2); l.position.set(cx, cy + 4, cz); scene.add(l);
    JUKAI_NET.heartSpot = { x: F.x, z: F.z, y: F.y }; }
  // strange things at the dead ends, furthest from the heart first
  const ends = JUKAI_NET.ends.slice().sort((a, c) => (hn ? Math.hypot(c.x - hn.x, c.z - hn.z) - Math.hypot(a.x - hn.x, a.z - hn.z) : 0));
  ends.slice(0, JFIND_KINDS.length).forEach((E, i) => { const [kind, name] = JFIND_KINDS[i], F = endFrame(E.e, E.node), at = (a, w) => { const [x, z] = F.P(a, w); return [x, shownGround(x, z), z]; };
    if (kind === 'car'){ const c = makeAICar(0x4a4032); c.mark.visible = false; const [x, y, z] = at(10, 1); c.mesh.position.set(x, y - 0.15, z); c.mesh.rotation.set(0.08, F.h + 0.6, -0.12, 'YXZ'); c.mesh.visible = true; c.tail.color.setHex(0x050505); for (let k = 0; k < 5; k++){ const [vx, vy, vz] = at(8 + k * 1.1, 1 + (k % 2 - 0.5)); b.add(new THREE.BoxGeometry(0.6, 0.12, 0.9), mossM, vx, vy + 1.35 + k * 0.02, vz, F.h + k); } }
    if (kind === 'hut'){ const [x, y, z] = at(14, 0); b.add(new THREE.BoxGeometry(5, 3, 4), barkM, x, y + 1.5, z, F.h); b.add(new THREE.ConeGeometry(4.2, 2.2, 4), mossM, x, y + 4.1, z, F.h + Math.PI / 4); const [wx, wy, wz] = at(11.9, 1); b.add(new THREE.BoxGeometry(0.9, 0.7, 0.1), glowM, wx, wy + 1.7, wz, F.h); lantern(...at(10, -3).filter((_, j) => j !== 1)); }
    if (kind === 'train'){ const [x, y, z] = at(16, 0); b.add(new THREE.BoxGeometry(0.15, 0.12, 30), LM(0x4a3a30), x + F.lx * 0.8, y + 0.06, z + F.lz * 0.8, F.h + Math.PI / 2); b.add(new THREE.BoxGeometry(0.15, 0.12, 30), LM(0x4a3a30), x - F.lx * 0.8, y + 0.06, z - F.lz * 0.8, F.h + Math.PI / 2);
      b.add(new THREE.BoxGeometry(2.2, 2.4, 4.5), LM(0x3a4a40), x, y + 1.6, z, F.h + Math.PI / 2); { const g = new THREE.CylinderGeometry(0.9, 0.9, 4, 12); g.rotateX(Math.PI / 2); b.add(g, LM(0x2a2a2a), x + F.fx * 0, y + 1.6, z, F.h + Math.PI / 2); }
      for (const o of [-6, -11]){ const px = x + F.lx * o, pz = z + F.lz * o; b.add(new THREE.BoxGeometry(2, 0.5, 4), barkM, px, y + 0.8, pz, F.h + Math.PI / 2); for (let k = 0; k < 3; k++){ const g = new THREE.CylinderGeometry(0.35, 0.35, 4.2, 8); g.rotateX(Math.PI / 2); b.add(g, LM(0x6a4a2a), px + F.fx * (k - 1) * 0.7, y + 1.4, pz + F.fz * (k - 1) * 0.7, F.h + Math.PI / 2); } } }
    if (kind === 'jizo'){ const [x, y, z] = at(14, 0); for (let k = 0; k < 7; k++){ const a = k / 7 * TAU, px = x + Math.cos(a) * 4, pz = z + Math.sin(a) * 4, py = shownGround(px, pz); b.add(new THREE.CylinderGeometry(0.3, 0.38, 1, 8), stoneM, px, py + 0.5, pz); b.add(new THREE.SphereGeometry(0.3, 8, 6), stoneM, px, py + 1.22, pz); b.add(new THREE.ConeGeometry(0.42, 0.5, 8), redM, px, py + 0.85, pz); } lantern(x, z, 0.8); }
    JFINDS.push({ kind, name, x: F.x, z: F.z, y: F.y }); });
  b.flush();
}
// fireflies: a little cloud of blinking lights that only lives around you in the forest
const FIREFLY = (() => { const n = 260, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xc8ff7a, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.visible = false; scene.add(p); return { p, pos, n, cx: 1e9, cz: 1e9, m }; })();
let jukaiMsgT = 0, jWasIn = false;
function updateJukai(dt){
  const jk = weather.jk || 0, J = STATE.jukai, v = Math.hypot(car.vx, car.vy);
  // fireflies
  FIREFLY.p.visible = jk > 0.25; if (FIREFLY.p.visible){ FIREFLY.m.opacity = jk * (0.55 + 0.45 * Math.sin(simT * 2.3)) * (1 - DAY.dayF);
    if (Math.hypot(car.x - FIREFLY.cx, car.z - FIREFLY.cz) > 45){ FIREFLY.cx = car.x; FIREFLY.cz = car.z; for (let i = 0; i < FIREFLY.n; i++){ const a = rnd() * TAU, r = 8 + rnd() * 70, x = car.x + Math.cos(a) * r, z = car.z + Math.sin(a) * r; FIREFLY.pos[i * 3] = x; FIREFLY.pos[i * 3 + 1] = shownGround(x, z) + 0.6 + rnd() * 3.5; FIREFLY.pos[i * 3 + 2] = z; } FIREFLY.p.geometry.attributes.position.needsUpdate = true; } }
  // the trails you drive are yours to keep on the map
  const e = car.sup && car.sup.e; if (e && e.jukai && !JSEEN.has(e.id)){ JSEEN.add(e.id); J.seen.push(e.id); popup('TRAIL ADDED TO YOUR MAP · ' + e.name, 0, 'near'); saveState(); }
  const inside = inJukai(); if (inside !== jWasIn){ jWasIn = inside; if (inside && simT > jukaiMsgT){ jukaiMsgT = simT + 90; toast('樹海 · THE SEA OF TREES', 'NO GPS SIGNAL IN HERE · TRAILS APPEAR ON YOUR MAP ONCE YOU\'VE DRIVEN THEM · FOLLOW THE LANTERNS', '#9affc8'); } }
  if (v > 4) return;
  for (const F of JFINDS){ if (J.found.includes(F.kind) || Math.abs(car.x - F.x) > 30 || Math.abs(car.z - F.z) > 30 || Math.hypot(car.x - F.x, car.z - F.z) > 26) continue;
    J.found.push(F.kind); STATE.cash += 4000; sfx.beep(1600); toast('樹海 · ' + F.name, '+$4,000 · ' + J.found.length + ' OF ' + JFINDS.length + ' FOREST SECRETS FOUND', '#9affc8'); saveState(); }
  const H = JUKAI_NET.heartSpot; if (H && !J.heart && Math.hypot(car.x - H.x, car.z - H.z) < 26){ J.heart = true; STATE.cash += 15000; saveState(); sfx.beep(2000);
    showLore('THE HEART OF THE FOREST · 樹海の心', ['The trail just stops, and there it is: a cedar so old the moss on it has moss. A sacred rope is tied round its trunk and the lanterns around it are lit, though there\'s nobody here to light them.', 'Carved low on the bark, half grown over: "THE FOREST KEEPS WHAT IT FINDS. IT GIVES BACK TO THOSE WHO FIND IT."', 'REWARD: JUKAI MOSS paint · +$15,000.'], () => grantReward('paint:JUKAI MOSS')); }
}
