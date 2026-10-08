// ---------- audio (from Midnight Weave; mute silences everything, rain included)
const sfx = (() => {
  let muted = false; try { muted = localStorage.getItem('nd-mute') === '1'; } catch (e) {}
  let ctx = null, out, cabLP, cabLS, cabK = -1, mix, wetG, echoG, noiseBuf, E = null;
  const N = {};
  const noiseSrc = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; };
  function chain(src, type, f, q, to){ const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(to || mix); return { fl, g }; }
  function init(){
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    out = ctx.createGain(); out.gain.value = muted ? 0 : 0.6;
    cabLP = ctx.createBiquadFilter(); cabLP.type = 'lowpass'; cabLP.frequency.value = 20000; cabLP.Q.value = 0.6; cabLS = ctx.createBiquadFilter(); cabLS.type = 'lowshelf'; cabLS.frequency.value = 220; cabLS.gain.value = 0; out.connect(cabLP); cabLP.connect(cabLS); cabLS.connect(ctx.destination); // inside the car: the glass and doors take the top off everything
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(out);
    mix = ctx.createGain(); mix.connect(comp);
    // tunnel acoustics: a long concrete reverb plus a short slap-back echo off the walls
    const len = ctx.sampleRate * 2.4 | 0, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * Math.min(1, i / 600); }
    const conv = ctx.createConvolver(); conv.buffer = ir; wetG = ctx.createGain(); wetG.gain.value = 0; mix.connect(conv); conv.connect(wetG); wetG.connect(comp);
    const dl = ctx.createDelay(1), fb = ctx.createGain(); dl.delayTime.value = 0.085; fb.gain.value = 0.38; echoG = ctx.createGain(); echoG.gain.value = 0;
    mix.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(echoG); echoG.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // engine: a straight-six's firing order harmonics, saturated, plus exhaust rasp pulsed at the firing rate
    const sum = ctx.createGain(), eLP = ctx.createBiquadFilter(), shaper = ctx.createWaveShaper(), eng = ctx.createGain();
    eLP.type = 'lowpass'; eLP.Q.value = 2.2; eng.gain.value = 0;
    const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++){ const x = i / 512 - 1; cv[i] = Math.tanh(x * 2.6); } shaper.curve = cv;
    const osc = (type, mult, gain, det = 0) => { const o = ctx.createOscillator(); o.type = type; o.detune.value = det; const g = ctx.createGain(); g.gain.value = gain; o.connect(g); g.connect(sum); o.start(); return { o, mult }; };
    E = { oscs: [osc('sawtooth', 1, 0.45), osc('sawtooth', 1, 0.28, 11), osc('sine', 0.5, 0.75), osc('square', 2, 0.07), osc('triangle', 1.5, 0.18), osc('sawtooth', 3, 0.04, -7), osc('sine', 0.25, 0.35)], eLP, eng };
    // a lumpy, uneven idle: two slow wobbles on the pitch of every harmonic, strongest at low revs
    E.jit = ctx.createGain(); E.jit.gain.value = 14;
    for (const hz of [6.3, 9.7]){ const l = ctx.createOscillator(); l.frequency.value = hz; l.connect(E.jit); l.start(); }
    for (const x of E.oscs) E.jit.connect(x.o.detune);
    // the exhaust: a deep resonance in the pipes, the fizz taken off the top
    const res = ctx.createBiquadFilter(); res.type = 'peaking'; res.frequency.value = 140; res.Q.value = 0.9; res.gain.value = 7;
    const res2 = ctx.createBiquadFilter(); res2.type = 'peaking'; res2.frequency.value = 420; res2.Q.value = 1.4; res2.gain.value = 3;
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 3200; shelf.gain.value = -6;
    E.res2 = res2;
    sum.connect(eLP); eLP.connect(shaper); shaper.connect(res); res.connect(res2); res2.connect(shelf); shelf.connect(eng); eng.connect(mix);
    // pops and bangs go through their own gritty bus with a short exhaust-pipe slap
    E.popBus = ctx.createGain(); E.popBus.gain.value = 1; const pShape = ctx.createWaveShaper(), pc = new Float32Array(512); for (let i = 0; i < 512; i++){ const x = i / 256 - 1; pc[i] = Math.tanh(x * 3.5); } pShape.curve = pc;
    const slap = ctx.createDelay(0.2), slapG = ctx.createGain(); slap.delayTime.value = 0.045; slapG.gain.value = 0.28;
    E.popBus.connect(pShape); pShape.connect(mix); pShape.connect(slap); slap.connect(slapG); slapG.connect(mix);
    E.prevThr = 0; E.overrunT = 9; E.burbleAcc = 0;
    E.rasp = chain(noiseSrc(), 'bandpass', 650, 0.8, eng);
    E.am = ctx.createOscillator(); E.am.type = 'square'; const amD = ctx.createGain(); amD.gain.value = 0.3; E.am.connect(amD); amD.connect(E.rasp.g.gain); E.am.start();
    E.intake = chain(noiseSrc(), 'bandpass', 1400, 1.5);
    E.tur = ctx.createOscillator(); E.tur.type = 'sine'; E.turG = ctx.createGain(); E.turG.gain.value = 0; E.tur.connect(E.turG); E.turG.connect(mix); E.tur.start();
    // road and environment
    N.road = chain(noiseSrc(), 'lowpass', 260, 0.7);
    N.hum = chain(noiseSrc(), 'bandpass', 120, 2.5);
    N.wind = chain(noiseSrc(), 'bandpass', 500, 0.6);
    N.sq = chain(noiseSrc(), 'bandpass', 1500, 6);
    N.rain = chain(noiseSrc(), 'highpass', 2500, 0.4);
    N.spray = chain(noiseSrc(), 'bandpass', 1900, 0.8);
    N.ro = ctx.createOscillator(); N.ro.type = 'square'; N.rumble = chain(N.ro, 'lowpass', 180, 1); N.ro.start();
    if (muted) ctx.suspend();
  }
  function update(p){
    if (!ctx) return;
    if (muted){ out.gain.value = 0; if (ctx.state === 'running') ctx.suspend(); return; } // muted means silent, whatever else is going on
    const t = ctx.currentTime, P = p.paused ? 0 : 1, sp = p.spd || 0, tun = p.tunnel || 0;
    const f = p.rpm / 60 * 3;
    for (const x of E.oscs) x.o.frequency.setTargetAtTime(f * x.mult, t, 0.012);
    E.am.frequency.setTargetAtTime(f, t, 0.012);
    E.eLP.frequency.setTargetAtTime(240 + p.thr * 2600 + p.rpm * 0.3, t, 0.03);
    E.eng.gain.setTargetAtTime(P * (0.07 + p.thr * 0.16 + p.rpm / 8000 * 0.05), t, 0.04);
    E.rasp.g.gain.setTargetAtTime(0.3 + p.thr * 0.45, t, 0.04);
    E.jit.gain.setTargetAtTime(P * lerp(16, 1.5, clamp((p.rpm - 900) / 3500, 0, 1)), t, 0.1);
    E.res2.gain.setTargetAtTime(2 + p.thr * 4, t, 0.05); // the pipes open up under load
    E.intake.g.gain.setTargetAtTime(P * p.thr * (p.rpm / 8000) * 0.06, t, 0.05); E.intake.fl.frequency.setTargetAtTime(900 + p.rpm * 0.25, t, 0.05);
    E.tur.frequency.setTargetAtTime(1900 + (p.boost || 0) * 5200, t, 0.06); E.turG.gain.setTargetAtTime(P * (p.boost || 0) ** 2 * 0.03, t, 0.06);
    N.road.g.gain.setTargetAtTime(P * Math.min(0.32, sp * 0.004) * (1 + tun * 0.7), t, 0.1); N.road.fl.frequency.setTargetAtTime(170 + sp * 6 + (p.wet || 0) * 900, t, 0.1);
    N.hum.g.gain.setTargetAtTime(P * Math.min(0.18, sp * 0.0024), t, 0.1); N.hum.fl.frequency.setTargetAtTime(55 + sp * 2.3, t, 0.1);
    N.wind.g.gain.setTargetAtTime(P * Math.min(0.5, sp * sp * 0.00006) * (1 - tun * 0.45), t, 0.1);
    N.sq.g.gain.setTargetAtTime(P * clamp((p.slip - 0.1) * 1.6, 0, 0.3) * (sp > 3 ? 1 : 0) * (1 - (p.wet || 0) * 0.7), t, 0.05);
    N.rain.g.gain.setTargetAtTime(P * (p.rain || 0) * 0.12 * (1 - tun), t, 0.3);
    N.spray.g.gain.setTargetAtTime(P * Math.min(p.wet || 0, (p.rain || 0) * 1.5) * (1 - tun) * Math.min(0.22, sp * 0.004), t, 0.2); // spray hiss stops with the rain
    N.ro.frequency.setTargetAtTime(18 + sp * 0.9, t, 0.05); N.rumble.g.gain.setTargetAtTime(P * (p.rumble || 0) * Math.min(0.35, sp * 0.012), t, 0.03);
    wetG.gain.setTargetAtTime(tun * 0.85, t, 0.2); echoG.gain.setTargetAtTime(tun * 0.4, t, 0.2);
    return P ? exhaust(p, t) : 0;
  }
  // ---------- exhaust pops, bangs and burbles: lift off at high revs and the exhaust crackles while the revs fall
  function popAt(t, vol, big){
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = big ? 650 + Math.random() * 300 : 750 + Math.random() * 1100; fl.Q.value = big ? 0.7 : 1.1;
    const g = ctx.createGain(), dur = big ? 0.11 : 0.03 + Math.random() * 0.03; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(E.popBus); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(big ? 120 : 160 + Math.random() * 60, t); o.frequency.exponentialRampToValueAtTime(big ? 42 : 60, t + (big ? 0.09 : 0.04));
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(vol * (big ? 1.1 : 0.7), t + 0.003); og.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.14 : 0.06)); o.connect(og); og.connect(E.popBus); o.start(t); o.stop(t + 0.16);
    if (big){ const s2 = ctx.createBufferSource(); s2.buffer = noiseBuf; const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = 3200; const hg = ctx.createGain(); hg.gain.setValueAtTime(vol * 0.5, t); hg.gain.exponentialRampToValueAtTime(0.001, t + 0.02); s2.connect(h); h.connect(hg); hg.connect(E.popBus); s2.start(t, Math.random()); s2.stop(t + 0.05); }
  }
  function exhaust(p, t){
    const dt = p.dt || 0.016; let fired = 0;
    const lift = E.prevThr > 0.55 && p.thr < 0.12 && p.rpm > 3800;
    if (p.thr > 0.12) E.overrunT = 0; else E.overrunT += dt;
    if (lift){ // the bang when you lift: one big one and a couple of crackles behind it
      popAt(t + 0.03, 0.55, true); fired++;
      const n = 2 + Math.floor(Math.random() * 3); for (let k = 0; k < n; k++){ popAt(t + 0.12 + k * (0.06 + Math.random() * 0.1), 0.18 + Math.random() * 0.22, Math.random() < 0.25); }
      E.overrunT = 0;
    }
    // the burble: crackles while the engine is being dragged down, thinning out as the revs fall
    if (p.thr < 0.1 && p.rpm > 2400 && (p.spd || 0) > 5 && E.overrunT < 4.5){
      const rate = (3 + (p.rpm - 2400) / 500) * Math.exp(-E.overrunT / 2.2);
      E.burbleAcc += rate * dt;
      while (E.burbleAcc > 1){ E.burbleAcc -= 1 + Math.random() * 0.6; const v = 0.08 + Math.random() * 0.2 * Math.min(1, p.rpm / 6000), big = Math.random() < 0.08; popAt(t + Math.random() * dt, big ? 0.35 : v, big); if (big || v > 0.2) fired++; }
    } else E.burbleAcc = 0;
    if (E.shiftBang){ E.shiftBang = false; popAt(t + 0.01, 0.5, true); fired++; }
    E.prevThr = p.thr; E.lastThr = p.thr; E.lastRpm = p.rpm;
    return fired;
  }
  // MIDNIGHT FM: a small synthwave loop (Am F C G at 100 bpm) scheduled a little ahead of the audio clock
  const RAD = { on: false, timer: null, next: 0, step: 0, bus: null };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12), PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  function rnote(type, f, t0, dur, vol, cut){ const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; let node = o;
    if (cut){ const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut; o.connect(fl); node = fl; }
    node.connect(g); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.03, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); g.connect(RAD.bus); o.start(t0); o.stop(t0 + dur + 0.05); }
  function rhit(t0, dur, vol, type, f){ const src = ctx.createBufferSource(); src.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); src.connect(fl); fl.connect(g); g.connect(RAD.bus); src.start(t0, Math.random()); src.stop(t0 + dur + 0.02); }
  function radioTick(){
    if (!RAD.on || !ctx || ctx.state !== 'running') return;
    const spb = 60 / 100 / 4;
    while (RAD.next < ctx.currentTime + 0.35){
      const st = RAD.step % 64, ch = PROG[Math.floor(st / 16)], t0 = RAD.next;
      if (st % 4 === 0){ const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.18); g.gain.setValueAtTime(0.45, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32); o.connect(g); g.connect(RAD.bus); o.start(t0); o.stop(t0 + 0.35); }
      if (st % 8 === 4) rhit(t0, 0.2, 0.25, 'bandpass', 1800);
      if (st % 2 === 1) rhit(t0, 0.05, 0.07, 'highpass', 7000);
      if (st % 2 === 0) rnote('sawtooth', mtof(ch[0] - 24), t0, spb * 1.8, 0.15, 520);
      rnote('square', mtof(ch[st % 3] + 12 + (st % 8 >= 6 ? 12 : 0)), t0, spb * 0.9, 0.03, 2600);
      if (st % 16 === 0) for (const m of ch){ rnote('sawtooth', mtof(m), t0, spb * 16, 0.03, 1300); rnote('sawtooth', mtof(m) * 1.005, t0, spb * 16, 0.025, 1300); }
      RAD.next += spb; RAD.step++;
    }
  }
  function burst(dur, f, type, gain, sweep, q = 1, delay = 0){
    if (!ctx) return; const t = ctx.currentTime + delay, src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(mix); src.start(t); src.stop(t + dur + 0.05);
  }
  function thump(f, gain, delay = 0){
    if (!ctx) return; const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(mix); o.start(t); o.stop(t + 0.15);
  }
  return {
    get muted(){ return muted; },
    setMuted(m){
      muted = m; try { localStorage.setItem('nd-mute', m ? '1' : '0'); } catch (e) {}
      if (!ctx) return;
      if (m){ out.gain.setValueAtTime(0, ctx.currentTime); ctx.suspend(); }
      else { ctx.resume(); out.gain.setTargetAtTime(0.6, ctx.currentTime, 0.02); }
    },
    horn(pitch = 1, vol = 1, delay = 0){
      if (!ctx || muted) return; const t = ctx.currentTime + delay, g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * vol, t + 0.02); g.gain.setValueAtTime(0.16 * vol, t + 0.42); g.gain.linearRampToValueAtTime(0, t + 0.5);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; f.connect(g); g.connect(mix);
      for (const hz of [349, 440]){ const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz * pitch; o.connect(f); o.start(t); o.stop(t + 0.52); }
    },
    init, update, resume(){ if (ctx && ctx.state === 'suspended' && !muted) ctx.resume(); }, pause(){ if (ctx && ctx.state === 'running') ctx.suspend(); }, cabin(k){ if (!ctx || !cabLP || k === cabK) return; cabK = k; const t = ctx.currentTime; cabLP.frequency.setTargetAtTime(k > 0 ? 20000 * Math.pow(1300 / 20000, k) : 20000, t, 0.08); cabLS.gain.setTargetAtTime(5 * k, t, 0.08); },
    crash(v){ burst(0.9, 700, 'lowpass', Math.min(1, 0.3 + v * 0.06)); burst(0.4, 2500, 'bandpass', 0.3); thump(45, 0.6); },
    bump(v){ burst(0.18, 500, 'lowpass', Math.min(0.4, v * 0.08)); },
    whoosh(tier){ burst(0.45, 2600, 'bandpass', 0.18 + tier * 0.08, 500); },
    shift(){ if (!ctx) return; E.eng.gain.setTargetAtTime(0.03, ctx.currentTime, 0.01); if ((E.lastThr || 0) > 0.6 && (E.lastRpm || 0) > 5200 && Math.random() < 0.75) E.shiftBang = true; }, // a bang on a flat-out upshift
    bov(){ burst(0.42, 3600, 'bandpass', 0.14, 1400, 1.4); },
    siren(on){
      if (!ctx) return;
      if (on && !N.siren){ const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = 820; lfo.frequency.value = 0.5; lg.gain.value = 260; lfo.connect(lg); lg.connect(o.frequency);
        f.type = 'lowpass'; f.frequency.value = 2000; g.gain.value = 0; o.connect(f); f.connect(g); g.connect(mix); o.start(); lfo.start(); N.siren = { o, lfo, g }; }
      if (!on && N.siren){ const s2 = N.siren; s2.g.gain.setTargetAtTime(0, ctx.currentTime, 0.25); setTimeout(() => { try { s2.o.stop(); s2.lfo.stop(); } catch (e) {} }, 1200); N.siren = null; }
    },
    sirenVol(v){ if (ctx && N.siren) N.siren.g.gain.setTargetAtTime(muted ? 0 : v, ctx.currentTime, 0.1); },
    radio(on){
      if (!ctx) return false;
      if (!RAD.bus){ RAD.bus = ctx.createGain(); RAD.bus.gain.value = 0.55; RAD.bus.connect(mix); }
      RAD.on = on;
      if (on){ RAD.next = ctx.currentTime + 0.1; if (!RAD.timer) RAD.timer = setInterval(radioTick, 100); }
      else { clearInterval(RAD.timer); RAD.timer = null; }
      return on;
    },
    get radioOn(){ return RAD.on; },
    beep(f){ if (!ctx || muted) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(g); g.connect(mix); o.start(t); o.stop(t + 0.25); },
    pop(){ burst(0.06, 1100, 'lowpass', 0.3); thump(80, 0.25); },
    joint(v){ const g = Math.min(0.45, v * 0.007); thump(52, g); thump(46, g * 0.8, 2.6 / Math.max(v, 3)); },
  };
})();
