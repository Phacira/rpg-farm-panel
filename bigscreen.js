/* Большой экран пульта — opt-in (кнопка «Большой экран» / ?big=1). Обычный вид по умолчанию. Кэш bs510. */
(function () {
  const W = 2560, H = 1440, KEY = 'rpgPanel.bigscreen';
  const LOCS = [['camp', '🔥', 'Лагерь'], ['forest', '🌲', 'Лес'], ['boss', '👹', 'Босс'], ['garden', '🌱', 'Огород'], ['town', '🏘', 'Город']];
  const LOCN = { camp: 'Лагерь', forest: 'Лес', boss: 'Босс', garden: 'Огород', town: 'Город' };
  const CLSN = { warrior: 'Воин', archer: 'Лучник', mage: 'Маг', priest: 'Жрец', paladin: 'Паладин', assassin: 'Ассасин' };
  const MOB_RU = { wolf: 'Волк', goblin: 'Гоблин', slime: 'Слизень', rat: 'Крыса', tree_spirit: 'Дух дерева', mimic: 'Мимик', ogre_boss: 'Огр', queen_boss: 'Королева-Матка', treant_king_boss: 'Король Трентов' };
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => window.__panel && __panel.esc ? __panel.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wantOn = () => { try { if (/[?&]big=1/.test(location.search)) return true; if (/[?&]big=0/.test(location.search)) return false; return localStorage.getItem(KEY) === '1'; } catch (e) { return /[?&]big=1/.test(location.search); } };

  // как в game.js: ogre/queen нарисованы лицом вправо — зеркалим, голова влево к героям; трент почти анфас.
  const BOSS_MIRROR = { ogre_boss: 1, troll_boss: 1, queen_boss: 1 };
  const BOSS_FILE = { ogre_boss: 'ogre_boss.png', troll_boss: 'ogre_boss.png', queen_boss: 'queen_boss.png', treant_boss: 'treant_king_boss.png', treant_king_boss: 'treant_king_boss.png' };
  // Сцена 2560×1440. Смена фона — правь только эти числа и файл img/<lair>.jpg.
  // floorY0/Y1 — полоса пола (ноги); rows — Y рядов (зад, середина, перед); scale — масштаб ряда (перспектива);
  // x0 — левый край строя; boss — ноги босса; clear — зазор до героев; h — высота спрайта босса.
  const BOSS_LAIR = {
    boss:        { floorY0: 860, floorY1: 1240, rows: [900, 1060, 1220], scale: [0.90, 0.95, 1], x0: 400, boss: [2040, 1140], clear: 420, h: 460 },
    boss_treant: { floorY0: 820, floorY1: 1240, rows: [940, 1080, 1220], scale: [0.86, 0.93, 1], x0: 400, boss: [2020, 1160], clear: 440, h: 500 },
    boss_queen:  { floorY0: 840, floorY1: 1240, rows: [960, 1090, 1220], scale: [0.86, 0.93, 1], x0: 400, boss: [2020, 1160], clear: 470, h: 460 }
  };
  function lairKeyOf(st) {
    const k = st && st.boss && st.boss.lair;
    if (k && BOSS_LAIR[k]) return k;
    const id = (st && st.boss && st.boss.key) || '';
    if (/treant/.test(id)) return 'boss_treant';
    if (/queen/.test(id)) return 'boss_queen';
    return 'boss';
  }
  function lairSpotOf(st) { return BOSS_LAIR[lairKeyOf(st)] || BOSS_LAIR.boss; }
  function bossSrc(key) { const f = BOSS_FILE[key] || 'ogre_boss.png'; return 'img/boss/' + f; }
  function layoutBossHeroes(list, L) {
    const rowsY = L.rows, nR = rowsY.length, scales = L.scale || rowsY.map(() => 1);
    const xRight = L.boss[0] - L.clear, xLeft = L.x0 || 400;
    if (!list.length) return [];
    const ys = list.map(t => +t[2]);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const assigned = list.map(t => {
      const r = (yMax === yMin) ? nR - 1 : Math.max(0, Math.min(nR - 1, Math.round((+t[2] - yMin) / (yMax - yMin) * (nR - 1))));
      return { t: t.slice(), r };
    });
    for (let r = 0; r < nR; r++) {
      const row = assigned.filter(a => a.r === r).sort((a, b) => a.t[1] - b.t[1]);
      const n = row.length; if (!n) continue;
      const stagger = (r % 2) ? 50 : 0;
      const left = xLeft + stagger, right = xRight - (r % 2 ? 30 : 0);
      row.forEach((a, i) => {
        a.t[1] = n === 1 ? Math.round((left + right) / 2) : Math.round(left + i * (right - left) / Math.max(1, n - 1));
        a.t[2] = rowsY[r];
        a.t._hs = scales[r] || 1;
      });
    }
    return assigned.map(a => a.t).sort((a, b) => a[2] - b[2] || a[1] - b[1]);
  }
  function dockClassicBars(into) {
    ['castbox', 'rm49', 'tr495'].forEach(id => {
      const n = document.getElementById(id); if (!n || !into) return;
      if (!n._bsHome) n._bsHome = n.parentElement;
      if (n.parentElement !== into) into.appendChild(n);
    });
  }
  function undockClassicBars() {
    ['castbox', 'rm49', 'tr495'].forEach(id => {
      const n = document.getElementById(id);
      if (n && n._bsHome && n.parentElement !== n._bsHome) n._bsHome.appendChild(n);
    });
  }

  let on = false, logMine = false, bsLoc = 'camp', dockTab = 'q';

  function mount() {
    if ($('#bs')) return;
    const el = document.createElement('div');
    el.id = 'bs';
    el.innerHTML = `
      <div class="scene-wrap" id="bsWrap">
        <div class="scene" id="bsScene">
          <img class="bg" id="bsBg" alt="">
          <div class="glow" id="bsGlow"></div>
          <div id="bsActors"></div>
        </div>
      </div>
      <div class="hud" id="bsHud">
        <button type="button" class="bs-off" id="bsOff">← Обычный пульт</button>
        <div class="loc-chip" id="bsChip"></div>
        <div class="unitframe" id="bsUnit"></div>
        <div class="bossbar" id="bsBoss" hidden></div>
        <aside class="bsp goal" id="bsGoal" hidden></aside>
        <aside class="bsp quests" id="bsQuests"></aside>
        <aside class="bsp feed" id="bsFeed">
          <header>📜 Журнал <button type="button" class="exp" data-bslog="1">развернуть</button></header>
          <ul id="bsFeedList"></ul>
        </aside>
        <div class="ph-dock" id="bsDock">
          <div class="goal-strip" id="bsGoalStrip" hidden></div>
          <div class="dock-tabs" role="tablist">
            <button type="button" class="on" data-bstab="q">Задания</button>
            <button type="button" data-bstab="l">Журнал</button>
          </div>
          <div class="dock-pane on" id="bsDockQ"></div>
          <div class="dock-pane" id="bsDockL">
            <button type="button" class="exp wide" data-bslog="1">Развернуть журнал</button>
            <ul id="bsDockFeed"></ul>
          </div>
        </div>
        <div class="bars-wrap">
          <nav class="locbar" id="bsLocbar"></nav>
          <nav class="actionbar" id="bsBar"></nav>
        </div>
      </div>
      <div class="overlay" id="bsOverlay" hidden>
        <div class="window" role="dialog">
          <header class="win-h"><h2 id="bsInvTitle">Инвентарь</h2><button class="x" id="bsInvX" type="button" aria-label="Закрыть">✕</button></header>
          <div class="inv-body" id="bsInvBody"></div>
        </div>
      </div>
      <div class="log-overlay" id="bsLogOv" hidden>
        <div class="log-win" role="dialog">
          <header class="win-h">
            <h2>📜 Журнал (15 мин)</h2>
            <span class="logf"><button type="button" data-bslf="0" class="on">все</button><button type="button" data-bslf="1">мои</button></span>
            <button class="x" id="bsLogX" type="button" aria-label="Закрыть">✕</button>
          </header>
          <div class="log-body" id="bsLogBody"></div>
        </div>
      </div>`;
    document.body.appendChild(el);

    $('#bsOff').onclick = () => setOn(false);
    $('#bsInvX').onclick = () => setInv(false);
    $('#bsOverlay').addEventListener('click', e => { if (e.target.id === 'bsOverlay') setInv(false); });
    $('#bsLogX').onclick = () => setLog(false);
    $('#bsLogOv').addEventListener('click', e => { if (e.target.id === 'bsLogOv') setLog(false); });
    $('#bsLocbar').addEventListener('click', e => {
      const b = e.target.closest('button[data-loc]'); if (!b) return;
      bsLoc = b.dataset.loc; setInv(false); setLog(false);
      if (window.__panel && __panel.setTab) __panel.setTab(bsLoc); else sync();
    });
    $('#bsBar').addEventListener('click', e => {
      const b = e.target.closest('button[data-i]'); if (!b || b.disabled) return;
      const i = +b.dataset.i, defs = lastDefs[i];
      if (!defs) return;
      if (defs._ui === 'inv') return setInv(true);
      if (defs._ui === 'log') return setLog(true);
      if (defs[2] && window.__bossLeft && __bossLeft(defs[2])) return;
      if (window.PanelActions && PanelActions.activate) PanelActions.activate(defs);
    });
    document.addEventListener('click', e => {
      if (e.target.closest('[data-bslog]')) { e.preventDefault(); setLog(true); }
      const lf = e.target.closest('[data-bslf]');
      if (lf) { logMine = lf.dataset.bslf === '1'; fillLog(); }
      const tab = e.target.closest('#bs [data-bstab]');
      if (tab) {
        dockTab = tab.dataset.bstab;
        document.querySelectorAll('#bs [data-bstab]').forEach(x => x.classList.toggle('on', x === tab));
        const q = $('#bsDockQ'), l = $('#bsDockL');
        if (q) q.classList.toggle('on', dockTab === 'q');
        if (l) l.classList.toggle('on', dockTab === 'l');
      }
    });
    addEventListener('resize', layout);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { if (on) layout(); });
      ['bsBoss', 'bsBar', 'bsDock'].forEach(id => { const n = document.getElementById(id); if (n) ro.observe(n); });
    }
  }

  function enterBtn() {
    const h = document.querySelector('#panel h1');
    if (!h || $('#bsEnter')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'bsEnter'; b.textContent = '🖥 Большой экран';
    b.onclick = () => setOn(true);
    h.appendChild(b);
  }

  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (!on) undockClassicBars();
    document.body.classList.toggle('bs-on', on);
    if (on) { mount(); const t = window.__panel && __panel.tab; if (t && t !== 'me') bsLoc = t; else if (__panel && __panel.state && __panel.state.me && __panel.state.me.loc) bsLoc = __panel.state.me.loc; sync(); }
    else if (window.__panel) __panel.render();
  }

  function ctx() {
    const P = window.__panel, st = P && P.state, user = P && P.user;
    const online = !!(st && st.online && (st.stream || (st.ref && st.ref.stream)));
    return { online, tab: bsLoc, me: online && st ? st.me : null, ref: st && st.ref, state: st, user };
  }

  function sprUrl(t) {
    const k6 = String(t[6] || '').replace(/_sit$/, '');
    const sit = t[5] === 'sleep', hair = t[7] || '';
    if (sit) return 'img/h/' + k6 + '_sit.webp';
    const key = (hair && k6 && !k6.endsWith('_' + hair)) ? k6 + '_' + hair : k6;
    return key ? 'img/h7/' + key + '.webp' : '';
  }
  function sprFb(t) {
    const k6 = String(t[6] || '').replace(/_sit$/, '');
    const hair = t[7] || '';
    const key = (hair && k6 && !k6.endsWith('_' + hair)) ? k6 + '_' + hair : k6;
    return key ? 'img/h/' + (key) + '.webp' : (k6 ? 'img/h/' + k6 + '.webp' : '');
  }

  function bgOf(l, st) {
    if (l === 'boss' && st && st.boss && st.boss.lair && /^boss_[a-z0-9_]{1,24}$/.test(st.boss.lair)) return 'img/' + st.boss.lair + '.jpg?v=bs510';
    return 'img/' + (l || 'camp') + '.jpg?v=bs510';
  }

  let lastDefs = [];

  function barDefs(c) {
    const D = window.PanelActions && PanelActions.defs ? PanelActions.defs(c) : {};
    let list = (D[c.tab] || []).slice();
    if (c.tab === 'camp') {
      const have = new Set(list.map(d => d[2]));
      (D.forest || []).forEach(d => { if (/^(поход|пати|ход)$/.test(d[2]) && !have.has(d[2])) { list.push(d); have.add(d[2]); } });
      // «В поход» и «Пати» — в начало, как в макете
      const pri = ['поход', 'пати', 'ход'];
      list = list.slice().sort((a, b) => (pri.indexOf(a[2]) + 1 || 99) - (pri.indexOf(b[2]) + 1 || 99));
    }
    list = list.concat([
      { _ui: 'inv', 0: '🎒', 1: 'Инвентарь', 4: '' },
      { _ui: 'log', 0: '📜', 1: 'Журнал', 4: '' }
    ]);
    // normalize array-like
    return list.map(d => Array.isArray(d) ? d : Object.assign([d[0], d[1], d._ui, '', d[4]], d));
  }

  function fillBar(c) {
    const defs = barDefs(c);
    lastDefs = defs;
    $('#bsLocbar').innerHTML = LOCS.map(l => `<button type="button" data-loc="${l[0]}"${l[0] === bsLoc ? ' class="on"' : ''}>${l[1]} <span>${l[2]}</span></button>`).join('');
    $('#bsBar').innerHTML = defs.map((d, i) => {
      const ic = d[0] || '•', lab = d[1] || '', sub = d[4] || '', dis = !!d[6], other = d[7] === 'other';
      const cmd = d._ui ? '' : (d[2] || '');
      const left = cmd && window.__bossLeft ? __bossLeft(cmd) : 0;
      const hot = !left && (c.tab === 'camp' && /поход|пати/.test(cmd) && !dis || (c.tab === 'boss' && !dis && !other && cmd && cmd !== 'босс'));
      const off = dis || left;
      const cls = off ? ' class="dis' + (left ? ' bcd' : '') + '"' : hot ? ' class="hot"' : '';
      const bc = cmd ? ` data-bc="${esc(cmd)}" data-sub="${esc(sub)}" data-en="${dis ? 0 : 1}"` : '';
      const subTxt = left ? ('⏳ откат ' + left + ' с') : sub;
      return `<button type="button" data-i="${i}"${bc}${cls}${off ? ' disabled' : ''}>`
        + (other ? `<span class="grp">не твой класс</span>` : '')
        + `<span class="ic">${ic}</span><span class="lbl">${esc(lab)}</span>`
        + (subTxt ? `<small class="sub">${esc(subTxt)}</small>` : '') + `</button>`;
    }).join('');
  }

  function fillUnit(c) {
    const me = c.me, el = $('#bsUnit');
    if (!me) { el.innerHTML = '<div class="unit-main"><div class="unit-top"><b>Нет героя</b></div><div class="unit-sub">Сначала вступите в игру</div></div>'; return; }
    const hp = +me.hp || 0, mhp = +me.mhp || 1, xp = +me.xp || 0, xpN = +me.xpN || 1;
    const pic = window.__panel && __panel.heroPic ? __panel.heroPic(me.k6, me.hair, me.dy, me.cls, 'big') : '';
    el.innerHTML = `<div class="port">${pic}</div><div class="unit-main">
      <div class="unit-top"><b>★ ${esc(me.n)}</b><span class="lvl">${esc(me.lv)} ур.</span></div>
      <div class="unit-sub">${esc(me.cn || CLSN[me.cls] || me.cls || '')}${me.gd ? ' · ' + esc(me.gd) : ''}</div>
      <div class="bar hp"><i style="width:${Math.max(0, Math.min(100, hp / mhp * 100))}%"></i><span>HP ${hp}/${mhp}</span></div>
      <div class="bar xp"><i style="width:${Math.max(0, Math.min(100, xp / xpN * 100))}%"></i><span>Опыт ${xp}/${xpN}</span></div>
      <div class="unit-res"><span>🪙 ${esc(me.gold || 0)}</span><span>🧪 ${esc(me.pot || 0)}</span><span>🍲 ${esc(me.food || 0)}</span></div>
    </div>`;
  }

  function fillGoal(c) {
    const el = $('#bsGoal'), strip = $('#bsGoalStrip');
    const g = c.online && +((c.ref && c.ref.px) || 0) >= 499 && Array.isArray(c.ref.sg) ? c.ref.sg : null;
    el.hidden = !g;
    if (strip) strip.hidden = !g;
    if (!g) return;
    const [t, pr, nd, dn] = g, pc = Math.max(0, Math.min(100, Math.round(100 * pr / (nd || 1))));
    el.innerHTML = `<header>🎯 Цель стрима</header>
      <div class="goal-title">${esc(t)}</div>
      <div class="bar goalb"><i style="width:${dn ? 100 : pc}%"></i><span>${dn ? '✔ выполнено' : `${pr} / ${nd}`}</span></div>
      ${dn || !g[4] ? '' : `<div class="muted">награда: ${esc(g[4])}</div>`}`;
    if (strip) strip.innerHTML = `<span>🎯 Цель стрима: ${esc(t)}</span><b>${dn ? '✔' : `${pr}/${nd}`}</b><span class="sgb"><i style="width:${dn ? 100 : pc}%"></i></span>`;
  }

  function questLis(c) {
    const me = c.me, qn = (c.ref && c.ref.quests) || {}, of = (me && me.of) || [], qs = me && me.qs;
    const rows = [];
    if (qs && Array.isArray(qs.c) && qs.c[0]) rows.push(`<li><i class="qdot on"></i>${esc(qs.c[0])} <b>${esc(qs.c[1] || 0)}/${esc(qs.c[2] || 1)}</b></li>`);
    if (qs && Array.isArray(qs.l)) qs.l.forEach(x => rows.push(`<li><i class="qdot"></i>${esc(x[0] || '')}</li>`));
    if (!rows.length) of.forEach(id => rows.push(`<li><i class="qdot"></i>${esc(qn[id] || id)}</li>`));
    return rows;
  }
  function fillQuests(c) {
    const el = $('#bsQuests'), rows = questLis(c);
    el.innerHTML = `<header>📜 Задания</header>${rows.length ? `<ul>${rows.join('')}</ul>` : '<div class="muted">сейчас нет заданий</div>'}`;
    const dq = $('#bsDockQ'); if (dq) dq.innerHTML = rows.length ? `<ul>${rows.join('')}</ul>` : '<div class="muted">сейчас нет заданий</div>';
  }

  function logRows(c, mine, limit) {
    const L = ((c.ref && c.ref.log) || []), nm = c.me && c.me.n ? String(c.me.n).toLowerCase() : '';
    const src = mine && nm ? L.filter(e => String(e[1]).toLowerCase().includes(nm)) : L;
    const out = [];
    for (const e of src) { const p = out[out.length - 1]; if (p && p.x === e[1]) { p.n += +e[3] || 1; p.t = e[0]; } else out.push({ t: e[0], x: e[1], k: e[2], n: +e[3] || 1, mine: nm && String(e[1]).toLowerCase().includes(nm) }); }
    const hm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const rows = limit ? out.slice(0, limit) : out;
    if (!rows.length) return '<div class="muted">за 15 минут событий нет</div>';
    return rows.map(e => `<div class="lg${e.mine ? ' mine' : ''}"><time>${hm(e.t)}</time> ${esc(e.x)}${e.n > 1 ? ` <b>×${e.n}</b>` : ''}</div>`).join('');
  }
  function fillFeed(c) {
    const html = logRows(c, false, 5);
    const short = html.replace(/class="lg/g, 'class="x').replace(/<div class="x[^"]*">/g, '<li>').replace(/<\/div>/g, '</li>');
    // simpler:
    const L = ((c.ref && c.ref.log) || []).slice(0, 5);
    const hm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const lis = L.length ? L.map(e => `<li><time>${hm(e[0])}</time> ${esc(e[1])}</li>`).join('') : '<li class="muted">событий пока нет</li>';
    $('#bsFeedList').innerHTML = lis;
    const df = $('#bsDockFeed'); if (df) df.innerHTML = lis;
  }
  function fillLog() {
    const body = $('#bsLogBody'); if (!body) return;
    body.innerHTML = logRows(ctx(), logMine);
    document.querySelectorAll('[data-bslf]').forEach(b => b.classList.toggle('on', (b.dataset.bslf === '1') === logMine));
  }

  function fillBoss(c) {
    const el = $('#bsBoss'), b = c.state && c.state.boss;
    const show = c.tab === 'boss' && b;
    undockClassicBars();
    el.hidden = !show;
    if (!show) return;
    const timer = window.__panel && __panel.bossTimerText ? (__panel.bossTimerText() || '') : '';
    const ph = b.ph === 'fight' ? 'в бою' : b.ph === 'signup' ? 'запись' : b.ph === 'wait' ? 'ожидание' : b.ph === 'done' ? (b.win ? 'побеждён' : 'ушёл') : '';
    const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const pct = b.mhp ? Math.max(0, Math.min(100, b.hp / b.mhp * 100)) : 0;
    const swarm = Array.isArray(b.sw) ? ` · 🐛 личинок ${esc(+b.sw[0] || 0)}, коконов ${esc(+b.sw[1] || 0)}` : '';
    const hp = b.mhp ? `<div class="fight boss"><span class="fmob"><span class="fhp"><i style="width:${pct}%"></i></span><small>${esc(fmt(b.hp))} / ${esc(fmt(b.mhp))} HP${swarm}</small></span></div>` : '';
    el.innerHTML = `<div class="bossbar-top"><div class="bossbar-name">${esc(b.name || 'Босс')} · ${esc(ph)}${b.n ? ' ' + b.n : ''}</div></div>`
      + (timer ? `<div class="bt496" id="bt496c">${esc(timer)}</div>` : '')
      + hp + `<div class="bs-docks" id="bsDocks"></div>`;
    dockClassicBars($('#bsDocks'));
  }

  function fillActors(c) {
    const box = $('#bsActors'), st = c.state, l = bsLoc;
    const meName = c.user && c.user.login ? String(c.user.login).toLowerCase() : (c.me && String(c.me.n).toLowerCase()) || '';
    let list = ((st && st.locs && st.locs[l]) || []).map(t => t.slice()).sort((a, b) => a[2] - b[2] || a[1] - b[1]);
    const Lair = (l === 'boss' && st && st.boss) ? lairSpotOf(st) : null;
    if (Lair && st.boss.ph === 'fight') list = layoutBossHeroes(list, Lair);
    const faceRight = l !== 'camp';
    let html = '';
    for (const t of list) {
      const n = t[0], x = t[1], y = t[2], cls = t[3], lv = t[4], k6 = t[6] || '';
      const mine = String(n).toLowerCase() === meName;
      const g = (k6.split('_')[0] || t[11] || 'none');
      const flip = faceRight ? false : x > 1280;
      const src = sprUrl(t), fb = sprFb(t);
      const cn = CLSN[cls] || cls || '';
      const hs = t._hs || 1;
      html += `<div class="hero g-${esc(g)}${mine ? ' me' : ''}${flip ? ' flip' : ''}" data-n="${esc(n)}" style="left:${+x}px;top:${+y}px;z-index:${Math.round(+y)};--hs:${hs}">`
        + `<div class="shadow"></div><div class="ring"></div>`
        + (src ? `<img src="${esc(src)}" alt="" onerror="${fb && fb !== src ? `this.onerror=null;this.src='${esc(fb)}'` : `this.remove()`}">` : '')
        + `<div class="name">${mine ? '★ ' : ''}${esc(n)}<small>${esc(cn)}${lv != null && lv !== '' ? ' · ' + esc(lv) : ''}</small></div></div>`;
    }
    if (l === 'forest') {
      const seen = new Set();
      for (const t of list) if (t[12] && !seen.has(t[12])) {
        seen.add(t[12]);
        const mx = 1500, my = 1100, hp = t[13], id = t[12];
        const ext = id === 'mimic' ? 'png' : 'webp';
        html += `<div class="mob" style="left:${mx}px;top:${my}px;z-index:${Math.round(+my)}">`
          + `<img src="img/mob/${esc(id)}.${ext}" alt="" onerror="this.remove()">`
          + `<div class="mname">${esc(MOB_RU[id] || id)}</div>`
          + (hp != null ? `<div class="mhp bar hp"><i style="width:${Math.max(0, Math.min(100, +hp))}%"></i><span>${esc(hp)}%</span></div>` : '')
          + `</div>`;
      }
    }
    if (l === 'boss' && st && st.boss && st.boss.ph === 'fight' && st.boss.key) {
      const id = st.boss.key, src = bossSrc(id), flip = !!BOSS_MIRROR[id];
      const flt = /^[a-z0-9().,\s-]*$/i.test(st.boss.flt || '') && st.boss.flt ? ` filter:${esc(st.boss.flt)};` : '';
      const h = Lair ? Lair.h : (/treant/.test(id) ? 500 : 460);
      const bx = Lair ? Lair.boss[0] : 2040, by = Lair ? Lair.boss[1] : 1140;
      html += `<div class="mob boss${flip ? ' flip' : ''}" style="left:${bx}px;top:${by}px;z-index:${by}">`
        + `<img src="${esc(src)}" alt="" style="height:${h}px;${flt}" onerror="this.remove()">`
        + `<div class="mname">${esc(st.boss.name || '')}</div></div>`;
    }
    box.innerHTML = html;
    $('#bsBg').src = bgOf(l, st);
    $('#bs').dataset.view = l;
    const n = list.length;
    $('#bsChip').textContent = (LOCN[l] || l) + (n ? ' · героев ' + n : '');
  }

  function layoutKind() {
    const w = innerWidth, h = innerHeight;
    if (w <= 520 && h > w) return 'phone-p';
    if (h <= 500 && w > h) return 'phone-l';
    return 'pc';
  }
  function phoneCam(l, st) {
    const list = ((st && st.locs && st.locs[l]) || []);
    const pts = list.map(t => [+t[1], +t[2]]);
    if (l === 'boss' && st && st.boss && st.boss.ph === 'fight') {
      const L = lairSpotOf(st); pts.push(L.boss);
    }
    if (l === 'forest') (st && st.locs && st.locs.forest || []).forEach(t => { if (t[12]) pts.push([+t[1] + 220, +t[2]]); });
    if (!pts.length) {
      if (l === 'boss') return { x: 640, y: 280, w: 1480, h: 1100 };
      if (l === 'forest') return { x: 520, y: 420, w: 1400, h: 1000 };
      return { x: 780, y: 620, w: 1100, h: 820 };
    }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs) - 300, maxX = Math.max(...xs) + 300;
    const minY = Math.min(...ys) - 540, maxY = Math.max(...ys) + 180;
    return { x: minX, y: minY, w: Math.max(1000, maxX - minX), h: Math.max(740, maxY - minY) };
  }
  function layout() {
    if (!on) return;
    const root = $('#bs'), wrap = $('#bsWrap'), scene = $('#bsScene'); if (!root || !wrap || !scene) return;
    const kind = layoutKind();
    root.classList.remove('phone-p', 'phone-l', 'pc');
    root.classList.add(kind);
    const wr = wrap.getBoundingClientRect();
    let s, ox, oy;
    if (kind === 'phone-p') {
      const bars = $('.bars-wrap', root);
      const barsH = (bars && bars.offsetHeight) || 176;
      root.style.setProperty('--barsH', (barsH + 10) + 'px');
      const boss = $('#bsBoss');
      const bossH = (boss && !boss.hidden) ? boss.offsetHeight : 0;
      root.style.setProperty('--bossH', bossH + 'px');
      const dockMin = 120;
      const maxScene = innerHeight - barsH - 12 - dockMin - (bossH ? bossH + 8 : 0);
      const sh = Math.max(200, Math.min(Math.round(innerHeight * 0.42), maxScene));
      wrap.style.height = sh + 'px';
      root.style.setProperty('--sceneH', sh + 'px');
      const r = wrap.getBoundingClientRect();
      const cam = phoneCam(bsLoc, window.__panel && __panel.state);
      s = Math.max(r.width / cam.w, r.height / cam.h);
      ox = r.width / 2 - (cam.x + cam.w / 2) * s;
      oy = r.height / 2 - (cam.y + cam.h / 2) * s;
    } else if (kind === 'phone-l') {
      wrap.style.height = '';
      const floor = 72;
      s = Math.max(wr.width / W, (wr.height - floor) / (H - 120));
      ox = (wr.width - W * s) / 2;
      oy = (wr.height - floor - 8) - 1220 * s;
    } else {
      wrap.style.height = '';
      s = Math.min(wr.width / W, wr.height / H);
      ox = (wr.width - W * s) / 2;
      oy = (wr.height - H * s) / 2;
    }
    scene.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + s + ')';
    clipNames();
  }

  function clipNames() {
    const wrap = $('#bsWrap'); if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const blockers = ['.unitframe', '.bossbar:not([hidden])', '.bars-wrap', '#bsGoal:not([hidden])', '#bsQuests', '#bsFeed', '.bs-off', '.ph-dock']
      .flatMap(s => [...document.querySelectorAll('#bs ' + s)])
      .map(el => el.getBoundingClientRect())
      .filter(b => b.width > 2 && b.height > 2);
    const names = [...document.querySelectorAll('#bs .hero:not([hidden]) .name')]
      .sort((a, b) => (b.closest('.me') ? 1 : 0) - (a.closest('.me') ? 1 : 0));
    const kept = [];
    names.forEach(n => {
      const b = n.getBoundingClientRect();
      const hit = q => b.left < q.right && b.right > q.left && b.top < q.bottom && b.bottom > q.top;
      const cut = b.left < r.left + 2 || b.right > r.right - 2 || b.top < r.top + 2 || b.bottom > r.bottom - 2
        || blockers.some(hit) || kept.some(hit);
      n.style.visibility = cut ? 'hidden' : '';
      if (!cut) kept.push(b);
    });
  }

  function setInv(show) {
    const ov = $('#bsOverlay'); if (!ov) return;
    ov.hidden = !show;
    if (!show) return;
    const c = ctx(), body = $('#bsInvBody');
    const acts = document.createElement('div'); acts.id = 'bsInvActs'; acts.className = 'actsbox';
    const card = document.createElement('div');
    card.innerHTML = (c.me && window.__panel && __panel.cardHtml) ? __panel.cardHtml(c.me) : '<p class="muted">Нет героя</p>';
    body.innerHTML = ''; body.appendChild(acts); body.appendChild(card);
    if (window.PanelActions) PanelActions.render(acts, { online: c.online, tab: 'me', me: c.me, ref: c.ref });
  }
  function setLog(show) {
    const ov = $('#bsLogOv'); if (!ov) return;
    ov.hidden = !show;
    if (show) fillLog();
  }

  function sync() {
    enterBtn();
    if (!on) return;
    mount();
    const c = ctx();
    if (window.__panel && __panel.tab && __panel.tab !== 'me') bsLoc = __panel.tab;
    c.tab = bsLoc;
    fillUnit(c); fillGoal(c); fillQuests(c); fillFeed(c); fillBoss(c); fillBar(c); fillActors(c);
    if (!$('#bsOverlay').hidden) setInv(true);
    if (!$('#bsLogOv').hidden) fillLog();
    requestAnimationFrame(() => { layout(); const imgs = [...document.querySelectorAll('#bs img')].filter(i => !i.complete); if (!imgs.length) { layout(); window.__bsReady = true; return; }
      let n = imgs.length; const done = () => { if (--n <= 0) { layout(); window.__bsReady = true; } };
      imgs.forEach(i => { i.addEventListener('load', done); i.addEventListener('error', done); }); });
  }

  window.BigScreen = { sync, setOn, get on() { return on; }, get loc() { return bsLoc; } };

  function boot() {
    enterBtn();
    if (wantOn()) setOn(true);
    if (/[?&]bslog=1/.test(location.search)) setLog(true);
    if (/[?&]bsinv=1/.test(location.search)) setInv(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
