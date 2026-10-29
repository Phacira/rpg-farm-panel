// Пульт зрителя, шаг 3 (v7panel3): кнопки-действия. Кнопка → relay → игра выполняет то же, что чат-команда от ВАШЕГО ника (ник relay берёт из Twitch-токена).
// Ответа в чат нет: результат или ошибка показываются здесь, под кнопками.
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SLOT_RU = { weapon: 'оружие', armor: 'броня', offhand: 'щит', trinket: 'амулет' };
  const REWARD = 'нужен ход от награды канала';
  let seq = 0; const pend = {}; let results = [];
  // Каждая кнопка: [иконка, подпись, команда, аргумент|функция-выбор, подсказка, подтверждение?]
  // pick(ctx) → [{label, arg, sub, confirm, dis}] — выбор аргумента в окне
  function defs(ctx) {
    const me = ctx.me, ref = ctx.ref || {}, gold = me ? me.gold : 0;
    const bldPick = loc => (ref.bld || []).filter(b => !loc || b[5] === loc).map(([id, name, lv, max, need]) => need == null ? { label: `${name} (ур. ${lv}, максимум)`, dis: true }
      : { label: `${name} (ур. ${lv}→${lv + 1})`, sub: `осталось ${need} з`, next: [50, 100, 250, 'всё'].map(a => ({ label: a === 'всё' ? `Всё золото (${gold} з)` : `${a} золота`, arg: `${id} ${a}`, dis: a !== 'всё' && gold < a, confirm: `Вложить ${a === 'всё' ? 'всё золото' : a + ' золота'} в «${name}»?` })) });
    const crops = [{ label: 'Всё сразу', arg: 'всё', confirm: 'Продать ВСЕ овощи на рынке?' }].concat((ref.crops || []).map(([id, n]) => ({ label: n, sub: me && me.veg ? `есть ${me.veg[id] || 0}` : '', dis: me && me.veg && !(me.veg[id] > 0), arg: n.toLowerCase(), confirm: `Продать все: ${n}?` })));
    const shop = () => (ref.eq || []).filter(i => !i[4] || (me && i[4].includes(me.cls))).map(([id, name, price, slot, , bs]) => {
      const own = me && (me.eqOwn || []).includes(id), on = me && me.eqOn && me.eqOn[slot] === id;
      return own ? { label: name, sub: on ? 'надето' : 'есть — надеть', dis: on, arg: id, cmd: 'экип' } : { label: name, sub: `${price} з · ${SLOT_RU[slot] || slot}${bs > (ref.bsLv || 1) ? ' · кузница ур.' + bs : ''}`, dis: gold < price || bs > (ref.bsLv || 1), arg: id, confirm: `Купить «${name}» за ${price} золота?` }; });
    const hair = () => (ref.hair || []).map(([id, n]) => ({ label: n, sub: me && me.hair === id ? 'сейчас' : `${ref.hairPrice || 250} з`, dis: (me && me.hair === id) || gold < (ref.hairPrice || 250), arg: n, confirm: `Покрасить волосы в «${n}» за ${ref.hairPrice || 250} золота?` }));
    const guilds = () => (ref.guilds || []).map(([id, n], i) => ({ label: n, sub: me && me.gid === id ? 'ваша гильдия' : '', dis: me && me.gid === id, arg: String(i + 1), confirm: `Вступить в гильдию «${n}»?` }));
    const quests = () => me && me.q ? [{ label: 'У вас уже есть задание', dis: true }] : (me && me.of || []).map((id, i) => ({ label: `${i + 1}. ${(ref.quests || {})[id] || id}`, arg: String(i + 1) })).concat([{ label: 'Показать список (без хода)', arg: '' }]);
    const wear = () => (me && me.eqOwn || []).map(id => (ref.eq || []).find(i => i[0] === id)).filter(Boolean).map(([id, n, , slot]) => ({ label: n, sub: me.eqOn && me.eqOn[slot] === id ? 'надето' : SLOT_RU[slot] || slot, dis: me.eqOn && me.eqOn[slot] === id, arg: id, confirm: `Надеть «${n}»?` }));
    const unwear = () => Object.entries(me && me.eqOn || {}).filter(([, v]) => v).map(([slot, id]) => { const i = (ref.eq || []).find(x => x[0] === id); return { label: `${SLOT_RU[slot] || slot}: ${i ? i[1] : id}`, arg: slot, confirm: `Снять ${i ? '«' + i[1] + '»' : SLOT_RU[slot]}?` }; });
    const titles = () => (me && me.tt || []).map((t, i) => ({ label: t, sub: me.ttOn === t ? 'надет' : '', dis: me.ttOn === t, arg: String(i + 1), confirm: `Надеть титул «${t}»?` })).concat(me && me.ttOn ? [{ label: 'Снять титул', arg: 'снять', confirm: 'Снять титул?' }] : []);
    const hike = me && me.cd > 0 ? `КД ${Math.floor(me.cd / 60)}:${String(me.cd % 60).padStart(2, '0')}` : (me && me.rw && me.rw.hike > 0 ? `ходов: ${me.rw.hike}` : REWARD);
    return {
      town: [['📜', 'Задание', 'квест', quests, me && me.rw && me.rw.quest > 0 ? `ходов: ${me.rw.quest}` : REWARD],
        ['⚒', 'Кузница', 'купить', shop, 'купить / надеть'], ['💈', 'Парикмахер', 'парикмахер', hair, `${ref.hairPrice || 250} з`],
        ['🏗', 'Вклад', 'вклад', () => bldPick('town'), 'в постройку города'], ['💰', 'Продать', 'продать', () => crops, 'овощи на рынке']],
      garden: [['🚶', 'На огород', 'огород', '', 'к своей грядке'], ['🌰', 'Семена', 'семена', '', '3 в день'], ['🌱', 'Посадить', 'посадить', '', ''],
        ['⏳', 'Грядка', 'грядка', '', 'сколько ждать'], ['🐞', 'Жуки', 'жуки', '', 'отогнать'], ['🧺', 'Собрать', 'собрать', '', 'урожай'],
        ['✨', 'Магия', 'магия', '', 'шанс ×2'], ['🔁', 'Обмен', 'обмен', '', '10 сорняков → овощ', 'Обменять 10 сорняков на овощ?'], ['📦', 'Урожай', 'урожай', '', 'что у меня есть'],
        ['🍲', 'Готовить', 'готовить', '', me && me.rw && me.rw.cook > 0 ? `ходов: ${me.rw.cook}` : REWARD], ['💰', 'Продать', 'продать', () => crops, 'овощи'], ['🏗', 'Вклад', 'вклад', () => bldPick('garden'), 'в сарай']],
      camp: [['🛡', 'В пати', 'пати', '', 'групповой поход'], ['🏰', 'Гильдия', 'гильдия', guilds, me && me.gd ? me.gd : 'выбрать'],
        ['✔', 'Да', 'да', '', 'подтвердить гильдию'], ['✖', 'Нет', 'нет', '', 'отменить выбор'], ['🏗', 'Вклад', 'вклад', () => bldPick('camp'), 'костёр, палатка']],
      forest: [['⚔', 'В поход', 'поход', '', hike], ['🛡', 'Пати-поход', 'пати', '', me && me.pty ? 'вы в очереди' : 'вместе с другими']],
      boss: [['☠', 'Записаться', 'босс', '', 'в отряд на босса'], ['👊', 'Удар', 'удар', '', 'до 4 в минуту'], ['💚', 'Лечить', 'лечить', '', 'раз в 30 с'],
        ['💫', 'Оглушить', 'оглушить', '', 'красный каст'], ['🕸', 'Связать', 'связать', '', 'жёлтый каст'], ['🔮', 'Очистить', 'очистить', '', 'фиолетовый каст'],
        ['🐌', 'Замедлить', 'замедлить', '', 'маг'], ['🛡', 'Заслон', 'заслон', '', 'паладин'], ['✝', 'Воскресить', 'воскресить', '', 'поднять союзника']],
      me: me ? [['🎒', 'Надеть', 'экип', wear, 'своё снаряжение'], ['🧤', 'Снять', 'снять', unwear, 'вещь со слота'], ['🏷', 'Титул', 'титул', titles, me.ttOn || 'выбрать'],
        ['💈', 'Парикмахер', 'парикмахер', hair, `${ref.hairPrice || 250} з`], ['🏰', 'Гильдия', 'гильдия', guilds, me.gd || 'выбрать'], ['⚒', 'Кузница', 'купить', shop, 'купить вещь']]
        : [['🧙', 'Стать героем', 'вступить', '', 'если стример разрешил']]
    };
  }
  let ctxNow = null, curList = [];
  function render(el, ctx) {
    ctxNow = ctx; if (!el) return;
    const on = ctx.online, list = (defs(ctx)[ctx.tab] || []);
    curList = list;
    const title = { town: 'Город', garden: 'Огород', camp: 'Лагерь', forest: 'Лес', boss: 'Босс', me: 'Мой герой' }[ctx.tab] || '';
    el.innerHTML = `<h2>Действия: ${esc(title)}</h2>${!on ? '<p class="note">Кнопки работают, когда идёт стрим.</p>' : !ctx.me && ctx.tab !== 'me' ? '<p class="note">У вас пока нет героя — кнопки появятся, когда он будет.</p>' : ''}
      <div class="acts">${list.map((d, i) => { const busy = Object.values(pend).some(p => p.cmd === d[2]);
        return `<button class="act${busy ? ' busy' : ''}" data-a="${i}"${!on || (!ctx.me && d[2] !== 'вступить') || busy ? ' disabled' : ''}><span class="ai">${d[0]}</span><span class="al">${esc(d[1])}</span><small>${esc(d[4] || '')}</small></button>`; }).join('')}</div>
      <div class="cres" aria-live="polite">${results.map(r => `<div class="${r.ok ? 'ok' : r.ok === false ? 'bad' : 'wait'}">${r.ok ? '✔' : r.ok === false ? '✖' : '…'} <b>${esc(r.label)}</b>: ${esc(r.msg)}</div>`).join('')}</div>`;
  }
  // окно выбора/подтверждения
  function sheet(title, opts) {
    const s = document.getElementById('sheet'); s.hidden = false;
    s.innerHTML = `<div class="sbox"><h3>${esc(title)}</h3><div class="sopts">${opts.length ? opts.map((o, i) => `<button data-o="${i}"${o.dis ? ' disabled' : ''}><span class="al">${esc(o.label)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('') : '<p class="note">Выбрать пока нечего.</p>'}</div><button class="scancel" data-o="x">Отмена</button></div>`;
    s.onclick = e => { const b = e.target.closest('button'); if (!b && e.target !== s) return; if (e.target === s || b.dataset.o === 'x') return close(); const o = opts[+b.dataset.o]; if (o && o.go) o.go(); };
  }
  function close() { const s = document.getElementById('sheet'); s.hidden = true; s.innerHTML = ''; }
  function ask(d, arg, label, confirm, cmd) {
    if (confirm) return sheet(confirm, [{ label: 'Да, выполнить', go: () => { close(); fire(cmd || d[2], arg, label); } }]);
    close(); fire(cmd || d[2], arg, label);
  }
  function choose(d, opts, title) {
    sheet(title, opts.map(o => Object.assign({}, o, { go: () => o.next ? choose(d, o.next, o.label) : ask(d, o.arg, d[1] + (o.label ? ' · ' + o.label : ''), o.confirm, o.cmd) })));
  }
  function click(i) {
    const d = curList[i]; if (!d) return;
    if (typeof d[3] === 'function') return choose(d, d[3](), d[1]);
    ask(d, d[3] || '', d[1], d[5]);
  }
  function fire(cmd, arg, label) {
    const id = 'c' + (++seq); pend[id] = { cmd, label };
    push({ id, label, msg: 'отправляю…', ok: null });
    window.__panelSend({ type: 'cmd', id, cmd, arg: arg || '' });
    setTimeout(() => { if (pend[id]) done({ id, ok: false, msg: 'нет ответа — проверьте связь' }); }, 12000);
  }
  function push(r) { results = [r].concat(results.filter(x => x.id !== r.id)).slice(0, 4); window.__panel && window.__panel.render(); }
  function done(m) { const p = pend[m.id]; if (!p) return; delete pend[m.id]; push({ id: m.id, label: p.label, msg: m.msg || (m.ok ? 'готово' : 'не получилось'), ok: !!m.ok }); }
  document.addEventListener('click', e => { const b = e.target.closest('button.act'); if (b && !b.disabled) click(+b.dataset.a); });
  window.PanelActions = { render, done, defs };
})();
