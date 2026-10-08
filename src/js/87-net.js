// =====================================================================================================
// ONLINE: drive the same map with friends. One of you makes a room (a 5-letter code), the others join it with the code.
// Every car's position goes through a public message relay (MQTT over a secure websocket), so it works between any two
// networks: home wifi, school wifi, phone hotspots. (The old direct browser-to-browser link was blocked by most routers,
// which is why friends ended up alone in "the same" room.) If one relay is down, the next one is tried.
// Each car sends where it is 10 times a second; friends' cars are ghosts you drive through, each with a name tag, and
// show on your map too. Everything else (traffic, police, money, the hunt) stays your own.
// =====================================================================================================
const NDNET = { mode: 'solo', clis: [], code: '', id: '', q: 0, lastQ: new Map(), others: new Map(), live: false };
const ND_VER = 2;                                  // only cars from the same version of the game see each other
const ND_MQTT_SRC = ['https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js', 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js'];
// every relay at once: each player may only be able to reach some of them (school and work networks often block the
// unusual ports), so messages go out on all of them and any one relay you both reach is enough. shiftr uses port 443,
// the normal web port, which is almost never blocked
const ND_BROKERS = [{ url: 'wss://broker.hivemq.com:8884/mqtt' }, { url: 'wss://public.cloud.shiftr.io:443', username: 'public', password: 'public' }, { url: 'wss://test.mosquitto.org:8081/mqtt' }, { url: 'wss://broker.emqx.io:8084/mqtt' }];
const ndTopic = () => 'night-driver-v' + ND_VER + '/room/' + NDNET.code;
const ndNow = () => performance.now() / 1000;
function ndLoadLib(){ return new Promise((ok, bad) => { if (window.mqtt) return ok(); let i = 0; const next = () => { if (i >= ND_MQTT_SRC.length) return bad(new Error('no mqtt')); const sc = document.createElement('script'); sc.src = ND_MQTT_SRC[i++]; sc.onload = () => window.mqtt ? ok() : next(); sc.onerror = next; document.head.appendChild(sc); }; next(); }); }
function ndStatus(t){ const el = $('ndNet'); if (el) el.innerHTML = t; }
const ndMyName = () => (($('ndName') && $('ndName').value) || (typeof PLAYER === 'string' && PLAYER) || 'DRIVER').toUpperCase().slice(0, 14);
const ndState = () => ({ t: 's', v: ND_VER, id: NDNET.id, n: ndMyName(), c: CARV.id, col: pPaint.color.getHex(), x: +car.x.toFixed(2), y: +car.y.toFixed(2), z: +car.z.toFixed(2), h: +car.h.toFixed(4), v2: +car.vx.toFixed(2), st: +car.steerIn.toFixed(2), s: STATE.stars || 0 });
const ndRelaysUp = () => NDNET.clis.filter(c => c.connected && c.ndSub).length;
function ndSend(m){ m.q = ++NDNET.q; const msg = JSON.stringify(m); for (const c of NDNET.clis) if (c.connected && c.ndSub) try { c.publish(ndTopic(), msg, { qos: 0 }); } catch (e) {} }
function ndConnectAll(){
  return new Promise(ok => {
    let done = false; const fin = r => { if (!done){ done = true; ok(r); } };
    // (no 'last will' message: one relay dropping must not count as you leaving the room)
    ND_BROKERS.forEach((B, bi) => { let c;
      try { c = mqtt.connect(B.url, { clientId: 'nd-' + NDNET.id + '-' + bi, username: B.username, password: B.password, clean: true, connectTimeout: 8000, reconnectPeriod: 4000, keepalive: 30 }); } catch (e) { return; }
      NDNET.clis.push(c);
      c.on('connect', () => { c.subscribe(ndTopic(), { qos: 0 }, err => { if (err) return; c.ndSub = true; NDNET.live = true; ndSend({ t: 'hi', v: ND_VER, id: NDNET.id }); ndSend(ndState()); ndRoomStatus(); fin(true); }); });
      c.on('close', () => { c.ndSub = false; if (NDNET.live) ndRoomStatus(); });
      c.on('error', () => {});
      c.on('message', (topic, buf) => { let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; } ndOnData(m); }); });
    setTimeout(() => fin(ndRelaysUp() > 0), 12000);
  });
}
// your position goes out 10 times a second on its own timer, so it keeps going while you're paused or on the map
setInterval(() => { if (NDNET.live && NDNET.mode !== 'solo') ndSend(ndState()); }, 100);
function ndRoomStatus(){ const n = NDNET.others.size, r = ndRelaysUp(); ndStatus('In room <b>' + NDNET.code + '</b> (' + r + ' of ' + ND_BROKERS.length + ' relays) · ' + (n ? n + (n > 1 ? ' friends' : ' friend') + ' here · press J to jump to them' : 'waiting for friends: send them the code') + ' · everyone needs this same game file'); }
async function ndStart(code, host){
  try { await ndLoadLib(); } catch (e) { ndStatus('Couldn\'t load the online part (no internet?). Check your connection and try again.'); return false; }
  NDNET.code = code; NDNET.id = Math.random().toString(36).slice(2, 10); NDNET.mode = host ? 'host' : 'client';
  ndStatus((host ? 'Making room <b>' : 'Joining room <b>') + code + '</b>…');
  const ok = await ndConnectAll();
  if (!ok){ NDNET.mode = 'solo'; ndStatus('Couldn\'t reach any of the online relays. Your internet (or a school/work filter) may be blocking them. Try another network or a phone hotspot.'); return false; }
  ndRoomStatus(); return true;
}
function ndHost(){ const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; return ndStart(Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''), true); }
function ndJoin(code){ code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length !== 5){ ndStatus('Room codes have 5 letters.'); return Promise.resolve(false); } return ndStart(code, false); }
function ndOnData(m){
  if (!m || typeof m !== 'object' || m.id === NDNET.id) return;
  if (typeof m.q === 'number'){ if (m.q <= (NDNET.lastQ.get(m.id) || 0)) return; NDNET.lastQ.set(m.id, m.q); } // the same message through two relays only counts once
  if (m.v !== ND_VER){ ndStatus('Someone in room <b>' + NDNET.code + '</b> has a different version of the game. Everyone needs the same, newest file.'); return; }
  if (m.t === 'bye'){ if (NDNET.others.has(m.id)){ toast(String(NDNET.others.get(m.id).name) + ' LEFT', 'ROOM ' + NDNET.code, '#8d96ab'); ndDrop(m.id); ndRoomStatus(); } return; }
  if (m.t === 'hi'){ ndSend(ndState()); return; } // a newcomer: tell them where we are straight away
  if (m.t === 's'){ const fresh = !NDNET.others.has(m.id); m.v = m.v2; ndGot(m); if (fresh){ toast(String(m.n) + ' IS IN THE ROOM', 'PRESS J TO JUMP TO THEM', '#3de8ff'); ndRoomStatus(); } }
}
function ndLeave(){ if (NDNET.clis.length){ ndSend({ t: 'bye', v: ND_VER, id: NDNET.id }); for (const c of NDNET.clis) try { c.end(); } catch (e) {} } }
addEventListener('pagehide', ndLeave);
// a friend's car: the same car as yours in their paint colour, with a name tag over it
function ndGot(st){
  let o = NDNET.others.get(st.id);
  if (!o || o.col !== st.col || o.kind !== st.c){ if (o) ndDrop(st.id); const A = makeAICar(st.col, st.c); A.mesh.visible = true; A.mark.visible = false;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 64, (g, w, h) => { g.fillStyle = 'rgba(5,8,18,0.72)'; g.fillRect(0, 8, w, 48); g.fillStyle = '#3de8ff'; g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(st.n).slice(0, 14), w / 2, 33); }), depthWrite: false, transparent: true, fog: false }));
    tag.position.set(0, 2.5, 0); tag.scale.set(3.2, 0.8, 1); A.mesh.add(tag);
    o = { id: st.id, kind: st.c, col: st.col, grp: A.mesh, wheels: A.wheels, buf: [], name: st.n }; NDNET.others.set(st.id, o); }
  o.name = st.n; o.stars = st.s; o.last = ndNow(); o.buf.push({ t: ndNow(), x: st.x, y: st.y, z: st.z, h: st.h, v: st.v, st: st.st }); if (o.buf.length > 14) o.buf.shift();
}
function ndDrop(id){ const o = NDNET.others.get(id); if (!o) return; scene.remove(o.grp); o.grp.traverse(x => { if (x.isSprite){ x.material.map.dispose(); x.material.dispose(); } }); NDNET.others.delete(id); }
function updateNdNet(dt){
  if (NDNET.mode === 'solo') return;
  const now = ndNow();
  for (const [id, o] of NDNET.others){ if (now - o.last > 8){ ndDrop(id); continue; }
    const tR = now - 0.25, B = o.buf; let a = B[0], b = B[B.length - 1]; for (let i = 0; i < B.length - 1; i++) if (B[i].t <= tR && B[i + 1].t >= tR){ a = B[i]; b = B[i + 1]; break; }
    const k = b.t > a.t ? clamp((tR - a.t) / (b.t - a.t), 0, 1.5) : 1; o.grp.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k)); o.grp.rotation.set(0, a.h + angWrap(b.h - a.h) * k, 0);
    for (const w of o.wheels){ w.spin.rotation.x += b.v / 0.34 * dt; w.pivot.rotation.y = w.front ? clamp((b.st || 0) * 0.45, -0.5, 0.5) : 0; } }
  // the room list in the corner
  const el = $('ndPlayers'); if (el){ el.hidden = false; el.innerHTML = '<div class="h">ROOM ' + NDNET.code + (NDNET.live && !ndRelaysUp() ? ' · RECONNECTING' : '') + '</div>' + [{ n: ndMyName() + ' (YOU)', d: 0 }, ...[...NDNET.others.values()].map(o => ({ n: o.name, d: Math.hypot(o.grp.position.x - car.x, o.grp.position.z - car.z) }))].map(r => `<div class="p"><span>${String(r.n).replace(/[<>&]/g, '')}</span><span>${r.d ? (r.d > 1000 ? (r.d / 1000).toFixed(1) + ' km' : Math.round(r.d) + ' m') : ''}</span></div>`).join(''); }
}
// J: drop in right behind the next friend, on their road, at their speed
let ndJumpI = 0;
function ndJumpToFriend(){ const L = [...NDNET.others.values()]; if (!L.length){ toast('NOBODY TO JUMP TO', NDNET.mode === 'solo' ? 'HOST OR JOIN A ROOM IN THE MENU' : 'WAITING FOR FRIENDS', '#8d96ab'); return; }
  const o = L[ndJumpI++ % L.length], p = o.grp.position, h = o.grp.rotation.y, q = nearestRoadPoint(p.x - Math.sin(h) * 25, p.z - Math.cos(h) * 25);
  if (q){ let hh = edgeAt(q.e, q.s, {}).h; if (Math.cos(angWrap(hh - h)) < 0) hh += Math.PI; placeCarWorld(q.x, q.z, hh, q.y); } else placeCarWorld(p.x - Math.sin(h) * 25, p.z - Math.cos(h) * 25, h, p.y);
  car.vx = clamp(o.buf.length ? o.buf[o.buf.length - 1].v || 0 : 0, 0, 40); toast('WITH ' + o.name, 'DRIVE TOGETHER', '#3de8ff'); }
addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat && started && !(e.target && e.target.tagName === 'INPUT')) ndJumpToFriend(); });
// the menu buttons
{ const hb = $('ndHost'), jb = $('ndJoin'), nm = $('ndName'), cd = $('ndCode');
  if (nm){ try { nm.value = localStorage.getItem('nd-net-name') || ''; } catch (e) {} nm.addEventListener('change', () => { try { localStorage.setItem('nd-net-name', nm.value); } catch (e) {} }); }
  if (cd) cd.addEventListener('keydown', e => { if (e.key === 'Enter') jb && jb.click(); });
  const lock = on => { if (hb) hb.disabled = on; if (jb) jb.disabled = on; };
  if (hb) hb.addEventListener('click', async () => { if (NDNET.mode !== 'solo') return; lock(true); const ok = await ndHost(); lock(false); if (ok){ hb.textContent = 'ROOM ' + NDNET.code; if (cd) cd.value = NDNET.code; } });
  if (jb) jb.addEventListener('click', async () => { if (NDNET.mode !== 'solo') return; lock(true); const ok = await ndJoin(cd && cd.value); lock(false); if (ok){ jb.textContent = 'IN ' + NDNET.code; if (hb) hb.textContent = 'ROOM ' + NDNET.code; } }); }
