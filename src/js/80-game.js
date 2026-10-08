// =====================================================================================================
// THE GAME: money, upgrades, wanted stars (all saved), near-miss payouts, crashes, repairs, shops, camera, controls
// =====================================================================================================
// players: each has their own save on this device ('PLAYER 1' keeps the original save). A save can be exported to a file
// or a code and loaded on any other phone, tablet or computer
const LS_GET = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, LS_SET = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const PLAYER = (LS_GET('nd-player') || 'PLAYER 1').slice(0, 20);
const PLAYERS = (() => { try { const a = JSON.parse(LS_GET('nd-players') || '[]'); return Array.isArray(a) && a.length ? a : ['PLAYER 1']; } catch (e) { return ['PLAYER 1']; } })();
if (!PLAYERS.includes(PLAYER)) PLAYERS.push(PLAYER);
const SAVE_KEY = PLAYER === 'PLAYER 1' ? 'nd-save-v1' : 'nd-save-v1:' + PLAYER;
const STATE_DEFAULT = () => ({ cash: 3000, stars: 0, up: { engine: 0, turbo: 0, tyres: 0, brakes: 0, nitro: 0, armor: 0, tank: 0 }, ammo: 3, jammer: false, scanner: false, fuel: 1, paint: 0, earned: 0, odo: 0, busts: 0, escapes: 0, dest: null, trans: 'auto', assist: true });
let STATE = STATE_DEFAULT();
try { const raw = localStorage.getItem(SAVE_KEY); if (raw){ const o = JSON.parse(raw); STATE = Object.assign(STATE_DEFAULT(), o, { up: Object.assign(STATE_DEFAULT().up, o.up || {}) }); } } catch (e) {}
function saveState(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(STATE)); } catch (e) {} }
function starText(n){ const f = Math.floor(n), h = n - f >= 0.5; return '★'.repeat(f) + (h ? '½' : '') + '☆'.repeat(Math.max(0, 5 - f - (h ? 1 : 0))); }
function applyUpgrades(){
  const U = STATE.up;
  UPK.torque = [1, 1.12, 1.25, 1.4, 1.58][U.engine]; UPK.cd = [1, 0.9, 0.81, 0.73, 0.66][U.turbo]; // level 4 only comes from secret places
  UPK.lat = [0, 3, 6, 9.5, 13][U.tyres]; UPK.wet = [1, 0.85, 0.72, 0.6, 0.5][U.tyres]; UPK.brake = [1, 1.18, 1.36, 1.55, 1.75][U.brakes];
  UPK.nitroCap = [5, 6.5, 8, 10, 13][U.nitro]; UPK.nitroPush = [9, 10, 11.2, 12.5, 14.5][U.nitro]; UPK.armor = [1, 0.8, 0.62, 0.45, 0.32][U.armor]; UPK.jammer = !!STATE.jammer;
  UPK.tank = [1, 1.3, 1.6, 2, 2.5][U.tank || 0]; UPK.scanner = !!STATE.scanner;
  if (STATE.proto){ UPK.torque *= 1.12; UPK.cd *= 0.93; UPK.nitroCap += 3; } // the prototype kit from the job
  const mods = STATE.mods || []; UPK.rocket = mods.includes('ROCKET'); UPK.aero = mods.includes('AERO'); // from the hangars
}
applyUpgrades();

// ---------- popups and toasts
const popBox = $('popups');
function popup(text, cash, cls){
  const el = document.createElement('div'); el.className = 'pop ' + cls;
  el.textContent = text; if (cash){ const sm = document.createElement('small'); sm.textContent = '+$' + Math.round(cash).toLocaleString(); el.appendChild(sm); }
  popBox.prepend(el); setTimeout(() => el.remove(), 1300);
  while (popBox.children.length > 4) popBox.lastChild.remove();
}
let toastT = 0;
function toast(big, small, color){ const t = $('toast'); t.style.color = color || ''; t.textContent = big; if (small){ const s = document.createElement('small'); s.textContent = small; t.appendChild(s); } t.classList.add('show'); toastT = 2.4; }
function addCash(n, label){ n = Math.round(n); if (!n) return; STATE.cash += n; STATE.earned += n; if (label) popup(label, n, 'close'); }

