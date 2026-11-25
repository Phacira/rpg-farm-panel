// ============================================================
//  ЯДРО БОЯ С БОССОМ (v5). Чистая логика без картинок.
//  Его используют И игра (game.js), И тест-симуляция (tests/boss_sim.js),
//  поэтому проценты побед в FARM_RULES.md считаются тем же кодом, что идёт на стриме.
// ============================================================
(function (root) {
  'use strict';
  // роли: кто может быть танком / лекарем / бойцом
  const ROLE = {
    paladin: { tank: 1, heal: 0.5, dps: 0 }, warrior: { tank: 0.5, heal: 0, dps: 1 },
    priest: { tank: 0, heal: 1, dps: 0 }, mage: { dps: 1 }, archer: { dps: 1 }, assassin: { dps: 1 },
  };
  // способности контроля: кто может, в каком окне сильны
  const CC = {
    stun:   { cmd: '!оглушить', classes: ['paladin', 'warrior'], win: 'red',    name: 'Оглушить' },
    bind:   { cmd: '!связать',  classes: ['archer', 'assassin'], win: 'yellow', name: 'Связать' },
    purge:  { cmd: '!очистить', classes: ['priest'],             win: 'purple', name: 'Очистить' },
    slow:   { cmd: '!замедлить', classes: ['mage'],              win: '*',      name: 'Замедлить' },
    revive: { cmd: '!воскресить', classes: ['priest'],          win: '*',      name: 'Воскрешение', noCast: 1 }, // v6.37: не контроль каста, общий откат с !очистить
    wall:   { cmd: '!заслон',   classes: ['paladin'],            win: '*',      name: 'Заслон' },
    cover:  { cmd: '!прикрыть', classes: ['paladin', 'warrior'], win: '*',      name: 'Прикрыть', noCast: 1 }, // v8: фаза 2 — принять удар по Метке на себя (свой откат, не общий)
  };
  const WIN = { red: { name: 'КРАСНОЕ', need: 'stun', color: '#e0453a' }, yellow: { name: 'ЖЁЛТОЕ', need: 'bind', color: '#e8c33a' }, purple: { name: 'ФИОЛЕТОВОЕ', need: 'purge', color: '#a35ae0' } };

  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // ---------- отряды по 5: 1 танк, 1 лекарь, 3 бойца ----------
  // list: [{id, cls, guild}] в порядке записи. squadsFor(guild) -> сколько отрядов можно гильдии.
  // v8: opt.mixed — гильдии собирают только ПОЛНЫЕ отряды (до squadsFor(g)), все остальные (остатки гильдий и герои без гильдии)
  // складываются в сборные отряды guild:'_mix' по ролям; opt.max — потолок отрядов всего. Без opt — как раньше (отряд на гильдию).
  function formSquads(list, size, squadsFor, opt) {
    if (opt && opt.mixed) return formMixed(list, size, squadsFor, opt);
    const byG = {};
    list.forEach(m => (byG[m.guild || '_solo'] = byG[m.guild || '_solo'] || []).push(m));
    const squads = [], reserve = [];
    for (const g in byG) {
      const pool = byG[g].slice(), max = squadsFor(g);
      squads.push(...buildSquads(pool, g, max, size, false));
      pool.forEach(m => reserve.push(m));
    }
    return { squads, reserve };
  }
  function formMixed(list, size, squadsFor, opt) {
    const byG = {}, squads = [], mix = [], cap = opt.max || 99;
    list.forEach(m => (byG[m.guild || '_solo'] = byG[m.guild || '_solo'] || []).push(m));
    for (const g in byG) {
      const pool = byG[g].slice();
      if (g !== '_solo' && g !== '_mix') { const full = Math.min(squadsFor(g) || 0, Math.floor(pool.length / size), cap - squads.length); if (full > 0) squads.push(...buildSquads(pool, g, full, size, true)); }
      mix.push(...pool);
    }
    const n = Math.min(Math.ceil(mix.length / size), Math.max(0, cap - squads.length));
    if (n > 0) { const tg = Math.ceil(mix.length / n), made = buildSquads(mix, '_mix', n, size, true, tg);
      // остаток (если роли раскидались неровно) — дозаполнить отряды до size
      made.forEach(sq => { while (mix.length && sq.members.length < size) { const x = mix.shift(); sq.members.push(x); sq.dps.push(x); } sq.need = []; if (!sq.tank) sq.need.push('танк'); if (!sq.healer) sq.need.push('лекарь'); if (sq.members.length < size) sq.need.push(`бойцы ×${size - sq.members.length}`); });
      squads.push(...made); }
    return { squads, reserve: mix };
  }
  // собрать n отрядов из pool (pool уменьшается); exact — только полные (для гильдейских пятёрок)
  function buildSquads(pool, g, max, size, exact, target) {
    const sz = target || size; // v8: в сборных — поровну (6 человек → 3+3, а не 5+1)
    const squads = [];
    {
      const take = f => { const i = pool.findIndex(f); return i < 0 ? null : pool.splice(i, 1)[0]; };
      // v6.55 п.9: сначала раздаём танков по всем отрядам гильдии, потом лекарей (паладин — лекарем только если лишний), потом бойцов.
      // Раньше 2 паладина без жреца уходили в один отряд (танк + «лекарь»), а второй отряд показывал «нужен танк».
      const n = exact ? max : Math.min(max, Math.max(1, Math.ceil(pool.length / size))), mine = [];
      for (let k = 0; k < n && pool.length; k++) mine.push({ guild: g, tank: null, healer: null, dps: [] });
      mine.forEach(sq => { sq.tank = take(m => m.cls === 'paladin') || take(m => m.cls === 'warrior'); });
      mine.forEach(sq => { sq.healer = take(m => m.cls === 'priest') || (mine.every(s => s.tank) ? take(m => m.cls === 'paladin') : null); });
      for (const sq of mine) {
        while (sq.dps.length < sz - 2) { const d = take(m => ROLE[m.cls] && ROLE[m.cls].dps) || take(() => true); if (!d) break; sq.dps.push(d); }
        if (!sq.healer && pool.length && sq.dps.length < sz - 1) { const x = take(() => true); if (x) sq.dps.push(x); }
        if (!sq.tank && pool.length && sq.dps.length + (sq.healer ? 1 : 0) < sz) { const x = take(() => true); if (x) sq.dps.push(x); }
      }
      for (const sq of mine) {
        if (!sq.members) sq.members = [sq.tank, sq.healer, ...sq.dps].filter(Boolean);
        if (!sq.members.length) continue;
        sq.need = []; if (!sq.tank) sq.need.push('танк'); if (!sq.healer) sq.need.push('лекарь'); if (sq.members.length < size) sq.need.push(`бойцы ×${size - sq.members.length}`);
        squads.push(sq);
      }
    }
    return squads;
  }
  function roleIn(sq, id) { if (sq.tank && sq.tank.id === id) return 'tank'; if (sq.healer && sq.healer.id === id) return 'healer'; return 'dps'; }

  // ---------- бой ----------
  // members: [{id, cls, maxhp, atk, def, squad}] ; reserve: те же поля (squad = индекс гильдии-отряда или -1)
  function newFight(BE, def, squads, reserveList, statsOf) {
    const F = { t: 0, BE, def, squads: [], all: {}, reserve: [], boss: {}, cast: null, castT: BE.cast.first, enrage: 0, events: [], cc: { used: 0 } };
    squads.forEach((sq, si) => {
      const S = { guild: sq.guild, ids: [], hasTank: !!sq.tank, hasHeal: !!sq.healer, need: sq.need, hitT: BE.hitEvery * (0.5 + si * 0.13), aoeT: BE.aoeEvery * (0.6 + si * 0.1), wall: 0 };
      sq.members.forEach(m => { const u = mk(m, si, roleIn(sq, m.id), statsOf); F.all[m.id] = u; S.ids.push(m.id); });
      F.squads.push(S);
    });
    reserveList.forEach(m => { const u = mk(m, -1, 'reserve', statsOf); F.all[m.id] = u; F.reserve.push(m.id); });
    const n = Object.keys(F.all).length - F.reserve.length;
    // v8: hpPerAtk — HP босса от силы отряда (сумма атаки бойцов с поправкой класса), а не от числа голов
    // hpIncompleteK — бойцы отрядов без танка/лекаря или неполных добавляют боссу меньше HP (им и так тяжелее)
    const sqK = si => (F.squads[si] && F.squads[si].need && F.squads[si].need.length ? (BE.hpIncompleteK || 1) : 1);
    // сумма «сырой» атаки (без поправки класса), чтобы отряд из одних паладинов/жрецов не получал крошечного босса
    const base = BE.hpPerAtk > 0 ? Object.values(F.all).filter(u => u.sq >= 0).reduce((a, u) => a + u.atk * sqK(u.sq), 0) * BE.hpPerAtk : BE.baseHp + BE.hpPerHero * n;
    F.boss = { maxhp: Math.round(base * (dv(BE, def, 'hp') || 1) * (1 + (BE.hpPerExtraSquad || 0) * Math.max(0, F.squads.length - 1))), hp: 0 }; F.boss.hp = F.boss.maxhp;
    F.ph = { n: 1 }; F.deaths = 0;
    F.endAt = BE.durationMinutes * 60;
    return F;
  }
  function mk(m, si, role, statsOf) {
    const s = statsOf ? statsOf(m) : m;
    return { id: m.id, cls: m.cls, guild: m.guild, sq: si, role, maxhp: s.maxhp, hp: s.hp !== undefined ? Math.min(s.hp, s.maxhp) : s.maxhp, shield: s.shield || 0, atk: s.atk, def: s.def, dead: 0, cd: 0, lock: 0, last: -99, n: 0, opened: 0, wasReserve: role === 'reserve', subbed: false };
  }
  const alive = u => u && !u.dead;
  // v8: средний множитель урона класса по боссу (маг — залп раз в 3 удара, ассасин — криты, воин ×1.4, паладин ×0.7, жрец бьёт вполсилы)
  const ATKK = { mage: 1.5, assassin: 1.3, warrior: 1.4, paladin: 0.7, priest: 0.5, archer: 1 };
  function atkK(BE, cls) { const c = (BE.classMods || {})[cls] || {}; return (ATKK[cls] || 1) * (cls === 'paladin' ? 1 : (c.atkMult === undefined ? 1 : c.atkMult)); }
  const PH = BE => BE.phases || null;
  // v8: в режиме ударов в долях HP (hitShare) у босса свои множители hp8/hit8 (поздние боссы считались под рост уровня); нет — обычные hp/hit
  const dv = (BE, def, k) => (BE.hitShare > 0 && def && def[k + '8'] != null ? def[k + '8'] : def && def[k]);
  function sqMult(F, S) { const BE = F.BE; return (1 + (S.hasTank ? 0 : BE.noTankMult) + (S.hasHeal ? 0 : BE.noHealerMult) + Math.max(0, BE.squadSize - S.ids.length) * BE.missingMult) * (1 + F.enrage) * (dv(BE, F.def, 'hit') || 1); }
  function refreshRoles(F, S) {
    // роль «есть», только если её носитель жив
    S.hasTank = S.ids.some(id => alive(F.all[id]) && F.all[id].role === 'tank');
    S.hasHeal = S.ids.some(id => alive(F.all[id]) && F.all[id].role === 'healer');
  }
  function damage(F, u, raw, kind) {
    const BE = F.BE, c = BE.classMods[u.cls] || {};
    const rr = raw * (1 - (u.role === 'tank' ? (c.dmgReduce || c.tankReduce || 0) : (c.dmgReduce || 0) * 0.5)), CF = typeof window !== 'undefined' && window.CONFIG, md = BE.minDmg != null ? +BE.minDmg : CF && CF.armorMinDmg != null ? +CF.armorMinDmg : CF ? 0.4 : 0; let d = Math.max(rr - u.def, rr * md); // v9c: броня гасит не больше (1−armorMinDmg) удара
    d = Math.max(1, Math.round(d)); let sh = 0; if (u.shield > 0) { sh = Math.min(u.shield, d); u.shield -= sh; d -= sh; } u.hp -= d; F.events.push({ e: 'hurt', id: u.id, d, kind, sh });
    if (u.hp <= 0) { u.hp = 0; F.deaths = (F.deaths || 0) + 1; u.dead = F.t + BE.reviveSeconds; u.diedAt = F.t; if (u.sq >= 0) { u.fromSq = u.sq; u.fromRole = u.role; } F.events.push({ e: 'dead', id: u.id }); swapIn(F, u); }
  }
  // запасной заменяет павшего (сначала — той же гильдии и подходящей роли)
  function swapIn(F, u) {
    if (u.sq < 0) return; const S = F.squads[u.sq];
    const all = F.reserve.map(id => F.all[id]).filter(r => alive(r));
    let ok = S.guild === '_mix' ? all : all.filter(r => (r.guild || '_solo') === (S.guild || '_solo'));
    if (!ok.length && F.BE.mixedSquads) ok = all; // v8: своей гильдии в запасе нет — встаёт любой
    if (!ok.length) return;
    const want = u.role === 'tank' ? ['paladin', 'warrior'] : u.role === 'healer' ? ['priest', 'paladin'] : ['mage', 'archer', 'assassin', 'warrior'];
    const r = ok.find(x => want.includes(x.cls)) || ok[0];
    F.reserve.splice(F.reserve.indexOf(r.id), 1); F.reserve.push(u.id);
    r.sq = u.sq; r.role = want.includes(r.cls) ? u.role : 'dps'; r.subbed = true; u.sq = -1; u.role = 'reserve';
    S.ids[S.ids.indexOf(u.id)] = r.id;
    F.events.push({ e: 'swap', out: u.id, in: r.id });
  }
  function heroHit(F, u, mult, tag) {
    const BE = F.BE, c = BE.classMods[u.cls] || {}, r = F.rnd;
    let d = u.atk * (0.85 + r() * 0.3) * (mult || 1) * (c.atkMult === undefined ? 1 : c.atkMult); let t = tag || '';
    if (u.cls === 'assassin') { if (!u.opened) { d *= 2; u.opened = 1; t = t || 'ИЗ ТЕНИ'; } else if (r() < 0.3) { d *= 2; t = t || 'КРИТ'; } }
    if (u.cls === 'mage') { u.n++; if (u.n % 3 === 0) { d *= 2.5; t = t || 'ЗАЛП'; } }
    if (u.cls === 'warrior') d *= 1.4;
    d = Math.round(d);
    const P = PH(BE), sl = F.seal;
    if (sl && !sl.done) { // v8: под Печатью босс неуязвим — урон идёт в замок своего отряда, после — в самый целый чужой
      let L = sl.locks[u.sq]; if (!L || L.hp <= 0) L = sl.locks.filter(x => x.hp > 0).sort((a, b) => b.hp - a.hp)[0];
      if (L) { const was = L.hp; L.hp = Math.max(0, L.hp - d); F.events.push({ e: 'deal', id: u.id, d, tag: t, seal: L.sq }); if (was > 0 && L.hp <= 0) { L.by = u.id; F.events.push({ e: 'lockBroken', sq: L.sq, id: u.id, help: L.sq !== u.sq }); } if (sl.locks.every(x => x.hp <= 0)) { sl.done = 1; F.events.push({ e: 'sealBroken', t: Math.round(F.t - sl.t0) }); } }
      return d;
    }
    let hp1 = Math.max(0, F.boss.hp - d);
    if (P && P.seal && !F.seal && hp1 <= F.boss.maxhp * P.seal.at) { hp1 = Math.round(F.boss.maxhp * P.seal.at); startSeal(F); }
    F.boss.hp = hp1;
    F.events.push({ e: 'deal', id: u.id, d, tag: t });
    return d;
  }
  // v8: фаза 2 — Печать. Замок на каждый отряд, HP замка = сила отряда × lockSec; не разбили за seconds — «Волна тьмы» по всем
  function startSeal(F) {
    const P = PH(F.BE).seal;
    const locks = F.squads.map((S, si) => { const pw = S.ids.map(id => F.all[id]).filter(u => u).reduce((a, u) => a + u.atk * atkK(F.BE, u.cls), 0) / F.BE.tick; return { sq: si, max: Math.max(1, Math.round(pw * P.lockSec)), hp: 0 }; });
    locks.forEach(L => L.hp = L.max);
    F.seal = { t0: F.t, until: F.t + P.seconds, locks, done: 0 }; F.ph.n = 2;
    F.events.push({ e: 'sealOn', sec: P.seconds, locks: locks.length });
  }
  function phaseStep(F, dt) {
    const P = PH(F.BE); if (!P) return;
    const sl = F.seal;
    if (sl && !sl.done && F.t >= sl.until) { // не успели — Волна тьмы, Печать спадает сама
      const X = F.BE.cast; sl.done = 2;
      F.squads.forEach(S => { const wl = F.t < S.wall; S.ids.forEach(id => { const u = F.all[id]; if (alive(u)) damage(F, u, u.maxhp * P.seal.failShare * (wl ? 1 - X.wallReduce : 1), 'wave'); }); });
      F.events.push({ e: 'sealFail', left: sl.locks.filter(x => x.hp > 0).map(x => x.sq) });
    }
    if (sl && sl.done && P.mark) { // фаза 2–3: Метка — по одной на каждый отряд, где есть живые не-танки
      F.marks = F.marks || [];
      for (let i = F.marks.length - 1; i >= 0; i--) { const M = F.marks[i]; if (F.t < M.at) continue; F.marks.splice(i, 1);
        const tg = F.all[M.id], cv = M.cover && F.all[M.cover];
        if (cv && alive(cv)) { damage(F, cv, cv.maxhp * P.mark.coverShare, 'mark'); F.events.push({ e: 'markHit', id: M.id, cover: cv.id }); }
        else if (tg && alive(tg)) { damage(F, tg, tg.maxhp * P.mark.share, 'mark'); F.events.push({ e: 'markHit', id: M.id }); } }
      if (!F.marks.length) { F.markT = (F.markT === undefined ? P.mark.first : F.markT) - dt;
        if (F.markT <= 0) { F.markT = P.mark.every;
          F.squads.forEach(S => { const pool = S.ids.map(id => F.all[id]).filter(u => alive(u) && u.role !== 'tank'); if (!pool.length) return;
            const tg = pool[Math.floor(F.rnd() * pool.length)]; F.marks.push({ id: tg.id, sq: tg.sq, at: F.t + P.mark.delay, cover: null }); F.events.push({ e: 'mark', id: tg.id, sec: P.mark.delay }); }); } }
    }
    if (P.rage && F.ph.n < 3 && sl && sl.done && F.boss.hp <= F.boss.maxhp * P.rage.at) { F.ph.n = 3; F.rageT = P.rage.every; F.events.push({ e: 'rage' }); }
    if (F.ph.n === 3) { F.rageT -= dt; if (F.rageT <= 0) { F.rageT += P.rage.every; F.enrage += P.rage.add; } }
  }
  const healMul = F => (F.ph && F.ph.n === 3 && PH(F.BE) && PH(F.BE).rage ? PH(F.BE).rage.healMul : 1);
  // v8: !прикрыть — танк любого отряда принимает удар по Метке на себя (свой откат coverCd, не общий с контролем)
  function useCover(F, id) {
    const u = F.all[id], P = PH(F.BE);
    if (!u) return { ok: false, msg: 'ты не в бою' };
    if (!CC.cover.classes.includes(u.cls)) return { ok: false, msg: '!прикрыть — только для паладина и воина' };
    if (u.sq < 0) return { ok: false, msg: 'ты в запасе' };
    if (!alive(u)) return { ok: false, msg: 'ты в нокауте' };
    if (F.t < (u.rootUntil || 0)) return { ok: false, msg: 'ты опутан корнями — жди, пока освободят' };
    const open = (F.marks || []).filter(m => !m.cover);
    if (!(F.marks || []).length) return { ok: false, msg: 'сейчас никто не помечен — прикрывать некого' };
    if (!open.length) return { ok: false, msg: 'все Метки уже прикрыты' };
    if (F.t < (u.cvcd || 0)) return { ok: false, msg: `прикрыть снова можно через ${Math.ceil(u.cvcd - F.t)}с` };
    const M = open.find(m => m.sq === u.sq) || open.sort((a, b) => a.at - b.at)[0]; // сначала свой отряд, иначе та, что ударит раньше
    M.cover = id; u.cvcd = F.t + ((P && P.mark && P.mark.coverCd) || 20);
    const other = M.sq !== u.sq;
    F.events.push({ e: 'cover', id, to: M.id, help: other });
    return { ok: true, msg: `прикрываешь ${M.id} — удар Метки примешь ты (${Math.round(((P && P.mark && P.mark.coverShare) || 0.4) * 100)}% твоего HP)`, effect: 'cover', to: M.id };
  }
  // окна каста: перестановка трёх цветов на полосе
  function castWindow(F) { const c = F.cast; if (!c) return null; const k = Math.min(2, Math.floor(c.p * 3)); return c.order[k]; }
  function startCast(F) {
    const r = F.rnd, o = ['yellow', 'purple', 'red']; for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    F.cast = { p: 0, order: o, slowUntil: 0, used: 0, dot: true };
    F.events.push({ e: 'castStart', name: F.def.cast || F.BE.cast.name });
  }
  // использование контроля героем. Возвращает {ok, msg, effect}
  function useCC(F, id, ab) {
    const BE = F.BE, X = BE.cast, u = F.all[id], A = CC[ab];
    if (ab === 'revive') return useRevive(F, id, false);
    if (ab === 'cover') return useCover(F, id);
    if (!u || !A) return { ok: false, msg: 'нет такой способности' };
    if (u.sq < 0) return { ok: false, msg: 'ты в запасе' };
    if (!alive(u)) return { ok: false, msg: 'ты в нокауте' }; // v49.12: без КД; раньше сообщение было «повержен», КД мог ставиться снаружи
    if (F.t < (u.rootUntil || 0)) return { ok: false, msg: 'ты опутан корнями — жди, пока освободят' }; // v49.5: Король Трентов
    if (!A.classes.includes(u.cls)) return { ok: false, msg: `${A.cmd} — только для: ${A.classes.join(', ')}` };
    if (F.t < u.lock) { u.lock = Math.max(u.lock, F.t + X.spamLockout); return { ok: false, msg: `спам! блок ${Math.ceil(u.lock - F.t)}с`, penal: 1 }; }
    if (F.t < u.cd) {
      const left = Math.ceil(u.cd - F.t), last = u.lastAb, L = last && CC[last] ? CC[last].name : '';
      u.lock = F.t + X.spamLockout;
      let msg = `рано! блок ${X.spamLockout}с`;
      if (L && last !== ab) {
        if (last === 'wall' && ab === 'stun') msg = `после Заслона сбить каст нельзя ещё ${left}с`;
        else if (last === 'stun' && ab === 'wall') msg = `после Оглушить Заслон нельзя ещё ${left}с`;
        else msg = `после ${L} «${A.name}» нельзя ещё ${left}с — общий откат`;
      }
      return { ok: false, msg, penal: 1 };
    }
    if (ab === 'purge' && F.t < (u.rcd || 0)) {
      const left = Math.ceil(u.rcd - F.t);
      return { ok: false, msg: u.lastR === 'revive' ? `после Воскрешения Очистить нельзя ещё ${left}с` : `!очистить на общем откате с воскрешением ещё ${left}с` };
    }
    u.cd = F.t + X.heroCooldown; u.lastAb = ab;
    if (ab === 'wall') { F.squads[u.sq].wall = F.t + X.wallSeconds; F.events.push({ e: 'cc', id, ab, good: 1 }); return { ok: true, msg: 'заслон поднят', effect: 'wall' }; }
    const c = F.cast;
    if (!c) { u.lock = F.t + X.wrongLockout; return { ok: false, msg: `босс не колдует — блок ${X.wrongLockout}с`, penal: 1 }; }
    if (ab === 'slow' && F.t < c.slowUntil) { u.cd = 0; return { ok: false, msg: 'каст уже замедлен' }; }
    if (c.used >= X.maxPerCastPerSquad * F.squads.length) return { ok: false, msg: 'контроль на этот каст исчерпан' };
    c.used++;
    if (ab === 'slow') { c.slowUntil = F.t + X.slowSeconds; F.events.push({ e: 'cc', id, ab, good: 1 }); return { ok: true, msg: `каст замедлен на ${Math.round(X.slowPct * 100)}%`, effect: 'slow' }; }
    const w = castWindow(F);
    if (A.win === w) {
      if (ab === 'stun') { F.cast = null; F.castT = X.every; F.events.push({ e: 'interrupt', id }); F.events.push({ e: 'cc', id, ab, good: 1 }); return { ok: true, msg: 'КАСТ ПРЕРВАН!', effect: 'interrupt' }; }
      c.p = Math.max(0, c.p - X.pushback); if (ab === 'purge') { c.dot = false; u.rcd = F.t + RV(BE).cooldown; u.lastR = 'purge'; }
      F.events.push({ e: 'cc', id, ab, good: 1 }); return { ok: true, msg: `каст отброшен на ${Math.round(X.pushback * 100)}%`, effect: 'push' };
    }
    c.p = Math.max(0, c.p - X.wrongPush); u.lock = F.t + X.wrongLockout;
    F.events.push({ e: 'cc', id, ab, good: 0 });
    return { ok: false, msg: `не то окно (нужно ${WIN[w].name}: ${CC[WIN[w].need].cmd}) — блок ${X.wrongLockout}с`, penal: 1 };
  }
  // v6.37: воскрешение жреца. Общий откат с !очистить (rcd): после одного другое недоступно reviveCooldown с
  const RV = BE => Object.assign({ cooldown: 60, hpShare: 0.5, auto: true, autoDelay: 6 }, BE.revive || {});
  function reviveTargets(F, u) {
    const pri = x => { const ro = x.sq >= 0 ? x.role : x.fromRole; return ro === 'tank' ? (x.cls === 'paladin' ? 0 : x.cls === 'warrior' ? 1 : 2) : ro === 'healer' ? 3 : 4; };
    const mySq = x => (x.sq >= 0 ? x.sq : x.fromSq) === u.sq;
    return Object.values(F.all).filter(x => x.dead && x.id !== u.id && (x.sq >= 0 || x.fromSq !== undefined))
      .sort((a, b) => (mySq(b) - mySq(a)) || (pri(a) - pri(b)) || (b.maxhp - a.maxhp) || (a.diedAt - b.diedAt));
  }
  function useRevive(F, id, auto) {
    const X = RV(F.BE), u = F.all[id];
    if (!u) return { ok: false, msg: 'ты не в бою' };
    if (u.cls !== 'priest') return { ok: false, msg: '!воскресить — только для жреца' };
    if (u.sq < 0) return { ok: false, msg: 'ты в запасе' };
    if (!alive(u)) return { ok: false, msg: 'ты в нокауте' };
    if (F.t < (u.rootUntil || 0)) return { ok: false, msg: 'ты опутан корнями — жди, пока освободят' }; // v49.5: Король Трентов
    if (F.t < (u.rcd || 0)) {
      const left = Math.ceil(u.rcd - F.t);
      return { ok: false, msg: u.lastR === 'purge' ? `после Очистить воскресить нельзя ещё ${left}с` : `воскрешение/очищение на откате ещё ${left}с` };
    }
    const t = reviveTargets(F, u)[0];
    if (!t) return { ok: false, msg: 'павших нет — воскрешение не потрачено' };
    u.rcd = F.t + X.cooldown; u.lastR = 'revive'; t.dead = 0; t.hp = Math.round(t.maxhp * X.hpShare);
    F.events.push({ e: 'rez', id, to: t.id, auto: !!auto, cd: X.cooldown });
    return { ok: true, msg: `воскрешает ${t.id} (${Math.round(X.hpShare * 100)}% HP); !очистить — через ${X.cooldown}с`, effect: 'revive', to: t.id };
  }
  function autoRevive(F) {
    const X = RV(F.BE); if (!X.auto) return;
    const purpleNow = F.cast && castWindow(F) === 'purple'; // приоритет контроля: в фиолетовом окне жрец бережёт !очистить
    F.squads.forEach(S => S.ids.forEach(id => { const u = F.all[id];
      if (!u || u.cls !== 'priest' || !alive(u) || F.t < (u.rcd || 0) || purpleNow) return;
      const t = reviveTargets(F, u)[0]; if (t && F.t - (t.diedAt || 0) >= X.autoDelay) useRevive(F, id, true); }));
  }
  // v8: лекарь — свой отряд, если кто-то ниже ownBelow (0.6); иначе самый раненый во всём рейде ниже raidBelow (0.7); иначе свой ниже 0.9 (как раньше)
  function healTarget(F, S, live) {
    const pct = x => x.hp / x.maxhp, low = live.slice().sort((a, b) => pct(a) - pct(b))[0], H = F.BE.healRaid;
    if (!H) return low && pct(low) < 0.9 ? low : null;
    if (low && pct(low) < (H.ownBelow || 0.6)) return low;
    let best = null; F.squads.forEach(T => T.ids.forEach(id => { const x = F.all[id]; if (alive(x) && x.sq >= 0 && (!best || pct(x) < pct(best))) best = x; }));
    if (best && pct(best) < (H.raidBelow || 0.7)) return best;
    return low && pct(low) < 0.9 ? low : null;
  }
  function step(F, dt) {
    const BE = F.BE, X = BE.cast, r = F.rnd; F.t += dt;
    // воскрешение
    for (const id in F.all) { const u = F.all[id]; if (u.dead && F.t >= u.dead) { u.dead = 0; u.hp = Math.round(u.maxhp * 0.5); F.events.push({ e: 'revive', id }); } }
    autoRevive(F);
    F.squads.forEach(S => refreshRoles(F, S));
    phaseStep(F, dt);
    // каст
    if (!F.cast) { if (!(F.seal && !F.seal.done)) F.castT -= dt; if (F.castT <= 0) startCast(F); } // v8: под Печатью новый каст не начинается
    else {
      const c = F.cast, sp = F.t < c.slowUntil ? 1 - X.slowPct : 1;
      c.p += dt / ((F.def.castTime || X.seconds)) * sp;
      if (c.dot && Math.floor((c.p - dt / X.seconds) * X.seconds / 2) !== Math.floor(c.p * X.seconds / 2)) // тёмная порча, пока не очищена
        F.squads.forEach(S => S.ids.forEach(id => { const u = F.all[id]; if (alive(u)) damage(F, u, u.maxhp * X.dotShare, 'dot'); }));
      if (c.p >= 1) {
        F.cast = null; F.castT = X.every; F.enrage += X.enragePerCast;
        F.events.push({ e: 'castHit' });
        F.squads.forEach(S => { const m = sqMult(F, S) * (F.t < S.wall ? 1 - X.wallReduce : 1); S.ids.forEach(id => { const u = F.all[id]; if (alive(u)) damage(F, u, u.maxhp * X.hitShare * m, 'cast'); }); });
      }
    }
    // v49: «Раскат» — только у боссов с полем rumble (огры): после падения HP босса до atHp раз в every секунд share макс. HP каждому живому (заслон режет, как каст)
    const RM = F.def && F.def.rumble;
    if (RM && RM.share > 0 && F.boss.hp > 0) {
      if (!F.rmb && F.boss.hp <= F.boss.maxhp * (RM.atHp || 0.5)) { const fd = RM.firstDelay === undefined ? RM.every : RM.firstDelay; F.rmb = { next: F.t + fd, n: 0 }; F.events.push({ e: 'rumbleOn', in: fd, every: RM.every, pct: Math.round(RM.share * 100) }); }
      if (F.rmb && F.t >= F.rmb.next) {
        F.rmb.next += RM.every; F.rmb.n++; let hit = 0, walled = 0;
        F.squads.forEach(S => { const wl = RM.wall !== false && F.t < S.wall; S.ids.forEach(id => { const u = F.all[id]; if (alive(u)) { hit++; if (wl) walled++; damage(F, u, u.maxhp * RM.share * (wl ? 1 - X.wallReduce : 1), 'rumble'); } }); });
        F.events.push({ e: 'rumble', n: F.rmb.n, hit, walled, pct: Math.round(RM.share * 100) });
      }
    }
    // удары босса по каждому отряду
    F.squads.forEach(S => {
      const live = S.ids.map(id => F.all[id]).filter(alive); if (!live.length) return;
      S.hitT -= dt; S.aoeT -= dt;
      // v8: hitShare/aoeShare — удар в долях макс. HP цели (сильные герои не стоят без потерь); нет полей — как раньше, числом
      if (S.hitT <= 0) { S.hitT += BE.hitEvery; const t = live.find(u => u.role === 'tank') || live[Math.floor(r() * live.length)]; damage(F, t, (BE.hitShare > 0 ? t.maxhp * BE.hitShare : BE.hitBase) * sqMult(F, S), 'hit'); }
      if (S.aoeT <= 0) { S.aoeT += BE.aoeEvery; live.forEach(u => { const c = BE.classMods[u.cls] || {}; if (r() < (c.dodge || BE.baseDodge)) { F.events.push({ e: 'dodge', id: u.id }); return; } damage(F, u, (BE.aoeShare > 0 ? u.maxhp * BE.aoeShare : BE.aoeBase) * sqMult(F, S), 'aoe'); }); }
    });
    // герои: удары и лечение (раз в tick секунд)
    F.tickAcc = (F.tickAcc || 0) + dt;
    while (F.tickAcc >= BE.tick) {
      F.tickAcc -= BE.tick;
      F.squads.forEach(S => {
        const live = S.ids.map(id => F.all[id]).filter(alive);
        for (const u of live) {
          if (F.t < (u.rootUntil || 0)) continue; // v49.5: опутан корнями — не бьёт и не лечит
          const c = BE.classMods[u.cls] || {};
          const hm = healMul(F);
          if (c.aura && u.role !== 'dps') live.forEach(x => { x.hp = Math.min(x.maxhp, x.hp + x.maxhp * c.aura * hm); });
          const hp = u.role === 'healer' ? (c.heal || c.healAsHealer || 0) : 0;
          if (hp) {
            const low = healTarget(F, S, live);
            if (low) { const h = Math.round(low.maxhp * hp * hm); low.hp = Math.min(low.maxhp, low.hp + h); F.events.push({ e: 'heal', id: u.id, to: low.id, h, help: low.sq !== u.sq }); continue; }
          }
          heroHit(F, u, hp ? 0.5 : 1);
          if (F.boss.hp <= 0) return;
        }
      });
      if (F.boss.hp <= 0) break;
    }
    if (F.boss.hp <= 0) return 'win';
    if (F.t >= F.endAt) return 'timeout';
    return null;
  }

  // ---------- симуляция для баланса ----------
  // comp: массив отрядов, каждый — массив id классов. policy: 'good' | 'none' | 'spam'
  function simulate(BE, comp, opts) {
    opts = opts || {}; const r = rng(opts.seed || 1); const lv = opts.level || 5, statsOf = m => { const c = BE.simClasses[m.cls]; const l = lv - 1; const e = opts.eq || {}; return { maxhp: c.hp + l * 10 + (e.hp || 0), atk: c.atk + l * 2 + (e.atk || 0), def: c.def + Math.floor(l / 2) + (e.def || 0) }; }; // v6.57: opts.eq — бонус снаряжения (только симуляция)
    const list = []; comp.forEach((sq, gi) => sq.forEach((cls, i) => list.push({ id: `g${gi}_${i}`, cls, guild: 'g' + gi })));
    const { squads, reserve } = formSquads(list, 5, () => opts.squadsPerGuild || 1, BE.mixedSquads ? { mixed: true, max: BE.maxSquads } : null);
    const def = opts.boss || BE.bosses[0];
    if (opts.noRevive) BE = Object.assign({}, BE, { revive: Object.assign({}, BE.revive || {}, { auto: false }) });
    const F = newFight(BE, def, squads, reserve, statsOf); F.rnd = r;
    const dt = 0.25; let res = null, wrong = 0;
    while (!res) {
      res = step(F, dt);
      if (opts.policy === 'good' && (F.marks || []).some(m => !m.cover)) { // v8: танки прикрывают Метки (реакция ~ как на каст)
        for (const id in F.all) { const u = F.all[id]; if (u.sq < 0 || !alive(u) || !CC.cover.classes.includes(u.cls) || F.t < (u.cvcd || 0)) continue; if (r() < (opts.react || 0.6) * dt) useCover(F, id); } }
      if (opts.policy && opts.policy !== 'none' && F.cast) {
        const need = () => WIN[castWindow(F)].need;
        for (const id in F.all) {
          const u = F.all[id]; if (u.sq < 0 || !alive(u) || !F.cast) continue;
          if (opts.policy === 'spam') { if (r() < 0.25 * dt) { const ab = Object.keys(CC).filter(a => !CC[a].noCast && CC[a].classes.includes(u.cls)); const x = useCC(F, id, ab[Math.floor(r() * ab.length)]); if (x.penal) wrong++; } continue; }
          const react = (opts.react || 0.6) * dt;
          if (CC[need()].classes.includes(u.cls) && F.t >= u.cd && F.t >= u.lock && r() < react) useCC(F, id, need());
          else if (u.cls === 'mage' && F.t >= F.cast.slowUntil && F.t >= u.cd && r() < react) useCC(F, id, 'slow');
          else if (u.cls === 'paladin' && F.cast && F.cast.p > 0.7 && F.t >= u.cd && F.t >= F.squads[u.sq].wall && r() < react) useCC(F, id, 'wall');
        }
      }
      if (opts.policy === 'good' && F.rmb && F.def.rumble && F.rmb.next - F.t < 1.6) for (const id in F.all) { const u = F.all[id]; if (u.cls !== 'paladin' || u.sq < 0 || !alive(u) || F.t < u.cd || F.t < u.lock || F.t < F.squads[u.sq].wall) continue; if (r() < (opts.react || 0.6) * dt * 4) useCC(F, id, 'wall'); }
      F.events.length = 0;
    }
    return { win: res === 'win', res, t: F.t, hpLeft: F.boss.hp / F.boss.maxhp, wrong, deaths: F.deaths || 0, seal: F.seal ? F.seal.done : 0, ph: F.ph ? F.ph.n : 1 };
  }
  // запасной, пришедший во время боя
  function addReserve(F, m, statsOf) { if (F.all[m.id]) return F.all[m.id]; const u = mk(m, -1, 'reserve', statsOf); F.all[m.id] = u; F.reserve.push(m.id); return u; }
  const api = { ROLE, CC, WIN, formSquads, newFight, step, useCC, useRevive, useCover, reviveTargets, castWindow, simulate, rng, heroHit, addReserve, sqMult, healMul };
  if (typeof module !== 'undefined') module.exports = api; else root.BossCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
