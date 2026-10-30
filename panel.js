// Пульт зрителя: вход через Twitch, просмотр и (v7panel3) кнопки-действия — см. actions.js.
(function () {
  const CFG = window.PANEL_CONFIG || {}, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const W = 2560, H = 1440;
  const TABS = [['town', 'Город'], ['garden', 'Огород'], ['camp', 'Лагерь'], ['forest', 'Лес'], ['boss', 'Босс'], ['me', 'Мой герой']];
  const ST = { camp: 'в лагере', garden: 'на огороде', cooking: 'готовит еду', expedition: 'в походе', town: 'в городе', boss: 'бьётся с боссом', sleep: 'спит', dead: 'отдыхает после поражения' };
  const LOCN = { town: 'Город', garden: 'Огород', camp: 'Лагерь', forest: 'Лес', boss: 'Босс' };
  const VEG = { cucumber: '🥒', tomato: '🍅', carrot: '🥕', eggplant: '🍆', pumpkin: '🎃' };
  const mock = /[?&]mock=1/.test(location.search);
  let user = null, state = null, tab = 'me', ws = null, retry = 1500, imgs = {};
  const redirect = () => location.origin + location.pathname.replace(/index\.html$/, '');

  // ---------- Twitch OAuth (implicit flow, scope пустой, токен только в sessionStorage) ----------
  function login() {
    const st = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('tw_state', st);
    location.href = 'https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=' + encodeURIComponent(CFG.TWITCH_CLIENT_ID) +
      '&redirect_uri=' + encodeURIComponent(redirect()) + '&scope=&state=' + encodeURIComponent(st);
  }
  function logout() { sessionStorage.removeItem('tw_token'); user = null; if (ws) ws.close(); ws = null; state = null; render(); }
  function takeHash() {
    if (!location.hash || location.hash.length < 2) return;
    const p = new URLSearchParams(location.hash.slice(1)); history.replaceState(null, '', location.pathname + location.search);
    if (p.get('error')) return msg('Вход отменён: ' + (p.get('error_description') || p.get('error')));
    const t = p.get('access_token'), st = p.get('state');
    if (t && st && st === sessionStorage.getItem('tw_state')) sessionStorage.setItem('tw_token', t); else if (t) msg('Ошибка входа (state не совпал). Попробуйте ещё раз.');
    sessionStorage.removeItem('tw_state');
  }
  async function validate() {
    const t = sessionStorage.getItem('tw_token'); if (!t) return render();
    try {
      const r = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + t } });
      const j = r.ok ? await r.json() : null;
      if (!j || j.client_id !== CFG.TWITCH_CLIENT_ID || !j.login) { sessionStorage.removeItem('tw_token'); msg('Вход устарел — войдите снова.'); return render(); }
      user = { login: String(j.login).toLowerCase(), id: String(j.user_id) }; render(); connect();
    } catch (e) { msg('Нет связи с Twitch.'); render(); }
  }
  function msg(s) { const m = $('pmsg'); if (m) { m.textContent = s; m.hidden = !s; } }

  // ---------- Relay ----------
  function connect() {
    if (mock || !user) return;
    if (!CFG.RELAY_URL) { state = { online: false, nocfg: true }; return render(); }
    try { ws = new WebSocket(CFG.RELAY_URL.replace(/\/+$/, '') + '/viewer'); } catch (e) { return later(); }
    const me = ws;
    ws.onopen = () => me.send(JSON.stringify({ type: 'auth', token: sessionStorage.getItem('tw_token') }));
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.type === 'cmd-res') { if (window.PanelActions) PanelActions.done(m); return; }
      if (m.type === 'state') state = m; else if (m.type === 'offline') state = { online: false, lastAt: m.lastAt };
      else if (m.type === 'error') { if (m.code === 'bad-token') { logout(); msg('Вход устарел — войдите снова.'); } else msg(m.code === 'too-many' ? 'Пульт открыт в слишком многих вкладках.' : 'Ошибка: ' + m.code); }
      render(); };
    ws.onclose = e => { if (ws !== me) return; ws = null; if (user && e.code !== 4003) later(); };
  }
  function later() { setTimeout(connect, retry); retry = Math.min(30000, retry * 2); }
  setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"type":"ping"}'); else retry = Math.max(1500, retry); }, 25000);

  // ---------- Отрисовка ----------
  function img(l) { if (!imgs[l]) { imgs[l] = new Image(); imgs[l].onload = draw; imgs[l].src = 'img/' + l + '.jpg'; } return imgs[l]; }
  function curLoc() { const me = state && state.me; return tab === 'me' ? (me ? me.loc : (state && state.cam) || 'camp') : tab; }
  // v7panel3b: на превью — спрайты героев как в игре (класс, пол, волосы, окраска сета, взгляд), свой — со звёздочкой и подсветкой; нет спрайта → точка
  // v7panel4 п.11: спрайты на превью выключены (лагали и не совпадали по цвету с игрой) — цветные точки класса. Код спрайтов оставлен: SPRITES = true вернёт их.
  const SPRITES = false;
  // плавное движение точек: позиция догоняет цель из снимка (~раз в секунду), кадры только пока кто-то движется
  const POS = {}; let anim = 0, lastL = '';
  function animStep() { anim = 0; draw(true); }
  const CLSC = { warrior: '#e0703a', archer: '#7fbf5a', mage: '#7aa8ff', priest: '#e8d070', paladin: '#f0e0b0', assassin: '#b07ad8' };
  function draw(fromAnim) {
    const c = $('map'); if (!c) return; const x = c.getContext('2d'), w = c.width, h = c.height, l = curLoc(), im = img(l);
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#120e16'; x.fillRect(0, 0, w, h); if (im.complete && im.naturalWidth) { x.imageSmoothingEnabled = true; x.drawImage(im, 0, 0, w, h); x.imageSmoothingEnabled = false; }
    if (!state || !state.online) { x.fillStyle = 'rgba(10,6,12,.65)'; x.fillRect(0, 0, w, h); return; }
    if (l !== lastL) { for (const n in POS) delete POS[n]; lastL = l; }
    const k = w / W, list = ((state.locs && state.locs[l]) || []).slice().sort((a, b) => a[2] - b[2]), me = user && user.login;
    const css = c.clientWidth || w, u = w / css; // пикселей холста на 1 css-пиксель — подписи всегда ~13 px на экране
    let moving = false; const seen = {};
    const ramps = {}; ((state.ref && state.ref.hair) || []).forEach(z => { if (z[2]) ramps[z[0]] = z[2]; });
    const HS = SPRITES ? window.HeroSprites : null, labels = [], stat = { spr: 0, dot: 0, mine: 0, lab: 0, fs: 0 };
    for (const t of list) {
      const [n, hx, hy, cls, lv, st, k6, hid, dy, fl, hh] = t, mine = String(n).toLowerCase() === me;
      let P = POS[n]; if (!P) P = POS[n] = { x: hx, y: hy }; seen[n] = 1;
      if (fromAnim) { P.x += (hx - P.x) * .18; P.y += (hy - P.y) * .18; }
      if (Math.abs(hx - P.x) > 2 || Math.abs(hy - P.y) > 2) moving = true; else { P.x = hx; P.y = hy; }
      const px = Math.round(P.x * k), py = Math.round(P.y * k);
      const sp = HS && k6 ? HS.get(k6, hid, dy, ramps) : null;
      let top;
      if (sp) {
        const f = (hh || 120) * k / 240 / sp.sc, dw = Math.max(1, Math.round(sp.w * f)), dh = Math.max(1, Math.round(sp.h * f)), ax = sp.fx * f, ay = (sp.sit ? sp.sy : sp.fy) * f;
        x.save(); x.globalAlpha = .28; x.fillStyle = '#1a0e06'; x.beginPath(); x.ellipse(px, py + 1, dw * .42, Math.max(2, dh * .06), 0, 0, 7); x.fill(); x.restore();
        if (mine) { x.save(); x.strokeStyle = '#ffd27a'; x.lineWidth = Math.max(2, 2.5 * u); x.globalAlpha = .9; x.beginPath(); x.ellipse(px, py + 1, dw * .55, Math.max(4, dh * .1), 0, 0, 7); x.stroke(); x.restore(); }
        x.save(); x.translate(px, sp.sit ? py : py); if (fl) x.scale(-1, 1); if (st === 'sleep') x.globalAlpha = .75;
        if (mine) { x.shadowColor = '#ffd27a'; x.shadowBlur = 10 * u; }
        x.drawImage(sp.c, Math.round(-ax), Math.round(-ay), dw, dh); x.restore();
        top = py - ay; stat.spr++; if (mine) stat.mine = 1;
      } else {
        const r = (mine ? 7 : 5) * Math.max(1, u * .8);
        x.beginPath(); x.arc(px, py - r, r, 0, 7); x.fillStyle = mine ? '#ffd27a' : st === 'sleep' ? '#8a8aa8' : (CLSC[cls] || '#ffffff'); x.fill(); x.lineWidth = 2; x.strokeStyle = '#000'; x.stroke();
        top = py - 2 * r; stat.dot++; if (mine) stat.mine = 1;
      }
      labels.push({ mine, t: (mine ? '★ ' : '') + n + ' · ' + (/^\d+$/.test(String(lv)) ? 'ур.' + lv : lv), x: px, y: top - 4 * u });
    }
    // подписи поверх всех героев; свой — всегда, чужие — если не налезают на уже нарисованные
    const fs = Math.round(13 * u), placed = []; x.font = `600 ${fs}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.lineJoin = 'round';
    labels.sort((a, b) => b.mine - a.mine);
    for (const L of labels) {
      const tw = x.measureText(L.t).width, r = [L.x - tw / 2 - 3 * u, L.y - fs - 2 * u, L.x + tw / 2 + 3 * u, L.y + 2 * u];
      if (!L.mine && (list.length > 40 || placed.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]))) continue;
      placed.push(r); x.lineWidth = 4 * u; x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText(L.t, L.x, L.y); x.fillStyle = L.mine ? '#ffd27a' : '#fff'; x.fillText(L.t, L.x, L.y); stat.lab++;
    }
    for (const n in POS) if (!seen[n]) delete POS[n];
    if (moving && !anim) anim = requestAnimationFrame(animStep); // ~кадры только во время движения
    stat.fs = fs / u; stat.sprites = SPRITES; stat.moving = moving; stat.draws = ((window.__mapStat && window.__mapStat.draws) || 0) + 1; window.__mapStat = stat; // для тестов: сколько спрайтов/точек/подписей и размер подписи в css-px
  }
  if (SPRITES && window.HeroSprites) HeroSprites.onReady(() => draw());
  window.addEventListener('resize', () => draw());
  function bar(v, m, cls) { const p = Math.max(0, Math.min(100, m ? v / m * 100 : 0)); return `<div class="bar ${cls}"><i style="width:${p.toFixed(0)}%"></i><span>${v} / ${m}</span></div>`; }
  // v7panel8 п.9: инвентарь своего героя (данные от игры: me.iv + eqOn/eqOwn, названия вещей — ref.eq)
  const SLOT_IC = { weapon: '⚔️', armor: '🥋', offhand: '🛡️', trinket: '📿', helm: '⛑️' };
  function invHtml(me) {
    const ref = (state && state.ref) || {}, iv = me.iv || {}, eqN = {}; (ref.eq || []).forEach(e => eqN[e[0]] = e[1]);
    const slots = (ref.slots && ref.slots.length ? ref.slots : [['weapon', 'Оружие'], ['armor', 'Броня'], ['offhand', 'Левая рука'], ['trinket', 'Амулет']]);
    const it = (ic, name, n, cls) => `<span class="ivi${cls ? ' ' + cls : ''}" title="${esc(name)}">${esc(ic)} ${esc(name)}${n !== '' && n != null ? ` <b>${esc(n)}</b>` : ''}</span>`;
    const row = (t, arr) => `<div class="ivr"><em>${t}</em>${arr.length ? arr.join('') : '<span class="ivn">пусто</span>'}</div>`;
    const eqOn = me.eqOn || {}, spare = (me.eqOwn || []).filter(id => !Object.values(eqOn).includes(id));
    const L = a => (a || []).map(x => it(x[0], x[1], x[2]));
    return `<div class="hinv"><div class="ivh">🎒 Инвентарь</div>
      ${row('Снаряжение', slots.map(([s, sn]) => it(SLOT_IC[s] || '▫️', eqOn[s] ? (eqN[eqOn[s]] || eqOn[s]) : sn + ': —', '', eqOn[s] ? 'on' : 'off')).concat(spare.map(id => it('🎒', eqN[id] || id, ''))))}
      ${row('Материалы', L(iv.m))}${row('Еда', L(iv.f))}${row('Зелья', L(iv.p))}
      ${row('Семена', [it('🌱', 'семена', me.sd || 0), it('✨', 'волшебные', me.sdp || 0)])}
      ${row('Косметика', (iv.c || []).map(x => it(x[0], x[1], x[2] ? '✓' : '', x[2] ? 'on' : '')).concat(me.ttOn ? [it('🏷️', 'титул: ' + me.ttOn, '✓', 'on')] : []))}</div>`;
  }
  function card(me) {
    if (!me) return `<div class="hcard"><b>Героя пока нет.</b><p class="note">Напишите в чат стрима <b>!rpg</b> — герой появится, и вы увидите его здесь.</p></div>`;
    const cd = me.cd > 0 ? `через ${Math.floor(me.cd / 60)}:${String(me.cd % 60).padStart(2, '0')}` : 'можно';
    const veg = Object.keys(VEG).map(k => `${VEG[k]} ${me.veg && me.veg[k] || 0}`).join(' &nbsp;');
    return `<div class="hcard"><div class="hname">★ ${esc(me.n)} <small>${esc(me.cn)} · ур. ${esc(me.lv)}</small></div>
      <div class="hst">${esc(ST[me.st] || me.st)} · ${esc(LOCN[me.loc] || me.loc)}${me.gd ? ' · гильдия: ' + esc(me.gd) : ''}</div>
      ${bar(me.hp, me.mhp, 'hp')}${bar(me.xp, me.xpN, 'xp')}
      <div class="hgrid"><span>💰 ${esc(me.gold)}</span><span>🌱 семена: ${esc(me.sd || 0)}</span><span>✨ волшебные: ${esc(me.sdp || 0)}</span><span>🥾 поход: ${cd}</span></div>
      <div class="hveg">${veg}</div>
      ${invHtml(me)}
      <div class="hcook">Можно приготовить еду или сварить зелий: <b>${esc(me.rw.cook || 0)}</b></div>
      <div class="note">Наград сегодня: поход ${me.rw.hike}, готовка ${me.rw.cook}, квест ${me.rw.quest}${me.q ? ' · есть квест' : ''}</div></div>`;
  }
  function render() {
    $('auth').innerHTML = user ? `<span class="who">Вы: <b>${esc(user.login)}</b> <small>(ID ${esc(user.id)})</small></span><button id="bout" class="small">Выйти</button>`
      : `<button id="blogin" class="twitch">Войти через Twitch</button><span class="note">Вход нужен, чтобы найти вашего героя и чтобы кнопки действовали только от вашего имени. В чат пульт ничего не пишет.</span>`;
    if ($('blogin')) $('blogin').onclick = login; if ($('bout')) $('bout').onclick = logout;
    const live = $('live'), body = $('pbody');
    body.hidden = !user;
    if (!user) return;
    const on = state && state.online;
    live.className = 'live ' + (on ? 'on' : 'off');
    live.textContent = !state ? 'Подключение…' : state.nocfg ? 'Пульт ещё не подключён к серверу (RELAY_URL пуст)' : on ? '● Стрим идёт' : 'Стрим не идёт';
    $('tabs').innerHTML = TABS.map(([id, t]) => `<button data-t="${id}" class="tab${id === tab ? ' on' : ''}" aria-pressed="${id === tab}">${t}</button>`).join('');
    const l = curLoc(), list = on && state.locs ? (state.locs[l] || []) : [];
    let info = on ? `${LOCN[l] || l}: героев ${list.length}` : 'Когда стример запустит игру, здесь появится карта.';
    if (on && l === 'boss' && state.boss) { const b = state.boss; info += ' · ' + (b.ph === 'wait' ? `босс ${esc(b.name || '')} через ${Math.ceil(b.in / 60000)} мин` : b.ph === 'signup' ? `запись на босса: ${b.n}` : b.ph === 'fight' ? 'идёт бой с боссом!' : 'босс повержен'); }
    $('linfo').innerHTML = info;
    $('hero').innerHTML = on ? card(state.me) : '';
    if (window.PanelActions) PanelActions.render($('acts'), { online: !!on, tab, me: on ? state.me : null, ref: state && state.ref });
    draw();
  }
  document.addEventListener('click', e => { const b = e.target.closest('#tabs button'); if (b) { tab = b.dataset.t; render(); } });

  // ---------- Демо-режим (?mock=1): вымышленные данные, без сети ----------
  function mockData() {
    user = { login: 'demo_viewer', id: '100000001' };
    const R = (a, b) => a + Math.floor(Math.random() * (b - a)), names = ['demo_viewer', 'lisa_fox', 'ironpaw', 'mira77', 'oak_knight', 'kotik_mag', 'sunny_bard', 'gnomik', 'redhood', 'pixel_elf'];
    const locs = { town: [], garden: [], camp: [], forest: [], boss: [] }, ls = ['camp', 'camp', 'garden', 'town', 'camp', 'garden', 'forest', 'town', 'camp', 'garden'];
    const CL = ['warrior', 'archer', 'mage', 'priest', 'paladin', 'assassin'], GU = ['moon', 'fire', 'none', 'silver', 'gold', 'none'], HR = ['black', 'red', 'blond', 'chestnut', 'grey', 'lightbrown', 'darkbrown', 'red'];
    const SC = { camp: 192, town: 192, garden: 152, forest: 120, boss: 120 }, pos = { camp: [[1180, 1180], [760, 1240], [1640, 1150], [2050, 1290], [420, 1300]], town: [[1100, 1240], [1700, 1180], [600, 1300]], garden: [[900, 1150], [1500, 1220], [2000, 1160]], forest: [[1200, 1200]], boss: [] }, used = {};
    names.forEach((n, i) => { const l = ls[i], cl = i === 0 ? 'warrior' : CL[i % 6], g = i % 2 ? 'f' : 'm', p = (pos[l] || [])[used[l] = (used[l] || 0)] || [R(300, 2260), R(1000, 1300)]; used[l]++;
      const sit = l === 'camp' && i === 4, key = (i === 0 ? 'moon' : GU[i % 6]) + '_' + g + '_' + cl + (sit ? '_sit' : '');
      locs[l].push([n, p[0], p[1], cl, R(1, 20), sit ? 'sleep' : l, i === 9 ? 'nosuch_sprite' : key, /assassin|paladin/.test(cl) ? '' : HR[i % 8], i === 7 ? '#3a8ad8' : '', i % 3 === 1 ? 1 : 0, SC[l], g]); });
    state = { type: 'state', online: !/offline=1/.test(location.search), t: Date.now(), cam: 'camp', locs, boss: { ph: 'wait', name: 'Тролль', in: 540000, n: 0 },
      me: { n: 'demo_viewer', cls: 'warrior', cn: 'Воин', lv: 7, xp: 210, xpN: 350, hp: 86, mhp: 120, gold: 340, pot: 2, food: 3, sd: 4, sdp: 1, gd: 'Лунные тени', gid: 'moon', eqOwn: ['w_sword1'], eqOn: { weapon: 'w_sword1' }, tt: ['Огородник', 'Гроза крыс'], ttOn: 'Огородник', hair: 'black', of: ['plant2', 'carrot2', 'harv4'], pty: false, st: 'camp', loc: 'camp', mode: 'idle',
        veg: { cucumber: 4, tomato: 2, carrot: 0, eggplant: 1, pumpkin: 0 }, rw: { hike: 1, cook: 1, quest: 2 }, mg: { left: 1, max: 2, cd: 1260, seeds: 1 }, sal: { left: 3, max: 4, reset: 1900000, can: false, total: 1 }, rcp: [3, 1, 1, 0, 3, 0], cd: 75, buffs: 1, q: null, iv: { m: [['🪵', 'Дерево', 12], ['🪨', 'Камень', 5], ['⛓️', 'Железо', 1]], f: [['🥗', 'Овощной салат', 1], ['🍲', 'Морковный суп (активно)', 2]], p: [['❤️', 'Зелье лечения', 2]], c: [['✨', 'Аура: Светлячки', 1], ['💫', 'След: Листья', 0]] } },
      ref: MOCK_REF };
  }
  const MOCK_REF = { guilds: [['fire', 'Огненный клинок', '#d9482b'], ['silver', 'Серебряный лист', '#9fc7d6'], ['moon', 'Лунные тени', '#8a6ad8'], ['gold', 'Золотой колос', '#e8b830']],
    hair: [['black', 'чёрный', [[14, 12, 14], [40, 36, 42], [82, 76, 86]]], ['darkbrown', 'тёмно-каштановый', [[24, 14, 10], [60, 38, 26], [104, 72, 50]]], ['chestnut', 'каштановый', null], ['lightbrown', 'русый', [[70, 52, 34], [132, 106, 74], [190, 164, 122]]], ['blond', 'блонд', [[118, 86, 40], [202, 162, 86], [246, 224, 152]]], ['red', 'рыжий', [[88, 28, 10], [178, 72, 26], [238, 140, 66]]], ['grey', 'седой', [[78, 78, 84], [150, 150, 158], [216, 216, 224]]]], hairPrice: 250, bsLv: 1,
    eq: [['w_sword1', 'Железный меч', 120, 'weapon', null, 1], ['a_leather', 'Кожаная броня', 150, 'armor', null, 1], ['o_shield', 'Деревянный щит', 90, 'offhand', ['warrior', 'paladin'], 1], ['t_amulet', 'Амулет силы', 400, 'trinket', null, 2]],
    bld: [['campfire', 'Костёр', 1, 4, 140, 'camp'], ['tents', 'Палатка', 2, 4, 400, 'camp'], ['blacksmith', 'Кузница', 1, 4, 250, 'town'], ['market', 'Рынок', 1, 4, 200, 'town'], ['shed', 'Сарай', 1, 4, 150, 'garden']],
    quests: { plant2: 'Посадить 2 семечка', carrot2: 'Собрать 2 морковки', harv4: 'Собрать 4 урожая' }, recipes: [['Овощной салат', 'food', 'огурец 2, помидор 1', 1], ['Морковный суп', 'food', 'морковь 3', 1], ['Рагу', 'food', 'баклажан 2, морковь 2', 4], ['Тыквенный пирог', 'food', 'тыква 1, морковь 2', 7], ['Зелье лечения', 'potion', 'помидор 2', 1], ['Зелье удачи', 'potion', 'тыква 1, огурец 3', 4]],
    crops: [['cucumber', 'Огурец'], ['tomato', 'Помидор'], ['carrot', 'Морковь'], ['eggplant', 'Баклажан'], ['pumpkin', 'Тыква']] };
  // отправка команды: в бою — через relay (ника нет, его подставит relay из токена); в демо — ответ имитируется на странице
  window.__panelSend = m => {
    if (mock) return setTimeout(() => PanelActions.done(mockReply(m)), 350);
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); else PanelActions.done({ id: m.id, ok: false, msg: 'нет связи с сервером' });
  };
  function mockReply(m) {
    const me = state.me, it = MOCK_REF.eq.find(i => i[0] === m.arg);
    if (m.cmd === 'поход' && me.cd > 0) return { id: m.id, ok: false, msg: `поход: КД ещё ${Math.floor(me.cd / 60)}:${String(me.cd % 60).padStart(2, '0')}` };
    if (m.cmd === 'готовить') { const r = MOCK_REF.recipes[+m.arg - 1]; return { id: m.id, ok: true, msg: r ? `пошёл к котлу готовить «${r[0]}» (демо)` : 'пошёл к котлу: лучшее из доступного (демо)' }; }
    if (m.cmd === 'продать') return { id: m.id, ok: true, msg: `продал: ${m.arg} (демо)` };
    if (m.cmd === 'обмен') return { id: m.id, ok: true, msg: 'обмен: 🌿 -10, 🎃 +1 (демо)' };
    if (m.cmd === 'магия') return { id: m.id, ok: true, msg: 'магия: 🥕 +2 (демо)' };
    if (m.cmd === 'салат') { const s = me.sal; if (!s.left) return { id: m.id, ok: false, msg: 'лимит салатов на этот период (демо)' }; if (!s.can) return { id: m.id, ok: false, msg: 'для салата не хватает: 🥕 0/5, 🍆 1/5, 🎃 0/1 — ничего не списано (демо)' }; }
    if (m.cmd === 'грядка') return { id: m.id, ok: true, msg: 'осталось примерно 23 мин до созревания! (демо)' };
    if (m.cmd === 'купить' && it) { if (me.gold < it[2]) return { id: m.id, ok: false, msg: `«${it[1]}» стоит ${it[2]} золота, у тебя ${me.gold}` }; me.gold -= it[2]; me.eqOwn.push(it[0]); me.eqOn[it[3]] = it[0]; render(); return { id: m.id, ok: true, msg: `купил и надел «${it[1]}» (демо)` }; }
    return { id: m.id, ok: true, msg: `выполнено (демо): !${m.cmd}${m.arg ? ' ' + m.arg : ''}` };
  }
  takeHash();
  if (mock) { mockData(); const t0 = /[?&]tab=(\w+)/.exec(location.search); if (t0) tab = t0[1]; render(); } else validate();
  window.__panel = { get state() { return state; }, get user() { return user; }, render };
})();