// ---------- scoring: near misses pay cash, chained into a multiplier
const COMBO = 5.5;
const run = { crashes: 0, mult: 1, combo: 0, near: 0, top: 0, crashCool: 0, drift: 0, driftT: 0, frac: 0 };
let scrapeCool = 0, contactCool = 0;
function damageCar(x){ car.damage = Math.min(1, (car.damage || 0) + x * UPK.armor); }
function crash(v){
  if (run.crashCool > 0) return;
  run.crashCool = 1.5; sfx.crash(v);
  damageCar(Math.min(0.2, 0.12 + v * 0.003));
  run.crashes++;
  if (run.crashes < 5){ run.mult = 1; run.combo = 0; toast('CRASH ' + run.crashes + ' / 5', run.crashes === 4 ? 'ONE MORE AND YOU GET TOWED' : 'REPAIR AT ANY GAS STATION', '#ff4058'); return; }
  const fee = Math.min(STATE.cash, 500); STATE.cash -= fee;
  towToStation('CRASHED OUT', '5 CRASHES · TOWED TO THE NEAREST CHECKPOINT · $' + fee + ' TOW FEE', true);
}
function contact(v){
  sfx.bump(v);
  if (contactCool > 0) return; contactCool = 1.2; damageCar(0.05);
  run.mult = 1; run.combo = 0; popup('CONTACT', 0, 'bad');
}
function wallScrape(v){
  sfx.bump(v);
  if (scrapeCool > 0) return; scrapeCool = 1; damageCar(0.025);
  if (run.mult > 1){ run.mult = Math.max(1, run.mult - 0.5); popup('WALL', 0, 'bad'); }
}
// the nearest gas station by road, for towing and the HUD
function nearestStation(kindFilter){
  let best = null, bd = Infinity;
  for (const st of STATIONS){ if (kindFilter && st.kind !== kindFilter) continue; const d = Math.hypot(st.pad.cx - car.x, st.pad.cz - car.z); if (d < bd){ bd = d; best = st; } }
  return best;
}
function spawnAt(st){
  const sp = st.spawn || (() => { const F = frameAt(st.e, st.sm), q = F.at(-24, -F.r.hr - 6, {}); return { x: q.x, z: q.z, h: q.h, y: q.y }; })();
  placeCarWorld(sp.x, sp.z, sp.h, sp.y); car.graceT = 20; // a moment to get going before any police notice you
  for (const c of traffic){ if (c.mode !== 'park' && Math.hypot(c.x - sp.x, c.z - sp.z) < 90) parkCar(c); }
}
function towToStation(title, sub, repair){
  run.mult = 1; run.combo = 0; run.crashes = 0;
  if (chase.on) endChase(false);
  // towed to the nearest checkpoint: a gas station, or any town (its fuel stop or its garage)
  let st = null, bd = Infinity; for (const s2 of STATIONS){ if (!(s2.kind === 'gas' || s2.kind === 'fuel' || (s2.kind === 'shop' && s2.place && s2.place.isTown))) continue; const d = Math.hypot(s2.pad.cx - car.x, s2.pad.cz - car.z); if (d < bd){ bd = d; st = s2; } }
  st = st || START_STATION;
  if (repair){ car.damage = 0; car.flat = 0; }
  spawnAt(st);
  toast(title, sub, '#ff4058'); saveState();
}
function scoring(dt){
  const kmh = Math.abs(car.vx) * 3.6;
  run.crashCool = Math.max(0, run.crashCool - dt); scrapeCool = Math.max(0, scrapeCool - dt); contactCool = Math.max(0, contactCool - dt);
  STATE.odo += Math.abs(car.vs) * dt; run.top = Math.max(run.top, kmh);
  if (kmh > 110){ run.frac += (kmh - 110) * 0.045 * run.mult * dt; if (run.frac >= 1){ const k = Math.floor(run.frac); run.frac -= k; STATE.cash += k; STATE.earned += k; } }
  const beta = Math.abs(Math.atan2(car.vy, Math.max(Math.abs(car.vx), 0.1)));
  const onMt = car.sup && car.sup.e && car.sup.e.cls === 'mt', onDrift = onMt && car.sup.e.gen === 'drift', dmul = onDrift ? 2 : onMt ? 1.35 : 1; // drifting pays more up the mountains, double on the drift road
  if (onDrift && !run.onDrift) toast('MIDNIGHT DRIFT ROAD', 'DRIFT POINTS ×2 · LINK THE BENDS', '#ff9a1a'); run.onDrift = onDrift;
  if (kmh > 45 && beta > 0.22 && run.crashCool <= 0){ run.drift += (beta * 6 + kmh * 0.06) * dt * run.mult * dmul; run.driftT += dt; }
  else if (run.driftT > 0){ if (run.drift > 12 && run.driftT > 0.6){ addCash(run.drift); run.mult = Math.min(12, run.mult + 0.2); run.combo = COMBO; popup('DRIFT', run.drift, 'close'); } run.drift = 0; run.driftT = 0; }
  run.combo = Math.max(0, run.combo - dt * (kmh < 60 ? 3 : 1));
  if (run.combo <= 0 && run.mult > 1) run.mult = Math.max(1, run.mult - 0.8 * dt);
  // near misses: a car you pass close by at speed. Oncoming traffic on two-lane roads pays more
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h), pv = car.vx, inTokai = inCity(car.x, car.z, 30) === CITY.tokai;
  for (const c of traffic){
    if (c.mode === 'park'){ c.prevRel = 0; continue; }
    const dx = c.x - car.x, dz = c.z - car.z; if (dx * dx + dz * dz > 400 || Math.abs(c.y - car.y) > 3){ c.prevRel = 0; continue; }
    const rel = dx * fx + dz * fz, lat = dx * lx + dz * lz, cvf = c.v * Math.cos(angWrap(c.h - car.h));
    if (c.prevRel > 0 && rel <= 0 && !c.hit && kmh > 80 && pv > cvf + 2){
      const gap = Math.abs(lat) - c.wid / 2 - 0.96;
      if (gap < 1.35){
        const tier = gap < 0.45 ? 2 : gap < 0.9 ? 1 : 0, oncoming = cvf < -5;
        const pay = (20 + (kmh - 80) * 0.35) * (1 + (1.6 - gap) * 1.1) * (c.truck ? 1.3 : 1) * (oncoming ? 1.6 : 1) * (inTokai ? 1.5 : 1) * run.mult;
        addCash(pay); run.mult = Math.min(12, run.mult + [0.25, 0.4, 0.6][tier] * (oncoming ? 1.3 : 1)); run.combo = COMBO; run.near++;
        popup((oncoming ? 'ONCOMING · ' : '') + ['NEAR MISS', 'CLOSE', 'INSANE'][tier], pay, ['near', 'close', 'insane'][tier]);
        if (tier === 2 && rnd() < 0.55) sfx.horn(c.truck ? 0.62 : 0.85 + rnd() * 0.25, 0.55, 0.12);
        sfx.whoosh(tier);
      }
    }
    c.prevRel = rel;
  }
}

