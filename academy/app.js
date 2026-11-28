// Академия магии — сайт ученика и пульт ведущего. Вход через Twitch (как у пульта RPG-фермы), связь с игрой через relay.
(function () {
  const CFG = window.PANEL_CONFIG || {}, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HOUSES = [
    { id: 'astra', name: 'Астра', color: '#4a7fe0', motto: 'звёзды и ясный ум' },
    { id: 'verdant', name: 'Вердант', color: '#46a862', motto: 'жизнь и терпение' },
    { id: 'vallor', name: 'Валлор', color: '#e0544e', motto: 'смелость и сила' },
    { id: 'lumen', name: 'Люмен', color: '#9a68d8', motto: 'луна и тайны' }];
  const emblem = (id, size) => `<img class="emb" src="img/emb/${id}.png" alt="" style="height:${size}px;width:auto">`;
  const houseOf = id => HOUSES.find(h => h.id === id);
  const STYLES = { m: [['messy', 'Растрёпанные'], ['sidepart', 'Пробор'], ['slick', 'Зачёс'], ['curly', 'Кудри'], ['ponytail', 'Хвостик'], ['spiky', 'Ёжик'], ['wavy', 'Волны'], ['buzz', 'Коротко']],
    f: [['ponytail', 'Хвост'], ['braids', 'Две косы'], ['bob', 'Каре'], ['wavy', 'Локоны'], ['bun', 'Пучок'], ['sidebraid', 'Коса набок'], ['straight', 'Прямые'], ['twinbuns', 'Два пучка']] };
  const COLORS = [['black', 'Чёрные', '#24201f'], ['darkbrown', 'Каштановые', '#5a3420'], ['lightbrown', 'Русые', '#9a6a40'], ['ginger', 'Рыжие', '#d9772e'], ['blond', 'Светлые', '#e8c560']];
  // сон по дороге в Академию: ответы незаметно выбирают факультет (a — Astra, v — Verdant, r — Vallor, l — Lumen)
  const QUIZ = [
    ['Вы стоите в густом тумане перед старой башней. Дверь заперта, а изнутри доносится тихий стук.', [['a', 'Разглядываю узор на замке: он похож на загадку'], ['v', 'Окликаю: вдруг там кто-то ждёт помощи'], ['r', 'Налегаю плечом: дверь поддастся'], ['l', 'Обхожу башню в поисках другого входа']]],
    ['Дверь исчезает, а на каменной дорожке появляются четыре вещи. Взять можно только одну.', [['r', 'Старый меч в потёртых ножнах'], ['l', 'Колоду карт, тёплую на ощупь'], ['a', 'Медный телескоп'], ['v', 'Горсть светящихся семян']]],
    ['Вещь в ваших руках вспыхивает, и откуда-то издалека звучит голос: «Зачем тебе магия?»', [['v', 'Чтобы лечить и помогать расти'], ['a', 'Чтобы понять, как устроен мир'], ['l', 'Чтобы видеть то, что скрыто'], ['r', 'Чтобы защищать тех, кто рядом']]],
    ['Из тумана выходят знакомые лица. Ваши друзья говорят о вас. Что они говорят?', [['l', '«Тебе можно доверить любую тайну»'], ['r', '«Ты никогда не отступаешь»'], ['v', '«Рядом с тобой спокойно»'], ['a', '«Ты всегда знаешь, что посоветовать»']]],
    ['Сон начинает таять. Перед пробуждением вы видите четыре тропы. По какой вы пойдёте?', [['a', 'По винтовой лестнице к звёздам'], ['l', 'В тихий коридор, где горят свечи'], ['v', 'В сад, полный цветов'], ['r', 'На площадь, где звенит сталь']]]];
  let RIG = null; fetch('rig.json').then(r => r.json()).then(j => { RIG = j; render(); }).catch(() => {});
  const IMGS = {};
  function img(src) { if (!IMGS[src]) { const i = IMGS[src] = new Image(); i.onload = () => drawFigures(); i.src = src; } return IMGS[src]; }
  // ученик целиком: та же сборка, что в оверлее (стойка, без поворотов)
  function figure(look, robe, h) { return `<canvas class="fig" data-look="${esc(look)}" data-robe="${esc(robe || 'grey')}" style="height:${h}px;width:${Math.round(h * 0.7)}px"></canvas>`; }
  function drawFigures() {
    if (!RIG) return;
    document.querySelectorAll('canvas.fig').forEach(cv => {
      const look = cv.dataset.look, robe = cv.dataset.robe, hd = RIG.heads[look]; if (!hd) return;
      const parts = { arm_f: `img/body/arm_f_${robe}.png`, leg_f: 'img/body/leg_f.png', leg_n: 'img/body/leg_n.png', body: `img/body/body_${robe}.png`, arm_n: `img/body/arm_n_${robe}.png`, head: `img/heads/${look}.png` };
      const im = {}; for (const k in parts) { im[k] = img(parts[k]); if (!im[k].complete || !im[k].naturalWidth) return; }
      const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
      const A = RIG.ATT, P = RIG.PIV, Z = RIG.size, X = RIG.BX, Y = RIG.BY;
      // рамка по факту: тело + реальная голова с причёской (косы, пучки), с запасом
      const hx = X + A.head[0] - hd.p[0], hy = Y + A.head[1] - hd.p[1];
      const b = [Math.min(RIG.bbox[0], hx) - 12, Math.min(RIG.bbox[1], hy) - 12, Math.max(RIG.bbox[2], hx + hd.w) + 12, RIG.bbox[3] + 26];
      const c = cv.getContext('2d'), bw = b[2] - b[0], bh = b[3] - b[1], k = Math.min(W * dpr / bw, H * dpr / bh);
      c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(k, 0, 0, k, (W * dpr - bw * k) / 2 - b[0] * k, (H * dpr - bh * k) - b[1] * k);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(X + Z.body[0] / 2, RIG.bbox[3] - 4, bw * .32, 16, 0, 0, 7); c.fill();
      const put = (n, ax, ay) => c.drawImage(im[n], ax - P[n][0], ay - P[n][1], Z[n][0], Z[n][1]);
      put('arm_f', X + A.arm_f[0], Y + A.arm_f[1]); put('leg_f', X + A.leg_f[0], Y + A.leg_f[1]); put('leg_n', X + A.leg_n[0], Y + A.leg_n[1]);
      c.drawImage(im.body, X, Y, Z.body[0], Z.body[1]);
      c.drawImage(im.head, X + A.head[0] - hd.p[0], Y + A.head[1] - hd.p[1], hd.w, hd.h);
      put('arm_n', X + A.arm_n[0], Y + A.arm_n[1]);
      // косы и пряди ниже подбородка — поверх плеча, а не под рукавом
      const hy0 = Y + A.head[1] - hd.p[1], cut = hd.p[1] - 6;
      c.save(); c.beginPath(); c.rect(X + A.head[0] - hd.p[0], hy0 + cut, hd.w, hd.h - cut); c.clip();
      c.drawImage(im.head, X + A.head[0] - hd.p[0], hy0, hd.w, hd.h); c.restore();
    });
  }
  // ---------- живая сцена: ученик идёт к воротам / стоит в зале с рунами ----------
  const SCN = { gate: { src: 'img/scene_gate.jpg', ox: 700, oy: 300, w: 1028, h: 612 }, hall: { src: 'img/scene_hall.jpg', ox: 0, oy: 330, w: 2122, h: 579 } };
  const BAN_X = { lumen: 380, vallor: 707, verdant: 1435, astra: 1779 }, HCOL = { astra: '#4a7fe0', verdant: '#46a862', vallor: '#e0544e', lumen: '#9a68d8' };
  const walkers = {}; // ключ сцены -> {x, ph}, чтобы перерисовка страницы не начинала путь заново
  function scene(mode, look, robe, opt) {
    const o = opt || {};
    return `<canvas class="scene" data-mode="${mode}" data-look="${esc(look)}" data-robe="${esc(robe || 'grey')}" data-tx="${o.tx || 0}" data-house="${o.house || ''}" data-st="${o.st || ''}"></canvas>`;
  }
  function drawChar(c, look, robe, x, y, sc, p) {
    const hd = RIG.heads[look]; if (!hd) return;
    const parts = { arm_f: `img/body/arm_f_${robe}.png`, leg_f: 'img/body/leg_f.png', leg_n: 'img/body/leg_n.png', body: `img/body/body_${robe}.png`, arm_n: `img/body/arm_n_${robe}.png`, head: `img/heads/${look}.png` };
    const im = {}; for (const k in parts) { im[k] = img(parts[k]); if (!im[k].complete || !im[k].naturalWidth) return; }
    const A = RIG.ATT, P = RIG.PIV, Z = RIG.size, X = RIG.BX, Y = RIG.BY, bb = RIG.bbox, b = p.bob || 0;
    c.save(); c.translate(x + (p.jx || 0) * sc, y);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 0, 34 * sc * (1 - (p.lift || 0) / 80), 8 * sc, 0, 0, 7); c.fill();
    c.translate(0, -(p.lift || 0) * sc); if (p.rot) c.rotate(p.rot * Math.PI / 180);
    const k = sc * 150 / (bb[3] - bb[1]); c.scale(k * (p.dir || 1), k); c.translate(-(bb[0] + bb[2]) / 2, -bb[3]);
    const part = (n, ax, ay, ang) => { c.save(); c.translate(ax, ay); c.rotate(ang * Math.PI / 180); c.drawImage(im[n], -P[n][0], -P[n][1], Z[n][0], Z[n][1]); c.restore(); };
    part('arm_f', X + A.arm_f[0], Y + A.arm_f[1] + b, p.af || 0); part('leg_f', X + A.leg_f[0], Y + A.leg_f[1], p.lf || 0); part('leg_n', X + A.leg_n[0], Y + A.leg_n[1], p.ln || 0);
    c.drawImage(im.body, X, Y + b, Z.body[0], Z.body[1]);
    const head = () => { c.save(); c.translate(X + A.head[0], Y + A.head[1] + b + (p.hb || 0)); c.rotate((p.hr || 0) * Math.PI / 180); c.drawImage(im.head, -hd.p[0], -hd.p[1], hd.w, hd.h); c.restore(); };
    head(); part('arm_n', X + A.arm_n[0], Y + A.arm_n[1] + b, p.an || 0);
    c.save(); c.translate(X + A.head[0], Y + A.head[1] + b + (p.hb || 0)); c.rotate((p.hr || 0) * Math.PI / 180);
    c.beginPath(); c.rect(-hd.p[0], -6, hd.w, hd.h); c.clip(); c.drawImage(im.head, -hd.p[0], -hd.p[1], hd.w, hd.h); c.restore();
    c.restore();
  }
  // ---------- живая Академия: вся сцена как в OBS ----------
  const HALL_X = 1728, HALL_W = 2122, DOOR_X = 1560, ROAD_Y = 742, ARCH_FLOOR = 771, STAGE = { x: HALL_X + 1062, front: 738, top: 676 };
  const ROBE = { astra: 'blue', verdant: 'green', vallor: 'red', lumen: 'purple' };
  const EMO = { jump: ['!', '#ffd24a'], wave: ['♪', '#fff'], proud: ['✦', '#ffd24a'], calm: ['♥', '#ff8fb0'], shake: ['💧', '#7cc4ff'], stumble: ['✶', '#ffe27a'], yawn: ['z Z', '#d8e4ff'], grumpy: ['#', '#ff6a5a'], confused: ['?', '#fff'] };
  const LV = { ents: {}, scene: null, sorting: null, at: 0, follow: true, scrolled: 0 };
  function lvUpdate(sc) {
    LV.scene = sc; if (!sc) return;
    const seen = new Set(), E = LV.ents;
    const ent = (k, n, look, x, y) => { let e = E[k]; if (!e) e = E[k] = { k, n, look, x, y, ph: 0, a: x < 0 ? 1 : 0, robe: 'grey', seed: Math.random() * 10 }; seen.add(k); e.n = n; e.look = look; return e; };
    (sc.q || []).forEach((q, i) => { const e = ent(q[0], q[1], q[2], -60, ROAD_Y); e.tx = 1290 - i * 150; e.ty = ROAD_Y; e.mode = 'q'; e.tr = q.slice(3); e.robe = 'grey'; e.react = null; e.house = null; });
    for (const hid in (sc.h || {})) sc.h[hid].forEach((o, i) => { const e = ent(o[0], o[1], o[2], HALL_X + BAN_X[hid] + (i - 1.5) * 80, 774); e.tx = HALL_X + BAN_X[hid] + (i - 1.5) * 80; e.ty = 774; e.mode = 'h'; e.ri = i; e.house = hid; e.robe = ROBE[hid]; e.react = null; });
    const so = sc.s;
    if (so) {
      const e = ent(so[0], so[1], so[2], -60, ROAD_Y), st = so[3];
      e.mode = 's'; e.st = st; e.react = so[5]; if (so[4]) { e.house = so[4]; e.robe = ROBE[so[4]]; }
      if (st === 'enter' || st === 'tunnel') { e.tx = DOOR_X; e.ty = ROAD_Y; }
      else if (st === 'hall') { e.tx = STAGE.x; e.ty = STAGE.front; }
      else { e.tx = STAGE.x; e.ty = STAGE.top; }
    }
    for (const k in E) if (!seen.has(k)) E[k].gone = true; else E[k].gone = false;
  }
  function lvPose(e, t, walking) {
    const sn = Math.sin, p = {};
    if (walking) { const ph = e.ph * Math.PI; return { ln: -22 * sn(ph), lf: 22 * sn(ph), an: 20 * sn(ph), af: -20 * sn(ph), bob: -6 * Math.abs(sn(ph)), hr: 1.5 * sn(ph), hb: -2 * Math.abs(sn(ph)) }; }
    if (e.mode === 's' && e.st === 'sorting') return { hb: 1.2 * sn(t * 31 + e.seed), jx: 0.8 * sn(t * 27), hr: 7 * sn(t * 2.1 + e.seed), an: 16 + 9 * sn(t * 7), af: -16 - 9 * sn(t * 7 + 1) };
    if (e.mode === 's' && e.st === 'react' && e.react) {
      e.ru = (e.ru || 0); const u = e.ru, k = Math.min(1, u * 4);
      switch (e.react) {
        case 'jump': return { lift: 30 * Math.abs(sn(u * Math.PI * 1.7)), an: -172 * k, af: -168 * k, hr: -4 * k };
        case 'wave': return { an: (-168 + 18 * sn(u * 14)) * k, hr: 4 * k, hb: -2 * Math.abs(sn(u * 7)) };
        case 'proud': return { hr: -7 * k, hb: -4 * k, an: 28 * k, af: -28 * k, lift: 3 * k };
        case 'calm': return { hb: 5 * Math.max(0, sn(u * 5)), hr: 4 * Math.max(0, sn(u * 5)), an: 4, af: -4 };
        case 'shake': return { jx: 2.2 * sn(u * 60), an: 32 * k, af: -32 * k, hb: 2 + sn(u * 40), hr: 3 * sn(u * 9) };
        case 'stumble': return { rot: 14 * sn(u * 7) * Math.exp(-u * 1.1), an: -60 * sn(u * 7) * Math.exp(-u), af: 60 * sn(u * 7) * Math.exp(-u) };
        case 'yawn': { const q = Math.min(1, u * 2); return { hr: -10 * q, hb: -3 * q, an: -125 * q }; }
        case 'grumpy': return { hr: 9 * sn(u * 9), an: 38 * k, af: -38 * k };
        case 'confused': return { hr: 11 * sn(u * 2.6), an: (-115 + 12 * sn(u * 13)) * k };
      }
    }
    const ph = t / 2.6 * 2 * Math.PI + e.seed; return { hb: -3 * sn(ph), hr: 1.5 * sn(ph), an: 2 * sn(ph), af: -2 * sn(ph) };
  }
  function lvTick(t, dt) {
    const cv = $('lv'); if (!cv || !LV.scene || !RIG) return;
    const bg = img('img/scene_full.jpg'), arch = img('img/arch.png'); if (!bg.complete || !bg.naturalWidth) return;
    const dpr = window.devicePixelRatio || 1, H = cv.clientHeight, W = Math.round(H * 4354 / 912);
    if (cv.style.width !== W + 'px') { cv.style.width = W + 'px'; }
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const c = cv.getContext('2d'), k = cv.height / 912; c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(bg, 0, 0, cv.width, cv.height);
    if (arch.complete && arch.naturalWidth) for (const ax of [HALL_X, HALL_X + HALL_W]) c.drawImage(arch, (ax - 60) * k, 0, 120 * k, cv.height);
    // руны: оживают, когда ученик на помосте
    const so = LV.scene.s, onStage = so && (so[3] === 'sorting' || so[3] === 'react'), decided = so && so[4];
    const chase = onStage && !decided ? Object.keys(BAN_X)[Math.floor(t * 7) % 4] : null;
    Object.keys(BAN_X).forEach((hid, i) => {
      const r = img(`img/rune_${hid}.png`); if (!r.complete || !r.naturalWidth) return;
      const on = chase === hid || (onStage && decided === hid), hh = 150 * k * (on ? 1.15 : 1), ww = hh * r.naturalWidth / r.naturalHeight;
      const x = (HALL_X + BAN_X[hid]) * k, y = (566 + 6 * Math.sin(t * 1.4 + i)) * k;
      if (on && decided) { const g = c.createRadialGradient(x, y, 0, x, y, 190 * k); g.addColorStop(0, HCOL[hid]); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .55; c.fillStyle = g; c.fillRect(x - 190 * k, y - 190 * k, 380 * k, 380 * k); c.globalCompositeOperation = 'source-over'; }
      c.globalAlpha = on ? 1 : (onStage ? .35 : .14); c.drawImage(r, x - ww / 2, y - hh / 2, ww, hh);
      if (on) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .45; c.drawImage(r, x - ww / 2, y - hh / 2, ww, hh); c.globalCompositeOperation = 'source-over'; }
      c.globalAlpha = 1;
    });
    // движение учеников
    const list = Object.values(LV.ents);
    for (const e of list) {
      if (e.gone) { e.a -= dt * 2; if (e.a <= 0) delete LV.ents[e.k]; continue; }
      if (e.mode === 's' && e.x < HALL_X - 100 && e.tx > HALL_X) { // через ворота в зал
        if (Math.abs(e.x - DOOR_X) > 4) { e.wx = DOOR_X; e.wy = ROAD_Y; } else { e.a -= dt * 3; if (e.a <= 0) { e.x = HALL_X; e.y = ARCH_FLOOR; } }
      } else { e.wx = e.tx; e.wy = e.ty; if (e.a < 1) e.a = Math.min(1, e.a + dt * 3); }
      if (e.mode === 's' && e.st === 'tunnel' && e.x < HALL_X) { e.wx = DOOR_X; e.wy = ROAD_Y; }
      const dx = e.wx - e.x, dy = e.wy - e.y, d = Math.hypot(dx, dy), sp = d > 700 ? 420 : 170;
      e.walking = d > 2; if (e.walking) { const st = Math.min(d, sp * dt); e.x += dx / d * st; e.y += dy / d * st; e.ph += st / 95; if (Math.abs(dx) > 1) e.dir = dx > 0 ? 1 : -1; }
      else if (e.mode === 'h') e.dir = e.x < STAGE.x ? 1 : -1; else e.dir = 1;
      if (e.mode === 's' && e.st === 'react') e.ru = (e.ru || 0) + dt; else e.ru = 0;
    }
    list.sort((a, b) => a.y - b.y);
    const me = user && user.login.toLowerCase();
    for (const e of list) { c.globalAlpha = Math.max(0, Math.min(1, e.a)); drawChar(c, e.look, e.robe, e.x * k, e.y * k, k, Object.assign(lvPose(e, t, e.walking), { dir: e.dir || 1 })); }
    c.globalAlpha = 1;
    // ники, эмоции, карточка новенького
    const fs = Math.max(10, 21 * k * 1.4);
    for (const e of list) {
      if (e.a < .3) continue;
      const mine = e.k === me, label = e.n.length > 12 ? e.n.slice(0, 11) + '…' : e.n;
      c.font = `800 ${fs}px Nunito, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = c.measureText(label).width + fs * .9, x = e.x * k, y = (e.y - 160) * k - (e.mode === 'q' ? (Math.round((1290 - e.tx) / 150) % 2) * fs * 1.5 : e.mode === 'h' ? (e.ri % 2) * fs * 1.5 : 0);
      c.fillStyle = mine ? 'rgba(246,210,107,.95)' : 'rgba(20,16,24,.78)'; rr(c, x - w / 2, y - fs * .7, w, fs * 1.4, fs * .4); c.fill();
      c.fillStyle = mine ? '#2a1e08' : e.house ? HCOL[e.house] : '#fff'; c.fillText(label, x, y);
      let em = null; if (e.mode === 's' && e.st === 'sorting' && (t * 1.1 + e.seed) % 1.6 < .9) em = ['💧', '#7cc4ff']; else if (e.mode === 's' && e.st === 'react') em = EMO[e.react];
      if (em) { const f2 = fs * 1.5; c.font = `900 ${f2}px Nunito, "Segoe UI Emoji", sans-serif`; c.lineWidth = f2 * .16; c.strokeStyle = 'rgba(30,20,20,.85)'; const ex = (e.x + 34) * k, ey = (e.y - 152 - 6 * Math.sin(t * 4)) * k; c.strokeText(em[0], ex, ey); c.fillStyle = em[1]; c.fillText(em[0], ex, ey); }
    }
    const q0 = (LV.scene.q || [])[0], e0 = q0 && LV.ents[q0[0]];
    if (e0 && !e0.walking && e0.tr && e0.tr.length === 3) {
      c.font = `800 ${fs}px Nunito, system-ui, sans-serif`; c.textAlign = 'left';
      const lines = e0.tr.map((x, i) => ['+ ', '− ', '◦ '][i] + x), w = Math.max(...lines.map(l => c.measureText(l).width)) + fs * 1.2, h = fs * 1.35 * 3 + fs * .6;
      const x = Math.min(e0.x * k + 50 * k, (DOOR_X - 10) * k - w), y = (e0.y - 210) * k - h;
      c.fillStyle = 'rgba(20,16,24,.82)'; rr(c, x, y, w, h, fs * .45); c.fill();
      lines.forEach((l, i) => { c.fillStyle = ['#8fe39a', '#ff9a8a', '#9cc8ff'][i]; c.fillText(l, x + fs * .6, y + fs * .95 + i * fs * 1.35); });
    }
    // камера: следим за своим учеником (или за церемонией), пока зритель сам не прокрутил
    const box = cv.parentElement, mine = me && LV.ents[me];
    if (LV.follow && Date.now() - LV.scrolled > 6000) {
      const fx = mine ? mine.x : (so ? STAGE.x : HALL_X + HALL_W / 2), want = fx * k / dpr - box.clientWidth / 2;
      const cur = box.scrollLeft, nx = cur + (want - cur) * Math.min(1, dt * 3);
      if (Math.abs(nx - cur) > .5) { LV.auto = true; box.scrollLeft = nx; }
    }
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function renderLive() {
    const sec = $('live'), show = !!(user && state && state.online && state.pub && state.pub.scene);
    sec.hidden = !show; if (!show) return;
    lvUpdate(state.pub.scene);
    if (!sec.dataset.init) { sec.dataset.init = 1; const box = sec.querySelector('.lv-scroll'); box.addEventListener('scroll', () => { if (LV.auto) { LV.auto = false; return; } LV.scrolled = Date.now(); }, { passive: true }); }
  }
  let lastT = 0;
  function tickScenes(now) {
    const t = now / 1000, dt = Math.min(0.05, lastT ? t - lastT : 0); lastT = t;
    lvTick(t, dt);
    document.querySelectorAll('canvas.scene').forEach(cv => {
      if (!RIG) return;
      const m = SCN[cv.dataset.mode], bg = img(m.src); if (!bg.complete || !bg.naturalWidth) return;
      const look = cv.dataset.look, robe = cv.dataset.robe, house = cv.dataset.house, st = cv.dataset.st;
      // камера: какой кусок сцены показать (в координатах сцены)
      const cam = cv.dataset.mode === 'gate' ? [780, 420, 820, 440] : house ? [Math.min(2122 - 1000, Math.max(0, BAN_X[house] - 450)), 420, 1000, 440] : [300, 330, 1530, 560];
      const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = Math.round(W * cam[3] / cam[2]);
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px'; }
      const c = cv.getContext('2d'), k = cv.width / cam[2], f = bg.naturalWidth / m.w; c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(bg, (cam[0] - m.ox) * f, (cam[1] - m.oy) * f, cam[2] * f, cam[3] * f, 0, 0, cv.width, cv.height);
      const X = v => (v - cam[0]) * k, Y = v => (v - cam[1]) * k;
      if (cv.dataset.mode === 'gate') {
        const key = 'gate:' + look, w = walkers[key] || (walkers[key] = { x: 700, ph: 0 });
        const tx = +cv.dataset.tx || 1020, d = tx - w.x, step = Math.min(Math.abs(d), 170 * dt);
        w.x += Math.sign(d) * step; w.ph += step / 95; const walking = Math.abs(d) > 1;
        const ph = w.ph * Math.PI, sn = Math.sin, id = t / 2.6 * 2 * Math.PI;
        const p = walking ? { ln: -22 * sn(ph), lf: 22 * sn(ph), an: 20 * sn(ph), af: -20 * sn(ph), bob: -6 * Math.abs(sn(ph)), hr: 1.5 * sn(ph), hb: -2 * Math.abs(sn(ph)) } : { hb: -3 * sn(id), hr: 1.5 * sn(id), an: 2 * sn(id), af: -2 * sn(id) };
        drawChar(c, look, robe, X(w.x), Y(742), k, p);
      } else {
        const id = t / 2.6 * 2 * Math.PI, sn = Math.sin;
        const chase = st === 'sorting' ? Object.keys(BAN_X)[Math.floor(t * 7) % 4] : null;
        Object.keys(BAN_X).forEach((hid, i) => {
          const r = img(`img/rune_${hid}.png`); if (!r.complete || !r.naturalWidth) return;
          const on = chase === hid || house === hid, hh = 150 * k * (on ? 1.15 : 1), ww = hh * r.naturalWidth / r.naturalHeight;
          const x = X(BAN_X[hid]), y = Y(566 + 6 * sn(t * 1.4 + i));
          if (house === hid) { const g = c.createRadialGradient(x, y, 0, x, y, 170 * k); g.addColorStop(0, HCOL[hid]); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .45 + .1 * sn(t * 3); c.fillStyle = g; c.fillRect(x - 170 * k, y - 170 * k, 340 * k, 340 * k); c.globalCompositeOperation = 'source-over'; }
          c.globalAlpha = on ? 1 : (house || chase ? .35 : .8); c.drawImage(r, x - ww / 2, y - hh / 2, ww, hh);
          if (on) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .4; c.drawImage(r, x - ww / 2, y - hh / 2, ww, hh); c.globalCompositeOperation = 'source-over'; }
          c.globalAlpha = 1;
        });
        const sx = house ? BAN_X[house] + 90 : 1062, sy = house ? 800 : 700;
        drawChar(c, look, robe, X(sx), Y(sy), k, { hb: -3 * sn(id), hr: 1.5 * sn(id), an: 2 * sn(id), af: -2 * sn(id), dir: house && sx > 1062 ? -1 : 1 });
      }
    });
    requestAnimationFrame(tickScenes);
  }
  requestAnimationFrame(tickScenes);
  let HEADS = {}; fetch('heads.json').then(r => r.json()).then(j => { HEADS = j; render(); }).catch(() => {});
  const draftKey = 'ac_draft';
  let draft = (() => { try { return JSON.parse(localStorage.getItem(draftKey)) || null; } catch (e) { return null; } })() || { g: 'f', st: 'braids', c: 'darkbrown', q: [] };
  let step = null; // null | 'look' | 'dream' | 0..4 (сцена сна) | 'ready'
  const saveDraft = () => { try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch (e) {} };
  const lookOf = d => `${d.g}_${d.st}_${d.c}`;
  const mock = /[?&]mock=1/.test(location.search);
  let user = null, state = null, ws = null, retry = 1500, seq = 0, lastRes = null, busy = false, confirmYear = false, sureKey = null, filter = '';
  const redirect = () => location.origin + location.pathname.replace(/index\.html$/, '');
  const TK = {
    get(k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { try { sessionStorage.setItem(k, v); } catch (x) {} } },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {} } };

  // ---------- вход через Twitch (implicit flow, без прав) ----------
  function login() {
    const st = Math.random().toString(36).slice(2) + Date.now().toString(36); TK.set('ac_state', st);
    location.href = 'https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=' + encodeURIComponent(CFG.TWITCH_CLIENT_ID) +
      '&redirect_uri=' + encodeURIComponent(redirect()) + '&scope=&state=' + encodeURIComponent(st);
  }
  function logout() { TK.del('ac_token'); user = null; state = null; if (ws) ws.close(); ws = null; render(); }
  function takeHash() {
    if (!location.hash || location.hash.length < 2) return;
    const p = new URLSearchParams(location.hash.slice(1)); history.replaceState(null, '', location.pathname + location.search);
    if (p.get('error')) return setRes(false, 'Вход отменён');
    const t = p.get('access_token'), st = p.get('state');
    if (t && st && st === TK.get('ac_state')) TK.set('ac_token', t); else if (t) setRes(false, 'Ошибка входа, попробуйте ещё раз');
    TK.del('ac_state');
  }
  async function checkTok(t) {
    try {
      const r = await fetch(CFG.VALIDATE_URL || 'https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + t } });
      if (r.status === 401) return 'bad';
      const j = r.ok ? await r.json() : null; if (!j) return null;
      return (j.client_id !== CFG.TWITCH_CLIENT_ID || !j.login) ? 'bad' : j;
    } catch (e) { return null; }
  }
  async function validate() {
    const t = TK.get('ac_token'); if (!t) return render();
    const v = await checkTok(t);
    if (v === 'bad') { TK.del('ac_token'); setRes(false, 'Вход устарел, войдите снова'); return render(); }
    if (!v) { render(); setTimeout(validate, 5000); return; }
    user = { login: String(v.login).toLowerCase() }; render(); connect();
  }

  // ---------- связь с relay ----------
  let lastMsg = Date.now(), laterT = 0;
  function connect() {
    if (mock || !user) return;
    if (!CFG.RELAY_URL) { state = { online: false, nocfg: true }; return render(); }
    try { ws = new WebSocket(CFG.RELAY_URL.replace(/\/+$/, '') + '/viewer'); } catch (e) { return later(); }
    const me = ws;
    ws.onopen = () => { lastMsg = Date.now(); me.send(JSON.stringify({ type: 'auth', token: TK.get('ac_token') })); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      lastMsg = Date.now(); if (m.type === 'pong') return;
      if (m.type === 'hello' || m.type === 'state' || m.type === 'offline') retry = 1500;
      if (m.type === 'cmd-res') { busy = false; setRes(m.ok, m.msg || (m.ok ? 'готово' : 'не получилось')); return; }
      if (m.type === 'state') state = m; else if (m.type === 'offline') state = { online: false };
      else if (m.type === 'error' && m.code === 'bad-token') { logout(); setRes(false, 'Вход устарел, войдите снова'); }
      render();
    };
    ws.onclose = e => { if (ws !== me) return; ws = null; if (user && e.code !== 4003 && e.code !== 4010) later(); };
  }
  function later() { if (laterT) return; laterT = setTimeout(() => { laterT = 0; connect(); }, retry); retry = Math.min(8000, Math.round(retry * 1.7)); }
  setInterval(() => {
    if (ws && ws.readyState === 1) { ws.send('{"type":"ping"}'); if (Date.now() - lastMsg > 65000) try { ws.close(); } catch (e) {} }
    else if (user && !ws && !laterT && !mock) connect();
  }, 20000);
  function send(cmd, arg) {
    if (mock) return mockCmd(cmd, arg);
    if (!ws || ws.readyState !== 1) return setRes(false, 'нет связи, пробую переподключиться');
    busy = true; render(); ws.send(JSON.stringify({ type: 'cmd', id: String(++seq), cmd, arg: arg || '' }));
    setTimeout(() => { if (busy) { busy = false; render(); } }, 9000);
  }
  function setRes(ok, msg) { lastRes = { ok, msg, at: Date.now() }; render(); }

  // ---------- отрисовка ----------
  function render() { renderAuth(); renderLive(); renderMe(); renderCup(); renderAdmin(); drawFigures(); }
  function renderAuth() {
    $('auth').innerHTML = user
      ? `<span>Вы вошли как <b>${esc(user.login)}</b></span><button class="btn-ghost btn-small" id="out">Выйти</button>`
      : '';
    const o = $('out'); if (o) o.onclick = logout;
  }
  function resLine() { return lastRes && Date.now() - lastRes.at < 15000 ? `<p class="res ${lastRes.ok ? '' : 'bad'}">${esc(lastRes.msg)}</p>` : ''; }
  function face(look, size, cls) {
    const m = HEADS[look]; if (!m) return `<div class="${cls || 'portrait'}" style="width:${size}px;height:${size}px"></div>`;
    if (cls === 'mini') { // причёска целиком, без обрезки; общий масштаб, чтобы длинные косы были видны в настоящую длину
      let mw = 1, mh = 1; for (const key in HEADS) if (key[0] === look[0]) { mw = Math.max(mw, HEADS[key][0]); mh = Math.max(mh, HEADS[key][1]); }
      const k = Math.min(size / mw, size * 1.25 / mh), w = m[0] * k, h = m[1] * k;
      return `<div class="mini" style="width:${size}px;height:${Math.round(size * 1.25)}px"><img src="img/heads/${encodeURIComponent(look)}.png" alt="" style="width:${w}px;left:${(size - w) / 2}px;top:${(size * 1.25 - h) / 2}px"></div>`;
    }
    const k = size * 0.19 / m[4], w = m[0] * k, x = size / 2 - m[2] * k, y = size * 0.6 - m[3] * k;
    return `<div class="${cls || 'portrait'}" style="width:${size}px;height:${size}px"><img src="img/heads/${encodeURIComponent(look)}.png" alt="" style="width:${w}px;left:${x}px;top:${y}px"></div>`;
  }
  function portrait(look, robe) { return look ? `<div class="stage">${figure(look, robe, 190)}</div>` : `<div class="portrait empty">?</div>`; }
  function renderMe() {
    const box = $('me');
    if (!user) {
      box.innerHTML = `<h2>Добро пожаловать</h2><p class="sub">Войдите через Twitch, чтобы поступить в Академию. Ваш ученик появится у ворот замка прямо на стриме.</p>
        <div class="row"><button class="btn-gold" id="in">Войти через Twitch</button></div>${resLine()}`;
      $('in').onclick = login; return;
    }
    if (!state) { box.innerHTML = `<p class="big"><span class="spin">✦</span> Подключение…</p>`; return; }
    if (state.nocfg) { box.innerHTML = `<h2>Сайт ещё не настроен</h2><p class="sub">В config.js не указан адрес ретранслятора.</p>`; return; }
    if (!state.online) { box.innerHTML = `<h2>Академия закрыта</h2><p class="sub">Стрим сейчас не идёт. Поступить можно будет, когда начнётся трансляция.</p>${resLine()}`; return; }
    const me = state.me, pub = state.pub || {};
    if (!me) { renderBuilder(box); return; }
    const chips = (me.tr || []).map((x, i) => `<span class="tr t${i}">${esc(x)}</span>`).join('');
    if (me.st === 'queue') {
      const ahead = me.pos - 1 + (pub.sorting ? 1 : 0), wait = Math.round(ahead * (pub.every || 7) / 10) * 10;
      box.innerHTML = `<p class="big">${esc(me.n)} у ворот</p><div class="traits">${chips}</div>
        <p class="cap">Место <b>${me.pos}</b> из ${pub.queue || me.pos} · ${ahead ? `перед вами ${ahead}` : 'вы следующий!'}${pub.paused ? ' · распределение на паузе' : ahead ? ` · ждать ${wait < 60 ? 'меньше минуты' : 'около ' + Math.round(wait / 60) + ' мин'}` : ''}</p>${resLine()}`;
      return;
    }
    if (me.st === 'sorting') {
      box.innerHTML = `<p class="big"><span class="spin">✦</span> ${esc(me.n)} на церемонии</p><div class="traits">${chips}</div>${resLine()}`;
      return;
    }
    const h = houseOf(me.house);
    box.innerHTML = `<div class="house" style="background:${h.color}">${emblem(h.id, 44)}<div><b>${esc(me.n)} · ${h.name}</b></div></div><div class="traits">${chips}</div>${resLine()}`;
  }
  function renderBuilder(box) {
    const L = lookOf(draft);
    if (step === null) {
      box.innerHTML = `<div class="status">${portrait(L)}<div><p class="big">Письмо с восковой печатью</p>
        <p class="sub">Ворота Академии магии открыты для новых учеников, и в этом году в списке есть ваше имя. Осталось решить, каким вы приедете.</p></div></div>
        <div class="row"><button class="btn-gold" id="go">Выбрать внешность</button></div>${resLine()}`;
      $('go').onclick = () => { step = 'look'; render(); }; return;
    }
    if (step === 'look') {
      const st = STYLES[draft.g];
      box.innerHTML = `<h2>Внешность</h2><div class="builder"><div class="stage big">${figure(L, 'grey', 250)}</div>
        <div class="opts"><p class="lbl2">Ученик</p><div class="seg"><button data-g="m" class="${draft.g === 'm' ? 'on' : ''}">Парень</button><button data-g="f" class="${draft.g === 'f' ? 'on' : ''}">Девушка</button></div>
        <p class="lbl2">Цвет волос</p><div class="sw">${COLORS.map(c => `<button data-c="${c[0]}" class="${draft.c === c[0] ? 'on' : ''}" style="background:${c[2]}" aria-label="${c[1]}" title="${c[1]}"></button>`).join('')}</div></div></div>
        <p class="lbl2">Причёска</p><div class="styles">${st.map(x => `<button data-s="${x[0]}" class="${draft.st === x[0] ? 'on' : ''}">${face(`${draft.g}_${x[0]}_${draft.c}`, 70, 'mini')}<span>${x[1]}</span></button>`).join('')}</div>
        <div class="row"><button id="back">Назад</button><button class="btn-gold" id="next">Далее</button></div>`;
      box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { if (draft.g !== b.dataset.g) { draft.g = b.dataset.g; draft.st = STYLES[draft.g][0][0]; saveDraft(); render(); } });
      box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { draft.c = b.dataset.c; saveDraft(); render(); });
      box.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { draft.st = b.dataset.s; saveDraft(); render(); });
      $('back').onclick = () => { step = null; render(); }; $('next').onclick = () => { draft.q = []; step = 'dream'; render(); };
      return;
    }
    if (step === 'dream') {
      box.innerHTML = `<div class="status">${portrait(L)}<div><p class="big">Дорога</p>
        <p class="sub">Путь до Академии неблизкий. Повозка мерно покачивается, за окном тянутся холмы, и вы сами не замечаете, как закрываются глаза…</p>
        <p class="sub">Вам снится очень странный сон.</p></div></div>
        <div class="row"><button id="back">Назад</button><button class="btn-gold" id="next">Далее</button></div>`;
      $('back').onclick = () => { step = 'look'; render(); }; $('next').onclick = () => { step = 0; render(); };
      return;
    }
    if (typeof step === 'number') {
      const [q, ans] = QUIZ[step];
      box.innerHTML = `<p class="sub dream">Сон</p><div class="dots">${QUIZ.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'cur' : ''}"></i>`).join('')}</div>
        <h2 class="q">${esc(q)}</h2><div class="answers">${ans.map(a => `<button data-a="${a[0]}">${esc(a[1])}</button>`).join('')}</div>
        <div class="row"><button id="back">Назад</button></div>`;
      box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { draft.q[step] = b.dataset.a; draft.q.length = step + 1; saveDraft(); step = step + 1 < QUIZ.length ? step + 1 : 'ready'; render(); });
      $('back').onclick = () => { step = step === 0 ? 'dream' : step - 1; render(); };
      return;
    }
    box.innerHTML = `${scene('gate', L, 'grey', { tx: 1000 })}<p class="cap">Повозка остановилась. Впереди ворота Академии.</p>
      <div class="row"><button id="back">Изменить</button><button class="btn-gold" id="send" ${busy ? 'disabled' : ''}>Выйти к воротам</button></div>${resLine()}`;
    $('back').onclick = () => { step = 'look'; render(); };
    $('send').onclick = () => { send('поступить', L + ' ' + draft.q.join('')); step = null; };
  }
  function renderCup() {
    const pub = (state && state.pub) || null, counts = pub ? pub.counts : { astra: 0, verdant: 0, vallor: 0, lumen: 0 };
    const max = Math.max(1, ...HOUSES.map(h => counts[h.id] || 0));
    $('bars').innerHTML = HOUSES.map(h => `<div class="bar"><span style="color:${h.color}">${h.name}</span><i><span style="width:${(counts[h.id] || 0) / max * 100}%;background:${h.color}"></span></i><em>${counts[h.id] || 0}</em></div>`).join('');
    $('cupnote').textContent = pub ? `Учеников в Академии: ${HOUSES.reduce((a, h) => a + (counts[h.id] || 0), 0)}. В очереди у ворот: ${pub.queue}.` : 'Счёт появится, когда начнётся стрим.';
  }
  function renderAdmin() {
    const box = $('adm');
    if (!state || !state.admin || !state.online) { box.hidden = true; return; }
    box.hidden = false;
    const pub = state.pub || {}, adm = state.adm || {}, q = adm.queue || [], all = (adm.all || []).slice().reverse();
    const f = filter.trim().toLowerCase(), shown = all.filter(x => !f || x[0].includes(f) || String(x[1]).toLowerCase().includes(f)).slice(0, 80);
    const item = (k, n, color) => `<div class="item">${color ? `<i class="dot" style="background:${color}"></i>` : ''}<span>${esc(n)}</span><button data-rm="${esc(k)}" class="${sureKey === k ? 'sure' : ''}">${sureKey === k ? 'Точно убрать?' : 'Убрать'}</button></div>`;
    box.innerHTML = `<h2>Пульт ведущего</h2>
      <p class="sub">${pub.paused ? 'Распределение на паузе.' : 'Распределение идёт.'} В очереди: ${pub.queue || 0}.${pub.sorting ? ` На церемонии: ${esc(pub.sorting)}.` : ''}</p>
      <div class="row">${pub.paused ? '<button class="btn-gold" data-c="продолжить">Продолжить</button>' : '<button data-c="пауза">Пауза</button>'}
        <button data-c="следующий" ${!pub.queue || pub.sorting ? 'disabled' : ''}>Следующего на церемонию</button><button data-c="тест">Тестовый ученик</button></div>
      <p class="lbl">Распределение раз в</p><div class="chips">${[3, 5, 7, 10, 15, 20, 30, 60].map(s => `<button data-c="скорость" data-a="${s}" class="${pub.every === s ? 'on' : ''}">${s} с</button>`).join('')}</div>
      <p class="lbl">Учеников каждого факультета в зале</p><div class="chips">${[1, 2, 3, 4, 5, 6].map(s => `<button data-c="места" data-a="${s}" class="${adm.perHouse === s ? 'on' : ''}">${s}</button>`).join('')}</div>
      <p class="lbl">Очередь у ворот</p><div class="list">${q.length ? q.map(x => item(x[0], x[1])).join('') : '<p class="sub">пусто</p>'}</div>
      <p class="lbl">Ученики (новые сверху)</p><input type="search" id="flt" placeholder="Найти по нику" value="${esc(filter)}">
      <div class="list">${shown.length ? shown.map(x => item(x[0], x[1], (houseOf(x[2]) || {}).color)).join('') : '<p class="sub">никого</p>'}</div>
      ${confirmYear ? `<div class="confirm"><b>Начать новый учебный год?</b><p class="sub">Все ученики будут выпущены, счёт факультетов обнулится. Это нельзя отменить.</p>
        <div class="row"><button class="btn-danger" id="yYes">Да, начать заново</button><button id="yNo">Отмена</button></div></div>`
        : '<div class="row"><button class="btn-danger" id="year">Новый учебный год</button></div>'}`;
    box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => send(b.dataset.c, b.dataset.a || ''));
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const k = b.dataset.rm; if (sureKey === k) { sureKey = null; send('убрать', k); } else { sureKey = k; render(); setTimeout(() => { if (sureKey === k) { sureKey = null; render(); } }, 4000); } });
    const fl = $('flt'); if (fl) fl.oninput = () => { filter = fl.value; const pos = fl.selectionStart; renderAdmin(); const n = $('flt'); n.focus(); n.setSelectionRange(pos, pos); };
    const y = $('year'); if (y) y.onclick = () => { confirmYear = true; render(); };
    const yy = $('yYes'); if (yy) yy.onclick = () => { confirmYear = false; send('новый-год', ''); };
    const yn = $('yNo'); if (yn) yn.onclick = () => { confirmYear = false; render(); };
  }

  // ---------- пример без Twitch (?mock=1) ----------
  function mockCmd(cmd, arg) {
    const p = state.pub;
    if (cmd === 'поступить') {
      const L = arg.split(' ')[0], tr = ['Любопытный', 'Храпун', 'Сова'];
      state.me = { n: user.login, look: L, st: 'queue', pos: 1, tr }; p.queue = 3; setRes(true, 'вы в очереди: место 1');
      p.scene.q.unshift([user.login, user.login, L, ...tr]); render();
      setTimeout(() => { p.scene.q.shift(); p.scene.s = [user.login, user.login, L, 'enter', null, null]; state.me.st = 'sorting'; render(); }, 6000);
      setTimeout(() => { p.scene.s[3] = 'hall'; render(); }, 9000);
      setTimeout(() => { p.scene.s[3] = 'sorting'; render(); }, 14000);
      setTimeout(() => { p.scene.s[4] = 'lumen'; render(); }, 17000);
      setTimeout(() => { p.scene.s[3] = 'react'; p.scene.s[5] = 'jump'; render(); }, 18000);
      setTimeout(() => { p.scene.s = null; p.scene.h.lumen.push([user.login, user.login, L]); state.me.st = 'house'; state.me.house = 'lumen'; p.counts.lumen++; render(); }, 21000);
      return; }
    if (cmd === 'пауза') p.paused = true; if (cmd === 'продолжить') p.paused = false; if (cmd === 'скорость') p.every = +arg; if (cmd === 'места') state.adm.perHouse = +arg;
    setRes(true, 'пример: команда «' + cmd + '» выполнена'); render();
  }
  if (mock) {
    user = { login: 'ведьмочка' };
    state = { online: true, admin: true, me: null, pub: { counts: { astra: 12, verdant: 9, vallor: 15, lumen: 11 }, queue: 5, paused: false, every: 7, sorting: null,
        scene: { q: [['darkmage', 'DarkMage', 'm_spiky_black', 'Душа компании', 'Неряха', 'Жаворонок'], ['lisa', 'Лиса', 'f_wavy_ginger', 'Остряк', 'Соня', 'Сова']], s: null,
          h: { astra: [['mira', 'Mira', 'f_bob_blond']], vallor: [['rogue', 'Rogue', 'm_messy_darkbrown'], ['ivan', 'Иван', 'm_buzz_lightbrown']], verdant: [['tisha', 'Тиша', 'f_braids_lightbrown']], lumen: [] } } },
      adm: { perHouse: 4, queue: [['darkmage', 'DarkMage'], ['lisa', 'Лиса'], ['pixel', 'Pixel']], all: [['mira', 'Mira', 'astra'], ['rogue', 'Rogue', 'vallor'], ['tisha', 'Тиша', 'verdant']] } };
  }
  takeHash(); render(); if (!mock) validate();
})();
