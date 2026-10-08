// =====================================================================================================
// CARS: traffic models, your car, physics. The car model and arcade handling come straight from Midnight Weave.
// =====================================================================================================
// ---------- traffic vehicle types
const TYPES = {
  sedan: { len: 4.7, wid: 1.82, mass: 1550, w: 0.26 },
  hatch: { len: 4.1, wid: 1.76, mass: 1250, w: 0.15 },
  suv:   { len: 4.85, wid: 1.96, mass: 2150, w: 0.18 },
  van:   { len: 5.3, wid: 2.0, mass: 2700, w: 0.08 },
  truck: { len: 11.5, wid: 2.5, mass: 14000, w: 0.11, big: true },
  kei:   { len: 3.4, wid: 1.48, mass: 850, w: 0.13 },        // tall little box cars
  wagon: { len: 4.8, wid: 1.8, mass: 1600, w: 0.08 },        // estates with roof rails
  coupe: { len: 4.5, wid: 1.84, mass: 1400, w: 0.07 },        // low sports cars with a lip spoiler
  taxi:  { len: 4.7, wid: 1.76, mass: 1500, w: 0.08 },        // sedans with the lit roof sign
  pickup:{ len: 5.3, wid: 1.95, mass: 2000, w: 0.06 },
  ktruck:{ len: 3.4, wid: 1.48, mass: 900, w: 0.06 },         // kei trucks: tiny cab-over flatbeds
  bus:   { len: 11, wid: 2.5, mass: 12000, w: 0.03, big: true },
};
// some types come in their own colours (taxis, buses, work trucks); the rest use the everyday traffic colours
const TYPE_COLORS = { truck: [0xd8d8d8, 0xb0b4ba, 0x2a4b7a, 0x8a1d1d], taxi: [0xe8b11c, 0x15161a, 0x2f6b3a, 0xdcdcdc, 0xe8b11c], bus: [0xdedede, 0x2a6fb5, 0x2f8a4a, 0xd8a21c],
  ktruck: [0xeeeeee, 0xeeeeee, 0xc9cdd2, 0x2a4b7a], coupe: [0xc8141c, 0x1f5fd1, 0xe8e8e8, 0x15161a, 0xe8b11c, 0x7fbf1e], kei: [0xf3efe4, 0xe8e8e8, 0x9fc6d6, 0xd9b88a, 0xc94f5a, 0x7c9a6a, 0x1b1d22] };
