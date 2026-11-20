/* Большой экран пульта — opt-in (кнопка «Большой экран» / ?big=1). Обычный вид по умолчанию. Кэш bs519. */
(function () {
  const W = 2560, H = 1440, KEY = 'rpgPanel.bigscreen';
  const LOCS = [['town', '🏘', 'Город'], ['garden', '🌱', 'Огород'], ['camp', '🔥', 'Лагерь'], ['forest', '🌲', 'Лес'], ['boss', '👹', 'Босс']];
  const LOCN = { camp: 'Лагерь', forest: 'Лес', boss: 'Босс', garden: 'Огород', town: 'Город' };
  const CLSN = { warrior: 'Воин', archer: 'Лучник', mage: 'Маг', priest: 'Жрец', paladin: 'Паладин', assassin: 'Ассасин' };
  const MOB_RU = { wolf: 'Волк', goblin: 'Гоблин', slime: 'Слизень', rat: 'Стая крыс', tree_spirit: 'Дух дерева', mimic: 'Мимик', ogre_boss: 'Огр', queen_boss: 'Королева-Матка', treant_king_boss: 'Король Трентов' };
  const MOB_H = { slime: 100, goblin: 150, wolf: 130, rat: 64, tree_spirit: 170, mimic: 120 };
  const MOB_GROUP = { rat: 3 };
  const MOB_PACK = [[-0.55, -0.34, 0.9], [0.55, -0.34, 0.9], [0, 0, 1]];
  const GUILD_RU = { fire: 'Огненный легион', moon: 'Лунные тени', gold: 'Золотой колос', silver: 'Серебряный лист' };
  const FOLD_KEY = 'rpgPanel.bsFold';
  let fold = { loc: false, bar: false, feed: false };
  try {
    const o = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}');
    if (o && typeof o === 'object') { fold.loc = !!o.loc; fold.bar = !!o.bar; fold.feed = !!o.feed; }
  } catch (e) {}
  (function applyFoldQuery() {
    const m = /[?&]fold=([^&]*)/.exec(location.search);
    if (!m) return;
    const v = decodeURIComponent(m[1] || '');
    if (v === '0' || v === 'off') fold = { loc: false, bar: false, feed: false };
    else if (v === '1' || v === 'on') fold = { loc: true, bar: true, feed: true };
    else { const s = new Set(v.split(',').map(x => x.trim()).filter(Boolean)); fold.loc = s.has('loc'); fold.bar = s.has('bar'); fold.feed = s.has('feed'); }
  })();
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

  let on = false, logMine = false, bsLoc = 'camp', dockTab = 'q', dockOpen = false;
  let actorTween = { loc: '', nodes: Object.create(null), raf: 0, lastAt: 0 };

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
          <div class="fx-layer" id="bsFx"></div>
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
          <header>📜 Журнал <span class="head-btns"><button type="button" class="exp" data-bslog="1">развернуть</button><button type="button" class="fold-chev" data-bsfold="feed" title="Свернуть журнал" aria-label="Свернуть журнал">▾</button></span></header>
          <ul id="bsFeedList"></ul>
        </aside>
        <button type="button" class="fold-tab feed-tab" data-bsfold="feed" title="Показать журнал">📜 Журнал</button>
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
          <div class="bar-group" data-grp="loc">
            <button type="button" class="fold-chev" data-bsfold="loc" title="Свернуть локации" aria-label="Свернуть локации">▾</button>
            <nav class="locbar" id="bsLocbar"></nav>
          </div>
          <button type="button" class="fold-tab loc-tab" data-bsfold="loc" title="Показать локации">🗺️ Локации</button>
          <div class="bar-group" data-grp="bar">
            <button type="button" class="fold-chev" data-bsfold="bar" title="Свернуть кнопки" aria-label="Свернуть кнопки">▾</button>
            <nav class="actionbar" id="bsBar"></nav>
          </div>
          <button type="button" class="fold-tab bar-tab" data-bsfold="bar" title="Показать кнопки">⚔️ Кнопки</button>
        </div>
      </div>
      <div class="overlay" id="bsOverlay" hidden>
        <div class="window" role="dialog">
          <header class="win-h"><h2 id="bsInvTitle">Инвентарь</h2><button class="x" id="bsInvX" type="button" aria-label="Закрыть">✕</button></header>
          <div class="inv-body" id="bsInvBody"></div>
        </div>
      </div>
      <div class="overlay sheet" id="bsSheet" hidden>
        <div class="window sheet-win" role="dialog">
          <header class="win-h"><h2 id="bsSheetTitle">Ещё</h2><button class="x" id="bsSheetX" type="button" aria-label="Закрыть">✕</button></header>
          <div class="sheet-body" id="bsSheetBody"></div>
        </div>
      </div>
      <div class="zoom-ctl" id="bsZoom" aria-label="Масштаб сцены">
        <button type="button" data-z="in" title="Приблизить" aria-label="Приблизить">+</button>
        <button type="button" data-z="out" title="Отдалить" aria-label="Отдалить">−</button>
        <button type="button" data-z="reset" title="Сбросить масштаб" aria-label="Сбросить масштаб">1×</button>
      </div>
      <div class="bs-tips" id="bsTips" hidden></div>
      <div class="bs-hint" id="bsHint" hidden></div>
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
    $('#bsSheetX').onclick = () => setSheet(false);
    $('#bsSheet').addEventListener('click', e => { if (e.target.id === 'bsSheet') setSheet(false); });
    $('#bsLocbar').addEventListener('click', e => {
      const b = e.target.closest('button[data-loc]'); if (!b) return;
      bsLoc = b.dataset.loc; setInv(false); setLog(false); setSheet(false); resetCam();
      if (window.__panel && __panel.setTab) __panel.setTab(bsLoc); else sync();
    });
    $('#bsUnit').addEventListener('click', () => { if (on && ctx().me) setInv(true, 'Мой герой'); });
    $('#bsUnit').setAttribute('role', 'button');
    $('#bsUnit').setAttribute('title', 'Открыть карточку героя');
    const onBarClick = e => {
      const b = e.target.closest('button[data-i], button[data-ui]'); if (!b || b.disabled) return;
      if (b.dataset.ui === 'inv') return setInv(true);
      if (b.dataset.ui === 'log') return setLog(true);
      if (b.dataset.ui === 'quests') return setSheet('quests');
      if (b.dataset.ui === 'more') return setSheet('more');
      const i = +b.dataset.i, defs = lastDefs[i];
      if (!defs) return;
      if (defs._ui === 'inv') return setInv(true);
      if (defs._ui === 'log') return setLog(true);
      if (defs[2] && window.__bossLeft && __bossLeft(defs[2])) return;
      if (window.PanelActions && PanelActions.activate) PanelActions.activate(defs);
    };
    $('#bsBar').addEventListener('click', onBarClick);
    $('#bsSheet').addEventListener('click', onBarClick);
    document.addEventListener('click', e => {
      if (e.target.closest('[data-bslog]')) { e.preventDefault(); setLog(true); }
      const lf = e.target.closest('[data-bslf]');
      if (lf) { logMine = lf.dataset.bslf === '1'; fillLog(); }
      const fb = e.target.closest('#bs [data-bsfold]');
      if (fb) {
        const k = fb.dataset.bsfold;
        if (k === 'loc' || k === 'bar' || k === 'feed') {
          e.preventDefault();
          fold[k] = !fold[k];
          try { localStorage.setItem(FOLD_KEY, JSON.stringify(fold)); } catch (err) {}
          applyFold();
        }
      }
      const tab = e.target.closest('#bs [data-bstab]');
      if (tab) {
        const id = tab.dataset.bstab;
        if (dockOpen && dockTab === id) dockOpen = false;
        else { dockOpen = true; dockTab = id; }
        applyDock();
      }
    });
    addEventListener('resize', layout);
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', layout);
      visualViewport.addEventListener('scroll', layout);
    }
    document.addEventListener('touchmove', function (e) {
      if (!on) return;
      const ok = e.target.closest && e.target.closest('#bs .dock-pane, #bs .log-body, #bs .inv-body, #bs .sheet-body, #bs .actionbar, #bs .window, #bs .bossbar');
      if (!ok) e.preventDefault();
    }, { passive: false });
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { if (on) layout(); });
      ['bsBoss', 'bsBar', 'bsDock'].forEach(id => { const n = document.getElementById(id); if (n) ro.observe(n); });
    }
    bindZoom();
    tagKind();
  }

  function applyDock() {
    const dock = $('#bsDock');
    if (dock) dock.classList.toggle('collapsed', !dockOpen);
    document.querySelectorAll('#bs [data-bstab]').forEach(x => x.classList.toggle('on', dockOpen && x.dataset.bstab === dockTab));
    const q = $('#bsDockQ'), l = $('#bsDockL');
    if (q) q.classList.toggle('on', dockOpen && dockTab === 'q');
    if (l) l.classList.toggle('on', dockOpen && dockTab === 'l');
    if (on) layout();
  }
  function applyFold() {
    const root = $('#bs'); if (!root) return;
    root.classList.toggle('fold-loc', !!fold.loc);
    root.classList.toggle('fold-bar', !!fold.bar);
    root.classList.toggle('fold-feed', !!fold.feed);
    const lab = { loc: fold.loc ? 'Показать локации' : 'Свернуть локации', bar: fold.bar ? 'Показать кнопки' : 'Свернуть кнопки', feed: fold.feed ? 'Показать журнал' : 'Свернуть журнал' };
    root.querySelectorAll('[data-bsfold]').forEach(b => {
      const k = b.dataset.bsfold, a = lab[k];
      if (a) { b.setAttribute('title', a); b.setAttribute('aria-label', a); }
      if (b.classList.contains('fold-chev')) b.textContent = fold[k] ? '▸' : '▾';
    });
    if (on) layout();
  }

  function enterBtn() {
    const h = document.querySelector('#panel h1');
    if (!h || $('#bsEnter')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'bsEnter'; b.textContent = '🖥 Большой экран';
    b.onclick = () => setOn(true);
    h.appendChild(b);
  }

  const VP_CLASSIC = 'width=device-width,initial-scale=1';
  const VP_BS = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  function setViewport(bs) {
    let m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
    m.setAttribute('content', bs ? VP_BS : VP_CLASSIC);
  }
  function clearBsStyles() {
    const root = document.getElementById('bs');
    if (!root || !root.style) return;
    root.style.top = root.style.right = root.style.bottom = root.style.left = '';
    root.style.width = root.style.height = '';
    root.style.removeProperty('--barsH');
    root.style.removeProperty('--unitH');
    root.style.removeProperty('--bossH');
  }

  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (!on) { undockClassicBars(); setSheet(false); clearBsStyles(); }
    document.body.classList.toggle('bs-on', on);
    document.documentElement.classList.toggle('bs-on', on);
    setViewport(on);
    if (on) { actorTween = { loc: '', nodes: Object.create(null), raf: 0, lastAt: 0 }; mount(); applyDock(); applyFold(); const t = window.__panel && __panel.tab; if (t && t !== 'me') bsLoc = t; else if (__panel && __panel.state && __panel.state.me && __panel.state.me.loc) bsLoc = __panel.state.me.loc; sync(); }
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
    if (l === 'boss' && st && st.boss && st.boss.lair && /^boss_[a-z0-9_]{1,24}$/.test(st.boss.lair)) return 'img/' + st.boss.lair + '.jpg?v=bs518';
    return 'img/' + (l || 'camp') + '.jpg?v=bs518';
  }

  let lastDefs = [], lastMore = [], sheetKind = '', tipCmds = new Set();

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

  function btnHtml(d, i, more) {
    const ic = d[0] || '•', lab = d[1] || '', sub = d[4] || '', dis = !!d[6], other = d[7] === 'other';
    const ui = d._ui || '';
    const cmd = ui ? '' : (d[2] || '');
    const left = cmd && window.__bossLeft ? __bossLeft(cmd) : 0;
    const tab = (window.__panel && __panel.tab) || bsLoc;
    const off = dis || left;
    const tip = !off && tipCmds.has(cmd);
    const cls = (more ? 'more-btn' : '') + (off ? ' dis' + (left ? ' bcd' : '') : '') + (tip ? ' tip-hot' : '');
    const bc = cmd ? ` data-bc="${esc(cmd)}" data-sub="${esc(sub)}" data-en="${dis ? 0 : 1}"` : '';
    const uiA = ui ? ` data-ui="${esc(ui)}"` : '';
    const subTxt = left ? ('⏳ откат ' + left + ' с') : sub;
    return `<button type="button" data-i="${i}"${uiA}${bc} class="${cls.trim()}"${off ? ' disabled' : ''}>`
      + (other && !more ? `<span class="grp">не твой класс</span>` : '')
      + `<span class="ic">${ic}</span><span class="lbl">${esc(lab)}</span>`
      + (subTxt ? `<small class="sub">${esc(subTxt)}</small>` : '') + `</button>`;
  }
  function splitPhoneBar(defs, kind) {
    const quest = { _ui: 'quests', 0: '📋', 1: 'Задания', 4: '' };
    const more = { _ui: 'more', 0: '⋯', 1: 'Ещё', 4: '' };
    const isUi = d => d._ui === 'inv' || d._ui === 'log';
    const isOther = d => d[7] === 'other';
    const ui = defs.filter(isUi);
    const others = defs.filter(d => !isUi(d) && isOther(d));
    const important = defs.filter(d => !isUi(d) && !isOther(d));
    const inBoss = bsLoc === 'boss';
    const special = inBoss ? ui : [quest].concat(ui);
    const cap = kind === 'phone-l' ? 9 : 8;
    const reserved = special.length + 1;
    const room = Math.max(1, cap - reserved);
    const shown = important.slice(0, room);
    const rest = important.slice(room).concat(others);
    if (!inBoss) { /* quest already in special */ }
    else rest.unshift(quest);
    const main = shown.concat(special);
    if (rest.length) main.push(more);
    return { main, more: rest };
  }
  function fillBar(c, tips) {
    const defs = barDefs(c);
    lastDefs = defs;
    tipCmds = new Set((tips || collectTips(c)).map(x => x.cmd).filter(Boolean));
    const kind = layoutKind();
    const phone = kind === 'phone-p' || kind === 'phone-l';
    const split = phone ? splitPhoneBar(defs, kind) : { main: defs, more: [] };
    lastMore = split.more;
    $('#bsLocbar').innerHTML = LOCS.map(l => `<button type="button" data-loc="${l[0]}"${l[0] === bsLoc ? ' class="on"' : ''}><span class="ic">${l[1]}</span><span class="lbl">${l[2]}</span></button>`).join('');
    $('#bsBar').innerHTML = split.main.map(d => btnHtml(d, d._ui ? -1 : defs.indexOf(d), false)).join('');
    if (sheetKind) fillSheet();
  }

  function collectTips(c) {
    const me = c && c.me, ref = (c && c.ref) || {}, tips = [];
    if (!me) return tips;
    if (!ref.tb) {
      const nm = ref.trn || 'Сделать ход';
      tips.push({ id: 'turn', cmd: 'ход', kind: 'warn', icon: '🎲', text: 'Прожмите награду «' + nm + '» в чате Twitch' });
    }
    const b = me.bed;
    if (b) {
      if (b.eaten) tips.push({ id: 'bed', cmd: 'грядка', kind: 'warn', icon: '💀', text: b.txt || 'грядку съели' });
      else if (b.bugs) tips.push({ id: 'bed', cmd: 'жуки', kind: 'warn', icon: '🐞', text: b.txt || 'на грядке жуки — отгоните' });
      else if (b.st === 2) tips.push({ id: 'bed', cmd: 'собрать', kind: 'ok', icon: '🧺', text: b.txt || 'урожай готов — соберите' });
      else tips.push({ id: 'bed', cmd: 'грядка', kind: 'info', icon: '⏳', text: b.txt || 'грядка растёт' });
    }
    return tips;
  }
  function fillTips(tips) {
    const el = $('#bsTips'); if (!el) return;
    if (!tips || !tips.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = tips.map(t => '<div class="tip ' + esc(t.kind || '') + '">' + esc((t.icon ? t.icon + ' ' : '') + (t.text || '')) + '</div>').join('');
  }
  function setSheet(kind) {
    const ov = $('#bsSheet'); if (!ov) { sheetKind = ''; return; }
    if (!kind) { ov.hidden = true; sheetKind = ''; return; }
    setInv(false); setLog(false);
    if (sheetKind === kind && !ov.hidden) { ov.hidden = true; sheetKind = ''; return; }
    sheetKind = kind;
    ov.hidden = false;
    fillSheet();
  }
  function fillSheet() {
    const title = $('#bsSheetTitle'), body = $('#bsSheetBody'); if (!title || !body) return;
    if (sheetKind === 'quests') {
      title.textContent = 'Задания';
      const rows = questLis(ctx());
      body.innerHTML = rows.length ? `<ul class="qlist">${rows.join('')}</ul>` : '<div class="muted">сейчас нет заданий</div>';
    } else {
      title.textContent = 'Ещё';
      const rows = lastMore.map(d => btnHtml(d, d._ui ? -1 : lastDefs.indexOf(d), true)).join('');
      body.innerHTML = rows || '<div class="muted">пусто</div>';
    }
  }

  function sprFromMe(me) {
    if (!me) return '';
    return sprUrl([me.n, 0, 0, me.cls, me.lv, me.mode || me.st, me.k6, me.hair, me.dy || '']);
  }
  const HEAD_OK = new WeakMap();
  function paintHead(cv, src) {
    if (!cv || !src) return;
    if (HEAD_OK.get(cv) === src && cv.width) return;
    const box = cv.parentElement, css = Math.max(40, (box && box.clientWidth) || 76);
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const S = Math.round(css * dpr);
    const img = new Image();
    img.onload = function () {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d'); tctx.drawImage(img, 0, 0);
      // только верхние ~30% (голова); иначе широкий щит/плащ уводит кадр на грудь
      let top = 0;
      const full = tctx.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++) { let hit = 0; for (let x = 0; x < w; x++) if (full[(y * w + x) * 4 + 3] > 18) { hit = 1; break; } if (hit) { top = y; break; } }
      const band = Math.max(8, Math.floor(h * 0.30));
      const y1 = Math.min(h, top + band);
      let minx = w, miny = h, maxx = 0, maxy = 0, found = 0;
      for (let y = top; y < y1; y++) for (let x = 0; x < w; x++) {
        if (full[(y * w + x) * 4 + 3] > 18) { found = 1; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
      }
      if (!found) { minx = Math.floor(w * 0.2); maxx = Math.floor(w * 0.8); miny = top; maxy = y1; }
      const bw = Math.max(8, maxx - minx + 1), bh = Math.max(8, maxy - miny + 1);
      const side = Math.round(Math.max(bw * 1.2, bh * 1.35, h * 0.32));
      let sx = Math.round((minx + maxx) / 2 - side / 2);
      let sy = Math.max(0, miny - Math.round(side * 0.06));
      if (sx < 0) sx = 0; if (sx + side > w) sx = Math.max(0, w - side);
      if (sy + side > h) sy = Math.max(0, h - side);
      cv.width = S; cv.height = S;
      cv.style.width = css + 'px'; cv.style.height = css + 'px';
      const ctx2 = cv.getContext('2d');
      ctx2.imageSmoothingEnabled = true; ctx2.imageSmoothingQuality = 'high';
      ctx2.clearRect(0, 0, S, S);
      ctx2.drawImage(img, sx, sy, side, side, 0, 0, S, S);
      HEAD_OK.set(cv, src);
    };
    img.onerror = function () { HEAD_OK.delete(cv); };
    img.src = src;
  }
  function fillUnit(c) {
    const me = c.me, el = $('#bsUnit');
    if (!me) { el.innerHTML = '<div class="unit-main"><div class="unit-top"><b>Нет героя</b></div><div class="unit-sub">Сначала вступите в игру</div></div>'; return; }
    const hp = +me.hp || 0, mhp = +me.mhp || 1, xp = +me.xp || 0, xpN = +me.xpN || 1;
    const gtitle = me.gd || GUILD_RU[me.gid] || '';
    el.innerHTML = `<div class="port"><canvas class="hpic big head" width="0" height="0" aria-hidden="true"></canvas></div><div class="unit-main">
      <div class="unit-top"><b>★ ${esc(me.n)}</b><span class="lvl">${esc(me.lv)} ур.</span></div>
      <div class="unit-sub">${esc(me.cn || CLSN[me.cls] || me.cls || '')}${gtitle ? ' · ' + esc(gtitle) : ''}</div>
      <div class="bar hp"><i style="width:${Math.max(0, Math.min(100, hp / mhp * 100))}%"></i><span>HP ${hp}/${mhp}</span></div>
      <div class="bar xp"><i style="width:${Math.max(0, Math.min(100, xp / xpN * 100))}%"></i><span>Опыт ${xp}/${xpN}</span></div>
      <div class="unit-res"><span>🪙 ${esc(me.gold || 0)}</span><span>🧪 ${esc(me.pot || 0)}</span><span>🍲 ${esc(me.food || 0)}</span></div>
    </div>`;
    paintHead(el.querySelector('canvas'), sprFromMe(me));
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

  // v49.10: в снимке пульта t[5] === 'sleep', если в игре rt.mode === 'sleep' (герой в палатке, в OBS не рисуется).
  // Координаты спящих — вход в палатку Золотого колоса (TENTS.door 1680,600). Дополнительно: ключ спрайта *_sit.
  function isSleeping(t) { return !t ? false : t[5] === 'sleep' || /_sit$/.test(String(t[6] || '')); }
  const TENT_DOOR = [1680, 600];
  function inTentZone(x, y) { return y < 980 || Math.hypot(x - TENT_DOOR[0], y - TENT_DOOR[1]) < 280; }
  const CAMP_FLOOR = [];
  [1080, 1160, 1240, 1320].forEach(y => { for (let x = 480; x <= 2280; x += 200) CAMP_FLOOR.push([x, y]); });
  function spreadVisible(list, loc) {
    const out = list.map(t => t.slice()), minD = loc === 'camp' ? 170 : 150;
    const slots = loc === 'camp' ? CAMP_FLOOR : null;
    const near = (x, y, arr) => arr.some(o => Math.hypot(x - o[1], y - o[2]) < minD);
    const bad = t => (loc === 'camp' && inTentZone(+t[1], +t[2]));
    // сначала оставляем тех, кто уже на свободном месте (чтобы увод от палатки их не сдвигал)
    const kept = [];
    out.forEach(t => { if (!bad(t) && !near(+t[1], +t[2], kept)) kept.push(t); });
    const blocked = (x, y) => (loc === 'camp' && inTentZone(x, y)) || near(x, y, kept);
    out.forEach(t => {
      if (kept.includes(t)) return;
      let x = +t[1], y = +t[2];
      if (slots) {
        let best = null, bd = 1e9;
        for (const s of slots) {
          if (blocked(s[0], s[1])) continue;
          const d = Math.hypot(s[0] - x, s[1] - y);
          if (d < bd) { bd = d; best = s; }
        }
        if (best) { t[1] = best[0]; t[2] = best[1]; }
      } else if (kept.length) {
        let ox = 0, oy = 0, n = 0;
        kept.forEach(o => { const d = Math.hypot(x - o[1], y - o[2]) || 1; if (d < minD) { ox += (x - o[1]) / d; oy += (y - o[2]) / d; n++; } });
        if (n) { const k = (minD + 10) / Math.max(0.2, Math.hypot(ox, oy)); t[1] = Math.round(x + ox * k); t[2] = Math.round(y + oy * k); }
      }
      kept.push(t);
    });
    return out;
  }
  function locActors(st, l) {
    let list = ((st && st.locs && st.locs[l]) || []).filter(t => !isSleeping(t)).map(t => t.slice()).sort((a, b) => a[2] - b[2] || a[1] - b[1]);
    const fight = l === 'boss' && st && st.boss && st.boss.ph === 'fight';
    if (fight) return layoutBossHeroes(list, lairSpotOf(st));
    return spreadVisible(list, l);
  }

  const FOREST_GAP = 280, TWEEN_JUMP = 420;

  function mobFlip(id) {
    const src = (window.C && window.C.monFacesRight) || (window.CFG && window.CFG.monFacesRight) || (window.CONFIG && window.CONFIG.monFacesRight) || [];
    return Array.isArray(src) && src.indexOf(id) >= 0;
  }
  function mobMeta(id, name) {
    return { id, name: name || MOB_RU[id] || id, h: MOB_H[id] || 140, group: MOB_GROUP[id] || 1, flip: mobFlip(id) };
  }
  function forestMobs(st, list, meName) {
    const out = [];
    const names = {};
    const fm = st && st.me && st.me.fm;
    if (fm && fm[0]) names[fm[0]] = fm[1] || names[fm[0]];
    const raw = st && Array.isArray(st.mobs) ? st.mobs : [];
    if (raw.length) {
      raw.forEach(m => { if (m && m[0]) out.push(Object.assign(mobMeta(m[0], names[m[0]]), { x: +m[1], y: +m[2], hp: m[3] })); });
      return out;
    }
    const seen = new Set();
    for (const t of list) {
      const id = t[12]; if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(Object.assign(mobMeta(id, names[id]), { x: +t[1] + FOREST_GAP, y: +t[2], hp: t[13] }));
    }
    if (fm && fm[0] && !seen.has(fm[0])) {
      const me = list.find(t => String(t[0]).toLowerCase() === meName) || list[0];
      const hx = me ? +me[1] : 900, hy = me ? +me[2] : 970;
      const hp = fm[3] ? Math.round((+fm[2] || 0) / (+fm[3] || 1) * 100) : null;
      out.push(Object.assign(mobMeta(fm[0], fm[1]), { x: hx + FOREST_GAP, y: hy, hp }));
    }
    return out;
  }
  function mobSrc(id) {
    if (id === 'mimic') return 'img/mob/mimic.png';
    return 'img/mob/' + id + '.png';
  }
  function mobSrcFb(id) { return id === 'mimic' ? '' : 'img/mob/' + id + '.webp'; }
  function actorNow(it) {
    if (!it.from || !it.start) return { x: it.x, y: it.y };
    const u = Math.min(1, (performance.now() - it.start) / (it.dur || 1));
    if (u >= 1) { it.from = null; return { x: it.x, y: it.y }; }
    const e = u * u * (3 - 2 * u);
    return { x: it.from.x + (it.x - it.from.x) * e, y: it.from.y + (it.y - it.from.y) * e };
  }
  function applyActorPos(it) {
    const p = actorNow(it);
    it.el.style.left = p.x + 'px';
    it.el.style.top = p.y + 'px';
    it.el.style.zIndex = Math.round(p.y);
    const moving = !!(it.from && (performance.now() - it.start) < (it.dur || 0));
    it.el.classList.toggle('walk', moving && it.kind === 'hero');
  }
  function tickActors() {
    actorTween.raf = 0;
    let more = false;
    const now = performance.now();
    Object.keys(actorTween.nodes).forEach(k => {
      const it = actorTween.nodes[k];
      applyActorPos(it);
      if (it.from && (now - it.start) < (it.dur || 0)) more = true;
      else if (it.from) { it.from = null; it.el.classList.remove('walk'); }
    });
    if (more) actorTween.raf = requestAnimationFrame(tickActors);
  }
  function moveActor(it, x, y, snap, dur) {
    const cur = actorNow(it);
    it.x = x; it.y = y;
    if (snap || Math.hypot(x - cur.x, y - cur.y) > TWEEN_JUMP) {
      it.from = null; it.el.classList.remove('walk'); applyActorPos(it); return;
    }
    if (Math.hypot(x - cur.x, y - cur.y) < 1) { it.from = null; applyActorPos(it); return; }
    it.from = { x: cur.x, y: cur.y }; it.start = performance.now(); it.dur = dur;
    applyActorPos(it);
    if (!actorTween.raf) actorTween.raf = requestAnimationFrame(tickActors);
  }

  function fillActors(c) {
    const box = $('#bsActors'), st = c.state, l = bsLoc;
    if (!box) return;
    const meName = c.user && c.user.login ? String(c.user.login).toLowerCase() : (c.me && String(c.me.n).toLowerCase()) || '';
    let list = locActors(st, l);
    const Lair = (l === 'boss' && st && st.boss) ? lairSpotOf(st) : null;
    const faceRight = l !== 'camp';
    const now = performance.now();
    const dur = Math.max(500, Math.min(1500, actorTween.lastAt ? (now - actorTween.lastAt) : 1000));
    const snapAll = actorTween.loc !== l;
    if (snapAll) {
      box.innerHTML = '';
      actorTween.nodes = Object.create(null);
      actorTween.loc = l;
    }
    actorTween.lastAt = now;
    const seen = new Set();

    for (const t of list) {
      const key = 'h:' + t[0], n = t[0], cls = t[3], lv = t[4], k6 = t[6] || '';
      seen.add(key);
      const mine = String(n).toLowerCase() === meName;
      const g = (k6.split('_')[0] || t[11] || 'none');
      const flip = faceRight ? false : +t[1] > 1280;
      const src = sprUrl(t), fb = sprFb(t);
      const cn = CLSN[cls] || cls || '';
      const hs = t._hs || 1;
      let it = actorTween.nodes[key];
      const gtitle = GUILD_RU[g] || '';
      const nameHtml = '<i class="gmark" title="' + esc(gtitle ? ('Гильдия: ' + gtitle) : 'без гильдии') + '"></i>'
        + (mine ? '★ ' : '') + '<span class="nick">' + esc(n) + '</span>'
        + '<small>' + esc(cn) + (lv != null && lv !== '' ? ' · ' + esc(lv) : '') + (gtitle ? ' · ' + esc(gtitle) : '') + '</small>';
      if (!it) {
        const el = document.createElement('div');
        el.className = 'hero g-' + g + (mine ? ' me' : '') + (flip ? ' flip' : '');
        el.dataset.n = n;
        el.dataset.cls = cls || '';
        el.style.setProperty('--hs', hs);
        el.innerHTML = '<div class="shadow"></div><div class="ring"></div>'
          + (src ? '<img alt="">' : '')
          + '<div class="name">' + nameHtml + '</div>';
        const img = el.querySelector('img');
        if (img) {
          img.src = src;
          img.onerror = (fb && fb !== src) ? function () { img.onerror = null; img.src = fb; } : function () { img.remove(); };
        }
        box.appendChild(el);
        it = actorTween.nodes[key] = { el, kind: 'hero', x: +t[1], y: +t[2], from: null };
        applyActorPos(it);
      } else {
        it.el.className = 'hero g-' + g + (mine ? ' me' : '') + (flip ? ' flip' : '') + (it.el.classList.contains('walk') ? ' walk' : '') + (it.el.classList.contains('lunge') ? ' lunge' : '') + (it.el.classList.contains('hit') ? ' hit' : '');
        it.el.dataset.cls = cls || '';
        it.el.style.setProperty('--hs', hs);
        const img = it.el.querySelector('img');
        if (src && img && img.getAttribute('src') !== src) img.src = src;
        const nm = it.el.querySelector('.name');
        if (nm) nm.innerHTML = nameHtml;
        moveActor(it, +t[1], +t[2], snapAll, dur);
      }
    }

    if (l === 'forest') {
      forestMobs(st, list, meName).forEach(m => {
        const key = 'm:' + m.id;
        seen.add(key);
        const hp = m.hp, mh = m.h || MOB_H[m.id] || 140, grp = m.group || 1;
        const nm = m.name || MOB_RU[m.id] || m.id;
        let it = actorTween.nodes[key];
        const packHtml = function () {
          const n = Math.max(1, grp);
          const offs = n > 1 ? MOB_PACK.slice(-n) : [[0, 0, 1]];
          return offs.map((o, i) => {
            const img = '<img class="p' + i + '" alt="" style="--ox:' + o[0] + ';--oy:' + o[1] + ';--sc:' + o[2] + '">';
            return img;
          }).join('');
        };
        const bindImg = function (img) {
          const src = mobSrc(m.id), fb = mobSrcFb(m.id);
          img.src = src;
          img.onerror = (fb && fb !== src) ? function () { img.onerror = function () { img.remove(); }; img.src = fb; } : function () { img.remove(); };
          img.onload = function () {
            const natW = img.naturalWidth || 1, natH = img.naturalHeight || 1;
            const mw = Math.round(mh * natW / natH);
            img.parentElement && img.parentElement.style.setProperty('--mw', mw + 'px');
          };
        };
        if (!it) {
          const el = document.createElement('div');
          el.className = 'mob' + (grp > 1 ? ' pack' : '') + (m.flip ? ' flip' : '');
          el.dataset.id = m.id;
          el.style.setProperty('--mh', mh + 'px');
          el.innerHTML = packHtml()
            + '<div class="mname">' + esc(nm) + '</div>'
            + (hp != null ? '<div class="mhp bar hp"><i style="width:' + Math.max(0, Math.min(100, +hp)) + '%"></i><span>' + esc(hp) + '%</span></div>' : '');
          el.querySelectorAll('img').forEach(bindImg);
          box.appendChild(el);
          it = actorTween.nodes[key] = { el, kind: 'mob', x: +m.x, y: +m.y, from: null };
          applyActorPos(it);
        } else {
          it.el.classList.toggle('flip', !!m.flip);
          it.el.classList.toggle('pack', grp > 1);
          it.el.style.setProperty('--mh', mh + 'px');
          const bar = it.el.querySelector('.mhp i'), sp = it.el.querySelector('.mhp span');
          if (bar && hp != null) bar.style.width = Math.max(0, Math.min(100, +hp)) + '%';
          if (sp && hp != null) sp.textContent = hp + '%';
          const lab = it.el.querySelector('.mname'); if (lab) lab.textContent = nm;
          moveActor(it, +m.x, +m.y, snapAll, dur);
        }
      });
    }

    if (l === 'boss' && st && st.boss && st.boss.ph === 'fight' && st.boss.key) {
      const id = st.boss.key, src = bossSrc(id), flip = !!BOSS_MIRROR[id];
      const flt = /^[a-z0-9().,\s-]*$/i.test(st.boss.flt || '') && st.boss.flt ? ' filter:' + esc(st.boss.flt) + ';' : '';
      const h = Lair ? Lair.h : (/treant/.test(id) ? 500 : 460);
      const bx = Lair ? Lair.boss[0] : 2040, by = Lair ? Lair.boss[1] : 1140;
      const key = 'boss';
      seen.add(key);
      let it = actorTween.nodes[key];
      if (!it) {
        const el = document.createElement('div');
        el.className = 'mob boss' + (flip ? ' flip' : '');
        el.innerHTML = '<img alt="" style="height:' + h + 'px;' + flt + '" onerror="this.remove()"><div class="mname">' + esc(st.boss.name || '') + '</div>';
        const img = el.querySelector('img'); if (img) img.src = src;
        box.appendChild(el);
        it = actorTween.nodes[key] = { el, kind: 'boss', x: bx, y: by, from: null };
        applyActorPos(it);
      } else {
        it.el.classList.toggle('flip', !!flip);
        const img = it.el.querySelector('img');
        if (img) { if (img.getAttribute('src') !== src) img.src = src; img.style.height = h + 'px'; if (flt) img.style.cssText += flt; }
        const nm = it.el.querySelector('.mname'); if (nm) nm.textContent = st.boss.name || '';
        moveActor(it, bx, by, true, dur);
      }
    }

    Object.keys(actorTween.nodes).forEach(k => {
      if (!seen.has(k)) { actorTween.nodes[k].el.remove(); delete actorTween.nodes[k]; }
    });

    $('#bsBg').src = bgOf(l, st);
    $('#bs').dataset.view = l;
    const chip = $('#bsChip'); if (chip) chip.textContent = '';
    ingestFx(st, l);
  }

  const seenFx = new Set();
  let inferMem = { hp: null, gold: null, lastLunge: 0 };
  function spawnFloat(x, y, text, color, size) {
    const layer = $('#bsFx'); if (!layer || text == null || text === '') return;
    const el = document.createElement('div');
    el.className = 'fx';
    el.textContent = String(text);
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.color = color || '#fff';
    el.style.fontSize = (size || 28) + 'px';
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, 1700);
  }
  function pulse(sel, cls, ms) {
    const el = typeof sel === 'string' ? (actorTween.nodes[sel] && actorTween.nodes[sel].el) : sel;
    if (!el) return;
    el.classList.add(cls);
    clearTimeout(el._t && el._t[cls]);
    el._t = el._t || {};
    el._t[cls] = setTimeout(function () { el.classList.remove(cls); }, ms || 400);
  }
  function ingestFx(st, loc) {
    const pack = st && st.fx;
    if (pack && Array.isArray(pack.ev)) {
      pack.ev.forEach(function (e) {
        const id = e && e[0]; if (id == null || seenFx.has(id)) return;
        seenFx.add(id);
        if (seenFx.size > 240) { const k = [...seenFx]; k.slice(0, 80).forEach(x => seenFx.delete(x)); }
        const eloc = e[3];
        if (eloc && eloc !== loc && eloc !== 'all') return;
        spawnFloat(e[4], e[5], e[6], e[7], e[8]);
      });
    }
    if (pack && Array.isArray(pack.an)) {
      pack.an.forEach(function (a) {
        const who = a[0], kind = a[1];
        const it = actorTween.nodes['h:' + who] || actorTween.nodes['m:' + who];
        if (!it) return;
        if (kind === 'l') pulse(it.el, 'lunge', 280);
        else if (kind === 'h' || kind === 'mh') pulse(it.el, 'hit', 220);
        else if (kind === 'ma') pulse(it.el, 'atk', 700);
        else if (kind === 'd' || kind === 'md') it.el.classList.add('dying');
      });
    } else {
      inferCombat(st, loc);
    }
  }
  function inferCombat(st, loc) {
    const me = st && st.me; if (!me || loc !== 'forest') return;
    const node = actorTween.nodes['h:' + me.n] || actorTween.nodes['h:' + String(me.n || '').toLowerCase()];
    const mobId = me.fm && me.fm[0];
    const mnode = mobId && actorTween.nodes['m:' + mobId];
    const hx = node ? node.x : 900, hy = node ? node.y : 970;
    const mx = mnode ? mnode.x : hx + 280, my = mnode ? mnode.y : hy;
    if (inferMem.hp != null && me.hp < inferMem.hp) {
      spawnFloat(hx - 20, hy - 90, '-' + (inferMem.hp - me.hp), '#ff7a6a', 30);
      if (node) pulse(node.el, 'hit', 220);
      if (mnode) pulse(mnode.el, 'atk', 700);
    }
    if (inferMem.gold != null && me.gold > inferMem.gold) spawnFloat(hx, hy - 140, '+' + (me.gold - inferMem.gold) + ' 💰', '#ffd27a', 32);
    inferMem.hp = me.hp; inferMem.gold = me.gold;
  }

  function vpSize() {
    const vv = window.visualViewport;
    if (vv && vv.width && vv.height) return { w: vv.width, h: vv.height, x: vv.offsetLeft || 0, y: vv.offsetTop || 0 };
    return { w: innerWidth, h: innerHeight, x: 0, y: 0 };
  }
  function isPhoneDev() {
    const v = vpSize(), minS = Math.min(v.w, v.h), maxS = Math.max(v.w, v.h);
    let coarse = false, noHover = false;
    try { coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches); } catch (e) {}
    try { noHover = !!(window.matchMedia && matchMedia('(hover: none)').matches); } catch (e) {}
    if ((coarse || noHover) && minS <= 720) return true;
    if (minS <= 520) return true;
    if (maxS <= 980 && minS <= 600) return true;
    return false;
  }
  function layoutKind() {
    const v = vpSize(), w = v.w, h = v.h;
    if (isPhoneDev()) return h > w ? 'phone-p' : 'phone-l';
    if (w <= 520 && h > w) return 'phone-p';
    if (h <= 500 && w > h) return 'phone-l';
    return 'pc';
  }
  function tagKind() {
    const root = $('#bs'); if (!root) return;
    const k = layoutKind();
    root.classList.remove('phone-p', 'phone-l', 'pc');
    root.classList.add(k);
  }

  let camZ = 1, camPX = 0, camPY = 0, camFX = null, camFY = null, zMinCur = 1;
  const ZMAX = 3;
  function resetCam() { camZ = 1; camPX = 0; camPY = 0; camFX = null; camFY = null; }
  function zoomLabel(z) {
    if (Math.abs(z - 1) < 0.02) return '1×';
    const r = Math.round(z * 10) / 10;
    return (Math.abs(r - Math.round(r)) < 0.05 ? String(Math.round(r)) : r.toFixed(1)) + '×';
  }
  function setCamZ(z, fx, fy) {
    z = Math.max(zMinCur, Math.min(ZMAX, z));
    if (fx != null) camFX = fx;
    if (fy != null) camFY = fy;
    camZ = z;
    const lab = $('#bsZoom [data-z="reset"]');
    if (lab) lab.textContent = zoomLabel(camZ);
  }
  function snapIfDefault() {
    if (Math.abs(camZ - 1) < 0.03) {
      camZ = 1; camPX = 0; camPY = 0; camFX = null; camFY = null;
      const lab = $('#bsZoom [data-z="reset"]');
      if (lab) lab.textContent = '1×';
    }
  }
  function canPan() {
    return camZ > zMinCur + 0.02 && Math.abs(camZ - 1) > 0.02;
  }
  function meActor(st, l) {
    const list = locActors(st, l);
    const c = ctx();
    const meName = (c.user && c.user.login ? String(c.user.login) : (c.me && c.me.n) || '').toLowerCase();
    return list.find(t => String(t[0]).toLowerCase() === meName) || list[0] || null;
  }
  function clampCam(ox, oy, s, vw, vh) {
    const minOx = vw - W * s, maxOx = 0, minOy = vh - H * s, maxOy = 0;
    ox = minOx <= maxOx ? Math.max(minOx, Math.min(maxOx, ox)) : (vw - W * s) / 2;
    oy = minOy <= maxOy ? Math.max(minOy, Math.min(maxOy, oy)) : (vh - H * s) / 2;
    return [ox, oy];
  }
  function updateBossHint(s, ox, oy, vw, vh, st) {
    const el = $('#bsHint'); if (!el) return;
    const fight = bsLoc === 'boss' && st && st.boss && st.boss.ph === 'fight' && layoutKind() === 'phone-p';
    if (!fight) { el.hidden = true; return; }
    const L = lairSpotOf(st), bx = L.boss[0], by = L.boss[1] - (L.h || 460) * 0.45;
    const sx = ox + bx * s, sy = oy + by * s;
    const m = 36;
    if (sx > m && sx < vw - m && sy > m && sy < vh - m) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = (sx >= vw / 2 ? '► Босс' : '◄ Босс');
    el.style.left = Math.max(44, Math.min(vw - 44, sx)) + 'px';
    el.style.top = Math.max(80, Math.min(vh - 110, sy)) + 'px';
  }
  function layout() {
    if (!on) return;
    const root = $('#bs'), wrap = $('#bsWrap'), scene = $('#bsScene'); if (!root || !wrap || !scene) return;
    const kind = layoutKind();
    if (layout._kind && layout._kind !== kind) { layout._kind = kind; try { fillBar(ctx()); } catch (e) {} }
    layout._kind = kind;
    root.classList.remove('phone-p', 'phone-l', 'pc');
    root.classList.add(kind);
    const v = vpSize();
    const bars = $('.bars-wrap', root);
    root.style.setProperty('--barsH', (((bars && bars.offsetHeight) || 110) + 8) + 'px');
    root.classList.toggle('short', kind === 'pc' && vpSize().h <= 860);
    if (kind === 'pc') {
      root.style.top = root.style.right = root.style.bottom = root.style.left = '';
      root.style.width = root.style.height = '';
    } else {
      root.style.top = v.y + 'px';
      root.style.left = v.x + 'px';
      root.style.width = v.w + 'px';
      root.style.height = v.h + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
    }
    wrap.style.height = '';
    const wr = wrap.getBoundingClientRect();
    const vw = wr.width, vh = wr.height;
    const st = window.__panel && __panel.state;
    let s, ox, oy;
    if (kind === 'phone-p') {
      const bars = $('.bars-wrap', root);
      const unit = $('.unitframe', root);
      const boss = $('#bsBoss');
      const barsH = (bars && bars.offsetHeight) || 110;
      const unitH = (unit && unit.offsetHeight) || 64;
      const bossH = (boss && !boss.hidden) ? boss.offsetHeight : 0;
      root.style.setProperty('--barsH', (barsH + 8) + 'px');
      root.style.setProperty('--unitH', unitH + 'px');
      root.style.setProperty('--bossH', bossH + 'px');
      const me = meActor(st, bsLoc);
      const hx = me ? +me[1] : W / 2, hy = me ? +me[2] : Math.round(H * 0.72);
      const topSafe = 8 + unitH + (bossH ? bossH + 8 : 0);
      const botSafe = 8 + barsH;
      const feetTarget = Math.min(vh - botSafe - 20, vh * 0.72);
      const sFit = Math.max(vw / W, vh / H);
      const sFeet = (H - hy) > 8 ? (vh - feetTarget) / (H - hy) : sFit;
      s = Math.max(sFit, sFeet);
      ox = vw / 2 - hx * s;
      oy = feetTarget - hy * s;
      [ox, oy] = clampCam(ox, oy, s, vw, vh);
      updateBossHint(s, ox, oy, vw, vh, st);
    } else if (kind === 'phone-l') {
      // на весь экран без боковых полей: cover, чуть обрезая край сцены
      s = Math.max(vw / W, vh / H);
      ox = (vw - W * s) / 2;
      oy = (vh - H * s) / 2;
      [ox, oy] = clampCam(ox, oy, s, vw, vh);
    } else {
      s = Math.min(vw / W, vh / H);
      ox = (vw - W * s) / 2;
      oy = (vh - H * s) / 2;
    }
    const sContain = Math.min(vw / W, vh / H) || 1;
    zMinCur = Math.min(1, s > 1e-6 ? sContain / s : 1);
    if (camZ < zMinCur) camZ = zMinCur;
    if (camZ > ZMAX) camZ = ZMAX;
    const s0 = s, ox0 = ox, oy0 = oy;
    if (Math.abs(camZ - 1) > 0.001) {
      const fx = camFX != null ? camFX : vw / 2;
      const fy = camFY != null ? camFY : (kind === 'phone-p' ? Math.min(vh * 0.72, vh - 40) : vh / 2);
      const sx = (fx - ox0) / (s0 || 1);
      const sy = (fy - oy0) / (s0 || 1);
      s = s0 * camZ;
      ox = fx - sx * s + camPX;
      oy = fy - sy * s + camPY;
      [ox, oy] = clampCam(ox, oy, s, vw, vh);
    }
    updateBossHint(s, ox, oy, vw, vh, st);
    scene.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + s + ')';
    clipNames();
    const zlab = $('#bsZoom [data-z="reset"]');
    if (zlab && !zlab.matches(':active')) zlab.textContent = zoomLabel(camZ);
  }

  function bindZoom() {
    const wrap = $('#bsWrap'), ctl = $('#bsZoom');
    if (!wrap || wrap._zoomBound) return;
    wrap._zoomBound = true;
    let pinch = null, pan = null, lastTap = 0, lastTapX = 0, lastTapY = 0;
    const pt = (t, r) => ({ x: t.clientX - r.left, y: t.clientY - r.top });
    function zoomAt(next, fx, fy) {
      const r = wrap.getBoundingClientRect();
      const vw = r.width, vh = r.height;
      const scene = $('#bsScene'); if (!scene) return;
      const cur = scene.style.transform;
      // use last layout base via cam, then set
      setCamZ(next, fx, fy);
      layout();
    }
    if (ctl) ctl.addEventListener('click', e => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      const r = wrap.getBoundingClientRect();
      const cx = r.width / 2, cy = r.height / 2;
      if (b.dataset.z === 'in') { zoomAt(camZ * 1.25, cx, cy); snapIfDefault(); layout(); }
      else if (b.dataset.z === 'out') { zoomAt(camZ / 1.25, cx, cy); snapIfDefault(); layout(); }
      else { resetCam(); layout(); }
    });
    wrap.addEventListener('wheel', e => {
      if (!on) return;
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const fx = e.clientX - r.left, fy = e.clientY - r.top;
      const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(camZ * k, fx, fy);
      snapIfDefault();
      layout();
    }, { passive: false });
    function onTouchStart(e) {
      if (!on) return;
      const r = wrap.getBoundingClientRect();
      if (e.touches.length >= 2) {
        e.preventDefault();
        const a = pt(e.touches[0], r), b = pt(e.touches[1], r);
        pinch = { z: camZ, px: camPX, py: camPY, d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        pan = null;
      } else if (e.touches.length === 1 && canPan()) {
        const a = pt(e.touches[0], r);
        pan = { x: a.x, y: a.y, px: camPX, py: camPY };
        pinch = null;
      }
    }
    function onTouchMove(e) {
      if (!on) return;
      const r = wrap.getBoundingClientRect();
      if (e.touches.length >= 2) {
        e.preventDefault();
        const a = pt(e.touches[0], r), b = pt(e.touches[1], r);
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (!pinch) {
          pinch = { z: camZ, px: camPX, py: camPY, d: d, mx: mx, my: my };
          pan = null;
          return;
        }
        camPX = pinch.px + (mx - pinch.mx);
        camPY = pinch.py + (my - pinch.my);
        setCamZ(pinch.z * (d / pinch.d), mx, my);
        layout();
      } else if (e.touches.length === 1 && pan && canPan()) {
        e.preventDefault();
        const a = pt(e.touches[0], r);
        camPX = pan.px + (a.x - pan.x);
        camPY = pan.py + (a.y - pan.y);
        layout();
      }
    }
    function onTouchEnd(e) {
      if (e.touches.length < 2) {
        if (pinch) { snapIfDefault(); layout(); }
        pinch = null;
      }
      if (e.touches.length < 1) {
        if (pan) { snapIfDefault(); layout(); }
        pan = null;
      }
    }
    wrap.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
    wrap.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    wrap.addEventListener('touchend', onTouchEnd, { capture: true });
    wrap.addEventListener('touchcancel', onTouchEnd, { capture: true });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => {
      wrap.addEventListener(ev, e => { if (on) e.preventDefault(); }, { passive: false });
    });
    wrap.addEventListener('click', e => {
      if (e.target !== wrap && e.target !== $('#bsScene') && e.target !== $('#bsBg') && !(e.target && e.target.classList && (e.target.classList.contains('bg') || e.target.id === 'bsActors' || e.target.id === 'bsFx' || e.target.id === 'bsGlow'))) {
        /* allow double-tap only on the scene, not on HUD; HUD is outside wrap */
      }
    });
    wrap.addEventListener('pointerdown', e => {
      if (!on || e.pointerType === 'mouse' && e.detail > 1) return;
      if (e.target.closest && e.target.closest('#bsHud, #bsZoom, .overlay, .log-overlay, .window')) return;
    });
    wrap.addEventListener('dblclick', e => {
      if (!on) return;
      if (e.target.closest && e.target.closest('#bsHud, #bsZoom, .overlay, .log-overlay')) return;
      e.preventDefault();
      resetCam(); layout();
    });
    // double-tap for touch (dblclick is unreliable)
    wrap.addEventListener('touchend', e => {
      if (!on || e.touches.length || pinch) return;
      if (e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0], now = Date.now();
      const r = wrap.getBoundingClientRect();
      const x = t.clientX - r.left, y = t.clientY - r.top;
      if (now - lastTap < 300 && Math.hypot(x - lastTapX, y - lastTapY) < 36) {
        lastTap = 0;
        resetCam(); layout();
      } else { lastTap = now; lastTapX = x; lastTapY = y; }
    });
  }

  function clipNames() {
    const wrap = $('#bsWrap'); if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const blockers = ['.unitframe', '.bossbar:not([hidden])', '.bars-wrap', '#bsGoal:not([hidden])', '#bsGoalStrip:not([hidden])', '#bsQuests', '#bsFeed', '.bs-off', '.bs-hint:not([hidden])', '.bs-tips:not([hidden])']
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

  function setInv(show, title) {
    const ov = $('#bsOverlay'); if (!ov) return;
    if (show) { setLog(false); if (sheetKind) setSheet(false); }
    ov.hidden = !show;
    const ht = $('#bsInvTitle');
    if (ht) ht.textContent = title || 'Инвентарь';
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
    if (show) { const inv = $('#bsOverlay'); if (inv) inv.hidden = true; if (sheetKind) setSheet(false); }
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
    const tips = collectTips(c);
    fillUnit(c); fillGoal(c); fillQuests(c); fillFeed(c); fillBoss(c); fillBar(c, tips); fillActors(c); fillTips(tips); applyFold();
    if (!$('#bsOverlay').hidden) setInv(true);
    if (!$('#bsLogOv').hidden) fillLog();
    requestAnimationFrame(() => { layout(); const imgs = [...document.querySelectorAll('#bs img')].filter(i => !i.complete); if (!imgs.length) { layout(); window.__bsReady = true; return; }
      let n = imgs.length; const done = () => { if (--n <= 0) { layout(); window.__bsReady = true; } };
      imgs.forEach(i => { i.addEventListener('load', done); i.addEventListener('error', done); }); });
  }

  window.BigScreen = { sync, setOn, get on() { return on; }, get loc() { return bsLoc; } };

  function boot() {
    enterBtn();
    setViewport(false);
    if (wantOn()) setOn(true);
    if (/[?&]bslog=1/.test(location.search)) setLog(true);
    if (/[?&]bsinv=1/.test(location.search)) setInv(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
