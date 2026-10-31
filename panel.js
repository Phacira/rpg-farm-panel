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
  // v7panel11: коды спрайтов из игры (crop_carrot…) → смайлики; «(активно)» — отдельной пометкой
  const ICON_MAP = { crop_carrot: '🥕', crop_cucumber: '🥒', crop_eggplant: '🍆', crop_pumpkin: '🎃', crop_tomato: '🍅', potion: '🧪', food: '🍲' };
  const VEG_BY_EMO = { '🥒': 'cucumber', '🍅': 'tomato', '🥕': 'carrot', '🍆': 'eggplant', '🎃': 'pumpkin' }; // v7panel11: овощи — настоящими спрайтами игры (img/veg/*.png из assets/crops)
  const vegImg = (id, alt) => `<img class="vegi" src="img/veg/${id}.png" alt="${esc(alt || '')}">`;
  window.__vegImg = vegImg;
  // v7panel20 п.7: железо — серый слиток (тот же пиксельный набор, что в игре) вместо ⛓️
  const INGOT = '<img class="vegi" src="img/ingot.png" alt="железо">';
  // v7panel21 п.1: иконки DCSS/Idylwild (img/ic/<ключ>.png) — когда игра включила их (ref.ic); 'ic:<ключ>' в инвентаре
  const icImg = k => `<img class="vegi ic" src="img/ic/${esc(k)}.png" alt="">`;
  const icOn = () => !!(state && state.ref && state.ref.ic);
  window.__icImg = icImg; window.__icOn = icOn;
  const icoH = ic => { ic = String(ic || ''); if (/^ic:[a-z0-9_]+$/.test(ic)) return icImg(ic.slice(3)); return ic === '⛓️' || ic === '⛓' ? (icOn() ? icImg('iron') : INGOT) : esc(ic); };
  function invIcon(ic, def) { ic = String(ic || ''); if (!ic) return def; if (/^[a-z0-9_]+$/i.test(ic)) return ICON_MAP[ic] || def; return ic; }
  function invItem(x, def) { let nm = String(x[1] || ''), act = !!x[3]; nm = nm.replace(/^[a-z0-9_]+\s+(?=[А-ЯЁа-яё])/i, ''); if (/\s*\(активно\)\s*$/.test(nm)) { act = true; nm = nm.replace(/\s*\(активно\)\s*$/, ''); } const ic = invIcon(x[0], def), vm = /^crop_([a-z]+)$/.exec(String(x[0] || '')); return { ic, nm, n: x[2], act, veg: vm ? vm[1] : VEG_BY_EMO[ic] }; }
  window.__panelInvItem = invItem;
  let invOpen = false;
  function invHtml(me) {
    const ref = (state && state.ref) || {}, iv = me.iv || {}, eqN = {}; (ref.eq || []).forEach(e => eqN[e[0]] = e[1]);
    const chip = (o, cnt) => `<span class="ivi${o.act ? ' on' : ''}" title="${esc(o.nm)}${o.act ? ' — ' + (o.tag || 'активно') : ''}">${o.veg ? vegImg(o.veg, o.ic) : icoH(o.ic)} ${esc(o.nm)}${cnt ? ` <b>×${esc(o.n)}</b>` : ''}${o.act ? ` <i class="ivact">${o.tag || 'активно'}</i>` : ''}</span>`;
    const row = (t, arr) => arr.length ? `<div class="ivr"><em>${t}</em><div class="ivv">${arr.join('')}</div></div>` : '';
    const L = (a, def) => (a || []).map(x => chip(invItem(x, def), +x[2] > 0));
    const eqOn = me.eqOn || {}, spare = (me.eqOwn || []).filter(id => !Object.values(eqOn).includes(id));
    const eqT = {}; (ref.eq || []).forEach(e => eqT[e[0]] = e[6] || ''); // v7panel20 п.2: что даёт вещь
    const gear = Object.keys(eqOn).filter(s => eqOn[s]).map(s => chip({ ic: icOn() ? 'ic:' + eqOn[s] : SLOT_IC[s] || '▫️', nm: (eqN[eqOn[s]] || eqOn[s]) + (eqT[eqOn[s]] ? ' — ' + eqT[eqOn[s]] : ''), act: false }))
      .concat(spare.map(id => chip({ ic: icOn() ? 'ic:' + id : '🎒', nm: (eqN[id] || id) + (eqT[id] ? ' — ' + eqT[id] : '') })));
    // v7panel12: блок «Косметика» убран (косметика выключена до утверждения Tim); титул — в «Снаряжении»
    const ttl = me.ttOn ? [chip({ ic: '🏷️', nm: 'титул: ' + me.ttOn, act: true, tag: 'надето' })] : [];
    const pet = (me.pt || []).map(([id, n]) => chip({ ic: '🐾', nm: 'питомец: ' + n, act: me.ptOn === id, tag: 'надет' })); // v7panel12 п.7
    const body = [row('Снаряжение', gear.concat(ttl, pet)), row('Материалы', L(iv.m, '🪨')), row('Еда', L(iv.f, '🍲')), row('Зелья', L(iv.p, '🧪'))].join('');
    return `<div class="hinv${invOpen ? ' open' : ''}"><button type="button" class="ivh" aria-expanded="${invOpen}">🎒 Инвентарь ${invOpen ? '▴' : '▾'}</button>${invOpen ? `<div class="ivb">${body || '<span class="ivn">пусто</span>'}</div>` : ''}</div>`;
  }
  document.addEventListener('click', e => { if (e.target.closest('.hinv .ivh')) { invOpen = !invOpen; render(); } });
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
  function foodHtml(me) {
    const ref = (state && state.ref) || {}, L = ref.recipes || [];
    if (!L.length) return '';
    const rows = L.map(([n, kind, need, lv, txt, ick], i) => { const f = me && me.rcp ? me.rcp[i] || 0 : 1;
      return `<div class="upr2${f & 1 ? '' : ' off'}"${f & 1 ? '' : ` title="откроется с ур.${esc(lv)}"`}><span class="upi">${ick ? icImg(ick) : kind === 'potion' ? '🧪' : '🍲'}</span><b class="upn">${esc(n)}</b><span class="upe" title="${esc(txt || '')}">${esc(shortFx(txt) || '—')}</span><span class="upp">${f & 1 ? esc(need) : 'с ур.' + esc(lv)}</span></div>`; }).join('');
    return `<div class="upbox"><h2>🍲 Еда и зелья</h2><div class="upt upt-f"><div class="upr2 uph"><span></span><span>Название</span><span>Эффект</span><span>Состав</span></div>${rows}</div></div>`;
  }
  // v7panel20 п.2: все характеристики героя (из игры: me.sr), что даёт надетое (me.eqS) и баффы (me.bf)
  function statHtml(me) {
    const sr = (me.sr || []).filter(r => !/^(Семена|Готовка|Уровень|Золото)/.test(r[1]));
    const eq = me.eqS || [], bf = me.bf || [];
    return `<div class="hstats">${sr.map(([i, n, v]) => `<span><em>${esc(i)} ${esc(n)}</em> ${esc(v)}</span>`).join('')}</div>`
      + `<div class="hlist"><b>Надето:</b> ${eq.length ? eq.map(([sn, n, t, id]) => `<span>${icOn() && id ? icImg(id) : ''}${esc(sn)}: ${esc(n)} — ${esc(t)}</span>`).join('') : '<span class="dim">ничего</span>'}</div>`
      + `<div class="hlist"><b>Баффы:</b> ${bf.length ? bf.map(([n, t, c]) => `<span>${esc(n)}: ${esc(t)} (×${esc(c)})</span>`).join('') : '<span class="dim">нет активных</span>'}</div>`;
  }
  // v7panel20 п.8: журнал боя на пульте — последние 15 мин (ref.log от игры), прокрутка, фильтр «мои/все», повторы подряд — «×N»
  let logMine = false;
  function logHtml(me) {
    const L = ((state && state.ref && state.ref.log) || []), nm = me && me.n ? String(me.n).toLowerCase() : '';
    const src = logMine && nm ? L.filter(e => String(e[1]).toLowerCase().includes(nm)) : L, out = [];
    for (const e of src) { const p = out[out.length - 1]; if (p && p.x === e[1]) { p.n++; p.t = e[0]; } else out.push({ t: e[0], x: e[1], k: e[2], n: 1 }); }
    const hm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    return `<div class="logbox"><div class="logh"><h2>📜 Журнал (15 мин)</h2><span class="logf"><button type="button" data-lf="0" class="${logMine ? '' : 'on'}">все</button><button type="button" data-lf="1" class="${logMine ? 'on' : ''}"${nm ? '' : ' disabled'}>мои</button></span></div>
      <div class="logl" id="logl">${out.length ? out.map(e => `<div class="lg ${e.k === 'b' ? 'lb' : 'le'}"><time>${hm(e.t)}</time> ${esc(e.x)}${e.n > 1 ? ` <b>×${e.n}</b>` : ''}</div>`).join('') : '<div class="lg le">за 15 минут событий нет</div>'}</div></div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest('.logf button'); if (b && !b.disabled) { logMine = b.dataset.lf === '1'; render(); } });
  function card(me) {
    if (!me) return `<div class="hcard"><b>Героя пока нет.</b><p class="note">Напишите в чат стрима <b>!rpg</b> — герой появится, и вы увидите его здесь.</p></div>`;
    const cd = me.cd > 0 ? `через ${Math.floor(me.cd / 60)}:${String(me.cd % 60).padStart(2, '0')}` : 'можно';
    const veg = Object.keys(VEG).map(k => `<span class="hv" title="${k}">${vegImg(k, VEG[k])}${me.veg && me.veg[k] || 0}</span>`).join('');
    const rw = me.rw || {}, cook = +rw.cook || 0;
    const today = [`поход ${cd === 'можно' ? '✓' : cd}`].concat(cook > 0 ? [`готовка ${cook}`] : []).concat(+rw.quest > 0 ? [`квест ${rw.quest}`] : []).concat(me.q ? ['есть квест'] : []);
    return `<div class="hcard"><div class="hname">★ ${esc(me.n)} <small>${esc(me.cn)} · ур. ${esc(me.lv)}</small></div>
      <div class="hst">${esc(ST[me.st] || me.st)} · ${esc(LOCN[me.loc] || me.loc)}${me.gd ? ' · гильдия: ' + esc(me.gd) : ''}</div>
      ${bar(me.hp, me.mhp, 'hp')}${me.mmp ? bar(me.mp || 0, me.mmp, 'mp') : ''}${bar(me.xp, me.xpN, 'xp')}
      <div class="hgrid"><span>💰 ${esc(me.gold)}</span><span>🌱 ${esc(me.sd || 0)} · ✨ ${esc(me.sdp || 0)}</span></div>
      <div class="hveg">${veg}</div>
      <div class="htoday">Сегодня: ${today.map(esc).join(' · ')}</div>
      ${tab === 'me' ? statHtml(me) : ''}${invHtml(me)}</div>`;
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
    const ol = $('logl'), stick = !ol || ol.scrollTop + ol.clientHeight >= ol.scrollHeight - 8, oldTop = ol ? ol.scrollTop : 0;
    $('hero').innerHTML = on ? card(state.me) + (tab === 'town' ? upHtml() : tab === 'garden' ? foodHtml(state.me) : '') + (tab === 'forest' || tab === 'boss' || tab === 'me' ? logHtml(state.me) : '') : '';
    if (window.PanelActions) PanelActions.render($('acts'), { online: !!on, tab, me: on ? state.me : null, ref: state && state.ref });
    const ll = $('logl'); if (ll) ll.scrollTop = stick ? ll.scrollHeight : oldTop; // прокрутка: внизу — следим за новыми, иначе остаёмся где читали
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
      me: { n: 'demo_viewer', cls: 'warrior', cn: 'Воин', lv: 7, xp: 210, xpN: 350, hp: 86, mhp: 120, gold: 340, pot: 2, food: 3, sd: 4, sdp: 1, gd: 'Лунные тени', gid: 'moon', eqOwn: ['w_sword1'], eqOn: { weapon: 'w_sword1' }, tt: ['Огородник', 'Гроза крыс'], ttOn: 'Огородник', ttOn: 'Огородник', hair: 'black', of: ['plant2', 'carrot2', 'harv4'], pty: false, st: 'camp', loc: 'camp', mode: 'idle',
        veg: { cucumber: 4, tomato: 2, carrot: 0, eggplant: 1, pumpkin: 0 }, rw: { hike: 1, cook: 1, quest: 2 }, mg: { left: 1, max: 2, cd: 1260, seeds: 1 }, sal: { left: 3, max: 4, reset: 1900000, can: false, total: 1 }, rcp: [3, 1, 1, 0, 3, 0], cd: 75, buffs: 1, q: null, iv: { m: [['🪵', 'Дерево', 12], ['🪨', 'Камень', 5], ['⛓️', 'Железо', 1]], f: [['🥗', 'Овощной салат', 1], ['crop_carrot', 'Тушёная морковь (активно)', 8]], p: [['❤️', 'Зелье лечения', 2]], c: [] } },
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
    if (m.cmd === 'готовить') { const r = MOCK_REF.recipes[+m.arg - 1]; return { id: m.id, ok: true, msg: r ? `идёт к котлу готовить «${r[0]}» (демо)` : 'идёт к котлу: лучшее из доступного (демо)' }; }
    if (m.cmd === 'продать') return { id: m.id, ok: true, msg: `идёт на рынок и продаёт: ${m.arg} (демо)` };
    if (m.cmd === 'обмен') return { id: m.id, ok: true, msg: 'обмен: 🌿 -10, 🎃 +1 (демо)' };
    if (m.cmd === 'магия') return { id: m.id, ok: true, msg: 'магия: 🥕 +2 (демо)' };
    if (m.cmd === 'салат') { const s = me.sal; if (!s.left) return { id: m.id, ok: false, msg: 'лимит салатов на этот период (демо)' }; if (!s.can) return { id: m.id, ok: false, msg: 'для салата не хватает: 🥕 0/5, 🍆 1/5, 🎃 0/1 — ничего не списано (демо)' }; }
    if (m.cmd === 'грядка') return { id: m.id, ok: true, msg: 'осталось примерно 23 мин до созревания! (демо)' };
    if (m.cmd === 'купить' && it) { if (me.gold < it[2]) return { id: m.id, ok: false, msg: `«${it[1]}» стоит ${it[2]} золота, у тебя ${me.gold}` }; me.gold -= it[2]; me.eqOwn.push(it[0]); me.eqOn[it[3]] = it[0]; render(); return { id: m.id, ok: true, msg: `покупает и надевает «${it[1]}» (демо)` }; }
    return { id: m.id, ok: true, msg: `выполнено (демо): !${m.cmd}${m.arg ? ' ' + m.arg : ''}` };
  }
  takeHash();
  if (mock) { mockData(); const t0 = /[?&]tab=(\w+)/.exec(location.search); if (t0) tab = t0[1]; render(); } else validate();
  window.__panel = { get state() { return state; }, get user() { return user; }, render };
})();