function buildType(name){
  const t = TYPES[name], L = t.len, W = t.wid, hl = L / 2, hw = W / 2;
  const body = [], glass = [], wheels = [], tail = [], head = [];
  const wr = name === 'truck' || name === 'bus' ? 0.52 : name === 'van' || name === 'suv' || name === 'pickup' ? 0.37 : name === 'kei' || name === 'ktruck' ? 0.27 : 0.32;
  if (name === 'bus'){
    body.push(boxG(W, 2.7, L, 0, 0.45 + 1.35, 0));
    body.push(boxG(W - 0.3, 0.18, L - 2, 0, 3.24, -0.4));                                  // roof pod
    for (const x of [-1, 1]) glass.push(boxG(0.06, 0.95, L - 2.4, x * (hw + 0.005), 2.25, -0.5));
    glass.push(boxG(W - 0.2, 1.5, 0.08, 0, 2.0, hl + 0.01)); glass.push(boxG(W - 0.4, 0.7, 0.08, 0, 2.45, -hl - 0.01));
    head.push(boxG(W - 0.6, 0.26, 0.05, 0, 2.95, hl + 0.02));                              // the lit destination sign
    for (const z of [hl - 2.3, -hl + 2.6]) for (const x of [-1, 1]) wheels.push(wheelG(wr, 0.4, x * (hw - 0.25), z));
    for (const x of [-1, 1]){ tail.push(boxG(0.22, 0.4, 0.05, x * (hw - 0.2), 1.1, -hl - 0.01)); head.push(boxG(0.34, 0.18, 0.05, x * (hw - 0.35), 0.8, hl + 0.02)); }
  } else if (name === 'truck'){
    body.push(boxG(W - 0.1, 2.3, 2.3, 0, 0.75 + 1.15, hl - 1.15));
    body.push(boxG(W, 3.0, L - 2.8, 0, 1.05 + 1.5, -1.4));
    body.push(boxG(W - 0.3, 0.3, L - 1, 0, 0.8, -0.3));
    glass.push(boxG(W - 0.3, 0.9, 0.08, 0, 2.35, hl + 0.01));
    for (const z of [hl - 1.2, -hl + 1.4, -hl + 2.6]) for (const x of [-1, 1]) wheels.push(wheelG(wr, 0.4, x * (hw - 0.25), z));
    for (const x of [-1, 1]){ tail.push(boxG(0.3, 0.14, 0.05, x * (hw - 0.3), 1.0, -hl - 0.01)); tail.push(boxG(0.12, 0.12, 0.05, x * (hw - 0.1), 3.95, -hl + 0.02)); head.push(boxG(0.32, 0.2, 0.05, x * (hw - 0.35), 1.1, hl + 0.02)); }
    tail.push(boxG(0.8, 0.1, 0.05, 0, 3.95, -hl + 0.02));
  } else {
    const tall = name === 'suv' ? 0.2 : name === 'van' ? 0.35 : name === 'pickup' ? 0.16 : name === 'kei' || name === 'ktruck' ? 0.1 : name === 'coupe' ? -0.14 : 0;
    const beltY = 0.98 + tall, base = 0.3 + Math.max(0, tall) * 0.4;
    body.push(boxG(W, beltY - base, L, 0, (beltY + base) / 2, 0));
    body.push(boxG(W - 0.04, 0.12, L - 0.25, 0, beltY + 0.06, 0));
    let cabL, cabZ, cabH;
    if (name === 'sedan' || name === 'taxi'){ cabL = L * 0.45; cabZ = -0.15; cabH = 0.48; }
    else if (name === 'kei'){ cabL = L * 0.7; cabZ = -0.3; cabH = 0.66; }
    else if (name === 'wagon'){ cabL = L * 0.6; cabZ = -0.55; cabH = 0.5; }
    else if (name === 'coupe'){ cabL = L * 0.38; cabZ = -0.3; cabH = 0.4; }
    else if (name === 'pickup'){ cabL = 1.7; cabZ = hl - 2.25; cabH = 0.62; }
    else if (name === 'ktruck'){ cabL = 1.05; cabZ = hl - 0.65; cabH = 0.78; }
    else if (name === 'hatch'){ cabL = L * 0.55; cabZ = -0.35; cabH = 0.52; }
    else if (name === 'suv'){ cabL = L * 0.6; cabZ = -0.45; cabH = 0.62; }
    else { cabL = L * 0.78; cabZ = -0.45; cabH = 0.9; }
    glass.push(boxG(W - 0.2, cabH, cabL, 0, beltY + 0.1 + cabH / 2, cabZ));
    body.push(boxG(W - 0.16, 0.08, cabL - 0.3, 0, beltY + 0.12 + cabH, cabZ - 0.05));
    if (name === 'taxi'){ head.push(boxG(0.5, 0.16, 0.22, 0, beltY + cabH + 0.24, cabZ)); }                        // roof sign, lit like a lamp
    if (name === 'wagon') for (const x of [-1, 1]) body.push(boxG(0.05, 0.05, cabL - 0.4, x * (hw - 0.22), beltY + cabH + 0.2, cabZ));
    if (name === 'coupe') body.push(boxG(W - 0.3, 0.05, 0.3, 0, beltY + 0.16, -hl + 0.2));
    if (name === 'pickup' || name === 'ktruck'){ const bl = name === 'ktruck' ? L - 1.3 : L - 2.45; for (const x of [-1, 1]) body.push(boxG(0.06, 0.32, bl, x * (hw - 0.03), beltY + 0.16, -hl + bl / 2)); body.push(boxG(W, 0.32, 0.06, 0, beltY + 0.16, -hl + 0.03)); }
    const wz = name === 'kei' || name === 'ktruck' ? 0.6 : 0.95;
    for (const z of [hl - wz, -hl + wz]) for (const x of [-1, 1]) wheels.push(wheelG(wr, 0.24, x * (hw - 0.14), z));
    for (const x of [-1, 1]){
      tail.push(boxG(0.42, 0.13, 0.05, x * (hw - 0.3), beltY - 0.12, -hl - 0.01));
      head.push(boxG(0.4, 0.11, 0.05, x * (hw - 0.3), beltY - 0.2, hl + 0.01));
    }
  }
  return { body: merge(body), glass: merge(glass), wheels: merge(wheels), tail: merge(tail), head: merge(head) };
}
const TYPE_GEO = {}; for (const k in TYPES) TYPE_GEO[k] = buildType(k);
const M_GLASS = new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 0.9, roughness: 0.1 });
const M_TIRE = new THREE.MeshLambertMaterial({ color: 0x0d0d0f });
const M_HEAD = new THREE.MeshBasicMaterial({ color: 0xfff1d8, fog: false });
const PAINT_CACHE = {};
const paintMat = hex => PAINT_CACHE[hex] || (PAINT_CACHE[hex] = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.5, roughness: 0.35 }));
const TRAFFIC_COLORS = [0xe8e8e8, 0xd9dcdf, 0xa9adb3, 0x6e737a, 0x1b1d22, 0x14233f, 0x7a1b1b, 0x2d3a2e, 0xbfb39a, 0x8f2f1a, 0x29506d];
const TAIL_DIM = new THREE.Color(0.55, 0.04, 0.06), TAIL_BRAKE = new THREE.Color(1, 0.3, 0.26), HAZ = new THREE.Color(1, 0.55, 0.05);

