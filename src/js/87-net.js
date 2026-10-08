// =====================================================================================================
// ONLINE: drive the same map with friends. One of you hosts a room (a 5-letter code), the others join it. Browsers talk
// to each other directly (WebRTC through PeerJS; its free server only introduces them). Each car sends where it is 15
// times a second and the host passes everyone's positions round. Friends' cars are ghosts you drive through, each with
// a name tag, on your map too. Everything else (traffic, police, money, the hunt) stays your own.
// =====================================================================================================
const NDNET = { mode: 'solo', peer: null, conns: [], host: null, code: '', id: '', sendT: 0, others: new Map(), name: '' };
const ND_PEER_SRC = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const ndNow = () => performance.now() / 1000;
function ndLoadPeer(){ return new Promise((ok, bad) => { if (window.Peer) return ok(); const sc = document.createElement('script'); sc.src = ND_PEER_SRC; sc.onload = () => ok(); sc.onerror = () => bad(new Error('no PeerJS')); document.head.appendChild(sc); }); }
function ndStatus(t){ const el = $('ndNet'); if (el) el.innerHTML = t; }
const ndMyName = () => (($('ndName') && $('ndName').value) || (typeof PLAYER === 'string' && PLAYER) || 'DRIVER').toUpperCase().slice(0, 14);
const ndState = () => ({ t: 's', id: NDNET.id, n: ndMyName(), c: CARV.id, col: pPaint.color.getHex(), x: +car.x.toFixed(2), y: +car.y.toFixed(2), z: +car.z.toFixed(2), h: +car.h.toFixed(4), v: +car.vx.toFixed(2), st: +car.steerIn.toFixed(2), s: STATE.stars || 0 });
async function ndHost(){
  try { await ndLoadPeer(); } catch (e) { ndStatus('Couldn\'t reach the online service. Check your connection and try again.'); return false; }
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; NDNET.code = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join('');
  return new Promise(ok => { const peer = new Peer('ndr-' + NDNET.code, { debug: 0 }); NDNET.peer = peer; NDNET.mode = 'host';
    peer.on('open', id => { NDNET.id = id; ndStatus('ROOM <b>' + NDNET.code + '</b> · send this code to your friends'); ok(true); });
    peer.on('connection', conn => { conn.on('open', () => { NDNET.conns.push(conn); toast('A FRIEND JOINED', 'ROOM ' + NDNET.code, '#3de8ff'); });
      conn.on('data', m => ndOnData(m, conn)); conn.on('close', () => { NDNET.conns = NDNET.conns.filter(c => c !== conn); }); });
    peer.on('error', e => { if (e.type === 'unavailable-id'){ peer.destroy(); ndHost().then(ok); } else { ndStatus('Online error: ' + (e.type || e.message)); ok(false); } }); });
}
async function ndJoin(code){
  code = String(code || '').trim().toUpperCase(); if (code.length !== 5){ ndStatus('Room codes have 5 letters.'); return false; }
  try { await ndLoadPeer(); } catch (e) { ndStatus('Couldn\'t reach the online service. Check your connection and try again.'); return false; }
  return new Promise(ok => { const peer = new Peer(undefined, { debug: 0 }); NDNET.peer = peer; NDNET.mode = 'client'; NDNET.code = code;
    peer.on('open', id => { NDNET.id = id; ndStatus('Joining room <b>' + code + '</b>…'); const conn = peer.connect('ndr-' + code, { reliable: false, serialization: 'json' }); NDNET.host = conn;
      const fail = setTimeout(() => { ndStatus('No room <b>' + code + '</b> answered. Check the code, and that your friend is still in the room.'); ok(false); }, 9000);
      conn.on('open', () => { clearTimeout(fail); ndStatus('In room <b>' + code + '</b> · press J to jump to a friend'); ok(true); }); conn.on('data', m => ndOnData(m, conn));
      conn.on('close', () => { toast('LEFT THE ROOM', 'THE HOST CLOSED IT', '#ff3d6e'); NDNET.mode = 'solo'; NDNET.host = null; for (const id of [...NDNET.others.keys()]) ndDrop(id); }); });
    peer.on('error', e => { ndStatus(e.type === 'peer-unavailable' ? 'No room <b>' + code + '</b> found. Check the code.' : 'Online error: ' + (e.type || e.message)); ok(false); }); });
}
function ndOnData(m, conn){
  if (!m || typeof m !== 'object') return;
  if (m.t === 's' && NDNET.mode === 'host'){ conn.pid = m.id; ndGot(m); }
  if (m.t === 'w'){ for (const st of m.p) if (st.id !== NDNET.id) ndGot(st); for (const id of [...NDNET.others.keys()]) if (!m.p.some(q => q.id === id)) ndDrop(id); }
}
// a friend's car: the same car as yours in their paint colour, with a name tag over it
function ndGot(st){
  let o = NDNET.others.get(st.id);
  if (!o || o.col !== st.col || o.kind !== st.c){ if (o) ndDrop(st.id); const A = makeAICar(st.col, st.c); A.mesh.visible = true; A.mark.visible = false;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 64, (g, w, h) => { g.fillStyle = 'rgba(5,8,18,0.72)'; g.fillRect(0, 8, w, 48); g.fillStyle = '#3de8ff'; g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(st.n).slice(0, 14), w / 2, 33); }), depthWrite: false, transparent: true, fog: false }));
    tag.position.set(0, 2.5, 0); tag.scale.set(3.2, 0.8, 1); A.mesh.add(tag);
    o = { id: st.id, kind: st.c, col: st.col, grp: A.mesh, wheels: A.wheels, buf: [], name: st.n }; NDNET.others.set(st.id, o); if (NDNET.mode === 'host') toast(String(st.n) + ' IS HERE', 'PRESS J TO JUMP TO THEM', '#3de8ff'); }
  o.name = st.n; o.stars = st.s; o.last = ndNow(); o.buf.push({ t: ndNow(), x: st.x, y: st.y, z: st.z, h: st.h, v: st.v, st: st.st }); if (o.buf.length > 14) o.buf.shift();
}
function ndDrop(id){ const o = NDNET.others.get(id); if (!o) return; scene.remove(o.grp); o.grp.traverse(x => { if (x.isSprite){ x.material.map.dispose(); x.material.dispose(); } }); NDNET.others.delete(id); }
function updateNdNet(dt){
  if (NDNET.mode === 'solo') return;
  const now = ndNow(); NDNET.sendT -= dt;
  if (NDNET.sendT <= 0){ NDNET.sendT = 1 / 15;
    if (NDNET.mode === 'host'){ const all = [ndState(), ...[...NDNET.others.values()].map(o => { const b = o.buf[o.buf.length - 1]; return b ? { id: o.id, n: o.name, c: o.kind, col: o.col, x: b.x, y: b.y, z: b.z, h: b.h, v: b.v, st: b.st, s: o.stars } : null; }).filter(Boolean)];
      for (const c of NDNET.conns) if (c.open) c.send({ t: 'w', p: all }); }
    else if (NDNET.host && NDNET.host.open) NDNET.host.send(ndState()); }
  for (const [id, o] of NDNET.others){ if (now - o.last > 6){ ndDrop(id); continue; }
    const tR = now - 0.15, B = o.buf; let a = B[0], b = B[B.length - 1]; for (let i = 0; i < B.length - 1; i++) if (B[i].t <= tR && B[i + 1].t >= tR){ a = B[i]; b = B[i + 1]; break; }
    const k = b.t > a.t ? clamp((tR - a.t) / (b.t - a.t), 0, 1.5) : 1; o.grp.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k)); o.grp.rotation.set(0, a.h + angWrap(b.h - a.h) * k, 0);
    for (const w of o.wheels){ w.spin.rotation.x += b.v / 0.34 * dt; w.pivot.rotation.y = w.front ? clamp((b.st || 0) * 0.45, -0.5, 0.5) : 0; } }
  // the room list in the corner
  const el = $('ndPlayers'); if (el){ el.hidden = false; el.innerHTML = '<div class="h">ROOM ' + NDNET.code + '</div>' + [{ n: ndMyName() + ' (YOU)', d: 0 }, ...[...NDNET.others.values()].map(o => ({ n: o.name, d: Math.hypot(o.grp.position.x - car.x, o.grp.position.z - car.z) }))].map(r => `<div class="p"><span>${String(r.n).replace(/[<>&]/g, '')}</span><span>${r.d ? (r.d > 1000 ? (r.d / 1000).toFixed(1) + ' km' : Math.round(r.d) + ' m') : ''}</span></div>`).join(''); }
}
// J: drop in right behind the next friend, on their road, at their speed
let ndJumpI = 0;
function ndJumpToFriend(){ const L = [...NDNET.others.values()]; if (!L.length){ toast('NOBODY TO JUMP TO', NDNET.mode === 'solo' ? 'HOST OR JOIN A ROOM IN THE MENU' : 'WAITING FOR FRIENDS', '#8d96ab'); return; }
  const o = L[ndJumpI++ % L.length], p = o.grp.position, h = o.grp.rotation.y, q = nearestRoadPoint(p.x - Math.sin(h) * 25, p.z - Math.cos(h) * 25);
  if (q){ let hh = edgeAt(q.e, q.s, {}).h; if (Math.cos(angWrap(hh - h)) < 0) hh += Math.PI; placeCarWorld(q.x, q.z, hh, q.y); } else placeCarWorld(p.x - Math.sin(h) * 25, p.z - Math.cos(h) * 25, h, p.y);
  car.vx = clamp(o.buf.length ? o.buf[o.buf.length - 1].v : 0, 0, 40); toast('WITH ' + o.name, 'DRIVE TOGETHER', '#3de8ff'); }
addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat && started && !(e.target && e.target.tagName === 'INPUT')) ndJumpToFriend(); });
// the menu buttons
{ const hb = $('ndHost'), jb = $('ndJoin'), nm = $('ndName');
  if (nm){ try { nm.value = localStorage.getItem('nd-net-name') || ''; } catch (e) {} nm.addEventListener('change', () => { try { localStorage.setItem('nd-net-name', nm.value); } catch (e) {} }); }
  if (hb) hb.addEventListener('click', async () => { if (NDNET.mode !== 'solo') return; hb.disabled = true; const ok = await ndHost(); hb.disabled = false; if (ok) hb.textContent = 'ROOM ' + NDNET.code; });
  if (jb) jb.addEventListener('click', async () => { if (NDNET.mode !== 'solo') return; jb.disabled = true; const ok = await ndJoin($('ndCode').value); jb.disabled = false; if (ok) jb.textContent = 'IN ' + NDNET.code; }); }
