// ---------- sky, stars, moon, shooting stars (from Midnight Weave)
const sky = new THREE.Mesh(new THREE.SphereGeometry(3800, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x03050c) }, mid: { value: FOG.clone() }, glow: { value: new THREE.Color(0x3a2a30) } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 glow; varying vec3 vDir; void main(){ float h = vDir.y; vec3 c = mix(mid, top, smoothstep(0.0, 0.45, h)); c += glow * pow(1.0 - clamp(abs(h),0.0,1.0), 10.0) * 0.8; gl_FragColor = vec4(c, 1.0); }'
}));
sky.renderOrder = -1; sky.scale.setScalar(0.55); scene.add(sky);
const stars = (() => {
  const n = 1800, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ const a = rnd() * TAU, y = 0.12 + rnd() * 0.88, r = Math.sqrt(1 - y * y); p[i * 3] = Math.cos(a) * r * 3500; p[i * 3 + 1] = y * 3500; p[i * 3 + 2] = Math.sin(a) * r * 3500; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
  pts.scale.setScalar(0.55); scene.add(pts); return pts;
})();
let MOON_SPRITE = null;
// a hazy moon on the sky dome
(() => {
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,232,1)'); gr.addColorStop(0.22, 'rgba(250,244,220,1)'); gr.addColorStop(0.26, 'rgba(200,210,240,0.35)'); gr.addColorStop(1, 'rgba(120,140,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(180,170,150,0.25)'; for (const [x, y, rr] of [[56, 58, 6], [72, 66, 4], [62, 74, 3]]){ g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); } return new THREE.CanvasTexture(c); })();
  const moonS = MOON_SPRITE = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false, transparent: true }));
  moonS.position.set(-0.55, 0.6, 0.58).normalize().multiplyScalar(3300); moonS.scale.set(420, 420, 1); sky.add(moonS);
})();
// a shooting star every so often
const meteor = (() => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const m = new THREE.LineBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const line = new THREE.Line(g, m); line.frustumCulled = false; sky.add(line);
  return { line, m, t: 0, wait: 6 + Math.random() * 10, a: new THREE.Vector3(), v: new THREE.Vector3() };
})();
function updateMeteor(dt){
  const M2 = meteor;
  if (M2.t <= 0){ M2.wait -= dt; if (M2.wait > 0) return;
    const az = Math.random() * TAU, el = 0.35 + Math.random() * 0.4;
    M2.a.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(3000);
    M2.v.set(-Math.sin(az), -0.35, Math.cos(az)).multiplyScalar(1400 + Math.random() * 900);
    M2.t = 0.9; M2.wait = 8 + Math.random() * 18; }
  M2.t -= dt; M2.a.addScaledVector(M2.v, dt);
  const pos = M2.line.geometry.attributes.position;
  pos.setXYZ(0, M2.a.x, M2.a.y, M2.a.z); pos.setXYZ(1, M2.a.x - M2.v.x * 0.12, M2.a.y - M2.v.y * 0.12, M2.a.z - M2.v.z * 0.12); pos.needsUpdate = true;
  M2.m.opacity = Math.max(0, Math.sin(Math.PI * Math.max(0, M2.t) / 0.9)) * (1 - weather.fog);
}
// ---------- weather, day and night (from Midnight Weave; rain is rarer here: it comes every 5 to 10 minutes and passes in one or two)
const weather = { rain: 0, target: 0, wet: 0, grip: 1, timer: 300 + Math.random() * 300, fog: 0, fogTarget: 0, fogTimer: 150 + Math.random() * 150, power: 1, powerTarget: 1, powerTimer: 200 + Math.random() * 160, lights: 1 };
// ---------- weather
const RAIN_N = 4500, RB = 26, RH = 22;
const rainArr = new Float32Array(RAIN_N * 6), rainP = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++){ rainP[i * 3] = (Math.random() * 2 - 1) * RB; rainP[i * 3 + 1] = Math.random() * RH - 4; rainP[i * 3 + 2] = (Math.random() * 2 - 1) * RB; }
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainArr, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xa8b6cc, transparent: true, opacity: 0, depthWrite: false });
const rainMesh = new THREE.LineSegments(rainGeo, rainMat); rainMesh.frustumCulled = false; rainMesh.visible = false; scene.add(rainMesh);
const DRY_FOG = scene.fog.density, ROAD_DRY = new THREE.Color(1, 1, 1), ROAD_WET = new THREE.Color(0.6, 0.62, 0.68);
const FOG_HAZE = new THREE.Color(0x3b404a), SKY_TOP = new THREE.Color(0x03050c);
function setBlackout(on){
  weather.powerTarget = on ? 0 : 1; weather.powerTimer = on ? 25 + Math.random() * 20 : 180 + Math.random() * 180;
  toast(on ? 'BLACKOUT' : 'POWER RESTORED', on ? 'STREETLIGHTS DOWN · FLASH YOUR LIGHTS WITH L' : 'THE CITY LIGHTS COME BACK', on ? '#ffd27a' : '#c9d2de');
}
function setFog(on){
  weather.fogTarget = on ? 0.75 + Math.random() * 0.25 : 0; weather.fogTimer = on ? 60 + Math.random() * 70 : 150 + Math.random() * 150;
  toast(on ? 'FOG' : 'FOG LIFTING', on ? 'VISIBILITY UNDER 80 M · WATCH FOR TAILLIGHTS' : 'VISIBILITY RETURNING', '#c9d2de');
}
function setRain(on){
  weather.target = on ? 0.65 + Math.random() * 0.35 : 0; weather.timer = on ? 60 + Math.random() * 60 : 300 + Math.random() * 300;
  toast(on ? 'RAIN' : 'CLEARING', on ? 'GRIP REDUCED · BRAKE EARLIER' : 'THE ROAD WILL STAY WET FOR A WHILE', 'var(--cool)');
}
const DAY = { t: 21.0, dayF: 0 }; // hours; a full day takes 12 real minutes
const FOG_DAY = new THREE.Color(0x9db3c9), FOG_DUSK = new THREE.Color(0x7d5e62), SKY_DAY = new THREE.Color(0x2f66ab), GLOW_NIGHT = new THREE.Color(0x3a2a30), GLOW_DUSK = new THREE.Color(0xff7a3a);
const HEMI_NIGHT = new THREE.Color(0x8c9cc8), HEMI_DAY = new THREE.Color(0xe4ecff), MOON_COL = new THREE.Color(0x9fb4e8), SUN_COL = new THREE.Color(0xfff0d8), SUNSET_COL = new THREE.Color(0xffa060);
const sunSprite = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,252,236,1)'); gr.addColorStop(0.18, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,210,150,0.35)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true })); sp.scale.set(600, 600, 1); sky.add(sp); return sp; })();
function updateDay(dt){
  DAY.t = (DAY.t + dt / 30) % 24;
  const ang = (DAY.t - 6) / 12 * Math.PI, sunAlt = Math.sin(ang);
  const dayF = smooth(-0.12, 0.3, sunAlt), duskF = (1 - smooth(0.04, 0.4, Math.abs(sunAlt)));
  DAY.dayF = dayF; DAY.duskF = duskF;
  sunSprite.position.set(Math.cos(ang) * 3000, sunAlt * 3000, -800); sunSprite.material.opacity = smooth(-0.08, 0.05, sunAlt);
  if (MOON_SPRITE) MOON_SPRITE.material.opacity = 1 - dayF;
  return { dayF, duskF, sunAlt, ang };
}
function updateWeather(dt){
  const D = updateDay(dt);
  if (started){ weather.timer -= dt; if (weather.timer <= 0) setRain(weather.target === 0); weather.fogTimer -= dt * (weather.fogTarget === 0 && mtnK(car.x, car.z) > 0.5 ? 2 : 1); if (weather.fogTimer <= 0) setFog(weather.fogTarget === 0); weather.powerTimer -= dt; if (weather.powerTimer <= 0) setBlackout(weather.powerTarget > 0.5); }
  // power fails with a flicker and comes back the same way
  weather.power += clamp(weather.powerTarget - weather.power, -dt / 1.2, dt / 2);
  const pw = weather.power < 0.995 && weather.power > 0.02 ? weather.power * (rnd() < 0.3 ? 0.3 : 1) : weather.power;
  weather.lights = pw * (1 - 0.97 * smooth(-0.05, 0.2, D.sunAlt)); // street lamps switch off in daylight
  WIN_MAT.color.copy(WIN_OFF).lerp(WIN_ON, weather.lights);
  LAMP_HEAD_MAT.color.copy(LAMP_HEAD_ON).multiplyScalar(0.03 + 0.97 * weather.lights);
  for (const m of FACADES) m.emissiveIntensity = (0.1 + 0.9 * pw) * (1 - 0.75 * D.dayF);
  if (NEON_ATLAS) NEON_ATLAS.color.setScalar(0.15 + 0.85 * pw); STORE_MAT.color.setScalar(0.2 + 0.8 * pw);
  const tun = 0;
  weather.fog += clamp(weather.fogTarget - weather.fog, -dt / 14, dt / 14);
  weather.rain += clamp(weather.target - weather.rain, -dt / 10, dt / 10);
  weather.wet += clamp(weather.rain - weather.wet, -dt / 45, dt / 8);
  weather.grip = 1 - 0.33 * weather.wet * (1 - tun); // tunnels stay dry
  const bank = 0.55 + 0.45 * vnoise(car.x * 0.0025, car.z * 0.0025); // fog comes in thicker and thinner banks
  weather.jk = lerp(weather.jk || 0, jukaiK(car.x, car.z), Math.min(1, dt * 0.8));
  { const far = Math.round(3200 - 2100 * weather.jk); if (Math.abs(camera.far - far) > 60){ camera.far = far; camera.updateProjectionMatrix(); } } // and the far distance shrinks inside it: the mist hides it, and the frame rate stays up // the sea of trees: mist between the trunks and hardly any moonlight
  scene.fog.density = DRY_FOG + (weather.rain * 0.0036 + weather.fog * 0.017 * bank) * (1 - tun * 0.75) + weather.jk * 0.014;
  scene.fog.color.copy(FOG).lerp(FOG_DAY, D.dayF).lerp(FOG_DUSK, D.duskF * 0.45).lerp(FOG_HAZE.clone().lerp(FOG_DAY, D.dayF * 0.8), weather.fog * 0.85).multiplyScalar(lerp(lerp(0.35, 1, pw), 1, D.dayF)); scene.background.copy(scene.fog.color);
  sky.material.uniforms.mid.value.copy(scene.fog.color); sky.material.uniforms.top.value.copy(SKY_TOP).lerp(SKY_DAY, D.dayF).lerp(FOG_HAZE, weather.fog * 0.6); sky.material.uniforms.glow.value.copy(GLOW_NIGHT).lerp(GLOW_DUSK, D.duskF * (1 - weather.fog)).multiplyScalar(1 - D.dayF * 0.6);
  stars.material.opacity = 0.8 * (1 - weather.fog) * (1 - D.dayF);
  for (const k in ROAD_MATS){ const m = ROAD_MATS[k].mat; m.roughness = lerp(0.92, 0.34, weather.wet); m.envMapIntensity = lerp(0.25, 0.75, weather.wet); m.color.copy(ROAD_DRY).lerp(ROAD_WET, weather.wet); }
  ROAD_POWER.value = weather.lights;
  hemi.intensity = lerp((0.62 - weather.rain * 0.15) * lerp(0.14, 1, pw), 1.05 - weather.rain * 0.3 - weather.fog * 0.2, D.dayF) * (1 - 0.45 * weather.jk); hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY, D.dayF);
  moon.intensity = lerp(0.32 * lerp(0.25, 1, pw), 1.15 * (1 - weather.rain * 0.45) * (1 - weather.fog * 0.5), D.dayF); moon.color.copy(MOON_COL).lerp(SUN_COL, D.dayF).lerp(SUNSET_COL, D.duskF * D.dayF); moon.intensity *= 1 - 0.6 * weather.jk;
  if (D.dayF > 0.02) moon.position.set(Math.cos(D.ang) * 1000, Math.max(150, D.sunAlt * 1000), -300); else moon.position.set(-600, 900, 300);
  if (bloom) bloom.strength = lerp(0.45, 0.14, D.dayF);
  rainMesh.visible = weather.rain > 0.02 && tun < 0.5;
  if (rainMesh.visible){
    rainMat.opacity = 0.42 * weather.rain;
    const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
    const wvx = car.vx * fx + car.vy * lx, wvz = car.vx * fz + car.vy * lz, fall = 24, k = 0.035;
    const n = Math.floor(RAIN_N * weather.rain);
    for (let i = 0; i < RAIN_N; i++){
      const o = i * 3, q = i * 6;
      if (i >= n){ rainArr.fill(0, q, q + 6); rainArr[q + 1] = rainArr[q + 4] = -999; continue; }
      let x = rainP[o] - wvx * dt, y = rainP[o + 1] - fall * dt, z = rainP[o + 2] - wvz * dt;
      if (y < -4) y += RH;
      if (x < -RB) x += 2 * RB; else if (x > RB) x -= 2 * RB;
      if (z < -RB) z += 2 * RB; else if (z > RB) z -= 2 * RB;
      rainP[o] = x; rainP[o + 1] = y; rainP[o + 2] = z;
      if (opts.cam >= 4 && x * x + z * z < 6 && y < 1.2 && y > -2){ rainArr.fill(0, q, q + 6); rainArr[q + 1] = rainArr[q + 4] = -999; continue; } // no rain falling inside the car
      rainArr[q] = x; rainArr[q + 1] = y; rainArr[q + 2] = z;
      rainArr[q + 3] = x + wvx * k; rainArr[q + 4] = y + fall * k; rainArr[q + 5] = z + wvz * k;
    }
    rainGeo.attributes.position.needsUpdate = true;
    rainMesh.position.copy(camera.position);
  }
  const f = $('fWx'), label = weather.power < 0.5 ? 'BLACKOUT' : weather.fog > 0.3 ? (weather.rain > 0.3 ? 'FOG · RAIN' : 'FOG') : weather.rain > 0.3 ? 'RAIN' : weather.wet > 0.15 ? 'WET' : 'DRY';
  if (f.textContent !== label){ f.textContent = label; f.classList.toggle('on', label !== 'DRY'); }
}