// ---------- player car
const player = new THREE.Group();
const pBody = new THREE.Group(); player.add(pBody);
const PAINTS = [
  { name: 'Bayside Blue', hex: 0x1f5fd1 }, { name: 'Candy Red', hex: 0xb5121b }, { name: 'Midnight Purple', hex: 0x3d1d63 },
  { name: 'Pearl White', hex: 0xe9e9ec }, { name: 'Gunmetal', hex: 0x3a3f46 }, { name: 'Lime Rush', hex: 0x7fbf1e },
  { name: 'Chrome', hex: 0xd4dbe2, secret: 'paint:CHROME', metal: 1, rough: 0.06 }, { name: 'Matte Black', hex: 0x121315, secret: 'paint:MATTE BLACK', metal: 0.05, rough: 0.92 }, { name: 'Pearl Gold', hex: 0xd6ad48, secret: 'paint:PEARL GOLD', metal: 0.8, rough: 0.2 }, { name: 'Kage Black', hex: 0x0b0a12, secret: 'paint:KAGE BLACK', metal: 0.9, rough: 0.12 }, { name: 'Jukai Moss', hex: 0x2f4a2a, secret: 'paint:JUKAI MOSS', metal: 0.35, rough: 0.55 },
];
const pPaint = new THREE.MeshStandardMaterial({ color: PAINTS[0].hex, metalness: 0.6, roughness: 0.26, envMapIntensity: 1.3 });
const pBlack = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, metalness: 0.3, roughness: 0.65 });
const CARBON = new THREE.MeshStandardMaterial({ color: 0x16171b, metalness: 0.55, roughness: 0.3, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); for (let y = 0; y < 32; y += 4) for (let x = 0; x < 32; x += 4){ g.fillStyle = ((x + y) / 4) % 2 ? '#2a2c31' : '#121316'; g.fillRect(x, y, 4, 4); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); return t; })() });
const STRIPE = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.4, roughness: 0.35 });
const FLAME_MAT = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 1, 32, 32, 30); gr.addColorStop(0, 'rgba(200,230,255,1)'); gr.addColorStop(0.3, 'rgba(255,170,60,0.9)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() });
FLAME_MAT.visible = false;
let flameT = 0;
// visible crash damage on your car: the nose crumples, the lip and canards droop, a headlight dies, the paint dulls
const DMGV = { level: 0, base: null, mesh: null, parts: null, deadLight: new THREE.MeshBasicMaterial({ color: 0x1c1c1c }) };
function applyDamageVisual(dmg){
  if (!DMGV.mesh){
    DMGV.mesh = CARV.body.children[0]; DMGV.mesh.geometry = DMGV.mesh.geometry.clone(); // your own copy, so AI cars stay clean
    DMGV.base = DMGV.mesh.geometry.attributes.position.array.slice();
    DMGV.parts = CARV.body.children.filter(o => o.isMesh && o.position.z > 1.9).map(o => ({ o, p: o.position.clone(), r: o.rotation.clone(), m: o.material }));
  }
  const pos = DMGV.mesh.geometry.attributes.position, b = DMGV.base;
  for (let i = 0; i < pos.count; i++){
    const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2], f = smooth(1.1, 2.4, z) * dmg, n = hash2(i * 7 + 3, 11) - 0.5;
    pos.setXYZ(i, x + n * 0.07 * f, y - (0.09 + n * 0.09) * f, z - (0.4 + n * 0.14) * f);
  }
  pos.needsUpdate = true; DMGV.mesh.geometry.computeVertexNormals();
  DMGV.parts.forEach(({ o, p, r, m }, k) => {
    const n1 = hash2(k, 5) - 0.5, n2 = hash2(k, 9) - 0.5;
    o.position.set(p.x + n1 * 0.08 * dmg, p.y - 0.12 * dmg * (0.5 + hash2(k, 3)), p.z - 0.32 * dmg);
    o.rotation.set(r.x + n2 * 0.5 * dmg, r.y, r.z + n1 * 0.6 * dmg);
    if (m === M_HEAD) o.material = dmg > 0.3 && k % 2 === 0 ? DMGV.deadLight : M_HEAD;
  });
  pPaint.roughness = (PAINTS[STATE.paint] && PAINTS[STATE.paint].rough !== undefined ? PAINTS[STATE.paint].rough : 0.26) + dmg * 0.45;
}
const pTail = new THREE.MeshBasicMaterial({ color: TAIL_DIM.clone(), fog: false });
const pWheels = [];
(() => {
  const B = new THREE.Group(); B.name = 'car-raijin'; pBody.add(B); // the RAIJIN GT body (the other two cars are built further down)
  const s = new THREE.Shape(), y0 = 0.3;
  s.moveTo(-2.22, 0.32);
  s.lineTo(-1.32 - 0.42, y0); s.absarc(-1.32, y0, 0.42, Math.PI, 0, true);
  s.lineTo(1.38 - 0.42, y0); s.absarc(1.38, y0, 0.42, Math.PI, 0, true);
  s.lineTo(2.16, y0); s.quadraticCurveTo(2.34, 0.32, 2.33, 0.5);
  s.quadraticCurveTo(2.3, 0.67, 2.02, 0.72); s.lineTo(0.95, 0.9); s.lineTo(-1.15, 0.95);
  s.quadraticCurveTo(-2.05, 0.99, -2.28, 0.92); s.quadraticCurveTo(-2.36, 0.7, -2.22, 0.32);
  const bg = new THREE.ExtrudeGeometry(s, { depth: 1.76, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 });
  bg.translate(0, 0, -0.88); bg.rotateY(-Math.PI / 2);
  B.add(new THREE.Mesh(bg, pPaint));
  const c = new THREE.Shape();
  c.moveTo(-1.6, 0.9); c.lineTo(0.88, 0.88); c.quadraticCurveTo(0.25, 1.27, -0.2, 1.3); c.lineTo(-0.9, 1.29); c.quadraticCurveTo(-1.65, 1.22, -2.0, 0.95); c.lineTo(-1.6, 0.9);
  const cg = new THREE.ExtrudeGeometry(c, { depth: 1.34, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 3, curveSegments: 8 });
  cg.translate(0, 0, -0.67); cg.rotateY(-Math.PI / 2);
  B.add(new THREE.Mesh(cg, M_GLASS));
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.95), pPaint); roof.position.set(0, 1.335, -0.55); B.add(roof);
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); B.add(o); return o; };
  add(new THREE.BoxGeometry(1.92, 0.05, 0.3), pBlack, 0, 0.27, 2.2);
  add(new THREE.BoxGeometry(1.7, 0.18, 0.3), pBlack, 0, 0.33, -2.2);
  add(new THREE.BoxGeometry(1.75, 0.16, 2.4), pBlack, 0, 0.24, 0.03);
  for (const x of [-1, 1]){
    add(new THREE.BoxGeometry(0.42, 0.07, 0.12), M_HEAD, x * 0.64, 0.64, 2.24);
    add(new THREE.BoxGeometry(0.05, 0.46, 0.16), CARBON, x * 0.5, 1.12, -2.02);
    add(new THREE.BoxGeometry(0.16, 0.09, 0.2), pPaint, x * 1.0, 1.0, 0.7);
    const ex = add(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 1, roughness: 0.3 }), x * 0.45, 0.3, -2.3);
    ex.rotation.x = Math.PI / 2;
  }
  add(new THREE.BoxGeometry(2.0, 0.05, 0.46), CARBON, 0, 1.36, -2.08);
  for (const x of [-1, 1]) add(new THREE.BoxGeometry(0.025, 0.3, 0.6), CARBON, x * 1.0, 1.31, -2.08);
  add(new THREE.BoxGeometry(1.94, 0.03, 0.08), STRIPE, 0, 1.39, -1.88);
  // body kit: front lip, canards, side skirts, diffuser fins, hood vents
  add(new THREE.BoxGeometry(2.02, 0.04, 0.38), CARBON, 0, 0.23, 2.26);
  for (const x of [-1, 1]){ const cn = add(new THREE.BoxGeometry(0.3, 0.02, 0.18), CARBON, x * 0.93, 0.44, 2.12); cn.rotation.z = x * 0.25; }
  for (const x of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.11, 2.2), CARBON, x * 0.98, 0.27, 0.03);
  for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.02, 0.16, 0.34), CARBON, k * 0.3, 0.3, -2.3);
  for (const x of [-1, 1]){ const v = add(new THREE.BoxGeometry(0.34, 0.025, 0.42), pBlack, x * 0.38, 0.85, 1.25); v.rotation.x = 0.16; }
  // twin racing stripes over hood, roof and deck
  for (const x of [-0.17, 0.17]){
    const h1 = add(new THREE.BoxGeometry(0.2, 0.012, 1.1), STRIPE, x, 0.825, 1.48); h1.rotation.x = 0.165;
    add(new THREE.BoxGeometry(0.2, 0.012, 0.95), STRIPE, x, 1.36, -0.55);
    add(new THREE.BoxGeometry(0.2, 0.012, 0.95), STRIPE, x, 0.99, -1.62);
    add(new THREE.BoxGeometry(0.2, 0.012, 0.3), STRIPE, x, 0.6, 2.33).rotation.x = -1.2;
  }
  // round quad taillights
  for (const x of [-0.72, -0.46, 0.46, 0.72]){ const tl = add(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 18), pTail, x, 0.78, -2.33); tl.rotation.x = Math.PI / 2; }
  // underglow and exhaust flames
  for (const x of [-0.45, 0.45]){ const f = new THREE.Sprite(FLAME_MAT); f.position.set(x, 0.3, -2.55); f.scale.set(0.55, 0.55, 1); B.add(f); }
  add(new THREE.BoxGeometry(1.62, 0.05, 0.05), pTail, 0, 0.8, -2.31);
  for (const x of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.09, 0.05), pTail, x * 0.72, 0.76, -2.3);

  const tireG = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 26); tireG.rotateZ(Math.PI / 2);
  const rimG = new THREE.CylinderGeometry(0.235, 0.235, 0.265, 22); rimG.rotateZ(Math.PI / 2);
  const rimM = new THREE.MeshStandardMaterial({ color: 0x3a2c14, metalness: 0.9, roughness: 0.3 });
  const spokeM = new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 1, roughness: 0.22 });
  const calM = new THREE.MeshStandardMaterial({ color: 0xd8141c, emissive: 0x3a0000, roughness: 0.4 });
  for (const [x, z, front] of [[0.8, 1.38, 1], [-0.8, 1.38, 1], [0.8, -1.32, 0], [-0.8, -1.32, 0]]){
    const pivot = new THREE.Group(); pivot.position.set(x, 0.34, z); player.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(new THREE.Mesh(tireG, M_TIRE)); spin.add(new THREE.Mesh(rimG, rimM));
    const outer = Math.sign(x) * 0.136;
    for (let k = 0; k < 10; k++){ const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.44, 0.032), spokeM); sp.position.x = outer; sp.rotation.x = k / 10 * Math.PI; spin.add(sp); }
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.012, 6, 28), spokeM); lip.rotation.y = Math.PI / 2; lip.position.x = outer; spin.add(lip);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.22), calM); cal.position.set(Math.sign(x) * 0.08, 0.12, -0.12); pivot.add(cal);
    pWheels.push({ pivot, spin, front });
  }
})();
scene.add(player);
const headLamp = new THREE.SpotLight(0xfff0d8, 2.6, 140, 0.48, 0.55, 1.2);
headLamp.position.set(0, 0.7, 2.0); headLamp.target.position.set(0, -0.6, 30);
player.add(headLamp, headLamp.target);
const glowL = new THREE.PointLight(0xff2a2a, 0.5, 5, 2); glowL.position.set(0, 0.7, -2.8); player.add(glowL);
const flareMat = new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 });
const FLARES = []; for (const x of [-0.64, 0.64]){ const f = new THREE.Sprite(flareMat); f.position.set(x, 0.64, 2.32); f.scale.set(1.6, 1.6, 1); player.add(f); FLARES.push(f); }

