// v8.6: «живые» фоны — облака, звёзды, вечер/ночь, свет костра, искры, пар, окна замка, флаги на ветру, светлячки, листья, птицы.
// Один модуль для игры (OBS) и для большого экрана на сайте. Координаты — мира 2560×1440. Рисуется поверх фона, под героями.
// Время суток общее для всех (по часам): CONFIG.live.cycleMin — длина круга «закат → ночь → закат» в минутах.
// Выключить всё: CONFIG.live = { enabled: false }. Выключить эффект: CONFIG.live.off = ['birds', 'leaves', ...]
(function () {
  const W = 2560, H = 1440, SK = 1, SKY_H = 620; // небо — полоса сверху в полном разрешении (облака чёткие) // небо считается в половинном разрешении — дёшево, облака мягкие
  const LOC = {
    camp: {
      sky: 'camp_sky.png', // маска неба: PNG с прозрачностью (небо непрозрачное), 1280×720
      stars: [[663,38,0.78,0.3,1.91],[192,93,0.91,5.71,0.94],[856,17,0.67,3.46,0.69],[1158,31,1.16,3.96,1.53],[272,74,0.79,3.4,1.51],[370,26,0.91,4.01,1.2],[643,119,0.91,2.85,1.08],[499,20,0.9,3.3,2.0],[919,73,0.93,0.46,1.42],[700,38,1.15,2.65,2.14],[642,87,0.99,3.73,1.53],[934,17,1.09,5.93,1.36],[133,15,1.01,1.94,1.52],[912,72,1.0,5.57,1.16],[945,90,0.62,0.74,0.69],[588,33,1.02,2.5,2.07],[1016,20,0.62,2.52,1.04],[850,91,0.98,2.39,0.97],[169,45,0.61,4.14,0.62],[1206,46,0.68,0.03,1.27],[815,102,0.78,3.02,1.24],[390,17,1.19,2.77,0.78],[1230,13,0.57,3.56,1.46],[52,18,1.11,3.86,0.84],[516,88,0.92,2.98,0.78],[638,21,0.6,4.71,1.78],[1112,6,1.03,1.87,1.63],[534,132,0.76,1.05,1.84],[464,51,0.86,2.23,0.65],[572,120,0.68,4.35,2.13],[715,93,0.56,0.64,1.35],[691,52,0.84,6.19,1.58],[245,99,1.05,4.71,1.36],[680,22,1.06,6.1,1.23],[325,43,1.2,0.17,1.55],[717,39,0.88,0.82,0.62],[432,7,0.68,1.84,0.98],[268,15,1.14,2.22,1.33],[1027,33,0.87,3.29,0.63],[306,44,0.6,3.89,0.79],[116,63,0.63,0.27,0.76],[1048,51,0.98,2.84,1.45],[1071,66,1.15,5.61,0.92],[916,35,0.79,2.46,1.11],[492,109,0.55,4.2,1.85],[749,36,0.68,0.86,1.35],[997,41,1.19,5.23,0.86],[827,86,0.79,2.24,0.75],[749,4,0.74,2.88,1.73],[787,84,0.86,1.86,2.14],[468,26,0.56,1.71,2.05],[371,69,1.03,5.15,1.96],[529,103,0.6,5.77,1.51],[669,22,0.7,5.02,0.89],[148,68,1.16,3.98,1.88],[455,17,0.69,0.76,0.62],[264,11,0.87,1.5,0.78],[330,67,0.54,1.27,1.1],[624,135,1.03,1.82,1.4],[364,69,0.74,0.11,1.0],[31,4,1.01,3.46,0.9],[972,62,1.15,0.67,1.91],[440,58,0.74,5.23,1.73],[286,103,1.19,6.17,1.94],[29,18,0.94,5.53,1.29],[113,21,0.97,2.39,1.41],[600,11,0.82,0.99,1.31],[539,93,1.17,6.11,1.48],[500,8,1.18,1.94,1.17],[781,21,0.83,3.16,0.92],[183,36,0.78,0.26,0.64],[476,21,0.91,3.32,1.8],[1012,38,0.7,3.89,0.83],[1035,35,1.14,4.73,1.51],[470,21,0.52,0.84,1.18],[500,125,0.68,2.87,0.71],[1077,16,1.02,2.98,1.89],[543,60,1.01,1.29,1.78],[783,19,0.84,4.29,1.83],[406,19,0.92,2.08,1.64]], // [x, y, r, фаза, частота] в половинном разрешении
      fire: [1257, 846], steam: [1257, 683],
      flagAtlas: 'camp_flags.png', // вырезанные флаги (верхний ряд) и место под ними без флага (нижний ряд) — колышется только ткань флага
      flags: [[324, 290, 157, 298, 0, 0, 306], [863, 300, 139, 278, 157, 0, 306], [1523, 308, 136, 280, 296, 0, 306], [2043, 290, 149, 306, 432, 0, 306]], // [x, y, w, h, x в атласе, y флага, y подложки]
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

  // облако как нарисованные на фоне: вытянутая тёмная полоса из нескольких «лепёшек», светлее сверху, тонкая тёплая кайма заката снизу
  function makeCloud(w) {
    const h = Math.round(w * 0.16), pad = 8, c = mk(w + pad * 2, h + pad * 2), g = c.getContext('2d'), n = 3 + Math.floor(Math.random() * 4), lobes = [];
    for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1), rx = w * rnd(.18, .3) * (0.7 + 0.5 * Math.sin(t * Math.PI)), ry = h * rnd(.28, .45) * (0.6 + 0.6 * Math.sin(t * Math.PI)); lobes.push([pad + rx + t * (w - 2 * rx), pad + h * 0.62 - ry * rnd(.2, .6), rx, ry]); }
    const shape = (oy, k) => { g.beginPath(); lobes.forEach(([x, y, rx, ry]) => { g.moveTo(x + rx * k, y + oy); g.ellipse(x, y + oy, rx * k, ry * k, 0, 0, 7); }); };
    g.fillStyle = '#e48a5c'; shape(2.5, 1); g.fill(); // тёплая кайма снизу (выглядывает из-под тела облака)
    g.fillStyle = '#3a2650'; shape(0, 1); g.fill();
    g.fillStyle = '#4b3366'; shape(-h * 0.12, 0.82); g.fill(); // светлый верх
    g.fillStyle = 'rgba(110,80,140,.45)'; shape(-h * 0.2, 0.55); g.fill();
    return c;
  }
  function newFly(L) { const r = L.flies[Math.floor(Math.random() * L.flies.length)]; return { x: rnd(r[0], r[2]), y: rnd(r[1], r[3]), vx: rnd(-8, 8), vy: rnd(-5, 5), p: rnd(0, 6.28), life: rnd(6, 14) }; }

  function init(loc, base) {
    const L = LOC[loc]; if (!L) return null;
    let s = st[loc]; if (s) return s;
    s = st[loc] = { ready: false, clouds: [], sprites: [], stars: [], sparks: [], steam: [], flies: [], leaves: [], birds: [], shoot: null, nextShoot: 4, nextBirds: 8 };
    const sw = W, sh = SKY_H;
    s.sky = mk(sw, sh); s.mask = mk(sw, sh);
    const im = new Image();
    im.onerror = () => console.warn('live6: нет маски неба', base + L.sky);
    im.onload = () => {
      s.mask.getContext('2d').drawImage(im, 0, 0, im.width, im.height * SKY_H / H, 0, 0, sw, sh); // без getImageData: в OBS (file://) чтение пикселей картинки запрещено
      s.stars = (L.stars || []).map(([x, y, r, p, f]) => ({ x: x * 2, y: y * 2, r: r * 1.6, p, f }));
      s.ready = true;
    };
    im.src = base + L.sky + '?v=2';
    if (L.flagAtlas) { const a = new Image(); a.onload = () => { s.atlas = a; }; a.src = base + L.flagAtlas + '?v=1'; }
    for (let i = 0; i < 7; i++) s.sprites.push(makeCloud(Math.round(rnd(120, 250))));
    for (let i = 0; i < 6; i++) s.clouds.push({ s: s.sprites[i % s.sprites.length], x: rnd(-300, sw), y: rnd(20, 260), v: rnd(6, 14), a: rnd(.75, .95) });
    if (L.flies) for (let i = 0; i < 7; i++) s.flies.push(newFly(L));
    return s;
  }

  function skyLayer(s, dt, nk) {
    const g = s.sky.getContext('2d'), sw = s.sky.width, sh = s.sky.height;
    g.clearRect(0, 0, sw, sh);
    if (on('daynight')) { g.fillStyle = `rgba(18,10,40,${0.45 * nk})`; g.fillRect(0, 0, sw, sh); }
    if (on('stars')) { g.fillStyle = '#fff7e0'; s.stars.forEach(t => { const tw = 0.55 + 0.45 * Math.sin(T * t.f + t.p); g.globalAlpha = Math.min(1, (0.35 + 0.65 * nk) * tw); g.beginPath(); g.arc(t.x, t.y, t.r, 0, 7); g.fill(); }); g.globalAlpha = 1; }
    if (on('shoot')) {
      s.nextShoot -= dt; if (!s.shoot && s.nextShoot <= 0 && nk > .3) { s.shoot = { x: rnd(200, sw - 200), y: rnd(10, 120), vx: rnd(380, 520) * (Math.random() < .5 ? -1 : 1), vy: rnd(120, 180), t: 0 }; s.nextShoot = rnd(10, 25); }
      const o = s.shoot; if (o) { o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt; const a = Math.max(0, 1 - o.t / 0.9), gr = g.createLinearGradient(o.x, o.y, o.x - o.vx * .12, o.y - o.vy * .12); gr.addColorStop(0, `rgba(255,250,230,${a})`); gr.addColorStop(1, 'rgba(255,250,230,0)'); g.strokeStyle = gr; g.lineWidth = 2.5; g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.x - o.vx * .12, o.y - o.vy * .12); g.stroke(); if (o.t > .9) s.shoot = null; }
    }
    if (on('clouds')) { s.clouds.forEach(c => { c.x += c.v * dt; if (c.x > sw + 10) { c.x = -c.s.width - rnd(0, 400); c.y = rnd(20, 260); c.v = rnd(6, 14); c.s = s.sprites[Math.floor(Math.random() * s.sprites.length)]; } g.globalAlpha = c.a * (1 - 0.25 * nk); g.drawImage(c.s, Math.round(c.x), Math.round(c.y)); }); g.globalAlpha = 1; }
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
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(s.sky, 0, 0, W, SKY_H); ctx.restore();
    if (on('flags') && L.flags && s.atlas) {
      const sc = Math.abs(ctx.getTransform().a) || 1, step = Math.max(1, 1 / sc), A = s.atlas;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      L.flags.forEach(([X, Y, w, h, ax, fy, uy], i) => {
        ctx.drawImage(A, ax, uy, w, h, X, Y, w, h); // подложка: палатка без флага (видна на краях, когда флаг сдвинут)
        for (let y = 0; y < h; y += step) { const k = Math.max(0, (y - 22) / h), dx = Math.sin(T * 1.6 + i * 1.3 - k * 4) * 3 * k * k, sh = Math.min(step + 0.5, h - y); ctx.drawImage(A, ax, fy + y, w, sh, X + dx, Y + y, w, sh); }
      });
      ctx.restore(); }
    if (on('daynight')) {
      // ночь: дальний план темнеет сильнее, земля внизу (где стоят герои) — слабее, чтобы герои читались
      const col = k => `rgb(${Math.round(255 - 95 * nk * k)},${Math.round(255 - 85 * nk * k)},${Math.round(255 - 30 * nk * k)})`, tg = ctx.createLinearGradient(0, 0, 0, H);
      tg.addColorStop(0, col(1)); tg.addColorStop(0.5, col(0.85)); tg.addColorStop(1, col(0.45));
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H); ctx.restore();
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