// ---------- gas stations and shops: stop in the green box
let bayT = 0, shopOpenFor = null;
function inBay(st){
  const b = st.bay, side = st.side || -1, fwd = side < 0 ? 1 : -1, sb = st.sm + b.a * fwd;
  refineOn(st.e, st.e.i0 + clamp(Math.round(sb / st.e.ds), 0, st.e.n - 1), car.x, car.z, _pq);
  const r = edgeAt(st.e, _pq.s, {}), w = side < 0 ? -_pq.d - r.hr : _pq.d - r.hl;
  return { along: (_pq.s - sb) * fwd, w, inside: Math.abs(_pq.s - sb) < b.len / 2 && w > b.w0 - 0.4 && w < b.w1 + 0.4 && Math.abs(_pq.y - car.y) < 3 };
}
function stations(dt){
  const kmh = Math.abs(car.vx) * 3.6, el = $('repair');
  let near = null, nd = 150; // the station whose forecourt you're on (twins face each other across the road)
  if (car.sup && car.sup.kind === 'pad'){ const p = car.sup.pad; near = STATIONS.find(st => st.pad === p) || null; }
  if (!near) for (const st of STATIONS){ const d = Math.hypot(st.pad.cx - car.x, st.pad.cz - car.z); if (d < nd){ nd = d; near = st; } }
  if (!near){ el.hidden = true; bayT = 0; car.bayDone = null; if (shopOpenFor) closeShop(); return; }
  const onPad = car.sup && car.sup.kind === 'pad' && car.sup.pad === near.pad, b = inBay(near);
  if (b.inside && kmh < 6){
    if (car.bayDone === near){ el.hidden = true; return; }
    bayT += dt; const need = near.kind === 'shop' ? 1 : near.kind === 'fuel' ? 2 : 5;
    el.hidden = false; el.innerHTML = (near.kind === 'shop' ? 'OPENING THE SHOP' : near.kind === 'fuel' ? 'FUELLING' : 'REPAIRING') + '<b>' + Math.max(0, need - bayT).toFixed(1) + ' s</b><i style="width:' + Math.min(100, bayT / need * 100) + '%"></i>';
    if (bayT >= need && near.kind === 'fuel'){ // a mountain fuel stop: up to a third of a tank, and your checkpoint
      car.bayDone = near; bayT = 0; el.hidden = true; const msg = topUp(near, 1 / 3); STATE.checkpoint = near.place.id; popup(msg, 0, 'near'); popup('CHECKPOINT · ' + near.place.name, 0, 'near'); sfx.beep(1100); saveState();
    } else if (bayT >= need){
      car.damage = 0; car.flat = 0; run.crashes = 0; car.bayDone = near; bayT = 0; el.hidden = true;
      if (near.kind === 'shop'){ openShop(near); sfx.beep(1320); popup('REPAIRED · FUEL AND NITRO AT A GAS STATION', 0, 'near'); } // upgrade bays don't fill you up any more
      else { car.nitro = 1; const fuelMsg = refuel(near);
        STATE.ammo = Math.max(STATE.ammo, Math.min(5, STATE.ammo + 1)); popup('REPAIRED · NITRO FULL · +1 BULLET', 0, 'near'); popup(fuelMsg, 0, 'near'); sfx.beep(990); saveState(); }
    }
  } else {
    bayT = 0;
    if (!b.inside) car.bayDone = car.bayDone === near && Math.abs(b.along) > 14 ? null : car.bayDone;
    if (shopOpenFor && (!b.inside || kmh > 12)) closeShop();
    const needs = near.kind === 'fuel' ? car.fuel < 0.33 : near.kind === 'shop' || car.fuel < 0.98 || car.damage > 0.02 || car.nitro < 0.95 || run.crashes > 0 || car.flat;
    if (onPad && car.bayDone !== near && needs){ const diff = -b.along; el.hidden = false; el.innerHTML = (near.kind === 'shop' ? 'UPGRADE BAY' : near.kind === 'fuel' ? 'FUEL STOP · ⅓ TANK' : 'GREEN REPAIR BOX') + '<b>' + Math.round(Math.abs(diff)) + ' m ' + (diff > 0 ? 'AHEAD' : 'BEHIND') + '</b><span style="font-size:10px">stop inside it for ' + (near.kind === 'shop' ? 'a second' : near.kind === 'fuel' ? '2 seconds' : '5 seconds') + '</span>'; }
    else el.hidden = true;
  }
}
// ---------- fuel: a 60 litre tank (bigger with upgrades) at $3 a litre, half price where fuel is cheap
const FUEL_L = 60;
function fuelPrice(st){ const P = st.place; return P && P.info.special.includes('fuelCheap') ? 1.5 : 3; }
function refuel(st){
  const litres = (1 - car.fuel) * FUEL_L * UPK.tank; if (litres < 0.5){ car.fuel = 1; return 'TANK ALREADY FULL'; }
  const price = fuelPrice(st), cost = Math.round(litres * price);
  if (STATE.cash >= cost){ STATE.cash -= cost; car.fuel = 1; STATE.fuel = 1; return 'FUEL ' + Math.round(litres) + ' L · $' + cost; }
  const afford = STATE.cash / price; car.fuel = Math.max(car.fuel + afford / (FUEL_L * UPK.tank), Math.min(1, car.fuel + 0.25)); STATE.cash = 0; STATE.fuel = car.fuel;
  return 'NOT ENOUGH CASH · PART-FILLED';
}
function topUp(st, to){ // fill to a fraction of the tank (never empties it)
  if (car.fuel >= to - 0.005) return 'ALREADY ' + Math.round(car.fuel * 100) + '% FULL';
  const litres = (to - car.fuel) * FUEL_L * UPK.tank, price = fuelPrice(st), cost = Math.min(STATE.cash, Math.round(litres * price));
  STATE.cash -= cost; car.fuel = Math.max(car.fuel, car.fuel + (cost / price) / (FUEL_L * UPK.tank), Math.min(to, car.fuel + 0.15)); STATE.fuel = car.fuel;
  return 'FUEL TO ⅓ · ' + Math.round(litres) + ' L · $' + cost;
}
let fuelWarn = 0;
function burnFuel(dt, thr){
  const sp = Math.abs(car.vx), before = car.fuel;
  car.fuel = Math.max(0, car.fuel - (sp * dt * (0.55 + 0.75 * thr) / (30000 * UPK.tank) + dt * 0.00004 / UPK.tank));
  STATE.fuel = car.fuel;
  if (before > 0.2 && car.fuel <= 0.2) toast('LOW FUEL', '20% LEFT · FIND A GAS STATION (THE MAP SHOWS THEM)', '#ffb04a');
  if (before > 0.07 && car.fuel <= 0.07) toast('FUEL ALMOST GONE', 'PULL INTO THE NEXT GAS STATION', '#ff4058');
  if (before > 0 && car.fuel <= 0) toast('OUT OF FUEL', 'COAST TO A STOP · PRESS R FOR A TOW ($250)', '#ff4058');
}
function towForFuel(){
  const fee = Math.min(STATE.cash, 250); STATE.cash -= fee; car.fuel = Math.max(car.fuel, 0.3); STATE.fuel = car.fuel;
  towToStation('TOWED', 'OUT OF FUEL · $' + fee + ' TOW · 30% IN THE TANK', false);
}
// ---------- the shop
function priceOf(c, id){
  const I = c.info, lvl = STATE.up[id] || 0, u = UPG.find(q => q.id === id), mx = I.max[id] || 0;
  if (lvl >= 3) return { txt: 'MAXED', ok: false };
  if (lvl >= mx) return { txt: mx === 0 ? 'NOT SOLD HERE' : 'LEVEL ' + (lvl + 1) + ' NOT SOLD HERE', ok: false };
  const p = Math.round(u.base[lvl] * I.price * (I.off[id] || 1) / 50) * 50;
  return { txt: 'BUY  $' + p.toLocaleString(), ok: STATE.cash >= p, p };
}
function specials(c){
  const out = [], I = c.info;
  if (I.special.includes('respray')) out.push({ id: 'respray', name: 'RESPRAY', desc: 'A new colour: police forget one wanted star', p: 3000, ok: STATE.stars >= 0.5, why: STATE.stars < 0.5 ? 'NOT WANTED' : null });
  if (I.special.includes('ammo')) out.push({ id: 'ammo', name: 'AMMO', desc: 'One bullet for the gun (max 9)', p: 700, ok: STATE.ammo < 9, why: STATE.ammo >= 9 ? 'FULL' : null });
  if (I.special.includes('jammer')) out.push({ id: 'jammer', name: 'RADAR JAMMER', desc: 'Police spot you from 40% closer', p: 9000, ok: !STATE.jammer, why: STATE.jammer ? 'OWNED' : null });
  if (I.special.includes('scanner')) out.push({ id: 'scanner', name: 'POLICE SCANNER', desc: 'Every police car near you shows on your minimap and the road-ahead bar', p: 12000, ok: !STATE.scanner, why: STATE.scanner ? 'OWNED' : null });
  return out;
}
function openShop(st){ shopOpenFor = st; renderShop(); $('shop').hidden = false; }
const placeOf = st => st.place || st.city;
function closeShop(){ shopOpenFor = null; $('shop').hidden = true; }
function renderShop(){
  const st = shopOpenFor; if (!st) return; const c = placeOf(st), I = c.info, el = $('shop');
  let h = `<h2>${c.name} ${c.isTown ? 'PARTS' : 'TUNE'}</h2><div class="cashline"><span>${I.tag}</span><b>$${Math.round(STATE.cash).toLocaleString()}</b></div>`;
  for (const u of UPG){ const lvl = STATE.up[u.id] || 0, pr = priceOf(c, u.id);
    h += `<div class="up"><div><div class="nm">${u.name}</div><div class="ds">${u.desc}</div></div><div class="pips">${[0, 1, 2].map(k => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}${lvl >= 4 ? '<i class="on gold"></i>' : ''}</div><button type="button" data-buy="${u.id}" ${pr.ok ? '' : 'disabled'}>${pr.txt}</button></div>`; }
  for (const sp of specials(c)) h += `<div class="up"><div><div class="nm">${sp.name}</div><div class="ds">${sp.desc}</div></div><div></div><button type="button" data-sp="${sp.id}" ${sp.ok && STATE.cash >= sp.p ? '' : 'disabled'}>${sp.why || 'BUY  $' + sp.p.toLocaleString()}</button></div>`;
  h += questBlock(c); h += heistShopBlock(c);
  { const r = c.isTown ? loreRumour(c) : ''; if (r) h += `<div class="quest"><div class="nm">OVERHEARD AT THE COUNTER</div><p class="riddle">${r}</p></div>`; }
  h += `<div class="foot">REPAIRED · NITRO AND FUEL FULL · DRIVE OFF OR PRESS ESC TO LEAVE</div>`;
  el.innerHTML = h;
  el.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.buy, pr = priceOf(c, id); if (!pr.ok) return; STATE.cash -= pr.p; STATE.up[id]++; applyUpgrades(); saveState(); sfx.beep(1500); popup(UPG.find(q => q.id === id).name + ' LEVEL ' + STATE.up[id], 0, 'near'); renderShop(); }));
  el.querySelectorAll('[data-sp]').forEach(b => b.addEventListener('click', () => { const sp = specials(c).find(q => q.id === b.dataset.sp); if (!sp || !sp.ok || STATE.cash < sp.p) return; STATE.cash -= sp.p;
    if (sp.id === 'respray'){ STATE.stars = Math.max(0, STATE.stars - 1); STATE.paint = (STATE.paint + 1) % PAINTS.length; setPaint(STATE.paint); }
    if (sp.id === 'ammo') STATE.ammo++; if (sp.id === 'jammer'){ STATE.jammer = true; applyUpgrades(); } if (sp.id === 'scanner'){ STATE.scanner = true; applyUpgrades(); }
    saveState(); sfx.beep(1500); renderShop(); }));
  heistWire(el);
}