// ---------- the three cars you can pick. Same paint, same wheels and lights, but their own body and their own feel:
// tq = engine pull, m = weight, cd = drag (top speed), lat = cornering grip, slide = how loose a handbrake drift is, turn = how sharp it steers
const CAR_MODELS = {
  raijin: { name: 'RAIJIN GT', kind: 'TUNED COUPE', desc: 'The all-rounder. Good at everything, stripes and a big wing.', tq: 1, m: 1420, cd: 1, lat: 0, slide: 1, turn: 1, trac: 1.25,
    bars: { POWER: 7, 'TOP SPEED': 7, GRIP: 7, DRIFT: 6 }, wx: 0.8, wf: 1.38, wr: -1.32, ws: 1, lamp: [0.64, 0.64, 2.32] },
  kaze: { name: 'KAZE 86', kind: 'LIGHT HATCH', desc: 'Tiny, light and twitchy. Slower in a straight line, the king of the mountain drift.', tq: 0.7, m: 1040, cd: 1.12, lat: 4, slide: 0.72, turn: 1.14, trac: 1.1,
    bars: { POWER: 4, 'TOP SPEED': 5, GRIP: 8, DRIFT: 10 }, wx: 0.72, wf: 1.22, wr: -1.2, ws: 0.92, lamp: [0.55, 0.52, 2.12] },
  oni: { name: 'ONI V12', kind: 'WEDGE SUPERCAR', desc: 'Huge power and the fastest on the highway. Heavy, so brake early in the hills.', tq: 1.5, m: 1680, cd: 0.84, lat: -2, slide: 1.15, turn: 0.92, trac: 1.5,
    bars: { POWER: 10, 'TOP SPEED': 10, GRIP: 6, DRIFT: 5 }, wx: 0.8, wf: 1.45, wr: -1.42, ws: 1.05, lamp: [0.6, 0.57, 2.36] },
};
const CARV = { k: CAR_MODELS.raijin, id: 'raijin', body: pBody.children.find(o => o.name === 'car-raijin') };
const carShape = (pts, depth, bevel) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)){ if (p.length === 3) s.absarc(p[0], 0.3, p[2], Math.PI, 0, true); else s.lineTo(p[0], p[1]); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelSegments: 2, curveSegments: 8 }); g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2); return g; };
// KAZE 86: a boxy little hatchback, two-tone panda paint, pop-up lamps and a ducktail
(() => {
  const B = new THREE.Group(); B.name = 'car-kaze'; B.visible = false; pBody.add(B);
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); B.add(o); return o; };
  B.add(new THREE.Mesh(carShape([[-2.0, 0.32], [-1.6, 0.3], [-1.2, 0, 0.4], [0.82, 0.3], [1.22, 0, 0.4], [1.95, 0.3], [2.08, 0.42], [2.06, 0.66], [0.7, 0.84], [-1.9, 0.9], [-2.04, 0.74]], 1.6, 0.05), pPaint));
  B.add(new THREE.Mesh(carShape([[-1.86, 0.88], [0.66, 0.84], [-0.05, 1.32], [-1.12, 1.33], [-1.96, 0.93]], 1.34, 0.06), M_GLASS));
  add(new THREE.BoxGeometry(1.08, 0.04, 0.98), pPaint, 0, 1.365, -0.58);
  add(new THREE.BoxGeometry(1.72, 0.2, 1.6), pBlack, 0, 0.42, 0.01); // black lower doors and bumpers: the two-tone panda look
  add(new THREE.BoxGeometry(1.7, 0.2, 0.22), pBlack, 0, 0.4, 2.06); add(new THREE.BoxGeometry(1.7, 0.2, 0.22), pBlack, 0, 0.4, -2.04);
  for (const x of [-1, 1]){
    const pu = add(new THREE.BoxGeometry(0.42, 0.07, 0.3), pPaint, x * 0.55, 0.74, 1.82); pu.rotation.x = 0.12; // pop-up lamp lids
    add(new THREE.BoxGeometry(0.3, 0.08, 0.04), M_HEAD, x * 0.55, 0.52, 2.1);
    add(new THREE.BoxGeometry(0.12, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: 0xffa020, fog: false }), x * 0.8, 0.56, 2.08);
    add(new THREE.BoxGeometry(0.012, 0.05, 2.7), STRIPE, x * 0.84, 0.66, 0.1);
    add(new THREE.BoxGeometry(0.14, 0.08, 0.16), pPaint, x * 0.86, 0.95, 0.62);
  }
  add(new THREE.BoxGeometry(1.42, 0.12, 0.04), pTail, 0, 0.72, -2.11);
  add(new THREE.BoxGeometry(0.5, 0.13, 0.045), pBlack, 0, 0.72, -2.115);
  const duck = add(new THREE.BoxGeometry(1.3, 0.035, 0.24), CARBON, 0, 0.96, -1.97); duck.rotation.x = -0.28;
  const ex = add(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 1, roughness: 0.3 }), 0.5, 0.3, -2.08); ex.rotation.x = Math.PI / 2;
})();
// ONI V12: a long, low, wide wedge with a cab-forward bubble, side intakes and a big rear wing
(() => {
  const B = new THREE.Group(); B.name = 'car-oni'; B.visible = false; pBody.add(B);
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); B.add(o); return o; };
  B.add(new THREE.Mesh(carShape([[-2.3, 0.34], [-1.86, 0.3], [-1.42, 0, 0.44], [1.01, 0.3], [1.45, 0, 0.44], [2.25, 0.3], [2.42, 0.42], [2.36, 0.58], [1.1, 0.86], [-1.9, 1.0], [-2.34, 0.96]], 1.76, 0.06), pPaint));
  B.add(new THREE.Mesh(carShape([[-1.6, 0.96], [1.15, 0.86], [0.1, 1.27], [-0.7, 1.28], [-1.6, 1.0]], 1.24, 0.06), M_GLASS));
  add(new THREE.BoxGeometry(0.9, 0.03, 0.78), pPaint, 0, 1.305, -0.3);
  for (let k = 0; k < 5; k++){ const l = add(new THREE.BoxGeometry(1.1, 0.025, 0.06), pBlack, 0, 1.03 - k * 0.006, -1.72 - k * 0.11); l.rotation.x = -0.05; } // engine-cover louvres
  for (const x of [-1, 1]){
    const it = add(new THREE.BoxGeometry(0.06, 0.26, 0.66), pBlack, x * 0.93, 0.72, -0.62); it.rotation.y = x * 0.12;
    const hl = add(new THREE.BoxGeometry(0.46, 0.05, 0.14), M_HEAD, x * 0.6, 0.57, 2.3); hl.rotation.x = -0.3;
    add(new THREE.BoxGeometry(0.04, 0.34, 0.12), CARBON, x * 0.52, 1.17, -2.02);
    add(new THREE.BoxGeometry(0.03, 0.2, 0.5), CARBON, x * 0.91, 1.33, -2.06);
    add(new THREE.BoxGeometry(0.1, 0.1, 2.3), CARBON, x * 0.91, 0.3, 0.02);
  }
  add(new THREE.BoxGeometry(1.84, 0.05, 0.44), CARBON, 0, 1.36, -2.06);
  add(new THREE.BoxGeometry(1.82, 0.03, 0.42), CARBON, 0, 0.25, 2.3);
  add(new THREE.BoxGeometry(1.66, 0.05, 0.04), pTail, 0, 0.9, -2.43);
  for (const x of [-1, 1]) add(new THREE.BoxGeometry(0.3, 0.1, 0.04), pTail, x * 0.7, 0.83, -2.425);
  for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.02, 0.18, 0.36), CARBON, k * 0.32, 0.32, -2.36);
  const exM = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 1, roughness: 0.3 });
  for (const x of [-0.3, -0.12, 0.12, 0.3]){ const ex = add(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), exM, x, 0.42, -2.42); ex.rotation.x = Math.PI / 2; }
})();
function showCarBody(body, id){ for (const o of body.children) if (o.name && o.name.startsWith('car-')) o.visible = o.name === 'car-' + id; }
function setCar(id){
  const K = CAR_MODELS[id] || CAR_MODELS.raijin; id = CAR_MODELS[id] ? id : 'raijin';
  if (DMGV.mesh){ applyDamageVisual(0); DMGV.mesh = null; }
  CARV.k = K; CARV.id = id; CARV.body = pBody.children.find(o => o.name === 'car-' + id); showCarBody(pBody, id);
  PHYS.m = K.m; PHYS.I = 2350 * K.m / 1420;
  for (const w of pWheels){ w.pivot.position.set(Math.sign(w.pivot.position.x) * K.wx, 0.34 * K.ws, w.front ? K.wf : K.wr); w.pivot.scale.setScalar(K.ws); }
  FLARES.forEach((f, i) => f.position.set((i ? 1 : -1) * K.lamp[0], K.lamp[1], K.lamp[2])); headLamp.position.set(0, K.lamp[1] + 0.06, K.lamp[2] - 0.3);
  if (car.damage) applyDamageVisual(car.damage);
}

