// v8.6: «живые» фоны — облака, звёзды, вечер/ночь, свет костра, искры, пар, окна замка, флаги на ветру, светлячки, листья, птицы.
// Один модуль для игры (OBS) и для большого экрана на сайте. Координаты — мира 2560×1440. Рисуется поверх фона, под героями.
// Время суток общее для всех (по часам): CONFIG.live.cycleMin — длина круга «закат → ночь → закат» в минутах.
// Выключить всё: CONFIG.live = { enabled: false }. Выключить эффект: CONFIG.live.off = ['birds', 'leaves', ...]
(function () {
  const W = 2560, H = 1440, SK = 0.5; // небо считается в половинном разрешении — дёшево, облака мягкие
  const LOC = {
    camp: {
      sky: 'camp_sky.png',
      fire: [1257, 846], steam: [1257, 683],
      flags: [[339, 304, 467, 574], [877, 314, 989, 564], [1537, 323, 1646, 574], [2057, 304, 2179, 583]],
      windows: [[1446, 223, 4], [1431, 254, 4], [1524, 253, 4], [1524, 264, 12], [1310, 261, 3], [1537, 267, 10], [1480, 291, 14], [1476, 293, 15], [1354, 323, 11], [1320, 329, 10], [1386, 334, 29], [1413, 340, 10], [1527, 386, 37], [1534, 393, 34]],
      flies: [[20, 1030, 470, 1400], [2085, 1030, 2540, 1400]], leaves: true, birds: true
    }
  };
  const ALL = ['clouds', 'stars', 'shoot', 'daynight', 'fire', 'sparks', 'steam', 'windows', 'flags', 'ffly', 'leaves', 'birds'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let T = 0;
  const st = {}; // состояние по локациям

  function cfg() { const c = (window.CONFIG && window.CONFIG.live) || (window.C && window.C.live) || {}; return Object.assign({ enabled: true, cycleMin: 240, off: [] }, c); }
  function on(k) { const c = cfg(); return c.enabled !== false && !(c.off || []).includes(k); }
  // 0 = закат, 1 = глубокая ночь; общий для игры и сайта (по часам)
  function nightK() { if (!on('daynight')) return 0.35; const c = cfg(), per = Math.max(1, +c.cycleMin || 240) * 60000, t = (Date.now() % per) / per; return 0.5 - 0.5 * Math.cos(t * Math.PI * 2); }

  function makeCloud(w) {
    const h = Math.round(w * 0.26), c = mk(w + 8, h + 14), g = c.getContext('2d'), n = 5 + Math.floor(Math.random() * 4), blobs = [];
    for (let i = 0; i < n; i++) { const bx = 4 + w * (0.12 + 0.76 * i / (n - 1)) + rnd(-6, 6), r = h * rnd(.26, .48); blobs.push([bx, 4 + h * 0.62 - r * 0.35 + rnd(-2, 2), r]); }
    const shape = (ox, oy) => { g.beginPath(); blobs.forEach(([bx, by, r]) => { g.moveTo(bx + ox + r, by + oy); g.arc(bx + ox, by + oy, r, 0, 7); }); g.rect(4 + w * 0.08 + ox, 4 + h * 0.55 + oy, w * 0.84, h * 0.3); g.fill(); };
    g.fillStyle = '#1c1028'; [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ox, oy]) => shape(ox, oy));
    const gr = g.createLinearGradient(0, 0, 0, h + 8); gr.addColorStop(0, '#4b3567'); gr.addColorStop(.6, '#3a2856'); gr.addColorStop(1, '#2a1c40'); g.fillStyle = gr; shape(0, 0);
    g.save(); g.globalCompositeOperation = 'source-atop'; const gl = g.createLinearGradient(0, h + 8, 0, h * 0.55); gl.addColorStop(0, 'rgba(220,110,80,.35)'); gl.addColorStop(1, 'rgba(220,110,80,0)'); g.fillStyle = gl; g.fillRect(0, 0, w + 8, h + 14); g.restore();
    return c;
  }
  function newFly(L) { const r = L.flies[Math.floor(Math.random() * L.flies.length)]; return { x: rnd(r[0], r[2]), y: rnd(r[1], r[3]), vx: rnd(-8, 8), vy: rnd(-5, 5), p: rnd(0, 6.28), life: rnd(6, 14) }; }

  function init(loc, base) {
    const L = LOC[loc]; if (!L) return null;
    let s = st[loc]; if (s) return s;
    s = st[loc] = { ready: false, clouds: [], sprites: [], stars: [], sparks: [], steam: [], flies: [], leaves: [], birds: [], shoot: null, nextShoot: 4, nextBirds: 8 };
    const sw = W * SK, sh = H * SK;
    s.sky = mk(sw, sh); s.mask = mk(sw, sh);
    const im = new Image();
    im.onload = () => {
      const g = s.mask.getContext('2d'); g.drawImage(im, 0, 0, sw, sh);
      const d = g.getImageData(0, 0, sw, sh); for (let i = 0; i < d.data.length; i += 4) { const v = d.data[i]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = v; } g.putImageData(d, 0, 0);
      let tries = 0; while (s.stars.length < 80 && tries < 6000) { tries++; const x = Math.floor(rnd(0, sw)), y = Math.floor(rnd(0, sh * 0.3)); if (d.data[(y * sw + x) * 4 + 3] > 200) s.stars.push({ x, y, r: rnd(.5, 1.2), p: rnd(0, 6.28), f: rnd(.6, 2.2) }); }
      s.ready = true;
    };
    im.src = base + L.sky;
    for (let i = 0; i < 7; i++) s.sprites.push(makeCloud(Math.round(rnd(120, 250))));
    for (let i = 0; i < 6; i++) s.clouds.push({ s: s.sprites[i % s.sprites.length], x: rnd(-150, sw), y: rnd(8, 120), v: rnd(3, 7), a: rnd(.55, .85) });
    if (L.flies) for (let i = 0; i < 7; i++) s.flies.push(newFly(L));
    return s;
  }

  function skyLayer(s, dt, nk) {
    const g = s.sky.getContext('2d'), sw = s.sky.width, sh = s.sky.height;
    g.clearRect(0, 0, sw, sh);
    if (on('daynight')) { g.fillStyle = `rgba(18,10,40,${0.45 * nk})`; g.fillRect(0, 0, sw, sh); }
    if (on('stars')) { g.fillStyle = '#fff7e0'; s.stars.forEach(t => { const tw = 0.55 + 0.45 * Math.sin(T * t.f + t.p); g.globalAlpha = Math.min(1, (0.35 + 0.65 * nk) * tw); g.beginPath(); g.arc(t.x, t.y, t.r, 0, 7); g.fill(); }); g.globalAlpha = 1; }
    if (on('shoot')) {
      s.nextShoot -= dt; if (!s.shoot && s.nextShoot <= 0 && nk > .3) { s.shoot = { x: rnd(100, sw - 100), y: rnd(5, 60), vx: rnd(190, 260) * (Math.random() < .5 ? -1 : 1), vy: rnd(60, 90), t: 0 }; s.nextShoot = rnd(10, 25); }
      const o = s.shoot; if (o) { o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt; const a = Math.max(0, 1 - o.t / 0.9), gr = g.createLinearGradient(o.x, o.y, o.x - o.vx * .12, o.y - o.vy * .12); gr.addColorStop(0, `rgba(255,250,230,${a})`); gr.addColorStop(1, 'rgba(255,250,230,0)'); g.strokeStyle = gr; g.lineWidth = 1.5; g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.x - o.vx * .12, o.y - o.vy * .12); g.stroke(); if (o.t > .9) s.shoot = null; }
    }
    if (on('clouds')) { s.clouds.forEach(c => { c.x += c.v * dt; if (c.x > sw + 10) { c.x = -c.s.width - rnd(0, 200); c.y = rnd(8, 120); c.v = rnd(3, 7); c.s = s.sprites[Math.floor(Math.random() * s.sprites.length)]; } g.globalAlpha = c.a * (1 - 0.25 * nk); g.drawImage(c.s, Math.round(c.x), Math.round(c.y)); }); g.globalAlpha = 1; }
    g.globalCompositeOperation = 'destination-in'; g.drawImage(s.mask, 0, 0); g.globalCompositeOperation = 'source-over';
  }

  // ctx — в координатах мира 2560×1440 (масштаб уже выставлен). bg — картинка фона (для флагов). base — папка, где лежит <loc>_sky.png
  function draw(ctx, loc, bg, dt, base) {
    if (!cfg().enabled) return;
    const L = LOC[loc]; if (!L) return;
    const s = init(loc, base || 'assets/bg/'); if (!s || !s.ready) return;
    const now = performance.now(); if (s.last == null) s.last = now; dt = Math.min(0.1, Math.max(0, (now - s.last) / 1000)); s.last = now; T = now / 1000;
    const nk = nightK();
    skyLayer(s, dt, nk);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(s.sky, 0, 0, W, H); ctx.restore();
    if (on('flags') && bg && L.flags) { const bw = bg.naturalWidth || bg.width, kx = bw / W;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      L.flags.forEach(([x0, y0, x1, y1], i) => { const h = y1 - y0, w = x1 - x0; for (let y = y0 + 8; y < y1; y += 2) { const k = (y - y0) / h, dx = Math.sin(T * 1.6 + i * 1.3 - k * 4) * 3 * k * k; if (Math.abs(dx) < 0.2) continue; ctx.drawImage(bg, x0 * kx, y * kx, w * kx, 2 * kx, x0 + dx, y, w, 2); } });
      ctx.restore(); }
    if (on('daynight')) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${Math.round(255 - 95 * nk)},${Math.round(255 - 85 * nk)},${Math.round(255 - 30 * nk)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.18 * (1 - nk); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = '#ff9a5a'; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    const F = L.fire;
    if (F && on('fire')) { const fl = 0.85 + 0.1 * Math.sin(T * 9) + 0.07 * Math.sin(T * 23 + 1) + 0.05 * Math.sin(T * 41), R = (430 + 85 * nk) * fl, fy = F[1] - 28;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      let g = ctx.createRadialGradient(F[0], fy, 0, F[0], fy, R); g.addColorStop(0, `rgba(255,150,60,${0.30 + 0.15 * nk})`); g.addColorStop(.35, `rgba(255,110,40,${0.10 + 0.06 * nk})`); g.addColorStop(1, 'rgba(255,90,30,0)'); ctx.fillStyle = g; ctx.fillRect(F[0] - R, fy - R, R * 2, R * 2);
      g = ctx.createRadialGradient(F[0], F[1] - 14, 0, F[0], F[1] - 14, 86 * fl); g.addColorStop(0, 'rgba(255,210,120,.35)'); g.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = g; ctx.fillRect(F[0] - 100, F[1] - 114, 200, 200);
      ctx.restore(); }
    if (L.windows && on('windows')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; L.windows.forEach(([wx, wy, sz], i) => { const f = 0.6 + 0.4 * Math.sin(T * (0.7 + i * 0.13) + i * 2.1) * Math.sin(T * 0.31 + i), r = 6 + Math.sqrt(sz) * 1.7, g = ctx.createRadialGradient(wx, wy, 0, wx, wy, r); g.addColorStop(0, `rgba(255,200,110,${(0.25 + 0.35 * nk) * Math.max(0.2, f)})`); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(wx - r, wy - r, r * 2, r * 2); }); ctx.restore(); }
    const S2 = L.steam;
    if (S2 && on('steam')) { if (Math.random() < dt * 3) s.steam.push({ x: S2[0] + rnd(-20, 20), y: S2[1], r: rnd(11, 18), t: 0, l: rnd(2.5, 3.8), vx: rnd(-6, 6) });
      ctx.save(); ctx.fillStyle = '#d8cfe6'; s.steam = s.steam.filter(p => { p.t += dt; const k = p.t / p.l; if (k >= 1) return false; p.y -= 31 * dt; p.x += p.vx * dt + Math.sin(T * 1.3 + p.l) * 0.2; ctx.globalAlpha = 0.10 * (1 - k) * Math.min(1, k * 5); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 1.6), 0, 7); ctx.fill(); return true; }); ctx.restore(); }
    if (F && on('sparks')) { if (Math.random() < dt * 14) s.sparks.push({ x: F[0] + rnd(-37, 37), y: F[1] - 28, vx: rnd(-17, 17), vy: rnd(-100, -57), t: 0, l: rnd(.8, 1.8) });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; s.sparks = s.sparks.filter(p => { p.t += dt; p.x += p.vx * dt + Math.sin(T * 3 + p.l * 9) * 0.4; p.y += p.vy * dt; const a = 1 - p.t / p.l; if (a <= 0) return false; ctx.fillStyle = `rgba(255,${160 + Math.round(80 * a)},80,${a})`; ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); return true; }); ctx.restore(); }
    if (L.flies && on('ffly')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; s.flies.forEach((f, i) => { f.life -= dt; if (f.life <= 0) s.flies[i] = f = newFly(L); f.vx += rnd(-28, 28) * dt; f.vy += rnd(-28, 28) * dt; f.vx *= .98; f.vy *= .98; f.x += f.vx * dt; f.y += f.vy * dt; const b = Math.max(0, Math.sin(T * 2 + f.p)), a = (0.25 + 0.6 * nk) * b; if (a < 0.03) return; const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9); g.addColorStop(0, `rgba(220,255,140,${a})`); g.addColorStop(1, 'rgba(200,255,120,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - 9, f.y - 9, 18, 18); }); ctx.restore(); }
    if (L.leaves && on('leaves')) { if (Math.random() < dt * 0.35) s.leaves.push({ x: Math.random() < .5 ? rnd(-30, W * 0.25) : rnd(W * 0.75, W), y: rnd(0, 280), vx: rnd(20, 50), vy: rnd(30, 55), a: rnd(0, 6.28), c: ['#c8742e', '#a8531f', '#d99a3a'][Math.floor(Math.random() * 3)] });
      s.leaves = s.leaves.filter(l => { l.a += dt * 2.5; l.x += l.vx * dt + Math.sin(l.a) * 1.1; l.y += l.vy * dt; if (l.y > H) return false; ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(Math.sin(l.a) * 0.9); ctx.fillStyle = l.c; ctx.strokeStyle = '#3a1e10'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 4.2, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); return true; }); }
    if (L.birds && on('birds')) { s.nextBirds -= dt; if (s.nextBirds <= 0 && !s.birds.length) { const n = 3 + Math.floor(Math.random() * 4), y = rnd(60, 200), dir = Math.random() < .5 ? 1 : -1; for (let i = 0; i < n; i++) s.birds.push({ x: dir > 0 ? -60 - i * 31 : W + 60 + i * 31, y: y + (i % 2) * 14 + i * 4, v: dir * rnd(100, 130), p: rnd(0, 6) }); s.nextBirds = rnd(20, 40); }
      ctx.save(); ctx.strokeStyle = 'rgba(25,15,30,.85)'; ctx.lineWidth = 3; s.birds = s.birds.filter(b => { b.x += b.v * dt; const f = Math.sin(T * 9 + b.p) * 6; ctx.beginPath(); ctx.moveTo(b.x - 10, b.y - f); ctx.quadraticCurveTo(b.x - 4, b.y - 3, b.x, b.y); ctx.quadraticCurveTo(b.x + 4, b.y - 3, b.x + 10, b.y - f); ctx.stroke(); return b.x > -120 && b.x < W + 120; }); ctx.restore(); }
  }
  window.LIVE6 = { draw, has: loc => !!LOC[loc] && cfg().enabled !== false, nightK, LOC, ALL };
})();
