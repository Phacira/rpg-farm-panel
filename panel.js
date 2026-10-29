// Пульт зрителя, шаг 2: вход через Twitch и просмотр (без действий на стриме).
(function () {
  const CFG = window.PANEL_CONFIG || {}, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const W = 2560, H = 1440;
  const TABS = [['town', 'Город'], ['garden', 'Огород'], ['camp', 'Лагерь'], ['forest', 'Лес'], ['boss', 'Босс'], ['me', 'За моим героем']];
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
  function draw() {
    const c = $('map'); if (!c) return; const x = c.getContext('2d'), w = c.width, h = c.height, l = curLoc(), im = img(l);
    x.fillStyle = '#120e16'; x.fillRect(0, 0, w, h); if (im.complete && im.naturalWidth) x.drawImage(im, 0, 0, w, h);
    if (!state || !state.online) { x.fillStyle = 'rgba(10,6,12,.65)'; x.fillRect(0, 0, w, h); return; }
    const k = w / W, list = (state.locs && state.locs[l]) || [], me = user && user.login;
    x.font = `${Math.max(11, Math.round(w / 55))}px system-ui`; x.textAlign = 'center';
    for (const [n, hx, hy, , lv, st] of list) {
      const mine = n.toLowerCase() === me, px = hx * k, py = hy * k, r = mine ? 9 : 5;
      x.beginPath(); x.arc(px, py, r, 0, 7); x.fillStyle = mine ? '#ffd27a' : st === 'sleep' ? '#8a8aa8' : '#ffffff'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#000'; x.stroke();
      if (mine || list.length <= 25) { x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.85)'; const t = (mine ? '★ ' : '') + n + ' ' + lv; x.strokeText(t, px, py - r - 5); x.fillStyle = mine ? '#ffd27a' : '#fff'; x.fillText(t, px, py - r - 5); }
    }
  }
  function bar(v, m, cls) { const p = Math.max(0, Math.min(100, m ? v / m * 100 : 0)); return `<div class="bar ${cls}"><i style="width:${p.toFixed(0)}%"></i><span>${v} / ${m}</span></div>`; }
  function card(me) {
    if (!me) return `<div class="hcard"><b>Героя пока нет.</b><p class="note">Напишите в чат стрима <b>!rpg</b> — герой появится, и вы увидите его здесь.</p></div>`;
    const cd = me.cd > 0 ? `через ${Math.floor(me.cd / 60)}:${String(me.cd % 60).padStart(2, '0')}` : 'можно';
    const veg = Object.keys(VEG).map(k => `${VEG[k]} ${me.veg && me.veg[k] || 0}`).join(' &nbsp;');
    return `<div class="hcard"><div class="hname">★ ${esc(me.n)} <small>${esc(me.cn)} · ур. ${esc(me.lv)}</small></div>
      <div class="hst">${esc(ST[me.st] || me.st)} · ${esc(LOCN[me.loc] || me.loc)}${me.gd ? ' · гильдия: ' + esc(me.gd) : ''}</div>
      ${bar(me.hp, me.mhp, 'hp')}${bar(me.xp, me.xpN, 'xp')}
      <div class="hgrid"><span>💰 ${esc(me.gold)}</span><span>🧪 ${esc(me.pot)}</span><span>🍲 ${esc(me.food)}</span><span>🥾 поход: ${cd}</span></div>
      <div class="hveg">${veg}</div>
      <div class="note">Наград сегодня: поход ${me.rw.hike}, готовка ${me.rw.cook}, квест ${me.rw.quest}${me.q ? ' · есть квест' : ''}</div></div>`;
  }
  function render() {
    $('auth').innerHTML = user ? `<span class="who">Вы: <b>${esc(user.login)}</b> <small>(ID ${esc(user.id)})</small></span><button id="bout" class="small">Выйти</button>`
      : `<button id="blogin" class="twitch">Войти через Twitch</button><span class="note">Вход нужен только чтобы найти вашего героя. Пульт ничего не пишет в чат и ничего не меняет.</span>`;
    if ($('blogin')) $('blogin').onclick = login; if ($('bout')) $('bout').onclick = logout;
    const live = $('live'), body = $('pbody');
    body.hidden = !user;
    if (!user) return;
    const on = state && state.online;
    live.className = 'live ' + (on ? 'on' : 'off');
    live.textContent = !state ? 'Подключение…' : state.nocfg ? 'Пульт ещё не подключён к серверу (RELAY_URL пуст)' : on ? '● Стрим идёт' : 'Стрим не идёт';
    $('tabs').innerHTML = TABS.map(([id, t]) => `<button data-t="${id}" class="${id === tab ? 'act' : ''}">${t}</button>`).join('');
    const l = curLoc(), list = on && state.locs ? (state.locs[l] || []) : [];
    let info = on ? `${LOCN[l] || l}: героев ${list.length}` : 'Когда стример запустит игру, здесь появится карта.';
    if (on && l === 'boss' && state.boss) { const b = state.boss; info += ' · ' + (b.ph === 'wait' ? `босс ${esc(b.name || '')} через ${Math.ceil(b.in / 60000)} мин` : b.ph === 'signup' ? `запись на босса: ${b.n}` : b.ph === 'fight' ? 'идёт бой с боссом!' : 'босс повержен'); }
    $('linfo').innerHTML = info;
    $('hero').innerHTML = on ? card(state.me) : '';
    draw();
  }
  document.addEventListener('click', e => { const b = e.target.closest('#tabs button'); if (b) { tab = b.dataset.t; render(); } });

  // ---------- Демо-режим (?mock=1): вымышленные данные, без сети ----------
  function mockData() {
    user = { login: 'demo_viewer', id: '100000001' };
    const R = (a, b) => a + Math.floor(Math.random() * (b - a)), names = ['demo_viewer', 'lisa_fox', 'ironpaw', 'mira77', 'oak_knight', 'kotik_mag', 'sunny_bard', 'gnomik', 'redhood', 'pixel_elf'];
    const locs = { town: [], garden: [], camp: [], forest: [], boss: [] }, ls = ['camp', 'camp', 'garden', 'town', 'camp', 'garden', 'forest', 'town', 'camp', 'garden'];
    names.forEach((n, i) => locs[ls[i]].push([n, R(300, 2260), R(900, 1300), 'warrior', R(1, 20), i === 4 ? 'sleep' : ls[i]]));
    state = { type: 'state', online: !/offline=1/.test(location.search), t: Date.now(), cam: 'camp', locs, boss: { ph: 'wait', name: 'Тролль', in: 540000, n: 0 },
      me: { n: 'demo_viewer', cls: 'warrior', cn: 'Воин', lv: 7, xp: 210, xpN: 350, hp: 86, mhp: 120, gold: 340, pot: 2, food: 3, gd: 'Совы', st: 'camp', loc: 'camp', mode: 'idle',
        veg: { cucumber: 4, tomato: 2, carrot: 0, eggplant: 1, pumpkin: 0 }, rw: { hike: 1, cook: 0, quest: 2 }, cd: 75, buffs: 1, q: 1 } };
  }
  takeHash();
  if (mock) { mockData(); render(); } else validate();
  window.__panel = { get state() { return state; }, get user() { return user; }, render };
})();