// ---------- AI cars: copies of the player's car without its lights
function makeAICar(hex, kind){
  const paint = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.6, roughness: 0.26, envMapIntensity: 1.3 });
  const tail = new THREE.MeshBasicMaterial({ color: TAIL_DIM.clone(), fog: false });
  const mesh = player.clone(); showCarBody(mesh.children[0], kind || 'raijin');
  const wheels = pWheels.map(w => { const pivot = mesh.children[player.children.indexOf(w.pivot)]; return { pivot, spin: pivot.children[0], front: w.front }; });
  const drop = [];
  mesh.traverse(o => { if (o.isLight) drop.push(o); if (o.isMesh){ if (o.material === pPaint) o.material = paint; else if (o.material === pTail) o.material = tail; } });
  drop.forEach(o => o.parent.remove(o));
  { const K = CAR_MODELS[kind || 'raijin'] || CAR_MODELS.raijin; for (const w of wheels){ w.pivot.position.set(Math.sign(w.pivot.position.x) * K.wx, 0.34 * K.ws, w.front ? K.wf : K.wr); w.pivot.scale.setScalar(K.ws); } }
  const mark = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 4), new THREE.MeshBasicMaterial({ color: hex, fog: false }));
  mark.rotation.x = Math.PI; mark.position.y = 2.5; mesh.add(mark);
  mesh.visible = false; scene.add(mesh);
  return { mesh, wheels, tail, mark, body: mesh.children[0] };
}