// ---------- collisions with traffic and police (from Midnight Weave, in world space)
function applyImpulseWorld(jx, jz, px, pz, yawK = 0.7){
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
  let Vx = car.vx * fx + car.vy * lx, Vz = car.vx * fz + car.vy * lz;
  Vx += jx / PHYS.m; Vz += jz / PHYS.m;
  car.vx = Vx * fx + Vz * fz; car.vy = Vx * lx + Vz * lz;
  car.r += clamp((pz * jx - px * jz) / PHYS.I * yawK, -0.6, 0.6);
}
function collideMovers(){
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
  for (const c of traffic){
    if (c.mode === 'park') continue;
    const dx = c.x - car.x, dz = c.z - car.z; if (dx * dx + dz * dz > 256 || Math.abs(c.y - car.y) > 2.5) continue;
    const hit = obb(car.x, car.z, car.h, 0.96, 2.28, c.x, c.z, c.h, c.wid / 2, c.len / 2); if (!hit) continue;
    const { nx, nz, depth } = hit;
    car.x -= nx * depth * 0.7; car.z -= nz * depth * 0.7;
    const Vx = car.vx * fx + car.vy * lx, Vz = car.vx * fz + car.vy * lz, tf = Math.sin(c.h), tz = Math.cos(c.h);
    const vn = (Vx - c.v * tf) * nx + (Vz - c.v * tz) * nz; if (vn <= 0) continue;
    const light = vn < 3, e = light ? 0 : 0.1, j = (1 + e) * vn / (1 / PHYS.m + 1 / c.mass) * (light ? 0.8 : 1);
    let bx = 0, bz = 0, bd = -Infinity;
    for (const [sl, sf] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]){ const cx = lx * 0.96 * sl + fx * 2.28 * sf, cz = lz * 0.96 * sl + fz * 2.28 * sf, dd = cx * nx + cz * nz; if (dd > bd){ bd = dd; bx = cx; bz = cz; } }
    applyImpulseWorld(-j * nx, -j * nz, bx, bz, light ? 0.12 : 0.3);
    c.v = Math.max(0, c.v + j / c.mass * (nx * tf + nz * tz));
    if (c.mode === 'edge'){ const side = (nx * Math.cos(c.h) - nz * Math.sin(c.h)); c.d += clamp(j / c.mass * side * 0.05, -0.2, 0.2) * (c.dir > 0 ? 1 : -1); }
    c.hit = true;
    if (vn > 6.5){ crash(vn); c.wreck = 9; } else if (vn > 1.2) contact(vn); else sfx.bump(vn);
  }
  for (const u of police){
    if (!u.active) continue;
    const dx = u.x - car.x, dz = u.z - car.z; if (dx * dx + dz * dz > 64 || Math.abs(u.y - car.y) > 2.5) continue;
    const hit = obb(car.x, car.z, car.h, 0.96, 2.28, u.x, u.z, u.h, 0.96, 2.28); if (!hit) continue;
    car.x -= hit.nx * hit.depth * 0.7; car.z -= hit.nz * hit.depth * 0.7;
    const Vx = car.vx * fx + car.vy * lx, Vz = car.vx * fz + car.vy * lz, vn = (Vx - u.v * Math.sin(u.h)) * hit.nx + (Vz - u.v * Math.cos(u.h)) * hit.nz;
    if (vn > 0){ const j = vn / (2 / PHYS.m); applyImpulseWorld(-j * hit.nx * 0.8, -j * hit.nz * 0.8, 0, 0, 0.15); u.v += j / PHYS.m * 0.5; sfx.bump(vn); }
    if (u.blocker && vn > 6.5) crash(vn); // straight into a roadblock
    if (u.state === 'chase' && started){ if (Math.hypot(car.vx, car.vy) < 14){ busted('A POLICE CAR GOT YOU'); return; } if (vn > 2.5 && !u.ramT){ u.ramT = 1.5; popup('RAMMED BY POLICE', 0, 'bad'); car.damage = Math.min(1, car.damage + 0.06 * UPK.armor); cam.shake += 0.05; } } // at speed they ram you; slow down and they've got you
    if ((u.state === 'parked' || u.state === 'patrol') && started && vn > 1){ u.cool = 0; STATE.stars = Math.min(5, STATE.stars + 0.5); startChase(u, 'YOU HIT A POLICE CAR · WANTED ' + starText(STATE.stars)); }
  }
}

