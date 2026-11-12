/* v42repair: panel durability UI | locations-final-v1 */
// Пульт зрителя: вход через Twitch, просмотр и (v7panel3) кнопки-действия — см. actions.js.
(function () {
  const CFG = window.PANEL_CONFIG || {}, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const W = 2560, H = 1440;
  const TABS = [['town', 'Город'], ['garden', 'Огород'], ['camp', 'Лагерь'], ['forest', 'Лес'], ['boss', 'Босс'], ['me', 'Мой герой']];
  const ST = { camp: 'в лагере', garden: 'на огороде', cooking: 'готовит еду', expedition: 'в походе', town: 'в городе', boss: 'бьётся с боссом', sleep: 'спит', dead: 'отдыхает после поражения' };
  const LOCN = { town: 'Город', garden: 'Огород', camp: 'Лагерь', forest: 'Лес', boss: 'Босс' };
  const VEG = { cucumber: '🥒', tomato: '🍅', carrot: '🥕', eggplant: '🍆', pumpkin: '🎃' };
  const mock = /[?&]mock=1/.test(location.search); let MOCK_CAST = null;
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
    ws.onopen = () => { lastMsg = Date.now(); me.send(JSON.stringify({ type: 'auth', token: sessionStorage.getItem('tw_token') })); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      lastMsg = Date.now(); if (m.type === 'pong') return;
      if (m.type === 'hello' || m.type === 'state' || m.type === 'offline') { retry = 1500; if (m.type !== 'hello') msg(''); }
      if (m.type === 'cmd-res') { if (window.PanelActions) PanelActions.done(m); return; }
      if (m.type === 'state') { state = m; m._rx = Date.now(); } else if (m.type === 'offline') state = { online: false, lastAt: m.lastAt };
      else if (m.type === 'error') { if (m.code === 'bad-token') { logout(); msg('Вход устарел — войдите снова.'); } else msg(m.code === 'too-many' ? 'Эта вкладка отключена: пульт открыт в нескольких местах сразу. Обновите страницу, чтобы вернуть связь здесь.' : 'Ошибка: ' + m.code); }
      render(); };
    ws.onclose = e => { if (ws !== me) return; ws = null; if (user && e.code !== 4003 && e.code !== 4010) later(); };
  }
  let lastMsg = Date.now(), laterT = 0;
  function later() { if (laterT) return; laterT = setTimeout(() => { laterT = 0; connect(); }, retry); retry = Math.min(8000, Math.round(retry * 1.7)); }
  // мёртвое соединение (сон, смена сети): сервер молчит дольше минуты — переподключаемся сами; ping каждые 20 с
  const ensureConn = () => { if (mock || !user) return; if (ws && ws.readyState === 1 && Date.now() - lastMsg > 65000) { try { ws.close(); } catch (e) {} } if (!ws) { clearTimeout(laterT); laterT = 0; retry = 1500; connect(); } };
  setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"type":"ping"}'); ensureConn(); }, 20000);
  ['online', 'focus', 'pageshow'].forEach(ev => window.addEventListener(ev, ensureConn));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ensureConn(); });

  // ---------- Отрисовка ----------
  // v48: у каждого босса своё логово — game.js v48 шлёт boss.lair (например boss_queen) → img/boss_queen.jpg. Нет поля (старая игра) или файла — общее img/boss.jpg.
  function lairOf(l) { const lr = l === 'boss' && state && state.boss && state.boss.lair; return lr && /^boss_[a-z0-9_]{1,24}$/.test(lr) && !imgs['!' + lr] ? lr : l; }
  function img(l) { l = lairOf(l); if (!imgs[l]) { const i = imgs[l] = new Image(), k = l; i.onload = draw; if (k !== 'boss' && /^boss_/.test(k)) i.onerror = () => { imgs['!' + k] = 1; delete imgs[k]; draw(); }; i.src = 'img/' + l + '.jpg?v=locations-final-v1'; } return imgs[l]; }
  function curLoc() { const me = state && state.me; return tab === 'me' ? (me ? me.loc : (state && state.cam) || 'camp') : tab; }
  // v7panel3b: на превью — спрайты героев как в игре (класс, пол, волосы, окраска сета, взгляд), свой — со звёздочкой и подсветкой; нет спрайта → точка
  // v7panel4 п.11: спрайты на превью выключены (лагали и не совпадали по цвету с игрой) — цветные точки класса. Код спрайтов оставлен: SPRITES = true вернёт их.
  const SPRITES = true; // v7panel34: свой герой спрайтом, остальные — точки
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
      const [n, hx, hy, cls, lv, st, k6, hid, dy, fl, hh, , , , lastAct] = t, mine = String(n).toLowerCase() === me;
      const active = mine || (Date.now() - (lastAct || 0) < 600000);
      let P = POS[n]; if (!P) P = POS[n] = { x: hx, y: hy }; seen[n] = 1;
      if (fromAnim) { P.x += (hx - P.x) * .18; P.y += (hy - P.y) * .18; }
      if (Math.abs(hx - P.x) > 2 || Math.abs(hy - P.y) > 2) moving = true; else { P.x = hx; P.y = hy; }
      const px = Math.round(P.x * k), py = Math.round(P.y * k);
      const sp = HS && k6 && mine ? HS.get(k6, hid, dy, ramps) : null;
      let top;
      if (sp) {
        const f = (mine ? 350 : (hh || 120)) * k / 240 / sp.sc, dw = Math.max(1, Math.round(sp.w * f)), dh = Math.max(1, Math.round(sp.h * f)), ax = sp.fx * f, ay = (sp.sit ? sp.sy : sp.fy) * f;
        x.save(); x.globalAlpha = .28; x.fillStyle = '#1a0e06'; x.beginPath(); x.ellipse(px, py + 1, dw * .42, Math.max(2, dh * .06), 0, 0, 7); x.fill(); x.restore();
        if (mine) { x.save(); x.strokeStyle = '#ffd27a'; x.lineWidth = Math.max(2, 2.5 * u); x.globalAlpha = .9; x.beginPath(); x.ellipse(px, py + 1, dw * .55, Math.max(4, dh * .1), 0, 0, 7); x.stroke(); x.restore(); }
        x.save(); x.translate(px, sp.sit ? py : py); if (fl) x.scale(-1, 1); if (st === 'sleep') x.globalAlpha = .75;
        if (mine) { x.shadowColor = '#ffd27a'; x.shadowBlur = 10 * u; }
        x.drawImage(sp.c, Math.round(-ax), Math.round(-ay), dw, dh); x.restore();
        // пет рядом со своим героем
        if (mine && state.me && state.me.ptOn) { // v7panel35: me здесь — логин (строка), питомец берём из state.me

          const PET_EMO = { slime: '🟢', fairy: '🧚', cat: '🐱', dragon: '🐉', unicorn: '🦄' }; const petImgs = window.__petImgs || (window.__petImgs = {});
          const pid = state.me.ptOn;
          if (!petImgs[pid]) { const im = new Image(); im.onload = () => draw(); im.onerror = () => draw(); im.src = `img/pet/${pid}.png`; petImgs[pid] = im; } // v7panel35: перерисовать, когда картинка загрузилась
          const pim = petImgs[pid];
          const psz = Math.max(16, dh * 0.3);
          if (pim.complete && pim.naturalWidth) { // v7panel35: пропорции картинки, низ пета — на земле
            const pw = psz * pim.naturalWidth / pim.naturalHeight; x.drawImage(pim, px + dw * 0.3, py - psz, pw, psz);
          } else { // v7panel35: нет файла — эмодзи вместо жёлтого кружка
            x.save(); x.font = `${Math.round(psz)}px serif`; x.textBaseline = 'bottom'; x.fillText(PET_EMO[String(pid).replace(/^pet_/, '')] || '🐾', px + dw * 0.3, py); x.restore();
          }
        }
        top = py - ay; stat.spr++; if (mine) stat.mine = 1;
      } else {
        const r = (mine ? 7 : 5) * Math.max(1, u * .8);
        x.beginPath(); x.arc(px, py - r, r, 0, 7); x.fillStyle = mine ? '#ffd27a' : st === 'sleep' ? '#8a8aa8' : (CLSC[cls] || '#ffffff'); x.fill(); x.lineWidth = 2; x.strokeStyle = '#000'; x.stroke();
        top = py - 2 * r; stat.dot++; if (mine) stat.mine = 1;
      }
      labels.push({ mine, active, t: (mine ? '★ ' : '') + n + ' · ' + (/^\d+$/.test(String(lv)) ? 'ур.' + lv : lv), x: px, y: top - 4 * u });
    }
    // подписи поверх всех героев; свой — всегда, чужие — если не налезают на уже нарисованные
    const fs = Math.round(13 * u), placed = []; x.font = `600 ${fs}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.lineJoin = 'round';
    labels.sort((a, b) => b.mine - a.mine);
    for (const L of labels) {
      const tw = x.measureText(L.t).width, r = [L.x - tw / 2 - 3 * u, L.y - fs - 2 * u, L.x + tw / 2 + 3 * u, L.y + 2 * u];
      if (!L.active) continue;
      placed.push(r); x.lineWidth = 4 * u; x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText(L.t, L.x, L.y); x.fillStyle = L.mine ? '#ffd27a' : '#fff'; x.fillText(L.t, L.x, L.y); stat.lab++;
    }
    for (const n in POS) if (!seen[n]) delete POS[n];
    // мобы на карте спрайтами
    const mobs = state.mobs || [], mobImgs = window.__mobImgs || (window.__mobImgs = {});
    for (const [id, mx, my, hp] of mobs) {
      const px = Math.round(mx * k), py = Math.round(my * k);
      if (!mobImgs[id]) { const im = new Image(); im.src = `img/mob/${id}.${id === 'mimic' ? 'png' : 'webp'}`; mobImgs[id] = im; }
      const im = mobImgs[id];
      if (im.complete && im.naturalWidth) {
        const sz = Math.round(60 * k);
        x.drawImage(im, px - sz/2, py - sz, sz, sz);
        x.fillStyle = hp > 50 ? '#7dff9a' : hp > 25 ? '#ffaa6a' : '#ff6a6a';
        x.font = `600 ${Math.round(11 * u)}px system-ui`; x.textAlign = 'center'; x.fillText(hp + '%', px, py - sz - 4);
      } else {
        x.fillStyle = '#ff6a6a'; x.beginPath(); x.arc(px, py - 12, 14, 0, 7); x.fill();
      }
    }
    if (moving && !anim) anim = requestAnimationFrame(animStep); // ~кадры только во время движения
    stat.fs = fs / u; stat.sprites = SPRITES; stat.moving = moving; stat.draws = ((window.__mapStat && window.__mapStat.draws) || 0) + 1; window.__mapStat = stat; // для тестов: сколько спрайтов/точек/подписей и размер подписи в css-px
  }
  window.addEventListener('resize', () => draw());
  function bar(v, m, cls) { const p = Math.max(0, Math.min(100, m ? v / m * 100 : 0)); return `<div class="bar ${cls}"><i style="width:${p.toFixed(0)}%"></i><span>${v} / ${m}</span></div>`; }
  // v7panel8 п.9: инвентарь своего героя (данные от игры: me.iv + eqOn/eqOwn, названия вещей — ref.eq)
  const SLOT_IC = { weapon: '⚔️', armor: '🥋', offhand: '🛡️', trinket: '📿', ring1: '💍', ring2: '💍', helm: '⛑️' };
  // v7panel11: коды спрайтов из игры (crop_carrot…) → смайлики; «(активно)» — отдельной пометкой
  const ICON_MAP = { crop_carrot: '🥕', crop_cucumber: '🥒', crop_eggplant: '🍆', crop_pumpkin: '🎃', crop_tomato: '🍅', potion: '🧪', food: '🍲' };
  const VEG_BY_EMO = { '🥒': 'cucumber', '🍅': 'tomato', '🥕': 'carrot', '🍆': 'eggplant', '🎃': 'pumpkin' }; // v7panel11: овощи — настоящими спрайтами игры (img/veg/*.png из assets/crops)
  const vegImg = (id, alt) => `<img class="vegi" src="img/veg/${id}.png" alt="${esc(alt || '')}">`;
  window.__vegImg = vegImg;
  // v7panel20 п.7: железо — серый слиток (тот же пиксельный набор, что в игре) вместо ⛓️
  const INGOT = '<img class="vegi" src="img/ingot.png" alt="железо">';
  // v7panel21 п.1: иконки DCSS/Idylwild (img/ic/<ключ>.png) — когда игра включила их (ref.ic); 'ic:<ключ>' в инвентаре
  // v7panel37: 'ключ~оттенок' (hue-rotate), запасной значок вместо битой картинки
  const IC_FB = k => /^ring/.test(k) ? '💍' : /^amu|^t\d/.test(k) ? '📿' : /^pot/.test(k) ? '🧪' : '🎒';
  const icImg = k0 => { const [k, hue] = String(k0 || '').split('~'); return `<img class="vegi ic" src="img/ic/${esc(k)}.png" alt=""${+hue ? ` style="filter:hue-rotate(${+hue}deg)"` : ''} onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'vegi icfb',textContent:'${IC_FB(k)}'}))">`; };
  // ключ иконки вещи: ref.eq[i][7] от игры (v7panel37), иначе id (старая игра)
  const eqIcK = id => { const e = ((state && state.ref && state.ref.eq) || []).find(x => x[0] === id); return e && e[7] !== undefined ? e[7] : id; };
  window.__eqIcK = eqIcK;
  const icOn = () => !!(state && state.ref && state.ref.ic);
  window.__icImg = icImg; window.__icOn = icOn;
  const icoH = ic => { ic = String(ic || ''); if (/^ic:[a-z0-9_]+(~\d+)?$/.test(ic)) return icImg(ic.slice(3)); return ic === '⛓️' || ic === '⛓' ? (icOn() ? icImg('iron') : INGOT) : esc(ic); };
  function invIcon(ic, def) { ic = String(ic || ''); if (!ic) return def; if (/^[a-z0-9_]+$/i.test(ic)) return ICON_MAP[ic] || def; return ic; }
  function invItem(x, def) { let nm = String(x[1] || ''), act = !!x[3]; nm = nm.replace(/^[a-z0-9_]+\s+(?=[А-ЯЁа-яё])/i, ''); if (/\s*\(активно\)\s*$/.test(nm)) { act = true; nm = nm.replace(/\s*\(активно\)\s*$/, ''); } const ic = invIcon(x[0], def), vm = /^crop_([a-z]+)$/.exec(String(x[0] || '')); return { ic, nm, n: x[2], act, veg: vm ? vm[1] : VEG_BY_EMO[ic] }; }
  window.__panelInvItem = invItem;
  // v7panel45: единая карточка — вкладки инвентаря (без дубля «Надето»), слоты 3×2 с ремонтом
  let invOpen = true; // открыт по умолчанию в единой карточке
  let meInvTab = 'gear';
  let meSlotSel = '';
  let questOpen = false;

  const UC_SLOTS = [['weapon', 'Оружие'], ['armor', 'Броня'], ['offhand', 'Левая рука'], ['trinket', 'Амулет'], ['ring1', 'Кольцо 1'], ['ring2', 'Кольцо 2']];
  const hikeLeft = n => { n = +n || 0; const a = Math.abs(n) % 100, b = a % 10; const w = (a > 10 && a < 20) ? 'походов' : b === 1 ? 'похода' : (b >= 2 && b <= 4) ? 'похода' : 'походов'; return n + ' ' + w; };
  function slotLab(s, name) {
    if (s === 'offhand' && /гримуар|книг|tome|grimoire/i.test(name || '')) return 'Гримуар';
    return (UC_SLOTS.find(x => x[0] === s) || [s, s])[1];
  }
  function slotIc(s, name) {
    if (s === 'offhand' && /гримуар|книг|tome|grimoire/i.test(name || '')) return '📖';
    return SLOT_IC[s] || '▫️';
  }
  function gidOf(me) {
    const g = String((me && me.gid) || '').toLowerCase();
    return ['moon', 'fire', 'gold', 'silver'].includes(g) ? g : 'none';
  }
  function meter(lab, v, m, kind) {
    const p = Math.max(0, Math.min(100, m ? (+v || 0) / (+m || 1) * 100 : 0));
    return `<div class="uc-meter"><div class="uc-meter-lab"><b>${esc(lab)}</b></div><div class="uc-meter-track"><i class="uc-meter-fill ${kind}" style="width:${p.toFixed(0)}%"></i><span class="uc-meter-val">${esc(v)} / ${esc(m)}</span></div></div>`;
  }
  function invHtml(me) {
    const ref = (state && state.ref) || {}, iv = me.iv || {}, eqN = {}, eqT = {};
    (ref.eq || []).forEach(e => { eqN[e[0]] = e[1]; eqT[e[0]] = e[6] || ''; });
    const chip = (o, cnt) => { const tip = esc(o.nm) + (o.tag ? ' — ' + esc(o.tag) : '') + (o.repair ? ` · клик: починить ${o.cost} з` : '') + (o.sellLoot ? ` · клик: продать лут ${o.sellPrice} з` : '');
      const inner = `${o.veg ? vegImg(o.veg, o.ic) : icoH(o.ic)} ${esc(o.nm)}${cnt ? ` <b>×${esc(o.n)}</b>` : ''}${o.tag ? ` <i class="ivact">${esc(o.tag)}</i>` : ''}`;
      if (o.repair) return `<button type="button" class="ivi on ivrf" data-rep="${esc(o.repair)}" data-cost="${+o.cost || 0}" title="${tip}">${inner}</button>`;
      if (o.sellLoot) return `<button type="button" class="ivi on ivsell" data-sellloot="${esc(o.sellLoot)}" data-sellprice="${+o.sellPrice || 0}" data-sellbonus="${esc(o.sellBonus || '')}" data-sellname="${esc(o.nm)}" title="${tip}">${inner}</button>`;
      return `<span class="ivi${o.act ? ' on' : ''}" title="${tip}">${inner}</span>`; };
    const L = (a, def) => (a || []).map(x => chip(invItem(x, def), +x[2] > 0));
    const eqOn = me.eqOn || {}, spare = (me.eqOwn || []).filter(id => !Object.values(eqOn).includes(id));
    const drById = {}; (me.dr && me.dr.i || []).forEach(([s, pct, cost, id]) => { drById[id] = { s, pct, cost }; });
    const gearChips = spare.map(id => chip({ ic: icOn() && eqIcK(id) ? 'ic:' + eqIcK(id) : '🎒', nm: (eqN[id] || id) + (eqT[id] ? ' — ' + eqT[id] : '') }))
      .concat(((me.iv && me.iv.g) || []).map(x => { const id = x[3], price = x[4], bonus = x[5];
        const can = !!(id && ((ref.gear && ref.gear.length) || (me.lgs && me.lgs.length)));
        return chip({ ic: '⚔️', nm: x[1] || 'лут', act: true, tag: can && price != null ? `${price} з` : 'лут', sellLoot: can ? id : '', sellPrice: price, sellBonus: bonus }); }));
    const tabs = [
      ['gear', 'Снаряжение'],
      ['mat', 'Материалы'],
      ['food', 'Еда'],
      ['pot', 'Зелья'],
      ['seed', 'Семена']
    ];
    let pane = '';
    if (meInvTab === 'gear') {
      pane = gearChips.length ? gearChips.join('') : '<span class="ivn">запас снаряжения пуст</span>';
    } else if (meInvTab === 'mat') pane = L(iv.m, '🪨').join('') || '<span class="ivn">пусто</span>';
    else if (meInvTab === 'food') pane = L(iv.f, '🍲').join('') || '<span class="ivn">пусто</span>';
    else if (meInvTab === 'pot') pane = L(iv.p, '🧪').join('') || '<span class="ivn">пусто</span>';
    else if (meInvTab === 'seed') {
      const seeds = [`<span class="ivi" title="Семена">🌱 Семена <b>×${esc(me.sd || 0)}</b></span>`, `<span class="ivi" title="Волшебные">✨ Волшебные <b>×${esc(me.sdp || 0)}</b></span>`];
      pane = seeds.join(' ');
    }
    const tabBtns = tabs.map(([k, n]) => `<button type="button" data-uit="${k}" class="${k === meInvTab ? 'on' : ''}">${esc(n)}</button>`).join('');
    return `<div class="uc-itabs">${tabBtns}</div><div class="uc-ipane">${pane}</div>`;
  }
  document.addEventListener('click', e => {
    if (e.target.closest('button.ivrf, button.ivsell')) return;
    const t = e.target.closest('[data-uit]'); if (t) { meInvTab = t.dataset.uit; render(); return; }
    const qb = e.target.closest('[data-qopen]'); if (qb) { questOpen = true; render(); return; }
    const sl = e.target.closest('button.uc-slot[data-slot]'); if (!sl || sl.classList.contains('empty')) return;
    const s = sl.dataset.slot; meSlotSel = meSlotSel === s ? '' : s; render();
  });
  document.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('details.hq'); if (d) questOpen = !!d.open; }, true);

  // v7panel37: инвентарь «как в OBS» (портрет + слоты + характеристики + вкладки с сеткой ячеек). За переключателем: ?inv=obs (запоминается), ?inv=old — вернуть; или PANEL_CONFIG.inv = 'obs'. Умолчание — старый список.
  const INV_OBS = (() => { try { const m = /[?&]inv=(obs|old)/.exec(location.search); if (m) localStorage.setItem('panel_inv', m[1]); return (localStorage.getItem('panel_inv') || CFG.inv || 'old') === 'obs'; } catch (e) { return /[?&]inv=obs/.test(location.search) || CFG.inv === 'obs'; } })();
  let obsTab = 'mat';
  const OBS_SLOTS = [['weapon', 'Оружие'], ['armor', 'Броня'], ['offhand', 'Левая рука'], ['trinket', 'Амулет'], ['ring1', 'Кольцо 1'], ['ring2', 'Кольцо 2']];
  function invObsHtml(me) {
    const ref = (state && state.ref) || {}, iv = me.iv || {}, E = {}; (ref.eq || []).forEach(e => E[e[0]] = e);
    const eqOn = me.eqOn || {}, icOf = id => icOn() && eqIcK(id) ? icImg(eqIcK(id)) : `<span class="vegi icfb">${SLOT_IC[(E[id] || [])[3]] || '🎒'}</span>`;
    const slot = ([s, n]) => { const id = eqOn[s], e = E[id]; return `<div class="ob-slot${id ? '' : ' ob-none'}" title="${esc(id ? `${n}: ${e ? e[1] : id}${e && e[6] ? ' — ' + e[6] : ''}` : n + ': пусто')}">${id ? icOf(id) : `<span class="ob-ph">${SLOT_IC[s] || '▫️'}</span>`}<small>${esc(id ? (e ? e[1] : id) : n)}</small></div>`; };
    const sr = me.sr && me.sr.length ? me.sr : [['❤', 'Здоровье', `${me.hp}/${me.mhp}`], ['🌱', 'Семена', `${me.sd || 0} · ✨ ${me.sdp || 0}`], ['⭐', 'Уровень', `${me.lv} · ${me.xp || 0}/${me.xpN || '?'} XP`], ['💰', 'Золото', String(me.gold)]];
    const cell = o => `<span class="ob-c${o.n === 0 || o.n === '0' ? ' zero' : ''}${o.act ? ' on' : ''}" title="${esc(o.nm + (o.tip ? ' — ' + o.tip : ''))}">${o.html}${o.n !== '' && o.n != null ? `<i>${esc(o.n)}</i>` : ''}</span>`;
    const fromIv = (a, def) => (a || []).map(x => { const o = invItem(x, def); return { html: o.veg ? vegImg(o.veg, o.ic) : icoH(o.ic), n: o.n, nm: o.nm, act: o.act, tip: o.act ? 'активно' : '' }; });
    const T = {
      mat: ['Материалы', fromIv(iv.m, '🪨')],
      food: ['Еда', fromIv(iv.f, '🍲').concat(Object.entries(me.veg || {}).map(([k, n]) => ({ html: vegImg(k), n, nm: k })))],
      pot: ['Зелья', fromIv(iv.p, '🧪')],
      seed: ['Семена', [{ html: '<span class="vegi icfb">🌱</span>', n: me.sd || 0, nm: 'Семена' }, { html: '<span class="vegi icfb">✨</span>', n: me.sdp || 0, nm: 'Волшебные семена' }]],
      gear: ['Снаряжение', (me.eqOwn || []).map(id => { const e = E[id], on = Object.values(eqOn).includes(id); return { html: icOf(id), n: on ? '✓' : '', nm: e ? e[1] : id, act: on, tip: (e && e[6] || '') + (on ? ' · надето' : '') }; })
        .concat((me.lgs || []).map(r => ({ html: '<span class="vegi icfb">⚔️</span>', n: '★', nm: 'лут: ' + r[1], act: 1, tip: (r[4] || '') + (r[3] != null ? ' · продать ' + r[3] + ' з' : '') })))
        .concat(!(me.lgs && me.lgs.length) ? ((me.iv && me.iv.g) || []).map(x => ({ html: '<span class="vegi icfb">⚔️</span>', n: '★', nm: x[1] || 'лут', act: 1 })) : [])
        .concat(me.ttOn ? [{ html: '<span class="vegi icfb">🏷️</span>', n: '', nm: 'титул: ' + me.ttOn, act: 1 }] : [], (me.pt || []).map(([id, n]) => ({ html: '<span class="vegi icfb">🐾</span>', n: me.ptOn === id ? '✓' : '', nm: 'питомец: ' + n, act: me.ptOn === id })))]
    };
    const cur = T[obsTab] || T.mat, cells = cur[1].map(cell), pad = Math.max(0, (cells.length <= 12 ? 12 : Math.ceil(cells.length / 6) * 6) - cells.length);
    return `<div class="obsinv"><div class="ob-top"><div class="ob-left"><div class="ob-port">${heroPic(me.k6, me.hair, me.dy, me.cls, 'big')}<div><b>${esc(me.n)}</b><small>${esc(me.cn || '')} · ур. ${esc(me.lv)}</small></div></div>
      <div class="ob-slots">${OBS_SLOTS.map(slot).join('')}</div></div>
      <table class="ob-st">${sr.map(r => `<tr><td>${esc(r[0])}</td><th>${esc(r[1])}</th><td>${esc(r[2])}</td></tr>`).join('')}</table></div>
      <div class="ob-tabs">${Object.entries(T).map(([k, v]) => `<button type="button" data-obt="${k}"${k === obsTab ? ' class="on"' : ''}>${esc(v[0])}</button>`).join('')}</div>
      <div class="ob-grid">${cells.join('')}${'<span class="ob-c ob-e"></span>'.repeat(pad)}</div></div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-obt]'); if (b) { obsTab = b.dataset.obt; render(); } });
  document.addEventListener('mousedown', e => { if (e.target.closest('.hinv, .qcur, .log, .bcgo, input[data-bcq]')) bcHold = true; });
  document.addEventListener('click', e => { const b = e.target.closest('.ivh'); if (b) { invOpen = !invOpen; render(); } });
  // v7panel42/45b: починка (чип/detail) — confirm → fire; stopPropagation
  document.addEventListener('click', e => { const b = e.target.closest('button.ivrf[data-rep]'); if (!b || b.disabled) return;
    e.preventDefault(); e.stopPropagation();
    const s = b.dataset.rep, cost = +b.dataset.cost || 0, nm = b.dataset.repname || s;
    if (!s || !window.PanelActions || !PanelActions.fire) return;
    const SR = { weapon: 'оружие', armor: 'броня', offhand: 'щит', trinket: 'амулет', ring1: 'кольцо', ring2: 'кольцо' };
    if (!window.confirm('Починить «' + nm + '» (' + (SR[s] || s) + ') за ' + cost + ' золота?')) return;
    PanelActions.fire('чинить', s, 'Починить · ' + (SR[s] || s)); });
  // v7panel44: клик по чипу лута → подтверждение → продать лут <id>
  document.addEventListener('click', e => { const b = e.target.closest('button.ivsell[data-sellloot]'); if (!b || b.disabled) return;
    const id = b.dataset.sellloot, price = +b.dataset.sellprice || 0, bonus = b.dataset.sellbonus || 'пассив', nm = String(b.dataset.sellname || id).replace(/^лут:\s*/i, '');
    if (!id || !window.PanelActions || !PanelActions.fire) return;
    if (!window.confirm('Продать лут «' + nm + '» за ' + price + ' золота?\nПотеряете пассив: ' + bonus + '.\nЭто не кузнечная вещь.')) return;
    PanelActions.fire('продать', 'лут ' + id, 'Продать лут · ' + nm); });
  document.addEventListener('mouseup', () => { if (bcHold) setTimeout(() => { bcHold = false; }, 100); });
  // v7panel22 п.1: «Улучшения» и «Еда и зелья» — ровные колонки (CSS grid + subgrid), короткие тексты, на телефоне — две строки
  const BIC = { campfire: '🔥', tents: '⛺', blacksmith: '⚒️', market: '🏪', shed: '🛖' };
  const NUM = /[+\-−]?\d+(?:[.,]\d+)?%?/;
  const UPSH = [[/^ускоряет восстановление HP у всех героев в лагере: за 5 мин$/, 'реген HP в лагере за 5 мин'], [/^щит на поход: макс\. HP.*$/, 'щит на поход, % HP'], [/^сон лечит быстрее на$/, 'сон лечит'], [/^золота за каждый урожай$/, 'золото за урожай'], [/^овощи дороже на золота$/, 'овощи дороже, з'], [/^атака всех героев$/, 'атака героев'], [/^лечение у костра$/, 'лечение у костра']];
  // «мест у костра +0, лечение +0%» и «… +1, … +25%» → [[метка, сейчас, дальше], …]
  function upStats(eff, nxt) {
    const A = String(eff || '').split(/[,;]\s*/), B = String(nxt || '').split(/[,;]\s*/);
    return A.map((a, k) => { const m = a.match(NUM), b = B[k] || '', mb = b.match(NUM);
      if (!m && !mb) return [a, '', ''];
      let l = (m ? a : b).replace(NUM, ' ').replace(/:\s*нет$/, '').replace(/\s+/g, ' ').trim(); UPSH.forEach(([r, t]) => { l = l.replace(r, t); });
      return [l, m ? m[0] : 'нет', mb ? mb[0] : '']; });
  }
  window.__upStats = upStats;
  function upHtml() {
    const ref = (state && state.ref) || {}, MN = {}; (ref.mats || []).forEach(([id, n, ic]) => MN[id] = icOn() ? icImg(id) + esc(n) : id === 'iron' ? INGOT + esc(n) : esc((ic ? ic + ' ' : '') + n));
    const rows = (ref.bld || []).map(([id, name, lv, max, need, , eff0, nextEff0, ml, eff1, nextEff1]) => { const top = need == null;
      const S = upStats(top ? (nextEff1 || eff1 || eff0) : (eff1 || eff0), top ? '' : (nextEff1 || nextEff0));
      const price = top ? 'макс.' : [need ? esc(need + ' з') : ''].concat(Object.entries(ml || {}).map(([m, n]) => `<span>${MN[m] || esc(m)} ${esc(n)}</span>`)).filter(Boolean).join(' ') || 'готово';
      const col = f => S.map(x => `<div>${f(x)}</div>`).join('');
      return `<div class="upr2${top ? ' max' : ''}" data-b="${esc(id)}"><span class="upi">${BIC[id] || '🏠'}</span><b class="upn">${esc(name)} <small>${esc(lv)}${top ? '' : '→' + esc(lv + 1)}</small></b>`
        + `<span class="upl">${col(x => esc(x[0]))}</span><span class="upc">${col(x => esc(x[1]))}</span><span class="upd">${top ? '' : col(x => x[2] ? '→ ' + esc(x[2]) : '')}</span><span class="upp">${price}</span></div>`; }).join('');
    return `<div class="upbox"><h2>🏗 Улучшения</h2><div class="upt upt-b"><div class="upr2 uph"><span></span><span>Здание</span><span>Эффект</span><span>Сейчас</span><span>Дальше</span><span>Цена</span></div>${rows}</div></div>`;
  }
  const FSH = [[/ \(само при HP < 35%\)/, ' (авто <35%)'], [/после каждой волны/, 'за волну'], [/после волны/, 'за волну'], [/до конца боя/, 'на бой'], [/ и сундук на ступень лучше/, ', сундук лучше'], [/шанс сундука/, 'сундук']];
  function shortFx(t) { let s = String(t || ''); FSH.forEach(([r, x]) => { s = s.replace(r, x); }); return s; }
  window.__shortFx = shortFx;
  function bedHtml(me) {
    const b = me && me.bed;
    if (!b) return `<div class="upbox"><h2>🌱 Грядка</h2><div class="dim" style="padding:6px 10px;font-size:15px">данные грядки ещё не пришли (обновите пульт)</div></div>`;
    const ic = b.eaten ? '💀' : b.bugs ? '🐞' : b.st === 2 ? '🌾' : b.st === 1 ? '🌱' : '🟫';
    const style = b.bugs || b.eaten ? 'color:#ff9c7a;font-weight:600' : '';
    return `<div class="upbox"><h2>${ic} Грядка</h2><div class="dim" style="padding:6px 10px;font-size:15px;${style}">${esc(b.txt || '')}</div></div>`;
  }
  function foodHtml(me) {
    const ref = (state && state.ref) || {}, L = ref.recipes || [];
    if (!L.length) return '';
    const bc = +ref.bc || 0, cook = me && me.rw ? +me.rw.cook || 0 : 0; // v7panel24: готовка пачкой — только если игра прислала ref.bc (флаг batchCook включён)
    const rows = L.map(([n, kind, need, lv, txt, ick], i) => { const f = me && me.rcp ? me.rcp[i] || 0 : 1, ok = me && (f & 3) === 3;
      const q = bc && ok ? `<span class="bcq"><input type="number" data-bcq="${i}" min="1" max="${bc}" value="${Math.min(bc, bcSel[i] || 1)}" style="width:40px" title="Не больше ${bc} за раз" aria-label="Сколько порций, максимум ${bc}"><span class="dim" style="font-size:13px">из ${bc}</span><button type="button" class="bcgo" data-bci="${i}">Приготовить</button></span>` : '';
      return `<div class="upr2${f & 1 ? '' : ' off'}"${f & 1 ? '' : ` title="откроется с ур.${esc(lv)}"`}><span class="upi">${ick ? icImg(ick) : kind === 'potion' ? '🧪' : '🍲'}</span><b class="upn">${esc(n)}</b><span class="upe" title="${esc(txt || '')}">${esc(shortFx(txt) || '—')}</span><span class="upp">${f & 1 ? esc(need) : 'с ур.' + esc(lv)}${q}</span></div>`; }).join('');
    const as = bc && me && me.iv ? (me.iv.f || []).filter(x => x[3]).reduce((a, x) => a + (+x[2] || 0), 0) : 0, ds = bc && me && me.iv ? (me.iv.f || []).filter(x => !x[3]).reduce((a, x) => a + (+x[2] || 0), 0) : 0, ps = bc && me && me.iv ? (me.iv.p || []).reduce((a, x) => a + (+x[2] || 0), 0) : 0;
    return `<div class="upbox"><h2>🍲 Еда и зелья</h2>${bc ? `<div class="bcst">Запас: 🍲 ${ds}${as ? ` <span class="dim">(+${as} уже в действии)</span>` : ''} · 🧪 ${ps} · токенов готовки ${cook}</div>` : ''}<div class="upt upt-f"><div class="upr2 uph"><span></span><span>Название</span><span>Эффект</span><span>Состав</span></div>${rows}</div></div>`;
  }
  // v7panel25 п.2: выбранное количество хранится в памяти пульта; пока список открыт/в фокусе, карточку не перерисовываем (иначе выбор закрывался)
  const bcSel = {}; let bcHold = false;
  const bcBusy = () => { const a = document.activeElement; return !!(a && a.matches && a.matches('select[data-bcq],input[data-bcq]')); };
  const bcSave = e => { const s = e.target.closest && e.target.closest('select[data-bcq],input[data-bcq]'); if (s) bcSel[s.dataset.bcq] = s.value; };
  document.addEventListener('change', bcSave); document.addEventListener('input', bcSave);
  document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('select[data-bcq],input[data-bcq]')) setTimeout(() => { if (bcHold && !bcBusy()) { bcHold = false; render(); } }, 400); });
  document.addEventListener('click', e => { const b = e.target.closest('button.bcgo'); if (!b || b.disabled) return; const i = +b.dataset.bci, sel = document.querySelector(`[data-bcq="${i}"]`), bcm = +((state && state.ref && state.ref.bc) || 10), q = String(Math.max(1, Math.min(bcm, parseInt(sel ? sel.value : bcSel[i], 10) || 1))), r = ((state && state.ref && state.ref.recipes) || [])[i];
    if (r && window.PanelActions && PanelActions.fire) PanelActions.fire('готовить', `${i + 1} ${q}`, `Готовить · ${r[0]} × ${q}`); });
  // v7panel20 п.2: все характеристики героя (из игры: me.sr), что даёт надетое (me.eqS) и баффы (me.bf)
  // v7panel32: задания на вкладке «Мой герой»: текущее (прогресс x/y, награда) и последние выполненные. Нет me.qs (старая игра) — блок не рисуется.
  function questHtml(me) { const Q = me && me.qs; if (!Q || typeof Q !== 'object') return '';
    const c = Array.isArray(Q.c) ? Q.c : null, l = Array.isArray(Q.l) ? Q.l : [];
    const cur = c ? `<div class="qcur"><div class="qt">📜 ${esc(c[0])}</div>${bar(+c[1] || 0, +c[2] || 1, 'qp')}<div class="qrw">в процессе · награда: ${esc(c[3] || '')}</div></div>`
      : `<div class="dim">Текущего задания нет — возьмите на вкладке «Город» (кнопка «Задание»)</div>`;
    const done = l.length ? `<div class="qdl">${l.map(r => `<div class="qd">✔ ${esc(r[0])} <span>— выполнено · ${esc(r[1])}</span></div>`).join('')}</div>` : '';
    return `<details class="hq"${questOpen ? ' open' : ''}><summary>📜 Задания <small>выполнено всего: ${esc(+Q.d || 0)}</small></summary><div class="hq-body">${cur}${done}</div></details>`; }
  function hpBonusOf(me) {
    const row = (me.sr || []).find(r => r[1] === 'Здоровье'); if (!row) return '';
    const m = String(row[2] || '').match(/\(\+\d+\)/); return m ? ' ' + m[0] : '';
  }
  function statHtml(me) {
    // v7panel45b: без дубля HP-бара и «Броня: нет»; (+N) в подписи HP
    const sr = (me.sr || []).filter(r => !/^(Семена|Готовка|Уровень|Золото|Здоровье|Броня)$/.test(r[1]));
    return `<div class="uc-stats">${sr.map(([i, n, v]) => `<div><span class="k">${esc(i)} ${esc(n)}</span><em>${esc(v)}</em></div>`).join('') || '<div class="dim">нет данных</div>'}</div>`;
  }
  // v7panel20 п.8: журнал боя на пульте — последние 15 мин (ref.log от игры), прокрутка, фильтр «мои/все», повторы подряд — «×N»
  let logMine = false;
  function logHtml(me) {
    const L = ((state && state.ref && state.ref.log) || []), nm = me && me.n ? String(me.n).toLowerCase() : '';
    const src = logMine && nm ? L.filter(e => String(e[1]).toLowerCase().includes(nm)) : L, out = [];
    for (const e of src) { const p = out[out.length - 1]; if (p && p.x === e[1]) { p.n += +e[3] || 1; p.t = e[0]; } else out.push({ t: e[0], x: e[1], k: e[2], n: +e[3] || 1 }); } // v7panel28: e[3] — сколько одинаковых строк игра сжала в одну
    const hm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    return `<div class="logbox"><div class="logh"><h2>📜 Журнал (15 мин)</h2><span class="logf"><button type="button" data-lf="0" class="${logMine ? '' : 'on'}">все</button><button type="button" data-lf="1" class="${logMine ? 'on' : ''}"${nm ? '' : ' disabled'}>мои</button></span></div>
      <div class="logl" id="logl">${out.length ? out.map(e => `<div class="lg ${e.k === 'b' ? 'lb' : 'le'}"><time>${hm(e.t)}</time> ${esc(e.x)}${e.n > 1 ? ` <b>×${e.n}</b>` : ''}</div>`).join('') : '<div class="lg le">за 15 минут событий нет</div>'}</div></div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest('.logf button'); if (b && !b.disabled) { logMine = b.dataset.lf === '1'; render(); } });
  // v7panel26: картинки героев (спрайт heroes6 из игры + волосы + окраска сета) и мобов в карточке и блоке боя. Нет картинки — значок, страница не ломается.
  const CLS_IC = { warrior: '⚔️', archer: '🏹', mage: '🔮', priest: '✝️', paladin: '🛡️', assassin: '🗡️' };
  const MOBS = ['goblin', 'slime', 'wolf', 'rat', 'tree_spirit', 'ogre_boss', 'queen_boss', 'treant_king_boss', 'mimic'];
  const PIC = new Map();
  function rampsOf() { const r = {}; ((state && state.ref && state.ref.hair) || []).forEach(z => { if (z[2]) r[z[0]] = z[2]; }); return r; }
  function heroPic(k6, hid, dy, cls, cl) {
    const fb = `<span class="hpic fb ${cl || ''}" title="${esc(cls || '')}">${CLS_IC[cls] || '🧝'}</span>`;
    k6 = String(k6 || '').replace(/_sit$/, ''); if (!k6) return fb;
    const H = window.HeroSprites;
    // v7panel45b: canvas если движок готов; иначе webp по k6 из snap (emoji только при 404)
    if (H && H.has(k6)) {
      const key = k6 + '|' + (hid || '') + '|' + (dy || '');
      let u = PIC.get(key);
      if (!u) { try { const sp = H.get(k6, hid, dy, rampsOf()); if (sp) { u = (sp.crop || sp.c).toDataURL(); if (PIC.size > 300) PIC.clear(); PIC.set(key, u); } } catch (e) {} }
      if (u) return `<img class="hpic ${cl || ''}" src="${u}" alt="${esc(cls || '')}">`;
    }
    return `<img class="hpic ${cl || ''}" src="img/h/${esc(k6)}.webp" alt="${esc(cls || '')}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'hpic fb ${cl || ''}',title:'${esc(cls || '')}',textContent:'${CLS_IC[cls] || '🧝'}'}))">`;
  }
  function mobPic(id, flt, cl) {
    id = String(id || ''); if (!MOBS.includes(id)) return `<span class="mpic fb ${cl || ''}">👾</span>`;
    return `<img class="mpic ${cl || ''}" src="img/mob/${id}.${id === 'mimic' ? 'png' : 'webp'}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'mpic fb',textContent:'👾'}))"${/^[a-z0-9().,\s-]*$/i.test(flt || '') && flt ? ` style="filter:${flt}"` : ''}>`;
  }
  const hpLine = (p) => `<span class="fhp"><i style="width:${Math.max(0, Math.min(100, +p || 0))}%"></i></span>`;
  function myFight(me) {
    const f = me && me.fm; if (!f) return '';
    return `<div class="fight me"><span class="fwho">${heroPic(me.k6, me.hair, me.dy, me.cls)}</span><span class="fvs">⚔️</span><span class="fmob">${mobPic(f[0])}<b>${esc(f[1])}</b>${hpLine(f[2] / (f[3] || 1) * 100)}<small>${esc(f[2])} / ${esc(f[3])}${f[4] ? ' · отряд' : ''}</small></span></div>`;
  }
  function fightsHtml(l) {
    if (l === 'boss') { const b = state.boss; if (!b || !b.key) return '';
      const L = (state.locs && state.locs.boss) || [];
      return `<div class="fights"><h2>👹 ${esc(b.name || 'Босс')}</h2><div class="fight boss">${mobPic(b.key, b.flt, 'big')}<span class="fmob">${b.mhp ? hpLine(b.hp / b.mhp * 100) + `<small>${esc(b.hp)} / ${esc(b.mhp)}${Array.isArray(b.sw) ? ` · 🐛 личинок ${esc(+b.sw[0] || 0)}, коконов ${esc(+b.sw[1] || 0)}` : ''}</small>` : `<small>${b.ph === 'wait' ? 'ещё не пришёл' : b.ph === 'signup' ? 'идёт запись' : ''}</small>`}</span></div>`
        + (L.length ? `<div class="fteam">${L.slice(0, 30).map(t => `<span title="${esc(t[0])}">${heroPic(t[6], t[7], t[8], t[3], 'sm')}<em>${esc(t[0])}</em></span>`).join('')}</div>` : '') + '</div>'; }
    const L = ((state.locs && state.locs[l]) || []).filter(t => t[12]);
    if (!L.length) return l === 'forest' ? '<div class="fights"><h2>⚔️ Бои</h2><div class="dim">сейчас никто не бьётся</div></div>' : '';
    const me = user && user.login;
    return `<div class="fights"><h2>⚔️ Бои</h2>${L.slice(0, 20).map(t => `<div class="fight${String(t[0]).toLowerCase() === me ? ' mine' : ''}"><span class="fwho">${heroPic(t[6], t[7], t[8], t[3], 'sm')}<em>${esc(t[0])}</em></span><span class="fvs">→</span><span class="fmob">${mobPic(t[12], '', 'sm')}${hpLine(t[13])}</span></div>`).join('')}</div>`;
  }
  // v7panel30: блок «Пати» — набор (очередь), отряды в походе, свой герой подсвечен. Данные: state.ref.pty (game.js panelParty).
  const PPH = { walk: 'идут в лес', approach: 'подходят к мобу', spawn: 'ищут моба', fight: 'бой', dying: 'моб падает', back: 'возвращаются' };
  function partyHtml() {
    const P = state && state.ref && state.ref.pty; if (P === undefined) return ''; const me = user && String(user.login).toLowerCase();
    if (!P) return '<div class="pty"><h2>🛡 Пати</h2><div class="dim">пати-походы выключены</div></div>';
    const tup = {}; Object.values(state.locs || {}).forEach(L => (L || []).forEach(t => { tup[String(t[0]).toLowerCase()] = t; }));
    const mate = (n, dead) => { const t = tup[String(n).toLowerCase()], mine = String(n).toLowerCase() === me;
      return `<span class="pm${mine ? ' mine' : ''}${dead ? ' out' : ''}" title="${esc(n)}${dead ? ' — выбыл' : ''}">${t ? heroPic(t[6], t[7], t[8], t[3], 'sm') : '<span class="hpic sm fb">🙂</span>'}<em>${esc(n)}</em></span>`; };
    const q = P.q || [], qn = +P.qn || q.length, sz = +P.sz || 3, inQ = q.findIndex(n => String(n).toLowerCase() === me);
    let h = '';
    if (qn) { for (let i = 0; i < Math.max(q.length, 1); i += sz) { const sq = q.slice(i, i + sz), first = !i;
        const st = first ? (P.lane ? 'отряд собран — ждёт свободную тропу' : qn >= sz ? 'отряд собран — уходит' : P.left > 0 ? `старт через ${Math.floor(P.left / 60)}:${String(P.left % 60).padStart(2, '0')} или когда наберётся ${sz}` : 'уходит сейчас') : 'ждёт, пока уйдёт первый отряд';
        h += `<div class="pgrp q"><div class="ph">⏳ ${first ? 'Набор' : 'Следующий отряд'}: ${sq.length}/${sz} · ${st}</div><div class="fteam">${sq.map(n => mate(n)).join('')}${Array.from({ length: sz - sq.length }, () => '<span class="pm free"><span class="hpic sm fb">＋</span><em>место</em></span>').join('')}</div></div>`; }
      if (qn > q.length) h += `<div class="dim">и ещё ${qn - q.length} в очереди</div>`; }
    let myGo = -1;
    (P.go || []).forEach((g, i) => { const us = g[0] || [], al = String(g[1] || ''); if (us.some(n => String(n).toLowerCase() === me)) myGo = i;
      h += `<div class="pgrp go${myGo === i ? ' mine' : ''}"><div class="ph">⚔️ В походе · волна ${esc(g[3])}/${esc(P.wv || 3)} · ${esc(PPH[g[2]] || g[2] || '')}</div><div class="fteam">${us.map((n, j) => mate(n, al[j] === '0')).join('')}</div></div>`; });
    const mine = inQ >= 0 ? `Вы в наборе: место ${inQ % sz + 1} из ${sz}${inQ >= sz ? ' (следующий отряд)' : ''}` : myGo >= 0 ? 'Ваш отряд в походе' : '';
    if (!h) h = `<div class="dim">набор не идёт — нажмите «Пати-поход», чтобы начать (нужно от ${esc(P.mn || 2)} до ${sz})</div>`;
    return `<div class="pty"><h2>🛡 Пати</h2>${mine ? `<div class="pme">★ ${mine}</div>` : ''}${h}</div>`;
  }
  if (window.HeroSprites) HeroSprites.onReady(() => { PIC.clear(); clearTimeout(window.__picT); window.__picT = setTimeout(() => { if (!bcBusy()) render(); }, 120); if (SPRITES) draw(); }); // v7panel35: портреты в карточке и при спрайтах на карте
  // ---------- v47: свёрнутая карточка (только главное) и «Сет 1 / Сет 2» ----------
  // Свёрнуто/развёрнуто — localStorage rpgPanel.cardCollapsed ('1'/'0'); ?col=1|0 в адресе — задать явно.
  const COL_KEY = 'rpgPanel.cardCollapsed';
  let cardCol = (() => { try { const m = /[?&]col=([01])/.exec(location.search); if (m) localStorage.setItem(COL_KEY, m[1]); return localStorage.getItem(COL_KEY) === '1'; } catch (e) { return /[?&]col=1/.test(location.search); } })();
  // Сеты: показываются ТОЛЬКО если игра прислала ref.sets (game.js v47+: число сетов). Старая игра — блок не рисуется, слоты как раньше.
  // me.sets = { s: [ {слот:id}|0 ], a: надетый, lk?: почему нельзя } — приходит, только когда герой что-то сохранил (экономия снимка).
  let setView = 0, setMsg = null; // setMsg: {ok, msg} — ответ игры на последнюю кнопку сета (показываем в карточке)
  const SETS_REF = () => Math.max(0, Math.min(4, +(((state && state.ref) || {}).sets) || 0));
  const hasSets = me => !!(me && SETS_REF() > 0);
  const setsOfMe = me => { const z = me.sets && typeof me.sets === 'object' ? me.sets : {}, n = SETS_REF(), s = Array.isArray(z.s) ? z.s : [];
    return { s: Array.from({ length: n }, (_, i) => s[i] && typeof s[i] === 'object' ? s[i] : 0), a: +z.a || 0, lk: z.lk || '' }; };
  function setLock(me) { const z = setsOfMe(me); if (z.lk) return String(z.lk); if (me.st === 'expedition' || me.st === 'boss' || me.fm) return 'герой в бою — переодеться можно после похода'; return ''; }
  function setRows(me, set, eqN, ref) {
    const eqOn = me.eqOn || {}, own = me.eqOwn || [], E = {}; (ref.eq || []).forEach(e => { E[e[0]] = e; });
    return UC_SLOTS.filter(([s]) => set && set[s]).map(([s, lab]) => { const id = set[s], e = E[id], cur = eqOn[s] || '';
      const k = !e ? 'gone' : !own.includes(id) ? 'sold' : (e[4] && e[4].length && !e[4].includes(me.cls)) ? 'cls' : cur === id ? 'same' : 'new';
      return { s, lab, id, cur, k, name: e ? e[1] : id, tip: e ? e[6] || '' : '' }; }); }
  function setsHtml(me, slotsHtml, detail, eqN, ref) {
    const Z = setsOfMe(me), N = Z.s.length, a = Z.a, lk = setLock(me);
    if (!setView || setView > N) setView = a || 1;
    const set = Z.s[setView - 1] || null, empty = !set || !Object.keys(set).length, isAct = a === setView && !empty;
    const nm = id => id ? (eqN[id] || id) : '—';
    const tabs = Array.from({ length: N }, (_, i) => { const n = i + 1, z = Z.s[i], e = !z || !Object.keys(z).length;
      return `<button type="button" data-eqset="${n}" class="${setView === n ? 'on' : ''}">Сет ${n}${a === n && !e ? '<span class="act">надет</span>' : ''}${e ? '<span class="emp">пусто</span>' : ''}</button>`; }).join('');
    let body;
    if (empty) body = `<div class="uc-sdiff">Сет ${setView} пуст. Наденьте нужные вещи и нажмите «Сохранить текущее в сет ${setView}» — потом переоденетесь одной кнопкой.</div>`;
    else if (isAct) body = `<div class="uc-eq">${slotsHtml}</div>${detail}<div class="uc-sdiff"><span class="ok">✓ Этот сет сейчас надет.</span></div>`;
    else { const R = setRows(me, set, eqN, ref), ch = R.filter(r => r.k === 'new'), bad = R.filter(r => r.k === 'sold' || r.k === 'cls' || r.k === 'gone');
      const grid = UC_SLOTS.map(([s, lab]) => { const r = R.find(x => x.s === s);
        if (!r) { const cur = (me.eqOn || {})[s]; return `<div class="uc-slot sv empty" title="${esc(lab)}: в сете не задано — останется ${esc(nm(cur))}"><span class="vegi icfb">${SLOT_IC[s] || '▫️'}</span><span class="sn">${esc(lab)}</span><span class="nm">${esc(cur ? nm(cur) : '—')}</span><span class="uc-mk same">не меняется</span></div>`; }
        const isBad = r.k === 'sold' || r.k === 'cls' || r.k === 'gone';
        const ic = icOn() && eqIcK(r.id) ? icImg(eqIcK(r.id)) : `<span class="vegi icfb">${slotIc(s, r.name)}</span>`;
        const mk = { new: '<span class="uc-mk new">▲ заменит</span>', same: '<span class="uc-mk same">= уже надето</span>', sold: '<span class="uc-mk bad">⚠ продано</span>', cls: '<span class="uc-mk bad">⛔ не для класса</span>', gone: '<span class="uc-mk bad">⚠ нет вещи</span>' }[r.k];
        return `<div class="uc-slot sv${r.k === 'new' ? ' chg' : ''}${isBad ? ' bad' : ''}" title="${esc(r.lab + ': ' + r.name + (r.tip ? ' — ' + r.tip : ''))}">${ic}<span class="sn">${esc(slotLab(s, r.name))}</span><span class="nm">${esc(r.name)}</span>${mk}</div>`; }).join('');
      body = `<div class="uc-eq">${grid}</div><div class="uc-sdiff">` + (ch.length ? `<b>Поменяется (${ch.length}):</b><br>` + ch.map(r => `${esc(r.lab)}: ${esc(nm(r.cur))} → <b>${esc(r.name)}</b>${r.tip ? ` <span class="t">(${esc(r.tip)})</span>` : ''}`).join('<br>') : '<span class="ok">Ничего не поменяется — всё уже надето.</span>')
        + (bad.length ? '<br>' + bad.map(r => `<span class="w">⚠ ${esc(r.lab)}: «${esc(r.name)}» — ${r.k === 'sold' ? 'продано, нет в сумке' : r.k === 'cls' ? 'не для класса ' + esc(me.cn || me.cls || '') : 'такой вещи больше нет'}; слот останется как есть (${esc(nm(r.cur))})</span>`).join('<br>') : '') + `</div>`; }
    const ban = lk ? `<div class="uc-snote ban">⚔ ${esc(lk.replace(/^./, c => c.toUpperCase()))} (кнопки неактивны).</div>` : '<div class="uc-snote">Переодеться можно вне боя. Прочность у каждой вещи своя — смена сета её не сбрасывает.</div>';
    const wearDis = !!lk || empty || isAct;
    const msg = setMsg ? `<div class="uc-stoast${setMsg.ok === false ? ' bad' : setMsg.ok == null ? ' wait' : ''}">${setMsg.ok == null ? '… ' : setMsg.ok ? '✔ ' : '✖ '}${esc(setMsg.msg)}</div>` : '';
    return `<div class="uc-sets"><div class="uc-stabs">${tabs}</div><div class="uc-sbody">${body}
      <div class="uc-sbtns"><button type="button" data-eqwear="${setView}"${wearDis ? ' disabled' : ''}>${isAct ? '✓ Сет ' + setView + ' надет' : '👕 Надеть сет ' + setView}</button><button type="button" class="sec" data-eqsave="${setView}" data-full="${empty ? 0 : 1}"${lk ? ' disabled' : ''}>💾 Сохранить текущее в сет ${setView}</button></div>${ban}${msg}</div></div>`;
  }
  function setFire(cmd, arg, label) {
    if (!window.PanelActions || !PanelActions.fire) return;
    setMsg = { ok: null, msg: 'отправляю…' }; render();
    PanelActions.fire(cmd, arg, label, m => { setMsg = { ok: !!m.ok, msg: m.msg || (m.ok ? 'готово' : 'не получилось') }; render(); });
  }
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-ucfold]'); if (f) { cardCol = f.dataset.ucfold === '1'; try { localStorage.setItem(COL_KEY, cardCol ? '1' : '0'); } catch (x) {} render(); return; }
    const t = e.target.closest('[data-eqset]'); if (t) { setView = +t.dataset.eqset || 1; setMsg = null; render(); return; }
    const w = e.target.closest('button[data-eqwear]'); if (w && !w.disabled) { const n = +w.dataset.eqwear; setFire('экип', 'сет ' + n, 'Сет ' + n + ' · надеть'); return; }
    const v = e.target.closest('button[data-eqsave]'); if (v && !v.disabled) { const n = +v.dataset.eqsave;
      if (v.dataset.full === '1' && !window.confirm('Перезаписать сет ' + n + ' тем, что надето сейчас?')) return;
      setFire('экип', 'сет сохранить ' + n, 'Сет ' + n + ' · сохранить'); }
  });
  function miniCard(me, gid, gPill) {
    const pct = (v, m) => Math.max(0, Math.min(100, m ? (+v || 0) / (+m || 1) * 100 : 0)).toFixed(0);
    const cd = me.cd > 0 ? `поход через ${Math.floor(me.cd / 60)}:${String(me.cd % 60).padStart(2, '0')}` : 'поход ✓';
    const where = (me.fm || me.st === 'expedition' ? '⚔ ' : '') + [ST[me.st] || me.st || '', LOCN[me.loc] || me.loc || ''].filter(Boolean).join(' · ');
    const brk = (me.dr && me.dr.i || []).filter(x => x[1] < 30), eqN = {}; (((state && state.ref) || {}).eq || []).forEach(e => { eqN[e[0]] = e[1]; });
    const rep = brk.length ? `<span class="uc-pill uc-rep" title="${esc(brk.map(x => (eqN[x[3]] || x[3]) + ' ' + x[1] + '%').join(', '))}">🔧 ремонт: ${brk.length} ${brk.length === 1 ? 'вещь' : 'вещи'}</span>` : '';
    const bfs = me.bf || [], bf = bfs.length ? `<span class="uc-pill" title="${esc(bfs.map(b => b[0] + ' — ' + b[1]).join('\n'))}">🍲 баффы: ${bfs.length}</span>` : '';
    const f = me.fm, fight = f ? `<span class="fgt">бой: ${esc(f[1])} ${esc(f[2])}/${esc(f[3])}</span>` : '';
    return `<div class="hcard uc mini" data-gid="${esc(gid)}"><button type="button" class="uc-fold" data-ucfold="0" title="Показать всю карточку">▾ Развернуть</button>
      <div class="uc-mh"><div class="uc-mport">${heroPic(me.k6, me.hair, me.dy, me.cls, 'big')}</div><div class="uc-mtxt"><div class="uc-mname">★ ${esc(me.n)} <small>${esc(me.cn || me.cls || '')} · ур. ${esc(me.lv)}</small></div>
      <div class="uc-mrow">${gPill}<span class="uc-pill">💰 ${esc(me.gold)}</span><span class="uc-pill">🌱 ${esc(me.sd || 0)}</span><span class="uc-pill">✨ ${esc(me.sdp || 0)}</span>${bf}${rep}</div></div></div>
      <div class="uc-mbars"><div class="uc-mb hp" title="Здоровье"><i style="width:${pct(me.hp, me.mhp)}%"></i><span>❤ ${esc(me.hp)} / ${esc(me.mhp)}</span></div><div class="uc-mb xp" title="Опыт"><i style="width:${pct(me.xp, me.xpN)}%"></i><span>Опыт ${esc(me.xp)} / ${esc(me.xpN)}</span></div></div>
      <div class="uc-mst"><span>${esc(where)}</span><span class="${me.cd > 0 ? 'left' : 'ok'}">${esc(cd)}</span>${fight}</div></div>`;
  }
  function card(me) {
    if (!me) return `<div class="hcard"><b>Героя пока нет.</b><p class="note">Напишите в чат стрима <b>!rpg</b> — герой появится, и вы увидите его здесь.</p></div>`;
    const gid = gidOf(me);
    const cd = me.cd > 0 ? `через ${Math.floor(me.cd / 60)}:${String(me.cd % 60).padStart(2, '0')}` : 'можно';
    const rw = me.rw || {}, cook = +rw.cook || 0;
    const ccd = me.ccd > 0 ? `через ${Math.floor(me.ccd / 60)}:${String(me.ccd % 60).padStart(2, '0')}` : 'можно';
    const dayBits = [
      `<span class="${cd === 'можно' ? 'ok' : 'left'}">поход ${esc(cd === 'можно' ? '✓' : cd)}</span>`,
      `<span class="${ccd === 'можно' ? 'ok' : 'left'}">готовка ${esc(ccd === 'можно' ? '✓' : ccd)}</span>`,
      (+rw.quest > 0 ? `<button type="button" class="qtoggle" data-qopen="1">квестов осталось ${esc(rw.quest)}</button>` : '<span class="left">квесты кончились</span>')
    ].concat(me.q ? [`<span>квест: ${esc(me.q)} (${esc(me.qp || 0)}/${esc(me.qn || '?')})</span>`] : []);
    const veg = Object.keys(VEG).map(k => `<span class="hv" title="${k}">${vegImg(k, VEG[k])}${me.veg && me.veg[k] || 0}</span>`).join('') + (me.wd !== undefined ? `<span class="hv hwd" title="сорняки">🌿${+me.wd || 0}</span>` : '');
    // слоты 3×2
    const ref = (state && state.ref) || {}, eqN = {}, eqT = {};
    (ref.eq || []).forEach(e => { eqN[e[0]] = e[1]; eqT[e[0]] = e[6] || ''; });
    const eqOn = me.eqOn || {};
    const drById = {}; (me.dr && me.dr.i || []).forEach(([s, pct, cost, id]) => { drById[id] = { s, pct, cost }; });
    const slotsHtml = UC_SLOTS.map(([s, lab0]) => {
      const id = eqOn[s], name = id ? (eqN[id] || id) : '', lab = id ? slotLab(s, name) : lab0;
      const d = id && drById[id], tip = id ? (eqT[id] || '') : 'пусто';
      const ic = id ? (icOn() && eqIcK(id) ? icImg(eqIcK(id)) : `<span class="vegi icfb">${slotIc(s, name)}</span>`) : `<span class="vegi icfb">${SLOT_IC[s] || '▫️'}</span>`;
      const pct = d ? `<span class="pct${d.pct >= 70 ? ' hi' : ''}">${esc(d.pct)}%</span>` : (id ? '<span class="pct hi">100%</span>' : '');
      return `<button type="button" class="uc-slot${id ? '' : ' empty'}${meSlotSel === s ? ' on' : ''}" data-slot="${esc(s)}"${id ? '' : ' disabled'} title="${esc(lab + (id ? ': ' + name : ': пусто') + (tip ? ' — ' + tip : ''))}">${ic}<span class="sn">${esc(lab)}</span><span class="nm">${esc(id ? name : '—')}</span>${pct}</button>`;
    }).join('');
    let detail = '';
    if (meSlotSel && eqOn[meSlotSel]) {
      const id = eqOn[meSlotSel], name = eqN[id] || id, tip = eqT[id] || '', d = drById[id];
      const lab = slotLab(meSlotSel, name);
      detail = `<div class="uc-detail show"><b>${esc(lab)}:</b> ${esc(name)}${tip ? ` — ${esc(tip)}` : ''}`
        + (d ? ` · прочность ${esc(d.pct)}% · ${esc(d.cost)} з`
          + ` <button type="button" class="small ivrf" data-rep="${esc(d.s)}" data-cost="${+d.cost || 0}" data-repname="${esc(name)}">Починить · ${esc(d.cost)} з</button>` : ' · целое')
        + `</div>`;
    }
    // титул / пет / баффы
    const petName = me.ptOn ? ((me.pt || []).find(p => p[0] === me.ptOn) || [])[1] || me.ptOn : '';
    const ttl = me.ttOn ? `<span class="uc-tag ttl">🏷 ${esc(me.ttOn)}</span>` : '<span class="uc-tag lab">титул: нет</span>';
    const pet = me.ptOn
      ? `<span class="uc-tag pet"><img src="img/pet/${esc(me.ptOn)}.png" alt="" onerror="this.replaceWith(document.createTextNode('🐾'))"> ${esc(petName)}</span>`
      : '<span class="uc-tag lab">питомец: нет</span>';
    const bfs = (me.bf || []);
    const bfHtml = bfs.length
      ? bfs.map(([n, t, c]) => `<span class="uc-tag bf"><b>${esc(n)}</b> — ${esc(t)}${c != null && c !== '' ? ` · осталось ${esc(hikeLeft(c))}` : ''}</span>`).join('')
      : '<span class="uc-tag lab">баффы: нет</span>';
    const gName = me.gd || ({ moon: 'Лунные тени', fire: 'Огненный клинок', gold: 'Золотой колос', silver: 'Серебряный лист' }[gid] || '');
    const gPill = gid !== 'none' && gName ? `<span class="uc-pill g">${esc(gName)}</span>` : '<span class="uc-pill">без гильдии</span>';
    if (cardCol) return miniCard(me, gid, gPill); // v47
    const eqBlock = INV_OBS ? '' : hasSets(me) ? setsHtml(me, slotsHtml, detail, eqN, ref) : `<div class="uc-eq">${slotsHtml}</div>${detail}`; // v47: сеты — только с новой игрой
    return `<div class="hcard uc" data-gid="${esc(gid)}"><button type="button" class="uc-fold" data-ucfold="1" title="Оставить только главное — чтобы Пати и Журнал влезали">▴ Свернуть</button><div class="uc-head"><div class="uc-port">${heroPic(me.k6, me.hair, me.dy, me.cls, 'big')}${me.ptOn ? `<img class="hpet" src="img/pet/${esc(me.ptOn)}.png" onerror="this.outerHTML='<span class=hpet>🐾</span>'" alt="">` : ''}</div>
      <div><div class="hname">★ ${esc(me.n)} <small>${esc(me.cn || me.cls || '')} · ур. ${esc(me.lv)}</small></div>
      <div class="hst">${esc(ST[me.st] || me.st || '')} · ${esc(LOCN[me.loc] || me.loc || '')}</div>
      <div class="uc-meta">${gPill}<span class="uc-pill">💰 ${esc(me.gold)}</span><span class="uc-pill">🌱 ${esc(me.sd || 0)}</span><span class="uc-pill">✨ ${esc(me.sdp || 0)}</span>${cook ? `<span class="uc-pill">🍲 ${esc(cook)}</span>` : ''}</div></div></div>
      ${myFight(me)}
      ${meter('HP' + hpBonusOf(me), me.hp, me.mhp, 'hp')}${me.mmp ? meter('Мана', me.mp || 0, me.mmp, 'mp') : ''}${meter('Опыт', me.xp, me.xpN, 'xp')}
      ${eqBlock}
      ${tab === 'me' ? (INV_OBS ? '' : statHtml(me)) : ''}
      <div class="uc-status"><div class="uc-row">${ttl}${pet}</div><div class="uc-row">${bfHtml}</div></div>
      <div class="uc-day">${dayBits.join('')}</div>
      ${tab === 'me' ? questHtml(me) : ''}
      <div class="hveg">${veg}</div>
      ${INV_OBS ? invObsHtml(me) : invHtml(me)}</div>`;
  }

  function render() {
    $('auth').innerHTML = user ? `<span class="who">Вы: <b>${esc(user.login)}</b> <small>(ID ${esc(user.id)})</small></span><button id="bout" class="small">Выйти</button>`
      : `<button id="blogin" class="twitch">Войти через Twitch</button><span class="note">Вход нужен, чтобы найти вашего героя и чтобы кнопки действовали только от вашего имени. В чат пульт ничего не пишет.</span>`;
    if ($('blogin')) $('blogin').onclick = login; if ($('bout')) $('bout').onclick = logout;
    const live = $('live'), body = $('pbody');
    body.hidden = !user;
    if (!user) return;
    const on = state && state.online && (state.stream || (state.ref && state.ref.stream));
    const tst = !!(on && state.test); // v7panel37: тестовый режим — relay присылает test:true только владельцу канала
    live.className = 'live ' + (tst ? 'on test' : on ? 'on' : 'off');
    live.textContent = !state ? 'Подключение…' : state.nocfg ? 'Пульт ещё не подключён к серверу (RELAY_URL пуст)' : tst ? '🧪 Тестовый режим (виден только вам)' : on ? '● Стрим идёт' : 'Стрим не идёт';
    $('tabs').innerHTML = TABS.map(([id, t]) => `<button data-t="${id}" class="tab${id === tab ? ' on' : ''}" aria-pressed="${id === tab}">${t}</button>`).join('');
    const l = curLoc(), list = on && state.locs ? (state.locs[l] || []) : [];
    let info = on ? `${LOCN[l] || l}: героев ${list.length}` : 'Когда стример запустит игру, здесь появится карта.';
    if (on && l === 'boss' && state.boss) { const b = state.boss; info += ' · ' + (b.ph === 'wait' ? `босс ${esc(b.name || '')} через ${Math.ceil(b.in / 60000)} мин` : b.ph === 'signup' ? `запись на босса: ${b.n}` : b.ph === 'fight' ? 'идёт бой с боссом!' : 'босс повержен'); }
    $('linfo').innerHTML = info;
    const ol = $('logl'), stick = !ol || ol.scrollTop + ol.clientHeight >= ol.scrollHeight - 8, oldTop = ol ? ol.scrollTop : 0;
    if (on && bcBusy()) bcHold = true; else $('hero').innerHTML = on ? card(state.me) + fightsHtml(l) + (tab === 'forest' || tab === 'camp' || tab === 'me' ? partyHtml() : '') + (tab === 'town' ? upHtml() : tab === 'garden' ? bedHtml(state.me) + foodHtml(state.me) : '') + (tab === 'forest' || tab === 'boss' || tab === 'me' ? logHtml(state.me) : '') : '';
    if (window.PanelActions) PanelActions.render($('acts'), { online: !!on, tab, me: on ? state.me : null, ref: state && state.ref });
    const ll = $('logl'); if (ll) ll.scrollTop = stick ? ll.scrollHeight : oldTop; // прокрутка: внизу — следим за новыми, иначе остаёмся где читали
    draw();
  }
  document.addEventListener('click', e => { const b = e.target.closest('#tabs button'); if (b) { tab = b.dataset.t; render(); } });

  // ---------- Демо-режим (?mock=1): вымышленные данные, без сети ----------
  const MOCK_SLOT_RU = [['weapon', 'Оружие'], ['armor', 'Броня'], ['offhand', 'Левая рука'], ['trinket', 'Амулет'], ['ring1', 'Кольцо'], ['ring2', 'Кольцо 2']];
  function syncMockEqS(me) {
    if (!me) return; const eq = (typeof MOCK_REF !== 'undefined' && MOCK_REF.eq) || (state && state.ref && state.ref.eq) || [];
    me.eqS = MOCK_SLOT_RU.map(([s, sn]) => {
      const id = (me.eqOn || {})[s]; if (!id) return null;
      const e = eq.find(x => x[0] === id);
      const d = (me.dr && me.dr.i || []).find(x => x[0] === s || x[3] === id);
      const st = (e && e[6]) || ''; const dur = d ? ` · прочность ${d[1]}%` : '';
      return [sn, e ? e[1] : id, st + dur, id];
    }).filter(Boolean);
  }
  function mockData() {
    user = { login: 'demo_viewer', id: '100000001' };
    const R = (a, b) => a + Math.floor(Math.random() * (b - a)), names = ['demo_viewer', 'lisa_fox', 'ironpaw', 'mira77', 'oak_knight', 'kotik_mag', 'sunny_bard', 'gnomik', 'redhood', 'pixel_elf'];
    const locs = { town: [], garden: [], camp: [], forest: [], boss: [] }, ls = ['camp', 'camp', 'garden', 'town', 'camp', 'garden', 'forest', 'town', 'camp', 'garden'];
    const CL = ['warrior', 'archer', 'mage', 'priest', 'paladin', 'assassin'], GU = ['moon', 'fire', 'none', 'silver', 'gold', 'none'], HR = ['black', 'red', 'blond', 'chestnut', 'grey', 'lightbrown', 'darkbrown', 'red'];
    const SC = { camp: 192, town: 192, garden: 152, forest: 120, boss: 120 }, pos = { camp: [[1180, 1180], [760, 1240], [1640, 1150], [2050, 1290], [420, 1300]], town: [[1100, 1240], [1700, 1180], [600, 1300]], garden: [[900, 1150], [1500, 1220], [2000, 1160]], forest: [[1200, 1200]], boss: [] }, used = {};
    names.forEach((n, i) => { const l = ls[i], cl = i === 0 ? 'warrior' : CL[i % 6], g = i % 2 ? 'f' : 'm', p = (pos[l] || [])[used[l] = (used[l] || 0)] || [R(300, 2260), R(1000, 1300)]; used[l]++;
      const sit = l === 'camp' && i === 4, key = (i === 0 ? 'moon' : GU[i % 6]) + '_' + g + '_' + cl + (sit ? '_sit' : '');
      locs[l].push([n, p[0], p[1], cl, R(1, 20), sit ? 'sleep' : l, i === 9 ? 'nosuch_sprite' : key, /assassin|paladin/.test(cl) ? '' : HR[i % 8], i === 7 ? '#3a8ad8' : '', i % 3 === 1 ? 1 : 0, SC[l], g]); });
    if (/queen=1/.test(location.search)) locs.boss.push(['demo_viewer', 1230, 1100, 'warrior', 12, 'boss', 'moon_m_warrior', 'black', '', 0, 120, 'm'], ['ironpaw', 1450, 1000, 'paladin', 14, 'boss', 'gold_f_paladin', '', '', 0, 120, 'f'], ['gnomik', 890, 1180, 'priest', 11, 'boss', 'none_m_priest', 'blond', '', 0, 120, 'm'], ['mira77', 810, 900, 'mage', 13, 'boss', 'fire_f_mage', 'red', '', 0, 120, 'f'], ['redhood', 1920, 1020, 'assassin', 12, 'boss', 'silver_m_assassin', '', '#3a8ad8', 1, 120, 'm']); // v48: макет боя с Маткой (?mock=1&tab=boss&queen=1)
    if (/fight=1/.test(location.search)) { locs.forest.push(['demo_viewer', 1300, 1200, 'warrior', 7, 'forest', 'moon_m_warrior', 'black', '', 0, 120, 'm', 'goblin', 60], ['mira77', 1500, 1220, 'mage', 5, 'forest', 'fire_f_mage', 'red', '', 0, 120, 'f', 'wolf', 35], ['gnomik', 1700, 1180, 'priest', 3, 'forest', 'none_m_priest', 'blond', '', 0, 120, 'm', 'mimic', 90], ['oddone', 1900, 1180, 'archer', 2, 'forest', 'nosuch', '', '', 0, 120, 'm', 'dragon', 50]); locs.boss.push(['ironpaw', 1, 1, 'paladin', 9, 'boss', 'gold_f_paladin', '', '', 0, 120, 'f'], ['redhood', 1, 1, 'assassin', 8, 'boss', 'silver_m_assassin', '', '#3a8ad8', 0, 120, 'm']); }
    state = { type: 'state', online: !/offline=1/.test(location.search), t: Date.now(), cam: 'camp', locs, boss: /queen=1/.test(location.search) ? { ph: 'fight', name: 'Королева-Матка', key: 'queen_boss', flt: '', hp: 11800, mhp: 17100, in: 0, n: 5, lair: /nolair=1/.test(location.search) ? undefined : 'boss_queen', sw: /nolair=1/.test(location.search) ? undefined : [4, 2] } : /fight=1/.test(location.search) ? { ph: 'fight', name: 'Проклятый огр', key: 'ogre_boss', flt: 'hue-rotate(220deg) saturate(.8) brightness(.9)', hp: 4200, mhp: 9000, in: 0, n: 2 } : { ph: 'wait', name: 'Тролль', in: 540000, n: 0 },
      me: { k6: 'moon_m_warrior', dy: '', fm: /fight=1/.test(location.search) ? ['goblin', 'Гоблин', 31, 52, 0] : null, n: 'demo_viewer', cls: 'warrior', cn: 'Воин', lv: 7, xp: 210, xpN: 350, hp: 86, mhp: 120, gold: 340, pot: 2, food: 3, sd: 4, sdp: 1, gd: 'Лунные тени', gid: 'moon', eqOwn: ['w_sword1', 'r_str', 'r_def', 'a_light', 'r_hp'], eqOn: { weapon: 'w_sword1', ring1: 'r_str', ring2: 'r_def', trinket: 'a_light' }, sr: [['❤', 'Здоровье', '86/120 (+15)'], ['⚔', 'Урон', '14 (+2)'], ['🛡', 'Защита', '9 (+2)'], ['🔮', 'Магия', '+3 к урону'], ['💖', 'Лечение', '—'], ['🥋', 'Броня', 'нет'], ['🌱', 'Семена', '4 · ✨ волшебные 1'], ['🍲', 'Готовка (наград сегодня)', '1'], ['⭐', 'Уровень', '7 · 210/350 XP'], ['💰', 'Золото', '340']], tt: ['Огородник', 'Гроза крыс'], ttOn: 'Огородник', ttOn: 'Огородник', hair: 'black', of: ['plant2', 'carrot2', 'harv4'], pty: false, st: 'camp', loc: 'camp', mode: 'idle',
        veg: { cucumber: 4, tomato: 2, carrot: 0, eggplant: 1, pumpkin: 0 }, wd: 7, rw: { hike: 1, cook: 1, quest: 2 }, qs: /quest=0/.test(location.search) ? { c: 0, d: 0, l: [] } : { c: ['Сходить в 2 похода', 1, 2, '+30 золота, +20 опыта'], d: 3, l: [['Приготовить 2 блюда', '+20 золота, +10 опыта'], ['Посадить 2 грядки', '+15 золота, +5 опыта, +2 семян'], ['Победить 5 монстров', '+25 золота, +15 опыта']] }, mg: { left: 1, max: 2, cd: 1260, seeds: 1 }, sal: { left: 3, max: 4, reset: 1900000, can: false, total: 1 }, rcp: [3, 1, 1, 0, 3, 0], cd: 75, buffs: 1, q: null, iv: { m: [['🪵', 'Дерево', 12], ['🪨', 'Камень', 5], ['⛓️', 'Железо', 1]], f: [['🥗', 'Овощной салат', 1], ['crop_carrot', 'Тушёная морковь (активно)', 8]], p: [['❤️', 'Зелье лечения', 2]], c: [] } },
      ref: /bc=1/.test(location.search) ? Object.assign({}, MOCK_REF, { bc: 5 }) : MOCK_REF };
    // v48.2: ?cast=1[&win=red|yellow|purple&cls=priest|mage|paladin|archer] — макет полосы каста босса (идёт по кругу)
    if (/[?&]cast=1/.test(location.search)) {
      const qs = k => (new RegExp('[?&]' + k + '=(\\w+)').exec(location.search) || [])[1];
      if (!state.boss || state.boss.ph !== 'fight') state.boss = { ph: 'fight', name: 'Проклятый огр', key: 'ogre_boss', flt: '', hp: 9800, mhp: 14400, in: 0, n: 12 };
      const ord = { red: ['y', 'r', 'p'], yellow: ['r', 'y', 'p'], purple: ['y', 'p', 'r'] }[qs('win') || 'red'];
      MOCK_CAST = { o: ord, p: (qs('p') ? +qs('p') : 0.55), r: 1 / 14, nm: state.boss.key === 'queen_boss' ? 'Зов роя' : 'Проклятое пробуждение', sl: qs('slow') ? 1 : 0 };
      state.boss.cast = Object.assign({}, MOCK_CAST); state._rx = Date.now();
      if (qs('cls')) { state.me.cls = qs('cls'); }
    }
    state.stream = !/offline=1/.test(location.search); state.test = /ptest=1/.test(location.search);
    if (/[?&]dur=1/.test(location.search)) { // v7panel42: макет прочности + цен починки (без relay)
      state.me.dr = { t: 28, g: state.me.gold, ok: 1, w: '', i: [['weapon', 45, 12, 'w_sword1'], ['trinket', 18, 16, 'a_light']] };
      state.me.iv = Object.assign({}, state.me.iv, { g: [['⚔', 'лут: Острый меч', 1]] });
      state.me.lg = ['sword2', 'armor2']; state.me.lgs = [['sword2','Рунный клинок',2,80,'+10% урон'],['armor2','Кольчуга',2,80,'+4 защита']]; if (state.me.iv) state.me.iv.g = [['⚔','лут: Рунный клинок',1,'sword2',80,'+10% урон'],['⚔','лут: Кольчуга',1,'armor2',80,'+4 защита']];
      invOpen = true; // сразу видно % и цены в строках снаряжения
    }
    // v7panel42: «Надето» берёт me.eqS (как live snapshot). Раньше mock заполнял только eqOn → карточка «ничего», кузница при этом показывала «надето».
    syncMockEqS(state.me);
    // v7panel37: макет тест-режима // v7panel35: макет — стрим идёт (иначе с v7panel32 пульт в ?mock=1 пустой)
    { const m = /[?&]pet=(\w+)/.exec(location.search); if (m) { state.me.pt = [['slime', 'Слизень'], ['fairy', 'Фея'], ['cat', 'Котёнок'], ['dragon', 'Дракончик']]; state.me.ptOn = m[1]; } } // v7panel35: ?pet=dragon — макет питомца
    // v7panel45: ?guild=moon|fire|gold|silver|none  и ?case=loaded|normal — для визуальной проверки единой карточки
    { const m = /[?&]guild=(\w+)/.exec(location.search); if (m) {
      const id = m[1].toLowerCase(), names = { moon: 'Лунные тени', fire: 'Огненный клинок', gold: 'Золотой колос', silver: 'Серебряный лист', none: '' };
      if (id in names) { state.me.gid = id === 'none' ? '' : id; state.me.gd = names[id]; }
    } }
    if (/[?&]case=loaded/.test(location.search)) {
      const me = state.me;
      me.xp = 388; me.xpN = 700; me.hp = 86; me.mhp = 120; me.lv = 12; me.cn = 'Жрица'; me.cls = 'priest'; me.k6 = 'moon_f_priest'; me.g = 'f';
      me.ttOn = 'Истребитель огров'; me.tt = ['Истребитель огров', 'Огородник', 'Гроза крыс'];
      me.pt = [['dragon', 'Дракончик'], ['slime', 'Слизень']]; me.ptOn = 'dragon';
      // реальные food из config (maxActiveBuffs=3); зелье удачи — potion, не bf
      me.bf = [
        ['Королевский пир', '+25% атаки, +5 защиты, +20% HP, +50% опыта, 4 похода', 4],
        ['Овощной суп', '+10% HP и +8% HP после волны, 3 похода', 3],
        ['Летний салат', '+5% HP после каждой волны, 2 похода', 2]
      ];
      me.eqOn = { weapon: 'w_sword1', armor: 'a_leather', offhand: 'o_shield', trinket: 'a_light', ring1: 'r_str', ring2: 'r_def' };
      me.eqOwn = Object.values(me.eqOn).concat(['r_hp']);
      me.dr = { t: 44, g: me.gold, ok: 1, w: '', i: [['weapon', 45, 12, 'w_sword1'], ['armor', 62, 10, 'a_leather'], ['trinket', 18, 16, 'a_light']] };
      me.lg = ['sword2', 'armor2']; me.lgs = [['sword2','Рунный клинок',2,80,'+10% урон'],['armor2','Кольчуга',2,80,'+4 защита']];
      me.iv.g = [['⚔','лут: Рунный клинок',1,'sword2',80,'+10% урон'],['⚔','лут: Кольчуга',1,'armor2',80,'+4 защита']];
      // жрец: левая рука — гримуар (не щит)
      me.eqOn.offhand = 'o_tome'; me.eqOwn.push('o_tome');
      if (!(MOCK_REF.eq || []).some(e => e[0] === 'o_tome')) MOCK_REF.eq.push(['o_tome', 'Гримуар новичка', 110, 'offhand', ['priest', 'mage'], 1, '+4 магия', 'tome']);
      syncMockEqS(me);
    }
    if (/[?&]px=494/.test(location.search)) { state.ref = Object.assign({}, state.ref, { px: 494 }); } // v49.4: макет — игра понимает «снять квест» / «купить семена N»
    { const m = /[?&]sets=(\w+)/.exec(location.search); if (m) mockSets(state.me, m[1]); } // v47: ?sets=1|2|empty|fight — макет сетов (без параметра — как старая игра, без сетов)
    { const m = /[?&]turn=(\d)/.exec(location.search); state.ref = Object.assign({}, state.ref, { ch: 'demo_channel', tl: 1 }); if (m) { state.ref.tb = 1; state.me.tu = +m[1] - 1; } } // v7panel31: ?turn=1 — флаг включён, ?turn=2 — лимит исчерпан
    { const m = /[?&]pty=(\w+)/.exec(location.search); if (m) { const v = m[1]; // v7panel30: макет пати — q (набор), go (в походе), none (пусто)
      state.ref = Object.assign({}, state.ref, { pty: v === 'none' ? { sz: 3, mn: 2, wv: 3, q: [], qn: 0, left: -1, lane: 0, go: [] }
        : v === 'go' ? { sz: 3, mn: 2, wv: 3, q: ['lisa_fox'], qn: 1, left: 142, lane: 0, go: [[['demo_viewer', 'mira77', 'gnomik'], '110', 'fight', 2]] }
        : { sz: 3, mn: 2, wv: 3, q: ['ironpaw', 'demo_viewer', 'kotik_mag', 'sunny_bard'], qn: 4, left: 0, lane: 1, go: [[['oak_knight', 'redhood'], '11', 'walk', 1]] } }); } }
  }
  // v47: макет сетов — воин 12 ур., сет 1 надет, во 2-м сете проданное кольцо и щит не для класса
  function mockSets(me, v) {
    const add = r => { if (!MOCK_REF.eq.some(e => e[0] === r[0])) MOCK_REF.eq.push(r); };
    add(['w_sword2', 'Стальной клинок', 300, 'weapon', ['warrior', 'paladin'], 2, '+2 урон', 'w2']); add(['a_mithril', 'Мифриловый доспех', 900, 'armor', ['warrior', 'paladin'], 3, '+34 HP, +3 защита · тяжёлая', 'a4']);
    add(['a_plate', 'Латы', 700, 'armor', ['warrior', 'paladin'], 3, '+22 HP, +2 защита · тяжёлая', 'a3']); add(['o_bracer', 'Стальные наручи', 250, 'offhand', ['warrior'], 2, '+2 защита', 'r2']); add(['o_pshield', 'Крепкий щит', 400, 'offhand', ['paladin'], 2, '+5% блок', 'o2']);
    Object.assign(me, { lv: 12, xp: 388, xpN: 600, hp: 96, mhp: 148, gold: 1240 });
    const S1 = { weapon: 'w_sword1', armor: 'a_plate', offhand: 'o_bracer', trinket: 't3', ring1: 'r_str', ring2: 'r_def' }, S2 = { weapon: 'w_sword2', armor: 'a_mithril', offhand: 'o_pshield', trinket: 'a_light', ring1: 'r_hp', ring2: 'r_dodge' };
    me.eqOn = Object.assign({}, S1); me.eqOwn = ['w_sword1', 'w_sword2', 'a_plate', 'a_mithril', 'o_bracer', 'o_pshield', 't3', 'a_light', 'r_str', 'r_def', 'r_hp']; // r_dodge — продано
    state.ref = Object.assign({}, state.ref, { sets: 2 });
    me.sets = { s: [S1, v === 'empty' ? 0 : S2], a: 1 };
    if (v === 'none') delete me.sets; // ничего не сохранено — игра me.sets не шлёт
    if (v === 'fight') { me.st = 'expedition'; me.loc = 'forest'; me.sets.lk = 'герой в походе — переодеться можно после боя'; }
    if (v === '2' || v === 'fight') setView = 2;
    syncMockEqS(me);
  }
  function mockSetReply(m) { const me = state.me; if (state.ref.sets && !me.sets) me.sets = { s: [0, 0], a: 0 }; const Z = me.sets; const a = String(m.arg || '').replace(/^сет\s*/, ''); let x;
    if (!Z) return { id: m.id, ok: false, msg: 'этой вещи нет в сумке (купить: !купить)' };
    if (Z.lk) return { id: m.id, ok: false, msg: 'сет: ' + Z.lk };
    if ((x = /^сохранить (\d)$/.exec(a))) { const n = +x[1]; Z.s[n - 1] = Object.assign({}, me.eqOn); Z.a = n; render(); return { id: m.id, ok: true, msg: `💾 сет ${n} сохранён (${Object.keys(me.eqOn).length} вещей) (демо)` }; }
    if ((x = /^(\d)$/.exec(a))) { const n = +x[1], set = Z.s[n - 1]; if (!set) return { id: m.id, ok: false, msg: `сет ${n} пуст (демо)` };
      const R = setRows(me, set, {}, MOCK_REF), ch = R.filter(r => r.k === 'new'); ch.forEach(r => { me.eqOn[r.s] = r.id; }); Z.a = n; syncMockEqS(me); render();
      const sk = R.filter(r => r.k === 'sold' || r.k === 'cls'); return { id: m.id, ok: true, msg: `👕 надевает сет ${n}: ${ch.length} ${ch.length === 1 ? 'вещь' : 'вещи'}${sk.length ? '; пропущено: ' + sk.map(r => r.name).join(', ') : ''} (демо)` }; }
    return { id: m.id, ok: false, msg: 'как пользоваться: !сет 1 / !сет 2 (демо)' }; }
  const MOCK_REF = { guilds: [['fire', 'Огненный клинок', '#d9482b'], ['silver', 'Серебряный лист', '#9fc7d6'], ['moon', 'Лунные тени', '#8a6ad8'], ['gold', 'Золотой колос', '#e8b830']],
    hair: [['black', 'чёрный', [[14, 12, 14], [40, 36, 42], [82, 76, 86]]], ['darkbrown', 'тёмно-каштановый', [[24, 14, 10], [60, 38, 26], [104, 72, 50]]], ['chestnut', 'каштановый', null], ['lightbrown', 'русый', [[70, 52, 34], [132, 106, 74], [190, 164, 122]]], ['blond', 'блонд', [[118, 86, 40], [202, 162, 86], [246, 224, 152]]], ['red', 'рыжий', [[88, 28, 10], [178, 72, 26], [238, 140, 66]]], ['grey', 'седой', [[78, 78, 84], [150, 150, 158], [216, 216, 224]]]], hairPrice: 250, bsLv: 3, ic: 1,
    eq: [['w_sword1', 'Железный меч', 120, 'weapon', null, 1, '+2 урон'], ['a_leather', 'Кожаная броня', 150, 'armor', null, 1, '+4 защита'], ['o_shield', 'Деревянный щит', 90, 'offhand', ['warrior', 'paladin'], 1, '+3 защита'], ['t_amulet', 'Амулет силы', 400, 'trinket', null, 2],
      /* v7panel37: кольца и амулеты с ключом иконки [7] */ ['r_str', 'Кольцо Силы', 300, 'ring1', null, 1, '+2 атк', 'ring_atk'], ['r_def', 'Кольцо Защиты', 300, 'ring1', null, 1, '+2 защ', 'ring_def'], ['r_hp', 'Кольцо Жизни', 300, 'ring1', null, 1, '+15 hp', 'ring_hp'], ['r_dodge', 'Кольцо Уклона', 450, 'ring1', null, 2, '+4% уклон', 'ring_dodge'], ['r_str2', 'Кольцо Силы II', 700, 'ring1', null, 3, '+4 атк', 'ring_atk~67'],
      ['a_light', 'Амулет Света', 500, 'trinket', null, 2, '+3 маг', 'amu_mag'], ['a_shadow', 'Амулет Тени', 500, 'trinket', null, 2, '+5% крит', 'amu_crit'], ['a_first', 'Амулет Первого выстрела', 600, 'trinket', null, 3, '+3 атк', 'amu_atk'], ['a_cleave', 'Амулет Клива', 650, 'trinket', ['warrior'], 3, '+2 атк, +10 hp', 'amu_b3'], ['a_aura', 'Амулет Ауры', 650, 'trinket', ['paladin'], 3, '+20 hp', 'amu_hp'], ['t3', 'Амулет героя', 850, 'trinket', null, 3, '+2 атк, +15 hp', 't3'], ['r_missing', 'Кольцо (нет файла)', 100, 'ring1', null, 1, 'проверка запасного значка', 'ring_nofile']],
    bld: [['campfire', 'Костёр', 1, 4, 140, 'camp'], ['tents', 'Палатка', 2, 4, 400, 'camp'], ['blacksmith', 'Кузница', 1, 4, 250, 'town'], ['market', 'Рынок', 1, 4, 200, 'town'], ['shed', 'Сарай', 1, 4, 150, 'garden']],
    quests: { plant2: 'Посадить 2 семечка', carrot2: 'Собрать 2 морковки', harv4: 'Собрать 4 урожая' }, recipes: [['Овощной салат', 'food', 'огурец 2, помидор 1', 1], ['Морковный суп', 'food', 'морковь 3', 1], ['Рагу', 'food', 'баклажан 2, морковь 2', 4], ['Тыквенный пирог', 'food', 'тыква 1, морковь 2', 7], ['Зелье лечения', 'potion', 'помидор 2', 1], ['Зелье удачи', 'potion', 'тыква 1, огурец 3', 4]],
    crops: [['cucumber', 'Огурец'], ['tomato', 'Помидор'], ['carrot', 'Морковь'], ['eggplant', 'Баклажан'], ['pumpkin', 'Тыква']],
    gear: [['sword1','Острый меч',1,40,'+5% урон'],['sword2','Рунный клинок',2,80,'+10% урон'],['armor2','Кольчуга',2,80,'+4 защита'],['sword3','Клинок героя',3,120,'+18% урон']] };
  // отправка команды: в бою — через relay (ника нет, его подставит relay из токена); в демо — ответ имитируется на странице
  window.__panelSend = m => {
    if (mock) return setTimeout(() => PanelActions.done(mockReply(m)), 350);
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); else PanelActions.done({ id: m.id, ok: false, msg: 'нет связи с сервером' });
  };
  function mockReply(m) {
    const me = state.me, it = MOCK_REF.eq.find(i => i[0] === m.arg);
    if (m.cmd === 'экип' && /^сет(\s|$)/.test(String(m.arg || ''))) return mockSetReply(m); // v47
    if (m.cmd === 'ход') { me.tu = (me.tu || 0) + 1; ['hike', 'cook', 'quest'].forEach(k => me.rw[k] = Math.min(3, me.rw[k] + 1)); return { id: m.id, ok: true, msg: `ход сделан! Запас: поход ${me.rw.hike}, готовка ${me.rw.cook}, квест ${me.rw.quest} (максимум 3). С пульта за стрим: ${me.tu} из 1. (демо)` }; }
    if (m.cmd === 'поход' && me.cd > 0) return { id: m.id, ok: false, msg: `поход: КД ещё ${Math.floor(me.cd / 60)}:${String(me.cd % 60).padStart(2, '0')}` };
    if (m.cmd === 'готовить' && /\s/.test(m.arg)) { const [k, q] = m.arg.split(' '), r = MOCK_REF.recipes[+k - 1]; return { id: m.id, ok: true, msg: `готовит ${q === 'макс' ? 2 : q} × ${r ? r[0] : '…'} (демо)` }; }
    if (m.cmd === 'готовить') { const r = MOCK_REF.recipes[+m.arg - 1]; return { id: m.id, ok: true, msg: r ? `идёт к котлу готовить «${r[0]}» (демо)` : 'идёт к котлу: лучшее из доступного (демо)' }; }
    if (m.cmd === 'продать' && /^(?:лут|loot)\s+/i.test(m.arg || '')) {
      const id = String(m.arg).replace(/^(?:лут|loot)\s+/i, '').trim();
      let row = (me.lgs || []).find(x => x[0] === id);
      if (!row && (me.lg || []).includes(id)) row = (MOCK_REF.gear || []).find(x => x[0] === id);
      if (!row) return { id: m.id, ok: false, msg: 'этого лута нет в сумке (демо)' };
      me.lg = (me.lg || []).filter(x => x !== id); me.lgs = (me.lgs || []).filter(x => x[0] !== id);
      if (me.iv && me.iv.g) me.iv.g = me.iv.g.filter(x => x[3] !== id);
      me.gold += row[3]; render();
      return { id: m.id, ok: true, msg: `продаёт лут «${row[1]}» за ${row[3]} золота (демо)` };
    }
    if (m.cmd === 'продать') return { id: m.id, ok: true, msg: `идёт на рынок и продаёт: ${m.arg} (демо)` };
    if (m.cmd === 'снять' && m.arg === 'квест') { window.__lastMockCmd = m; return { id: m.id, ok: true, msg: 'бросает задание (демо)' }; } // v49.4
    if (m.cmd === 'купить' && /^семена \d+$/.test(m.arg || '')) { window.__lastMockCmd = m; return { id: m.id, ok: true, msg: `покупает ${m.arg.split(' ')[1]} семян (демо)` }; }
    if (m.cmd === 'обмен') return { id: m.id, ok: true, msg: 'обмен: 🌿 -10, 🎃 +1 (демо)' };
    if (m.cmd === 'магия') return { id: m.id, ok: true, msg: 'магия: 🥕 +2 (демо)' };
    if (m.cmd === 'салат') { const s = me.sal; if (!s.left) return { id: m.id, ok: false, msg: 'лимит салатов на этот период (демо)' }; if (!s.can) return { id: m.id, ok: false, msg: 'для салата не хватает: 🥕 0/5, 🍆 1/5, 🎃 0/1 — ничего не списано (демо)' }; }
    if (m.cmd === 'грядка') return { id: m.id, ok: true, msg: 'осталось примерно 23 мин до созревания! (демо)' };
    if (m.cmd === 'купить' && it) { if (me.gold < it[2]) return { id: m.id, ok: false, msg: `«${it[1]}» стоит ${it[2]} золота, у тебя ${me.gold}` }; me.gold -= it[2]; me.eqOwn.push(it[0]); me.eqOn[it[3]] = it[0]; syncMockEqS(me); render(); return { id: m.id, ok: true, msg: `покупает и надевает «${it[1]}» (демо)` }; }
    if (m.cmd === 'чинить' || m.cmd === 'починить') { const dr = me.dr; if (!dr) return { id: m.id, ok: false, msg: 'прочность выключена (демо)' }; if (!dr.i || !dr.i.length) return { id: m.id, ok: true, msg: 'всё снаряжение целое (демо)' };
      const all = !m.arg || m.arg === 'всё' || m.arg === 'все'; const rows = all ? dr.i : dr.i.filter(x => x[0] === m.arg); if (!rows.length) return { id: m.id, ok: false, msg: 'нечего чинить (демо)' };
      const tot = rows.reduce((s, x) => s + x[2], 0); if (me.gold < tot) return { id: m.id, ok: false, msg: `нужно ${tot} з, у тебя ${me.gold} (демо)` }; me.gold -= tot;
      if (all) { dr.i = []; dr.t = 0; dr.ok = 0; dr.w = 'всё целое'; } else { dr.i = dr.i.filter(x => x[0] !== m.arg); dr.t = dr.i.reduce((s, x) => s + x[2], 0); dr.ok = dr.i.length && me.gold >= dr.t ? 1 : 0; }
      syncMockEqS(me); render(); return { id: m.id, ok: true, msg: `кузнец чинит (−${tot} з) (демо)` }; }
    return { id: m.id, ok: true, msg: `выполнено (демо): !${m.cmd}${m.arg ? ' ' + m.arg : ''}` };
  }
  // ---------- v48.2: полоса каста босса (видна на любой вкладке, секундомер идёт сам между снимками) ----------
  // Игра шлёт boss.cast = {o: порядок окон r/y/p, p: прогресс 0..1, r: скорость в доле/сек, nm: название, sl: замедлен}.
  const CAST_W = { r: { n: 'КРАСНОЕ', cmd: 'оглушить', ic: '💫', who: 'воин, паладин', col: '#e0453a', cls: ['warrior', 'paladin'] }, y: { n: 'ЖЁЛТОЕ', cmd: 'связать', ic: '🕸', who: 'лучник, ассасин', col: '#e8c33a', cls: ['archer', 'assassin'] }, p: { n: 'ФИОЛЕТОВОЕ', cmd: 'очистить', ic: '🔮', who: 'жрец', col: '#a35ae0', cls: ['priest'] } };
  const CAST_X = { mage: ['замедлить', '🐌'], paladin: ['заслон', '🛡'] };
  let castSig = '';
  function castNow() {
    const b = state && state.online && state.boss, c = b && b.ph === 'fight' && b.cast; if (!c || !Array.isArray(c.o) || c.o.length !== 3 || !(c.r > 0)) return null;
    const rx = state._rx || state.t || Date.now(); let dt = (Date.now() - rx) / 1000;
    if (mock && MOCK_CAST) { const per = 1 / MOCK_CAST.r; dt = ((Date.now() - rx) / 1000) % (per * (1 - c.p) + 2); }
    else if (dt > 6) return null; // связь пропала — не врём
    const p = Math.min(1, (+c.p || 0) + c.r * dt), w = Math.min(2, Math.floor(p * 3));
    return { c, p, w, key: c.o[w], left: Math.max(0, (1 - p) / c.r) };
  }
  function castTick() {
    const box = document.getElementById('castbox'); if (!box) return;
    const n = castNow(); if (!n) { if (!box.hidden) { box.hidden = true; box.innerHTML = ''; castSig = ''; } return; }
    const W = CAST_W[n.key] || CAST_W.r, mc = state.me && state.me.cls, mine = !!(mc && W.cls.includes(mc)), ex = mc && CAST_X[mc], sig = n.c.o.join('') + '|' + (n.c.nm || '') + '|' + mc + '|' + (n.c.sl ? 1 : 0) + (mine ? 1 : 0);
    if (sig !== castSig || box.hidden) { castSig = sig; box.hidden = false;
      box.innerHTML = `<div class="ct"><b>☠ ${esc(n.c.nm || 'Каст босса')}</b><span class="cl" id="cast-left"></span>${n.c.sl ? '<i class="csl">🐌 замедлен</i>' : ''}</div>
        <div class="cbar">${n.c.o.map((k, i) => `<span class="cw" data-i="${i}" style="background:${(CAST_W[k] || CAST_W.r).col}"></span>`).join('')}<span class="cm" id="cast-mark"></span></div>
        <div class="cnow" id="cast-now"></div><div class="cbtns" id="cast-btns"></div>`;
      const bt = [[W, true]].concat(ex ? [[{ cmd: ex[0], ic: ex[1] }, false]] : []);
      $('cast-btns').innerHTML = bt.map(([d, pr]) => `<button class="cb${pr ? ' pri' : ''}" data-cc="${d.cmd}"${pr && !mine ? ' disabled' : ''}>${d.ic} ${d.cmd[0].toUpperCase() + d.cmd.slice(1)}</button>`).join('') + (mine ? '' : `<span class="cwho">нужен: ${W.who}</span>`); }
    box.className = 'castbox' + (n.left <= 4 ? ' hot' : ''); box.dataset.w = n.key;
    $('cast-left').textContent = n.left.toFixed(1) + ' с';
    $('cast-mark').style.left = (n.p * 100).toFixed(2) + '%';
    box.querySelectorAll('.cw').forEach(e => e.classList.toggle('cur', +e.dataset.i === n.w));
    $('cast-now').innerHTML = `Сейчас <b style="color:${W.col}">${W.n}</b> окно — сбивает <b>${W.ic} ${W.cmd[0].toUpperCase() + W.cmd.slice(1)}</b> (${W.who})`;
    const pb = box.querySelector('.cb.pri'); if (pb) { pb.dataset.cc = W.cmd; pb.innerHTML = W.ic + ' ' + W.cmd[0].toUpperCase() + W.cmd.slice(1); }
  }
  document.addEventListener('click', e => { const b = e.target.closest('#castbox button[data-cc]'); if (!b || b.disabled || !window.PanelActions) return; const cmd = b.dataset.cc; PanelActions.fire(cmd, '', cmd[0].toUpperCase() + cmd.slice(1)); });
  setInterval(castTick, 100);
  takeHash();
  if (mock) { mockData(); const t0 = /[?&]tab=(\w+)/.exec(location.search); if (t0) tab = t0[1]; render(); } else validate();
  window.__panel = { get state() { return state; }, get user() { return user; }, render };
})();
