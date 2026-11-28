// Академия магии — сайт ученика и пульт ведущего. Вход через Twitch (как у пульта RPG-фермы), связь с игрой через relay.
(function () {
  const CFG = window.PANEL_CONFIG || {}, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HOUSES = [
    { id: 'astra', name: 'Astra', color: '#4a7fe0', motto: 'звёзды и ясный ум' },
    { id: 'verdant', name: 'Verdant', color: '#46a862', motto: 'жизнь и терпение' },
    { id: 'vallor', name: 'Vallor', color: '#e0544e', motto: 'смелость и сила' },
    { id: 'lumen', name: 'Lumen', color: '#9a68d8', motto: 'луна и тайны' }];
  const EMB = {
    astra: 'M0 -9 l2.6 6.4 6.9 0 -5.4 4.2 2.1 6.8 -6.2 -4 -6.2 4 2.1 -6.8 -5.4 -4.2 6.9 0z',
    lumen: 'M2 -9 a9 9 0 1 0 2.2 15.6 a7 7 0 1 1 -2.2 -15.6z',
    verdant: 'M0 -10 q-9 2 -8 9 q-3 6 3.5 8 q2.5 1 4.5 0 q6 -2 3.5 -8 q1 -7 -8 -9z M-1.2 6 h2.4 v6 h-2.4z',
    vallor: 'M-1.4 -11 h2.8 v13 h-2.8z M-6 2 h12 v2.8 h-12z M-1.6 4.8 h3.2 v5.5 h-3.2z' };
  const emblem = (id, size) => `<svg width="${size}" height="${size}" viewBox="-12 -12 24 24" aria-hidden="true"><path d="${EMB[id]}" fill="#f6d26b" stroke="#2a1e08" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  const houseOf = id => HOUSES.find(h => h.id === id);
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
  function render() { renderAuth(); renderMe(); renderCup(); renderAdmin(); }
  function renderAuth() {
    $('auth').innerHTML = user
      ? `<span>Вы вошли как <b>${esc(user.login)}</b></span><button class="btn-ghost btn-small" id="out">Выйти</button>`
      : '';
    const o = $('out'); if (o) o.onclick = logout;
  }
  function resLine() { return lastRes && Date.now() - lastRes.at < 15000 ? `<p class="res ${lastRes.ok ? '' : 'bad'}">${esc(lastRes.msg)}</p>` : ''; }
  function portrait(look) { return look ? `<div class="portrait"><img src="img/heads/${encodeURIComponent(look)}.png" alt=""></div>` : `<div class="portrait empty">?</div>`; }
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
    if (!me) {
      box.innerHTML = `<div class="status">${portrait(null)}<div><p class="big">Хотите учиться магии?</p>
        <p class="sub">Ваш ученик встанет в очередь у ворот, а потом волшебный шар выберет ему факультет.</p></div></div>
        <div class="row"><button class="btn-gold" data-g="м" ${busy ? 'disabled' : ''}>Поступить парнем</button><button class="btn-gold" data-g="ж" ${busy ? 'disabled' : ''}>Поступить девушкой</button></div>
        <div class="row"><button data-g="" ${busy ? 'disabled' : ''}>Пусть решит судьба</button></div>${resLine()}`;
      box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => send('поступить', b.dataset.g));
      return;
    }
    if (me.st === 'queue') {
      const ahead = me.pos - 1 + (pub.sorting ? 1 : 0), wait = Math.round(ahead * (pub.every || 7) / 10) * 10;
      box.innerHTML = `<div class="status">${portrait(me.look)}<div><p class="big">Вы в очереди у ворот</p>
        <p class="sub">Место <b>${me.pos}</b> из ${pub.queue || me.pos}. ${ahead ? `Перед вами ${ahead} чел.` : 'Вы следующий!'}${pub.paused ? ' Распределение сейчас на паузе.' : ahead ? ` Ждать ${wait < 60 ? 'меньше минуты' : 'около ' + Math.round(wait / 60) + ' мин'}.` : ''}</p></div></div>${resLine()}`;
      return;
    }
    if (me.st === 'sorting') {
      box.innerHTML = `<div class="status">${portrait(me.look)}<div><p class="big"><span class="spin">✦</span> Шар выбирает…</p>
        <p class="sub">Ваш ученик стоит у волшебного шара. Смотрите на стрим!</p></div></div>${resLine()}`;
      return;
    }
    const h = houseOf(me.house);
    box.innerHTML = `<div class="status">${portrait(me.look)}<div><p class="big">${esc(me.n)}</p><p class="sub">Ученик Академии магии</p></div></div>
      <div class="house" style="background:${h.color}">${emblem(h.id, 44)}<div><b>${h.name}</b><div>${h.motto}</div></div></div>${resLine()}`;
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
      <p class="sub">${pub.paused ? 'Распределение на паузе.' : 'Распределение идёт.'} В очереди: ${pub.queue || 0}.${pub.sorting ? ` У шара: ${esc(pub.sorting)}.` : ''}</p>
      <div class="row">${pub.paused ? '<button class="btn-gold" data-c="продолжить">Продолжить</button>' : '<button data-c="пауза">Пауза</button>'}
        <button data-c="следующий" ${!pub.queue || pub.sorting ? 'disabled' : ''}>Следующего к шару</button><button data-c="тест">Тестовый ученик</button></div>
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
    if (cmd === 'поступить') { state.me = { n: user.login, look: arg === 'ж' ? 'f_braids_ginger' : 'm_curly_blond', st: 'queue', pos: 4 }; p.queue = 6; setRes(true, 'вы в очереди: место 4'); setTimeout(() => { state.me.st = 'sorting'; render(); }, 2500); setTimeout(() => { state.me.st = 'house'; state.me.house = 'lumen'; p.counts.lumen++; render(); }, 5000); return; }
    if (cmd === 'пауза') p.paused = true; if (cmd === 'продолжить') p.paused = false; if (cmd === 'скорость') p.every = +arg; if (cmd === 'места') state.adm.perHouse = +arg;
    setRes(true, 'пример: команда «' + cmd + '» выполнена'); render();
  }
  if (mock) {
    user = { login: 'ведьмочка' };
    state = { online: true, admin: true, me: null, pub: { counts: { astra: 12, verdant: 9, vallor: 15, lumen: 11 }, queue: 5, paused: false, every: 7, sorting: 'Kotik_42' },
      adm: { perHouse: 4, queue: [['darkmage', 'DarkMage'], ['lisa', 'Лиса'], ['pixel', 'Pixel']], all: [['mira', 'Mira', 'astra'], ['rogue', 'Rogue', 'vallor'], ['tisha', 'Тиша', 'verdant']] } };
  }
  takeHash(); render(); if (!mock) validate();
})();