// ---------- camera: chase, far chase, hood, bumper. Hold Q to look back over your car
const cam = { yaw: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0, init: false };
const ORB = { yaw: 0, pitch: 0, zoom: 0, drag: null, idle: 9 };
const CAMS = ['CHASE', 'FAR CHASE', 'HOOD', 'BUMPER', 'COCKPIT', 'COCKPIT WIDE']; // the wide one sits further back, with more of the road in view
function updateCamera(dt){
  const spd = Math.hypot(car.vx, car.vy);
  const velH = car.h + Math.atan2(car.vy, Math.max(Math.abs(car.vx), 0.1));
  const wantYaw = spd > 4 ? lerp(car.h, velH, 0.1 + 0.3 * car.drift) : car.h;
  cam.yaw += angWrap(wantYaw - cam.yaw) * Math.min(1, dt * (opts.cam < 2 ? 10 : 30));
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  let look;
  // looking around: drag the mouse (or the right stick) to swing the camera; it drifts back behind you a moment after you let go
  if (!ORB.drag && ORB.idle > 1.6){ const k = Math.min(1, dt * 2.2); ORB.yaw = angWrap(ORB.yaw) * (1 - k); ORB.pitch *= 1 - k; }
  ORB.idle += dt;
  if (opts.cam < 2){
    const dist = (opts.cam === 0 ? 6.6 : 9.0) + spd * 0.012 + ORB.zoom, hgt = opts.cam === 0 ? 2.6 : 3.2;
    const Y = ORB.yaw, ox = Math.sin(cam.yaw + Y), oz = Math.cos(cam.yaw + Y), cp = Math.cos(ORB.pitch), orbiting = Math.min(1, Math.abs(angWrap(Y)) * 2 + Math.abs(ORB.pitch) * 3);
    const dx = car.x - ox * dist * cp, dy = car.y + hgt + Math.sin(ORB.pitch) * dist, dz = car.z - oz * dist * cp;
    look = new THREE.Vector3(lerp(car.x + fx * 9, car.x, orbiting), car.y + 1.0, lerp(car.z + fz * 9, car.z, orbiting));
    if (!cam.init){ cam.pos.set(dx, dy, dz); cam.init = true; }
    cam.pos.x = lerp(cam.pos.x, dx, Math.min(1, dt * 13)); cam.pos.z = lerp(cam.pos.z, dz, Math.min(1, dt * 13));
    cam.pos.y = lerp(cam.pos.y, Math.max(dy, car.y + 1.4), Math.min(1, dt * 6));
  } else if (opts.cam >= 4){ // the driver's seat: your head leans into the corners and looks a little where you're steering
    CP.look = lerp(CP.look, clamp(car.steerIn * 0.1 + car.r * 0.06, -0.22, 0.22), Math.min(1, dt * 2.5)); CP.sway = lerp(CP.sway, clamp(-car.ayF * 0.0022, -0.045, 0.045), Math.min(1, dt * 4));
    player.updateMatrixWorld(true); const E = CP.EYE;
    const wide = opts.cam === 5 ? 1 : 0; cam.pos.copy(pBody.localToWorld(new THREE.Vector3(E.x + CP.sway - wide * 0.04, E.y + clamp(-car.axF * 0.0006, -0.02, 0.02) + wide * 0.05, E.z - wide * 0.14)));
    const hy = CP.look + clamp(angWrap(ORB.yaw), -1.7, 1.7), hp = clamp(ORB.pitch, -0.5, 0.6); // turn your head
    look = pBody.localToWorld(new THREE.Vector3(E.x + CP.sway * 0.5 + Math.sin(hy) * 12 - wide * 0.06, E.y - 0.3 + hp * 10, E.z + Math.cos(hy) * 12)); cam.yaw = car.h;
  } else {
    const fxc = Math.sin(car.h), fzc = Math.cos(car.h), fwd = opts.cam === 2 ? 0.55 : 2.35, hgt = opts.cam === 2 ? 1.2 : 0.55;
    cam.pos.set(car.x + fxc * fwd, car.y + hgt, car.z + fzc * fwd);
    const hy = car.h + clamp(angWrap(ORB.yaw), -1.9, 1.9);
    look = new THREE.Vector3(car.x + Math.sin(hy) * 30, car.y + hgt - 0.4 + car.slope * 30 + ORB.pitch * 25, car.z + Math.cos(hy) * 30); cam.yaw = car.h;
  }
  camera.position.copy(cam.pos);
  const sh = clamp((spd - 40) / 50, 0, 1) * 0.008 + cam.shake; cam.shake = Math.max(0, cam.shake - dt * 0.6);
  camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh;
  camera.lookAt(look);
  if (keys.KeyQ && started){ player.updateMatrixWorld(true); camera.position.copy(player.localToWorld(new THREE.Vector3(0.8, 2.2, 6.2))); camera.lookAt(player.localToWorld(new THREE.Vector3(0, 0.8, -6))); }
  const near = opts.cam >= 4 ? 0.08 : 0.3; if (camera.near !== near){ camera.near = near; camera.updateProjectionMatrix(); }
  document.body.classList.toggle('cockpit', opts.cam >= 4); sfx.cabin(opts.cam >= 4 ? 1 : opts.cam === 2 ? 0.35 : 0);
  const fov = opts.cam >= 4 ? cockpitFov(camera.aspect, spd) + (opts.cam === 5 ? 9 : 0) + (car.nosOn ? 6 : 0) + (car.rocketOn ? 10 : 0) : 58 + clamp(spd * 3.6 - 60, 0, 240) * 0.07 + (car.nosOn ? 9 : 0) + (car.rocketOn ? 14 : 0);
  if (Math.abs(camera.fov - fov) > 0.05){ camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 3)); camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position); stars.position.copy(camera.position);
}

