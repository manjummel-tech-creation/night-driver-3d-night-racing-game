// =====================================================================================================
// THE COCKPIT: the view from the driver's seat (camera mode COCKPIT), left-hand drive, and a little bit from the future.
// Textured leather, carbon fibre, Alcantara and brushed metal; cyan and violet light running along the dash, doors,
// console and footwells; a glowing digital cluster with shift lights on the wheel; a screen set into the centre stack.
// Real glass in the windows, wipers that sweep the rain off, and side and rear-view mirrors that show what's behind.
// Your gloved hands hold the wheel; the right one goes to the gear lever on every shift. Shared by Night Driver and
// Night Highway: it needs pBody, car, opts, weather, DAY, pPaint, STRIPE, renderer, scene, sfx, canvasTex and started.
// =====================================================================================================
var CP_drawScreen = () => {}, CP_hang = null;
const CP = (() => {
  const g = new THREE.Group(); g.visible = false; pBody.add(g);
  // ---------- textures, drawn once
  const tex = (w, h, draw, rx = 1, ry = 1) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
  const noise = (c, w, h, base, amp, n) => { c.fillStyle = base; c.fillRect(0, 0, w, h); for (let k = 0; k < n; k++){ const v = Math.random() * amp | 0; c.fillStyle = `rgba(${v},${v},${v + 4},0.18)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
  const leatherT = tex(256, 256, (c) => { noise(c, 256, 256, '#26262c', 90, 9000); for (let k = 0; k < 400; k++){ c.strokeStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 0, TAU); c.stroke(); } }, 4, 4);
  const alcT = tex(256, 256, (c) => noise(c, 256, 256, '#1e1f25', 70, 16000), 6, 6);
  const carbonT = tex(64, 64, (c) => { for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8){ const on = ((x + y) / 8) % 2, gr = c.createLinearGradient(x, y, x + 8, y + 8); gr.addColorStop(0, on ? '#2c2f36' : '#131418'); gr.addColorStop(1, on ? '#17181d' : '#24262c'); c.fillStyle = gr; c.fillRect(x, y, 8, 8); } }, 8, 8);
  const brushT = tex(256, 64, (c) => { c.fillStyle = '#6d727c'; c.fillRect(0, 0, 256, 64); for (let k = 0; k < 600; k++){ const v = 80 + Math.random() * 90 | 0; c.strokeStyle = `rgba(${v},${v},${v + 6},0.35)`; c.beginPath(); const y = Math.random() * 64; c.moveTo(0, y); c.lineTo(256, y + Math.random() - 0.5); c.stroke(); } }, 2, 1);
  const LT = (map, c, e) => new THREE.MeshLambertMaterial({ map, color: c, emissive: e });
  const dashM = LT(leatherT, 0xffffff, 0x0b0b10), softM = LT(alcT, 0xffffff, 0x0a0a0e), leather = LT(leatherT, 0xd8d8e0, 0x0a0a0d), carbon = LT(carbonT, 0xffffff, 0x0c0d11), roofM = LT(alcT, 0xb0b0b8, 0x07070a), carpet = LT(alcT, 0x707078, 0x040405);
  const brushed = new THREE.MeshStandardMaterial({ map: brushT, metalness: 0.85, roughness: 0.35, emissive: 0x16181c }), chrome = new THREE.MeshStandardMaterial({ color: 0xc9d0d8, metalness: 1, roughness: 0.15, emissive: 0x1a1c20 });
  // ---------- light: two colours that run through the whole cabin
  const CY = 0x3de8ff, VI = 0xa55bff, glowC = new THREE.MeshBasicMaterial({ color: CY }), glowV = new THREE.MeshBasicMaterial({ color: VI }), ledW = new THREE.MeshBasicMaterial({ color: 0xe8f4ff });
  const haze = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const suit = new THREE.MeshLambertMaterial({ map: alcT, color: 0xd8dae0, emissive: 0x141418 }), glove = new THREE.MeshLambertMaterial({ map: leatherT, color: 0xffffff, emissive: 0x3a3c40 }), gloveDark = LT(carbonT, 0xffffff, 0x0e0e12);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; };
  const between = (geo, m, a, b, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.copy(a).add(b).multiplyScalar(0.5); o.scale.y = a.distanceTo(b); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); parent.add(o); return o; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const EYE = V(0.38, 1.2, -0.78), W = 0.93; // eyes a little further back and up; the cabin's half-width
  const across = (pts, width, m, x0 = 0, bevel = 0.012) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++){ const p = pts[i]; if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]); }
    const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 }); geo.translate(0, 0, -width / 2); geo.rotateY(-Math.PI / 2); return add(geo, m, x0, 0, 0); };
  // ---------- dashboard: a sculpted leather top, a carbon fibre band and a glowing lip that runs door to door
  across([[0.9, 0.9], [0.86, 0.945], [0.5, 0.965, 0.3, 0.95], [0.18, 0.945, 0.15, 0.9], [0.17, 0.82], [0.2, 0.62], [0.7, 0.6], [0.9, 0.9]], W * 2 - 0.04, dashM);
  add(new THREE.BoxGeometry(W * 2 - 0.1, 0.05, 0.012), carbon, 0, 0.87, 0.162);
  add(new THREE.BoxGeometry(W * 2 - 0.1, 0.006, 0.006), glowC, 0, 0.84, 0.158); add(new THREE.BoxGeometry(W * 2 - 0.1, 0.004, 0.004), glowV, 0, 0.928, 0.166);
  add(new THREE.PlaneGeometry(W * 2 - 0.2, 0.25), haze(CY, 0.05), 0, 0.72, 0.15, 0, Math.PI, 0); // light spilling down from the strip
  // the cluster: a glowing display seen through the top of the wheel, in a slim bezel (no hood: from the seat it looked like part of the rim)
  const gc = document.createElement('canvas'); gc.width = 1024; gc.height = 400; const gx = gc.getContext('2d'), gTex = new THREE.CanvasTexture(gc);
  add(new THREE.BoxGeometry(0.47, 0.19, 0.04), new THREE.MeshBasicMaterial({ color: 0x020306 }), EYE.x, 0.905, 0.174).rotation.set(-0.22, Math.PI, 0, 'YXZ');
  const gauge = add(new THREE.PlaneGeometry(0.44, 0.172), new THREE.MeshBasicMaterial({ map: gTex }), EYE.x, 0.905, 0.15); gauge.rotation.set(-0.22, Math.PI, 0, 'YXZ');
  const SOFF = new THREE.MeshBasicMaterial({ color: 0x14161c }), SG = new THREE.MeshBasicMaterial({ color: CY }), SV = new THREE.MeshBasicMaterial({ color: VI }), SR = new THREE.MeshBasicMaterial({ color: 0xff3d6e }), LIM = new THREE.MeshBasicMaterial({ color: 0xffffff }), SHIFT = [];
  function drawGauges(){
    const c = gx, kmh = Math.abs(car.vx) * 3.6, rpm = car.rpm || 900, rk = clamp((rpm - 800) / 7000, 0, 1);
    c.fillStyle = '#020309'; c.fillRect(0, 0, 1024, 400);
    c.strokeStyle = 'rgba(61,232,255,0.07)'; c.lineWidth = 1; for (let x = 0; x < 1024; x += 32){ c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 400); c.stroke(); } for (let y = 0; y < 400; y += 32){ c.beginPath(); c.moveTo(0, y); c.lineTo(1024, y); c.stroke(); }
    // the rev arc: a wide glowing sweep, cyan to violet to red near the limiter
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, cx = 512, cy = 250, R = 210;
    c.lineCap = 'round'; c.lineWidth = 18; c.strokeStyle = 'rgba(255,255,255,0.06)'; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
    const gr = c.createLinearGradient(cx - R, 0, cx + R, 0); gr.addColorStop(0, '#3de8ff'); gr.addColorStop(0.7, '#a55bff'); gr.addColorStop(1, '#ff3d6e');
    c.strokeStyle = gr; c.shadowColor = rk > 0.85 ? '#ff3d6e' : '#3de8ff'; c.shadowBlur = 24; c.beginPath(); c.arc(cx, cy, R, a0, a0 + (a1 - a0) * rk + 0.001); c.stroke(); c.shadowBlur = 0;
    c.fillStyle = 'rgba(200,230,255,0.75)'; c.font = '600 20px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let k = 0; k <= 8; k++){ const t = a0 + (a1 - a0) * k / 8; c.fillText(String(k), cx + Math.cos(t) * (R - 38), cy + Math.sin(t) * (R - 38)); }
    c.fillStyle = '#ffffff'; c.shadowColor = '#3de8ff'; c.shadowBlur = 18; c.font = '700 120px "Teko", "Chakra Petch", sans-serif'; c.fillText(String(Math.round(kmh)), cx, cy - 10); c.shadowBlur = 0;
    c.fillStyle = '#7fd9ff'; c.font = '600 22px "Chakra Petch", sans-serif'; c.fillText('KM/H', cx, cy + 58);
    c.fillStyle = '#c6a3ff'; c.font = '800 56px "Teko", "Chakra Petch", sans-serif'; c.fillText(car.gear < 0 ? 'R' : (opts.auto ? 'D' : 'M') + car.gear, cx, cy + 110);
    const bar = (x, label, v, col) => { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x, 120, 26, 200); c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 12; c.fillRect(x, 120 + 200 * (1 - v), 26, 200 * v); c.shadowBlur = 0; c.fillStyle = '#9fb4cc'; c.font = '600 18px "Chakra Petch", sans-serif'; c.fillText(label, x + 13, 345); };
    if (car.fuel !== undefined) bar(150, 'FUEL', clamp(car.fuel, 0, 1), '#3de8ff'); if (car.nitro !== undefined) bar(848, 'NOS', clamp(car.nitro, 0, 1), '#a55bff');
    if (weather.rain > 0.12){ c.fillStyle = '#3de8ff'; c.font = '700 18px "Chakra Petch", sans-serif'; c.fillText('WIPERS AUTO', 512, 30); }
    gTex.needsUpdate = true;
    // the shift lights across the top of the wheel
    const lim = rk > 0.94 && (performance.now() / 70 | 0) % 2;
    for (let k = 0; k < SHIFT.length; k++){ const on = rk > 0.55 + k * 0.045; SHIFT[k].material = lim ? LIM : on ? (k < 3 ? SG : k < 6 ? SV : SR) : SOFF; }
  }
  // ---------- the centre stack: glowing vent rings, a screen set into the dash, touch buttons, the start button
  add(new THREE.BoxGeometry(0.36, 0.42, 0.05), carbon, -0.03, 0.74, 0.175, -0.2, 0, 0);
  for (const vx of [-0.13, 0.07]){ add(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 24), new THREE.MeshBasicMaterial({ color: 0x030406 }), vx, 0.89, 0.155, Math.PI / 2 - 0.2, 0, 0);
    add(new THREE.TorusGeometry(0.054, 0.006, 8, 28), glowC, vx, 0.89, 0.142, -0.2, 0, 0); for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.09, 0.005, 0.01), brushed, vx, 0.89 + k * 0.016, 0.145, -0.2, 0, 0); }
  { add(new THREE.BoxGeometry(0.28, 0.17, 0.02), new THREE.MeshBasicMaterial({ color: 0x020306 }), -0.03, 0.765, 0.152, -0.2, 0, 0);
    add(new THREE.BoxGeometry(0.29, 0.004, 0.02), glowV, -0.03, 0.852, 0.15, -0.2, 0, 0);
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 300; const sx = sc.getContext('2d'), sTex = new THREE.CanvasTexture(sc);
    const plane = add(new THREE.PlaneGeometry(0.255, 0.148), new THREE.MeshBasicMaterial({ map: sTex }), -0.03, 0.765, 0.139); plane.rotation.set(-0.2, Math.PI, 0, 'YXZ');
    let lastMin = -1; CP_drawScreen = () => { const m = Math.floor((DAY.t || 0) * 60) % 1440; if (m === lastMin) return; lastMin = m;
      const gr = sx.createLinearGradient(0, 0, 512, 300); gr.addColorStop(0, '#0a1020'); gr.addColorStop(1, '#120a22'); sx.fillStyle = gr; sx.fillRect(0, 0, 512, 300);
      sx.strokeStyle = 'rgba(165,91,255,0.25)'; sx.lineWidth = 1; for (let k = 0; k < 14; k++){ sx.beginPath(); sx.moveTo(60 + k * 34, 0); sx.lineTo(20 + k * 34, 300); sx.stroke(); }
      sx.strokeStyle = 'rgba(61,232,255,0.7)'; sx.lineWidth = 4; sx.beginPath(); sx.moveTo(80, 270); sx.bezierCurveTo(160, 200, 220, 230, 300, 120); sx.lineTo(470, 40); sx.stroke(); // a glowing route on a map
      sx.fillStyle = '#3de8ff'; sx.beginPath(); sx.arc(300, 120, 9, 0, TAU); sx.fill();
      sx.fillStyle = '#e8f4ff'; sx.font = '600 26px "Chakra Petch", sans-serif'; sx.textAlign = 'left'; sx.fillText(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'), 400, 36);
      sx.fillStyle = 'rgba(10,14,28,0.85)'; sx.fillRect(0, 230, 512, 70); sx.fillStyle = '#a55bff'; sx.fillRect(20, 286, 300, 4); sx.fillStyle = '#c9d8ee'; sx.font = '600 18px "Chakra Petch", sans-serif'; sx.fillText('NOW PLAYING · NIGHT FM 88.3', 20, 262); sTex.needsUpdate = true; }; }
  for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.03, 0.012, 0.012), k % 2 ? glowV : glowC, -0.115 + k * 0.034, 0.655, 0.13, -0.2, 0, 0);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 20), new THREE.MeshBasicMaterial({ color: 0x220810 }), 0.17, 0.8, 0.15, Math.PI / 2 - 0.2, 0, 0); add(new THREE.TorusGeometry(0.022, 0.004, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff3d6e }), 0.17, 0.8, 0.143, -0.2, 0, 0); // start / stop, glowing red
  // ---------- console: carbon, a glowing seam down each side, the gear lever and its lit knob
  add(new THREE.BoxGeometry(0.28, 0.12, 0.95), carbon, -0.02, 0.5, -0.2); for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.004, 0.004, 0.9), glowC, -0.02 + s * 0.142, 0.555, -0.2);
  const lever = new THREE.Group(); lever.position.set(-0.02, 0.57, 0.02); g.add(lever);
  add(new THREE.ConeGeometry(0.05, 0.06, 12), leather, 0, 0.02, 0, 0, 0, 0, lever); add(new THREE.CylinderGeometry(0.009, 0.011, 0.12, 8), chrome, 0, 0.09, 0, 0, 0, 0, lever);
  add(new THREE.SphereGeometry(0.032, 14, 10), carbon, 0, 0.165, 0, 0, 0, 0, lever).scale.set(1, 0.85, 1.15); add(new THREE.TorusGeometry(0.03, 0.003, 6, 24), glowV, 0, 0.165, 0, Math.PI / 2, 0, 0, lever);
  add(new THREE.BoxGeometry(0.035, 0.03, 0.22), leather, -0.02, 0.575, -0.4, -0.12, 0, 0);
  // ---------- doors: Alcantara panels, leather armrests, a glowing line, brushed handles, switches; footwell glow
  for (const s of [1, -1]){ const x = s * (W - 0.02);
    add(new THREE.BoxGeometry(0.05, 0.52, 1.8), softM, x, 0.68, -0.32); add(new THREE.BoxGeometry(0.11, 0.05, 0.62), leather, x - s * 0.06, 0.68, -0.4);
    add(new THREE.BoxGeometry(0.004, 0.006, 1.5), s > 0 ? glowC : glowV, x - s * 0.028, 0.87, -0.32); add(new THREE.BoxGeometry(0.03, 0.02, 0.13), brushed, x - s * 0.03, 0.8, 0.18);
    if (s > 0) for (const z of [-0.5, -0.42]) add(new THREE.BoxGeometry(0.03, 0.012, 0.03), brushed, x - s * 0.1, 0.71, z);
    add(new THREE.BoxGeometry(0.06, 0.08, 0.5), dashM, x - s * 0.02, 0.92, 0.6);
    add(new THREE.PlaneGeometry(0.5, 0.5), haze(s > 0 ? CY : VI, 0.07), s * 0.4, 0.33, 0.25, -Math.PI / 2, 0, 0); }
  add(new THREE.BoxGeometry(W * 2, 0.04, 2.3), carpet, 0, 0.3, -0.3);
  // ---------- the glass: tinted side windows in thin frames, and a faint sheen on the windscreen
  const glassM = new THREE.MeshBasicMaterial({ color: 0x8fb0d8, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [1, -1]){ const x = s * (W + 0.02), wg = new THREE.Shape(); wg.moveTo(0.82, 0); wg.lineTo(-0.95, 0); wg.lineTo(-0.85, 0.3); wg.quadraticCurveTo(-0.4, 0.38, 0.05, 0.37); wg.lineTo(0.82, 0.02); wg.lineTo(0.82, 0);
    const win = new THREE.Mesh(new THREE.ShapeGeometry(wg, 8), glassM); win.rotation.y = -Math.PI / 2; win.position.set(x, 0.95, 0); g.add(win);
    add(new THREE.BoxGeometry(0.03, 0.025, 1.8), dashM, x - s * 0.01, 0.95, -0.07); add(new THREE.BoxGeometry(0.03, 0.025, 1.0), dashM, x - s * 0.01, 1.37, -0.45); }
  const sheen = add(new THREE.PlaneGeometry(1.8, 1.14), new THREE.MeshBasicMaterial({ color: 0x8fb0d8, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide }), 0, 1.09, 0.33);
  // ---------- pillars, the Alcantara roof with a glowing edge, visors, the mirror with an air freshener hanging from it
  for (const s of [-1, 1]) between(new THREE.CylinderGeometry(0.035, 0.05, 1, 10), dashM, V(s * (W - 0.07), 0.92, 0.84), V(s * (W - 0.17), 1.38, -0.24));
  add(new THREE.BoxGeometry(W * 2 - 0.1, 0.03, 1.35), roofM, 0, 1.39, -0.9); add(new THREE.BoxGeometry(W * 2 - 0.14, 0.03, 0.08), dashM, 0, 1.39, -0.25); add(new THREE.BoxGeometry(W * 2 - 0.2, 0.004, 0.004), glowV, 0, 1.372, -0.29);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.4, 0.022, 0.17), roofM, s * 0.38, 1.365, -0.22, 0.1, 0, 0);
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), dashM, 0.06, 1.32, -0.12);
  { const fr = canvasTex(64, 96, (c) => { c.fillStyle = '#f0e6c8'; c.fillRect(0, 0, 64, 96); c.fillStyle = '#2d6a3a'; c.beginPath(); c.moveTo(32, 8); c.lineTo(56, 80); c.lineTo(8, 80); c.fill(); c.fillStyle = '#5a3a20'; c.fillRect(28, 80, 8, 12); });
    const hang = new THREE.Group(); hang.position.set(0.06, 1.25, -0.12); g.add(hang); add(new THREE.CylinderGeometry(0.0015, 0.0015, 0.07, 4), ledW, 0, -0.035, 0, 0, 0, 0, hang);
    add(new THREE.PlaneGeometry(0.045, 0.068), new THREE.MeshBasicMaterial({ map: fr, side: THREE.DoubleSide, color: 0x9a9a9a }), 0, -0.1, 0, 0, Math.PI, 0, hang); CP_hang = hang; }
  // ---------- mirrors that work: little cameras render what's behind into their glass, one mirror per frame
  const mkMirror = (w, h, fov, aspect, pos, yaw, mx, my, mz, gw, gh, gry) => { const rt = new THREE.WebGLRenderTarget(w, h); rt.texture.wrapS = THREE.RepeatWrapping; rt.texture.repeat.x = -1; rt.texture.offset.x = 1;
    const cam2 = new THREE.PerspectiveCamera(fov, aspect, 0.5, 420); cam2.position.copy(pos); cam2.rotation.set(-0.04, yaw, 0, 'YXZ'); pBody.add(cam2);
    const glass = add(new THREE.PlaneGeometry(gw, gh), new THREE.MeshBasicMaterial({ map: rt.texture, color: 0xd8dde4 }), mx, my, mz); glass.rotation.set(0, Math.PI + gry, 0); return { rt, cam: cam2, glass }; };
  const MIRRORS = []; // no mirrors inside the car: the rear-view strip at the top of the screen does the job (and it's cheaper)
  function renderMirrors(){}
  // ---------- the bonnet ahead (the outside body is hidden in this view), with its stripes
  { const s = new THREE.Shape(); s.moveTo(-0.9, 0); s.lineTo(-0.82, -1.35); s.quadraticCurveTo(0, -1.45, 0.82, -1.35); s.lineTo(0.9, 0); s.lineTo(-0.9, 0); add(new THREE.ShapeGeometry(s, 8), pPaint, 0, 0.93, 0.86, -Math.PI / 2 + 0.12, 0, 0);
    for (const x of [-0.13, 0.13]){ const st = new THREE.Shape(); st.moveTo(x - 0.06, 0); st.lineTo(x - 0.06, -1.36); st.lineTo(x + 0.06, -1.36); st.lineTo(x + 0.06, 0); add(new THREE.ShapeGeometry(st), STRIPE, 0, 0.934, 0.86, -Math.PI / 2 + 0.12, 0, 0); } }
  // ---------- the wipers: two arms parked along the bottom of the windscreen that sweep with the rain
  const WSQ = (() => { const up = V(0, 0.42, -1.08).normalize(), xa = V(-1, 0, 0), n = V().crossVectors(xa, up); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, up, n)); })();
  const wipers = []; { const frame = new THREE.Group(); frame.quaternion.copy(WSQ); frame.position.set(0, 1.08, 0.33); g.add(frame); const L = 300 / 384 * 1.14, armM = new THREE.MeshLambertMaterial({ color: 0x0b0c10, emissive: 0x050608 });
    for (const px of [150, 400]){ const pv = new THREE.Group(); pv.position.set(px / 512 * 1.42 - 0.71, -0.555, 0.012); frame.add(pv);
      add(new THREE.BoxGeometry(L, 0.012, 0.012).translate(L / 2, 0, 0), armM, 0, 0, 0, 0, 0, 0, pv); add(new THREE.BoxGeometry(L * 0.9, 0.008, 0.02).translate(L * 0.55, 0.008, 0), armM, 0, 0, 0, 0, 0, 0, pv); wipers.push(pv); } }
  // ---------- the driver: knees in a white race suit
  for (const s of [-1, 1]){ const hip = V(EYE.x + s * 0.11, 0.47, -0.62), knee = V(EYE.x + s * 0.13, 0.6, 0.02), foot = V(EYE.x + s * 0.12, 0.28, 0.45);
    between(new THREE.CylinderGeometry(0.068, 0.078, 1, 12), suit, hip, knee); between(new THREE.CylinderGeometry(0.055, 0.068, 1, 12), suit, knee, foot); add(new THREE.SphereGeometry(0.07, 12, 8), suit, knee.x, knee.y, knee.z); }
  // ---------- the wheel: flat-bottomed, leather and carbon, a glowing badge, shift lights across the top
  const wheel = new THREE.Group(); wheel.position.set(EYE.x, 0.86, 0.06); wheel.rotation.set(0.38, Math.PI, 0); g.add(wheel);
  const spin = new THREE.Group(); wheel.add(spin);
  { const pts = []; for (let k = 0; k < 64; k++){ const a = k / 64 * TAU; let x = Math.cos(a) * 0.19, y = Math.sin(a) * 0.19; if (y < -0.15){ x *= 1 + (-0.15 - y) * 1.2; y = -0.15; } pts.push(V(x, y, 0)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, 0.027, 10, true), leather, 0, 0, 0, 0, 0, 0, spin); }
  add(new THREE.TorusGeometry(0.19, 0.0035, 6, 20, 0.35), glowC, 0, 0, -0.026, 0, 0, Math.PI / 2 - 0.175, spin); // a cyan marker at twelve o'clock
  for (const a of [0, Math.PI]){ add(new THREE.BoxGeometry(0.12, 0.05, 0.02), carbon, Math.cos(a) * 0.1, -0.01, -0.005, 0, 0, 0, spin);
    for (let k = 0; k < 4; k++) add(new THREE.CircleGeometry(0.008, 10), k === 0 ? glowC : k === 1 ? glowV : ledW, Math.cos(a) * (0.075 + (k % 2) * 0.03), k < 2 ? 0.01 : -0.018, -0.017, 0, Math.PI, 0, spin); }
  add(new THREE.BoxGeometry(0.035, 0.11, 0.02), carbon, 0, -0.1, -0.005, 0, 0, 0, spin);
  add(new THREE.CylinderGeometry(0.072, 0.078, 0.05, 28), leather, 0, -0.005, -0.012, Math.PI / 2, 0, 0, spin);
  { const bt = canvasTex(128, 128, (c) => { c.fillStyle = '#05070c'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#3de8ff'; c.shadowColor = '#3de8ff'; c.shadowBlur = 14; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 46, 0, TAU); c.stroke(); c.fillStyle = '#e8f4ff'; c.font = '900 52px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', 64, 68); });
    add(new THREE.CircleGeometry(0.03, 24), new THREE.MeshBasicMaterial({ map: bt }), 0, 0, -0.039, 0, Math.PI, 0, spin); }
  add(new THREE.BoxGeometry(0.17, 0.022, 0.02), carbon, 0, 0.12, -0.012, 0, 0, 0, spin); for (let k = 0; k < 9; k++) SHIFT.push(add(new THREE.BoxGeometry(0.012, 0.01, 0.006), SOFF, -0.064 + k * 0.016, 0.12, -0.024, 0, 0, 0, spin));
  add(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 10), dashM, 0, 0, 0.16, Math.PI / 2, 0, 0, wheel);
  // ---------- hands: racing gloves wrapped round the rim; arms in the white suit back to your shoulders
  const mkHand = s => { const h = new THREE.Group(); g.add(h);
    add(new THREE.SphereGeometry(1, 14, 10), glove, 0.012, 0, 0.012, 0, 0, 0, h).scale.set(0.038, 0.052, 0.03);
    for (let k = 0; k < 4; k++) add(new THREE.TorusGeometry(0.03, 0.0105, 6, 12, Math.PI * 1.35), glove, 0, -0.03 + k * 0.019, 0, Math.PI / 2, 0, -0.6, h);
    add(new THREE.BoxGeometry(0.03, 0.06, 0.012), gloveDark, 0.034, 0, -0.004, 0, 0, 0, h); add(new THREE.BoxGeometry(0.004, 0.05, 0.013), glowC, 0.034, 0, -0.011, 0, 0, 0, h);
    add(new THREE.CylinderGeometry(0.011, 0.013, 0.05, 8), glove, -0.022, s * 0.032, 0.018, 0.4, 0, s * 0.9, h);
    const cuff = add(new THREE.CylinderGeometry(0.032, 0.034, 1, 12), gloveDark, 0, 0, 0), arm = add(new THREE.CylinderGeometry(0.036, 0.046, 1, 12), suit, 0, 0, 0), up = add(new THREE.CylinderGeometry(0.046, 0.055, 1, 12), suit, 0, 0, 0);
    return { s, h, cuff, arm, up, elbow: V(EYE.x - s * 0.31, 0.64, -0.36), shoulder: V(EYE.x - s * 0.21, 0.97, -0.86), ang: s > 0 ? 0.28 : Math.PI - 0.28 }; };
  const hands = [mkHand(1), mkHand(-1)]; // s = 1 is your right hand (it does the gear changes)
  const shift = { t: 9, dir: 1, gear: 1 };
  let wT = 0, gT = 0;
  // ---------- the windscreen: rain on a transparent canvas just inside the glass; the wiper arms wipe it
  const wc = document.createElement('canvas'); wc.width = 512; wc.height = 384; const wx = wc.getContext('2d'), wTex = new THREE.CanvasTexture(wc);
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 1.14), new THREE.MeshBasicMaterial({ map: wTex, transparent: true, depthWrite: false, fog: false })); g.add(shield);
  shield.quaternion.copy(WSQ); shield.position.set(0, 1.08, 0.32); sheen.quaternion.copy(WSQ); sheen.position.set(0, 1.08, 0.335);
  const drops = [], WIPERS = [{ px: 150, len: 300 }, { px: 400, len: 300 }], wip = { a: 0.06, dir: 1, wait: 0 };
  function drawShield(dt){
    const rain = weather.rain, sp = Math.abs(car.vx);
    const n = rain > 0.05 ? rain * (14 + sp * 0.5) * dt : 0; for (let k = 0; k < n + (Math.random() < n % 1 ? 1 : 0); k++) drops.push({ x: Math.random() * 512, y: Math.random() * 384, r: 1.2 + Math.random() * Math.random() * 3.2 * (0.6 + rain), a: 0.3 + Math.random() * 0.4 });
    for (const d of drops){ if (sp > 8) d.y -= sp * dt * (0.4 + d.r * 0.06); }
    const on = rain > 0.12, speed = rain > 0.5 ? 2.6 : 1.7, prev = wip.a;
    if (on || wip.a > 0.06){ if (wip.wait > 0) wip.wait -= dt; else { wip.a += wip.dir * speed * dt; if (wip.a > 2.5){ wip.a = 2.5; wip.dir = -1; sfx.bump(0.6); } if (wip.a < 0.06){ wip.a = 0.06; wip.dir = 1; wip.wait = rain > 0.5 ? 0 : 0.9; } } }
    for (const pv of wipers) pv.rotation.z = Math.PI - wip.a; // the arms follow the same sweep
    const lo = Math.min(prev, wip.a), hi = Math.max(prev, wip.a);
    for (let i = drops.length - 1; i >= 0; i--){ const d = drops[i]; if (d.y < -10){ drops.splice(i, 1); continue; }
      for (const Wp of WIPERS){ const dx = d.x - Wp.px, dy = 384 - d.y, r = Math.hypot(dx, dy), a = Math.atan2(dy, -dx); if (r < Wp.len && a >= lo - 0.05 && a <= hi + 0.05){ drops.splice(i, 1); break; } } }
    if (drops.length > 1400) drops.splice(0, drops.length - 1400);
    wT -= dt; if (wT > 0) return; wT = 1 / 24;
    wx.clearRect(0, 0, 512, 384);
    if (weather.wet > 0.05){ wx.fillStyle = 'rgba(150,165,185,' + (0.1 * weather.wet + 0.08 * rain) + ')'; wx.fillRect(0, 0, 512, 384); }
    for (const d of drops){ const gr = wx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r); gr.addColorStop(0, 'rgba(255,255,255,' + d.a + ')'); gr.addColorStop(0.6, 'rgba(160,180,210,' + d.a * 0.5 + ')'); gr.addColorStop(1, 'rgba(20,30,40,' + d.a * 0.6 + ')'); wx.fillStyle = gr; wx.beginPath(); wx.ellipse(d.x, d.y, d.r * 0.8, d.r, 0, 0, TAU); wx.fill(); }
    wTex.needsUpdate = true;
  }
  return { g, EYE, wheel, spin, hands, lever, shift, MIRRORS, renderMirrors, drawGauges, drawShield, ang: 0, angV: 0, look: 0, sway: 0,
    tick(dt){ gT -= dt; if (gT <= 0){ gT = 1 / 15; drawGauges(); CP_drawScreen(); } drawShield(dt); renderMirrors(); } };
})();
// ---------- each frame in the cockpit
let cpWas = false;
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _pA = new THREE.Vector3(), _qA = new THREE.Quaternion(), _sA = new THREE.Vector3(), _pB = new THREE.Vector3(), _qB = new THREE.Quaternion(), _wr = new THREE.Vector3();
const LEVER_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.25, Math.PI, 0.35, 'YXZ'));
function updateCockpit(dt){
  const on = opts.cam >= 4 && started;
  if (on !== cpWas){ cpWas = on; // swap the outside of the car for the inside, and put everything back after
    for (const o of pBody.children){ if (o === CP.g || o.isCamera) continue; if (on){ o.userData.vis = o.visible; o.visible = false; } else if (o.userData.vis !== undefined) o.visible = o.userData.vis; } }
  CP.g.visible = on; if (!on) return;
  // the wheel follows your steering through a little spring, so it winds on and unwinds smoothly like a real one
  const target = car.steerIn * 2.4, k = 60, c = 13; CP.angV += ((target - CP.ang) * k - CP.angV * c) * dt; CP.ang += CP.angV * dt; CP.spin.rotation.z = CP.ang;
  CP.wheel.updateMatrix(); CP.spin.updateMatrix();
  // a gear change: the right hand goes to the lever, pushes it, and comes back to the wheel
  const S = CP.shift; if (car.gear !== S.gear){ S.dir = car.gear > S.gear ? 1 : -1; S.gear = car.gear; S.t = S.t < 0.6 ? Math.min(S.t, 0.18) : 0; } S.t += dt;
  const reach = S.t < 0.18 ? smooth(0, 0.18, S.t) : S.t < 0.36 ? 1 : 1 - smooth(0.36, 0.62, S.t), push = S.t > 0.16 && S.t < 0.4 ? Math.sin((S.t - 0.16) / 0.24 * Math.PI) : 0;
  CP.lever.rotation.x = -S.dir * 0.3 * push; CP.lever.updateMatrix();
  for (const H of CP.hands){
    _m1.makeRotationZ(H.ang).setPosition(Math.cos(H.ang) * 0.19, Math.sin(H.ang) * 0.19, 0); _m2.multiplyMatrices(CP.wheel.matrix, CP.spin.matrix).multiply(_m1); _m2.decompose(_pA, _qA, _sA);
    if (H.s > 0 && reach > 0){ _pB.set(0, 0.2, -0.01).applyMatrix4(CP.lever.matrix); _qB.copy(LEVER_Q); _pA.lerp(_pB, reach); _qA.slerp(_qB, reach); _pA.y += Math.sin(reach * Math.PI) * 0.05; }
    H.h.position.copy(_pA); H.h.quaternion.copy(_qA);
    _wr.set(0, 0, 0.075).applyQuaternion(_qA).add(_pA);
    spanM(H.cuff, _pA, _wr); spanM(H.arm, _wr, H.elbow); spanM(H.up, H.elbow, H.shoulder);
  }
  if (CP_hang){ CP_hang.rotation.z = lerp(CP_hang.rotation.z, clamp(-car.ayF * 0.02, -0.5, 0.5), Math.min(1, dt * 3)); CP_hang.rotation.x = lerp(CP_hang.rotation.x, clamp(car.axF * 0.015, -0.4, 0.4), Math.min(1, dt * 3)); } // the air freshener swings
  CP.tick(dt);
}
const _su = new THREE.Vector3(0, 1, 0), _sw = new THREE.Vector3();
function spanM(m, a, b){ m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(1, Math.max(0.001, a.distanceTo(b)), 1); m.quaternion.setFromUnitVectors(_su, _sw.copy(b).sub(a).normalize()); }
// the cockpit's field of view: never narrower than about 80 degrees across, so tall or narrow windows don't squash the view
function cockpitFov(aspect, spd){ const vMin = 2 * Math.atan(Math.tan(80 * Math.PI / 360) / Math.max(0.3, aspect)) * 180 / Math.PI; return Math.max(56, vMin) + clamp(spd * 3.6 - 60, 0, 240) * 0.03; }