// ---------- tyre smoke
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const smoke = [];
for (let i = 0; i < 110; i++){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x9aa0aa, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; scene.add(sp); smoke.push({ sp, life: 0, vx: 0, vz: 0 }); }
let smokeI = 0;
function puff(x, y, z, vx, vz, amt, grow = 1){
  const p = smoke[smokeI = (smokeI + 1) % smoke.length]; p.life = 1; p.max = (1.2 + amt) * (grow < 1 ? 0.5 : 1); p.vx = vx; p.vz = vz; p.grow = grow;
  p.sp.position.set(x, y, z); p.sp.visible = true; p.sp.scale.setScalar(0.8); p.a = 0.35 * amt + 0.1;
}

// ---------- vehicle physics
const PHYS = { m: 1420, I: 2350, a: 1.22, b: 1.38, h: 0.5, L: 2.6, rw: 0.335, muF: 1.05, muR: 1.22, g: 9.81, cd: 0.33, down: 0.16 };
const GEAR = { '-1': -3.3, 1: 3.36, 2: 2.18, 3: 1.6, 4: 1.2, 5: 0.93, 6: 0.72 };
const FINAL = 3.62, IDLE = 850, LIMIT = 7600;
const TQ = [[800, 380], [1500, 480], [2500, 610], [3500, 710], [4500, 770], [5500, 790], [6500, 760], [7200, 700], [7600, 650]]; // about a quarter more pull everywhere
function torqueAt(rpm){
  if (rpm <= TQ[0][0]) return TQ[0][1];
  for (let i = 1; i < TQ.length; i++) if (rpm <= TQ[i][0]){ const [r0, t0] = TQ[i - 1], [r1, t1] = TQ[i]; return t0 + (t1 - t0) * (rpm - r0) / (r1 - r0); }
  return 520;
}
function tire(a, B = 18){ const C = 1.35, E = 0.6, x = B * a; return Math.sin(C * Math.atan(x - E * (x - Math.atan(x)))); }