// ---------- controls
const keys = {};
const CONTROLS = [
  ['W / ↑', 'Throttle', 'gas accelerate'], ['S / ↓', 'Brake, hold at a stop to reverse', 'reverse stop'], ['A D / ← →', 'Steer', 'turn left right'],
  ['SPACE', 'Handbrake slide', 'drift slide'], ['X (hold)', 'Nitro. Refilled at every gas station and shop; bigger bottles in the shops', 'nitro boost nos speed'],
  ['M / click the minimap', 'The big map: where you are, which road you are on, every city\'s pros and cons, and GPS routes', 'map gps route city where navigation'],
  ['GREEN BOXES', 'Stop in one: at a gas station it repairs you, refills nitro and resets crashes; at a city tune shop it opens the upgrade shop', 'repair shop upgrade gas station nitro'],
  ['CLICK', 'Shoot: click a police car to blow it up. Ammo from Nagisa, +1 at every repair', 'gun shoot fire weapon ammo cop police'],
  ['L', 'High beams on / off', 'lights headlights high beam'], ['H', 'Horn: slower cars in your lane move over', 'honk'],
  ['F (hold)', 'Rocket booster, if you found it in a hangar: three seconds of huge thrust, then it recharges', 'rocket boost booster hangar'], ['DRAG THE MOUSE', 'Look around your car (any mouse button, or the right stick on a gamepad). Scroll to zoom the chase camera in and out. Let go and the camera swings back behind you. A quick click without dragging still shoots', 'camera rotate orbit look around mouse zoom'], ['C', 'Camera: chase, far chase, hood, bumper, cockpit (from the driver\'s seat, hands on the wheel, wipers in the rain)', 'view cockpit interior inside first person wheel'], ['Q (hold)', 'Look back over your car: check damage and who is behind you', 'damage look behind rear mirror'],
  ['R', 'Back onto the nearest road, wherever you are (out of fuel and stopped: call a tow, $250)', 'respawn stuck tow fuel off road forest'], ['OFF ROAD', 'Nothing stops you leaving the road: fields, forests, hillsides. Expressways, ramps, country roads, mountain roads and every bridge have guard rails, with gaps at junctions and gas stations. Lanes, dirt tracks and city streets are open: drive off them into fields and forests. Grass is slow and slippery, trees are solid, a long drop hurts', 'off road forest grass field'],
  ['FUEL', 'Your car burns fuel, faster at full throttle. Fill up in any green service box at a gas station or shop ($3 a litre, half price in Hokuto, Kitahama and Nohara)', 'gas fuel petrol tank refuel'],
  ['TOWNS', 'Ten towns and four high mountain villages sell parts the cities don\'t. Their garages are hidden down side streets. The harder a place is to reach, the better its stock: level 3 parts, the jammer, the scanner, respray', 'towns villages shop parts level 3 upgrades'], ['THE STORY', 'Somewhere at the end of a forgotten road lives the Lore Keeper. Listen at the counters of the town garages: people talk. He has a story to pass on, and it is the goal of the game', 'story lore keeper goal chapter'], ['SEA OF TREES', 'In the north-west lies 樹海, the Sea of Trees: a vast old forest full of unmarked trails. Your GPS and minimap lose their signal inside, and the trails only appear on your map once you have driven them. Strange things wait at the ends of some trails, and something special at its heart. Stone lanterns at the forks may help', 'forest jukai sea of trees biome trails secret lost'], ['THE JOB', 'A fixer in the NAGISA tune shop has work for a driver with nerve: steal a prototype, get a fake licence, get past the border posts. Press I to look at your licence. While you are carrying the crate, police know your colour: respray at any garage ($1,500) before a border, and remember border posts run your ID after you pass', 'heist steal job quest licence id border respray'], ['SECRETS', 'Ask the old man in TENGU, the highest village, about the secret map. Secret places at the ends of lonely roads hold paints, underglow, rims, a wing and level 4 parts', 'secret map quest tengu hidden'], ['G', 'Automatic or manual gearbox', 'gears transmission'], ['Z / E', 'Shift down / up (manual gearbox)', 'gears'], ['T', 'Assists on / off', 'traction stability'],
  
  ['Y', 'Radio on / off', 'music radio song'], ['N', 'Mute all sound', 'audio volume sound'], ['P / ESC', 'Pause (Esc also closes the map or shop)', 'menu stop'], ['/', 'This controls list', 'help commands keys'],
  ['POLICE', 'Police leave you alone unless they see you break the law: speeding past one (or hitting one) makes you wanted. Once wanted, any unit that sees you gives chase. Get 300 m away from a unit and it gives up; lose them all: escaped, +½ wanted star. Your wanted level wears off by ½ star every 2 minutes while nobody is chasing you. From 4 stars there is a tracker on your car: every 30 s the police get your position and the nearest units come for you. Busted clears your stars but costs a fine', 'cops wanted stars chase escape busted tracker'],
];
let helpOpen = false;
function renderHelp(){
  const q = $('helpSearch').value.trim().toLowerCase();
  const rows = CONTROLS.filter(([k, d, t]) => !q || (k + ' ' + d + ' ' + t).toLowerCase().includes(q));
  $('helpList').innerHTML = rows.length ? rows.map(([k, d]) => `<kbd>${k}</kbd><span>${d}</span>`).join('') : '<span></span><span>No control matches that.</span>';
}
function openHelp(){ helpOpen = true; paused = true; $('help').hidden = false; $('helpSearch').value = ''; renderHelp(); try { $('helpSearch').focus(); } catch (e) {} }
function closeHelp(){ helpOpen = false; $('help').hidden = true; if (started){ paused = false; last = performance.now(); sfx.resume(); } else paused = false; }
$('helpSearch').addEventListener('input', renderHelp);
$('helpClose').addEventListener('click', closeHelp);
$('helpBtn').addEventListener('click', e => { e.currentTarget.blur(); openHelp(); });
function toggleRadio(){ sfx.init(); sfx.resume(); const on = sfx.radio(!sfx.radioOn); $('radioBtn').classList.toggle('on', on); toast(on ? 'NIGHT FM 88.3' : 'RADIO OFF', on ? 'NOW PLAYING · NIGHT DRIVE' : '', '#7fe3ff'); }
$('radioBtn').addEventListener('click', e => { e.currentTarget.blur(); toggleRadio(); });
addEventListener('keydown', e => {
  if (helpOpen){ if (e.code === 'Escape' || (e.code === 'Slash' && e.target.id !== 'helpSearch')){ e.preventDefault(); closeHelp(); } return; }
  if (mapOpen){ if (e.code === 'Escape' || e.code === 'KeyM'){ e.preventDefault(); closeMap(); } return; }
  if (e.code === 'Slash' && e.target.tagName !== 'INPUT'){ e.preventDefault(); openHelp(); return; }
  keys[e.code] = true;
  if (!started) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && e.target.tagName !== 'BUTTON') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape' && shopOpenFor){ closeShop(); return; }
  if (e.code === 'KeyM'){ openMap(); return; }
  if (e.code === 'KeyC'){ opts.cam = (opts.cam + 1) % CAMS.length; popup('CAMERA · ' + CAMS[opts.cam], 0, 'near'); }
  if (e.code === 'KeyR'){ if (car.fuel <= 0 && Math.hypot(car.vx, car.vy) < 2) towForFuel(); else resetCar(); }
  if (e.code === 'KeyY') toggleRadio();
  if (e.code === 'KeyH'){ sfx.horn(); yieldAhead(); }
  if (e.code === 'KeyL'){ highBeam = !highBeam; if (highBeam) yieldAhead(); flags(); }
  if (e.code === 'KeyN') toggleMute();
  if (e.code === 'KeyG'){ opts.auto = !opts.auto; STATE.trans = opts.auto ? 'auto' : 'manual'; flags(); }
  if (e.code === 'KeyT'){ opts.assist = !opts.assist; STATE.assist = opts.assist; flags(); }
  if (e.code === 'KeyE' || e.code === 'ShiftLeft') manualShift(1);
  if (e.code === 'KeyZ' || e.code === 'ControlLeft') manualShift(-1);
  if (e.code === 'KeyP' || e.code === 'Escape') setPaused(!paused);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && started && !mapOpen) setPaused(true); });
