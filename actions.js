/* v42repair: repair action buttons */
// Пульт зрителя, шаг 3 (v7panel3): кнопки-действия. Кнопка → relay → игра выполняет то же, что чат-команда от ВАШЕГО ника (ник relay берёт из Twitch-токена).
// Ответа в чат нет: результат или ошибка показываются здесь, под кнопками.
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SLOT_RU = { weapon: 'оружие', armor: 'броня', offhand: 'щит', trinket: 'амулет' , ring1: 'кольцо', ring2: 'кольцо'};
  const REWARD = 'нужен ход от награды канала';
  const HAIR_AVAILABLE = false; // v7panel10: true — включить кнопку «Парикмахер» (или игра включит сама через ref.hairOn)
  const HAIR_OFF_TEXT = 'Цирюльника пока нет на месте';
  let seq = 0; const pend = {}; let results = [];
  // Каждая кнопка: [иконка, подпись, команда, аргумент|функция-выбор, подсказка, подтверждение?]
  // pick(ctx) → [{label, arg, sub, confirm, dis}] — выбор аргумента в окне
  function defs(ctx) {
    const me = ctx.me, ref = ctx.ref || {}, gold = me ? me.gold : 0;
    const eqWorn = id => !!(me && me.eqOn && Object.values(me.eqOn).includes(id)); // v49.8: надето в любом слоте
    // v7panel18: вклад — выбор «Золото» или «Материалы» (материал → количество из сумки или докупить золотом по ref.matP)
    const MN = {}; (ref.mats || []).forEach(([id, n, ic]) => MN[id] = [n, ic]); const mtn = id => (MN[id] || [id])[0], mti = id => id === 'iron' ? '' : (MN[id] || [, ''])[1] || ''; // v7panel20 п.7: у железа вместо цепей — слиток (картинкой на карточке), в текстовых списках без значка
    const bldPick = loc => (ref.bld || []).filter(b => !loc || b[5] === loc).map(([id, name, lv, max, need, , eff, nextEff, ml, eff1, nextEff1, v2]) => { ml = ml || {};
      const now = eff1 || eff || '', nxt = nextEff1 || nextEff || '', fxOn = +(ref.px || 0) >= 497;
      // v49.8 (макет, ждёт «да»): плитка — только название, уровень и остаток; подробности (что даёт сейчас / что даст / сколько осталось / что есть у вас) — в следующем окне
      const info = (top) => ({ note: 1, label: '', lines: [[`Сейчас (ур. ${lv} из ${max})`, now || '—'], ...(top ? [['Дальше', 'это максимальный уровень', 'mx']] : [[`Ур. ${lv + 1} даст`, nxt || '—', 'nx']]), ...(top ? [] : [['Осталось оплатить', leftTxt()], ['У вас', haveTxt()]])] });
      const mlist0 = Object.entries(ml), leftTxt = () => [need ? need + ' з' : ''].concat(mlist0.map(([m, n]) => `${mtn(m)} ${n}`)).filter(Boolean).join(', ') || 'всё собрано',
        haveTxt = () => [`${gold} з`].concat(mlist0.map(([m]) => `${mtn(m)} ${me && me.mt ? +me.mt[m] || 0 : 0}`)).join(', ');
      // fix: постройка на стройке — плитка открывается (видно текущие бонусы), но кнопки вклада неактивны
      const bd = v2 && v2.build ? v2.build : null;
      if (bd) { const k = +bd.left || 0, sw = k % 10 === 1 && k % 100 !== 11 ? 'стрим' : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 10 || k % 100 >= 20) ? 'стрима' : 'стримов', why = `идёт стройка до ур. ${bd.lv} — вкладывать пока нельзя`;
        return { label: `${name} · 🔨 строится`, sub: `ур. ${lv} → ${bd.lv}: ещё ${k} ${sw}`,
          next: [{ note: 1, label: '', lines: [[`Сейчас (ур. ${lv} из ${max})`, now || '—'], ['🔨 Стройка', `до ур. ${bd.lv}: ещё ${k} ${sw}. Вклад откроется, когда стройка закончится`, 'mx'], [`Ур. ${bd.lv} даст`, nxt || '—', 'nx']] },
            { label: '💰 Золото', sub: why, dis: true }, { label: '🪵 Материалы', sub: why, dis: true }] }; }
      if (need == null) return fxOn ? { label: `${name} · ур. ${lv}/${max}`, sub: 'максимальный уровень', next: [info(true)] } : { label: `${name} (ур. ${lv}, максимум)`, sub: '', dis: true }; // v49.6: при px≥497 показываем, что даёт уровень; старая игра — как раньше
      const mlist = Object.entries(ml), left = [need ? need + ' з' : ''].concat(mlist.map(([m, n]) => `${mti(m)}${mtn(m)} ${n}`)).filter(Boolean).join(', ') || 'готово';
      const fx = fxOn ? `Ур. ${lv}/${max} · сейчас: ${now || '—'} · Улучшение: ${nxt || '—'} · ` : '';
      const put = Math.min(gold, need || 0); // v49.8: «всё» списывает не больше остатка до улучшения — показываем реальную сумму
      const goldOpts = [50, 100, 250, 'всё'].filter(a => a === 'всё' || a < need).map(a => a === 'всё'
        ? { label: gold >= need ? `Вложить ${need} з` : gold > 0 ? `Вложить ${gold} з (всё, что есть)` : `Вложить ${need} з`, sub: gold >= need ? `ровно столько осталось до улучшения · у вас ${gold} з` : gold > 0 ? `до улучшения не хватит ${need - gold} з · больше ${gold} з не спишется` : 'нет золота', arg: `${id} всё`, dis: put < 1, confirm: `Вложить ${put} золота в «${name}»? Спишется ровно ${put} з.` } /* v49.8: остаток до улучшения, считается на лету; больше остатка не списывается */
        : { label: `${a} золота`, arg: `${id} ${a}`, dis: gold < a, confirm: `Вложить ${a} золота в «${name}»?` });
      const matOpts = mlist.map(([m, n]) => { const have = me && me.mt ? +me.mt[m] || 0 : 0, k = Math.min(have, n), price = (ref.matP || {})[m] || 0, buy = n - k;
        return { label: `${mti(m)} ${mtn(m)}`, sub: `нужно ${n}, в сумке ${have}`, next: [1, 5, 10].filter(q => q < k).map(q => ({ label: `${mtn(m)}: ${q} из сумки`, arg: `${id} ${m} ${q}`, confirm: `Вложить ${mtn(m).toLowerCase()} ${q} шт. в «${name}»?` }))
          .concat(k ? [{ label: `${mtn(m)}: ${k} из сумки`, arg: `${id} ${m} ${k}`, confirm: `Вложить ${mtn(m).toLowerCase()} ${k} шт. в «${name}»?` }] : [])
          .concat(buy ? [{ label: `Докупить: ${mtn(m)} ${n}${k ? ` (${k} из сумки + ${buy})` : ''}`, sub: `${buy} × ${price} = ${buy * price} з`, dis: gold < buy * price, arg: `${id} ${m} ${n} золотом`, confirm: `Вложить ${mtn(m).toLowerCase()} ${n} шт. в «${name}», докупив ${buy} за ${buy * price} золота?` }] : []) }; });
      return { label: fxOn ? `${name} · ур. ${lv} → ${lv + 1}` : `${name} (ур. ${lv}→${lv + 1})`, sub: fxOn ? `осталось: ${left}` : `${fx}осталось: ${left}`,
        next: [...(fxOn ? [info(false)] : []), { label: '💰 Золото', sub: need ? `осталось ${need} з, у вас ${gold}` : 'золото собрано', dis: !need, next: goldOpts },
          { label: '🪵 Материалы', sub: mlist.length ? mlist.map(([m, n]) => `${mtn(m)} ${n}`).join(', ') : 'материалы не нужны', dis: !mlist.length, next: matOpts }] }; });
    // v7panel4 п.3: продажа — овощ, затем количество (1/5/10/все)
    const crops = [{ label: 'Все овощи сразу', arg: 'всё', confirm: 'Продать ВСЕ овощи на рынке?' }].concat((ref.crops || []).map(([id, n]) => { const have = me && me.veg ? (me.veg[id] || 0) : 0;
      return { label: n, sub: me && me.veg ? `есть ${have}` : '', dis: me && me.veg && !(have > 0),
        next: [1, 5, 10].filter(q => q < have).map(q => ({ label: `${n}: ${q} шт.`, arg: `${n.toLowerCase()} ${q}`, confirm: `Продать ${n.toLowerCase()} — ${q} шт.?` }))
          .concat([{ label: `${n}: все (${have} шт.)`, arg: n.toLowerCase(), confirm: `Продать все: ${n.toLowerCase()} (${have} шт.)?` }]) }; }));
    // v7panel4 п.5: выбор рецепта (ref.recipes: [название, вид, что нужно, ур. открытия]; me.rcp[i]: 1 — открыт, 2 — хватает овощей)
    const recipes = () => [{ label: 'Лучшее из доступного', sub: 'игра выберет сама', arg: '' }].concat((ref.recipes || []).map(([n, kind, need, lv], i) => { const f = me && me.rcp ? me.rcp[i] || 0 : 1, open = f & 1, can = f & 2; return {
      label: (kind === 'potion' ? '🧪 ' : '🍲 ') + n, sub: !open ? `закрыт: нужен ур. ${lv}` : (can ? 'хватает: ' : 'не хватает: ') + need, dis: !open, arg: String(i + 1) + (ref.bc ? ' 1' : ''), confirm: `${kind === 'potion' ? 'Сварить' : 'Приготовить'} «${n}»?` }; }));
    // v49.9 (fs499): цена продажи одной вещи (с учётом заточки / лишней копии) — общая для «Продать вещь» и кузницы
    const sellOffer = (id, n, price) => { const own = me && me.eqOwn || [], worn = Object.values(me && me.eqOn || {}), cnt = own.filter(x => x === id).length, wn = worn.filter(x => x === id).length;
      const can = cnt > wn, e = me && me.esp && me.esp[id], extra = can && wn > 0, lv = e && !extra ? e[1] : 0;
      const pr = e ? (extra ? Math.round((price || 0) * 0.3) : e[0]) : Math.round((price || 0) * 0.3), nm = n + (lv ? ` +${lv}` : '');
      return { can, pr, lv, extra, nm, row: { ic: ref.ic ? (window.__eqIcK ? window.__eqIcK(id) : id) : '', label: nm + (extra ? ' (лишняя копия)' : ''), sub: can ? `кузня · ${pr} з${lv ? ' · с учётом заточки' : ''}` : 'сначала сними вещь', dis: !can, arg: id, cmd: 'продать', confirm: can ? `Продать «${nm}» за ${pr} золота?${lv ? `\nЗаточка +${lv} пропадёт.` : ''}` : '' } }; };
    const shop = () => (ref.eq || []).filter(i => !i[4] || (me && i[4].includes(me.cls))).map(([id, name, price, slot, , bs, stt]) => { // v7panel20 п.2: + статы вещи; v49.9: у своей вещи — Надеть / Продать
      const own = me && (me.eqOwn || []).includes(id), on = me && eqWorn(id);
      const ic = ref.ic ? (window.__eqIcK ? window.__eqIcK(id) : id) : ''; // v7panel21 п.1: иконка вещи на кнопке
      if (!own) return { ic, label: name, sub: `${stt ? stt + ' · ' : ''}${price} з · ${SLOT_RU[slot] || slot}${bs > (ref.bsLv || 1) ? ' · кузница ур.' + bs : ''}`, dis: gold < price || bs > (ref.bsLv || 1), arg: id, confirm: `Купить «${name}» за ${price} золота?` };
      const s = sellOffer(id, name, price);
      return { ic, label: name, sub: (on ? 'надето' : 'есть') + (s.can ? ` · продать за ${s.pr} з` : '') + (stt ? ' · ' + stt : ''), next: [
        { ic, label: 'Надеть', sub: on ? 'уже надето' : 'надеть на героя', dis: on, arg: id, cmd: 'экип' },
        Object.assign({}, s.row, { label: 'Продать' + (s.extra ? ' (лишняя копия)' : '') + (s.lv ? ` +${s.lv}` : '') })
      ] }; });
    // v7panel31: «Сделать ход». ref.tb=0 — только подсказка (без запроса: баллы Twitch списывает только Twitch); tb=1 — ход с пульта, лимит ref.tl за стрим
    const tl = ref.tl || 1, tu = me && me.tu || 0, rw0 = me && me.rw || {};
    const cdLine = (sec, ready, busy) => { sec = +sec || 0; if (sec <= 0) return ready; const m = Math.ceil(sec / 60); return m >= 2 ? busy.replace('N', String(m)) : (sec >= 60 ? busy.replace('N', '1') : 'через ' + sec + ' сек'); };
    const turnInfo = () => {
      const url = ref.ch ? 'https://www.twitch.tv/' + ref.ch : '';
      const rows = [{ label: `Ход — это награда «${ref.trn || 'Сделать ход'}» за баллы канала`, sub: 'Пульт не может тратить баллы. Откройте чат Twitch → значок баллов под чатом → «' + (ref.trn || 'Сделать ход') + '».', note: 1 }];
      if (me && (me.cd != null || me.ccd != null || (me.rw && me.rw.quest != null))) {
        rows.push({ label: 'Поход — ' + cdLine(me.cd, 'готов', 'через N мин'), note: 1 });
        rows.push({ label: 'Готовка — ' + cdLine(me.ccd, 'готова', 'через N мин'), note: 1 });
        const left = me.rw && me.rw.quest != null ? +me.rw.quest : null;
        if (left != null) rows.push({ label: left > 0 ? 'Квесты — осталось ' + left + ' сегодня' : 'Квесты — на сегодня кончились', note: 1 });
      }
      return rows.concat(url ? [{ label: '↗ Открыть чат канала', sub: 'twitch.tv/' + ref.ch, url }] : []);
    };
    const turnBtn = ref.tb ? ['🎲', 'Сделать ход', 'ход', '', tu >= tl ? `с пульта ${tu}/${tl} — дальше в чате` : `с пульта: ${tl - tu} из ${tl}`, `Сделать ход с пульта? Осталось за стрим: ${tl - tu} из ${tl}.`, tu >= tl ? 1 : 0]
      : ['🎲', 'Сделать ход', 'ход', turnInfo, 'награда за баллы канала'];
    // v49.7 (brb498): цирюльник на готовых спрайтах — у каждого цвета превью своего героя img/h/<me.hk>_<цвет>.webp, только доступные цвета (me.ha). Старая игра (px < 498) — как раньше
    const brb = +(ref.px || 0) >= 498 && ref.hb === 1 && !!(me && me.hk);
    const hair = () => (ref.hair || []).filter(([id]) => !brb || !Array.isArray(me.ha) || me.ha.includes(id)).map(([id, n]) => ({ pic: brb && /^[a-z0-9_]{3,40}$/.test(me.hk + '_' + id) ? `img/h/${me.hk}_${id}.webp` : '', label: n, sub: me && me.hair === id ? 'сейчас' : `${ref.hairPrice || 250} з`, dis: (me && me.hair === id) || gold < (ref.hairPrice || 250), arg: brb ? id : n, confirm: `Покрасить волосы в «${n}» за ${ref.hairPrice || 250} золота?` }));
    const guilds = () => (ref.guilds || []).map(([id, n, , ga, gt, gd], i) => ({ label: n, sub: [me && me.gid === id ? 'ваша гильдия' : '', gt != null ? (gd ? `активных ${ga} из ${gt}` : `${gt} чел.`) : ''].filter(Boolean).join(' · '), /* v49.8: активные за gd дней */ dis: me && me.gid === id, arg: String(i + 1), confirm: `Вступить в гильдию «${n}»?` }));
    const quests = () => me && me.q ? [{ label: 'У вас уже есть задание', dis: true }] : (me && me.of || []).map((id, i) => ({ label: `${i + 1}. ${(ref.quests || {})[id] || id}`, arg: String(i + 1) })).concat([{ label: 'Показать список (без хода)', arg: '' }]);
    // v49.8: «Надеть» — только то, что лежит в сумке и не надето (кольцо может быть в слоте ring1 или ring2); дубли id не показываем
    const wear = () => { const L = [...new Set(me && me.eqOwn || [])].filter(id => !eqWorn(id)).map(id => (ref.eq || []).find(i => i[0] === id)).filter(Boolean).map(([id, n, , slot, , , stt]) => ({ ic: ref.ic ? (window.__eqIcK ? window.__eqIcK(id) : id) : '', label: n, sub: (SLOT_RU[slot] || slot) + (stt ? ' · ' + stt : ''), arg: id, confirm: `Надеть «${n}»?` }));
      return L.length ? L : [{ label: 'В сумке нет вещей, которые можно надеть', sub: 'всё купленное уже надето', note: 1 }]; };
    const unwear = () => Object.entries(me && me.eqOn || {}).filter(([, v]) => v).map(([slot, id]) => { const i = (ref.eq || []).find(x => x[0] === id); return { label: `${SLOT_RU[slot] || slot}: ${i ? i[1] : id}`, arg: slot, confirm: `Снять ${i ? '«' + i[1] + '»' : SLOT_RU[slot]}?` }; });
    // v7panel42: починка — цены из снимка me.dr (durCost на сервере); кнопок нет если прочность выкл (нет me.dr)
    const repair = () => { const dr = me && me.dr; if (!dr || !Array.isArray(dr.i) || !dr.i.length) return [];
      const SR = SLOT_RU || {};
      const rows = dr.i.map(([s, pct, cost, id]) => ({ label: `${SR[s] || s}: ${pct}%`, sub: `${cost} з`, arg: String(s), dis: me.gold < cost || !dr.ok, confirm: `Починить «${SR[s] || s}» за ${cost} золота?` }));
      rows.unshift({ label: `Починить всё — ${dr.t} з`, sub: dr.w || '', arg: 'всё', dis: me.gold < dr.t || !dr.ok, confirm: `Починить всё снаряжение за ${dr.t} золота?` });
      return rows; };
    const pets = () => (me && me.pt || []).map(([id, n]) => ({ label: n, sub: me.ptOn === id ? 'с героем' : '', dis: me.ptOn === id, arg: id, cmd: 'экип', confirm: `Взять питомца «${n}»?` })).concat(me && me.ptOn ? [{ label: 'Убрать питомца', arg: 'питомец', cmd: 'снять', confirm: 'Убрать питомца?' }] : []); // v7panel12 п.7
    const titles = () => (me && me.tt || []).map((t, i) => ({ label: t, sub: me.ttOn === t ? 'надет' : '', dis: me.ttOn === t, arg: String(i + 1), confirm: `Надеть титул «${t}»?` })).concat(me && me.ttOn ? [{ label: 'Снять титул', arg: 'снять', confirm: 'Снять титул?' }] : []);
    // v7panel6: подсказки на кнопках «Магия» и «Салат» из снимка игры (me.mg / me.sal)
    const mmss = s => s >= 3600 ? `${Math.floor(s / 3600)} ч ${Math.floor(s % 3600 / 60)} мин` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const dhm = s => s >= 86400 ? `${Math.floor(s / 86400)} дн ${Math.floor(s % 86400 / 3600)} ч` : mmss(s);
    const mg = me && me.mg, sal = me && me.sal;
    const magicSub = !mg ? 'волшебное семечко' : !mg.seeds ? 'нет волшебных семян' : !mg.left ? `0/${mg.max}, завтра` : mg.cd > 0 ? `${mg.left}/${mg.max} · КД ${mmss(mg.cd)}` : `${mg.left}/${mg.max} · готово`;
    const saladSub = !sal ? '🥒5 🍅5 🥕5 🍆5 🎃1' : !sal.left ? `0/${sal.max} · ${dhm(sal.reset)}` : `${sal.left}/${sal.max}${sal.can ? ' · можно' : ' · мало 🥕'}`;
    const saladAsk = 'Приготовить салат? Спишется 🥒5 🍅5 🥕5 🍆5 🎃1' + (sal ? ` (осталось ${sal.left}/${sal.max} за 30 дн.${sal.reset ? ', сброс через ' + dhm(sal.reset) : ''})` : '');
    const hike = me && me.cd > 0 ? `КД ${Math.floor(me.cd / 60)}:${String(me.cd % 60).padStart(2, '0')}` : 'можно';
    // v7panel10: парикмахер виден, но неактивен, пока HAIR_AVAILABLE=false и игра не прислала ref.hairOn (CONFIG.hairRecolor.enabled в игре)
    const hairOk = (HAIR_AVAILABLE || ref.hairOn === true) && (ref.hair || []).length > 0;
    // v7panel44: кузня (eqOwn снятое, 30%) + лут сундука (rpg_gear / me.lgs|lg+ref.gear, 40*tier). Без ref.gear и lgs — старая игра, лут в списке не показываем.
    // v49.8: цена с заточкой и лишние копии — из me.esp {id: [цена, +ур, копий]} (игра ≥ v49.8); иначе старые 30%
    const sellSmith = () => [...new Set(me && me.eqOwn || [])].map(id => { const it = (ref.eq || []).find(i => i[0] === id); return it && sellOffer(it[0], it[1], it[2]); }).filter(s => s && s.can).map(s => s.row);
    const sellLootRows = () => {
      if (!(ref.gear && ref.gear.length) && !(me && me.lgs && me.lgs.length)) return [];
      const rows = (me && me.lgs && me.lgs.length) ? me.lgs : (me && me.lg || []).map(id => { const g = (ref.gear || []).find(x => x[0] === id); return g || null; }).filter(Boolean);
      return rows.map(r => { const id = r[0], n = r[1], price = r[3], bonus = r[4] || 'пассив сундука';
        const t5 = r.length > 5, act = t5 && r[5]; // v49.8: трофей; [5] — активный
        return t5 ? { label: '🏆 Трофей: ' + n, sub: `${price} з · ${act ? 'активный: ' + bonus : 'не действует'}`, arg: 'лут ' + id, confirm: `Продать трофей «${n}» за ${price} золота?${act ? `\nЭто активный трофей: пропадёт ${bonus}, активным станет лучший из оставшихся.` : '\nОн сейчас не действует.'}` }
          : { label: 'лут: ' + n, sub: `пассив · ${price} з · ${bonus}`, arg: 'лут ' + id, confirm: `Продать лут «${n}» за ${price} золота?\nПотеряете пассив: ${bonus}.\nЭто не кузнечная вещь.` }; });
    };
    const sellEq = () => sellSmith().concat(sellLootRows());
    // v49.8: «Трофеи» — отдельно от снаряжения: действует только один, переключение «!экип трофей <id>»
    const trophyList = () => me && me.lgs && me.lgs.length && me.lgs[0].length > 5 ? me.lgs : null;
    const trophies = () => [{ label: 'Действует только один трофей', sub: 'трофеи не надеваются; остальные можно продать («Продать вещь»)', note: 1 }].concat(trophyList().map(r => { const [id, n, , price, bonus, act] = r;
      return { label: (act ? '✓ ' : '') + n, sub: act ? `активный · ${bonus}` : `не действует · дал бы ${bonus} · продажа ${price} з`, arg: 'трофей ' + id, dis: !!act, confirm: `Сделать «${n}» активным трофеем?\nПрежний перестанет действовать.` }; }));
    const trophyBtn = () => { const L = trophyList(); if (!L) return []; const a = L.find(r => r[5]); return [['🏆', 'Трофеи', 'экип', trophies, a ? `активный: ${a[1]}` : `${L.length} шт.`]]; };
    // v8.1: заточка с пульта + справка про осколки и свитки (данные: me.shp из игры ≥ v8.1, ref.sharp)
    const SHS = { weapon: 'Оружие', armor: 'Броня', offhand: 'Левая рука' }, SHA = { weapon: 'оружие', armor: 'броня', offhand: 'левая' };
    const shp = me && (me.shp || (me.sh && typeof me.sh === 'object' ? me.sh : null)), shr = ref.sharp || {};
    const pctS = v => Math.round((+v || 0) * 100) + '%';
    const shardInfo = () => { const d = shr.ds || {}; const L = [];
      if (d.bossWin) L.push(['победа над боссом', '+' + d.bossWin]); if (d.bossTop3) L.push(['топ-3 по урону на боссе', '+' + d.bossTop3]);
      if (d.mimic) L.push(['мимик', 'шанс ' + pctS(d.mimic)]); if (d.legendary) L.push(['легендарный сундук', '+' + d.legendary]); if (d.weeklyParty5) L.push(['недельное «5 пати-походов»', '+' + d.weeklyParty5]);
      return { note: 1, label: '✦ Звёздный осколок — нужен для заточки на +7…+10', lines: L.length ? L : [['падает с боссов, мимиков и легендарных сундуков', '']] }; };
    const luckInfo = () => { const d = shr.dl || {}, cr = shr.cr || [8, 30, 50, 200, 2]; const L = [];
      L.push(['что даёт', `+${pctS(shr.lk || 0.15)} к шансу`]); L.push(['тратится', 'при любой попытке']); L.push(['откат при неудаче', 'не отменяет']);
      if (d.bossTop1) L.push(['1-е место по урону на боссе', 'всегда']); if (d.bossWin) L.push(['победа над боссом', 'шанс ' + pctS(d.bossWin)]);
      if (d.mimic) L.push(['мимик', 'шанс ' + pctS(d.mimic)]); if (d.legendary) L.push(['легендарный сундук', 'шанс ' + pctS(d.legendary)]);
      L.push([`сделать в кузнице ур.${cr[0]}+`, `⛓${cr[1]} 🪵${cr[2]} ${cr[3]} з, ${cr[4]}/нед`]);
      return { note: 1, label: '🍀 Свиток удачи — повышает шанс заточки', lines: L }; };
    const sharpRules = () => ({ note: 1, label: 'Как работает заточка', lines: [['+1…+5', 'всегда успешно'], ['+6…+10', 'шанс, при неудаче откат на +' + (shr.ft || 5)], ['каждая неудача подряд', `+${pctS((shr.pt || [0.1])[0])} к шансу (до ${pctS((shr.pt || [0, 0.3])[1])})`], ['где', 'вне похода и боя с боссом']] });
    const sharpen = () => { if (!shp) return [{ label: 'Заточка пока недоступна', sub: 'начнётся в новом сезоне или нужна новая версия игры', note: 1 }];
      const rows = [{ note: 1, label: `У тебя: ✦ ${shp.s} осколков · 🍀 ${shp.l} свитков`, sub: shp.bz || '' }];
      (shp.q || []).forEach(([s, nm, lv, tgt, ch, chL, g, sh, fe, ft, mx, br]) => {
        if (!nm) { rows.push({ label: `${SHS[s]}: пусто`, sub: 'надень вещь, чтобы точить', dis: true }); return; }
        if (mx) { rows.push({ label: `${SHS[s]}: «${nm}» +${lv}`, sub: 'максимум +10', dis: true }); return; }
        const cost = `${g} з${sh ? ` · ✦${sh}` : ''}${fe ? ` · ⛓${fe}` : ''}`, lack = (me.gold < g ? 'мало золота' : '') || (shp.s < sh ? 'нужен ✦ осколок' : '') || (((me.mt || {}).iron || 0) < fe && me.mt ? 'мало железа' : '');
        const why = br ? 'вещь сломана — сначала почини' : shp.bz || lack;
        const risk = ft ? `\nПри неудаче заточка откатится на +${ft}.` : '';
        const plain = { label: `Точить без свитка — шанс ${ch}%`, sub: cost, arg: SHA[s], dis: !!why, confirm: `Заточить «${nm}» +${lv} → +${tgt}?\nШанс ${ch}%. Цена: ${cost}.${risk}` };
        const lucky = { label: `Со свитком 🍀 — шанс ${chL}%`, sub: cost + ' · 🍀1', arg: SHA[s] + ' удача', dis: !!why || !(shp.l > 0), confirm: `Заточить «${nm}» +${lv} → +${tgt} со свитком удачи?\nШанс ${chL}%. Цена: ${cost} и 1 свиток (сгорит в любом случае).${risk}` };
        const opt = { label: `${SHS[s]}: «${nm}» +${lv} → +${tgt}`, sub: why ? why : `шанс ${ch}% · ${cost}`, dis: !!(br || shp.bz) };
        if (ch >= 100 || why) Object.assign(opt, { arg: plain.arg, confirm: plain.confirm, dis: !!why }); else opt.next = shp.l > 0 ? [plain, lucky] : [plain, Object.assign(lucky, { sub: 'нет свитков' })];
        rows.push(opt); });
      const lc = shp.lc || [0, 8, 30, 50, 200, 2];
      rows.push({ label: '🍀 Сделать свиток удачи', sub: lc[0] ? `⛓${lc[2]} 🪵${lc[3]} ${lc[4]} з · осталось ${shp.k}/${lc[5]} на неделе` : `нужна кузница ур.${lc[1]}`, arg: 'крафт', dis: !lc[0] || !(shp.k > 0) || !!shp.bz, confirm: `Сделать свиток удачи за ⛓${lc[2]} железа, 🪵${lc[3]} дерева и ${lc[4]} золота?` });
      rows.push({ label: '📖 Что такое осколки и свитки', sub: 'откуда берутся и зачем', next: [sharpRules(), shardInfo(), luckInfo()] });
      return rows; };
    const sharpBtn = () => shp || shr.cost ? [['✨', 'Заточка', 'заточка', sharpen, shp ? `✦${shp.s} 🍀${shp.l}` : 'обновите игру']] : [];
    const px494 = +(ref && ref.px) >= 494; // v49.4: игра понимает «снять квест» и «купить семена N»
    const hairBtn = hairOk ? ['💈', 'Парикмахер', 'парикмахер', hair, `${ref.hairPrice || 250} з`] : ['💈', 'Парикмахер', 'парикмахер', '', HAIR_OFF_TEXT, null, true];
    return {
      town: [['📜', 'Задание', 'квест', quests, me && me.rw && me.rw.quest > 0 ? `осталось: ${me.rw.quest}` : 'квесты кончились'],
        ['✖', 'Отменить квест', 'снять', 'квест', !px494 ? 'обновите игру до v49.4' : me && me.q ? 'квест сгорит' : 'нет квеста', me && me.q ? 'Отменить квест? Он сгорит.' : null, !px494 || !(me && me.q)], // v49.4: relay не знает «отмена» — шлём «снять квест» (понимает game.js v49.4)
        ['⚒', 'Кузница', 'купить', shop, 'купить / надеть / продать'], ...(me && me.dr && me.dr.i && me.dr.i.length ? [['🔧', 'Починить', 'чинить', repair, 'у кузницы · ' + me.dr.t + ' з']] : []), ...sharpBtn(), hairBtn,
        ['🏗', 'Вклад', 'вклад', () => bldPick('town'), 'в постройку города'], ['💰', 'Продать', 'продать', () => crops, 'овощи на рынке']],
      garden: [['🚶', 'На огород', 'огород', '', 'к своей грядке'], ['🌰', 'Семена', 'семена', '', '3 в день'], (px494 ? ['💰', 'Купить семена', 'купить', () => [1, 3, 5].map(k => ({ label: k + ' шт.', sub: k * 150 + ' з', arg: 'семена ' + k, confirm: `Купить ${k} шт. семян за ${k * 150} золота?` })), '150 з/шт'] : ['💰', 'Купить семена', 'купить', '', 'обновите игру до v49.4', null, true]), ['🌱', 'Посадить', 'посадить', '', ''],
        ['⏳', 'Грядка', 'грядка', '', 'сколько ждать'], ['🐞', 'Жуки', 'жуки', '', 'отогнать'], ['🧺', 'Собрать', 'собрать', '', 'урожай'],
        ['✨', 'Магия', 'магия', '', magicSub], ['🔁', 'Обмен', 'обмен', '', '10 сорняков → овощ', 'Обменять 10 сорняков на овощ?'], ['🥗', 'Салат', 'салат', '', saladSub, saladAsk], ['📦', 'Урожай', 'урожай', '', 'что у меня есть'],
        ['🍲', 'Готовить', 'готовить', recipes, me && me.ccd > 0 ? `КД ${Math.floor(me.ccd / 60)}:${String(me.ccd % 60).padStart(2, '0')}` : 'можно'], ['💰', 'Продать', 'продать', () => crops, 'овощи'], ['🏗', 'Вклад', 'вклад', () => bldPick('garden'), 'в сарай']],
      camp: [['🏰', 'Гильдия', 'гильдия', guilds, me && me.gd ? me.gd : 'выбрать'],
        ['✔', 'Да', 'да', '', 'подтвердить гильдию'], ['✖', 'Нет', 'нет', '', 'отменить выбор'], ['🏗', 'Вклад', 'вклад', () => bldPick('camp'), 'костёр, палатка']],
      forest: [['⚔', 'В поход', 'поход', '', hike], ...(me ? [turnBtn] : []), ['🛡', 'Пати-поход', 'пати', '', me && me.pty ? 'вы в очереди' : 'вместе с другими']],
      boss: bossOrder(me, [['☠', 'Записаться', 'босс', '', 'в отряд на босса'], ['👊', 'Удар', 'удар', '', 'раз в 60 с'], ['💚', 'Лечить', 'лечить', '', 'раз в 30 с'],
        ['💫', 'Оглушить', 'оглушить', '', 'красный каст'], ['🕸', 'Связать', 'связать', '', 'жёлтый каст'], ['🔮', 'Очистить', 'очистить', '', 'фиолетовый каст'],
        ['🐌', 'Замедлить', 'замедлить', '', 'замедлить каст'], ['🛡', 'Заслон', 'заслон', '', 'щит отряду'], ['🎯', 'Прикрыть', 'прикрыть', '', 'принять удар Метки'], ['✝', 'Воскресить', 'воскресить', '', 'поднять союзника']]),
      me: me ? [turnBtn, ['🎒', 'Надеть', 'экип', wear, 'своё снаряжение'], ['🧤', 'Снять', 'снять', unwear, 'вещь со слота'], ['💰', 'Продать вещь', 'продать', sellEq, 'кузня · трофеи'], ...trophyBtn(), ['🏷', 'Титул', 'титул', titles, me.ttOn || 'выбрать'],
        ...(me.pt && me.pt.length ? [['🐾', 'Питомец', 'экип', pets, ((me.pt.find(p => p[0] === me.ptOn) || [])[1]) || 'не взят']] : []),
        hairBtn, ['🏰', 'Гильдия', 'гильдия', guilds, me.gd || 'выбрать'], ['⚒', 'Кузница', 'купить', shop, 'купить / надеть / продать'], ...(me.dr && me.dr.i && me.dr.i.length ? [['🔧', 'Починить', 'чинить', repair, 'у кузницы · ' + me.dr.t + ' з']] : []), ...sharpBtn()]
        : [['🧙', 'Стать героем', 'вступить', '', 'нужна награда канала']]
    };
  }
  // v7panel22 п.2: босс — кнопки своего класса сверху, чужие ниже группой «Не твой класс» (неактивны). Правила — bosscore.js CC (+ !удар/!лечить/!босс — всем)
  const BOSS_CLS = { оглушить: ['paladin', 'warrior'], связать: ['archer', 'assassin'], очистить: ['priest'], замедлить: ['mage'], заслон: ['paladin'], прикрыть: ['paladin', 'warrior'], воскресить: ['priest'] };
  const CLS_RU = { warrior: 'воин', paladin: 'паладин', archer: 'лучник', assassin: 'ассасин', mage: 'маг', priest: 'жрец' };
  const BOSS_ORD = { priest: ['босс', 'очистить', 'воскресить', 'лечить', 'удар'], paladin: ['босс', 'заслон', 'оглушить', 'прикрыть', 'удар', 'лечить'], warrior: ['босс', 'оглушить', 'прикрыть', 'удар', 'лечить'],
    archer: ['босс', 'связать', 'удар', 'лечить'], assassin: ['босс', 'связать', 'удар', 'лечить'], mage: ['босс', 'замедлить', 'удар', 'лечить'] };
  function bossOrder(me, L) {
    const cls = me && me.cls; if (!cls || !BOSS_ORD[cls]) return L;
    const HINT = {
      paladin: { заслон: 'щит отряду · общий откат с Оглушить', оглушить: 'красный каст · общий откат с Заслоном' },
      priest: { очистить: 'фиолетовый каст · общий откат с Воскресить', воскресить: 'поднять союзника · общий откат с Очистить' }
    };
    const hint = HINT[cls] || {};
    const ord = BOSS_ORD[cls], mine = ord.map(c => L.find(d => d[2] === c)).filter(Boolean).map(d => { const x = d.slice(); if (hint[x[2]]) x[4] = hint[x[2]]; return x; });
    const rest = L.filter(d => !ord.includes(d[2])).map(d => { const w = (BOSS_CLS[d[2]] || []).map(c => CLS_RU[c]).join(', '); const x = d.slice(); x[4] = 'только: ' + w; x[6] = 1; x[7] = 'other'; return x; });
    return mine.concat(rest);
  }
  window.__bossOrder = bossOrder;
  // v49.10: откаты кнопок босса. Игра v49.10+ шлёт me.bk (сек на момент снимка): c — общий КД контроля (один на все умения), l — блок за спам/не то окно,
  // s — !удар, h — !лечить, r — воскрешение/очищение, q — антиспам чата по командам. Старая игра bk не шлёт — тогда берём секунды из ответа игры.
  // Нажатие во время КД/блока игра наказывает блоком 20 с (spamLockout), поэтому кнопка на откате неактивна и показывает отсчёт.
  const CC_CMDS = ['оглушить', 'связать', 'очистить', 'замедлить', 'заслон'], BOSS_CMDS = ['босс', 'удар', 'лечить', 'воскресить', 'прикрыть'].concat(CC_CMDS);
  const LOC = {}; // cmd → [до (ms), предположение?]
  const setLoc = (cmds, sec, guess) => { const t = Date.now() + sec * 1000; cmds.forEach(c => { const o = LOC[c]; if (!o || o[0] < t || (o[1] && !guess)) LOC[c] = [t, !!guess]; }); };
  function bossReply(cmd, m) {
    if (!BOSS_CMDS.includes(cmd)) return; const msg = String(m.msg || ''); let x;
    if ((x = /блок (\d+)\s*с/.exec(msg))) setLoc(CC_CMDS, +x[1]); // блок общий на все умения контроля
    if ((x = /(?:откате|ещё) (\d+)\s*с/.exec(msg))) setLoc(cmd === 'очистить' || cmd === 'воскресить' ? (/откате/.test(msg) ? ['очистить', 'воскресить'] : [cmd]) : [cmd], +x[1]);
    if ((x = /^кулдаун(?: (\d+))?/.exec(msg))) setLoc([cmd], x[1] ? +x[1] : 5, !x[1]);
    if (m.ok) { if (cmd === 'удар') setLoc([cmd], 60, 1); else if (cmd === 'лечить') setLoc([cmd], 30, 1); else if (cmd === 'воскресить') setLoc(['воскресить', 'очистить'], 60, 1);
      else if (CC_CMDS.includes(cmd)) { setLoc(CC_CMDS, 20, 1); if (cmd === 'очистить' && /отброшен/.test(msg)) setLoc(['воскресить'], 60, 1); } }
  }
  function bossKo() {
    const P = window.__panel, st = P && P.state, me = st && st.me, bk = me && me.bk;
    if (!(st && st.boss && st.boss.ph === 'fight' && me)) return false;
    if (bk && +bk.d) return true;
    return (me.hp != null && +me.hp <= 0 && (me.mode === 'boss' || me.loc === 'boss'));
  }
  function bossLeft(cmd) {
    if (!BOSS_CMDS.includes(cmd)) return 0;
    if (cmd !== 'босс' && bossKo()) return 1;
    const P = window.__panel, st = P && P.state, me = st && st.me, bk = me && me.bk, now = Date.now(); let v = 0;
    if (bk && st.boss && st.boss.ph === 'fight') { const age = (now - (st._rx || st.t || now)) / 1000, g = k => Math.max(0, (+bk[k] || 0) - age);
      v = CC_CMDS.includes(cmd) ? Math.max(g('c'), g('l'), cmd === 'очистить' ? g('r') : 0) : cmd === 'удар' ? g('s') : cmd === 'лечить' ? g('h') : cmd === 'воскресить' ? g('r') : 0;
      const q = bk.q && +bk.q[cmd]; if (q) v = Math.max(v, q - age); }
    const o = LOC[cmd]; if (o && o[0] > now && !(bk && o[1])) v = Math.max(v, (o[0] - now) / 1000);
    return v > 0.05 ? Math.ceil(v) : 0;
  }
  function bossLock(cmd) {
    if (!BOSS_CMDS.includes(cmd)) return { n: 0, text: '' };
    const P = window.__panel, st = P && P.state, me = st && st.me, bk = me && me.bk;
    if (cmd !== 'босс' && bossKo()) return { n: 1, text: 'в нокауте' };
    const n = bossLeft(cmd);
    const why = bk && bk.why && bk.why[cmd];
    if (why && n) return { n, text: why };
    if (n) return { n, text: '⏳ откат ' + n + ' с' };
    return { n: 0, text: '' };
  }
  function bossCdTick() {
    document.querySelectorAll('button[data-bc]').forEach(b => { const lock = bossLock(b.dataset.bc), sm = b.querySelector('small');
      if (lock.n) { b.disabled = true; b.classList.add('bcd'); if (sm) sm.textContent = lock.text; }
      else if (b.classList.contains('bcd')) { b.classList.remove('bcd'); if (sm) sm.textContent = b.dataset.sub || ''; if (b.dataset.en === '1') b.disabled = false; } });
    document.querySelectorAll('#castbox button[data-cc]').forEach(b => { const lock = bossLock(b.dataset.cc);
      if (lock.n) { if (!b.disabled || b.dataset.cdx === '1') { b.disabled = true; b.dataset.cdx = '1'; b.dataset.cdt = lock.text; } }
      else if (b.dataset.cdx === '1') { b.disabled = false; delete b.dataset.cdx; delete b.dataset.cdt; } });
  }
  setInterval(bossCdTick, 250);
  window.__bossLeft = bossLeft; window.__bossLock = bossLock;
  let ctxNow = null, curList = [];
  function render(el, ctx) {
    ctxNow = ctx; if (!el) return;
    const on = ctx.online, list = (defs(ctx)[ctx.tab] || []);
    curList = list;
    const title = { town: 'Город', garden: 'Огород', camp: 'Лагерь', forest: 'Лес', boss: 'Босс', me: 'Мой герой' }[ctx.tab] || '';
    const rwn = (ctx.ref && ctx.ref.trn) || 'Сделать ход', rwHint = on && ctx.me && ctx.me.rws === 0 ? `<div class="rwhint">🎲 Вы ещё не прожали «${esc(rwn)}» в этом стриме — прожмите награду за баллы канала${ctx.ref && ctx.ref.tb ? ' или кнопку «Ход»' : ''}</div>` : ''; // v8.1
    el.innerHTML = `${rwHint}<h2>Действия: ${esc(title)}</h2>${!on ? '<p class="note">Кнопки работают, когда идёт стрим.</p>' : !ctx.me && ctx.tab !== 'me' ? '<p class="note">У вас пока нет героя — кнопки появятся, когда он будет.</p>' : ''}
      <div class="acts">${list.map((d, i) => { const grp = d[7] === 'other' && (!list[i - 1] || list[i - 1][7] !== 'other') ? '<div class="agrp">Не твой класс</div>' : ''; const busy = Object.values(pend).some(p => p.cmd === d[2]);
        const bc = ctx.tab === 'boss' && !d[6] && BOSS_CMDS.includes(d[2]) ? ` data-bc="${d[2]}" data-sub="${esc(d[4] || '')}" data-en="${!on || (!ctx.me && d[2] !== 'вступить') || busy ? 0 : 1}"` : '';
        return `<button class="act${busy ? ' busy' : ''}${d[6] ? ' off' : ''}" data-a="${i}"${bc}${d[6] ? ' disabled aria-disabled="true" title="' + esc(d[4]) + '"' : !on || (!ctx.me && d[2] !== 'вступить') || busy ? ' disabled' : ''}><span class="ai">${d[0]}</span><span class="al">${esc(d[1])}</span><small>${esc(d[4] || '')}</small></button>`.replace(/^/, grp); }).join('')}</div>
      <div class="cres" aria-live="polite">${results.map(r => `<div class="${r.ok ? 'ok' : r.ok === false ? 'bad' : 'wait'}">${r.ok ? '✔' : r.ok === false ? '✖' : '…'} <b>${esc(r.label)}</b>: ${esc(r.msg)}</div>`).join('')}</div>`;
    bossCdTick();
  }
  // окно выбора/подтверждения
  function sheet(title, opts) {
    const s = document.getElementById('sheet'); s.hidden = false;
    s.innerHTML = `<div class="sbox"><h3>${esc(title)}</h3><div class="sopts">${opts.length ? opts.map((o, i) => o.note ? (o.lines ? `<div class="snote sinfo">${o.label ? `<b>${esc(o.label)}</b>` : ''}${o.lines.map(([k, v, c]) => `<div class="sl${c ? ' ' + c : ''}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>` : `<p class="snote"><b>${esc(o.label)}</b><br>${esc(o.sub || '')}</p>`) : `<button data-o="${i}"${o.dis ? ' disabled' : ''}${o.pic ? ' class="hasp"' : ''}>${o.pic ? `<img class="opic" src="${esc(o.pic)}" alt="" onerror="this.remove()"><span class="otx">` : ''}<span class="al">${o.ic ? `<img class="oic" src="img/ic/${esc(String(o.ic).split('~')[0])}.png" alt=""${+String(o.ic).split('~')[1] ? ` style="filter:hue-rotate(${+String(o.ic).split('~')[1]}deg)"` : ''} onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'oic icfb',textContent:'${/^ring/.test(o.ic) ? '💍' : /^(amu|t\d)/.test(o.ic) ? '📿' : '🎒'}'}))">` : ''}${esc(o.label)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}${o.pic ? '</span>' : ''}</button>`).join('') : '<p class="note">Выбрать пока нечего.</p>'}</div><button class="scancel" data-o="x">Отмена</button></div>`;
    s.onclick = e => { const b = e.target.closest('button'); if (!b && e.target !== s) return; if (e.target === s || b.dataset.o === 'x') return close(); const o = opts[+b.dataset.o]; if (o && o.go) o.go(); };
  }
  function close() { const s = document.getElementById('sheet'); s.hidden = true; s.innerHTML = ''; }
  function ask(d, arg, label, confirm, cmd) {
    if (confirm) return sheet(confirm, [{ label: 'Да, выполнить', go: () => { close(); fire(cmd || d[2], arg, label); } }]);
    close(); fire(cmd || d[2], arg, label);
  }
  function choose(d, opts, title) {
    sheet(title, opts.map(o => Object.assign({}, o, { go: () => o.url ? window.open(o.url, '_blank', 'noopener') : o.next ? choose(d, o.next, o.label) : ask(d, o.arg, d[1] + (o.label ? ' · ' + o.label : ''), o.confirm, o.cmd) })));
  }
  function click(i) {
    const d = curList[i]; if (!d || d[6]) return; if (bossLeft(d[2])) return; // v7panel10: выключенная кнопка команду не шлёт
    if (typeof d[3] === 'function') return choose(d, d[3](), d[1]);
    ask(d, d[3] || '', d[1], d[5]);
  }
  function fire(cmd, arg, label, cb) { // v47: cb(ответ) — для кнопок в карточке (сеты)
    const id = 'c' + (++seq); pend[id] = { cmd, label, cb };
    push({ id, label, msg: 'отправляю…', ok: null });
    window.__panelSend({ type: 'cmd', id, cmd, arg: arg || '' });
    setTimeout(() => { if (pend[id]) done({ id, ok: false, msg: 'нет ответа — проверьте связь' }); }, 12000);
  }
  const resHooks = [];
  function push(r) { results = [r].concat(results.filter(x => x.id !== r.id)).slice(0, 4); window.__panel && window.__panel.render(); resHooks.forEach(fn => { try { fn(results); } catch (e) {} }); }
  function done(m) { const p = pend[m.id]; if (!p) return; delete pend[m.id]; try { bossReply(p.cmd, m); } catch (e) {} push({ id: m.id, label: p.label, msg: m.msg || (m.ok ? 'готово' : 'не получилось'), ok: !!m.ok }); if (typeof p.cb === 'function') { try { p.cb(m); } catch (e) {} } }
  document.addEventListener('click', e => { const b = e.target.closest('button.act'); if (b && !b.disabled) click(+b.dataset.a); });
  function activate(d) { if (!d || d[6]) return; if (bossLeft(d[2])) return; if (typeof d[3] === 'function') return choose(d, d[3](), d[1]); ask(d, d[3] || '', d[1], d[5]); }
  window.PanelActions = { render, done, defs, fire, activate, results: () => results.slice(), onResult: fn => { if (typeof fn === 'function') resHooks.push(fn); }, sellList: ctx => { const d = defs(ctx).me || []; const b = d.find(x => x[2] === 'продать'); return b && typeof b[3] === 'function' ? b[3]() : []; } };
})();