const car = {
  x: 0, z: 0, y: 0, h: 0, vx: 0, vy: 0, r: 0, steerIn: 0, delta: 0, gear: 1, rpm: IDLE, shiftT: 0, axF: 0, ayF: 0,
  vs: 0, drift: 0, slipR: 0, slipF: 0, spin: false, locked: false, wheelRot: 0, revHold: 0, limiterCut: false,
  sup: null, damage: 0, nitro: 1, flat: 0,
};
const opts = { auto: true, assist: true, cam: 0 };
const input = { thr: 0, brk: 0, steer: 0, hb: 0, analog: false, nos: 0 };
// what your upgrades do, recomputed whenever you buy something (see applyUpgrades)
const UPK = { torque: 1, cd: 1, lat: 0, wet: 1, brake: 1, nitroCap: 5, nitroPush: 9, armor: 1, jammer: false };
function placeCarWorld(x, z, h, y){
  car.x = x; car.z = z; car.h = h; car.y = y; car.vx = car.vy = car.r = 0; car.gear = 1; car.rpm = IDLE; car.steerIn = 0; car.axF = car.ayF = 0;
  car.sup = null; supportUpdate(true); cam.init = false;
}

function physStep(dt, thr, brk, hb, slopeAlong){
  const P = PHYS, vx = car.vx, vy = car.vy, r = car.r, spd = Math.hypot(vx, vy);
  const delta = car.delta, sinD = Math.sin(delta), cosD = Math.cos(delta);
  const W = P.m * P.g, dn = P.down * vx * vx;
  let Fzf = W * P.b / P.L - P.m * car.axF * P.h / P.L + dn * 0.45;
  let Fzr = W * P.a / P.L + P.m * car.axF * P.h / P.L + dn * 0.55;
  Fzf = Math.max(300, Fzf); Fzr = Math.max(300, Fzr);
  const grip = weather.grip * (1 - weather.wet * clamp((spd - 38) / 45, 0, 0.3)); // aquaplaning above ~140 km/h in the wet
  const maxF = P.muF * Fzf * grip, maxR = P.muR * Fzr * grip;
  // stability control: trim throttle when the rear starts to step out
  if (opts.assist && car.drift < 0.05){ const ex = Math.abs(car.slipR) - 0.08; if (ex > 0) thr *= Math.max(0, 1 - ex * 9); }

  // drivetrain
  const gr = GEAR[car.gear] * FINAL;
  const wheelRpm = Math.abs(vx / P.rw * gr) * 60 / TAU;
  let target = Math.max(wheelRpm, IDLE);
  if (wheelRpm < 2600 && thr > 0) target = Math.max(wheelRpm, IDLE + thr * 2700); // clutch slip on launch
  let torque = 0;
  car.limiterCut = car.rpm > LIMIT - 40 ? true : car.rpm < LIMIT - 300 ? false : car.limiterCut;
  if (car.shiftT > 0) torque = 0;
  else if (thr > 0.01 && !car.limiterCut) torque = torqueAt(car.rpm) * thr * UPK.torque * CARV.k.tq * (car.flat ? 0.5 : 1);
  else if (wheelRpm > 1100) torque = -(35 + car.rpm * 0.012);
  let Fdrive = torque * gr * 0.88 / P.rw * (1 - 0.45 * (car.damage || 0)); // a damaged car loses power

  // brakes with ABS
  const sgn = vx >= 0 ? 1 : -1, lowV = clamp(Math.abs(vx) / 0.6, 0, 1);
  const Fb = brk * 16000 * UPK.brake;
  const Fbf = Math.min(Fb * 0.64, maxF * 0.97), Fbr = Math.min(Fb * 0.36, maxR * 0.97);
  const Fxf = -sgn * Fbf * lowV;
  let Fxr = Fdrive - sgn * Fbr * lowV;
  let latR = 1;
  car.spin = false; car.locked = false;
  if (hb > 0.1){ Fxr = -sgn * maxR * 0.5 * lowV + Fdrive * 0.35; latR = 0.5; car.locked = Math.abs(vx) > 2; }
  else if (car.drift > 0) latR = lerp(1, 0.9, car.drift); // rear stays loose after a handbrake flick so throttle can hold the slide
  const maxRx = maxR * (hb > 0.1 ? 1 : CARV.k.trac); // how hard the tyres can push forward: launches differ per car
  if (Math.abs(Fxr) > maxRx){
    const tcs = opts.assist && car.drift < 0.05 && Fdrive * Fxr > 0;
    Fxr = Math.sign(Fxr) * maxRx * (tcs ? 0.97 : 0.84);
    if (!tcs){ car.spin = Math.abs(Fdrive) > maxRx * 1.05; latR *= 0.55; }
  }
  latR *= Math.sqrt(Math.max(0.04, 1 - (Fxr / maxRx) ** 2));
  if (car.spin) target = Math.max(target, wheelRpm + thr * 2200);
  car.rpm += (clamp(target, IDLE * 0.9, LIMIT + 60) - car.rpm) * Math.min(1, dt * (car.spin ? 10 : 22));

  // tyre slip
  const vyf = vy + P.a * r;
  const vxwf = vx * cosD + vyf * sinD, vywf = -vx * sinD + vyf * cosD;
  const af = Math.atan2(vywf, Math.max(Math.abs(vxwf), 3));
  const ar = Math.atan2(vy - P.b * r, Math.max(Math.abs(vx), 3));
  car.slipF = af; car.slipR = ar;
  const Fyf = -maxF * tire(af) * Math.sqrt(Math.max(0.04, 1 - (Fxf / maxF) ** 2));
  const Fyr = -maxR * tire(ar, 28) * latR;

  const roll = 0.016 * W * Math.tanh(vx * 2);
  const cd = P.cd * UPK.cd * CARV.k.cd;
  let Fx = Fxr + Fxf * cosD - Fyf * sinD - cd * vx * spd - roll - P.m * P.g * slopeAlong;
  // arcade handling owns the sideways motion and the yaw (see arcadeStep); only air drag acts sideways here
  const Fy = -cd * 2.5 * vy * spd, Mz = 0;
  const ax = Fx / P.m, ay = Fy / P.m;
  car.vx += (ax + r * vy) * dt; car.vy += (ay - r * vx) * dt; car.r += Mz / P.I * dt;
  car.axF += (ax - car.axF) * Math.min(1, dt * 7);
  car.ayF += (ay - car.ayF) * Math.min(1, dt * 7);

  if (Math.abs(car.vx) < 0.3 && brk > 0.1 && thr < 0.05){ car.vx *= 0.85; if (Math.abs(car.vx) < 0.05) car.vx = 0; }
  if (Math.abs(car.vx) < 0.05 && thr < 0.01 && Fdrive <= 0) car.vx = 0;
  car.r = clamp(car.r, -4, 4);

  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
  car.x += (car.vx * fx + car.vy * lx) * dt; car.z += (car.vx * fz + car.vy * lz) * dt; car.h += car.r * dt;
}