function flags(){
  $('fHi').classList.toggle('on', highBeam);
  $('fTrans').textContent = opts.auto ? 'AUTO' : 'MANUAL';
  $('fTc').textContent = opts.assist ? 'ASSIST' : 'NO ASSIST'; $('fTc').classList.toggle('on', opts.assist);
}
const touchState = { l: 0, r: 0, g: 0, b: 0 };
if ('ontouchstart' in window || navigator.maxTouchPoints > 0){
  document.body.classList.add('touch'); $('touch').hidden = false;
  for (const [id, k] of [['tl', 'l'], ['tr', 'r'], ['tg', 'g'], ['tb', 'b']]){
    const el = $(id);
    el.addEventListener('pointerdown', e => { touchState[k] = 1; el.setPointerCapture(e.pointerId); e.preventDefault(); });
    const up = () => { touchState[k] = 0; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  }
}
let padPrev = {};
function readInput(dt){
  let thr = (keys.KeyW || keys.ArrowUp || touchState.g) ? 1 : 0;
  let brk = (keys.KeyS || keys.ArrowDown || touchState.b) ? 1 : 0;
  let st = ((keys.KeyA || keys.ArrowLeft || touchState.l) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight || touchState.r) ? 1 : 0);
  let hb = keys.Space ? 1 : 0, analog = false, nos = keys.KeyX ? 1 : 0;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads){
    if (!p) continue;
    const ax = p.axes[0] || 0;
    if (Math.abs(ax) > 0.15){ st = -Math.sign(ax) * Math.pow((Math.abs(ax) - 0.15) / 0.85, 1.4); analog = true; } // a big dead zone so a worn stick can't steer for you
    { const rx = p.axes[2] || 0, ry = p.axes[3] || 0; if (Math.abs(rx) > 0.2 || Math.abs(ry) > 0.2){ ORB.yaw -= rx * dt * 2.6; ORB.pitch = clamp(ORB.pitch + ry * dt * 1.4, -0.35, 1.0); ORB.idle = 0; } } // right stick: look around
    const rt = p.buttons[7] ? p.buttons[7].value : 0, lt = p.buttons[6] ? p.buttons[6].value : 0;
    if (rt > 0.03) thr = Math.max(thr, rt); if (lt > 0.03) brk = Math.max(brk, lt);
    if (p.buttons[0] && p.buttons[0].pressed) hb = 1;
    if (p.buttons[1] && p.buttons[1].pressed) nos = 1;
    input.rocket = !!(p.buttons[2] && p.buttons[2].pressed);
    const pressed = i => p.buttons[i] && p.buttons[i].pressed && !padPrev[i];
    if (pressed(5)) manualShift(1); if (pressed(4)) manualShift(-1);
    if (pressed(3)) opts.cam = (opts.cam + 1) % CAMS.length;
    if (pressed(9)) setPaused(!paused);
    if (pressed(8)) resetCar();
    padPrev = {}; p.buttons.forEach((b, i) => padPrev[i] = b.pressed);
    break;
  }
  input.thr = thr; input.brk = brk; input.hb = hb; input.nos = nos;
  if (analog) car.steerIn += (st - car.steerIn) * Math.min(1, dt * 18);
  else {
    // like a real wheel: it winds on progressively while you hold the key and unwinds smoothly back to the middle when you let go
    const rate = st !== 0 ? (Math.sign(st) !== Math.sign(car.steerIn) && car.steerIn !== 0 ? 5 : 2.6) : 3.2;
    const diff = st - car.steerIn, rr = rate * lerp(0.9, 1.9, clamp(Math.hypot(car.vx, car.vy) / 35, 0, 1)), ease = st !== 0 ? 1 : 0.35 + 0.65 * Math.min(1, Math.abs(car.steerIn) * 3);
    car.steerIn += clamp(diff, -rr * ease * dt, rr * ease * dt);
  }
}
let highBeam = false;
function yieldAhead(){ if (car.lastE) yieldFrom(car.lastE, car.lastS, car.sup && car.sup.e === car.lastE ? car.sup.d : 0, car.lastDir, 130); }
function resetCar(){ // R: back onto the nearest road, facing along it
  const q = nearestRoadPoint(car.x, car.z, car.sup && car.sup.kind === 'ground' ? undefined : car.y), e = q.e, r = edgeAt(e, q.s, {}), dir = e.oneway ? 1 : (Math.cos(angWrap(car.h - r.h)) >= 0 ? 1 : -1);
  const lane = e.oneway ? e.C.lanes - 1 : 0, d = laneD(e, dir, lane);
  placeCarWorld(r.x + r.nx * d, r.z + r.nz * d, dir > 0 ? r.h : r.h + Math.PI, r.y);
  run.combo = 0; run.mult = 1; car.fall = 0; car.wet = false; popup('BACK ON THE ROAD', 0, 'near');
  for (const c of traffic){ if (c.mode !== 'park' && Math.hypot(c.x - car.x, c.z - car.z) < 35) parkCar(c); }
}

