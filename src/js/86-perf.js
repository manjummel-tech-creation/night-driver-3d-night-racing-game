// =====================================================================================================
// PERFORMANCE: things load in near you and drop out far away, without changing what you can see.
// 1. Static scenery is only drawn while it's inside the distance the night mist (or rain, or the forest) lets you see.
// 2. The small feature lights (secret places, story spots, the chop shop...) share a fixed handful of real lights,
//    handed to the nearest ones. The number of lights never changes, so the game never stops to rebuild its shaders.
// =====================================================================================================
const PERF = { list: [], feat: [], pool: [], t: 0 };
const _pc = new THREE.Vector3();
function perfSetup(){
  scene.updateMatrixWorld(true); SHOWN_H.clear();
  // feature lights: everything except the street-lamp lights, the gas station light and the lights on your car
  const keep = new Set([...lampLights, STATION_LIGHT]);
  const lights = []; scene.traverse(o => { if (!o.isPointLight || keep.has(o)) return; let p = o.parent; while (p && p !== player) p = p.parent; if (p === player) return; lights.push(o); });
  for (const l of lights){ const pos = l.getWorldPosition(new THREE.Vector3()), owner = l.parent; owner.remove(l); PERF.feat.push({ l, pos, owner }); }
  for (let i = 0; i < 3; i++){ const l = new THREE.PointLight(0xffffff, 0, 30, 2); scene.add(l); PERF.pool.push(l); }
  // static scenery straight under the scene
  for (const P of COP_POOL) P.mesh.userData.dyn = true; heli.grp.userData.dyn = true; // (moving things are left alone)
  const box = new THREE.Box3(), sph = new THREE.Sphere();
  for (const o of scene.children){ // tall things standing alone out in the world too (wind turbines, secret places, story spots)
    const tall = o.isMesh && !o.isInstancedMesh && o.matrixAutoUpdate && !o.userData.dyn;
    if (!(o.isGroup || tall) || o === player || o.userData.dyn || (o.isGroup && o.children.length === 0)) continue; box.setFromObject(o); if (box.isEmpty() || (tall && box.max.y - box.min.y < 25)) continue; box.getBoundingSphere(sph);
    if (sph.radius > 400 || (Math.abs(sph.center.x) < 1 && Math.abs(sph.center.z) < 1)) continue; PERF.list.push({ o, x: sph.center.x, z: sph.center.z, r: sph.radius, glow: false, grp: true }); }
  for (const o of scene.children){
    if (!o.isMesh || o.isInstancedMesh || o.matrixAutoUpdate || !o.geometry || o.material === TERRAIN_MAT) continue;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const r = g.boundingSphere.radius; if (!(r < 5000)) continue;
    const c = g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld), mats = Array.isArray(o.material) ? o.material : [o.material];
    PERF.list.push({ o, x: c.x, z: c.z, r, glow: mats.some(m => m.fog === false) }); }
}
const ownerShown = o => { while (o){ if (!o.visible) return false; o = o.parent; } return true; };
function perfTick(dt){
  PERF.t -= dt; if (PERF.t > 0) return; PERF.t = 0.2;
  const cx = camera.position.x, cz = camera.position.z;
  // how far you can actually see through the mist right now (less than 1% of anything is left beyond this)
  const see = clamp(2.4 / Math.max(1e-4, scene.fog.density), 260, Math.min(camera.far, CH_R - 150)), seeGlow = camera.far; // never past the edge of the ground that's loaded: nothing hangs in the sky
  for (const P of PERF.list){ const d = Math.hypot(P.x - cx, P.z - cz) - P.r, on = d < (P.glow ? seeGlow : see); if (P.grp){ if (P.on !== on){ P.on = on; P.o.traverse(c => c.layers.set(on ? 0 : 1)); } } else P.o.layers.set(on ? 0 : 1); }
  for (const ch of chunks.values()) if (ch.mesh) ch.mesh.layers.set(Math.hypot(ch.x0 + CH / 2 - cx, ch.z0 + CH / 2 - cz) - 283 < see ? 0 : 1); // the ground too
  // hand the shared lights to the nearest feature lights that are switched on
  const near = []; for (const F of PERF.feat){ const d = Math.hypot(F.pos.x - cx, F.pos.z - cz); if (d < F.l.distance + 220 && F.l.intensity > 0 && ownerShown(F.owner)) near.push([d, F]); }
  near.sort((a, b) => a[0] - b[0]);
  PERF.pool.forEach((L, i) => { const F = near[i] && near[i][1]; if (!F){ L.intensity = 0; return; } L.position.copy(F.pos); L.color.copy(F.l.color); L.distance = F.l.distance; L.decay = F.l.decay; L.intensity = F.l.intensity; });
}