// droplets that land on the camera lens and get blown off by the airflow
const rfx = $('rainfx'), rctx = rfx.getContext('2d'), drops = [], wiper = { t: 0, prev: null };
const DROP_IMG = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(24, 22, 3, 32, 32, 32); gr.addColorStop(0, 'rgba(230,238,250,0.30)'); gr.addColorStop(0.6, 'rgba(150,165,190,0.12)'); gr.addColorStop(1, 'rgba(10,14,22,0.35)');
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 32, 0, TAU); g.fill(); return c; })();
function sizeRfx(){ rfx.width = innerWidth; rfx.height = innerHeight; }
sizeRfx(); addEventListener('resize', sizeRfx);
function updateRainFx(dt){
  const W = rfx.width, H = rfx.height;
  if (weather.rain < 0.02 && !drops.length){ if (rfx.dataset.on){ rctx.clearRect(0, 0, W, H); rfx.dataset.on = ''; } return; }
  rfx.dataset.on = '1';
  rctx.clearRect(0, 0, W, H);
  rctx.fillStyle = `rgba(70,85,110,${0.13 * weather.rain})`; rctx.fillRect(0, 0, W, H);
  const spd = Math.abs(car.vx), inside = opts.cam >= 4 ? 0 : opts.cam >= 2 ? 1 : 0.6; // (the cockpit has its own windscreen)
  let n = weather.rain * 48 * inside * dt * (spd > 25 ? 1.6 : 1);
  while (n > 0 && drops.length < 260){ if (rnd() < n) drops.push({ x: rnd() * W, y: rnd() * H, r: 2.5 + rnd() * rnd() * 12, life: 1.5 + rnd() * 3, max: 0, slide: rnd() < 0.35, vy: 0 }); n -= 1; }
  for (let i = drops.length - 1; i >= 0; i--){
    const d = drops[i];
    if (!d.max) d.max = d.life;
    d.life -= dt;
    if (d.life <= 0 || d.x < -20 || d.x > W + 20 || d.y < -20 || d.y > H + 20){ drops.splice(i, 1); continue; }
    // airflow pushes drops outward from the centre of view; heavy ones slide down
    const wind = clamp((spd - 8) / 40, 0, 1.4);
    const ox = (d.x - W / 2) / W, oy = (d.y - H * 0.45) / H;
    if (d.slide) d.vy = Math.min(d.vy + dt * 60, 90);
    const mx = ox * wind * 900 * dt, my = (oy * wind * 600 + d.vy * (1 - wind * 0.6)) * dt;
    d.x += mx; d.y += my;
    const a = Math.min(1, d.life / d.max * 2.2);
    const stretch = 1 + Math.min(4, Math.hypot(mx, my) / Math.max(dt, 1e-3) / 260);
    const ang = Math.atan2(my, mx);
    rctx.save(); rctx.translate(d.x, d.y); rctx.rotate(ang); rctx.scale(stretch, 1);
    rctx.globalAlpha = a; rctx.drawImage(DROP_IMG, -d.r, -d.r, d.r * 2, d.r * 2); rctx.globalAlpha = 1;
    rctx.restore();
    if (d.slide && d.vy > 20){ rctx.strokeStyle = `rgba(190,205,225,${0.10 * a})`; rctx.lineWidth = d.r * 0.5; rctx.beginPath(); rctx.moveTo(d.x, d.y - d.r); rctx.lineTo(d.x, d.y - d.r - d.vy * 0.5); rctx.stroke(); }
  }
}

// ---------- bloom (optional)
let composer = null, bloom = null;
try {
  if (THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass){
    let rt;
    if (renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget){ rt = new THREE.WebGLMultisampleRenderTarget(innerWidth, innerHeight, { format: THREE.RGBAFormat }); rt.samples = 4; }
    composer = new THREE.EffectComposer(renderer, rt);
    if (rt){ composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.15, 0.4);
    composer.addPass(bloom);
  }
} catch (e) { composer = null; }
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer){ composer.setSize(innerWidth, innerHeight); }
});