// ---------- saves you can carry between devices: a file, or a code to paste
const saveBlob = () => JSON.stringify({ game: 'night-driver', v: 1, player: PLAYER, at: new Date().toISOString(), state: STATE });
const toCode = s => 'ND1-' + btoa(unescape(encodeURIComponent(s)));
function readSave(txt){ // a file's contents or a pasted code -> a state, or null
  try { txt = String(txt).trim(); if (txt.startsWith('ND1-')) txt = decodeURIComponent(escape(atob(txt.slice(4).replace(/\s+/g, ''))));
    const o = JSON.parse(txt); const st = o && o.game === 'night-driver' ? o.state : o; return st && typeof st === 'object' && typeof st.cash === 'number' ? st : null; } catch (e) { return null; } }
function loadSaveState(st){ STATE = Object.assign(STATE_DEFAULT(), st, { up: Object.assign(STATE_DEFAULT().up, st.up || {}) }); saveState(); location.reload(); }
function switchPlayer(name){ name = String(name || '').trim().toUpperCase().slice(0, 20); if (!name) return; saveState(); if (!PLAYERS.includes(name)) PLAYERS.push(name); LS_SET('nd-players', JSON.stringify(PLAYERS)); LS_SET('nd-player', name); location.reload(); }
LS_SET('nd-players', JSON.stringify(PLAYERS));
