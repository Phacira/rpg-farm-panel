/* v49: заточка +1…+10, Сезон 2, бесплатная смена облика, постройки до 10 ур.
   Модуль дополняет карточку героя, не меняя panel.js. Если игра НЕ прислала данные (me.sh / ref.sharp / ref.season / bld[11]) — ничего не рисует,
   поэтому пульт безопасно работает и со старой игрой (v48.2).
   Демо без сети: ?mock=1&sh=card|dlg|dlgs|ok|fail|max|poor  ·  &season=ann|new|sum|chg  ·  &bv2=1  ·  &rm=1 (раскат огра; можно вместе с cast=1) */
(function () {
  const P = window.__panel; if (!P) return;
  const qs = new URLSearchParams(location.search), mock = qs.get('mock') === '1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SLOT_RU = { weapon: 'оружие', armor: 'броня', offhand: 'левая' }, SLOT_NAME = { weapon: 'Оружие', armor: 'Броня', offhand: 'Левая рука' };
  const MED = { 'Чемпион': '🥇', 'Серебро': '🥈', 'Бронза': '🥉' };
  const st = () => P.state, ref = () => (st() && st().ref) || {}, me = () => st() && st().me;
  const medal = t => { const m = /^(Чемпион|Серебро|Бронза) \d+ сезона/.exec(String(t || '')); return m ? MED[m[1]] : ''; };
  const lvCls = n => n >= 10 ? 'l10' : n >= 8 ? 'l8' : n >= 6 ? 'l6' : 'l1';
  const num = x => Math.round(+x || 0);
  let dlg = null, fcOpen = null, sumOpen = false, lastRes = null, busy = false;

  // ---------- расчёты (по ref.sharp — копия config.sharpen; сервер всё равно проверяет сам) ----------
  const S = () => ref().sharp, hasSh = () => !!(S() && me() && me().sh);
  const lvOf = id => ((me().sh.m || {})[id]) | 0, pityOf = id => ((me().sh.p || {})[id]) | 0;
  const itemName = id => { const e = (ref().eq || []).find(x => x[0] === id); return e ? e[1] : id; };
  function bonusTxt(slot, id, n) {
    const X = S(); if (!n) return 'нет бонуса'; const sum = a => (a || []).slice(0, n).reduce((s, x) => s + x, 0), cnt = a => (a || []).filter(x => x <= n).length;
    if (slot === 'weapon') return `+${sum(X.w)} ${(X.mgI || []).includes(id) ? 'магии' : 'урона'}`;
    if (slot === 'armor') return `+${sum(X.a[0] || X.hp || [])} HP` + (cnt(X.a[1]) ? `, +${cnt(X.a[1])} защиты` : '');
    if ((X.oaI || []).includes(id)) return `+${cnt(X.oa)} ${(X.tmI || []).includes(id) ? 'магии' : 'урона'}`;
    return `+${sum(X.od[0])} HP` + (cnt(X.od[1]) ? `, +${cnt(X.od[1])} защиты` : '');
  }
  function quote(slot, luck) {
    const X = S(), id = (me().eqOn || {})[slot]; if (!id) return { empty: true };
    const cur = lvOf(id); if (cur >= 10) return { id, cur, max: true };
    const tgt = cur + 1, c = X.cost[tgt] || [0, 0, 0], off = slot === 'offhand', gold = off ? Math.round(c[0] * X.om) : c[0], iron = off ? ((X.oi || {})[tgt] || 0) : c[2], shards = c[1];
    const base = X.ch[tgt] || 1, pity = tgt <= 5 ? 0 : Math.min(X.pt[1], pityOf(id) * X.pt[0]), fg = tgt <= 5 ? 0 : (X.fg || 0), lk = luck && tgt > 5 ? X.lk : 0;
    const have = { gold: num(me().gold), shards: me().sh.s | 0, iron: ((me().mats || me().mt || {}).iron | 0) };
    return { id, cur, tgt, gold, iron, shards, base, pity, fg, lk, p: Math.min(1, base + pity + fg + lk), stack: pityOf(id), fail: tgt >= 6, have };
  }
  const ironHave = () => { const m = me(); return m.mats ? (m.mats.iron | 0) : m.mt ? (m.mt.iron | 0) : (m.fe | 0); };

  // ---------- карточка героя ----------
  function decorateCard() {
    const card = document.querySelector('#hero .hcard.uc'); if (!card) return;
    const m = me(), r = ref();
    if (hasSh()) {
      card.querySelectorAll('.uc-slot[data-slot]').forEach(b => {
        const s = b.dataset.slot; if (!SLOT_RU[s] || b.dataset.s49) return; b.dataset.s49 = '1'; const id = (m.eqOn || {})[s]; if (!id) return; const n = lvOf(id);
        if (n) { b.insertAdjacentHTML('afterbegin', `<span class="sh-lv ${lvCls(n)}">+${n}</span>`); const nm = b.querySelector('.nm'); if (nm) nm.textContent += ` +${n}`; b.classList.add('sh-' + lvCls(n)); }
        b.title += ` · заточка +${n} (${bonusTxt(s, id, n)})`;
      });
      const first = card.querySelector('.uc-slot[data-slot]'), host = first && first.parentElement;
      if (host && !card.querySelector('.sh-row')) {
        const btn = s => { const id = (m.eqOn || {})[s]; if (!id) return ''; const n = lvOf(id); return `<button type="button" data-sh="${s}"${n >= 10 ? ' disabled' : ''}>⚒ ${esc(SLOT_NAME[s])} <span class="sh-lv ${lvCls(n)}">+${n}</span></button>`; };
        host.insertAdjacentHTML('afterend', `<div class="sh-row">${btn('weapon')}${btn('armor')}${btn('offhand')}<span class="sh-inv" title="Осколки падают с боссов, мимиков и легендарных сундуков">✦ ${m.sh.s | 0} · 🍀 ${m.sh.l | 0}${m.sh.b ? ' · рекорд +' + m.sh.b : ''}</span></div>`);
      }
    }
    if (m && m.fc && !card.querySelector('.sz-free')) {
      const row = card.querySelector('.sh-row') || (card.querySelector('.uc-slot[data-slot]') || {}).parentElement;
      if (row) row.insertAdjacentHTML('afterend', '<div class="sz-free">🎭 Бесплатная смена класса и облика — 1 раз <button type="button" data-fc="1">Выбрать…</button> <small>или в чате: <code>!смена маг ж</code></small></div>');
    }
    const ttl = card.querySelector('.uc-tag.ttl'); if (ttl && !ttl.dataset.s49) { ttl.dataset.s49 = '1'; const md = medal(m && m.ttOn); if (md) ttl.textContent = ttl.textContent.replace('🏷', md); }
  }

  // ---------- диалог заточки ----------
  function dlgHtml() {
    const d = dlg, X = S(), m = me(); if (!hasSh()) return '';
    const q = quote(d.slot, d.luck), nm = q.id ? itemName(q.id) : '';
    if (q.empty) return `<div class="sh-back"><div class="sh-dlg"><div class="sh-h">⚒ Заточка<button type="button" class="sh-x" title="Закрыть">✕</button></div><p>Слот пуст — сначала купи вещь в кузнице.</p></div></div>`;
    const max = !!q.max, cur = q.cur, tgt = q.tgt;
    const res = lastRes ? `<div class="sh-res ${lastRes.k}">${lastRes.k === 'ok' ? '✨ ' : lastRes.k === 'bad' ? '💥 ' : '… '}${esc(lastRes.msg)}</div>` : '';
    const lack = (a, b) => a < b ? ' lack' : '';
    const ladder = [6, 7, 8, 9, 10].map(n => `<span class="${n === tgt ? 'on' : ''}">+${n}<b>${Math.round(X.ch[n] * 100)}%</b></span>`).join('');
    const body = max ? `<div class="sh-note">«${esc(nm)}» уже на максимуме (+10): ${bonusTxt(d.slot, q.id, 10)}.</div>` : `
      <div class="sh-ladder">${ladder}</div>
      <div class="sh-grid">
        <div>🎯 Шанс</div><div><b class="sh-ch">${Math.round(q.p * 100)}%</b> <small>${q.fail ? `= ${Math.round(q.base * 100)}%${q.pity ? ` + упорство ${Math.round(q.pity * 100)}% (${q.stack} ${q.stack === 1 ? 'неудача' : 'неудачи'} подряд)` : ''}${q.fg ? ` + бонус кузницы ${Math.round(q.fg * 100)}%` : ''}${q.lk ? ` + свиток ${Math.round(q.lk * 100)}%` : ''}` : 'до +5 — всегда успех'}</small></div>
        <div>💰 Цена</div><div class="${lack(q.have.gold, q.gold)}"><b>${q.gold}</b> золота <small>(у тебя ${q.have.gold})</small></div>
        ${q.shards ? `<div>✦ Осколок</div><div class="${lack(q.have.shards, q.shards)}"><b>${q.shards}</b> Звёздный осколок <small>(у тебя ${q.have.shards}; падают с босса)</small></div>` : ''}
        ${q.iron ? `<div>⛓️ Железо</div><div class="${lack(ironHave(), q.iron)}"><b>${q.iron}</b> слитка <small>(у тебя ${ironHave()})</small></div>` : ''}
        ${q.fail ? `<div>⬇ Если неудача</div><div><span class="bad2">откат сразу до <b>+${X.ft}</b></span> <small>(вещь не ломается)</small></div>` : ''}
      </div>
      ${q.fail ? `<label class="sh-scroll${(m.sh.l | 0) > 0 ? '' : ' off'}"><input type="checkbox" data-luck="1" ${d.luck ? 'checked' : ''} ${(m.sh.l | 0) > 0 ? '' : 'disabled'}> 🍀 Использовать <b>Свиток удачи</b>: +${Math.round(X.lk * 100)}% к шансу <small>(у тебя ${m.sh.l | 0}) — тратится при любом исходе, от отката не спасает</small></label>` : ''}`;
    const ok = !max && q.have.gold >= q.gold && q.have.shards >= q.shards && ironHave() >= q.iron && !busy;
    const go = max ? '' : `<button type="button" class="go" data-go="1"${ok ? '' : ' disabled'}>${busy ? 'точим…' : `⚒ Точить за ${q.gold} 💰${q.shards ? ' + ' + q.shards + ' ✦' : ''}${q.iron ? ' + ' + q.iron + ' ⛓️' : ''}`}</button>`;
    return `<div class="sh-back"><div class="sh-dlg" role="dialog" aria-label="Заточка">
      <div class="sh-h">⚒ Заточка<button type="button" class="sh-x" title="Закрыть">✕</button></div>
      <div class="sh-item"><div class="sh-ic">${d.slot === 'weapon' ? '⚔️' : d.slot === 'armor' ? '🛡️' : '🔰'}</div><div><div class="sh-nm">${esc(nm)} <span class="sh-lv ${lvCls(cur)}">+${cur}</span>${max ? '' : ` → <span class="sh-lv ${lvCls(tgt)}">+${tgt}</span>`}</div>
        <div class="sh-sub">сейчас: ${bonusTxt(d.slot, q.id, cur)}${max ? '' : ` · после: <b>${bonusTxt(d.slot, q.id, tgt)}</b>`}</div></div></div>
      ${body}${res}
      <div class="sh-btns">${go}<button type="button" class="sec" data-close="1">${lastRes ? 'Закрыть' : 'Отмена'}</button></div>
      <div class="sh-note">Точить можно только вне похода и боя. Прочность не меняется, сломанная вещь (0%) не даёт и бонус заточки. В чате: <code>!заточка ${SLOT_RU[d.slot]}</code></div>
    </div></div>`;
  }
  function showDlg() { removeDlg(); if (!dlg) return; document.body.insertAdjacentHTML('beforeend', dlgHtml()); }
  function removeDlg() { document.querySelectorAll('.sh-back[data-k="sh"],.sh-back:not([data-k])').forEach(e => { if (!e.dataset.k) e.remove(); }); }
  function refreshDlg() { if (dlg) { const sc = document.querySelector('.sh-back .sh-dlg'); const top = sc ? sc.scrollTop : 0; showDlg(); const n = document.querySelector('.sh-back .sh-dlg'); if (n) n.scrollTop = top; } }
  function doSharpen() {
    if (busy || !dlg) return; const q = quote(dlg.slot, dlg.luck); if (q.empty || q.max) return; busy = true; lastRes = { k: 'wait', msg: 'точим…' }; refreshDlg();
    const arg = 'заточка ' + SLOT_RU[dlg.slot] + (dlg.luck && q.fail ? ' удача' : '');
    if (window.PanelActions && PanelActions.fire) PanelActions.fire('экип', arg, 'Заточка', r => { busy = false; const ok = /^Успех/.test(r.msg || ''); lastRes = { k: ok ? 'ok' : r.ok === false ? 'bad' : 'ok', msg: r.msg || (r.ok ? 'готово' : 'не получилось') }; if (dlg && ok) dlg.luck = dlg.luck && false; refreshDlg(); });
  }

  // ---------- бесплатная смена ----------
  function fcHtml() {
    const d = fcOpen, cls = ref().cls || [], m = me(); const nameOf = c => (m.g === 'f' || d.g === 'f') && c[2] ? c[2] : c[1];
    const cur = cls.find(c => c[0] === m.cls); const sel = cls.find(c => c[0] === d.cls);
    return `<div class="sh-back" data-k="fc"><div class="sh-dlg" role="dialog" aria-label="Смена облика">
      <div class="sh-h">🎭 Бесплатная смена<button type="button" class="sh-x" data-fcx="1" title="Закрыть">✕</button></div>
      <div class="sh-note">Сейчас: ${esc(cur ? cur[1] : m.cls || '')}, ${m.g === 'f' ? 'женский' : 'мужской'} пол. Второй раз бесплатно не будет: сменить класс обычным способом нельзя.</div>
      <h4 style="margin:10px 0 2px">Класс</h4><div class="fc-grid">${cls.map(c => `<button type="button" data-fcc="${esc(c[0])}" class="${d.cls === c[0] ? 'on' : ''}">${esc(nameOf(c))}</button>`).join('')}</div>
      <h4 style="margin:10px 0 2px">Пол</h4><div class="fc-grid"><button type="button" data-fcg="m" class="${d.g === 'm' ? 'on' : ''}">Мужской</button><button type="button" data-fcg="f" class="${d.g === 'f' ? 'on' : ''}">Женский</button></div>
      ${lastRes && lastRes.fc ? `<div class="sh-res ${lastRes.k}">${esc(lastRes.msg)}</div>` : ''}
      ${d.confirm ? `<div class="sh-res wait">Точно? Класс «${esc(sel ? sel[1] : '')}», ${d.g === 'f' ? 'женский' : 'мужской'} пол. ${(m.eqOwn || []).length ? 'Вещи, которые новому классу не подходят, кузница выкупит по полной цене.' : 'Снаряжения у тебя сейчас нет (в новом сезоне всё начинается заново) — терять нечего.'} Второй раз бесплатно не будет.</div>` : ''}
      <div class="sh-btns">${d.confirm ? '<button type="button" class="go" data-fcgo="1">Да, сменить</button>' : `<button type="button" class="go" data-fcok="1"${d.cls === m.cls && d.g === (m.g === 'f' ? 'f' : 'm') ? ' disabled' : ''}>Сменить…</button>`}<button type="button" class="sec" data-fcx="1">${lastRes && lastRes.fc && lastRes.k === 'ok' ? 'Закрыть' : 'Отмена'}</button></div>
      <div class="sh-note">В чате: <code>!смена маг ж</code> — игра попросит подтвердить через <code>!да</code>.</div></div></div>`;
  }
  function showFc() { document.querySelectorAll('.sh-back[data-k="fc"]').forEach(e => e.remove()); if (fcOpen) document.body.insertAdjacentHTML('beforeend', fcHtml()); }

  // ---------- итоги сезона ----------
  const sumKey = () => 'rpgSeasonSumSeen_' + ((ref().season || {}).cur || 0);
  function sumHtml() {
    const Z = ref().season, sm = Z && Z.sum, a = me() && me().sa; if (!sm) return '';
    const podium = (sm.top || []).slice(0, 3).map((t, i) => `<div class="g${i + 1}">${['🥇', '🥈', '🥉'][i]}<b>${esc(t[4] || t[0])}</b><small>${esc(t[1])} очков · ур. ${esc(t[2])} · ${esc(t[3])} ${(t[3] | 0) % 10 === 1 && (t[3] | 0) !== 11 ? 'победа' : 'побед'} над боссом</small></div>`).join('');
    const mine = a ? `<div class="sh-note" style="opacity:.95;font-size:13px">Твои очки сезона: <b>${a.sc}</b> = ур. ${a.lv}×10 (${a.lp}) + ${a.w} побед над боссом ×10 (${a.wp})${a.sp ? ` + лучшая заточка +${a.b} (${a.sp})` : ''}. Место: <b>${a.r}</b> из ${a.n}.${a.tt && a.tt.length ? ' Награды: ' + esc(a.tt.join(', ')) + '.' : ''}</div>` : '';
    const extra = [sm.bane ? `🗡 Гроза боссов: <b>${esc(sm.bane[2] || sm.bane[0])}</b>` : '', sm.gd ? `🏰 Лучшая гильдия: <b>${esc(((ref().guilds || []).find(g => g[0] === sm.gd[0]) || [])[1] || sm.gd[0])}</b> ★` : '', sm.vet ? `🎖 Ветеранов: <b>${sm.vet}</b>` : ''].filter(Boolean).join(' · ');
    return `<div class="sh-back" data-k="sum"><div class="sh-dlg sz-dlg"><div class="sh-h">🏆 Итоги Сезона ${esc(sm.n)}<button type="button" class="sh-x" data-sumx="1">✕</button></div>
      <div class="sz-top">${podium || '<div>—</div>'}</div>${extra ? `<div class="sh-note" style="font-size:13px;opacity:.9">${extra}</div>` : ''}${mine}
      <div class="sz-cols" style="margin-top:8px"><div><h4>✅ Осталось навсегда</h4><ul><li>титулы (с пометкой «(${sm.n} сезон)»)</li><li>косметика: ауры, питомцы, следы, причёска</li><li>гильдия, зал славы</li><li>невыданные реальные призы</li><li>огород</li></ul></div>
      <div><h4>🔄 Началось заново</h4><ul><li>уровень, опыт, золото</li><li>снаряжение, сеты, сумка</li><li>задания, сундуки, материалы</li><li>постройки, очки гильдий</li></ul></div></div>
      ${me() && me().fc ? `<div class="sz-free">🎭 <b>Подарок к сезону:</b> одна бесплатная смена класса и облика. <button type="button" data-fc="1" data-sumx="1">Сменить</button></div>` : ''}
      <div class="sh-btns"><button type="button" class="sec" data-sumx="1">Закрыть</button></div></div></div>`;
  }
  function showSum(force) { document.querySelectorAll('.sh-back[data-k="sum"]').forEach(e => e.remove()); sumOpen = !!force; if (force) document.body.insertAdjacentHTML('beforeend', sumHtml()); }

  // ---------- плашка сезона ----------
  const fmtLeft = ms => { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), mi = Math.floor(s % 3600 / 60); return d ? `${d} д ${h} ч` : h ? `${h} ч ${mi} мин` : `${mi} мин`; };
  function seasonBar() {
    const Z = ref().season; let bar = document.getElementById('sz49'); const live = document.getElementById('live'); if (!live) return;
    let html = '';
    if (Z) {
      if (Z.at && Z.at > Date.now()) html = `<span class="sz-t">🏆 ${esc(Z.nm || 'Сезон ' + Z.id)}</span><span>через <b>${fmtLeft(Z.at - Date.now())}</b>: уровни, золото, снаряжение и постройки начнутся заново; титулы, косметика, гильдия и призы останутся. Каждому — бесплатная смена класса и облика</span>`;
      else if (Z.cur > 1) { const t = me() && me().ttOn, md = medal(t); html = `<span class="sz-t">🏆 Сезон ${Z.cur}</span>${Z.sum ? '<button type="button" data-sumo="1">📊 Итоги Сезона ' + (Z.cur - 1) + '</button>' : ''}${me() && me().fc ? '<button type="button" data-fc="1">🎭 Бесплатная смена</button>' : ''}${md ? `<span>${md} ${esc(t)}</span>` : ''}`; }
    }
    if (!html) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'sz49'; bar.className = 'sz-bar'; live.parentNode.insertBefore(bar, live); }
    if (bar.dataset.h !== html) { bar.dataset.h = html; bar.innerHTML = html; }
  }

  // ---------- постройки до 10 уровня ----------
  function bldInfo() {
    const B = ref().bld; if (!B || !B.some(b => b[11])) return;
    document.querySelectorAll('#hero .upr2[data-b]').forEach(row => {
      if (row.nextElementSibling && row.nextElementSibling.classList.contains('bv49')) return; const b = B.find(x => x[0] === row.dataset.b), v = b && b[11]; if (!v) return;
      let t = '', cl = '';
      if (v.build) { t = `🏗 Стройка до ур.${v.build.lv}: ещё <b>${v.build.left}</b> стрим${v.build.left === 1 ? '' : v.build.left < 5 ? 'а' : 'ов'} — вкладывать пока нельзя`; cl = 'build'; }
      else if (v.max) return;
      else { const p = Math.min(1, v.ch + v.pity); const bits = []; if (v.ch < 1) bits.push(`шанс <b>${Math.round(p * 100)}%</b>${v.pity ? ` (упорство +${Math.round(v.pity * 100)}%)` : ''}, при неудаче теряется часть золота и материалов`); else bits.push('уровень гарантирован'); if (v.streams) bits.push(`стройка ${v.streams} стрим${v.streams === 1 ? '' : 'а'}`); if (v.hearts) { bits.push(`нужны сердца ${v.hearts} разных боссов (в казне: ${esc(v.heartTxt)})`); cl = 'hearts'; } t = `Ур. ${b[2] + 1}: ` + bits.join(' · '); }
      row.insertAdjacentHTML('afterend', `<div class="bv49 ${cl}">${t}</div>`);
    });
  }

  // ---------- события ----------
  document.addEventListener('click', e => {
    const t = e.target;
    let b = t.closest('button[data-sh]'); if (b && !b.disabled && hasSh()) { dlg = { slot: b.dataset.sh, luck: false }; lastRes = null; busy = false; showDlg(); return; }
    if (t.closest('.sh-back[data-k="sum"]')) { if (t.closest('[data-fc]') && me() && me().fc) { fcOpen = { cls: me().cls, g: me().g === 'f' ? 'f' : 'm', confirm: false }; lastRes = null; showFc(); } if (t.closest('[data-sumx]') || t === t.closest('.sh-back')) { try { localStorage.setItem(sumKey(), '1'); } catch (x) { } showSum(false); } return; }
    if (t.closest('.sh-back[data-k="fc"]')) {
      if (t.closest('[data-fcx]') || t === t.closest('.sh-back')) { fcOpen = null; lastRes = null; showFc(); return; }
      if (!fcOpen) return; const c = t.closest('[data-fcc]'), g = t.closest('[data-fcg]');
      if (c) { fcOpen.cls = c.dataset.fcc; fcOpen.confirm = false; showFc(); } else if (g) { fcOpen.g = g.dataset.fcg; fcOpen.confirm = false; showFc(); }
      else if (t.closest('[data-fcok]')) { fcOpen.confirm = true; showFc(); }
      else if (t.closest('[data-fcgo]')) { const a = 'смена ' + fcOpen.cls + ' ' + (fcOpen.g === 'f' ? 'ж' : 'м'); fcOpen.confirm = false; lastRes = { k: 'wait', msg: 'меняем…', fc: 1 }; showFc();
        if (window.PanelActions && PanelActions.fire) PanelActions.fire('экип', a, 'Смена облика', r => { lastRes = { k: r.ok ? 'ok' : 'bad', msg: r.msg || (r.ok ? 'готово' : 'не получилось'), fc: 1 }; if (r.ok) fcOpen.cls = null; showFc(); }); }
      return; }
    if (t.closest('button[data-fc]') && me() && me().fc) { fcOpen = { cls: me().cls, g: me().g === 'f' ? 'f' : 'm', confirm: false }; lastRes = null; showFc(); return; }
    if (t.closest('button[data-sumo]')) { showSum(true); return; }
    if (t.closest('.sh-back:not([data-k])')) {
      if (t.closest('[data-go]')) return doSharpen();
      if (t.closest('[data-close]') || t.closest('.sh-x') || t === t.closest('.sh-back')) { dlg = null; lastRes = null; busy = false; removeDlg(); }
    }
  });
  document.addEventListener('change', e => { const c = e.target.closest && e.target.closest('input[data-luck]'); if (c && dlg) { dlg.luck = c.checked; refreshDlg(); } });
  function tick() {
    try { decorateCard(); bldInfo(); seasonBar();
      const Z = ref().season; if (Z && Z.sum && me() && !sumOpen && !fcOpen) { let seen = false; try { seen = !!localStorage.getItem(sumKey()); } catch (x) { } if (!seen && (me().sa || Z.cur > 1) && !(mock && !qs.get('season'))) showSum(true); }
      if (dlg) refreshDlg(); } catch (x) { console.error('[season.js]', x); }
  }
  const hero = document.getElementById('hero'); if (hero) new MutationObserver(() => tick()).observe(hero, { childList: true }); // v49.1: украшаем сразу (микрозадача до отрисовки) — раньше через 30 мс, и каждую секунду мелькал кадр без строк построек/заточки и с 🏷 вместо медали
  setInterval(() => { try { seasonBar(); } catch (x) { } }, 30000);

  // ---------- «Раскат» огра (v49): строка «Раскат через N с», только когда игра прислала boss.rm (огр ≤ 50% HP) ----------
  const rmBox = (() => { const c = document.getElementById('castbox'); if (!c) return null; const d = document.createElement('div'); d.id = 'rm49'; d.className = 'rm49'; d.hidden = true; c.insertAdjacentElement('afterend', d); return d; })();
  function rumbleTick() {
    if (!rmBox) return; const b = st() && st().online !== false && st().boss, r = b && b.ph === 'fight' && b.rm;
    if (!r || !(r.e > 0)) { if (!rmBox.hidden) { rmBox.hidden = true; rmBox.textContent = ''; } return; }
    const rx = st()._rx || st().t || Date.now(), dt = (Date.now() - rx) / 1000;
    if (!mock && dt > 6) { rmBox.hidden = true; return; } // связь пропала — не врём
    let left = (+r.l || 0) - dt; if (left < 0) left = r.e - ((-left) % r.e); if (mock) left = r.e - ((Date.now() - rx) / 1000) % r.e;
    rmBox.hidden = false; rmBox.className = 'rm49' + (left <= 3 ? ' hot' : '');
    rmBox.innerHTML = `🔥 <b>Раскат</b> через <b class="rml">${Math.ceil(left)} с</b> <span>−${esc(r.p)}% HP всем · 🛡 заслон паладина режет вдвое</span>`;
  }
  setInterval(rumbleTick, 250);
  // ---------- демо без сети (?mock=1) ----------
  if (mock && qs.get('rm') && P.state) { const bb = P.state.boss; P.state.boss = Object.assign(bb && bb.ph === 'fight' ? bb : { ph: 'fight', name: 'Огр', key: 'ogre_boss', flt: '', hp: 4300, mhp: 10000, n: 5 }, { rm: { l: 9, e: 15, p: 10 } }); P.state._rx = Date.now(); if (P.render) P.render(); }
  if (mock && (qs.get('sh') || qs.get('season') || qs.get('bv2'))) {
    const mm = P.state && P.state.me; if (mm) {
      const sh = qs.get('sh'), se = qs.get('season');
      const tbl = { 1: [40, 0, 0], 2: [60, 0, 0], 3: [80, 0, 0], 4: [110, 0, 0], 5: [150, 0, 0], 6: [200, 0, 1], 7: [260, 1, 2], 8: [320, 1, 2], 9: [380, 1, 3], 10: [450, 1, 3] };
      st().ref = Object.assign({}, st().ref, { sharp: { ch: { 6: .7, 7: .6, 8: .45, 9: .35, 10: .25 }, cost: tbl, om: .6, oi: { 6: 1, 7: 1, 8: 1, 9: 2, 10: 2 }, pt: [.1, .3], lk: .15, fg: 0, ft: 5, sc: 6, w: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2], a: [[3, 3, 3, 3, 3, 3, 3, 3, 3, 3], [4, 6, 8, 10]], od: [[1, 1, 1, 1, 1, 2, 2, 2, 2, 2], [6, 10]], oa: [2, 4, 6, 7, 8, 9, 10], oaI: [], mgI: [], tmI: [] }, cls: [['warrior', 'Воин', 'Воительница'], ['paladin', 'Паладин', 'Паладин'], ['archer', 'Лучник', 'Лучница'], ['assassin', 'Ассасин', 'Ассасинка'], ['mage', 'Маг', 'Волшебница'], ['priest', 'Жрец', 'Жрица']] });
      const eqOn = mm.eqOn || (mm.eqOn = {}); eqOn.weapon = eqOn.weapon || 'w3'; eqOn.armor = eqOn.armor || 'a3'; eqOn.offhand = eqOn.offhand || 'r2';
      const eq = st().ref.eq || (st().ref.eq = []); [['w3', 'Рунный клинок', 700, 'weapon'], ['a3', 'Латы', 700, 'armor'], ['r2', 'Стальные наручи', 300, 'offhand']].forEach(x => { if (!eq.find(e => e[0] === x[0])) eq.push([x[0], x[1], x[2], x[3], null, 3, '', null]); });
      mm.sh = { s: sh === 'poor' ? 0 : 3, l: sh === 'poor' ? 0 : 2, b: 8, m: { [eqOn.weapon]: 7, [eqOn.armor]: 5, [eqOn.offhand]: 3 }, p: { [eqOn.weapon]: 1 }, k: 2 };
      if (sh === 'max') mm.sh.m[eqOn.weapon] = 10; if (sh === 'fail') mm.sh.m[eqOn.weapon] = 7; mm.mats = { wood: 80, stone: 40, iron: sh === 'poor' ? 0 : 37 }; mm.gold = sh === 'poor' ? 120 : 1240;
      if (se) { mm.ttOn = 'Серебро 1 сезона'; mm.tt = ['Серебро 1 сезона', 'Ветеран 1 сезона']; mm.fc = 1; }
      if (se === 'ann') st().ref.season = { cur: 1, id: 2, nm: 'Сезон 2', at: Date.now() + 2 * 86400000 + 5 * 3600000, ad: 3 };
      if (se === 'new' || se === 'sum' || se === 'chg') { st().ref.season = { cur: 2, id: 2, nm: 'Сезон 2', sum: { n: 1, nm: 'Сезон 1', t: Date.now(), heroes: 24, top: [['ironpaw', 510, 31, 12, 'ironpaw'], ['demo_viewer', 425, 28, 9, 'demo_viewer'], ['kotik_mag', 405, 27, 10, 'kotik_mag']], vet: 17, bane: ['ironpaw', 99000, 'ironpaw'], gd: ['fire', 1200] } }; mm.sa = { sc: 425, lp: 280, wp: 90, sp: 55, lv: 28, w: 9, b: 8, r: 2, n: 24, md: 2, v: 1, g: 0, tt: ['Серебро 1 сезона', 'Ветеран 1 сезона'] }; }
      if (qs.get('bv2')) { st().ref.bld = [['campfire', 'Костёр', 5, 10, 220, 'camp', '+4 места', '+1 место', {}, '', '', { ch: .8, pity: .15, streams: 1, hearts: 0, haveHearts: 0, heartTxt: 'нет' }], ['blacksmith', 'Кузница', 9, 10, 0, 'town', '+0.30 урона', '+0.03', { iron: 10 }, '', '', { ch: .3, pity: .15, streams: 2, hearts: 2, haveHearts: 1, heartTxt: 'Огр 1' }], ['tents', 'Палатка', 6, 10, 0, 'camp', '', '', {}, '', '', { build: { lv: 7, left: 1 } }], ['market', 'Рынок', 10, 10, null, 'town', '', null, {}, '', null, { max: true }]]; }
      const orig = window.__panelSend; window.__panelSend = m => {
        if (m.cmd === 'экип' && /^заточка/.test(m.arg || '')) { return setTimeout(() => mockSharp(m), 350); }
        if (m.cmd === 'экип' && /^смена/.test(m.arg || '')) { return setTimeout(() => { mm.fc = 0; const w = String(m.arg).split(' '); mm.cls = w[1] || mm.cls; mm.g = w[2] === 'ж' ? 'f' : 'm'; PanelActions.done({ id: m.id, ok: true, msg: `теперь ${w[1]} (бесплатная смена использована)` }); P.render(); }, 350); }
        return orig(m);
      };
      function mockSharp(m) {
        const slot = /броня/.test(m.arg) ? 'armor' : /лев/.test(m.arg) ? 'offhand' : 'weapon', id = eqOn[slot], cur = mm.sh.m[id] | 0, tgt = cur + 1, c = tbl[tgt]; if (!c) return PanelActions.done({ id: m.id, ok: false, msg: `«${itemName(id)}» уже +10` });
        const luck = /удача/.test(m.arg), pity = Math.min(.3, (mm.sh.p[id] | 0) * .1), p = tgt <= 5 ? 1 : Math.min(1, ({ 6: .7, 7: .6, 8: .45, 9: .35, 10: .25 })[tgt] + pity + (luck ? .15 : 0)), win = qs.get('sh') === 'fail' ? false : (qs.get('sh') === 'ok' ? true : Math.random() < p);
        mm.gold -= c[0]; mm.sh.s -= c[1]; mm.mats.iron -= c[2]; if (luck) mm.sh.l--;
        if (win) { mm.sh.m[id] = tgt; mm.sh.p[id] = 0; mm.sh.b = Math.max(mm.sh.b, tgt); PanelActions.done({ id: m.id, ok: true, msg: `Успех! «${itemName(id)}» +${cur} → +${tgt}` }); }
        else { mm.sh.m[id] = 5; mm.sh.p[id] = (mm.sh.p[id] | 0) + 1; PanelActions.done({ id: m.id, ok: false, msg: `Неудача: «${itemName(id)}» +${cur} → +5 (шанс был ${Math.round(p * 100)}%). Упорство: +10% к следующей попытке` }); }
        P.render();
      }
      P.render();
      if (['dlg', 'dlgs', 'ok', 'fail', 'max', 'poor'].includes(sh)) setTimeout(() => { dlg = { slot: 'weapon', luck: sh === 'dlgs' }; showDlg(); if (sh === 'ok' || sh === 'fail') document.querySelector('.sh-back [data-go]').click(); }, 150);
      if (se === 'chg') setTimeout(() => { fcOpen = { cls: mm.cls, g: 'm', confirm: false }; showFc(); }, 200);
    }
  }
  tick();
})();