// Arcade handling (from Midnight Weave): the car turns at the rate you ask for, sideways speed is scrubbed off fast,
// and it never snaps into a spin. Space loosens the rear for a controllable slide.
function arcadeStep(dt, hb){
  // Polytrack-style: the nose points where you steer, almost instantly, and the car travels exactly where the nose points.
  const wetNow = weather.wet * UPK.wet;
  const v = car.vx, av = Math.abs(v), dir = v < 0 ? -1 : 1, wetK = 1 - 0.4 * wetNow;
  const drifting = hb > 0.1 && av > 8;
  const latMax = ((drifting ? 36 : 34) + UPK.lat + CARV.k.lat + (UPK.aero ? clamp(Math.abs(car.vx) - 18, 0, 50) * 0.24 : 0)) * wetK * (car.flat ? 0.7 : 1) * (car.sup && car.sup.e && car.sup.e.cls === 'dt' ? 0.82 : 1) * (car.sup && car.sup.kind === 'ground' ? 0.62 : 1); // loose dirt, grass: less grip
  const kin = av * Math.tan(0.6) / PHYS.L;
  const rMax = Math.min(kin, latMax / Math.max(av, 1), drifting ? 1.6 : 0.95) * (drifting ? 1.45 : 1) * CARV.k.turn; // at most ~55 deg/s, so a tap at low speed is a small nudge
  const rT = car.steerIn * rMax * dir;
  car.r += (rT - car.r) * Math.min(1, dt * (drifting ? 6 : lerp(6, 24, clamp(av / 35, 0, 1)) * lerp(1, 0.45, wetNow))); // eases into turns at low speed; lazier when wet
  const sp = Math.hypot(car.vx, car.vy);
  const grip = drifting ? 1.8 * CARV.k.slide * lerp(1, 0.6, wetNow) : car.drift > 0.05 ? lerp(40, 4, car.drift) * lerp(1, 0.4, wetNow) : lerp(60, 3.2, Math.pow(wetNow, 0.8)); // wet tarmac lets the car slide wide
  car.vy *= Math.exp(-grip * dt);
  if (av > 0.5) car.vx = dir * Math.sqrt(Math.max(0, sp * sp - car.vy * car.vy)); // turning keeps all your speed
  if (input.thr < 0.05 && input.brk < 0.05 && av > 1) car.vx -= dir * 1.6 * dt;   // lifting off slows you, no endless coasting
}

function updateGearbox(dt, thrKey, brkKey){
  // returns effective [throttle, brake] after reverse handling
  let thr = thrKey, brk = brkKey;
  if (car.gear < 0){
    thr = brkKey; brk = thrKey;
    if (thrKey > 0.2 && car.vx > -0.6 && opts.auto){ car.gear = 1; car.shiftT = 0.2; }
    return [thr, brk];
  }
  if (opts.auto){
    if (car.vx < 0.7 && brkKey > 0.5 && thrKey < 0.1){ car.revHold += dt; if (car.revHold > 0.35){ car.gear = -1; car.shiftT = 0.25; car.revHold = 0; } }
    else car.revHold = 0;
    if (car.shiftT <= 0 && car.gear > 0){
      if (car.rpm > 7150 && car.gear < 6 && !car.spin){ car.gear++; car.shiftT = 0.13; sfx.shift(); }
      else if (car.gear > 1){
        const lower = Math.abs(car.vx / PHYS.rw * GEAR[car.gear - 1] * FINAL) * 60 / TAU;
        const downAt = thr > 0.7 ? 4600 : thr > 0.2 ? 3400 : 2400;
        if (car.rpm < downAt && lower < 6900){ car.gear--; car.shiftT = 0.1; sfx.shift(); }
      }
    }
  }
  return [thr, brk];
}
function manualShift(dir){
  if (opts.auto || car.shiftT > 0) return;
  if (dir > 0){ if (car.gear < 0) car.gear = 1; else if (car.gear < 6) car.gear++; else return; }
  else { if (car.gear > 1) car.gear--; else if (car.gear === 1 && car.vx < 1.5) car.gear = -1; else return; }
  car.shiftT = 0.12; sfx.shift();
}
