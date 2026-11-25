// ============================================================
//  УЮТНАЯ RPG-ФЕРМА v4 — логика и отрисовка (один файл, без модулей)
//  Данные зрителя хранятся под ТЕМИ ЖЕ именами, что и переменные
//  Streamer.bot (seeds, gardenStatus, veg_carrot ...), а RPG-поля
//  имеют приставку rpg_. Так их можно синхронизировать с ботом.
// ============================================================
(function () {
  'use strict';
  const C = window.CONFIG, F = C.farm;
  const W = C.width || 2560, H = C.height || 1440;
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // v48: картинки Королевы-Матки и её логова — assets.js менять не нужно. Нет файла → игра рисует простую замену (личинки/коконы — фигурами, фон — логово огра).
  // v49.5: логово и спрайты Короля Трентов — assets/bg/boss_treant.png (+1080/), assets/monsters/treant/*.png. Нет файла → логово огра / простые фигуры.
  { const M = window.ASSET_MANIFEST && window.ASSET_MANIFEST.images, T = 'assets/monsters/treant/';
    if (M) { const add = { bg_boss_treant: 'assets/bg/boss_treant.png', bg1080_boss_treant: 'assets/bg/1080/boss_treant.png' };
      ['roots_1', 'roots_2', 'roots_3', 'roots_4', 'roots_5', 'roots_6', 'sprout_idle', 'sprout_attack', 'stump', 'entangle_icon', 'fx_heal_swirl', 'fx_heal_plus', 'fx_heal_pillar'].forEach(n => { add['t_' + n] = T + n + '.png'; });
      for (const k in add) if (!M[k]) M[k] = add[k]; } }
  { const M = window.ASSET_MANIFEST && window.ASSET_MANIFEST.images, Q = 'assets/monsters/queen/';
    if (M) { const add = { bg_boss_queen: 'assets/bg/boss_queen.png', bg1080_boss_queen: 'assets/bg/1080/boss_queen.png', q_cocoon: Q + 'cocoon.png', q_cocoon_broken: Q + 'cocoon_broken.png', q_poison: Q + 'icon_poison.png' };
      ['larva_1', 'larva_2', 'larva_3', 'larva_4', 'larva_atk_1', 'larva_atk_2', 'larva_death_1', 'larva_death_2', 'larva_death_3'].forEach(n => { add['q_' + n] = Q + n + '.png'; });
      for (const k in add) if (!M[k]) M[k] = add[k]; } }
  const IMG = window.Assets.img;
  const params = new URLSearchParams(location.search);
  const TRANSPARENT = params.has('transparent');
  const FONT = "'Rubik', 'DejaVu Sans', sans-serif";
  const STANDALONE = params.has('standalone') || params.has('test'); // симуляция без бота — только с ?standalone или ?test
  // OBS: внутреннее разрешение 2560×1440. Браузер: холст заполняет окно (16:9, поля по краям).
  const OBS = !!window.obsstudio || params.has('obs');
  const SIZE = (() => { const m = /^(\d{3,5})x(\d{3,5})$/.exec(params.get('size') || ''); return m ? { w: +m[1], h: +m[2] } : null; })();
  let K = 1; // пикселей холста на 1 пиксель мира
  const LOCS = C.locationOrder.slice();
  const LOCKED = LOCS.includes(params.get('loc')) ? params.get('loc') : null;

  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1)); // как «Random 1..N» в Streamer.bot (включительно)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function weighted(list) { const tot = list.reduce((s, x) => s + (x.weight || 1), 0); let r = Math.random() * tot; for (const x of list) { r -= (x.weight || 1); if (r <= 0) return x; } return list[list.length - 1]; }
  const clsById = id => C.classes.find(c => c.id === id) || C.classes[0];
  const className = h => { const c = clsById(h.rpg_class); return h.rpg_gender === 'female' && c.nameF ? c.nameF : c.name; };
  // цвет героя: цвет ника Twitch (тег color / поле color из бота), иначе — постоянный цвет по нику
  const PALETTE = ['#FF4040', '#3F7FFF', '#2EBD59', '#B32AE0', '#FF8C1A', '#1EC8C8', '#E0368C', '#9ACD32', '#DAA520', '#5F9EA0', '#D2691E', '#8A2BE2'];
  function nickColor(nick) { let x = 0; for (const ch of String(nick).toLowerCase()) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[x % PALETTE.length]; }
  const DN = h => (h && (h.rpg_disp || h.user)) || ''; // v6.55: отображаемое имя Twitch (Phacia, а не phacia)
  const DISPQ = {};
  function noteDisp(nick, disp) { const n = findNick(nick); const h = n && S.heroes[n]; disp = String(disp || '').trim(); if (h && disp && lc(disp) === lc(n) && disp !== h.user && disp !== h.rpg_disp) { h.rpg_disp = disp; save(); } else if (!h && disp && lc(disp) === lc(String(nick || '').trim().replace(/^@/, ''))) DISPQ[lc(disp)] = disp; return h ? DN(h) : null; }
  const heroColor = h => /^#[0-9a-f]{6}$/i.test(h.rpg_color || '') ? h.rpg_color : nickColor(h.user);
  const cropName = id => (C.crops.find(c => c.id === id) || { name: id }).name;
  const guildById = id => C.guilds.find(g => g.id === id) || null;
  const fmtTime = s => { s = Math.max(0, Math.ceil(s)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; if (d) return `${d}д ${h}ч`; return (h ? h + 'ч ' : '') + (h || m ? m + 'м ' : '') + (h ? '' : ss + 'с'); };
  const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const d = n % 10; return n > 10 && n < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; }; // v6.42: слова целиком
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lc = s => String(s || '').toLowerCase().trim();

  function fit() {
    const dpr = window.devicePixelRatio || 1, iw = innerWidth, ih = innerHeight;
    let bw, bh, cw, ch;
    if (SIZE) { bw = SIZE.w; bh = SIZE.h; const k = Math.min(iw / bw, ih / bh); cw = bw * k; ch = bh * k; K = Math.min(bw / W, bh / H); }
    else if (OBS) { const k = Math.min(iw / W, ih / H); if (k >= 1) { bw = W; bh = H; K = 1; const s = Math.floor(k); cw = W * s; ch = H * s; } else { K = k; bw = Math.round(W * k); bh = Math.round(H * k); cw = bw; ch = bh; } } // v6.46: OBS 1080 — рисуем сразу в 1920×1080 (без CSS-уменьшения браузером)
    else {
      const k = Math.min(iw / W, ih / H); let d = k * dpr;
      if (Math.abs(d - Math.round(d)) < 0.04 && Math.round(d) >= 1) d = Math.round(d); // почти целое — делаем целым (чётче)
      K = d; bw = Math.round(W * d); bh = Math.round(H * d); cw = bw / dpr; ch = bh / dpr;
    }
    if (cv.width !== bw) cv.width = bw; if (cv.height !== bh) cv.height = bh;
    ctx.imageSmoothingEnabled = false;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.style.left = Math.floor((iw - cw) / 2) + 'px'; cv.style.top = Math.floor((ih - ch) / 2) + 'px';
    try { SPR.clear(); } catch (e) { } // SPR объявлен ниже — при первом вызове ещё недоступен
  }
  addEventListener('resize', fit); fit();


  let S = null;            // сохраняемое состояние
  const RT = {};           // несохраняемое: позиции и анимации героев
  const FX = [];
  const MODALS = [];
  const BATTLES = [];
  const PLOTS = new Array(C.gardenPlots).fill(null); // кто сейчас стоит у огородов на экране
  let speedIdx = 0, ACTIVE = '';

  const BLD = Object.keys(C.buildings);
  function newState() {
    const b = {}; BLD.forEach(id => b[id] = { lv: 1, fund: 0 });
    return {
      v: 3, clock: Math.floor(Date.now() / 1000), heroes: {}, order: [], seats: [],
      global: { farmEvent: 'off', farmEventUntil: 0, farmDecree: 'off', farmDecreeUntil: 0 },
      prizes: [], log: [], idc: 1, fame: [], realLog: [], lastRealPrize: 0, trophy: null, weekKey: '', weekly: {}, cooking: [], greetLog: [],
      buildings: b, guildScore: {}, barber7: 1, boss: null, nextBossAt: 0, bossIdx: 0, lastBoss: null, stream: null, fair: null, fairLast: '',
    };
  }
  const now = () => S.clock;
  const today = () => { const d = new Date(now() * 1000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }; // v7panel6: локальная дата, как %date:yyyy-MM-dd% в Streamer.bot
  // v7panel6: лимиты огорода как в экспорте Streamer.bot («Магия семян», «Салат»); config.farm может переопределить
  const MAGIC_MAX = h => +(h && h._magicMax) || +F.magicPerDay || 2, MAGIC_CD = () => +F.magicCooldown || 1800;
  const SALAD = () => ({ need: F.salad || { cucumber: 5, tomato: 5, carrot: 5, eggplant: 5, pumpkin: 1 }, per: +F.saladsPerPeriod || 4, period: +F.saladPeriodSeconds || 2592000 });
  function magicInfo(h) { const used = h.magicLastDate === today() ? (+h.magicDailyCount || 0) : 0, max = MAGIC_MAX(h); return { left: Math.max(0, max - used), max, cd: Math.max(0, Math.round((+h.magicCooldownUntil || 0) - now())), seeds: +h.seedsPrem || 0 }; }
  function saladInfo(h) { const S2 = SALAD(), t = now(), st = +h.saladPeriodStart || 0, fresh = !st || t - st >= S2.period, used = fresh ? 0 : (+h.saladsThisPeriod || 0);
    return { left: Math.max(0, S2.per - used), max: S2.per, reset: fresh ? 0 : Math.max(0, Math.round(st + S2.period - t)), can: Object.keys(S2.need).every(k => (+h['veg_' + k] || 0) >= S2.need[k]), total: +h.totalSalads || 0 }; }

  // переменные зрителя: имена как в Streamer.bot + rpg_*
  function newHero(nick, cls, gender) {
    return {
      user: nick,
      seeds: 0, seedsPrem: 0, seedsCooldown: false, seedsLastTime: 0,
      gardenStatus: 0, plantedAt: 0, plantCooldown: false,
      waterLevel: 0, wateringLastTime: 0, fertilizerBuff: false, bugAttack: false,
      magicCooldownUntil: 0, magicDailyCount: 0, magicHarvest: 0, magicLastDate: '', magicLastCrop: '',
      saladPeriodStart: 0, saladsThisPeriod: 0, totalSalads: 0,
      veg_cucumber: 0, veg_tomato: 0, veg_carrot: 0, veg_eggplant: 0, veg_pumpkin: 0, veg_weed: 0,
      boosty: false, vip: false,
      _bugCheckAt: 0, _bugDeadline: 0, // только прототип (в боте это задержки Delay)
      rpg_class: cls, rpg_gender: gender, rpg_level: 1, rpg_xp: 0, rpg_hp: 0,
      rpg_gold: 0, rpg_potions: 1, rpg_food: 0, rpg_chests: 0, rpg_kills: 0, rpg_deaths: 0, rpg_expeditions: 0,
      rpg_created: Date.now(), rpg_lastRedeem: 0, rpg_lastGarden: 0, rpg_lastActive: 0,
      rpg_guild: '', rpg_guildJoined: 0, rpg_quest: null, rpg_offers: [], rpg_questsDone: 0,
      rpg_donated: 0, rpg_bossDmg: 0,
      rpg_color: '', rpg_buffs: [], rpg_dishes: [], rpg_bag: {}, rpg_chestBox: {}, rpg_mats: { wood: 0, stone: 0, iron: 0 },
      rpg_owned: { hat: [], aura: [], pet: [], title: [], set: [] }, rpg_eq: { hat: '', aura: '', pet: '', title: '', set: '' }, rpg_skills: {}, rpg_gear: [], rpg_ach: [],
      rpg_heroWeekUntil: 0, rpg_lastGreet: 0, rpg_lastChat: 0, rpg_cmdT: {}, rpg_strikeAt: 0, rpg_healAt: 0,
      rpg_cooked: 0, rpg_potionsBrewed: 0, rpg_harvests: 0, rpg_bossWins: 0, rpg_legendary: 0, rpg_partyExpeditions: 0, rpg_chestsGot: 0,
      rpg_shards: 0, rpg_luck: 0, rpg_sharp: {}, rpg_sharpPity: {}, rpg_sharpBest: 0, rpg_freeChange: 0, // v49: заточка и бесплатная смена облика
    };
  }
  const bLv = id => (S.buildings[id] || { lv: 1 }).lv;
  const bPer = (id, k) => ((C.buildings[id] || {}).per || {})[k] || 0;
  // v7panel15: campRegen — восстанавливается доля НЕДОСТАЮЩЕГО HP: за t сек 1−e^(−k·t); k×(1+fire·(ур.костра−1)) для всех в лагере
  const CAMPRG_DEF = { enabled: false, k: 0.00266, fire: 1 }, CAMPRG = () => Object.assign({}, CAMPRG_DEF, C.campRegen || {});
  // v7panel16: щит палатки на поход/бой с боссом (флаг, по умолчанию выкл): доля макс. HP по уровню палатки, поглощает урон перед HP
  const TSH_DEF = { enabled: false, pct: [0, 0.05, 0.10, 0.15] }, TSH = () => Object.assign({}, TSH_DEF, C.tentShield || {});
  // v7panel17: pct из 5 чисел [0,0,.05,.10,.15] — индекс = уровень (как в REPORT_v7panel16); из 4 чисел — индекс = уровень−1
  const tsP = lv => { const v2 = BV2(), A2 = v2 && v2.eff && v2.eff.tents && v2.eff.tents.shield; if (Array.isArray(A2)) return +A2[Math.max(0, Math.min(A2.length - 1, lv))] || 0; const P = TSH().pct || [], i = P.length >= 5 ? lv : lv - 1; return P[Math.max(0, Math.min(P.length - 1, i))] || 0; };
  function tentShieldFor(h) { const T = TSH(); if (T.enabled !== true) return 0; const p = tsP(bLv('tents')); return Math.round(stats(h).maxhp * p); }
  function shieldGive(h) { const n = tentShieldFor(h); h._shield = n; h._shieldMax = n; if (n > 0) clog(`${DN(h)}: щит палатки ${n} HP (палатка ур.${bLv('tents')})`, '#7fd0ff'); return n; }
  function shieldAbsorb(h, dmg) { const a = Math.min(h._shield || 0, dmg); if (a > 0) { h._shield -= a; if (h._shield <= 0) clog(`${DN(h)}: щит палатки разрушен`, '#7fd0ff'); } return a; }
  // v7panel17: тексты костра/палатки по флагам campRegen/tentShield (иначе — effect из config.js)
  const crPct = lv => { const G = CAMPRG(); return Math.round(100 * (1 - Math.exp(-G.k * (1 + G.fire * bEq('campfire', lv)) * 300))); };
  const tsPct = lv => Math.round(100 * tsP(lv));
  function bText(id, lv) { const b = C.buildings[id], sts = (b.per || {}).seats;
    if (id === 'campfire' && CAMPRG().enabled === true) return `${sts ? `+${sts} место у костра; ` : ''}ускоряет восстановление HP у всех героев в лагере: ${crPct(lv)}% за 5 мин`;
    if (id === 'tents' && TSH().enabled === true) { const p = tsPct(lv); return `щит на поход: ${p > 0 ? p + '% макс. HP' : 'нет'} (ур.2 ${tsPct(2)}%, ур.3 ${tsPct(3)}%, ур.4 ${tsPct(4)}% макс. HP)`; }
    return b.effect; }
  // v7panel18: реальный эффект постройки на уровне lv (per × (lv−1), как в bEff) — для вкладки «Улучшения» и пульта
  function bReal(id, lv) { const b = C.buildings[id], P = k => bEffAt(id, k, lv), pc = v => Math.round(v * 100);
    let t;
    if (id === 'campfire') t = [`мест у костра +${P('seats')}`, CAMPRG().enabled === true ? `ускоряет восстановление HP у всех героев в лагере: ${crPct(lv)}% за 5 мин` : `лечение у костра +${pc(P('regen'))}%`];
    else if (id === 'tents') t = [TSH().enabled === true ? `щит на поход: ${tsPct(lv) > 0 ? tsPct(lv) + '% макс. HP' : 'нет'}` : `сон лечит быстрее на ${pc(P('rest'))}%`];
    else if (id === 'blacksmith') { t = [`атака всех героев +${pc(P('atk'))}%`]; const v = BV2(); if (v) { const ft = v.forgeTiers || {}, rows = [1].concat(Object.keys(ft).map(Number).filter(r => lv >= ft[r])); t.push(`ряды вещей: ${Math.max(...rows)}`); if (P('repair') > 0) t.push(`ремонт −${pc(P('repair'))}%`); const X = SH_ON() ? SH() : null; if (X && lv >= ((X.drops && X.drops.luckCraft && X.drops.luckCraft.blacksmithLv) || 99)) t.push('крафт свитка удачи'); if (X && lv >= (+X.forgeBonusLv || 99)) t.push(`заточка +${pc(+X.forgeBonus || 0)}%`); } } // v49.6
    else if (id === 'guild') t = [`в отряд на босса +${P('squad')}`, `награда за босса +${pc(P('bossReward'))}%`];
    else if (id === 'shed') t = [`+${P('harvestGold')} золота за каждый урожай`];
    else if (id === 'market') t = [`овощи дороже на +${BV2() ? Math.round(bEffAt('market', 'sell', lv)) : ((C.market || {}).sellPerLevel || 0) * (lv - 1)} золота`];
    else if (id === 'board') t = [`заданий на доске +${P('offers')}`, `золото за задания +${pc(P('questGold'))}%`];
    else return bText(id, lv);
    return t.join(', '); }
  const bFxTxt = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().slice(0, 180); // v49.6: тексты построек для пульта без HTML, коротко
  const bPurpose = id => id === 'tents' && TSH().enabled === true ? 'щит на поход' : id === 'campfire' && CAMPRG().enabled === true ? 'места и восстановление HP' : (PURPOSE[id] || '');
  const bEff = (id, k) => bEffAt(id, k, bLv(id)); // суммарный эффект постройки (за уровни выше 1-го; v49: в Сезоне 2 — по таблице buildingsV2.eff)
  const seatCount = () => { const n = C.maxSeats + Math.round(bEff('campfire', 'seats')); return B6.camp ? Math.min(n, SLOTS6.camp.length + 4) : n; };
  const CT_DEF = { paladin: { block: 0.15, blockReduce: 0.5, auraEvery: 4, auraHeal: 0.05 }, warrior: { cleaveChance: 0.18 } };
  const CT = k => Object.assign({}, CT_DEF[k], (C.classTune || {})[k] || {}); // v6.55 п.18
  // v7panel36: сложность мобов (вариант A) — множитель атаки обычных мобов похода поверх party.mobAtk/mobAtk2. По умолчанию ВЫКЛ.
  const MOBDIF = () => Object.assign({ enabled: true, atkMul: 1.3, noSupportAtkMul: 1.2, noSupportMinSize: 3 }, C.mobDifficulty || {}); // v7panel39: отряд из 3+ без паладина и жреца — ×1.2 // v7panel38: ВКЛ по умолчанию
  // v49.8: CONFIG.mobLevelScale — мобы походов (соло и отряд, НЕ боссы) под уровень героя: множитель = 1 + perLevel × (уровень − baseLevel), в пределах [minMul, maxMul].
  // Уровень — герой в соло, средний уровень отряда в пати. Нет блока или enabled: false — множитель 1 (как раньше).
  const soloWaveHeal = () => { const v = C.soloWaveHeal; return v == null ? 0.25 : Math.max(0, Math.min(1, +v || 0)); }; // v49.8: соло — доля макс. HP, которую герой восстанавливает между волнами (конфиг soloWaveHeal, по умолчанию 0.25)
  const mobLvK = (lv, key) => { const m = C.mobLevelScale; if (!m || m.enabled === false) return 1; const v = 1 + (+m[key] || 0) * ((+lv || 1) - (m.baseLevel != null ? +m.baseLevel : 8));
    const lo = m.minMul != null ? +m.minMul : 0.7, hi = m.maxMul != null ? +m.maxMul : 1.0; /* v49.8: по умолчанию выше базового уровня мобы не усиливаются */ return Math.max(lo, Math.min(hi, v)); };
  const mobAtkK = ids => { const m = MOBDIF(); if (!m.enabled) return 1; if (ids && m.noSupportAtkMul != null && ids.length >= (m.noSupportMinSize || 3) && !ids.some(c => c === 'paladin' || c === 'priest')) return +m.noSupportAtkMul || 1; return +m.atkMul || 1; };
  // v7panel36: мягкий нерф паладина и жреца. solo* — только соло-поход; блок паладина (шанс и сила) в пати не меняется. По умолчанию ВЫКЛ.
  // v7panel39: сильнее в пати — аура 0.03, блок паладина в пати 10% / −35% урона, защита паладина в пати −5; жрец: самолечение 0.15, лечение 11% при HP<50%.
  const NERF_DEF = { paladin: { auraHeal: 0.03, soloAuraHeal: 0.05, soloDefAdd: -6, soloDmgReduce: 0.25, soloBlockReduce: 0.6, partyBlock: 0.1, partyBlockReduce: 0.35, partyDmgReduce: 0, partyDefAdd: -5 }, priest: { selfHeal: 0.15, selfBelow: 0.5, healPct: 0.11, healBelow: 0.5 } };
  const NERF = k => { const n = C.classNerf || { enabled: true }; if (n.enabled === false) return null; // v7panel38: ВКЛ по умолчанию
    return Object.assign({}, NERF_DEF[k], n[k] || {}); };
  function stats(h) {
    const c = clsById(h.rpg_class), l = h.rpg_level - 1;
    let atkM = 1 + bEff('blacksmith', 'atk'), def = c.def + Math.floor(l / 2), hpM = 1, xpM = 1, regen = 0;
    for (const b of h.rpg_buffs || []) { const r = recipeById(b.id); if (!r) continue; const e = r.effect; atkM += e.atk || 0; def += e.def || 0; hpM += e.maxhp || 0; xpM += e.xp || 0; regen += e.regen || 0; }
    { const g = trophyOn(h); if (g) { atkM += g.atk || 0; def += g.def || 0; } } // v49.8: действует только ОДИН активный трофей
    if (typeof g9Eff === 'function') { atkM += g9Eff(h, 'atk'); hpM += g9Eff(h, 'hp'); xpM += g9Eff(h, 'xp'); } // v9: бафф гильдии из казны
    const eb = equipBonus(h); def += eb.def; // v6.56: снаряжение — плоские бонусы (v6.57: + магия к урону)
    return { maxhp: Math.round((c.hp + l * 10 + eb.hp) * (hpM + (eb.hpPct || 0))), atk: Math.round((c.atk + l * g9Grow(c.id) + eb.atk + eb.mag) * (atkM + (eb.dmgPct || 0))), /* v7panel39: кольца Силы (dmgPct) и Жизни (hpPct) работают */ def, xpM, regen, block: eb.block, eq: eb };
  }
  // ===================== v6.56: СНАРЯЖЕНИЕ (оружие/броня/щит/амулет), покупка в кузнице =====================
  const EQ = () => { const e = C.equip || { slots: [], items: [] }; if (e.items && !e._nm498) { e._nm498 = 1; const rn = new Set(e.items.filter(i => /^ring/.test(i.slot)).map(i => i.name.toLowerCase().replace(/ё/g, 'е')));
    e.items.forEach(i => { if (!/^ring/.test(i.slot) && rn.has(i.name.toLowerCase().replace(/ё/g, 'е'))) i.name = i.name.replace(/^Кольцо/i, i.slot === 'trinket' ? 'Амулет' : 'Вещь'); }); } return e; }; // v49.8: амулет «Кольцо силы» звался так же, как «Кольцо Силы» — выглядело как два одинаковых кольца
  const eqItem = id => EQ().items.find(i => i.id === id);
  const EQ_SLOT_RU = { оружие: 'weapon', меч: 'weapon', броня: 'armor', доспех: 'armor', щит: 'offhand', оффхенд: 'offhand', амулет: 'trinket', кольцо: 'ring1', кольцо1: 'ring1', кольцо2: 'ring2', ring1: 'ring1', ring2: 'ring2' };
  function eqOf(h) { if (!h.rpg_equip || typeof h.rpg_equip !== 'object') h.rpg_equip = {}; if (!Array.isArray(h.rpg_eqOwn)) h.rpg_eqOwn = []; if (h.rpg_equip.ring2 && h.rpg_equip.ring2 === h.rpg_equip.ring1) delete h.rpg_equip.ring2; /* v49.8: одно кольцо не может быть надето в оба слота */ return h.rpg_equip; }
  const ringSlot = (h, it) => it.slot !== 'ring1' ? it.slot : (h.rpg_equip.ring1 === it.id || h.rpg_equip.ring2 === it.id) ? '' : !h.rpg_equip.ring1 ? 'ring1' : 'ring2'; // v49.8: кольцо уже надето (в любом слоте) → '' ; свободен 1-й слот → ring1; иначе ring2
  // v6.57: классовые вещи — it.cls (нет поля = всем классам)
  const eqAllowed = (h, it) => !!it && (!it.cls || it.cls.includes(h.rpg_class));
  const eqForClass = h => EQ().items.filter(it => eqAllowed(h, it));
  const ATYPE_RU = { heavy: 'тяжёлая', leather: 'кожаная', light: 'ткань' };
  const clsList = it => (it.cls || []).map(id => { const c = clsById(id); return c ? c.name : id; }).join(', ');
  function eqDeny(h, it) { return res(h, false, `«${it.name}»${it.atype ? ` (${ATYPE_RU[it.atype]} броня)` : ''} — не для класса ${className(h)}. Подходит: ${clsList(it)}. Твоя кузница: !купить`); }
  // v7panel38: gearCaps — мягкие потолки суммарных бонусов снаряжения (вкл по умолчанию; gearCaps:{enabled:false} — как раньше).
  // Сверх потолка бонус засчитывается на over (20%). atk — урон+магия вместе. hybridMul — сила гибридов амулетов в пати.
  const GEARCAP_DEF = { def: 1, block: 0.05, dodge: 0.05, hp: 15, atk: 4, dmgPct: 0.05, hpPct: 0.08, over: 0.2, hybridMul: 0.6 }; // v7panel39: + dmgPct/hpPct (кольца Силы/Жизни)
  const GEARCAP = () => { const g = C.gearCaps; return g && g.enabled === false ? null : Object.assign({}, GEARCAP_DEF, g || {}); };
  const softCap = (x, cap, over) => cap == null || x <= cap ? x : cap + (x - cap) * over;
  function equipBonus(h, raw) { const b = equipBonus0(h, raw), sb = sharpBonus(h); if (sb) { b.atk += sb.atk; b.mag += sb.mag; b.hp += sb.hp; b.def += sb.def; } return b; } // v49: + заточка (после потолков, с учётом прочности)
  function equipBonus0(h, raw) { const b = { atk: 0, hp: 0, def: 0, block: 0, mag: 0, dodge: 0, dmgPct: 0, hpPct: 0 }; const e = h.rpg_equip || {}; for (const s in e) { if (s === 'ring2' && e.ring2 === e.ring1) continue; /* v49.8: дубль кольца не даёт статы дважды */ const it = eqItem(e[s]); if (it && eqAllowed(h, it)) { const dm = durMul(h, it); if (dm) for (const k in b) b[k] += (it[k] || 0) * dm; } } // v7panel40: прочность ×0.5 / ×0
    const K = !raw && GEARCAP(); if (!K) return b; const o = K.over;
    const am = b.atk + b.mag, am2 = softCap(am, K.atk, o), f = am ? am2 / am : 1;
    return { atk: Math.round(b.atk * f * 10) / 10, mag: Math.round(b.mag * f * 10) / 10, hp: Math.round(softCap(b.hp, K.hp, o)), def: Math.round(softCap(b.def, K.def, o) * 10) / 10, block: softCap(b.block, K.block, o), dodge: softCap(b.dodge, K.dodge, o), dmgPct: softCap(b.dmgPct, K.dmgPct, o), hpPct: softCap(b.hpPct, K.hpPct, o) }; }
  // v7panel40: прочность снаряжения (по умолчанию ВЫКЛ; CONFIG.durability = { enabled: true, ... })
  const DUR_DEF = { enabled: false, maxByTier: { 1: 80, 2: 140, 3: 220, 4: 320 }, trinketMax: [[200, 120], [600, 200], [Infinity, 280]], weaponHitEvery: 2, armorHit: 1, trinketEvery: 5, repairMul: 0.10, halfBonusBelow: 0.30, zeroBonusAt: 0, warnBelow: 0.20, tankArmorMul: 2 };
  const DUR = () => { const d = C.durability; if (!d || d.enabled !== true) return null; const o = Object.assign({}, DUR_DEF, d); o.maxByTier = Object.assign({}, DUR_DEF.maxByTier, d.maxByTier || {}); return o; };
  const DUR_SLOTS = ['weapon', 'armor', 'offhand', 'trinket', 'ring1', 'ring2'];
  function durMax(it, D) { D = D || DUR() || DUR_DEF; if (it.slot === 'trinket' || it.slot === 'ring1' || it.slot === 'ring2') { const t = Array.isArray(D.trinketMax) ? D.trinketMax : DUR_DEF.trinketMax; for (const [lim, v] of t) if ((it.price || 0) <= (lim == null ? Infinity : lim)) return v; return t[t.length - 1][1]; } return D.maxByTier[it.bs || 1] || D.maxByTier[1] || 80; }
  function durCur(h, it) { const m = durMax(it); const v = (h.rpg_dur || {})[it.id]; return v == null ? m : Math.max(0, Math.min(m, v)); }
  function durMul(h, it) { const D = DUR(); if (!D) return 1; const r = durCur(h, it) / durMax(it, D); if (r <= (D.zeroBonusAt || 0)) return 0; return r < D.halfBonusBelow ? 0.5 : 1; }
  function durWear(h, slots, n) { const D = DUR(); if (!D) return; if (!h.rpg_dur || typeof h.rpg_dur !== 'object') h.rpg_dur = {}; const e = h.rpg_equip || {};
    for (const s of slots) { const it = eqItem(e[s]); if (!it) continue; const m = durMax(it, D), c0 = durCur(h, it), c = Math.max(0, c0 - (n || 1)); h.rpg_dur[it.id] = c;
      if (c0 > m * D.warnBelow && c <= m * D.warnBelow && c > 0) log(`⚠ ${DN(h)}: «${it.name}» почти сломан (${Math.round(c / m * 100)}%) — !чинить`, '#ffb84a');
      if (c0 > 0 && c === 0) log(`💥 ${DN(h)}: «${it.name}» сломан — бонусы не действуют, !чинить`, '#ff7a6a'); } }
  function durOnHit(h) { const D = DUR(); if (!D) return; h._durW = (h._durW || 0) + 1; h._durT = (h._durT || 0) + 1;
    if (h._durW >= Math.max(1, D.weaponHitEvery)) { h._durW = 0; durWear(h, ['weapon']); }
    if (h._durT >= Math.max(1, D.trinketEvery)) { h._durT = 0; durWear(h, ['trinket', 'ring1', 'ring2']); } }
  // v45: танки (воин/паладин) — защитная броня и защитная левая рука (щит/наручи) изнашиваются в tankArmorMul раз медленнее (по умолчанию 2: −1 за 2·armorHit попаданий). Остальное — как раньше.
  const DUR_TANK = { warrior: 1, paladin: 1 }, DUR_PROT_OFF = { shield: 1, bracer: 1 };
  function durOnHurt(h) { const D = DUR(); if (!D) return; const a = Math.max(1, D.armorHit);
    if (!DUR_TANK[h.rpg_class]) { h._durA = (h._durA || 0) + 1; if (h._durA >= a) { h._durA = 0; durWear(h, ['armor', 'offhand']); } return; }
    const off = eqItem((h.rpg_equip || {}).offhand), prot = !!(off && DUR_PROT_OFF[off.kind]), k = Math.max(1, Math.round(a * (+D.tankArmorMul > 0 ? +D.tankArmorMul : 2)));
    if (off && !prot) { h._durA = (h._durA || 0) + 1; if (h._durA >= a) { h._durA = 0; durWear(h, ['offhand']); } } // незащитная левая рука у танка (на случай чужого конфига) — по-старому
    h._durAT = (h._durAT || 0) + 1; if (h._durAT >= k) { h._durAT = 0; durWear(h, prot ? ['armor', 'offhand'] : ['armor']); } }
  const bsRepairK = () => 1 - Math.min(0.6, Math.max(0, +bEff('blacksmith', 'repair') || 0)); // v49.6: кузница ур.3/5/7/9 — ремонт дешевле
  const durCost = (h, it) => { const D = DUR() || DUR_DEF; return Math.ceil((it.price || 0) * D.repairMul * shRepairMul(h, it) * bsRepairK() * g9SmithK(h) * (1 - durCur(h, it) / durMax(it, D))); };
  const durPct = (h, it) => Math.round(durCur(h, it) / durMax(it) * 100);
  // v7panel42: список изношенных надетых вещей + цены (та же формула durCost, что !чинить)
  function durRepairList(h) {
    if (!DUR() || !h) return null; eqOf(h); const e = h.rpg_equip;
    const items = DUR_SLOTS.map(s => { const it = eqItem(e[s]); if (!it || !eqAllowed(h, it) || durCur(h, it) >= durMax(it)) return null;
      return { s, id: it.id, name: it.name, pct: durPct(h, it), cost: durCost(h, it), cur: durCur(h, it), max: durMax(it), ir: durIron(h, it) }; }).filter(Boolean);
    const tot = items.reduce((a, x) => a + x.cost, 0), ti = items.reduce((a, x) => a + x.ir, 0), fe = (h.rpg_mats || {}).iron || 0, blk = blocked(h, 'town'), busy = BATTLES.some(b => b.user === h.user);
    let why = ''; if (blk) why = blk; else if (busy) why = 'нельзя: герой в бою'; else if (!items.length) why = 'всё целое'; else if (h.rpg_gold < tot) why = `нужно ${tot} з, у тебя ${Math.floor(h.rpg_gold)} з`; else if (fe < ti) why = `нужно железа ⛓${ti}, у тебя ${fe}`;
    return { items, tot, ti, gold: Math.floor(h.rpg_gold || 0), ok: !!(items.length && !blk && !busy && h.rpg_gold >= tot && fe >= ti), why };
  }
  function repairCmd(nick, q) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' }; eqOf(h);
    if (!DUR()) return res(h, false, 'прочность снаряжения выключена — чинить нечего');
    const blk = blocked(h, 'town'); if (blk) return res(h, false, 'чинить можно только в городе у кузницы — ' + blk.replace(/^нельзя: /, ''));
    if (BATTLES.some(b => b.user === h.user)) return res(h, false, 'чинить можно только в городе у кузницы — герой в бою');
    q = String(q || '').trim().toLowerCase().replace(/ё/g, 'е'); const e = h.rpg_equip;
    let L = DUR_SLOTS.map(s => eqItem(e[s])).filter(Boolean);
    if (q && q !== 'все' && q !== 'всё') { const s = EQ_SLOT_RU[q] || (DUR_SLOTS.includes(q) ? q : null); L = s ? L.filter(it => e[s] === it.id) : L.filter(it => it.id === q || it.name.toLowerCase().replace(/ё/g, 'е').startsWith(q)); if (!L.length) return res(h, false, 'нет такой надетой вещи. Пример: !чинить оружие / !чинить всё'); }
    L = L.filter((it, i, a) => a.indexOf(it) === i && durCur(h, it) < durMax(it));
    if (!L.length) return res(h, true, 'всё снаряжение целое (100%)');
    const tot = L.reduce((s, it) => s + durCost(h, it), 0), ti = L.reduce((s, it) => s + durIron(h, it), 0), fe = (h.rpg_mats || {}).iron || 0;
    if (h.rpg_gold < tot) return res(h, false, `починка (${L.map(it => `${it.name} ${durPct(h, it)}% — ${durCost(h, it)} з`).join(', ')}) стоит ${tot} з, у тебя ${Math.floor(h.rpg_gold)} з`);
    if (fe < ti) return res(h, false, `починка вещей 3–4 ряда требует железа ⛓: ${ti} (у тебя ${fe}) — по 1 за каждые 25% износа`);
    const txt = L.map(it => `${it.name} ${durPct(h, it)}%→100% (${durCost(h, it)} з)`).join(', ');
    h.rpg_gold -= tot; if (ti) h.rpg_mats.iron = fe - ti; if (!h.rpg_dur || typeof h.rpg_dur !== 'object') h.rpg_dur = {}; L.forEach(it => { h.rpg_dur[it.id] = durMax(it); }); save(); refreshUI();
    const went = goDo(h, 'town', TOWN.blacksmith.x - 110, TOWN.blacksmith.y + 20, 'чинит…', C.townStaySeconds, 2, () => fxText(TOWN.blacksmith.x, TOWN.blacksmith.y - 220, 'починено', '#c8f0a8', 32, 2, 'town'), true);
    if (!went) say(h, 'кузнец чинит…', 2.5);
    return res(h, true, `кузнец чинит: ${txt}. Итого −${tot} з${ti ? `, −${ti} железа` : ''}`);
  }
  const durTxt = (h, it) => DUR() ? ` · прочность ${durPct(h, it)}%` : '';
  // v49.8: описания гибридов амулетов — реальные цифры из конфига (сила = hybridPower × gearCaps.hybridMul, если потолки включены) и где работает.
  // Механика (partycore.js / соло / босс в game.js) не менялась: heal — соло, отряд, босс; crit/first/cleave/aura — только поход отрядом.
  const hybPow = it => (it.hybridPower || 1) * ((GEARCAP() || {}).hybridMul || 1), hpc = x => { const v = Math.round(x * 1000) / 10; return (v % 1 ? v.toFixed(1).replace('.', ',') : String(v)); };
  const HYBRID_RU = {
    heal: it => `каждый ${it.hybridEvery || 2}-й ход лечит самого раненого на ${hpc(0.12 * hybPow(it))}% HP (если HP < 70%) · соло, отряд и босс`,
    crit: it => `${hpc(0.15 * hybPow(it))}% шанс двойного урона · только в походе отрядом`,
    first: () => 'первый удар героя в каждой волне +50% урона · только в походе отрядом', // сила на «первый удар» не влияет (partycore: ×1.5)
    cleave: it => `${hpc(0.2 * hybPow(it))}% шанс +30% урона · только в походе отрядом`,
    aura: it => `каждые 6 ходов лечит весь отряд на ${hpc(0.03 * hybPow(it))}% HP · только в походе отрядом`
  };
  const eqStatTxt = it => [it.atk && `+${it.atk} урон`, it.mag && `+${it.mag} магия`, it.hp && `+${it.hp} HP`, it.hpPct && `+${Math.round(it.hpPct * 100)}% HP`, it.def && `+${it.def} защита`, it.block && `+${Math.round(it.block * 100)}% блок`, it.dodge && `+${Math.round(it.dodge * 100)}% уклон`, it.dmgPct && `+${Math.round(it.dmgPct * 100)}% урон`, it.hybrid && (HYBRID_RU[it.hybrid] ? HYBRID_RU[it.hybrid](it) : it.hybrid)].filter(Boolean).join(', ') + (it.atype ? ` · ${ATYPE_RU[it.atype]}` : '');
  function eqResolve(q, h) { q = String(q || '').trim().toLowerCase().replace(/ё/g, 'е'); const L = EQ().items; if (/^\d+$/.test(q)) return (h ? eqForClass(h) : L)[+q - 1]; const nn = i => i.name.toLowerCase().replace(/ё/g, 'е'); return L.find(i => i.id === q) || L.find(i => nn(i) === q && i.slot === 'ring1') || L.find(i => nn(i) === q) || L.find(i => nn(i).startsWith(q)); } // v49.8: точное имя важнее префикса; «кольцо силы» — это кольцо, а не амулет
  // v6.57: цвет волос
  const HAIRS = () => (C.hair && C.hair.colors) || [];
  function hairPick(u) { const L = HAIRS(), tot = L.reduce((s, x) => s + x.w, 0); let v = u * tot; for (const x of L) { if ((v -= x.w) < 0) return x.id; } return (L[0] || {}).id || ''; }
  function nickHash(s) { let x = 2166136261; for (const ch of lc(String(s))) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619) >>> 0; } return x; }
  const hairById = id => HAIRS().find(x => x.id === id);
  function hairOf(h) { if (h && hairById(h.rpg_hair)) return h.rpg_hair; return h ? (BARB_ON() ? 'chestnut' : hairPick((nickHash(h.user || '') % 10007) / 10007)) : ''; } // v49.7: без цвета — каштановый
  function hairResolve(q) { q = lc(String(q || '').trim()).replace(/ё/g, 'е'); if (!q) return null; const L = HAIRS(), nn = s => lc(s).replace(/ё/g, 'е');
    if (/^\d+$/.test(q)) return L[+q - 1] || null;
    return L.find(x => x.id === q || nn(x.name) === q || (x.alias || []).some(a => nn(a) === q)) || L.find(x => nn(x.name).startsWith(q)) || null; }
  // v7panel9: перекраска волос выключена по умолчанию — все герои рисуются исходными спрайтами. Включить: CONFIG.hairRecolor = { enabled: true }
  const HAIR_RC = () => !!(C.hairRecolor && C.hairRecolor.enabled === true); // старая перекраска по маске (heroes6/hair) — выкл.
  // v49.7: цирюльник — готовые спрайты assets/heroes7/<гильдия>_<m|f>_<класс>_<волосы>.png: класс + пол + гильдия героя + цвет волос. Выключить: CONFIG.barber = { enabled: false } (вернутся старые спрайты heroes6)
  const BARB = () => Object.assign({ enabled: true, autoGuild: true }, C.barber || {}), BARB_ON = () => BARB().enabled !== false;
  const HAIR_ON = () => BARB_ON() || HAIR_RC();
  const hairNm = h => (h.rpg_gender === 'female' ? 'f_' : 'm_') + h.rpg_class;
  const hairOk = (h, x) => !!x && (!x.only || x.only.includes(h.rpg_class + '_' + (h.rpg_gender === 'female' ? 'f' : 'm')));
  const hairsFor = h => HAIRS().filter(x => hairOk(h, x));
  // v7panel12: косметика (ауры, сеты-окраски, следы, витрина, выпадение, вкладка) выключена до утверждения Tim. Данные героев (rpg_owned/rpg_eq) не трогаются. Включить: CONFIG.cosmetics.enabled = true
  const COS_ON = () => !!(C.cosmetics && C.cosmetics.enabled === true);
  // v7panel24: готовка пачкой (!готовить 3 / !готовить <блюдо> 3) — по умолчанию выключено
  const BCK = () => Object.assign({ enabled: false, max: 5 }, C.batchCook || {}), BC_ON = () => BCK().enabled === true, BC_MAX = () => Math.max(1, Math.floor(+BCK().max || 5));
  let COOK_TOK = Infinity; // токенов готовки у героя на момент команды (ставит обёртка наград)
  const EQ_COS = (h, t) => (COS_ON() || !['aura', 'set', 'trail'].includes(t)) ? (h.rpg_eq || {})[t] : ''; // надетая косметика с учётом флага (титул/питомец — как было)
  const hairPrice = () => (C.hair && C.hair.price) || 250;
  // v8.4: борода у цирюльника — только у мужских героев, цвет = цвет волос. !парикмахер борода — отрастить/сбрить. Цена: CONFIG.hair.beardPrice (по умолчанию как стрижка)
  const beardPrice = () => (C.hair && C.hair.beardPrice != null ? +C.hair.beardPrice : hairPrice());
  const beardOk = h => !!h && h.rpg_gender !== 'female';
  const beardOf = h => beardOk(h) && !!h.rpg_beard;
  const BEARD_RE = /^(борода|бороду|бороды|бород|сбрить|побрить|побриться|бритьё|бритье|отрастить|beard|shave)(\s|$)/;
  function hairCmd(nick, q) {
    if (/^(котик|кот|кота|котика|кошку|кошка|погладить кота|погладить котика)$/i.test(String(q || '').trim())) return petCat(nick); // v8.7
    if (/^(погладить|пёсик|песик|пес|пёс)$/i.test(String(q || '').trim())) return petDog(nick); // v8.6: кнопка пульта шлёт через разрешённую ретранслятором команду
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    if (!HAIR_ON()) return res(h, false, 'парикмахер временно недоступен: Цирюльника пока нет на месте'); // v7panel9: цвет волос сохраняется, но не применяется
    const cur = hairById(hairOf(h)), P = hairPrice();
    if (!q || !String(q).trim()) return res(h, true, `парикмахер (${P} з): сейчас ${cur ? cur.name : '?'}${beardOf(h) ? ' с бородой' : ''}. Цвета: ` + hairsFor(h).map(x => `${HAIRS().indexOf(x) + 1}.${x.name}`).join(' · ') + ' — !парикмахер <цвет>' + (BARB_ON() && beardOk(h) ? ` · борода (${beardPrice()} з) — !парикмахер борода` : ''));
    if (BARB_ON() && BEARD_RE.test(lc(String(q).trim()).replace(/ё/g, 'е'))) { // v8.4: борода — переключатель
      if (!beardOk(h)) return res(h, false, 'борода бывает только у героев-мужчин');
      const BP = beardPrice(), on = !h.rpg_beard;
      if (h.rpg_gold < BP) return res(h, false, `${on ? 'отрастить бороду' : 'сбрить бороду'} стоит ${BP} з, у тебя ${Math.floor(h.rpg_gold)} з`);
      h.rpg_gold -= BP; h.rpg_beard = on ? 1 : 0; h7Load(hero7Name(h)); save(); refreshUI(); publishSnapSoon();
      return res(h, true, on ? `парикмахер: борода отращена (−${BP} з)` : `парикмахер: борода сбрита (−${BP} з)`);
    }
    const x = hairResolve(q); if (!x) return res(h, false, 'нет такого цвета. Цвета: ' + hairsFor(h).map(z => z.name).join(', '));
    if (!hairOk(h, x)) return res(h, false, `«${x.name}» есть только у ${(x.only || []).map(z => z === 'mage_f' ? 'магини' : z).join(', ')}. Цвета: ` + hairsFor(h).map(z => z.name).join(', ')); // v49.7
    if (cur && x.id === cur.id) return res(h, false, `у тебя уже ${x.name} цвет волос`);
    if (h.rpg_gold < P) return res(h, false, `стрижка стоит ${P} з, у тебя ${Math.floor(h.rpg_gold)} з`);
    h.rpg_gold -= P; h.rpg_hair = x.id; h7Load(hero7Name(h)); save(); refreshUI(); publishSnapSoon();
    const hid = BARB_ON() ? '' : /assassin|paladin/.test(h.rpg_class) ? ' (под капюшоном/шлемом видно мало)' : '';
    return res(h, true, `парикмахер: волосы теперь ${x.name} (−${P} з)${hid}`);
  }
  function buyEquip(nick, q) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    { const sq0 = String(q || '').trim().toLowerCase().replace(/ё/g, 'е'); if (/^железо(?:\s|$)/.test(sq0)) return stoneToIron(nick, sq0.replace(/^железо\s*/, '')); } // v49: рынок ур.6: камень → железо
    if (!q || !String(q).trim()) return res(h, true, `кузница (${className(h)}): ` + eqForClass(h).map((i, k) => `${k + 1}.${i.name} ${i.price}з`).join(' · '));
    { const pz = petResolve(h, q); if (pz) { h.rpg_eq.pet = pz.id; save(); refreshUI(); return res(h, true, `питомец: ${pz.name}`); } } // v7panel12 п.7: питомец надевается и без косметики
    const it = eqResolve(q, h); if (it && !eqAllowed(h, it)) return eqDeny(h, it); if (!it) { const cz = COS_ON() && cosResolve(q); if (cz) return buyCos(h, cz); return res(h, false, 'нет такой вещи. Список: !купить'); }
    eqOf(h); const bs = (S.buildings.blacksmith || {}).lv || 1;
    if (h.rpg_eqOwn.includes(it.id)) { 
      const slot = ringSlot(h, it); if (!slot) return res(h, false, `«${it.name}» уже надето`); // v49.8
      h.rpg_equip[slot] = it.id; save(); refreshUI(); return res(h, true, `надевает: ${it.name}`); 
    }
    if (bs < needBs(it)) return res(h, false, `«${it.name}» нужна кузница ур.${needBs(it)} (сейчас ${bs}) — !вклад кузница`);
    const PR9 = Math.round(it.price * g9SmithK(h)); // v9d: скидка гильдии недели
    if (h.rpg_gold < PR9) return res(h, false, `«${it.name}» стоит ${PR9} золота, у тебя ${h.rpg_gold}`);
    h.rpg_gold -= PR9; h.rpg_eqOwn.push(it.id); 
    const slot = it.slot === 'ring1' && h.rpg_equip.ring1 ? 'ring2' : it.slot;
    h.rpg_equip[slot] = it.id; save(); refreshUI();
    log(`⚒ ${DN(h)}: покупка «${it.name}» (${eqStatTxt(it)})`, '#ffd27a'); return res(h, true, `покупает и надевает «${it.name}»: ${eqStatTxt(it)}`);
  }
  function wearEquip(nick, q) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' }; eqOf(h);
    { const sq0 = String(q || '').trim().toLowerCase().replace(/ё/g, 'е'); let mm; // v49: «!экип заточка …» / «!экип смена …» — те же команды через разрешённую кнопкой пульта «экип»
      if ((mm = /^(?:заточка|точить)(?:\s+(.*))?$/.exec(sq0))) return sharpenCmd(nick, mm[1] || '');
      if ((mm = /^(?:трофей|трофеи)(?:\s+(.*))?$/.exec(sq0))) return trophyCmd(nick, mm[1] || ''); // v49.8: «!экип трофей <id>» — для кнопки пульта
      if ((mm = /^смена(?:\s+(.*))?$/.exec(sq0))) return changeCmd(nick, mm[1] || ''); }
    { const sq = String(q || '').trim().toLowerCase().replace(/ё/g, 'е'); if (/^сет(?:\s+.*)?$/.test(sq) && !/^сет\s+[^\d\sсs]/.test(sq)) return setsCmd(nick, sq.replace(/^сет\s*/, '')); } // v47: «!экип сет 2», «!экип сет сохранить 1»
    if (!q || !String(q).trim()) return res(h, true, 'снаряжение: ' + (EQ().slots.map(([s, n]) => `${n}: ${(eqItem(h.rpg_equip[s]) || {}).name || '—'}`).join(' · ')));
    { const pz = petResolve(h, q); if (pz) { h.rpg_eq.pet = pz.id; save(); refreshUI(); return res(h, true, `питомец: ${pz.name}`); } } // v7panel12 п.7: питомец надевается и без косметики
    const it = eqResolve(q, h);
    if (!(it && eqAllowed(h, it) && h.rpg_eqOwn.includes(it.id))) { const lg = lootOwnedResolve(h, q); if (lg) return lootWearInfo(h, lg); } // v46: трофей сундука (rpg_gear) с тем же именем, что вещь кузницы («Мифриловый доспех») — объясняем, а не «нет в сумке»/«не для класса»
    if (it && !eqAllowed(h, it)) return eqDeny(h, it); if (!it || !h.rpg_eqOwn.includes(it.id)) { const cz = COS_ON() && cosResolve(q, h); if (cz && cosOwn(h, cz)) { h.rpg_eq[cz.type] = cz.id; save(); refreshUI(); return res(h, true, `надевает: ${cz.name}`); } return res(h, false, 'этой вещи нет в сумке (купить: !купить)'); }
    const slot = ringSlot(h, it); if (!slot) return res(h, false, `«${it.name}» уже надето`); // v49.8: одно кольцо — в один слот
    h.rpg_equip[slot] = it.id; save(); refreshUI(); return res(h, true, `надевает: ${it.name}`);
  }
  // v7panel12 п.7: питомец — своя ячейка в окне героя и на пульте (ранее надевался только из вкладки «Косметика», которая выключена)
  const petsOwn = h => ((h.rpg_owned || {}).pet || []).map(id => C.petList.find(p => p.id === id)).filter(Boolean);
  function petResolve(h, q) { q = String(q || '').trim().toLowerCase(); if (!q) return null; return petsOwn(h).find(p => p.id === q || p.name.toLowerCase() === q || ('пет ' + p.name.toLowerCase()) === q) || null; }
  function buySeeds(nick, n) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    n = Math.max(1, Math.min(10, +n || 1));
    const price = n * 150;
    if (h.rpg_gold < price) return res(h, false, `семена: ${n} шт. стоят ${price} з, у тебя ${h.rpg_gold}`);
    h.rpg_gold -= price; h.seeds += n; seedMark(h);
    emitBot({ event: 'vegDelta', reason: 'buySeeds', user: h.user, txid: vtx(h, 'bs'), gold: 0, goldTotal: h.rpg_gold || 0, delta: { seeds: n }, seeds: n }, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); // v46: раньше купленные семена боту не уходили — следующий farmVars их стирал
    save(); refreshUI();
    return res(h, true, `покупает ${n} семян за ${price} з (всего ${h.seeds})`);
  }
  // v49.8: цена продажи = 30% цены вещи + доля (sharpen.sellBack, по умолчанию 0.5) золота, которое стоила заточка до текущего уровня (sharpen.cost, для оффхенда ×offhandCost.goldMul).
  // Всегда меньше, чем покупка + заточка, поэтому на перепродаже не заработать.
  const SELL_SH_K = () => { const v = (C.sharpen || {}).sellBack; return v == null ? 0.5 : Math.max(0, Math.min(0.9, +v || 0)); };
  function shGoldSpent(h, it, lv) { let g = 0; for (let t = 1; t <= lv; t++) { const c = shCost(h, it, t); if (c) g += c.gold; } return g; }
  function eqSellPrice(h, it, extra) { const lv = extra || !SH_ON() ? 0 : shLv(h, it.id); return Math.round(it.price * 0.3) + Math.round(shGoldSpent(h, it, lv) * SELL_SH_K()); }
  function sellEquip(nick, q, confirmed) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    const it = eqResolve(q, h); if (!it || !h.rpg_eqOwn.includes(it.id)) return res(h, false, 'этой вещи нет в сумке');
    if (Object.values(h.rpg_equip).filter(x => x === it.id).length >= h.rpg_eqOwn.filter(x => x === it.id).length) return res(h, false, 'сначала сними вещь (!снять)'); // v49.8: кольцо во 2-м слоте тоже считается надетым; лишнюю копию можно продать
    { const lvS = SH_ON() ? shLv(h, it.id) : 0; if (lvS >= SH().sellConfirmFrom && !confirmed) { const p0 = CPEND[h.user]; if (!(p0 && p0.kind === 'sell' && p0.id === it.id && Date.now() - p0.t <= 30000)) { CPEND[h.user] = { kind: 'sell', id: it.id, t: Date.now() }; return res(h, false, `«${it.name}» заточена на +${lvS}: при продаже заточка пропадёт, получишь ${eqSellPrice(h, it, false)} з. Чтобы продать — напиши !да (или повтори «Продать» ещё раз) в течение 30 с`); } delete CPEND[h.user]; } }
    const dup = h.rpg_eqOwn.filter(x => x === it.id).length > 1, price = eqSellPrice(h, it, dup), lvS = dup ? 0 : (SH_ON() ? shLv(h, it.id) : 0);
    { const k = h.rpg_eqOwn.indexOf(it.id); h.rpg_eqOwn.splice(k, 1); } if (!dup) { if (h.rpg_sharp) delete h.rpg_sharp[it.id]; if (h.rpg_sharpPity) delete h.rpg_sharpPity[it.id]; } // v49.8: лишняя копия продаётся по одной, заточка остаётся на оставшейся
    h.rpg_gold += price;
    save(); refreshUI();
    log(`💰 ${DN(h)}: продажа «${it.name}» за ${price} з`, '#ffd27a');
    return res(h, true, `продаёт «${it.name}»${lvS ? ` +${lvS}` : ''}${dup ? ' (лишняя копия)' : ''} за ${price} золота (30% цены${lvS ? ` + ${Math.round(SELL_SH_K() * 100)}% золота, потраченного на заточку` : ''})`);
  }
  // v7panel44: продажа пассивного лута сундука (rpg_gear) — только по id, цена 40*tier на сервере; не путать с кузней (!продать <id>) и овощами
  function gearById(id) { return (C.gear || []).find(x => x.id === id) || null; }
  // v49.8: трофеи сундука — активен только один (h.rpg_trophyOn); если не выбран или продан — лучший (выше ряд, при равенстве — первый в config.gear). Старые сохранения: активный = лучший.
  function trophyOn(h) { const L = [...new Set(h && h.rpg_gear || [])].map(gearById).filter(Boolean); if (!L.length) return null; const pick = L.find(g => g.id === h.rpg_trophyOn); if (pick) return pick;
    return L.slice().sort((a, b) => (b.tier || 0) - (a.tier || 0) || (C.gear.indexOf(a) - C.gear.indexOf(b)))[0]; }
  function trophyCmd(nick, q) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    const L = [...new Set(h.rpg_gear || [])].map(gearById).filter(Boolean), on = trophyOn(h);
    if (!L.length) return res(h, false, 'трофеев нет — они выпадают из сундуков в походах');
    q = String(q || '').trim(); if (!q) return res(h, true, '🏆 трофеи (действует только активный): ' + L.map(g => `${g.id === (on || {}).id ? '✓ ' : ''}${g.name} (${gearBonusTxt(g)})`).join(' · ') + ' · сменить: !трофей <название>');
    const g = lootOwnedResolve(h, q); if (!g) return res(h, false, 'такого трофея нет. Твои: ' + L.map(x => x.name).join(', '));
    if (on && on.id === g.id) return res(h, false, `трофей «${g.name}» уже активный`);
    h.rpg_trophyOn = g.id; save(); refreshUI(); publishSnapSoon();
    return res(h, true, `активный трофей: «${g.name}» (${gearBonusTxt(g)})${on ? `; «${on.name}» больше не действует` : ''}`, '#ffd27a');
  }
  function gearBonusTxt(g) {
    if (!g) return 'пассив сундука';
    const p = [];
    if (g.atk) p.push('+' + Math.round(g.atk * 100) + '% урон');
    if (g.def) p.push('+' + g.def + ' защита');
    return p.length ? p.join(', ') : 'пассив сундука';
  }
  // v46: трофеи сундука (C.gear → h.rpg_gear) — пассив для любого класса, слота не занимают; надевать нечего
  function lootOwnedResolve(h, q) { q = String(q || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/^(?:лут|loot)(?:\s+|:)/, ''); if (!q) return null;
    const L = (h.rpg_gear || []).map(gearById).filter(Boolean), nn = x => x.name.toLowerCase().replace(/ё/g, 'е');
    return L.find(g => g.id === q || nn(g) === q) || L.find(g => nn(g).startsWith(q)) || null; }
  function lootWearInfo(h, g) { const on = trophyOn(h), act = on && on.id === g.id; return res(h, true, `«${g.name}» — 🏆 трофей из сундука, его не надевают: ${act ? `это твой активный трофей, бонус ${gearBonusTxt(g)} действует` : `сейчас не действует (активный: «${on ? on.name : '—'}»). Сделать активным: !трофей ${g.id}`}. Действует только один трофей. Продать: !продать лут ${g.id} (${gearSellPrice(g)} з)`); }
  function gearSellPrice(g) { const t = Math.max(1, Math.min(3, Math.floor(+(g && g.tier) || 1))); return 40 * t; }
  function parseLootSellArg(q) {
    const s = String(q == null ? '' : q).trim();
    const m = /^(?:лут|loot)(?:\s+|:)([a-z][a-z0-9_]{0,23})$/i.exec(s);
    return m ? m[1].toLowerCase() : null;
  }
  function sellLoot(nick, q) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    const blk = blocked(h, 'town'); if (blk) return res(h, false, 'продать лут можно в городе — ' + blk.replace(/^нельзя: /, ''));
    if (BATTLES.some(b => b.user === h.user)) return res(h, false, 'нельзя продавать лут во время боя');
    let raw = String(q == null ? '' : q).trim();
    if (!/^(?:лут|loot)(?:\s+|:)/i.test(raw)) raw = 'лут ' + raw;
    const id = parseLootSellArg(raw);
    if (!id) return res(h, false, 'как продать лут: !продать лут <id>, например !продать лут sword2');
    const gitem = gearById(id);
    if (!gitem) return res(h, false, 'такого лута нет');
    if (!(h.rpg_gear || []).includes(gitem.id)) return res(h, false, 'этого лута нет в сумке');
    const price = gearSellPrice(gitem), bonus = gearBonusTxt(gitem);
    h.rpg_gear = (h.rpg_gear || []).filter(x => x !== gitem.id); if (h.rpg_trophyOn === gitem.id) delete h.rpg_trophyOn;
    h.rpg_gold = (h.rpg_gold || 0) + price;
    save(); refreshUI();
    log(`💰 ${DN(h)}: продажа лута «${gitem.name}» за ${price} з (−${bonus})`, '#ffd27a');
    return res(h, true, `продаёт лут «${gitem.name}» за ${price} золота (теряет пассив: ${bonus})`);
  }
  function unequip(nick, slotQ) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' }; eqOf(h);
    { const q = String(slotQ || '').toLowerCase(), m = { косметика: COS_TYPES, аура: ['aura'], сет: ['set'], окраска: ['set'], след: ['trail'], cos: COS_TYPES }[q]; if (m && COS_ON()) { m.forEach(t => h.rpg_eq[t] = ''); save(); refreshUI(); return res(h, true, 'косметика снята'); } }
    if (/^(питомец|питомца|пет|pet)$/.test(String(slotQ || '').toLowerCase())) { if (!h.rpg_eq.pet) return res(h, false, 'питомца нет'); h.rpg_eq.pet = ''; save(); refreshUI(); return res(h, true, 'питомец снят'); } // v7panel12 п.7 (раньше «!снять pet» снимал титул)
    const s = EQ_SLOT_RU[String(slotQ).toLowerCase()] || slotQ; if (!EQ().slots.some(x => x[0] === s)) return null;
    delete h.rpg_equip[s]; save(); refreshUI(); return res(h, true, 'снято');
  }
  // ===================== v47: два сета снаряжения (Сет 1 / Сет 2) =====================
  // h.rpg_sets = [ {слот: id вещи} | null, … ] — ссылки на вещи из сумки (rpg_eqOwn, id уникальны). Прочность хранится по id вещи (rpg_dur) — смена сета её не трогает.
  // !сет — показать · !сет 1|2 — надеть · !сет сохранить 1|2 — запомнить надетое. С пульта: «!экип сет 2» / «!экип сет сохранить 2» (relay пускает «экип» и без обновления).
  // Вещь продана / не для класса / пропала из config → ⚠ пропускается, слот остаётся как есть. В бою (поход, босс) переодеваться нельзя. Выключить: CONFIG.equipSets = { enabled: false }.
  const SETS_N = 2, SET_SLOTS = ['weapon', 'armor', 'offhand', 'trinket', 'ring1', 'ring2'];
  const SETS_ON = () => !(C.equipSets && C.equipSets.enabled === false);
  const SET_SLOT_RU = { weapon: 'Оружие', armor: 'Броня', offhand: 'Левая рука', trinket: 'Амулет', ring1: 'Кольцо 1', ring2: 'Кольцо 2' };
  function setsOf(h) { if (!Array.isArray(h.rpg_sets)) h.rpg_sets = []; for (let i = 0; i < SETS_N; i++) { const x = h.rpg_sets[i]; h.rpg_sets[i] = x && typeof x === 'object' && !Array.isArray(x) ? x : null; } h.rpg_sets.length = SETS_N; return h.rpg_sets; }
  function setBusy(h) { const st = heroState(h);
    if (st === 'expedition' || st === 'boss' || BATTLES.some(b => b.user === h.user) || (bossFighting() && BF.all && BF.all[h.user])) return `герой ${STATE_NAME[st === 'boss' ? 'boss' : 'expedition']} — переодеться можно после боя`;
    return ''; }
  const setSlotOk = (it, s) => it.slot === s || (it.slot === 'ring1' && (s === 'ring1' || s === 'ring2'));
  function setCheck(h, set) { const e = eqOf(h);
    return SET_SLOTS.filter(s => set && set[s]).map(s => { const id = set[s], it = eqItem(id), cur = e[s] || '';
      const k = !it || !setSlotOk(it, s) ? 'gone' : !h.rpg_eqOwn.includes(id) ? 'sold' : !eqAllowed(h, it) ? 'cls' : cur === id ? 'same' : 'new';
      return { s, id, it, cur, k }; }); }
  const setNm = id => (eqItem(id) || {}).name || id || '—';
  const setWhy = r => r.k === 'sold' ? 'продано, нет в сумке' : r.k === 'cls' ? 'не для класса' : 'вещи больше нет в игре';
  function eqSetActive(h) { const L = setsOf(h), m = [];
    L.forEach((set, i) => { if (!set) return; const R = setCheck(h, set); if (R.some(r => r.k === 'same') && !R.some(r => r.k === 'new')) m.push(i + 1); });
    return m.includes(+h.rpg_setOn) ? +h.rpg_setOn : (m[0] || 0); }
  function setWear(h, n) { const set = setsOf(h)[n - 1];
    if (!set || !Object.keys(set).length) return res(h, false, `сет ${n} пуст — наденьте вещи и сохраните: !сет сохранить ${n}`);
    const busy = setBusy(h); if (busy) return res(h, false, `сет ${n}: ${busy}`);
    const R = setCheck(h, set), ch = R.filter(r => r.k === 'new'), bad = R.filter(r => r.k === 'sold' || r.k === 'cls' || r.k === 'gone');
    const skip = bad.length ? `; пропущено: ${bad.map(r => `«${setNm(r.id)}» — ${setWhy(r)}${r.k === 'cls' ? ' ' + className(h) : ''}, слот как был`).join('; ')}` : '';
    if (!ch.length) { if (bad.length && !R.some(r => r.k === 'same')) return res(h, false, `сет ${n} не надет: ничего из него нельзя надеть${skip}`); h.rpg_setOn = n; return res(h, true, `сет ${n} уже надет${skip}`); }
    const e = eqOf(h), placed = new Set(ch.map(r => r.id));
    ch.forEach(r => { e[r.s] = r.id; });
    SET_SLOTS.forEach(s => { if (e[s] && placed.has(e[s]) && !ch.some(r => r.s === s)) delete e[s]; }); // кольцо переехало в другой слот — не оставляем дубль
    h.rpg_setOn = n; save(); refreshUI();
    return res(h, true, `👕 надевает сет ${n}: ${ch.map(r => `${SET_SLOT_RU[r.s]}: ${setNm(r.cur)} → ${setNm(r.id)}`).join(', ')}${skip}`, '#ffd27a'); }
  function setSave(h, n) { const busy = setBusy(h); if (busy) return res(h, false, `сет ${n}: ${busy}`);
    const e = eqOf(h), o = {}; SET_SLOTS.forEach(s => { const it = eqItem(e[s]); if (it && eqAllowed(h, it) && h.rpg_eqOwn.includes(it.id)) o[s] = it.id; });
    if (!Object.keys(o).length) return res(h, false, `нечего сохранять в сет ${n} — ничего не надето`);
    setsOf(h)[n - 1] = o; h.rpg_setOn = n; save(); refreshUI();
    return res(h, true, `💾 сет ${n} сохранён (${Object.keys(o).length} ${plural(Object.keys(o).length, 'вещь', 'вещи', 'вещей')}): ${Object.keys(o).map(s => setNm(o[s])).join(', ')}`); }
  function setsCmd(nick, q) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' }; eqOf(h); setsOf(h);
    if (!SETS_ON()) return res(h, false, 'сеты снаряжения выключены');
    q = String(q || '').trim().toLowerCase().replace(/ё/g, 'е');
    let m = /^([0-9]+)$/.exec(q); if (m) { const n = +m[1]; if (n < 1 || n > SETS_N) return res(h, false, `сетов два: !сет 1 или !сет 2`); return setWear(h, n); }
    m = /^(?:сохранить|сохрани|сохр|запомнить|save)\s*([0-9]+)$/.exec(q) || /^([0-9]+)\s*(?:сохранить|сохрани|сохр|save)$/.exec(q);
    if (m) { const n = +m[1]; if (n < 1 || n > SETS_N) return res(h, false, `сетов два: !сет сохранить 1 или !сет сохранить 2`); return setSave(h, n); }
    if (q) return res(h, false, 'как пользоваться: !сет 1 / !сет 2 — надеть, !сет сохранить 1 / !сет сохранить 2 — запомнить надетое');
    const a = eqSetActive(h);
    return res(h, true, setsOf(h).map((set, i) => `сет ${i + 1}${a === i + 1 ? ' (надет)' : ''}: ${set && Object.keys(set).length ? Object.keys(set).map(s => setNm(set[s])).join(', ') : 'пусто'}`).join(' · ') + ' — !сет 1|2, !сет сохранить 1|2'); }
  // для пульта (компактно, снимок ≤256 КБ): ref.sets = число сетов (пульт по нему включает вкладки); me.sets — только если герой что-то сохранил:
  // { s: [ {слот:id}|0, … ], a: надетый сет (0 — ни один), lk?: почему нельзя переодеться сейчас }
  function panelSets(h) { if (!SETS_ON() || !h) return undefined; const L = setsOf(h); if (!L.some(Boolean)) return undefined; const o = { s: L.map(x => x ? Object.assign({}, x) : 0), a: eqSetActive(h) }, lk = setBusy(h); if (lk) o.lk = lk; return o; }
  const xpNeed = h => 50 * h.rpg_level;
  const recipeById = id => (C.recipes || []).find(r => r.id === id);

  const logEl = document.getElementById('logList');
  function log(text, color) { S.log.push({ t: Date.now(), text, color: color || '' }); if (S.log.length > 200) S.log.shift(); try { EVH.push({ t: Date.now(), text }); while (EVH.length > 3000 || (EVH.length && EVH[0].t < Date.now() - 16 * 60000)) EVH.shift(); } catch (e) {} renderLog(); }
  // v7panel28 п.4: история событий для журнала пульта по времени (не сохраняется; S.log режется на 200 строк и годится только для окна игры)
  var EVH = [];
  function renderLog() { if (logEl) logEl.innerHTML = S.log.slice(-9).map(l => `<div style="color:${l.color || '#f6e7c8'}">${esc(l.text)}</div>`).join(''); }

  function save() { try { localStorage.setItem(C.saveKey, JSON.stringify(S)); } catch (e) { } }
  function load() { try { const raw = localStorage.getItem(C.saveKey); if (raw) { const d = JSON.parse(raw); if (d && d.heroes) return migrate(d); } } catch (e) { } return null; }
  // v49.7: цирюльник. Один раз: у всех героев волосы «каштановый» (как старый спрайт; прежний случайный цвет — в rpg_hairOld). Каждый раз: герой без гильдии → в самую маленькую (как autoGuild).
  function barberMigrate(d, b7) {
    if (!BARB_ON() || !d || !d.heroes) return;
    if (!b7) { for (const n in d.heroes) { const h = d.heroes[n]; if (!h) continue; if (h.rpg_hair && h.rpg_hair !== 'chestnut') h.rpg_hairOld = h.rpg_hair; h.rpg_hair = 'chestnut'; } d.barber7 = 1; }
    if (BARB().autoGuild === false) return;
    const ids = C.guilds.map(g => g.id), cnt = {}; ids.forEach(g => cnt[g] = 0);
    for (const n in d.heroes) { const h = d.heroes[n]; if (h && cnt[h.rpg_guild] !== undefined) cnt[h.rpg_guild]++; }
    for (const n of (d.order || Object.keys(d.heroes))) { const h = d.heroes[n]; if (!h || cnt[h.rpg_guild] !== undefined) continue; const g = ids.slice().sort((a, b) => cnt[a] - cnt[b])[0]; h.rpg_guild = g; h.rpg_guildJoined = Date.now(); h.rpg_guildAuto = 1; cnt[g]++; }
  }
  function migrate(d) {
    const b7 = d && d.barber7; // v49.7: флаг цирюльника до подстановки значений по умолчанию
    const base = newState(); if (d.season === undefined) d.season = 1; // v49: сохранение без номера сезона — это Сезон 1
    for (const k in base) if (d[k] === undefined) d[k] = base[k];
    BLD.forEach(id => { if (!d.buildings[id]) d.buildings[id] = { lv: 1, fund: 0 }; });
    delete d.beds; delete d.quests; delete d.magicBedLast;
    barberMigrate(d, b7);
    for (const n in d.heroes) { const h = d.heroes[n] = Object.assign(newHero(n, 'warrior', 'male'), d.heroes[n]); if (typeof h.rpg_chests === 'number') { if (h.rpg_chests) h.rpg_chestBox = { wooden: h.rpg_chests }; h.rpg_chests = 0; } if (!clsById(h.rpg_class) || !C.classes.some(c => c.id === h.rpg_class)) h.rpg_class = 'warrior'; }
    for (const n in d.heroes) { const h = d.heroes[n]; if (h.rpg_eq) h.rpg_eq.hat = ''; if (h.rpg_owned) h.rpg_owned.hat = []; } // v6.30: шляпы убраны, старые сохранения не ломаются
    // v6.31: готовка, начатая со старой (долгой) длительностью — пересчитываем под новое время, сохраняя долю прогресса
    // v6.31: зелья из сорняков больше нет — из сумок убираем (+10 золота за штуку), начатую варку отменяем с возвратом сорняков
    for (const n in (d.heroes || {})) { const h = d.heroes[n]; if (h && h.rpg_bag && h.rpg_bag.weedpot) { h.rpg_gold = (h.rpg_gold || 0) + 10 * h.rpg_bag.weedpot; delete h.rpg_bag.weedpot; } }
    (d.cooking || []).forEach(j => { if (j && j.id && !C.recipes.some(x => x.id === j.id) && d.heroes && d.heroes[j.user] && j.id === 'weedpot') d.heroes[j.user].veg_weed = (d.heroes[j.user].veg_weed || 0) + 5; });
    d.cooking = (d.cooking || []).filter(j => j && j.id && C.recipes.some(x => x.id === j.id)); d.cooking.forEach(j => { j.started = true; const r = (C.recipes || []).find(x => x.id === j.id), n = recipeSec(r); if (j.need !== n) { const f = j.need > 0 ? Math.max(0, Math.min(1, j.left / j.need)) : 1; j.need = n; j.left = Math.round(n * f * 10) / 10; } });
    delete d.spins; d.prizes = (d.prizes || []).map(p => Object.assign({ done: false }, p));
    // v6.44: Лесной тролль → Огр (титулы, текущий босс, итоги)
    const T644 = { 'Истребитель троллей': 'Истребитель огров', 'Гроза троллей': 'Гроза огров' }, ogre = n => String(n || '').replace(/Лесной тролль/g, 'Огр').replace(/Лесного тролля/g, 'Огра').replace(/ тролль/g, ' огр').replace(/ тролля/g, ' огра');
    for (const n in d.heroes) { const h = d.heroes[n]; if (h.rpg_eq && T644[h.rpg_eq.title]) h.rpg_eq.title = T644[h.rpg_eq.title]; if (h.rpg_owned && Array.isArray(h.rpg_owned.title)) h.rpg_owned.title = h.rpg_owned.title.map(t => T644[t] || t); if (T644[h.rpg_title]) h.rpg_title = T644[h.rpg_title]; }
    for (const b of [d.boss, d.lastBoss, d.stream && d.stream.boss]) if (b && typeof b === 'object') { if (b.key === 'troll_boss') b.key = 'ogre_boss'; for (const k of ['name', 'gen', 'acc']) if (b[k]) b[k] = ogre(b[k]); }
    d.order = d.order.filter(n => d.heroes[n]);
    d.seats = (d.seats || []).map(n => d.heroes[n] ? n : null);
    d.clock = Math.max(d.clock || 0, Math.floor(Date.now() / 1000));
    return d;
  }

  // ===================== ПОЗИЦИИ НА ЛОКАЦИЯХ =====================
  const NAV = window.NAV || { road: 1300, locs: {} };
  const ROAD = NAV.road;                      // по этой высоте тропинки пересекают границы локаций
  // ===== v6.19: сцены B (постройки нарисованы на фоне), слоты героев из layout_v618 =====
  const L6 = window.LAYOUT6 || {}, M6 = window.HERO6_META || {};
  if (L6.garden) { L6.garden.beds = [[500, 436, 850, 600], [864, 436, 1186, 600], [1246, 436, 1557, 600], [1579, 436, 1857, 600], [357, 636, 771, 836], [786, 636, 1171, 836], [1243, 636, 1621, 836], [1650, 636, 2079, 836]]; L6.garden.slots = [{"x": 530, "y": 618, "type": "stand", "face": "R", "bed": [500, 436, 850, 600], "prio": 2}, {"x": 894, "y": 618, "type": "stand", "face": "R", "bed": [864, 436, 1186, 600], "prio": 1}, {"x": 1527, "y": 618, "type": "stand", "face": "L", "bed": [1246, 436, 1557, 600], "prio": 3}, {"x": 1827, "y": 618, "type": "stand", "face": "L", "bed": [1579, 436, 1857, 600], "prio": 5}, {"x": 387, "y": 854, "type": "stand", "face": "R", "bed": [357, 636, 771, 836], "prio": 6}, {"x": 816, "y": 854, "type": "stand", "face": "R", "bed": [786, 636, 1171, 836], "prio": 4}, {"x": 1591, "y": 854, "type": "stand", "face": "L", "bed": [1243, 636, 1621, 836], "prio": 7}, {"x": 2049, "y": 854, "type": "stand", "face": "L", "bed": [1650, 636, 2079, 836], "prio": 8}]; } // v8.6: новый фон огорода — 8 грядок 2×4
  // v49.7: спрайты цирюльника (assets/heroes7, 768×1024 → обрезаны, ступни на одной линии, рост как у старых heroes6). w/h/fx/fy — в тех же единицах, что HERO6_META
  // scale_fix: w/h/fx/fy умножены на коэф. класса, чтобы тело (глаза–ступни) совпадало с эталоном лучник/паладин/жрец; ступни остаются на базовой линии.
  // scale_fix heads: у f_warrior / f_assassin / m_assassin голова+волосы/капюшон увеличены на 15% от шеи; при выходе за край холст расширен сверху, fy/h обновлены.
  // v8.3: новые спрайты (assets/heroes8): приглушённые гильдии, светлая кожа, тело выровнено от подбородка до ступней; _beard — вариант с бородой
  const H7 = {"fire_m_archer_black":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"fire_m_archer_black_beard":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"fire_m_archer_blond":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"fire_m_archer_blond_beard":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"fire_m_archer_chestnut":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"fire_m_archer_chestnut_beard":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"fire_m_archer_red":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"fire_m_archer_red_beard":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"gold_m_archer_black":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"gold_m_archer_black_beard":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"gold_m_archer_blond":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"gold_m_archer_blond_beard":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"gold_m_archer_chestnut":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"gold_m_archer_chestnut_beard":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"gold_m_archer_red":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"gold_m_archer_red_beard":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"moon_m_archer_black":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"moon_m_archer_black_beard":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"moon_m_archer_blond":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"moon_m_archer_blond_beard":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"moon_m_archer_chestnut":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"moon_m_archer_chestnut_beard":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"moon_m_archer_red":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"moon_m_archer_red_beard":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"silver_m_archer_black":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"silver_m_archer_black_beard":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"silver_m_archer_blond":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"silver_m_archer_blond_beard":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"silver_m_archer_chestnut":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"silver_m_archer_chestnut_beard":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"silver_m_archer_red":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"silver_m_archer_red_beard":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"fire_f_archer_black":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"fire_f_archer_blond":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"fire_f_archer_chestnut":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"fire_f_archer_red":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"gold_f_archer_black":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"gold_f_archer_blond":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"gold_f_archer_chestnut":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"gold_f_archer_red":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"moon_f_archer_black":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"moon_f_archer_blond":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"moon_f_archer_chestnut":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"moon_f_archer_red":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"silver_f_archer_black":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"silver_f_archer_blond":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"silver_f_archer_chestnut":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"silver_f_archer_red":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"fire_m_paladin_black":{"w":149.4,"h":236.2,"fx":63.1,"fy":236.2},"fire_m_paladin_black_beard":{"w":149.4,"h":237.5,"fx":62.8,"fy":236.9},"fire_m_paladin_blond":{"w":149.4,"h":236.9,"fx":63.1,"fy":236.9},"fire_m_paladin_blond_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"fire_m_paladin_chestnut":{"w":149.4,"h":238.1,"fx":62.8,"fy":237.5},"fire_m_paladin_chestnut_beard":{"w":149.4,"h":235.6,"fx":63.4,"fy":235.6},"fire_m_paladin_red":{"w":149.4,"h":238.1,"fx":63.1,"fy":238.1},"fire_m_paladin_red_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"gold_m_paladin_black":{"w":149.4,"h":236.2,"fx":63.1,"fy":236.2},"gold_m_paladin_black_beard":{"w":149.4,"h":237.5,"fx":62.8,"fy":236.9},"gold_m_paladin_blond":{"w":149.4,"h":236.9,"fx":63.1,"fy":236.9},"gold_m_paladin_blond_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"gold_m_paladin_chestnut":{"w":149.4,"h":238.1,"fx":62.8,"fy":237.5},"gold_m_paladin_chestnut_beard":{"w":149.4,"h":235.6,"fx":63.4,"fy":235.6},"gold_m_paladin_red":{"w":149.4,"h":238.1,"fx":63.1,"fy":238.1},"gold_m_paladin_red_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"moon_m_paladin_black":{"w":149.4,"h":236.2,"fx":63.1,"fy":236.2},"moon_m_paladin_black_beard":{"w":149.4,"h":237.5,"fx":62.8,"fy":236.9},"moon_m_paladin_blond":{"w":149.4,"h":236.9,"fx":63.1,"fy":236.9},"moon_m_paladin_blond_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"moon_m_paladin_chestnut":{"w":149.4,"h":238.1,"fx":62.8,"fy":237.5},"moon_m_paladin_chestnut_beard":{"w":149.4,"h":235.6,"fx":63.4,"fy":235.6},"moon_m_paladin_red":{"w":149.4,"h":238.1,"fx":63.1,"fy":238.1},"moon_m_paladin_red_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"silver_m_paladin_black":{"w":149.4,"h":236.2,"fx":63.1,"fy":236.2},"silver_m_paladin_black_beard":{"w":149.4,"h":237.5,"fx":62.8,"fy":236.9},"silver_m_paladin_blond":{"w":149.4,"h":236.9,"fx":63.1,"fy":236.9},"silver_m_paladin_blond_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"silver_m_paladin_chestnut":{"w":149.4,"h":238.1,"fx":62.8,"fy":237.5},"silver_m_paladin_chestnut_beard":{"w":149.4,"h":235.6,"fx":63.4,"fy":235.6},"silver_m_paladin_red":{"w":149.4,"h":238.1,"fx":63.1,"fy":238.1},"silver_m_paladin_red_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"fire_f_paladin_black":{"w":148.8,"h":236.2,"fx":63.1,"fy":236.2},"fire_f_paladin_blond":{"w":148.8,"h":235.6,"fx":62.8,"fy":235.6},"fire_f_paladin_chestnut":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"fire_f_paladin_red":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"gold_f_paladin_black":{"w":148.8,"h":236.2,"fx":63.1,"fy":236.2},"gold_f_paladin_blond":{"w":148.8,"h":235.6,"fx":62.8,"fy":235.6},"gold_f_paladin_chestnut":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"gold_f_paladin_red":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"moon_f_paladin_black":{"w":148.8,"h":236.2,"fx":63.1,"fy":236.2},"moon_f_paladin_blond":{"w":148.8,"h":235.6,"fx":62.8,"fy":235.6},"moon_f_paladin_chestnut":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"moon_f_paladin_red":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"silver_f_paladin_black":{"w":148.8,"h":236.2,"fx":63.1,"fy":236.2},"silver_f_paladin_blond":{"w":148.8,"h":235.6,"fx":62.8,"fy":235.6},"silver_f_paladin_chestnut":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"silver_f_paladin_red":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"fire_m_mage_black":{"w":135.0,"h":260.6,"fx":67.5,"fy":260.6},"fire_m_mage_black_beard":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"fire_m_mage_blond":{"w":134.4,"h":261.9,"fx":67.5,"fy":261.9},"fire_m_mage_blond_beard":{"w":134.4,"h":262.5,"fx":67.5,"fy":261.9},"fire_m_mage_chestnut":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"fire_m_mage_chestnut_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"fire_m_mage_red":{"w":134.4,"h":261.2,"fx":66.6,"fy":260.6},"fire_m_mage_red_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"gold_m_mage_black":{"w":135.0,"h":260.6,"fx":67.5,"fy":260.6},"gold_m_mage_black_beard":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"gold_m_mage_blond":{"w":134.4,"h":261.9,"fx":67.5,"fy":261.9},"gold_m_mage_blond_beard":{"w":134.4,"h":262.5,"fx":67.5,"fy":261.9},"gold_m_mage_chestnut":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"gold_m_mage_chestnut_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"gold_m_mage_red":{"w":134.4,"h":261.2,"fx":66.6,"fy":260.6},"gold_m_mage_red_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"moon_m_mage_black":{"w":135.0,"h":260.6,"fx":67.5,"fy":260.6},"moon_m_mage_black_beard":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"moon_m_mage_blond":{"w":134.4,"h":261.9,"fx":67.5,"fy":261.9},"moon_m_mage_blond_beard":{"w":134.4,"h":262.5,"fx":67.5,"fy":261.9},"moon_m_mage_chestnut":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"moon_m_mage_chestnut_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"moon_m_mage_red":{"w":134.4,"h":261.2,"fx":66.6,"fy":260.6},"moon_m_mage_red_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"silver_m_mage_black":{"w":135.0,"h":260.6,"fx":67.5,"fy":260.6},"silver_m_mage_black_beard":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"silver_m_mage_blond":{"w":134.4,"h":261.9,"fx":67.5,"fy":261.9},"silver_m_mage_blond_beard":{"w":134.4,"h":262.5,"fx":67.5,"fy":261.9},"silver_m_mage_chestnut":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"silver_m_mage_chestnut_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"silver_m_mage_red":{"w":134.4,"h":261.2,"fx":66.6,"fy":260.6},"silver_m_mage_red_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"fire_f_mage_black":{"w":133.8,"h":260.6,"fx":67.8,"fy":260.6},"fire_f_mage_blond":{"w":133.8,"h":261.2,"fx":67.5,"fy":261.2},"fire_f_mage_chestnut":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"fire_f_mage_red":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"gold_f_mage_black":{"w":133.8,"h":260.6,"fx":67.8,"fy":260.6},"gold_f_mage_blond":{"w":133.8,"h":261.2,"fx":67.5,"fy":261.2},"gold_f_mage_chestnut":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"gold_f_mage_red":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"moon_f_mage_black":{"w":133.8,"h":260.6,"fx":67.8,"fy":260.6},"moon_f_mage_blond":{"w":133.8,"h":261.2,"fx":67.5,"fy":261.2},"moon_f_mage_chestnut":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"moon_f_mage_red":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"silver_f_mage_black":{"w":133.8,"h":260.6,"fx":67.8,"fy":260.6},"silver_f_mage_blond":{"w":133.8,"h":261.2,"fx":67.5,"fy":261.2},"silver_f_mage_chestnut":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"silver_f_mage_red":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"fire_m_priest_black":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"fire_m_priest_black_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"fire_m_priest_blond":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"fire_m_priest_blond_beard":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"fire_m_priest_chestnut":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"fire_m_priest_chestnut_beard":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"fire_m_priest_red":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"fire_m_priest_red_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"gold_m_priest_black":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"gold_m_priest_black_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"gold_m_priest_blond":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"gold_m_priest_blond_beard":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"gold_m_priest_chestnut":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"gold_m_priest_chestnut_beard":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"gold_m_priest_red":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"gold_m_priest_red_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"moon_m_priest_black":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"moon_m_priest_black_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"moon_m_priest_blond":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"moon_m_priest_blond_beard":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"moon_m_priest_chestnut":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"moon_m_priest_chestnut_beard":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"moon_m_priest_red":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"moon_m_priest_red_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"silver_m_priest_black":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"silver_m_priest_black_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"silver_m_priest_blond":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"silver_m_priest_blond_beard":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"silver_m_priest_chestnut":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"silver_m_priest_chestnut_beard":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"silver_m_priest_red":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"silver_m_priest_red_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"fire_f_priest_black":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"fire_f_priest_blond":{"w":98.1,"h":234.4,"fx":53.4,"fy":233.8},"fire_f_priest_chestnut":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"fire_f_priest_red":{"w":98.1,"h":234.4,"fx":53.4,"fy":234.4},"gold_f_priest_black":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"gold_f_priest_blond":{"w":98.1,"h":234.4,"fx":53.4,"fy":233.8},"gold_f_priest_chestnut":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"gold_f_priest_red":{"w":98.1,"h":234.4,"fx":53.4,"fy":234.4},"moon_f_priest_black":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"moon_f_priest_blond":{"w":98.1,"h":234.4,"fx":53.4,"fy":233.8},"moon_f_priest_chestnut":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"moon_f_priest_red":{"w":98.1,"h":234.4,"fx":53.4,"fy":234.4},"silver_f_priest_black":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"silver_f_priest_blond":{"w":98.1,"h":234.4,"fx":53.4,"fy":233.8},"silver_f_priest_chestnut":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"silver_f_priest_red":{"w":98.1,"h":234.4,"fx":53.4,"fy":234.4},"fire_m_warrior_black":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"fire_m_warrior_black_beard":{"w":193.1,"h":239.4,"fx":91.9,"fy":239.4},"fire_m_warrior_blond":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"fire_m_warrior_blond_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"fire_m_warrior_chestnut":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"fire_m_warrior_chestnut_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"fire_m_warrior_red":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"fire_m_warrior_red_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"gold_m_warrior_black":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"gold_m_warrior_black_beard":{"w":193.1,"h":239.4,"fx":91.9,"fy":239.4},"gold_m_warrior_blond":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"gold_m_warrior_blond_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"gold_m_warrior_chestnut":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"gold_m_warrior_chestnut_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"gold_m_warrior_red":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"gold_m_warrior_red_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"moon_m_warrior_black":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"moon_m_warrior_black_beard":{"w":193.1,"h":239.4,"fx":91.9,"fy":239.4},"moon_m_warrior_blond":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"moon_m_warrior_blond_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"moon_m_warrior_chestnut":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"moon_m_warrior_chestnut_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"moon_m_warrior_red":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"moon_m_warrior_red_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"silver_m_warrior_black":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"silver_m_warrior_black_beard":{"w":193.1,"h":239.4,"fx":91.9,"fy":239.4},"silver_m_warrior_blond":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"silver_m_warrior_blond_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"silver_m_warrior_chestnut":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"silver_m_warrior_chestnut_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"silver_m_warrior_red":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"silver_m_warrior_red_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"fire_f_warrior_black":{"w":163.8,"h":236.9,"fx":75.3,"fy":236.9},"fire_f_warrior_blond":{"w":164.4,"h":237.5,"fx":75.3,"fy":236.9},"fire_f_warrior_chestnut":{"w":164.4,"h":237.5,"fx":75.0,"fy":236.9},"fire_f_warrior_red":{"w":163.8,"h":237.5,"fx":75.0,"fy":237.5},"gold_f_warrior_black":{"w":163.8,"h":236.9,"fx":75.3,"fy":236.9},"gold_f_warrior_blond":{"w":164.4,"h":237.5,"fx":75.3,"fy":236.9},"gold_f_warrior_chestnut":{"w":164.4,"h":237.5,"fx":75.0,"fy":236.9},"gold_f_warrior_red":{"w":163.8,"h":237.5,"fx":75.0,"fy":237.5},"moon_f_warrior_black":{"w":163.8,"h":236.9,"fx":75.3,"fy":236.9},"moon_f_warrior_blond":{"w":164.4,"h":237.5,"fx":75.3,"fy":236.9},"moon_f_warrior_chestnut":{"w":164.4,"h":237.5,"fx":75.0,"fy":236.9},"moon_f_warrior_red":{"w":163.8,"h":237.5,"fx":75.0,"fy":237.5},"silver_f_warrior_black":{"w":163.8,"h":236.9,"fx":75.3,"fy":236.9},"silver_f_warrior_blond":{"w":164.4,"h":237.5,"fx":75.3,"fy":236.9},"silver_f_warrior_chestnut":{"w":164.4,"h":237.5,"fx":75.0,"fy":236.9},"silver_f_warrior_red":{"w":163.8,"h":237.5,"fx":75.0,"fy":237.5},"fire_m_assassin_black":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"fire_m_assassin_black_beard":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"fire_m_assassin_blond":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"fire_m_assassin_blond_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"fire_m_assassin_chestnut":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"fire_m_assassin_chestnut_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"fire_m_assassin_red":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"fire_m_assassin_red_beard":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"gold_m_assassin_black":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"gold_m_assassin_black_beard":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"gold_m_assassin_blond":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"gold_m_assassin_blond_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"gold_m_assassin_chestnut":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"gold_m_assassin_chestnut_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"gold_m_assassin_red":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"gold_m_assassin_red_beard":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"moon_m_assassin_black":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"moon_m_assassin_black_beard":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"moon_m_assassin_blond":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"moon_m_assassin_blond_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"moon_m_assassin_chestnut":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"moon_m_assassin_chestnut_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"moon_m_assassin_red":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"moon_m_assassin_red_beard":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"silver_m_assassin_black":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"silver_m_assassin_black_beard":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"silver_m_assassin_blond":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"silver_m_assassin_blond_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"silver_m_assassin_chestnut":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"silver_m_assassin_chestnut_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"silver_m_assassin_red":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"silver_m_assassin_red_beard":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"fire_f_assassin_black":{"w":156.2,"h":235.0,"fx":63.8,"fy":235.0},"fire_f_assassin_blond":{"w":156.9,"h":235.0,"fx":63.8,"fy":234.4},"fire_f_assassin_chestnut":{"w":156.2,"h":235.0,"fx":64.1,"fy":234.4},"fire_f_assassin_red":{"w":156.2,"h":235.0,"fx":63.8,"fy":234.4},"gold_f_assassin_black":{"w":156.2,"h":235.0,"fx":63.8,"fy":235.0},"gold_f_assassin_blond":{"w":156.9,"h":235.0,"fx":63.8,"fy":234.4},"gold_f_assassin_chestnut":{"w":156.2,"h":235.0,"fx":64.1,"fy":234.4},"gold_f_assassin_red":{"w":156.2,"h":235.0,"fx":63.8,"fy":234.4},"moon_f_assassin_black":{"w":156.2,"h":235.0,"fx":63.8,"fy":235.0},"moon_f_assassin_blond":{"w":156.9,"h":235.0,"fx":63.8,"fy":234.4},"moon_f_assassin_chestnut":{"w":156.2,"h":235.0,"fx":64.1,"fy":234.4},"moon_f_assassin_red":{"w":156.2,"h":235.0,"fx":63.8,"fy":234.4},"silver_f_assassin_black":{"w":156.2,"h":235.0,"fx":63.8,"fy":235.0},"silver_f_assassin_blond":{"w":156.9,"h":235.0,"fx":63.8,"fy":234.4},"silver_f_assassin_chestnut":{"w":156.2,"h":235.0,"fx":64.1,"fy":234.4},"silver_f_assassin_red":{"w":156.2,"h":235.0,"fx":63.8,"fy":234.4}};
  Object.assign(H7, {"none_m_archer_black":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"none_m_archer_black_beard":{"w":158.8,"h":241.2,"fx":78.8,"fy":241.2},"none_m_archer_blond":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"none_m_archer_blond_beard":{"w":154.4,"h":238.8,"fx":75.9,"fy":238.8},"none_m_archer_chestnut":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"none_m_archer_chestnut_beard":{"w":157.5,"h":241.2,"fx":77.2,"fy":241.2},"none_m_archer_red":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"none_m_archer_red_beard":{"w":160.0,"h":241.2,"fx":78.8,"fy":241.2},"none_f_archer_black":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"none_f_archer_blond":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"none_f_archer_chestnut":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"none_f_archer_red":{"w":152.5,"h":245.6,"fx":74.4,"fy":245.6},"none_m_paladin_black":{"w":149.4,"h":236.2,"fx":63.1,"fy":236.2},"none_m_paladin_black_beard":{"w":149.4,"h":237.5,"fx":62.8,"fy":236.9},"none_m_paladin_blond":{"w":149.4,"h":236.9,"fx":63.1,"fy":236.9},"none_m_paladin_blond_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"none_m_paladin_chestnut":{"w":149.4,"h":238.1,"fx":62.8,"fy":237.5},"none_m_paladin_chestnut_beard":{"w":149.4,"h":235.6,"fx":63.4,"fy":235.6},"none_m_paladin_red":{"w":149.4,"h":238.1,"fx":63.1,"fy":238.1},"none_m_paladin_red_beard":{"w":149.4,"h":237.5,"fx":63.1,"fy":237.5},"none_f_paladin_black":{"w":148.8,"h":236.2,"fx":63.1,"fy":236.2},"none_f_paladin_blond":{"w":148.8,"h":235.6,"fx":62.8,"fy":235.6},"none_f_paladin_chestnut":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"none_f_paladin_red":{"w":148.8,"h":236.9,"fx":63.1,"fy":236.9},"none_m_mage_black":{"w":135.0,"h":260.6,"fx":67.5,"fy":260.6},"none_m_mage_black_beard":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"none_m_mage_blond":{"w":134.4,"h":261.9,"fx":67.5,"fy":261.9},"none_m_mage_blond_beard":{"w":134.4,"h":262.5,"fx":67.5,"fy":261.9},"none_m_mage_chestnut":{"w":134.4,"h":261.2,"fx":67.2,"fy":261.2},"none_m_mage_chestnut_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"none_m_mage_red":{"w":134.4,"h":261.2,"fx":66.6,"fy":260.6},"none_m_mage_red_beard":{"w":134.4,"h":261.9,"fx":67.2,"fy":261.9},"none_f_mage_black":{"w":133.8,"h":260.6,"fx":67.8,"fy":260.6},"none_f_mage_blond":{"w":133.8,"h":261.2,"fx":67.5,"fy":261.2},"none_f_mage_chestnut":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"none_f_mage_red":{"w":133.8,"h":261.9,"fx":67.8,"fy":261.9},"none_m_priest_black":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"none_m_priest_black_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"none_m_priest_blond":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"none_m_priest_blond_beard":{"w":101.9,"h":234.4,"fx":58.8,"fy":234.4},"none_m_priest_chestnut":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"none_m_priest_chestnut_beard":{"w":101.2,"h":234.4,"fx":58.1,"fy":234.4},"none_m_priest_red":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"none_m_priest_red_beard":{"w":101.2,"h":233.8,"fx":58.1,"fy":233.8},"none_f_priest_black":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"none_f_priest_blond":{"w":98.1,"h":234.4,"fx":53.4,"fy":233.8},"none_f_priest_chestnut":{"w":97.5,"h":233.8,"fx":53.1,"fy":233.8},"none_f_priest_red":{"w":98.1,"h":234.4,"fx":53.4,"fy":234.4},"none_m_warrior_black":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"none_m_warrior_black_beard":{"w":193.1,"h":239.4,"fx":91.9,"fy":239.4},"none_m_warrior_blond":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"none_m_warrior_blond_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"none_m_warrior_chestnut":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"none_m_warrior_chestnut_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"none_m_warrior_red":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"none_m_warrior_red_beard":{"w":193.1,"h":240.0,"fx":91.9,"fy":240.0},"none_f_warrior_black":{"w":163.8,"h":236.9,"fx":75.3,"fy":236.9},"none_f_warrior_blond":{"w":164.4,"h":237.5,"fx":75.3,"fy":236.9},"none_f_warrior_chestnut":{"w":164.4,"h":237.5,"fx":75.0,"fy":236.9},"none_f_warrior_red":{"w":163.8,"h":237.5,"fx":75.0,"fy":237.5},"none_m_assassin_black":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"none_m_assassin_black_beard":{"w":180.6,"h":240.0,"fx":69.4,"fy":239.4},"none_m_assassin_blond":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"none_m_assassin_blond_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":240.6},"none_m_assassin_chestnut":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"none_m_assassin_chestnut_beard":{"w":180.6,"h":241.2,"fx":69.7,"fy":241.2},"none_m_assassin_red":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"none_m_assassin_red_beard":{"w":180.6,"h":241.2,"fx":69.4,"fy":241.2},"none_f_assassin_black":{"w":156.2,"h":235.0,"fx":63.8,"fy":235.0},"none_f_assassin_blond":{"w":156.9,"h":235.0,"fx":63.8,"fy":234.4},"none_f_assassin_chestnut":{"w":156.2,"h":235.0,"fx":64.1,"fy":234.4},"none_f_assassin_red":{"w":156.2,"h":235.0,"fx":63.8,"fy":234.4}}); /* v9: нейтральная броня (без гильдии) */
  Object.assign(M6, H7);
  const B6 = { town: !!L6.town, camp: !!L6.camp, garden: !!L6.garden };
  const SLOTS6 = {}; for (const l of ['town', 'camp', 'garden']) SLOTS6[l] = L6[l] ? L6[l].slots.slice().sort((a, b) => a.prio - b.prio) : [];
  const TOWN6 = new Array(SLOTS6.town.length).fill(null);
  const HERO6_H = 120, SIT6_K = 0.8;
  const HERO6_LOC = Object.assign({ camp: 1.6, town: 1.6, garden: 1.25 }, C.heroScale6 || {}); // v6.46: герои в лагере/городе крупнее (были «лилипуты»)
  window.__heroScale6 = HERO6_LOC;
  // кликабельные зоны построек на фонах B (координаты холста 2560x1440)
  const REG6 = Object.assign({}, B6.town ? { guild: [0, 0, 714, 757], blacksmith: [1379, 243, 1986, 736], board: [850, 300, 1279, 700], market: [2014, 286, 2560, 843] } /* v8.6: новый город */ : {},
    B6.camp ? { campfire: [1100, 620, 1420, 900], tents: [0, 190, 2560, 780] } /* v8.6 */ /* locations_final: 4 палатки */ : {}, B6.garden ? { shed: [1420, 0, 2000, 390] } : {});
  // не вытесняются: выбранный зритель и участники босса
  function noEvict(n) { return n === ACTIVE || !!(S.boss && S.boss.phase !== 'done' && (S.boss.signup || []).includes(n)); }
  const FIRE = B6.camp ? { x: 1257, y: 846 } /* v8.6: новый фон лагеря */ : { x: 1340, y: 850 };
  const RING = { x: 1230, y: 820, rx: 640, ry: 270 };
  const TENTS = B6.camp ? { big: { x: 1590, y: 700 }, door: { x: 1590, y: 740 } } /* v8.6 */ /* вход у 3-й палатки (золотой колос) */ : { big: { x: 2130, y: 720 }, door: { x: 2130, y: 800 } };
  // места у костра: ровно по кольцу, первое — внизу по центру
  // v6.34: у сидячих спрайтов ассасина и паладина (все 6 сетов, м/ж) свой ящик — их сажаем на землю у костра, а не на лавку/пень.
  // Остальные (лучник, маг, жрец, воин) — на лавки/пеньки (sit-слоты). Переполнение — на стоячие слоты / свободную землю.
  const SITBOX6 = ['assassin', 'paladin'];
  const GROUND6 = [{ x: 1120, y: 820, face: 'R' }, { x: 1440, y: 820, face: 'L' }, { x: 1280, y: 900, face: 'R' }, { x: 1000, y: 860, face: 'R' }] /* locations_final */; // v6.45: земля у костра нового фона
  // v49.8: у спрайтов цирюльника нет сидячей позы — все стоят. Стоячие места рядами в шахматном порядке (шаг 310, ряды через 190):
  // ник героя заднего ряда приходится между героями переднего, никто никого не закрывает. Не на палатках, не на костре, не в кустах.
  const CAMP7 = (() => { // v8.6: новый фон — 2 ряда в шахматном порядке с большим зазором (ники под ногами не налезают на соседей), середина заполняется первой
    const r1 = [950, 1570, 640, 1880, 330, 2190], r2 = [1105, 1415, 795, 1725, 485, 2035, 2345], o = []; // прямо перед костром в 1-м ряду никого — костёр виден
    for (let i = 0; i < 7; i++) { if (r1[i]) o.push([r1[i], 985]); o.push([r2[i], 1240]); }
    [1105, 1415, 795, 1725].forEach(x => o.push([x, 1120])); // запас, если мест больше 14
    return o.map(([x, y]) => ({ x, y, type: 'stand', face: x < 1260 ? 'R' : 'L' })); })();
  function campSlots() {
    if (BARB_ON()) { const out = S.seats.slice(0, seatCount()).map((n, i) => CAMP7[i] || CAMP7[CAMP7.length - 1]); return out; }
    const sit = SLOTS6.camp.filter(q => q.type === 'sit'), stand = SLOTS6.camp.filter(q => q.type !== 'sit'), gr = GROUND6.slice(), out = [];
    S.seats.slice(0, seatCount()).forEach(n => { const h = S.heroes[n], box = h && SITBOX6.includes(h.rpg_class);
      // v7panel12: места «на земле» (паладин/ассасин) и стоячие места не должны перекрываться — берём первое свободное, не закрывающее уже занятых
      const free = q => !out.some(o => o && !(q.type === 'sit' && !q.ground && o.type === 'sit' && !o.ground) && Math.abs(o.x - q.x) < 170 && Math.abs(o.y - q.y) < 200), take = a => { const i = a.findIndex(free); return i >= 0 ? a.splice(i, 1)[0] : null; };
      let q = box ? ((gr.length && (q => q && Object.assign({ type: 'sit', ground: 1 }, q))(take(gr))) || take(stand)) : (take(sit) || take(stand) || (q => q && Object.assign({ type: 'stand', ground: 1 }, q))(take(gr)));
      if (!q) { // мест без пересечения не осталось — берём самое далёкое от занятых (меньше всего закрывает)
        const sc = q => Math.min(9, ...out.filter(Boolean).map(o => Math.max(Math.abs(o.x - q.x) / 170, Math.abs(o.y - q.y) / 200)));
        const all = (box ? [[gr, 'sit', 1], [stand], [sit]] : [[sit], [stand], [gr, 'stand', 1]]).flatMap(([a, t, g]) => a.map(x => ({ a, x, t, g })));
        const b = all.sort((u, v) => sc(v.x) - sc(u.x))[0]; if (b) { b.a.splice(b.a.indexOf(b.x), 1); q = b.g ? Object.assign({ type: b.t, ground: 1 }, b.x) : b.x; } }
      out.push(q || { x: 1580, y: 1032, type: 'stand', face: 'R' }); });
    return out;
  }
  function campSlot(i) { return B6.camp ? campSlots()[i] : null; }
  function seatXY(i) {
    const cq = campSlot(i); if (cq) return { x: cq.x, y: cq.y };
    const n = seatCount(), a = Math.PI / 2 + (i + 0.5) / n * Math.PI * 2;
    return { x: Math.round(RING.x + Math.cos(a) * RING.rx), y: Math.round(RING.y + Math.sin(a) * RING.ry) };
  }
  // v6.19 огород B: 12 мест = 12 слотов; грядка у места — из слота, у мест «котёл/дорожка» — свободные грядки по порядку
  const BEDS6 = (() => { if (!B6.garden) return []; const used = SLOTS6.garden.filter(s => s.bed).map(s => s.bed.join()); const free = (L6.garden.beds || []).filter(b => !used.includes(b.join()));
    return SLOTS6.garden.map(s => s.bed || free.shift() || null); })();
  const PLOT_XY = B6.garden ? BEDS6.map(b => b ? { x: (b[0] + b[2]) / 2, y: b[3] - 12 } : { x: 1500, y: 700 })
    : (() => { const a = []; for (const y of [885, 1235]) for (const x of [965, 1500, 2035]) a.push({ x, y }); return a; })();
  const PLOT_STAND = B6.garden ? SLOTS6.garden.map(s => ({ x: s.x, y: s.y })) : PLOT_XY.map((p, i) => ({ x: p.x, y: i < 3 ? 940 : ROAD })); const BED_DX = B6.garden ? 46 : 110;
  const CAULDRON = B6.garden ? { x: 2030, y: 1100 } : { x: 2440, y: 1200 }, SHED = B6.garden ? { x: 1700, y: 390 } : { x: 2400, y: 862 };
  const CAULDRON6 = [{ x: 1830, y: 1180 }, { x: 2230, y: 1180 }, { x: 2030, y: 1290 }]; // v8.6 // locations_v1: котёл нарисован на garden.png (~1990,975), повара слева/справа/спереди // v6.52: под ширину нового котла // v6.48: котёл между грядками и тележкой // места поваров у котла (с огородными местами не пересекаются)
  const LANES = [790, 970, 1150, 1330] /* v49.8: тропы через 180 — ник верхнего отряда не уходит под ноги нижнему */, LX = [0, 300, 0, 300], HERO_X = 900, MON_X = 1180; // LX — шахматный сдвиг полос вправо (v6.47)
  // v6.47: поляна леса, ниже середины, шаг 170 (подписи не налезают)
  const TOWN = B6.town ? { guild: { x: 379, y: 770 }, blacksmith: { x: 1571, y: 770 }, board: { x: 1064, y: 750 }, market: { x: 2286, y: 880 } } : { guild: { x: 1000, y: 740 }, blacksmith: { x: 1620, y: 720 }, board: { x: 1150, y: 1110 }, market: { x: 1950, y: 1110 } };
  const SPOT = (l, k) => { if (l === 'boss') { let o = null; try { o = lairSpot(k); } catch (e) {} if (o) return o; } const p = (NAV.locs[l] && NAV.locs[l].spots || {})[k]; return p ? { x: p[0], y: p[1] } : { x: W / 2, y: ROAD }; };
  const BUILD_POS0 = { campfire: { loc: 'camp', ...SPOT('camp', 'fire') }, tents: { loc: 'camp', ...SPOT('camp', 'tent') }, blacksmith: { loc: 'town', ...SPOT('town', 'blacksmith') }, guild: { loc: 'town', ...SPOT('town', 'guild') }, shed: { loc: 'garden', ...SPOT('garden', 'shed') }, market: { loc: 'town', ...SPOT('town', 'market') }, board: { loc: 'town', ...SPOT('town', 'board') } };
  const BUILD_POS = {}; for (const k in BUILD_POS0) { const r = REG6[k]; BUILD_POS[k] = r ? { loc: BUILD_POS0[k].loc, x: (r[0] + r[2]) / 2, y: r[3] } : BUILD_POS0[k]; }

  // v6.20: для сцен B — свои тропинки по нарисованным дорожкам
  if (B6.garden && L6.nav) L6.nav.garden = { gate: [80, 876], fade: 1, lines: [[[80, 876], [300, 876], [2150, 876]], [[300, 876], [300, 618], [1215, 618], [2150, 618], [2150, 876]], [[1215, 618], [1215, 410], [1060, 410]], [[2150, 876], [2030, 1180]], [[1830, 1180], [2230, 1180]], [[1700, 618], [1700, 380]]] }; // v8.6
  if (B6.town && L6.nav) L6.nav.town = { gate: [1250, 1530], lines: [[[1250, 1530], [1250, 1080]], [[300, 1300], [2300, 1300]], [[379, 770], [379, 1300]], [[379, 1080], [2286, 1080]], [[1571, 770], [1571, 1300]], [[1064, 750], [1064, 1080]], [[2286, 880], [2286, 1080]]] }; // v8.6: новый город
  if (B6.camp && L6.nav) L6.nav.camp = { gate: [80, 1120], fade: 1, lines: [ // v8.6: тропы нового лагеря — по поляне ниже костра, к палатке колоса справа от лавки
    [[80, 1120], [700, 1120], [1260, 1120], [1850, 1120], [2480, 1120]],
    [[1850, 1120], [1760, 960], [1700, 820], [1590, 740]]] };
  if (L6.nav) for (const l in L6.nav) if (B6[l]) NAV.locs[l] = Object.assign({}, NAV.locs[l] || {}, { lines: L6.nav[l].lines });
  // ---------- граф тропинок: A* по узлам ломаных ----------
  const GRAPH = {};
  for (const l in NAV.locs) {
    const nodes = [], key = {}, adj = [], segs = [];
    const id = p => { const k = p[0] + ',' + p[1]; if (key[k] === undefined) { key[k] = nodes.length; nodes.push({ x: p[0], y: p[1] }); adj.push([]); } return key[k]; };
    for (const line of NAV.locs[l].lines) for (let i = 0; i + 1 < line.length; i++) {
      const a = id(line[i]), b = id(line[i + 1]); if (a === b) continue;
      const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
      adj[a].push([b, d]); adj[b].push([a, d]); segs.push([a, b]);
    }
    GRAPH[l] = { nodes, adj, segs };
  }
  function snap(l, x, y) { // ближайшая точка на тропинке
    const g = GRAPH[l]; let best = null;
    for (const [a, b] of g.segs) {
      const A = g.nodes[a], B = g.nodes[b], dx = B.x - A.x, dy = B.y - A.y, L = dx * dx + dy * dy;
      const t = L ? clamp(((x - A.x) * dx + (y - A.y) * dy) / L, 0, 1) : 0;
      const px = A.x + dx * t, py = A.y + dy * t, d = Math.hypot(x - px, y - py);
      if (!best || d < best.d) best = { x: px, y: py, a, b, d };
    }
    return best;
  }
  function route(l, fx, fy, tx, ty) {
    const g = GRAPH[l]; if (!g || !g.segs.length) return [{ x: tx, y: ty }];
    const s = snap(l, fx, fy), e = snap(l, tx, ty), out = [];
    if (s.d > 3) out.push({ x: s.x, y: s.y });
    const sameSeg = (s.a === e.a && s.b === e.b) || (s.a === e.b && s.b === e.a);
    if (!sameSeg) {
      // A*: стартовые узлы — концы сегмента старта
      const N = g.nodes.length, dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
      const hgt = i => Math.hypot(g.nodes[i].x - e.x, g.nodes[i].y - e.y);
      dist[s.a] = Math.hypot(s.x - g.nodes[s.a].x, s.y - g.nodes[s.a].y); dist[s.b] = Math.hypot(s.x - g.nodes[s.b].x, s.y - g.nodes[s.b].y);
      const goal = i => i === e.a || i === e.b;
      let end = -1;
      for (;;) {
        let u = -1, bu = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] + hgt(i) < bu) { bu = dist[i] + hgt(i); u = i; }
        if (u < 0) break; done[u] = true;
        if (goal(u)) { end = u; break; }
        for (const [v, w] of g.adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
      }
      const chain = []; for (let u = end; u >= 0; u = prev[u]) chain.unshift(g.nodes[u]);
      for (const p of chain) out.push({ x: p.x, y: p.y });
    }
    out.push({ x: e.x, y: e.y });
    if (Math.hypot(tx - e.x, ty - e.y) <= 60) out.push({ x: tx, y: ty });
    return out.filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 1);
  }
  const persp = y => clamp(0.8 + 0.36 * (y - 560) / 700, 0.75, 1.2);

  // ===================== ГЕРОИ =====================
  function normClass(c) {
    c = lc(c);
    if (C.classes.some(x => x.id === c)) return c;
    for (const [id, al] of Object.entries(C.classAliases)) if (al.some(a => c.includes(a))) return id;
    return null;
  }
  function normGender(g) { g = lc(g); return (/^(f|ж|she|она)/.test(g) || g.includes('жен') || g.includes('дев') || g.includes('female')) ? 'female' : 'male'; }
  // v6.35: разбор текста награды — нужны И класс, И пол. Порядок слов/регистр/ё не важны. Несколько разных классов или полов — не распознано.
  const G_WORDS = { male: ['м', 'm', 'муж', 'мужчина', 'мужской', 'мужик', 'парень', 'мальчик', 'male', 'man', 'boy', 'он', 'he'],
    female: ['ж', 'f', 'жен', 'женщина', 'женский', 'девушка', 'девочка', 'дева', 'female', 'woman', 'girl', 'она', 'she'] };
  // v6.38: строгий формат награды (heroRewardStrict, по умолчанию true): «!герой <класс> <пол>» — ровно два слова после !герой (класс и пол, порядок любой).
  // Регистр, лишние пробелы, ё/е, синонимы (classAliases, G_WORDS) допускаются. Иначе why: noPrefix / empty / noClass / noGender / ambiguous / extra.
  const HERO_PREFIX = /^\s*!\s*(герой|герои|hero)(?![a-zа-я])/i;
  function heroStrict() { return C.heroRewardStrict !== false; }
  function parseHeroSpec(text, strict) {
    if (strict === undefined) strict = heroStrict();
    let src = String(text || '').replace(/ё/gi, 'е');
    if (strict) {
      const m = src.match(HERO_PREFIX);
      if (!m) return { ok: false, cls: null, gender: null, why: String(text || '').trim() ? 'noPrefix' : 'empty', strict: true };
      src = src.slice(m[0].length);
      const tk = src.toLowerCase().split(/[^a-zа-я]+/).filter(Boolean);
      const r0 = parseHeroSpec(src, false); r0.strict = true;
      if (r0.ok && tk.length !== 2) { r0.ok = false; r0.why = 'extra'; }
      return r0;
    }
    const toks = String(src || '').toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я]+/).filter(Boolean);
    const cls = new Set(), gen = new Set();
    for (const t of toks) {
      for (const [id, al] of Object.entries(C.classAliases)) if (al.some(a => { a = a.replace(/ё/g, 'е'); return t === a || (a.length >= 4 && t.startsWith(a) && t.length - a.length <= 3); })) cls.add(id);
      for (const [g, al] of Object.entries(G_WORDS)) if (al.includes(t)) gen.add(g);
    }
    const r = { cls: cls.size === 1 ? [...cls][0] : null, gender: gen.size === 1 ? [...gen][0] : null };
    r.ok = !!(r.cls && r.gender); r.why = r.ok ? '' : (cls.size > 1 || gen.size > 1) ? 'ambiguous' : !r.cls && !r.gender ? 'empty' : !r.cls ? 'noClass' : 'noGender';
    return r;
  }
  const HERO_WHY = { noPrefix: 'текст должен начинаться с !герой', empty: 'текст пустой', noClass: 'класс не распознан', noGender: 'пол не распознан', ambiguous: 'указано несколько классов или полов', extra: 'лишние слова — нужны только класс и пол' };
  function heroNeedInfo(nick, text, why, ids) {
    const msg = heroStrict()
      ? `@${nick} герой не создан: ${HERO_WHY[why] || 'текст не распознан'}. Напиши в награде строго: !герой класс пол — например: !герой маг ж или !герой паладин м. Классы: воин, паладин, лучник, маг, жрец, ассасин. Пол: м или ж (мужчина/женщина). Награда не использована — баллы вернутся, попробуй ещё раз.`
      : `@${nick} чтобы создать героя, напиши в награде класс и пол, например: маг ж (классы: воин, паладин, лучник, маг, жрец, ассасин; пол: м/ж). Награда не использована — попробуй ещё раз.`;
    emitBot(Object.assign({ event: 'heroNeedInfo', user: nick, why, input: String(text || '').slice(0, 100), text: msg, refund: true }, redeemIds(ids)));
    log(`Награда от ${nick}: герой не создан (${why}) — «${String(text || '').slice(0, 40)}»`, '#f0a060');
    return { ok: false, needInfo: true, why, msg };
  }
  // v6.39: id погашения Twitch (если RPG Reward их передал) — чтобы Streamer.bot мог вернуть баллы
  function redeemIds(ids) { const o = {}; if (ids && ids.rewardId) o.rewardId = String(ids.rewardId); if (ids && ids.redemptionId) o.redemptionId = String(ids.redemptionId); return o; }
  // v6.39: повторная «награда создания» у зрителя с героем: дубль не создаётся, класс/пол не меняются, токены начисляются как обычно.
  // Если текст начинается с !герой — подсказка heroExists (не чаще heroExistsHint.everySec на ник). refund: true — только если награда ничего не дала (все токены на максимуме).
  const HERO_EX_T = {};
  // v6.40: награда действий при полном запасе (ни один токен не добавился) — rewardFull с refund:true, не чаще rewardFullHint.everySec на ник
  const REW_FULL_T = {};
  function rewardFull(h, before, ids) { return null; } // v7panel34: токенов больше нет
  function heroExists(h, text, before, ids) {
    const H = C.heroExistsHint || {}; if (H.enabled === false) return null;
    if (!HERO_PREFIX.test(String(text || '').replace(/ё/gi, 'е'))) return null;
    const t = h.rpg_reward || {}, got = ['hike', 'cook', 'quest'].filter(k => (t[k] || 0) > (before[k] || 0));
    const refund = !got.length, g = h.rpg_gender === 'female' ? 'ж' : 'м';
    const text2 = `@${DN(h)} у тебя уже есть герой (${className(h).toLowerCase()}, ${g}), второго создать нельзя, класс и пол не меняются. ` +
      (refund ? 'Запас наград уже полный — награду вернём.' : `Награда засчитана: поход ${t.hike || 0}, готовка ${t.cook || 0}, квест ${t.quest || 0} в запасе.`);
    log(`Награда от ${h.user}: герой уже есть${refund ? ' (запас полный — вернуть баллы)' : ''}`, '#f0c080'); say(h, 'Я уже здесь!', 3);
    const k = lc(h.user), now0 = Date.now();
    if (HERO_EX_T[k] && now0 - HERO_EX_T[k] < (H.everySec || 30) * 1000) return { sent: false, refund, text: text2 };
    HERO_EX_T[k] = now0; emitBot(Object.assign({ event: 'heroExists', user: h.user, cls: h.rpg_class, gender: h.rpg_gender, refund, text: text2 }, redeemIds(ids)));
    return { sent: true, refund, text: text2 };
  }
  // v6.37: почему поход не начался — подсказка зрителю в чат (Streamer.bot) не чаще expeditionHint.everySec на ник + плашка над героем и строка в журнале
  const HIKE_HINT_T = {};
  function hikeCdSec() { return C.expeditionCooldownSec != null ? +C.expeditionCooldownSec : (C.hikeCooldownSec || 0); }
  function hikeCdLeft(h) { return Math.max(0, Math.ceil(((h.rpg_hikeAt || 0) + hikeCdSec() * 1000 - Date.now()) / 1000)); }
  function expeditionHint(h, why) {
    const left = hikeCdLeft(h), mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, mins = Math.max(1, Math.ceil(left / 60));
    const tok = (h.rpg_reward && h.rpg_reward.hike) || 0;
    const q = expQueueInfo(h.user); if (why === 'queued' && q) { const text = `@${DN(h)} ты в очереди похода: ${q.pos} из ${q.total} — уйдёшь автоматически, когда освободится тропа`; say(h, `Очередь ${q.pos}`, 3); emitBot({ event: 'expeditionQueue', user: h.user, pos: q.pos, total: q.total, text }); return { sent: true, text }; } // v6.57
    const txt = why === 'inHike' ? `@${DN(h)} ты ещё в походе${left > 0 ? `, следующий — через ${mins} мин` : ' — следующий сразу после возвращения'}`
      : why === 'dead' ? `@${DN(h)} герой возвращается в лагерь после поражения${left > 0 ? `, снова в поход через ${mins} мин` : ' — подожди немного'}`
      : `@${DN(h)} ты отдыхаешь после похода, снова в поход через ${mins} мин`;
    const text = txt + (tok > 0 ? ` (походов в запасе: ${tok})` : '');
    const plate = why === 'inHike' ? 'Уже в походе' : why === 'dead' ? 'Возвращаюсь…' : `Отдых ${mm}`;
    const k = lc(h.user), t = Date.now(), H = C.expeditionHint || {}, every = (H.everySec || 30) * 1000;
    clog(`⏳ ${h.user}: ${plate.toLowerCase()}${left > 0 && why !== 'cooldown' ? ' · следующий через ' + mm : ''}`, '#f0c080');
    say(h, plate, 3); log(`${h.user}: поход не начат — ${why === 'inHike' ? 'уже в походе' : why === 'dead' ? 'возвращается' : 'отдых ' + mm}`, '#f0c080');
    if (H.enabled === false || (HIKE_HINT_T[k] && t - HIKE_HINT_T[k] < every)) return { sent: false, text };
    HIKE_HINT_T[k] = t; emitBot({ event: 'expeditionCooldown', user: h.user, why, left, tokens: tok, text });
    return { sent: true, text };
  }
  function hikeBusy(h) { const rt = ensureRT(h); if (rt.mode === 'dead') return 'dead'; if (rt.mode === 'exp' || BATTLES.some(b => b.user === h.user)) return 'inHike'; if (EXPQ.includes(h.user)) return 'queued'; return hikeCdLeft(h) > 0 ? 'cooldown' : ''; }
  function findNick(nick) { nick = String(nick || '').trim(); if (S.heroes[nick]) return nick; const l = lc(nick); return S.order.find(n => lc(n) === l) || null; }
  function ensureRT(h) {
    if (!RT[h.user]) RT[h.user] = { loc: 'camp', x: TENTS.door.x, y: TENTS.door.y, mode: 'sleep', fade: 0, path: [], onArrive: null, dest: null, flip: false, walkT: 0, bubble: null, bubbleT: 0, queue: [], idleT: R(4, 12), ghost: false, work: null, hit: 0, lunge: 0, stayUntil: 0 };
    return RT[h.user];
  }
  let tm = 0; // реальное время с запуска (сек) — для анимаций
  function touch(h) { h.rpg_lastActive = Date.now(); }
  // v6.34: данные грядки зрителя без героя копятся отдельно (S.gardenPending) и применяются, когда герой появится по награде
  function createHero(nick, cls, gender, silent) {
    const r = createHero0(nick, cls, gender, silent), n = findNick(nick), k = lc(String(nick || '').trim().replace(/^@/, ''));
    if (n && DISPQ[k]) { noteDisp(n, DISPQ[k]); delete DISPQ[k]; } // v6.55: displayName пришёл раньше героя
    if (n && S.gardenPending && S.gardenPending[k]) { const v = S.gardenPending[k]; delete S.gardenPending[k]; syncVars(n, v); }
    return r;
  }
  function createHero0(nick, cls, gender, silent) {
    nick = String(nick || '').trim().replace(/^@/, '').slice(0, 25);
    if (!nick) return { ok: false, msg: 'Пустой ник' };
    const ex = findNick(nick); if (ex) nick = ex;
    const id = normClass(cls) || (S.heroes[nick] ? S.heroes[nick].rpg_class : C.classes[0].id);
    const g = gender ? normGender(gender) : (S.heroes[nick] ? S.heroes[nick].rpg_gender : 'male');
    let h = S.heroes[nick];
    if (h) { if (cls || gender) { h.rpg_class = id; h.rpg_gender = g; } }
    else {
      h = S.heroes[nick] = newHero(nick, id, g); h.rpg_hp = stats(h).maxhp; h.rpg_hair = hairPick(Math.random()); S.order.push(nick); if (!silent) autoGuild(h); else if (BARB_ON() && BARB().autoGuild !== false && !h.rpg_guild) { const c = guildCounts(h.user); h.rpg_guild = C.guilds.slice().sort((a, b) => c[a.id] - c[b.id])[0].id; h.rpg_guildJoined = now(); h.rpg_guildAuto = 1; } // v49.7: без гильдии героев нет
      const rt = ensureRT(h); rt.loc = 'camp'; rt.mode = 'walk'; rt.x = R(400, 1100); rt.y = ROAD;
      if (!silent) log(`Новый герой: ${nick} — ${className(h)} ${g === 'female' ? '♀' : '♂'}`, '#ffd27a');
      log(`Создан герой ${nick} по событию «${CREATE_WHY || 'вызов api/панели'}» от ника ${nick}`, '#c9b27a'); console.info('[RPG] hero created', nick, CREATE_WHY || 'api');
    }
    redeem(h);
    if (!silent) say(h, 'Привет!');
    save(); refreshUI();
    return { ok: true };
  }
  // «Прожал награду»: свежий редим — место у костра (вытесняет самого давнего)
  function giveReward(h) {
    const s = streamCur();
    if (h._rewStream === s.id) { log(`${h.user}: награда уже прожата в этом стриме`, '#888'); return; }
    h._rewStream = s.id;
    const t = h.rpg_reward || (h.rpg_reward = { hike: 0, cook: 0, quest: 0 });
    t.quest = 3;
    log(`${h.user}: награда стрима — 3 квеста`, '#ffd27a');
    if (sessionOver()) sessionTouch('награда'); // новый стрим — новый босс и цель
  }
  const REWARD_CMD = { 'пати': 'hike', 'поход': 'hike', 'готовить': 'cook', 'квест': 'quest' };
  function redeem(h) {
    h.rpg_lastRedeem = Date.now(); touch(h); sessionTouch('награда');
    claimSeat(h); ensureRT(h);
    if (h.rpg_hp < stats(h).maxhp * 0.3) h.rpg_hp = Math.round(stats(h).maxhp * 0.3);
    const rt = RT[h.user];
    if (rt.mode === 'sleep' || rt.mode === 'seat' && !S.seats.includes(h.user) || rt.mode === 'walk' && rt.loc === 'camp') goCamp(h); // v6.55 п.17: уже сидит у костра — не пересаживаем (не «подпрыгивает» на пне)
    bump('camp', 3);
  }
  function claimSeat(h) {
    const n = seatCount();
    S.seats.length = Math.max(S.seats.length, n);
    if (S.seats.indexOf(h.user) >= 0 && S.seats.indexOf(h.user) < n) return;
    let i = [...Array(n).keys()].find(k => !S.seats[k] || !S.heroes[S.seats[k]]);
    if (i === undefined) {
      i = -1; let old = Infinity;
      for (let k = 0; k < n; k++) { const o = S.heroes[S.seats[k]]; if (noEvict(o.user)) continue; if (o.rpg_lastRedeem < old) { old = o.rpg_lastRedeem; i = k; } }
      if (i < 0) return; // все места заняты защищёнными (выбранный / босс) — новый спит в палатке
      const o = S.heroes[S.seats[i]]; S.seats[i] = null;
      const ort = ensureRT(o);
      if (ort.mode === 'seat') { say(o, 'Пойду вздремну…', 3); goSleep(o); }
      log(`${o.user} уступает место у костра и уходит спать в палатку`, '#c9b8e8');
    }
    S.seats[i] = h.user;
  }
  // v6.26: кто создаёт героев. CREATE_WHY — событие-источник (пишется в лог). ignoreNicks — чёрный список.
  let CREATE_WHY = '';
  const BOT_NICKS = ['streamelements', 'nightbot', 'moobot', 'streamlabs', 'phaciabot', 'fossabot', 'wizebot', 'streamerbot', 'soundalerts'];
  function nickIgnored(nick) { const n = lc(String(nick || '').trim().replace(/^@/, '')); return BOT_NICKS.includes(n) || (C.ignoreNicks || []).map(x => lc(String(x))).includes(n); }
  // можно ли создать нового героя по событию kind ('join' = !вступить/!герой, 'reward' = награда канала, иное = авто)
  function mayCreate(nick, kind) {
    if (findNick(nick)) return true;
    if (nickIgnored(nick)) { log(`Игнор: ${nick} в ignoreNicks — героя не создаю (${kind})`, '#888'); return false; }
    if (kind === 'join' && C.joinWithoutReward !== true) { log(`Нет героя ${nick}: !вступить без награды выключен (joinWithoutReward=false)`, '#888'); return false; }
    if (C.heroAutoCreate !== true && kind !== 'join' && kind !== 'reward') { log(`Нет героя ${nick}: событие «${kind}» не создаёт героя (heroAutoCreate=false)`, '#888'); return false; }
    CREATE_WHY = kind; return true;
  }
  function getHero(nick, autoCreate) {
    const n = findNick(nick);
    if (n) return S.heroes[n];
    if (autoCreate && String(nick || '').trim()) { createHero(nick, null, null, false); return S.heroes[findNick(nick)]; }
    return null;
  }
  function removeHero(nick) {
    const n = findNick(nick), h = S.heroes[n]; if (!h) return { ok: false, msg: 'Нет такого героя' };
    for (let i = BATTLES.length - 1; i >= 0; i--) if (BATTLES[i].user === n) BATTLES.splice(i, 1);
    S.seats = S.seats.map(x => x === n ? null : x); releasePlot(n);
    delete S.heroes[n]; delete RT[n]; S.order = S.order.filter(x => x !== n);
    if (ACTIVE === n) ACTIVE = '';
    log(`${n} покидает игру`); save(); refreshUI(); return { ok: true };
  }

  // ---------------- движение ----------------
  function say(h, text, sec) { const rt = ensureRT(h); if (rt.bubble && rt.bubble.chat) return; rt.bubble = { lines: wrap(text, 24), chat: false }; rt.bubbleT = sec || 3; }
  function walkPath(h, pts, cb) { const rt = ensureRT(h); rt.path = pts.map(p => ({ x: p.x, y: p.y })); rt.onArrive = cb || null; }
  // Идти в любую точку любой локации (через край экрана, по дороге внизу)
  function leftGate() { if (typeof document === 'undefined') return -90; const e = document.getElementById('hud'); return e && !e.classList.contains('hidden') ? 700 : -90; }
  function puff(loc, x, y) { if (typeof FX !== 'undefined') FX.push({ kind: 'ring', loc, x, y: y - 10, t: 0, life: 0.6, color: '#c8b8a0' }); }
  function travel(h, loc, x, y, cb) {
    const rt = ensureRT(h); rt.work = null; rt.out6 = null;
    if (rt.mode === 'sleep') { rt.mode = 'walk'; rt.loc = 'camp'; rt.x = TENTS.door.x; rt.y = TENTS.door.y; rt.fade = 0; } // выходит из палатки (проявляется)
    rt.dest = { loc, x, y, cb }; stepTravel(h);
  }
  // v6.19: город — 10 мест; полный город вытесняет самого давнего (кроме выбранного и участников босса)
  function claimTown(h) {
    let i = TOWN6.indexOf(h.user); if (i >= 0) return i;
    i = TOWN6.findIndex(n => !n || !S.heroes[n]);
    if (i < 0) {
      let old = Infinity;
      TOWN6.forEach((n, k) => { if (noEvict(n)) return; const t = S.heroes[n].rpg_lastActive || 0; if (t < old) { old = t; i = k; } });
      if (i < 0) return -1;
      const o = S.heroes[TOWN6[i]]; TOWN6[i] = null; if (o) { say(o, 'Пойду в лагерь', 2); goCamp(o); }
    }
    TOWN6[i] = h.user; return i;
  }
  function leave6(h, loc) { if (loc === 'garden') releasePlot(h.user); if (loc === 'town') { const i = TOWN6.indexOf(h.user); if (i >= 0) TOWN6[i] = null; } }
  // v6.20: путь по тропинкам B до точки (последний шаг — с тропинки к месту героя)
  function route6(l, fx, fy, tx, ty) { const r = route(l, fx, fy, tx, ty); const e = r[r.length - 1]; if (!e || Math.hypot(e.x - tx, e.y - ty) > 1) r.push({ x: tx, y: ty }); return r; }
  const gate6 = l => { const g = L6.nav && L6.nav[l] && L6.nav[l].gate; return g ? { x: g[0], y: g[1] } : null; };
  function stepTravel(h) {
    const rt = RT[h.user], d = rt.dest; if (!d) return;
    if (B6[rt.loc] || B6[d.loc]) { // сцены B: идут по нарисованным дорожкам, между локациями — уходят за край кадра и входят с края
      rt.dest = null;
      if (rt.loc === d.loc) { walkPath(h, route6(rt.loc, rt.x, rt.y, d.x, d.y), d.cb); return; }
      const arrive = () => {
        rt.loc = d.loc;
        const gi = gate6(d.loc);
        if (gi) { rt.x = gi.x; rt.y = gi.y; rt.fade = 0; walkPath(h, route6(d.loc, gi.x, gi.y, d.x, d.y), d.cb); }
        else { rt.x = LOCS.indexOf(d.loc) > LOCS.indexOf('town') ? leftGate() : W + 90; rt.y = ROAD; rt.fade = 0; walkPath(h, (d.loc === 'forest' ? route6 : route)(d.loc, rt.x, rt.y, d.x, d.y), d.cb); } // v49.8: в лес из лагеря/огорода — до своего места в строю, а не до ближайшей точки тропы
      };
      const go = gate6(rt.loc);
      if (go && rt.mode !== 'sleep' && (rt.fade === undefined || rt.fade > 0.5)) walkPath(h, route6(rt.loc, rt.x, rt.y, go.x, go.y), () => { const fin = () => { leave6(h, rt.loc); arrive(); }; if (L6.nav[rt.loc].fade) rt.out6 = fin; else fin(); });
      else { leave6(h, rt.loc); if (B6[rt.loc]) puff(rt.loc, rt.x, rt.y); arrive(); }
      return;
    }
    if (rt.loc === d.loc) {
      rt.dest = null;
      walkPath(h, (rt.loc === 'forest' ? route6 : route)(rt.loc /* v49.8: в лесу герой доходит до своего места, а не до ближайшей точки тропы */, rt.x, rt.y, d.x, d.y), d.cb); return;
    }
    // Левый край дороги закрыт меню зрителя (HUD): там герои исчезают/появляются у края меню, а не идут под ним
    const gate = leftGate(), dir = LOCS.indexOf(d.loc) > LOCS.indexOf(rt.loc) ? 1 : -1, ex = dir > 0 ? W + 90 : gate;
    walkPath(h, route(rt.loc, rt.x, rt.y, ex, ROAD), () => {
      if (rt.loc === 'garden') releasePlot(h.user);
      if (dir < 0 && gate > 0) puff(rt.loc, rt.x, rt.y);
      rt.loc = LOCS[LOCS.indexOf(rt.loc) + dir]; rt.x = dir > 0 ? gate : W + 90; rt.y = ROAD;
      if (dir > 0 && gate > 0) { rt.fade = 0; puff(rt.loc, rt.x, rt.y); }
      stepTravel(h);
    });
  }
  function goCamp(h) {
    const rt = ensureRT(h); rt.mode = 'walk'; rt.stayUntil = 0;
    const i = S.seats.indexOf(h.user);
    if (i >= 0 && i < seatCount()) { const p = seatXY(i); travel(h, 'camp', p.x, p.y, () => { rt.mode = 'seat'; }); }
    else goSleep(h);
  }
  function goSleep(h) {
    const rt = ensureRT(h); rt.mode = 'walk';
    travel(h, 'camp', TENTS.door.x, TENTS.door.y, () => { rt.mode = 'enter'; rt.fade = 0; }); // входит в палатку и исчезает
  }
  // герой идёт по делу, потом (через stay секунд) возвращается к костру
  function goDo(h, loc, x, y, text, stay, workSec, onArrive, exact) { // v7panel20: exact — идти точно в (x,y) (к зданию/прилавку), без слота города
    const rt = ensureRT(h); if (rt.mode === 'exp' || rt.mode === 'dead' || rt.mode === 'boss' || rt.mode === 'cook') return false;
    if (B6[loc] && loc === 'town' && !exact) { const k = claimTown(h); if (k < 0) { say(h, 'В городе тесно…', 2.5); return false; } x = SLOTS6.town[k].x; y = SLOTS6.town[k].y; }
    if (B6[loc] && loc === 'camp') { const k = S.seats.indexOf(h.user); const p = k >= 0 && k < seatCount() ? seatXY(k) : TENTS.door; x = p.x; y = p.y; }
    touch(h); rt.mode = loc === 'garden' ? 'garden' : 'visit';
    travel(h, loc, x, y, () => {
      rt.flip = B6[loc] ? x > 1500 : x > W / 2 + 400; rt.work = workSec || 1.5; if (text) say(h, text, 2.5);
      rt.stayUntil = tm + (stay || 0); bump(loc, 2);
      if (onArrive) onArrive();
    });
    return true;
  }
  // ---------------- огороды на экране ----------------
  // v8.6: погладить пёсика в городе — герой подходит, пёсик виляет хвостом и гавкает (живой фон live6.js)
  const PET_CD = {};
  function petDog(nick) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    const d = window.LIVE6 && LIVE6.dogXY && LIVE6.dogXY('town'); if (!d) return res(h, false, 'пёсика сейчас нет в городе');
    if (PET_CD[h.user] && Date.now() - PET_CD[h.user] < 20000) return res(h, false, 'пёсик ещё радуется — погладь чуть позже');
    PET_CD[h.user] = Date.now();
    const ok = goDo(h, 'town', d.x - 95, d.y + 6, 'гладит пёсика', 4, 3, () => { ensureRT(h).flip = false; if (window.LIVE6) LIVE6.pet('town'); }, true);
    return ok ? res(h, true, 'идёт гладить пёсика 🐶') : res(h, false, 'сейчас не может — занят');
  }
  // v8.7: котик на заборе огорода — герой подходит по тропинке у забора, котик просыпается и мурчит
  function petCat(nick) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    const c = window.LIVE6 && LIVE6.catXY && LIVE6.catXY('garden'); if (!c) return res(h, false, 'котика сейчас нет на огороде');
    if (PET_CD['c' + h.user] && Date.now() - PET_CD['c' + h.user] < 20000) return res(h, false, 'котик ещё мурчит — погладь чуть позже');
    PET_CD['c' + h.user] = Date.now();
    const ok = goDo(h, 'garden', 1060, 410, 'гладит котика', 4, 3, () => { ensureRT(h).flip = false; if (window.LIVE6) LIVE6.pet('garden'); }, true);
    return ok ? res(h, true, 'идёт гладить котика 🐱') : res(h, false, 'сейчас не может — занят');
  }
  function petAny(nick, a) { const q = lc(String(a || '').trim()); if (/^(кот|кош)/.test(q)) return petCat(nick); if (!q) { const h = getHero(nick, false); if (h && ensureRT(h).loc === 'garden') return petCat(nick); } return petDog(nick); }
  function claimPlot(h) {
    h.rpg_lastGarden = Date.now();
    let i = PLOTS.indexOf(h.user); if (i >= 0) return i;
    i = PLOTS.findIndex(p => !p);
    if (i < 0) {
      let old = Infinity; i = -1;
      PLOTS.forEach((n, k) => { if (noEvict(n)) return; const o = S.heroes[n]; const t = o ? o.rpg_lastGarden : 0; if (t < old) { old = t; i = k; } });
      if (i < 0) return -1;
      const o = S.heroes[PLOTS[i]]; PLOTS[i] = null;
      if (o) { const ort = ensureRT(o); if (ort.loc === 'garden' || (ort.dest && ort.dest.loc === 'garden')) goCamp(o); }
    }
    PLOTS[i] = h.user; return i;
  }
  function releasePlot(n) { const i = PLOTS.indexOf(n); if (i >= 0) PLOTS[i] = null; }
  function bedXY(h, claim) {
    let i = PLOTS.indexOf(h.user);
    if (i < 0 && claim !== false) i = claimPlot(h);
    if (i < 0) return { x: 1500, y: 700, hidden: true };
    return { x: PLOT_XY[i].x - BED_DX, y: PLOT_XY[i].y };
  }
  function magicXY(h) { const i = PLOTS.indexOf(h.user) >= 0 ? PLOTS.indexOf(h.user) : claimPlot(h); if (i < 0) return { x: 1500, y: 700, hidden: true }; return { x: PLOT_XY[i].x + BED_DX, y: PLOT_XY[i].y }; }
  function goGarden(h, text, sec, cb) { forceSync(h);
    const i = claimPlot(h), p = PLOT_STAND[i];
    if (i < 0) { say(h, 'Огород полон…', 2.5); return false; }
    return goDo(h, 'garden', p.x, p.y, text, C.gardenStaySeconds, sec, cb);
  }
  function visitBed(h, text, cb) { return goGarden(h, text, undefined, cb); }
  function goCauldron(h, text) { claimPlot(h); const p = B6.garden ? CAULDRON6[0] : SPOT('garden', 'cauldron'); return goDo(h, 'garden', p.x, p.y, text, C.gardenStaySeconds, 2.5); }

  // ---------------- активность (для авто-камеры) ----------------
  const ACT = { camp: 0, garden: 0, forest: 0, town: 0 };
  function bump(loc, n) { if (ACT[loc] !== undefined) ACT[loc] += n; }

  const PFX = []; let pfxSeq = 1;
  const PFXA = []; let pfxaSeq = 1;
  function pfxPush(loc, x, y, text, color, size) {
    PFX.push({ i: pfxSeq++, t: Date.now(), k: 't', loc: loc || '', x: Math.round(x) || 0, y: Math.round(y) || 0, s: String(text == null ? '' : text).slice(0, 28), c: color || '#fff', z: size || 30 });
    if (PFX.length > 80) PFX.splice(0, PFX.length - 80);
  }
  function pfxAnim(who, kind, loc) {
    if (!who) return;
    PFXA.push({ i: pfxaSeq++, t: Date.now(), who: String(who), k: String(kind || ''), loc: loc || '' });
    if (PFXA.length > 80) PFXA.splice(0, PFXA.length - 80);
  }
  function fxText(x, y, text, color, size, life, loc) { FX.push({ kind: 'text', loc: loc || 'garden', x, y, text, color: color || '#fff', size: size || 30, t: 0, life: life || 1.8 }); pfxPush(loc || 'garden', x, y, text, color, size); }
  function panelFx() {
    const from = Date.now() - 2800;
    const ev = PFX.filter(e => e.t >= from).map(e => [e.i, e.t, e.k, e.loc, e.x, e.y, e.s, e.c, e.z]);
    const an = PFXA.filter(e => e.t >= from).map(e => [e.i, e.t, e.who, e.k, e.loc]);
    return { ev, an };
  }
  function fxIcon(x, y, key, life, h, loc) { FX.push({ kind: 'icon', loc: loc || 'garden', x, y, key, t: 0, life: life || 2, h: h || 70 }); }
  function fxPop(x, y, key, loc) { FX.push({ kind: 'pop', loc: loc || 'garden', x, y, key, t: 0, life: 0.7 }); }
  function fxLabel(x, y, key, text, color, delay) { FX.push({ kind: 'label', loc: 'garden', x, y, key, text, color: color || '#fff', t: -(delay || 0), life: 2.6 }); }
  // момент сбора: растение «выпрыгивает», над грядкой всплывают иконки и подписи
  function harvestFX(h) {
    const rt = ensureRT(h), hv = rt.harvest; if (!hv) return; rt.harvest = null;
    const b = bedXY(h, false); if (b.hidden) return;
    rt.pick = tm; fxPop(b.x, b.y - 38, 'ripe');
    const cnt = {}; hv.got.forEach(id => cnt[id] = (cnt[id] || 0) + 1);
    Object.keys(cnt).forEach((id, i) => fxLabel(b.x, b.y - 150 - i * 64, 'crop_' + id, `${cropName(id)} +${cnt[id]}`, id === 'weed' ? '#d8e8b0' : '#fff2c0', 0.15 + i * 0.2));
    if (hv.fairy) fxFairy(b.x, b.y - 100);
    if (hv.golden) goldenPumpkin(h);
  }
  function fxFairy(x, y) { FX.push({ kind: 'fairy', loc: 'garden', x, y, t: 0, life: 3 }); }

  // ===================== ОГОРОД — правила Streamer.bot =====================
  function G() {
    const g = S.global, t = now();
    if (g.farmEvent !== 'off' && g.farmEventUntil <= t) { log('Событие фермы закончилось', '#9fc5e8'); g.farmEvent = 'off'; }
    if (g.farmDecree !== 'off' && g.farmDecreeUntil <= t) { log('Указ закончился', '#9fc5e8'); g.farmDecree = 'off'; }
    return {
      event: g.farmEvent, decree: g.farmDecree,
      growSeconds: g.farmEvent === 'rain' ? F.rainGrowSeconds : F.growSeconds,
      bugChance: g.farmEvent === 'nobug' ? 0 : (g.farmDecree === 'decree-weevil' ? F.weevilBugChance : F.bugChance),
      doubleHarvestBonus: g.farmDecree === 'decree-double' ? 49 : 0,
      magicDoubleAt: g.farmDecree === 'decree-magic' ? 2 : 1,
    };
  }
  function res(h, ok, msg, color) { if (h) touch(h); if (S.session) { S.session.last = now(); S.session.real = Date.now(); } log(`${h ? DN(h) + ': ' : ''}${msg}`, color || (ok ? '#c8f0a8' : '#e8b0a0')); save(); try { refreshUI(); } catch (e) { console.error('refreshUI', e); } return { ok, msg }; } // v7panel8 п.6: ошибка отрисовки (окно героя на file:// — toDataURL) раньше вылетала ПОСЛЕ продажи → пульт «ошибка игры», а продажа уже прошла
  function addVeg(h, id, n) { h['veg_' + id] = (h['veg_' + id] || 0) + n; questEvent('harvest', { crop: id, n }, h); }
  // v7panel28 п.3: овощи, которые начислила сама игра (лут мобов/сундуков), Streamer.bot не знает — «RPG Veg Delta» принимает только списания (d > 0 пропускает),
  // а farmVars бота присылает абсолютные veg_* → следующий farmVars стирал лут («овощи исчезают»), а при готовке списание уходило из запаса бота.
  // Теперь такие овощи — отдельный кредит h._vegCr: farmVars = значение бота + кредит; готовка/продажа сначала тратят кредит, в бот уходит только остаток.
  function vegSync(h) {
    if (!h || !h._vegCr) return;
    const args = { event: 'vegDelta', reason: 'sync', user: h.user, txid: h.user + '-s' + Date.now().toString(36), gold: 0, goldTotal: h.rpg_gold || 0, delta: {} };
    let any = false;
    for (const k in h._vegCr) {
      const n = +h._vegCr[k] || 0;
      if (n > 0) { args.delta[k] = n; args[k] = n; any = true; }
    }
    if (any) { emitBot(args, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); h._vegCr = {}; log(`${DN(h)}: синхронизация овощей с ботом`, '#9fc5e8'); }
  }
  function lootVeg(h, id, n) {
    addVeg(h, id, n);
    const k = 'veg_' + id; // v7panel35: лут уходит боту дельтой сразу → в кредит _vegCr НЕ пишем (иначе бот получал его второй раз через vegSync, а farmVars показывал ×2)
    // v7panel34: лут с моба/сундука сразу уходит боту дельтой, чтобы пульт и Streamer.bot показывали одно и то же
    const args = { event: 'vegDelta', reason: 'loot', user: h.user, txid: h.user + '-l' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36), gold: 0, goldTotal: h.rpg_gold || 0, delta: {} };
    args.delta[k] = n; args[k] = n;
    emitBot(args, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta');
    log(`${DN(h)}: лут ${VEG[id] || id} +${n}`, '#b8e0a0'); // в основной журнал тоже
  }
  function vegSpendBot(h, k, n) { const c = h._vegCr || {}, cr = Math.min(Math.max(0, +c[k] || 0), n); if (cr) c[k] -= cr; return n - cr; }
  function gardenUpdate(h) { // Garden_Update
    if (h.gardenStatus === 1 && h.plantedAt > 0 && now() - h.plantedAt > G().growSeconds) {
      h.plantedAt = 0; h.gardenStatus = 2;
      const b = bedXY(h, false); if (!b.hidden) fxText(b.x, b.y - 140, 'Созрело!', '#ffe27a');
      log(`${h.user}: твоё растение созрело! Можно собирать урожай.`, '#ffe27a');
    }
  }
  function goldenPumpkin(h) { FX.push({ kind: 'golden', loc: 'garden', x: 1500, y: 560, t: 0, life: 2.6 }); bump('garden', 4); log(`★ ${h.user}: ЗОЛОТАЯ ТЫКВА! ★`, '#ffd700'); }

  const farm = {
    freeSeeds(nick) { // !семена
      const h = getHero(nick, true), diff = now() - (h.seedsLastTime || 0);
      if (h.seedsLastTime && diff < F.freeSeedsCooldown) return res(h, false, `семена будут через ${fmtTime(F.freeSeedsCooldown - diff)}`);
      h.seeds += F.freeSeeds; sStat(h, 'seeds', F.freeSeeds); h.seedsLastTime = now(); say(h, `+${F.freeSeeds} семян`);
      return res(h, true, `получает ${F.freeSeeds} семечка (всего ${h.seeds})`);
    },
    giveSeeds(nick, n) { const h = getHero(nick, true); n = +n || 3; h.seeds += n; sStat(h, 'seeds', n); seedMark(h); say(h, `+${n} семян`); emitBot({ event: 'vegDelta', reason: 'seeds', user: h.user, txid: vtx(h, 'sd'), gold: 0, goldTotal: h.rpg_gold || 0, delta: { seeds: n }, seeds: n }, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); return res(h, true, `+${n} семян (всего ${h.seeds})`); },
    giveMagicSeeds(nick, n) { const h = getHero(nick, true); n = +n || 3; h.seedsPrem += n; seedMark(h); say(h, `+${n} волшебных`); emitBot({ event: 'vegDelta', reason: 'magicSeeds', user: h.user, txid: vtx(h, 'm'), gold: 0, goldTotal: h.rpg_gold || 0, delta: { seedsPrem: n }, seedsPrem: n }, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); return res(h, true, `+${n} волшебных семян (всего ${h.seedsPrem})`, '#d7b8ff'); },
    plant(nick) { // !посадить
      const h = getHero(nick, true); gardenUpdate(h);
      if (h.seeds < 1) return res(h, false, 'нет семян! Напиши !семена');
      if (h.gardenStatus !== 0) return res(h, false, 'грядка уже занята');
      if (h.plantCooldown) return res(h, false, 'посадка на перезарядке');
      vegActivate(h); h.gardenStatus = 1; h.seeds -= 1; h.plantedAt = now(); h.waterLevel = 0; h._bugEaten = false;
      h._bugCheckAt = now() + R(F.bugCheckDelayMin, F.bugCheckDelayMax);
      visitBed(h, 'Сажаю!'); questEvent('plant', {}, h); bump('garden', 2);
      return res(h, true, `сажает семечко (осталось ${h.seeds}). Созреет через ${fmtTime(G().growSeconds)}`);
    },
    bugs(nick) { // !жуки
      const h = getHero(nick, true);
      if (!h.bugAttack) return res(h, false, 'на грядке нет жуков');
      h.bugAttack = false; h._bugDeadline = 0; // v7panel7: как «Спасение от жуков» в боте — рост не трогаем (шаги 5.2.2–5.2.4 там выключены)
      const b = bedXY(h); fxText(b.x, b.y - 120, 'Жуки прогнаны!', '#c8f0a8'); visitBed(h, 'Кыш!');
      return res(h, true, 'прогоняет жуков — растение растёт дальше');
    },
    shoo(nick, target) { // !отогнать <ник>
      const h = getHero(nick, true), t = getHero(target || nick, false);
      if (!t || !t.bugAttack) return res(h, false, `у ${target || nick} нет жуков`);
      t.bugAttack = false; t._bugDeadline = 0;
      const b = bedXY(t, false); if (!b.hidden) { fxFairy(b.x, b.y - 120); fxText(b.x, b.y - 110, 'спасено!', '#d7b8ff'); }
      visitBed(h, 'Кыш!');
      return res(h, true, `отгоняет жуков от грядки ${t.user}`);
    },
    harvest(nick) { // !собрать (анимация — harvestFX)
      const h = getHero(nick, true); gardenUpdate(h);
      if (h.gardenStatus !== 2) return res(h, false, 'на грядке ничего не созрело');
      if (h.plantedAt > 0 && now() - h.plantedAt > 120) { h.plantedAt = 0; h.waterLevel = 0; return res(h, true, 'растение созрело! Можно собирать урожай.'); }
      const g = G();
      let r = R(1, 30);
      if (g.decree === 'decree-weeds' && r < 12 && R(1, 2) === 1) r = 25;
      if (g.event === 'herb' && r > 22) r = (r % 12) + 1;
      const got = []; let seedBonus = 0, golden = false, fairy = false;
      const dbl = id => { got.push(id, id); fairy = true; };
      if (r <= 4) got.push('cucumber');
      else if (r <= 8) got.push('tomato');
      else if (r <= 12) got.push('carrot');
      else if (r === 13) { if (R(1, 10) < 5) { got.push('pumpkin'); golden = true; } else { got.push('weed'); seedBonus = 1; } }
      else if (r <= 17) got.push('eggplant');
      else if (r <= 20) { const id = ['cucumber', 'tomato', 'carrot'][r - 18]; if (R(1, 100) < g.doubleHarvestBonus + 1) dbl(id); else got.push(id); }
      else if (r === 21) { if (R(1, 10) < g.doubleHarvestBonus + 1) dbl('eggplant'); else got.push('eggplant'); }
      else { got.push('weed'); if (r === 26) seedBonus = 1; }
      vegActivate(h); got.forEach(id => addVeg(h, id, 1)); goalAdd('harvest', got.length, h); h.rpg_harvests++; addSkillXp(h, 'garden', skAct(1)); checkAch(h);
      h.seeds += seedBonus; h.gardenStatus = 0; h.plantedAt = 0; h.waterLevel = 0;
      const shedGold = Math.round(bEff('shed', 'harvestGold')); if (shedGold) h.rpg_gold += shedGold;
      // результат уже решён (как в боте), но показываем его только когда герой дошёл до грядки
      const rt = ensureRT(h); bedXY(h); rt.harvest = { got, golden, fairy, until: tm + 25 };
      if (!visitBed(h, golden ? 'ЗОЛОТО!' : 'Урожай!', () => harvestFX(h))) harvestFX(h);
      return res(h, true, `собирает: ${got.map(cropName).join(', ')}${fairy ? ' (фея удвоила!)' : ''}${seedBonus ? ' +1 семечко' : ''}`, golden ? '#ffd700' : '#c8f0a8');
    },
    exchange(nick) { // !обмен
      const h = getHero(nick, true);
      if (h.veg_weed < F.exchangeWeeds) return res(h, false, `нужно ${F.exchangeWeeds} сорняков (есть ${h.veg_weed})`);
      h.veg_weed -= F.exchangeWeeds;
      const r = R(1, 9), id = r <= 2 ? 'cucumber' : r <= 4 ? 'tomato' : r <= 6 ? 'carrot' : r <= 8 ? 'eggplant' : 'pumpkin';
      h['veg_' + id] += 1;
      const b = bedXY(h); fxIcon(b.x, b.y - 80, 'crop_' + id, 2); visitBed(h, 'Меняю!');
      if (id === 'pumpkin') goldenPumpkin(h);
      return res(h, true, `обменивает ${F.exchangeWeeds} сорняков на: ${cropName(id)}`);
    },
    magic(nick) { // !магия — отдельная волшебная грядка
      const h = getHero(nick, true), g = G();
      if (h.seedsPrem < 1) return res(h, false, 'нет волшебных семян');
      if (now() < h.magicCooldownUntil) return res(h, false, `мана копится: волшебная грядка будет готова через ${fmtTime(h.magicCooldownUntil - now())}`);
      if (h.magicLastDate !== today()) { h.magicDailyCount = 0; h.magicLastDate = today(); }
      if (h.magicDailyCount > MAGIC_MAX(h) - 1) return res(h, false, `мана на сегодня закончилась (${MAGIC_MAX(h)} в день), восстановится завтра`);
      h.seedsPrem -= 1; h.magicDailyCount += 1; h.magicHarvest += 1; h.magicCooldownUntil = now() + MAGIC_CD(); addSkillXp(h, 'magic', skAct(1));
      const r = R(1, 8), maybe = () => R(1, 2) < g.magicDoubleAt;
      let id, dbl = false;
      if (r === 1) id = 'cucumber';
      else if (r === 2) { id = 'cucumber'; dbl = maybe(); }
      else if (r === 3) id = 'carrot';
      else if (r === 4) { id = 'carrot'; dbl = maybe(); }
      else if (r === 5) id = 'tomato';
      else if (r === 6) { id = 'tomato'; dbl = maybe(); }
      else if (r === 7) { id = 'eggplant'; dbl = maybe(); }
      else id = R(1, 10) < 4 ? 'pumpkin' : 'eggplant';
      addVeg(h, id, dbl ? 2 : 1); goalAdd('harvest', dbl ? 2 : 1, h);
      h.magicLastCrop = id; questEvent('magic', {}, h);
      const mb = magicXY(h);
      const show = () => { const rt = ensureRT(h); rt.pick = tm; fxPop(mb.x, mb.y - 38, 'magic_flower'); fxLabel(mb.x, mb.y - 170, 'crop_' + id, `${dbl ? 'Магия x2' : 'Магия'}: ${cropName(id)} +${dbl ? 2 : 1}`, '#e8c8ff', 0.15); if (id === 'pumpkin') goldenPumpkin(h); };
      if (!goGarden(h, 'Абракадабра!', undefined, show)) show();
      return res(h, true, `волшебная грядка: ${cropName(id)}${dbl ? ' x2' : ''} (осталось сегодня ${Math.max(0, MAGIC_MAX(h) - h.magicDailyCount)}/${MAGIC_MAX(h)}, следующая через ${fmtTime(MAGIC_CD())})`, '#d7b8ff');
    },
    salad(nick) { // !салат — как действие «Салат» в Streamer.bot: 4 салата за 30 дней, рецепт 🥒5 🍅5 🥕5 🍆5 🎃1
      const h = getHero(nick, true), t = now(), S2 = SALAD();
      const fresh = !(+h.saladPeriodStart) || t - h.saladPeriodStart >= S2.period;
      if (!fresh && h.saladsThisPeriod > S2.per - 1) return res(h, false, `лимит салатов уже исчерпан — максимум (${S2.per} за 30 дн.). Следующий через ${fmtTime(h.saladPeriodStart + S2.period - t)}`);
      const need = S2.need, miss = Object.keys(need).filter(k => (+h['veg_' + k] || 0) < need[k]);
      if (miss.length) return res(h, false, 'для салата не хватает: ' + miss.map(k => `${cropName(k)} ${+h['veg_' + k] || 0}/${need[k]}`).join(', ') + ' — ничего не списано');
      for (const k in need) h['veg_' + k] -= need[k];
      h.totalSalads = (+h.totalSalads || 0) + 1;
      if (fresh) { h.saladPeriodStart = t; h.saladsThisPeriod = 1; } else h.saladsThisPeriod += 1;
      fxText(CAULDRON.x - 20, CAULDRON.y - 220, 'САЛАТ!', '#c8f0a8', 40);
      goCauldron(h, 'Салат готов!');
      questEvent('cook', {}, h); questEvent('cookDiff', { dish: 'salad' }, h); goalAdd('cook', 1, h); giveChest(h, 'silver', 'салат');
      const left = S2.per - h.saladsThisPeriod;
      return res(h, true, `🥗 легендарный салат готов! Списано: ${Object.keys(need).map(k => VEG_IC['veg_' + k] + need[k]).join(' ')}. Осталось салатов: ${left}/${S2.per}, лимит обновится через ${fmtTime(h.saladPeriodStart + S2.period - t)}`, '#ffe27a');
    },
    bag(nick) { // !урожай — тот же JSON, что бот шлёт в оверлей
      const h = getHero(nick, false); if (!h) return null;
      return { event: 'farmBag', user: h.user, cuc: h.veg_cucumber, tom: h.veg_tomato, car: h.veg_carrot, egp: h.veg_eggplant, pum: h.veg_pumpkin, weed: h.veg_weed, seeds: h.seeds, magicSeeds: h.seedsPrem, magic: h.magicHarvest };
    },
    bedInfo(nick) { // !грядка
      const h = getHero(nick, false); if (!h) return 'нет героя';
      gardenUpdate(h);
      if (h.gardenStatus === 0) return 'грядка пустая';
      if (h.gardenStatus === 2) return 'созрело, можно собирать: !собрать';
      if (!(h.plantedAt > 0) || h._paGuess) return 'растёт, время созревания неизвестно';
      return `растёт, осталось ${fmtTime(G().growSeconds - (now() - h.plantedAt))}`;
    },
  };
  function gardenAuto(nick) {
    const h = getHero(nick, true); gardenUpdate(h);
    if (h.bugAttack) return farm.bugs(nick);
    if (h.gardenStatus === 2) return farm.harvest(nick);
    if (h.gardenStatus === 1) { visitBed(h, 'Проверю грядку'); return res(h, true, farm.bedInfo(nick)); } // v6.22: полива нет
    if (h.seeds < 1) farm.freeSeeds(nick);
    return farm.plant(nick);
  }
  function setEvent(name) { // группа «Ферма_События»
    const g = S.global, t = now();
    if (name === 'off') { g.farmEvent = 'off'; g.farmEventUntil = 0; g.farmDecree = 'off'; g.farmDecreeUntil = 0; log('Обычная ферма: события и указы сняты', '#9fc5e8'); }
    else if (name === 'decree-off') { g.farmDecree = 'off'; g.farmDecreeUntil = 0; log('Указ снят', '#9fc5e8'); }
    else if (F.events[name]) { g.farmEvent = name; g.farmEventUntil = t + F.events[name].seconds; log(`Событие: ${F.events[name].name} на ${fmtTime(F.events[name].seconds)}`, '#9fc5e8'); }
    else if (F.decrees[name]) { g.farmDecree = name; g.farmDecreeUntil = t + F.decrees[name].seconds; log(`${F.decrees[name].name} на неделю`, '#9fc5e8'); }
    else return { ok: false, msg: 'неизвестное событие' };
    save(); refreshUI(); return { ok: true };
  }
  function farmTick() {
    streamTick();
    const t = now(), g = G();
    // v6.26: грядки, посаженные до запуска/перезагрузки игры (или только через Streamer.bot), занимают свободное место в огороде
    if (PLOTS.includes(null)) for (const n of S.order) { const h = S.heroes[n]; if (h && h.gardenStatus > 0 && !PLOTS.includes(n)) { const i = PLOTS.indexOf(null); if (i < 0) break; PLOTS[i] = n; } }
    for (const n of S.order) {
      const h = S.heroes[n];
      if (STANDALONE && h._bugCheckAt && t >= h._bugCheckAt) { // жуков «бросает» бот; без бота — только в ?standalone/?test
        h._bugCheckAt = 0;
        if (h.gardenStatus !== 0 && !h.vip && !h.bugAttack && R(1, 100) < g.bugChance) {
          h.bugAttack = true; h._bugDeadline = t + bugSec(h);
          log(`Жуки напали на грядку ${n}! !жуки или !отогнать ${n} — 60 секунд!`, '#ff9c7a'); say(h, 'Жуки!!', 3);
        }
      }
      if (STANDALONE && h.bugAttack && h._bugDeadline && t >= h._bugDeadline) {
        h.bugAttack = false; h._bugDeadline = 0; h.gardenStatus = 0; h.waterLevel = 0; h.plantedAt = 0; h._bugEaten = true;
        log(`${n}: урожай пожрал долгоносик :(`, '#ff9c7a');
        const b = bedXY(h, false); if (!b.hidden) fxText(b.x, b.y - 110, 'съедено…', '#ff9c7a');
      }
      gardenUpdate(h);
    }
  }

  // ===================== СОСТОЯНИЕ ГЕРОЯ (машина состояний) =====================
  // camp — у костра/в палатке; garden — на огороде; cooking — у котла; expedition — в походе (или бредёт назад);
  // town — в городе; boss — в отряде на босса.
  function heroState(h) {
    const rt = ensureRT(h);
    if (rt.mode === 'boss' || (S.boss && S.boss.signup && S.boss.signup.includes(h.user) && bossActive())) return 'boss';
    if (rt.mode === 'cook') return 'cooking';
    if (rt.mode === 'exp' || rt.mode === 'dead') return 'expedition';
    if (rt.mode === 'garden') return 'garden';
    if (rt.mode === 'visit' && (rt.loc === 'town' || (rt.dest && rt.dest.loc === 'town'))) return 'town';
    return 'camp';
  }
  const STATE_NAME = { camp: 'в лагере', garden: 'на огороде', cooking: 'у котла', expedition: 'в походе', town: 'в городе', boss: 'в отряде на босса' };
  // какие действия из каких состояний запрещены
  const BLOCK = {
    cook: ['cooking', 'expedition', 'boss'],
    expedition: ['cooking', 'expedition', 'boss'],
    town: ['cooking', 'expedition', 'boss'],
    boss: ['expedition', 'cooking'],
  };
  function blocked(h, action) { const s = heroState(h); return (BLOCK[action] || []).includes(s) ? `нельзя: герой сейчас ${STATE_NAME[s]}` : ''; }

  // ===================== НАГРАДЫ: ОБЩЕЕ =====================
  const RARITY = ['common', 'rare', 'epic', 'legendary'];
  const RARITY_NAME = { common: 'обычный', rare: 'редкий', epic: 'эпический', legendary: 'легендарный' };
  function addMats(h, src, mult) {
    const t = C.matDrops[src]; if (!t) return '';
    const out = [];
    for (const [id, [a, b]] of Object.entries(t)) { const n = Math.round(R(a, b) * (mult || 1)); if (n > 0) { h.rpg_mats[id] = (h.rpg_mats[id] || 0) + n; out.push(`${matName(id)} +${n}`); } }
    return out.join(', ');
  }
  const matName = id => (C.materials.find(m => m.id === id) || { name: id }).name;
  function fame(kind, text) { S.fame.unshift({ t: Date.now(), kind, text }); if (S.fame.length > 300) S.fame.length = 300; }
  function fameText() { return S.fame.map(f => `${new Date(f.t).toLocaleDateString('ru-RU')} — ${f.text}`).join('\n'); }

  // косметика: шляпы / ауры / питомцы (по редкости)
  function cosPool(type) { return type === 'hat' ? C.hats : type === 'aura' ? C.auras : type === 'set' ? (C.sets || []) : type === 'trail' ? (C.trails || []) : C.petList; }
  function cosName(type, id) { const x = cosPool(type).find(c => c.id === id); return x ? x.name : id; }
  function giveCosmetic(h, type, rarity) { if (type === 'hat') type = 'aura'; // v6.30
    const ri = Math.max(0, RARITY.indexOf(rarity));
    h.rpg_owned[type] = h.rpg_owned[type] || [];
    let pool = cosPool(type).filter(c => !c.price && RARITY.indexOf(c.rarity) <= ri && !h.rpg_owned[type].includes(c.id)); // v6.57a: витринная косметика (price) — только покупка/редкий шанс
    const exact = pool.filter(c => c.rarity === rarity); if (exact.length) pool = exact;
    if (!pool.length) { h.rpg_gold += 25 * (ri + 1); return `${25 * (ri + 1)} золота (вся косметика уже есть)`; }
    const c = pick(pool); h.rpg_owned[type].push(c.id);
    if (!h.rpg_eq[type]) h.rpg_eq[type] = c.id; // пустой слот — надеваем сразу
    if (RARITY.indexOf(c.rarity) >= 2) fame('cosmetic', `${h.user} получает ${c.name} (${RARITY_NAME[c.rarity]})`);
    return { text: `${type === 'hat' ? 'Шляпа' : type === 'aura' ? 'Аура' : type === 'set' ? 'Сет' : 'Питомец'}: ${c.name}`, rarity: c.rarity };
  }
  function titleCmd(nick, a) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    const own = (h.rpg_owned && h.rpg_owned.title) || [], s = String(a || '').trim().toLowerCase();
    if (/^(снять|убрать|нет|0|off)$/.test(s)) { h.rpg_eq.title = ''; return res(h, true, 'титул снят — над героем снова класс'); }
    const i = +s; if (i >= 1 && i <= own.length) return equip(h.user, 'title', own[i - 1]);
    const f = s && own.find(t => t.toLowerCase().startsWith(s)); if (f) return equip(h.user, 'title', f);
    return res(h, !!own.length, own.length ? `твои титулы: ${own.map((t, k) => `${k + 1}) ${t}`).join(', ')} · !титул N — надеть, !титул снять — убрать` : 'титулов пока нет');
  }
  function equip(nick, type, id) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    if (!['aura', 'pet', 'title', 'set', 'trail'].includes(type)) return { ok: false, msg: 'слоты: aura, pet, title, set, trail' }; // v6.30: без hat
    h.rpg_owned[type] = h.rpg_owned[type] || [];
    if (id && !h.rpg_owned[type].includes(id)) return res(h, false, `нет такого предмета (${id})`);
    h.rpg_eq[type] = id || ''; return res(h, true, id ? `надевает: ${type === 'title' ? id : cosName(type, id)}` : 'снимает предмет');
  }
  // ===================== v6.57a: КОСМЕТИКА (ауры, сеты-окраски, следы) — без влияния на статы =====================
  const COS_T = { aura: 'Аура', set: 'Сет', trail: 'След' }, COS_TYPES = ['aura', 'set', 'trail'];
  const cosAll = () => COS_TYPES.flatMap(t => cosPool(t).map(c => Object.assign({ type: t }, c)));
  const cosShop = () => cosAll().filter(c => c.price);
  const cosOwn = (h, c) => ((h.rpg_owned || {})[c.type] || []).includes(c.id);
  function cosResolve(q, h) { q = String(q || '').trim().toLowerCase().replace(/ё/g, 'е'); if (!q) return null; const L = h ? cosAll().filter(c => c.price || cosOwn(h, c)) : cosShop();
    return L.find(c => c.id === q) || L.find(c => c.name.toLowerCase().replace(/ё/g, 'е').startsWith(q)); }
  function cosGive(h, c) { h.rpg_owned[c.type] = h.rpg_owned[c.type] || []; if (!h.rpg_owned[c.type].includes(c.id)) h.rpg_owned[c.type].push(c.id); if (!h.rpg_eq[c.type]) h.rpg_eq[c.type] = c.id;
    if (RARITY.indexOf(c.rarity) >= 1) fame('cosmetic', `${h.user} получает ${c.name} (${RARITY_NAME[c.rarity]})`); return { text: `${COS_T[c.type]}: ${c.name}`, rarity: c.rarity, cos: c.id }; }
  function buyCos(h, c) {
    if (cosOwn(h, c)) { h.rpg_eq[c.type] = c.id; save(); refreshUI(); return res(h, true, `надевает: ${c.name}`); }
    if (!c.price) return res(h, false, `«${c.name}» не продаётся — только из сундуков`);
    if (h.rpg_gold < c.price) return res(h, false, `«${c.name}» стоит ${c.price} золота, у тебя ${h.rpg_gold}`);
    h.rpg_gold -= c.price; cosGive(h, c); h.rpg_eq[c.type] = c.id; save(); refreshUI();
    log(`✨ ${DN(h)} покупает косметику «${c.name}» за ${c.price} золота`, '#e0b0ff'); return res(h, true, `покупает и надевает «${c.name}» (только внешний вид)`);
  }
  // редкий шанс поверх содержимого сундука: mult — множитель (мимик)
  function cosChestRoll(h, tier, mult) { const CS = C.cosmeticsShop || {}; if (!CS.enabled || !COS_ON()) return null;
    const p = ((CS.chestChance || {})[tier] || 0) * (mult || 1); if (!(Math.random() < p)) return null;
    const pool = cosShop().filter(c => !cosOwn(h, c)); if (!pool.length) return null; return cosGive(h, pick(pool)); }

  // ===================== СУНДУКИ (только игровые награды) =====================
  // v6.31: иконка предмета для разлёта из сундука
  function lootKey(o) { return o.key || 'chest'; }
  // v6.31: сундук на месте (pos), открывается, над ним текст содержимого, предметы летят к герою
  function chestFx(h, tier, out, pos) {
    const ch = C.chests[tier], rt = ensureRT(h), loc = pos && pos.loc || rt.loc;
    const x = pos ? pos.x : rt.x + 70, y = pos ? pos.y : rt.y;
    const lines = out.map(o => o.text);
    FX.push({ kind: 'chestdrop', loc, x, y, t: 0, life: (C.chestFxSec || 2.6), tier, name: ch.name, color: ch.color, lines: pos ? [] : lines }); // v6.32: при дропе с моба состав — в табличке сверху, у сундука только название
    out.filter(o => o.key && o.key !== 'chest').forEach((o, i) => FX.push({ kind: 'fly', loc, x, y: y - 40, user: h.user, key: lootKey(o), t: -(0.55 + i * 0.12), life: 0.8 }));
    LASTLOOT.unshift({ user: h.user, tier, name: ch.name, x, y, loc, items: lines, t: tm }); if (LASTLOOT.length > 30) LASTLOOT.length = 30;
  }
  const LASTLOOT = [];
  // v6.31: табличка лута поверх экрана (очередь, по одной ~4 с), под «Топ фермеров», не перекрывает журнал
  const LOOTPOP = [];
  // v6.32: перенос строки по ширине в пикселях (журнал, плашки наград)
  function wrapPx(t, size, maxW) { setFont(size); const out = []; let cur = ''; for (const w of String(t).split(' ')) { const c = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(c).width > maxW) { out.push(cur); cur = w; } else cur = c; } if (cur) out.push(cur); return out.flatMap(l => { if (ctx.measureText(l).width <= maxW) return [l]; let a = l; while (a.length > 1 && ctx.measureText(a + '…').width > maxW) a = a.slice(0, -1); return [a + '…']; }); }
  function lootPopup(user, title, lines, color, big, loc) {
    const last = LOOTPOP[LOOTPOP.length - 1];
    if (last && last.user === user && last.loc === loc && last.t === 0 && LOOTPOP.length > 1) { if (big) last.gold = (last.gold || 0) + big; else { last.title = title; last.color = color; } last.lines.push(...lines); return; }
    LOOTPOP.push({ user, title, lines: lines.slice(), color: color || '#ffd27a', gold: big || 0, t: 0, loc: loc || '' });
    while (LOOTPOP.length > (C.lootPopupQueue || 6)) LOOTPOP.splice(1, 1);
  }
  function drawLootPopup(dt) {
    while (LOOTPOP[0] && LOOTPOP[0].loc && LOOTPOP[0].loc !== viewLoc()) LOOTPOP.shift(); // v6.32: табличка только на своей локации (лесное «+6 золота» не всплывает на экране босса)
    const p = LOOTPOP[0]; if (!p) return; const life = C.lootPopupSec || 4; p.t += dt;
    if (p.t >= life) { LOOTPOP.shift(); return; }
    const a = p.t < 0.25 ? p.t / 0.25 : p.t > life - 0.4 ? (life - p.t) / 0.4 : 1, s = UIS;
    const head = p.user ? `${p.user}: ${p.title}` : p.title, big = p.gold ? `+${p.gold} золота` : '', ls = p.lines.slice(-6);
    const w = Math.max(measure(head, 34 * s), big ? measure(big, 56 * s) : 0, ...ls.map(l => measure(l, 30 * s))) + 70 * s;
    const hh = 60 * s + (big ? 70 * s : 0) + ls.length * 42 * s + 16 * s, x0 = W / 2 - w / 2, y0 = Math.max(150 * s, BANNER_BOT, viewLoc() === 'garden' ? 136 : 0, topBottom()); // v6.34: ниже баннера босса и «Топ фермеров»
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(30,18,10,.9)'; ctx.fillRect(x0, y0, w, hh); ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.strokeRect(x0, y0, w, hh);
    if (p.gold && !ls.length) drawImg('coins', x0 + 40 * s, y0 + 58 * s, 46 * s); // v6.32: без второго сундука — сундук один, на месте моба
    text(head, W / 2, y0 + 32 * s, 34 * s, p.color); let y = y0 + 60 * s;
    if (big) { text(big, W / 2, y + 34 * s, 56 * s, '#ffd700'); y += 70 * s; }
    ls.forEach((l, i) => text(l, W / 2, y + 22 * s + i * 42 * s, 30 * s, '#fff2c0')); ctx.restore();
    if (LOOTPOP.length > 1) text(`ещё ${LOOTPOP.length - 1}…`, x0 + w - 60 * s, y0 + hh - 14 * s, 20 * s, '#c8b8a0');
  }
  // v7panel12 п.6: материалы и 1 овощ в сундуке — с небольшим шансом, по тирам растёт плавно (было: материалы всегда, ×0.5/1/1.5/2)
  const CHEST_MATS = Object.assign({ wooden: { p: 0.25, mult: 0.5, veg: 0.10 }, silver: { p: 0.35, mult: 0.7, veg: 0.12 }, golden: { p: 0.45, mult: 0.85, veg: 0.15 }, legendary: { p: 0.6, mult: 1, veg: 0.18 } }, C.chestExtras || {});
  // v7panel20 п.10: овощи/семена — только редким шансом. Флаг C.rareVegLoot (по умолчанию ВЫКЛ до одобрения Tim; ?rareloot=1 — для теста)
  // v7panel21 п.2: ВКЛ по умолчанию. Выключить: rareVegLoot: false или rareVegLoot: { enabled: false }; ?rareloot=0 — для теста. С мобов: семена 8%, овощ 2% (сорняк — отдельно 2%, как раньше)
  const RARE_LOOT = () => { if (typeof location !== 'undefined' && /[?&]rareloot=0/.test(location.search)) return false; if (typeof location !== 'undefined' && /[?&]rareloot=1/.test(location.search)) return true; const v = C.rareVegLoot; return !(v === false || (v && typeof v === 'object' && v.enabled === false)); };
  const RL = Object.assign({ monsterVeg: 0.02, monsterSeed: 0.08, monsterWeed: 0.02, chestVegK: 0.3, chestRollKeep: 0.3 }, C.rareVegLootK || {}, (C.rareVegLoot && typeof C.rareVegLoot === 'object') ? C.rareVegLoot : {});
  // v7panel35: баланс лута с походов — меньше семян и овощей. Золото/опыт НЕ трогаем; тыква (легенд. сундук) не режется.
  // C.lootBalance: { enabled, seedMul (семена и волшебные семена), vegMul (обычные овощи), dimStep/dimFloor/windowMin — убывание за частые походы:
  //   k-й поход за последние windowMin минут даёт ×max(dimFloor, 1 − dimStep·(k−1)), seedCap — максимум семян за один поход }.
  // По умолчанию при походе раз в 10 мин: семена ≈ ÷2.4, овощи ≈ ÷2 (tests/sim_v7panel34_loot.cjs). Выключить: lootBalance: { enabled: false }.
  const LOOTB = () => { const v = C.lootBalance; return Object.assign({ enabled: true, seedMul: 0.6, vegMul: 0.75, dimStep: 0.15, dimFloor: 0.5, windowMin: 60, seedCap: 2 }, v && typeof v === 'object' ? v : {}, v === false ? { enabled: false } : {}); };
  function lootK(h, kind) { const L = LOOTB(); if (!L.enabled || !h) return 1; const t = Date.now(), win = (+L.windowMin || 60) * 60000;
    const a = (h._hikeTs || []).filter(x => t - x < win), k = Math.max(1, a.length), f = Math.max(+L.dimFloor || 0, 1 - (+L.dimStep || 0) * (k - 1));
    return Math.max(0, (kind === 'seed' ? +L.seedMul : +L.vegMul) * f); }
  // v46: семена — уникальный txid дельты (бот пропускает повтор ПОСЛЕДНЕГО txid: две дельты в одну мс, напр. 2 броска сундука, раньше теряли вторую)
  let VTX_N = 0; const vtx = (h, k) => h.user + '-' + k + Date.now().toString(36) + (++VTX_N).toString(36);
  // v46: отметка «игра сама начислила семена» — эхо этого начисления в farmVars бота не пишется в журнал второй раз (и устаревший farmVars не даёт ложного «+N»)
  function seedMark(h) { if (h) h._sdHi = { s: +h.seeds || 0, p: +h.seedsPrem || 0, t: Date.now() }; }
  function lootHikeMark(h) { if (!h) return; const t = Date.now(), win = ((+LOOTB().windowMin) || 60) * 60000; h._hikeTs = (h._hikeTs || []).filter(x => t - x < win); h._hikeTs.push(t); h._hikeSeeds = 0; }
  function lootSeedsOk(h, n) { const L = LOOTB(); if (!L.enabled || !h || !(+L.seedCap > 0)) return n; const left = Math.max(0, L.seedCap - (h._hikeSeeds || 0)), m = Math.min(n, left); h._hikeSeeds = (h._hikeSeeds || 0) + m; return m; }
  function chestExtras(h, tier, out) { const x = CHEST_MATS[tier] || CHEST_MATS.wooden;
    if (Math.random() < x.p) { const m = addMats(h, 'chest', x.mult); if (m) out.push({ text: m, rarity: 'common' }); }
    if (Math.random() < x.veg * (RARE_LOOT() ? RL.chestVegK : 1) * lootK(h, 'veg')) { const id = pick(['cucumber', 'tomato', 'carrot', 'eggplant']); lootVeg(h, id, 1); out.push({ text: `${cropName(id)} ×1`, rarity: 'common', key: 'crop_' + id }); } }
  function giveChest(h, tier, src, pos) {
    const ch = C.chests[tier]; if (!ch) return;
    h.rpg_chestsGot = (h.rpg_chestsGot || 0) + 1;
    const out = [];
    for (let i = 0; i < ch.rolls; i++) out.push(chestItem(h, weighted(COS_ON() ? ch.items : ch.items.filter(x => x.type !== 'cosmetic'))));
    chestExtras(h, tier, out);
    { const cz = cosChestRoll(h, tier, pos && pos.cosMult); if (cz) out.push(cz); } // v6.57a
    if (tier === 'legendary') { h.rpg_legendary++; checkAch(h); shChestDrop(h, tier, out); }
    log(`${h.user}: ${ch.name} (${src}) — ${out.map(o => o.text).join('; ')}`, ch.color);
    { const s = streamCur(); s.loot += out.length; sStat(h, 'loot', out.length); out.forEach(o => { if (RARITY.indexOf(o.rarity) >= 2) { s.lootTop.unshift({ user: h.user, text: o.text }); if (s.lootTop.length > 8) s.lootTop.length = 8; } if (o.key === 'coins') { const n = parseInt(o.text) || 0; s.gold += n; sStat(h, 'gold', n); } }); }
    chestFx(h, tier, out, pos); if (pos) lootPopup(h.user, ch.name, out.map(o => o.text), ch.color, 0, pos.loc); clog(`Лут: ${ch.name} — ${out.map(o => o.text).join(', ')}`, ch.color);
    if (tier !== 'wooden' && !pos) MODALS.push({ type: 'chest', user: h.user, tier, items: out, t: 0 });
    if (ch.realPrize) rollRealPrize(h, 'legendaryChest');
    save(); refreshUI();
    return out;
  }
  function chestItem(h, it) {
    const R1 = t => ({ text: t, rarity: 'common' });
    if (/^(veg|seeds|magicSeeds)$/.test(it.type) && it.crop !== 'pumpkin' && Math.random() > (RARE_LOOT() ? RL.chestRollKeep : 1) * lootK(h, it.type === 'veg' ? 'veg' : 'seed')) it = { type: 'gold', min: 10, max: 25 }; // v7panel35: × lootBalance
    if (it.type === 'seeds') { const m = lootSeedsOk(h, it.n); if (!m) it = { type: 'gold', min: 10, max: 25 }; else if (m !== it.n) it = Object.assign({}, it, { n: m }); } // п.10: чаще золото вместо овощей/семян
    switch (it.type) {
      case 'gold': { const n = R(it.min, it.max); h.rpg_gold += n; return { text: `${n} золота`, rarity: 'common', key: 'coins' }; }
      case 'veg': { const id = it.crop || pick(['cucumber', 'tomato', 'carrot', 'eggplant']); lootVeg(h, id, it.n); return { text: `${cropName(id)} ×${it.n}`, rarity: id === 'pumpkin' ? 'rare' : 'common', key: 'crop_' + id }; }
      case 'seeds': h.seeds += it.n; sStat(h, 'seeds', it.n); seedMark(h); emitBot({ event: 'vegDelta', reason: 'chest', user: h.user, txid: vtx(h, 'ch'), gold: 0, goldTotal: h.rpg_gold || 0, delta: { seeds: it.n }, seeds: it.n }, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); return R1(`семена ×${it.n}`);
      case 'magicSeeds': h.seedsPrem += it.n; seedMark(h); emitBot({ event: 'vegDelta', reason: 'chest', user: h.user, txid: vtx(h, 'ch'), gold: 0, goldTotal: h.rpg_gold || 0, delta: { seedsPrem: it.n }, seedsPrem: it.n }, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); return { text: `волшебные семена ×${it.n}`, rarity: 'rare' };
      default: { h.rpg_gold += 15; return { text: '15 золота', rarity: 'common', key: 'coins' }; } // v6.31: неизвестный тип из старого конфига — золото
      case 'potion': { h.rpg_bag[it.id] = (h.rpg_bag[it.id] || 0) + 1; const r = recipeById(it.id); return { text: r ? r.name : it.id, rarity: r && r.tier >= 3 ? 'epic' : 'rare', key: 'potion' }; }
      case 'gear': { const pool = C.gear.filter(g => g.tier === it.tier && !h.rpg_gear.includes(g.id)); if (!pool.length) { h.rpg_gold += 40 * it.tier; return R1(`${40 * it.tier} золота`); } const g = pick(pool); h.rpg_gear.push(g.id); return { text: `снаряжение: ${g.name}`, rarity: RARITY[it.tier] }; }
      case 'cosmetic': { if (!COS_ON()) return R1('—'); const r = giveCosmetic(h, (it.rarity === 'epic' || it.rarity === 'legendary') && Math.random() < 0.2 ? 'set' : Math.random() < 0.65 ? 'aura' : 'pet', it.rarity); return typeof r === 'string' ? R1(r) : r; }
      case 'pet': { const r = giveCosmetic(h, 'pet', it.rarity); return typeof r === 'string' ? R1(r) : r; }
    }
    return R1('?');
  }
  function rollChestTier(luck) {
    const w = Object.entries(C.drops.chestTier).map(([id, weight]) => ({ id, weight }));
    let t = weighted(w).id;
    if (luck && t !== 'legendary') { const order = ['wooden', 'silver', 'golden', 'legendary']; t = order[Math.min(2, order.indexOf(t) + 1)]; } // fix: зелье удачи поднимает максимум до золотого; легендарный — только своим броском
    return t;
  }

  // ===================== РЕАЛЬНЫЕ ПРИЗЫ (только редкие события, выдаёт стример вручную) =====================
  const DAY = 86400000;
  function prizeCount(id, ms) { const t = Date.now() - ms; return S.realLog.filter(r => r.id === id && r.t >= t).length; }
  // v43c: лимит «1 реальный приз на зрителя за стрим». Стрим = S.stream.id (тот же, что «ходы с пульта за стрим»; новый — по Twitch Stream Online или новой сессии).
  // Хранится в сейве отдельно от списка «Призы к выдаче»: отметка «выдано» или удаление строки лимит не сбрасывают. Ник — в нижнем регистре.
  // v43d: если Streamer.bot прислал startedAt трансляции Twitch (действие «RPG Stream Online» v43d), стрим для лимита = эта трансляция:
  // повторный Online / Offline+Online / перезагрузка с тем же startedAt лимит НЕ сбрасывают. Без startedAt — как раньше, по S.stream.id.
  function twMark(st) { st = String(st == null ? '' : st).trim().slice(0, 64); if (!st) return; const s = streamCur(); s.twStart = st; save(); }
  function realStreamRec() { const s = streamCur(), key = s.twStart ? 'tw:' + s.twStart : s.id; let r = S.realStream;
    if (!r || r.sid !== key) { const t0 = s.twStart && /^\d{4}-\d\d-\d\dT/.test(s.twStart) && isFinite(Date.parse(s.twStart)) ? Date.parse(s.twStart) : +s.start; r = S.realStream = { sid: key, users: {} }; // миграция: призы, уже выпавшие с начала текущего стрима (по t в «Призах к выдаче»), кроме тестовых
      (S.prizes || []).forEach(p => { if (p && p.user && p.src !== 'test' && +p.t >= (t0 || Infinity)) r.users[lc(p.user)] = +p.t; }); }
    return r; }
  function realStreamHas(h) { return !!(h && realStreamRec().users[lc(h.user)]); }
  function realStreamMark(h) { if (h) realStreamRec().users[lc(h.user)] = Date.now(); }
  // v47: общий лимит реальных призов за стрим на ВСЕХ зрителей (realPrizes.perStreamTotal; нет ключа — без общего лимита, как раньше).
  // Считается по той же записи стрима S.realStream (в сейве, по startedAt Twitch) — перезагрузка источника OBS лимит не сбрасывает. force/тест не считаются.
  const realStreamCap = () => { const v = (C.realPrizes || {}).perStreamTotal; return v == null || v === '' || !isFinite(+v) ? Infinity : Math.max(0, Math.floor(+v)); };
  const realStreamTotal = () => Object.keys(realStreamRec().users).length;
  function rollRealPrize(h, source, force) {
    const P = C.realPrizes;
    if (P.budgetMode === 'off' && !force) return null;
    const chance = (P.sources || {})[source] || 0;
    if (!force && Math.random() >= chance) return null;
    if (!force && realStreamTotal() >= realStreamCap()) { log(`(реальный приз для ${h.user} не выпал: лимит ${realStreamCap()} на стрим для всех уже выдан)`, '#9a8a7a'); return null; } // v47
    if (!force && realStreamHas(h)) { log(`(реальный приз для ${h.user} не выпал: уже был реальный приз за этот стрим)`, '#9a8a7a'); return null; } // v43c: 1 реальный приз на зрителя за стрим
    if (!force && Date.now() - S.lastRealPrize < P.globalCooldownMinutes * 60000) { log(`(реальный приз для ${h.user} не выпал: общий кулдаун)`, '#9a8a7a'); return null; }
    const allowed = { normal: ['free', 'cheap', 'medium', 'expensive'], cheap: ['free', 'cheap'], off: [] }[P.budgetMode] || ['free', 'cheap', 'medium', 'expensive'];
    const pool = P.list.filter(p => (force || allowed.includes(p.cost)) && h.rpg_level >= (p.minLevel || 0)
      && prizeCount(p.id, DAY) < p.caps.day && prizeCount(p.id, 7 * DAY) < p.caps.week && prizeCount(p.id, 30 * DAY) < p.caps.month
      && !(p.id === 'heroweek' && h.rpg_heroWeekUntil > Date.now()));
    if (!pool.length) return null;
    const p = weighted(pool);
    S.realLog.push({ id: p.id, t: Date.now() }); S.realLog = S.realLog.filter(r => Date.now() - r.t < 31 * DAY);
    S.lastRealPrize = Date.now();
    if (!force) realStreamMark(h);
    const auto = !!p.auto;
    S.prizes.push({ id: S.idc++, user: h.user, prizeId: p.id, name: p.name, cost: p.cost, src: source, t: Date.now(), done: auto, doneAt: auto ? Date.now() : 0, auto });
    if (p.id === 'heroweek') grantHeroWeek(h, source);
    fame('prize', `${h.user} выигрывает «${p.name}»`);
    log(`★ РЕАЛЬНЫЙ ПРИЗ: ${h.user} — ${p.name} (${source})${auto ? ' — выдан автоматически' : ' → «Призы к выдаче»'}`, '#ff9cc4');
    const rt = ensureRT(h); fxText(rt.x, rt.y - 260, '★ ' + p.name + '!', '#ff9cc4', 36, 3, rt.loc);
    save(); refreshUI(); return p;
  }
  function markPrize(id, done) { const p = S.prizes.find(x => x.id === +id); if (!p) return { ok: false }; p.done = done !== false; p.doneAt = p.done ? Date.now() : 0; save(); refreshUI(); return { ok: true }; }

  // ===================== ГЕРОЙ НЕДЕЛИ =====================
  function grantHeroWeek(h, src) {
    const HW = C.heroOfWeek;
    h.rpg_heroWeekUntil = Date.now() + HW.days * DAY; h.rpg_lastGreet = 0;
    fame('heroweek', `${h.user} — ${HW.title} (${src})`);
    log(`★ ${h.user} — ${HW.title} на ${HW.days} дн.! Бот поприветствует его в чате при первом сообщении.`, '#ffd27a');
  }
  const isHeroWeek = h => h.rpg_heroWeekUntil > Date.now();
  const GREETED = {}; // кого уже поприветствовали за эту сессию (с момента загрузки страницы)
  function maybeGreet(h) {
    const HW = C.heroOfWeek; if (!isHeroWeek(h)) return;
    const t = Date.now(), gap = HW.sessionGapMinutes * 60000;
    const newSession = !GREETED[h.user] || t - (h.rpg_lastChat || 0) > gap;
    h.rpg_lastChat = t;
    if (!newSession || t - (h.rpg_lastGreet || 0) < HW.greetCooldownMinutes * 60000) { GREETED[h.user] = true; return; }
    GREETED[h.user] = true; h.rpg_lastGreet = t;
    const text = pick(HW.phrases).replace(/\{user\}/g, h.user);
    emitBot({ event: 'heroGreeting', user: h.user, text }, HW.action);
    S.greetLog.unshift({ t, user: h.user, text }); S.greetLog.length = Math.min(S.greetLog.length, 50);
    log(`→ Streamer.bot: приветствие героя недели ${h.user}`, '#ffd27a');
    save();
  }

  // ===================== ДОСТИЖЕНИЯ И ТИТУЛЫ =====================
  function checkAch(h) {
    for (const a of C.achievements) {
      if (h.rpg_ach.includes(a.id) || (h[a.stat] || 0) < a.at) continue;
      h.rpg_ach.push(a.id); h.rpg_gold += a.gold || 0;
      if (a.title && !h.rpg_owned.title.includes(a.title)) { h.rpg_owned.title.push(a.title); if (!h.rpg_eq.title && C.titleAutoEquip === true) h.rpg_eq.title = a.title; } // v6.55 п.5: титул не надевается сам
      log(`🏆 ${h.user}: достижение «${a.name}»${a.title ? ` — титул «${a.title}»` : ''} +${a.gold || 0} золота`, '#ffd27a');
      fame('ach', `${h.user}: «${a.name}»`);
      if (a.rare) rollRealPrize(h, 'rareAchievement');
    }
  }

  // ===================== КОТЁЛ: РЕЦЕПТЫ =====================
  // Готовить можно только у котла и только свободным героем. Блюдо = бафф (до 3 сразу), зелье — в сумку.
  function findRecipe(q) {
    const s = lc(q); if (!s) return null;
    if (/^\d+$/.test(s)) return C.recipes[+s - 1] || null;
    return C.recipes.find(r => r.id === s || lc(r.name) === s) || C.recipes.find(r => lc(r.name).includes(s)) || null;
  }
  function canAfford(h, r) { return Object.entries(r.need).every(([k, n]) => (h['veg_' + k] || 0) >= n); }
  // v6.22: рецепты открываются по уровню навыка (PROGRESSION.md): T1 — сразу, дальше каждый следующий рецепт своего вида — +3 уровня
  function recipeSkill(r) { return r.kind === 'potion' ? 'alch' : 'cook'; }
  function recipeLv(r) { if (r.lv > 0) return r.lv; if ((r.tier || 1) <= 1) return 1; const same = C.recipes.filter(x => x.kind === r.kind && (x.tier || 1) > 1); return 1 + 3 * (same.indexOf(r) + 1); }
  function recipeOpen(h, r) { return !h || skill(h, recipeSkill(r)).lv >= recipeLv(r); }
  function bestRecipe(h) { return C.recipes.slice().sort((a, b) => b.tier - a.tier).find(r => recipeOpen(h, r) && canAfford(h, r) && !(r.kind === 'food' && h.rpg_buffs.length >= C.maxActiveBuffs && h.rpg_dishes.length >= 3)); }
  // v6.31: время готовки из config (cookSeconds по сложности; seconds у рецепта — ручное переопределение)
  function recipeSec(r) { if (!r) return 3; if (r.seconds > 0) return r.seconds; const cs = C.cookSeconds || {}, lvl = (C.cookTierLevel || {})[r.tier] || 'hard'; return cs[lvl] || cs.hard || 30; }
  // v7panel24: из аргумента выделяем количество (последнее число или «макс»); одно число = количество для текущего/лучшего блюда
  function cookArgs(which) {
    const a = String(which || '').trim().split(/\s+/).filter(Boolean); let want = 1;
    if (BC_ON() && a.length) { const l = lc(a[a.length - 1]); if ((/^\d+$/.test(l) && a.length >= 2) || l === 'макс' || l === 'max') { // v49.11: одно число — это номер рецепта («!готовить 6» = зелье №6), количество — вторым числом («!готовить 6 3»)
      want = /^\d+$/.test(l) ? +l : BC_MAX(); a.pop(); } }
    return { q: a.join(' '), want: Math.max(1, Math.min(BC_MAX(), want)) };
  }
  function cookPortions(h, r) { return Math.min(...Object.entries(r.need).map(([k, n]) => Math.floor((h['veg_' + k] || 0) / n))); }
  function cook(nick, which0) {
    const h = getHero(nick, true);
    const b = blocked(h, 'cook'); if (b) return res(h, false, b);
    const ca = cookArgs(which0), which = ca.q;
    const r = which ? findRecipe(which) : bestRecipe(h);
    if (!r) return res(h, false, which ? `нет рецепта «${which}». Меню: ${C.recipes.map((x, i) => `${i + 1}) ${x.name}`).join(', ')}` : 'не хватает овощей ни на один рецепт');
    if (!recipeOpen(h, r)) return res(h, false, `«${r.name}» пока закрыт: нужен уровень ${recipeSkill(r) === 'alch' ? 'алхимии' : 'готовки'} ${recipeLv(r)} (сейчас ${skill(h, recipeSkill(r)).lv})`);
    if (!canAfford(h, r)) return res(h, false, `для «${r.name}» нужно: ${Object.entries(r.need).map(([k, n]) => `${cropName(k)} ${h['veg_' + k] || 0}/${n}`).join(', ')}`);
    if ((h._cookCd || 0) > Date.now()) { const left = Math.ceil((h._cookCd - Date.now()) / 1000); return res(h, false, `готовка: КД ещё ${fmtTime(left)}`); }
    if (h._rcd && h._rcd[r.id] > Date.now()) { const left = Math.ceil((h._rcd[r.id] - Date.now()) / 1000); return res(h, false, `«${r.name}»: КД ещё ${fmtTime(left)}`); }
    if (S.cooking.length >= 3) return res(h, false, 'у котла уже трое, подожди');
    const tokN = Number.isFinite(COOK_TOK) ? Math.max(0, COOK_TOK) : Infinity, vegN = cookPortions(h, r);
    const cnt = Math.max(1, Math.min(ca.want, tokN, vegN)); // ≥1: на одну порцию овощи и токен уже проверены
    const short = cnt < ca.want ? (cnt >= tokN && tokN < vegN ? `токенов готовки только ${tokN}` : `овощей хватает только на ${vegN}`) : '';
    for (const [k, n] of Object.entries(r.need)) h['veg_' + k] -= n * cnt;
    vegTrim(h); // v7panel8 п.7: списание сразу уходит и в Streamer.bot (иначе следующий farmVars бота «возвращал» овощи и счётчик на пульте не уменьшался)
    { const args = { event: 'vegDelta', reason: 'cook', recipe: r.id, user: h.user, txid: h.user + '-c' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36), gold: 0, goldTotal: h.rpg_gold || 0, delta: {} };
      for (const [k, n] of Object.entries(r.need)) { const b = vegSpendBot(h, 'veg_' + k, n * cnt); if (b) { args.delta['veg_' + k] = -b; args['veg_' + k] = -b; } }
      emitBot(args, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); }
    const rt = ensureRT(h); claimPlot(h);
    const p = B6.garden ? CAULDRON6[0] : SPOT('garden', 'cauldron'), slot = S.cooking.length;
    const job = { user: h.user, id: r.id, need: recipeSec(r), left: recipeSec(r), started: false, n: cnt };
    S.cooking.push(job);
    rt.mode = 'cook'; touch(h);
    const cp = B6.garden ? CAULDRON6[slot % 3] : { x: p.x - slot * 70, y: p.y + (slot % 2) * 30 };
    travel(h, 'garden', cp.x, cp.y, () => { job.started = true; rt.flip = false; rt.work = 999; rt.bubbleOff = B6.garden ? COOK_BUB[slot % 3] : null; say(h, `${recipeVerb(r).me}: ${r.name}`, 3); });
    bump('garden', 3);
    if (BC_ON() && (cnt > 1 || ca.want > 1)) { const o = res(h, true, `готовит ${cnt} × ${r.name} (${fmtTime(recipeSec(r))})${short ? ` — ${short}, запрошено ${ca.want}` : ''}`); o.used = cnt; return o; }
    return res(h, true, `${heroFem(h) ? 'пошла' : 'пошёл'} к котлу ${recipeVerb(r).inf} «${r.name}» (${fmtTime(recipeSec(r))})`);
  }
  function cookTick(dt) {
    for (let i = S.cooking.length - 1; i >= 0; i--) {
      const j = S.cooking[i], h = S.heroes[j.user];
      if (!h) { S.cooking.splice(i, 1); continue; }
      if (!j.started) { const rt = ensureRT(h); if (rt.mode !== 'cook') { j.started = true; /* v7panel32: раньше заказ молча удалялся (овощи уже списаны, квест «приготовить» не шёл) — напр. после перезагрузки страницы по пути к котлу; теперь блюдо доваривается */ } else continue; }
      j.left -= dt; if (j.left > 0) continue;
      S.cooking.splice(i, 1); finishCook(h, recipeById(j.id), j.n || 1);
    }
  }
  // ===== v6.19: навыки (PROGRESSION.md) =====
  const skNeed = lv => Math.round(30 * Math.pow(lv, 1.85));
  const skCap = lv => 300 + 70 * lv;
  const skAct = u => Math.round(15 + 3 * u + Math.pow(u, 1.6)); // XP за действие; u — уровень открытия рецепта
  function skill(h, id) { h.rpg_skills = h.rpg_skills || {}; return h.rpg_skills[id] = h.rpg_skills[id] || { lv: 1, xp: 0, day: '', today: 0 }; }
  function addSkillXp(h, id, n) {
    const s = skill(h, id), d = new Date().toISOString().slice(0, 10); if (s.day !== d) { s.day = d; s.today = 0; }
    if (s.lv >= 50) return 0;
    const g = Math.max(0, Math.min(n, skCap(s.lv) - s.today)); s.today += g; s.xp += g;
    let up = false; while (s.lv < 50 && s.xp >= skNeed(s.lv)) { s.xp -= skNeed(s.lv); s.lv++; up = true; }
    if (s.lv >= 50) s.xp = 0;
    if (up) { log(`${h.user}: ${C.skills[id]} — ур.${s.lv}`, '#c8e8ff'); say(h, `${C.skills[id]} ур.${s.lv}!`, 2.5); }
    return g;
  }
  // v6.49: глагол готовки по id блюда (CONFIG.recipeVerb), запасной — «Готовлю»
  const VERB_DEF = { me: 'Готовлю', he: 'готовит', pastM: 'приготовил', pastF: 'приготовила', inf: 'готовить' };
  function recipeVerb(r) { const v = (C.recipeVerb || {})[r && r.id]; return Object.assign({}, VERB_DEF, v || {}); }
  function heroFem(h) { return h && h.rpg_gender === 'female'; }
  const COOK_BUB = [[120, 0], [-120, 0], [0, -150]]; // разнос облачков поваров: справа, слева, над паром
  function finishCook(h, r, n) {
    n = Math.max(1, n || 1);
    for (let i = 0; i < n; i++) addSkillXp(h, r.kind === 'potion' ? 'alch' : 'cook', skAct(((r.tier || 1) - 1) * 3 + 1 + (r.lv > 1 && (r.tier || 1) <= 1 ? r.lv - 1 : 0)));
    const rt = ensureRT(h); rt.work = null; rt.out6 = null; rt.mode = 'garden'; rt.stayUntil = tm + 4;
    h.rpg_cooked += n; if (r.kind === 'potion') h.rpg_potionsBrewed += n;
    if (r.kind === 'potion') { h.rpg_bag[r.id] = (h.rpg_bag[r.id] || 0) + n; say(h, `${r.name}${n > 1 ? ' ×' + n : ''} в сумке!`, 3); }
    else { for (let i = 0; i < n; i++) h.rpg_dishes.push(r.id); applyDishes(h); say(h, `${r.name}${n > 1 ? ' ×' + n : ''}! Ням!`, 3); }
    fxIcon(CAULDRON.x, CAULDRON.y - 160, r.icon, 2, 70, 'garden');
    for (let i = 0; i < n; i++) questEvent('cook', { potion: r.kind === 'potion' }, h); if (r.kind !== 'potion') questEvent('cookDiff', { dish: r.id }, h); goalAdd('cook', n, h); checkAch(h);
    rt.bubbleOff = null; const vb = recipeVerb(r);
    if (n > 1) { const st = r.kind === 'potion' ? `в сумке ${h.rpg_bag[r.id] || 0}` : `в запасе ${h.rpg_dishes.filter(x => x === r.id).length}`; log(`${h.user}: готово ${n} × ${r.name} — ${r.text} (${st})`, '#c8f0a8'); }
    else log(`${h.user} ${heroFem(h) ? vb.pastF : vb.pastM} «${r.name}» — ${r.text}`, '#c8f0a8');
    h._rcd = h._rcd || {}; h._rcd[r.id] = Date.now() + 300000; // КД 5 мин на рецепт
    save(); refreshUI();
  }
  // еда применяется сама: свободный слот баффа (макс. C.maxActiveBuffs) → сразу, иначе ждёт в сумке
  function applyDishes(h) {
    while (h.rpg_dishes.length && h.rpg_buffs.length < C.maxActiveBuffs) {
      const id = h.rpg_dishes.shift(), r = recipeById(id); if (!r) continue;
      const same = h.rpg_buffs.find(b => b.id === id);
      if (same && BC_ON()) { h.rpg_dishes.unshift(id); break; } // v7panel24: бафф не копится — порция ждёт в запасе, пока текущий не закончится
      if (same) same.charges += r.charges; else h.rpg_buffs.push({ id, charges: r.charges });
    }
  }
  function useBuffCharge(h) { h.rpg_buffs.forEach(b => b.charges--); h.rpg_buffs = h.rpg_buffs.filter(b => b.charges > 0); applyDishes(h); }
  // зелья: само при низком HP (в бою) — лучшее лечебное, что есть
  function drinkPotion(h, reason) {
    const st = stats(h);
    const isBoss = BF && BF.all && BF.all[h.user];
    const ids = C.recipes.filter(r => r.kind === 'potion' && r.effect.heal && (h.rpg_bag[r.id] || 0) > 0 && (!r.effect.rage || isBoss)).sort((a, b) => a.effect.heal - b.effect.heal);
    const r = ids.find(x => h.rpg_hp + st.maxhp * x.effect.heal >= st.maxhp * 0.7) || ids[ids.length - 1];
    if (!r) return 0;
    h.rpg_bag[r.id]--; const hl = Math.round(st.maxhp * r.effect.heal); h.rpg_hp = Math.min(st.maxhp, h.rpg_hp + hl);
    if (r.effect.rage) h._rage = r.effect.rage;
    return hl;
  }

  // ===================== ЛИЧНЫЕ КВЕСТЫ (доска в городе) =====================
  const QUEST_BAN = /water|fertil/i; // v6.29: полив/удобрение в квестах не используем
  // v7panel33: встроенные квесты (если в config.js нет квеста с таким id — добавляем)
  const QUESTS_ADD = [{ id: 'cookdiff2', text: 'Приготовить 2 разных блюда', type: 'cookDiff', need: 2, gold: 30, xp: 15 }];
  const QUESTS = () => C.quests.concat(QUESTS_ADD.filter(a => !C.quests.some(q => q.id === a.id))).filter(q => !QUEST_BAN.test(q.id) && !QUEST_BAN.test(q.type));
  const questById = id => QUESTS().find(q => q.id === id);
  const offerCount = () => C.questOffers + Math.round(bEff('board', 'offers'));
  function offers(h) {
    if (h.rpg_quest && !questById(h.rpg_quest.id)) h.rpg_quest = null; // v6.29: старый квест на полив/удобрение снимаем
    h.rpg_offers = (h.rpg_offers || []).filter(questById);
    while (h.rpg_offers.length < offerCount()) {
      const free = QUESTS().filter(q => !h.rpg_offers.includes(q.id)); if (!free.length) break;
      h.rpg_offers.push(pick(free).id);
    }
    return h.rpg_offers;
  }
  function getQuestOffers(nick) { const h = getHero(nick, false); if (!h) return []; return offers(h).map((id, i) => ({ n: i + 1, id, text: questById(id).text, gold: questById(id).gold })); }
  function chooseQuest(nick, qid) {
    const h = getHero(nick, true); const of = offers(h);
    if (h.rpg_quest) return res(h, false, `уже есть задание: «${questById(h.rpg_quest.id).text}» ${h.rpg_quest.prog}/${questById(h.rpg_quest.id).need}`);
    if (qid === undefined || String(qid).trim() === '') return showQuestOffers(h); // v6.29: без номера — только показать, токен не тратится
    if (/^\d+$/.test(String(qid))) qid = of[+qid - 1];
    if (!of.includes(qid)) return res(h, false, `на доске для тебя: ${of.map((id, i) => `${i + 1}) ${questById(id).text}`).join('; ')}`);
    h.rpg_quest = { id: qid, prog: 0 }; ensureRT(h).qp = null;
    if (!blocked(h, 'town')) { const p = SPOT('town', 'board'); goDo(h, 'town', p.x + R(-60, 60), p.y, 'Беру задание!', C.townStaySeconds); }
    bump('town', 3);
    return res(h, true, `берёт задание: «${questById(qid).text}» (+${questById(qid).gold} золота)`, '#ffd27a');
  }
  const QP_SEC = 60;
  function showQuestOffers(h) {
    const of = offers(h), rt = ensureRT(h);
    if (!blocked(h, 'town')) { const p = SPOT('town', 'board'); goDo(h, 'town', p.x + R(-60, 60), p.y, 'Что тут есть?', Math.max(C.townStaySeconds || 0, QP_SEC)); }
    rt.qp = { until: Date.now() + QP_SEC * 1000, of: of.slice() };
    const list = of.map((id, i) => `${i + 1}) ${questById(id).text} (+${questById(id).gold})`).join('; ');
    log(`${h.user}: предложения на доске — ${list}. Выбор: !квест 1|2|3`, '#e8d9a8');
    bump('town', 2);
    return { ok: false, offers: of, msg: `на доске для тебя: ${list}. Напиши !квест 1, 2 или 3` };
  }
  function drawQuestPlaque(h) {
    const rt = ensureRT(h), q = rt.qp; if (!q) return;
    if (Date.now() > q.until || h.rpg_quest) { rt.qp = null; return; }
    const lines = q.of.map((id, i) => { const o = questById(id); return o ? `${i + 1}) ${o.text}  +${o.gold}💰` : ''; });
    setFont(22); const w = Math.max(300, ...lines.map(l => ctx.measureText(l).width)) + 36, hh = (48 + lines.length * 30) * UIS;
    const x = clamp(rt.x - w / 2, 10, W - w - 10), y = clamp(rt.y - HERO6_H - hh - 40, 10, H - hh - 10);
    panel(x, y, w, hh, '#f2e3bd');
    text(`${h.user}: !квест 1–${lines.length}  (${Math.ceil((q.until - Date.now()) / 1000)}с)`, x + 18, y + 24, 20, '#7a3a12', 'left', 0);
    lines.forEach((l, i) => text(l, x + 18, y + (56 + i * 30) * UIS, 22, '#3a2412', 'left', 0));
  }
  function abandonQuest(nick) {
    const h = getHero(nick, false); if (!h || !h.rpg_quest) return { ok: false };
    const t = h.rpg_reward || {}; // v49.6: отмена не тратит квест — сгорает только прогресс
    h.rpg_quest = null; h.rpg_offers = []; offers(h);
    return res(h, true, `бросает задание, прогресс сгорел (квестов осталось: ${t.quest || 0})`);
  }
  function takeWeekly(nick, idx) {
    const h = getHero(nick, true); if (!h) return { ok: false };
    const wq = C.weeklyQuests || []; if (!wq.length) return res(h, false, 'еженедельных заданий нет');
    const wk = weekKey();
    if (h.rpg_weekly && h.rpg_weekly.week === wk) return res(h, false, `уже есть еженедельное: «${(wq.find(x => x.id === h.rpg_weekly.id) || {}).text}» ${h.rpg_weekly.prog}/${(wq.find(x => x.id === h.rpg_weekly.id) || {}).need}`);
    if (!idx) { const list = wq.map((q, i) => `${i + 1}) ${q.text} (+${q.gold})`).join('; '); return res(h, false, `еженедельные: ${list}. Напиши !неделя 1`); }
    const q = wq[+idx - 1]; if (!q) return res(h, false, 'нет такого номера');
    h.rpg_weekly = { id: q.id, prog: 0, week: wk };
    return res(h, true, `берёт еженедельное: «${q.text}» (+${q.gold} золота)`, '#ffd27a');
  }
  function questEvent(type, data, h) {
    // обычный квест
    const q = h.rpg_quest;
    if (q) {
      const d = questById(q.id); if (d && d.type === type) {
        if (!(d.crop && data.crop !== d.crop) && !(d.monster && data.monster !== d.monster) && !(d.potion && !data.potion)) {
          let inc = true; if (type === 'cookDiff') { q.seen = q.seen || []; if (!data.dish || q.seen.includes(data.dish)) inc = false; else { q.seen.push(data.dish); q.prog = q.seen.length; } } // v7panel33: уникальные блюда за время квеста
          else q.prog += data.n || 1;
          if (inc && q.prog >= d.need) {
            const gold = Math.round(d.gold * (1 + bEff('board', 'questGold')));
            h.rpg_quest = null; h.rpg_questsDone++; h.rpg_gold += gold; gainXp(h, d.xp || 0);
            const noSeed = RARE_LOOT() && (d.type === 'plant' || d.type === 'harvest' || d.type === 'magic');
            if (d.seeds && !noSeed) { h.seeds += d.seeds; seedMark(h); emitBot({ event: 'vegDelta', reason: 'quest', user: h.user, txid: vtx(h, 'q'), gold: 0, goldTotal: h.rpg_gold || 0, delta: { seeds: d.seeds }, seeds: d.seeds }, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); } /* v46: обычные семена задания — тоже дельтой боту */ if (d.magicSeeds && !noSeed) { h.seedsPrem += d.magicSeeds; seedMark(h); emitBot({ event: 'vegDelta', reason: 'quest', user: h.user, txid: vtx(h, 'q'), gold: 0, goldTotal: h.rpg_gold || 0, delta: { seedsPrem: d.magicSeeds }, seedsPrem: d.magicSeeds }, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); }
            const m = addMats(h, 'quest');
            h.rpg_offers = []; offers(h);
            const rw = [`+${gold} золота`, `+${d.xp || 0} опыта`].concat(d.seeds && !noSeed ? [`+${d.seeds} семян`] : [], d.magicSeeds && !noSeed ? [`+${d.magicSeeds} волш. семян`] : [], m ? [m] : []).join(', ');
            log(`📜 ${DN(h)}: задание «${d.text}» выполнено! ${rw}`, '#ffd27a');
            h.rpg_qlog = (h.rpg_qlog || []).concat([{ text: d.text, rw, t: Date.now() }]).slice(-5);
            say(h, `Задание! +${gold}`, 3);
            { const rt = ensureRT(h); if (rt && rt.loc) { fxText(rt.x, rt.y - 230, '📜 Задание выполнено!', '#ffe27a', 40, 3.2, rt.loc); fxText(rt.x, rt.y - 185, rw, '#fff2c0', 28, 3.2, rt.loc); } }
            if (C.questDoneToBot) emitBot({ event: 'questDone', user: h.user, quest: d.text, gold, xp: d.xp || 0, text: `@${DN(h)}, задание «${d.text}» выполнено: ${rw}` });
          }
        }
      }
    }
    // еженедельный квест
    const wk = h.rpg_weekly;
    if (wk && wk.week === weekKey()) {
      const wd = (C.weeklyQuests || []).find(x => x.id === wk.id);
      if (wd && wd.type === type) {
        if (!(wd.crop && data.crop !== wd.crop) && !(wd.monster && data.monster !== wd.monster)) {
          wk.prog = (wk.prog || 0) + (data.n || 1);
          if (wk.prog >= wd.need) {
            const gold = wd.gold, xp = wd.xp || 0;
            h.rpg_weekly = null; h.rpg_gold += gold; gainXp(h, xp);
            const m = addMats(h, 'quest', wd.materials ? wd.materials / 30 : 1);
            log(`📅 ${DN(h)}: еженедельное «${wd.text}» выполнено! +${gold} золота, +${xp} опыта`, '#ffd27a');
            say(h, `Неделя! +${gold}`, 3); shWeeklyDrop(h, wd);
          }
        }
      }
    }
  }

  // ===================== ГИЛЬДИИ, НЕДЕЛЬНЫЕ ОЧКИ, ТРОФЕЙ =====================
  function weekKey() { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10); }
  function weekTick() { const k = weekKey(); if (S.weekKey !== k) { if (S.weekKey && typeof g9WeekEnd === 'function') g9WeekEnd(S.weekKey); S.weekKey = k; S.weekly = {}; } } // v9d: перед обнулением — гильдия недели
  function addGuildPoints(gid, n, h) { if (!gid) return; weekTick(); S.weekly[gid] = (S.weekly[gid] || 0) + n; S.guildScore[gid] = (S.guildScore[gid] || 0) + n; if (h) { if (h.rpg_wk !== S.weekKey) { h.rpg_wk = S.weekKey; h.rpg_wkPts = 0; } h.rpg_wkPts += n; } }
  const trophyActive = () => S.trophy && S.trophy.until > Date.now();
  const trophyBonus = h => (trophyActive() && h.rpg_guild === S.trophy.guild ? C.trophy.goldXpBonus : 0) + underdogBonus(h) + g9Medal(h); // v9: + медаль от ГМ
  function findGuild(id) { const s = lc(id); if (/^[1-9]$/.test(s)) return C.guilds[+s - 1] || null; return C.guilds.find(g => g.id === s || lc(g.name) === s || lc(g.name).startsWith(s) && s.length > 2) || null; }
  // --- баланс гильдий ---
  const GB = C.guildBalance || { maxOverPct: 1, minSlack: 99, underdogBonus: 0, autoAssign: false };
  // v49.8: для лимитов, автоназначения и бонуса слабой гильдии считаются только активные за guild.activeDays дней (по умолчанию 14). Никого не исключаем, очки не трогаем.
  const GACTD = () => { const v = (C.guild || {}).activeDays != null ? C.guild.activeDays : (C.guildBalance || {}).activeDays; return v == null ? 14 : Math.max(0, +v || 0); };
  const heroSeen = h => Math.max(+h.rpg_lastActive || 0, +h.rpg_lastRedeem || 0, +h.rpg_lastChat || 0, +h.rpg_lastGarden || 0) || +h.rpg_created || 0;
  const heroActive = h => { const d = GACTD(); return !d || Date.now() - heroSeen(h) <= d * 86400000; };
  function guildCounts(except, all) { const c = {}; C.guilds.forEach(g => c[g.id] = 0); S.order.forEach(n => { const h = S.heroes[n]; if (h && h.rpg_guild && c[h.rpg_guild] !== undefined && n !== except && (all || heroActive(h))) c[h.rpg_guild]++; }); return c; }
  const guildActTxt = (a, t) => GACTD() ? `активных ${a} из ${t}` : `${t}`;
  function guildCap(c) { const mn = Math.min(...Object.values(c)); return Math.max(Math.floor(mn * (1 + GB.maxOverPct)), mn + GB.minSlack); }
  // v6.33: лимит по «пятёркам» (guildJoinGroupSize): раунд r = floor(min/5)+1, в гильдию можно, пока в ней < 5*r.
  // Сам вступающий не считается (уходящий освобождает место); герои без гильдии не считаются.
  const GJ = () => Math.max(0, C.guildJoinGroupSize | 0);
  function guildLimit(c) { const g = GJ(); if (!g) return guildCap(c) + 1; const mn = Math.min(...Object.values(c)); return g * (Math.floor(mn / g) + 1); }
  const guildOpen = (gid, except) => { const c = guildCounts(except); return GJ() ? c[gid] < guildLimit(c) : c[gid] + 1 <= guildCap(c); };
  function guildJoinInfo(except) { const c = guildCounts(except), all = guildCounts(), lim = guildLimit(c); return C.guilds.map((g, i) => ({ id: g.id, name: g.name, n: i + 1, count: all[g.id], total: guildCounts(null, true)[g.id], limit: lim, // v6.55 п.7: показываем всех (как на экране); лимит/открытость — без самого игрока
       open: guildOpen(g.id, except) })); }
  function guildReply(h, r) { emitBot({ event: 'guildReply', user: h.user, ok: r.ok, text: `@${DN(h)} ${r.msg}` }); return r; }
  // v8.7: «на одного активного» — чтобы большая гильдия не выигрывала просто массой (CONFIG.guildBalance.perActive, по умолчанию вкл.)
  const PER_ON = () => GB.perActive !== false;
  function perActive(gid, v, cnt) { const c = cnt || guildCounts(); return PER_ON() ? v / Math.max(1, c[gid] || 0) : v; }
  function underdogGuilds() { // v8.7: слабая гильдия — по активу (очкам недели), а не по числу людей. CONFIG.guildBalance.underdogBy: 'points' (по умолчанию) | 'members'
    if (!GB.underdogBonus) return [];
    if (GB.underdogBy === 'members') { const c = guildCounts(), v = Object.values(c), mn = Math.min(...v), mx = Math.max(...v); if (mx - mn < GB.minSlack) return []; return C.guilds.filter(g => c[g.id] === mn); }
    weekTick(); const A = guildCounts(), live = C.guilds.filter(g => (A[g.id] || 0) > 0); if (live.length < 2) return [];
    const pts = g => perActive(g.id, +(S.weekly || {})[g.id] || 0, A), mx = Math.max(...live.map(pts)), mn = Math.min(...live.map(pts));
    if (Math.max(...live.map(g => +(S.weekly || {})[g.id] || 0)) < (GB.underdogMinPts || 100) || mn > mx * (GB.underdogRatio || 0.5)) return []; // отстаёт хотя бы вдвое от лидера
    return live.filter(g => pts(g) === mn); }
  const underdogBonus = h => h && h.rpg_guild && underdogGuilds().some(g => g.id === h.rpg_guild) ? GB.underdogBonus : 0;
  function autoGuild(h) { if (!GB.autoAssign || h.rpg_guild || h.rpg_g9Left) return; /* v9: вышедший по неактиву выбирает гильдию сам */ const c = guildCounts(h.user); const g = C.guilds.slice().sort((a, b) => c[a.id] - c[b.id])[0]; h.rpg_guild = g.id; h.rpg_guildJoined = now(); h.rpg_guildAuto = 1; }
  // v6.42: кулдаун смены гильдии в днях (guildSwitchCooldownDays, иначе старый guildSwitchCooldown в сек); первый выбор — без кулдауна
  const GSW = () => C.guildSwitchCooldownDays !== undefined ? +C.guildSwitchCooldownDays * 86400 : (C.guildSwitchCooldown || 0);
  const GSWD = () => +(GSW() / 86400).toFixed(1);
  // v6.42: подтверждение выбора гильдии — окно (HUD/мышь/OBS interact) или вторая команда !да (таймаут)
  const GCD = { confirm: true, chatTimeoutSec: 30 }, GCONF = new Proxy(GCD, { get: (t, k) => (C.guildConfirm && C.guildConfirm[k] !== undefined ? C.guildConfirm : t)[k] }); // читается вживую
  const GPEND = {}; let GMODAL = null;
  const gAskText = (g, h) => { const sj = h ? smallJoin(h, g) : { gold: 0 }; return `Точно вступаешь в гильдию «${g.name}»?${sj.gold ? ` Это самая маленькая гильдия — получишь +${sj.gold} золота.` : ''} Следующая смена гильдии будет доступна через ${GSWD()} дней`; }; // v8.7
  function guildAsk(nick, id, ui) {
    const r = joinGuild(nick, id, { check: true }); if (!r.ok || !r.g) return r;
    const h = getHero(nick, true), g = r.g;
    GPEND[h.user] = { g: g.id, t: Date.now(), ui: !!ui };
    if (ui) guildModal(h.user, g);
    return guildReply(h, res(h, true, ui ? gAskText(g, h) : `${gAskText(g, h)}. Напиши !да в течение ${GCONF.chatTimeoutSec} с, чтобы подтвердить`));
  }
  function guildConfirm(nick, yes) {
    const h = S.heroes[findNick(nick)]; if (!h) return { ok: false, msg: 'нет героя' };
    const p = GPEND[h.user]; delete GPEND[h.user]; if (GMODAL && GMODAL.user === h.user) guildModalClose();
    if (!p) return { ok: false, msg: 'нечего подтверждать' };
    if (!yes) return guildReply(h, res(h, false, 'выбор гильдии отменён'));
    if (Date.now() - p.t > GCONF.chatTimeoutSec * 1000 && !p.ui) return guildReply(h, res(h, false, `подтверждение просрочено (${GCONF.chatTimeoutSec} с) — выбери гильдию заново`));
    return joinGuild(h.user, p.g);
  }
  function guildModal(user, g) {
    guildModalClose(); let el = document.getElementById('guildConfirm');
    if (!el) { el = document.createElement('div'); el.id = 'guildConfirm'; document.body.appendChild(el); }
    el.innerHTML = `<div class="gc-box"><div class="gc-t">${esc(gAskText(g, S.heroes[user]))}</div><div class="gc-b"><button data-gc="1">Да</button><button data-gc="0">Отмена</button></div></div>`;
    el.style.display = 'flex'; GMODAL = { user, g: g.id };
    el.onclick = e => { const b = e.target.closest('button'); if (b) { guildConfirm(user, b.dataset.gc === '1'); renderHUD(true); } };
  }
  function guildModalClose() { const el = document.getElementById('guildConfirm'); if (el) el.style.display = 'none'; GMODAL = null; }
  // v8.7: «маленькая» гильдия — меньше всех активных (без учёта самого героя) и меньше самой большой. Награда раз в smallJoinDays дней (по умолчанию 30)
  function guildSmall(gid, except) { // маленькая = меньше всех активных ИЛИ слабая по очкам на игрока
    const c = guildCounts(except), v = C.guilds.map(x => c[x.id] || 0), mn = Math.min(...v), mx = Math.max(...v);
    return ((c[gid] || 0) === mn && mn < mx) || underdogGuilds().some(x => x.id === gid); }
  function smallJoin(h, g) {
    const small = !!g && guildSmall(g.id, h.user);
    const days = GB.smallJoinDays == null ? 30 : +GB.smallJoinDays, gold = GB.smallJoinGold == null ? 200 : +GB.smallJoinGold;
    const ok = small && gold > 0 && !(h.rpg_smallJoinAt && Date.now() - h.rpg_smallJoinAt < days * 864e5);
    return { small, gold: ok ? gold : 0 };
  }
  function joinGuild(nick, id, opt) {
    opt = opt || {};
    const h = getHero(nick, true), g = findGuild(id);
    const open = () => C.guilds.map((x, i) => [x, i]).filter(([x]) => x.id !== h.rpg_guild && guildOpen(x.id, h.user)).map(([x, i]) => { const c = guildCounts(h.user), all = guildCounts(); return GJ() ? `${i + 1}) ${x.name} (${all[x.id]}/${guildLimit(c)}${GACTD() ? ' акт.' : ''})` : `${i + 1}) ${x.name}`; }).join(', ') || 'нет';
    if (!g) return guildReply(h, res(h, false, 'гильдии: ' + guildJoinInfo(h.user).map(x => GJ() ? `${x.n}) ${x.name} ${x.count}/${x.limit}${GACTD() ? ` (${guildActTxt(x.count, x.total)})` : ''}${x.open ? '' : ' (мест нет)'}` : `${x.n}) ${x.name}`).join(', ') + ' · открыты: ' + open()));
    if (h.rpg_guild === g.id) return guildReply(h, res(h, false, `уже в гильдии «${g.name}»`));
    const SJ = smallJoin(h, g); // v8.7: вступление в самую маленькую гильдию — без отката и с наградой
    const left = h.rpg_guild && !h.rpg_guildAuto && !(SJ.small && GB.smallJoinFree !== false) ? h.rpg_guildJoined + GSW() - now() : 0;
    if (left > 0) { const when = new Date((now() + left) * 1000); return guildReply(h, res(h, false, `сменить гильдию пока нельзя: ты в «${(findGuild(h.rpg_guild) || {}).name || h.rpg_guild}» с ${new Date(h.rpg_guildJoined * 1000).toLocaleDateString('ru-RU')}, смена раз в ${GSWD()} ${plural(GSWD(), 'день', 'дня', 'дней')} — можно через ${fmtTime(left)} (${when.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})`)); }
    if (!guildOpen(g.id, h.user)) { const inf = guildJoinInfo(h.user).find(x => x.id === g.id); return guildReply(h, res(h, false, GJ() ? `в «${g.name}» уже ${inf.count} из ${inf.limit}${GACTD() ? ` активных (всего ${inf.total})` : ''} — вступить нельзя, пока остальные гильдии не наберут по ${inf.limit - GJ() || GJ()}+. Открыты: ${open()}` : `«${g.name}» переполнена (баланс гильдий). Открыты: ${open()}`)); }
    if (opt.check) return { ok: true, g };
    if (h.rpg_guild && GB.resetWeeklyOnSwitch) { weekTick(); if (h.rpg_wk === S.weekKey && h.rpg_wkPts) S.weekly[h.rpg_guild] = Math.max(0, (S.weekly[h.rpg_guild] || 0) - h.rpg_wkPts); h.rpg_wkPts = 0; h.rpg_wk = S.weekKey; }
    h.rpg_guild = g.id; h.rpg_guildJoined = now(); delete h.rpg_guildAuto;
    let sjTxt = ''; if (SJ.gold) { h.rpg_gold += SJ.gold; h.rpg_smallJoinAt = Date.now(); sjTxt = ` — спасибо, что усилил маленькую гильдию: +${SJ.gold} золота`; log(`${DN(h)} вступает в маленькую гильдию «${g.name}»: +${SJ.gold} золота`, g.color); save(); }
    if (!blocked(h, 'town')) { const p = SPOT('town', 'guild'); goDo(h, 'town', p.x + R(-60, 60), p.y, `За «${g.name}»!`, C.townStaySeconds); }
    bump('town', 3);
    return guildReply(h, res(h, true, `теперь в гильдии «${g.name}»${sjTxt}${underdogBonus(h) ? ` (+${Math.round(GB.underdogBonus * 100)}% золота/опыта — слабая гильдия)` : ''}`, g.color));
  }

  // ===================== v9: МЕХАНИКИ ГИЛЬДИЙ — гильд-мастер, казна и баффы, гильд-походы =====================
  // Всё включается флагом CONFIG.guildsV9.enabled (по умолчанию ВЫКЛ). Состояние — S.g9.
  // ГМ: выборы раз в неделю (стримы пн–пт). Голоса за неделю → итоги в начале первого стрима новой недели (понедельник).
  //   Первые выборы — первые gm.firstMin минут стрима после включения. Нет 2 голосов за одного — остаётся прошлый ГМ.
  //   !гм уйти — уйти с поста: место у следующего по голосам этих выборов (2+), иначе до понедельника без ГМ; ушедший в эту неделю ГМ не становится.
  //   Награда и бафф — один раз в неделю на ГИЛЬДИЮ (смена ГМ не даёт второго раза). Медаль одному игроку — не чаще раза в gm.medalEveryDays.
  // Гильд-поход: сбор hike.waitSec (10 мин), 2–5 игроков своей гильдии, 1 раз за стрим на игрока; 5 волн + мини-босс со своей механикой;
  //   !цель — 10 с бить «цель» мини-босса (волков / тотем / каменную кожу) с уроном ×1.5; без кнопок герои бьют цель сами, но медленнее.
  const G9DEF = { enabled: false,
    gm: { enabled: true, minVotes: 2, firstMin: 30, rewardGold: 150, medalPct: 0.05, medalDays: 3, medalEveryDays: 14 },
    bank: { enabled: true, minDeposit: 10, maxPerWeek: 1000, days: 7, sizeNorm: 6, noGmMin: 200,
      buffs: [ { id: 'gold', name: 'Знамя богатства', icon: 'buff_gold', price: 1500, gold: 0.15, txt: '+15% золота в походах' },
               { id: 'xp', name: 'Знамя мудрости', icon: 'buff_xp', price: 1500, xp: 0.15, txt: '+15% опыта' },
               { id: 'hp', name: 'Знамя стойкости', icon: 'buff_hp', price: 1200, hp: 0.10, txt: '+10% здоровья' },
               { id: 'dmg', name: 'Знамя ярости', icon: 'buff_dmg', price: 2000, atk: 0.08, txt: '+8% урона' } ] },
    hike: { enabled: true, waves: 5, min: 3, max: 5, waitSec: 600, mobHpPer: 0.9, mobAtk: 1.15, waveUp: 0.05, waveHeal: 0.25, reward: 2.0, guildPts: 3, chest: 'silver',
      boss: { hp: 1.8, atk: 1.05, gear: 0, gearMax: 1.5 }, minDmg: 0.4, autoShare: 0.35, autoDelay: 8, focusSec: 10, focusCd: 20, focusMul: 1.5,
      bosses: [ { id: 'guild_wolf_alpha', name: 'Вожак стаи', hp: 72, atk: 14, def: 3, xp: 120, gold: 60, h: 330, mech: 'pack' },
                { id: 'guild_goblin_chief', name: 'Гоблин-вождь', hp: 70, atk: 17, def: 2, xp: 120, gold: 60, h: 320, mech: 'totem' },
                { id: 'guild_moss_golem', name: 'Мшистый голем', hp: 100, atk: 13, def: 5, xp: 120, gold: 60, h: 350, mech: 'skin' } ] },
    week: { enabled: true, chest: 'silver', smithOff: 0.10, minPts: 100 }, // победитель недели (по очкам на активного): сундук каждому + скидка в кузнице на неделю
    inactiveKickDays: 30 };
  const G9 = () => { const c = C.guildsV9 || {}; return Object.assign({}, G9DEF, c, { gm: Object.assign({}, G9DEF.gm, c.gm || {}), bank: Object.assign({}, G9DEF.bank, c.bank || {}), week: Object.assign({}, G9DEF.week, c.week || {}), hike: Object.assign({}, G9DEF.hike, c.hike || {}, { boss: Object.assign({}, G9DEF.hike.boss, (c.hike || {}).boss || {}) }) }); };
  const G9ON = () => !!(C.guildsV9 && C.guildsV9.enabled === true);
  function g9S() { const s = S.g9 = S.g9 || {}; ['votes', 'gm', 'last', 'resigned', 'bank', 'buff', 'buffWk', 'gmRew', 'dep'].forEach(k => { s[k] = s[k] || {}; }); return s; }
  const g9Name = gid => (guildById(gid) || {}).name || gid;
  const g9Col = gid => (guildById(gid) || {}).color || '#ffd27a';
  const g9Off = () => ({ ok: false, msg: 'механики гильдий пока выключены' });
  const g9Ok = (u, gid) => { const h = S.heroes[u]; return !!(h && h.rpg_guild === gid && heroActive(h)); };
  function g9Me(nick) { const h = getHero(nick, false); if (!h) return { e: { ok: false, msg: 'нет героя' } }; if (!h.rpg_guild) return { e: res(h, false, 'сначала вступи в гильдию: !гильдия') }; return { h, gid: h.rpg_guild }; }
  // ---- гильд-мастер: выборы раз в неделю ----
  function g9Count(gid) { // голоса текущих выборов: [[кандидат, голосов], …] по убыванию
    const V = g9S().votes[gid] || {}, cnt = {}, wk = h => (h && h.rpg_wk === S.weekKey ? +h.rpg_wkPts || 0 : 0);
    for (const [voter, cand] of Object.entries(V)) if (g9Ok(voter, gid) && g9Ok(cand, gid)) cnt[cand] = (cnt[cand] || 0) + 1;
    return Object.entries(cnt).sort((a, b) => b[1] - a[1] || wk(S.heroes[b[0]]) - wk(S.heroes[a[0]]) || (a[0] < b[0] ? -1 : 1));
  }
  function g9Gm(gid) { const g = g9S().gm[gid]; return g && g9Ok(g.user, gid) ? g : null; }
  function g9Tally(why) { // итоги выборов во всех гильдиях
    const s = g9S(), P = G9().gm;
    C.guilds.forEach(g => { const L = g9Count(g.id), prev = g9Gm(g.id), win = L.find(([u, n]) => n >= P.minVotes);
      let nx = null;
      if (win) nx = { user: win[0], votes: win[1], from: 'vote' };
      else if (prev) nx = { user: prev.user, votes: 0, from: 'stay' };
      else if (L.length) nx = { user: L[0][0], votes: L[0][1], from: 'vote' }; // прошлого ГМ нет — у кого больше голосов, даже 1
      s.last[g.id] = L; s.votes[g.id] = {};
      if (nx) { nx.wk = weekKey(); nx.at = Date.now(); s.gm[g.id] = nx; if (!prev || prev.user !== nx.user || nx.from === 'vote') { log(`👑 Гильд-мастер «${g.name}» на неделю — ${DN(S.heroes[nx.user])}${nx.from === 'stay' ? ' (остаётся: за другого не набралось 2 голоса)' : ` (${nx.votes} гол.)`}`, g.color); if (nx.from === 'vote') fame('gm', `${DN(S.heroes[nx.user])} — гильд-мастер «${g.name}»`); } }
      else delete s.gm[g.id];
    });
    s.resigned = {}; s.elect = { wk: weekKey(), at: Date.now(), why: why || '' }; save(); publishSnapSoon();
  }
  function g9ElectTick() { // неделя сменилась → итоги; первые выборы — firstMin минут после включения
    const s = g9S(), P = G9().gm; if (!P.enabled) return;
    if (!s.elect) { s.elect = { wk: weekKey(), first: Date.now() + P.firstMin * 60000 }; log(`👑 Открыты первые выборы гильд-мастеров — ${P.firstMin} мин: !голос <ник>`, '#ffd27a'); save(); return; }
    if (s.elect.first && Date.now() >= s.elect.first) return g9Tally('первые выборы');
    if (!s.elect.first && s.elect.wk !== weekKey()) g9Tally('новая неделя');
  }
  const g9ElectInfo = () => { const e = g9S().elect || {}; return e.first ? `итоги в ${new Date(e.first).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'итоги в понедельник'; };
  function g9VoteCmd(nick, a) {
    if (!G9ON() || !G9().gm.enabled) return g9Off(); const { h, gid, e } = g9Me(nick); if (e) return e;
    const s = g9S(), P = G9().gm, q = String(a || '').trim().replace(/^@/, '');
    if (!q) { const gm = g9Gm(gid), L = g9Count(gid), my = (s.votes[gid] || {})[h.user];
      return res(h, true, `гильд-мастер «${g9Name(gid)}»: ${gm ? DN(S.heroes[gm.user]) : 'нет'} · выборы на следующую неделю (${g9ElectInfo()}): ${L.length ? L.slice(0, 3).map(([u, n]) => `${DN(S.heroes[u])} ${n}`).join(', ') : 'голосов пока нет'} · твой голос: ${my && S.heroes[my] ? DN(S.heroes[my]) : 'нет'} — !голос <ник>${gm && gm.user === h.user ? ' · уйти с поста: !гм уйти' : ''}`); }
    if (/^(снять|отозвать|нет|отмена)$/i.test(q)) { if (s.votes[gid]) delete s.votes[gid][h.user]; save(); publishSnapSoon(); return res(h, true, 'голос отозван'); }
    const t = findNick(q), ht = t && S.heroes[t]; if (!ht) return res(h, false, `нет героя «${q}»`);
    if (ht.rpg_guild !== gid) return res(h, false, `${DN(ht)} не в твоей гильдии`);
    if (ht.user === h.user) return res(h, false, 'за себя голосовать нельзя');
    (s.votes[gid] = s.votes[gid] || {})[h.user] = ht.user; save(); publishSnapSoon();
    const L = g9Count(gid), mine = (L.find(([u]) => u === ht.user) || [0, 0])[1];
    return res(h, true, `голос за ${DN(ht)} принят (у него ${mine} гол.) — ${g9ElectInfo()}; до итогов голос можно поменять`);
  }
  function g9ResignCmd(nick) {
    if (!G9ON() || !G9().gm.enabled) return g9Off(); const { h, gid, e } = g9Me(nick); if (e) return e;
    const s = g9S(), gm = g9Gm(gid), P = G9().gm; if (!gm || gm.user !== h.user) return res(h, false, 'ты не гильд-мастер');
    const rs = s.resigned[gid] = s.resigned[gid] || []; rs.push(h.user);
    const nx = (s.last[gid] || []).find(([u, n]) => n >= P.minVotes && !rs.includes(u) && g9Ok(u, gid));
    if (nx) s.gm[gid] = { user: nx[0], votes: nx[1], from: 'next', wk: weekKey(), at: Date.now() }; else delete s.gm[gid];
    log(`👑 ${DN(h)} уходит с поста гильд-мастера «${g9Name(gid)}»${nx ? ` — теперь ГМ ${DN(S.heroes[nx[0]])}` : ' — до понедельника без ГМ'}`, g9Col(gid));
    save(); refreshUI(); publishSnapSoon();
    return res(h, true, `ты больше не гильд-мастер${nx ? `; ГМ — ${DN(S.heroes[nx[0]])}` : ''}. Награда и бафф этой недели остаются как есть`);
  }
  const g9Medal = h => (G9ON() && h && +h.rpg_medalUntil > Date.now() ? G9().gm.medalPct : 0);
  function g9RewardCmd(nick, a) {
    if (!G9ON() || !G9().gm.enabled) return g9Off(); const { h, gid, e } = g9Me(nick); if (e) return e;
    const P = G9().gm, s = g9S(), wk = weekKey(), gm = g9Gm(gid);
    if (!gm || gm.user !== h.user) return res(h, false, 'наградить может только гильд-мастер');
    if (s.gmRew[gid] === wk) return res(h, false, 'награда гильдии на этой неделе уже выдана — следующая с понедельника');
    const q = String(a || '').trim().replace(/^@/, ''); if (!q) return res(h, false, `кого наградить? !наградить <ник> — +${P.rewardGold} золота и медаль (+${Math.round(P.medalPct * 100)}% золота и опыта на ${P.medalDays} дн.)`);
    const t = findNick(q), ht = t && S.heroes[t]; if (!ht) return res(h, false, `нет героя «${q}»`);
    if (ht.rpg_guild !== gid) return res(h, false, `${DN(ht)} не в твоей гильдии`);
    if (ht.user === h.user) return res(h, false, 'себя наградить нельзя');
    if (+ht.rpg_medalAt && Date.now() - ht.rpg_medalAt < P.medalEveryDays * 864e5) return res(h, false, `${DN(ht)} уже получал медаль — снова можно с ${new Date(ht.rpg_medalAt + P.medalEveryDays * 864e5).toLocaleDateString('ru-RU')}`);
    ht.rpg_gold += P.rewardGold; ht.rpg_medalAt = Date.now(); ht.rpg_medalUntil = Date.now() + P.medalDays * 864e5; s.gmRew[gid] = wk;
    log(`🏅 Гильд-мастер ${DN(h)} награждает ${DN(ht)}: +${P.rewardGold} золота и медаль гильдии`, g9Col(gid)); fame('medal', `${DN(ht)} — медаль гильдии «${g9Name(gid)}» от ${DN(h)}`);
    const rt = ensureRT(ht); fxText(rt.x, rt.y - heroH(rt) - 60, '🏅 Медаль!', '#ffd27a', 30, 2.2, rt.loc);
    save(); refreshUI(); publishSnapSoon();
    return res(h, true, `${DN(ht)} получает +${P.rewardGold} золота и медаль гильдии`);
  }
  // ---- казна и баффы ----
  function g9Buff(gid) { const b = g9S().buff[gid]; if (!b || b.until <= Date.now()) return null; const d = G9().bank.buffs.find(x => x.id === b.id); return d ? Object.assign({ until: b.until }, d) : null; }
  const g9Eff = (h, k) => { if (!G9ON() || !h || !h.rpg_guild) return 0; const b = g9Buff(h.rpg_guild); return b && b[k] ? +b[k] : 0; };
  function g9Price(gid, b) { const P = G9().bank, n = Math.max(1, guildCounts()[gid] || 0); return Math.max(100, Math.round(b.price * Math.max(0.5, n / (P.sizeNorm || 6)) / 50) * 50); }
  const g9Dep = (s, u) => { const wk = weekKey(), d = s.dep[u]; return d && d.wk === wk ? d : { wk, amt: 0 }; };
  function g9BankCmd(nick, a) {
    if (!G9ON() || !G9().bank.enabled) return g9Off(); const { h, gid, e } = g9Me(nick); if (e) return e;
    const P = G9().bank, s = g9S(), bal = +s.bank[gid] || 0, q = String(a || '').trim();
    if (!q) { const cur = g9Buff(gid);
      return res(h, true, `казна «${g9Name(gid)}»: ${bal} з${cur ? ` · действует ${cur.name} (${cur.txt}) до ${new Date(cur.until).toLocaleDateString('ru-RU')}` : ''} · баффы на ${P.days} дн. (один в неделю): ${P.buffs.map((b, i) => `${i + 1}) ${b.name} ${b.txt} — ${g9Price(gid, b)} з`).join('; ')} · внести: !казна <сумма> (до ${P.maxPerWeek} з в неделю, золото остаётся гильдии)`); }
    const n = Math.floor(+q.replace(/[^\d]/g, '') || 0); if (!(n >= P.minDeposit)) return res(h, false, `в казну — от ${P.minDeposit} золота: !казна <сумма>`);
    const d = g9Dep(s, h.user), left = P.maxPerWeek - d.amt; if (left <= 0) return res(h, false, `лимит — ${P.maxPerWeek} золота в казну за неделю`);
    const put = Math.min(n, left, Math.floor(h.rpg_gold)); if (put < P.minDeposit) return res(h, false, `не хватает золота: у тебя ${Math.floor(h.rpg_gold)} з`);
    h.rpg_gold -= put; d.amt += put; d.gid = gid; s.dep[h.user] = d; s.bank[gid] = bal + put;
    log(`💰 ${DN(h)} вносит в казну «${g9Name(gid)}» ${put} з (в казне ${s.bank[gid]} з)`, g9Col(gid));
    save(); refreshUI(); publishSnapSoon();
    return res(h, true, `+${put} з в казну «${g9Name(gid)}» — в казне ${s.bank[gid]} з${put < n ? ` (лимит ${P.maxPerWeek} з в неделю)` : ''}`);
  }
  function g9CanBuy(h, gid) { const gm = g9Gm(gid); if (gm) return gm.user === h.user; return g9Dep(g9S(), h.user).amt >= G9().bank.noGmMin; }
  function g9BuffCmd(nick, a) {
    if (!G9ON() || !G9().bank.enabled) return g9Off(); const { h, gid, e } = g9Me(nick); if (e) return e;
    const P = G9().bank, s = g9S(), q = String(a || '').trim(); if (!q) return g9BankCmd(nick, '');
    const i = Math.floor(+q) - 1, b = P.buffs[i] || P.buffs.find(x => lc(x.name).includes(lc(q)) || x.id === lc(q)); if (!b) return res(h, false, 'нет такого баффа — список: !казна');
    if (!g9CanBuy(h, gid)) return res(h, false, g9Gm(gid) ? 'бафф выбирает гильд-мастер' : `ГМ нет — бафф может купить тот, кто внёс в казну на этой неделе ${P.noGmMin}+ з`);
    if (s.buffWk[gid] === weekKey()) return res(h, false, 'бафф гильдии на этой неделе уже куплен — следующий с понедельника');
    const cur = g9Buff(gid); if (cur) return res(h, false, `ещё действует ${cur.name} — до ${new Date(cur.until).toLocaleDateString('ru-RU')}`);
    const price = g9Price(gid, b), bal = +s.bank[gid] || 0; if (bal < price) return res(h, false, `в казне ${bal} з, нужно ${price} з — !казна <сумма>`);
    s.bank[gid] = bal - price; s.buff[gid] = { id: b.id, until: Date.now() + P.days * 864e5, by: h.user }; s.buffWk[gid] = weekKey();
    log(`🚩 «${g9Name(gid)}» поднимает ${b.name}: ${b.txt} на ${P.days} дн. (−${price} з из казны)`, g9Col(gid)); fame('buff', `«${g9Name(gid)}»: ${b.name} (${b.txt})`);
    save(); refreshUI(); publishSnapSoon();
    return res(h, true, `${b.name} поднято: ${b.txt} всей гильдии на ${P.days} дн.`);
  }
  // ---- гильд-поход ----
  const G9Q = {};
  const g9Went = h => !!(h && h.rpg_g9Hike && h.rpg_g9Hike === streamCur().id); // уже ходил в гильд-поход на этом стриме
  function g9HikeCmd(nick) {
    if (!G9ON() || !G9().hike.enabled) return g9Off(); const { h, gid, e } = g9Me(nick); if (e) return e;
    const P = G9().hike; if (g9Went(h)) return res(h, false, 'в гильд-поход можно один раз за стрим — ты уже ходил');
    const why = hikeBusy(h); if (why && why !== 'cooldown') return res(h, false, why === 'dead' ? 'ещё возвращается в лагерь' : why === 'queued' ? 'ты в очереди похода' : 'ты уже в походе');
    if (PARTYQ.users.includes(h.user)) return res(h, false, 'ты в очереди пати');
    const bl = blocked(h, 'expedition'); if (bl) return res(h, false, bl);
    const q = G9Q[gid] = G9Q[gid] || { users: [], t0: 0 }; if (q.users.includes(h.user)) return res(h, false, `ты уже в отряде гильд-похода (${q.users.length}/${P.max})`);
    if (!q.users.length) { q.t0 = Date.now(); emitBot({ event: 'g9Hike', user: h.user, text: `⚔ «${g9Name(gid)}» собирает гильд-поход: ${P.waves} волн и мини-босс! Сбор ${Math.round(P.waitSec / 60)} мин — !гильдпоход` }); }
    q.users.push(h.user); say(h, `Гильд-поход ${q.users.length}/${P.max}`);
    const left = Math.max(0, Math.ceil((q.t0 + P.waitSec * 1000 - Date.now()) / 60000));
    log(`⚔ ${DN(h)} в отряде гильд-похода «${g9Name(gid)}»: ${q.users.length}/${P.max}, сбор ещё ${left} мин`, g9Col(gid));
    if (q.users.length >= P.max) g9HikeGo(gid);
    publishSnapSoon();
    return res(h, true, `ты в гильд-походе «${g9Name(gid)}» (${q.users.length}/${P.max}) — старт при ${P.max} или через ${left} мин, если соберётся ${P.min}+`);
  }
  function g9HikeTick() {
    const P = G9().hike;
    for (const gid of Object.keys(G9Q)) { const q = G9Q[gid]; q.users = q.users.filter(u => S.heroes[u] && S.heroes[u].rpg_guild === gid);
      if (!q.users.length) { delete G9Q[gid]; continue; }
      const waited = Date.now() - q.t0 >= P.waitSec * 1000;
      if (q.users.length >= P.max || (waited && q.users.length >= P.min)) g9HikeGo(gid);
      else if (waited) { log(`⚔ Гильд-поход «${g9Name(gid)}» не собрался (${q.users.length}/${P.min}) — попытка не потрачена`, '#bfe0ff'); delete G9Q[gid]; publishSnapSoon(); } }
  }
  function g9HikeGo(gid) {
    const P = G9().hike, q = G9Q[gid]; if (!q) return; const lane = freeLane(); if (lane === undefined) return; // ждём свободную тропу
    const RK = { paladin: 0, warrior: 1, archer: 2, assassin: 2, mage: 3, priest: 4 };
    const us = q.users.splice(0, P.max).filter(u => S.heroes[u]).sort((a, b) => (RK[S.heroes[a].rpg_class] ?? 2) - (RK[S.heroes[b].rpg_class] ?? 2)); delete G9Q[gid];
    if (us.length < P.min) return;
    const PX = C.party || {}, minX = +PX.minX || 780, gap = +PX.gap || 225, n = us.length;
    const party = { id: Date.now(), users: us.slice(), mobHp: 1, mobAtk: P.mobAtk, reward: P.reward, g9: gid };
    party.G = { id: party.id, lane, users: us.slice(), bs: [], turn: 0, phase: 'walk', mon: null, wave: 0, timer: 0, waves: P.waves, g9: gid,
      P: Object.assign({}, PTY(), { mobHpPer: P.mobHpPer, mobAtk: P.mobAtk, mobAtk2: P.mobAtk }), monX: Math.max(PMON_X(lane), minX + gap * (n - 1) + (lane % 2 ? Math.round(gap / 2) : 0) + 170) };
    let slot = 0; const sid = streamCur().id; const went = us.filter(u => { const r = sendToExpedition(u, party, slot++); if (r && r.ok) { S.heroes[u].rpg_g9Hike = sid; return true; } return false; });
    log(`⚔ Гильд-поход «${g9Name(gid)}»: ${went.map(u => DN(S.heroes[u])).join(', ')} — ${P.waves} волн и мини-босс!`, g9Col(gid));
    save(); refreshUI(); publishSnapSoon();
  }
  function g9BossDef() { const P = G9().hike, L0 = P.only ? P.bosses.filter(b => b.id.includes(P.only)) : [], L = L0.length ? L0 : P.bosses; return Object.assign({ weight: 1, minLevel: 1, g9boss: true }, L[Math.floor(Math.random() * L.length)]); }
  function g9Finish(b, h) { const P = G9().hike, gid = b.party && b.party.g9; if (!gid || h.rpg_guild !== gid) return;
    addGuildPoints(gid, (C.guildPointsPerExpedition || 1) * Math.max(0, P.guildPts - 1), h);
    if (P.chest && C.chests[P.chest]) { const rt = ensureRT(h); giveChest(h, P.chest, 'Гильд-поход', { x: rt.x, y: rt.y, loc: 'forest' }); } }
  // ---- механики мини-боссов (вызывается после каждого хода боя гильд-похода) ----
  // «Цель» (волки / тотем / каменная кожа): часть урона героев уходит в неё сама (autoShare), герой с !цель бьёт только её ×focusMul.
  function g9Focus(h) { return +h._g9focus > Date.now(); }
  function g9FocusCmd(nick) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    const b = BATTLES.find(x => x.user === h.user && x.G && x.G.g9), M = b && b.G.mech;
    if (!M || !M.sub) return res(h, false, 'сейчас нет цели — кнопка работает против мини-босса гильд-похода');
    const P = G9().hike; if (+h._g9fcd > Date.now()) return res(h, false, `«Цель» снова через ${Math.ceil((h._g9fcd - Date.now()) / 1000)} с`);
    h._g9focus = Date.now() + P.focusSec * 1000; h._g9fcd = Date.now() + P.focusCd * 1000;
    const rt = ensureRT(h); fxText(rt.x, rt.y - heroH(rt) - 40, `🎯 ${M.sub.name}!`, '#ffd27a', 26, 1.6, 'forest');
    return res(h, true, `${P.focusSec} с бьёшь «${M.sub.name}» (урон ×${P.focusMul})`);
  }
  // ---- v9c: рост атаки за уровень по классам и потолок брони ----
  function g9Grow(id) { const g = C.classGrowth || { warrior: 2.5, assassin: 2.5, mage: 2.5, archer: 2.3, paladin: 1.8, priest: 1.5 }; return g[id] != null ? +g[id] : 2; }
  function g9MinDmg() { return C.armorMinDmg != null ? +C.armorMinDmg : 0.4; }
  function g9Mech(G, m, ms, ev, bs) {
    if (!G.g9 || !m.d || !m.d.g9boss) return; const P = G9().hike, M = G.mech = G.mech || { t: 0, mech: m.d.mech }; M.t += 0.8;
    const say9 = (t, c) => { fxText(m.x, m.y - (m.d.h || 300) * persp(m.y) - 70, t, c || '#ffd27a', 32, 1.8, 'forest'); clog(`${m.d.name}: ${t}`, c || '#ffb08a'); };
    const H = u => S.heroes[u], alive = () => ms.filter(x => x.hp > 0);
    const hurt = (x, d, why) => { d = Math.max(1, Math.round(d)); x.hp -= d; ev.push({ t: 'hurt', to: x.id, dmg: d, sh: 0, why }); if (x.hp <= 0) { x.hp = 0; ev.push({ t: 'dead', to: x.id }); } };
    // 1) урон героев → часть в «цель»
    if (M.sub && M.sub.hp > 0) { let back = 0;
      for (const e of ev) { if (e.t !== 'hit') continue; const hh = H(e.from), f = hh && g9Focus(hh), share = f ? 1 : (M.mech === 'skin' ? 0.7 : (M.t - (M.sub.t0 || 0) >= P.autoDelay ? P.autoShare : 0)), part = Math.round(e.dmg * share); if (!part) continue;
        back += part; M.sub.hp -= Math.round(part * (f ? P.focusMul : 1)); if (M.sub.hp <= 0) break; }
      if (back) { const was = m.hp; m.hp = Math.min(m.maxhp, m.hp + back); if (was <= 0 && m.hp > 0) for (let i = ev.length - 1; i >= 0; i--) if (ev[i].t === 'kill') ev.splice(i, 1); }
      if (M.sub.hp <= 0) { M.sub.hp = 0; say9(M.mech === 'pack' ? 'Волки повержены!' : M.mech === 'totem' ? 'Тотем разбит!' : 'Кожа треснула!', '#c8f0a8'); M.sub = null; M.cd = M.t; }
    }
    if (m.hp <= 0) return;
    // 2) механика босса
    if (M.mech === 'pack') { // Зов стаи: волки бьют самого слабого; при 50% — бешенство
      if (!M.sub && M.t - (M.cd ?? -99) >= 15) { M.sub = { name: 'Волки', hp: Math.round(m.maxhp * 0.1), max: Math.round(m.maxhp * 0.1), t0: M.t }; say9('Зов стаи!', '#ffb08a'); }
      if (M.sub && G.turn % 2 === 0) { const w = alive().sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0]; if (w) hurt(w, m.atk * (M.t - M.sub.t0 >= 10 ? 0.6 : 0.4), 'волки'); } // v9b: волки опаснее, через 10 с — сильнее
      if (!M.rage && m.hp < m.maxhp * 0.5) { M.rage = 1; m.atk = Math.round(m.atk * 1.15); say9('Бешенство!', '#ff7a5a'); }
    } else if (M.mech === 'totem') { // Огненный тотем: жжёт всех; простоял 10 с — вождь лечится
      if (!M.sub && M.t - (M.cd ?? -99) >= 18) { M.sub = { name: 'Тотем', hp: Math.round(m.maxhp * 0.1), max: Math.round(m.maxhp * 0.1), t0: M.t }; say9('Огненный тотем!', '#ffb08a'); }
      if (M.sub && Math.round(M.t / 0.8) % 4 === 0) { alive().forEach(x => hurt(x, x.maxhp * 0.04, 'тотем')); if (M.t - M.sub.t0 >= 10) { const n = Math.round(m.maxhp * 0.02); m.hp = Math.min(m.maxhp, m.hp + n); fxText(m.x, m.y - 120, `+${n}`, '#7dff9a', 26, 1.2, 'forest'); } }
    } else if (M.mech === 'skin') { // Каменная кожа (70% урона гасит, пока не треснет), Удар по земле раз в 20 с
      if (M.t <= 0.8 && !M.skinDone) { M.sub = { name: 'Каменная кожа', hp: Math.round(m.maxhp * 0.25), max: Math.round(m.maxhp * 0.25), t0: M.t }; M.skinDone = 1; say9('Каменная кожа!', '#c8c0b0'); }
      if (M.t - (M.stomp || 0) >= 20) { M.stomp = M.t; say9('Удар по земле!', '#ffb08a'); alive().forEach(x => hurt(x, x.maxhp * 0.08, 'удар')); }
    }
  }
  // ---- победитель недели: сундук каждому активному + скидка в кузнице ----
  function g9WeekEnd(prevWk) { // вызывается при смене недели ДО обнуления S.weekly
    const W = G9().week; if (!G9ON() || !W.enabled || !prevWk) return; const s = g9S(), GA = guildCounts();
    const rows = C.guilds.map(g => ({ id: g.id, pts: +(S.weekly || {})[g.id] || 0, pa: perActive(g.id, +(S.weekly || {})[g.id] || 0, GA) })).sort((a, b) => b.pa - a.pa);
    const top = rows[0]; if (!top || top.pts < (W.minPts || 0) || (rows[1] && rows[1].pa === top.pa)) { s.win = null; return; }
    const members = S.order.filter(u => { const h = S.heroes[u]; return h && h.rpg_guild === top.id && heroActive(h); });
    s.win = { gid: top.id, wk: weekKey(), pa: Math.round(top.pa), users: members, paid: {} };
    const t = `🏆 Гильдия недели — «${g9Name(top.id)}» (${Math.round(top.pa)} очков на игрока)! Каждому — ${(C.chests[W.chest] || {}).name || 'сундук'}, всю неделю скидка ${Math.round(W.smithOff * 100)}% в кузнице`;
    log(t, g9Col(top.id)); emitBot({ event: 'g9Week', user: '', text: t });
  }
  function g9Win() { const w = g9S().win; return w && w.wk === weekKey() ? w : null; }
  function g9SmithK(h) { const w = g9Win(); return w && h && h.rpg_guild === w.gid ? 1 - (+G9().week.smithOff || 0) : 1; }
  function g9WeekTick() { // выдаём сундук победителям, когда они на стриме
    weekTick(); const w = g9Win(), W = G9().week; if (!w || !C.chests[W.chest]) return; let n = 0;
    for (const u of w.users) { if (w.paid[u]) continue; const h = S.heroes[u]; if (!h || h.rpg_guild !== w.gid || Date.now() - heroSeen(h) > 15 * 60000) continue;
      const rt = ensureRT(h); giveChest(h, W.chest, 'Гильдия недели', { x: rt.x, y: rt.y, loc: rt.loc }); w.paid[u] = Date.now(); n++; if (n >= 3) break; }
    if (n) save();
  }
  // ---- неактивные ----
  let G9KICK_T = 0;
  function g9KickTick() {
    if (!(+G9().inactiveKickDays > 0) || Date.now() - G9KICK_T < 600000) return; G9KICK_T = Date.now();
    const lim = +G9().inactiveKickDays * 864e5; let n = 0;
    S.order.forEach(u => { const h = S.heroes[u]; if (h && h.rpg_guild && Date.now() - heroSeen(h) > lim) { log(`${DN(h)} давно не появлялся — выходит из гильдии «${g9Name(h.rpg_guild)}»`, '#9a8a7a'); h.rpg_guild = null; h.rpg_guildJoined = 0; delete h.rpg_guildAuto; h.rpg_g9Left = 1; n++; } });
    if (n) save();
  }
  let G9WK_T = 0;
  function g9Tick() { if (!G9ON()) return; g9ElectTick(); g9HikeTick(); g9KickTick(); if (Date.now() - G9WK_T > 20000) { G9WK_T = Date.now(); g9WeekTick(); } }
  function g9Snap() {
    if (!G9ON()) return null; const s = g9S(), P = G9(), e = s.elect || {};
    const W9 = g9Win();
    return { win: W9 ? [W9.gid, W9.pa, Math.round((+P.week.smithOff || 0) * 100), (C.chests[P.week.chest] || {}).name || ''] : null, wk: P.week.enabled ? [Math.round((+P.week.smithOff || 0) * 100), (C.chests[P.week.chest] || {}).name || '', P.week.minPts] : null, hmin: P.hike.min, gm: P.gm.enabled, bank: P.bank.enabled, hike: P.hike.enabled, minVotes: P.gm.minVotes, rewardGold: P.gm.rewardGold, medalDays: P.gm.medalDays, medalEvery: P.gm.medalEveryDays, maxDep: P.bank.maxPerWeek, waves: P.hike.waves, hmin: P.hike.min, hmax: P.hike.max, hwait: Math.round(P.hike.waitSec / 60), noGmMin: P.bank.noGmMin,
      elect: e.first ? e.first : 0, buffs: P.bank.buffs.map(b => [b.id, b.name, b.txt, b.icon]),
      g: C.guilds.map(g => { const gm = g9Gm(g.id), bf = g9Buff(g.id), q = G9Q[g.id], L = g9Count(g.id); return { id: g.id, gm: gm ? DN(S.heroes[gm.user]) : '', gmu: gm ? gm.user : '', gv: gm ? gm.votes : 0, lead: L.slice(0, 3).map(([u, n]) => [DN(S.heroes[u]), n]), bank: +s.bank[g.id] || 0, buff: bf ? [bf.id, bf.name, bf.txt, bf.until] : null, bwk: s.buffWk[g.id] === weekKey() ? 1 : 0, prices: P.bank.buffs.map(b => g9Price(g.id, b)), hq: q ? q.users.length : 0, hleft: q ? Math.max(0, Math.ceil((q.t0 + P.hike.waitSec * 1000 - Date.now()) / 60000)) : 0, rew: s.gmRew[g.id] === weekKey() ? 1 : 0,
        members: S.order.map(u => S.heroes[u]).filter(h => h && h.rpg_guild === g.id && heroActive(h)).slice(0, 40).map(h => [h.user, DN(h), +h.rpg_medalAt && Date.now() - h.rpg_medalAt < P.gm.medalEveryDays * 864e5 ? 1 : 0]) }; }) };
  }
  function g9MeSnap(h) { if (!G9ON() || !h || !h.rpg_guild) return null; const s = g9S(), b = BATTLES.find(x => x.user === h.user && x.G && x.G.g9), M = b && b.G.mech;
    return { so: Math.round((1 - g9SmithK(h)) * 100), vote: (s.votes[h.rpg_guild] || {})[h.user] || '', dep: g9Dep(s, h.user).amt, medal: +h.rpg_medalUntil > Date.now() ? h.rpg_medalUntil : 0, inQ: !!(G9Q[h.rpg_guild] && G9Q[h.rpg_guild].users.includes(h.user)), went: g9Went(h) ? 1 : 0,
      fight: M && M.sub ? [M.sub.name, Math.round(M.sub.hp / M.sub.max * 100), g9Focus(h) ? 1 : 0, Math.max(0, Math.ceil(((+h._g9fcd || 0) - Date.now()) / 1000))] : null }; }

  // ===================== v49: СЕЗОН 2 · ЗАТОЧКА · ПОСТРОЙКИ 10 УР. · ВАЙП =====================
  // Всё новое включается только конфигом (season / sharpen / buildingsV2) и только с сезона fromSeason (по умолчанию 2):
  // пока в сохранении «Сезон 1», игра ведёт себя как v48.2. Вайп срабатывает ОДИН раз при загрузке игры, когда
  // config.season.id больше номера сезона в сохранении и текущее время ≥ season.startAt (см. seasonBoot).
  const SEASON_DEF = { id: 1, name: 'Сезон 2', startAt: '', announceDays: 3, veteranMinLevel: 5, top: 3, topBy: 'score', bannerHours: 6, summaryDays: 14,
    score: { perLevel: 10, perBossWin: 10, sharpBest: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 20, 7: 35, 8: 55, 9: 80, 10: 120 } },
    freeChange: { cls: true, gender: true, hair: true, expires: false, confirm: true }, resetBuildings: true };
  const SEASON = () => { const c = C.season || {}; return Object.assign({}, SEASON_DEF, c, { score: Object.assign({}, SEASON_DEF.score, c.score || {}), freeChange: Object.assign({}, SEASON_DEF.freeChange, c.freeChange || {}) }); };
  const seasonNo = () => (S && +S.season) || 1;
  const seasonTarget = () => Math.max(1, Math.floor(+SEASON().id) || 1);
  const SEASON_NOW = () => (typeof window !== 'undefined' && +window.__seasonNow) || Date.now();
  function seasonStartMs() { const a = SEASON().startAt; if (!a) return 0; const t = typeof a === 'number' ? a : Date.parse(String(a).trim().replace(' ', 'T')); return isFinite(t) ? t : Infinity; } // время без пояса = по часам этого компьютера; не разобрали — вайпа не будет
  const seasonSkipKey = () => seasonTarget() + '|' + String(SEASON().startAt || '');
  const SEASON_TITLES = [['Чемпион', '🥇'], ['Серебро', '🥈'], ['Бронза', '🥉']];
  const seasonMedal = t => { const m = /^(Чемпион|Серебро|Бронза) \d+ сезона/.exec(String(t || '')); return m ? SEASON_TITLES.find(x => x[0] === m[1])[1] : ''; };
  const seasonBackupKey = n => C.saveKey + '_s' + n + '_backup';

  // ---------- очки сезона ----------
  function seasonScoreOf(h) {
    const SC = SEASON().score, lv = +h.rpg_level || 1, w = +h.rpg_bossWins || 0, best = Math.max(0, Math.min(10, +h.rpg_sharpBest || 0));
    const lp = lv * SC.perLevel, wp = w * SC.perBossWin, sp = best ? (+(SC.sharpBest || {})[best] || 0) : 0;
    return { sc: lp + wp + sp, lp, wp, sp, lv, w, best };
  }
  function seasonRanking() {
    const L = S.order.map(n => S.heroes[n]).filter(Boolean).map(h => Object.assign({ h }, seasonScoreOf(h)));
    L.sort((a, b) => b.sc - a.sc || (+b.h.rpg_xp || 0) - (+a.h.rpg_xp || 0) || (+a.h.rpg_created || 0) - (+b.h.rpg_created || 0) || (a.h.user < b.h.user ? -1 : 1));
    L.forEach((x, i) => x.r = i + 1);
    return L;
  }

  // ---------- вайп ----------
  const SEASON_RESET_NUM = ['rpg_kills', 'rpg_deaths', 'rpg_expeditions', 'rpg_partyExpeditions', 'rpg_harvests', 'rpg_cooked', 'rpg_potionsBrewed', 'rpg_chestsGot', 'rpg_bossWins', 'rpg_bossDmg', 'rpg_legendary', 'rpg_donated', 'rpg_chests', 'rpg_food', 'rpg_questsDone', 'rpg_wkPts', 'rpg_hikeAt', 'rpg_healAt', 'rpg_strikeAt', 'rpg_sharpBest', 'rpg_shards', 'rpg_luck', 'rpg_gold', 'rpg_xp'];
  function seasonResetHero(h) {
    SEASON_RESET_NUM.forEach(k => { if (h[k] !== undefined || k === 'rpg_gold' || k === 'rpg_xp') h[k] = 0; });
    h.rpg_level = 1; h.rpg_potions = 1;
    h.rpg_equip = {}; h.rpg_eqOwn = []; h.rpg_dur = {}; h.rpg_gear = []; delete h.rpg_trophyOn; h.rpg_sharp = {}; h.rpg_sharpPity = {}; h.rpg_sets = []; delete h.rpg_setOn;
    h.rpg_bag = {}; h.rpg_chestBox = {}; h.rpg_mats = { wood: 0, stone: 0, iron: 0 }; h.rpg_buffs = []; h.rpg_dishes = [];
    h.rpg_quest = null; h.rpg_offers = []; h.rpg_weekly = null; delete h.rpg_wk; h.rpg_qlog = [];
    h.rpg_skills = {}; h.rpg_cmdT = {}; delete h.rpg_pturn; delete h.rpg_luckCraft;
    h.rpg_hp = stats(h).maxhp;
    for (const k of Object.keys(h)) if (/^_(durW|durT|durA|durAT|shield|shieldMax|bossDead|lastBoss.*|hikeTs|rewStream_x)$/.test(k)) delete h[k];
  }
  function seasonTitleOld(t, old) { t = String(t || ''); if (!t || /\(\d+ сезон\)$/.test(t) || /^(Чемпион|Серебро|Бронза|Ветеран|Гроза боссов) \d+ сезона$/.test(t)) return t; return `${t} (${old} сезон)`; }
  function seasonWipe(newId) {
    const old = seasonNo(), SC = SEASON(), tNow = Date.now();
    const rank = seasonRanking(), N = rank.length, topN = Math.max(0, +SC.top || 3);
    const bane = S.order.map(n => S.heroes[n]).filter(h => h && (+h.rpg_bossDmg || 0) > 0).sort((a, b) => (+b.rpg_bossDmg || 0) - (+a.rpg_bossDmg || 0))[0] || null;
    const give = (h, t, arch) => { h.rpg_owned = h.rpg_owned || {}; h.rpg_owned.title = h.rpg_owned.title || []; if (!h.rpg_owned.title.includes(t)) h.rpg_owned.title.push(t); arch.tt.push(t); };
    const vetT = `Ветеран ${old} сезона`, baneT = `Гроза боссов ${old} сезона`;
    let vets = 0;
    for (const x of rank) {
      const h = x.h, arch = { sc: x.sc, lp: x.lp, wp: x.wp, sp: x.sp, lv: x.lv, xp: +h.rpg_xp || 0, w: x.w, dmg: Math.round(+h.rpg_bossDmg || 0), kills: +h.rpg_kills || 0, best: x.best, r: x.r, n: N, md: 0, vet: false, bane: false, ach: (h.rpg_ach || []).slice(), tt: [], t: tNow };
      // титулы 1 сезона: старые остаются с пометкой, в новом сезоне те же достижения можно заработать заново
      h.rpg_owned = h.rpg_owned || { hat: [], aura: [], pet: [], title: [], set: [] }; h.rpg_eq = h.rpg_eq || {};
      h.rpg_owned.title = (h.rpg_owned.title || []).map(t => seasonTitleOld(t, old)).filter((t, i, a) => a.indexOf(t) === i);
      if (h.rpg_eq.title) h.rpg_eq.title = seasonTitleOld(h.rpg_eq.title, old);
      if (x.r <= topN) { const nm = SEASON_TITLES[x.r - 1]; if (nm) { give(h, `${nm[0]} ${old} сезона`, arch); arch.md = x.r; } }
      if (x.lv >= SC.veteranMinLevel) { give(h, vetT, arch); arch.vet = true; vets++; }
      if (bane && h === bane) { give(h, baneT, arch); arch.bane = true; }
      h.rpg_seasons = Object.assign({}, h.rpg_seasons || {}); h.rpg_seasons[old] = arch;
      h.rpg_ach = [];
    }
    for (const x of rank) { seasonResetHero(x.h); x.h.rpg_freeChange = 1; }
    // общее
    const gs = Object.entries(S.guildScore || {}).sort((a, b) => b[1] - a[1])[0];
    const sum = { n: old, nm: 'Сезон ' + old, t: tNow, heroes: N, top: rank.slice(0, topN).map(x => [x.h.user, x.sc, x.lv, x.w, DN(x.h)]), vet: vets, bane: bane ? [bane.user, Math.round(bane.rpg_bossDmg || 0), DN(bane)] : null, gd: gs && gs[1] > 0 ? [gs[0], Math.round(gs[1])] : null };
    S.seasons = Object.assign({}, S.seasons || {}); S.seasons[old] = sum;
    if (sum.gd) { S.guildStars = S.guildStars || {}; (S.guildStars[sum.gd[0]] = S.guildStars[sum.gd[0]] || []).push(old); }
    if (SC.resetBuildings !== false) { const b = {}; BLD.forEach(id => b[id] = { lv: 1, fund: 0 }); S.buildings = b; }
    S.guildScore = {}; S.weekly = {}; S.weekKey = ''; S.trophy = null; S.boss = null; S.nextBossAt = 0; S.bossIdx = 0; S.lastBoss = null; S.cooking = []; S.log = []; S.fair = null; S.fairLast = ''; S.hearts = {}; S.heartLog = [];
    S.season = newId; S.seasonAt = tNow; S.seasonBannerUntil = tNow + (+SC.bannerHours || 6) * 3600000; delete S.seasonSkip;
    if (rank[0]) fame('season', `Сезон ${old} завершён: чемпион — ${DN(rank[0].h)} (${rank[0].sc} очк.)`);
    if (rank[1]) fame('season', `Сезон ${old}: серебро — ${DN(rank[1].h)} (${rank[1].sc} очк.)`);
    if (rank[2]) fame('season', `Сезон ${old}: бронза — ${DN(rank[2].h)} (${rank[2].sc} очк.)`);
    if (bane) fame('season', `Сезон ${old}: гроза боссов — ${DN(bane)} (урон ${fmtHP(bane.rpg_bossDmg)})`);
    S.seats = (S.seats || []).map(n => S.heroes[n] ? n : null);
    log(`🏆 ${SC.name || 'Сезон ' + newId} начался! Героев: ${N}. Чемпион ${old} сезона — ${rank[0] ? DN(rank[0].h) : '—'}. Всем героям — бесплатная смена класса и облика (!смена).`, '#ffd27a');
    return { sum, rank };
  }
  function seasonSeen() { try { return localStorage.getItem(C.saveKey); } catch (e) { return null; } }
  function seasonBoot(fresh) {
    S.seasonErr = undefined; delete S.seasonErr;
    if (fresh) { const t = seasonTarget(); S.season = (t > 1 && SEASON_NOW() >= seasonStartMs()) ? t : 1; return { ran: false, fresh: true }; }
    if (!S.season) S.season = 1;
    const tgt = seasonTarget();
    if (tgt <= S.season) return { ran: false };
    if (SEASON_NOW() < seasonStartMs()) return { ran: false, wait: true };
    if (S.seasonSkip && S.seasonSkip === seasonSkipKey()) return { ran: false, skipped: true };
    const old = S.season, raw = seasonSeen();
    try {
      if (!raw) throw new Error('нет сохранения в OBS для копии');
      const bk = seasonBackupKey(old);
      localStorage.setItem(bk, raw);
      if (localStorage.getItem(bk) !== raw) throw new Error('копия не записалась (проверьте место в OBS)');
      localStorage.setItem(bk + '_meta', JSON.stringify({ t: Date.now(), season: old, heroes: S.order.length, bytes: raw.length }));
    } catch (e) { S.seasonErr = 'Вайп НЕ выполнен: ' + String(e && e.message || e); console.error('[season]', e); log('⚠ ' + S.seasonErr, '#ff9c7a'); return { ran: false, err: S.seasonErr }; }
    try { const r = seasonWipe(tgt); save(); S.seasonRan = Date.now(); SEASON_LAST = r; emitSeasonStart(r); return { ran: true, from: old, to: tgt }; }
    catch (e) { console.error('[season] вайп упал, возвращаю сохранение', e); try { S = migrate(JSON.parse(raw)); } catch (e2) { } S.seasonErr = 'Вайп не удался (' + String(e && e.message || e) + '), сохранение осталось как было'; return { ran: false, err: S.seasonErr }; }
  }
  let SEASON_LAST = null;
  function emitSeasonStart(r) {
    const old = r.sum.n, c = r.rank[0], N = r.sum.heroes;
    emitBot({ event: 'seasonStart', season: S.season, name: SEASON().name || 'Сезон ' + S.season, heroes: N, champion: c ? DN(c.h) : '', championScore: c ? c.sc : 0, top: r.sum.top.map(x => `${x[4]} (${x[1]})`).join(', '),
      text: `🏆 Сезон ${S.season} начался! Чемпион ${old} сезона — ${c ? DN(c.h) : '—'}${c ? ` (${c.sc} очков)` : ''}. У каждого героя одна бесплатная смена класса и облика: !смена. Итоги прошлого сезона — на пульте.` });
  }
  function seasonExport() {
    let raw = null; try { raw = localStorage.getItem(C.saveKey); } catch (e) { }
    const json = (S && JSON.stringify(S)) || raw || '{}', d = new Date(), p = n => String(n).padStart(2, '0');
    return { ok: true, name: `rpgFarmSave_s${seasonNo()}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`, json, heroes: S ? S.order.length : 0, season: seasonNo() };
  }
  function seasonInfo() {
    const old = Math.max(1, seasonNo() - 1), k = seasonBackupKey(seasonNo() > 1 ? old : 1); let meta = null, has = false;
    try { has = !!localStorage.getItem(k); meta = JSON.parse(localStorage.getItem(k + '_meta') || 'null'); } catch (e) { }
    return { season: seasonNo(), target: seasonTarget(), startAt: SEASON().startAt || '', startMs: seasonStartMs(), waiting: seasonTarget() > seasonNo(), backup: has, backupKey: k, backupMeta: meta, err: S.seasonErr || '', skip: S.seasonSkip || '' };
  }
  function seasonRestore() { // «↩ Вернуть Сезон 1 из копии»: из копии rpgFarmSave_v4_s1_backup; сам вайп повторно не запустится, пока не поменяют id/startAt
    const cur = seasonNo(), from = cur > 1 ? cur - 1 : 1, k = seasonBackupKey(from);
    let raw = null; try { raw = localStorage.getItem(k); } catch (e) { }
    if (!raw) return { ok: false, msg: 'копии сезона ' + from + ' нет в этом OBS (' + k + '). Загрузите файл сохранения вручную.' };
    let d; try { d = JSON.parse(raw); } catch (e) { return { ok: false, msg: 'копия повреждена' }; }
    const keep = seasonRescue(); // защита: невыданные призы текущего сохранения добавляем в восстановленное
    try { localStorage.setItem(C.saveKey + '_before_restore', JSON.stringify(S)); } catch (e) { }
    S = migrate(d); S.seasonSkip = seasonSkipKey(); if (keep.n) S.prizes = S.prizes.concat(keep.add);
    resetRuntime(); ACTIVE = ''; S.order.forEach(n => goCamp(S.heroes[n])); save(); renderLog(); log(`↩ Сезон ${S.season} восстановлен из копии (${S.order.length} героев)` + (keep.n ? `, добавлено новых призов: ${keep.n}` : ''), '#ffd27a'); refreshUI(); publishSnap();
    return { ok: true, msg: `Сезон ${S.season} возвращён из копии: героев ${S.order.length}. В config.js поставьте season.id: ${S.season}, иначе вайп останется отложенным только до смены времени.`, season: S.season, heroes: S.order.length };
  }
  function seasonRescue() { // призы, выданные ПОСЛЕ копии (id больше всех в копии), не теряем при возврате
    try { const raw = localStorage.getItem(seasonBackupKey(seasonNo() > 1 ? seasonNo() - 1 : 1)); const b = raw && JSON.parse(raw); const have = new Set(((b && b.prizes) || []).map(p => p.id)); const add = (S.prizes || []).filter(p => !have.has(p.id)); return { n: add.length, add }; } catch (e) { return { n: 0, add: [] }; }
  }

  // ---------- заточка (как в BDO) ----------
  const SH_DEF = { enabled: true, fromSeason: 2, slots: ['weapon', 'armor', 'offhand'], failTo: 5, pity: 0.10, pityMax: 0.30,
    chance: { 6: 0.70, 7: 0.60, 8: 0.45, 9: 0.35, 10: 0.25 },
    cost: { 1: [40, 0, 0], 2: [60, 0, 0], 3: [80, 0, 0], 4: [110, 0, 0], 5: [150, 0, 0], 6: [200, 0, 1], 7: [260, 1, 2], 8: [320, 1, 2], 9: [380, 1, 3], 10: [450, 1, 3] },
    offhandCost: { goldMul: 0.6, iron: { 6: 1, 7: 1, 8: 1, 9: 2, 10: 2 } },
    weapon: { atkPer: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2] }, armor: { hpPer: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], defAt: [4, 6, 8, 10] },
    offhand: { def: { hpPer: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2], defAt: [6, 10] }, atk: { atkAt: [2, 4, 6, 7, 8, 9, 10] } },
    luckScroll: { bonus: 0.15, perTry: 1 }, repairPerLevel: 0.10, repairIronFromBs: 3, repairIronPer25: 1, sellConfirmFrom: 6, forgeBonusLv: 10, forgeBonus: 0.05,
    fx: { 8: 'flash', 9: 'banner', 10: 'legend' }, chatAnnounceFrom: 10,
    drops: { shard: { bossWin: 1, bossTop3: 1, mimic: 0.20, legendary: 2, weeklyParty5: 1 }, luck: { bossWin: 0.10, bossTop1: 1, mimic: 0.05, legendary: 0.30 }, luckCraft: { blacksmithLv: 8, iron: 30, wood: 50, gold: 200, perWeek: 2 } } };
  let _SHC = null, _SHS = null;
  const SH = () => { const c = C.sharpen; if (_SHS === c && _SHC) return _SHC; _SHS = c; const o = Object.assign({}, SH_DEF, c || {}); for (const k of ['chance', 'cost', 'luckScroll', 'drops', 'offhandCost', 'weapon', 'armor', 'offhand', 'fx']) o[k] = Object.assign({}, SH_DEF[k], (c || {})[k] || {}); return _SHC = o; };
  const SH_ON = () => { const c = C.sharpen; return !!c && c.enabled !== false && seasonNo() >= (+c.fromSeason || 2); };
  const SH_SLOT_RU = [[/оруж|меч|лук|кинж|посох|клин/, 'weapon'], [/брон|доспех|латы|кольчуг|роб[аы]/, 'armor'], [/лев|щит|оффх|колчан|наруч|книг|гримуар|дага|кинжал2|символ/, 'offhand']];
  const shLv = (h, id) => Math.max(0, Math.min(10, Math.floor(+((h.rpg_sharp || {})[id]) || 0)));
  function shItem(h, slot) { const it = eqItem(eqOf(h)[slot]); return it && it.slot === slot && eqAllowed(h, it) ? it : null; }
  function shKind(it) { if (!it) return null; if (it.slot === 'weapon') return 'w'; if (it.slot === 'armor') return 'a'; if (it.slot === 'offhand') return (it.kind === 'shield' || it.kind === 'bracer') ? 'od' : 'oa'; return null; }
  function shBonusOf(it, n) {
    const o = { atk: 0, mag: 0, hp: 0, def: 0 }, k = shKind(it), X = SH(); if (!k || !(n > 0)) return o;
    const sum = a => (a || []).slice(0, n).reduce((s, x) => s + x, 0), cnt = a => (a || []).filter(x => x <= n).length;
    if (k === 'w') { const v = sum(X.weapon.atkPer); if (it.mag && !it.atk) o.mag = v; else o.atk = v; }
    else if (k === 'a') { o.hp = sum(X.armor.hpPer); o.def = cnt(X.armor.defAt); }
    else if (k === 'od') { o.hp = sum(X.offhand.def.hpPer); o.def = cnt(X.offhand.def.defAt); }
    else { const v = cnt(X.offhand.atk.atkAt); if (it.kind === 'tome') o.mag = v; else o.atk = v; }
    return o;
  }
  function sharpBonus(h) { // сумма бонусов заточки надетых вещей; слабеет вместе с прочностью (как бонус самой вещи)
    if (!SH_ON() || !h || !h.rpg_sharp) return null; let r = null;
    for (const s of ['weapon', 'armor', 'offhand']) { const it = shItem(h, s); if (!it) continue; const n = shLv(h, it.id); if (!n) continue; const dm = durMul(h, it); if (!dm) continue;
      const b = shBonusOf(it, n); r = r || { atk: 0, mag: 0, hp: 0, def: 0 }; for (const k in b) r[k] += b[k] * dm; }
    return r;
  }
  const eqLabel = (h, it) => { const n = SH_ON() ? shLv(h, it.id) : 0; return it.name + (n ? ` +${n}` : ''); };
  const forgeBonus = () => { const X = SH(); return bLv('blacksmith') >= (+X.forgeBonusLv || 99) && BV2() ? +X.forgeBonus || 0 : 0; };
  function shCost(h, it, tgt) {
    const X = SH(), c = X.cost[tgt]; if (!c) return null; const off = it.slot === 'offhand';
    return { gold: off ? Math.round(c[0] * X.offhandCost.goldMul) : c[0], shards: c[1], iron: off ? (X.offhandCost.iron[tgt] || 0) : c[2] };
  }
  function shChance(h, it, tgt, luck) {
    const X = SH(); if (tgt <= 5) return 1; const pit = Math.min(X.pityMax, (+((h.rpg_sharpPity || {})[it.id]) || 0) * X.pity);
    return Math.min(1, (X.chance[tgt] || 0) + pit + forgeBonus() + (luck ? X.luckScroll.bonus : 0));
  }
  function shQuote(h, slot, luck) { // что получится, если нажать «Заточить» (для чата и для проверки)
    const it = shItem(h, slot); if (!it) return { slot, empty: true };
    const lv = shLv(h, it.id), tgt = lv + 1; if (lv >= 10) return { slot, it, lv, max: true };
    const c = shCost(h, it, tgt), p = shChance(h, it, tgt, luck);
    return { slot, it, lv, tgt, c, p, fail: tgt >= 6, ok: h.rpg_gold >= c.gold && (h.rpg_shards || 0) >= c.shards && ((h.rpg_mats || {}).iron || 0) >= c.iron };
  }
  const SH_SLOT_NAME = { weapon: 'оружие', armor: 'броня', offhand: 'левая рука' };
  const pct = x => Math.round(x * 100) + '%';
  function shStatus(h) {
    const parts = ['weapon', 'armor', 'offhand'].map(s => { const q = shQuote(h, s); if (q.empty) return `${SH_SLOT_NAME[s]}: пусто`; if (q.max) return `${SH_SLOT_NAME[s]} «${q.it.name}» +10 (максимум)`;
      return `${SH_SLOT_NAME[s]} «${q.it.name}» +${q.lv}→+${q.tgt}: ${pct(q.p)}, ${q.c.gold} з${q.c.shards ? `, ✦${q.c.shards}` : ''}${q.c.iron ? `, ⛓${q.c.iron}` : ''}`; });
    return `заточка: ${parts.join(' · ')} · ✦ осколков ${h.rpg_shards || 0}, 🍀 свитков ${h.rpg_luck || 0} · !заточка оружие|броня|левая [удача]`;
  }
  function shBusy(h) { const b = blocked(h, 'town'); if (b) return 'точить можно только вне похода и боя с боссом — ' + b.replace(/^нельзя: /, ''); if (BATTLES.some(x => x.user === h.user)) return 'точить можно только вне похода и боя с боссом — герой в бою'; return ''; }
  function sharpenCmd(nick, arg) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    if (!SH_ON()) return res(h, false, 'заточка начнётся в новом сезоне');
    let q = String(arg || '').toLowerCase().replace(/ё/g, 'е').trim(); const luck = /(^|\s)(удач\S*|свиток|свитком|luck|🍀)(\s|$)/.test(q); q = q.replace(/(^|\s)(удач\S*|свиток|свитком|luck|🍀)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q || /^(инфо|info|статус|список)$/.test(q)) return res(h, true, shStatus(h));
    if (/^(крафт|создать|сделать|скрафтить)/.test(q)) return luckCraft(h);
    let slot = null; for (const [re, s] of SH_SLOT_RU) if (re.test(q)) { slot = s; break; }
    if (!slot) return res(h, false, 'что точить? !заточка оружие | броня | левая [удача] — или !заточка для списка');
    return sharpenTry(h, slot, luck);
  }
  function sharpenTry(h, slot, luck) {
    const busy = shBusy(h); if (busy) return res(h, false, busy);
    const q = shQuote(h, slot, luck); if (q.empty) return res(h, false, `слот «${SH_SLOT_NAME[slot]}» пуст — нечего точить (!купить)`);
    const it = q.it; if (q.max) return res(h, false, `«${it.name}» уже +10 — выше точить нельзя`);
    if (DUR() && durCur(h, it) <= 0) return res(h, false, `«${it.name}» сломана — сначала почини (!чинить), потом точи`);
    const c = q.c, X = SH(), fe = (h.rpg_mats || {}).iron || 0;
    if (luck && !((h.rpg_luck || 0) >= X.luckScroll.perTry)) return res(h, false, 'нет свитка удачи 🍀 (падает с боссов, мимиков и из легендарных сундуков; в кузнице ур.' + (X.drops.luckCraft.blacksmithLv) + ' его можно сделать: !заточка крафт)');
    if (h.rpg_gold < c.gold) return res(h, false, `заточка «${it.name}» +${q.lv}→+${q.tgt} стоит ${c.gold} з, у тебя ${Math.floor(h.rpg_gold)} з`);
    if ((h.rpg_shards || 0) < c.shards) return res(h, false, `нужен Звёздный осколок ✦ (у тебя ${h.rpg_shards || 0}). Падают с боссов, мимиков и легендарных сундуков`);
    if (fe < c.iron) return res(h, false, `нужно железа ⛓: ${c.iron}, у тебя ${fe}`);
    h.rpg_gold -= c.gold; h.rpg_shards = (h.rpg_shards || 0) - c.shards; h.rpg_mats.iron = fe - c.iron; if (luck) h.rpg_luck -= X.luckScroll.perTry;
    h.rpg_sharp = h.rpg_sharp || {}; h.rpg_sharpPity = h.rpg_sharpPity || {};
    const p = q.p, ok = Math.random() < p, tgt = q.tgt, lv0 = q.lv; let msg, color;
    if (ok) {
      h.rpg_sharp[it.id] = tgt; delete h.rpg_sharpPity[it.id]; if (tgt > (+h.rpg_sharpBest || 0)) h.rpg_sharpBest = tgt;
      msg = `Успех! «${it.name}» +${lv0} → +${tgt}${luck ? ' (свиток удачи 🍀 потрачен)' : ''}`; color = tgt >= 8 ? '#e0b0ff' : '#c8f0a8';
    } else {
      const to = Math.min(lv0, Math.max(0, +X.failTo || 5)); h.rpg_sharp[it.id] = to; h.rpg_sharpPity[it.id] = (+h.rpg_sharpPity[it.id] || 0) + 1;
      msg = `Неудача: «${it.name}» +${lv0} → +${to} (шанс был ${pct(p)}). Упорство: +${pct(Math.min(X.pityMax, h.rpg_sharpPity[it.id] * X.pity))} к следующей попытке${luck ? '; свиток 🍀 потрачен' : ''}`; color = '#e8b0a0';
    }
    const nm = DN(h), line = `⚒ ${nm}: «${it.name}» +${lv0}→${ok ? '+' + tgt : '+' + h.rpg_sharp[it.id] + ' (неудача)'} · ${pct(p)}${luck ? ' · 🍀' : ''}`;
    if (tgt >= 6) clog(line.replace('⚒ ', 'Заточка: '), color);
    const rt = ensureRT(h), went = !blocked(h, 'town') && rt.mode !== 'exp' && TOWN.blacksmith && goDo(h, 'town', TOWN.blacksmith.x - 110, TOWN.blacksmith.y + 20, 'точит…', C.townStaySeconds, 2, () => fxText(TOWN.blacksmith.x, TOWN.blacksmith.y - 220, ok ? `+${tgt}!` : 'сорвалось', ok ? '#e0b0ff' : '#ff9c7a', 36, 2, 'town'), true);
    if (ok && tgt >= 8) sharpFx(h, it, tgt);
    if (ok && tgt >= (+X.chatAnnounceFrom || 99)) emitBot({ event: 'sharpenAnnounce', user: h.user, userName: DN(h), item: it.name, level: tgt, text: `🔥 ${DN(h)} заточил «${it.name}» до +${tgt}!` });
    save(); refreshUI(); publishSnapSoon();
    return res(h, ok, msg, color);
  }
  function luckCraft(h) {
    const X = SH().drops.luckCraft, bs = bLv('blacksmith'), busy = shBusy(h); if (busy) return res(h, false, busy);
    if (bs < X.blacksmithLv) return res(h, false, `свиток удачи можно сделать в кузнице ур.${X.blacksmithLv} (сейчас ${bs}) — !вклад кузница`);
    const wk = weekKey(), lc0 = h.rpg_luckCraft && h.rpg_luckCraft.wk === wk ? h.rpg_luckCraft.n : 0;
    if (lc0 >= X.perWeek) return res(h, false, `свитки удачи: не больше ${X.perWeek} в неделю — на этой неделе уже сделаны`);
    const m = h.rpg_mats || {}; if (h.rpg_gold < X.gold || (m.iron || 0) < X.iron || (m.wood || 0) < X.wood) return res(h, false, `свиток удачи 🍀: ${X.iron} железа, ${X.wood} дерева, ${X.gold} золота (у тебя ⛓${m.iron || 0}, 🪵${m.wood || 0}, ${Math.floor(h.rpg_gold)} з)`);
    h.rpg_gold -= X.gold; m.iron -= X.iron; m.wood -= X.wood; h.rpg_luck = (h.rpg_luck || 0) + 1; h.rpg_luckCraft = { wk, n: lc0 + 1 };
    log(`🍀 ${DN(h)}: кузнец сделал Свиток удачи (${lc0 + 1}/${X.perWeek} за неделю)`, '#c8f0a8'); save(); refreshUI(); publishSnapSoon();
    return res(h, true, `кузнец сделал Свиток удачи 🍀 (${lc0 + 1}/${X.perWeek} за эту неделю, всего ${h.rpg_luck})`, '#c8f0a8');
  }
  // награды: осколки ✦ и свитки удачи 🍀
  function shGive(h, shards, luck) { h.rpg_shards = (h.rpg_shards || 0) + shards; h.rpg_luck = (h.rpg_luck || 0) + luck; }
  function shBossDrop(h, top3, top1) { // → текст для таблички награды или ''
    if (!SH_ON()) return ''; const D = SH().drops; let s = D.shard.bossWin + (top3 ? D.shard.bossTop3 : 0), l = (top1 ? D.luck.bossTop1 : 0) + (!top1 && Math.random() < D.luck.bossWin ? 1 : 0);
    shGive(h, s, l); return `✦ осколок ×${s}` + (l ? `, 🍀 свиток ×${l}` : '');
  }
  function shChestDrop(h, tier, out) { if (!SH_ON() || tier !== 'legendary') return; const D = SH().drops; shGive(h, D.shard.legendary, 0); out.push({ text: `✦ Звёздный осколок ×${D.shard.legendary}`, rarity: 'epic' }); if (Math.random() < D.luck.legendary) { shGive(h, 0, 1); out.push({ text: '🍀 Свиток удачи', rarity: 'epic' }); } }
  function shMimicDrop(h, out) { if (!SH_ON()) return; const D = SH().drops; if (Math.random() < D.shard.mimic) { shGive(h, 1, 0); out.push({ text: '✦ Звёздный осколок', rarity: 'rare' }); } if (Math.random() < D.luck.mimic) { shGive(h, 0, 1); out.push({ text: '🍀 Свиток удачи', rarity: 'rare' }); } }
  function shWeeklyDrop(h, wd) { if (!SH_ON() || !wd || wd.id !== 'wk_party5') return; const n = SH().drops.shard.weeklyParty5; shGive(h, n, 0); log(`✦ ${DN(h)}: за недельное задание — Звёздный осколок ×${n}`, '#e0b0ff'); }
  // ремонт: +10% цены за уровень заточки; вещи 3–4 ряда — ещё железо (1 за каждые 25% износа)
  const shRepairMul = (h, it) => SH_ON() ? 1 + (+SH().repairPerLevel || 0) * shLv(h, it.id) : 1;
  const durIron = (h, it) => { if (!SH_ON() || (it.bs || 1) < (+SH().repairIronFromBs || 3) || !(+SH().repairIronPer25 > 0)) return 0; const wear = (1 - durCur(h, it) / durMax(it)) * 100; return Math.floor(wear / 25) * SH().repairIronPer25; };
  // продажа заточенной вещи с +6: переспрашиваем (второй «Продать» или !да в течение 30 с)
  const CPEND = {}; // ник → { kind, ... , t }
  function pendingConfirm(nick, yes) {
    const n = findNick(nick), h = n && S.heroes[n]; if (!h) return null; const p = CPEND[h.user]; if (!p) return null; delete CPEND[h.user];
    if (Date.now() - p.t > 30000) return res(h, false, 'подтверждение просрочено (30 с) — повтори команду');
    if (!yes) return res(h, false, p.kind === 'sell' ? 'продажа отменена' : 'смена отменена');
    if (p.kind === 'sell') return sellEquip(h.user, p.id, true);
    if (p.kind === 'change') return changeApply(h, p.cls, p.gender, p.hair);
    return null;
  }
  const hasPending = nick => { const n = findNick(nick), h = n && S.heroes[n]; return !!(h && CPEND[h.user] && Date.now() - CPEND[h.user].t <= 30000); };
  // ---------- OBS-эффекты заточки ----------
  const SHFX = [];
  function sfxTone(seq) { try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const a = (window.__shAC = window.__shAC || new AC()); if (a.state === 'suspended') a.resume(); let t = a.currentTime + 0.02; for (const [f, d, v] of seq) { const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.05); t += d * 0.8; } } catch (e) { } }
  function sharpFx(h, it, lv) {
    const rt = ensureRT(h), kind = SH().fx[lv] || (lv >= 10 ? 'legend' : lv >= 9 ? 'banner' : lv >= 8 ? 'flash' : '');
    if (rt && rt.loc) { fxText(rt.x, rt.y - 250, `⚒ +${lv}!`, lv >= 10 ? '#ffd24a' : '#e0b0ff', lv >= 10 ? 56 : 44, 2.6, rt.loc); puff(rt.loc, rt.x, rt.y - 80); }
    if (kind === 'banner' || kind === 'legend') {
      if (SHFX.length > 5) SHFX.shift(); SHFX.push({ kind, t: 0, life: kind === 'legend' ? 8 : 5, text: `${DN(h)} заточил «${it.name}» до +${lv}!`, sub: kind === 'legend' ? 'ЛЕГЕНДАРНАЯ ЗАТОЧКА' : '' });
      sfxTone(kind === 'legend' ? [[392, .28], [494, .28], [587, .28], [784, .6, .16], [988, .9, .16]] : [[523, .2], [659, .2], [784, .45]]);
    }
  }
  function drawSharpFx(dt) {
    for (let i = SHFX.length - 1; i >= 0; i--) { const f = SHFX[i]; f.t += dt; if (f.t >= f.life) SHFX.splice(i, 1); }
    SHFX.forEach((f, i) => {
      const p = f.t / f.life, a = p < 0.08 ? p / 0.08 : p > 0.85 ? Math.max(0, (1 - p) / 0.15) : 1, big = f.kind === 'legend', y = 120 + i * 120;
      ctx.save(); ctx.globalAlpha = a;
      if (big) { const cx = W / 2, cy = y + 36; ctx.save(); ctx.translate(cx, cy); ctx.rotate(f.t * 0.25); for (let k = 0; k < 14; k++) { ctx.rotate(Math.PI * 2 / 14); const g = ctx.createLinearGradient(0, 0, 900, 0); g.addColorStop(0, 'rgba(255,214,90,.45)'); g.addColorStop(1, 'rgba(255,214,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(900, -60); ctx.lineTo(900, 60); ctx.lineTo(0, 18); ctx.fill(); } ctx.restore(); }
      const fs = big ? 44 : 32, w = Math.round(Math.max(measure(f.text, fs), f.sub ? measure(f.sub, 26) : 0) + 90), h2 = big ? 112 : 70, x = Math.round(W / 2 - w / 2);
      ctx.fillStyle = big ? 'rgba(40,24,6,.92)' : 'rgba(30,18,50,.9)'; ctx.fillRect(x, y, w, h2); ctx.strokeStyle = big ? '#ffd24a' : '#c58aff'; ctx.lineWidth = big ? 6 : 4; ctx.strokeRect(x + 2, y + 2, w - 4, h2 - 4);
      if (f.sub) text(f.sub, W / 2, y + 30, 26, '#ffd24a', 'center'); text(f.text, W / 2, y + (f.sub ? 74 : h2 / 2), fs, big ? '#fff2c0' : '#f0dcff', 'center');
      ctx.restore();
    });
  }

  // ---------- постройки до 10 уровня (Сезон 2) ----------
  const BV2 = () => { const v = C.buildingsV2; return v && v.enabled !== false && seasonNo() >= (+v.fromSeason || 2) ? v : null; };
  const bvMax = () => (BV2() && +BV2().maxLv) || 10;
  function bvRow(id, target) {
    const v = BV2(), r = v && v.table && v.table[target]; if (!r) return null; const w = +((v.weight || {})[id] != null ? v.weight[id] : 1);
    return { gold: Math.round(r[0] * w), wood: Math.round(r[1] * w), stone: Math.round(r[2] * w), iron: Math.round(r[3] * w), ch: +r[4], streams: +r[5] || 0, hearts: +r[6] || 0 };
  }
  const bvNeed = row => { const o = {}; if (row.wood) o.wood = row.wood; if (row.stone) o.stone = row.stone; if (row.iron) o.iron = row.iron; return o; };
  function bEffAt(id, k, lv) { const v = BV2(), a = v && v.eff && v.eff[id] && v.eff[id][k]; if (Array.isArray(a)) { let s = 0; for (let i = 2; i <= lv && i < a.length; i++) s += +a[i] || 0; return s; } return bPer(id, k) * (lv - 1); }
  const bEq = (id, lv) => { const v = BV2(); if (!v || !(v.eff && v.eff[id])) return lv - 1; const k = id === 'campfire' ? 'regen' : null; return k && bPer(id, k) ? bEffAt(id, k, lv) / bPer(id, k) : lv - 1; };
  function bvHearts() { const H = S.hearts || {}; return Object.keys(H).filter(k => H[k] > 0); }
  const bvHeartTxt = () => { const H = S.hearts || {}, nm = k => { const d = (BE.bosses || []).find(x => x.id === k); return d ? d.name.replace(/^(Каменный|Проклятый) /, '') : k; }; const ks = Object.keys(H).filter(k => H[k] > 0); return ks.length ? ks.map(k => `${nm(k)} ${H[k]}`).join(', ') : 'нет'; };
  // «шанс/стройка/сердца» для пульта и меню; null — не V2 или максимум
  function bvInfo(id) {
    const v = BV2(); if (!v) return null; const st = S.buildings[id] || { lv: 1 }; if (st.lv >= bvMax()) return { max: true, build: st.build || null };
    const row = bvRow(id, st.lv + 1); if (!row) return null;
    return { ch: row.ch, pity: row.ch < 1 ? Math.min(+((v.fail || {}).pityMax || 0.45), (st.fails || 0) * (+((v.fail || {}).pity) || 0.15)) : 0, streams: row.streams, hearts: row.hearts, haveHearts: bvHearts().length, heartTxt: bvHeartTxt(), build: st.build || null };
  }
  function bvAttempt(id, st, cost, need, b) { // золото и материалы собраны → бросок (ур.2–5 — всегда успех); вернуть { up:true } или { up:false, msg }
    const v = BV2(), row = bvRow(id, st.lv + 1), nl = st.lv + 1;
    if (row.hearts > 0 && bvHearts().length < row.hearts) { st.waitHearts = true; return { up: false, msg: ` — всё собрано, но для ${nl} ур. нужны сердца ${row.hearts} разных боссов (сейчас: ${bvHeartTxt()}). Сердце падает в казну за каждую победу над боссом; как только сердца будут, уровень включится сам` }; }
    const info = bvInfo(id), p = Math.min(1, row.ch + info.pity);
    if (row.ch >= 1 || Math.random() < p) {
      if (row.hearts > 0) { const H = S.hearts, ks = bvHearts().sort((a, c) => H[c] - H[a]).slice(0, row.hearts); ks.forEach(k => H[k]--); }
      if (row.streams > 0) { st.fund -= cost; st.mats = {}; st.fails = 0; st.build = { lv: nl, left: row.streams };
        return { up: false, msg: ` — получилось (шанс ${pct(p)})! Стройка «${b.name}» до ур.${nl}: ещё ${row.streams} ${plural(row.streams, 'стрим', 'стрима', 'стримов')}, пока вкладывать нельзя` }; }
      st.fails = 0; delete st.waitHearts; return { up: true };
    }
    const F = v.fail || {}, lostG = Math.round(cost * (+F.gold || 0.25)); st.fund = Math.max(0, st.fund - lostG); st.fails = (st.fails || 0) + 1;
    for (const m of Object.keys(need)) st.mats[m] = Math.floor((st.mats[m] || 0) * (1 - (+F.mats || 0.30)));
    return { up: false, msg: ` — ЛЕСА РУХНУЛИ! (шанс был ${pct(p)}) Пропало ${lostG} золота и ${pct(+F.mats || 0.3)} материалов, уровень не упал. Следующий шанс выше на +${pct(+F.pity || 0.15)}. Докиньте недостающее — бросок повторится` };
  }
  function bvStreamTick() { // новый стрим: достраиваем стройки
    if (!BV2()) return; BLD.forEach(id => { const st = S.buildings[id]; if (!st || !st.build) return; st.build.left--; if (st.build.left > 0) return;
      st.lv = st.build.lv; delete st.build; const b = C.buildings[id]; log(`★ ${b.name} достроен до ур.${st.lv}!`, '#ffd27a'); fame('build', `${b.name} → ур.${st.lv}`); if (id === 'campfire') S.seats.length = seatCount(); }); }
  function bvKick() { // сердца пришли, а золото и материалы уже собраны: бросок делаем сами (иначе пришлось бы «докидывать» монету)
    if (!BV2()) return; let any = false;
    BLD.forEach(id => { const st = S.buildings[id]; if (!st || !st.waitHearts || st.build) return; const cost = bGold(id, st); if (cost === undefined) { delete st.waitHearts; return; }
      const need = bNeed(id, st); st.mats = st.mats || {}; if (st.fund < cost || !Object.keys(need).every(m => (st.mats[m] || 0) >= need[m])) { delete st.waitHearts; return; }
      const row = bvRow(id, st.lv + 1); if (row.hearts > bvHearts().length) return; delete st.waitHearts; any = true; const b = C.buildings[id], r = bvAttempt(id, st, cost, need, b);
      if (r.msg) log(`🏗 ${b.name}${r.msg}`, '#ffd27a');
      if (r.up) { st.fund -= cost; st.lv++; st.mats = {}; log(`★ ${b.name} теперь ур.${st.lv}!`, '#ffd27a'); fame('build', `${b.name} → ур.${st.lv}`); if (id === 'campfire') S.seats.length = seatCount(); } });
    if (any) { save(); refreshUI(); publishSnapSoon(); } }
  const needBs = it => { const v = BV2(), t = v && v.forgeTiers; return t && t[it.bs] ? t[it.bs] : (it.bs || 1); };
  function bvHeartDrop(b) { if (!BV2()) return; const k = (b && (b.key || b.id)) || 'boss'; S.hearts = S.hearts || {}; S.hearts[k] = (S.hearts[k] || 0) + (+(BV2().bossHeart || {}).perWin || 1); S.heartLog = (S.heartLog || []).concat([[Date.now(), k]]).slice(-20); log(`❤ Сердце босса (${b && b.name || k}) отдано в казну города`, '#ff9c9c'); try { bvKick(); } catch (e) { console.error(e); } }
  function stoneToIron(nick, a) { // рынок ур.6+: !железо [N] — 10 камня → 1 железо
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' }; const v = BV2(), X = v && v.stoneToIron;
    if (!X) return res(h, false, 'обмен камня на железо начнётся в новом сезоне');
    if (bLv('market') < X.marketLv) return res(h, false, `обмен камня на железо — на рынке ур.${X.marketLv} (сейчас ${bLv('market')})`);
    const m = h.rpg_mats || (h.rpg_mats = { wood: 0, stone: 0, iron: 0 }), per = X.stone, have = Math.floor((m.stone || 0) / per); let n = /^\d+$/.test(String(a || '').trim()) ? +a : (String(a || '').trim() ? have : 1);
    if (!String(a || '').trim()) n = 1; n = Math.min(n, have);
    if (n < 1) return res(h, false, `нужно ${per} камня за 1 железо, у тебя ${m.stone || 0}`);
    m.stone -= n * per; m.iron = (m.iron || 0) + n * X.iron; save(); refreshUI(); publishSnapSoon();
    return res(h, true, `рынок: ${n * per} камня → ${n * X.iron} железа ⛓ (всего ${m.iron})`, '#c8f0a8');
  }

  // ---------- бесплатная смена класса / пола / цвета волос ----------
  function changeParse(h, q) {
    const toks = lc(q).replace(/ё/g, 'е').split(/\s+/).filter(Boolean); let cls = null, gender = null, hair = null; const bad = [];
    for (const t of toks) { if (G_WORDS.male.includes(t)) gender = 'male'; else if (G_WORDS.female.includes(t)) gender = 'female'; else if (normClass(t)) cls = normClass(t); else if (HAIR_ON() && hairResolve(t)) hair = hairResolve(t).id; else bad.push(t); }
    return { cls, gender, hair, bad };
  }
  function changeCmd(nick, q) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    if (!(+h.rpg_freeChange > 0)) return res(h, false, 'бесплатной смены класса и облика у тебя нет (она даётся один раз в начале сезона)');
    const FC = SEASON().freeChange; q = String(q || '').trim();
    if (!q) return res(h, true, `бесплатная смена (1 раз): !смена <класс> <пол> [цвет волос], например «!смена маг ж»${HAIR_ON() ? ' рыжий' : ''}. Сейчас: ${className(h)}, ${h.rpg_gender === 'female' ? 'ж' : 'м'}. Классы: ${C.classes.map(c => c.name).join(', ')}`);
    const p = changeParse(h, q); if (p.bad.length) return res(h, false, `не поняла: «${p.bad.join(' ')}». Пример: !смена маг ж`);
    const cls = FC.cls === false ? h.rpg_class : (p.cls || h.rpg_class), gender = FC.gender === false ? h.rpg_gender : (p.gender || h.rpg_gender), hair = FC.hair === false || !HAIR_ON() ? (h.rpg_hair || '') : (p.hair || h.rpg_hair || '');
    if (cls === h.rpg_class && gender === h.rpg_gender && hair === (h.rpg_hair || '')) return res(h, false, 'ничего не меняется — выбери другой класс, пол или цвет');
    const busy = shBusyAny(h); if (busy) return res(h, false, 'сменить облик можно только в лагере, не в походе и не в бою — ' + busy);
    if (FC.confirm === false || PANEL_QUIET) return changeApply(h, cls, gender, hair);
    CPEND[h.user] = { kind: 'change', cls, gender, hair, t: Date.now() };
    return res(h, true, `Точно сменить на «${clsById(cls).name}», ${gender === 'female' ? 'женский' : 'мужской'} пол${HAIR_ON() && hair ? ', волосы ' + ((hairById(hair) || {}).name || hair) : ''}? Второй раз бесплатно не будет. Напиши !да в течение 30 с`);
  }
  const shBusyAny = h => { const b = blocked(h, 'town'); if (b) return b.replace(/^нельзя: /, ''); return BATTLES.some(x => x.user === h.user) ? 'герой в бою' : ''; };
  function changeApply(h, cls, gender, hair) {
    if (!(+h.rpg_freeChange > 0)) return res(h, false, 'бесплатной смены уже нет');
    const was = `${className(h)} ${h.rpg_gender === 'female' ? '♀' : '♂'}`, refund = [];
    h.rpg_class = cls; h.rpg_gender = gender; if (hair) h.rpg_hair = hair; if (BARB_ON() && !hairOk(h, hairById(h.rpg_hair))) h.rpg_hair = 'chestnut'; // v49.7: распущенные — только у магини
    // вещи прежнего класса возвращаем деньгами (100% цены), заточка пропадает
    eqOf(h); for (const id of (h.rpg_eqOwn || []).slice()) { const it = eqItem(id); if (it && !eqAllowed(h, it)) { h.rpg_eqOwn = h.rpg_eqOwn.filter(x => x !== id); for (const s in h.rpg_equip) if (h.rpg_equip[s] === id) delete h.rpg_equip[s]; if (h.rpg_sharp) delete h.rpg_sharp[id]; if (h.rpg_sharpPity) delete h.rpg_sharpPity[id]; if (h.rpg_dur) delete h.rpg_dur[id]; h.rpg_gold += it.price || 0; refund.push(`${it.name} +${it.price || 0} з`); } }
    h.rpg_freeChange = 0; h.rpg_hp = stats(h).maxhp; const rt = ensureRT(h); rt.sit6 = false;
    log(`🎭 ${DN(h)}: смена облика — ${was} → ${className(h)} ${gender === 'female' ? '♀' : '♂'}`, '#ffd27a'); save(); refreshUI(); publishSnapSoon();
    return res(h, true, `теперь ${className(h)} ${gender === 'female' ? '♀' : '♂'} (бесплатная смена использована)` + (refund.length ? `; вещи прежнего класса проданы за полную цену: ${refund.join(', ')}` : ''), '#ffd27a');
  }

  // ---------- данные для пульта (компактно; старый пульт их игнорирует, новый прячет блоки без них) ----------
  function panelSharp(h) {
    if (!SH_ON()) return undefined; const m = {}, p = {}; for (const id in (h.rpg_sharp || {})) if (h.rpg_sharp[id] > 0) m[id] = h.rpg_sharp[id]; for (const id in (h.rpg_sharpPity || {})) if (h.rpg_sharpPity[id] > 0) p[id] = h.rpg_sharpPity[id];
    const X = SH().drops.luckCraft, wk = weekKey(), n = h.rpg_luckCraft && h.rpg_luckCraft.wk === wk ? h.rpg_luckCraft.n : 0;
    // v8.1: готовые расчёты по слотам для кнопки «Заточка» на пульте: [слот, название, +сейчас, +цель, шанс, шанс со свитком, золото, осколки, железо, откат при неудаче, max, сломана]
    const q = ['weapon', 'armor', 'offhand'].map(s => { const a = shQuote(h, s), b = shQuote(h, s, true); if (a.empty) return [s, '', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      if (a.max) return [s, a.it.name, a.lv, a.lv, 0, 0, 0, 0, 0, 0, 1, 0];
      return [s, a.it.name, a.lv, a.tgt, Math.round(a.p * 100), Math.round(b.p * 100), a.c.gold, a.c.shards, a.c.iron, a.fail ? SH().failTo : 0, 0, DUR() && durCur(h, a.it) <= 0 ? 1 : 0]; });
    const LC = X; return { s: h.rpg_shards || 0, l: h.rpg_luck || 0, b: h.rpg_sharpBest || 0, m, p, k: Math.max(0, X.perWeek - n), q, bz: shBusy(h) || '', lc: [bLv('blacksmith') >= LC.blacksmithLv ? 1 : 0, LC.blacksmithLv, LC.iron, LC.wood, LC.gold, LC.perWeek] };
  }
  function panelSharpRef() {
    if (!SH_ON()) return undefined; const X = SH(), D = X.drops;
    return { ch: X.chance, cost: X.cost, om: X.offhandCost.goldMul, oi: X.offhandCost.iron, pt: [X.pity, X.pityMax], lk: X.luckScroll.bonus, fg: forgeBonus(), ft: X.failTo, sc: X.sellConfirmFrom,
      w: X.weapon.atkPer, a: [X.armor.hpPer, X.armor.defAt], od: [X.offhand.def.hpPer, X.offhand.def.defAt], oa: X.offhand.atk.atkAt, rp: X.repairPerLevel,
      cr: [D.luckCraft.blacksmithLv, D.luckCraft.iron, D.luckCraft.wood, D.luckCraft.gold, D.luckCraft.perWeek], ds: D.shard, dl: D.luck, /* v8.1: откуда падают осколки и свитки — для справки на пульте */
      oaI: EQ().items.filter(i => shKind(i) === 'oa').map(i => i.id), mgI: EQ().items.filter(i => i.slot === 'weapon' && i.mag && !i.atk).map(i => i.id), tmI: EQ().items.filter(i => i.kind === 'tome').map(i => i.id) };
  }
  const seasonDays = () => { const t = seasonStartMs(); return isFinite(t) ? (t - Date.now()) / 86400000 : Infinity; };
  const seasonAnnounceOn = () => seasonTarget() > seasonNo() && seasonDays() > 0 && seasonDays() <= (+SEASON().announceDays || 0);
  function seasonBannerText() {
    if (seasonAnnounceOn()) { const sec = Math.max(0, (seasonStartMs() - Date.now()) / 1000); return `🏆 До «${SEASON().name || 'Сезон ' + seasonTarget()}» осталось ${fmtTime(sec)} — героев ждёт вайп, титулы и бесплатная смена облика`; }
    if (S.seasonBannerUntil && S.seasonBannerUntil > Date.now()) return `🏆 ${SEASON().name || 'Сезон ' + seasonNo()} начался! Бесплатная смена класса и облика: !смена · итоги прошлого сезона на пульте`;
    return '';
  }
  function panelSeasonRef() {
    const C0 = C.season; if (!C0 && seasonNo() <= 1) return undefined; const tgt = seasonTarget(), o = { cur: seasonNo(), id: tgt, nm: SEASON().name || '' };
    if (tgt > seasonNo() && isFinite(seasonStartMs())) { o.at = seasonStartMs(); o.ad = +SEASON().announceDays || 0; }
    const prev = S.seasons && S.seasons[seasonNo() - 1]; if (prev && (!S.seasonAt || Date.now() - S.seasonAt < (+SEASON().summaryDays || 14) * 86400000)) o.sum = prev;
    if (S.guildStars) o.gst = S.guildStars;
    return (o.at || o.sum || o.gst || seasonNo() > 1) ? o : undefined;
  }
  function panelSeasonMe(h) { const s = h.rpg_seasons && h.rpg_seasons[seasonNo() - 1]; if (!s || !S.seasonAt || Date.now() - S.seasonAt > (+SEASON().summaryDays || 14) * 86400000) return undefined; return { sc: s.sc, lp: s.lp, wp: s.wp, sp: s.sp, lv: s.lv, w: s.w, b: s.best, r: s.r, n: s.n, md: s.md, v: s.vet ? 1 : 0, g: s.bane ? 1 : 0, tt: s.tt }; }
  const bGold = (id, st) => { if (BV2()) { if (st.lv >= bvMax()) return undefined; const r = bvRow(id, st.lv + 1); return r ? r.gold : undefined; } return C.buildings[id].costs[st.lv - 1]; };
  const bNeed = (id, st) => { if (BV2()) { const r = st.lv >= bvMax() ? null : bvRow(id, st.lv + 1); return r ? bvNeed(r) : {}; } return matsFor(st.lv + 1); };
  const bMaxN = id => BV2() ? bvMax() : C.buildings[id].costs.length + 1;
  const bvLine = inf => { const v = inf.v2; if (!v || v.max) return ''; if (v.build) return `Стройка до ур.${v.build.lv}: ещё ${v.build.left} ${plural(v.build.left, 'стрим', 'стрима', 'стримов')} (вкладывать нельзя)`; const parts = []; if (v.ch < 1) parts.push(`шанс ${pct(Math.min(1, v.ch + v.pity))}${v.pity ? ` (упорство +${pct(v.pity)})` : ''}`); if (v.streams) parts.push(`стройка ${v.streams} ${plural(v.streams, 'стрим', 'стрима', 'стримов')}`); if (v.hearts) parts.push(`сердца ${v.hearts} разных боссов (в казне: ${v.heartTxt})`); return parts.length ? 'Уровень ' + (inf.lv + 1) + ': ' + parts.join(', ') : ''; };
  function sharpBarHtml(h) {
    if (!SH_ON()) return ''; const rows = ['weapon', 'armor', 'offhand'].map(s => { const q = shQuote(h, s); if (q.empty) return ''; if (q.max) return `<div class="hw-si"><span>${esc(SH_SLOT_NAME[s])}: ${esc(q.it.name)} +10<small>максимум</small></span></div>`;
      return `<div class="hw-si"><span>${esc(SH_SLOT_NAME[s])}: ${esc(q.it.name)} +${q.lv} → +${q.tgt}<small>шанс ${pct(q.p)} · ${q.c.gold} з${q.c.shards ? ` · ✦${q.c.shards}` : ''}${q.c.iron ? ` · ⛓${q.c.iron}` : ''}${q.fail ? ' · при неудаче откат до +' + SH().failTo : ''}</small></span>${hbtn('!заточка ' + SH_SLOT_NAME[s], 'Заточить', !q.ok)}${(h.rpg_luck || 0) > 0 && q.fail ? hbtn('!заточка ' + SH_SLOT_NAME[s] + ' удача', '🍀', !q.ok) : ''}</div>`; }).join('');
    return `<div class="hw-rep"><b>⚒ Заточка</b><small class="sm">✦ осколков: ${h.rpg_shards || 0} · 🍀 свитков: ${h.rpg_luck || 0}</small>${rows}</div>`;
  }

  // ===================== ПОСТРОЙКИ: УЛУЧШЕНИЯ ЗА ЗОЛОТО (+ материалы на поздних уровнях) =====================
  const bMaxLv = id => bMaxN(id);
  const matsFor = lv => C.buildingMats[lv] || {}; // материалы, нужные для перехода НА уровень lv
  function bInfo(id) {
    const b = C.buildings[id], st = S.buildings[id], cost = bGold(id, st);
    const need = cost === undefined ? {} : bNeed(id, st); st.mats = st.mats || {};
    const nextEff = Object.entries(b.per).map(([k, v]) => `${k}: ${+(v * st.lv).toFixed(2)}`).join(', ');
    return { v2: bvInfo(id), id, name: b.name, lv: st.lv, max: cost === undefined, fund: st.fund, cost, need, have: st.mats, effect: bText(id, st.lv), nextEffect: cost === undefined ? null : bText(id, st.lv + 1), next: nextEff };
  }
  // v6.55 п.13: постройка по id, русскому имени (начало слова) или номеру 1..N
  function bldResolve(q) {
    const s = String(q || '').trim().toLowerCase().replace(/ё/g, 'е'); if (!s) return null;
    if (C.buildings[s]) return s; const i = +s; if (i >= 1 && i <= BLD.length) return BLD[i - 1];
    return BLD.find(k => C.buildings[k].name.toLowerCase().replace(/ё/g, 'е') === s) || BLD.find(k => C.buildings[k].name.toLowerCase().replace(/ё/g, 'е').startsWith(s)) || null;
  }
  // v7panel18: вклад золотом или материалами. Курс докупки материала золотом — C.donateMatPrice (умолчания ниже)
  const DMP_DEF = { wood: 5, stone: 8, iron: 15 };
  const DMP = () => Object.assign({}, DMP_DEF, C.donateMatPrice || {});
  function matResolve(q) { const s = String(q || '').toLowerCase().replace(/ё/g, 'е'); if (!s) return null;
    const M = C.materials || []; const m = M.find(x => x.id === s) || M.find(x => x.name.toLowerCase().replace(/ё/g, 'е') === s) || (s.length >= 3 ? M.find(x => x.name.toLowerCase().replace(/ё/g, 'е').startsWith(s)) : null); return m ? m.id : null; }
  function donateCmd(nick, a) { // !вклад <постройка> [сумма|всё] | !вклад <постройка> <материал> [кол-во] [золотом]
    const p = String(a || '').trim().split(/\s+/).filter(Boolean); let buy = false, mat = null, n = '';
    if (p.length > 1 && /^(золотом|докупить|купить)$/i.test(p[p.length - 1])) { buy = true; p.pop(); }
    let amt = p.length > 1 && /^(\d+|все|всё|all)$/i.test(p[p.length - 1]) ? p.pop() : '';
    if (p.length > 1 && matResolve(p[p.length - 1])) { mat = matResolve(p.pop()); n = amt; amt = ''; }
    if (/^(все|всё|all)$/i.test(amt)) amt = 'all';
    const bid = bldResolve(p.join(' ')) || p.join(' ');
    if (mat || buy) return donate(nick, bid, '', { mat, n, buy });
    return donate(nick, bid, amt);
  }
  function donate(nick, bid, amount, mo) {
    const h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' }; // v6.55: раньше создавал героя
    bid = bldResolve(bid) || bid; const b = C.buildings[bid];
    if (!b) return res(h, false, '!вклад <постройка> <сумма> или !вклад <постройка> <материал> <кол-во> [золотом], постройки: ' + BLD.map((k, i) => `${i + 1}) ${C.buildings[k].name}`).join(', '));
    const st = S.buildings[bid], cost = bGold(bid, st); st.mats = st.mats || {};
    if (cost === undefined) return res(h, false, `${b.name} уже максимального уровня`);
    if (st.build) return res(h, false, `«${b.name}» сейчас строится до ур.${st.build.lv}: ещё ${st.build.left} ${plural(st.build.left, 'стрим', 'стрима', 'стримов')} — вкладывать пока нельзя`);
    const need = bNeed(bid, st); const gaveM = []; let a = 0, paid = 0;
    const left = m => Math.max(0, (need[m] || 0) - (st.mats[m] || 0));
    if (mo) { // материалами (из сумки; с «золотом» — недостающее докупается по курсу, золото в казну не идёт)
      const lst = Object.keys(need).filter(m => left(m) > 0);
      if (!mo.mat) { if (!lst.length) return res(h, false, `«${b.name}»: материалы уже собраны, нужно только золото`); mo.mat = lst[0]; }
      const m = mo.mat, L = left(m);
      if (!L) return res(h, false, `«${b.name}» сейчас не нужно: ${matName(m)}` + (lst.length ? ` (нужно: ${lst.map(x => `${matName(x)} ${left(x)}`).join(', ')})` : ''));
      let want = mo.n === 'all' || mo.n === '' || mo.n == null ? L : Math.floor(+mo.n || 0); want = Math.max(0, Math.min(want, L));
      if (!want) return res(h, false, 'укажи количество');
      const have = +(h.rpg_mats[m] || 0), fromBag = Math.min(have, want), miss = want - fromBag, price = DMP()[m] || 0;
      if (miss > 0 && !mo.buy) { if (!fromBag) return res(h, false, `нет материала: ${matName(m)} 0/${want}. Докупить: !вклад ${b.name.toLowerCase()} ${matName(m).toLowerCase()} ${want} золотом (${miss}×${price} = ${miss * price} з)`); want = fromBag; }
      const buyN = mo.buy ? want - fromBag : 0; paid = buyN * price;
      if (paid > h.rpg_gold) return res(h, false, `не хватает золота: докупить ${matName(m)} ${buyN}×${price} = ${paid} з, у тебя ${h.rpg_gold}`);
      h.rpg_mats[m] = have - fromBag; h.rpg_gold -= paid; st.mats[m] = (st.mats[m] || 0) + want;
      gaveM.push(`${matName(m)} ${want}` + (buyN ? ` (докуплено ${buyN} за ${paid} з)` : ''));
    } else {
      a = amount === 'all' || amount === undefined || amount === '' ? h.rpg_gold : Math.floor(+amount || 0);
      a = Math.max(0, Math.min(a, h.rpg_gold, cost - st.fund));
      if (a <= 0) return res(h, false, st.fund >= cost ? `золото на «${b.name}» собрано, нужны материалы: ${Object.keys(need).filter(m => left(m)).map(m => `${matName(m)} ${left(m)}`).join(', ')} (!вклад ${b.name.toLowerCase()} <материал> <кол-во>)` : `нечего вложить (золото ${h.rpg_gold})`);
      h.rpg_gold -= a; h.rpg_donated += a; st.fund += a; goalAdd('invest', a, h);
    }
    const p = BUILD_POS[bid];
    // v7panel20 п.5: герой сначала идёт к постройке, у неё — пузырь «улучшает…», потом результат (надпись/уровень) на экране
    const FXQ = []; if (a) FXQ.push(() => fxText(p.x, p.y - 260, `+${a}`, '#ffd27a', 36, 2, p.loc));
    let msg = `вкладывает ${gaveM.length ? gaveM.join(', ') : a + ' золота'} в «${b.name}» (золото ${st.fund}/${cost}${Object.keys(need).length ? ', ' + Object.entries(need).map(([m, n]) => `${matName(m)} ${st.mats[m] || 0}/${n}`).join(', ') : ''})`;
    const matsOk = Object.entries(need).every(([m, n]) => (st.mats[m] || 0) >= n);
    const _bv = st.fund >= cost && matsOk && BV2() ? bvAttempt(bid, st, cost, need, b) : null; // v49: ур.6+ — бросок, стройка, сердца
    if (_bv && !_bv.up) msg += _bv.msg;
    else if (st.fund >= cost && matsOk) {
      st.fund -= cost; st.lv++; st.mats = {};
      msg += ` — ${b.name} теперь ур.${st.lv}!`;
      const nl = st.lv; FXQ.push(() => { log(`★ ${b.name} улучшен до ур.${nl}: ${bText(bid, nl)}`, '#ffd27a'); fame('build', `${b.name} → ур.${nl}` + (bText(bid, nl) !== b.effect ? ` (${bText(bid, nl)})` : '')); fxText(p.x, p.y - 320, `${b.name}: ур.${nl}!`, '#ffd27a', 48, 3, p.loc); });
      if (bid === 'campfire') S.seats.length = seatCount();
    } else if (st.fund >= cost) msg += ` — не хватает материалов: ${Object.entries(need).map(([m, n]) => `${matName(m)} ${st.mats[m] || 0}/${n}`).join(', ')}`;
    bump(p.loc, 4);
    const runFX = () => FXQ.forEach(f => f());
    const went = !blocked(h, 'town') && goDo(h, p.loc, p.x + (p.loc === 'town' ? -110 : 0), p.y + 30, 'улучшает…', C.townStaySeconds, 2, () => setTimeout(runFX, 1200), true);
    if (!went) runFX(); else msg = `идёт к «${b.name}» и улучшает: ` + msg;
    return res(h, true, msg, '#ffe27a');
  }

  // ===================== v6.32: СТРИМ — ЦЕЛЬ СТРИМА, ГЕРОЙ ДНЯ, ИТОГ, ЯРМАРКА =====================
  // S.stream хранится в сохранении (игра открыта не всегда): цель, прогресс, статистика героев за стрим.
  const SG = C.streamGoals || { list: [] }, FAIR = C.fair || { minutes: 30, bonusVeg: 1, bonusPumpkin: 10, schedule: { enabled: false, times: [] } };
  let STREAMCARD = false, BANNER_ON = false;
  function goalText(g) { return g ? String(g.text || g.id).replace('{n}', g.need) : ''; }
  function goalSay(kind, extra) {
    const s = S.stream, g = s && s.goal; if (!g) return;
    const t = kind === 'start' ? `🎯 Цель стрима: ${goalText(g)}! Награда — деревянный сундук каждому участнику.`
      : kind === 'done' ? `🏆 Цель стрима выполнена: ${goalText(g)}! ${extra || ''}`.trim()
      : `🎯 Цель стрима: ${goalText(g)} — ${g.prog}/${g.need} (${extra}%)`;
    emitBot({ event: 'goalAnnounce', kind, goal: g.id, prog: g.prog, need: g.need, text: t });
    log(t, '#ffd27a');
  }
  function streamNew(why, goalId) {
    const old = S.stream; if (old && !old.finished && old.stats && Object.keys(old.stats).length) streamFinish(old);
    const list = (SG.list || []).filter(g => g.enabled !== false && g.need > 0);
    const d = goalId ? list.find(g => g.id === goalId) : list[Math.floor(Math.random() * list.length)];
    S.stream = { id: Date.now().toString(36), start: Date.now(), why: why || '', stats: {}, loot: 0, lootTop: [], gold: 0, finished: false, hero: null,
      goal: d ? { id: d.id, type: d.type, text: d.text, need: d.need, prog: 0, done: false, ms: 0, doneAt: 0, rewarded: 0, t0: Date.now(), ev: 0 } : null };
    S.stream.base = {}; for (const u in S.heroes) S.stream.base[u] = recapCounters(S.heroes[u]); // v6.41: точка отсчёта для повтора итогов
    if (d) goalSay('start');
    try { bvStreamTick(); } catch (e) { console.error(e); } // v49: достройка зданий (1–2 стрима после удачного броска)
    return S.stream;
  }
  const streamCur = () => S.stream || streamNew('авто');
  // v6.41: накопительные счётчики героя — повтор итогов считает разницу «сейчас − начало стрима» (герой, созданный в этом стриме, — от нуля)
  const RC_KEYS = ['rpg_expeditions', 'rpg_deaths', 'rpg_kills', 'rpg_cooked', 'rpg_harvests', 'rpg_questsDone', 'rpg_donated', 'rpg_chestsGot', 'rpg_legendary', 'rpg_bossWins', 'rpg_level', 'rpg_potionsBrewed', 'rpg_partyExpeditions'];
  function recapCounters(h) { const o = {}; RC_KEYS.forEach(k => o[k] = +h[k] || 0); o.mats = Object.values(h.rpg_mats || {}).reduce((a, b) => a + (+b || 0), 0); return o; }
  function sStat(h, k, n) {
    if (!h || !n) return; const s = streamCur();
    const st = s.stats[h.user] || (s.stats[h.user] = { dmg: 0, heal: 0, inv: 0, kills: 0, exp: 0, cook: 0, veg: 0, gold: 0, loot: 0 });
    st[k] = (st[k] || 0) + n;
  }
  const W8 = SG.contribWeights || { kills: 20, exp: 60, cook: 40, veg: 6, inv: 1, loot: 0 };
  const contribOf = st => Math.round(Object.keys(W8).reduce((a, k) => a + (st[k] || 0) * W8[k], 0));
  const scoreOf = st => Math.round(st.dmg + st.heal + contribOf(st));
  function goalAdd(type, n, h) {
    n = +n || 0; if (n <= 0) return;
    if (h) sStat(h, { harvest: 'veg', expedition: 'exp', cook: 'cook', kill: 'kills', invest: 'inv' }[type] || type, n);
    const s = streamCur(), g = s.goal; if (!g || g.done || g.type !== type) return;
    if (!g.t0) g.t0 = Date.now(); g.ev = (g.ev || 0) + 1;
    g.prog = Math.min(g.need, g.prog + n);
    // v6.34: цель не выполняется «в ту же секунду» — раньше goalMinSec после старта прогресс держится на need−1, добьёт следующее событие
    if (g.prog >= g.need && Date.now() - g.t0 < (SG.goalMinSec ?? 30) * 1000) g.prog = g.need - 1;
    const pct = Math.floor(g.prog / g.need * 100), ms = (SG.milestones || [25, 50, 75]).filter(m => pct >= m).length;
    if (g.prog >= g.need) goalDone();
    else if (ms > g.ms) { g.ms = ms; goalSay('progress', (SG.milestones || [25, 50, 75])[ms - 1]); }
  }
  function goalDone() {
    const s = S.stream, g = s.goal; if (!g || g.done || g.rewarded || g.doneAt) return; // награда — строго один раз
    g.done = true; g.prog = g.need; g.doneAt = Date.now();
    const tier = SG.rewardChest || 'wooden', users = Object.keys(s.stats).filter(u => S.heroes[u]);
    users.forEach(u => { const h = S.heroes[u]; const items = giveChestQuiet(h, tier); s.loot += items.length; });
    g.rewarded = users.length;
    fame('goal', `Цель стрима: ${goalText(g)} — ${users.length} ${plural(users.length, 'участник', 'участника', 'участников')}`);
    clog(`🏆 Цель стрима выполнена! Сундук: ${users.length} героям`, '#ffd27a');
    lootPopup('Цель стрима', `🏆 ${goalText(g)}`, [`${C.chests[tier] ? C.chests[tier].name : tier} — ${users.length} участникам`], '#ffd27a');
    goalSay('done', `${users.length} ${plural(users.length, 'участник', 'участника', 'участников')} получили ${C.chests[tier] ? C.chests[tier].name.toLowerCase() : 'сундук'}.`);
    save();
  }
  function heroOfDay(s) {
    s = s || S.stream; if (!s) return null;
    const arr = Object.entries(s.stats).map(([u, st]) => ({ user: u, dmg: Math.round(st.dmg), heal: Math.round(st.heal), contrib: contribOf(st), score: scoreOf(st), st }))
      .filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    return arr.length ? Object.assign(arr[0], { list: arr }) : null;
  }
  function streamSummary() {
    const s = streamCur(), hd = heroOfDay(s), list = hd ? hd.list : [];
    const top = (k) => list.slice().sort((a, b) => b[k] - a[k]).filter(x => x[k] > 0).slice(0, 3).map(x => ({ user: x.user, v: x[k] }));
    const G = recapGuilds();
    return { id: s.id, start: s.start, min: Math.round((Date.now() - s.start) / 60000), heroes: list.length,
      hero: hd ? { user: hd.user, dmg: hd.dmg, heal: hd.heal, contrib: hd.contrib, score: hd.score } : null,
      topDmg: top('dmg'), topHeal: top('heal'), topContrib: top('contrib'),
      loot: s.loot, lootTop: s.lootTop.slice(0, 4), gold: Math.round(s.gold),
      goal: s.goal ? { text: goalText(s.goal), prog: s.goal.prog, need: s.goal.need, done: s.goal.done, rewarded: s.goal.rewarded } : null, fair: fairActive(),
      guilds: G.map(g => ({ name: g.name, n: g.n, exp: g.exp, quests: g.quests, dmg: g.dmg, gold: g.gold, chests: g.chests, score: g.score })),
      topGuild: G[0] ? { name: G[0].name, n: G[0].n, score: G[0].score } : null };
  }
  function heroLine(hd) { return `👑 Герой дня: ${hd.user} — урон ${hd.dmg}, лечение ${hd.heal}, вклад ${hd.contrib}`; }
  function streamFinish(s) {
    s = s || S.stream; if (!s || s.finished) return null; s.finished = true;
    const hd = heroOfDay(s); if (hd) { s.hero = hd.user; clog(heroLine(hd), '#ffd27a'); fame('heroday', `Герой дня: ${hd.user}`); log(heroLine(hd), '#ffd27a'); }
    return hd;
  }
  // ===================== v6.41: УСКОРЕННЫЙ ПОВТОР ИТОГОВ СТРИМА =====================
  const RCP = Object.assign({ cardSec: 8, minSec: 7, maxSec: 12, perLineSec: 0.6, speed: 1 }, C.recap || {}, C.recapCardSec ? { cardSec: C.recapCardSec } : {}, C.recapSpeed ? { speed: C.recapSpeed } : {}); let RECAP = null;
  function recapData() {
    const s = streamCur(), base = s.base || {}, rows = [];
    const users = new Set(Object.keys(s.stats)); for (const u in S.heroes) { const b = base[u], c = recapCounters(S.heroes[u]); if (!b ? S.heroes[u].rpg_created >= s.start : RC_KEYS.some(k => c[k] !== b[k])) users.add(u); }
    users.forEach(u => { const h = S.heroes[u]; if (!h) return; const c = recapCounters(h), b = base[u] || (h.rpg_created >= s.start ? { rpg_level: 1 } : c), st = s.stats[u] || {}, d = k => Math.max(0, (c[k] || 0) - (b[k] || 0));
      rows.push({ user: u, exp: d('rpg_expeditions'), deaths: d('rpg_deaths'), kills: d('rpg_kills'), cook: d('rpg_cooked'), harv: d('rpg_harvests'), quests: d('rpg_questsDone'), inv: d('rpg_donated'), chests: d('rpg_chestsGot'), legend: d('rpg_legendary'), lv: d('rpg_level'), brew: d('rpg_potionsBrewed'), boss: d('rpg_bossWins'),
        mats: Math.max(0, c.mats - (b.mats || 0)), seeds: st.seeds || 0, sold: st.sold || 0, soldGold: Math.round(st.soldGold || 0), expGold: Math.round(st.expGold || 0), gold: Math.round(st.gold || 0), rez: st.rez || 0 }); });
    return { s, rows, sum: k => rows.reduce((a, r) => a + (r[k] || 0), 0), top: (k, n) => rows.filter(r => r[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, n || 3) };
  }
  // v49.10: активность гильдий за стрим — из тех же дельт, что остальные итоги (сбрасывается вместе со стримом)
  function recapGuilds(D) {
    D = D || recapData();
    const map = {};
    D.rows.forEach(r => {
      const h = S.heroes[r.user], gid = (h && h.rpg_guild) || '';
      if (!gid) return;
      const g = map[gid] || (map[gid] = { id: gid, name: (guildById(gid) || { name: gid }).name, n: 0, exp: 0, quests: 0, kills: 0, chests: 0, gold: 0, dmg: 0, heal: 0, boss: 0 });
      const st = (D.s.stats || {})[r.user] || {};
      g.n++; g.exp += r.exp || 0; g.quests += r.quests || 0; g.kills += r.kills || 0; g.chests += r.chests || 0; g.gold += Math.round(r.gold || 0); g.boss += r.boss || 0;
      g.dmg += Math.round(st.dmg || 0); g.heal += Math.round(st.heal || 0);
    });
    const b = D.s.boss; if (b && b.guilds) b.guilds.forEach(x => { const g = Object.values(map).find(y => y.name === x.name || y.id === x.gid); if (g) g.bossDmg = x.dmg; });
    return Object.values(map).map(g => Object.assign(g, { score: g.dmg + g.heal + g.exp * 60 + g.kills * 20 + g.quests * 40 + g.chests * 30 + g.gold })).sort((a, c) => c.score - a.score || c.n - a.n);
  }
  function recapCards() {
    const D = recapData(), s = D.s, sm = streamSummary(), cards = [], nm = u => u.length > 16 ? u.slice(0, 15) + '…' : u;
    const lines = (arr, f) => arr.map((r, i) => `${i + 1}. ${nm(r.user)} — ${f(r)}`);
    cards.push({ icon: '📜', title: 'ИТОГИ СТРИМА', sub: `${new Date(s.start).toLocaleDateString('ru-RU')} · ${sm.min} ${plural(sm.min, 'минута', 'минуты', 'минут')} · героев: ${D.rows.length}`, lines: ['Ускоренный повтор: что было за стрим'] });
    if (D.sum('exp')) cards.push({ icon: '🌲', title: 'Походы', sub: `${D.sum('exp')} походов · ${D.sum('kills')} монстров ${D.sum('expGold') ? ` · +${D.sum('expGold')} золота` : ''}`, lines: lines(D.top('exp'), r => `${r.exp} ${plural(r.exp, 'поход', 'похода', 'походов')}${r.expGold ? `, +${r.expGold} золота` : ''}`) });
    if (D.sum('mats') + D.sum('chests') + D.sum('seeds') + D.sum('harv')) cards.push({ icon: '💰', title: 'Добыча', sub: `золото +${sm.gold} · ингредиенты ${D.sum('mats')} · сундуки ${D.sum('chests')} · семена ${D.sum('seeds')} · урожай ${D.sum('harv')}`, lines: lines(D.top('chests').length ? D.top('chests') : D.top('mats'), r => `сундуков ${r.chests}, ингредиентов ${r.mats}`).concat(sm.lootTop.length ? ['Лучшее: ' + sm.lootTop.slice(0, 2).map(l => `${nm(l.user)} — ${l.text}`).join(' · ')] : []) });
    if (D.sum('deaths')) cards.push({ icon: '💀', title: 'Павшие', sub: `героев пало: ${D.sum('deaths')} раз`, lines: lines(D.top('deaths'), r => `${r.deaths} раз`) });
    if (D.sum('inv') + D.sum('lv')) cards.push({ icon: '🔨', title: 'Вложения и прокачка', sub: `в постройки: ${D.sum('inv')} золота · уровней получено: ${D.sum('lv')}`, lines: lines(D.top('inv').length ? D.top('inv') : D.top('lv'), r => `вклад ${r.inv} золота, +${r.lv} ${plural(r.lv, 'уровень', 'уровня', 'уровней')}`) });
    if (D.sum('sold')) cards.push({ icon: '🛒', title: 'Торговля', sub: `продано ${D.sum('sold')} ${plural(D.sum('sold'), 'овощ', 'овоща', 'овощей')} на ${D.sum('soldGold')} золота`, lines: lines(D.top('soldGold'), r => `${r.sold} ${plural(r.sold, 'овощ', 'овоща', 'овощей')} → ${r.soldGold} золота`) });
    if (D.sum('cook') + D.sum('quests') + D.sum('brew')) cards.push({ icon: '🍲', title: 'Готовка и квесты', sub: `блюд: ${D.sum('cook')} · зелий: ${D.sum('brew')} · квестов: ${D.sum('quests')}`, lines: lines(D.top('cook').length ? D.top('cook') : D.top('quests'), r => `блюд ${r.cook}, квестов ${r.quests}`) });
    if (sm.goal) cards.push({ icon: '🎯', title: 'Цель стрима', sub: sm.goal.text, goal: sm.goal, lines: [sm.goal.done ? `✔ Выполнена! Сундук получили ${sm.goal.rewarded} ${plural(sm.goal.rewarded, 'участник', 'участника', 'участников')}` : `Прогресс ${sm.goal.prog}/${sm.goal.need} — в следующий раз!`] });
    const b = s.boss; if (b) cards.push({ icon: b.killed ? '🏆' : '☠', title: b.killed ? `${b.name} ${gv(b.name,'повержен','повержена')}!` : `${b.name} ${gv(b.name,'ушёл','ушла')}`, sub: `отряд: ${b.squad} ${plural(b.squad, 'герой', 'героя', 'героев')}${b.guilds.length ? ' · гильдии: ' + b.guilds.map(g => g.name).join(', ') : ''}`, win: b.killed,
      lines: [b.mvpDmg ? `⚔ MVP урон: ${nm(b.mvpDmg.user)} — ${b.mvpDmg.v} урона` : '', b.mvpHeal ? `✚ MVP лечение: ${nm(b.mvpHeal.user)} — ${b.mvpHeal.v} HP` : '', b.mvpRez ? `✝ Воскрешений: ${nm(b.mvpRez.user)} — ${b.mvpRez.v}` : '', `Награда: ${b.reward}`].filter(Boolean) });
    { const G = recapGuilds(D); if (G.length) { const top = G[0], nAll = G.reduce((a, g) => a + g.n, 0);
      cards.push({ icon: '🛡', title: 'Гильдии', sub: `лучшая: «${top.name}» · ${nAll} ${plural(nAll, 'герой', 'героя', 'героев')} за стрим`,
        lines: G.slice(0, 4).map((g, i) => { const p = [`${g.n} ${plural(g.n, 'герой', 'героя', 'героев')}`]; if (g.exp) p.push(`${g.exp} ${plural(g.exp, 'поход', 'похода', 'походов')}`); if (g.quests) p.push(`${g.quests} ${plural(g.quests, 'квест', 'квеста', 'квестов')}`); if (g.chests) p.push(`${g.chests} ${plural(g.chests, 'сундук', 'сундука', 'сундуков')}`); if (g.dmg) p.push(`урон ${g.dmg}`); if (g.gold) p.push(`+${g.gold} золота`); return `${i + 1}. «${g.name}» — ${p.join(', ')}`; }) }); } }
    if (sm.hero) cards.push({ icon: '👑', title: 'Герой дня', sub: sm.hero.user, big: true, lines: [`урон ${sm.hero.dmg} · лечение ${sm.hero.heal} · вклад ${sm.hero.contrib}`, 'Спасибо всем за стрим!'] });
    return cards;
  }
  // v6.42: время карточки зависит от объёма: minSec + perLineSec × (строки/участники), не больше maxSec; cardSec (8 по умолч.) — масштаб, speed — «медленнее/быстрее»
  try { const sp = +localStorage.getItem('rpgfarm_recapSpeed'); if (sp > 0) RCP.speed = sp; } catch (e) {}
  const recapScale = () => (+RCP.cardSec || 8) / 8 / Math.max(0.25, +RCP.speed || 1);
  const recapCardN = c => c.lines.length + (c.goal ? 1 : 0) + (c.sub && c.sub.length > 60 ? 1 : 0);
  const recapDur = c => Math.min(+RCP.maxSec || 12, Math.max(+RCP.minSec || 7, (+RCP.minSec || 7) + (+RCP.perLineSec || 0.6) * recapCardN(c))) * recapScale();
  const recapSec = () => recapScale() * 8;
  function recapSpeed(v) { if (v === 'slower') v = (+RCP.speed || 1) / 1.25; else if (v === 'faster') v = (+RCP.speed || 1) * 1.25; RCP.speed = Math.max(0.4, Math.min(2.5, +v || 1)); RCP.speed = Math.round(RCP.speed * 100) / 100; try { localStorage.setItem('rpgfarm_recapSpeed', RCP.speed); } catch (e) {} return { ok: true, speed: RCP.speed, msg: `скорость итогов ×${RCP.speed}` + (RECAP ? ` · эта карточка ${recapDur(RECAP.cards[RECAP.i]).toFixed(1)} с` : '') }; }
  function recapGo(i) { if (!RECAP) return { ok: false }; RECAP.i = Math.max(0, +i || 0); RECAP.ct = tm; return { ok: true, i: RECAP.i }; }
  function recapStart(why) {
    const cards = recapCards(); STREAMCARD = false;
    RECAP = { t0: tm, ct: tm, i: 0, cards, why: why || 'стример', sec: recapSec() };
    log(`📜 Повтор итогов стрима (${cards.length} карточек)`, '#ffd27a'); emitBot({ event: 'recapStart', cards: cards.length, text: '📜 Итоги стрима — смотрите на экране!' });
    const durs = cards.map(c => Math.round(recapDur(c) * 10) / 10); return { ok: true, cards: cards.length, sec: RECAP.sec, durs, total: Math.round(durs.reduce((a, b) => a + b, 0) * 10) / 10, titles: cards.map(c => c.title) };
  }
  function recapStop() { const was = !!RECAP; RECAP = null; return { ok: was }; }
  function recapState() { if (!RECAP) return null; const i = RECAP.i, c = RECAP.cards[i] || {}; return { i, n: RECAP.cards.length, title: c.title || '', dur: c.lines ? Math.round(recapDur(c) * 10) / 10 : 0, speed: RCP.speed }; }
  // fix: текст карточки итогов не вылезает за рамку — сначала уменьшаем шрифт (до ~78%), если всё ещё длинно — перенос по словам
  function recapFit(t, size, maxW) {
    t = String(t == null ? '' : t); let s = size; const min = Math.round(size * 0.78);
    while (s > min && measure(t, s) > maxW) s -= 2;
    const lh = Math.round(fsz(s) * 1.2);
    if (measure(t, s) <= maxW) return { rows: [t], s, lh };
    const rows = []; let cur = '';
    for (const w of t.split(' ')) { const tr = cur ? cur + ' ' + w : w; if (cur && measure(tr, s) > maxW) { rows.push(cur); cur = w; } else cur = tr; }
    if (cur) rows.push(cur);
    return { rows, s, lh };
  }
  function recapLayout(c, maxW) {
    const key = maxW + '|' + UIS; if (c._lay && c._lay.key === key) return c._lay;
    const title = recapFit(`${c.icon} ${c.title}`, c.big ? 76 : 68, maxW), sub = recapFit(c.sub, c.big ? 64 : 42, maxW);
    const lines = c.lines.map(l => recapFit(l, 46, maxW));
    const linesH = lines.reduce((a, f) => a + 78 + (f.rows.length - 1) * f.lh, 0);
    return (c._lay = { key, title: { rows: [title.rows.join(' ')], s: title.rows.length > 1 ? Math.max(40, Math.floor(title.s * maxW / measure(title.rows.join(' '), title.s))) : title.s }, sub, subExtra: (sub.rows.length - 1) * sub.lh, lines, linesH });
  }
  function drawRecap() {
    if (!RECAP) return; while (RECAP.i < RECAP.cards.length && tm - RECAP.ct >= recapDur(RECAP.cards[RECAP.i])) { RECAP.ct += recapDur(RECAP.cards[RECAP.i]); RECAP.i++; }
    const i = RECAP.i, du = i < RECAP.cards.length ? recapDur(RECAP.cards[i]) : 1, el = tm - RECAP.ct, k = el / du, fk = 0.45 / du; // появление/исчезание ~0,45 с
    if (i >= RECAP.cards.length) { RECAP = null; if (RCP.endWithCard !== false) streamCard(true); return; }
    const c = RECAP.cards[i], fade = Math.min(1, k / fk, (1 - k) / fk), a = Math.max(0, Math.min(1, fade)); // плавное появление/исчезание, без движения
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const cw = 1640, L = recapLayout(c, cw - 150), ch = 260 + L.subExtra + L.linesH + (c.goal ? 70 : 0), x = Math.round(W / 2 - cw / 2), y = topPlace('recap', x, cw, ch, Math.max(Math.round(H / 2 - ch / 2) - 40, topBottom()));
    ctx.save(); ctx.globalAlpha = a; darkPlate(x, y, cw, ch);
    ctx.strokeStyle = c.win === false ? '#ff8a6a' : '#ffcf4a'; ctx.lineWidth = 5; ctx.strokeRect(x + 10, y + 10, cw - 20, ch - 20);
    text(L.title.rows[0], W / 2, y + 96, L.title.s, c.win === false ? '#ffb090' : '#ffcf4a', 'center', 5);
    L.sub.rows.forEach((r, j) => text(r, W / 2, y + 170 + j * L.sub.lh, L.sub.s, c.big ? '#ffffff' : '#ffe9c8', 'center', 4));
    let ly = y + 250 + L.subExtra;
    if (c.goal) { const gw = cw - 240, p = Math.min(1, c.goal.prog / c.goal.need); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 120, ly - 20, gw, 26); ctx.fillStyle = c.goal.done ? '#9fe870' : '#ffcf4a'; ctx.fillRect(x + 120, ly - 20, gw * p, 26); ly += 70; }
    L.lines.forEach((f, j) => { f.rows.forEach((r, q) => text(r, W / 2, ly + q * f.lh, f.s, j === 0 && !c.goal ? '#ffffff' : '#f0e0c0', 'center', 4)); ly += 78 + (f.rows.length - 1) * f.lh; });
    for (let d = 0; d < RECAP.cards.length; d++) { ctx.fillStyle = d === i ? '#ffcf4a' : 'rgba(255,255,255,0.3)'; ctx.fillRect(Math.round(W / 2 - RECAP.cards.length * 15 + d * 30), y + ch - 30, 18, 8); }
    ctx.restore();
  }
  function streamCard(show) {
    STREAMCARD = show === undefined ? !STREAMCARD : !!show;
    if (STREAMCARD) { const hd = heroOfDay(); if (hd) { S.stream.hero = hd.user; clog(heroLine(hd), '#ffd27a'); } }
    return { show: STREAMCARD, summary: streamSummary() };
  }
  // --- ярмарка ---
  const fairActive = () => !!(S.fair && S.fair.until > now());
  function fairBonus(id) { return fairActive() && id !== 'weed' ? (id === 'pumpkin' ? FAIR.bonusPumpkin : FAIR.bonusVeg) : 0; }
  function fairStart(min, why) {
    min = +min || FAIR.minutes || 30; S.fair = { start: now(), until: now() + min * 60, why: why || 'стример' };
    const t = `🎪 Ярмарка на ${min} мин! При !продать: +${FAIR.bonusVeg} золота за овощ, +${FAIR.bonusPumpkin} за тыкву.`;
    emitBot({ event: 'fairAnnounce', kind: 'start', minutes: min, text: t }); log(t, '#ffd27a'); bump('town', 3); save();
    return { ok: true, until: S.fair.until, min };
  }
  function fairStop(silent) {
    if (!S.fair) return { ok: false }; S.fair = null;
    const t = '🎪 Ярмарка закончилась. Цены снова обычные.'; if (!silent) emitBot({ event: 'fairAnnounce', kind: 'end', text: t }); log(t, '#9fc5e8'); save(); return { ok: true };
  }
  function streamTick() {
    if (S.fair && S.fair.until <= now()) fairStop();
    const sc = FAIR.schedule; if (!sc || !sc.enabled || fairActive()) return;
    const d = new Date(), day = d.toISOString().slice(0, 10), hm = d.getHours() * 60 + d.getMinutes();
    for (const t of sc.times || []) { const [hh, mm] = String(t).split(':').map(Number), at = hh * 60 + (mm || 0);
      if (hm >= at && hm < at + (FAIR.minutes || 30) && S.fairLast !== day + ' ' + t) { S.fairLast = day + ' ' + t; fairStart(FAIR.minutes, 'расписание ' + t); break; } }
  }
  // --- отрисовка: плашка цели (слева сверху, под баннером событий; «Топ фермеров» — по центру, не перекрываем) ---
  function drawGoalPlate() {
    const s = S.stream, g = s && s.goal; if (!g || STREAMCARD) return;
    const fs = 26, t = `🎯 ${goalText(g)}`, num = g.done ? '✔ выполнено' : `${g.prog}/${g.need}`;
    const w = Math.round(Math.max(measure(t, fs), 300) + measure(num, fs) + 70), h = 62, x = 24, y = topPlace('goal', x, w, h);
    darkPlate(x, y, w, h);
    text(t, x + 20, y + 28, fs, '#ffe9a8', 'left', 3); text(num, x + w - 20, y + 28, fs, g.done ? '#9fe870' : '#ffffff', 'right', 3);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 20, y + 44, w - 40, 8);
    ctx.fillStyle = g.done ? '#9fe870' : '#ffcf4a'; ctx.fillRect(x + 20, y + 44, (w - 40) * Math.min(1, g.prog / g.need), 8);
  }
  // v45: строки «Лучшее» в итоге стрима по реальной ширине текста (measure): перенос по записям, не больше maxL строк, остаток — «… ещё N»
  function bestLines(arr, maxW, fs, maxL) {
    maxL = maxL || 2; const W0 = t => measure(t, fs) <= maxW;
    const fit = t => { if (W0(t)) return t; while (t.length > 1 && !W0(t + '…')) t = t.slice(0, -1); return t + '…'; };
    const items = arr.map(l => `${l.user} — ${l.text}`), L = [[]]; let k = 0; // L — записи по строкам
    const str = (li, tail) => (li === 0 ? 'Лучшее: ' : '') + L[li].join(' · ') + (tail || '');
    for (; k < items.length; k++) { const li = L.length - 1; L[li].push(items[k]); if (W0(str(li))) continue;
      if (L[li].length === 1) { L[li][0] = fit((li === 0 ? 'Лучшее: ' : '') + items[k]).slice(li === 0 ? 8 : 0); continue; } // одна длинная запись — «…»
      L[li].pop(); if (L.length >= maxL) break; L.push([items[k]]); if (!W0(str(L.length - 1))) L[L.length - 1][0] = fit(items[k]); }
    let rest = items.length - k; const last = L.length - 1;
    while (rest > 0 && L[last].length > 1 && !W0(str(last, ` · ещё ${rest}`))) { L[last].pop(); rest++; }
    if (rest > 0) { const tl = ` · ещё ${rest}`; let t0 = L[last][0]; while (t0.length > 1 && !W0(str(last, tl).replace(L[last][0], t0 + '…'))) t0 = t0.slice(0, -1); if (t0 !== L[last][0]) L[last][0] = t0 + '…'; }
    return L.map((_, li) => str(li, li === last && rest > 0 ? ` · ещё ${rest}` : ''));
  }
  const TEXT = (...a) => text(...a); const SC_BOXES = []; // v6.42: рамки текстов «Итог стрима» — для теста наложений
  function drawStreamCard() {
    SC_BOXES.length = 0; if (!STREAMCARD) return; const sm = streamSummary();
    const text = (t, tx, ty, fs, ...r) => { const w = measure(t, fs), al = r[1] || 'center', x0 = al === 'center' ? tx - w / 2 : al === 'right' ? tx - w : tx; SC_BOXES.push({ t: String(t).slice(0, 40), x0, x1: x0 + w, y0: ty - fs * 0.5, y1: ty + fs * 0.5 }); return TEXT(t, tx, ty, fs, ...r); };
    const cw = 1500, chh = 1000, x = Math.round(W / 2 - cw / 2), y = Math.round(H / 2 - chh / 2) - 20;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    darkPlate(x, y, cw, chh);
    ctx.save(); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 4; ctx.strokeRect(x + 8, y + 8, cw - 16, chh - 16); ctx.restore();
    text('ИТОГ СТРИМА', W / 2, y + 74, 60, '#ffcf4a', 'center', 5);
    text(`${new Date(sm.start).toLocaleDateString('ru-RU')} · ${sm.min} мин · героев: ${sm.heroes}`, W / 2, y + 122, 30, '#d8d8d8', 'center', 3);
    const hy = y + 200;
    if (sm.hero) { text(`Герой дня: ${sm.hero.user}`, W / 2, hy, 54, '#ffffff', 'center', 5); text(`урон ${sm.hero.dmg} · лечение ${sm.hero.heal} · вклад ${sm.hero.contrib}`, W / 2, hy + 50, 32, '#ffe9a8', 'center', 3); }
    else text('Герой дня ещё не определился', W / 2, hy, 44, '#cccccc', 'center', 4);
    const cols = [['Урон', sm.topDmg, '#ff9a7a'], ['Лечение', sm.topHeal, '#8fe88f'], ['Вклад', sm.topContrib, '#8fc8ff']], colW = (cw - 120) / 3, ty = y + 340;
    cols.forEach(([nm, arr, col], i) => { const cx = x + 60 + colW * i + colW / 2; text(nm, cx, ty, 38, col, 'center', 4);
      if (!arr.length) text('—', cx, ty + 56, 32, '#aaaaaa', 'center', 3);
      arr.forEach((r, j) => { text(`${j + 1}. ${r.user.length > 14 ? r.user.slice(0, 13) + '…' : r.user}  ${r.v}`, cx, ty + 56 + j * 46, 32, '#ffffff', 'center', 3); }); });
    const ly = y + 570;
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 60, ly - 40, cw - 120, 2); ctx.restore();
    text(`Лут: ${sm.loot} ${plural(sm.loot, 'предмет', 'предмета', 'предметов')}`, x + 80, ly + 10, 36, '#ffe9a8', 'left', 3);
    text(`Золото: ${sm.gold}`, x + cw - 80, ly + 10, 36, '#ffd27a', 'right', 3);
    if (sm.lootTop.length) bestLines(sm.lootTop, cw - 160, 28).forEach((l, j) => text(l, x + 80, ly + 52 + j * 34, 28, '#e8d0ff', 'left', 3)); // v45: «Лучшее» — не шире рамки, максимум 2 строки + «ещё N»
    let gy = y + 700;
    if (sm.topGuild) { // v49.10: активность гильдий в итогах стрима
      text(`Лучшая гильдия: «${sm.topGuild.name}»`, x + 80, gy, 32, '#ffe9a8', 'left', 3);
      text(sm.guilds.slice(0, 4).map(g => `«${g.name}» ${g.n}`).join(' · '), x + 80, gy + 36, 28, '#e8d0ff', 'left', 3);
      gy += 80;
    }
    if (sm.goal) { // v6.42: цель — своей строкой (с переносом), статус — отдельной строкой ниже, без наложений
      const gl = wrapPx(`Цель стрима: ${sm.goal.text}`, 38, cw - 160).slice(0, 2); gl.forEach((l, j) => text(l, x + 80, gy + j * 46, 38, sm.goal.done ? '#9fe870' : '#ffffff', 'left', 4));
      const sy = gy + gl.length * 46 + 4;
      text(sm.goal.done ? `✔ выполнена · сундук получили ${sm.goal.rewarded} ${plural(sm.goal.rewarded, 'участник', 'участника', 'участников')}` : `прогресс ${sm.goal.prog}/${sm.goal.need}`, x + 80, sy, 32, sm.goal.done ? '#9fe870' : '#ffcf4a', 'left', 3);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 80, sy + 30, cw - 160, 16);
      ctx.fillStyle = sm.goal.done ? '#9fe870' : '#ffcf4a'; ctx.fillRect(x + 80, sy + 30, (cw - 160) * Math.min(1, sm.goal.prog / sm.goal.need), 16);
    } else text('Цель стрима не выбрана', x + 80, gy, 36, '#aaaaaa', 'left', 3);
    if (sm.fair) text('🎪 Идёт ярмарка', W / 2, y + chh - 60, 30, '#ffd27a', 'center', 3);
  }

  // ===================== СОБЫТИЕ: БОСС (один за стрим, через час после начала сессии) =====================
  const BE = C.bossEvent, BC = (typeof window !== 'undefined' && window.BossCore) || null;
  /*QSW-BEGIN*/
  // v48: «Рой» Королевы-Матки — чистая логика поверх боя BossCore (bosscore.js не меняется). Тот же код идёт в симуляцию tests/v48_queen_sim.cjs.
  // Коконы у логова вылупляют личинок; личинки ползут мимо танка к лекарю отряда, кусают (Яд роя, стаки) и ползут обратно — дошедшая до Матки лечит её.
  // «Зов роя» докастован — все коконы вылупляются сразу (+callBonus); каст прерван — коконы засыпают на interruptDelay с, самый слабый гибнет.
  // Танк бьёт личинок в своей зоне, !заслон держит их у танка, бойцы отвлекаются на личинок (маг — по площади), лучник/ассасин бьют коконы.
  // Урон роя никого не добивает (минимум 1 HP) — смерти считает только BossCore.
  const QSW = (function () {
    const DEF = { cocoons: 3, hatchFirst: [16, 24, 32], hatchSec: 28, relaySec: 12, perHatch: 1, callBonus: 1, interruptDelay: 12,
      cocoonHp: 0.012, larvaHp: 0.0065, growSec: 5, growHp: 0.25, travelSec: 11, backSec: 9, tankZone: [0.3, 0.5], wallStop: 0.45,
      focus: 0.20, cocoonFocus: 0.18, bite: 0.05, poison: 0.012, poisonEvery: 2, poisonMax: 5, poisonSec: 12, heal: 0.008, maxPerSquad: 6,
      crawlSec: 6, crawlBackSec: 6, larvaHits: 6, cocoonHits: 10 }; // v49.10: автоудары не перемалывают рой; личинки обычно доползают, кусают и часть возвращается. crawlSec/Hits нет в старом config — берутся отсюда
    const cfgOf = def => Object.assign({}, DEF, (def && def.swarm) || {});
    const alive = u => u && !u.dead && u.hp > 0;
    const typDpsAtk = F => { const a = []; (F.squads || []).forEach(S => (S.ids || []).forEach(id => { const u = F.all[id]; if (u && u.role === 'dps' && u.atk) a.push(u.atk); })); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 40; };
    const hpAgainst = (base, F, hits) => Math.max(base, Math.round(typDpsAtk(F) * (hits || 8)));
    function init(F, def) {
      const X = cfgOf(def), n = Math.max(1, F.squads.length), ph = F.boss.maxhp / n;
      F.sw = { X, ph, t: 0, acc: 0, ev: 0, rr: 0, id: 0, cocoons: [], larvae: [], stats: { hatched: 0, killed: 0, bites: 0, fed: 0, healed: 0, broken: 0, calls: 0, calm: 0 } };
      const chp = hpAgainst(Math.round(ph * n * X.cocoonHp), F, X.cocoonHits);
      for (let i = 0; i < X.cocoons; i++) F.sw.cocoons.push({ i, st: 'grow', t: X.hatchFirst[i] !== undefined ? X.hatchFirst[i] : X.hatchSec, hp: chp, mhp: chp, relay: 0 });
      return F.sw;
    }
    const nonLethal = (u, d) => { const a = Math.max(0, Math.min(Math.round(d), Math.round(u.hp) - 1)); u.hp -= a; return a; };
    function hatch(F, c, k) {
      const W = F.sw, X = W.X, n = F.squads.length; let made = 0;
      for (let j = 0; j < k * n; j++) {
        const sq = W.rr++ % n; if (W.larvae.filter(l => l.sq === sq).length >= X.maxPerSquad) continue;
        const hp = hpAgainst(Math.round(W.ph * X.larvaHp), F, X.larvaHits); W.larvae.push({ id: ++W.id, c: c.i, sq, p: 0, dir: 1, hp, mhp: hp, age: 0, st: 1, atk: 0, lane: W.id % 3 }); made++;
      }
      c.st = 'broken'; c.relay = X.relaySec; c.hatched = 1; W.stats.hatched += made;
      F.events.push({ e: 'swHatch', c: c.i, n: made }); return made;
    }
    function hitLarva(F, l, d, by) { l.hp -= Math.round(d); l.hitT = 0.25; if (l.hp <= 0) { l.dead = 1; F.sw.stats.killed++; F.events.push({ e: 'swDie', id: l.id, c: l.c, sq: l.sq, p: l.p, lane: l.lane, st: l.st, by }); } }
    function heroAct(F, S, si, W) {
      const X = W.X, r = F.rnd, live = S.ids.map(id => F.all[id]).filter(alive), mods = F.BE.classMods || {};
      const L = () => W.larvae.filter(l => !l.dead && l.sq === si).sort((a, b) => b.p - a.p);
      const atk = u => u.atk * (0.85 + r() * 0.3) * (((mods[u.cls] || {}).atkMult) === undefined ? 1 : mods[u.cls].atkMult);
      const wall = F.t < (S.wall || 0);
      for (const u of live) {
        let ls = L();
        if (u.role === 'tank') { const z = ls.filter(l => l.dir > 0 && l.p >= X.tankZone[0] - 0.05 && l.p <= X.tankZone[1] + 0.05); if (z.length) hitLarva(F, z[0], atk(u) * (wall ? 1.5 : 1), u.id); continue; }
        if (u.role !== 'dps') continue;
        if (ls.length && r() < X.focus) {
          if (u.cls === 'mage') { ls.forEach(l => hitLarva(F, l, atk(u) * 0.6, u.id)); continue; }
          if (u.cls === 'warrior') { ls.slice(0, 2).forEach(l => hitLarva(F, l, atk(u), u.id)); continue; }
          hitLarva(F, ls[0], atk(u) * 1.2, u.id); continue;
        }
        if ((u.cls === 'archer' || u.cls === 'assassin') && r() < X.cocoonFocus) {
          const c = W.cocoons.filter(c => c.st === 'grow').sort((a, b) => a.t - b.t)[0];
          if (c) { c.hp -= Math.round(atk(u)); if (c.hp <= 0) { c.hp = 0; c.st = 'broken'; c.relay = X.relaySec; c.hatched = 0; W.stats.broken++; F.events.push({ e: 'swBreak', c: c.i, id: u.id }); } }
        }
      }
    }
    function step(F, dt) {
      const W = F.sw; if (!W) return; const X = W.X, r = F.rnd; W.t += dt;
      // события ядра за этот шаг: каст докастован / прерван
      if (F.events.length < W.ev) W.ev = 0;
      for (; W.ev < F.events.length; W.ev++) { const e = F.events[W.ev];
        if (e.e === 'castHit') { W.stats.calls++; W.cocoons.filter(c => c.st === 'grow').forEach(c => hatch(F, c, X.perHatch + X.callBonus)); F.events.push({ e: 'swCall' }); }
        else if (e.e === 'interrupt') { W.stats.calm++; const g = W.cocoons.filter(c => c.st === 'grow'); g.forEach(c => { c.t += X.interruptDelay; });
          const weak = g.sort((a, b) => a.hp / a.mhp - b.hp / b.mhp)[0]; if (weak) { weak.st = 'broken'; weak.relay = X.relaySec; weak.hatched = 0; W.stats.broken++; F.events.push({ e: 'swBreak', c: weak.i, id: '' }); }
          F.events.push({ e: 'swCalm' }); } }
      W.ev = F.events.length;
      // коконы
      for (const c of W.cocoons) {
        if (c.st === 'grow') { c.t -= dt; if (c.t <= 0) hatch(F, c, X.perHatch); }
        else { c.relay -= dt; if (c.relay <= 0) { c.st = 'grow'; c.t = X.hatchSec; c.hp = c.mhp; c.hatched = 0; } }
      }
      // личинки
      for (const l of W.larvae) {
        if (l.dead) continue; const S = F.squads[l.sq]; l.age += dt; if (l.hitT > 0) l.hitT -= dt; if (l.atk > 0) l.atk -= dt;
        const st = Math.min(4, 1 + Math.floor(l.age / X.growSec)); if (st > l.st) { const add = Math.round(l.mhp * X.growHp); l.mhp += add; l.hp += add; l.st = st; }
        const live = S ? S.ids.map(id => F.all[id]).filter(alive) : [];
        if (l.dir > 0 && !live.length) l.dir = -1;
        if (l.dir > 0) {
          if (F.t < (S.wall || 0) && l.p >= X.wallStop) { l.p = X.wallStop; l.atk = 0.3; l.held = 1; continue; }
          l.held = 0; l.p += dt / (X.crawlSec || X.travelSec || 11);
          if (l.p >= 1) { l.p = 1; const t = live.find(u => u.role === 'healer') || live[Math.floor(r() * live.length)];
            const k = 0.7 + 0.15 * l.st, d = nonLethal(t, t.maxhp * X.bite * k); const q = t._qp || (t._qp = { n: 0, until: 0, next: F.t + X.poisonEvery });
            q.n = Math.min(X.poisonMax, q.n + 1); q.until = F.t + X.poisonSec; W.stats.bites++; l.atk = 0.6; l.dir = -1; l.fed = 1;
            F.events.push({ e: 'swBite', id: t.id, d, n: q.n, lid: l.id }); }
        } else {
          l.p -= dt / (X.crawlBackSec || X.backSec || 9);
          if (l.p <= 0) { l.dead = 1; l.gone = 1; if (l.fed) { const h = Math.round(W.ph * X.heal * (0.7 + 0.15 * l.st)); const h0 = F.boss.hp; F.boss.hp = Math.min(F.boss.maxhp, F.boss.hp + h); W.stats.fed++; W.stats.healed += F.boss.hp - h0; F.events.push({ e: 'swFeed', h: F.boss.hp - h0, c: l.c }); } }
        }
      }
      // яд: раз в poisonEvery с, урон = стаки × poison × макс. HP, не добивает
      for (const id in F.all) { const u = F.all[id], q = u._qp; if (!q || !q.n) continue;
        if (F.t >= q.until || !alive(u)) { q.n = 0; continue; }
        if (F.t >= q.next) { q.next = F.t + X.poisonEvery; const d = nonLethal(u, u.maxhp * X.poison * q.n); if (d) F.events.push({ e: 'swPoison', id, d, n: q.n }); } }
      // герои: раз в BE.tick (тот же ритм, что удары по боссу)
      W.acc += dt; const tk = +(F.BE && F.BE.tick) || 1.2;
      while (W.acc >= tk) { W.acc -= tk; F.squads.forEach((S, si) => heroAct(F, S, si, W)); }
      W.larvae = W.larvae.filter(l => !l.dead);
      W.ev = F.events.length;
    }
    function cleanse(F, si) { let n = 0; if (!F || !F.sw) return 0; (F.squads[si] ? F.squads[si].ids : []).forEach(id => { const u = F.all[id]; if (u && u._qp && u._qp.n) { n += u._qp.n; u._qp.n = 0; } }); return n; }
    function snap(F) { const W = F && F.sw; if (!W) return null; return { l: W.larvae.length, c: W.cocoons.filter(c => c.st === 'grow').length, s: W.stats }; }
    return { DEF, cfgOf, init, step, cleanse, snap };
  })();
  /*QSW-END*/
  /*TRT-BEGIN*/
  // v49.5: Король Трентов — «Корни древних» и ростки. Чистая логика поверх боя BossCore (как рой Матки). Тот же код идёт в симуляцию tests/v495_treant_sim.cjs.
  // Каст докастован → корни хватают 1/2/3 героев (по числу бойцов), кроме танков. Опутан rootSec с: не бьёт, не лечит, без умений.
  // Освободить: 3 × !удар других героев, !оглушить (когда босс не колдует) или !заслон — сразу одного; иначе сам через rootSec с.
  // Каст прерван в последние interruptLeft с → корни всё равно хватают interruptTargets героев; прерван раньше — корней нет.
  // Ростки: первый на first с, дальше раз в every с (не больше max), лечат босса healPct раз в healEvery с, бьют героя hit раз в hitEvery с (не добивают).
  // Срубленный росток — пень на stumpSec с: stumpHits ударов — пень исчез, не успели — снова росток.
  const TRT = (function () {
    const DEF = { roots: { targets: [[1, 1], [8, 2], [16, 3]], rootSec: 6, freeHits: 3, interruptLeft: 3, interruptTargets: 1, chop: 0.35 },
      sprouts: { first: 20, every: 25, max: 3, spots: 4, hp: 0.0065, hpPerSquad: 1, healPct: 0.004, healEvery: 3, hit: 0.03, hitEvery: 4, stumpSec: 20, stumpHits: 2, focus: 0.4, stumpFocus: 0.3 } };
    function cfgOf(def) { const t = (def && def.treant) || {}; return { R: Object.assign({}, DEF.roots, t.roots || {}), P: Object.assign({}, DEF.sprouts, t.sprouts || {}) }; }
    const alive = u => u && !u.dead && u.hp > 0;
    const rooted = (F, u) => !!u && F.t < (u.rootUntil || 0);
    const nonLethal = (u, d) => { const a = Math.max(0, Math.min(Math.round(d), Math.round(u.hp) - 1)); u.hp -= a; return a; };
    function init(F, def) {
      const X = cfgOf(def), n = Math.max(1, F.squads.length);
      F.tr = { X, n, ph: F.boss.maxhp / n, ev: 0, acc: 0, next: X.P.first, lastP: 0, roots: [], sprouts: [], heal: 0,
        stats: { casts: 0, rooted: 0, freedHit: 0, freedCC: 0, freedSelf: 0, sprouts: 0, cut: 0, stumps: 0, regrow: 0, healed: 0, hits: 0 } };
      return F.tr;
    }
    const sproutHp = W => Math.max(1, Math.round(W.ph * W.X.P.hp * (1 + W.X.P.hpPerSquad * (W.n - 1))));
    function fighters(F) { let n = 0; F.squads.forEach(S => { n += S.ids.length; }); return n; }
    function nTargets(F) { const n = fighters(F); let k = 1; for (const [a, b] of F.tr.X.R.targets) if (n >= a) k = b; return k; }
    function grab(F, k) {
      const W = F.tr, R = W.X.R, cand = [];
      F.squads.forEach(S => S.ids.forEach(id => { const u = F.all[id]; if (alive(u) && u.role !== 'tank' && !rooted(F, u)) cand.push(u); }));
      const got = [];
      for (let i = 0; i < k && cand.length; i++) { const u = cand.splice(Math.floor(F.rnd() * cand.length), 1)[0]; u.rootUntil = F.t + R.rootSec; u.rootHits = 0; got.push(u.id); if (!W.roots.includes(u.id)) W.roots.push(u.id); }
      W.stats.rooted += got.length; if (got.length) F.events.push({ e: 'trRoot', ids: got, sec: R.rootSec }); return got;
    }
    function free(F, u, by, how) {
      if (!u) return false; const was = rooted(F, u); u.rootUntil = 0; u.rootHits = 0; F.tr.roots = F.tr.roots.filter(i => i !== u.id);
      if (!was) return false; F.tr.stats[how === 'hit' ? 'freedHit' : how === 'cc' ? 'freedCC' : 'freedSelf']++; F.events.push({ e: 'trFree', id: u.id, by: by || '', how }); return true;
    }
    function chop(F, t, by) { const need = F.tr.X.R.freeHits; t.rootHits = (t.rootHits || 0) + 1; const n = t.rootHits; F.events.push({ e: 'trChop', id: t.id, by, n, need }); if (n >= need) free(F, t, by, 'hit'); return n; }
    function hitSprout(F, s, d, by) { s.hp -= Math.round(d); s.fl = 0.25; if (s.hp > 0) return 0; s.hp = 0; s.st = 'stump'; s.t = F.tr.X.P.stumpSec; s.hits = 0; F.tr.stats.cut++; F.events.push({ e: 'trCut', i: s.i, by }); return 1; }
    function hitStump(F, s, by) { s.hits++; s.fl = 0.25; if (s.hits < F.tr.X.P.stumpHits) return 0; s.gone = 1; F.tr.stats.stumps++; F.events.push({ e: 'trStump', i: s.i, by }); return 1; }
    const roots = (F, ids, not) => ids.map(id => F.all[id]).filter(x => x && x.id !== not && alive(x) && rooted(F, x));
    // что рубит !удар героя u: свой опутанный союзник → любой опутанный → самый слабый росток → пень → null (бьёт босса)
    function target(F, u) {
      const W = F.tr; if (!W || !u) return null;
      const mine = roots(F, u.sq >= 0 && F.squads[u.sq] ? F.squads[u.sq].ids : [], u.id), any = mine.length ? mine : roots(F, W.roots, u.id);
      if (any.length) return { k: 'root', u: any.sort((a, b) => (b.rootHits || 0) - (a.rootHits || 0))[0] };
      const sp = W.sprouts.filter(s => !s.gone && s.st === 'sprout').sort((a, b) => a.hp - b.hp)[0]; if (sp) return { k: 'sprout', s: sp };
      const st = W.sprouts.filter(s => !s.gone && s.st === 'stump').sort((a, b) => a.t - b.t)[0]; if (st) return { k: 'stump', s: st };
      return null;
    }
    // !удар игрока: d — урон удара. Возвращает null (бей босса) или { k, msg }
    function strike(F, u, d) {
      const g = target(F, u); if (!g) return null; const R = F.tr.X.R, P = F.tr.X.P;
      if (g.k === 'root') { const n = chop(F, g.u, u.id); return { k: 'root', who: g.u.id, msg: n >= R.freeHits ? `рубит корни — ${g.u.id} свободен!` : `рубит корни на ${g.u.id} (${n}/${R.freeHits})` }; }
      if (g.k === 'sprout') { const k = hitSprout(F, g.s, d, u.id); return { k: 'sprout', msg: k ? `срубил росток (${Math.round(d)})` : `росток −${Math.round(d)} (осталось ${g.s.hp})` }; }
      const k = hitStump(F, g.s, u.id); return { k: 'stump', msg: k ? 'выкорчевал пень' : `пень ${g.s.hits}/${P.stumpHits}` };
    }
    // !оглушить без каста / !заслон: освободить одного (свой отряд — первым). Возвращает id или ''
    function freeOne(F, id) { const W = F.tr, u = F.all[id]; if (!W || !u) return ''; const mine = roots(F, u.sq >= 0 && F.squads[u.sq] ? F.squads[u.sq].ids : [], u.id), any = mine.length ? mine : roots(F, W.roots, u.id);
      const t = any.sort((a, b) => a.rootUntil - b.rootUntil).pop(); return t && free(F, t, id, 'cc') ? t.id : ''; }
    // перед BossCore.useCC: оглушение, когда босс не колдует, а кто-то опутан, — тратит умение на освобождение (без штрафа «босс не колдует»)
    function preCC(F, id, ab, cast) {
      const W = F.tr, u = F.all[id]; if (!W || !u || ab !== 'stun' || F.cast || !W.roots.length) return null;
      if (u.sq < 0 || !alive(u) || rooted(F, u) || !['paladin', 'warrior'].includes(u.cls) || F.t < (u.cd || 0) || F.t < (u.lock || 0)) return null;
      const t = freeOne(F, id); if (!t) return null; u.cd = F.t + ((cast && cast.heroCooldown) || 20); u.lastAb = ab; F.events.push({ e: 'cc', id, ab, good: 1 });
      return { ok: true, msg: `вырвал ${t} из корней`, effect: 'free' };
    }
    function heroAct(F, S, si, W) {
      const P = W.X.P, R = W.X.R, r = F.rnd, mods = (F.BE && F.BE.classMods) || {};
      const live = S.ids.map(id => F.all[id]).filter(u => alive(u) && !rooted(F, u)), rt = roots(F, S.ids);
      const atk = u => u.atk * (0.85 + r() * 0.3) * (((mods[u.cls] || {}).atkMult) === undefined ? 1 : mods[u.cls].atkMult);
      for (const u of live) {
        if (u.role !== 'dps') continue;
        const tr = rt.filter(x => rooted(F, x));
        if (tr.length && r() < R.chop) { chop(F, tr[0], u.id); continue; }
        const sp = W.sprouts.filter(s => !s.gone && s.st === 'sprout');
        if (sp.length && r() < ((u.cls === 'archer' || u.cls === 'mage') ? Math.min(1, P.focus * 1.5) : P.focus)) {
          if (u.cls === 'mage') { sp.forEach(s => hitSprout(F, s, atk(u) * 0.6, u.id)); continue; }
          hitSprout(F, sp.sort((a, b) => a.hp - b.hp)[0], atk(u) * 1.2, u.id); continue;
        }
        const st = W.sprouts.filter(s => !s.gone && s.st === 'stump');
        if (st.length && r() < P.stumpFocus) hitStump(F, st[0], u.id);
      }
    }
    function step(F, dt) {
      const W = F.tr; if (!W) return; const R = W.X.R, P = W.X.P, r = F.rnd;
      if (F.events.length < W.ev) W.ev = 0;
      for (; W.ev < F.events.length; W.ev++) { const e = F.events[W.ev];
        if (e.e === 'castHit') { W.stats.casts++; grab(F, nTargets(F)); }
        else if (e.e === 'interrupt') { const ct = (F.def && F.def.castTime) || (F.BE && F.BE.cast && F.BE.cast.seconds) || 15; if (W.lastP >= 1 - R.interruptLeft / ct) grab(F, Math.min(R.interruptTargets, nTargets(F))); } }
      W.ev = F.events.length; if (F.cast) W.lastP = F.cast.p; else W.lastP = 0;
      if (dt <= 0) return;
      // корни: истекли / герой выбыл
      for (const id of W.roots.slice()) { const u = F.all[id]; if (!u || !alive(u) || u.sq < 0) { if (u) { u.rootUntil = 0; u.rootHits = 0; } W.roots = W.roots.filter(i => i !== id); continue; } if (!rooted(F, u)) { u.rootUntil = 0; u.rootHits = 0; W.roots = W.roots.filter(i => i !== id); W.stats.freedSelf++; F.events.push({ e: 'trFree', id, by: '', how: 'self' }); } }
      // ростки
      W.next -= dt;
      if (W.next <= 0) { W.next += P.every; const used = W.sprouts.filter(s => !s.gone).map(s => s.i);
        if (used.length < P.max) { const fr = []; for (let i = 0; i < P.spots; i++) if (!used.includes(i)) fr.push(i);
          const i = fr[Math.floor(r() * fr.length)], hp = sproutHp(W); W.sprouts.push({ i, st: 'sprout', hp, mhp: hp, healT: P.healEvery, hitT: P.hitEvery * (0.5 + r() * 0.5), t: 0, hits: 0 }); W.stats.sprouts++; F.events.push({ e: 'trSprout', i }); } }
      for (const s of W.sprouts) { if (s.gone) continue; if (s.fl > 0) s.fl -= dt;
        if (s.st === 'stump') { s.t -= dt; if (s.t <= 0) { s.st = 'sprout'; s.hp = s.mhp; s.healT = P.healEvery; s.hitT = P.hitEvery; W.stats.regrow++; F.events.push({ e: 'trRegrow', i: s.i }); } continue; }
        s.healT -= dt; if (s.healT <= 0) { s.healT += P.healEvery; if (F.boss.hp > 0) { const h0 = F.boss.hp; F.boss.hp = Math.min(F.boss.maxhp, F.boss.hp + Math.round(F.boss.maxhp * P.healPct)); const h = F.boss.hp - h0; W.stats.healed += h; W.heal = F.t; if (h) F.events.push({ e: 'trHeal', i: s.i, h }); } }
        s.hitT -= dt; if (s.hitT <= 0) { s.hitT += P.hitEvery; const live = []; F.squads.forEach(S => S.ids.forEach(id => { const u = F.all[id]; if (alive(u)) live.push(u); }));
          if (live.length) { const t = live[Math.floor(r() * live.length)], d = nonLethal(t, t.maxhp * P.hit); W.stats.hits++; if (d) F.events.push({ e: 'trHit', i: s.i, id: t.id, d }); } } }
      W.sprouts = W.sprouts.filter(s => !s.gone);
      // герои: раз в BE.tick
      W.acc += dt; const tk = +(F.BE && F.BE.tick) || 1.2;
      while (W.acc >= tk) { W.acc -= tk; F.squads.forEach((S, si) => heroAct(F, S, si, W)); }
      W.ev = F.events.length;
    }
    function snap(F) { const W = F && F.tr; if (!W) return null;
      return { r: W.roots.map(id => F.all[id]).filter(u => u && rooted(F, u)).map(u => [u.id, Math.max(1, Math.ceil(u.rootUntil - F.t)), u.rootHits || 0]), sp: W.sprouts.filter(s => s.st === 'sprout').length, st: W.sprouts.filter(s => s.st === 'stump').length, fh: W.X.R.freeHits }; }
    return { DEF, cfgOf, init, step, strike, target, preCC, freeOne, rooted, snap };
  })();
  /*TRT-END*/

  // v48: у каждого босса своё логово. lair в списке боссов (config.js) → фон assets/bg/<lair>.png (+ 1080/<lair>.png), пульт img/<lair>.jpg.
  // Без поля lair — общее логово огра ('boss'). Нет файла фона — тоже логово огра (точки/факелы — огра). Настройки логова: CONFIG.lairs[<lair>] поверх этих.
  const LAIRS_DEF = { boss: {}, boss_queen: { torches: [], portal: [1480, 520, 220], spots: { boss: [1780, 1180], reserve: [420, 1280] }, backY1: 1320, feetMax: 1330, floor: [840, 1320], cocoons: [[2100, 1080], [2000, 1280], [2220, 1140]] },
    boss_treant: { torches: [], spots: { boss: [1860, 1180], arena: [1250, 1200], reserve: [420, 1280] }, floor: [820, 1320], feetMax: 1330, sprouts: [[1620, 980], [1680, 1280], [2060, 1280], [2220, 1140]] } }; // v49.10: пол с ~52–55%; коконы/ростки на полу рядом с боссом, не в воздухе и не на героях/HUD
  function bossDefOf(b) { if (!b || !BE || !BE.bosses) return null; return BE.bosses.find(x => x.name === b.name) || BE.bosses.find(x => x.id === b.key) || null; }
  function lairOf(d) { return !d ? 'boss' : d.lair || (d.id === 'queen_boss' ? 'boss_queen' : d.id === 'treant_boss' ? 'boss_treant' : 'boss'); }
  function lairKey() { const k = lairOf(bossDefOf(S && S.boss)); if (k === 'boss') return 'boss'; const im = IMG['bg_' + k]; return im && !isPH('bg_' + k) && (im.naturalWidth || im.width) ? k : 'boss'; }
  function lairCfg(k) {
    const a = LAIRS_DEF[k] || {}, b = ((C.lairs || {})[k]) || {};
    const o = Object.assign({}, a, b);
    if (a.spots || b.spots) o.spots = Object.assign({}, a.spots || {}, b.spots || {});
    // старый блок lairs в config.js (точки/backY1/коконы в воздухе, без floor) — не затираем новый пол, точку босса, коконы и ростки на полу
    if (a.floor && !b.floor) {
      o.floor = a.floor.slice();
      if (a.portal) o.portal = a.portal.slice();
      if (a.backY1 != null && b.backY1 != null) o.backY1 = a.backY1;
      if (a.feetMax != null) o.feetMax = a.feetMax;
      if (a.spots && a.spots.boss) o.spots = Object.assign({}, o.spots || {}, { boss: a.spots.boss.slice() });
    }
    if (a.cocoons && !b.floor) o.cocoons = a.cocoons.slice();
    if (a.sprouts && !b.floor) o.sprouts = a.sprouts.map(s => s.slice());
    return o;
  }
  function lairSpot(k) { const L = lairCfg(lairKey()), p = L.spots && L.spots[k]; return p ? { x: p[0], y: p[1] } : null; }
  function trentOn(d) { return !!d && d.treant !== false && (!!d.treant || d.id === 'treant_boss'); } // v49.5
  function swarmOn(d) { return !!d && d.swarm !== false && (!!d.swarm || d.id === 'queen_boss'); }
  const palOf = loc => { const P = C.palette || {}; return P[loc] || (/^boss_/.test(loc) ? P.boss : '') || P.default || 'brightness(0.74) saturate(0.82) contrast(1.06)'; };
  const CC_CMD = { 'оглушить': 'stun', 'замедлить': 'slow', 'связать': 'bind', 'очистить': 'purge', 'заслон': 'wall', 'воскресить': 'revive', 'прикрыть': 'cover' };
  let BF = null; // живой бой (BossCore), не сохраняется: перезагрузка во время боя возвращает босса к записи
  // v6.44: прогрессия. Ранние боссы (без unlockAfter) — по кругу; поздние открываются после unlockAfter боссов (S.bossIdx)
  // и выходят каждым 3-м боссом, если средний уровень 10 сильнейших героев ≥ recLevel; иначе — снова ранний.
  // v6.44: род глагола по имени босса (Королева-Матка — женский)
  function gv(name, m, f) { const d = BE.bosses.find(x => x.name === name); return d && d.fem ? f : m; }
  function bossTopLevel() { const L = Object.values(S.heroes || {}).map(h => h.rpg_level || 1).sort((a, b) => b - a).slice(0, 10); return L.length ? L.reduce((a, b) => a + b, 0) / L.length : 1; }
  function bossDef(idx) {
    if (BE.forceBoss) { const f = BE.bosses.find(b => b.id === BE.forceBoss || b.name === BE.forceBoss); if (f) return f; } // v48: тест — всегда этот босс (в config.js пусто = выкл)
    const i = idx === undefined ? (S.bossIdx || 0) : idx, early = BE.bosses.filter(b => !b.unlockAfter), lv = bossTopLevel();
    const late = BE.bosses.filter(b => b.unlockAfter && i >= b.unlockAfter && lv >= (b.recLevel || 0));
    if (late.length && i % 3 === 2) return late[Math.floor(i / 3) % late.length];
    return early[i % early.length];
  }
  function bossActive() { return !!(S.boss && (S.boss.phase === 'signup' || S.boss.phase === 'fight')); }
  const bossFighting = () => !!(S.boss && S.boss.phase === 'fight' && BF);
  const bossWaiting = () => !!(S.boss && S.boss.phase === 'wait');
  // --- сессия = стрим. Начинается с первой награды/нового героя или кнопкой «Начать босса» ---
  function sessionTouch(why) {
    const t = now(); S.session = S.session || null;
    if (sessionOver()) {
      if (S.boss && bossActive()) endBoss(false, 'стрим закончился');
      S.session = { start: t, last: t, real: Date.now(), why: why || 'награда' };
      if (BF) BF = null;
      const d = bossDef();
      S.boss = { phase: 'wait', key: d.id, name: d.name, gen: d.gen || d.name, acc: d.acc || d.name, filter: d.filter || '', fem: !!d.fem, size: d.size || 0, recLevel: d.recLevel || 0, spawnAt: t + BE.bossSpawnDelayMin * 60, signup: [] };
      log(`Новая сессия стрима (${why || 'награда'}): ${d.name} появится через ${BE.bossSpawnDelayMin} ${plural(BE.bossSpawnDelayMin, 'минуту', 'минуты', 'минут')}`, '#c9b6ff');
      streamNew(why || 'награда');
    }
    S.session.last = t; S.session.real = Date.now();
  }
  // v7panel20: Streamer.bot → Twitch «Stream Online» → событие streamOnline: новая сессия (новая цель стрима, босс через bossSpawnDelayMin). Повтор в течение 10 мин игнорируется.
  function streamOnline(src) {
    if (S.session && Date.now() - (S.session.onlineAt || 0) < 10 * 60000) return { ok: true, dup: true };
    S.session = null; sessionTouch(src || 'Stream Online'); S.session.onlineAt = Date.now(); save(); refreshUI();
    return { ok: true, boss: S.boss && S.boss.name, inMin: BE.bossSpawnDelayMin, goal: S.stream && S.stream.goal && S.stream.goal.id };
  }
  // v7panel37: «стрим идёт» — только по Twitch Stream Online/Offline из Streamer.bot (S.live). Пока событий не было — как раньше (сессия по активности).
  const LIVE_MAX_H = () => +C.liveMaxHours > 0 ? +C.liveMaxHours : 14; // забытый Offline: через 14 ч статус сам гаснет
  function liveSet(on, src, force) { const was = !!(S.live && S.live.on); S.live = { on: !!on, at: Date.now(), src: String(src || '').slice(0, 40) }; let r0 = null; if (on && (!was || force)) r0 = streamOnline(src || 'Twitch: стрим запущен'); if (!on && was) log('Стрим закончился (' + (src || 'Twitch') + ') — пульт: «Стрим не идёт»'); save(); return Object.assign({ ok: true }, r0 || {}, { live: S.live.on }); }
  const liveNow = () => S.live ? !!S.live.on && Date.now() - S.live.at < LIVE_MAX_H() * 3600000 : undefined;
  const panelTestOn = () => C.panelTest === true || !!S.ptest;
  const streamerLogin = () => String(C.streamerLogin || C.twitchChannel || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 25);
  const streamFlag = () => { const l = liveNow(); return l === undefined ? !sessionOver() : l; };
  function sessionOver() { const G = BE.sessionGapMinutes * 60; return !S.session || now() - S.session.last > G || Date.now() - (S.session.real || Date.now()) > G * 1000; }
  function startBoss(opts) { // кнопка «Начать босса»: начать сессию / призвать сейчас / начать бой
    opts = opts || {};
    if (sessionOver()) sessionTouch('кнопка стримера');
    let b = S.boss;
    // v7panel28: кнопка стримера/тестового пульта не блокируется лимитом «один босс за сессию». Раньше: сессия продлевается любой командой (res) и переживает перезапуск,
    // поэтому phase 'done' от прошлого/тестового босса оставалась и кнопка отвечала «уже был». Теперь — новый босс в той же сессии (цель стрима не сбрасывается).
    if (!b || b.phase === 'done') {
      const d = bossDef();
      S.boss = b = { phase: 'wait', key: d.id, name: d.name, gen: d.gen || d.name, acc: d.acc || d.name, filter: d.filter || '', fem: !!d.fem, size: d.size || 0, recLevel: d.recLevel || 0, spawnAt: now() + BE.bossSpawnDelayMin * 60, signup: [], manual: true };
      log(`Стример вызвал нового босса: ${d.name}`, '#c9b6ff'); save(); refreshUI();
    }
    if (b.phase === 'wait') { if (opts.now || opts.gatherSeconds !== undefined) spawnBoss(); else return { ok: true, msg: `сессия идёт, босс через ${fmtTime(b.spawnAt - now())}` }; }
    if (opts.fight && S.boss.phase === 'signup') return beginFight();
    return { ok: true };
  }
  function spawnBoss() {
    const b = S.boss; if (!b || b.phase !== 'wait') return;
    b.phase = 'signup'; b.spawnedAt = now(); b.signupUntil = BE.signupMinutes > 0 ? now() + BE.signupMinutes * 60 : 0;
    const text = `${b.name} ${gv(b.name,'появился','появилась')}! Пиши !босс, чтобы вступить в отряд`;
    log(text, '#ff9c7a'); b.bannerT = tm;
    emitBot({ event: 'bossAnnounce', text, boss: b.name });
    bump('boss', 8); save(); refreshUI();
  }
  // --- запись ---
  function heroCls(n) { const h = S.heroes[n]; return h ? h.rpg_class : 'warrior'; }
  function plan(list) { // list: ники в порядке записи -> отряды/запас
    const byG = {}; list.forEach(n => { const g = (S.heroes[n] && S.heroes[n].rpg_guild) || '_solo'; byG[g] = (byG[g] || 0) + 1; });
    const sz = BE.squadSize, allow = {}; let total = 0;
    Object.keys(byG).sort((a, c) => byG[c] - byG[a]).forEach(g => {
      const base = g === '_solo' ? BE.soloSquads : BE.squadsPerGuild + Math.round(bEff('guild', 'squad'));
      let k = Math.max(Math.min(base, 1), Math.floor(byG[g] / sz) + (byG[g] % sz >= 3 ? 1 : 0));
      k = Math.max(1, Math.min(k, BE.maxSquads - total)); allow[g] = k; total += k;
    });
    const items = list.map(n => ({ id: n, cls: heroCls(n), guild: (S.heroes[n] && S.heroes[n].rpg_guild) || '_solo' }));
    if (BE.mixedSquads) { // v8: гильдии — только полные пятёрки (сколько разрешает Дом гильдий), остальные — в сборные отряды
      const full = g => g === '_solo' ? 0 : BE.squadsPerGuild + Math.round(bEff('guild', 'squad'));
      return BC.formSquads(items, sz, full, { mixed: true, max: BE.maxSquads });
    }
    return BC.formSquads(items, sz, g => allow[g] || 0);
  }
  const bossRoster = () => S.boss ? (BF ? null : plan(S.boss.signup)) : null;
  function joinBoss(nick, silent) {
    const h = getHero(nick, true), b = S.boss;
    if (bossWaiting()) return res(h, false, `${b.name} появится через ${fmtTime(b.spawnAt - now())} — тогда пиши !босс`);
    if (!bossActive()) return res(h, false, b && b.phase === 'done' ? 'босс этого стрима уже был' : 'сейчас нет босса');
    if (b.signup.includes(h.user)) return res(h, false, 'уже записан');
    const bl = blocked(h, 'boss'); if (bl) return res(h, false, bl);
    const st = stats(h); const healed = BE.signupHeal !== false && h.rpg_hp < st.maxhp; /* v49.6: при записи на босса HP восстанавливается до полного — не ждём лагерь */ if (!healed && h.rpg_hp < st.maxhp * BE.minHpShare) return res(h, false, `нужно HP ≥ ${Math.round(BE.minHpShare * 100)}% (сейчас ${h.rpg_hp}/${st.maxhp}) — отдохни у костра или выпей зелье`);
    if (b.signup.length >= BE.maxSquads * BE.squadSize + BE.maxReserve) return res(h, false, 'арена полна');
    if (healed) h.rpg_hp = st.maxhp;
    b.signup.push(h.user);
    const rt = ensureRT(h); rt.mode = 'boss'; rt.stayUntil = 0; rt.formation = null;
    const p = SPOT('boss', 'reserve'); travel(h, 'boss', p.x + R(-40, 40), p.y, () => placeFormation());
    if (BF) BC.addReserve(BF, { id: h.user, cls: h.rpg_class, guild: h.rpg_guild || '_solo' }, statsOf);
    let role = 'в запасе';
    if (!BF) { const P = plan(b.signup); const sq = P.squads.find(s => s.members.some(m => m.id === h.user)); if (sq) role = 'отряд ' + guildShort(sq.guild) + ', ' + (sq.tank && sq.tank.id === h.user ? 'танк' : sq.healer && sq.healer.id === h.user ? 'лекарь' : 'боец'); if (BE.autoFightWhenFull && P.squads.length >= BE.maxSquads && P.squads.every(s => !s.need.length)) beginFight(); }
    placeFormation();
    if (!silent) log(`${h.user} записывается на ${b.acc}: ${role} (всего ${b.signup.length})`, '#ffb08a');
    return silent ? { ok: true } : res(h, true, `записан на ${b.acc}: ${role}${healed ? ' · HP восстановлено' : ''}`);
  }
  const guildShort = g => g === '_solo' ? 'одиночек' : g === '_mix' ? 'сборный' : `«${(guildById(g) || { name: g }).name}»`;
  function statsOf(m) { const h = S.heroes[m.id], st = stats(h); return { maxhp: st.maxhp, hp: Math.max(1, h.rpg_hp), atk: st.atk, def: st.def, shield: shieldGive(h) }; }
  // --- строй: отряды дугой перед боссом (танк впереди, лекарь сзади), запас — слева ---
  const SQ_POS = [[1180, 1030], [1180, 740], [820, 1030], [820, 740], [1540, 1150], [1000, 1260], [1370, 1270], [730, 890]];
  const BEHIND = [[270, 40], [250, -60], [300, 160], [230, 220]]; // v6.25: ассасины заходят боссу за спину
  const SQ_OFF = { tank: [[130, -10]], dps: [[-30, -80], [35, 0], [-30, 80]], healer: [[-135, 10]] };
  // v6.34: линии строя: d — отступ от босса по x, zig — шахматный сдвиг, per — мест в колонке, step — следующая колонка
  const RANGED6 = new Set(['archer', 'mage', 'priest']);
  const LINE6 = { front: { d: 200, zig: 70, per: 6, step: 120, y0: 900, y1: 1290 }, mid: { d: 420, zig: 70, per: 6, step: 120, y0: 890, y1: 1320 }, back: { d: 760, zig: 80, per: 6, step: 170, y0: 880, y1: 1330 } }; // v6.45: пол логова нового фона начинается ~y 860
  // v49.8: пол логова для строя: y0…y1 — ряды ног, xl/xr — края ряда (кусты/черепа/кости переднего плана, тело босса, журнал боя справа)
  function bossFloor(k, bs) {
    const L = lairCfg(k), fm = L.feetMax || 1300;
    if (k === 'boss_treant') {
      const y0 = (L.floor && L.floor[0]) || 840, y1 = (L.floor && L.floor[1]) || 1320;
      return { y0, y1: Math.min(fm - 10, y1), xl: () => 160, xr: () => bs.x - 340 };
    }
    if (k === 'boss_queen') {
      const y0 = (L.floor && L.floor[0]) || 860, y1 = (L.floor && L.floor[1]) || L.backY1 || 1320;
      return { y0, y1: Math.min(fm, y1), xl: () => 180, xr: () => bs.x - 360 };
    }
    // v49.10: герои всегда левее босса (раньше нижний ряд заходил под ноги/вправо и перекрывал огра)
    return { y0: 820, y1: Math.min(fm, 1290), xl: y => y > 960 ? 400 : 170, xr: () => bs.x - 340 };
  }
  const BGRID6 = [[300, 150], [270, 130], [240, 115], [220, 100], [200, 90], [185, 82], [170, 76], [155, 76], [140, 76], [130, 76], [140, 66], [130, 58], [120, 50], [110, 44]];
  function bossGrid(k, bs, n) {
    const F = bossFloor(k, bs), C6 = (lairCfg(k).grid || BGRID6); let sp = [];
    for (const [sx, dy] of C6) {
      sp = []; const xa = Math.max(F.xr(F.y0), F.xr(F.y1));
      for (let r = 0, y = F.y0; y <= F.y1; r++, y = F.y0 + r * dy) for (let x = xa - (r % 2) * sx / 2; x >= F.xl(y); x -= sx) if (x <= F.xr(y)) sp.push({ x: Math.round(x), y: Math.round(y) });
      if (sp.length >= n) break;
    }
    return sp;
  }
  function formationSpots() {
    const b = S.boss; if (!b) return {};
    let squads, reserve;
    if (BF) { squads = BF.squads.map(Sq => ({ ids: Sq.ids.slice() })); reserve = BF.reserve.slice(); }
    else { const P = plan(b.signup); squads = P.squads.map(s => ({ ids: s.members.map(m => m.id), P: s })); reserve = P.reserve.map(m => m.id); }
    const sc = squads.length > 4 ? 0.78 : 1, out = {}; let nBehind = 0;
    // v6.34: строй линиями по классам (все отряды): паладины вплотную к боссу, воины второй линией,
    // дальники (лучник/маг/жрица) — задняя линия далеко от босса, ассасины — за спиной босса.
    const bs = SPOT('boss', 'boss'), LINES = { front: [], mid: [], back: [], ass: [] };
    squads.forEach((s, k) => s.ids.forEach(id => {
      const u = BF && BF.all[id], P = s.P;
      const r = BF ? (u.role === 'tank' ? 'tank' : u.role === 'healer' ? 'healer' : 'dps') : (P.tank && P.tank.id === id ? 'tank' : P.healer && P.healer.id === id ? 'healer' : 'dps');
      const hc = S.heroes[id] && S.heroes[id].rpg_class;
      if (hc === 'assassin') { LINES.ass.push({ id, k, r }); return; } // v49.8: ассасины — места ближе всего к спине босса
      const line = hc === 'paladin' ? 'front' : hc === 'warrior' ? 'mid' : RANGED6.has(hc) ? 'back' : r === 'tank' ? 'front' : r === 'healer' ? 'back' : 'mid';
      LINES[line].push({ id, k, r });
    }));
    // v49.8: строй — шахматная сетка по всему полу логова. Соседние ряды сдвинуты на полшага: голова и ник заднего ряда видны между
    // героями переднего. Шаг подбирается по числу героев (мало — просторно, 50 — плотно, но без наложений), ближние к боссу места —
    // паладинам, дальше воины, дальники, запас — самые дальние; ассасины — места у спины/под боком босса.
    const all = [...LINES.ass, ...LINES.front, ...LINES.mid, ...LINES.back, ...reserve.map(id => ({ id, k: -1, r: 'reserve' }))];
    const spots = bossGrid(lairKey(), bs, all.length), used = new Set(), dist = q => Math.hypot(bs.x - q.x, (bs.y - q.y) * 1.6);
    const take = (m, ln, pick) => { const free = spots.filter((q, i) => !used.has(i)); if (!free.length) return; const q = pick(free); used.add(spots.indexOf(q));
      out[m.id] = Object.assign({ x: q.x, y: q.y, sq: m.k, role: m.r }, ln === 'ass' ? { behind: q.x > bs.x - 60 } : ln === 'reserve' ? {} : { line: ln }); };
    const nearest = f => f.reduce((a, q) => dist(q) < dist(a) ? q : a), backOf = f => f.reduce((a, q) => (q.x - dist(q) * 0.35) > (a.x - dist(a) * 0.35) ? q : a);
    LINES.ass.forEach(m => take(m, 'ass', backOf));
    for (const ln of ['front', 'mid', 'back']) LINES[ln].forEach(m => take(m, ln, nearest));
    reserve.forEach(id => take({ id, k: -1, r: 'reserve' }, 'reserve', nearest));
    all.forEach((m, i) => { if (!out[m.id]) out[m.id] = { x: bs.x - 300 - (i % 6) * 90, y: Math.round(bs.y + 120), sq: m.k, role: m.r }; }); // не хватило мест (не бывает при лимите 50)
    return out;
  }
  function placeFormation() {
    const b = S.boss; if (!b) return; const spots = formationSpots();
    for (const n of b.signup) {
      const h = S.heroes[n]; if (!h) continue; const rt = ensureRT(h), p = spots[n]; if (!p) continue;
      if (rt.loc !== 'boss' || rt.dest || (rt.path.length && !rt.formation)) continue;
      if (rt.formation && rt.formation.x === p.x && rt.formation.y === p.y) continue;
      const face = false; /* v8.5: в бою герои всегда смотрят вправо */ rt.formation = { x: p.x, y: p.y, role: p.role, behind: !!p.behind }; rt.flip = face;
      walkPath(h, [{ x: p.x, y: p.y }], () => { rt.flip = face; });
    }
  }
  // v6.42: звук босса (bossaudio.js, программный синтез): музыка на время боя, «wah-wah» при провале
  const BMKEY = 'rpgfarm_bossMusic';
  const BMSKEY = 'rpgfarm_bossMusicStyle'; // v6.42b: стиль музыки A/B/C (переключатель дока сильнее config)
  function bmStyle() { const v = localStorage.getItem(BMSKEY) || C.bossMusicStyle || 'B'; return /^[ABC]$/i.test(v) ? v.toUpperCase() : 'B'; }
  function setBossMusicStyle(st) { if (st === 'next') st = 'ABC'[('ABC'.indexOf(bmStyle()) + 1) % 3]; st = String(st || 'A').toUpperCase(); if (!/^[ABC]$/.test(st)) return { ok: false, msg: 'стиль A, B или C' }; localStorage.setItem(BMSKEY, st);
    if (AUD.music) { bossMusicStop(0.8); setTimeout(() => { if (S.boss && S.boss.phase === 'fight') bossMusicStart(); }, 900); } else if (BAUD && bmOn()) BAUD.prepare(st); return { ok: true, style: st, msg: 'музыка босса: стиль ' + st }; }
  function bmOn() { const v = localStorage.getItem(BMKEY); return v === null ? C.bossMusicEnabled !== false : v === '1'; }
  const BAUD = window.BossAudio ? BossAudio.Player(() => ({ enabled: bmOn() && !params.has('mute'), volume: +(C.bossMusicVolume ?? 0.35), fadeIn: +(C.bossMusicFadeInSec ?? 3), fadeOut: +(C.bossMusicFadeOutSec ?? 3), failEnabled: bmOn() && C.failSfxEnabled !== false && !params.has('mute'), failVolume: +(C.failSfxVolume ?? 0.6), style: bmStyle() })) : null;
  if (BAUD && bmOn() && !params.has('mute')) setTimeout(() => BAUD.prepare(), 4000); // v6.42b: петля готовится заранее в фоне
  const AUD = { music: false, fails: 0, lastFail: 0 };
  function bossMusicStart() { if (!BAUD || AUD.music) return; AUD.music = BAUD.start() || bmOn(); }
  function bossMusicStop(fade) { AUD.music = false; if (BAUD) BAUD.stop(fade); }
  function bossFailSfx() { AUD.fails++; AUD.lastFail = Date.now(); if (BAUD) BAUD.fail(); }
  function setBossMusic(on) { localStorage.setItem(BMKEY, on ? '1' : '0'); if (!on) bossMusicStop(0.8); else if (S.boss && S.boss.phase === 'fight') bossMusicStart(); return { ok: true, on: bmOn(), msg: on ? 'звук босса включён' : 'звук босса выключен' }; }
  function beginFight() {
    const b = S.boss; if (!b || b.phase !== 'signup') return { ok: false, msg: 'нет записи на босса' };
    const list = b.signup.filter(n => S.heroes[n]); if (!list.length) { endBoss(false, 'никто не записался'); return { ok: false, msg: 'никто не записался' }; }
    const P = plan(list), d = (S.boss && BE.bosses.find(x => x.name === S.boss.name)) || bossDef(); // v6.44: тот же босс, что объявлен в сессии
    BF = BC.newFight(BE, d, P.squads, P.reserve, statsOf); BF.rnd = Math.random;
    if (swarmOn(d)) { QSW.init(BF, d); QDEAD.length = 0; } // v48: рой Королевы-Матки
    if (trentOn(d)) TRT.init(BF, d); // v49.5: корни и ростки Короля Трентов
    BF.endAt = BE.durationMinutes * 60;
    bossMusicStart(); b.phase = 'fight'; b.startAt = now(); b.endAt = now() + BF.endAt; b.maxhp = BF.boss.maxhp; b.hp = BF.boss.hp; b.dmg = {}; b.contrib = {}; b.ccLog = [];
    b.need = P.squads.map(s => s.need);
    log(`⚔ Бой с ${d.gen.replace(/^./, c => c)} начался! Отрядов: ${P.squads.length}, в запасе: ${P.reserve.length}, HP ${b.maxhp}.`, '#ff9c7a');
    emitBot({ event: 'bossFight', text: `⚔ Бой начался! ${b.name}: HP ${b.maxhp}. !удар, !лечить; при касте — !оглушить (красное), !связать (жёлтое), !очистить (фиолет.), !замедлить, !заслон; жрец: !воскресить павшего (общий откат с !очистить 60с)${BE.phases ? '. На 70% — Печать: бейте свой замок; потом Метки — танк, !прикрыть' : ''}` });
    placeFormation(); bump('boss', 8); setCamera('boss', true); save(); refreshUI();
    return { ok: true };
  }
  // числа урона: слоты по кругу над боссом, не больше 1 числа на героя за 1.2 с — без наложений при 40 героях
  let numSlot = 0; const numAt = {};
  function bossNum(txt, col, size, force) {
    const bp = SPOT('boss', 'boss'), k = numSlot++ % 10;
    fxText(bp.x + (k % 2 ? 1 : -1) * (250 + (Math.floor(k / 2) % 3) * 70), bp.y - 330 + (Math.floor(k / 6) % 4) * 46, txt, col, size || 24, 1.1, 'boss');
  }
  function heroFx(u, txt, col, size, gap) {
    const h = S.heroes[u]; if (!h) return; const rt = ensureRT(h), key = u + col;
    if (gap && numAt[key] && tm - numAt[key] < gap) return; numAt[key] = tm;
    fxText(rt.x, rt.y - 175, txt, col, size || 22, 1.1, 'boss');
  }
  // v6.24: компактный журнал боя/похода (угол экрана, последние строки)
  // v7panel42: только отображение HP в журнале/FX — расчёт не трогаем. ≤1 знак, без .0; крошечное >0 не схлопываем в 0.
  function fmtHP(n) { const x = +n; if (!isFinite(x) || x === 0) return '0';
    let r = Math.round(x * 10) / 10; if (r === 0) r = x > 0 ? 0.1 : -0.1;
    const s = r.toFixed(1); return s.endsWith('.0') ? String(Math.round(r)) : s; }
  const CLOG = [], CAGG = {}; let caggT = 0, FT_EMA = 16;
  // v7panel20 п.8: история журнала для пульта (CLOGH, по времени) + режим OBS «больше строк, очередь, ×N» — только при флаге (по умолчанию выключен до одобрения Tim)
  const CLOGH = [], CLOGQ = []; let clogOutT = -1e9;
  const OBS_LOG_PLUS = () => !(C.obsLogPlus === false || (typeof location !== 'undefined' && /[?&]obslog=0/.test(location.search))); // v7panel21 п.3: ВКЛ по умолчанию; obsLogPlus: false — выключить
  const clogMax = () => OBS_LOG_PLUS() ? (C.obsLogLines || 14) : (C.combatLogLines || 7);
  function clogPut(e) { const last = CLOG[CLOG.length - 1]; if (OBS_LOG_PLUS() && last && last.base === e.text) { last.n++; last.text = `${e.text} ×${last.n}`; last.t = tm; return; } CLOG.push({ text: e.text, base: e.text, n: 1, color: e.color, t: tm }); while (CLOG.length > clogMax()) CLOG.shift(); }
  function clogDrain() { if (!CLOGQ.length) return; const gap = C.obsLogInterval || 0.6; while (CLOGQ.length && tm - clogOutT >= gap) { clogPut(CLOGQ.shift()); clogOutT = tm; if (CLOGQ.length > 30) CLOGQ.splice(0, CLOGQ.length - 30); } }
  function clog(text, color) { color = color || '#e8e0d0'; CLOGH.push({ t: Date.now(), text, k: 'b' }); while (CLOGH.length > 3000 || CLOGH[0].t < Date.now() - 16 * 60000) CLOGH.shift(); // v7panel28 п.4: по времени, а не 300 строк
    if (OBS_LOG_PLUS()) { CLOGQ.push({ text, color }); clogDrain(); return; }
    CLOG.push({ text, color, t: tm }); if (CLOG.length > (C.combatLogLines || 7)) CLOG.shift(); }
  function caggAdd(key, who, kind, v) { const a = CAGG[key] || (CAGG[key] = { who, kind, v: 0, n: 0 }); a.v += v; a.n++; }
  function caggFlush(force) { if (!force && tm - caggT < 2) return; caggT = tm; for (const k in CAGG) { const a = CAGG[k]; if (a.kind === 'blk') clog(`${a.who} ×${a.n}`, '#bfe0ff'); else if (a.kind === 'dmg') clog(`${a.who}: урон ${a.v} (${a.n} ${plural(a.n, 'удар', 'удара', 'ударов')})`, '#f0e6d8'); else clog(`${a.who} +${fmtHP(a.v)} HP`, '#9dffb0'); delete CAGG[k]; } }
  let CLOG_SHOW = (() => { try { const v = localStorage.getItem('rpg_combatLog'); return v === null ? true : v === '1'; } catch (e) { return true; } })();
  function toggleCombatLog(v) { CLOG_SHOW = v === undefined ? !CLOG_SHOW : !!v; try { localStorage.setItem('rpg_combatLog', CLOG_SHOW ? '1' : '0'); } catch (e) {} refreshUI(); return { ok: true, show: CLOG_SHOW }; }
  function drawCombatLog(loc) {
    caggFlush(); clogDrain(); // v6.29: журнал стабильно виден на Лес/Босс; кнопка «Журнал» в HUD скрывает/показывает его на любой локации
    if (!CLOG_SHOW) { CLOG_BTN = null; return; }
    const onBoss = loc === 'boss';
    const tabY = H - 80 * UIS; // верх панели локаций
    if (CLOG_MINI) { const w = 200 * UIS, h = 36 * UIS, x0 = W - w - 16, y0 = tabY - h - 8; ctx.fillStyle = 'rgba(14,10,8,.72)'; ctx.fillRect(x0, y0, w, h); text('▴ Журнал боя', x0 + w / 2, y0 + h / 2, 17, '#e8d6a8'); CLOG_BTN = { x: x0, y: y0, w, h }; return; }
    if (FT_EMA > 24 && C.combatLogAutoHide === true) return; // автоскрытие по FPS — только если явно включено
    const L = CLOG.slice(-(onBoss ? 8 : (OBS_LOG_PLUS() ? (C.obsLogLines || 14) : (C.combatLogLines || 9)))); if (!L.length) L.push({ text: loc === 'boss' ? 'Ждём бой с боссом…' : loc === 'forest' ? 'Ждём поход…' : 'Событий пока нет', color: '#9a8a70', t: tm });
    // v49.10: на боссе журнал уже и ниже ног/подписи босса, чтобы не перекрывать спрайт; в лесу — как раньше
    const fs = onBoss ? 16 : 19, lh = (onBoss ? 20 : 27) * UIS, w = (onBoss ? 400 : 560) * UIS;
    let maxRows = onBoss ? 5 : (OBS_LOG_PLUS() ? (C.obsLogRows || 18) : (C.combatLogRows || 12));
    if (onBoss) {
      const bp = SPOT('boss', 'boss'), nameBottom = bp.y + 62;
      maxRows = Math.max(3, Math.min(5, Math.floor((tabY - 8 - nameBottom - 26) / lh)));
    }
    const rows = [];
    for (let i = L.length - 1; i >= 0; i--) { const ws = wrapPx(L[i].text, fs, w - 22); if (rows.length + ws.length > maxRows && rows.length) break; rows.unshift(...ws.slice(0, maxRows).map((t, k) => ({ t: (k ? '   ' : '') + t, color: L[i].color }))); }
    setFont(fs); const h = rows.length * lh + 26, x0 = W - w - 16;
    let y0 = tabY - h - 8;
    if (onBoss) { const nameBottom = SPOT('boss', 'boss').y + 62; if (y0 < nameBottom) y0 = nameBottom; if (y0 + h > tabY - 4) y0 = tabY - 4 - h; }
    ctx.fillStyle = 'rgba(14,10,8,.70)'; ctx.fillRect(x0, y0, w, h);
    text('Журнал боя', x0 + w / 2, y0 + 13, 15, '#c9b48a'); text('▾', x0 + w - 16, y0 + 13, 18, '#e8d6a8'); CLOG_BTN = { x: x0 + w - 40, y: y0, w: 40, h: 26 };
    setFont(fs); ctx.textAlign = 'left'; rows.forEach((l, i) => { ctx.globalAlpha = 1; ctx.fillStyle = l.color; ctx.fillText(l.t, x0 + 10, y0 + 32 + i * lh); }); ctx.globalAlpha = 1; ctx.textAlign = 'center';
  }
  // v46: Амулет Света в бою с боссом — снаружи bosscore (файл ядра не меняется). Тот же ритм, что удары героев (BE.tick): каждый every-й тик
  // носитель лечит самого раненого живого в своём отряде (HP < 70%) на 12%×power; свой удар/лечение не тратит.
  function bossHyHeal(F, d) { const tk = +(F.BE && F.BE.tick) || 1.2; F._hyAcc = (F._hyAcc || 0) + d;
    while (F._hyAcc >= tk) { F._hyAcc -= tk;
      F.squads.forEach(Sq => { const live = Sq.ids.map(id => F.all[id]).filter(u => u && !u.dead && u.hp > 0);
        for (const u of live) { const hh = S.heroes[u.id], hyb = hh && hybridOf(hh); if (!hyb || hyb.type !== 'heal' || F.t < (u.rootUntil || 0)) continue; u._hyN = (u._hyN || 0) + 1; if (u._hyN % hyb.every) continue;
          const low = live.slice().sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0]; if (!low || low.hp >= low.maxhp * HY_HEAL_BELOW) continue;
          const n = Math.min(low.maxhp - low.hp, Math.round(low.maxhp * HY_HEAL_K * (hyb.power || 0.5))); if (n > 0) { low.hp += n; F.events.push({ e: 'heal', id: u.id, to: low.id, h: n, hy: 1 }); } } }); } }
  function applyEvents() {
    const b = S.boss, bp = SPOT('boss', 'boss');
    if (BF.sw) QSW.step(BF, 0); if (BF.tr) TRT.step(BF, 0); // v49.5: рой/корни видят прерывание каста из чата до очистки событий (раньше !оглушить из чата рой не успокаивал)
    for (const e of BF.events) {
      const h = S.heroes[e.id], rt = h && ensureRT(h);
      if (e.e === 'deal') {
        if (h) caggAdd('d' + e.id, h.user, 'dmg', e.d);
        const g = (h && h.rpg_guild) || '_solo'; b.dmg[g] = (b.dmg[g] || 0) + e.d; b.contrib[e.id] = (b.contrib[e.id] || 0) + e.d; if (h) { h.rpg_bossDmg += e.d; sStat(h, 'dmg', e.d); }
        if (rt) { if (!(rt.lunge > 0)) { rt.lunge = 0.25 + Math.random() * 0.35; pfxAnim(e.id || (h && h.user), 'l', 'boss'); } if (Math.random() < 0.5) FX.push({ kind: 'attack', fx: clsById(h.rpg_class).fx, loc: 'boss', x: rt.x, y: rt.y - 70, tx: bp.x + R(-70, 70), ty: bp.y - R(120, 300), t: 0, life: 0.6 }); }
        if (e.tag || !numAt['d' + e.id] || tm - numAt['d' + e.id] > 1.6) { numAt['d' + e.id] = tm; if (e.tag || Math.random() < 0.35) bossNum((e.tag ? e.tag + ' ' : '') + '-' + e.d, e.tag ? '#ffcf4a' : '#f0e6d8', e.tag ? 28 : 22); }
      } else if (e.e === 'hurt') { if (h) caggAdd('b' + e.id, `${b.name} → ${h.user}`, 'dmg', e.d); if (rt) { rt.hit = 0.25; pfxAnim(e.id || (h && h.user), 'h', 'boss'); if (e.d >= 3) heroFx(e.id, '-' + e.d, e.kind === 'cast' ? '#ff5a8a' : e.kind === 'rumble' ? '#ff9c3a' : '#ff7a6a', e.kind === 'cast' || e.kind === 'rumble' ? 26 : 22, e.kind === 'cast' || e.kind === 'rumble' ? 1.2 : 0.9); if ((e.kind === 'cast' || e.kind === 'rumble') && BF) { const u = BF.all[e.id]; const Sq = u && BF.squads[u.sq]; if (Sq && BF.t < (Sq.wall || 0)) { const pct = Math.round(((BE.cast && BE.cast.wallReduce) || 0.5) * 100); heroFx(e.id, '−' + pct + '%', '#7fd0ff', 28, 1.45); FX.push({ kind: 'ring', loc: 'boss', x: rt.x, y: rt.y - 20, t: 0, life: 0.7, color: '#7fd0ff' }); pfxAnim(e.id || (h && h.user), 'wf', 'boss'); } } } }
      else if (e.e === 'dead') heroFx(e.id, 'Выбывает', '#ff9c7a', 22, 0, caggFlush(true), clog(`☠ ${e.id} выбывает из боя`, '#ff9c7a'));
      else if (e.e === 'revive') heroFx(e.id, 'Снова в бою!', '#c8f0a8', 22, 0);
      else if (e.e === 'rez') { // v6.37: воскрешение жреца — журнал, луч света, плашка над воскрешённым (без тряски)
        const t = S.heroes[e.to], tr = t && ensureRT(t), tn = t ? t.user : e.to;
        clog(`✝ ${e.id} воскрешает ${tn}${e.auto ? ' (авто)' : ''} — 50% HP · !очистить на откате ${e.cd}с`, '#fff2a0');
        log(`✝ ${e.id} воскрешает ${tn}`, '#fff2a0'); if (h) { sStat(h, 'heal', BF.all[e.to] ? BF.all[e.to].hp : 0); sStat(h, 'rez', 1); }
        if (rt && tr) FX.push({ kind: 'attack', fx: 'holy', loc: 'boss', x: rt.x, y: rt.y - 70, tx: tr.x, ty: tr.y - 70, t: 0, life: 0.7 });
        if (tr) { FX.push({ kind: 'ring', loc: 'boss', x: tr.x, y: tr.y, t: 0, life: 1.2, color: '#fff2a0' }); heroFx(e.to, 'ВОСКРЕШЁН!', '#fff2a0', 30, 0); }
        if (h) heroFx(e.id, 'Воскрешение!', '#fff2a0', 22, 1);
        placeFormation();
      }
      else if (e.e === 'dodge') heroFx(e.id, 'Уклон!', '#c8f0a8', 20, 2);
      else if (e.e === 'heal') { const t = S.heroes[e.to]; if (h) sStat(h, 'heal', e.h); if (h && t) caggAdd('h' + e.id + e.to, `${h.user} лечит ${t.user}`, 'heal', e.h); if (rt && t) { const tr = ensureRT(t); if (!(rt.lunge > 0)) { rt.lunge = 0.25 + Math.random() * 0.2; pfxAnim(e.id || (h && h.user), 'l', 'boss'); } FX.push({ kind: 'attack', fx: 'holy', loc: 'boss', x: rt.x, y: rt.y - 70, tx: tr.x, ty: tr.y - 70, t: 0, life: 0.6 }); heroFx(e.to, '+' + fmtHP(e.h), '#7dff9a', 20, 1.2); } }
      else if (e.e === 'swap') { log(`Запасной ${e.in} заменяет ${e.out}`, '#ffb08a'); placeFormation(); }
      else if (e.e === 'castStart') { try { publishSnapSoon(); } catch (x) { } clog(`${b.name} колдует «${e.name}»`, '#c58cff'); b.castName = e.name; fxText(bp.x, bp.y - 470, `${e.name}!`, '#c58cff', 40, 2.2, 'boss'); log(`☠ ${b.name} колдует «${e.name}» — контроль по цвету окна!`, '#c58cff'); }
      else if (e.e === 'interrupt') { try { publishSnapSoon(); } catch (x) { } clog('Каст прерван!', '#ffd27a'); fxText(bp.x, bp.y - 470, 'ПРЕРВАНО!', '#ffd27a', 48, 2.2, 'boss'); FX.push({ kind: 'ring', loc: 'boss', x: bp.x, y: bp.y, t: 0, life: 1, color: '#ffd27a' }); }
      else if (e.e === 'castHit') { try { publishSnapSoon(); } catch (x) { } fxText(bp.x, bp.y - 470, 'ТЬМА ОБРУШИЛАСЬ!', '#ff5a8a', 44, 2.4, 'boss'); b.shake = 0.6; clog(`${b.name}: «${b.castName || 'каст'}» обрушился на отряд`, '#ff5a8a'); }
      else if (e.e === 'rumbleOn') { try { publishSnapSoon(); } catch (x) { } fxText(bp.x, bp.y - 470, 'ОГР В ЯРОСТИ!', '#ff9c3a', 44, 2.4, 'boss'); b.shake = 0.5; clog(`${b.name} в ярости! Раскат через ${Math.round(e.in)} с, дальше каждые ${Math.round(e.every)} с`, '#ff9c3a'); log(`🔥 ${b.name} в ярости (HP ≤ 50%): раскат −${e.pct}% HP всем каждые ${Math.round(e.every)} с — паладин, !заслон!`, '#ff9c3a'); }
      else if (e.e === 'rumble') { try { publishSnapSoon(); } catch (x) { } fxText(bp.x, bp.y - 470, 'РАСКАТ!', '#ff7a2a', 52, 2.2, 'boss'); b.shake = 0.8; FX.push({ kind: 'ring', loc: 'boss', x: bp.x, y: bp.y, t: 0, life: 1, color: '#ff7a2a' }); clog(`Раскат! −${e.pct}% HP всем${e.walled ? ' (заслон прикрыл ' + e.walled + ' из ' + e.hit + ')' : ''}`, '#ff7a2a'); log(`💢 Раскат! ${b.name} бьёт всех на ${e.pct}% HP${e.walled ? ' · заслон: ' + e.walled + ' из ' + e.hit : ''}`, '#ff7a2a'); }
      else if (e.e === 'swHatch') { const p = qPt(e.c); if (e.n) { clog(`🥚 Кокон вылупился: +${e.n} ${plural(e.n, 'личинка', 'личинки', 'личинок')}`, '#d8a0ff'); FX.push({ kind: 'ring', loc: 'boss', x: p[0], y: p[1], t: 0, life: 0.9, color: '#c58cff' }); } }
      else if (e.e === 'swCall') { clog('«Зов роя»: коконы вылупились разом!', '#ff7ad8'); fxText(bp.x, bp.y - 520, 'РОЙ ПРОСНУЛСЯ!', '#ff7ad8', 40, 2.2, 'boss'); }
      else if (e.e === 'swCalm') clog('Зов роя сорван — коконы засыпают, один погиб', '#ffd27a');
      else if (e.e === 'swBreak') { const p = qPt(e.c); if (e.id) clog(`💥 ${e.id} разбивает кокон`, '#ffe7b0'); FX.push({ kind: 'ring', loc: 'boss', x: p[0], y: p[1], t: 0, life: 0.8, color: '#ffe7b0' }); fxText(p[0], p[1] - 210, 'кокон разбит!', '#ffe7b0', 26, 1.4, 'boss'); }
      else if (e.e === 'swDie') { const q = qLarvaXY(e); QDEAD.push({ x: q.x, y: q.y, t: tm }); if (QDEAD.length > 40) QDEAD.shift(); if (e.by && S.heroes[e.by]) caggAdd('qk' + e.by, `${e.by} давит личинок`, 'blk', 1); }
      else if (e.e === 'swBite') { heroFx(e.id, `Яд роя ×${e.n}`, '#b8ff6a', 22, 1.5); caggAdd('qb' + e.id, `Личинки кусают ${e.id} (Яд роя)`, 'blk', 1); }
      else if (e.e === 'swFeed') { bossNum('+' + e.h, '#c58cff', 24); caggAdd('qf', `Личинки подкормили: ${b.name}`, 'heal', e.h); }
      else if (e.e === 'trRoot') { const nm = e.ids.join(', '); clog(`🌿 Корни древних опутали: ${nm} — !удар рубит корни, !оглушить/!заслон освобождают`, '#b8ff6a'); fxText(bp.x, bp.y - 520, 'КОРНИ ДРЕВНИХ!', '#9dff6a', 40, 2.2, 'boss'); e.ids.forEach(id => heroFx(id, 'Опутан!', '#b8ff6a', 24, 0)); try { publishSnapSoon(); } catch (x) { } }
      else if (e.e === 'trFree') { heroFx(e.id, 'Свободен!', '#c8f0a8', 22, 0); if (e.how === 'cc' && e.by) clog(`${e.by} вырывает ${e.id} из корней`, '#c8f0a8'); else if (e.how === 'hit') clog(`Корни срублены — ${e.id} свободен`, '#c8f0a8'); try { publishSnapSoon(); } catch (x) { } }
      else if (e.e === 'trChop') { if (e.n < e.need) heroFx(e.id, `корни ${e.n}/${e.need}`, '#d8ffb0', 20, 0.5); if (e.by && S.heroes[e.by]) caggAdd('tc' + e.by, `${e.by} рубит корни`, 'blk', 1); }
      else if (e.e === 'trSprout') { clog('🌱 Вырос росток — лечит Короля! Рубите его (!удар)', '#9dff6a'); const p = trSpot(e.i); FX.push({ kind: 'ring', loc: 'boss', x: p[0], y: p[1], t: 0, life: 0.8, color: '#9dff6a' }); try { publishSnapSoon(); } catch (x) { } }
      else if (e.e === 'trCut') { const p = trSpot(e.i); fxText(p[0], p[1] - 190, 'СРУБЛЕН!', '#ffe7b0', 30, 1.4, 'boss'); if (e.by && S.heroes[e.by]) caggAdd('ts' + e.by, `${e.by} рубит ростки`, 'blk', 1); }
      else if (e.e === 'trStump') { const p = trSpot(e.i); fxText(p[0], p[1] - 120, 'пень выкорчеван', '#e8d6c0', 24, 1.2, 'boss'); }
      else if (e.e === 'trRegrow') { clog('🌱 Пень снова пророс', '#9dff6a'); }
      else if (e.e === 'trHeal') { bossNum('+' + e.h, '#9dff6a', 24); caggAdd('th', `Ростки лечат: ${b.name}`, 'heal', e.h); TRHEAL.push({ i: e.i, t: tm, h: e.h }); if (TRHEAL.length > 12) TRHEAL.shift(); }
      else if (e.e === 'trHit') { heroFx(e.id, '-' + e.d, '#a8d070', 20, 1.5); if (rt) { rt.hit = 0.2; pfxAnim(e.id, 'h', 'boss'); } }
      else if (e.e === 'swPoison') heroFx(e.id, '-' + e.d + ' яд', '#9dff6a', 20, 1.8);
      // v8: фазы босса — Печать, Метка, Ярость
      else if (e.e === 'sealOn') { clog(`🔒 ПЕЧАТЬ! ${b.name} неуязвим — каждый отряд разбивает свой замок за ${e.sec}с, иначе Волна тьмы`, '#c8a0ff'); fxText(bp.x, bp.y - 470, 'ПЕЧАТЬ!', '#c8a0ff', 56, 2.4, 'boss'); FX.push({ kind: 'ring', loc: 'boss', x: bp.x, y: bp.y, t: 0, life: 1.2, color: '#c8a0ff' }); bump('boss', 4); emitBot({ event: 'bossPhase', phase: 'seal', text: `🔒 ${b.name} под Печатью! Бейте свой замок — ${e.sec} секунд` }, (C.botActions || {}).bossAnnounce || 'bossAnnounce'); /* v8: тем же действием, что объявление босса (пишет text в чат) */ try { publishSnapSoon(); } catch (x) { } }
      else if (e.e === 'lockBroken') { const S0 = BF.squads[e.sq]; clog(`🔓 Замок отряда ${guildShort((S0 && S0.guild) || '_solo')} разбит — ${e.id}${e.help ? ' (помощь другому отряду!)' : ''}`, '#e0c8ff'); heroFx(e.id, e.help ? 'ПОМОГ ЗАМКУ!' : 'ЗАМОК!', '#e0c8ff', 22, 0); if (e.help && S.heroes[e.id]) sStat(S.heroes[e.id], 'help', 1); }
      else if (e.e === 'sealBroken') { clog(`✨ Печать разбита за ${e.t}с!`, '#e0c8ff'); fxText(bp.x, bp.y - 470, 'ПЕЧАТЬ РАЗБИТА!', '#e0c8ff', 48, 2, 'boss'); try { publishSnapSoon(); } catch (x) { } }
      else if (e.e === 'sealFail') { clog('🌑 ВОЛНА ТЬМЫ! Печать не разбили вовремя', '#b080ff'); fxText(bp.x, bp.y - 470, 'ВОЛНА ТЬМЫ!', '#b080ff', 56, 2.4, 'boss'); b.shake = 1; FX.push({ kind: 'ring', loc: 'boss', x: bp.x, y: bp.y, t: 0, life: 1.4, color: '#7a40d0' }); try { publishSnapSoon(); } catch (x) { } }
      else if (e.e === 'mark') { clog(`🎯 МЕТКА на ${e.id}! Танк, !прикрыть за ${e.sec}с`, '#ff8080'); heroFx(e.id, '🎯 МЕТКА', '#ff6a6a', 26, 0); try { publishSnapSoon(); } catch (x) { } }
      else if (e.e === 'cover') { clog(`🛡 ${e.id} прикрывает ${e.to}${e.help ? ' — из другого отряда!' : ''}`, '#a8d8ff'); heroFx(e.id, 'ПРИКРЫВАЮ!', '#a8d8ff', 22, 0); if (e.help && S.heroes[e.id]) sStat(S.heroes[e.id], 'help', 1); try { publishSnapSoon(); } catch (x) { } }
      else if (e.e === 'markHit') { if (e.cover) clog(`🛡 ${e.cover} принимает удар Метки за ${e.id}`, '#a8d8ff'); else clog(`💥 Удар Метки по ${e.id}!`, '#ff6a6a'); }
      else if (e.e === 'rage') { clog(`🔥 ЯРОСТЬ! ${b.name} бьёт всё сильнее, лечение слабее — добивайте!`, '#ff7a2a'); fxText(bp.x, bp.y - 470, 'ЯРОСТЬ!', '#ff7a2a', 56, 2.4, 'boss'); b.shake = 0.8; emitBot({ event: 'bossPhase', phase: 'rage', text: `🔥 ${b.name} в ярости — добивайте!` }, (C.botActions || {}).bossAnnounce || 'bossAnnounce'); try { publishSnapSoon(); } catch (x) { } }
      else if (e.e === 'cc' && rt) { const A = BC.CC[e.ab]; clog(`${e.id}: ${A.name}${e.good ? '' : ' — мимо'} (КД ${(BE.cast && BE.cast.heroCooldown) || 20}с)`, e.good ? '#ffe7b0' : '#a0a0a0'); heroFx(e.id, e.good ? A.name + '!' : 'мимо…', e.good ? '#ffe7b0' : '#a0a0a0', 22, 0); if (e.ab !== 'wall') FX.push({ kind: 'attack', fx: e.ab === 'purge' ? 'holy' : 'arcane', loc: 'boss', x: rt.x, y: rt.y - 70, tx: bp.x, ty: bp.y - 200, t: 0, life: 0.5 }); } // v49.12: заслон — не снаряд в босса, это защита отряда
    }
    BF.events.length = 0; if (BF.sw) BF.sw.ev = 0; if (BF.tr) BF.tr.ev = 0;
  }
  function syncHp() { for (const id in BF.all) { const h = S.heroes[id]; if (h) { h.rpg_hp = Math.max(0, Math.round(BF.all[id].hp)); h._bossDead = !!BF.all[id].dead; h._shield = BF.all[id].shield || 0; } } S.boss.hp = BF.boss.hp; }
  function bossTick(dt) {
    weekTick();
    if (S.trophy && S.trophy.until <= Date.now()) S.trophy = null;
    const b = S.boss; if (!b) return;
    if (b.phase === 'wait') { if (now() >= b.spawnAt) spawnBoss(); return; }
    if (b.phase === 'signup') {
      if (sessionOver()) { endBoss(false, 'стрим закончился'); return; }
      if (b.signupUntil && now() >= b.signupUntil) { if (b.signup.length) beginFight(); else endBoss(false, 'никто не записался'); return; }
      placeFormation(); return;
    }
    if (b.phase !== 'fight') return;
    if (!BF) { b.phase = 'signup'; return; } // перезагрузка во время боя — снова запись
    // AoE круги для картинки
    let left = dt; while (left > 1e-6) { const d = Math.min(0.25, left); left -= d; const r = BC.step(BF, d); if (!r) { bossHyHeal(BF, d); if (BF.sw) QSW.step(BF, d); if (BF.tr) TRT.step(BF, d); } if (r) { applyEvents(); syncHp(); endBoss(r === 'win', r === 'timeout' ? 'время вышло' : ''); return; } }
    applyEvents(); syncHp(); b.cast = BF.cast ? { p: BF.cast.p, order: BF.cast.order, slow: BF.t < BF.cast.slowUntil, win: BC.castWindow(BF) } : null; b.castIn = BF.cast ? 0 : BF.castT;
    b.enrage = BF.enrage; b.need = BF.squads.map(Sq => { const n = []; if (!Sq.hasTank) n.push('танк'); if (!Sq.hasHeal) n.push('лекарь'); return n; });
  }
  // --- команды участника во время боя ---
  function inFight(nick) {
    const h = getHero(nick, false); if (!h) return [null, { ok: false, msg: 'нет героя' }];
    if (!bossFighting() || !BF.all[h.user]) return [h, res(h, false, bossActive() ? 'бой ещё не начался — !босс для записи' : 'ты не в бою с боссом')];
    return [h, null];
  }
  function strike(nick) {
    const [h, er] = inFight(nick); if (er) return er; const u = BF.all[h.user];
    if (u.dead) return res(h, false, 'ты в нокауте — жди воскрешения');
    if (u.sq < 0) return res(h, false, 'ты в запасе — выйдешь, если кто-то падёт');
    const left = (h.rpg_strikeAt || 0) + BE.strikeCooldown - now(); if (left > 0) return res(h, false, `!удар ещё ${Math.ceil(left)}с`);
    if (BF.tr && TRT.rooted(BF, u)) return res(h, false, 'ты опутан корнями — пусть союзники рубят (!удар) или освободят (!оглушить/!заслон)');
    if (BF.tr) { const g = TRT.strike(BF, u, u.atk * BE.strikeMult * (0.85 + Math.random() * 0.3)); // v49.5: !удар рубит корни на союзнике, потом ростки и пни, и только потом бьёт Короля
      if (g) { h.rpg_strikeAt = now(); applyEvents(); syncHp(); heroFx(h.user, g.k === 'root' ? 'РУБИТ КОРНИ!' : g.k === 'sprout' ? 'РУБИТ РОСТОК!' : 'КОРЧУЕТ ПЕНЬ!', '#b8ff6a', 24, 0); return { ok: true, msg: g.msg }; } }
    h.rpg_strikeAt = now(); const d = BC.heroHit(BF, u, BE.strikeMult, 'УДАР'); applyEvents(); syncHp();
    heroFx(h.user, 'СИЛЬНЫЙ УДАР!', '#ffcf4a', 26, 0);
    if (BF.boss.hp <= 0) endBoss(true);
    return { ok: true, msg: `удар на ${d}` };
  }
  function heal(nick) {
    const [h, er] = inFight(nick); if (er) return er; const u = BF.all[h.user];
    if (u.dead) return res(h, false, 'ты в нокауте');
    const left = (h.rpg_healAt || 0) + BE.healCooldown - now(); if (left > 0) return res(h, false, `!лечить ещё ${Math.ceil(left)}с`);
    if (BF.tr && TRT.rooted(BF, u)) return res(h, false, 'ты опутан корнями — сейчас не вылечить');
    h.rpg_healAt = now(); const rt = ensureRT(h);
    if ((h.rpg_class === 'priest' || h.rpg_class === 'paladin') && u.sq >= 0) {
      const share = h.rpg_class === 'priest' ? BE.healShare : BE.healShare / 2;
      BF.squads[u.sq].ids.forEach(id => { const x = BF.all[id]; if (!x.dead) x.hp = Math.min(x.maxhp, x.hp + Math.round(x.maxhp * share)); });
      const pz = BF.sw && h.rpg_class === 'priest' ? QSW.cleanse(BF, u.sq) : 0; if (pz) clog(`${h.user} снимает Яд роя с отряда (×${pz})`, '#b8ff6a'); // v48: !лечить жреца снимает Яд роя
      syncHp(); FX.push({ kind: 'ring', loc: 'boss', x: rt.x, y: rt.y, t: 0, life: 1, color: '#fff2a0' });
      return { ok: true, msg: pz ? 'лечит отряд и снимает Яд роя' : 'лечит отряд' };
    }
    const hl = drinkPotion(h); if (!hl) return res(h, false, 'нет зелий лечения');
    u.hp = Math.min(u.maxhp, h.rpg_hp); heroFx(h.user, `+${hl} зелье`, '#7dff9a', 22, 0); return { ok: true, msg: `+${hl} HP` };
  }
  // v49.10: что сейчас на откате у героя в бою с боссом — пульт показывает это на кнопках и не даёт нажать (нажатие в КД даёт блок spamLockout)
  function panelBossCd(h) {
    const b = S.boss, u = BF && b && b.phase === 'fight' && BF.all[h.user]; if (!u) return undefined;
    const L = x => Math.max(0, Math.ceil(+x || 0)), q = {}, ct = h.rpg_cmdT || {}, cc = (+C.chatCommandCooldown || 0) * 1000;
    ['босс', 'оглушить', 'связать', 'очистить', 'замедлить', 'заслон', 'воскресить'].forEach(c => { const v = L((cc - (Date.now() - (ct[c] || 0))) / 1000); if (v) q[c] = v; });
    const dead = !!u.dead, c = L((u.cd || 0) - BF.t), r = L((u.rcd || 0) - BF.t);
    const last = u.lastAb || '', lastN = (last && BC && BC.CC && BC.CC[last] && BC.CC[last].name) || '', lastR = u.lastR || '';
    const why = {};
    const SK = ['оглушить', 'связать', 'очистить', 'замедлить', 'заслон', 'воскресить', 'удар', 'лечить'];
    if (dead) SK.forEach(cmd => { why[cmd] = 'в нокауте'; });
    else {
      if (c && last) {
        const pair = { wall: { stun: `после Заслона сбить каст нельзя ещё ${c}с` }, stun: { wall: `после Оглушить Заслон нельзя ещё ${c}с` } };
        const abOf = { оглушить: 'stun', замедлить: 'slow', связать: 'bind', очистить: 'purge', заслон: 'wall', воскресить: 'revive' };
        Object.keys(abOf).forEach(cmd => { const ab = abOf[cmd]; if (ab === last) return; why[cmd] = (pair[last] && pair[last][ab]) || (lastN ? `после ${lastN} нельзя ещё ${c}с` : ''); if (!why[cmd]) delete why[cmd]; });
      }
      if (r) {
        if (lastR === 'purge') why['воскресить'] = `после Очистить воскресить нельзя ещё ${r}с`;
        else if (lastR === 'revive') why['очистить'] = `после Воскрешения Очистить нельзя ещё ${r}с`;
        else { why['очистить'] = why['воскресить'] = `общий откат ещё ${r}с`; }
      }
    }
    return { c, l: L((u.lock || 0) - BF.t), s: L((h.rpg_strikeAt || 0) + BE.strikeCooldown - now()), h: L((h.rpg_healAt || 0) + BE.healCooldown - now()), r, q, d: dead ? 1 : 0, last, lastN, why }; // v49.12: d — нокаут, last/why — общий откат скиллов для подсказок на пульте
  }
  function heroBossKo(h) { return !!(bossFighting() && BF && h && BF.all[h.user] && BF.all[h.user].dead); } // v49.12
  function bossCC(nick, ab) {
    const [h, er] = inFight(nick); if (er) return er;
    if (heroBossKo(h)) return res(h, false, 'ты в нокауте'); // v49.12: не тратить КД / не звать useCC
    const pre = BF.tr ? TRT.preCC(BF, h.user, ab, BE.cast) : null; // v49.5: !оглушить без каста освобождает из корней
    const r = pre || BC.useCC(BF, h.user, ab); if (!pre && r.ok && ab === 'wall' && BF.tr) { const fr = TRT.freeOne(BF, h.user); if (fr) r.msg += ` · ${fr} вырван из корней`; } applyEvents();
    (S.boss.ccLog = S.boss.ccLog || []).push({ n: h.user, ab, ok: r.ok }); if (S.boss.ccLog.length > 6) S.boss.ccLog.shift();
    return res(h, r.ok, r.msg, r.ok ? '#ffe7b0' : '#e8b0a0');
  }
  // v6.31: награда босса — над героем (несколько строк) и в журнале боя
  const BOSSREWARDS = []; let BR_IDX = 0;
  function bossRewardFx(h, parts, color) {
    const rt = ensureRT(h); h._lastBossReward = parts.slice();
    BOSSREWARDS.unshift({ user: h.user, parts: parts.slice(), t: tm }); if (BOSSREWARDS.length > 80) BOSSREWARDS.length = 80;
    clog(`Награда ${h.user}: ${parts.join('; ')}`, color);
    FX.push({ kind: 'reward', loc: 'boss', user: h.user, x: rt.x, y: rt.y, lines: [h.user, ...parts], color, t: -Math.min(60, (BR_IDX++) * (C.bossRewardFxSec || 2.6)), life: C.bossRewardFxSec || 2.6 }); // v6.32: строго по одной — следующая появляется, когда предыдущая ушла
    FX.push({ kind: 'fly', loc: 'boss', x: rt.x + 60, y: rt.y - 300, user: h.user, key: 'coins', t: 0, life: 0.8 });
  }
  function endBoss(killed, why) { caggFlush(true); // v6.55 п.3
    const b = S.boss; if (!b || b.phase === 'done') return { ok: false, msg: 'босса нет' }; BR_IDX = 0; caggFlush(true); // v6.43: итоги боя — до наград, чтобы поздний сброс не вытеснял «Награда …» из журнала
    // v6.31: «Победа» с панели до начала боя тоже награждает записавшихся
    const fought = (b.phase === 'fight' && BF) || (killed && b.signup.length > 0); const wasFight = b.phase === 'fight'; bossMusicStop(); if (wasFight && !killed) bossFailSfx(); b.phase = 'done'; b.doneAt = Date.now(); b.cast = null; // v48.1: реальное время, иначе после перезагрузки OBS босс стоял
    const dmg = b.dmg || {};
    const _ga = guildCounts(), gsc = g => g === '_solo' ? 0 : perActive(g, dmg[g], _ga); // v8.7: лучшая гильдия на боссе — по урону на одного активного
    const rank = Object.keys(dmg).filter(g => dmg[g] > 0).sort((a, c) => gsc(c) - gsc(a));
    const topG = rank.find(g => g !== '_solo');
    const bonus = 1 + bEff('guild', 'bossReward');
    const _cd = Object.keys(b.contrib || {}).filter(u => b.contrib[u] > 0).sort((a, c) => b.contrib[c] - b.contrib[a]), TOP1 = _cd[0], TOP3 = _cd.slice(0, 3); // v49: осколки/свитки лучшим по урону
    for (const n of b.signup) {
      const h = S.heroes[n]; if (!h) continue; const rt = ensureRT(h);
      const u6 = fought && BF && BF.all[n], bench = !!(u6 && u6.wasReserve && !u6.subbed); // запасной, так и не вышедший в бой
      if (bench) { const g = Math.round((killed ? BE.winGold * bonus : BE.consolationGold) * (C.reserveRewardShare || 0.1)); h.rpg_gold += g; h._lastBossGold = g; bossRewardFx(h, [`запас: +${g} золота`], '#e0d0a0'); }
      else if (fought && killed) {
        const g = Math.round(BE.winGold * bonus); h.rpg_gold += g; h.rpg_bossWins++; const xp0 = h.rpg_xp; gainXp(h, 40);
        const mt = addMats(h, 'boss'), sv = giveChestQuiet(h, 'silver');
        const parts = [`+${g} золота`, `+${Math.max(0, h.rpg_xp - xp0) || 40} XP`]; if (mt) parts.push(mt);
        parts.push(`${C.chests.silver.name}: ${sv.map(o => o.text).join(', ')}`);
        if (topG && h.rpg_guild === topG) { const bt = BE.topGuildBonusChest, bc = giveChestQuiet(h, bt); parts.push(`бонус гильдии — ${C.chests[bt].name}: ${bc.map(o => o.text).join(', ')}`); }
        { const sd = shBossDrop(h, TOP3.includes(n), TOP1 === n); if (sd) parts.push(sd); }
        bossRewardFx(h, parts, '#ffd27a');
        rollRealPrize(h, 'boss'); checkAch(h);
      } else if (fought) { h.rpg_gold += BE.consolationGold; bossRewardFx(h, [`утешительно +${BE.consolationGold} золота`], '#ffb08a'); }
      if (!bench && h.rpg_guild && b.contrib) addGuildPoints(h.rpg_guild, Math.round((b.contrib[n] || 0) / 100), h);
      rt.mode = 'walk'; rt.formation = null; rt.path = []; delete h._bossDead;
      if (h.rpg_hp <= 0) h.rpg_hp = 1;
      if (fought) useBuffCharge(h);
      setTimeout(() => { if (rt.mode === 'walk' && !rt.dest) goCamp(h); }, 4000 + Math.random() * 3000);
    }
    { // v6.32: одна табличка сверху с теми же суммами, что в журнале и над героями
      const W_ = fought && killed, gw = Math.round(BE.winGold * bonus), gb = Math.round((W_ ? BE.winGold * bonus : BE.consolationGold) * (C.reserveRewardShare || 0.1));
      const ls = []; if (W_) ls.push(`Бойцам: +${gw} золота, +40 XP, ${C.chests.silver.name.toLowerCase()}`); else if (fought) ls.push(`Утешительно: +${BE.consolationGold} золота`);
      if (fought && BF && Object.values(BF.all).some(u => u.wasReserve && !u.subbed)) ls.push(`Запасным: +${gb} золота`);
      if (ls.length) lootPopup('', W_ ? `Награда: ${b.name} ${gv(b.name,'повержен','повержена')}` : 'Награда за бой', ls, W_ ? '#ffd27a' : '#ffb08a', W_ ? gw : 0, 'boss');
    }
    const n = BF ? Object.keys(BF.all).length : b.signup.length;
    if (fought && killed && topG) {
      S.trophy = { guild: topG, until: Date.now() + C.trophy.days * DAY, boss: b.name };
      fame('trophy', `Гильдия «${guildById(topG).name}» победила ${b.acc} — трофей на ${C.trophy.days} ${plural(C.trophy.days, 'день', 'дня', 'дней')}`);
    }
    if (fought && killed) fame('boss', `${b.name} ${gv(b.name,'повержен','повержена')} отрядом из ${n} героев`);
    if (fought && killed) bvHeartDrop(b); // v49: сердце босса в казну города (10-й уровень построек)
    { const s = streamCur(), mv = k => { let best = null; for (const u of b.signup) { const st = s.stats[u]; if (st && (st[k] || 0) > 0 && (!best || st[k] > best.v)) best = { user: u, v: Math.round(st[k]) }; } return best; };
      s.boss = { name: b.name, killed: !!(fought && killed), fought: !!fought, squad: n, guilds: rank.filter(g => g !== '_solo').slice(0, 3).map(g => ({ name: (guildById(g) || {}).name || g, dmg: Math.round(dmg[g]) })),
        mvpDmg: mv('dmg') || (() => { const c = b.contrib || {}, u = Object.keys(c).sort((p, q) => c[q] - c[p])[0]; return u && c[u] > 0 ? { user: u, v: Math.round(c[u]) } : null; })(), mvpHeal: mv('heal'), mvpRez: mv('rez'), reward: fought && killed ? `+${Math.round(BE.winGold * bonus)} золота, +40 XP, ${C.chests.silver.name.toLowerCase()}` : fought ? `утешительно +${BE.consolationGold} золота` : 'бой не состоялся' }; } // v6.41
    S.lastBoss = { name: b.name, killed: !!(fought && killed), rank: rank.map(g => ({ gid: g, dmg: dmg[g] })), squad: n, t: Date.now() };
    const bp = SPOT('boss', 'boss');
    if (fought && killed) { log(`★ ${b.name} ${gv(b.name,'повержен','повержена')}! Каждый: ${BE.winGold} золота, сундук, материалы. Лучшая гильдия — бонусный сундук и трофей.`, '#ffd27a'); fxText(bp.x, bp.y - 470, 'ПОВЕРЖЕН!', '#ffd27a', 64, 3.5, 'boss'); MODALS.push({ type: 'bosswin', boss: b.name, guild: topG, n, t: 0 }); }
    else { log(`${b.name} ${gv(b.name,'ушёл','ушла')}${why ? ' (' + why + ')' : ''}.${fought ? ` Утешительно: ${BE.consolationGold} золота.` : ''}`, '#ffb08a'); if (fought) fxText(bp.x, bp.y - 470, 'БОСС УШЁЛ…', '#ffb08a', 56, 3, 'boss'); }
    emitBot({ event: 'bossEnd', text: fought && killed ? `★ ${b.name} ${gv(b.name,'повержен','повержена')}! Отряд: ${n}.` : `${b.name} ${gv(b.name,'ушёл','ушла')}${why ? ' (' + why + ')' : ''}.`, killed: !!(fought && killed) });
    b.fled = !(fought && killed); BF = null; S.bossIdx = (S.bossIdx || 0) + 1;
    bump('boss', 8); save(); refreshUI();
    if (RCP.onBossEnd === true && fought) setTimeout(() => recapStart('после босса'), (RCP.onBossEndDelaySec ?? 12) * 1000); // v6.41
    return { ok: true, killed: !!(fought && killed) };
  }
  function giveChestQuiet(h, tier) { const ch = C.chests[tier], out = []; if (!ch) return out; h.rpg_chestsGot = (h.rpg_chestsGot || 0) + 1; for (let i = 0; i < ch.rolls; i++) out.push(chestItem(h, weighted(COS_ON() ? ch.items : ch.items.filter(x => x.type !== 'cosmetic')))); { const cz = cosChestRoll(h, tier); if (cz) out.push(cz); } if (tier === 'legendary') { h.rpg_legendary++; shChestDrop(h, tier, out); } return out; }
  // тест: n тестовых героев (классы по кругу), сразу запись; fight=true — сразу бой
  function testBossSquad(n, fight, key) {
    if (bossActive()) endBoss(false, 'тест'); BF = null;
    n = Math.max(1, Math.min(50, +n || (BE.maxSquads || 8) * 5));
    const cls = ['paladin', 'priest', 'warrior', 'mage', 'archer', 'assassin'];
    const d = (key && BE.bosses.find(b => b.id === key || b.name === key)) || bossDef(); sessionTouch('тест');
    S.boss = { phase: 'wait', key: d.id, name: d.name, gen: d.gen, acc: d.acc, filter: d.filter || '', fem: !!d.fem, size: d.size || 0, spawnAt: now(), signup: [], test: true };
    spawnBoss();
    for (let i = 0; i < n; i++) {
      const nick = 'Тест_' + (i + 1); if (!S.heroes[nick]) createHero(nick, cls[i % cls.length], i % 2 ? 'female' : 'male', true);
      const h = S.heroes[nick]; h.rpg_class = cls[i % cls.length]; h.rpg_guild = C.guilds[Math.floor(i / 5) % C.guilds.length].id; h.rpg_level = Math.max(h.rpg_level, 5); h.rpg_hp = stats(h).maxhp;
      const rt = ensureRT(h); BATTLES.filter(x => x.user === nick).forEach(x => BATTLES.splice(BATTLES.indexOf(x), 1)); rt.mode = 'walk'; rt.dest = null; rt.path = [];
      S.cooking = S.cooking.filter(j => j.user !== nick);
      rt.loc = 'boss'; rt.x = 400 + R(-80, 80); rt.y = ROAD; joinBoss(nick, true);
    }
    if (fight) beginFight();
    return { ok: true, n };
  }

  // ===================== ПОХОДЫ И БОИ (лес) =====================
  // v6.55 п.19: !пати — очередь в групповой поход: собирается size героев (или min за waitSec), мобы сильнее, награда выше
  const PTY = () => Object.assign({ enabled: true, size: 3, min: 2, waitSec: 180, mobHp: 1.25, mobAtk: 1.1, mobAtk2: 1.5, reward: 1.5 }, C.party || {});
  const PARTYQ = { users: [], t0: 0 };
  function partyJoin(nick) {
    const P = PTY(), h = getHero(nick, false); if (!h) return { ok: false, msg: 'нет героя' };
    if (!P.enabled) return res(h, false, 'групповые походы выключены');
    if (PARTYQ.users.includes(h.user)) return res(h, false, `ты уже в очереди пати (${PARTYQ.users.length}/${P.size})`);
    const rt = ensureRT(h); if (rt.mode === 'dead') return res(h, false, 'ещё возвращается в лагерь');
    const bl = blocked(h, 'expedition'); if (bl) return res(h, false, bl);
    if (!PARTYQ.users.length) PARTYQ.t0 = Date.now();
    PARTYQ.users.push(h.user); const ix = PARTYQ.users.length - 1, sqN = Math.floor(ix / P.size), place = ix % P.size + 1; // v6.57: в отряде максимум size, остальные собирают следующий
    say(h, `Пати ${place}/${P.size}`);
    log(`🛡 ${DN(h)} в очереди пати: ${sqN ? `отряд №${sqN + 1} (следующий), ` : ''}${place}/${P.size}`, '#bfe0ff');
    if (sqN) { if (EXPQ.includes(h.user)) EXPQ.splice(EXPQ.indexOf(h.user), 1); return res(h, true, `отряд заполнен (${P.size}/${P.size}) — ты собираешь следующий отряд: ${place}/${P.size}, уйдёт после первого`); }
    if (EXPQ.includes(h.user)) EXPQ.splice(EXPQ.indexOf(h.user), 1); /* v6.57: из очереди похода — в очередь пати */
    if (PARTYQ.users.length >= P.size && partyLanesFree() >= partyNeedLanes(P.size)) partyGo();
    return res(h, true, `ты в очереди пати (${Math.min(PARTYQ.users.length, P.size)}/${P.size}); старт, когда наберётся ${P.size} или через ${Math.round(P.waitSec / 60)} мин при ${P.min}+`);
  }
  function partyGo() {
    const P = PTY(), us = PARTYQ.users.splice(0, P.size).filter(u => S.heroes[u]); PARTYQ.t0 = PARTYQ.users.length ? Date.now() : 0;
    const party = us.length >= P.min ? { id: Date.now(), users: us.slice(), mobHp: P.mobHp, mobAtk: P.mobAtk, reward: P.reward } : null;
    if (party && P.shared) { const lane = freeLane(); if (lane !== undefined) party.G = { id: party.id, lane, users: us.slice(), bs: [], turn: 0, phase: 'walk', mon: null, wave: 0, timer: 0 }; } // v6.57b: один моб на всех, одна тропа
    if (party && party.G) { const RK = { paladin: 0, warrior: 1, archer: 2, assassin: 2, mage: 3, priest: 4 }; us.sort((a, b) => (RK[S.heroes[a].rpg_class] ?? 2) - (RK[S.heroes[b].rpg_class] ?? 2)); party.G.users = us.slice(); } // v6.57b2: строй — танк впереди, затем бойцы, маг, жрица за магом
    let slot = 0; const went = us.filter(u => { const r = sendToExpedition(u, party, party && party.G ? slot++ : 0); if (r && r.ok) return true;
      const hh = S.heroes[u]; if (hh) { hh.rpg_reward = hh.rpg_reward || {}; hh.rpg_reward.hike = (hh.rpg_reward.hike || 0) + 1; hh.rpg_hikeAt = 0; log(`🛡 ${DN(hh)}: пати не ушла (${r && r.msg || 'ошибка'}) — токен похода возвращён`, '#bfe0ff'); } return false; }); // токен не сгорает
    save();
    if (party) log(`🛡 Пати в поход: ${went.map(u => DN(S.heroes[u])).join(', ')} — мобы ×${P.mobHp} HP, награда ×${P.reward}`, '#bfe0ff');
    else if (went.length) log(`🛡 Пати не набралась — ${went.map(u => DN(S.heroes[u])).join(', ')} идёт в обычный поход`, '#bfe0ff');
    return { ok: true, went, party: !!party };
  }
  const PMON_X = lane => Math.max(MON_X + LX[lane], (+(C.party || {}).minX || 780) + 2 * (+(C.party || {}).gap || 225) + 170); // v49.8: моб пати встаёт перед передним героем (отряд стоит с шагом 225)
  const laneCount = () => Math.min(C.maxBattleLanes, LANES.length);
  const freeLane = () => { const used = BATTLES.map(b => b.lane); return [...Array(laneCount()).keys()].find(i => !used.includes(i)); };
  const partyLanesFree = () => laneCount() - new Set(BATTLES.map(b => b.lane)).size; /* v6.57b: отряд занимает одну тропу */
  const partyNeedLanes = n => PTY().shared ? 1 : n;
  // v6.57: очередь на !поход — если тропы заняты, герой встаёт в очередь и уходит сам, когда тропа освободится
  const EXPQ = [];
  function expQueueInfo(user) { const i = EXPQ.indexOf(user); return i < 0 ? null : { pos: i + 1, total: EXPQ.length }; }
  function expQueueTick() {
    while (EXPQ.length && freeLane() !== undefined && !(PARTYQ.users.length >= PTY().size && partyLanesFree() <= 1)) { // полный отряд пати не обгоняем
      const u = EXPQ.shift(), h = S.heroes[u]; if (!h) continue; const r = sendToExpedition(u);
      if (r && r.ok) { log(`⏳ ${DN(h)}: очередь дошла — в поход!`, '#bfe0ff'); emitBot({ event: 'expeditionQueueGo', user: h.user, text: `@${DN(h)} очередь дошла — ты уходишь в поход` }); }
      else { h.rpg_reward = h.rpg_reward || {}; h.rpg_reward.hike = (h.rpg_reward.hike || 0) + 1; h.rpg_hikeAt = 0; log(`⏳ ${DN(h)}: поход из очереди не начат (${r && r.msg || 'ошибка'}) — токен похода возвращён`, '#bfe0ff'); } }
  }
  function partyTick() { const P = PTY(), n = PARTYQ.users.length; if (!n) return; // старт ждёт свободных троп, чтобы пати ушла целиком
    const want = n >= P.size ? P.size : (Date.now() - PARTYQ.t0 >= P.waitSec * 1000 ? n : 0);
    if (want && partyLanesFree() >= partyNeedLanes(Math.min(want, P.size))) partyGo(); }
  function sendToExpedition(nick, party, slot) {
    const h = getHero(nick, true), rt = ensureRT(h);
    if (rt.mode === 'dead') return res(h, false, 'ещё возвращается в лагерь');
    const qi = expQueueInfo(h.user); if (qi && !party) return res(h, false, `ты уже в очереди похода: ${qi.pos} из ${qi.total}`);
    const bl = blocked(h, 'expedition'); if (bl) return res(h, false, bl);
    const G = party && party.G, lane = G ? G.lane : freeLane();
    const pq = !party && PARTYQ.users.length >= PTY().size && partyLanesFree() <= 1; // свободная тропа держится для собранного отряда пати
    if (lane === undefined || pq) {
      if (party) return res(h, false, 'все тропы заняты, подожди');
      EXPQ.push(h.user); const q = expQueueInfo(h.user); say(h, `Очередь ${q.pos}`);
      emitBot({ event: 'expeditionQueue', user: h.user, pos: q.pos, total: q.total, text: `@${DN(h)} ${pq ? 'тропу ждёт отряд пати' : 'все тропы заняты'} — ты в очереди похода: ${q.pos} из ${q.total}` });
      log(`⏳ ${DN(h)} в очереди похода: ${q.pos} из ${q.total}${pq ? ' (ждёт отряд пати)' : ''}`, '#bfe0ff');
      return res(h, true, `${pq ? 'тропу ждёт отряд пати' : 'все тропы заняты'} — ты в очереди похода: ${q.pos} из ${q.total}, уйдёшь автоматически`);
    }
    const st = stats(h); if (h.rpg_hp < st.maxhp * 0.4) h.rpg_hp = Math.round(st.maxhp * 0.4);
    if ((h.rpg_bag.luck || 0) > 0 && !h.rpg_bag._luckActive) { h.rpg_bag.luck--; h.rpg_bag._luckActive = 1; h.rpg_bag._luckGot = 0; say(h, 'Зелье удачи!'); }
    const b = { user: h.user, lane, wave: 0, mon: null, timer: 0, turn: 0, loot: { gold: 0, xp: 0 }, phase: 'walk', party: party || null, G: G || null, slot: G ? (slot || 0) : 0 };
    BATTLES.push(b); touch(h); if (G) G.bs.push(b); shieldGive(h); lootHikeMark(h); // v7panel35: счётчик походов для lootBalance
    say(h, G ? 'В пати!' : 'В поход!');
    // v7panel33: строй по ролям — танк впереди, дамагеры, жрец сзади
    const roleOrder = { paladin: 0, warrior: 1, archer: 2, assassin: 2, mage: 2, priest: 3 }; // v49.4: ниже — ?? вместо || (паладин 0 не должен становиться 2)
    const sorted = G ? G.bs.slice().sort((a, b) => {
      const ca = (S.heroes[a.user] && S.heroes[a.user].rpg_class) || 'warrior';
      const cb = (S.heroes[b.user] && S.heroes[b.user].rpg_class) || 'warrior';
      return (roleOrder[ca] ?? 2) - (roleOrder[cb] ?? 2);
    }) : null;
    const mySlot = G ? b.slot : (sorted ? sorted.findIndex(x => x.user === h.user) : b.slot); // v49.4: место в строю = порядок partyGo (уже отсортирован: паладин, воин, бойцы, маг, жрец). Раньше считалось по тем, кто уже ушёл, а паладин (0 || 2) ранжировался как боец → воин и паладин вставали в одну точку, второй паладин — за жрецом
    let fx = HERO_X + 40 + LX[lane], fy = LANES[lane] + mySlot * 14;
    if (G) { // v49.4: строй пати влезает в тропу: левее x≈780 героя уводило на дорогу внизу экрана или ставило между танком и вторым героем. Отряд из 3 на ближних тропах встаёт чуть ближе к мобу и плотнее, со сдвигом по глубине
      const n = Math.max(1, (G.users || []).length), PX = C.party || {}, minX = +PX.minX || 780, G6 = +PX.gap || 225, front = Math.max(fx + (n > 2 && !LX[lane] ? 60 : 0), minX + G6 * (n - 1) + (lane % 2 ? Math.round(G6 / 2) : 0) /* v49.8: соседние тропы сдвинуты на полшага — герой нижней тропы стоит между героями верхней */) /* v49.8: отряд не сжимается — передний встаёт ближе к мобу */, gap = n > 1 ? Math.min(G6, (front - minX) / (n - 1)) : 0; // v49.8: шире — ники соседей не налезают
      fx = Math.round(front - mySlot * gap); fy = LANES[lane]; } // v49.8: отряд в одну линию по тропе (сдвиг по глубине закрывал ник соседа)
    travel(h, 'forest', fx, fy, () => { b.phase = 'spawn'; rt.flip = false; }); // v6.57b: отряд стоит рядом на одной тропе
    rt.mode = 'exp'; bump('forest', 3);
    return res(h, true, 'отправляется в поход');
  }
  function spawnMonster(b) {
    const h = S.heroes[b.user];
    const pool = C.monsters.filter(m => m.minLevel <= h.rpg_level + b.wave);
    const d = (b.forceMon === 'mimic' ? mimicDef(pool) : b.forceMon && C.monsters.find(m => m.id === b.forceMon)) || weighted(pool), lv = 1 + Math.floor((h.rpg_level - 1) / 2);
    if (b.forceMon === 'mimic') b.forceMon = null;
    const pm = b.party || { mobHp: 1, mobAtk: 1 }, kH = mobLvK(h.rpg_level, 'hpPerLevel'), kA = mobLvK(h.rpg_level, 'atkPerLevel'); /* v49.8: mobLevelScale */ b.mon = { d, hp: Math.max(1, Math.round(d.hp * lv * pm.mobHp * kH)), maxhp: Math.max(1, Math.round(d.hp * lv * pm.mobHp * kH)), atk: Math.max(1, Math.round((d.atk + (lv - 1) * 2) * pm.mobAtk * mobAtkK() * kA)), def: d.def, x: MON_X + LX[b.lane] + 220, y: LANES[b.lane], hit: 0, dead: 0, born: 0 };
    b.phase = 'approach'; b.turn = 0; mimicPlace(b, b.mon);
    clog(`${h.user}: волна ${b.wave + 1} — ${d.name} (${b.mon.hp} HP)`, d.rare ? '#ff9cc4' : '#d8c8a8');
    if (d.rare) log(`Редкий монстр: ${d.name}!`, '#ff9cc4');
    if (d.mimic) log(`${DN(h)}: сундук ожил — это Мимик!`, '#ffb36a');
  }
  // v6.57c: мимик — сундук-монстр (z4, лента 32x28, смотрит влево). Статы — среднее доступных мобов × K, награда — сундук лучшего тира + шанс косметики
  // v6.57b2: мимик появляется ВМЕСТО сундука: при убийстве моба, где выпал бы сундук, с шансом C.mimic.chance сундук «оживает» на том же месте
  function mimicPlace(T, mon) { if (!T.mimicAt || !mon.d.mimic) return; mon.x = T.mimicAt.x; mon.wake = 0.7; T.mimicAt = null; }
  function mimicWake(T, m, dt) { if (!(m.wake > 0)) return false; m.wake -= dt; return true; }
  function mimicNextFromDeath(T) { if (!T.mimicAt) return false; T.forceMon = 'mimic'; T.phase = 'spawn'; return true; }
  function mimicRoll(lv) { const M = MIM(); return !!M.enabled && lv >= (M.minLevel || 1) && Math.random() < (M.chance || 0); }
  function mimicDef(pool) { const M = MIM(), P = (pool && pool.length ? pool : C.monsters).filter(x => !x.rare), A = k => P.reduce((t, x) => t + (x[k] || 0), 0) / Math.max(1, P.length);
    return { id: 'mimic', name: M.name || 'Мимик', hp: Math.round(A('hp') * (M.hpK || 1.25)), atk: Math.round(A('atk') * (M.atkK || 1.15)), def: Math.round(A('def')), xp: Math.round(A('xp') * (M.xpK || 1.8)), gold: Math.round(A('gold') * (M.goldK || 2)), h: M.h || 120, minLevel: 1, weight: 0, mimic: true }; }

  // v6.57b: общий бой отряда — partycore.js считает ход, тут отрисовка, лут и смерти
  const PCT = () => { const np = NERF('paladin'), nr = NERF('priest'); return { paladin: Object.assign(CT('paladin'), np && np.auraHeal != null ? { auraHeal: np.auraHeal } : {}, np && np.partyBlock != null ? { block: np.partyBlock } : {}, np && np.partyBlockReduce != null ? { blockReduce: np.partyBlockReduce } : {}, np && np.partyDmgReduce != null ? { dmgReduce: np.partyDmgReduce } : {}), warrior: CT('warrior'), priest: nr ? { healPct: nr.healPct, healBelow: nr.healBelow } : {}, tankHitShare: PTY().tankHitShare /* v49.4 */, minDmg: g9MinDmg() /* v9c */ }; };
  // v46: гибрид амулета — общий расчёт для пати, соло и босса (раньше только пати)
  function hybridOf(h) { const it = eqItem((h.rpg_equip || {}).trinket); if (!it || !it.hybrid) return null; return { type: it.hybrid, power: (it.hybridPower || 1) * ((GEARCAP() || {}).hybridMul || 1), every: it.hybridEvery || 2, name: it.name }; } // та же формула, что в пати (без прочности — как в пати)
  const HY_HEAL_K = 0.12, HY_HEAL_BELOW = 0.7; // как в partycore: 12% × power, если HP < 70%
  function groupTick(G, dt) {
    const bs = G.bs.filter(b => BATTLES.includes(b) && S.heroes[b.user]); if (!bs.length) return;
    const H = b => S.heroes[b.user];
    if (G.phase === 'walk') { if (bs.every(b => b.phase !== 'walk')) G.phase = 'spawn'; else return; }
    if (G.phase === 'spawn') {
      const lvMax = Math.max(...bs.map(b => H(b).rpg_level)), lvAvg = bs.reduce((s, b) => s + H(b).rpg_level, 0) / bs.length, P = G.P || PTY(), G9LAST = !!G.g9 && G.wave >= (G.waves || C.expeditionWaves) - 1; // v9: гильд-поход — свои параметры и мини-босс в последней волне
      const pool = C.monsters.filter(m => m.minLevel <= lvMax + G.wave), d = G9LAST ? g9BossDef() : G.forceMon === 'mimic' ? mimicDef(pool) : weighted(pool); G.forceMon = null; const lv = 1 + Math.floor((Math.round(lvAvg) - 1) / 2);
      const mm = PartyCore.monFor(d, lv, bs.length, P); mm.atk = Math.round(mm.atk * mobAtkK(bs.map(b => H(b).rpg_class))); mm.hp = Math.max(1, Math.round(mm.hp * mobLvK(lvAvg, 'hpPerLevel'))); mm.atk = Math.max(1, Math.round(mm.atk * mobLvK(lvAvg, 'atkPerLevel'))); /* v49.8: mobLevelScale — средний уровень отряда */ // v7panel36: A — поверх mobAtk/mobAtk2
      if (d.mimic) { mm.hp = Math.round(mm.hp * 1.3); mm.atk = Math.round(mm.atk * 1.15); }
      if (G.g9) { const HP9 = G9().hike, up = 1 + (HP9.waveUp || 0) * G.wave; mm.hp = Math.round(mm.hp * up * (G9LAST ? HP9.boss.hp : 1)); mm.atk = Math.round(mm.atk * (G9LAST ? HP9.boss.atk : up)); if (G9LAST && HP9.boss.gear) { const act = bs.reduce((s, b) => s + stats(H(b)).atk, 0), base = bs.reduce((s, b) => { const h = H(b), c = clsById(h.rpg_class); return s + c.atk + (h.rpg_level - 1) * 2; }, 0), gk = Math.max(1, Math.min(HP9.boss.gearMax || 1.5, act / Math.max(1, base))); mm.hp = Math.round(mm.hp * gk); mm.atk = Math.round(mm.atk * (1 + (gk - 1) * HP9.boss.gear)); } /* v9b: мини-босс учитывает снаряжение отряда (во сколько раз урон героев выше «голого» по уровню) */ if (G9LAST) { log(`⚔ Гильд-поход «${g9Name(G.g9)}»: мини-босс — ${d.name}!`, '#ffb08a'); bs.forEach(b => say(H(b), 'Босс!')); } } // v9
      G.mon = { d, hp: mm.hp, maxhp: mm.hp, atk: mm.atk, def: mm.def, x: (G.monX || PMON_X(G.lane)) + 220, y: LANES[G.lane], hit: 0, dead: 0, born: 0, party: true };
      bs.forEach(b => { b.mon = G.mon; b.phase = 'group'; }); G.phase = 'approach'; mimicPlace(G, G.mon);
      clog(`Отряд (${bs.map(b => DN(H(b))).join(', ')}): волна ${G.wave + 1} — ${d.name} (${G.mon.hp} HP, общий)`, d.rare ? '#ff9cc4' : '#bfe0ff');
    }
    const m = G.mon; if (!m) return;
    if (G.phase === 'approach') { if (mimicWake(G, m, dt)) return; m.born += dt; m.x -= 200 * dt; if (m.x <= (G.monX || PMON_X(G.lane))) { m.x = G.monX || PMON_X(G.lane); G.phase = 'fight'; G.timer = 0.4; G.turn = 0; bs.forEach(b => { const h = H(b); if (h) { h._tauntUntil = 0; h._tauntCd = 0; } }); } return; } // v7panel43: сброс таунта на старте волны (turn снова 0)
    if (G.phase === 'fight') {
      G.timer -= dt; if (G.timer > 0) return; G.timer = 0.8; bump('forest', 0.5);
      const my = m.y - (m.d.h || 120) * persp(m.y) - 40, byU = {};
      if (G.turn % 2 === 0) bs.forEach(b => { const h = H(b), st = stats(h); let hl; if (h.rpg_hp > 0 && h.rpg_hp < st.maxhp * C.potionAutoHp && (hl = drinkPotion(h))) { const rt = ensureRT(h); fxText(rt.x - 60, rt.y - heroH(rt) - 40, `+${hl} зелье`, '#7dff9a', 26, 1.6, 'forest'); } });
      const ms = bs.map(b => { const h = H(b), st = stats(h); byU[h.user] = b; const hyIt = eqItem(h.rpg_equip.trinket); const hybrid = hyIt && hyIt.hybrid ? { type: hyIt.hybrid, power: (hyIt.hybridPower || 1) * ((GEARCAP() || {}).hybridMul || 1), every: hyIt.hybridEvery || 2 } : null; return { id: h.user, c: clsById(h.rpg_class), hp: h.rpg_hp, shield: h._shield || 0, maxhp: st.maxhp, atk: Math.round(st.atk * (1 + (h._rage || 0))), def: h.rpg_class === 'paladin' && (NERF('paladin') || {}).partyDefAdd ? Math.max(0, st.def + NERF('paladin').partyDefAdd) : st.def, block: equipBonus(h).block || 0, dodge: st.eq.dodge || 0, hybrid, slot: b.slot, tauntUntil: h._tauntUntil || 0, tauntCd: h._tauntCd || 0 }; }); // v7panel43: tauntUntil/Cd переживают тик (раньше ms пересобирался без них → лог «таунт!» был, а дух бил дальника)
      const ev = PartyCore.step(G, m, ms, G.g9 && m.d && m.d.g9boss && G9().hike.minDmg ? Object.assign({}, PCT(), { minDmg: G9().hike.minDmg }) : PCT()); if (G.g9) g9Mech(G, m, ms, ev, bs); // v9: механики мини-боссов; броня гасит не больше (1−minDmg) удара мини-босса
      ms.forEach(x => { const hh = S.heroes[x.id]; hh.rpg_hp = x.hp; if (hh._shield > 0 && !(x.shield > 0)) clog(`${DN(hh)}: щит палатки разрушен`, '#7fd0ff'); hh._shield = x.shield || 0; hh._tauntUntil = x.tauntUntil || 0; hh._tauntCd = x.tauntCd || 0; });
      const pos = u => { const rt = ensureRT(S.heroes[u]); return { rt, x: rt.x, y: rt.y - heroH(rt) - 40 }; };
      let k = 0;
      for (const e of ev) {
        if (e.t === 'hit') { const p = pos(e.from), h = S.heroes[e.from], c = clsById(h.rpg_class); p.rt.lunge = 0.25; pfxAnim(e.from, 'l', 'forest'); m.hit = 0.2; pfxAnim(m.d && m.d.id, 'mh', 'forest'); durOnHit(h); sStat(h, 'dmg', e.dmg); caggAdd('f' + h.user, h.user + ' → ' + m.d.name, 'dmg', e.dmg);
          fxText(m.x + 30 + (k++ % 3) * 26, my - (k % 3) * 22, e.tag + '-' + e.dmg, e.tag ? '#ffcf4a' : '#ffffff', e.tag ? 30 : 28, 1.3, 'forest');
          if (e.tag) clog(`${DN(h)}: ${e.tag.trim()} ${e.dmg} урона`, '#ffcf4a'); if (/КРИТ/.test(e.tag || '') && byU[e.from]) byU[e.from].crits = (byU[e.from].crits || 0) + 1; // v49.2: счёт критов за поход
          FX.push({ kind: 'attack', fx: c.fx, loc: 'forest', x: p.x + 40, y: p.rt.y - 80, tx: m.x, ty: my + 40, t: 0, life: 0.5 }); }
        else if (e.t === 'heal') { { const hh = S.heroes[e.from]; if (hh && e.n > 0) sStat(hh, 'heal', e.n); } /* v45: лечение в пати → итоги стрима (эффективное, кастеру) */ const p = pos(e.to); fxText(p.x - 50, p.y - (e.from === e.to ? 0 : 24), `+${fmtHP(e.n)} ${e.kind}`, '#fff6a0', 24, 1.6, 'forest'); clog(`${DN(S.heroes[e.from])} ${e.kind === 'свет' ? 'лечит' : e.kind}: ${DN(S.heroes[e.to])} +${fmtHP(e.n)} HP`, '#fff6a0'); }
        else if (e.t === 'dodge') { const p = pos(e.to); fxText(p.x - 40, p.y, 'Уклон!', '#c8f0a8', 26, 1.2, 'forest'); clog(`${DN(S.heroes[e.to])}: уклон!`, '#c8f0a8'); if (byU[e.to]) byU[e.to].dodges = (byU[e.to].dodges || 0) + 1; } // v49.2: уклон в пати — в журнал и в итог
        else if (e.t === 'hurt') { const p = pos(e.to); durOnHurt(S.heroes[e.to]); if (e.sh) fxText(p.x - 40, p.y - 70, 'щит −' + e.sh, '#7fd0ff', 24, 1.2, 'forest'); p.rt.hit = 0.2; pfxAnim(e.to, 'h', 'forest'); m.atkT = 0.7; pfxAnim(m.d && m.d.id, 'ma', 'forest'); caggAdd('m' + e.to, m.d.name + ' → ' + e.to, 'dmg', e.dmg); fxText(p.x - 40, p.y, '-' + e.dmg, '#ff7a6a', 30, 1.3, 'forest'); if (e.blk) { fxText(p.x - 40, p.y - 40, 'Блок!', '#bfe0ff', 26, 1.2, 'forest'); const bh = S.heroes[e.to]; caggAdd('b' + e.to, DN(bh) + ': блок щитом', 'blk', 1); sStat(bh, 'blk', 1); } if (e.taunted) fxText(p.x - 40, p.y - 90, 'Таунт!', '#ffd27a', 22, 1.1, 'forest'); } // v7panel32: блок в пати теперь в логе/статистике
        else if (e.t === 'taunt') { const h = S.heroes[e.from]; if (h) { clog(`${DN(h)}: таунт!`, '#ffd27a'); fxText(pos(e.from).x, pos(e.from).y - 60, 'Таунт!', '#ffd27a', 24, 1.4, 'forest'); } }
        else if (e.t === 'dead') { const b = byU[e.to]; (G.fallen = G.fallen || []).push({ user: e.to, g0: G.lg || 0, x0: G.lx || 0 }); /* v49.3: доля павшего — от добычи отряда после его гибели */ clog(`${DN(S.heroes[e.to])} выбывает — отряд бьётся дальше`, '#ff9c7a'); loseBattle(b, S.heroes[e.to]); }
        else if (e.t === 'kill') { const alive = bs.filter(b => BATTLES.includes(b)); G.lg = (G.lg || 0) + (+m.d.gold || 0); G.lx = (G.lx || 0) + (+m.d.xp || 0); alive.forEach(b => winWave(b, H(b))); G.phase = 'dying'; G.timer = 0.9; m.dead = m.dead || 0.01; }
      }
      if (!bs.some(b => BATTLES.includes(b))) G.mon = null;
      return;
    }
    if (G.phase === 'dying') { G.timer -= dt; if (G.timer > 0) return;
      if (G.mimicAt) { G.mon = null; bs.forEach(b => { b.mon = null; }); mimicNextFromDeath(G); return; }
      G.mon = null; G.wave++; bs.forEach(b => { b.mon = null; b.wave = G.wave; });
      if (G.wave >= (G.waves || C.expeditionWaves)) { bs.forEach(b => finishExpedition(b, H(b))); fallenShare(G); log(`🛡 Отряд завершил поход: ${bs.map(b => DN(H(b))).join(', ')}`, '#bfe0ff'); }
      else { G.phase = 'spawn'; bs.forEach(b => { const h = H(b), st = stats(h); if (st.regen) h.rpg_hp = Math.min(st.maxhp, h.rpg_hp + Math.round(st.maxhp * st.regen)); if (G.g9) h.rpg_hp = Math.min(st.maxhp, h.rpg_hp + Math.round(st.maxhp * (G9().hike.waveHeal || 0))); }); } // v9: передышка между волнами гильд-похода
    }
  }
  // v49.3: павший в пати-походе получает долю отряда, если хоть кто-то дошёл до конца: fallenShare × (добыча выжившего после гибели павшего) × party.reward. Лута нет.
  function fallenShare(G) {
    const K = Math.max(0, Math.min(1, +PTY().fallenShare || 0)), mul = +PTY().reward || 1; if (!K || !G.fallen) return;
    for (const f of G.fallen) { const h = S.heroes[f.user]; if (!h) continue;
      const g = Math.round(Math.max(0, (G.lg || 0) - f.g0) * mul * K), xp = Math.round(Math.max(0, (G.lx || 0) - f.x0) * mul * K); if (!g && !xp) continue;
      h.rpg_gold = (+h.rpg_gold || 0) + g; sStat(h, 'expGold', g); sStat(h, 'gold', g); gainXp(h, xp);
      log(`${DN(h)} (пал) получает долю отряда: +${g} золота, +${xp} опыта`, '#c8f0a8'); clog(`${DN(h)} (пал): доля отряда +${g} золота`, '#ffd27a'); }
    G.fallen = null; save();
  }
  function battleTick(b, dt) {
    const h = S.heroes[b.user]; if (!h) return;
    if (b.G) return; // v6.57b: отрядом управляет groupTick
    const rt = ensureRT(h), st = stats(h), c = clsById(h.rpg_class);
    const hx = rt.x, hy = rt.y - heroH(rt) - 40;
    if (b.phase === 'spawn') spawnMonster(b);
    if (b.phase === 'approach') {
      if (mimicWake(b, b.mon, dt)) return;
      b.mon.born += dt; b.mon.x -= 200 * dt;
      if (b.mon.x <= MON_X + LX[b.lane]) { b.mon.x = MON_X + LX[b.lane]; b.phase = 'fight'; b.timer = 0.4; b.turn = c.ability === 'first' ? 0 : 1; if (c.ability === 'first') fxText(hx, hy - 30, 'Первый выстрел!', '#c8f0a8', 24, 1.6, 'forest'); }
      return;
    }
    if (b.phase === 'fight') {
      b.timer -= dt; if (b.timer > 0) return; b.timer = 1.5;
      const m = b.mon, my = m.y - (m.d.h || 120) * persp(m.y) - 40;
      bump('forest', 0.4);
      if (b.turn % 2 === 0) {
        rt.lunge = 0.25; pfxAnim(h.user, 'l', 'forest');
        let hl0 = 0;
        { const hyb = hybridOf(h); /* v46: Амулет Света в соло (раньше гибриды работали только в пати). Как в пати: каждый every-й ход героя, HP < 70% → +12%×power, удар не тратится */
          if (hyb && hyb.type === 'heal' && h.rpg_hp > 0 && b.turn > 0 && (b.turn / 2) % hyb.every === 0 && h.rpg_hp < st.maxhp * HY_HEAL_BELOW) { const n = Math.min(st.maxhp - h.rpg_hp, Math.round(st.maxhp * HY_HEAL_K * (hyb.power || 0.5))); if (n > 0) { h.rpg_hp += n; sStat(h, 'heal', n); fxText(hx - 60, hy - 30, `+${fmtHP(n)} ${hyb.name}`, '#fff6a0', 24, 1.6, 'forest'); clog(`${DN(h)}: ${hyb.name} +${fmtHP(n)} HP`, '#fff6a0'); } } }
        if (h.rpg_hp < st.maxhp * C.potionAutoHp && (hl0 = drinkPotion(h))) { fxText(hx - 60, hy, `+${hl0} зелье`, '#7dff9a', 26, 1.6, 'forest'); clog(`${h.user}: зелье +${hl0} HP`, '#7dff9a'); }
        else if (c.ability === 'heal' && h.rpg_hp < st.maxhp * ((NERF('priest') || {}).selfBelow || 0.5) && b.turn % 6 === 0) { const hl = Math.round(st.maxhp * ((NERF('priest') || {}).selfHeal || 0.25)), hp0 = h.rpg_hp; h.rpg_hp = Math.min(st.maxhp, h.rpg_hp + hl); sStat(h, 'heal', Math.max(0, Math.round(h.rpg_hp - hp0))); /* v45 */ fxText(hx - 60, hy, `+${hl} свет`, '#fff6a0', 26, 1.6, 'forest'); clog(`${h.user}: «Свет» +${hl} HP (КД 6 ходов)`, '#fff6a0'); }
        else if (c.auraHeal && CT('paladin').auraEvery > 0 && b.turn > 0 && (b.turn / 2) % CT('paladin').auraEvery === 0 && h.rpg_hp < st.maxhp) { // v6.55 п.18: аура — раз в N ходов, а не +4% каждый удар
          const hl = Math.min(st.maxhp - h.rpg_hp, Math.round(st.maxhp * ((NERF('paladin') || {}).soloAuraHeal || CT('paladin').auraHeal))); h.rpg_hp += hl; sStat(h, 'heal', Math.max(0, hl)); /* v45 */ fxText(hx - 60, hy, `+${hl} аура`, '#fff6a0', 26, 1.6, 'forest'); clog(`${DN(h)}: святая аура +${hl} HP (раз в ${CT('paladin').auraEvery} хода)`, '#fff6a0');
        }
        else {
          let dmg = Math.max(1, Math.round((st.atk * (1 + (h._rage || 0)) - m.def) * (0.85 + Math.random() * 0.3))), tag = '';
          let isCrit = false; if (c.ability === 'crit' && Math.random() < c.crit) { dmg *= 2; tag = 'КРИТ '; isCrit = true; }
          if (c.ability === 'arcane' && b.turn % 6 === 4) { dmg = Math.round(dmg * 2.5); tag = 'ЗАЛП '; }
          if (c.ability === 'cleave' && Math.random() < CT('warrior').cleaveChance) { /* v6.55 п.18: было 30% */ dmg = Math.round(dmg * 1.4); tag = 'РАССЕК '; }
          if (isCrit) { b.crits = (b.crits || 0) + 1; clog(`${DN(h)}: КРИТ ${dmg} урона`, '#ffcf4a'); } // v49.2: крит соло — в журнал и в итог похода
          m.hp -= dmg; durOnHit(h); sStat(h, 'dmg', dmg); m.hit = 0.2; pfxAnim(m.d && m.d.id, 'mh', 'forest'); caggAdd('f' + h.user, h.user + ' → ' + m.d.name, 'dmg', dmg); fxText(m.x + 40, my, tag + '-' + dmg, tag ? '#ffcf4a' : '#ffffff', tag ? 32 : 30, 1.3, 'forest');
          FX.push({ kind: 'attack', fx: c.fx, loc: 'forest', x: rt.x + 40, y: rt.y - 80, tx: m.x, ty: my + 40, t: 0, life: 0.5 });
        }
        if (m.hp <= 0) { m.hp = 0; winWave(b, h); return; }
      } else {
        if (Math.random() < (c.dodge || 0) * 0.4 + (st.eq.dodge || 0)) { /* v6.57: + уклонение от снаряжения */ fxText(hx - 40, hy, 'Уклон!', '#c8f0a8', 26, 1.2, 'forest'); b.dodges = (b.dodges || 0) + 1; clog(`${DN(h)}: уклон!`, '#c8f0a8'); /* v49.2 */ b.turn++; return; }
        const np = c.auraHeal ? NERF('paladin') : null; // v7panel36: соло-нерф паладина
        let dmg = Math.max(1, Math.round(Math.max(m.atk - Math.max(0, st.def + (np ? np.soloDefAdd || 0 : 0)), m.atk * g9MinDmg()) * (1 - ((np && np.soloDmgReduce != null ? np.soloDmgReduce : c.dmgReduce) || 0) / 2) * (0.85 + Math.random() * 0.3)));
        if (Math.random() < (c.auraHeal ? CT('paladin').block : 0) + (equipBonus(h).block || 0)) { // v6.56: щит из снаряжения добавляет шанс блока любому классу
          dmg = Math.max(0, Math.round(dmg * (1 - (np && np.soloBlockReduce != null ? np.soloBlockReduce : CT('paladin').blockReduce)))); fxText(hx - 40, hy - 40, 'Блок!', '#bfe0ff', 26, 1.2, 'forest'); caggAdd('b' + h.user, DN(h) + ': блок щитом', 'blk', 1); } // v6.55 п.18
        { const a = shieldAbsorb(h, dmg); if (a) { dmg -= a; fxText(hx - 40, hy - 70, 'щит −' + a, '#7fd0ff', 24, 1.2, 'forest'); } }
        h.rpg_hp -= dmg; durOnHurt(h); rt.hit = 0.2; pfxAnim(h.user, 'h', 'forest'); m.atkT = 0.7; pfxAnim(m.d && m.d.id, 'ma', 'forest'); caggAdd('m' + h.user, m.d.name + ' → ' + h.user, 'dmg', dmg); fxText(hx - 40, hy, '-' + dmg, '#ff7a6a', 30, 1.3, 'forest');
        if (h.rpg_hp <= 0) { h.rpg_hp = 0; loseBattle(b, h); return; }
      }
      b.turn++; return;
    }
    if (b.phase === 'dying') {
      b.timer -= dt;
      if (b.timer <= 0) {
        if (b.mimicAt) { b.mon = null; mimicNextFromDeath(b); return; }
        b.mon = null; b.wave++;
        if (b.wave >= C.expeditionWaves) finishExpedition(b, h);
        else { b.phase = 'spawn'; const wh = h.rpg_hp > 0 ? (st.regen || 0) + (b.party ? 0 : soloWaveHeal()) : 0; /* v49.8: +25% HP между волнами в соло (не отрядом, не мёртвым) */ if (wh > 0) h.rpg_hp = Math.min(st.maxhp, h.rpg_hp + Math.round(st.maxhp * wh)); }
      }
    }
  }
  // v6.57c: награда мимика — лучшее из сундука: тир не ниже C.mimic.chestMin и на ступень выше обычного броска; плюс шанс косметики
  // v7panel12 п.6: лут мимика скромнее — по умолчанию без «ступени выше» и без минимума серебра, материалов вдвое меньше (настройки — в config.mimic)
  const MIMIC_DEF = { chance: 0.03, chestUpgrade: false, chestMin: 'wooden', matMult: 0.5 };
  const MIM = () => Object.assign({}, MIMIC_DEF, C.mimic || {});
  function mimicLoot(h, m, luck) { const M = MIM(), T = ['wooden', 'silver', 'golden', 'legendary'];
    let i = Math.min(3, T.indexOf(rollChestTier(luck)) + (M.chestUpgrade ? 1 : 0)); i = Math.max(i, T.indexOf(M.chestMin || 'wooden'));
    const out = giveChestQuiet(h, T[i]); let cos = null; const mt = addMats(h, 'chest', CHEST_MATS[T[i]].mult * (M.matMult ?? 0.5)); if (mt) out.push({ text: mt, rarity: 'common', key: 'wood' });
    if (COS_ON() && Math.random() < (M.cosChance || 0)) { const pool = cosShop().filter(c => !cosOwn(h, c)); if (pool.length) { cos = cosGive(h, pick(pool)); if (cos) { clog(`Мимик: косметика — ${cos.text}`, '#ff9cc4'); log(`${DN(h)}: из мимика выпала косметика — ${cos.text}`, '#ff9cc4'); } } }
    if (cos) out.push(cos);
    shMimicDrop(h, out); // v49
    { const s = streamCur(); s.loot += out.length; sStat(h, 'loot', out.length); }
    out.forEach((o, k) => FX.push({ kind: 'fly', loc: 'forest', x: m.x, y: m.y - 60, user: h.user, key: o.key && o.key !== 'chest' ? o.key : 'coins', t: -(0.35 + k * 0.12), life: 0.8 }));
    lootPopup(h.user, `Добыча мимика (${(C.chests[T[i]] || {}).name || T[i]})`, out.map(o => o.text), (C.chests[T[i]] || {}).color || '#ffb36a', 0, 'forest');
    log(`${DN(h)}: добыча мимика — ${out.map(o => o.text).join('; ')}`, '#ffb36a'); clog(`Лут мимика: ${out.map(o => o.text).join(', ')}`, '#ffb36a'); save(); refreshUI();
    S._mimicStat = S._mimicStat || { kills: 0 }; S._mimicStat.kills++; return { tier: T[i], items: out.map(o => o.text), cos: cos && cos.text, chestFx: false }; }
  function winWave(b, h) {
    const m = b.mon; b.phase = 'dying'; b.timer = 0.9; m.dead = 0.01;
    b.loot.gold += m.d.gold; b.loot.xp += m.d.xp; h.rpg_kills++; lootPopup(h.user, `${m.d.name} ${m.d.fem ? 'повержена' : 'повержен'}`, [], '#ffd27a', m.d.gold, 'forest');
    log(`${DN(h)} побеждает: ${m.d.name}`, '#c8f0a8'); caggFlush(true); // v6.55 п.3: сначала урон, потом смерть, потом награда
    clog(`✔ ${m.d.name} ${m.d.fem ? 'повержена' : 'повержен'}`, '#c8f0a8'); clog(`${DN(h)}: награда +${m.d.gold} золота, +${m.d.xp} XP`, '#ffd27a');
    questEvent('kill', { monster: m.d.id }, h); goalAdd('kill', 1, h);
    const top = m.y - (m.d.h || 120) * persp(m.y) - 90;
    const luck = (h.rpg_bag._luckActive || 0) > 0, D = C.drops.monster;
    const TT = b.G || b;
    if (m._mim === undefined) { m._mim = !m.d.mimic && !m.d.rare && (TT._forceMimicChest || mimicRoll(h.rpg_level)); TT._forceMimicChest = false; if (m._mim) { TT.mimicAt = { x: m.x, y: m.y }; FX.push({ kind: 'mimicchest', loc: 'forest', x: m.x, y: m.y, t: 0, life: 0.9 }); log(`${DN(h)}: сундук ожил — это Мимик!`, '#ffb36a'); clog('Сундук шевелится… это Мимик!', '#ffb36a'); } }
    if (m.d.mimic || m._mim) { /* v6.57b2: мимик вместо сундука; с самого мимика сундук не падает */ }
    else if (Math.random() < D.chest * (luck ? 2 : 1) || m.d.rare) { if (luck) h.rpg_bag._luckGot = 1; let t = rollChestTier(luck); if (m.d.rare && t === 'wooden') t = D.rareChestMin || 'silver'; giveChest(h, t, m.d.name, { x: m.x, y: m.y, loc: 'forest' }); }
    if (RARE_LOOT() && Math.random() < RL.monsterWeed) { lootVeg(h, 'weed', 1); clog(`Лут: ${VEG.weed || 'weed'} — ${DN(h)}`, '#b8e0a0'); } // v7panel21: сорняк — отдельно, для зелий
    if (Math.random() < (RARE_LOOT() ? RL.monsterVeg : D.ingredient) * lootK(h, 'veg')) { const id = pick(RARE_LOOT() ? ['cucumber', 'tomato', 'carrot', 'eggplant'] : ['cucumber', 'tomato', 'carrot', 'eggplant', 'weed']); lootVeg(h, id, 1); clog(`Лут: ${VEG[id] || id} — ${DN(h)}`, '#b8e0a0'); }
    if (Math.random() < (RARE_LOOT() ? RL.monsterSeed : D.seed) * lootK(h, 'seed') && lootSeedsOk(h, 1)) { h.seeds++; sStat(h, 'seeds', 1); seedMark(h); emitBot({ event: 'vegDelta', reason: 'loot', user: h.user, txid: h.user + '-ms' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), gold: 0, goldTotal: h.rpg_gold || 0, delta: { seeds: 1 }, seeds: 1 }, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta'); clog(`Лут: семена ×1 — ${DN(h)}`, '#b8e0a0'); } // v46: с ником — раньше строка без имени не попадала в фильтр «мои» и сливалась у разных игроков в одну «×N» // v7panel35: семена с моба тоже дельтой боту (как из сундука), иначе farmVars их стирал
    if (m.d.rare) rollRealPrize(h, 'rareMonster');
    if (m.d.mimic) { if (luck) h.rpg_bag._luckGot = 1; mimicLoot(h, m, luck); }
    checkAch(h);
    FX.push({ kind: 'fly', loc: 'forest', x: m.x - 30, y: m.y - 40, user: h.user, key: 'coins', t: -0.4, life: 0.7 });
  }
  function gainXp(h, xp) {
    xp = Math.round(xp * stats(h).xpM);
    h.rpg_xp += xp;
    while (h.rpg_xp >= xpNeed(h)) { h.rpg_xp -= xpNeed(h); h.rpg_level++; checkAch(h); h.rpg_hp = stats(h).maxhp; log(`${h.user}: новый уровень — ${h.rpg_level}!`, '#ffd27a'); const rt = ensureRT(h); fxText(rt.x, rt.y - 230, 'УРОВЕНЬ!', '#ffd27a', 34, 2, rt.loc); }
  }
  const cdTxt = b => { const pl = (n, a, b2, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b2 : c, k = b.crits | 0, d = b.dodges | 0, p = []; if (k) p.push(`${k} ${pl(k, 'крит', 'крита', 'критов')}`); if (d) p.push(`${d} ${pl(d, 'уклон', 'уклона', 'уклонов')}`); return p.length ? ' · ' + p.join(', ') : ''; }; // v49.2: «· 4 крита, 2 уклона» в итоге похода
  function finishExpedition(b, h) { h._shield = 0;
    BATTLES.splice(BATTLES.indexOf(b), 1);
    const tb = (1 + trophyBonus(h)) * (b.party ? b.party.reward : 1), g = Math.round(b.loot.gold * tb * (1 + g9Eff(h, 'gold'))); // v9: + знамя богатства
    h.rpg_gold += g; sStat(h, 'expGold', g); gainXp(h, Math.round(b.loot.xp * tb)); h.rpg_expeditions++; clog(`${h.user}: поход завершён, +${g} золота`, '#ffd27a');
    addGuildPoints(h.rpg_guild, C.guildPointsPerExpedition, h); useBuffCharge(h); delete h._rage; if (b.party && b.party.g9) g9Finish(b, h); // v9: гильд-поход
    if (h.rpg_bag._luckActive) { // fix: зелье удачи — если за поход сундука не было, в конце гарантированный серебряный
      if (!h.rpg_bag._luckGot) { const rt0 = ensureRT(h); giveChest(h, 'silver', 'Зелье удачи', { x: rt0.x, y: rt0.y, loc: 'forest' }); clog(`${DN(h)}: Зелье удачи — сундук не выпал, гарантированный ${C.chests.silver.name}`, '#c8f0a8'); }
      h.rpg_bag._luckActive--; delete h.rpg_bag._luckGot; }
    log(`${h.user} возвращается из ${b.party ? 'пати-похода' : 'похода'}: +${g} золота, +${Math.round(b.loot.xp * tb)} опыта${b.party ? (b.party.g9 ? ` (гильд-поход ×${b.party.reward})` : ` (пати ×${b.party.reward})`) : ''}${(() => { const tp = trophyActive() && h.rpg_guild === S.trophy.guild, ud = underdogBonus(h) > 0; return tp || ud ? ` (${[tp ? `трофей гильдии +${Math.round(C.trophy.goldXpBonus * 100)}%` : '', ud ? `слабая гильдия +${Math.round(GB.underdogBonus * 100)}%` : ''].filter(Boolean).join(', ')})` : ''; })()}${cdTxt(b)}`, '#c8f0a8');
    questEvent('expedition', { win: true }, h); questEvent('expeditionWin', {}, h); if (b.party) { questEvent('partyExpedition', { win: true }, h); questEvent('partyExpeditionWin', {}, h); /* v49.6 */ h.rpg_partyExpeditions = (h.rpg_partyExpeditions || 0) + 1; } goalAdd('expedition', 1, h); sStat(h, 'gold', g);
    say(h, 'Домой!'); goCamp(h);
    save(); refreshUI();
  }
  function loseBattle(b, h) { h._shield = 0;
    caggFlush(true); // v6.55 п.3
    BATTLES.splice(BATTLES.indexOf(b), 1);
    const rt = ensureRT(h);
    // v7panel29: павший не теряет своё золото — он просто получает меньше добычи похода: (1 − deathLootLoss) от собранного, без пати-множителя и трофея.
    // Списаний нет: только неотрицательная прибавка, баланс в минус не уходит; в Streamer.bot ничего не шлётся.
    const keep = 1 - Math.min(1, Math.max(0, +C.deathLootLoss || 0)), keepG = Math.max(0, Math.floor((+b.loot.gold || 0) * keep)), keepXp = Math.max(0, Math.floor((+b.loot.xp || 0) * keep));
    h.rpg_gold = Math.max(0, (+h.rpg_gold || 0) + keepG); gainXp(h, keepXp); h.rpg_deaths++; h.rpg_hp = 1; useBuffCharge(h); delete h._rage; questEvent('expedition', { fail: true }, h); if (b.party) questEvent('partyExpedition', { fail: true }, h); /* v49.6: пати-поход засчитывается в квест и при гибели */ // v7panel32: «сходить в поход» засчитывается и при гибели
    log(`${h.user} выбывает из ${b.party ? 'пати-похода' : 'похода'} и плетётся в лагерь: +${keepG} золота, +${keepXp} опыта (павшему — ${Math.round(keep * 100)}% добычи${b.party ? ', без пати-бонуса' : ''})${cdTxt(b)}`, '#ff9c7a');
    say(h, 'Ой…'); goCamp(h); rt.mode = 'dead'; rt.ghost = true; rt.ghostT = tm + 120; // v6.29: серый вид — только пока «пал», с предохранителем
    const cb = rt.dest ? rt.dest.cb : rt.onArrive;
    const fix = () => { rt.ghost = false; if (cb) cb(); else rt.mode = 'seat'; };
    if (rt.dest) rt.dest.cb = fix; else rt.onArrive = fix;
    save(); refreshUI();
  }

  // ===================== ЧАТ TWITCH (только чтение) =====================
  function stripEmotes(msg, emotesTag) {
    if (!emotesTag) return msg;
    const cut = [];
    emotesTag.split('/').forEach(e => { const r = e.split(':')[1]; if (r) r.split(',').forEach(p => { const [a, b] = p.split('-').map(Number); cut.push([a, b]); }); });
    const chars = Array.from(msg); cut.forEach(([a, b]) => { for (let i = a; i <= b; i++) chars[i] = ''; });
    return chars.join('').replace(/\s+/g, ' ').trim();
  }
  // v6.26: !продать <овощ|всё> [кол-во] — продажа овощей за золото (цена C.market.sell + sellPerLevel за уровень рынка сверх 1-го).
  // Овощи никогда не уходят в минус: продаём min(просили, есть). Списание уходит в Streamer.bot через DoAction C.bot.vegDeltaAction.
  // v6.35: учёт овощей стрима. Овощи, что уже лежали у зрителя, в учёт не идут (цель, ярмарка, золото стрима, Герой дня),
  // пока он сам не поработает с грядкой в этом стриме (посадка / полив / сбор). В этот момент текущие количества — baseline;
  // считается только то, что сверх baseline. h._vs = { sid, on, base: { veg_x: n } }
  function vegAcct(h) { const sid = streamCur().id; if (!h._vs || h._vs.sid !== sid) h._vs = { sid, on: false, base: {} }; return h._vs; }
  function vegActivate(h, snap) { const a = vegAcct(h); if (a.on) return a; a.on = true; a.at = now(); VEGK.forEach(k => a.base[k] = Math.max(0, +((snap && k in snap) ? snap[k] : h[k]) || 0)); return a; }
  function vegCounted(h, k) { const a = vegAcct(h); return a.on ? Math.max(0, (+h[k] || 0) - (a.base[k] || 0)) : 0; }
  function vegTrim(h) { const a = vegAcct(h); VEGK.forEach(k => { if (a.base[k] > (+h[k] || 0)) a.base[k] = Math.max(0, +h[k] || 0); }); }
  function sellVeg(nick, arg) {
    const h = getHero(nick, true); if (!h) return { ok: false, msg: 'нет героя' };
    const M = C.market || {}, price = M.sell || {}, plus = BV2() ? Math.round(bEffAt('market', 'sell', bLv('market'))) : (M.sellPerLevel || 0) * Math.max(0, bLv('market') - 1);
    const a = String(arg || '').trim().toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
    let what = a[0] || '', qty = null;
    if (/^\d+$/.test(what)) { qty = +what; what = a[1] || ''; } else if (a[1] && /^\d+$/.test(a[1])) qty = +a[1];
    if (!what) return res(h, false, 'как продать: !продать <овощ|всё> [кол-во], например !продать огурец 5');
    const all = /^(все|всё|all|\*)$/.test(what);
    let ids;
    if (all) ids = Object.keys(price);
    else { const c = C.crops.find(c => c.id === what || c.name.toLowerCase().replace(/ё/g, 'е').startsWith(what.slice(0, Math.max(3, Math.min(what.length, 5)))) && price[c.id] !== undefined);
      if (!c) return res(h, false, `не знаю овощ «${what}». Можно: ${Object.keys(price).map(cropName).join(', ')} или «всё»`); ids = [c.id]; }
    if (qty !== null && (!(qty > 0) || qty > 100000)) return res(h, false, 'количество должно быть от 1');
    const sold = {}; let gold = 0, n = 0, fb = 0, sg = 0;
    for (const id of ids) {
      const have = Math.max(0, Math.floor(h['veg_' + id] || 0)); if (!have) continue;
      const k = Math.min(have, qty === null ? have : qty); if (k <= 0) continue;
      const ck = Math.min(k, vegCounted(h, 'veg_' + id)); // ярмарочная надбавка и золото стрима — только за учтённые (выращенные в этом стриме) овощи
      h['veg_' + id] = have - k; sold[id] = k; n += k; gold += k * ((price[id] || 0) + plus) + ck * fairBonus(id); fb += ck * fairBonus(id); sg += ck * ((price[id] || 0) + plus + fairBonus(id));
    }
    vegTrim(h);
    if (!n) return res(h, false, all ? 'нечего продавать — овощей нет' : `нет: ${cropName(ids[0])} 0`);
    h.rpg_gold = (h.rpg_gold || 0) + gold; sStat(h, 'sold', n); sStat(h, 'soldGold', gold); if (sg) { sStat(h, 'gold', sg); if (S.stream) S.stream.gold += sg; }
    const args = { event: 'vegDelta', reason: 'sell', user: h.user, txid: h.user + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36), gold, goldTotal: h.rpg_gold, delta: {} };
    for (const id in sold) { const b = vegSpendBot(h, 'veg_' + id, sold[id]); if (b) { args.delta['veg_' + id] = -b; args['veg_' + id] = -b; } }
    emitBot(args, (C.bot && C.bot.vegDeltaAction) || 'RPG Veg Delta');
    // v7panel20 п.4: идёт к прилавку рынка, только там пузырь «продаёт…»
    const went = !blocked(h, 'town') && goDo(h, 'town', TOWN.market.x - 120, TOWN.market.y + 20, 'продаёт…', C.townStaySeconds, 2, () => fxText(TOWN.market.x, TOWN.market.y - 240, `+${gold} 💰`, '#ffd27a', 36, 2, 'town'), true);
    if (!went) say(h, `продаёт… +${gold} 💰`, 3);
    return res(h, true, `${went ? 'идёт на рынок и продаёт' : 'продаёт'} ${Object.entries(sold).map(([k, v]) => `${cropName(k)} ×${v}`).join(', ')} за ${gold} золота${fb ? ` (ярмарка +${fb})` : ''}`);
  }
  // Команды чата (только игровые, без постинга в чат): у каждого зрителя общий кулдаун C.chatCommandCooldown
  const CHAT_CMDS = {
    'готовить': (n, a) => cook(n, a), 'продать': (n, a) => sellVeg(n, a), 'поход': n => sendToExpedition(n), 'огород': n => { const h = getHero(n, false); const bl = blocked(h, 'town'); if (bl) return res(h, false, bl); goGarden(h, 'Проверю грядку'); return { ok: true }; },
    'вклад': (n, a) => donateCmd(n, a), // v6.55 п.13: раньше в чате не было — подсказка на табличке вела в никуда
    'титул': (n, a) => titleCmd(n, a),
    'парикмахер': (n, a) => hairCmd(n, a), // v6.57
    'погладить': (n, a) => petAny(n, a), 'гладить': (n, a) => petAny(n, a), 'погладь': (n, a) => petAny(n, a), 'котик': n => petCat(n), 'пёсик': n => petDog(n), 'песик': n => petDog(n), // v8.6: пёсик в городе
    'купить': (n, a) => buyEquip(n, a), 'чинить': (n, a) => repairCmd(n, a), 'починить': (n, a) => repairCmd(n, a), // v7panel40
    'экип': (n, a) => wearEquip(n, a), // v6.56
    'трофей': (n, a) => trophyCmd(n, a), 'трофеи': (n, a) => trophyCmd(n, a), // v49.8
    'сет': (n, a) => setsCmd(n, a), // v47: !сет 1|2, !сет сохранить 1|2
    'снять': (n, a) => unequip(n, a) || titleCmd(n, 'снять'), 'продать': (n, a) => { const s = String(a || '').trim(); if (/^(?:лут|loot)(?:\s+|:)/i.test(s)) return sellLoot(n, s); const veg = /^(огурец|помидор|морков|баклажан|тыкв|сорняк|всё|все)/i.test(s); return veg ? sellVeg(n, a) : sellEquip(n, a); }, 'купитьсемена': (n, a) => buySeeds(n, a),
    'голос': (n, a) => g9VoteCmd(n, a), 'гм': (n, a) => /^(уйти|уйду|сложить|отставка)$/i.test(String(a || '').trim()) ? g9ResignCmd(n) : g9VoteCmd(n, ''), 'цель': n => g9FocusCmd(n), 'наградить': (n, a) => g9RewardCmd(n, a), 'казна': (n, a) => g9BankCmd(n, a), 'бафф': (n, a) => g9BuffCmd(n, a), 'гильдпоход': n => g9HikeCmd(n), // v9: механики гильдий
    'пати': n => partyJoin(n), // v6.55 п.19 // v6.55 п.5: !титул — список, !титул N — надеть, !титул снять — убрать
    'квест': (n, a) => chooseQuest(n, a), 'отмена': (n, a) => abandonQuest(n), 'неделя': (n, a) => takeWeekly(n, a), 'гильдия': (n, a) => a && GCONF.confirm ? guildAsk(n, a) : joinGuild(n, a), 'да': n => hasPending(n) ? pendingConfirm(n, true) : guildConfirm(n, true), 'нет': n => hasPending(n) ? pendingConfirm(n, false) : guildConfirm(n, false), 'заточка': (n, a) => sharpenCmd(n, a), 'точить': (n, a) => sharpenCmd(n, a), 'смена': (n, a) => changeCmd(n, a), 'железо': (n, a) => stoneToIron(n, a), 'босс': n => joinBoss(n), 'удар': n => strike(n), 'лечить': n => heal(n), 'оглушить': n => bossCC(n, 'stun'), 'замедлить': n => bossCC(n, 'slow'), 'связать': n => bossCC(n, 'bind'), 'очистить': n => bossCC(n, 'purge'), 'прикрыть': n => bossCC(n, 'cover'), 'заслон': n => bossCC(n, 'wall'), 'воскресить': n => bossCC(n, 'revive'), 'воскрешение': n => bossCC(n, 'revive'), 'рес': n => bossCC(n, 'revive'),
  };
  function chatCommand(n, text) {
    const m = /^!(\S+)\s*(.*)$/.exec(text); if (!m) return { ok: false };
    const FCH = { 'посадить': 'plant', 'собрать': 'harvest', 'жуки': 'bugs', 'отогнать': 'shoo', 'магия': 'magic', 'грядка': 'garden' };
    if (FCH[lc(m[1])]) { // команды фермы считает бот; без farmVars от бота герой всё равно идёт к грядке и показывает действие
      const a = FCH[lc(m[1])], st = params.has('standalone') || params.has('test');
      if (st && farm[a] && a !== 'garden') return farm[a](n, m[2].trim() || undefined);
      const hh = S.heroes[n], can = hh && ({ shoo: () => hh.bugAttack, bugs: () => hh.bugAttack, plant: () => hh.gardenStatus === 0 && (+hh.seeds || 0) > 0, harvest: () => hh.gardenStatus === 2, garden: () => !PANEL_QUIET }[a] || (() => true))(); // v7panel11: без данных бота — к грядке только если действие возможно
      if (Date.now() - FARMVARS_SEEN > 120000 && can) farmShow(hh, a === 'bugs' ? 'shoo' : a);
      return { ok: true };
    }
    const cmd = lc(m[1]), fn = CHAT_CMDS[cmd]; if (!fn) return { ok: false };
    const h = S.heroes[n]; const t = Date.now();
    if (cmd === 'квест' && !m[2].trim()) return chooseQuest(n, '');
    const cd = (cmd === 'голос' || cmd === 'гм' || cmd === 'наградить' || cmd === 'казна' || cmd === 'бафф' || cmd === 'гильдпоход' || cmd === 'цель' || cmd === 'погладить' || cmd === 'удар' || cmd === 'лечить' || cmd === 'квест' || cmd === 'титул' || cmd === 'экип' || cmd === 'сет' || cmd === 'снять' || cmd === 'купить' || cmd === 'чинить' || cmd === 'починить' || cmd === 'парикмахер') ? 0 : C.chatCommandCooldown * 1000; // у боевых свои кулдауны
    if (cmd === 'поход') { const why = hikeBusy(h); if (why) { expeditionHint(h, why); const left = hikeCdLeft(h); return res(h, false, why === 'cooldown' ? `поход: КД ещё ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}` : why === 'queued' ? `поход: ты в очереди ${(expQueueInfo(h.user) || {}).pos || '?'} из ${EXPQ.length}` : why === 'inHike' ? 'поход: уже в походе' : 'поход: ещё возвращается в лагерь'); } } // v6.37: причина — зрителю, раньше общего антиспама
    if (t - (h.rpg_cmdT[cmd] || 0) < cd) return { ok: false, msg: `кулдаун ${Math.ceil((cd - (t - (h.rpg_cmdT[cmd] || 0))) / 1000)} с — команды !${cmd} не чаще раза в ${Math.round(cd / 1000)} с` }; // v49.10: раньше просто «кулдаун» — непонятно, сколько ждать
    // v49.12: в нокауте боевые команды не стартуют chat-КД (раньше rpg_cmdT ставился до проверки и кнопки уходили в откат)
    if (heroBossKo(h) && /^(удар|лечить|оглушить|замедлить|связать|очистить|заслон|воскресить|воскрешение|рес)$/.test(cmd)) return res(h, false, 'ты в нокауте');
    // v7panel34: поход и готовка без токена; квест — 3 за стрим
    const tk = C.reward && C.reward.enabled !== false && REWARD_CMD[cmd];
    if (tk) {
      const tok = h.rpg_reward || {};
      const arg = m[2].trim();
      if (tk === 'quest' && !(tok.quest > 0)) { if (!PANEL_QUIET) say(h, 'Квесты кончились!'); return res(h, false, 'квест: лимит 3 за стрим'); }
      if (tk === 'hike' || tk === 'cook' || tk === 'quest') {
        const s = streamCur();
        if (h._rewStream !== s.id) return res(h, false, 'нужна награда канала — прожми один раз за стрим');
      }
      if (tk === 'hike') { const why = hikeBusy(h); if (why) { expeditionHint(h, why); const left = hikeCdLeft(h); return res(h, false, why === 'cooldown' ? `поход: КД ещё ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}` : why === 'queued' ? `поход: ты в очереди ${(expQueueInfo(h.user) || {}).pos || '?'} из ${EXPQ.length}` : why === 'inHike' ? 'поход: уже в походе' : 'поход: ещё возвращается в лагерь'); } }
      h.rpg_cmdT[cmd] = t;
      if (tk === 'cook') COOK_TOK = Infinity; let r; try { r = fn(n, arg); } finally { COOK_TOK = Infinity; }
      if (r && r.ok) {
        if (tk === 'quest') tok.quest--;
        if (tk === 'hike') h.rpg_hikeAt = t;
        save(); refreshUI();
      }
      return r;
    }
    h.rpg_cmdT[cmd] = t;
    return fn(n, m[2].trim());
  }
  const NOHERO_T = {};
  function chat(nick, text, color) {
    let n = findNick(nick); text = String(text || '').replace(/\s+/g, ' ').trim();
    if (!n && /^!(вступить|герой|join)(\s|$)/i.test(text) && C.heroJoinCommand !== false && mayCreate(nick, 'join')) { CREATE_WHY = 'чат !вступить/!герой'; const a = text.split(' '); createHero(nick, a[1] || null, a[2] || null, false); CREATE_WHY = ''; return { ok: true }; }
    if (!n && text.startsWith('!')) { // v6.34: без героя команды не работают — подсказка в чат не чаще раза в 5 мин
      const k = lc(nick), t = Date.now(); if (t - (NOHERO_T[k] || 0) > 300000) { NOHERO_T[k] = t; emitBot({ event: 'noHero', user: nick, text: `@${nick}, сначала получи героя — активируй награду канала «${C.heroRewardName || 'Стать героем'}».` }); }
      return { ok: false, msg: 'нет героя: нужна награда канала' };
    }
    if (!n || !text) return { ok: false };
    { const mv = /^!(вступить|join)\s+(\S.*)$/i.exec(text); if (mv && findGuild(mv[2].trim())) text = '!гильдия ' + mv[2].trim(); } // v6.42: !вступить <гильдия>
    const hh = S.heroes[n];
    if (color && /^#[0-9a-f]{6}$/i.test(color) && hh.rpg_color !== color) { hh.rpg_color = color; save(); }
    maybeGreet(hh);
    if (text.startsWith('!')) return chatCommand(n, text);
    if (C.chatIgnore.map(lc).includes(lc(nick))) return { ok: false };
    const B = C.bubble; if (text.length > B.maxChars) text = text.slice(0, B.maxChars - 1) + '…';
    const rt = ensureRT(S.heroes[n]);
    if (rt.queue.length >= B.queue) rt.queue.shift();
    rt.queue.push(text);
    if (!rt.bubble || !rt.bubble.chat) nextBubble(rt);
    bump(rt.mode === 'sleep' ? 'camp' : rt.loc, 1);
    return { ok: true };
  }
  function nextBubble(rt) { const t = rt.queue.shift(); if (t) { rt.bubble = { lines: wrap(t, 24, C.bubble.maxWidth), chat: true }; rt.bubbleT = C.bubble.seconds; } else rt.bubble = null; }
  let twitchWS = null;
  function connectTwitch(channel) {
    channel = lc(channel).replace(/^#/, ''); if (!channel) return;
    let ws; try { ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); } catch (e) { return; }
    twitchWS = ws;
    ws.onopen = () => { ws.send('CAP REQ :twitch.tv/tags'); ws.send('PASS SCHMOOPIIE'); ws.send('NICK justinfan' + R(10000, 99999)); ws.send('JOIN #' + channel); log(`Чат Twitch: #${channel} (только чтение)`, '#9fc5e8'); };
    ws.onmessage = ev => {
      String(ev.data).split('\r\n').forEach(line => {
        if (!line) return;
        if (line.startsWith('PING')) { ws.send('PONG' + line.slice(4)); return; }
        const m = line.match(/^(?:@(\S+) )?:(\w+)!\S+ PRIVMSG #\S+ :(.*)$/); if (!m) return;
        const tags = {}; (m[1] || '').split(';').forEach(kv => { const i = kv.indexOf('='); if (i > 0) tags[kv.slice(0, i)] = kv.slice(i + 1); });
        let msg = m[3]; if (msg.startsWith('\u0001ACTION ')) msg = msg.slice(8).replace(/\u0001$/, '');
        chat(tags['display-name'] || m[2], stripEmotes(msg, tags.emotes), tags.color);
      });
    };
    ws.onclose = () => setTimeout(() => connectTwitch(channel), 5000);
    ws.onerror = () => { };
  }

  // ===================== ОТРИСОВКА: базовые функции =====================
  const isPH = k => window.Assets.isPlaceholder[k] === true;
  const SPR = new Map();
  // Спрайт заранее масштабируется до целого числа ПИКСЕЛЕЙ ЭКРАНА (K = пикселей холста на пиксель мира)
  // и рисуется 1:1 по целым пикселям экрана — без «мыла». opt.frame — кадр из ленты (assets.js → anim).
  function sprite(key, h, frame) {
    const im = IMG[key]; if (!im || !im.width) return null;
    const an = window.Assets.anim && window.Assets.anim[key], nf = an && !isPH(key) ? an.frames : 1;
    const fi = nf > 1 ? ((frame | 0) % nf + nf) % nf : 0;
    const dh = Math.max(4, Math.round(h * K / 2) * 2);
    const id = key + '|' + dh + '|' + fi; let c = SPR.get(id);
    if (!c) {
      if (SPR.size > 1200) SPR.clear();
      const fw = im.width / nf, w = Math.max(1, Math.round(fw * dh / im.height));
      c = document.createElement('canvas'); c.width = w; c.height = dh;
      const x = c.getContext('2d');
      if (im._pixel || nf > 1) x.imageSmoothingEnabled = false; else { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; }
      x.drawImage(im, fi * fw, 0, fw, im.height, 0, 0, w, dh); SPR.set(id, c);
    }
    return c;
  }
  const px = v => Math.round(v * K) / K; // привязка к пикселю экрана
  // v6.25: ctx.filter в кадре дорогой — фильтр применяется один раз к копии спрайта и кэшируется
  const FSPR = new Map();
  function filtered(c, f) {
    if (!c || !f || f === 'none') return c;
    let m = FSPR.get(c); if (!m) { m = new Map(); FSPR.set(c, m); }
    let o = m.get(f); if (o) return o;
    if (FSPR.size > 600) FSPR.clear();
    o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.filter = f; x.drawImage(c, 0, 0); m.set(f, o); return o;
  }
  function drawImg(key, cx, by, h, opt) {
    opt = opt || {};
    const c = filtered(sprite(key, h, opt.frame), opt.filter); if (!c) return 0;
    const w = c.width / K, hh = c.height / K;
    const x = Math.round(cx * K - c.width / 2) / K, y = Math.round(by * K - c.height) / K;
    if (!opt.alpha && opt.alpha !== undefined) return w;
    ctx.save();
    if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
    if (opt.rot) { ctx.translate(px(cx), px(by - hh / 2)); ctx.rotate(opt.rot); ctx.drawImage(c, -w / 2, -hh / 2, w, hh); }
    else if (opt.flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0, w, hh); }
    else ctx.drawImage(c, x, y, w, hh);
    ctx.restore();
    return w;
  }
  // постройка/предмет стоит на земле: сначала контактная тень, потом спрайт
  function prop(key, cx, by, h, opt) {
    const c = sprite(key, h); if (c) shadow(cx, by - 4, c.width / K * 0.42);
    return drawImg(key, cx, by, h, opt);
  }
  // Шрифт Rubik 700 (лежит в assets/fonts, OFL): минимум 22px, тонкая обводка
  const UIS = +C.uiScale || 1; // v6.29: масштаб интерфейса (HUD, плашки, подписи на холсте)
  const fsz = size => Math.max(Math.round(22 * UIS), Math.round(size * UIS)); // минимум 22px в 1440p ≈ 16.5px в 1080p
  function setFont(size) { ctx.font = `700 ${fsz(size)}px ${FONT}`; }
  function text(t, x, y, size, color, align, outline) {
    setFont(size); ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    x = px(x); y = px(y);
    if (outline !== 0) { ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#1e120a'; ctx.strokeText(t, x, y); }
    ctx.fillStyle = color || '#fff'; ctx.fillText(t, x, y);
  }
  function measure(t, size) { setFont(size); return ctx.measureText(t).width; }
  function wrap(t, n, maxW) {
    maxW = maxW || C.bubble.maxWidth; const words = String(t).split(' '), out = []; let cur = '';
    setFont(22);
    for (let w of words) {
      while (ctx.measureText(w).width > maxW && w.length > 4) { const k = Math.max(4, Math.floor(w.length * maxW / ctx.measureText(w).width) - 1); if (cur) { out.push(cur); cur = ''; } out.push(w.slice(0, k)); w = w.slice(k); }
      const tryS = cur ? cur + ' ' + w : w;
      if (ctx.measureText(tryS).width > maxW && cur) { out.push(cur); cur = w; } else cur = tryS;
    }
    if (cur) out.push(cur);
    return out.slice(0, 4);
  }
  const SHADE = {};
  function shade(c, k) { const key = c + k; if (SHADE[key]) return SHADE[key]; const m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return c; const v = parseInt(m[1], 16); const r = Math.round((v >> 16 & 255) * k), g = Math.round((v >> 8 & 255) * k), b = Math.round((v & 255) * (k + 0.04)); return SHADE[key] = `rgb(${r},${g},${Math.min(255, b)})`; }
  function panel(x, y, w, h, fill) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = 'rgba(30,18,10,.5)'; ctx.fillRect(x + 6, y + 6, w, h);
    ctx.fillStyle = '#1e120a'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = shade(fill || '#f2dfb4', 0.74); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, w, 4);
  }
  function bar(x, y, w, h, p, col) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#1e120a'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * clamp(p, 0, 1)), h);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, y, Math.round(w * clamp(p, 0, 1)), Math.max(2, h / 4 | 0));
  }
  function shadow(x, y, rx) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), rx, rx * 0.28, 0, 0, Math.PI * 2); ctx.fill(); }
  // v6.34: фон заранее приводится к размеру холста в пикселях экрана (W*K × H*K) — на экран он кладётся 1:1, без сглаживания
  const BGK = {};
  function bgFor(loc) {
    const src = bgSrc(loc); if (K === 1 || ZC) return src;
    const c0 = BGK[loc]; if (c0 && c0._k === K && c0._s === src) return c0;
    const c = document.createElement('canvas'); c.width = Math.round(W * K); c.height = Math.round(H * K); const x = c.getContext('2d');
    if (K < 1) { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; } else x.imageSmoothingEnabled = false;
    const h1 = IMG['bg1080_' + loc]; // v6.46: для K<1 — отдельный фон 1920×1080 (Lanczos+резкость из исходника), без двойного пересэмпла
    if (K < 1 && (src === IMG['dk_' + loc] || src === IMG['bg_' + loc]) && h1 && h1.naturalWidth && !isPH('bg1080_' + loc)) {
      const f = palOf(loc);
      if (f !== 'none') x.filter = f; x.drawImage(h1, 0, 0, c.width, c.height); x.filter = 'none';
      if (f !== 'none') { const w = c.width, h = c.height, gr = x.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 1.05); gr.addColorStop(0, 'rgba(10,6,20,0)'); gr.addColorStop(1, 'rgba(10,6,20,.45)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }
    } else x.drawImage(src, 0, 0, c.width, c.height); c._k = K; c._s = src; return BGK[loc] = c;
  }
  function bgSrc(loc) {
    const k = 'bg_' + loc, dk = 'dk_' + loc;
    if (IMG[dk]) return IMG[dk];
    if (IMG[k] && !isPH(k) && IMG[k].complete !== false && (IMG[k].naturalWidth || IMG[k].width)) { // тёмное фэнтези: приглушаем фон один раз
      const f = palOf(loc);
      if (f === 'none') return IMG[k];
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.filter = f; x.drawImage(IMG[k], 0, 0, W, H);
      x.filter = 'none'; const g = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(10,6,20,0)'); g.addColorStop(1, 'rgba(10,6,20,.45)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      return IMG[dk] = c;
    }
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = { camp: '#7fa653', garden: '#8bb05a', forest: '#4f7a3f', town: '#a8a070' }[loc]; x.fillRect(0, 0, W, H);
    IMG[k] = c; window.Assets.isPlaceholder[k] = false; return c;
  }

  // ===================== ПОСТРОЙКИ: значок уровня, назначение, полоса прогресса, подсказка =====================
  const PURPOSE = { campfire: 'места и лечение', tents: 'сон и отдых', blacksmith: 'атака героев', guild: 'отряд на босса', shed: 'золото с урожая', market: 'продажа овощей', board: 'задания' };
  const HOVER = [];        // прямоугольники построек для подсказки (мышь в координатах холста)
  let MOUSE = null;
  function plate(id, cx, py) {
    const inf = bInfo(id), title = `${inf.name} · ${bPurpose(id)}`;
    setFont(22); const pw = Math.max(260, ctx.measureText(title).width + 110), ph = 64, x0 = Math.round(cx - pw / 2);
    ctx.fillStyle = 'rgba(30,18,10,.8)'; ctx.fillRect(x0, py, pw, ph);
    // значок уровня — слева на табличке
    ctx.fillStyle = inf.lv > 1 ? '#e8b04a' : '#a88a5a'; ctx.fillRect(x0 + 6, py + 6, 74, ph - 12);
    text('ур.' + inf.lv, x0 + 43, py + ph / 2, 22, '#fff6d0');
    const tx = x0 + 90 + (pw - 96) / 2;
    text(title, tx, py + 18, 22, '#ffe7b0', 'center', 0);
    if (!inf.max) {
      const mats = Object.entries(inf.need).filter(([m, n]) => (inf.have[m] || 0) < n);
      bar(x0 + 96, py + 38, pw - 200, 14, inf.fund / inf.cost, '#ffd24a');
      text(`${inf.fund}/${inf.cost}` + (mats.length ? ' + материалы' : ''), x0 + pw - 52, py + 45, 22, '#ffe27a', 'center', 0);
    } else text('максимум', tx, py + 45, 22, '#ffe27a', 'center', 0);
    return { x: x0, y: py, w: pw, h: ph };
  }
  function building(id, key, x, y, h, draw, plateAt) {
    const r6 = REG6[id];
    if (r6) { HOVER.push({ id, x: r6[0], y: r6[1], w: r6[2] - r6[0], h: r6[3] - r6[1], loc: BUILD_POS[id].loc, ax: (r6[0] + r6[2]) / 2, ay: r6[1] }); bldBuildTag(id, (r6[0] + r6[2]) / 2, r6[1] + 10); return; }
    const lv = bLv(id);
    const sc = 1 + 0.06 * (lv - 1);
    const filt = lv > 1 ? `saturate(${1 + 0.12 * (lv - 1)}) brightness(${1 + 0.03 * (lv - 1)})` : undefined;
    let w;
    if (draw) w = draw(sc, filt);
    else { const c = sprite(key, Math.round(h * sc)); if (c) shadow(x, y - 4, c.width / K * 0.42); w = drawImg(key, x, y, Math.round(h * sc), { filter: filt }); }
    // v6.19: таблички уровня убраны — всё в меню по клику на постройку
    HOVER.push({ id, x: x - w / 2, y: y - h * sc, w, h: h * sc, loc: BUILD_POS[id].loc, ax: x, ay: y - h * sc });
    bldBuildTag(id, x, y - h * sc + 10);
  }
  // fix: постройка на стройке — табличка над ней на экране локации («🔨 стройка до ур.N: ещё K стримов»)
  function bldBuildTag(id, x, y) {
    const st = S.buildings && S.buildings[id]; if (!st || !st.build) return;
    const left = +st.build.left || 0, t = `🔨 Стройка до ур.${st.build.lv}: ещё ${left} ${plural(left, 'стрим', 'стрима', 'стримов')}`;
    const w = Math.round(measure(t, 24)) + 36, hh = Math.round(fsz(24) * 1.6);
    darkPlate(x - w / 2, y - hh, w, hh); text(t, x, y - hh / 2, 24, '#ffd27a', 'center', 3);
  }
  const PANELS6 = []; let MENU = null; // v6.19: меню постройки по клику (второй клик — закрыть)
  function drawMenu(loc) {
    if (!MENU || MENU.loc !== loc) return;
    const hv = HOVER.find(b => b.id === MENU.id && b.loc === loc); if (!hv) return;
    if (hv.id === 'cauldron') return drawCauldronMenu(hv);
    const inf = bInfo(hv.id), d = C.buildings[hv.id];
    const lines = [[`${inf.name} — ур.${inf.lv}${inf.max ? ' (макс.)' : ''} · ${bPurpose(hv.id)}`, '#7a3a12']]; if (bText(hv.id, inf.lv) !== d.effect) lines.push([`Сейчас: ${inf.effect}`, '#2e5a18']);
    let barY = -1;
    if (!inf.max) {
      lines.push([`Прогресс: ${inf.fund}/${inf.cost} золота`, '#4a2e18']); barY = lines.length;
      lines.push(['', '']);
      const mats = Object.entries(inf.need).map(([m, n]) => [m, Math.max(0, n - ((inf.have || {})[m] || 0))]).filter(([, n]) => n > 0);
      lines.push([`Нужно ещё: ${Math.max(0, inf.cost - inf.fund)} золота` + (mats.length ? ', ' + mats.map(([m, n]) => `${matName(m)} ${n}`).join(', ') : ''), '#4a2e18']);
      lines.push([`Следующий уровень (${inf.lv + 1}): ${inf.nextEffect}`, '#2e5a18']); { const vl = bvLine(inf); if (vl) lines.push([vl, '#7a3a12']); }
      lines.push([`Вклад: !вклад ${BLD.indexOf(hv.id) + 1} <сумма>  (или !вклад ${d.name.toLowerCase()} <сумма>)`, '#5a3412']);
    } else lines.push([`Максимальный уровень. ${bText(hv.id, inf.lv) !== d.effect ? inf.effect : 'Каждое улучшение дало: ' + d.effect}`, '#2e5a18']);
    lines.push(['Клик ещё раз — закрыть', '#8a7a6a']);
    setFont(22); const w = Math.max(420, ...lines.map(l => ctx.measureText(l[0]).width)) + 36, hh = lines.length * 32 + 20;
    // v6.20: меню не наезжает на панели (очки гильдий, зал славы): над постройкой, справа, слева, под ней
    const cands = [[hv.ax - w / 2, hv.ay - hh - 14], [hv.x + hv.w + 14, hv.y], [hv.x - w - 14, hv.y], [hv.ax - w / 2, hv.y + hv.h + 14]].map(([x, y]) => [clamp(x, 10, W - w - 10), clamp(y, 10, H - hh - 10)]);
    const free = c => !PANELS6.some(p => c[0] < p[2] && c[0] + w > p[0] && c[1] < p[3] && c[1] + hh > p[1]);
    const [x0, y0] = cands.find(free) || cands[1];
    panel(x0, y0, w, hh, '#f2e3bd');
    lines.forEach((l, i) => { if (l[0]) text(l[0], x0 + 18, y0 + 26 + i * 32, 22, l[1], 'left', 0); });
    if (barY > 0) bar(x0 + 18, y0 + 16 + barY * 32, w - 36, 14, inf.fund / inf.cost, '#ffd24a');
  }
  function menuClick(p) {
    const hv = HOVER.find(b => b.loc === CAM.loc && !b.go && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    if (!hv) { const was = !!MENU; MENU = null; return was; }
    MENU = MENU && MENU.id === hv.id ? null : { id: hv.id, loc: hv.loc }; return true;
  }
  // ===================== ГЕРОИ / МОНСТРЫ =====================
  const HERO_H = 150;
  function heroH(rt) { if (B6[rt.loc]) { const H6 = Math.round(HERO6_H * (HERO6_LOC[rt.loc] || 1) / 4) * 4; return rt.sit6 ? Math.round(H6 * SIT6_K) : H6; } return Math.round(HERO_H * persp(rt.y) * (HERO6_LOC[rt.loc] || 1) / 4) * 4; } // v8.5: лес/босс тоже масштабируются (CONFIG.heroScale6.forest/boss)
  // v6.19: chibiB — запечённые спрайты (гильдия красит только снаряжение, кожа/лицо/волосы не трогаются), сеты без тинта
  const H7L = {}, H7G = ['fire', 'silver', 'moon', 'gold'];
  function h7Load(k) { if (!k || !H7[k] || H7L[k]) return; const i = new Image(); H7L[k] = 1; i.onload = () => { IMG['h6_' + k] = i; window.Assets.isPlaceholder['h6_' + k] = false; H7L[k] = 2; }; i.onerror = () => { H7L[k] = -1; console.warn('[RPG] нет спрайта assets/heroes8/' + k + '.png'); }; i.src = 'assets/heroes8/' + k + '.png'; }
  const h7Ok = k => H7L[k] === 2 && IMG['h6_' + k] && IMG['h6_' + k].width;
  function guild7(h) { return H7G.includes(h.rpg_guild) ? h.rpg_guild : (!h.rpg_guild && G9ON() && H7[`none_${hairNm(h)}_chestnut`] ? 'none' : H7G[nickHash(h.user || '') % 4]); } // v9: без гильдии — нейтральная броня // без гильдии (если autoGuild выкл.) — постоянная по нику, спрайт не пропадает
  function hero7Name(h) { if (!BARB_ON() || !h) return null; const nm = hairNm(h), g = dyeOf(h) ? 'silver' : guild7(h), hr = hairOf(h); // сет-окраска красит серебряный спрайт с теми же волосами
    const k = H7[`${g}_${nm}_${hr}`] ? `${g}_${nm}_${hr}` : H7[`${g}_${nm}_chestnut`] ? `${g}_${nm}_chestnut` : null;
    return k && beardOf(h) && H7[k + '_beard'] ? k + '_beard' : k; } // v8.4: борода (только мужчины, rpg_beard)
  function hero7Key(h, rt) { const k = hero7Name(h); if (!k) return null; if (h7Ok(k)) { if (rt) rt._k7 = k; return k; } h7Load(k); return rt && rt._k7 && h7Ok(rt._k7) ? rt._k7 : null; } // пока грузится новый — прежний
  const sit6Ok = h => !(BARB_ON() && hero7Name(h)); // у спрайтов цирюльника нет сидячей позы — у костра стоят
  function hero6Key(h, rt) {
    if (BARB_ON()) { const set = EQ_COS(h, 'set'), nm0 = hairNm(h); if (!(set && M6[`${set}_${nm0}`])) { const k7 = hero7Key(h, rt); if (k7) return k7; } } // v49.7; эпические сеты (tide/thorn) — свои спрайты
    const nm = (h.rpg_gender === 'female' ? 'f_' : 'm_') + h.rpg_class, set = EQ_COS(h, 'set');
    let k = set && M6[`${set}_${nm}`] ? `${set}_${nm}` : dyeOf(h) ? `none_${nm}` : `${['fire', 'silver', 'moon', 'gold'].includes(h.rpg_guild) ? h.rpg_guild : 'none'}_${nm}`; // v6.57a: окраска — от базового спрайта без гильдии
    if (rt.sit6 && M6[k + '_sit']) k += '_sit';
    const im = IMG['h6_' + k]; return M6[k] && im && im.width && !isPH('h6_' + k) ? k : null;
  }
  // v6.26: унификация стиля героев с тёплым живописным фоном (C.heroStyleUnify 0/1/2), по умолчанию выключено.
  const USPR = new Map();
  const unifyLevel = () => { if (window.__unify !== undefined) return window.__unify; const q = params.get('unify'); return q !== null ? (+q || 0) : (+C.heroStyleUnify || 0); };
  // v6.28: «мягкий» режим (1) по пожеланиям: классовые профили, тёплые тени, мягкий контур без размытия, тёплый рефлекс от земли
  const CLS_PROF = {
    warrior: { keepHue: [12, 45], hiDark: .88, shadow: [74, 44, 22], shadowK: .38 },               // оранжевая броня, блики темнее, коричневые тени
    archer: { coldWhite: .7, beige: [196, 184, 160], shadow: [96, 88, 74], shadowK: .45, T: .44 }, // меньше холодного блеска, серо-бежевые тени
    priest: { keepHue: [250, 320], purpleSat: .84, purpleL: .94, shadow: [78, 48, 40], shadowK: .34 }, // фиолетовый приглушён, тени теплее
    paladin: { shadow: [76, 52, 30], shadowK: .3, hiDark: .92 },
    assassin: { shadow: [70, 46, 30], shadowK: .3 },
    mage: { shadow: [72, 46, 36], shadowK: .3, hiDark: .93 },
  };
  function unified(c, lv, cls) {
    if (!c || !lv) return c;
    const key = lv + ':' + (cls || '');
    let m = USPR.get(c); if (m && m[key]) return m[key]; if (!m) { m = {}; USPR.set(c, m); }
    if (USPR.size > 800) USPR.clear();
    const PR = CLS_PROF[cls] || {};
    const W = c.width, H = c.height, o = document.createElement('canvas'); o.width = W; o.height = H;
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0);
    let id; try { id = x.getImageData(0, 0, W, H); } catch (e) { m[key] = c; return c; }
    const d = id.data, A = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) A[i] = d[i * 4 + 3];
    const T = lv >= 2 ? 0.62 : (PR.T || 0.3);
    const G0 = [58, 36, 20], G1 = [176, 128, 64], G2 = [236, 214, 164];
    const ramp = (l, o3) => { const t = l < .5 ? l * 2 : (l - .5) * 2, a = l < .5 ? G0 : G1, b = l < .5 ? G1 : G2; for (let k = 0; k < 3; k++) o3[k] = a[k] + (b[k] - a[k]) * t; };
    const rr = [0, 0, 0], inH = (h, r) => r && h >= r[0] && h <= r[1];
    // нижняя граница силуэта по столбцам — для рефлекса от земли
    const bot = new Int32Array(W).fill(-1); for (let xx = 0; xx < W; xx++) for (let yy = H - 1; yy >= 0; yy--) if (A[yy * W + xx] > 60) { bot[xx] = yy; break; }
    let footY = 0; for (let xx = 0; xx < W; xx++) footY = Math.max(footY, bot[xx]);
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const i = yy * W + xx, p = i * 4; if (A[i] < 8) continue;
      let r = d[p] / 255, g = d[p + 1] / 255, b = d[p + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
      const sat = dl === 0 ? 0 : dl / (1 - Math.abs(2 * l - 1));
      let hue = 0; if (dl) { hue = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; hue *= 60; if (hue < 0) hue += 360; }
      const skin = hue >= 8 && hue <= 42 && sat > .18 && sat < .75 && l > .42 && l < .9;
      const accent = sat > .42 && l > .18 && l < .8 && (hue < 10 || hue > 330 || (hue > 200 && hue < 320));
      const keep = lv < 2 && !skin && sat > .35 && inH(hue, PR.keepHue);
      let t = T;
      if (skin) t = 0.05; else if (keep) t = T * 0.15; else if (accent) t = T * 0.25; else if (hue > 60 && hue < 170 && sat > .2) t = T * 0.6;
      ramp(l, rr);
      r = r * 255 * (1 - t) + rr[0] * t; g = g * 255 * (1 - t) + rr[1] * t; b = b * 255 * (1 - t) + rr[2] * t;
      if (lv < 2) {
        // жрец: фиолетовый приглушить (насыщенность и яркость)
        if (PR.purpleSat && inH(hue, PR.keepHue) && sat > .2) { const avg = (r + g + b) / 3; r = (avg + (r - avg) * PR.purpleSat) * PR.purpleL; g = (avg + (g - avg) * PR.purpleSat) * PR.purpleL; b = (avg + (b - avg) * PR.purpleSat) * PR.purpleL; }
        // лучник: холодный белый блеск → бежевый
        if (PR.coldWhite && !skin && l > .62 && (sat < .22 || (hue > 170 && hue < 260))) { const k = PR.coldWhite * Math.min(1, (l - .62) / .25 + .4); r = r * (1 - k) + PR.beige[0] * k * l * 1.05; g = g * (1 - k) + PR.beige[1] * k * l * 1.05; b = b * (1 - k) + PR.beige[2] * k * l * 1.05; }
        // светлые блики слегка темнее
        if (!skin && l > .78) { const k = PR.hiDark || .92; r *= k; g *= k; b *= k * .96; }
        // тёплые классовые тени
        if (!skin && l < .38 && PR.shadow) { const k = (PR.shadowK || .3) * (1 - l / .38); r = r * (1 - k) + PR.shadow[0] * k; g = g * (1 - k) + PR.shadow[1] * k; b = b * (1 - k) + PR.shadow[2] * k; }
      } else if (!skin && l > .86) { r *= .84; g *= .84; b *= .8; }
      // свет сверху (тёплый) и рефлекс от земли снизу
      const top = Math.max(0, 1 - yy / H) * (lv >= 2 ? .12 : .05); r += (255 - r) * top * .9; g += (200 - g) * top * .6; b *= 1 - top * .5;
      const fr = footY > 0 ? Math.max(0, 1 - (footY - yy) / (H * .28)) : 0;
      if (fr > 0) { const k = fr * (lv >= 2 ? .14 : .1); r += (232 - r) * k; g += (150 - g) * k * .8; b += (70 - b) * k * .4; }
      if (!skin && mx > 0) { // v6.29: насыщенность не падает больше ~8% (синие/бирюзовые модели были блёклыми)
        const sv0 = (mx - mn) / mx, M = Math.max(r, g, b), N = Math.min(r, g, b), sv1 = M > 0 ? (M - N) / M : 0, tg = sv0 * 0.98;
        if (sv1 < tg && sv1 > 0.005) { const k = Math.min(3, tg / sv1); r = M - (M - r) * k; g = M - (M - g) * k; b = M - (M - b) * k; r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b); }
      }
      d[p] = Math.min(255, r); d[p + 1] = Math.min(255, g); d[p + 2] = Math.min(255, b);
    }
    // контур: в режиме 1 — смягчаем имеющийся тёмный край (поднимаем к тёплому коричневому), без размытия и без изменения альфы
    const R = Math.max(1, Math.round(H / (lv >= 2 ? 110 : 160))), OA = lv >= 2 ? .85 : .3, OC = lv >= 2 ? [42, 26, 16] : [70, 46, 30];
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const i = yy * W + xx; if (A[i] < 100) continue; let edge = false;
      for (let q = -R; q <= R && !edge; q++) for (let w = -R; w <= R; w++) { if (q * q + w * w > R * R + 1) continue; const X = xx + w, Y = yy + q; if (X < 0 || Y < 0 || X >= W || Y >= H || A[Y * W + X] < 60) { edge = true; break; } }
      if (!edge) continue;
      const p = i * 4;
      if (lv >= 2) { d[p] = d[p] * (1 - OA) + OC[0] * OA; d[p + 1] = d[p + 1] * (1 - OA) + OC[1] * OA; d[p + 2] = d[p + 2] * (1 - OA) + OC[2] * OA; d[p + 3] = Math.max(d[p + 3], 230); }
      else { const lum = (d[p] + d[p + 1] + d[p + 2]) / 3; if (lum < 60) { d[p] = d[p] * (1 - OA) + OC[0] * OA; d[p + 1] = d[p + 1] * (1 - OA) + OC[1] * OA; d[p + 2] = d[p + 2] * (1 - OA) + OC[2] * OA; } }
    }
    x.putImageData(id, 0, 0); m[key] = o; return o;
  }
  // v6.57a: сет-окраска — перекраска снаряжения (насыщенные не-кожные пиксели) в оттенок dye, светлота сохраняется; кожа/лицо/волосы-тёмные не трогаются
  const dyeOf = h => { const id = h.rpg_eq && EQ_COS(h, 'set'); const x = id && (C.sets || []).find(z => z.id === id); return x && x.dye || null; };
  const DYE = new Map();
  function dyed(c, hex) {
    if (!c || !hex) return c; let m = DYE.get(c); if (!m) { m = {}; DYE.set(c, m); if (DYE.size > 400) DYE.clear(); } if (m[hex]) return m[hex];
    const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0);
    let id; try { id = x.getImageData(0, 0, o.width, o.height); } catch (e) { return (m[hex] = c); }
    const n = parseInt(hex.slice(1), 16), tr = (n >> 16) / 255, tg = (n >> 8 & 255) / 255, tb = (n & 255) / 255;
    const tmx = Math.max(tr, tg, tb), tmn = Math.min(tr, tg, tb), td = tmx - tmn; let th = 0; if (td) { th = tmx === tr ? ((tg - tb) / td) % 6 : tmx === tg ? (tb - tr) / td + 2 : (tr - tg) / td + 4; th *= 60; if (th < 0) th += 360; }
    const ts = td / (1 - Math.abs(tmx + tmn - 1) || 1);
    const hsl2 = (H, S, L) => { const C2 = (1 - Math.abs(2 * L - 1)) * S, X = C2 * (1 - Math.abs((H / 60) % 2 - 1)), mm = L - C2 / 2; const [a, b, cc] = H < 60 ? [C2, X, 0] : H < 120 ? [X, C2, 0] : H < 180 ? [0, C2, X] : H < 240 ? [0, X, C2] : H < 300 ? [X, 0, C2] : [C2, 0, X]; return [(a + mm) * 255, (b + mm) * 255, (cc + mm) * 255]; };
    const d = id.data;
    for (let p = 0; p < d.length; p += 4) { if (d[p + 3] < 8) continue;
      const r = d[p] / 255, g = d[p + 1] / 255, b = d[p + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
      const sat = dl ? dl / (1 - Math.abs(2 * l - 1)) : 0; let hue = 0; if (dl) hue = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; if (dl) { hue *= 60; if (hue < 0) hue += 360; }
      const skin = hue >= 4 && hue <= 46 && sat > .28 && l > .2; if (skin || l < .12 || l > .95) continue;
      const [R2, G2, B2] = sat < .22 ? hsl2(th, Math.min(1, ts * .75), l * .9) : hsl2(th, Math.min(1, sat * .45 + ts * .55), l); /* серые ткань/металл — мягкий тон, цветные — полная перекраска */ d[p] = R2; d[p + 1] = G2; d[p + 2] = B2; }
    x.putImageData(id, 0, 0); return (m[hex] = o);
  }
  // v6.57: перекраска волос по маске assets/heroes6/hair/<k>.png (белое = волосы), тон по светлоте пикселя → ramp цвета; кэш по холсту
  const HAIRC = new Map();
  function haired(c, k, hid) {
    if (!HAIR_RC() || H7[k]) return c; // v7panel9: исходный спрайт без перекраски; v49.7: у heroes7 волосы уже нарисованы
    const hc = hairById(hid); if (!c || !hc || !hc.ramp) return c; const mi = IMG['hm_' + k]; if (!mi || !mi.width || isPH('hm_' + k)) return c;
    let m = HAIRC.get(c); if (!m) { m = {}; HAIRC.set(c, m); if (HAIRC.size > 400) HAIRC.clear(); } if (m[hid]) return m[hid];
    const W = c.width, H = c.height, o = document.createElement('canvas'); o.width = W; o.height = H; const x = o.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0);
    const mc = document.createElement('canvas'); mc.width = W; mc.height = H; const mx2 = mc.getContext('2d'); mx2.imageSmoothingEnabled = false; mx2.drawImage(mi, 0, 0, W, H);
    let id, md; try { id = x.getImageData(0, 0, W, H); md = mx2.getImageData(0, 0, W, H).data; } catch (e) { return (m[hid] = hairedComp(c, o, mi, hc)); } // v7panel8: OBS «Локальный файл»/file:// — холст «грязный», getImageData запрещён → перекраска композитингом
    const d = id.data, [A, B, Cc] = hc.ramp;
    for (let p = 0; p < d.length; p += 4) { if (md[p] < 128 || d[p + 3] < 8) continue;
      const l = (Math.max(d[p], d[p + 1], d[p + 2]) + Math.min(d[p], d[p + 1], d[p + 2])) / 510, t = Math.max(0, Math.min(1, (l - .03) / .4));
      const a = t < .5 ? A : B, b = t < .5 ? B : Cc, u = t < .5 ? t * 2 : (t - .5) * 2;
      d[p] = a[0] + (b[0] - a[0]) * u; d[p + 1] = a[1] + (b[1] - a[1]) * u; d[p + 2] = a[2] + (b[2] - a[2]) * u; }
    x.putImageData(id, 0, 0); return (m[hid] = o);
  }
  // v7panel8 п.1/п.2: перекраска волос без чтения пикселей (работает на file:// в OBS, где getImageData/toDataURL бросают SecurityError).
  // Маска — белое с альфой (assets/heroes6/hair/*.png, RGBA). Оттенок — blend 'color', светлота — multiply/screen к тону ramp[1].
  const HAIR_BASE_L = (Math.max(120, 66, 40) + Math.min(120, 66, 40)) / 510; // натуральный каштан
  function hairedComp(c, o, mi, hc) {
    try { const W = c.width, H = c.height, L = document.createElement('canvas'); L.width = W; L.height = H; const g = L.getContext('2d'); g.imageSmoothingEnabled = false;
      const cut = () => { g.globalCompositeOperation = 'destination-in'; g.drawImage(mi, 0, 0, W, H); g.drawImage(c, 0, 0); };
      g.drawImage(c, 0, 0); cut();
      const mid = hc.ramp[1], tl = (Math.max(...mid) + Math.min(...mid)) / 510;
      g.globalCompositeOperation = 'color'; g.fillStyle = `rgb(${mid.join(',')})`; g.fillRect(0, 0, W, H); cut();
      if (tl < HAIR_BASE_L) { const v = Math.round(255 * Math.max(.15, tl / HAIR_BASE_L)); g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, 0, W, H); cut(); }
      else if (tl > HAIR_BASE_L + .02) { const v = Math.round(255 * Math.min(.85, (tl - HAIR_BASE_L) / (1 - HAIR_BASE_L))); g.globalCompositeOperation = 'screen'; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, 0, W, H); cut(); }
      const x = o.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.drawImage(L, 0, 0); return o;
    } catch (e) { return c; }
  }
  function drawHero6(k, h, rt, dx, dy, hh, opt) {
    const m = M6[k], sit = k.endsWith('_sit'), s = (sit ? hh / SIT6_K : hh) / 240;
    const ul = unifyLevel(), c = filtered(haired(dyed(unified(sprite('h6_' + k, Math.round(m.h * s)), ul, h.rpg_class), dyeOf(h)), k, hairOf(h)), opt.filter); if (!c) return null;
    const w = c.width / K, ch = c.height / K, fx = m.fx * w / m.w, fy = (sit ? m.sy : m.fy) * ch / m.h;
    const ax = rt.x + dx, ay = sit ? rt.y : rt.y + dy;
    if (false && ul && !sit) { ctx.fillStyle = ul >= 2 ? 'rgba(40,22,8,.22)' : 'rgba(40,22,8,.14)'; ctx.beginPath(); ctx.ellipse(Math.round(rt.x), Math.round(rt.y + 2), hh * .36, hh * .09, 0, 0, Math.PI * 2); ctx.fill(); } // мягкая тень под ногами
    ctx.save(); if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
    ctx.translate(px(ax), px(ay));
    // v6.22: без покачивания сидящих (вращение рвало пиксели)
    if (opt.flip) ctx.scale(-1, 1);
    if (window.LIVE6 && LIVE6.has(rt.loc)) { ctx.shadowColor = 'rgba(255,236,205,.55)'; ctx.shadowBlur = Math.max(2, 4 * K); } // v8.6: светлая кайма — герой читается на тёмном живом фоне
    ctx.drawImage(c, -fx, -fy, w, ch); ctx.restore();
    return { w, top: ay - fy, h: ch * (sit ? 1 : (m.fy - 0) / m.h) };
  }
  const AURA_COL = { fire: ['#ff7a2a', '#ffd04a'], frost: ['#7ad8ff', '#e6f8ff'], holy: ['#fff2a0', '#ffffff'], shadow: ['#7a3aff', '#2a0a4a'] };
  // v6.57a: витринные ауры — пиксельные частицы, приглушённые, по прямым линиям (без покачиваний и дрожания)
  const AURA_PX = { ember: { c: ['#d0703a', '#e8b060'], dir: -1, sp: .35, n: 10, s: 8, a: .75 }, leaf: { c: ['#8aaa50', '#c0a858'], dir: 1, sp: .25, n: 9, s: 8, a: .7 },
    moondust: { c: ['#a8b0d8', '#e0e4f4'], dir: -1, sp: .18, n: 14, s: 6, a: .65 }, starcrown: { c: ['#e8d080', '#fff4c0'], ring: 1, n: 9, s: 8, a: .8 } };
  function drawAuraPx(A, x, y, hh, seed) {
    ctx.save();
    for (let k = 0; k < A.n; k++) {
      const s = A.s, col = k % 3 ? A.c[0] : A.c[1];
      if (A.ring) { const a = k / A.n * Math.PI * 2 + seed * 6, tw = (Math.floor(tm * 2 + k * 1.7) % 4) / 3; // звёзды стоят на месте, только мерцают ступенями
        ctx.globalAlpha = A.a * (.35 + .65 * tw); ctx.fillStyle = col; ctx.fillRect(Math.round(x + Math.cos(a) * hh * .3 - s / 2), Math.round(y - hh * 1.1 + Math.sin(a) * hh * .06 - s / 2), s, s); continue; }
      const p = (tm * A.sp + k / A.n + seed) % 1, lane = ((k * 37 + Math.floor(seed * 97)) % 11) / 10 - .5; // фиксированная «дорожка» для каждой частицы
      const px0 = x + lane * hh * .62, py0 = A.dir < 0 ? y - hh * (.1 + p * .95) : y - hh * (1.05 - p * .95);
      ctx.globalAlpha = A.a * Math.sin(p * Math.PI); ctx.fillStyle = col; ctx.fillRect(Math.round(px0 - s / 2), Math.round(py0 - s / 2), s, s);
    }
    ctx.restore();
  }
  // v6.57a: след за героем — пиксели остаются на земле и гаснут за 1.2 с
  function drawTrail(h, rt, moving) {
    const T = (C.trails || []).find(z => z.id === h.rpg_eq.trail); if (!T) { rt.trl = null; return; }
    const L = rt.trl || (rt.trl = []);
    if (moving && tm - (rt.trlT || 0) > 0.11) { rt.trlT = tm; L.push({ x: Math.round(rt.x + ((L.length * 7) % 13) - 6), y: Math.round(rt.y - 2 + ((L.length * 5) % 7) - 3), t: tm }); }
    while (L.length && tm - L[0].t > 1.2) L.shift();
    ctx.save(); for (const q of L) { const a = 1 - (tm - q.t) / 1.2; ctx.globalAlpha = .7 * a; ctx.fillStyle = T.color || '#fc8'; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); if (T.id === 'petals') { ctx.fillStyle = '#fff0f4'; ctx.fillRect(q.x - 1, q.y - 3, 2, 2); } } ctx.restore();
  }
  function drawAura(id, x, y, hh, seed) {
    if (AURA_PX[id]) return drawAuraPx(AURA_PX[id], x, y, hh, seed);
    const c = AURA_COL[id]; if (!c) return;
    ctx.save();
    const gr = ctx.createRadialGradient(x, y - hh * .45, 6, x, y - hh * .45, hh * .62);
    gr.addColorStop(0, c[0] + '55'); gr.addColorStop(1, c[0] + '00'); ctx.fillStyle = gr; ctx.fillRect(x - hh, y - hh * 1.2, hh * 2, hh * 1.4);
    for (let k = 0; k < 7; k++) {
      const p = (tm * (id === 'shadow' ? .45 : .7) + k / 7 + seed) % 1, a = k * 2.4 + seed * 9;
      const px0 = x + Math.cos(a) * hh * .32 * (1 - p * .3), py0 = y - p * hh * 1.05;
      ctx.globalAlpha = (1 - p) * .9; ctx.fillStyle = k % 2 ? c[1] : c[0];
      const s = id === 'frost' ? 7 : 9; ctx.fillRect(Math.round(px0 - s / 2), Math.round(py0 - s / 2), s, s);
    }
    ctx.restore();
  }
  function bestRarity(h) {
    let r = -1; const R4 = ['common', 'rare', 'epic', 'legendary'];
    [['aura', C.auras], ['pet', C.petList]].forEach(([t, pool]) => { const it = pool.find(c => c.id === EQ_COS(h, t)); if (it) r = Math.max(r, R4.indexOf(it.rarity)); });
    return r < 0 ? null : R4[r];
  }
  const LABQ = []; function flushLab() { const q = LABQ.splice(0); q.forEach(f => f()); } // подписи сцен B рисуются поверх всех спрайтов
  const BUB6 = []; // v49.8: занятые облачка в кадре
  const LBL6 = []; // занятые подписи (ник+класс) в кадре — чтобы ники не наезжали друг на друга
  // v6.30: подпись не налезает ни на чужие подписи, ни на модельки соседей (BOX6 — рамки спрайтов героев локации)
  const BOX6 = {};
  function boxes6(loc) {
    if (BOX6[loc]) return BOX6[loc];
    return BOX6[loc] = heroesIn(loc).map(h => { const r = ensureRT(h), hh = heroH(r); return { u: h.user, r: [r.x - 42, r.y - hh + 6, r.x + 42, r.y + 4] } }); // v7panel17: шире — оружие/плащ соседа
  }
  const LBLDBG = {}; // v7panel17: для теста — где и с каким текстом нарисована подпись героя
  function lblPos(x, y, w, loc, user, scr) {
    const ov = (a, o) => a[0] < o[2] && a[2] > o[0] && a[1] < o[3] && a[3] > o[1];
    const bx = loc ? boxes6(loc).filter(b => b.u !== user).map(b => scr ? [...zw2s(b.r[0], b.r[1]), ...zw2s(b.r[2], b.r[3])] : b.r) : [];
    const sx = w / 2 + 8, far = C.labelStyle === 'old', cand = far ? [[0, 0], [0, 58], [-sx, 18], [sx, 18], [-sx, -20], [sx, -20], [0, 116], [-sx, 76], [sx, 76], [-2 * sx, 18], [2 * sx, 18], [0, 174]]
      : [[0, 0], [-w * 0.35, 10], [w * 0.35, 10], [0, 30], [-w * 0.35, 34], [w * 0.35, 34]]; // v8.6: подпись не уезжает далеко от героя — лучше чуть заехать на соседа
    if (!far) { x = Math.max(w / 2 + 10, Math.min(W - w / 2 - 10, x)); y = Math.min(y, H - 150); } // не за край кадра и не на меню локаций внизу
    let best = null, bestN = 1e9;
    for (const [dx, dy] of cand) {
      const r = [x + dx - w / 2, y + dy + 10, x + dx + w / 2, y + dy + 66];
      if (LBL6.some(o => ov(r, o))) continue;
      const n = bx.filter(o => ov(r, o)).length;
      if (n === 0) { LBL6.push(r); return { x: x + dx, y: y + dy }; }
      if (n < bestN) { bestN = n; best = [dx, dy, r]; }
    }
    if (best) { LBL6.push(best[2]); return { x: x + best[0], y: y + best[1], ov: bestN }; }
    LBL6.push([x - w / 2, y + 10, x + w / 2, y + 66]); return { x, y, ov: 1 };
  }
  // v6.25: жесты атаки по классам — целые пиксели, без вращения/покачиваний; фаза 0..1 по таймеру rt.lunge (0.25 с)
  function gesture(h, rt) {
    if (!(rt.lunge > 0) || rt.lunge > 0.25 || rt.path.length) return { dx: 0, dy: 0, k: null };
    if (rt.loc === 'boss' && BF && BF.tr && BF.tr.roots.some(id => S.heroes[id] === h && TRT.rooted(BF, BF.all[id]))) { rt.lunge = 0; return { dx: 0, dy: 0, k: null }; } // v49.10: опутанный не делает выпад
    const p = 1 - rt.lunge / 0.25, dir = rt.flip ? -1 : 1, hit = Math.sin(p * Math.PI), c = h.rpg_class;
    const step = v => Math.round(v / 4) * 4; // шаг 4 px — без дробных сдвигов
    if (c === 'warrior') return { dx: step(hit * 34) * dir, dy: 0, k: 'slash', p };
    if (c === 'paladin') return { dx: step(hit * 14) * dir, dy: 0, k: 'hammer', p };
    if (c === 'assassin') return { dx: step(hit * 30) * dir, dy: 0, k: 'stab', p };
    if (c === 'archer') return { dx: -step(hit * 12) * dir, dy: 0, k: 'bow', p };
    if (c === 'mage') return { dx: 0, dy: 0, k: 'cast', p };
    if (c === 'priest') return { dx: 0, dy: -step(hit * 8), k: 'staff', p };
    return { dx: step(hit * 24) * dir, dy: 0, k: null };
  }
  function drawGesture(G, x, y, hh, flip) {
    const d = flip ? -1 : 1, p = G.p, a = Math.sin(p * Math.PI);
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6);
    const sq = (cx, cy, s, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s); };
    if (G.k === 'slash' || G.k === 'hammer' || G.k === 'stab') { // замах: дуга из пикселей перед героем
      const col = G.k === 'hammer' ? '#ffe2a0' : G.k === 'stab' ? '#d7c7ff' : '#ffffff', r = G.k === 'stab' ? hh * .28 : hh * .42, n = 7;
      for (let i = 0; i < n; i++) { const t = (i / (n - 1)) * Math.min(1, p * 1.6); const ang = -1.25 + t * 2.0; sq(x + d * (hh * .18 + Math.cos(ang) * r), y - hh * .55 + Math.sin(ang) * r, 8, col); }
      if (G.k === 'hammer') { ctx.fillStyle = 'rgba(120,170,255,.55)'; ctx.fillRect(Math.round(x + d * hh * .22 - 6), Math.round(y - hh * .78), 12, Math.round(hh * .5)); } // щит перед собой
    } else if (G.k === 'bow') { // натянутая тетива
      const bx = x + d * hh * .3, by = y - hh * .55, pull = Math.round(a * 22);
      ctx.fillStyle = '#e8d6a8'; for (let i = -5; i <= 5; i++) ctx.fillRect(Math.round(bx - d * pull * (1 - Math.abs(i) / 5)) - 2, Math.round(by + i * 8) - 2, 4, 4);
    } else if (G.k === 'cast') { // посох вперёд, руна каста перед магом
      const cx = x + d * hh * .42, cy = y - hh * .6;
      for (let i = 0; i < 8; i++) { const ang = i / 8 * Math.PI * 2 + p * 3; sq(cx + Math.cos(ang) * 20, cy + Math.sin(ang) * 20, 6, i % 2 ? '#9fd8ff' : '#e6f8ff'); }
    } else if (G.k === 'staff') { // посох над головой — свет над макушкой
      const cx = x, cy = y - hh * 1.06;
      for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2 + p * 2; sq(cx + Math.cos(ang) * 16, cy + Math.sin(ang) * 10, 6, i % 2 ? '#fff6a0' : '#ffffff'); }
      sq(cx, cy, 10, '#fffbe0');
    }
    ctx.restore();
  }
  function drawHero(h) {
    const rt = ensureRT(h), st = stats(h), hh = heroH(rt), moving = rt.path.length > 0;
    const bob = moving ? -Math.round(Math.abs(Math.sin(rt.walkT * 10)) * 8) : 0; // v6.25: без покачиваний на месте
    const pk = rt.pick !== undefined && tm - rt.pick < 0.7 ? Math.round(Math.sin((tm - rt.pick) / 0.7 * Math.PI) * 34) : 0;
    const G = gesture(h, rt), lunge = G.dx;
    const fade = rt.fade === undefined ? 1 : clamp(rt.fade, 0, 1);
    if (fade <= 0.01) return;
    const boss = rt.mode === 'boss' && rt.loc === 'boss';
    ctx.save(); ctx.globalAlpha = fade;
    const opt = { flip: rt.flip, alpha: rt.ghost ? 0.5 : 1 };
    if (rt.hit > 0) opt.filter = 'brightness(1.7)';
    const shake = rt.hit > 0 ? (Math.sin(tm * 75) > 0 ? 3 : -3) : 0; // лёгкая тряска при уроне
    if (rt.ghost && (tm > (rt.ghostT || 0) || rt.loc === 'camp' && rt.mode !== 'dead' && rt.mode !== 'walk')) { rt.ghost = false; if (rt.mode === 'dead' && !rt.path.length) rt.mode = 'seat'; } // v6.29: не оставлять серость у живых
    if (rt.ghost || (boss && h._bossDead)) { opt.filter = 'grayscale(1)'; opt.alpha = 0.5; }
    if (h._stealth) opt.alpha = 0.55;
    if (ACTIVE === h.user) {
      ctx.save(); ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 5; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(tm * 6);
      ctx.beginPath(); ctx.ellipse(rt.x, rt.y + 2, 58, 18, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (isHeroWeek(h)) { // Герой недели: золотое сияние под ногами
      ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(tm * 3); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(rt.x, rt.y + 2, 64, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    { // v8.5: контактная тень — плоская, тёмная в центре, прямо под ступнями (не «круг», герой не висит в воздухе)
      const rx = Math.max(22, hh * 0.2), ry = rx * 0.2, cx = Math.round(rt.x + lunge), cy = Math.round(rt.y - ry * 0.15);
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx); gr.addColorStop(0, 'rgba(10,6,4,.55)'); gr.addColorStop(0.6, 'rgba(10,6,4,.35)'); gr.addColorStop(1, 'rgba(10,6,4,0)');
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (EQ_COS(h, 'trail')) drawTrail(h, rt, moving);
    if (EQ_COS(h, 'aura')) drawAura(h.rpg_eq.aura, rt.x + lunge, rt.y, hh, (h.rpg_created % 97) / 97);
    const k6 = hero6Key(h, rt), r6 = k6 && drawHero6(k6, h, rt, lunge + shake, bob - pk + G.dy, hh, opt);
    if (G.k) drawGesture(G, rt.x + lunge, rt.y + G.dy, hh, rt.flip);
    let sw;
    if (r6) sw = r6.w;
    else { const base = `hero_${h.rpg_class}_${h.rpg_gender}`, key = window.Assets.tinted(base, heroColor(h)); sw = drawImg(key, rt.x + lunge + shake, rt.y + bob - pk, hh, opt); }
    // шляпа на макушке (точки — assets.js → heroAnchors)
    const hat = null; // v6.30: шляпы убраны
    if (hat && !rt.ghost) {
      const an = window.Assets.anchors[`${h.rpg_class}_${h.rpg_gender === 'female' ? 'f' : 'm'}`] || { x: .5, y: .08, w: .46 };
      const ax = rt.flip ? 1 - an.x : an.x, hw = sw * an.w * 1.1, hth = Math.round(hw * hat.height / hat.width);
      const left = rt.x + lunge - sw / 2, top = rt.y + bob - pk - hh;
      drawImg('hat_' + h.rpg_eq.hat, left + sw * ax, top + hh * an.y + hth * 0.42, hth, { flip: rt.flip });
    }
    // питомец рядом
    if (h.rpg_eq.pet && !boss) {
      const side = rt.flip ? 1 : -1, fly = h.rpg_eq.pet === 'fairy' || h.rpg_eq.pet === 'dragon';
      const py0 = rt.y + 4 - (fly ? 70 + Math.sin(tm * 3 + h.rpg_created) * 10 : Math.abs(Math.sin(tm * 4 + h.rpg_created)) * 6);
      // v6.57c: питомец-слизень рисовался тем же спрайтом и размером, что монстр «Слизень», — в бою выглядел как моб у героя.
      // Теперь питомец мельче, перекрашен (CONFIG.petLook) и с сердечком над ним.
      const PL = (C.petLook || {})[h.rpg_eq.pet] || {}, ph = PL.h || (fly ? 54 : 34);
      if (!fly) shadow(rt.x + side * 70, rt.y + 4, 13);
      drawImg('pet_' + h.rpg_eq.pet, rt.x + side * 70, py0, ph, { flip: !rt.flip, filter: PL.filter || undefined });
      text('♥', rt.x + side * 70, py0 - ph - 4, 16, '#ff8fb8');
    }
    const g = guildById(h.rpg_guild);
    let nm = DN(h);
    const maxN = boss ? 10 : 14; if (nm.length > maxN) nm = nm.slice(0, maxN - 1) + '…';
    const nameCol = heroColor(h);
    let ttl = isHeroWeek(h) ? '★ Герой недели' : (h.rpg_eq.title && C.titleReplacesClass ? h.rpg_eq.title : (h.rpg_eq.title ? `${h.rpg_eq.title} · ` : '') + `${className(h)} ${h.rpg_level}`); { const md = seasonMedal(h.rpg_eq.title); if (md && !isHeroWeek(h)) ttl = md + ' ' + ttl; } // v49: медаль сезона // v6.55 п.5: титул не затирает класс
    const LBL_B = (B6[rt.loc] || rt.loc === 'boss') && !boss; // v6.32: после боя на поляне босса подписи тоже разводятся
    const ZL = !!ZC; // v6.34: при приближении подписи — в экранных координатах и разводятся
    let LW = C.labelStyle !== 'old' ? Math.max(measure(nm, 24) + 40, measure(ttl, 18) + 10) : Math.max(measure(nm, 24) + 32, measure(ttl, 22) + 16); const [zsx, zsy] = ZL ? zw2s(rt.x, rt.y) : [0, 0];
    let LP = ZL ? lblPos(zsx, zsy, LW, rt.loc, h.user, true) : LBL_B ? lblPos(rt.x, rt.y, LW, rt.loc, h.user) : { x: rt.x, y: rt.y };
    // v7panel17: подпись наезжает на соседа — укорачиваем титул («Алхимик · Жрица 6» → «Алхимик 6») и ищем место заново
    if ((ZL || LBL_B) && LP.ov > 0 && !boss) { const sh = h.rpg_eq.title && !isHeroWeek(h) ? `${h.rpg_eq.title.length > 12 ? h.rpg_eq.title.slice(0, 11) + '…' : h.rpg_eq.title} ${h.rpg_level}` : ttl;
      if (sh !== ttl) { LBL6.pop(); ttl = sh; LW = Math.max(measure(nm, 24) + 32, measure(ttl, 22) + 16); LP = ZL ? lblPos(zsx, zsy, LW, rt.loc, h.user, true) : lblPos(rt.x, rt.y, LW, rt.loc, h.user); } }
    LBLDBG[h.user] = { loc: rt.loc, x: LP.x, y: LP.y, w: LW, ov: LP.ov || 0, ttl, zl: ZL };
    const LBLF = () => {
    const R0 = rt; if (C.labelStyle !== 'old') { const x = LP.x, y = LP.y; // v8.6: подпись как на сайте — «● ник» цветом гильдии и строка «титул · класс ур» мелко, без рамок
      const ncol = g ? g.color : nameCol, nw = measure(nm, 24);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = Math.max(2, 5 * K);
      if (g) { ctx.fillStyle = '#1e120a'; ctx.beginPath(); ctx.arc(px(x - nw / 2 - 15), px(y + 24), 8, 0, 7); ctx.fill(); ctx.fillStyle = g.color; ctx.beginPath(); ctx.arc(px(x - nw / 2 - 15), px(y + 24), 5.5, 0, 7); ctx.fill(); }
      text(nm, x + (g ? 8 : 0), y + 24, 24, ncol);
      if (!boss) text(ttl, x, y + 48, 18, isHeroWeek(h) ? '#ffd24a' : '#f3ead8');
      ctx.restore(); return; }
    { const rt = { x: LP.x, y: LP.y };
    if (g) { const nw = measure(nm, 24); ctx.fillStyle = '#1e120a'; ctx.fillRect(Math.round(rt.x - nw / 2 - 26), Math.round(rt.y + 13), 20, 20); ctx.fillStyle = g.color; ctx.fillRect(Math.round(rt.x - nw / 2 - 23), Math.round(rt.y + 16), 14, 14); }
    text(nm, rt.x, rt.y + 24, 24, nameCol);
    if (/^Чемпион \d+ сезона/.test(h.rpg_eq.title || '')) { const nw = measure(nm, 24) + 22; ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.strokeRect(Math.round(rt.x - nw / 2), Math.round(rt.y + 7), Math.round(nw), 34); } // v49: золотая рамка ника чемпиона
    if (!boss) {
      const rar = bestRarity(h), col = isHeroWeek(h) ? '#ffd24a' : rar ? C.rarityColors[rar] : '#ffe7b0';
      if (rar || isHeroWeek(h) || h.rpg_eq.title) { // рамка редкости вокруг подписи
        const tw = measure(ttl, 22) + 16; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(Math.round(rt.x - tw / 2), Math.round(rt.y + 38), Math.round(tw), 28);
      }
      text(ttl, rt.x, rt.y + 52, 22, col);
    }
    }
    };
    if (LBL_B || ZL) { const al = ctx.globalAlpha, tf = ZL ? ZBASE : ctx.getTransform(); LABQ.push(() => { ctx.save(); ctx.setTransform(tf); ctx.globalAlpha = al; LBLF(); ctx.restore(); }); } else LBLF();
    if (rt.mode === 'exp' || rt.mode === 'dead' || boss || h.rpg_hp < st.maxhp - 0.5) bar(rt.x - 40, rt.y - hh - 20, 80, 9, h.rpg_hp / st.maxhp, h.rpg_hp / st.maxhp > .35 ? '#5ad35a' : '#e05a3a');
    if ((rt.mode === 'exp' || boss) && h._shield > 0 && h._shieldMax > 0) bar(rt.x - 40, rt.y - hh - 34, 80, 6, h._shield / h._shieldMax, '#7fd0ff'); // v7panel16: щит палатки
    if (rt.work && rt.work > 0 && !moving && rt.mode !== 'cook') text('✦', rt.x + 40, rt.y - hh + 10 + Math.sin(tm * 8) * 6, 24, '#fff6a0');
    ctx.restore();
  }
  function drawBubble(h) {
    const rt = ensureRT(h); if (!rt.bubble) return;
    const lines = rt.bubble.lines, lh = 30;
    setFont(22); const w = Math.round(Math.max(60, ...lines.map(l => ctx.measureText(l).width)) + 28), bh = lines.length * lh + 16;
    const hh = heroH(rt);
    const bo = rt.bubbleOff && rt.mode === 'cook' ? rt.bubbleOff : [0, 0];
    let bx = Math.round(clamp(rt.x + bo[0] - w / 2, 12, W - w - 12)), by = Math.round(rt.y + bo[1] - hh - 36 - bh - (rt.mode === 'exp' || h.rpg_hp < stats(h).maxhp ? 18 : 0));
    if (by < 10) by = 10;
    { // v49.8: облачко не закрывает соседей и другие облачка — из нескольких мест (над головой, левее/правее, выше) берём наименее закрывающее
      const ia = (p, q) => Math.max(0, Math.min(p[2], q[2]) - Math.max(p[0], q[0])) * Math.max(0, Math.min(p[3], q[3]) - Math.max(p[1], q[1]));
      const hb = boxes6(rt.loc).filter(o => o.u !== h.user).map(o => o.r), sx = Math.round(w / 2 + 20);
      const cand = [[0, 0], [-sx, 20], [sx, 20], [0, -bh - 14], [-sx, -bh - 6], [sx, -bh - 6], [-2 * sx, 40], [2 * sx, 40]];
      let best = null, bs = 1e18;
      for (const [dx, dy] of cand) {
        const x0 = clamp(bx + dx, 12, W - w - 12), y0 = Math.max(10, by + dy), r = [x0 - 3, y0 - 3, x0 + w + 3, y0 + bh + 21];
        const sc = hb.reduce((t, q) => t + ia(r, q), 0) + 4 * BUB6.reduce((t, q) => t + ia(r, q), 0) + 0.5 * LBL6.reduce((t, q) => t + ia(r, q), 0) + (Math.abs(dx) + Math.abs(dy)) * 2;
        if (sc < bs) { bs = sc; best = [x0, y0, r]; }
      }
      bx = Math.round(best[0]); by = Math.round(best[1]); BUB6.push(best[2]); rt.bubXY = [bx, by, w, bh];
    }
    const a = rt.bubbleT < 0.4 ? rt.bubbleT / 0.4 : 1;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = '#a07a44'; ctx.fillRect(bx - 3, by - 3, w + 6, bh + 6);
    ctx.fillStyle = rt.bubble.chat ? '#3a2e44' : '#2c2230'; ctx.fillRect(bx, by, w, bh);
    const tx = clamp(Math.round(rt.x), bx + 14, bx + w - 14);
    ctx.fillStyle = '#a07a44'; ctx.beginPath(); ctx.moveTo(tx - 13, by + bh + 2); ctx.lineTo(tx, by + bh + 18); ctx.lineTo(tx + 13, by + bh + 2); ctx.fill();
    ctx.fillStyle = rt.bubble.chat ? '#3a2e44' : '#2c2230'; ctx.beginPath(); ctx.moveTo(tx - 9, by + bh - 1); ctx.lineTo(tx, by + bh + 11); ctx.lineTo(tx + 9, by + bh - 1); ctx.fill();
    lines.forEach((l, i) => text(l, bx + w / 2, by + bh / 2 + (i - (lines.length - 1) / 2) * lh, 22, '#f4e6c8', 'center', 0)); // v6.30: по центру
    ctx.restore();
  }
  // v7panel4 п.1: облачко набора пати над записавшимся героем: «🛡 пати 1/3» (отряд героя в очереди). Ушли/распались — героя нет в PARTYQ → облачка нет
  function partyTagText(h) { const P = PTY(), q = PARTYQ.users, i = q.indexOf(h.user); if (i < 0) return ''; const s0 = Math.floor(i / P.size) * P.size; return `🛡 пати ${Math.min(P.size, q.length - s0)}/${P.size}`; }
  function drawPartyTag(h) {
    const rt = ensureRT(h), t = partyTagText(h); if (!t) return;
    setFont(22); const w = Math.round(ctx.measureText(t).width + 24), bh = 36, hh = heroH(rt);
    const bx = Math.round(clamp(rt.x - w / 2, 12, W - w - 12)), by = Math.max(10, Math.round(rt.y - hh - 36 - bh - (rt.mode === 'exp' || h.rpg_hp < stats(h).maxhp ? 18 : 0)));
    ctx.save(); ctx.fillStyle = '#c8a050'; ctx.fillRect(bx - 3, by - 3, w + 6, bh + 6); ctx.fillStyle = '#24304a'; ctx.fillRect(bx, by, w, bh);
    const tx = clamp(Math.round(rt.x), bx + 12, bx + w - 12); ctx.fillStyle = '#c8a050'; ctx.beginPath(); ctx.moveTo(tx - 10, by + bh + 2); ctx.lineTo(tx, by + bh + 14); ctx.lineTo(tx + 10, by + bh + 2); ctx.fill();
    text(t, bx + w / 2, by + bh / 2, 22, '#ffe6a8', 'center', 0); ctx.restore();
  }
  function drawMonster(b) {
    const m = b.mon; if (!m) return;
    if (m.d.mimic && drawMimic(b, m)) return;
    const alpha = m.dead ? Math.max(0, 1 - m.dead / 0.8) : 1;
    const hh = Math.round((m.d.h || 120) * persp(m.y) / 4) * 4;
    // v6.30: тень по ширине спрайта и плотнее — моб стоит на земле, а не висит
    const im6 = IMG[m.d.id], mw = im6 && im6.height ? hh * im6.width / im6.height : hh;
    ctx.save(); ctx.globalAlpha = alpha; shadow(m.x, m.y - 2, Math.round(mw * 0.46)); shadow(m.x, m.y - 2, Math.round(mw * 0.3)); ctx.restore();
    // v6.26/v6.44: спрайты мобов нарисованы лицом влево (новый лист отзеркален при нарезке) — разворачиваем к герою этого боя
    const mflip = !!(C.monFacesRight || []).includes(m.d.id); // v6.54: все спрайты мобов (лист Tim t186) смотрят ВЛЕВО, к героям; не разворачиваем
    // v6.44: стайка (крысы ×3) — копии чуть позади/впереди, ближняя рисуется последней
    const grp = m.d.group > 1 ? [[-0.55, -0.34, 0.9], [0.55, -0.34, 0.9], [0, 0, 1]].slice(-m.d.group) /* v6.57b2: треугольник — 2 сверху (дальше), 1 снизу (ближе) */ : [[0, 0, 1]]; // v6.54: одна и та же крыса ×3, чуть разный размер/место
    for (const [ox, oy, sc] of grp) { if (ox || oy) { ctx.save(); ctx.globalAlpha = alpha; shadow(m.x + ox * mw, m.y + oy * hh - 2, Math.round(mw * 0.4)); ctx.restore(); }
      const lg = m.atkT > 0 && !m.dead ? -Math.sin(Math.min(1, (0.7 - m.atkT) / 0.7) * Math.PI) * 42 * persp(m.y) * (mflip ? -1 : 1) : 0, sq = m.atkT > 0 && !m.dead ? 1 + Math.sin(Math.min(1, (0.7 - m.atkT) / 0.7) * Math.PI) * 0.06 : 1; // v9: выпад моба при атаке
      drawImg(m.d.id, m.x + ox * mw + lg, m.y + oy * hh, Math.round(hh * sc * sq / 4) * 4, { flip: mflip, alpha, filter: m.hit > 0 ? 'brightness(1.35)' : undefined }); }
    if (!m.dead) { bar(m.x - 44, m.y - hh - 22, 88, 10, m.hp / m.maxhp, '#e05a3a'); text(m.d.name, m.x, m.y + 24, 22, m.d.rare ? '#ff9cc4' : '#ffd7c2'); }
    if (!m.dead && b.G && b.G.g9 && b.G.mech && b.G.mech.sub) { const sb = b.G.mech.sub, yy = m.y - hh - 58; text(`🎯 ${sb.name}`, m.x, yy - 16, 20, '#ffd27a'); bar(m.x - 60, yy, 120, 9, Math.max(0, sb.hp / sb.max), '#e8b830'); } // v9: цель мини-босса
  }

  // v6.57c: кадр из ленты/сетки с целым экранным множителем (nearest): s экранных пикселей на пиксель арта
  function drawCell(key, sx, sy, sw, sh, ax, cx, by, artH, targetH, opt) {
    const im = IMG[key]; if (!im || !im.width || isPH(key)) return false; opt = opt || {};
    const s = Math.max(1, Math.round(targetH * K / artH)), w = sw * s / K, hh = sh * s / K;
    const x = Math.round(cx * K - ax * s) / K, y = Math.round(by * K - sh * s) / K;
    ctx.save(); ctx.imageSmoothingEnabled = false; if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha; if (opt.filter) ctx.filter = opt.filter;
    ctx.drawImage(im, sx, sy, sw, sh, x, y, w, hh); ctx.restore(); return { w, h: hh, s };
  }
  const MIMIC_A = { attack: 9, chew: 4, death: 5, hit: 6, jump: 6, lick: 8, rest: 4 };
  function mimicAnim(b, m, tm) { // какая лента и кадр сейчас
    if (m.dead) return ['death', Math.min(4, Math.floor(m.dead * 9))];
    if (m.atkT > 0) return ['attack', Math.min(8, Math.floor((0.7 - m.atkT) / 0.7 * 9))];
    if (m.hit > 0) return ['hit', Math.min(5, Math.floor((0.2 - m.hit) / 0.2 * 6))];
    const ph = (b.G || b).phase;
    if (ph === 'approach' || ph === 'spawn') return ['jump', Math.floor(tm * 10) % 6];
    const c = tm % 7; if (c < 1) return ['lick', Math.floor(c * 8) % 8]; if (c > 4 && c < 4.8) return ['chew', Math.floor((c - 4) * 5) % 4];
    return ['rest', Math.floor(tm * 5) % 4];
  }
  // v7panel12 п.6: ленты мимика подгружаем сами (старый assets.js без mimic_*), а пока их нет — мимик рисуется прыгающим деревянным сундуком
  let _mimLazy = false;
  function mimicLazy() { if (_mimLazy) return; _mimLazy = true; for (const an of Object.keys(MIMIC_A)) { const k = 'mimic_' + an; if (IMG[k] && !isPH(k)) continue; const i = new Image(); i.onload = () => { IMG[k] = i; window.Assets.isPlaceholder[k] = false; }; i.src = 'assets/mimic/' + k + '.png'; } }
  function drawMimicChest(b, m, tm) {
    const alpha = m.dead ? Math.max(0, 1 - m.dead / 0.8) : 1, ph = (b.G || b).phase, hop = ph === 'approach' || ph === 'spawn' ? Math.abs(Math.sin(tm * 9)) * 18 : 0;
    const sh = m.hit > 0 || m.atkT > 0 ? Math.round(Math.sin(tm * 45) * 5) : 0, hh = (m.d.h || 120) * persp(m.y);
    ctx.save(); ctx.globalAlpha = alpha; shadow(m.x, m.y - 2, Math.round(hh * 0.5)); ctx.restore();
    const r = drawChestA('wooden', m.x + sh, m.y - hop, hh * 0.6, m.atkT > 0, 0.2, { alpha, filter: m.hit > 0 ? 'brightness(1.35)' : undefined });
    const top = r ? r.h : hh; if (!r) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#8a5a2a'; ctx.fillRect(m.x - hh * 0.5, m.y - hh * 0.8 - hop, hh, hh * 0.8); ctx.fillStyle = '#d8a040'; ctx.fillRect(m.x - hh * 0.5, m.y - hh * 0.5 - hop, hh, 6); ctx.restore(); }
    if (!m.dead) { bar(m.x - 44, m.y - top - 16, 88, 10, m.hp / m.maxhp, '#e05a3a'); text(m.d.name, m.x, m.y + 24, 22, '#ffb36a'); }
    return true;
  }
  function drawMimic(b, m) {
    const tm = performance.now() / 1000, [an, fi] = m._anim || mimicAnim(b, m, tm), key = 'mimic_' + an;
    if (!IMG[key] || isPH(key)) { mimicLazy(); return drawMimicChest(b, m, tm); } // v7panel12 п.6: в OBS у Tim лент мимика нет в манифесте/папке → раньше рисовалась только подпись
    const alpha = m.dead ? (m.dead < 0.55 ? 1 : Math.max(0, 1 - (m.dead - 0.55) / 0.3)) : 1;
    const hh = (m.d.h || 120) * persp(m.y);
    ctx.save(); ctx.globalAlpha = alpha; shadow(m.x, m.y - 2, Math.round(hh * 0.5)); ctx.restore();
    const r = drawCell(key, (fi % MIMIC_A[an]) * 32, 0, 32, 28, 16, m.x, m.y + 2, 28, hh, { alpha, filter: m.hit > 0 ? 'brightness(1.35)' : undefined });
    if (!r) return false;
    if (!m.dead) { bar(m.x - 44, m.y - r.h - 16, 88, 10, m.hp / m.maxhp, '#e05a3a'); text(m.d.name, m.x, m.y + 24, 22, '#ffb36a'); }
    return true;
  }
  // v6.57c: анимированные сундуки (z1 Animated Chests, сетка 48x32: тип — 2 строки, закрытый и открытие; арт сундука 28px, центр x=16)
  const CHEST_H = 120; // v6.57b2: было 66 (мелко); высота сундука в мире, экранный множитель целый
  const CHEST_ROW = { wooden: 0, silver: 1, golden: 2, legendary: 3 };
  function drawChestA(tier, cx, by, h, open, tOpen, opt) {
    const r = (CHEST_ROW[tier] || 0) * 2, tm = performance.now() / 1000;
    const fi = open ? Math.min(1, Math.max(0, Math.floor(tOpen * 8))) /* кадры 2-4 строки открытия — крышка улетает, для нас лишнее */ : Math.floor(tm * 6) % 5;
    return drawCell('chests_anim', fi * 48, (r + (open ? 1 : 0)) * 32, 48, 32, 16, cx, by, 20, h, opt);
  }

  // ===================== СЦЕНЫ ЛОКАЦИЙ =====================
  function heroesIn(loc) { return S.order.map(n => S.heroes[n]).filter(h => { const rt = ensureRT(h); return rt.loc === loc && rt.mode !== 'sleep'; }); }
  function sortDraw(list) { list.sort((a, b) => a.y - b.y).forEach(o => o.f()); }
  // v6.34: живое пламя поверх запечённых фонов — 8 заранее нарисованных пиксельных кадров (сетка 2px), смена 10 к/с,
  // картинка не дрожит (целые координаты, без сглаживания), свет — радиальный градиент с малой амплитудой мерцания
  const FLAMEC = {};
  function flameFrames(cw, ch) {
    const key = cw + 'x' + ch; if (FLAMEC[key]) return FLAMEC[key];
    const fr = [], N = 8, cols = ['#7a1e0c', '#c2410f', '#f08a1c', '#ffc443', '#fff1b0'];
    const hsh = (a, b) => { let v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let f = 0; f < N; f++) {
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d');
      for (let y = 0; y < ch; y++) {
        const t = y / ch, ph = f / N * Math.PI * 2;                         // t: 1 — низ (широко), 0 — верх (язык)
        const sw = Math.sin(y * 0.45 + ph) * (1 - t) * cw * 0.12;           // язык пламени чуть изгибается по кадрам
        const hw = cw * 0.5 * Math.pow(t, 0.75) * (0.85 + 0.25 * hsh(y, f));
        for (let i = 0; i < cw; i++) {
          const d = Math.abs(i + 0.5 - cw / 2 - sw) / Math.max(hw, 0.01); if (d > 1) continue;
          const q = (1 - d) * (0.35 + 0.65 * t) + 0.12 * (hsh(i + y * 7, f) - 0.5);
          const k = q > 0.78 ? 4 : q > 0.58 ? 3 : q > 0.36 ? 2 : q > 0.16 ? 1 : 0;
          if (k === 0 && hsh(i, y + f * 13) < 0.4) continue;
          x.fillStyle = cols[k]; x.fillRect(i, y, 1, 1);
        }
      }
      for (let k = 0; k < 3; k++) { const sx = Math.floor(cw * (0.25 + 0.5 * hsh(k, f))), sy = Math.floor(ch * 0.25 * hsh(f, k)); x.fillStyle = '#ffc443'; x.fillRect(sx, sy, 1, 1); } // искры
      fr.push(c);
    }
    return FLAMEC[key] = fr;
  }
  // v6.46: готовый пиксельный огонь из gif (assets/fx_fire_sheet.png, 10 кадров 15×15, 10 fps), целый масштаб, nearest
  // v6.47: огонь в стиле фона — assets/fx_fire47.png (10 кадров 32×44, приглушённая палитра), целый масштаб nearest, 10 fps
  function gifFire(x, y, s, seed) {
    const im = IMG.fx_fire; if (!im || isPH('fx_fire') || !(im.naturalWidth || im.width)) return false;
    const n = 10, fw = 32, fh = 44, f = (Math.floor(tm * 10) + seed) % n, w = fw * s, h = fh * s, was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, f * fw, 0, fw, fh, Math.round(x - w / 2), Math.round(y - h), w, h); ctx.imageSmoothingEnabled = was; return true;
  }
  function fireFX(x, y, cw, ch, light, seed) { // x,y — основание пламени (мир), размер в клетках по 2px
    const fl = 1 + 0.06 * Math.sin(tm * 7.3 + seed) + 0.03 * Math.sin(tm * 13.1 + seed * 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - ch, 4, x, y - ch, light * fl); g.addColorStop(0, 'rgba(255,150,60,.16)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.fillRect(x - light * 1.1, y - ch - light * 1.1, light * 2.2, light * 2.2); ctx.restore();
    if (gifFire(x, y, Math.max(1, Math.round(ch * 2 / 44)), seed)) return;
    const fr = flameFrames(cw, ch)[(Math.floor(tm * 10) + seed) % 8];
    const was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fr, Math.round(x - cw), Math.round(y - ch * 2), cw * 2, ch * 2); ctx.imageSmoothingEnabled = was;
  }
  // v6.40: факелы босса — то же пламя, что у костра лагеря (кадры 30×52), но 1 клетка = 1 px (≈50% размера костра, целый масштаб без мерцания пикселей),
  // плавная смена кадров кроссфейдом каждый кадр отрисовки (60 FPS), позиция округлена до целых px.
  function torchFX(x, y, sc, light, seed) {
    const cw = 30, ch = 52, fl = 1 + 0.05 * Math.sin(tm * 6.1 + seed) + 0.025 * Math.sin(tm * 11.7 + seed * 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fy = y - ch * sc * 0.5, g = ctx.createRadialGradient(x, fy, 3, x, fy, light * fl); g.addColorStop(0, 'rgba(255,150,60,.18)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.fillRect(x - light * 1.1, fy - light * 1.1, light * 2.2, light * 2.2); ctx.restore();
    if (gifFire(x, y + 4, 1, seed)) return; // факелы: 32×44
    const frs = flameFrames(cw, ch), ph = tm * 9 + seed, i = Math.floor(ph), k = ph - i, w = Math.round(cw * sc), h = Math.round(ch * sc);
    const X = Math.round(x - w / 2), Y = Math.round(y - h), was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.globalAlpha *= 1 - k; ctx.drawImage(frs[i % 8], X, Y, w, h); ctx.globalAlpha = (ctx.globalAlpha / Math.max(1 - k, 1e-3)) * k; ctx.drawImage(frs[(i + 1) % 8], X, Y, w, h); ctx.restore();
    ctx.imageSmoothingEnabled = was;
  }
  const TORCH6 = [[368, 300, 0.8, 110, 3], [2150, 300, 0.8, 110, 5], [1445, 478, 1.0, 120, 1]]; // locations_v1: факелы и жаровня у трона нового логова // v6.45: на нарисованные факелы нового логова
  window.__torch6 = TORCH6; // v6.43: правая верхняя жаровня (и в фоне boss.png) сдвинута на (-45, +120) — в 1080p больше не уходит под легенду босса
  const FIRE6 = { camp: [[1257, 836, 40, 52, 260, 0]], boss: [[368, 300, 12, 20, 140, 3], [2150, 300, 12, 20, 140, 5], [1445, 478, 18, 28, 160, 1]] }; // locations_v1
  window.__fire6 = FIRE6;
  function sceneCamp() {
    const list = [];
    const LIVEC = !!(window.LIVE6 && LIVE6.has('camp')); // v8.6: свет костра рисует живой фон
    if (!LIVEC) { const fl = 1 /* v49.8: без мерцания */, gx = FIRE.x, gy = FIRE.y, R = 420 * fl; // locations_v1: свечение от костра на фоне // v6.47: мягкое тёплое мерцающее свечение на землю (screen)
      ctx.save(); ctx.globalCompositeOperation = 'screen'; const gr = ctx.createRadialGradient(gx, gy, 10, gx, gy, R); gr.addColorStop(0, 'rgba(150,80,30,.42)'); gr.addColorStop(0.5, 'rgba(110,55,20,.16)'); gr.addColorStop(1, 'rgba(80,40,15,0)');
      ctx.fillStyle = gr; ctx.setTransform(ctx.getTransform().scale(1, 0.55).translate(0, gy / 0.55 - gy)); ctx.fillRect(gx - R, gy - R, R * 2, R * 2); ctx.restore(); }
    const an = (window.Assets.anim || {}).campfire_flame || { frames: 10, fps: 9 }, fr = 0; void an; // v49.8: костёр статичный, без анимации пламени
    list.push({ y: FIRE.y, f: () => building('campfire', 'campfire_base', FIRE.x, FIRE.y, 280, (sc, filt) => {
      // каменное основание + тень, потом брёвна и пламя
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(FIRE.x, FIRE.y - 2, 150 * sc, 44 * sc, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 14; k++) {
        const a = k / 14 * Math.PI * 2, sx = FIRE.x + Math.cos(a) * 118 * sc, sy = FIRE.y - 14 + Math.sin(a) * 34 * sc;
        ctx.fillStyle = '#3a3330'; ctx.fillRect(Math.round(sx - 17), Math.round(sy - 12), 34, 24);
        ctx.fillStyle = k % 3 ? '#8d857c' : '#a29a8e'; ctx.fillRect(Math.round(sx - 14), Math.round(sy - 10), 28, 17);
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(Math.round(sx - 12), Math.round(sy - 9), 14, 4);
      }
      drawImg('campfire_flame', FIRE.x, FIRE.y - Math.round(50 * sc), Math.round(230 * sc), { frame: fr });
      return drawImg('campfire_base', FIRE.x, FIRE.y, Math.round(118 * sc), { filter: filt });
    }, { x: FIRE.x, y: 300 }) });
    // v49.8: анимированное пламя (fireFX) над костром лагеря убрано — остаётся нарисованный костёр фона
    const sleepers = S.order.filter(n => ensureRT(S.heroes[n]).mode === 'sleep');
    list.push({ y: TENTS.big.y, f: () => {
      building('tents', 'tent', TENTS.big.x, TENTS.big.y, 300, null, { x: TENTS.big.x, y: TENTS.big.y - 380 });
      const ty = TENTS.big.y - 300;
      if (sleepers.length) { for (let k = 0; k < 3; k++) { const p = (tm * 0.4 + k / 3) % 1; text('z', TENTS.big.x + 190 + p * 40, ty + 60 - p * 70, 24 + k * 8, `rgba(220,230,255,${1 - p})`); } campSleep = sleepers.length; }
    } });
    if (!B6.camp) for (let i = 0; i < seatCount(); i++) { const p = seatXY(i); list.push({ y: p.y - 1, f: () => prop(i % 2 ? 'stump2' : 'stump', p.x, p.y + 14, 52) }); }
    else if (!LIVEC) { const fl = 0.75; /* v49.8: без мерцания */ const g2 = ctx.createRadialGradient(FIRE.x, FIRE.y - 30, 4, FIRE.x, FIRE.y - 30, 120); g2.addColorStop(0, `rgba(255,200,90,${.35 * fl})`); g2.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = g2; ctx.fillRect(FIRE.x - 120, FIRE.y - 150, 240, 240); }
    heroesIn('camp').forEach(h => list.push({ y: ensureRT(h).y, f: () => drawHero(h) }));
    sortDraw(list);
    flushLab();
    const used = S.seats.slice(0, seatCount()).filter(n => n && S.heroes[n]).length;
    const away = S.seats.slice(0, seatCount()).filter(n => n && S.heroes[n] && ensureRT(S.heroes[n]).mode !== 'seat').length;
    // v6.24: счётчики лагеря — одним блоком, списком
    const cl = [[`У костра: ${used - away}/${seatCount()}` + (away ? ` (ещё ${away} в делах)` : ''), '#ffe7b0'], [`Спят в палатке: ${campSleep}`, '#c9d8ff']];
    zoomUI(() => { // v6.33: табличка костра — в экранных координатах
    setFont(26); const cw = Math.max(...cl.map(l => ctx.measureText(l[0]).width)) + 40, cx0 = FIRE.x - cw / 2, cy0 = 196;
    ctx.fillStyle = 'rgba(20,14,10,.62)'; ctx.fillRect(cx0, cy0, cw, 84); ctx.strokeStyle = 'rgba(255,220,160,.35)'; ctx.lineWidth = 2; ctx.strokeRect(cx0, cy0, cw, 84);
    cl.forEach((l, i) => text(l[0], FIRE.x, cy0 + 24 + i * 36, 26, l[1])); });
  }
  let campSleep = 0;
  const PLANT_H = [0, 24, 34, 44, 56]; // v6.22: соразмерно волшебному цветку (70) — раньше росток был больше цветка // ростки и растение: 20–55% роста героя; овощ — около 35%
  function drawBed(i) {
    const p = PLOT_XY[i], nick = PLOTS[i], h = nick && S.heroes[nick];
    const bx = p.x - BED_DX, mx = p.x + BED_DX, y = p.y, BH = 84;
    const b6 = B6.garden ? BEDS6[i] : null; if (B6.garden && !b6) return;
    const BW = b6 ? b6[2] - b6[0] : 0, PX = b6 ? (b6[0] + b6[2]) / 2 - BW * 0.14 : bx, PY = b6 ? (b6[1] + b6[3]) / 2 + 34 : y - 30, PK = b6 ? 1.7 : 1, MX = b6 ? (b6[0] + b6[2]) / 2 + BW * 0.2 : mx; // v8.6: обычное растение и волшебный цветок рядом, оба по центру грядки // v8.6: растение — ровно по центру грядки, крупнее; волшебный цветок — в правом углу
    if (!h) { if (!b6) { drawImg('bed', bx, y, BH, { alpha: 0.5 }); drawImg('bed_magic', mx, y, BH, { alpha: 0.4 }); } return; }
    if (!b6) drawImg('bed', bx, y, BH); // полива нет — waterLevel не учитываем
    const pend = ensureRT(h).harvest;
    if (h.gardenStatus === 1 && !pend) {
      const pr = clamp((now() - h.plantedAt) / G().growSeconds, 0, 1);
      const st = pr < .25 ? 1 : pr < .5 ? 2 : pr < .75 ? 3 : 4;
      drawImg(st === 4 ? 'ripe' : 'stage' + st, PX, PY, Math.round(PLANT_H[st] * PK));
      bar(PX - 50, b6 ? b6[3] - 22 : y + 8, 100, 10, pr, '#7dd35a');
    } else if (h.gardenStatus === 2 || pend) {
      drawImg('ripe', PX, PY, Math.round(PLANT_H[4] * PK));
      for (let k = 0; k < 3; k++) { const a = tm * 2 + k * 2.1 + i; text('✦', PX + Math.cos(a) * 44 * PK, PY - 50 * PK + Math.sin(a * 1.3) * 22, 22, '#fff6a0'); }
      if (!pend) text('!', PX + 52 * PK, PY - 88 * PK, 40, '#ffe27a');
    }
    if (h.bugAttack && !(h._bugDeadline && h._bugDeadline - now() <= 0 && !STANDALONE)) { // v7panel11: таймер истёк, а бот ничего не прислал — «жуки 0с» не показываем
      for (let k = 0; k < 4; k++) { const a = tm * 3 + k * 1.6; drawImg('bug', PX + Math.cos(a) * 38 * PK, PY + 8 + Math.sin(a * 2) * 10, 24, { rot: a }); }
      const left = Math.max(0, h._bugDeadline - now());
      text(`жуки ${Math.ceil(left)}с`, PX, PY - 110 * PK, 22, '#ff8a6a');
      bar(PX - 50, (b6 ? b6[3] - 8 : y + 24), 100, 8, left / bugSec(h), '#ff6a4a');
    }
    const cd = h.magicCooldownUntil - now();
    if (!b6) drawImg('bed_magic', mx, y, BH);
    // v6.22: цветок магии — только если есть волшебные семена и магия не на откате (кд и дневной лимит)
    const dayUsed = h.magicLastDate === today() ? (+h.magicDailyCount || 0) : 0;
    const magicReady = (+h.seedsPrem || 0) > 0 && cd <= 0 && dayUsed < MAGIC_MAX(h);
    if (magicReady) { const MY = b6 ? PY : y - 30; drawImg('magic_flower', MX, MY, b6 ? 80 : 70); for (let k = 0; k < 3; k++) { const a = tm * 1.5 + k * 2.1; text('✦', MX + Math.cos(a) * 46, MY - 40 + Math.sin(a) * 20, 22, '#e2b8ff'); }
    } else if (cd > 0 && (+h.seedsPrem || 0) > 0) bar(MX - 50, b6 ? b6[3] - 8 : y + 8, 100, 10, 1 - cd / MAGIC_CD(), '#b07cff');
    if (!b6) text(nick.length > 14 ? nick.slice(0, 13) + '…' : nick, p.x, y + 40, 22, '#fff2d0');
  }
  function drawRecipeSign() { } // v6.22: рецепты — только по клику на котёл (drawCauldronMenu)
  function drawCauldronMenu(hv) {
    const L = [['Котёл — рецепты (клик ещё раз — закрыть)', '#7a3a12', 26], ['Как приготовить: !готовить <номер> или кнопка «🍲 Готовить»', '#2f5a1a', 22], ['Герой сам придёт к котлу; без номера — лучший доступный рецепт', '#5a3a20', 20]];
    const ah = ACTIVE && S.heroes[ACTIVE];
    if (ah) L.push([`Навыки ${ah.user}: готовка ур.${skill(ah, 'cook').lv}, алхимия ур.${skill(ah, 'alch').lv} · закрытые — затемнены`, '#5a3a20', 20]);
    C.recipes.forEach((r, i) => { const need = Object.entries(r.need).map(([c, n]) => `${(C.crops.find(x => x.id === c) || { name: c }).name} ${n}`).join(', '); const op = recipeOpen(ah, r); L.push([`${i + 1}) ${r.name}${r.kind === 'potion' ? ' (зелье)' : ''}${op && (ah || recipeLv(r) <= 1) ? '' : '  [ур. ' + recipeLv(r) + ' ' + (r.kind === 'potion' ? 'алхимии' : 'готовки') + ']'} — ${need}${r.text ? ' · ' + r.text : ''}`, op || !ah ? '#3a2414' : '#9a8a72', 21]); });
    const w = Math.min(W - 40, Math.max(...L.map(l => measure(l[0], l[2]))) + 48), h = 24 + L.length * 33;
    const x = clamp(hv.ax - w / 2, 20, W - 20 - w), y = clamp(hv.ay - h - 16, 20, 1440 - 20 - h);
    panel(x, y, w, h, '#eadcb8');
    L.forEach(([t, c, s], i) => { let q = t; while (measure(q, s) > w - 40 && q.length > 8) q = q.slice(0, -2); if (q !== t) q += '…'; text(q, x + 24, y + 28 + i * 33, s, c, 'left', 0); });
  }
  // v6.52: котёл Tim + круглые пиксельные пузырьки (оливково-жёлто-зелёные, с бликом) и мягкий пар — только во время готовки
  const CAUL_H = 230, CAUL_PX = 2; // высота спрайта в мире; клетка пузырька = 2 px мира (круг 4–9 клеток)
  const BUBC = {};
  function bubbleCan(d, pop) { // пиксельный круг диаметром d клеток (1 клетка = 1 px канваса, рисуется с nearest)
    const k = d + (pop ? 'p' : ''); if (BUBC[k]) return BUBC[k];
    const c = document.createElement('canvas'); c.width = c.height = d; const x = c.getContext('2d'), r = d / 2;
    for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) { const dx = i + .5 - r, dy = j + .5 - r, q = Math.hypot(dx, dy); if (q > r + (d <= 2 ? .3 : 0)) continue;
      const rim = q > r - 1; if (pop && !rim) continue;
      x.fillStyle = pop ? '#c9c86a' : rim ? '#5b6318' : (dx < 0 && dy < 0 && q > r * .35) ? '#b3b83a' : '#909c2c'; x.fillRect(i, j, 1, 1); }
    if (!pop && d >= 3) { x.fillStyle = '#ece9a6'; const hx = Math.floor(r - r * .5); x.fillRect(hx, hx, 1, 1); if (d >= 7) { x.fillRect(hx + 1, hx, 1, 1); x.fillRect(hx, hx + 1, 1, 1); } }
    return BUBC[k] = c;
  }
  function cauldronBubbles() {
    const cx = CAULDRON.x - 12, top = CAULDRON.y - Math.round(CAUL_H * 0.66), P = CAUL_PX;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    for (let k = 0; k < 3; k++) { // мягкий пар: круглые градиенты, без краёв
      const p = (tm * .18 + k / 3) % 1, sx = cx + Math.sin(tm * .6 + k * 2.1) * 18 + (k - 1) * 22, sy = top - 20 - p * 110, r = 26 + p * 40;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, `rgba(205,210,170,${(.16 * Math.sin(Math.PI * p)).toFixed(3)})`); g.addColorStop(1, 'rgba(205,210,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); }
    for (let k = 0; k < 9; k++) { // пузырьки: поднимаются, в конце лопаются (кольцо)
      const per = 1.6 + (k % 4) * .35, p = ((tm + k * .53) / per) % 1, d = 4 + ((k * 7) % 6), seed = k * 12.9898;
      const bx = cx + Math.sin(seed) * 48 + Math.sin(tm * 1.7 + k) * 6, by = top - p * (70 + (k % 3) * 25);
      const pop = p > .86, can = bubbleCan(pop ? d + 2 : d, pop), s = can.width * P;
      ctx.globalAlpha = (pop ? (1 - p) / .14 * .6 : .8) * Math.min(1, p / .08);
      ctx.drawImage(can, Math.round((bx - s / 2) / P) * P, Math.round((by - s / 2) / P) * P, s, s); }
    ctx.restore();
  }
  // ===== v6.53: живая курица в огороде (гифки Stardew 32×32, ×4 nearest; кадры смотрят ВЛЕВО) =====
  const CHICK_DUR = { // длительности кадров из GIF, мс
    rest: [500, 100, 300, 2000, 300, 100, 500], feed: [200, 100, 100, 100],
    strut: [200, 200, 200, 200], run: [500, 100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 100, 100, 200] };
  const CHK = { x: 0, y: 0, st: 'rest', t: 0, fi: 0, ft: 0, loops: 1, tx: 0, ty: 0, flip: false, last: -1, init: false, draws: 0, lastDraw: null, moved: 0 };
  const chickCfg = () => C.chicken || {};
  function chickZone() { const z = chickCfg().zone || { x: 420, y: 820, w: 300, h: 60 }; return z; }
  function chickPick() { const z = chickZone(); return { x: z.x + Math.random() * z.w, y: z.y + Math.random() * z.h }; }
  function chickSet(st, loops) {
    CHK.st = st; CHK.fi = 0; CHK.ft = 0; CHK.loops = loops || 1;
    if (st === 'strut' || st === 'run') {
      const z = chickZone(); let p;
      for (let i = 0; i < 8; i++) { p = chickPick(); const d = Math.hypot(p.x - CHK.x, p.y - CHK.y); if (st === 'run' ? d > 60 && d < 160 : d > 30 && d < 140) break; }
      CHK.tx = p.x; CHK.ty = p.y; if (Math.abs(p.x - CHK.x) > 2) CHK.flip = p.x > CHK.x; // кадры смотрят влево → вправо зеркалим
    }
  }
  function chickNext() { // случайное поведение: отдых → клюёт 2–4 раза → идёт к новой точке; изредка короткий бег
    const r = Math.random();
    if (CHK.st === 'strut' || CHK.st === 'run') return chickSet(r < 0.6 ? 'feed' : 'rest', r < 0.6 ? 2 + (Math.random() * 3 | 0) : 1);
    if (r < 0.10) return chickSet('run');
    if (r < 0.50) return chickSet('strut');
    if (r < 0.80) return chickSet('feed', 2 + (Math.random() * 3 | 0));
    chickSet('rest', 1);
  }
  function chickStep(dt) { // dt-анимация (не от FPS)
    if (!CHK.init) { const z = chickZone(); CHK.x = z.x + z.w * 0.3; CHK.y = z.y + z.h * 0.5; CHK.init = true; chickSet('rest', 1); }
    dt = Math.min(0.25, Math.max(0, dt));
    const dur = CHICK_DUR[CHK.st];
    CHK.ft += dt * 1000;
    while (CHK.ft >= dur[CHK.fi]) {
      CHK.ft -= dur[CHK.fi]; CHK.fi++;
      if (CHK.fi >= dur.length) {
        CHK.fi = 0;
        if (CHK.st === 'strut' || CHK.st === 'run') continue; // идёт, пока не дойдёт
        if (--CHK.loops <= 0) { chickNext(); return; }
      }
    }
    if (CHK.st === 'strut' || (CHK.st === 'run' && CHK.fi >= 1 && CHK.fi <= 12)) { // бег: 0-й кадр — замах, потом рывок
      const sp = CHK.st === 'run' ? 170 : 34, dx = CHK.tx - CHK.x, dy = CHK.ty - CHK.y, d = Math.hypot(dx, dy), s = sp * dt;
      if (d <= s) { CHK.x = CHK.tx; CHK.y = CHK.ty; CHK.moved += d; if (CHK.st === 'strut' || CHK.fi >= 2) chickNext(); }
      else { CHK.x += dx / d * s; CHK.y += dy / d * s; CHK.moved += s; }
    }
    const z = chickZone(); CHK.x = clamp(CHK.x, z.x, z.x + z.w); CHK.y = clamp(CHK.y, z.y, z.y + z.h);
  }
  function drawChicken() {
    const cf = chickCfg(); const v = cf.variant === 'white' ? 'white' : 'light_brown', h = +cf.scale || 128;
    const key = 'chicken_' + v + '_' + CHK.st, x = Math.round(CHK.x), y = Math.round(CHK.y); // целые пиксели — без дрожи
    drawImg(key, x, y + Math.round(h * 2 / 32), h, { frame: CHK.fi, flip: CHK.flip }); // в кадре 2px пустоты под лапами
    CHK.draws++; CHK.lastDraw = { x, y, st: CHK.st, fi: CHK.fi, flip: CHK.flip, loc: 'garden' };
  }
  function sceneGarden() {
    const list = [];
    if (chickCfg().enabled) { if (CHK.last >= 0) chickStep(tm - CHK.last); CHK.last = tm; list.push({ y: Math.round(CHK.y), f: drawChicken }); }
    for (let i = 0; i < PLOT_XY.length; i++) list.push({ y: PLOT_XY[i].y - 20, f: () => drawBed(i) });
    list.push({ y: SHED.y, f: () => building('shed', 'shed', SHED.x, SHED.y, 240, null, { x: SHED.x - 90, y: SHED.y + 4 }) });
    list.push({ y: CAULDRON.y, f: () => {
      if (!(B6.garden && C.gardenCauldronSprite !== true)) prop('cauldron', CAULDRON.x, CAULDRON.y, CAUL_H); // locations_v1: котёл уже на фоне — спрайт не рисуем (вернуть: CONFIG.gardenCauldronSprite = true) // v6.52: спрайт Tim (огонь и пар уже нарисованы), nearest
      HOVER.push({ id: 'cauldron', x: CAULDRON.x - 100, y: CAULDRON.y - CAUL_H, w: 200, h: CAUL_H + 10, loc: 'garden', ax: CAULDRON.x, ay: CAULDRON.y - CAUL_H });
      if (S.cooking.some(j => j.started)) cauldronBubbles();
    } });
    heroesIn('garden').forEach(h => list.push({ y: ensureRT(h).y, f: () => drawHero(h) }));
    sortDraw(list);
    flushLab();
    // полосы готовки над поварами
    S.cooking.forEach(j => { const h = S.heroes[j.user]; if (!h || !j.started) return; const rt = ensureRT(h), r = recipeById(j.id); const y = rt.y - heroH(rt) - 46; bar(rt.x - 50, y, 100, 12, 1 - j.left / j.need, '#9fe07a'); drawImg(r.icon, rt.x - 72, y + 18, 30); });
    drawRecipeSign();
    zoomUI(() => { // v6.22: сверху по центру — только «Топ фермеров»
    const top = S.order.map(n => S.heroes[n]).map(h => ({ n: h.user, s: h.rpg_harvests || 0 })).filter(t => t.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
    const t2 = top.length ? top.map((t, i) => `${i + 1}. ${t.n.slice(0, 12)} — ${t.s}`).join('   ') : 'пока пусто — соберите первый урожай';
    const pw = Math.max(measure('Топ фермеров', 28), measure(t2, 22)) + 60;
    if (viewLoc() === 'garden') TOP6.push([Math.round(W / 2 - pw / 2), 36, Math.round(W / 2 + pw / 2), 124, 'topfarm']); // v6.36: место «Топ фермеров» для менеджера (zoomUI рисует в экранных координатах)
    panel(W / 2 - pw / 2, 36, pw, 88, '#eadcb8');
    text('Топ фермеров', W / 2, 62, 28, '#5a3412', 'center', 0);
    text(t2, W / 2, 98, 22, '#4a2e18', 'center', 0); });
    if (S.global.farmDecree === 'decree-double') drawImg('fairy', 1500 + Math.cos(tm * .7) * 500, 560 + Math.sin(tm * 1.3) * 30, 90, { flip: Math.sin(tm * .7) > 0 });
  }
  // v6.22: нарисованный указатель-стрелка к логову босса: чудище + знаки «опасно» (пиксели 4px, без внешних ассетов)
  function drawBossSignpost(x, y) {
    const P = 4, r = (c, X, Y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + X * P), Math.round(y + Y * P), w * P, h * P); };
    // столб
    r('#1e120a', -5, -70, 10, 70); r('#5a3a22', -4, -70, 8, 70); r('#734b2c', -4, -70, 3, 70); r('#3e2716', 2, -70, 2, 70);
    r('#1e120a', -8, -2, 16, 2); r('#2f3a1c', -10, 0, 20, 2);
    // доска-стрелка вправо
    const by = -84, bh = 30, bx = -42, bw = 72;
    r('#1e120a', bx - 1, by - 1, bw + 2, bh + 2);
    for (let i = 0; i <= bh / 2 + 1; i++) { r('#1e120a', bx + bw + i - 1, by - 1 + i, 1, bh + 2 - 2 * i); }
    r('#8a5a32', bx, by, bw, bh); for (let i = 0; i < bh / 2; i++) r('#8a5a32', bx + bw + i - 1, by + i, 1, bh - 2 * i);
    r('#a16c3e', bx, by, bw, 3); r('#6b4224', bx, by + bh - 3, bw, 3); r('#6b4224', bx, by + 10, bw, 1); r('#6b4224', bx, by + 20, bw, 1);
    r('#c9c2b0', bx + 3, by + 3, 2, 2); r('#c9c2b0', bx + bw - 6, by + 3, 2, 2); r('#c9c2b0', bx + 3, by + bh - 5, 2, 2);
    // чудище (v6.23 — страшнее): длинные изогнутые рога, тёмная морда, косые горящие глаза, пасть с рваными клыками, кровь
    const mx = bx + 28, my = by + 3;
    [[-9,-3,2,5],[-11,-6,2,4],[-12,-9,2,4],[-11,-11,2,2],[15,-3,2,5],[17,-6,2,4],[18,-9,2,4],[17,-11,2,2]].forEach(([X,Y,w,h]) => r('#e8dcc4', mx + X, my + Y, w, h));
    r('#8a7a62', mx - 9, my - 1, 2, 2); r('#8a7a62', mx + 15, my - 1, 2, 2);
    r('#120808', mx - 8, my - 1, 24, 25); r('#2a1424', mx - 7, my, 22, 23); r('#3c1c30', mx - 6, my + 1, 20, 10); r('#120808', mx - 9, my + 7, 26, 9);
    r('#120808', mx - 5, my + 5, 8, 2); r('#120808', mx + 5, my + 5, 8, 2); // нахмуренные брови
    r('#ff2a1a', mx - 4, my + 7, 5, 2); r('#ff2a1a', mx - 3, my + 9, 3, 1); r('#ff2a1a', mx + 7, my + 7, 5, 2); r('#ff2a1a', mx + 8, my + 9, 3, 1);
    r('#fff2a0', mx - 2, my + 7, 1, 1); r('#fff2a0', mx + 9, my + 7, 1, 1);
    r('#120808', mx + 3, my + 11, 2, 2); // ноздри
    r('#3a0606', mx - 5, my + 14, 18, 8); r('#7a0e0e', mx - 4, my + 17, 16, 3);
    for (let k = 0; k < 6; k++) { r('#f4efe2', mx - 5 + k * 3, my + 14, 2, k % 2 ? 2 : 3); r('#f4efe2', mx - 4 + k * 3, my + 20, 2, k % 2 ? 2 : 1); }
    r('#f4efe2', mx - 5, my + 14, 1, 5); r('#f4efe2', mx + 12, my + 14, 1, 5); // клыки по краям
    r('#b01010', mx - 2, my + 22, 1, 3); r('#b01010', mx + 7, my + 22, 1, 4); r('#b01010', mx + 7, my + 26, 1, 1);
    // следы когтей на доске
    for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) r('#3e2414', bx + 3 + k * 3 + j, by + 19 + j * 2, 1, 2);
    // знаки «опасно»: два жёлтых треугольника с «!»
    const tri = (tx, ty) => { for (let i = 0; i < 8; i++) { r('#1e120a', tx - i - 1, ty + i, 2 * i + 3, 1); } for (let i = 0; i < 7; i++) r('#ffcc33', tx - i, ty + i + 1, 2 * i + 1, 1); r('#1e120a', tx, ty + 3, 1, 3); r('#1e120a', tx, ty + 7, 1, 1); };
    tri(bx + 7, by + 8); tri(bx + 57, by + 8);
    // табличка ниже: череп + «ЛОГОВО»
    r('#1e120a', -27, -50, 54, 16); r('#6b4224', -26, -49, 52, 14); r('#8a5a32', -26, -49, 52, 2);
    ctx.save(); text('ЛОГОВО →', x + 4, y - 168, 22, '#ffe2a8', 'center', 0); ctx.restore();
    // сухие травинки у основания
    r('#4a5a28', -12, -4, 1, 4); r('#4a5a28', 10, -5, 1, 5); r('#5c6c30', 12, -3, 1, 3);
  }
  function sceneForest() {
    const list = [], sp = SPOT('forest', 'sign');
    list.push({ y: sp.y - 60, f: () => { // указатель к арене босса (локация 5)
      // locations_final: табличка нарисована на forest.png (как котёл на огороде) — спрайт sign_lair48 не рисуем.
      // SH — высота от основания SPOT до верха доски; таймер строго НАД табличкой. «ЛОГОВО →» не дублируем (череп на фоне).
      // locations_final: верх доски по макету y=412 (SPOT [2010,980]); SH=568. Низ таймера ≤390, зазор над доской.
      const SH = (C.forestSign && +C.forestSign.h) || 568; // sp.y - SH = 412
      const boardTop = sp.y - SH; // 412
      const timerH = 36, gap = 22; // низ плашки = 390
      const timerBottom = boardTop - gap; // 390
      const timerTop = timerBottom - timerH; // 354
      if (C.forestSignSprite === true) { const sim = IMG.sign_lair48, sw = sim && sim.height ? Math.round(SH * sim.width / sim.height) : 290; if (sim && sim.width) { ctx.save(); ctx.imageSmoothingEnabled = false; shadow(sp.x, sp.y - 2, 70); ctx.drawImage(sim, Math.round(sp.x - sw / 2), Math.round(sp.y - SH), sw, SH); ctx.restore(); } }
      // hotspot = вся доска-стрелка + столб (не только ножка); подход SPOT остаётся у основания
      HOVER.push({ id: 'boss_sign', x: sp.x - 180, y: boardTop - 4, w: 420, h: (sp.y - boardTop) + 24, loc: 'forest', ax: sp.x, ay: boardTop, go: 'boss' }); // вся доска-стрелка + столб
      const b = S.boss; const t = !b ? 'ждёт стрим' : b.phase === 'wait' ? 'через ' + fmtTime(b.spawnAt - now()) : b.phase === 'signup' ? 'запись: !босс' : b.phase === 'fight' ? 'идёт бой!' : 'был сегодня';
      const tw = measure(t, 24) + 28; darkPlate(sp.x - tw / 2, timerTop, tw, timerH); text(t, sp.x, timerTop + 18, 24, '#ffd27a', 'center', 0);
    } });
    heroesIn('forest').forEach(h => list.push({ y: ensureRT(h).y, f: () => drawHero(h) }));
    const monSeen = new Set(); BATTLES.forEach(bt => { if (bt.mon && !monSeen.has(bt.mon) && S.heroes[bt.user] && ensureRT(S.heroes[bt.user]).loc === 'forest') { monSeen.add(bt.mon); list.push({ y: bt.mon.y, f: () => drawMonster(bt) }); } }); // v6.57b: общий моб рисуется один раз
    sortDraw(list);
    if (!BATTLES.length && !bossActive() && !B6.forest && !(window.LIVE6 && LIVE6.has('forest'))) text('В лесу тихо… (!поход — отправить героя)', 1500, 300, 30, '#e8d6b0'); // v8.7: на новом фоне надпись не нужна
  }
  // v6.45: карточки заданий на нарисованной доске нового фона города (доска — мир [700,640]-[1150,885])
  const BOARD6 = { x0: 965, y0: 505, x1: 1285, y1: 725 }; // locations_v1: доска нового города // v6.46: внутри деревянной рамки (рамка ≈705–1125 × 700–880) с отступами ~18px
  // v6.55: принятые квесты — свитки, приколотые к доске; клик открывает/закрывает свиток (полный текст, награда, прогресс)
  const SCROLL6 = []; let QOPEN = null;
  function questRewardText(q) { const ns = RARE_LOOT() && /^(plant|harvest|magic)$/.test(q.type); return [q.gold ? `+${q.gold} золота` : '', q.xp ? `+${q.xp} опыта` : '', q.seeds && !ns ? `+${q.seeds} сем.` : '', q.magicSeeds && !ns ? `+${q.magicSeeds} волш. сем.` : ''].filter(Boolean).join(', '); }
  // v8.7: на новом фоне доска чистая — задания целиком открываются по клику на доску (QBOARD)
  let QBOARD = false, QBOX = null; const BOARD7 = { x0: 900, y0: 420, x1: 1240, y1: 640 };
  function wrapW(t, size, maxW) { setFont(size); const out = []; let cur = ''; String(t).split(' ').forEach(w => { const tr = cur ? cur + ' ' + w : w; if (ctx.measureText(tr).width > maxW && cur) { out.push(cur); cur = w; } else cur = tr; }); if (cur) out.push(cur); return out; }
  function drawQuestBoardPopup() {
    QBOX = null; QBOARD = !!(MENU && MENU.id === 'board' && MENU.loc === 'town'); if (!QBOARD || CAM.loc !== 'town') return; // v8.7: клик по доске — меню улучшений И все задания
    const act = S.order.map(n => S.heroes[n]).filter(h => h && h.rpg_quest && questById(h.rpg_quest.id)).slice(0, 8);
    const PW = 820, X = 60, rows = act.map(h => { const q = questById(h.rpg_quest.id); return { h, q, lines: wrapW(`${DN(h)} — ${q.text}`, 22, PW - 190), rew: questRewardText(q) }; });
    const PH = 80 + (rows.length ? rows.reduce((a, r) => a + r.lines.length * 28 + 34, 0) : 40) + 30, Y = Math.max(20, Math.min(450, H - 120 - PH));
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(X + 8, Y + 10, PW, PH);
    ctx.fillStyle = '#f6e6bb'; ctx.fillRect(X, Y, PW, PH); ctx.fillStyle = '#6a4220'; ctx.fillRect(X - 10, Y - 12, PW + 20, 18); ctx.fillRect(X - 10, Y + PH - 6, PW + 20, 18);
    ctx.fillStyle = '#9a6a38'; ctx.fillRect(X - 10, Y - 8, PW + 20, 4); ctx.fillRect(X - 10, Y + PH - 2, PW + 20, 4);
    text('Доска заданий', X + PW / 2, Y + 34, 28, '#5a3412', 'center', 0);
    let y = Y + 78;
    if (!rows.length) text('Заданий пока нет — !квест, чтобы взять', X + PW / 2, y + 6, 22, '#4a2e18', 'center', 0);
    rows.forEach(r => { r.lines.forEach((l, k) => text(l, X + 30, y + k * 28, 22, '#3a2414', 'left', 0));
      text(`${r.h.rpg_quest.prog}/${r.q.need}`, X + PW - 30, y, 24, '#8a3a12', 'right', 0);
      text('Награда: ' + r.rew, X + 30, y + r.lines.length * 28 - 2, 18, '#8a5a2a', 'left', 0);
      y += r.lines.length * 28 + 34; ctx.fillStyle = 'rgba(106,66,32,.25)'; ctx.fillRect(X + 24, y - 22, PW - 48, 2); });
    text('клик по доске ещё раз — закрыть', X + PW / 2, Y + PH - 18, 16, '#8a6a4a', 'center', 0);
    QBOX = { x: X - 10, y: Y - 12, w: PW + 20, h: PH + 24 }; PANELS6.push([QBOX.x, QBOX.y, QBOX.x + QBOX.w, QBOX.y + QBOX.h]); // меню улучшений встанет рядом, не поверх
  }
  function drawBoard6() {
    if (B6.town) { SCROLL6.length = 0; QOPEN = null; return; }
    const act = S.order.map(n => S.heroes[n]).filter(h => h && h.rpg_quest && questById(h.rpg_quest.id)).slice(0, 4);
    const B = BOARD6, cw = B.x1 - B.x0; SCROLL6.length = 0;
    if (QOPEN && !act.some(h => h.user === QOPEN)) QOPEN = null;
    if (!act.length) { const cy = B.y0 + 60; ctx.fillStyle = 'rgba(242,227,189,.93)'; ctx.fillRect(B.x0 + 20, cy - 34, cw - 40, 92); ctx.fillStyle = '#8a3a12'; ctx.fillRect(B.x0 + cw / 2 - 5, cy - 40, 10, 10);
      text('Доска заданий', B.x0 + cw / 2, cy - 6, 26, '#5a3412', 'center', 0); text('!квест — взять задание', B.x0 + cw / 2, cy + 30, 21, '#4a2e18', 'center', 0); return; }
    const ch = Math.min(44, Math.floor((B.y1 - B.y0) / act.length) - 6);
    act.forEach((h, i) => { const q = questById(h.rpg_quest.id), y = B.y0 + 4 + i * (ch + 6), x0 = B.x0 + 14, x1 = B.x1 - 14, on = QOPEN === h.user;
      // свёрнутый свиток: пергамент + деревянные валики по краям + красная кнопка
      ctx.fillStyle = on ? '#fff3cf' : '#efdcae'; ctx.fillRect(x0, y + 4, x1 - x0, ch - 8);
      ctx.fillStyle = '#c9a66a'; ctx.fillRect(x0, y + ch - 8, x1 - x0, 3);
      ctx.fillStyle = '#6a4220'; ctx.fillRect(x0 - 10, y, 12, ch); ctx.fillRect(x1 - 2, y, 12, ch);
      ctx.fillStyle = '#9a6a38'; ctx.fillRect(x0 - 8, y + 2, 4, ch - 4); ctx.fillRect(x1, y + 2, 4, ch - 4);
      ctx.fillStyle = '#b22a1a'; ctx.fillRect(x0 + (x1 - x0) / 2 - 5, y - 2, 10, 10); ctx.fillStyle = '#ff6a50'; ctx.fillRect(x0 + (x1 - x0) / 2 - 3, y, 4, 4);
      setFont(20); let t = `${DN(h)} — ${q.text}`; while (ctx.measureText(t).width > x1 - x0 - 90 && t.length > 8) t = t.slice(0, -2) + '…';
      text(t, x0 + 10, y + ch / 2, 20, '#4a2e18', 'left', 0); text(`${h.rpg_quest.prog}/${q.need}`, x1 - 8, y + ch / 2, 20, '#8a3a12', 'right', 0);
      SCROLL6.push({ user: h.user, x: x0 - 10, y, w: x1 - x0 + 20, h: ch }); });
    const oh = QOPEN && S.heroes[QOPEN]; if (!oh) return;
    setFont(20); const q = questById(oh.rpg_quest.id), lines = wrap(q.text, 30), W = Math.max(460, Math.ceil(ctx.measureText(`Награда: ${questRewardText(q)}`).width) + 60), H = 150 + lines.length * 30, X = B.x0 + cw / 2 - W / 2, Y = B.y0 - H - 16;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(X + 6, Y + 8, W, H);
    ctx.fillStyle = '#f6e6bb'; ctx.fillRect(X, Y, W, H); ctx.fillStyle = '#6a4220'; ctx.fillRect(X - 8, Y - 10, W + 16, 16); ctx.fillRect(X - 8, Y + H - 6, W + 16, 16);
    ctx.fillStyle = '#9a6a38'; ctx.fillRect(X - 8, Y - 6, W + 16, 4); ctx.fillRect(X - 8, Y + H - 2, W + 16, 4);
    text(`Задание: ${DN(oh)}`, X + W / 2, Y + 30, 24, '#5a3412', 'center', 0);
    lines.forEach((l, k) => text(l, X + W / 2, Y + 66 + k * 30, 22, '#3a2414', 'center', 0));
    const py = Y + 66 + lines.length * 30;
    text(`Награда: ${questRewardText(q)}`, X + W / 2, py + 4, 20, '#8a3a12', 'center', 0);
    bar(X + 40, py + 26, W - 80, 14, Math.min(1, oh.rpg_quest.prog / q.need), '#7dd87d');
    text(`${oh.rpg_quest.prog} / ${q.need}`, X + W / 2, py + 56, 20, '#4a2e18', 'center', 0);
    SCROLL6.push({ user: oh.user, x: X - 8, y: Y - 10, w: W + 16, h: H + 26, open: true });
  }
  function scrollClick(p) {
    if (CAM.loc !== 'town') return false;
    if (B6.town) { // v8.7: клик по доске — открыть/закрыть все задания целиком
      return false; // задания открываются вместе с меню доски (menuClick)
    }
    if (!SCROLL6.length) return false;
    if (ZVIEW && ZOOM > 1) { const z = ZC; ZC = ZVIEW; const [x, y] = zs2w(p.x, p.y); ZC = z; p = { x, y }; }
    const s = SCROLL6.slice().reverse().find(s => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h);
    if (!s) return false; QOPEN = QOPEN === s.user ? null : s.user; return true;
  }
  function sceneTown() {
    const list = [];
    list.push({ y: TOWN.guild.y, f: () => building('guild', 'guild_hall', TOWN.guild.x, TOWN.guild.y, 380) });
    list.push({ y: TOWN.blacksmith.y, f: () => building('blacksmith', 'blacksmith', TOWN.blacksmith.x, TOWN.blacksmith.y, 320) });
    list.push({ y: TOWN.board.y, f: () => building('board', 'notice_board', TOWN.board.x, TOWN.board.y, 210) });
    list.push({ y: TOWN.market.y, f: () => building('market', 'market_stall', TOWN.market.x, TOWN.market.y, 220) });
    if (B6.town) list.push({ y: 999, f: drawBoard6 });
    heroesIn('town').forEach(h => list.push({ y: ensureRT(h).y, f: () => drawHero(h) }));
    sortDraw(list);
    heroesIn('town').forEach(h => zoomAt(ensureRT(h), () => drawQuestPlaque(h))); // v6.29 плашка предложений квестов
    flushLab();
    zoomUI(() => { // v6.33: вывески — в экранных координатах
    // вывеска гильдий у дома гильдий: недельные очки + трофей
    weekTick();
    const GC = guildCounts(null, true), GA = guildCounts(), rows = C.guilds.map((g, gi) => ({ g, gi, d: S.weekly[g.id] || 0, n: GC[g.id], a: GA[g.id], pa: Math.round(perActive(g.id, S.weekly[g.id] || 0, GA)) })).sort((a, c) => (PER_ON() ? c.pa - a.pa : 0) || c.d - a.d); // v8.7: место — по очкам на активного // v6.55 п.7: тот же счёт, что у бота
    const UD = underdogGuilds(), UDB = Math.round((GB.underdogBonus || 0) * 100), gx = 470, gy = 112, gw = 980, HDR = PER_ON() ? 26 : 0, RH = G9ON() ? 62 : 38 /* v9: строка гильдии + ГМ/бафф/казна */, gh = 64 + HDR + rows.length * RH + (trophyActive() ? 40 : 0) + (UDB ? 36 : 0); PANELS6.push([gx, gy, gx + gw, gy + gh]);
    panel(gx, gy, gw, gh, '#f2e3bd');
    text('Гильдии — очки за эту неделю', gx + gw / 2, gy + 26, 26, '#5a3412', 'center', 0);
    if (HDR) { text('за неделю', gx + gw - 190, gy + 58, 17, '#8a6a4a', 'right', 0); text('на игрока', gx + gw - 30, gy + 58, 17, '#8a6a4a', 'right', 0); } // v8.7: подписи колонок
    rows.forEach((r, i) => {
      const y = gy + 72 + HDR + i * RH;
      ctx.fillStyle = '#1e120a'; ctx.fillRect(gx + 18, y - 13, 26, 26); ctx.fillStyle = r.g.color; ctx.fillRect(gx + 21, y - 10, 20, 20);
      text(`${r.gi + 1}. ${r.g.name}`, gx + 56, y, 22, '#4a2e18', 'left', 0); // v6.55 п.6: номер для вступления (1–4), а не место
      text(`!гильдия ${r.gi + 1}`, gx + 300, y, 20, '#8a3a12', 'left', 0);
      text(GACTD() ? guildActTxt(r.a, r.n) : `${r.n} ${plural(r.n, 'человек', 'человека', 'человек')}`, gx + gw - (PER_ON() ? 330 : 140), y, 22, '#7a5a3a', 'right', 0); // v49.10: колонки не наезжают
      if (PER_ON()) { text(String(r.d), gx + gw - 190, y, 21, '#7a5a3a', 'right', 0); text(String(r.pa), gx + gw - 30, y, 24, '#4a2e18', 'right', 0); } else text(String(r.d), gx + gw - 20, y, 22, '#4a2e18', 'right', 0);
      if (G9ON()) { // v9: под строкой гильдии — гильд-мастер, бафф, казна
        const gm = g9Gm(r.g.id), bf = g9Buff(r.g.id), y2 = y + 25; let x2 = gx + 56;
        const ic = (k, x) => { const im = IMG[k]; if (im && im.width && !isPH(k)) ctx.drawImage(im, x, y2 - 11, 22, 22); };
        ic('g9_crown', x2); text(gm.user ? `ГМ: ${DN(S.heroes[gm.user])}` : 'ГМ не выбран — !голос <ник>', x2 + 28, y2, 17, gm.user ? '#6a3a12' : '#9a7a5a', 'left', 0); x2 += 28 + measure(gm.user ? `ГМ: ${DN(S.heroes[gm.user])}` : 'ГМ не выбран — !голос <ник>', 17) + 24;
        if (bf) { ic('g9_' + bf.icon, x2); text(bf.name, x2 + 28, y2, 17, '#2e5a18', 'left', 0); x2 += 28 + measure(bf.name, 17) + 24; }
        { const tb = `казна ${+(g9S().bank[r.g.id]) || 0} з`; ic('g9_bank', gx + gw - 30 - measure(tb, 17) - 28); text(tb, gx + gw - 30, y2, 17, '#7a5a3a', 'right', 0); }
      }
    });
    if (UDB) text(UD.length ? `Слабая гильдия: ${UD.map(g => g.name).join(', ')} — +${UDB}% золота и опыта${(GB.smallJoinGold == null ? 200 : +GB.smallJoinGold) > 0 ? `, вступившим +${GB.smallJoinGold == null ? 200 : +GB.smallJoinGold} з` : ''}` : `Бонус слабой гильдии +${UDB}%: сейчас нет — очки гильдий близки`, gx + gw / 2, gy + gh - (trophyActive() ? 58 : 22), 21, UD.length ? '#1f5a8a' : '#7a5a3a', 'center', 0); // v8.7
    if (trophyActive()) {
      const tg = guildById(S.trophy.guild);
      text(`Трофей за босса: ${tg ? tg.name : '?'} — +${Math.round(C.trophy.goldXpBonus * 100)}% золота и опыта до ${new Date(S.trophy.until).toLocaleDateString('ru-RU')}`, gx + gw / 2, gy + gh - 22, 22, '#8a3a12', 'center', 0);
      if (C.trophy.showBanner && tg && !B6.town) zoomWorld(() => { // v8.7: на новом фоне не рисуем (плохо смотрелись) // знамя победителя у дома гильдий
        const bk = window.Assets.tinted('banner_guild', tg.color);
        drawImg(bk, TOWN.guild.x + 250, TOWN.guild.y - 10, 170, { rot: Math.sin(tm * 1.5) * 0.03 });
        drawImg('trophy_boss', TOWN.guild.x - 250, TOWN.guild.y - 10, 90);
      });
    }
    // Зал славы (доска в городе)
    const fm = S.fame.slice(0, C.hallOfFame.boardSize);
    const fx = 1880, fy = 112, fw = 660, FL = fm.map(f => wrapW(f.text, 20, fw - 30).slice(0, 2)), fh = 46 + Math.max(1, FL.reduce((a, l) => a + l.length, 0)) * 26 + 8; // v8.7: шире, текст переносится, а не обрезается // табличка на стене (фон), вне дорожек и построек
    PANELS6.push([fx, fy, fx + fw, fy + fh]);
    ctx.fillStyle = '#3a2614'; ctx.fillRect(fx + 60, fy - 14, 8, 16); ctx.fillRect(fx + fw - 68, fy - 14, 8, 16);
    panel(fx, fy, fw, fh, '#d9c08e');
    text('Зал славы', fx + fw / 2, fy + 20, 22, '#5a3412', 'center', 0);
    if (!fm.length) text('пока пусто', fx + fw / 2, fy + 58, 22, '#7a5a3a', 'center', 0);
    { let ly = fy + 50; FL.forEach(ls => ls.forEach((t, k) => { text(t, fx + 15 + (k ? 18 : 0), ly, 20, '#3a2414', 'left', 0); ly += 26; })); }
    drawQuestBoardPopup();
    });
  }
  // ===================== ЛОКАЦИЯ «БОСС» =====================
  const ROLE_RU = { tank: 'танк', healer: 'лекарь', dps: 'боец', reserve: 'запас' };
  function bossNeeds() { // что не хватает отрядам: «нужен танк!» (v6.55 п.9: по отрядам, с указанием какому)
    const b = S.boss; if (!b || !bossActive()) return [];
    const rows = []; // [guild, needs[]]
    if (b.phase === 'fight') { if (BF) BF.squads.forEach(Sq => rows.push([Sq.guild, [Sq.hasTank ? '' : 'танк', Sq.hasHeal ? '' : 'лекарь'].filter(Boolean)])); else (b.need || []).forEach(n => rows.push(['', n])); }
    else { const P = plan(b.signup); P.squads.forEach(s => rows.push([s.guild, s.need])); if (!P.squads.length) rows.push(['', ['танк', 'лекарь', 'бойцы ×3']]); }
    const who = r => rows.filter(x => x[1].some(r)).map(x => x[0]), tag = gs => rows.length > 1 && gs.length && gs.length < rows.length ? ` (${gs.map(g => guildShort(g || '_solo')).join(', ')})` : '';
    const out = [], t = who(n => n === 'танк'), l = who(n => n === 'лекарь');
    if (t.length) out.push('нужен танк!' + tag(t)); if (l.length) out.push('нужен лекарь!' + tag(l)); if (rows.some(x => x[1].some(n => n.startsWith('бойцы')))) out.push('нужны ДД');
    return out;
  }
  function bossRosterLines() {
    const b = S.boss; if (!b) return [];
    const by = { tank: [], healer: [], dps: [], reserve: [] };
    const spots = formationSpots(); for (const n of b.signup) { const p = spots[n]; if (p) by[p.role].push(n); }
    const fit = (arr, max) => { let t = arr.slice(0, max).map(n => n.length > 11 ? n.slice(0, 10) + '…' : n).join(', '); if (arr.length > max) t += ` +${arr.length - max}`; return t || '—'; };
    return [[`Танки (${by.tank.length}): ${fit(by.tank, 4)}`, '#ffb08a'], [`Лекари (${by.healer.length}): ${fit(by.healer, 4)}`, '#a8f0b8'], [`Бойцы (${by.dps.length}): ${fit(by.dps, 3)}`, '#f0e0c0'], [`Запас (${by.reserve.length}): ${fit(by.reserve, 3)}`, '#b8b0c8']];
  }
  function drawSkull(x, y, s, col) { // череп из прямоугольников (s — размер пикселя)
    const M = ['.XXXX.', 'XXXXXX', 'X..X..', 'XXXXXX', '.XXXX.', '.X.X..'];
    ctx.fillStyle = col; M.forEach((r, j) => [...r].forEach((c, i) => { if (c === 'X') ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), s, s); }));
    ctx.fillStyle = col; ctx.fillRect(Math.round(x + 4 * s), Math.round(y + 2 * s), s, s); ctx.fillRect(Math.round(x + 4 * s), Math.round(y + 5 * s), s, s);
  }
  function castBar(cx, y, w, b, compact) {
    const c = b.cast; if (!c) return 0;
    const x = Math.round(cx - w / 2), h = compact ? 22 : 30;
    ctx.fillStyle = '#0e0a12'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    c.order.forEach((k, i) => { ctx.fillStyle = BC.WIN[k].color; ctx.globalAlpha = c.win === k ? 1 : 0.45; ctx.fillRect(x + Math.round(i * w / 3), y, Math.round(w / 3) - 2, h); });
    ctx.globalAlpha = 1; const mx = x + Math.round(w * clamp(c.p, 0, 1));
    ctx.fillStyle = '#fff'; ctx.fillRect(mx - 3, y - 8, 6, h + 16);
    const W0 = BC.WIN[c.win], A = BC.CC[W0.need];
    text(`${b.castName || BE.cast.name}${c.slow ? ' (замедлено)' : ''}: ${W0.name} → ${A.cmd}`, cx, y + h + (compact ? 20 : 26), compact ? 22 : 28, W0.color);
    return h + (compact ? 34 : 44);
  }
  // v6.26: босс смотрит на основную группу (бойцы/танк/лекари перед ним), ассасины за спиной не считаются.
  // v6.44: ogre/treant/queen_boss.png нарисованы лицом влево → flip=true только если группа справа.
  // v7panel20 п.9: все боссы просто отзеркалены (без поворота) — голова влево, к героям. Ключи — спрайты, нарисованные лицом вправо/анфас.
  const BOSS_MIRROR = k => ['ogre_boss', 'troll_boss', 'queen_boss'].includes(k || 'ogre_boss'); // v49.5: трент почти анфас — не зеркалим
  function bossFaceRight(bp) {
    let sx = 0, n = 0;
    (S.boss && S.boss.signup || []).forEach(u => { const rt = RT[u]; if (!rt || rt.loc !== 'boss' || rt.ghost || (rt.formation && rt.formation.behind)) return; const tx = rt.formation ? rt.formation.x : rt.x; sx += tx; n++; });
    return n ? sx / n > bp.x : false;
  }
  // ===================== v48: РОЙ КОРОЛЕВЫ-МАТКИ (картинка) =====================
  // v49.5: Король Трентов — корни под опутанными, ростки (лечат босса), пни, столб лечения. Данные — BF.tr (TRT).
  const TRHEAL = [];
  function trSpot(i) { const a = lairCfg(lairKey()).sprouts || LAIRS_DEF.boss_treant.sprouts; return a[i % a.length]; }
  function trentList(list, bp) {
    const Wt = BF && BF.tr; if (!Wt) return; const R = Wt.X.R, P = Wt.X.P;
    for (const id of Wt.roots) { const u = BF.all[id]; if (!TRT.rooted(BF, u)) continue; const h = S.heroes[id], rt = h && RT[h.user]; if (!rt || rt.loc !== 'boss') continue;
      const left = u.rootUntil - BF.t, age = Math.max(0, R.rootSec - left), x = rt.x, y = rt.y, hh = heroH(rt);
      const fr = age < 0.45 ? 1 + Math.min(3, Math.floor(age / 0.15)) : left < 0.7 ? (left < 0.35 ? 6 : 5) : 4 - (Math.floor(tm * 2.5) % 2);
      // v49.10: полные корни ≈ 50% роста героя (ноги и пояс), впереди у ступней; кадры роста/спада масштабируются от полного кадра, лицо и руки открыты
      const im = IMG['t_roots_' + fr], im4 = IMG['t_roots_4'];
      const nat = (im && (im.naturalHeight || im.height)) || [0, 91, 133, 179, 205, 159, 109][fr] || 205;
      const base = (im4 && (im4.naturalHeight || im4.height)) || 205;
      const full = Math.round(hh * 0.55 / 2) * 2, rh = Math.max(16, Math.round(full * nat / base / 2) * 2);
      list.push({ y: y + 2, f: () => drawImg('t_roots_' + fr, x, y + 6, rh, {}) }); }
    for (const sp of Wt.sprouts) { if (sp.gone) continue; const p = trSpot(sp.i), x = p[0], y = p[1];
      if (sp.st === 'stump') { list.push({ y, f: () => { shadow(x, y - 2, 46); drawImg('t_stump', x, y, 95, { alpha: sp.fl > 0 ? .6 : 1 }); bar(x - 40, y - 112, 80, 7, Math.max(0, sp.t) / P.stumpSec, '#c8a070'); } }); continue; }
      const healing = TRHEAL.some(q => q.i === sp.i && tm - q.t < 1.3), atk = sp.hitT < 0.6 || healing && Math.floor(tm * 2) % 2 === 0;
      list.push({ y, f: () => { shadow(x, y - 2, 50); drawImg(atk ? 't_sprout_attack' : 't_sprout_idle', x, y, 150, { alpha: sp.fl > 0 ? .55 + .45 * Math.abs(Math.sin(tm * 40)) : 1 }); bar(x - 45, y - 172, 90, 9, sp.hp / sp.mhp, '#7ad04a');
        if (healing) { drawImg('t_fx_heal_swirl', x, y - 40, 110, { alpha: .75 + .25 * Math.sin(tm * 5) }); ctx.save(); ctx.strokeStyle = 'rgba(170,255,120,.55)'; ctx.lineWidth = 6; ctx.setLineDash([14, 12]); ctx.lineDashOffset = -tm * 60; ctx.beginPath(); ctx.moveTo(px(x), px(y - 120)); ctx.quadraticCurveTo(px((x + bp.x) / 2), px(Math.min(y, bp.y) - 380), px(bp.x), px(bp.y - 260)); ctx.stroke(); ctx.restore(); } } }); }
    const hl = TRHEAL.filter(q => tm - q.t < 1.3); if (hl.length) { const a = 1 - (tm - hl[hl.length - 1].t) / 1.3;
      list.push({ y: bp.y + 1, f: () => { drawImg('t_fx_heal_pillar', bp.x, bp.y + 20, 300, { alpha: .6 * a }); drawImg('t_fx_heal_plus', bp.x - 120, bp.y - 300, 120, { alpha: (.7 + .3 * Math.sin(tm * 6)) * a }); } }); }
  }
  function trentIcons() { const Wt = BF && BF.tr; if (!Wt) return; // значок «Опутан N с» — поверх всех спрайтов, как Яд роя
    for (const id of Wt.roots) { const u = BF.all[id]; if (!TRT.rooted(BF, u)) continue; const h = S.heroes[id], rt = h && RT[h.user]; if (!rt || rt.loc !== 'boss') continue;
      const left = u.rootUntil - BF.t, x = rt.x, iy = rt.y - heroH(rt) - 46; drawImg('t_entangle_icon', x - 34, iy + 22, 46, {});
      text(`Опутан ${Math.ceil(left)}с` + ((u.rootHits || 0) ? ` · ${u.rootHits}/${Wt.X.R.freeHits}` : ''), x - 8, iy - 6, 22, '#b8ff6a', 'left'); } }
  // v49.5: «дыхание» боссов без новых кадров — спрайт рисуется полосами, ступни на месте. C.bossIdle: { on, amp, ogre|stone|cursed|queen|treant: { T, A, p, ... } }
  const BOSS_IDLE_DEF = { ogre: { T: 3.0, A: 0.024, p: 1.6 }, stone: { T: 3.0, A: 0.012, p: 2.2, step: 1 }, cursed: { T: 2.0, A: 0.022, p: 1.4, twitch: 1 },
    queen: { T: 2.0, A: 0.012, p: 1.2, hover: 9, sway: 1.2, swayT: 3.0 }, treant: { T: 3.0, A: 0.014, p: 1.5, crown: 0.028, crownT: 6.0 } };
  function bossIdleKind(b) { const d = bossDefOf(b); if (d && d.idle) return d.idle; const k = b.key || 'ogre_boss'; return k === 'queen_boss' ? 'queen' : k === 'treant_boss' ? 'treant' : 'ogre'; }
  function drawBossIdle(key, cx, by, h, opt, kind) {
    const BI = C.bossIdle; if (!BI || BI.on === false || !BOSS_IDLE_DEF[kind] && !(BI[kind])) return false;
    const Q = Object.assign({}, BOSS_IDLE_DEF[kind] || {}, BI[kind] || {}); if (Q.on === false) return false; const amp = BI.amp === undefined ? 1 : +BI.amp;
    const c = filtered(sprite(key, h, opt.frame), opt.filter); if (!c) return false; const iw = c.width, ih = c.height, w = iw / K, hh = ih / K, t = tm, A = (Q.A || 0) * amp;
    let b = Math.sin(2 * Math.PI * t / Q.T); if (Q.step) b = Math.round(b * 4) / 4;
    let tw = 0; if (Q.twitch) { const ph = (t % 4) / 4; tw = ph > .9 ? Math.sin((ph - .9) * 10 * Math.PI * 6) * 3 * amp : 0; }
    const hov = Q.hover ? -Q.hover * amp * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / Q.T)) : 0, rot = Q.sway ? Q.sway * amp * Math.PI / 180 * Math.sin(2 * Math.PI * t / (Q.swayT || 3)) : 0;
    const crown = Q.crown ? Q.crown * amp * hh * Math.sin(2 * Math.PI * t / (Q.crownT || 6)) : 0, fl = opt.flip ? -1 : 1;
    ctx.save(); if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
    ctx.translate(Math.round((cx + tw) * K) / K, Math.round((by + hov) * K) / K); if (rot) ctx.rotate(rot); if (opt.flip) ctx.scale(-1, 1);
    const N = 24; for (let i = 0; i < N; i++) { const u0 = i / N, u1 = (i + 1) / N, Y = u => -hh * u * (1 + A * b * Math.pow(u, Q.p || 1.5)), X = u => fl * crown * Math.pow(u, 2.2);
      const sy = ih * (1 - u1), sh = ih / N, dy0 = Y(u1), dy1 = Y(u0), sx = 1 - A * 0.5 * b * Math.pow((u0 + u1) / 2, Q.p || 1.5), dw = w * sx;
      ctx.drawImage(c, 0, sy, iw, Math.min(sh + 0.6, ih - sy), -dw / 2 + X((u0 + u1) / 2), dy0, dw, dy1 - dy0 + 0.6 / K); }
    ctx.restore(); return true;
  }
  const QDEAD = []; // анимация гибели личинок: распад 1→2→лужица
  function qPts() { const L = lairCfg(lairKey()); return L.cocoons || LAIRS_DEF.boss_queen.cocoons; }
  function qPt(i) { const P = qPts(); return P[((i | 0) % P.length + P.length) % P.length]; }
  function qSquadXY(si) { // где стоят танк и лекарь отряда (личинки ползут мимо танка к лекарю)
    const bp = SPOT('boss', 'boss'); let T = { x: bp.x - 200, y: 1100 }, Hh = { x: bp.x - 760, y: 1150 }; const Sq = BF && BF.squads[si];
    if (Sq) for (const id of Sq.ids) { const u = BF.all[id], h = S.heroes[id], rt = h && RT[h.user]; if (!u || !rt) continue; if (u.role === 'tank') T = { x: rt.x, y: rt.y }; else if (u.role === 'healer') Hh = { x: rt.x, y: rt.y }; }
    return { T, H: Hh };
  }
  function qLarvaXY(l) {
    const c = qPt(l.c), z = qSquadXY(l.sq), ly = ((l.lane || 0) - 1) * 30, p = Math.max(0, Math.min(1, l.p || 0));
    // v49.10: путь по длине, а не 45% времени на короткий отрезок до танка — иначе к жрецу ползут «слишком медленно»
    const A = { x: c[0], y: c[1] }, B = { x: z.T.x + 10, y: z.T.y }, E = { x: z.H.x + 40, y: z.H.y };
    const d1 = Math.hypot(B.x - A.x, B.y - A.y), d2 = Math.hypot(E.x - B.x, E.y - B.y), D = d1 + d2 || 1, s = p * D;
    const P0 = s <= d1 ? A : B, P1 = s <= d1 ? B : E, q = s <= d1 ? (d1 ? s / d1 : 1) : (d2 ? (s - d1) / d2 : 1);
    return { x: P0.x + (P1.x - P0.x) * q, y: P0.y + (P1.y - P0.y) * q + ly };
  }
  const qImg = k => IMG[k] && !isPH(k) && (IMG[k].naturalWidth || IMG[k].width) ? IMG[k] : null;
  function qBlob(x, y, w, h, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y - h / 2), w / 2, h / 2, 0, 0, 7); ctx.fill(); }
  function qDraw(key, x, y, opt, fw, fh, col) { const im = qImg(key); if (im) return drawImg(key, x, y, im.height, opt || {}); qBlob(x, y, fw, fh, col || '#8a4ac8'); return fw; }
  function portalGlow(P) { const [x, y, r] = P, a = 0.2 + 0.12 * Math.sin(tm * 2.2) + 0.05 * Math.sin(tm * 5.1); const g = ctx.createRadialGradient(x, y, 10, x, y, r * (1 + 0.06 * Math.sin(tm * 1.7)));
    g.addColorStop(0, `rgba(210,120,255,${(a + 0.15).toFixed(3)})`); g.addColorStop(0.5, `rgba(160,60,230,${a.toFixed(3)})`); g.addColorStop(1, 'rgba(120,30,200,0)'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4); ctx.restore(); }
  function swarmList(list, b) {
    const W0 = BF && BF.sw;
    const cocs = W0 ? W0.cocoons : qPts().map((p, i) => ({ i, st: 'grow', t: 99, hp: 1, mhp: 1 }));
    cocs.forEach(c => { const p = qPt(c.i); list.push({ y: p[1], f: () => {
      if (c.st === 'grow') { const soon = c.t < 6, pu = soon ? 1 + 0.04 * Math.sin(tm * 12) : 1;
        if (soon) { const g = ctx.createRadialGradient(p[0], p[1] - 90, 10, p[0], p[1] - 90, 150); g.addColorStop(0, 'rgba(255,120,230,.35)'); g.addColorStop(1, 'rgba(255,120,230,0)'); ctx.fillStyle = g; ctx.fillRect(p[0] - 150, p[1] - 240, 300, 300); }
        shadow(p[0], p[1] - 2, 70); const im = qImg('q_cocoon'); if (im) drawImg('q_cocoon', p[0], p[1], Math.round(im.height * pu / 2) * 2, {}); else qBlob(p[0], p[1], 120, 180, '#7a3aa8');
        if (c.hp < c.mhp) bar(p[0] - 50, p[1] - 214, 100, 9, c.hp / c.mhp, '#d070ff');
      } else { const a = Math.max(0, Math.min(1, c.relay / 4)); if (a > 0) qDraw('q_cocoon_broken', p[0], p[1], { alpha: a }, 130, 170, '#5a2a78'); }
    } }); });
    if (!W0) return;
    for (const l of W0.larvae) { const q = qLarvaXY(l), x = q.x + Math.sin(tm * 6 + l.id) * 3, y = q.y;
      list.push({ y, f: () => { const atk = l.atk > 0 || l.held, key = atk ? 'q_larva_atk_' + (1 + ((Math.floor(tm * 4) + l.id) % 2)) : 'q_larva_' + l.st;
        const sq = atk ? 1 : 1 + 0.04 * Math.sin(tm * 9 + l.id); // ползёт: лёгкое сжатие
        shadow(x, y - 2, 30 + l.st * 10);
        const im = qImg(key); if (im) drawImg(key, x, y, Math.round(im.height * sq / 2) * 2, { filter: l.hitT > 0 ? 'brightness(1.6)' : undefined }); // спрайты нарисованы лицом влево — к героям, не разворачиваем
        else qBlob(x, y, 60 + l.st * 22, 34 + l.st * 12, l.hitT > 0 ? '#e0b0ff' : '#b06ae0');
        if (l.hp < l.mhp) bar(x - 30, y - (im ? im.height : 60) - 12, 60, 7, l.hp / l.mhp, '#d070ff'); } }); }
    for (let i = QDEAD.length - 1; i >= 0; i--) { const d = QDEAD[i], a = tm - d.t; if (a > 2.6 || a < 0) { QDEAD.splice(i, 1); continue; }
      list.push({ y: d.y - 1, f: () => { const k = a < 0.3 ? 'q_larva_death_1' : a < 0.6 ? 'q_larva_death_2' : 'q_larva_death_3'; qDraw(k, d.x, d.y, { alpha: a < 0.6 ? 1 : Math.max(0, 1 - (a - 0.6) / 2) }, 70, 20, '#9a3ae0'); } }); }
  }
  function poisonIcons() { for (const id in BF.all) { const u = BF.all[id], q = u._qp; if (!q || !q.n || u.dead) continue; const h = S.heroes[id], rt = h && RT[h.user]; if (!rt || rt.loc !== 'boss') continue;
    const hh = heroH(rt), x = rt.x - 66, y = rt.y - hh + 4; // v49.10: иконка у головы, не улетает на героя сзади
    if (qImg('q_poison')) drawImg('q_poison', x, y, 36, {}); else qBlob(x, y, 32, 32, '#8a3ae0');
    text('Яд роя ×' + q.n, x + 22, y - 18, 18, '#b8ff6a', 'left'); } }
  function wallSquadBox(Sq) {
    const pts = [];
    (Sq.ids || []).forEach(id => { const h = S.heroes[id], u = BF && BF.all[id]; if (!h || (u && u.dead)) return; pts.push({ id, n: h.user, rt: ensureRT(h) }); });
    if (!pts.length) return null;
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    pts.forEach(p => { const x = p.rt.x, y = p.rt.y; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; });
    return { n: pts.map(p => p.n), x: Math.round((minx + maxx) / 2), y: Math.round((miny + maxy) / 2), w: Math.round(Math.max(280, maxx - minx + 280)), h: Math.round(Math.max(240, maxy - miny + 260)) };
  }
  function drawWallDomes() {
    if (!BF) return;
    BF.squads.forEach(Sq => {
      const left = (Sq.wall || 0) - BF.t; if (left <= 0) return;
      const box = wallSquadBox(Sq); if (!box) return;
      const cx = box.x, cy = box.y - 50, rx = box.w / 2, ry = box.h / 2;
      const pulse = 0.82 + 0.18 * Math.sin(tm * 4);
      ctx.save();
      const gr = ctx.createRadialGradient(cx, cy, 16, cx, cy, Math.max(rx, ry));
      gr.addColorStop(0, 'rgba(80,200,255,' + (0.10 * pulse) + ')');
      gr.addColorStop(0.55, 'rgba(80,180,255,' + (0.22 * pulse) + ')');
      gr.addColorStop(0.82, 'rgba(160,230,255,' + (0.40 * pulse) + ')');
      gr.addColorStop(1, 'rgba(180,230,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(180,240,255,' + (0.50 + 0.25 * pulse) + ')'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,200,255,' + (0.22 * pulse) + ')'; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      text(String(Math.ceil(left)), cx, cy - ry + 36, 32, '#d8f6ff');
      ctx.restore();
    });
  }
  function panelWalls() {
    if (!BF || !S.boss || S.boss.phase !== 'fight') return [];
    const out = [];
    BF.squads.forEach(Sq => {
      const left = (Sq.wall || 0) - BF.t; if (left <= 0) return;
      const box = wallSquadBox(Sq); if (!box) return;
      out.push({ n: box.n, l: Math.max(1, Math.ceil(left)), x: box.x, y: box.y, w: box.w, h: box.h });
    });
    return out;
  }
  function sceneBoss() {
    const LR = lairCfg(lairKey()), LIVEL = !!(window.LIVE6 && LIVE6.has(lairKey())); if (!LIVEL) (LR.torches || TORCH6).forEach(a => torchFX(...a)); // v8.7: на новом фоне огонь нарисован — свет и искры даёт живой фон // v48: факелы — у каждого логова свои (у Матки нет) // v6.40: факелы как костёр лагеря, ~50% // v6.34: факелы-жаровни по раскладке фона
    const b = S.boss, bp = SPOT('boss', 'boss'), list = [];
    const show = b && (b.phase === 'signup' || b.phase === 'fight' || (b.phase === 'done' && Date.now() - (b.doneAt || 0) < 8000 && !b.fled));
    if (show) list.push({ y: bp.y, f: () => {
      const sh = b.shake > 0 ? Math.round(Math.sin(tm * 60) * 8) : 0; if (b.shake > 0) b.shake -= 1 / 60;
      if (b.cast) { const gr = ctx.createRadialGradient(bp.x, bp.y - 200, 20, bp.x, bp.y - 200, 330); gr.addColorStop(0, 'rgba(160,80,255,.45)'); gr.addColorStop(1, 'rgba(160,80,255,0)'); ctx.fillStyle = gr; ctx.fillRect(bp.x - 330, bp.y - 530, 660, 660); }
      shadow(bp.x, bp.y - 4, 160);
      { const bk = IMG[b.key] ? b.key : 'ogre_boss', bo = { filter: b.filter || undefined, flip: BOSS_MIRROR(b.key), alpha: b.phase === 'signup' ? .8 : 1 }; // v49.5: дыхание боссов (C.bossIdle)
        if (!drawBossIdle(bk, bp.x + sh, bp.y, b.size || 430, bo, bossIdleKind(b))) drawImg(bk, bp.x + sh, bp.y, b.size || 430, bo); }
      text(b.name, bp.x, bp.y + 34, 30, '#ffb08a');
    } });
    // v6.22: без босса — вместо силуэта (тень «смотрела» не туда) анимированный туман
    else list.push({ y: bp.y, f: () => drawFog(bp) });
    if (LR.portal && !LIVEL) portalGlow(LR.portal);
    if (b && swarmOn(bossDefOf(b)) && (b.phase === 'signup' || b.phase === 'fight')) swarmList(list, b);
    if (b && b.phase === 'fight' && BF && BF.tr) trentList(list, bp); // v49.5
    heroesIn('boss').forEach(h => list.push({ y: ensureRT(h).y, f: () => drawHero(h) }));
    sortDraw(list); flushLab(); // v6.32: подписи отряда поверх спрайтов, без наложений
    drawWallDomes(); // v49.12: купол заслона 8с + таймер
    if (BF && BF.sw) poisonIcons();
    if (BF && BF.tr) trentIcons(); // v49.5
    zoomUI(() => {
    if (b && b.phase === 'fight' && b.cast) castBar(W / 2, 168, 700, b, false);
    // v49.10: компактная табличка команд справа сверху (над зоной босса, 2 колонки легенды) — не перекрывает спрайт и имя
    const L = [];
    if (!b || b.phase === 'done') L.push([b && b.phase === 'done' ? `${b.name} ${b.fled ? gv(b.name,'ушёл','ушла') : gv(b.name,'повержен','повержена')} — следующий на следующем стриме` : 'Босс появится через час после начала стрима', '#e8d6c0']);
    else if (b.phase === 'wait') L.push([`${b.name} появится через ${fmtTime(b.spawnAt - now())}`, '#ffd27a']);
    else if (b.phase === 'signup') L.push([`Запись: ${b.signup.length} чел.${b.signupUntil ? ' · бой через ' + fmtTime(b.signupUntil - now()) : ' · бой начнёт стример'}`, '#ffd27a']);
    else L.push([`Бой ${fmtTime(b.endAt - now())} · каст ${b.cast ? 'СЕЙЧАС' : 'через ' + Math.ceil(b.castIn || 0) + 'с'}${BF && BF.rmb ? ' · раскат ' + Math.ceil(Math.max(0, BF.rmb.next - BF.t)) + 'с' : ''}`, '#ff9c7a']);
    if (!b || b.phase !== 'fight') L.push(['!босс — записаться в отряд', '#fff2d0']);
    L.push(['Отряд 5: танк · лекарь · 3 бойца', '#d8c8b0']);
    const nd = bossNeeds(); if (nd.length) L.push([nd.join(' · '), '#ff7a5a']);
    if (b && b.phase !== 'done' && swarmOn(bossDefOf(b))) { const sw = BF && BF.sw; L.push([`🐛 Рой${sw ? `: личинок ${sw.larvae.length}, коконов ${sw.cocoons.filter(c => c.st === 'grow').length}` : ''} · !заслон у танка, !лечить — яд`, '#d8a0ff']);
      L.push(['прерви «Зов роя» — вылупится меньше', '#c8b0e0']); }
    if (b && b.phase !== 'done' && trentOn(bossDefOf(b))) { const tq = BF && BF.tr && TRT.snap(BF); L.push([`🌿 Корни${tq ? `: опутано ${tq.r.length} · ростков ${tq.sp}${tq.st ? ' · пней ' + tq.st : ''}` : ''} · !удар рубит, ростки лечат`, '#b8ff6a']);
      L.push(['!оглушить (без каста) / !заслон — вырвать из корней', '#c8e0b0']); }
    if (b && bossActive()) bossRosterLines().forEach(l => L.push(l));
    const fs = 16, lhs = 20, titleFs = 18, pw = 600, pad = 10;
    const leg = CC_LEGEND, legRows = Math.ceil(leg.length / 2);
    const ph = pad + 6 + L.length * lhs + 8 + legRows * lhs + pad;
    const x0 = W - pw - 16, y0 = 20;
    darkPlate(x0, y0, pw, ph);
    drawSkull(x0 + 10, y0 + 8, 3, '#e8d6c0');
    L.forEach(([t, c], i) => { const sz = i === 0 ? titleFs : fs; let s = t; while (measure(s, sz) > pw - 44 && s.length > 8) s = s.slice(0, -2); if (s !== t) s += '…'; text(s, x0 + 34, y0 + 16 + i * lhs, sz, c, 'left'); });
    const ly0 = y0 + 16 + L.length * lhs + 6, colW = (pw - 24) / 2;
    leg.forEach((r, i) => {
      const col = i % 2, row = Math.floor(i / 2), xx = x0 + 12 + col * (colW + 4);
      const raw = `${r.i} ${r.cmd} — ${r.win}`;
      let s = raw; while (measure(s, 15) > colW - 4 && s.length > 8) s = s.slice(0, -2); if (s !== raw) s += '…';
      text(s, xx, ly0 + row * lhs, 15, r.c, 'left');
    });
    });
  }
  // v6.22: процедурный туман (своя value-noise, без внешних ассетов): 2 тайлящиеся текстуры, 3 слоя с дрейфом
  let FOGT = null;
  function fogTex(seed) {
    const S0 = 128, c = document.createElement('canvas'); c.width = c.height = S0; const x = c.getContext('2d'), im = x.createImageData(S0, S0);
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const oct = [8, 16, 32].map(n => { const a = []; for (let i = 0; i < n * n; i++) a.push(rnd()); return { n, a }; });
    const sm = t => t * t * (3 - 2 * t);
    for (let j = 0; j < S0; j++) for (let i = 0; i < S0; i++) {
      let v = 0, w = 0, amp = 1;
      for (const o of oct) { const fx = i / S0 * o.n, fy = j / S0 * o.n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0), A = (X, Y) => o.a[((Y + o.n) % o.n) * o.n + (X + o.n) % o.n];
        v += amp * ((A(x0, y0) * (1 - tx) + A(x0 + 1, y0) * tx) * (1 - ty) + (A(x0, y0 + 1) * (1 - tx) + A(x0 + 1, y0 + 1) * tx) * ty); w += amp; amp *= .5; }
      v = Math.max(0, Math.min(1, (v / w - .38) * 2.2)) * Math.sin(Math.PI * (j + .5) / S0); const k = (j * S0 + i) * 4;
      im.data[k] = 200; im.data[k + 1] = 196; im.data[k + 2] = 225; im.data[k + 3] = Math.round(v * 255);
    }
    x.putImageData(im, 0, 0); return c;
  }
  function drawFog(bp) {
    if (!FOGT) FOGT = [fogTex(1234567), fogTex(7654321)];
    ctx.save(); ctx.imageSmoothingEnabled = true;
    const layers = [[0, 1400, 9, .30, 560, 900], [1, 1100, -14, .26, 700, 700], [0, 900, 22, .20, 860, 520]];
    for (const [t, sz, sp, al, y, hh] of layers) {
      const off = ((tm * sp) % sz + sz) % sz;
      ctx.globalAlpha = al * (0.85 + 0.15 * Math.sin(tm * .4 + sz));
      for (let x = -sz + off; x < W; x += sz) ctx.drawImage(FOGT[t], x, y, sz, hh);
    }
    ctx.restore();
  }
  const CC_LEGEND = [ // v6.22: кто что жмёт в бою с боссом (иконки — как в списке классов)
    { i: '⚔️🛡️', who: 'Воин, Паладин', cmd: '!оглушить', win: 'красное', c: '#ff8a7a' },
    { i: '🏹🗡️', who: 'Лучник, Ассасин', cmd: '!связать', win: 'жёлтое', c: '#ffd86a' },
    { i: '✨', who: 'Жрец', cmd: '!очистить', win: 'фиолетовый · !воскресить · !лечить', c: '#d7a8ff' },
    { i: '📖', who: 'Маг', cmd: '!замедлить', win: 'любое окно', c: '#a8d8ff' },
    { i: '🛡️', who: 'Паладин', cmd: '!заслон', win: 'любое окно', c: '#a8d8ff' },
    { i: '👊', who: 'Все', cmd: '!удар', win: 'всегда', c: '#fff2d0' },
  ];
  function darkPlate(x, y, w, h) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + 6, y + 6, w, h);
    ctx.fillStyle = '#0c0910'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = 'rgba(28,22,34,.92)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(200,160,255,.18)'; ctx.fillRect(x, y, w, 3);
  }
  const SCENES = { camp: sceneCamp, garden: sceneGarden, forest: sceneForest, town: sceneTown, boss: sceneBoss };

  // ===================== ЭФФЕКТЫ =====================
  const FXCOL = { slash: '#ffffff', hammer: '#ffd27a', arrow: '#c8a46a', daggers: '#d0d8ff', arcane: '#c07aff', holy: '#fff2a0' };
  function drawAttack(f, p) {
    const c = FXCOL[f.fx] || '#fff', e = Math.min(1, p * 1.6), x = f.x + (f.tx - f.x) * e, y = f.y + (f.ty - f.y) * e;
    ctx.fillStyle = c; ctx.strokeStyle = c;
    if (f.fx === 'slash') { // широкий взмах у цели
      ctx.lineWidth = 8; ctx.globalAlpha *= 1 - p; ctx.beginPath(); ctx.arc(f.tx, f.ty, 70, -1.2 + p * 2, 0.4 + p * 2); ctx.stroke();
    } else if (f.fx === 'hammer') { // удар молота: волна
      ctx.lineWidth = 6; ctx.globalAlpha *= 1 - p; ctx.beginPath(); ctx.ellipse(f.tx, f.ty + 40, 30 + p * 110, (30 + p * 110) * .35, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (f.fx === 'arrow') { const a = Math.atan2(f.ty - f.y, f.tx - f.x); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 40, y - Math.sin(a) * 40); ctx.lineTo(x, y); ctx.stroke(); ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8); }
    else if (f.fx === 'daggers') { for (const d of [-14, 14]) ctx.fillRect(Math.round(x) - 7, Math.round(y + d) - 3, 14, 6); }
    else if (f.fx === 'arcane') { const gr = ctx.createRadialGradient(x, y, 2, x, y, 26); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(192,122,255,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 26, y - 26, 52, 52); }
    else if (f.fx === 'holy') { ctx.lineWidth = 5; ctx.globalAlpha *= 1 - p * .7; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(x, y); ctx.stroke(); ctx.fillRect(Math.round(x) - 6, Math.round(y) - 6, 12, 12); }
  }
  function drawFX(dt, loc) {
    for (const f of FX) {
      if (f.loc !== loc) continue;
      if (f.t < 0) continue;
      const p = f.t / f.life; if (p >= 1) continue;
      ctx.save(); ctx.globalAlpha = p < .8 ? 1 : (1 - p) / .2;
      if (f.kind === 'text') text(f.text, f.x, f.y - p * 70, f.size, f.color);
      else if (f.kind === 'icon') drawImg(f.key, f.x, f.y - Math.sin(Math.min(p * 2, 1) * Math.PI / 2) * 90, f.h);
      else if (f.kind === 'pop') { const s = 1 + Math.sin(Math.min(p * 1.4, 1) * Math.PI) * 0.3; drawImg(f.key, f.x, f.y - p * 60, Math.round(64 * s), { alpha: 1 - p }); }
      else if (f.kind === 'label') {
        const yy = f.y - Math.sin(Math.min(p * 2.5, 1) * Math.PI / 2) * 50 - p * 30;
        setFont(28); const tw = ctx.measureText(f.text).width, w = tw + 84, x0 = px(f.x - w / 2);
        ctx.fillStyle = 'rgba(30,18,10,.82)'; ctx.fillRect(x0, px(yy - 28), w, 56);
        drawImg(f.key, x0 + 32, yy + 22, 44); text(f.text, x0 + 64 + tw / 2, yy, 28, f.color, 'center', 0);
      }
      else if (f.kind === 'mimicchest') { const sh = Math.round(Math.sin(f.t * 45) * 5 * Math.min(1, f.t * 2)); drawChestA('wooden', f.x + sh, f.y, CHEST_H, false, 0); }
      else if (f.kind === 'chestdrop') {
        const tt = f.t, open = tt > 0.5, sh = open ? 0 : Math.sin(tt * 50) * 6, sc = open ? 1 + Math.max(0, 0.25 - (tt - 0.5)) : 1;
        if (!drawChestA(f.tier, f.x + sh, f.y, CHEST_H, open, tt - 0.5)) drawImg(open ? 'chest_open' : 'chest', f.x + sh, f.y, Math.round(90 * sc), { filter: f.tier === 'golden' || f.tier === 'legendary' ? 'sepia(.5) saturate(2) brightness(1.15)' : f.tier === 'silver' ? 'saturate(.2) brightness(1.25)' : undefined });
        if (open) { const ls = [f.name, ...f.lines], rise = Math.min(1, (tt - 0.5) * 3) * 30; setFont(24); const w = Math.max(...ls.map(l => ctx.measureText(l).width)) + 30, hh = ls.length * 30 + 12, y0 = f.y - 130 - hh - rise;
          ctx.fillStyle = 'rgba(30,18,10,.85)'; ctx.fillRect(px(f.x - w / 2), px(y0), w, hh); ctx.strokeStyle = f.color || '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px(f.x - w / 2), px(y0), w, hh);
          ls.forEach((l, i) => text(l, f.x, y0 + 8 + i * 30, 24, i ? '#fff2c0' : f.color, 'center', 0)); }
      }
      else if (f.kind === 'fly') { const rt = S.heroes[f.user] && ensureRT(S.heroes[f.user]); const tx = rt && rt.loc === f.loc ? rt.x : f.x, ty = rt && rt.loc === f.loc ? rt.y - 60 : f.y - 100;
        const e = p * p * (3 - 2 * p), xx = f.x + (tx - f.x) * e, yy = f.y + (ty - f.y) * e - Math.sin(p * Math.PI) * 120; drawImg(f.key, xx, yy, 44); }
      else if (f.kind === 'reward') { const rt = S.heroes[f.user] && ensureRT(S.heroes[f.user]); const x = rt && rt.loc === 'boss' ? rt.x : f.x, yb = (rt && rt.loc === 'boss' ? rt.y : f.y) - 200 - Math.min(1, p * 6) * 20;
        const ls = f.lines.flatMap((l, i) => wrapPx(l, 22, 440).map(t => ({ t, c: i ? '#fff2c0' : f.color }))); setFont(22); const w = Math.max(...ls.map(l => ctx.measureText(l.t).width)) + 28, hh = ls.length * 26 + 12;
        const xc = Math.max(w / 2 + 10, Math.min(W - w / 2 - 10, x)); // не уезжает за край экрана
        ctx.fillStyle = 'rgba(30,18,10,.88)'; ctx.fillRect(px(xc - w / 2), px(yb - hh), w, hh);
        ls.forEach((l, i) => text(l.t, xc, yb - hh + 18 + i * 26, 22, l.c, 'center', 0)); }
      else if (f.kind === 'attack') drawAttack(f, p);
      else if (f.kind === 'ring') { ctx.strokeStyle = f.color || '#fff'; ctx.lineWidth = 6; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.ellipse(f.x, f.y, 40 + p * 160, (40 + p * 160) * .35, 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (f.kind === 'fairy') drawImg('fairy', f.x + Math.sin(f.t * 4) * 40, f.y - p * 40 + Math.sin(f.t * 7) * 8, 100);
      else if (f.kind === 'golden') {
        const s = 1 + Math.sin(f.t * 6) * .06, gr = ctx.createRadialGradient(f.x, f.y, 10, f.x, f.y, 240);
        gr.addColorStop(0, 'rgba(255,220,80,.7)'); gr.addColorStop(1, 'rgba(255,220,80,0)'); ctx.fillStyle = gr; ctx.fillRect(f.x - 240, f.y - 240, 480, 480);
        drawImg('crop_pumpkin', f.x, f.y + 90, Math.round(160 * s), { filter: 'sepia(.6) saturate(2.5) brightness(1.2)' }); text('ЗОЛОТАЯ ТЫКВА!', f.x, f.y + 130, 44, '#ffd700');
      }
      ctx.restore();
    }
  }
  function tickFX(dt) { for (let i = FX.length - 1; i >= 0; i--) { FX[i].t += dt; if (FX[i].t >= FX[i].life) FX.splice(i, 1); } }

  // ===================== ВЕРХНИЕ ПОЛОСЫ, КНОПКИ ЛОКАЦИЙ, ОКНА =====================
  // v6.36: единый менеджер верхних плашек — каждая плашка просит место, менеджер сдвигает её вниз, пока она не перестанет пересекаться с уже размещёнными
  const TOP6 = [], TOP_GAP = 12;
  function topPlace(id, x, w, h, y0) { x = Math.round(x); let y = Math.round(y0 === undefined ? 24 : y0), moved = true;
    while (moved && y < H / 2) { moved = false; for (const r of TOP6) if (x < r[2] + TOP_GAP && x + w + TOP_GAP > r[0] && y < r[3] + TOP_GAP && y + h + TOP_GAP > r[1]) { y = r[3] + TOP_GAP; moved = true; } }
    TOP6.push([x, y, x + w, y + h, id]); return y; }
  const topBottom = () => TOP6.reduce((m, r) => Math.max(m, r[3] + TOP_GAP), 0);
  const BB = Object.assign({ appearSec: 25, bigSec: 20, keepDuringSignup: true, preSpawnSec: 600, pulse: true }, C.bossBanner || {}); // v6.42
  const BANNER_SEC = BB.appearSec; // v6.24: крупная плашка о появлении босса; v6.42: потом — компактная, пока открыта запись
  function drawBanner() {
    const g = S.global, items = []; BANNER_BOT = 0;
    if (g.farmEvent !== 'off' && F.events[g.farmEvent]) items.push(`${F.events[g.farmEvent].name}: ${fmtTime(g.farmEventUntil - now())}`);
    if (g.farmDecree !== 'off' && F.decrees[g.farmDecree]) items.push(`${F.decrees[g.farmDecree].name}: ${fmtTime(g.farmDecreeUntil - now())}`);
    if (fairActive()) items.push(`🎪 Ярмарка +${FAIR.bonusVeg}/+${FAIR.bonusPumpkin}: ${fmtTime(S.fair.until - now())}`);
    { const sb = seasonBannerText(); if (sb) items.push(sb); } // v49: сезон — отсчёт до вайпа / «Сезон начался»
    const sp = C.speedSteps[speedIdx]; if (sp !== 1) items.push(`время x${sp}`);
    BANNER_ON = items.length > 0;
    if (items.length) { const t = items.join('  •  '), w = Math.round(measure(t, 22) + 40), ey = topPlace('event', 24, w, 46); panel(24, ey, w, 46, '#cfe3f2'); text(t, 24 + w / 2, ey + 23, 22, '#1f3a52', 'center', 0); }
    drawGoalPlate(); // v6.36: цель — слева под событиями, до баннера босса
    // босс: за 10 минут до появления и всё время записи — во всех локациях
    let bt = '', big = false; const B = S.boss;
    if (B && B.phase === 'wait' && B.spawnAt - now() <= BB.preSpawnSec) bt = `⚔ Через ${fmtTime(B.spawnAt - now())} появится ${B.name}`;
    else if (B && B.phase === 'signup' && tm - (B.bannerT === undefined ? -999 : B.bannerT) < BANNER_SEC) { const nd = bossNeeds(); bt = `☠ ${B.name} ${gv(B.name,'появился','появилась')}! !босс — запись в отряд · записано ${B.signup.length}${nd.length ? ' · ' + nd[0] : ''}`; big = tm - (B.bannerT || -99) < BB.bigSec; }
    else if (B && B.phase === 'signup' && BB.keepDuringSignup) { const nd = bossNeeds(); bt = `☠ ${B.name}: запись открыта — !босс · записано ${B.signup.length}${B.signupUntil ? ' · бой через ' + fmtTime(B.signupUntil - now()) : ''}${nd.length ? ' · ' + nd[0] : ''}`; }
    else if (B && B.phase === 'fight' && viewLoc() !== 'boss') bt = `☠ Бой с ${B.gen}: ${Math.round(B.hp / B.maxhp * 100)}% HP${B.cast ? ' · КАСТ — ' + BC.WIN[B.cast.win].name + ' ' + BC.CC[BC.WIN[B.cast.win].need].cmd : ''}`;
    BANNER_TXT = bt;
    if (bt) { const fs = big ? 34 : 28, w = Math.round(measure(bt, fs) + 56), x = Math.round(W / 2 - w / 2), hh = big ? 66 : 56, by = topPlace('boss', x, w, hh, 28); BANNER_BOT = by + hh + 14; darkPlate(x, by, w, hh); if (big && BB.pulse) { ctx.fillStyle = `rgba(255,90,60,${0.25 + 0.2 * Math.sin(tm * 6)})`; ctx.fillRect(x, by, w, hh); } text(bt, W / 2, by + hh / 2, fs, '#ffd8b0', 'center'); }
    if (viewLoc() === 'town' && !B6.town) { const ud = underdogGuilds(); if (ud.length) { const t = `Слабая гильдия: ${ud.map(g => g.name).join(', ')} — +${Math.round(C.guildBalance.underdogBonus * 100)}% золота и опыта`; const w = Math.round(measure(t, 22) + 40), ux = Math.max(1300, W / 2 - w / 2), uy = topPlace('guild', ux, w, 44, 28); darkPlate(ux, uy, w, 44); text(t, ux + w / 2, uy + 22, 22, '#a8e0ff', 'center'); } } // v6.34: правее вывески гильдий (x 640–1280)
  }
  // v6.57: очередь на поход и отряды пати — табличка в игре (видна во всех локациях, пока очередь не пуста)
  function queueLines() { const P = PTY(), L = [], nm = u => S.heroes[u] ? DN(S.heroes[u]) : u, cut = (a, n) => a.slice(0, n).join(', ') + (a.length > n ? ` +${a.length - n}` : '');
    if (EXPQ.length) L.push(`⏳ Очередь в поход: ${cut(EXPQ.map((u, i) => `${i + 1}. ${nm(u)}`), 5)}`);
    const q = PARTYQ.users; for (let i = 0; i < q.length; i += P.size) { const sq = q.slice(i, i + P.size); L.push(`🛡 ${i ? 'Следующий отряд' : 'Отряд пати'} ${sq.length}/${P.size}: ${sq.map(nm).join(', ')}`); }
    return L; }
  function drawQueuePlate() { const L = queueLines(); if (!L.length) return; const fs = 22, w = Math.round(Math.max(...L.map(t => measure(t, fs))) + 40), hh = 14 + L.length * 32, y = topPlace('queue', 24, w, hh);
    panel(24, y, w, hh, '#d8e6f4'); L.forEach((t, i) => text(t, 44, y + 23 + i * 32, fs, '#1f3a52', 'left', 0)); }
  let BANNER_BOT = 0, BANNER_TXT = ''; // v6.34: низ баннера босса — табличка лута ниже
  // v8: строка фазы для полосы босса и пульта: Печать (таймер и замки), Метки, Ярость
  function bossPhaseLine() {
    if (!BF) return '';
    const sl = BF.seal;
    if (sl && !sl.done) return `🔒 ПЕЧАТЬ ${Math.max(0, Math.ceil(sl.until - BF.t))}с · замки: ` + sl.locks.map(L => `${guildShort((BF.squads[L.sq] || {}).guild || '_solo').replace(/[«»]/g, '').split(' ')[0]} ${L.hp > 0 ? Math.round(100 * L.hp / L.max) + '%' : '✔'}`).join(' · ');
    const mk = (BF.marks || []).map(m => `🎯 ${m.id} ${Math.max(0, Math.ceil(m.at - BF.t))}с${m.cover ? ' (прикрыт ' + m.cover + ')' : ' — !прикрыть'}`);
    if (mk.length) return mk.slice(0, 3).join(' · ');
    if (BF.ph && BF.ph.n === 3) return `🔥 ЯРОСТЬ: урон босса +${Math.round((BF.enrage || 0) * 100)}%, лечение слабее`;
    return '';
  }
  function drawBossBar() {
    if (!bossFighting() || viewLoc() !== 'boss') return; // полоса — на вкладке босса
    const b = S.boss, w = 900, x = Math.round(W / 2 - w / 2), y = topPlace('bossbar', x - 20, w + 40, 108, 24) + 10;
    darkPlate(x - 20, y - 10, w + 40, 108);
    bar(x, y + 30, w, 26, b.hp / b.maxhp, '#b8362c');
    const n = Object.keys(BF.all).length - BF.reserve.length;
    text(`${b.name} — ${Math.round(b.hp)}/${b.maxhp} HP — в бою ${n}, запас ${BF.reserve.length} — ${fmtTime(b.endAt - now())}${b.enrage ? ` — ярость +${Math.round(b.enrage * 100)}%` : ''}`, W / 2, y + 12, 24, '#ffd0b0');
    const ph = bossPhaseLine(); if (ph) { let fs = 24; while (fs > 16 && measure(ph, fs) > w + 20) fs -= 1; text(ph, W / 2, y + 78, fs, BF.seal && !BF.seal.done ? '#e0c8ff' : BF.ph && BF.ph.n === 3 ? '#ffb070' : '#ffd0d0'); return; } // v8: фаза важнее счёта гильдий
    const rows = C.guilds.map(g => ({ g, d: (b.dmg || {})[g.id] || 0 })).filter(r => r.d > 0).sort((a, c) => c.d - a.d).slice(0, 4);
    rows.forEach((r, i) => { const xx = x + i * (w / 4); ctx.fillStyle = r.g.color; ctx.fillRect(xx + 6, y + 70, 16, 16); text(`${r.g.name.split(" ")[1] || r.g.name} ${r.d}`, xx + 30, y + 78, 22, '#fff2d0', 'left'); });
  }
  const IND = [];
  function drawIndicator() {
    const names = C.locationNames, cur = viewLoc();
    setFont(28); const items = LOCS.map((l, i) => ({ l, t: `${i + 1} ${names[l]}`, w: ctx.measureText(`${i + 1} ${names[l]}`).width + 40 + (l === 'boss' ? 34 : 0) }));
    const tot = items.reduce((s, i) => s + i.w, 0) + 8;
    let x = W - tot - 24; const y = H - 72, bh = 52;
    ctx.fillStyle = 'rgba(30,18,10,.78)'; ctx.fillRect(x - 6, y - 6, tot + 12, bh + 12);
    IND.length = 0;
    items.forEach(it => {
      const on = it.l === cur;
      ctx.fillStyle = on ? '#e8b04a' : 'rgba(255,240,210,.08)'; ctx.fillRect(Math.round(x + 4), y, Math.round(it.w - 4), bh);
      const sk = it.l === 'boss' ? 34 : 0; if (sk) drawSkull(x + 16, y + 14, 4, on ? '#2b1a0e' : (bossActive() ? '#ff8a6a' : '#f2e3c8'));
      text(it.t, x + 4 + sk + (it.w - 4 - sk) / 2, y + bh / 2 + 1, 28, on ? '#2b1a0e' : '#f2e3c8', 'center', on ? 0 : undefined);
      IND.push({ l: it.l, x: x + 4, y, w: it.w - 4, h: bh });
      x += it.w;
    });
    if (LOCKED) text('🔒', W - tot - 56, y + bh / 2, 28, '#fff');
  }
  const TIER_COL = { wooden: '#a8784a', silver: '#c8d0dc', golden: '#ffd24a', legendary: '#ff9a2a' };
  function drawModal(dt) {
    const m = MODALS[0]; if (!m) return;
    m.t += dt;
    const cx = Math.round(W / 2) + 160, cy = Math.round(H / 2);
    ctx.fillStyle = 'rgba(20,12,6,.45)'; ctx.fillRect(0, 0, W, H);
    if (m.type === 'chest') {
      const ch = C.chests[m.tier] || { name: 'Сундук' }, n = m.items.length, ph = 300 + n * 40;
      panel(cx - 420, cy - ph / 2, 840, ph, '#f2e3bd');
      ctx.fillStyle = TIER_COL[m.tier] || '#fff'; ctx.fillRect(cx - 420, cy - ph / 2, 840, 8);
      text(`${ch.name}: ${m.user}`, cx, cy - ph / 2 + 44, 38, '#5a3412', 'center', 0);
      if (m.t < 1.2) { if (!drawChestA(m.tier, cx + Math.round(Math.sin(m.t * 40) * 8 * (m.t / 1.2)), cy + ph / 2 - 30, 220, false, 0)) drawImg('chest', cx + Math.round(Math.sin(m.t * 40) * 8 * (m.t / 1.2)), cy + ph / 2 - 30, 180, { filter: m.tier === 'golden' || m.tier === 'legendary' ? 'sepia(.5) saturate(2) brightness(1.15)' : undefined }); }
      else {
        if (!drawChestA(m.tier, cx, cy + ph / 2 - 30, 220, true, m.t - 1.2)) drawImg('chest_open', cx, cy + ph / 2 - 30, 200);
        m.items.forEach((it, i) => { const a = clamp((m.t - 1.2 - i * .35) / .3, 0, 1); if (!a) return; ctx.save(); ctx.globalAlpha = a; const col = C.rarityColors[it.rarity] || '#4a2e18'; const yy = cy - ph / 2 + 100 + i * 40; ctx.fillStyle = col; ctx.fillRect(cx - 300, yy - 12, 10, 24); text(it.text, cx - 280, yy, 26, '#2a1a0e', 'left', 0); ctx.restore(); });
      }
      if (m.t > 2.4 + n * .35) MODALS.shift();
    } else if (m.type === 'bosswin') {
      panel(cx - 520, cy - 300, 1040, 600, '#f2e3bd');
      text(`Победа! ${m.boss} ${gv(m.boss,'повержен','повержена')}`, cx, cy - 240, 48, '#7a2a10', 'center', 0);
      const g = m.guild && guildById(m.guild);
      text(`Отряд: ${m.n} героев${g ? ` · лучшая гильдия: ${g.name}` : ''}`, cx, cy - 180, 28, '#4a2e18', 'center', 0);
      const s = m.t < 1.4 ? 'chest' : 'chest_open';
      if (m.t < 1.4) { if (!drawChestA('golden', cx + Math.round(Math.sin(m.t * 40) * 10 * (m.t / 1.4)), cy + 200, 180, false, 0)) drawImg(s, cx + Math.round(Math.sin(m.t * 40) * 10 * (m.t / 1.4)), cy + 200, 240, { filter: 'sepia(.5) saturate(2) brightness(1.15)' }); }
      else {
        if (!drawChestA('golden', cx, cy + 220, 200, true, m.t - 1.4)) drawImg(s, cx, cy + 220, 270, { filter: 'sepia(.5) saturate(2) brightness(1.15)' });
        for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + m.t, r = 80 + (m.t - 1.4) * 120; ctx.fillStyle = k % 2 ? '#ffd24a' : '#fff6b0'; ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + 60 + Math.sin(a) * r * .5), 10, 10); }
        text('Золото, материалы и серебряные сундуки — всему отряду', cx, cy - 110, 26, '#2f6a2a', 'center', 0);
        if (g) { drawImg('trophy_boss', cx - 360, cy + 220, 150); text(`Трофей недели: «${g.name}»`, cx, cy - 66, 26, '#8a3a12', 'center', 0); }
      }
      if (m.t > 6.5) MODALS.shift();
    } else MODALS.shift();
  }


  // ===================== КАМЕРА =====================
  const CAM = { x: 0, from: 0, to: 0, t: 1, loc: LOCKED || 'camp', holdUntil: 0, dwellT: 0 };
  const locX = l => LOCS.indexOf(l) * W;
  function viewLoc() { return CAM.loc; }
  const bossLock = () => C.camera.bossLock !== false && S && S.boss && S.boss.phase === 'fight' && BF; // v6.55 п.11: во время боя с боссом вид не уходит с логова
  function setCamera(loc, hold, force) {
    if (!LOCS.includes(loc)) return { ok: false, msg: 'локации: ' + LOCS.join(', ') };
    if (!force && loc !== 'boss' && bossLock()) { if (tm - (CAM.lockMsgT || -9) > 3) { CAM.lockMsgT = tm; log('Идёт бой с боссом — смена сцены заблокирована до конца боя', '#ffb08a'); } if (CAM.loc !== 'boss') setCamera('boss', true, true); return { ok: false, msg: 'идёт бой с боссом — смена сцены заблокирована (стример: forceLoc)' }; }
    if (LOCKED && loc !== LOCKED) return { ok: false, msg: 'вид закреплён ?loc=' + LOCKED };
    if (hold) CAM.holdUntil = tm + (C.camera.manualHoldSeconds || 60);
    if (CAM.loc === loc) return { ok: true };
    CAM.loc = loc; CAM.from = CAM.x; CAM.to = locX(loc); CAM.t = 0; CAM.dwellT = 0;
    return { ok: true };
  }
  function activity(l) { return ACT[l] + 0.5 * heroesIn(l).length + (l === 'forest' ? 2 * BATTLES.length + (bossActive() ? 0.5 : 0) : 0); }
  function cameraTick(dt) {
    for (const l in ACT) ACT[l] *= Math.exp(-dt / 20);
    if (CAM.t < 1) { CAM.t = Math.min(1, CAM.t + dt / (C.camera.slideSeconds || 0.9)); const e = CAM.t < .5 ? 4 * CAM.t ** 3 : 1 - Math.pow(-2 * CAM.t + 2, 3) / 2; CAM.x = CAM.from + (CAM.to - CAM.from) * e; }
    else CAM.x = locX(CAM.loc);
    if (LOCKED) return;
    // слежение за выбранным героем: камера переходит туда, где он сейчас; авто-тур на паузе
    const fh = FOLLOW && ACTIVE && S.heroes[ACTIVE];
    if (fh) {
      const rt = ensureRT(fh), L = rt.mode === 'sleep' || rt.mode === 'enter' ? 'camp' : rt.loc;
      if (L !== CAM.followLoc) { CAM.followLoc = L; setCamera(L); }
      return;
    }
    CAM.followLoc = null;
    if (!C.camera.autoTour || tm < CAM.holdUntil) return;
    CAM.dwellT += dt; if (CAM.dwellT < (C.camera.dwellSeconds || 20)) return;
    CAM.dwellT = 0;
    let best = CAM.loc, bs = -1; for (const l of LOCS) { const s = activity(l) + (l === CAM.loc ? -0.5 : 0); if (s > bs) { bs = s; best = l; } }
    setCamera(best);
  }

  // ===================== ЦИКЛ =====================
  let FOLLOW = C.camera.followSelected === true;
  let lastT = 0, saveT = 0, farmT = 0, bossT = 0, snapT = 0;
  function update(dt) {
    const sp = C.speedSteps[speedIdx];
    S.clock += dt * sp;
    farmT += dt; if (farmT > 0.25) { farmT = 0; farmTick(); }
    bossT += dt; if (bossT >= 0.2) { const g = bossT * sp; bossT = 0; bossTick(g); }
    cookTick(dt * sp);
    const vdt = dt * Math.min(sp, 4), WS = C.walkSpeed || 405;
    const regenSeat = 0.02 * (1 + bEff('campfire', 'regen')), regenSleep = regenSeat; // v7panel16: палатка на реген не влияет
    const CRG = CAMPRG(), crOn = CRG.enabled === true, kSeat = CRG.k * (1 + CRG.fire * bEq('campfire', bLv('campfire'))), kSleep = kSeat; // v7panel16: только костёр, для всех (палатка на реген не влияет) // v7panel15: медленный реген в лагере (флаг, по умолчанию выкл)
    for (const n of S.order) {
      const h = S.heroes[n], rt = ensureRT(h), st = stats(h);
      if (rt.path.length) {
        const tg = rt.path[0], dx = tg.x - rt.x, dy = tg.y - rt.y, d = Math.hypot(dx, dy), v = (rt.ghost ? 150 : WS) * vdt;
        if (Math.abs(dx) > 2) rt.flip = dx < 0;
        rt.walkT += vdt;
        if (d <= v) { rt.x = tg.x; rt.y = tg.y; rt.path.shift(); if (!rt.path.length) { const cb = rt.onArrive; rt.onArrive = null; if (cb) cb(); } }
        else { rt.x += dx / d * v; rt.y += dy / d * v; }
      } else if (rt.work !== null && rt.work !== undefined) { rt.work -= vdt; if (rt.work <= 0) rt.work = null; }
      else if (rt.mode === 'seat') {
        const i = S.seats.indexOf(n);
        if (i < 0 || i >= seatCount()) goSleep(h);
        else {
          const p = seatXY(i); if (Math.hypot(p.x - rt.x, p.y - rt.y) > 4) { walkPath(h, B6.camp ? route6('camp', rt.x, rt.y, p.x, p.y) : route('camp', rt.x, rt.y, p.x, p.y), () => { rt.mode = 'seat'; }); }
          const sl = campSlot(i); rt.sit6 = !!(sl && sl.type === 'sit') && sit6Ok(h); rt.flip = sl ? sl.face === 'L' : rt.x > FIRE.x;
          rt.idleT -= dt; if (rt.idleT <= 0) { rt.idleT = R(8, 20); if (Math.random() < .35) say(h, pick(C.campPhrases), 2.5); }
        }
      } else if ((rt.mode === 'garden' || rt.mode === 'visit') && !rt.dest && rt.stayUntil && tm > rt.stayUntil) goCamp(h);
      if ((rt.mode === 'seat' || rt.mode === 'sleep') && h.rpg_hp < st.maxhp) { if (crOn) { const miss = st.maxhp - h.rpg_hp; h.rpg_hp = miss < 1 ? st.maxhp : h.rpg_hp + miss * (1 - Math.exp(-(rt.mode === 'sleep' ? kSleep : kSeat) * dt * sp)); } else h.rpg_hp = Math.min(st.maxhp, h.rpg_hp + st.maxhp * (rt.mode === 'sleep' ? regenSleep : regenSeat) * dt * sp); }
      if (rt.bubble) { rt.bubbleT -= dt; if (rt.bubbleT <= 0) nextBubble(rt); }
      else if (rt.queue.length) nextBubble(rt);
      if (rt.out6) { rt.fade = (rt.fade === undefined ? 1 : rt.fade) - dt / 0.5; if (rt.fade <= 0) { rt.fade = 0; const f = rt.out6; rt.out6 = null; f(); } }
      else if (rt.mode === 'enter') { rt.fade = (rt.fade === undefined ? 1 : rt.fade) - dt / 0.6; if (rt.fade <= 0) { rt.fade = 0; rt.mode = 'sleep'; } }
      else if (rt.mode !== 'sleep' && (rt.fade === undefined || rt.fade < 1)) rt.fade = Math.min(1, (rt.fade || 0) + dt / 0.6);
      if (rt.mode !== 'seat' || rt.path.length) rt.sit6 = false;
      if (rt.harvest && tm > rt.harvest.until) harvestFX(h);
      if (rt.hit > 0) rt.hit -= dt;
      if (rt.lunge > 0) rt.lunge -= vdt;
    }
    const gDone = new Set(), mDone = new Set();
    for (const b of BATTLES.slice()) { if (b.G) { if (!gDone.has(b.G)) { gDone.add(b.G); groupTick(b.G, vdt); } } else battleTick(b, vdt); }
    for (const b of BATTLES) if (b.mon && !mDone.has(b.mon)) { mDone.add(b.mon); if (b.mon.hit > 0) b.mon.hit -= dt; if (b.mon.atkT > 0) b.mon.atkT -= dt; if (b.mon.dead) b.mon.dead += vdt; }
    partyTick(); expQueueTick(); g9Tick(); // v9 /* v6.57: partyTick раньше не вызывался — старт по таймеру не срабатывал */
    tickFX(dt); cameraTick(dt);
    saveT += dt; if (saveT > 4) { saveT = 0; save(); }
    snapT += dt; if (snapT > 1) { snapT = 0; renderHUD(); }
  }
  // v6.33 ЭКСПЕРИМЕНТ: приближение мира (C.worldZoom или ?zoom=1.3). UI — в экранных координатах.
  const ZOOM = (() => { const q = parseFloat(new URLSearchParams(location.search).get('zoom')); const z = q > 0 ? q : (+C.worldZoom || 1); return Math.max(1, Math.min(2, z)); })();
  const ZS = {}; let ZC = null, ZBASE = null; // ZS[loc] = сглаженный фокус {x,y,z}; ZC — фокус текущей отрисовки
  function zoomTarget(l) {
    const pts = [];
    if (l === 'forest') BATTLES.forEach(bt => { if (bt.mon) pts.push([bt.mon.x, bt.mon.y - 80]); const h = S.heroes[bt.user]; if (h && ensureRT(h).loc === 'forest') { const rt = ensureRT(h); pts.push([rt.x, rt.y - 80]); } });
    if (l === 'boss' && S.boss && S.boss.phase !== 'wait') { const bp = SPOT('boss', 'boss'); pts.push([bp.x - 120, bp.y - 470], [bp.x + 120, bp.y]); } // v6.34: голова и ноги босса — в рамку
    const hs = heroesIn(l); if (!pts.length || l === 'boss') hs.forEach(h => { const rt = ensureRT(h); pts.push([rt.x, rt.y - 80]); });
    let x = W / 2, y = H * 0.55; if (pts.length) { x = pts.reduce((a, p) => a + p[0], 0) / pts.length; y = pts.reduce((a, p) => a + p[1], 0) / pts.length; }
    let z = 1 + (ZOOM - 1) * Math.max(0.4, Math.min(1, 1 - (hs.length - 5) / 25)); // много героев — камера слегка отъезжает
    if (pts.length > 1) { const sx = Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])), sy = Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1])); z = Math.min(z, Math.max(1, W * 0.85 / (sx + 260)), Math.max(1, H * 0.8 / (sy + 320))); }
    if (!hs.length && !(l === 'forest' && BATTLES.some(b => b.mon))) z = 1; // v6.34: нет героев — без приближения
    if (l === 'boss' && pts.length) { // v6.34: всё (голова босса, крайний правый герой) — левее легенды (x ≥ 1870) и ниже полосы HP
      const L = 60, R = 2080, T = 190, Bt = H - 200, x0 = Math.min(...pts.map(p => p[0])) - 70, x1 = Math.max(...pts.map(p => p[0])) + 70, y0 = Math.min(...pts.map(p => p[1])) - 40, y1 = Math.max(...pts.map(p => p[1])) + 130;
      z = Math.max(1, Math.min(z, (R - L) / (x1 - x0), (Bt - T) / (y1 - y0)));
      x = (x0 + x1) / 2 - ((L + R) / 2 - W / 2) / z; y = (y0 + y1) / 2 - ((T + Bt) / 2 - H / 2) / z;
    }
    return { x, y, z };
  }
  function zoomFocus(l, dt) {
    const t = zoomTarget(l), f = ZS[l] || (ZS[l] = { ...t }), a = Math.min(1, (dt || 0.016) * 2);
    f.x += (t.x - f.x) * a; f.y += (t.y - f.y) * a; f.z += (t.z - f.z) * a;
    const hw = W / 2 / f.z, hh = H / 2 / f.z; f.x = clamp(f.x, hw, W - hw); f.y = clamp(f.y, hh, H - hh); return f;
  }
  const zw2s = (x, y) => ZC ? [(x - ZC.x) * ZC.z + W / 2, (y - ZC.y) * ZC.z + H / 2] : [x, y];
  const zs2w = (x, y) => ZC ? [(x - W / 2) / ZC.z + ZC.x, (y - H / 2) / ZC.z + ZC.y] : [x, y];
  let ZWT = null; function zoomUI(fn) { if (!ZC) return fn(); const tf = ctx.getTransform(), pw = ZWT; ZWT = tf; ctx.setTransform(ZBASE); try { return fn(); } finally { ctx.setTransform(tf); ZWT = pw; } }
  function zoomWorld(fn) { if (!ZC || !ZWT) return fn(); const tf = ctx.getTransform(); ctx.setTransform(ZWT); try { return fn(); } finally { ctx.setTransform(tf); } }
  function zoomAt(rt, fn) { if (!ZC) return fn(); const ox = rt.x, oy = rt.y, [sx, sy] = zw2s(ox, oy); rt.x = sx; rt.y = sy; try { zoomUI(fn); } finally { rt.x = ox; rt.y = oy; } }
  function drawLoc(l, off) {
    ctx.save(); ctx.translate(off, 0);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); // v6.51b: сцена не вылезает за свой кадр (туман логова не залезает в лес при перелёте камеры)
    ZC = null; const zw = 1 - Math.min(1, Math.abs(off) / W); // v6.34: при перелёте камеры приближение плавно растёт/спадает
    if (ZOOM > 1 && zw > 0) { const f = zoomFocus(l, 0.016), z = 1 + (f.z - 1) * zw * zw * (3 - 2 * zw); if (z > 1.001) { ZBASE = ctx.getTransform(); const hw = W / 2 / z, hh = H / 2 / z; ZC = { x: clamp(f.x, hw, W - hw), y: clamp(f.y, hh, H - hh), z }; if (off !== 0) { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); } ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-ZC.x, -ZC.y); } }
    ZLIVE[l] = ZC ? ZC.z : 1;
    const hov0 = HOVER.length;
    if (!TRANSPARENT) ctx.drawImage(bgFor(l === 'boss' ? lairKey() : l), 0, 0, W, H);
    const LK = l === 'boss' ? lairKey() : l; // v8.7: у логова — свой живой фон (огр / Королева / Трентов)
    if (!TRANSPARENT && window.LIVE6 && LIVE6.has(LK)) { try { LIVE6.draw(ctx, LK, IMG['bg_' + LK], 0); } catch (e) { console.warn('live6', e); } } // v8.6: живой фон (небо, костёр, флаги…)
    SCENES[l]();
    if (!TRANSPARENT && window.LIVE6 && LIVE6.drawTop) { try { LIVE6.drawTop(ctx, LK); } catch (e) { console.warn('live6 top', e); } } // v8.7: пёсик/котик поверх героев
    flushLab(); // v6.34: подписи при zoom — в очереди, дорисовываем
    drawFX(0, l);
    const bubs = S.order.map(n => S.heroes[n]).filter(h => { const rt = ensureRT(h); return rt.loc === l && rt.mode !== 'sleep' && rt.bubble; });
    S.order.map(n => S.heroes[n]).filter(h => h && PARTYQ.users.includes(h.user) && (() => { const rt = ensureRT(h); return rt.loc === l && rt.mode !== 'sleep' && !rt.bubble; })()).forEach(h => zoomAt(ensureRT(h), () => drawPartyTag(h))); // v7panel4 п.1
    bubs.sort((a, b) => RT[a.user].y - RT[b.user].y).forEach(h => zoomAt(ensureRT(h), () => drawBubble(h)));
    if (ZC) { for (let i = hov0; i < HOVER.length; i++) { const o = HOVER[i], [x1, y1] = zw2s(o.x, o.y), [ax, ay] = zw2s(o.ax, o.ay); o.x = x1; o.y = y1; o.w *= ZC.z; o.h *= ZC.z; o.ax = ax; o.ay = ay; } if (off === 0) ZVIEW = ZC; }
    ctx.restore(); ZC = null;
  }
  let ZVIEW = null; const ZLIVE = {}; // v6.34: фактический z каждой видимой локации в кадре (для тестов перелёта)
  function render(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(K, 0, 0, K, 0, 0); ctx.imageSmoothingEnabled = false;
    HOVER.length = 0; LBL6.length = 0; BUB6.length = 0; TOP6.length = 0; for (const k in BOX6) delete BOX6[k]; LABQ.length = 0; PANELS6.length = 0;
    const vis = [];
    LOCS.forEach(l => { const off = Math.round((locX(l) - CAM.x) * K) / K; if (off > -W && off < W) vis.push([l, off]); });
    if (ZOOM > 1 && !vis.some(v => v[1] === 0)) ZVIEW = null;
    for (const k in ZLIVE) delete ZLIVE[k];
    vis.forEach(([l, off]) => drawLoc(l, off));
    if (CAM.t >= 1) drawMenu(CAM.loc);
    drawBanner(); drawQueuePlate(); drawBossBar(); BANNER_BOT = Math.max(BANNER_BOT, topBottom()); drawIndicator(); drawCombatLog(CAM.loc); drawLootPopup(dt); if (RECAP) drawRecap(); else drawStreamCard();
    drawSharpFx(dt); drawModal(dt);
  }
  function frame(t) {
    const dt = Math.min(0.1, Math.max(0, (t - lastT) / 1000)); lastT = t; tm += dt;
    const t0 = performance.now();
    try { update(dt); render(dt); } catch (e) { console.error(e); }
    FT_EMA = FT_EMA * 0.95 + (performance.now() - t0) * 0.05; window.__ft = FT_EMA;
    requestAnimationFrame(frame);
  }
  function goLoc(l) {
    if (FOLLOW && ACTIVE && S.heroes[ACTIVE]) { const rt = ensureRT(S.heroes[ACTIVE]); const L = rt.mode === 'sleep' || rt.mode === 'enter' ? 'camp' : rt.loc; if (L !== l) { FOLLOW = false; CAM.followLoc = null; } }
    return setCamera(l, true);
  }
  function setActive(nick, moveCam) {
    const n = findNick(nick); ACTIVE = n || '';
    if (n && moveCam && !FOLLOW) { const rt = ensureRT(S.heroes[n]); setCamera(rt.mode === 'sleep' ? 'camp' : (rt.dest ? rt.dest.loc : rt.loc), true); }
    refreshUI(); return { ok: !!n };
  }

  // ===================== HUD ЗРИТЕЛЯ (DOM, слева внизу) =====================
  const $ = id => document.getElementById(id);
  let hudTab = 'town', hudSub = { town: 'up', garden: 'food', forest: 'exp' }, hudT = 0;
  const HUD_TABS = [['town', 'Город'], ['garden', 'Огород'], ['camp', 'Лагерь'], ['forest', 'Лес'], ['boss', '☠ Босс'], ['guild', 'Гильдия']];
  const HUD_SUBS = { town: [['up', 'Улучшения'], ['quest', 'Квесты']], garden: [['food', 'Еда'], ['potion', 'Зелья']], forest: [['exp', 'Поход']] };
  const hbar = (v, max, col) => `<span class="bar"><i style="width:${Math.max(0, Math.min(100, v / Math.max(1, max) * 100)).toFixed(0)}%;background:${col || '#e8b84a'}"></i></span>`;
  const hbtn = (cmd, label, dis, title) => `<button data-cmd="${esc(cmd)}"${dis ? ' disabled' : ''}${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</button>`;
  const VEG = { cucumber: 'огурцы', tomato: 'помидоры', carrot: 'морковь', eggplant: 'баклажаны', pumpkin: 'тыква', weed: 'сорняк' };
  // v6.55 п.12b: пиксельные иконки 16×16 (рисуются кодом, кешируются в dataURL), показываются ×2 с image-rendering:pixelated
  const PXI = {};
  // v6.57c: иконки Shikashi's Fantasy Icons Pack (32x32, CC BY 3.0) вместо самодельных 16px; цвет тира — рамка-уголок
  const SHK = { ingot: 275, wood: 272, stone: 273, food: 241, sword: 81, armor: 116, shield: 97, amulet: 134, bow: 99, dagger: 86, staff: 107, quiver: 100, tome: 214, bracer: 129, leather: 118, robe: 126, aura: 5, trail: 60, seed: 196, ring: 133, coins: 199, chest: 187 };
  const SHK_COL = { veg: { '#4caf50': 226, '#e04a3a': 233, '#f08a24': 230, '#7a4ab8': 234, '#f0a030': 227, '#6b8e23': 191 }, potion: { '#e04a3a': 144, '#ff5a5a': 144, '#5aa0ff': 145, '#4caf50': 146, '#7dff9a': 146 }, staff: { '#ff8af0': 105, '#ffd24a': 107, '#7ab8ff': 104 }, seed: { '#c58aff': 197 }, dye: {} };
  function shkIcon(kind, col) {
    const im = IMG.ico_shk; if (!im || !im.width || isPH('ico_shk')) return null;
    let i = (SHK_COL[kind] || {})[col]; if (i === undefined) i = SHK[kind];
    if (kind === 'potion' && i === undefined) i = 147; if (kind === 'dye') i = 152; if (kind === 'veg' && i === undefined) i = 230; if (i === undefined) return null;
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    if (kind === 'ingot') x.filter = 'grayscale(1) brightness(1.2)'; // v7panel20 п.7: железный (серый) слиток, тот же набор, что бревно/камень
    x.drawImage(im, (i % 16) * 32, Math.floor(i / 16) * 32, 32, 32, 0, 0, 32, 32);
    if (/^(sword|armor|shield|amulet|bow|dagger|staff|quiver|tome|bracer|leather|robe|ring)$/.test(kind) && col) { x.fillStyle = '#2a1a0c'; x.fillRect(25, 25, 7, 7); x.fillStyle = col; x.fillRect(26, 26, 5, 5); }
    if ((kind === 'aura' || kind === 'trail' || kind === 'dye') && col) { x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.45; x.fillStyle = col; x.fillRect(0, 0, 32, 32); }
    try { return c.toDataURL(); } catch (e) { return null; } // v7panel8: file:// — холст с картинкой «грязный» → свои 16px
  }
  function pxIcon(kind, col) {
    const key = (C.invIcons === 'shikashi' ? 'S:' : '') + kind + col; if (PXI[key]) return PXI[key];
    { const u = C.invIcons === 'shikashi' && shkIcon(kind, col); if (u) return (PXI[key] = u); } // v7panel8 п.8: по умолчанию прежние 16px-иконки v6.55–v6.57; C.invIcons:'shikashi' — иконки Shikashi 32px (v6.57c)
    const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); const R = (a, b, w, h, f) => { x.fillStyle = f; x.fillRect(a, b, w, h); };
    const dk = '#2a1a0c';
    if (kind === 'ingot') { R(3, 7, 10, 5, dk); R(4, 6, 8, 1, dk); R(4, 7, 8, 4, col); R(5, 7, 6, 1, '#fff8'); R(4, 10, 8, 1, '#0004'); }
    else if (kind === 'wood') { R(2, 5, 12, 7, dk); R(3, 6, 10, 5, col); R(3, 8, 10, 1, '#0003'); R(11, 6, 2, 5, '#e9c48a'); R(12, 8, 1, 1, '#8a5a2a'); }
    else if (kind === 'stone') { R(3, 5, 10, 8, dk); R(2, 7, 12, 5, dk); R(4, 6, 8, 6, col); R(3, 8, 10, 3, col); R(5, 6, 3, 2, '#fff5'); }
    else if (kind === 'veg') { R(5, 4, 6, 10, dk); R(4, 6, 8, 6, dk); R(5, 6, 6, 7, col); R(6, 5, 4, 8, col); R(6, 6, 1, 3, '#fff6'); R(7, 1, 2, 4, '#3f9a3a'); }
    else if (kind === 'potion') { R(6, 2, 4, 2, '#c9a27a'); R(6, 4, 4, 2, dk); R(4, 6, 8, 8, dk); R(5, 7, 6, 6, col); R(5, 7, 6, 2, '#fff4'); R(6, 8, 1, 2, '#fff8'); }
    else if (kind === 'food') { R(2, 8, 12, 5, dk); R(3, 9, 10, 3, '#c98a4a'); R(4, 6, 8, 3, col); R(5, 5, 2, 2, '#fff8'); }
    else if (kind === 'sword') { for (let i = 0; i < 9; i++) R(4 + i, 11 - i, 2, 2, dk); for (let i = 0; i < 8; i++) R(5 + i, 11 - i, 1, 1, col); R(2, 10, 5, 2, dk); R(4, 8, 2, 6, dk); R(3, 12, 2, 2, '#8a5a2a'); R(13, 2, 1, 1, '#fff'); }
    else if (kind === 'armor') { R(3, 3, 10, 11, dk); R(1, 3, 3, 5, dk); R(12, 3, 3, 5, dk); R(4, 4, 8, 9, col); R(2, 4, 2, 3, col); R(12, 4, 2, 3, col); R(6, 3, 4, 2, dk); R(5, 6, 6, 1, '#fff5'); R(7, 7, 2, 6, '#0003'); }
    else if (kind === 'shield') { R(3, 2, 10, 8, dk); R(4, 10, 8, 2, dk); R(6, 12, 4, 2, dk); R(4, 3, 8, 7, col); R(5, 10, 6, 1, col); R(7, 11, 2, 2, col); R(7, 3, 2, 9, '#ffd24a'); R(4, 6, 8, 1, '#ffd24a'); }
    else if (kind === 'amulet') { R(4, 1, 1, 6, '#c9a24a'); R(11, 1, 1, 6, '#c9a24a'); R(5, 7, 1, 1, '#c9a24a'); R(10, 7, 1, 1, '#c9a24a'); R(5, 8, 6, 6, dk); R(6, 9, 4, 4, col); R(7, 9, 1, 1, '#fff'); }
    else if (kind === 'bow') { for (let i = 0; i < 10; i++) { const yy = 2 + i, xx = 5 + Math.round(Math.abs(i - 4.5) * -0.9 + 4); R(xx - 1, yy, 3, 1, dk); R(xx, yy, 1, 1, col); } R(5, 2, 1, 11, '#e8e0c8'); R(3, 7, 9, 1, '#8a5a2a'); R(12, 6, 2, 3, dk); }
    else if (kind === 'dagger') { for (let i = 0; i < 6; i++) R(6 + i, 9 - i, 2, 2, dk); for (let i = 0; i < 5; i++) R(7 + i, 9 - i, 1, 1, col); R(4, 9, 5, 2, dk); R(5, 10, 2, 4, '#8a5a2a'); }
    else if (kind === 'staff') { R(7, 4, 2, 11, dk); R(7, 5, 1, 10, '#a8743a'); R(5, 1, 6, 5, dk); R(6, 2, 4, 3, col); R(7, 2, 1, 1, '#fff'); }
    else if (kind === 'quiver') { R(5, 4, 6, 11, dk); R(6, 5, 4, 9, '#8a5a2a'); R(6, 7, 4, 1, col); R(6, 1, 1, 4, '#e8e0c8'); R(9, 1, 1, 4, '#e8e0c8'); R(5, 1, 3, 1, col); R(8, 1, 3, 1, col); }
    else if (kind === 'tome') { R(3, 3, 10, 11, dk); R(4, 4, 8, 9, col); R(4, 4, 1, 9, '#0004'); R(7, 6, 3, 3, '#ffd24a'); R(11, 4, 1, 9, '#e8e0c8'); }
    else if (kind === 'bracer') { R(3, 5, 10, 7, dk); R(4, 6, 8, 5, col); R(4, 8, 8, 1, '#0004'); R(6, 6, 1, 5, '#fff5'); }
    else if (kind === 'leather') { R(3, 3, 10, 11, dk); R(4, 4, 8, 9, '#8a5a2a'); R(2, 4, 2, 3, '#8a5a2a'); R(12, 4, 2, 3, '#8a5a2a'); R(4, 9, 8, 1, col); R(7, 4, 2, 9, '#0003'); }
    else if (kind === 'robe') { R(4, 2, 8, 13, dk); R(5, 3, 6, 11, col); R(3, 13, 10, 2, dk); R(4, 13, 8, 1, col); R(7, 3, 2, 3, '#0004'); R(5, 8, 6, 1, '#ffd24a'); }
    else if (kind === 'aura') { R(7, 1, 2, 2, col); R(2, 5, 2, 2, col); R(12, 5, 2, 2, col); R(1, 10, 2, 2, col); R(13, 10, 2, 2, col); R(5, 6, 6, 8, dk); R(6, 7, 4, 6, '#6a5a4a'); R(6, 3, 4, 3, dk); R(4, 13, 2, 2, col); R(10, 13, 2, 2, col); }
    else if (kind === 'dye') { R(3, 6, 10, 8, dk); R(4, 7, 8, 6, col); R(4, 7, 8, 2, '#fff4'); R(2, 4, 12, 2, dk); R(3, 4, 10, 1, '#8a6a4a'); R(7, 1, 2, 4, '#c9a27a'); }
    else if (kind === 'trail') { [[2, 12], [5, 10], [8, 11], [11, 8], [13, 5]].forEach(([a, b], i) => { R(a, b, 2, 2, dk); R(a, b, 2, 2, i % 2 ? col : '#fff8'); }); R(12, 2, 3, 3, dk); R(12, 2, 2, 2, col); }
    else if (kind === 'seed') { R(6, 5, 4, 7, dk); R(5, 7, 6, 4, dk); R(6, 6, 4, 5, col); R(6, 7, 1, 2, '#fff6'); if (col === '#c58aff') { R(2, 3, 1, 1, '#fff'); R(13, 4, 1, 1, '#fff'); R(12, 12, 1, 1, '#fff'); } }
    return (PXI[key] = c.toDataURL());
  }
  const INV_ICON = { wood: ['wood', '#a8743a'], stone: ['stone', '#9aa0a6'], iron: ['ingot', '#c9d4dc'], cucumber: ['veg', '#4caf50'], tomato: ['veg', '#e04a3a'], carrot: ['veg', '#f08a24'], eggplant: ['veg', '#7a4ab8'], pumpkin: ['veg', '#f0a030'], weed: ['veg', '#6b8e23'] };
  const EQ_ICON = { weapon: 'sword', armor: 'armor', offhand: 'shield', trinket: 'amulet', ring1: 'ring', ring2: 'ring' }, EQT_COL = ['#9aa0a6', '#c9d4dc', '#7ab8ff', '#ffd24a', '#ff8af0', '#d4a5ff', '#a5d4ff'];
  const ATYPE_IC = { heavy: 'armor', leather: 'leather', light: 'robe' };
  // v7panel21 п.1: иконки DCSS 32px (CC0) + слиток/бревно Idylwild — по умолчанию; C.invIcons:'pixel' — прежние 16px, 'shikashi' — Shikashi
  const DCSS_ON = () => !C.invIcons || C.invIcons === 'dcss';
  const DCSS_HAS = new Set('w1 w2 w3 w4 b1 b2 b3 b4 d1 d2 d3 d4 s1 s2 s3 s4 a1 a2 a3 a4 l1 l2 l3 l4 c1 c2 c3 c4 o1 o2 o3 o4 r1 r2 r3 r4 q1 q2 q3 q4 k1 k2 k3 k4 g1 g2 g3 g4 t1 t2 t3 wood stone iron pot_red pot_green pot_gold pot_blue pot_purple'.split(' '));
  const DCSS_POT = { minorheal: 'pot_red', herbtea: 'pot_green', vigor: 'pot_gold', heal: 'pot_red', luck: 'pot_blue', elixir: 'pot_purple' };
  // v7panel35: equipIcons2 — иконки DCSS для колец/амулетов без своей картинки (assets/icons/eq2/). По умолчанию ВЫКЛ: equipIcons2: { enabled: true } в config.
  //   Выбор: map[id] → иначе по главному стату (ring_atk/hp/def/mag/dodge/crit, amu_…) → иначе по тиру bs (ring_b1…b5, amu_b1…b5).
  const EQI2 = () => { const v = C.equipIcons2; return v === undefined || v === null || v === true || !!(v && v.enabled !== false); }; // v7panel37: ВКЛ по умолчанию (Tim одобрила); выкл: equipIcons2: { enabled: false }
  const EQI2_HAS = new Set('ring_b1 ring_b2 ring_b3 ring_b4 ring_b5 ring_atk ring_hp ring_def ring_mag ring_dodge ring_crit amu_b1 amu_b2 amu_b3 amu_b4 amu_b5 amu_atk amu_hp amu_def amu_mag amu_dodge amu_crit'.split(' '));
  function eq2Key(id) { if (!EQI2()) return ''; const it = eqItem(id); if (!it || !/^(ring1|ring2|trinket)$/.test(it.slot)) return '';
    const m = (C.equipIcons2 && C.equipIcons2.map) || {}; if (m[id] && EQI2_HAS.has(m[id])) return m[id];
    const pre = /^ring/.test(it.slot) || it.kind === 'ring' || /кольц/i.test(it.name || '') ? 'ring_' : 'amu_';
    const sc = { atk: +it.atk || 0, hp: (+it.hp || 0) / 5, def: +it.def || 0, mag: +it.mag || 0, dodge: (+it.dodge || 0) * 50, crit: (+it.crit || 0) * 50 }, best = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
    const two = Object.values(sc).filter(v => v > 0).length; // одна характеристика — значок по стату, несколько — по тиру
    return two === 1 && best[1] > 0 ? pre + best[0] : pre + 'b' + Math.min(5, Math.max(1, +it.bs || 1)); }
  // v7panel37: разные вещи — разные иконки. Если ключ уже занят другой вещью, берём свободный ключ того же типа (кольцо/амулет), а когда свободные кончились — тот же значок с другим оттенком (hue-rotate).
  let EQH_CACHE = null, EQH_SRC = null;
  function eqIconMap() { const L = EQ().items, sig = L.map(i => i.id + ':' + i.slot).join('|') + EQI2() + JSON.stringify((C.equipIcons2 && C.equipIcons2.map) || {}); if (EQH_CACHE && EQH_SRC === sig) return EQH_CACHE;
    const used = {}, out = {}, mapOf = (C.equipIcons2 && C.equipIcons2.map) || {};
    L.forEach(it => { if (DCSS_HAS.has(it.id) && !mapOf[it.id]) used[it.id] = (used[it.id] || 0) + 1; });
    const ALL = [...EQI2_HAS];
    L.forEach(it => { const k = eq2Key(it.id); if (!k || DCSS_HAS.has(it.id) && !mapOf[it.id]) return; let key = k;
      if (used[key] && !mapOf[it.id]) { const free = ALL.find(x => x.slice(0, 4) === k.slice(0, 4) && !used[x]); if (free) key = free; }
      const n = used[key] || 0; used[key] = n + 1; out[it.id] = { k: key, hue: n ? (n * 67) % 360 : 0 }; });
    EQH_SRC = sig; EQH_CACHE = out; return out; }
  const eqHue = id => (eqIconMap()[id] || {}).hue || 0;
  const eqIcSpec = id => { const k = DCSS_ON() && dcKey(id); if (!k) return ''; const h = eqHue(id); return k + (h ? '~' + h : ''); }; // для пульта: 'ring_atk~67'
  const dcKey = id => DCSS_HAS.has(id) && !(EQI2() && C.equipIcons2 && C.equipIcons2.map && C.equipIcons2.map[id]) ? id : DCSS_POT[id] || (eqIconMap()[id] || {}).k || eq2Key(id) || (recipeById(id) && recipeById(id).kind === 'potion' ? 'pot_red' : '');
  const dcSrc = id => { const k = DCSS_ON() && dcKey(id); return k ? (EQI2_HAS.has(k) ? 'assets/icons/eq2/' : 'assets/icons/dcss/') + k + '.png' : ''; };
  window.__dcSrc = dcSrc;
  const eqIc = it => [it.kind || ATYPE_IC[it.atype] || EQ_ICON[it.slot], EQT_COL[it.bs] || '#ccc'];
  // v7panel11: овощи в инвентаре — настоящие спрайты огорода (crop_*), а не пиксельная заглушка 'veg' (была похожа на склянку)
  function vegSrc(id) { const i = IMG['crop_' + id]; if (!i || (window.Assets.isPlaceholder || {})['crop_' + id]) return ''; try { return i.src || (i.toDataURL && i.toDataURL()) || ''; } catch (e) { return ''; } }
  let invTab = 'mat';
  function invPanel(h, cols) {
    const it = []; eqOf(h);
    if (invTab === 'mat') { C.materials.forEach(m => it.push({ ic: INV_ICON[m.id] || ['stone', '#999'], src: dcSrc(m.id), dc: 1, n: h.rpg_mats[m.id] || 0, name: m.name, tip: m.id === 'iron' ? 'Железный слиток — для улучшений построек (!вклад)' : 'Стройматериал — для улучшений построек (!вклад)' })); }
    else if (invTab === 'food') { Object.keys(VEG).forEach(id => it.push({ ic: INV_ICON[id], src: vegSrc(id), n: +h['veg_' + id] || 0, name: VEG[id], tip: id === 'weed' ? 'Сорняки — обмен в огороде' : 'Овощ — для готовки и продажи' }));
      h.rpg_dishes.forEach(id => { const r = recipeById(id) || {}; it.push({ ic: ['food', '#e8b84a'], n: 1, name: r.name || id, tip: 'Блюдо — съешь, чтобы получить бафф' }); });
      h.rpg_buffs.forEach(b => { const r = recipeById(b.id) || {}; it.push({ ic: ['food', '#7ad06a'], n: b.charges, name: (r.name || b.id) + ' (активно)', tip: 'Активный бафф, зарядов: ' + b.charges }); }); }
    else if (invTab === 'pot') { C.recipes.filter(r => r.kind === 'potion').forEach(r => it.push({ ic: ['potion', r.effect && r.effect.heal ? '#e04a4a' : r.effect && r.effect.luck ? '#4ad07a' : '#4a8aff'], src: dcSrc(r.id), dc: 1, n: h.rpg_bag[r.id] || 0, name: r.name, tip: r.text || 'Зелье' })); }
    else if (invTab === 'cos') { COS_TYPES.forEach(t => (h.rpg_owned[t] || []).forEach(id => { const c = cosPool(t).find(z => z.id === id); if (!c) return; const on = h.rpg_eq[t] === id;
      it.push({ ic: cosIc(Object.assign({ type: t }, c)), n: on ? '✓' : '', name: `${COS_T[t]}: ${c.name}`, tip: `только внешний вид · ${RARITY_NAME[c.rarity] || ''}${on ? ' · надето' : ' · клик — надеть'}`, cmd: on ? `!снять ${{ aura: 'аура', set: 'сет', trail: 'след' }[t]}` : `!экип ${id}` }); })); }
    else if (invTab === 'gear') { h.rpg_eqOwn.forEach(id => { const o = eqItem(id); if (o) { const on = h.rpg_equip[o.slot] === id, need = DUR() && on && durCur(h, o) < durMax(o); const badge = on ? (DUR() ? (need ? durPct(h, o) + '%' : '✓') : '✓') : ''; it.push({ ic: eqIc(o), src: dcSrc(o.id), hue: eqHue(o.id), dc: 1, n: badge, name: o.name, tip: eqStatTxt(o) + durTxt(h, o) + (on ? (need ? ` · починить ${durCost(h, o)} з (клик)` : ' · надето, клик — снять') : ' · клик — надеть'), cmd: on ? (need ? '!чинить ' + o.slot : '!снять ' + o.slot) : '!экип ' + o.id }); } });
      /* v7panel42+44: лут сундука rpg_gear — пассив; клик → подтверждение продажи */ { const tOn = trophyOn(h); [...new Set(h.rpg_gear || [])].forEach(id => { const g = gearById(id); if (g) { const pr = gearSellPrice(g), bn = gearBonusTxt(g), act = tOn && tOn.id === g.id; it.push({ ic: ['sword', '#c9a227'], n: act ? '🏆✓' : '🏆', name: 'Трофей: ' + g.name, tip: `трофей из сундука, не надевается · ${act ? `АКТИВНЫЙ: ${bn}` : `не действует (активен только один; сменить: !трофей ${g.id}) · дал бы ${bn}`} · продать за ${pr} з (клик)`, sellLoot: g.id, sellPrice: pr, sellBonus: act ? bn : 'ничего (неактивный)' }); } }); } } // v7panel8 п.3 + v7panel42/44
    else { it.push({ ic: ['seed', '#c9a24a'], n: +h.seeds || 0, name: 'Семена', tip: 'Обычные семена — посадка в огороде (!посадить)' }); it.push({ ic: ['seed', '#c58aff'], n: +h.seedsPrem || 0, name: 'Волшебные семена', tip: 'Волшебные семена — редкие растения' }); }
    cols = cols || 4; const N = Math.max(cols * 2, Math.ceil(it.length / cols) * cols);
    const cells = Array.from({ length: N }, (_, k) => { const o = it[k]; if (!o) return '<span class="islot empty"></span>';
      return `<span class="islot${o.n ? '' : ' zero'}${o.cmd || o.sellLoot ? ' gear' : ''}"${o.cmd ? ` data-cmd="${esc(o.cmd)}"` : ''}${o.sellLoot ? ` data-sellloot="${esc(o.sellLoot)}" data-sellprice="${+o.sellPrice || 0}" data-sellbonus="${esc(o.sellBonus || '')}"` : ''} title="${esc(o.name + (o.cmd || o.sellLoot ? '' : ' ×' + o.n) + ' — ' + o.tip)}"><img src="${o.src || pxIcon(o.ic[0], o.ic[1])}" alt=""${o.src ? (o.dc ? ' class="dc"' : ' class="veg"') : ''}${o.src && o.hue ? ` style="filter:hue-rotate(${o.hue}deg)"` : ''}><i>${o.n}</i></span>`; }).join('');
    const tabs = [['mat', 'Материалы'], ['food', 'Еда'], ['pot', 'Зелья'], ['seed', 'Семена'], ['gear', 'Снаряжение']].concat(COS_ON() ? [['cos', 'Косметика']] : []).map(([id, n]) => `<button class="itab${invTab === id ? ' on' : ''}" data-inv="${id}">${n}</button>`).join('');
    const rep = (invTab === 'gear' && DUR()) ? repairBarHtml(h) : '';
    return `<div class="row inv"><b>Инвентарь</b><div class="itabs">${tabs}</div><div class="igrid" style="grid-template-columns:repeat(${cols},44px)">${cells}</div>${rep}</div>`;
  }
  // ===================== v6.56: ОКНО ПЕРСОНАЖА (варианты A/B/C, C.heroWindow) =====================
  let HW_OPEN = false, HW_VAR = null, hwTab = 'look', HW_MSG = null;
  // v6.57: основной вид — C (компактный); кнопка «⤢» расширяет до A и обратно, выбор запоминается в localStorage
  const HW_KEY = 'rpgfarm_herowin';
  const hwSaved = () => { try { const v = localStorage.getItem(HW_KEY); return v === 'A' || v === 'C' ? v : null; } catch (e) { return null; } };
  // v7panel12: переключатель компактный/подробный убран — один вид C. Код A остаётся: CONFIG.heroWindowToggle = true возвращает кнопку и учитывает heroWindow/heroWindowExpand
  const HW_TOG = () => C.heroWindowToggle === true;
  const hwVar = () => HW_VAR || (HW_TOG() ? hwSaved() || C.heroWindow || 'C' : 'C');
  function hwExpandToggle() { const v = hwVar() === 'A' ? (C.heroWindow === 'A' ? 'C' : (C.heroWindow || 'C')) : (HW_TOG() && C.heroWindowExpand || 'A'); HW_VAR = null; try { localStorage.setItem(HW_KEY, v); } catch (e) { HW_VAR = v; } return v; }
  function heroStatRows(h) {
    const c = clsById(h.rpg_class), st = stats(h), eb = st.eq, P = c.auraHeal ? CT('paladin') : null, plus = v => v ? ` <em>(+${v})</em>` : '';
    const rows = [['❤', 'Здоровье', `${Math.round(h.rpg_hp)}/${st.maxhp}${plus(eb.hp)}`], ['⚔', 'Урон', `${st.atk}${plus(eb.atk)}`], ['🛡', 'Защита', `${st.def}${plus(eb.def)}`]];
    const blk = (P ? P.block : 0) + eb.block; if (blk) rows.push(['🔰', 'Блок', `${Math.round(blk * 100)}% (−${Math.round(CT('paladin').blockReduce * 100)}% урона)${eb.block ? ` <em>(+${Math.round(eb.block * 100)}%)</em>` : ''}`]);
    if (h.rpg_class === 'warrior') rows.push(['🌀', 'Рассечение', `${Math.round(CT('warrior').cleaveChance * 100)}%`]);
    if (c.dodge || eb.dodge) rows.push(['💨', 'Уклонение', `${Math.round((c.dodge || 0) * 40 + eb.dodge * 100)}%${eb.dodge ? ` <em>(+${Math.round(eb.dodge * 100)}%)</em>` : ''}`]);
    if (eb.mag) rows.push(['🔮', 'Магия', `+${eb.mag} к урону`]);
    if (c.crit) rows.push(['🎯', 'Крит. шанс', `${Math.round(c.crit * 100)}%`]); // v7panel20 п.2: все характеристики
    if (h.rpg_class === 'priest') rows.push(['💖', 'Лечение', '15% HP союзнику + благословение +10% урона']);
    if (h.rpg_class === 'mage') rows.push(['📖', 'Тайный залп', 'каждый 3-й удар ×2.5']);
    { const ar = eqItem(eqOf(h).armor); rows.push(['🥋', 'Броня', ar && eqAllowed(h, ar) ? `${ar.name}${ar.atype ? ' (' + ATYPE_RU[ar.atype] + ')' : ''}` : 'нет']); }
    if (c.dmgReduce) rows.push(['🧱', 'Снижение урона', `${Math.round(c.dmgReduce * 50)}%`]);
    if (P) rows.push(['✨', 'Аура', `+${Math.round(P.auraHeal * 100)}% HP / ${P.auraEvery} хода`]);
    { const tg = trophyOn(h); if (tg) rows.push(['🏆', 'Трофей', `${tg.name}: ${gearBonusTxt(tg)}${new Set(h.rpg_gear || []).size > 1 ? ' (активен один)' : ''}`]); } // v49.8
    if (st.regen) rows.push(['💚', 'Реген (еда)', `+${Math.round(st.regen * 100)}%`]);
    if (st.xpM > 1) rows.push(['📘', 'Опыт', `×${st.xpM.toFixed(2)}`]);
    rows.push(['🌱', 'Семена', `${+h.seeds || 0} · ✨ волшебные ${+h.seedsPrem || 0}`], ['🍲', 'Готовка (наград сегодня)', `${(h.rpg_reward || {}).cook || 0}`]); // v7panel4 п.10, v7panel11: короче
    rows.push(['⭐', 'Уровень', `${h.rpg_level} · ${h.rpg_xp || 0}/${xpNeed(h)} XP`], ['💰', 'Золото', `${h.rpg_gold}`]);
    return rows;
  }
  // v7panel20 п.2: что даёт надетое + баффы героя (перенесены сюда из «Улучшений»)
  function eqOnList(h) { const e = eqOf(h); return (EQ().slots || []).map(([sid, sn]) => { const it = eqItem(e[sid]); return it && eqAllowed(h, it) ? [sn, eqLabel(h, it), eqStatTxt(it) + (SH_ON() && shLv(h, it.id) ? ` · заточка +${shLv(h, it.id)}` : '') + durTxt(h, it), it.id] : null; }).filter(Boolean); }
  const statsHtml = h => { const E = eqOnList(h), B = buffList(h);
    return `<table class="hw-stats">${heroStatRows(h).map(([i, n, v]) => `<tr><td>${i}</td><td>${n}</td><td>${v}</td></tr>`).join('')}</table>`
      + `<div class="hw-eqon"><b>Надето</b>${E.length ? E.map(([sn, n, t, id]) => `<span class="sm">${dcSrc(id) ? `<img class="eqi" src="${dcSrc(id)}" alt="">` : ''}${esc(sn)}: ${esc(n)} — ${esc(t)}</span>`).join('') : '<span class="sm dim">ничего</span>'}</div>`
      + `<div class="hw-eqon"><b>Баффы</b>${B.length ? B.map(([n, t, c]) => `<span class="sm">${esc(n)}: ${esc(t)} (×${c})</span>`).join('') : '<span class="sm dim">нет активных</span>'}</div>`; };
  function slotHtml(h, s, n) { const it0 = eqItem(eqOf(h)[s]), it = it0 && eqAllowed(h, it0) ? it0 : null;
    return `<div class="hw-slot${it ? '' : ' empty'}" title="${esc(it ? `${n}: ${it.name} — ${eqStatTxt(it)}${durTxt(h, it)} (клик — снять)` : `${n}: пусто — купи в кузнице (!купить)`)}"${it ? ` data-cmd="!снять ${s}"` : ''}><img src="${it && dcSrc(it.id) || pxIcon(EQ_ICON[s], it ? EQT_COL[it.bs] : '#4a3a2a')}" alt=""${it && dcSrc(it.id) && eqHue(it.id) ? ` style="filter:hue-rotate(${eqHue(it.id)}deg)"` : ''}><span>${esc(it ? eqLabel(h, it) : n)}</span>${it && DUR() ? `<i class="hw-dur" style="display:block;height:3px;background:#333"><b style="display:block;height:3px;width:${durPct(h, it)}%;background:${durPct(h, it) <= 20 ? '#ff6a4a' : durPct(h, it) < 30 ? '#ffb84a' : '#7ad06a'}"></b></i>` : ''}</div>`; }
  // v6.57a: косметика в окне героя
  const COS_COL = { common: '#9aa0a6', rare: '#7ab8ff', epic: '#c58aff', legendary: '#ffb84a' };
  const cosIc = c => [c.type === 'set' ? 'dye' : c.type, c.type === 'set' ? (c.dye || '#a05050') : c.type === 'trail' ? (c.color || '#fc8') : (COS_COL[c.rarity] || '#ccc')];
  function cosSlotHtml(h) { if (!COS_ON()) return ''; const on = COS_TYPES.map(t => h.rpg_eq[t] ? cosName(t, h.rpg_eq[t]) : '').filter(Boolean), first = COS_TYPES.find(t => h.rpg_eq[t]);
    const ic = first ? cosIc(Object.assign({ type: first }, cosPool(first).find(z => z.id === h.rpg_eq[first]) || {})) : ['aura', '#4a3a2a'];
    return `<div class="hw-slot hw-cos${on.length ? '' : ' empty'}" title="${esc(on.length ? `Косметика: ${on.join(', ')} — только внешний вид (клик — снять всё)` : 'Косметика: пусто — ауры, окраски и следы (вкладка «Косметика»)')}"${on.length ? ' data-cmd="!снять косметика"' : ''}><img src="${pxIcon(ic[0], ic[1])}" alt=""><span>${esc(on.length ? on.join(' · ') : 'Косметика')}</span></div>`; }
  function petSrc(id) { const k = 'pet_' + id, i = IMG[k]; if (!i || isPH(k)) return ''; try { return i.src || (i.toDataURL && i.toDataURL()) || ''; } catch (e) { return ''; } }
  function petSlotHtml(h) { const own = petsOwn(h), on = h.rpg_eq.pet && own.find(p => p.id === h.rpg_eq.pet);
    if (!own.length) return '';
    const nx = on ? null : own[0], src = (on || nx) && petSrc((on || nx).id), ic = src ? `<img class="pet" src="${src}" alt="">` : `<img src="${pxIcon('pet', on ? COS_COL[on.rarity] || '#ccc' : '#4a3a2a')}" alt="">`;
    return `<div class="hw-slot hw-pet${on ? '' : ' empty'}" title="${esc(on ? `Питомец: ${on.name} (клик — снять)` : `Питомец: не надет — клик: надеть «${nx.name}»${own.length > 1 ? ` (всего ${own.length}: ${own.map(p => p.name).join(', ')}; !экип имя)` : ''}`)}" data-cmd="${on ? '!снять питомец' : '!экип ' + nx.id}">${ic}<span>${esc(on ? on.name : 'Питомец')}</span></div>`; }
  function cosShopHtml(h) { if (!COS_ON()) return '';
    const hc = hairOf(h), HP = hairPrice(), hair = `<div class="hw-hair"><b>Парикмахер</b> <small class="sm">${HP} з · сейчас: ${esc((hairById(hc) || {}).name || '?')}</small><div class="hw-hair-row">${HAIRS().map(x => { const r = x.ramp ? x.ramp[1] : x.sw || [120, 66, 40], on = x.id === hc; if (!hairOk(h, x)) return '';
      return `<button class="hw-hc${on ? ' on' : ''}" title="${esc(x.name)}${on ? ' — сейчас' : ` — ${HP} з (!парикмахер ${x.name})`}"${on || h.rpg_gold < HP ? ' disabled' : ''} data-cmd="!парикмахер ${x.id}" style="background:rgb(${r.join(',')})"></button>`; }).join('')}</div></div>`;
    return `<div class="hw-shop hw-cshop">${HAIR_ON() ? hair : ''}<b>Косметика</b><small class="sm">Только внешний вид, на статы не влияет. Редко выпадает из сундуков.</small>${cosShop().map(c => { const own = cosOwn(h, c), on = h.rpg_eq[c.type] === c.id;
      return `<div class="hw-si"><img src="${pxIcon(...cosIc(c))}" alt=""><span>${esc(c.name)}<small>${COS_T[c.type]} · ${RARITY_NAME[c.rarity]}</small></span>${on ? '<i>надето</i>' : own ? hbtn('!экип ' + c.id, 'Надеть') : hbtn('!купить ' + c.id, c.price + ' з', h.rpg_gold < c.price)}</div>`; }).join('')}</div>`; }
  const DYE_URL = {};
  function portraitSrc(h, k) { const d = dyeOf(h), hr = hairOf(h), hc = hairById(hr), im = IMG['h6_' + k]; if ((!d && !(hc && hc.ramp && !H7[k])) || !im || !im.width) return `assets/heroes${H7[k] ? 8 : 6}/${k}.png`; /* v8.6: новые спрайты */
    const key = k + (d || '') + '|' + hr; if (DYE_URL[key]) return DYE_URL[key]; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); const out = haired(dyed(c, d), k, hr); try { return (DYE_URL[key] = out.toDataURL()); } catch (e) { PORT_CV = out; return ''; } } // v7panel8 п.2: на file:// toDataURL запрещён → рисуем портрет в <canvas>
  let PORT_CV = null;
  function portraitHtml(h) { const k = hero6Key(h, {}); PORT_CV = null; const src = k ? portraitSrc(h, k) : ''; return `<div class="hw-port">${k ? (src ? `<img src="${src}" alt="">` : '<canvas class="hw-pcv"></canvas>') : '<div class="sm">нет спрайта</div>'}<div class="hw-name" style="color:${heroColor(h)}">${esc(DN(h))}</div><div class="sm">${esc(className(h))} · ур.${h.rpg_level}${h.rpg_eq.title ? ' · ' + esc(cosName('title', h.rpg_eq.title)) : ''}</div></div>`; }
  function repairBarHtml(h) {
    const R = durRepairList(h); if (!R) return '';
    if (!R.items.length) return `<div class="hw-rep dim">⚒ Починка: всё снаряжение целое</div>`;
    const tip = R.why || '', allDis = !R.ok;
    const rows = R.items.map(x => `<div class="hw-si"><span>${esc(x.name)}<small>прочность ${x.pct}% · ${x.cost} з</small></span>${hbtn('!чинить ' + x.s, 'Починить · ' + x.cost + ' з', allDis || h.rpg_gold < x.cost, tip)}</div>`).join('');
    return `<div class="hw-rep"><b>⚒ Починка у кузницы</b>${hbtn('!чинить всё', 'Починить всё — ' + R.tot + ' з', allDis, tip)}${rows}</div>`;
  }
  function shopHtml(h) { const bs = (S.buildings.blacksmith || {}).lv || 1; eqOf(h);
    const kit = ((EQ().classKits || {})[h.rpg_class]) || '';
    return repairBarHtml(h) + sharpBarHtml(h) + `<div class="hw-shop"><b>Кузница ур.${bs}</b>${kit ? `<small class="sm hw-kit">${esc(className(h))}: ${esc(kit)}. Чужие вещи не продаются.</small>` : ''}${eqForClass(h).map(it => { const own = h.rpg_eqOwn.includes(it.id), lock = bs < needBs(it);
      return `<div class="hw-si${lock ? ' lock' : ''}"><img src="${dcSrc(it.id) || pxIcon(...eqIc(it))}" alt=""><span>${esc(it.name)}<small>${eqStatTxt(it)}</small></span>${own ? (h.rpg_equip[it.slot] === it.id ? '<i>надето</i>' : hbtn('!экип ' + it.id, 'Надеть')) : lock ? `<i>кузница ${needBs(it)}</i>` : hbtn('!купить ' + it.id, it.price + ' з', h.rpg_gold < it.price)}</div>`; }).join('')}</div>`; }
  function heroWinHtml(h) {
    const v = hwVar(), SL = EQ().slots, sl = i => SL[i] ? slotHtml(h, SL[i][0], SL[i][1]) : '';
    const close = `<button class="hw-x" data-hw="close" title="Закрыть">✕</button>`, dev = C.heroWindowDev ? `<button class="hw-dev" data-hwv="1" title="Переключить вариант окна (dev)">вариант ${v} ⟳</button>` : '';
    const ex = v === 'B' || !HW_TOG() ? '' : `<button class="hw-exp" data-hwx="1" title="${v === 'A' ? 'Свернуть в компактный вид' : 'Развернуть: кукла, кузница, сумка'}">${v === 'A' ? '⤡ компактно' : '⤢ подробнее'}</button>`;
    const hm = HW_MSG && Date.now() - HW_MSG.t < 8000 ? `<span class="hw-msg${HW_MSG.ok ? '' : ' bad'}">${esc(HW_MSG.msg)}</span>` : '', title = `<div class="hw-title">Герой${ex}${dev}${hm}${close}</div>`;
    if (v === 'B') { const tabs = [['look', 'Облик'], ['stats', 'Характеристики'], ['bag', 'Сумка'], ['shop', 'Кузница']].concat(COS_ON() ? [['cos', 'Косметика']] : []).map(([id, n]) => `<button class="hw-bt${hwTab === id ? ' on' : ''}" data-hwt="${id}">${n}</button>`).join('');
      const body = hwTab === 'stats' ? statsHtml(h) : hwTab === 'bag' ? invPanel(h, 6) : hwTab === 'shop' ? shopHtml(h) : hwTab === 'cos' ? cosShopHtml(h) : `<div class="hw-b-look">${portraitHtml(h)}<div class="hw-b-slots">${SL.map((s, i) => sl(i)).join('')}${petSlotHtml(h)}${cosSlotHtml(h)}</div></div>`;
      return title + `<div class="hw-book"><div class="hw-btabs">${tabs}</div><div class="hw-page">${body}</div></div>`; }
    if (v === 'C') return title + `<div class="hw-c"><div class="hw-c-left">${portraitHtml(h)}<div class="hw-c-slots">${SL.map((s, i) => sl(i)).join('')}${petSlotHtml(h)}${cosSlotHtml(h)}</div></div><div class="hw-c-right">${statsHtml(h)}${invPanel(h, 5)}${invTab === 'cos' ? cosShopHtml(h) : ''}</div></div>`;
    return title + `<div class="hw-a"><div class="hw-a-doll"><div class="hw-a-col">${sl(0)}${sl(2)}</div>${portraitHtml(h)}<div class="hw-a-col">${sl(1)}${sl(3)}</div></div><div class="hw-a-stats"><b>Характеристики</b>${statsHtml(h)}${petSlotHtml(h)}${cosSlotHtml(h)}</div></div><div class="hw-a-bottom">${invPanel(h, 8)}${invTab === 'gear' ? shopHtml(h) : invTab === 'cos' ? cosShopHtml(h) : ''}</div>`;
  }
  function renderHeroWin() {
    let el = $('herowin'); const h = S.heroes[ACTIVE];
    if (!HW_OPEN || !h) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'herowin'; document.body.appendChild(el); el.addEventListener('click', hwClick); if (UIS !== 1) el.style.zoom = UIS; }
    el.className = 'hw hw-' + hwVar(); let html; try { html = heroWinHtml(h); } catch (e) { console.warn('herowin', e); html = `<div class="hw-title">Герой <button class="hw-x" data-hw="close">✕</button></div><div class="sm">Окно героя не отрисовалось: ${esc(e && e.message || e)}</div>`; } el.innerHTML = html; // v7panel8 п.2: исключение больше не оставляет пустую «капсулу»
    const pc = el.querySelector('.hw-pcv'); if (pc && PORT_CV) { pc.width = PORT_CV.width; pc.height = PORT_CV.height; pc.getContext('2d').drawImage(PORT_CV, 0, 0); }
  }
  function hwClick(e) {
    const t = e.target.closest('button,[data-cmd],[data-sellloot]'); e.stopPropagation(); if (!t) return;
    if (t.dataset.hw === 'close') HW_OPEN = false;
    else if (t.dataset.hwx && HW_TOG()) hwExpandToggle();
    else if (t.dataset.hwv) HW_VAR = { A: 'B', B: 'C', C: 'A' }[hwVar()];
    else if (t.dataset.hwt) hwTab = t.dataset.hwt;
    else if (t.dataset.inv) invTab = t.dataset.inv;
    else if (t.dataset.sellloot && ACTIVE) { // v7panel44: подтверждение продажи лута сундука
      const id = t.dataset.sellloot, pr = +t.dataset.sellprice || 0, bn = t.dataset.sellbonus || 'пассив';
      const g0 = gearById(id), nm = (g0 && g0.name) || id;
      if (!window.confirm('Продать лут «' + nm + '» за ' + pr + ' золота?\nПотеряете пассив: ' + bn + '.\nЭто не кузнечная вещь.')) { renderHeroWin(); return; }
      let r; try { r = runCmd(ACTIVE, '!продать лут ' + id); } catch (er) { r = { ok: false, msg: String(er && er.message || er) }; }
      HW_MSG = r && r.msg ? { ok: r.ok !== false, msg: r.msg, t: Date.now() } : null;
    }
    else if (t.dataset.cmd && ACTIVE) { let r; try { r = runCmd(ACTIVE, t.dataset.cmd); } catch (er) { r = { ok: false, msg: String(er && er.message || er) }; } HW_MSG = r && r.msg ? { ok: r.ok !== false, msg: r.msg, t: Date.now() } : null; } // v7panel8 п.3: результат клика виден в окне
    renderHeroWin(); renderHUD(true);
  }
  // v7panel18: строка «Улучшения» и баффы героя (те же данные — в пульте через ref.bld и me.bf)
  function upRow(h, id) { const i = bInfo(id), M = DMP();
    const lft = Object.entries(i.need).map(([m, n]) => [m, Math.max(0, n - ((i.have || {})[m] || 0))]).filter(x => x[1] > 0);
    const goldLeft = i.max ? 0 : Math.max(0, i.cost - i.fund);
    const remain = i.max ? 'максимальный уровень' : 'осталось: ' + [goldLeft ? goldLeft + ' золота' : ''].concat(lft.map(([m, n]) => `${matName(m)} ${n}`)).filter(Boolean).join(', ') || 'готово';
    const mb = lft.map(([m, n]) => { const have = +(h.rpg_mats[m] || 0), k = Math.min(have, n), buy = n - k;
      return (k ? hbtn(`!вклад ${id} ${m} ${k}`, `${matName(m)} ${k}`) : '') + hbtn(`!вклад ${id} ${m} ${n} золотом`, `${matName(m)} ${n}: докупить ${buy * (M[m] || 0)} з`, !buy || h.rpg_gold < buy * (M[m] || 0)); }).join('');
    return `<div class="row up"><b>${esc(i.name)} <span class="lv">ур.${i.lv}</span></b><span class="sm">сейчас: ${esc(bReal(id, i.lv))}</span>` + (i.max ? '<span class="sm">максимальный уровень</span>' :
      `<span class="sm dim">ур.${i.lv + 1}: ${esc(bReal(id, i.lv + 1))}</span>${hbar(i.fund, i.cost)}<span class="sm">${esc(remain)}</span>` +
      (goldLeft ? hbtn(`!вклад ${id} ${Math.min(10, goldLeft)}`, `Золото ${Math.min(10, goldLeft)}`, h.rpg_gold < 1) + hbtn(`!вклад ${id} всё`, 'Всё золото', h.rpg_gold < 1) : '') + mb) + '</div>'; }
  function buffList(h) { return (h.rpg_buffs || []).map(b => { const r = recipeById(b.id) || {}; return [r.name || b.id, r.text || '', b.charges || 0]; }); }
  function buffsHtml(h) { const L = buffList(h); return `<div class="row"><b>Баффы героя сейчас</b>${L.length ? L.map(([n, t, c]) => `<span class="sm">${esc(n)}: ${esc(t)} (осталось ${c})</span>`).join('') : '<span class="sm dim">нет активных баффов</span>'}</div>`; }
  function hudBody(h) {
    const st = stats(h);
    if (hudTab === 'town' && hudSub.town === 'up') return BLD.map(id => upRow(h, id)).join(''); // v7panel18: ур., эффект сейчас/дальше, сколько осталось, вклад золотом или материалами
    if (hudTab === 'town') { const q = h.rpg_quest && questById(h.rpg_quest.id); const qdone = (h.rpg_qlog || []).length ? `<div class="row qdone"><b>Выполнено заданий: ${h.rpg_questsDone || 0}</b>${h.rpg_qlog.slice().reverse().map(r => `<span class="sm">✔ ${esc(r.text)} — ${esc(r.rw)}</span>`).join('')}</div>` : (h.rpg_questsDone ? `<div class="sm">Выполнено заданий: ${h.rpg_questsDone}</div>` : ''); return qdone + (q ? `<div class="row"><b>Текущий: ${esc(q.text)}</b>${hbar(h.rpg_quest.prog, q.need, '#7dd87d')}<span class="sm">${h.rpg_quest.prog}/${q.need} · +${q.gold} золота</span></div>` : '') + offers(h).map((id, k) => { const o = questById(id); return `<div class="row"><span>${k + 1}) ${esc(o.text)} <span class="sm">+${o.gold} золота</span></span>${hbtn('!квест ' + (k + 1), 'Взять', !!q)}</div>`; }).join(''); }
    if (hudTab === 'garden') {
      const kind = hudSub.garden; const veg = Object.keys(VEG).map(k => `${VEG[k]} ${h['veg_' + k] || 0}`).join(' · ');
      const job = S.cooking.find(j => j.user === h.user);
      const seedsLn = `<div class="row seeds"><b>🌱 Семена: ${+h.seeds || 0} · ✨ Волшебные: ${+h.seedsPrem || 0}</b>${h._fvStream || h.seeds || h.seedsPrem ? '' : '<span class="sm dim">данные грядки приходят от бота (farmVars/farmBag) после первой команды огорода</span>'}</div>`; // v6.55 п.10
      return seedsLn + `<div class="sm">${veg}</div>` + (job ? `<div class="row"><b>Варится…</b>${hbar(job.need - job.left, job.need, '#ffb15a')}</div>` : '') +
        C.recipes.map((r, k) => [r, k]).filter(([r]) => r.kind === kind).map(([r, k]) => `<div class="row${recipeOpen(h, r) ? '' : ' locked'}"><b>${esc(r.name)} <span class="lv">${recipeOpen(h, r) ? 'T' + r.tier : 'ур. ' + recipeLv(r)}</span></b><span class="sm">${esc(r.text)}</span><span class="sm dim">${Object.entries(r.need).map(([v, n]) => `${VEG[v]} ${h['veg_' + v] || 0}/${n}`).join(', ')}</span>${hbtn('!готовить ' + (k + 1) + (BC_ON() ? ' 1' : ''), recipeOpen(h, r) ? 'Готовить' : 'ур. ' + recipeLv(r), !recipeOpen(h, r) || !canAfford(h, r) || !!job)}</div>`).join('') +
        (kind === 'food' ? `<div class="sm">Баффы (${h.rpg_buffs.length}/${C.maxActiveBuffs}): ${h.rpg_buffs.map(b => `${esc((recipeById(b.id) || {}).name || b.id)} ×${b.charges}`).join(', ') || '—'}${h.rpg_dishes.length ? ` · в запасе ${h.rpg_dishes.length}` : ''}</div>` : `<div class="sm">Сумка: ${Object.entries(h.rpg_bag).filter(([id, n]) => n > 0 && id !== 'spray').map(([id, n]) => `${esc((recipeById(id) || {}).name || id)} ×${n}`).join(', ') || '—'}</div>`) +
        // v7panel20 п.3: эффекты всех блюд и зелий одним списком (как «Улучшения»)
        `<div class="row fxlist"><b>Эффекты еды и зелий</b>${C.recipes.map(r => `<span class="sm${recipeOpen(h, r) ? '' : ' dim'}">${r.kind === 'potion' ? '🧪' : '🍲'} ${esc(r.name)}: ${esc(r.text || '—')}</span>`).join('')}</div>`;
    }
    if (hudTab === 'camp') {
      const seat = S.seats.indexOf(h.user), sc = seatCount();
      const pots = C.recipes.filter(r => r.kind === 'potion' && (h.rpg_bag[r.id] || 0) > 0).map(r => `${r.name} ×${h.rpg_bag[r.id]}`);
      const food = h.rpg_buffs.map(b => `${(recipeById(b.id) || {}).name || b.id} (${b.charges})`).concat(h.rpg_dishes.map(id => (recipeById(id) || {}).name || id));
      const slots = (arr, n) => Array.from({ length: n }, (_, k) => `<span class="slot">${esc(arr[k] || '—')}</span>`).join(' ');
      const inv = invPanel(h); void slots; void pots; void food; // v6.55 п.12b: сетка вместо строки «Сумка»
      const sk = Object.keys(C.skills).map(id => { const s = skill(h, id); return `<div class="row"><b>${C.skills[id]} <span class="lv">ур.${s.lv}</span></b>${s.lv < 50 ? hbar(s.xp, skNeed(s.lv), '#7ab8ff') + `<span class="sm">${s.xp}/${skNeed(s.lv)} XP · сегодня ${s.day === new Date().toISOString().slice(0, 10) ? s.today : 0}/${skCap(s.lv)}</span>` : '<span class="sm">максимум</span>'}</div>`; }).join('');
      const eq = inv + sk + ['aura', 'pet', 'title', 'set'].filter(t => COS_ON() || !['aura', 'set'].includes(t)).map(t => `<div class="row"><b>${{ hat: 'Шляпа', aura: 'Аура', pet: 'Питомец', title: 'Титул', set: 'Сет' }[t]}: ${esc(h.rpg_eq[t] ? cosName(t, h.rpg_eq[t]) : '—')}</b><span>${(h.rpg_owned[t] || []).map(id => hbtn(`!надеть ${t} ${id}`, cosName(t, id), h.rpg_eq[t] === id)).join('') + (h.rpg_eq[t] ? hbtn(`!снять ${t}`, 'Снять', false) : '') || '<span class="sm dim">пусто</span>'}</span></div>`).join('');
      return `<div class="row"><b>HP ${Math.round(h.rpg_hp)}/${st.maxhp}</b>${hbar(h.rpg_hp, st.maxhp, '#d84a4a')}<span class="sm">${seat >= 0 && seat < sc ? `место у костра ${seat + 1}/${sc}` : 'отдыхает в палатке'} · ${CAMPRG().enabled === true ? `костёр ур.${bLv('campfire')}: ${crPct(bLv('campfire'))}% недостающего HP за 5 мин` : `реген ${Math.round(100 * 0.02 * (1 + bEff('campfire', 'regen')))}%/с`}${tentShieldFor(h) > 0 ? ` · щит на поход ${tentShieldFor(h)} HP` : ''}</span></div>` + eq;
    }
    if (hudTab === 'forest') { const b = BATTLES.find(x => x.user === h.user); return `<div class="row"><b>${b ? 'В походе…' : 'Поход в лес'}</b><span class="sm">Волны монстров, золото, опыт, материалы и сундуки. Еда применяется сама.</span>${hbtn('!поход', 'В поход', !!b)}</div><div class="sm">Походов: ${h.rpg_expeditions} · убито ${h.rpg_kills}</div>`; }
    if (hudTab === 'boss') {
      const b = S.boss, inSq = !!(b && b.signup && b.signup.includes(h.user)), u = BF && BF.all[h.user];
      const head = !b ? '<b>Босс появится через час после начала стрима</b>' : b.phase === 'wait' ? `<b>${esc(b.name)} — через ${fmtTime(b.spawnAt - now())}</b>` : b.phase === 'signup' ? `<b>${esc(b.name)} — запись (${b.signup.length})</b>` : b.phase === 'fight' ? `<b>${esc(b.name)} — HP ${Math.max(0, Math.round(b.hp))}/${b.maxhp}</b>${hbar(b.hp, b.maxhp, '#c33')}` : `<b>${esc(b.name)} — ${b.fled ? gv(b.name,'ушёл','ушла') : gv(b.name,'повержен','повержена')}</b>`;
      const sl = Math.max(0, (h.rpg_strikeAt || 0) + BE.strikeCooldown - now()), hl = Math.max(0, (h.rpg_healAt || 0) + BE.healCooldown - now());
      const my = Object.entries(BC.CC).filter(([, A]) => A.classes.includes(h.rpg_class)).map(([k, A]) => hbtn(A.cmd, A.name, !bossFighting() || !u || u.sq < 0));
      const role = u ? ROLE_RU[u.role] : inSq ? (formationSpots()[h.user] || {}).role : '';
      const nd = bossNeeds();
      return `<div class="row">${head}<span>${hbtn('!босс', inSq ? 'Записан' : 'Записаться', !bossActive() || inSq)}${hbtn('!удар', sl ? `Удар ${Math.ceil(sl)}с` : 'Удар', !bossFighting() || !u || sl > 0)}${hbtn('!лечить', hl ? `Лечить ${Math.ceil(hl)}с` : 'Лечить', !bossFighting() || !u || hl > 0)}${my.join('')}</span></div>` +
        `<div class="sm">${role ? 'Роль: ' + esc(ROLE_RU[role] || role) + ' · ' : ''}${nd.length ? esc(nd.join(' · ')) + ' · ' : ''}</div><div class="ccl">${CC_LEGEND.map(r => `<div style="color:${r.c}">${r.i} <b>${esc(r.who)}</b>: ${esc(r.cmd)} <span class="sm">— ${esc(r.win)}</span></div>`).join('')}</div><div class="sm dim">Урон по боссам: ${h.rpg_bossDmg} · побед ${h.rpg_bossWins}</div>`;
    }
    if (hudTab === 'guild') { const wk = S.weekly || {}, GI = guildJoinInfo(h.user); return C.guilds.map((g, gi) => `<div class="row"><b>${esc(g.name)}${S.trophy && S.trophy.guild === g.id && trophyActive() ? ' 🏆' : ''}</b><span class="sm">очки недели: ${Math.round((S.guildScore || {})[g.id] || wk[g.id] || 0)}${GACTD() ? ` · ${guildActTxt(GI[gi].count, GI[gi].total)}` : ''}${GJ() ? ` · ${GI[gi].count}/${GI[gi].limit}${GI[gi].open || h.rpg_guild === g.id ? '' : ' · закрыта'}` : ''}</span>${hbtn('!гильдия ' + g.id, h.rpg_guild === g.id ? 'Вы здесь' : GI[gi].open ? 'Вступить' : 'Мест нет', h.rpg_guild === g.id || !GI[gi].open)}</div>`).join(''); }
    return '';
  }
  function renderHUD(force) {
    const el = $('hud'); if (!el || el.classList.contains('hidden')) return;
    if (!force && el.matches(':hover') && performance.now() - hudT < 3000) return; // не перерисовываем под курсором
    hudT = performance.now();
    const h = S.heroes[ACTIVE];
    const tabs = HUD_TABS.map(([id, n]) => `<button class="tab${hudTab === id ? ' on' : ''}" data-tab="${id}">${n}</button>`).join('');
    const subs = (HUD_SUBS[hudTab] || []).map(([id, n]) => `<button class="sub${hudSub[hudTab] === id ? ' on' : ''}" data-sub="${id}">${n}</button>`).join('');
    const head = h ? `<div class="hh"><b style="color:${heroColor(h)}">${esc(DN(h))}</b> ${esc(className(h))} ур.${h.rpg_level} · ${h.rpg_gold} золота${isHeroWeek(h) ? ' · ★' : ''}${C.reward && C.reward.enabled !== false ? `<div class="sm">Награда: поход ${(h.rpg_reward||{}).hike||0} · готовка ${(h.rpg_reward||{}).cook||0} · квест ${(h.rpg_reward||{}).quest||0}</div>` : ''}</div>` : `<div class="hh">Герой не выбран</div>`;
    const busy = h && BATTLES.some(x => x.user === h.user), quick = h ? `<div class="quick"><button data-cmd="!поход"${busy ? ' disabled' : ''}>⚔ Поход</button><button data-cmd="!огород">🌱 Огород</button><button data-hw="open" title="Окно персонажа: облик, снаряжение, характеристики, сумка">🛡 Герой</button><button data-clog="1" class="${CLOG_SHOW ? 'on' : ''}" title="Показать/скрыть журнал боя">📜 Журнал</button><button data-cmd="!готовить">🍲 Готовить</button></div>` : '';
    el.classList.toggle('mini', HUD_MINI);
    if (HUD_MINI) { el.innerHTML = `<div class="hh"><button class="mini-t" data-hudmini="0" title="Развернуть панель героя">▴</button> ${h ? `<b style="color:${heroColor(h)}">${esc(DN(h))}</b> ур.${h.rpg_level}` : 'Герой'}</div>`; return; }
    renderHeroWin();
    el.innerHTML = `<button class="mini-t" data-hudmini="1" title="Свернуть панель героя">▾</button>` + head + quick + `<div class="tabs">${tabs}</div>` + (subs ? `<div class="subs">${subs}</div>` : '') + `<div class="body">${h ? hudBody(h) : '<div class="sm">Напишите в чат или выберите героя в панели управления.</div>'}</div>`;
  }
  // v6.34: свернуть/развернуть панель героя и журнал боя (мышью; состояние в localStorage)
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { } };
  let HUD_MINI = lsGet('rpg_hudMini', false), CLOG_MINI = lsGet('rpg_clogMini', false), CLOG_BTN = null;
  function setHudMini(v) { HUD_MINI = !!v; lsSet('rpg_hudMini', HUD_MINI); renderHUD(true); }
  function setClogMini(v) { CLOG_MINI = !!v; lsSet('rpg_clogMini', CLOG_MINI); }
  function refreshUI() { renderHUD(); }
  function hudClick(e) {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.hudmini) { setHudMini(t.dataset.hudmini === '1'); return; }
    if (t.dataset.hw) { HW_OPEN = !HW_OPEN; renderHeroWin(); return; }
    if (t.dataset.tab) { hudTab = t.dataset.tab; const L = { town: 'town', garden: 'garden', camp: 'camp', forest: 'forest', boss: 'boss', guild: 'town' }[hudTab]; goLoc(L); }
    else if (t.dataset.sub) hudSub[hudTab] = t.dataset.sub;
    else if (t.dataset.inv) invTab = t.dataset.inv;
    else if (t.dataset.clog) toggleCombatLog();
    else if (t.dataset.cmd && ACTIVE) runCmd(ACTIVE, t.dataset.cmd);
    renderHUD(true);
  }
  // кнопки HUD = те же команды чата (с теми же кулдаунами); !вклад и !надеть — только из HUD/панели
  function runCmd(nick, text) {
    let m;
    if ((m = /^!вклад (\S+) (\d+)$/.exec(text))) return donate(nick, m[1], +m[2]);
    if ((m = /^!вклад (.+)$/.exec(text))) return donateCmd(nick, m[1]);
    if ((m = /^!надеть (\S+) (.+)$/.exec(text))) return equip(nick, m[1], m[2].trim()); // v6.55: титулы с пробелом («Истребитель огров»)
    if ((m = /^!снять (\S+)$/.exec(text))) { const r = unequip(nick, m[1]); if (r) return r; return equip(nick, m[1], ''); }
    if ((m = /^!гильдия (\S+)$/.exec(text)) && GCONF.confirm) return guildAsk(nick, m[1], true); // v6.42: кнопка HUD — окно подтверждения
    if ((m = /^!квест (\d+)$/.exec(text))) return chooseQuest(nick, m[1]); // кнопка «Взять» на панели — без токена награды
    return chat(nick, text);
  }
  function setupInput() {
    const hud = $('hud'), hint = $('hhint');
    if (hud) hud.addEventListener('click', hudClick);
    if (UIS !== 1) ['hud', 'hhint'].forEach(id => { const e = $(id); if (e) e.style.zoom = UIS; });
    if (hint) { hint.addEventListener('click', () => toggleHUD()); setTimeout(() => hint.classList.add('mini'), 5000); }
    const toCanvas = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    cv.addEventListener('mousemove', e => { MOUSE = toCanvas(e); cv.style.cursor = IND.concat(HOVER.filter(b => b.loc === CAM.loc)).some(b => MOUSE.x >= b.x && MOUSE.x <= b.x + b.w && MOUSE.y >= b.y && MOUSE.y <= b.y + b.h) ? 'pointer' : ''; });
    cv.addEventListener('mouseleave', () => { MOUSE = null; });
    cv.addEventListener('click', e => { const p = toCanvas(e); if (CLOG_BTN && p.x >= CLOG_BTN.x && p.x <= CLOG_BTN.x + CLOG_BTN.w && p.y >= CLOG_BTN.y && p.y <= CLOG_BTN.y + CLOG_BTN.h) { setClogMini(!CLOG_MINI); return; } const b = IND.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h); if (b) { MENU = null; goLoc(b.l); return; } const sg = HOVER.find(h => h.go === 'boss' && h.loc === CAM.loc && p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h); if (sg) { MENU = null; hudTab = 'boss'; goLoc('boss'); return; } /* locations_final: клик по нарисованной табличке → логово */ if (scrollClick(p)) return; if (heroAt(p)) { MENU = null; heroClick(p); return; } if (menuClick(p)) return; heroClick(p); }); // v6.55: свитки квестов; герой важнее постройки
    addEventListener('keydown', e => {
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.repeat) return;
      if (C.hotkeys[e.code]) { const l = C.hotkeys[e.code]; if (HUD_TABS.some(t => t[0] === l)) hudTab = l; goLoc(l); }
    });
  }
  // v6.24: в OBS работают только клики — клик по герою показывает его плашку, повторный клик/клик мимо скрывает
  function heroAt(p) {
    if (ZVIEW && ZOOM > 1) { const z = ZC; ZC = ZVIEW; const [x, y] = zs2w(p.x, p.y); ZC = z; p = { x, y }; }
    let best = null, bd = 1e9;
    heroesIn(CAM.loc).forEach(h => { const rt = ensureRT(h), hh = heroH(rt) || 150; if (p.x > rt.x - 55 && p.x < rt.x + 55 && p.y > rt.y - hh - 20 && p.y < rt.y + 30) { const d = Math.abs(p.x - rt.x) + Math.abs(p.y - rt.y + hh / 2); if (d < bd) { bd = d; best = h; } } });
    return best;
  }
  function heroClick(p) {
    const h = heroAt(p), el = $('hud'), open = el && !el.classList.contains('hidden');
    if (h && !(open && ACTIVE === h.user)) { setActive(h.user, false); toggleHUD(true); }
    else toggleHUD(false);
  }
  function toggleHUD(v) { const el = $('hud'); if (!el) return; el.classList.toggle('hidden', v === undefined ? !el.classList.contains('hidden') : !v); if (el.classList.contains('hidden')) { HW_OPEN = false; renderHeroWin(); } renderHUD(true); }

  // ===================== СИНХРОНИЗАЦИЯ С control.html =====================
  // Игра — главная: хранит состояние и шлёт снимки; панель шлёт команды {type:'cmd', id, fn, args}.
  const BCH = typeof BroadcastChannel === 'function' ? new BroadcastChannel('rpgfarm') : null;
  const WHERE = { seat: 'у костра', sleep: 'спит', enter: 'идёт спать', walk: 'в пути', exp: 'в походе', garden: 'огород', visit: 'в городе', boss: 'бой с боссом', cook: 'у котла', fight: 'в бою', dead: 'без сил' };
  function snapshot() {
    const heroes = S.order.map(n => { const h = S.heroes[n], rt = ensureRT(h); return { user: n, cls: h.rpg_class, g: h.rpg_gender, lv: h.rpg_level, gold: h.rpg_gold, hp: Math.round(h.rpg_hp), maxhp: stats(h).maxhp, guild: (guildById(h.rpg_guild) || {}).name || '', where: WHERE[rt.mode] || rt.mode, loc: rt.loc, hw: isHeroWeek(h), seeds: h.seeds, last: h.rpg_lastActive }; });
    return {
      type: 'snap', t: Date.now(), clock: S.clock, speed: C.speedSteps[speedIdx], speeds: C.speedSteps, cam: CAM.loc, active: ACTIVE, follow: FOLLOW, hud: !!($('hud') && !$('hud').classList.contains('hidden')),
      heroes, log: S.log.slice(-60), prizes: S.prizes.slice(-80), fame: S.fame.slice(-50), fameText: fameText(),
      boss: S.boss ? { name: S.boss.name, phase: S.boss.phase, hp: Math.round(S.boss.hp), maxhp: S.boss.maxhp, signup: (S.boss.signup || []).length, spawnAt: S.boss.spawnAt, cast: S.boss.cast || null, needs: bossNeeds() } : null, session: S.session || null,
      buildings: BLD.map(bInfo), guilds: C.guilds.map(g => ({ id: g.id, name: g.name, pts: Math.round((S.guildScore || {})[g.id] || 0) })), trophy: trophyActive() ? S.trophy : null,
      budget: C.realPrizes.budgetMode, event: S.global.farmEvent,
      clog: CLOG_SHOW, recap: recapState(), bossMusic: { on: bmOn(), playing: AUD.music, fails: AUD.fails, style: bmStyle() }, bossLeft: S.boss ? Math.max(0, Math.round(((S.boss.phase === 'wait' ? S.boss.spawnAt : S.boss.phase === 'fight' ? S.boss.endAt : S.boss.signupUntil) || 0) - now())) : 0, // v6.40: док-панель
    };
  }
  let lsWarned = false, wsControl = false;
  function publishSnap() {
    let s; try { s = snapshot(); } catch (e) { console.error(e); return; }
    if (BCH) try { BCH.postMessage(s); } catch (e) { }
    if (wsControl && WS && WS.readyState === 1) try { WS.send(JSON.stringify({ request: 'DoAction', action: { name: (C.bot && C.bot.relayAction) || 'RPG Control Relay' }, args: { json: JSON.stringify(s) }, id: 'rpgfarm-snap' })); } catch (e) { }
    try { localStorage.setItem('rpgfarm_snap', JSON.stringify(s)); } catch (e) { if (!lsWarned) { lsWarned = true; console.warn('rpgfarm_snap: localStorage недоступен'); } }
  }
  function handleCmd(m) {
    if (!m || m.type !== 'cmd' || typeof api[m.fn] !== 'function') return;
    let r; try { r = api[m.fn].apply(null, m.args || []); } catch (e) { r = { ok: false, msg: String(e && e.message || e) }; }
    let out; try { out = JSON.parse(JSON.stringify(r === undefined ? null : r)); } catch (e) { out = null; }
    const reply = { type: 'res', id: m.id, fn: m.fn, result: out };
    if (BCH) try { BCH.postMessage(reply); } catch (e) { }
    try { localStorage.setItem('rpgfarm_res', JSON.stringify(reply)); } catch (e) { }
    if (wsControl && m.fn !== 'seasonExport' && WS && WS.readyState === 1) try { WS.send(JSON.stringify({ request: 'DoAction', action: { name: (C.bot && C.bot.relayAction) || 'RPG Control Relay' }, args: { json: JSON.stringify(reply) }, id: 'rpgfarm-res' })); } catch (e) { } // v49: файл сохранения (seasonExport) в Streamer.bot не шлём
    publishSnap();
  }
  const seenCmd = new Set();
  function onCmd(m) { if (!m || seenCmd.has(m.id)) return; seenCmd.add(m.id); handleCmd(m); }
  if (BCH) BCH.onmessage = e => onCmd(e.data);
  addEventListener('storage', e => { if (e.key === 'rpgfarm_cmd' && e.newValue) { try { onCmd(JSON.parse(e.newValue)); } catch (x) { } } });

  // ===================== СОБЫТИЯ ДЛЯ STREAMER.BOT =====================
  // Игра никогда не пишет в чат сама: она только отправляет событие боту (DoAction), а бот решает, что написать.
  let PANEL_QUIET = false, PANEL_QUIET_LOG = []; const PANEL_QUIET_DROP = ['guildReply', 'noHero', 'heroNeedInfo', 'heroExists', 'heroGreeting', 'expeditionCooldown', 'expeditionQueue', 'rewardFull'];
  let WS = null; const BOTQ = []; // v6.24: события босса, ждущие подключения к Streamer.bot (живут 2 мин)
  const BOTSENT = [];
  function emitBot(payload, actionName) {
    if (PANEL_QUIET) { if (PANEL_QUIET_DROP.includes(payload.event)) { PANEL_QUIET_LOG.push(payload.text || payload.event); return { ok: true, sent: false, quiet: true }; } payload = Object.assign({ silent: true }, payload); } // v7panel3: команда с пульта — без ответов в чат
    const name = actionName || (C.botActions && C.botActions[payload.event]) || payload.event;
    BOTSENT.push({ name, payload }); if (BOTSENT.length > 30) BOTSENT.shift(); // для тестов
    const args = {}; for (const k in payload) args[k] = typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k];
    const msg = JSON.stringify({ request: 'DoAction', action: { name }, args, id: 'rpgfarm-' + Date.now() });
    if (WS && WS.readyState === 1) { try { WS.send(msg); } catch (e) { } }
    else if (/^(boss|season)/.test(payload.event)) { BOTQ.push({ msg, t: Date.now() }); if (BOTQ.length > 10) BOTQ.shift(); log(`нет связи со Streamer.bot — «${name}» отправлю после подключения`, '#e8b0a0'); }
    if (BCH) try { BCH.postMessage({ type: 'bot', action: name, payload }); } catch (e) { }
    log(`→ бот: ${name} (${payload.event}${payload.user ? ', ' + payload.user : ''})`, '#9fc5e8');
    return { ok: true, sent: !!(WS && WS.readyState === 1) };
  }

  const NAMES = ['Котик', 'Пельмень', 'Ёжик', 'Луна', 'Шторм', 'Ворон', 'Ромашка', 'Тыковка', 'Барон', 'Искра', 'Сова', 'Лис', 'Кекс', 'Буря', 'Мята'];
  function demo(n) {
    n = n || 12;
    const ppl = [['Феечка', 'priest', 'female'], ['Бородач', 'warrior', 'male'], ['Луна', 'mage', 'female'], ['Тень', 'assassin', 'male'], ['Стрела', 'archer', 'female'], ['Сэр_Тыква', 'paladin', 'male'], ['Огурчик', 'mage', 'male'], ['Ромашка', 'archer', 'female'], ['Пельмень', 'warrior', 'male'], ['Сова', 'priest', 'female'], ['Барон', 'paladin', 'male'], ['Искра', 'assassin', 'female'], ['Мята', 'archer', 'female'], ['Ворон', 'mage', 'male'], ['Кекс', 'warrior', 'male']].slice(0, n);
    ppl.forEach(([nk, c, g], i) => { createHero(nk, c, g, true); const h = S.heroes[nk], rt = ensureRT(h); if (S.seats.includes(nk)) { const p = seatXY(S.seats.indexOf(nk)); rt.x = p.x; rt.y = p.y; rt.path = []; rt.dest = null; rt.onArrive = null; rt.mode = 'seat'; } h.rpg_level = 1 + (i % 4); h.rpg_hp = stats(h).maxhp; h.rpg_gold = R(20, 160); h.rpg_guild = C.guilds[i % C.guilds.length].id; h.rpg_guildJoined = now() - 1e6; });
    const t = now();
    ppl.forEach(([nk], i) => {
      const h = S.heroes[nk]; h.seeds = 5; h.seedsPrem = 2;
      if (i % 4 === 0) { h.gardenStatus = 2; h.plantedAt = 0; } else { h.gardenStatus = 1; h.plantedAt = t - [0, 400, 1300, 2400, 3100][i % 5]; h.waterLevel = i % 3; }
      Object.assign(h, { veg_cucumber: R(2, 7), veg_tomato: R(2, 7), veg_carrot: R(2, 7), veg_eggplant: R(2, 7), veg_pumpkin: R(0, 2), veg_weed: R(3, 12) });
    });
    log('Демо-сценка готова', '#9fc5e8'); save(); refreshUI();
  }


  // ===================== API =====================

  // v6.22: бот (Streamer.bot) сам считает грядки и шлёт farmVars/farmBag — оверлей по изменениям показывает действие героя в огороде
  const VEGK = ['veg_cucumber', 'veg_tomato', 'veg_carrot', 'veg_eggplant', 'veg_pumpkin', 'veg_weed'];
  let FARMVARS_SEEN = 0; const FARM_LAST = {};
  function farmShow(h, act) {
    if (!h) return false; const k = h.user + ':' + act, t = Date.now(); if (t - (FARM_LAST[k] || 0) < 4000) return false; FARM_LAST[k] = t;
    if (blocked(h, 'town')) return false;
    const TXT = { plant: 'Сажаю!', harvest: 'Урожай!', bugs: 'Жуки!', shoo: 'Кыш!', magic: 'Магия!', garden: 'Проверю грядку' };
    const ok = goGarden(h, TXT[act] || TXT.garden, undefined, () => {
      const b = bedXY(h, false); if (b.hidden) return;
      if (act === 'harvest') { ensureRT(h).pick = tm; fxPop(b.x, b.y - 38, 'ripe'); }
      else if (act === 'shoo' || act === 'bugs') fxText(b.x, b.y - 110, act === 'bugs' ? 'жуки на грядке!' : 'жуки прогнаны!', act === 'bugs' ? '#ff9c7a' : '#c8f0a8');
      else if (act === 'plant') fxText(b.x, b.y - 110, 'посажено', '#c8f0a8');
    });
    bump('garden', 2); return ok;
  }
  function farmReact(h, w, ch) {
    FARMVARS_SEEN = Date.now();
    const veg = VEGK.reduce((s, k) => s + (+h[k] || 0), 0);
    let act = null;
    // v7panel12: задания по ферме, которую считает бот (!магия/!собрать/!посадить приходят только как farmVars) — раньше questEvent вызывался лишь в standalone
    const dmh = (+h.magicHarvest || 0) - (+w.mh || 0); if (dmh > 0 && dmh <= 3) questEvent('magic', { n: dmh }, h);
    // v7panel32: !салат через бота приходит только как farmVars (totalSalads/saladsThisPeriod) — раньше квест «приготовить» его не видел
    { const dts = (+h.totalSalads || 0) - (w.ts || 0), dsp = (+h.saladsThisPeriod || 0) - (w.sp || 0), dsl = dts > 0 ? dts : (w.base && dsp > 0 ? dsp : 0); if (dsl > 0 && dsl <= 2) { questEvent('cook', { n: dsl, salad: true }, h); questEvent('cookDiff', { dish: 'salad' }, h); goalAdd('cook', dsl, h); } }
    if (w.base) for (const k of VEGREAL) { const d = (+h[k] || 0) - (w.vk[k] || 0); if (d > 0 && d <= FV_MAX) questEvent('harvest', { crop: k.slice(4), n: d }, h); }
    const watered = (h.waterLevel !== w.wl && +h.waterLevel > +w.wl) || (h.wateringLastTime && h.wateringLastTime !== w.wt);
    if (veg > w.veg || (+h.magicHarvest || 0) > (+w.mh || 0)) {
      act = 'harvest';
      const real0 = VEGREAL.reduce((s, k) => s + (+h[k] || 0), 0) - (w.vr || 0);
      if (w.base && real0 > 0 && real0 <= FV_MAX) vegActivate(h, w.vk); // сбор = работа с грядкой; базой — количества ДО сбора
      if (!vegAcct(h).on) { vegTrim(h); }
      // v6.34: в цель стрима идёт только реальный сбор после старта стрима: базовая линия на первом farmVars героя в этом стриме,
      // сорняк (veg_weed) не овощ, скачок больше FV_MAX за одно событие — это синхронизация инвентаря, а не сбор
      const real = VEGREAL.reduce((s, k) => s + (+h[k] || 0), 0) - (w.vr || 0);
      if (w.base && vegAcct(h).on && real > 0 && real <= FV_MAX) goalAdd('harvest', real, h);
    }
    else if (w.st !== 1 && h.gardenStatus === 1 && h.plantedAt > 0 && !h._paGuess && h.plantedAt !== w.pa && now() - h.plantedAt <= 300) { act = 'plant'; if (w.base) vegActivate(h, w.vk);  questEvent('plant', {}, h); } // v7panel11: посадка — только свежая (≤5 мин) и не в ответ на «Семена»
    else if (h.bugAttack && !w.bug && !seedsWin(h)) act = 'bugs';
    else if (!h.bugAttack && w.bug) act = 'shoo';
    else if (h.seeds > w.seeds) { const pc = panelWin(h); if (!pc) say(h, `+${h.seeds - w.seeds} семян`); return; } // v7panel11: после кнопки пульта результат показывает сам пульт — без реплики
    if (!act && watered && w.base) vegActivate(h, w.vk);
    const pc = panelWin(h); if (act && pc && !(PANEL_FX_ALLOW[pc] || []).includes(act)) act = null; // v7panel11
    if (act) farmShow(h, act);
  }
  // v7panel11: аудит пульта — после кнопки огорода реакция (поход к грядке, реплика, «посажено», жуки) допускается только та, что соответствует команде
  const PANEL_LAST = {}, PANEL_FX_ALLOW = { 'посадить': ['plant'], 'собрать': ['harvest'], 'жуки': ['shoo'], 'отогнать': ['shoo'], 'магия': [], 'семена': [], 'грядка': [], 'обмен': [], 'урожай': [], 'салат': [] };
  const panelWin = h => { const p = h && PANEL_LAST[lc(h.user)]; return p && Date.now() - p.t < 15000 ? p.cmd : null; };
  const seedsWin = h => ['посадить', 'семена', 'магия', 'собрать', 'обмен', 'салат'].includes(panelWin(h)); // жуки приходят через минуты после посадки, а не в ответ на кнопку действия; справка (грядка/урожай) их не глушит
  const VAR_ALIAS = { cuc: 'veg_cucumber', tom: 'veg_tomato', car: 'veg_carrot', egp: 'veg_eggplant', pum: 'veg_pumpkin', weed: 'veg_weed', magicSeeds: 'seedsPrem' };
  function bugSec(h) { return (h && +h._bugSec > 0) ? +h._bugSec : (+C.bugTimerSec > 0 ? +C.bugTimerSec : (+(C.farm || {}).bugTimerSeconds > 0 ? +C.farm.bugTimerSeconds : 60)); }
  const VEGREAL = VEGK.filter(k => k !== 'veg_weed'), FV_MAX = 5, FV_TX = [];
  function syncVars(nick, vars) {
    if (!vars) return { ok: false };
    if (!findNick(nick) && C.heroAutoCreate !== true) { // v6.34: farmVars/farmBag героя не создают — кэш по нику
      const k = lc(String(nick || '').trim().replace(/^@/, '')); if (!k) return { ok: false };
      const P = S.gardenPending || (S.gardenPending = {}); const o = P[k] || (P[k] = {});
      for (const x in vars) if (x !== 'user' && x !== 'event' && x !== 'txid' && x !== 'eventId' && x !== 'msgId') o[x] = vars[x];
      return { ok: false, pending: true };
    }
    const h = getHero(nick, true); if (!h) return { ok: false };
    const tx = vars.txid || vars.eventId || vars.msgId; // v6.34: дедуп повторной доставки одного события
    if (tx) { if (FV_TX.includes(tx)) return { ok: true, dup: true, changed: [] }; FV_TX.push(tx); if (FV_TX.length > 300) FV_TX.shift(); }
    const sid = streamCur().id, base = h._fvStream === sid; h._fvStream = sid;  // первый farmVars героя в стриме — только базовая линия
    const changed = [], was = { vk: Object.fromEntries(VEGK.map(k => [k, +h[k] || 0])), base, vr: VEGREAL.reduce((s, k) => s + (+h[k] || 0), 0), st: h.gardenStatus, pa: h.plantedAt, wl: h.waterLevel, wt: h.wateringLastTime, fb: h.fertilizerBuff, bug: h.bugAttack, veg: VEGK.reduce((s, k) => s + (+h[k] || 0), 0), seeds: h.seeds, sdp: +h.seedsPrem || 0, mh: h.magicHarvest, ts: +h.totalSalads || 0, sp: +h.saladsThisPeriod || 0 };
    for (let k in vars) {
      const v = vars[k]; if (k === 'user' || k === 'event') continue; // служебные поля farmBag не трогают героя (ник!)
      k = VAR_ALIAS[k] || k;
      if (v === undefined || v === null || !(k in h) || k.startsWith('rpg_')) continue;
      const cur = h[k]; let val = typeof cur === 'number' ? +v : typeof cur === 'boolean' ? (v === true || v === 'true' || v === 'True' || v === 1) : v;
      if (typeof cur === 'number' && !isFinite(val)) continue;
      if (k === 'bugAttack' && val === true && cur !== true && seedsWin(h) && !(+vars.bugSeconds > 0)) continue; // v7panel11: кнопки пульта (кроме посадки) не приносят жуков
      if (typeof cur === 'number' && /^veg_/.test(k) && h._vegCr && +h._vegCr[k] > 0) { val = val + (+h._vegCr[k]); } // v7panel28 п.3: + лут игры, которого бот не знает
      if (cur !== val) { h[k] = val; changed.push(k); }
    }
    // v6.27: таймер жуков = bugSeconds от бота, иначе config.bugTimerSec (как «Жуки таймер» в Streamer.bot, 60 с)
    if (+vars.bugSeconds > 0) h._bugSec = +vars.bugSeconds;
    if (h.bugAttack && (!h._bugDeadline || (+vars.bugSeconds > 0) || (!was.bug))) h._bugDeadline = now() + bugSec(h);
    if (!h.bugAttack) h._bugSec = 0;
    // v6.26: сигнал бота «созрело» (gardenStatus=2, plantedAt=0) или рост без события посадки в игре — грядка героя должна быть на экране
    if (h.gardenStatus > 0 && !PLOTS.includes(h.user)) claimPlot(h);
    if (h.gardenStatus === 1 && !(h.plantedAt > 0)) { h.plantedAt = now(); h._paGuess = true; } else if (+vars.plantedAt > 0 || h.gardenStatus !== 1) h._paGuess = false; if (+vars.magicPerDay > 0) h._magicMax = +vars.magicPerDay; // защита: рост без времени посадки — считаем с текущего момента
    if (was.st === 1 && h.gardenStatus === 2) { const b = bedXY(h, false); /* v7panel8 п.4: «Созрело!» только при росте 1→2; скачок 0→2 (игра не знала грядку, бот прислал состояние после команды пульта) — синхронизация без реплик */ if (!b.hidden) { fxText(b.x, b.y - 110, 'Созрело!', '#ffe27a'); bump('garden', 2); } }
    if (changed.length) { seedJournal(h, was); farmReact(h, was, changed); save(); refreshUI(); }
    if (h._vegCr && Object.values(h._vegCr).some(v => +v > 0)) vegSync(h); // v7panel34: синхронизация кредита с ботом
    return { ok: true, changed };
  }
  // v46 «призрачные семена»: семена, начисленные ботом огорода (!семена в чате, кнопка пульта, бонус сбора, обмен, награды Streamer.bot),
  // приходят только farmVars и раньше не писались в журнал. Пишем прирост; эхо собственных начислений игры (seedMark) не повторяем.
  function seedJournal(h, was) {
    const hi = h._sdHi && Date.now() - h._sdHi.t < 120000 ? h._sdHi : null; if (h._sdHi && !hi) delete h._sdHi;
    const one = (cur, old, hk, w, ic) => {
      cur = +cur || 0; old = +old || 0; const top = hi ? hi[hk] : null;
      const x = cur - (top != null ? Math.max(old, top) : old);
      if (x > 0) log(`${ic} ${DN(h)}: +${x} ${plural(x, w[0], w[1], w[2])} (огород, теперь ${cur})`, '#c8f0a8');
      return top == null || cur >= top; };
    const okS = one(h.seeds, was.seeds, 's', ['семечко', 'семечка', 'семян'], '🌱');
    const okP = one(h.seedsPrem, was.sdp, 'p', ['волшебное семечко', 'волшебных семечка', 'волшебных семян'], '✨');
    if (hi) { const used = (was.st !== 1 && h.gardenStatus === 1) || (+h.magicHarvest || 0) > (+was.mh || 0); if ((okS && okP) || used) delete h._sdHi; }
  }
  const resetRuntime = () => { for (const k in RT) delete RT[k]; BATTLES.length = 0; MODALS.length = 0; PLOTS.fill(null); };

  // ===================== v7 ПУЛЬТ ЗРИТЕЛЯ, шаг 2: исходящее подключение к relay (только чтение) =====================
  // CONFIG.panel = { enabled, url: 'wss://<worker>.workers.dev', key: '<GAME_KEY>' }. Выключено — ничего не создаётся и не считается.
  const PANEL = { ws: null, ok: false, timer: null, retry: 2000, sent: 0, bytes: 0, last: null, state: 'off' };
  // v7panel32: задания для пульта «Мой герой». Компактно: c — текущее [текст, прогресс, нужно, награда] или 0; d — всего выполнено; l — последние ≤5 [текст, награда, t].
  // Старые клиенты поле игнорируют; relay пропускает героя без изменений.
  function panelBed(h) {
    const st = +h.gardenStatus || 0;
    const bugs = !!(h.bugAttack && h._bugDeadline && h._bugDeadline > now());
    const bugLeft = bugs ? Math.max(0, Math.ceil(h._bugDeadline - now())) : 0;
    const eaten = !!(h._bugEaten);
    if (st === 0) return { st: 0, txt: eaten ? 'урожай съеден жуками' : 'грядка пустая', bugs: false, eaten };
    if (st === 2) return { st: 2, txt: 'созрело — можно собирать', bugs: false };
    const left = h.plantedAt > 0 && !h._paGuess ? Math.max(0, G().growSeconds - (now() - h.plantedAt)) : -1;
    let txt = left >= 0 ? `растёт, осталось ${fmtTime(left)}` : 'растёт (время неизвестно)';
    if (bugs) txt += ` · жуки! ${bugLeft}с`;
    return { st: 1, txt, left: left >= 0 ? left : null, bugs, bugLeft };
  }
  function panelQuests(h) { const q = h.rpg_quest, d = q && questById(q.id);
    return { c: d ? [d.text, Math.min(+q.prog || 0, d.need), d.need, `+${Math.round(d.gold * (1 + bEff('board', 'questGold')))} золота, +${d.xp || 0} опыта`] : 0, d: +h.rpg_questsDone || 0,
      l: (h.rpg_qlog || []).slice(-5).reverse().map(r => [String(r.text || ''), String(r.rw || ''), +r.t || 0]) }; }
  // v48.2: полоса каста босса для пульта. o — порядок окон (r=красное, y=жёлтое, p=фиолетовое), p — прогресс 0..1, r — скорость (доля/сек, с учётом !замедлить), left — секунд до удара, w — номер текущего окна, cmd — какая команда нужна сейчас, nm — название каста.
  function panelCast(b) {
    try {
      if (!b || b.phase !== 'fight' || !BF || !BF.cast) return undefined;
      const c = BF.cast, X = BE.cast, tot = (BF.def && BF.def.castTime) || X.seconds || 15, sl = BF.t < c.slowUntil, rate = (sl ? 1 - X.slowPct : 1) / tot, w = BC.castWindow(BF), W0 = BC.WIN[w];
      return { o: c.order.map(k => k[0]), p: Math.round(c.p * 1000) / 1000, r: Math.round(rate * 10000) / 10000, left: Math.max(0, Math.round((1 - c.p) / rate * 10) / 10), w: c.order.indexOf(w), cmd: W0 ? BC.CC[W0.need].cmd.replace('!', '') : '', nm: b.castName || (BF.def && BF.def.cast) || X.name, sl: sl ? 1 : 0 };
    } catch (e) { return undefined; }
  }
  // v49: «Раскат» для пульта: l — секунд до следующего, e — период, p — % макс. HP. Только когда раскат уже идёт (огр ≤ 50% HP)
  function panelRumble(b) {
    try { if (!b || b.phase !== 'fight' || !BF || !BF.rmb || !BF.def || !BF.def.rumble) return undefined; return { l: Math.max(0, Math.round((BF.rmb.next - BF.t) * 10) / 10), e: BF.def.rumble.every, p: Math.round(BF.def.rumble.share * 100) }; } catch (e) { return undefined; }
  }
  // v49.8 (px 499): цель стрима на пульте — [текст, прогресс, нужно, выполнена 0/1] (как плашка слева вверху в OBS)
  function panelGoal() { const g = S.stream && S.stream.goal; return g ? [String(goalText(g)).slice(0, 80), Math.max(0, +g.prog || 0), Math.max(1, +g.need || 1), g.done ? 1 : 0, (C.chests && C.chests[SG.rewardChest || 'wooden'] || {}).name || ''] : null; }
  function panelSnapshot() {
    const locs = {}, heroes = {}, list = S.order.slice(0, 300);
    const FM = {}; BATTLES.forEach(b => { const m = b.mon; if (m && !m.dead && m.d && !FM[b.user]) FM[b.user] = [String(m.d.id || ''), String(m.d.name || ''), Math.max(0, Math.round(m.hp)), m.maxhp || 1, m.party ? 1 : 0]; }); // v7panel26: с кем бьётся герой — [id моба, имя, hp, maxhp, групповой]
    LOCS.forEach(l => locs[l] = []);
    for (const n of list) {
      const h = S.heroes[n]; if (!h) continue; const rt = ensureRT(h), st = heroState(h);
      const loc = rt.mode === 'sleep' ? 'camp' : (rt.loc || 'camp');
      const k6 = hero6Key(h, rt), H6 = Math.round(HERO6_H * (HERO6_LOC[loc] || 1) / 4) * 4; // v7panel3b: облик для превью пульта — ключ спрайта, волосы, окраска сета, взгляд, рост
      const s = stats(h), rw = h.rpg_reward || {};
      (locs[loc] || (locs[loc] = [])).push([n, Math.round(rt.x), Math.round(rt.y), h.rpg_class, h.rpg_level, rt.mode === 'sleep' ? 'sleep' : st, k6 || '', k6 && HAIR_RC() && !H7[k6] && !/assassin|paladin/.test(k6) ? hairOf(h) : '', dyeOf(h) || '', rt.flip ? 1 : 0, H6, h.rpg_gender === 'female' ? 'f' : 'm', FM[n] ? FM[n][0] : '', FM[n] ? Math.round(FM[n][2] / FM[n][3] * 100) : 0, h.rpg_lastActive || 0, Math.round(h.rpg_hp), s.maxhp, Math.max(0, Math.round(h._shield || 0)), Math.max(0, Math.round(h._shieldMax || 0))]); // v49.10c: [15]=hp, [16]=mhp; v49.10d: [17]=щит, [18]=макс. щит
      heroes[lc(n)] = { n, cls: h.rpg_class, cn: className(h), g: h.rpg_gender, lv: h.rpg_level, xp: h.rpg_xp, xpN: xpNeed(h), hp: Math.round(h.rpg_hp), mhp: s.maxhp, sh: Math.max(0, Math.round(h._shield || 0)), shm: Math.max(0, Math.round(h._shieldMax || 0)), sr: (() => { try { return heroStatRows(h).map(r => [r[0], r[1], String(r[2]).replace(/<[^>]*>/g, '').slice(0, 60)]); } catch (e) { return []; } })(), /* v7panel37: характеристики для окна героя на пульте (?inv=obs) */
        gold: h.rpg_gold, pot: h.rpg_potions, food: h.rpg_food, gd: (guildById(h.rpg_guild) || {}).name || '', gid: h.rpg_guild || '', st, loc, mode: rt.mode,
        eqOwn: (h.rpg_eqOwn || []).slice(0, 40), eqOn: Object.assign({}, h.rpg_equip || {}), tt: ((h.rpg_owned && h.rpg_owned.title) || []).slice(0, 20), ttOn: (h.rpg_eq && h.rpg_eq.title) || '', pt: petsOwn(h).map(p => [p.id, p.name]), ptOn: (h.rpg_eq && h.rpg_eq.pet) || '', hair: HAIR_ON() ? hairOf(h) : '', hk: BARB_ON() && hero7Name(h) ? hero7Name(h).replace(/_beard$/, '').replace(/_[a-z]+(_loose)?$/, '') : undefined, bd: BARB_ON() && beardOf(h) ? 1 : 0, bk: BARB_ON() && beardOk(h) ? 1 : 0, /* v8.4: борода — есть ли (bd), можно ли (bk) */ ha: BARB_ON() ? hairsFor(h).map(x => x.id) : undefined, /* v49.7: hk — превью цирюльника img/h/<hk>_<волосы>.webp, ha — доступные цвета */ of: (h.rpg_offers || []).slice(0, 5), pty: PARTYQ.users.includes(h.user),
        veg: { cucumber: h.veg_cucumber, tomato: h.veg_tomato, carrot: h.veg_carrot, eggplant: h.veg_eggplant, pumpkin: h.veg_pumpkin }, wd: +h.veg_weed || 0, // v7panel25: сорняки для пульта
        rw: { hike: rw.hike || 0, cook: rw.cook || 0, quest: rw.quest || 0 }, g9: g9MeSnap(h) || undefined, tu: turnUsed(h), rws: h._rewStream === streamCur().id ? 1 : 0, /* v8.1: награда «Сделать ход» прожата в этом стриме */ qs: panelQuests(h), sd: +h.seeds || 0, sdp: +h.seedsPrem || 0, rcp: C.recipes.map(r => (recipeOpen(h, r) ? 1 : 0) | (canAfford(h, r) ? 2 : 0)), mg: magicInfo(h), sal: saladInfo(h), cd: hikeCdLeft(h), ccd: Math.max(0, Math.ceil(((h._cookCd || 0) - Date.now()) / 1000)), bk: panelBossCd(h), /* v49.10: откаты босса для пульта (сек): c — общий КД контроля, l — блок, s — !удар, h — !лечить, r — воскрешение/очищение, q — антиспам чата по командам */ buffs: (h.rpg_buffs || []).length, bf: buffList(h), sr: heroStatRows(h).map(([i, n, v]) => [i, n, String(v).replace(/<[^>]+>/g, '')]), eqS: eqOnList(h), dr: (() => { const R = durRepairList(h); if (!R) return undefined; return { t: R.tot, g: R.gold, ok: R.ok ? 1 : 0, w: R.why || "", i: R.items.map(x => [x.s, x.pct, x.cost, x.id, x.ir || 0]), ti: R.ti || 0 }; })(), lg: (h.rpg_gear || []).slice(0, 12), lgs: (() => { const tOn = trophyOn(h); return [...new Set(h.rpg_gear || [])].slice(0, 12).map(id => { const z = gearById(id); return z ? [z.id, z.name, z.tier || 1, gearSellPrice(z), gearBonusTxt(z), tOn && tOn.id === z.id ? 1 : 0] : null; }).filter(Boolean); })(), /* v49.8: [5] = активный трофей */ esp: Object.fromEntries([...new Set(h.rpg_eqOwn || [])].map(id => { const it = eqItem(id); return it ? [id, [eqSellPrice(h, it, false), SH_ON() ? shLv(h, id) : 0, (h.rpg_eqOwn || []).filter(x => x === id).length]] : null; }).filter(Boolean)), /* v49.8: цена продажи с заточкой [цена, +ур, копий] */ mt: Object.assign({}, h.rpg_mats || {}), iv: panelInv(h), q: h.rpg_quest ? (questById(h.rpg_quest.id) || {}).text || h.rpg_quest.id : null, qp: h.rpg_quest ? h.rpg_quest.prog : 0, qn: h.rpg_quest ? (questById(h.rpg_quest.id) || {}).need : 0, k6: k6 || '', dy: dyeOf(h) || '', fm: FM[n] || null, bed: panelBed(h), sets: panelSets(h), sh: panelSharp(h), shp: panelSharp(h) /* v8.1: «sh» читает старая заточка пульта (season.js) — не трогать; shp — для кнопки «Заточка» */, fc: +h.rpg_freeChange > 0 ? 1 : undefined, sa: panelSeasonMe(h) }; // v47: sets — пульт показывает «Сет 1 / Сет 2» только если игра их прислала
    }
    const b = S.boss;
    const mobs = []; BATTLES.forEach(b => { if (b.mon && !b.mon.dead && b.mon.d) mobs.push([b.mon.d.id, Math.round(b.mon.x), Math.round(b.mon.y), Math.round(b.mon.hp / b.mon.maxhp * 100)]); });
    const clockMs = t => t > 0 ? Date.now() + Math.round((t - now()) * 1000) : 0; // v49.6: абсолютное epoch-ms для таймера пульта (Date.now(), не время загрузки страницы)
    const walls = panelWalls();
    const bossSnap = !b ? null : { ph: b.phase, name: b.name, in: b.phase === 'wait' ? Math.max(0, Math.round(b.spawnAt - now())) : 0, n: (b.signup || []).length, key: b.key || '', flt: b.filter || '', hp: b.phase === 'fight' ? Math.max(0, Math.round(b.hp || 0)) : 0, mhp: b.phase === 'fight' ? b.maxhp || 0 : 0, lair: lairKey() !== 'boss' ? lairKey() : undefined, sw: b.phase === 'fight' && BF && BF.sw ? [BF.sw.larvae.length, BF.sw.cocoons.filter(c => c.st === 'grow').length] : undefined, cast: panelCast(b), rm: panelRumble(b), tr: b.phase === 'fight' && BF && BF.tr ? TRT.snap(BF) : undefined, pl: b.phase === 'fight' && BF ? (bossPhaseLine() || undefined) : undefined, /* v8: строка фазы (Печать/Метка/Ярость) для пульта */
      spawnAt: b.phase === 'wait' && b.spawnAt ? clockMs(b.spawnAt) : undefined, startAt: (b.phase === 'fight' || b.phase === 'done') && b.startAt ? clockMs(b.startAt) : undefined, endAt: b.phase === 'fight' && b.endAt ? clockMs(b.endAt) : undefined, fightAt: b.phase === 'signup' && b.signupUntil ? clockMs(b.signupUntil) : undefined, win: b.phase === 'done' ? (b.fled ? 0 : 1) : undefined, wl: walls && walls.length ? walls : undefined }; // v49.6: spawnAt/startAt/endAt/fightAt — epoch-ms; пульт считает локально; v49.12: wl — активные заслоны
    const fx = panelFx();
    return { t: Date.now(), cam: CAM.loc, locs, heroes, mobs, stream: streamFlag(), live: liveNow(), test: panelTestOn() ? 1 : undefined, owner: panelTestOn() ? streamerLogin() : undefined, ref: Object.assign({}, panelRef(), { log: panelLog(), pty: panelParty(), sg: panelGoal(), fx: fx, mobs: mobs, faces: (C.monFacesRight || ['slime', 'queen_boss']).slice(), wl: walls /* v49.12: купол заслона на большом экране */ }), boss: bossSnap, fx: fx }; /* v49.10c: fx — кольцо цифр и выпадов ~2.8 с */
  }
  // v7panel30: пати для пульта (только отображение). Едет в ref.pty — relay пропускает ref без изменений, старые клиенты поле игнорируют.
  // { sz, mn, wv: волн, q: [ники очереди ≤12], qn: всего в очереди, left: сек до авто-старта (-1 — ждём полный отряд/тропу), lane: 1 — отряд собран, ждёт свободную тропу,
  //   go: [[ [ники], 'маска живых 1/0', фаза, волна ]] ≤6 } ; null — пати выключены
  function panelParty() { const P = PTY(); if (!P || !P.enabled) return null; const cut = n => String(n || '').slice(0, 25), q = PARTYQ.users;
    const n = q.length, full = n >= P.size, left = !n ? -1 : full ? 0 : Math.max(0, Math.round(P.waitSec - (Date.now() - PARTYQ.t0) / 1000));
    const go = [], seen = {};
    BATTLES.forEach(b => { const p = b.party; if (!p || seen[p.id] || go.length >= 6) return; seen[p.id] = 1; const us = (p.users || []).slice(0, P.size + 2), G = b.G || b;
      go.push([us.map(cut), us.map(u => BATTLES.some(x => x.user === u && x.party === p) ? 1 : 0).join(''), String(G.phase || ''), Math.min(G.waves || C.expeditionWaves, (+G.wave || 0) + 1)]); });
    const mb = [], seenM = {};
    BATTLES.forEach(b => {
      if (!b || !b.party || seenM[b.user]) return;
      const h = S.heroes[b.user]; if (!h) return;
      seenM[b.user] = 1;
      const rt = ensureRT(h), stt = stats(h), k6 = hero6Key(h, rt) || '';
      mb.push([cut(h.user), h.rpg_class || '', h.rpg_guild || '', Math.round(h.rpg_hp), stt.maxhp, Math.max(0, Math.round(h._shield || 0)), Math.max(0, Math.round(h._shieldMax || 0)), Math.round(rt.x), Math.round(rt.y), k6, h.rpg_level, h.rpg_gender === 'female' ? 'f' : 'm']);
    });
    return { sz: P.size, mn: P.min, wv: C.expeditionWaves, q: q.slice(0, 12).map(cut), qn: n, left, lane: full && partyLanesFree() < partyNeedLanes(P.size) ? 1 : 0, go, mb: mb.slice(0, 16) }; }
  // v7panel20 п.8: журнал для пульта — бой (clog) + события (log) за последние PANEL_LOG_MIN минут, до 80 строк: [время, текст, вид b|e]
  const PANEL_LOG_MIN = 15;
  // v7panel28 п.4: раньше .slice(-80) + CLOGH 300 строк → на активном стриме журнал покрывал ~4 мин. Теперь 15 мин целиком, но сжато:
  // одинаковые строки → [t, текст, вид, N]; «A → B: урон X (K ударов)» одной пары за минуту — суммируются. Бюджет ~24 КБ, сверх — режем самые старые.
  const PANEL_LOG_BYTES = 24000;
  function panelLog() { const from = Date.now() - PANEL_LOG_MIN * 60000, cut = t => String(t || '').slice(0, 320); /* fix: длинные строки (бонус гильдии) не обрезаются */
    const src = CLOGH.filter(e => e.t >= from).map(e => [e.t, cut(e.text), 'b']).concat(EVH.filter(e => e.t >= from && !/^(→ бот:|нет связи с Streamer\.bot)/.test(String(e.text || ''))).map(e => [e.t, cut(e.text), 'e'])).sort((a, b) => a[0] - b[0]);
    const out = [], dmg = {}, same = {}, RX = /^(.+): урон (\d+) \((\d+) удар(?:а|ов)?\)$/;
    for (const e of src) {
      const m = RX.exec(e[1]);
      if (m) { const d = dmg[m[1]]; if (d && e[0] - d.t0 < 60000) { d.v += +m[2]; d.n += +m[3]; d.e[0] = e[0]; d.e[1] = `${m[1]}: урон ${d.v} (${d.n} ${plural(d.n, 'удар', 'удара', 'ударов')})`; continue; }
        const r = [e[0], e[1], e[2]]; out.push(r); dmg[m[1]] = { t0: e[0], v: +m[2], n: +m[3], e: r }; continue; }
      const k = e[2] + e[1], p = same[k]; if (p && e[0] - p[0] < 60000) { p[3] = (p[3] || 1) + 1; p[0] = e[0]; continue; }
      const r = [e[0], e[1], e[2]]; out.push(r); same[k] = r;
    }
    out.sort((a, b) => a[0] - b[0]);
    let bytes = 0, i = out.length; while (i > 0 && (bytes += out[i - 1][1].length * 2 + 24) < PANEL_LOG_BYTES) i--;
    return out.slice(i); }
  // v7panel8 п.9: инвентарь для карточки «Мой герой» на пульте — компактно, только ненулевое: [смайлик, название, кол-во]. Relay отдаёт зрителю только его героя (me).
  function panelInv(h) {
    const cut = s => String(s || '').slice(0, 28), m = [], f = [], p = [], c = [], dcP = id => DCSS_ON() && dcKey(id) ? 'ic:' + dcKey(id) : ''; // v7panel21 п.1: 'ic:<ключ>' → img/ic/<ключ>.png на пульте
    (C.materials || []).forEach(x => { const n = +(h.rpg_mats || {})[x.id] || 0; if (n) m.push([dcP(x.id) || x.icon || '🪨', cut(x.name), n]); });
    const dn = {}; (h.rpg_dishes || []).forEach(id => dn[id] = (dn[id] || 0) + 1);
    const EMO = { crop_carrot: '🥕', crop_cucumber: '🥒', crop_eggplant: '🍆', crop_pumpkin: '🎃', crop_tomato: '🍅', potion: '🧪' }, ic = (v, d) => (v && !/^[a-z0-9_]+$/i.test(v)) ? v : (EMO[v] || d); // v7panel11: icon в рецептах — код спрайта, на пульт отдаём смайлик
    for (const id in dn) { const r = recipeById(id) || {}; f.push([ic(r.icon, '🍲'), cut(r.name || id), dn[id]]); }
    (h.rpg_buffs || []).forEach(b => { const r = recipeById(b.id) || {}; f.push([ic(r.icon, '🍲'), cut(r.name || b.id), b.charges || 0, 1]); }); // 4-й элемент = активный бафф
    (C.recipes || []).filter(r => r.kind === 'potion').forEach(r => { const n = +(h.rpg_bag || {})[r.id] || 0; if (n) p.push([dcP(r.id) || ic(r.icon, '🧪'), cut(r.name), n]); });
    const CI = { aura: '✨', set: '👘', trail: '💫' };
    if (COS_ON()) COS_TYPES.forEach(t => ((h.rpg_owned || {})[t] || []).slice(0, 12).forEach(id => { const z = cosPool(t).find(q => q.id === id); if (z) c.push([CI[t] || '🎀', cut(COS_T[t] + ': ' + z.name), (h.rpg_eq || {})[t] === id ? 1 : 0]); }));
    // v7panel42/44: пассивный лут сундука — [ic, label, n, id, price, bonus] (старый пульт читает 0..2)
    const tOn = trophyOn(h), g = [...new Set(h.rpg_gear || [])].slice(0, 8).map(id => { const z = gearById(id); return z ? ['🏆', cut('Трофей: ' + z.name), 1, z.id, gearSellPrice(z), gearBonusTxt(z), tOn && tOn.id === z.id ? 1 : 0] : null; }).filter(Boolean); // v49.8: [6] = активный трофей
    return { m, f: f.slice(0, 16), p, c: c.slice(0, 20), g };
  }
  // v7panel3: справочники для кнопок пульта (названия гильдий, вещи, цвета, постройки, задания) — без секретов
  let PREF = null, PREF_T = 0;
  function panelRef() {
    const t = Date.now(); if (PREF && t - PREF_T < 10000) return PREF; PREF_T = t;
    return PREF = {
      g9: g9Snap() || undefined, /* v9: механики гильдий */
      guilds: (() => { const ga = guildCounts(), gt = guildCounts(null, true); const sg = GB.smallJoinGold == null ? 200 : +GB.smallJoinGold; return C.guilds.map(g => [g.id, g.name + ((S.guildStars || {})[g.id] ? ' ★' : ''), g.color, ga[g.id], gt[g.id], GACTD(), sg > 0 && guildSmall(g.id) ? sg : 0, underdogGuilds().some(x => x.id === g.id) ? Math.round((GB.underdogBonus || 0) * 100) : 0]); })(), /* v8.7: [6]=золото за вступление, [7]=% бонуса слабой */ /* v49.8: [3]=активных, [4]=всего, [5]=дней */
      px: 499, /* v49.8: расстановка героев в лагере/у босса/в походе, костёр без анимации; цель стрима ref.sg; кольца без дублей; */ /* v49.7: цирюльник (ref.hb, me.hk/ha) если px ≥ 498; */ /* v49.6: пульт показывает «сейчас даёт» / «следующий уровень даст» у построек только если px ≥ 497; */ /* v49.6: таймер босса (spawnAt/startAt/endAt/fightAt) если px ≥ 496; */ /* v49.5: «Опутан N с» и «Рубить» (boss.tr) если px ≥ 495; */ /* v49.4: «снять квест» / «купить семена N» */
      hair: !HAIR_ON() ? [] : HAIRS().map(x => [x.id, x.name, (!BARB_ON() && x.ramp) || null, x.only || null]), hairPrice: hairPrice(), beardPrice: beardPrice(), hairOn: HAIR_ON(), hb: BARB_ON() ? 1 : 0, /* v49.7 px498: цирюльник на готовых спрайтах */
      eq: EQ().items.map(i => [i.id, i.name, i.price, i.slot, i.cls || null, needBs(i), eqStatTxt(i), eqIcSpec(i.id) /* v7panel37: [7] ключ иконки для пульта, 'ключ~оттенок' */]), slots: EQ().slots,
      bld: BLD.map(id => { const b = C.buildings[id], st = S.buildings[id] || { lv: 1, fund: 0 }, top = bGold(id, st) === undefined; return [id, b.name, st.lv, bMaxN(id), top ? null : Math.max(0, bGold(id, st) - (st.fund || 0)), b.loc, bFxTxt(bText(id, st.lv)), top ? null : bFxTxt(bText(id, st.lv + 1)), top ? {} : Object.fromEntries(Object.entries(bNeed(id, st)).map(([m, n]) => [m, Math.max(0, n - ((st.mats || {})[m] || 0))]).filter(x => x[1] > 0)), bFxTxt(bReal(id, st.lv)), top ? null : bFxTxt(bReal(id, st.lv + 1)), bvInfo(id) || undefined]; }), /* v49.6 px497: [2]/[3] ур./макс., [9]/[10] сейчас/следующий (bReal, без HTML), [4]/[8] цена */ matP: DMP(), ic: DCSS_ON() ? 1 : 0, /* v7panel21 п.1: пульт берёт img/ic/<id>.png */ mats: (C.materials || []).map(m => [m.id, m.name, m.icon || '']), // v7panel18: [8] = сколько материалов осталось
      bsLv: (S.buildings.blacksmith || {}).lv || 1,
      quests: Object.fromEntries(QUESTS().map(q => [q.id, q.text])),
      crops: (C.crops || []).map(c => [c.id, c.name]),
      gear: (C.gear || []).map(z => [z.id, z.name, z.tier || 1, gearSellPrice(z), gearBonusTxt(z)]), // v7panel44: каталог лута для продажи на пульте
      tb: TURN_ON() ? 1 : 0, tl: TURN_LIM(), trn: C.turnRewardName || 'Сделать ход', ch: String(C.twitchChannel || '').replace(/[^a-z0-9_]/gi, '').slice(0, 25), // v7panel31: кнопка «Сделать ход»
      bc: BC_ON() ? BC_MAX() : 0, // v7panel24: готовка пачкой — пульт показывает выбор количества только при включённом флаге
      recipes: C.recipes.map(r => [r.name, r.kind, Object.entries(r.need).map(([k, n]) => `${cropName(k)} ${n}`).join(', '), recipeLv(r), r.text || '', DCSS_ON() && r.kind === 'potion' ? dcKey(r.id) : '']), // v7panel4 п.5; v7panel20 п.3: + эффект
      sharp: panelSharpRef(), season: panelSeasonRef(), cls: C.classes.map(c => [c.id, c.name, c.nameF || '']), bv2: BV2() ? 1 : 0, hearts: BV2() ? bvHeartTxt() : undefined, // v49: пульт показывает заточку/сезон только если игра прислала эти поля
      sets: SETS_ON() ? SETS_N : 0, // v47: пульт показывает «Сет 1 / Сет 2» только когда игра это умеет
      stream: streamFlag() // v7panel32 (v7panel37: по Twitch, если Streamer.bot шлёт Online/Offline): статус стрима для пульта
    };
  }
  // Кнопки пульта: игра выполняет ТО ЖЕ, что чат-команда от этого ника (chat()), в тихом режиме (без ответов в чат).
  // Ник приходит от relay (он берёт его из проверенного Twitch-токена), клиент пульта ник не передаёт.
  const PANEL_FARM = ['семена', 'посадить', 'грядка', 'жуки', 'собрать', 'магия', 'обмен', 'урожай', 'салат'];
  const PANEL_ALLOW = ['голос', 'гм', 'цель', 'наградить', 'казна', 'бафф', 'гильдпоход', 'погладить', 'поход', 'пати', 'огород', 'готовить', 'продать', 'квест', 'вклад', 'титул', 'парикмахер', 'купить', 'экип', 'сет', 'снять', 'чинить', 'починить', 'гильдия', 'вступить', 'да', 'нет',
    'ход', 'босс', 'удар', 'лечить', 'оглушить', 'связать', 'очистить', 'замедлить', 'заслон', 'воскресить', 'прикрыть', 'отмена', 'купитьсемена', 'заточка'].concat(PANEL_FARM); // v49.4: + отмена квеста, покупка семян
  const PANEL_CD = {};
  // v7panel31: «Сделать ход» с пульта. Обычно ход — награда канала за баллы Twitch (пульт баллы списать не может).
  // C.panelTurnButton !== true → кнопка только объясняет, где взять награду; true → игра сама даёт ход (как награда: +1 поход/готовка/квест, максимум C.reward.max),
  // но не больше C.panelTurnPerStream (по умолчанию 1) раз за стрим на зрителя; при полном запасе ход не тратится.
  const TURN_ON = () => C.panelTurnButton === true, TURN_LIM = () => Math.max(1, Math.min(20, Math.floor(+C.panelTurnPerStream) || 1));
  function turnUsed(h) { const s = streamCur(), u = h && h.rpg_pturn; return u && u.sid === s.id ? +u.n || 0 : 0; }
  function stockTxt(t) { return `поход ${t.hike || 0}, готовка ${t.cook || 0}, квест ${t.quest || 0} (максимум ${(C.reward || {}).max || 3})`; }
  function panelTurn(n) {
    const h = getHero(n, false); if (!h) return { ok: false, msg: 'героя не нашли', code: 'nohero' };
    const RN = C.turnRewardName || 'Сделать ход', t0 = Object.assign({ hike: 0, cook: 0, quest: 0 }, h.rpg_reward || {});
    if (!TURN_ON()) return { ok: false, code: 'turn-off', msg: `«${RN}» — награда канала за баллы Twitch, пульт баллы списать не может. Прожмите её за баллы канала (значок баллов под чатом Twitch). Сейчас в запасе: ${stockTxt(t0)}.` };
    const lim = TURN_LIM(), used = turnUsed(h);
    if (used >= lim) return { ok: false, code: 'turn-limit', msg: `с пульта уже ${used} из ${lim} за этот стрим. Дальше — награда «${RN}» за баллы канала. Запас: ${stockTxt(t0)}.` };
    const mx = (C.reward || {}).max || 3;
    if (['hike', 'cook', 'quest'].every(k => (t0[k] || 0) >= mx)) return { ok: false, code: 'turn-full', msg: `запас ходов уже полный (${stockTxt(t0)}) — сначала потратьте их: «В поход», «Готовить», «Квест». Ход с пульта не потрачен.` };
    redeem(h); giveReward(h);
    h.rpg_pturn = { sid: streamCur().id, n: used + 1 };
    log(`${h.user}: ход с пульта (${used + 1}/${lim} за стрим)`, '#ffd27a');
    save(); refreshUI(); publishSnapSoon();
    return { ok: true, code: 'turn', msg: `ход сделан! Запас: ${stockTxt(h.rpg_reward)}. С пульта за стрим: ${used + 1} из ${lim}.` };
  }
  function panelCmd(login, cmd, arg) {
    const P = C.panel || {}; cmd = String(cmd || '').toLowerCase(); arg = String(arg == null ? '' : arg).replace(/[\u0000-\u001f!@#<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    login = lc(String(login || '').trim()); if (!/^[a-z0-9_]{1,25}$/.test(login)) return { ok: false, msg: 'неверный ник' };
    if (P.actions === false) return { ok: false, msg: 'кнопки пульта выключены стримером' };
    // v49.4: «Отменить квест» и «Купить семена» с пульта. Relay пропускает только свой белый список, где нет «отмена»/«купитьсемена», поэтому пульт v49.4 шлёт их как «снять квест» и «купить семена N»
    if (cmd === 'снять' && /^квест$/i.test(arg)) { cmd = 'отмена'; arg = ''; }
    const seedsBuy = (cmd === 'купить' || cmd === 'купитьсемена') && /^(семена)?(?: ?(\d{1,2}))?$/i.exec(arg); if (cmd === 'купитьсемена' && !seedsBuy) return { ok: false, msg: 'неверный выбор' };
    if (!PANEL_ALLOW.includes(cmd)) return { ok: false, msg: 'такой команды нет в пульте' };
    const t = Date.now(), cdMs = +P.cmdCooldownMs > 0 ? +P.cmdCooldownMs : 1500;
    if (t - (PANEL_CD[login] || 0) < cdMs) return { ok: false, msg: 'слишком часто — подождите секунду', code: 'cooldown' };
    PANEL_CD[login] = t; if (Object.keys(PANEL_CD).length > 5000) for (const k in PANEL_CD) if (t - PANEL_CD[k] > 60000) delete PANEL_CD[k];
    const n = findNick(login);
    if (!n && cmd !== 'вступить') return { ok: false, msg: 'у вас пока нет героя: возьмите награду канала «' + (C.heroRewardName || 'Стать героем') + '»', code: 'nohero' };
    if (cmd === 'ход') return panelTurn(n);
    if (seedsBuy && (cmd === 'купитьсемена' || seedsBuy[1])) { const r0 = buySeeds(n, +seedsBuy[2] || 1); publishSnapSoon(); return { ok: !!(r0 && r0.ok !== false), msg: String((r0 && (r0.msg || r0.text)) || 'готово').replace(/^@\S+,?\s*/, '').slice(0, 300) }; } // v49.4
    if (['поход', 'готовить', 'квест'].includes(cmd)) {
      const h = getHero(n, false);
      if (h && h._rewStream !== streamCur().id) return { ok: false, msg: 'нужна награда канала — прожми один раз за стрим' };
    }
    const text = '!' + cmd + (arg ? ' ' + arg : '');
    if (PANEL_FARM.includes(cmd) || cmd === 'отогнать') PANEL_LAST[lc(n)] = { cmd, t: Date.now() }; // v7panel11: ответ бота (farmVars) после кнопки пульта показываем только как событие ЭТОЙ команды
    if (PANEL_FARM.includes(cmd) && (params.has('standalone') || params.has('test'))) { // без бота огород считает сама игра
      const FF = { 'семена': 'freeSeeds', 'посадить': 'plant', 'грядка': 'bedInfo', 'жуки': 'bugs', 'собрать': 'harvest', 'магия': 'magic', 'обмен': 'exchange', 'урожай': 'bag', 'салат': 'salad' }[cmd];
      PANEL_QUIET = true; let r0; try { if (cmd === 'грядка') chatCommand(n, text); r0 = farm[FF](n); /* v7panel6: раньше chatCommand + farm[FF] выполняли посадку/сбор/магию дважды */ } catch (e) { r0 = { ok: false, msg: 'ошибка игры' }; console.error(e); } finally { PANEL_QUIET = false; }
      publishSnapSoon(); return { ok: !!(r0 && r0.ok !== false), msg: String((typeof r0 === 'string' ? r0 : r0 && (r0.msg || r0.text)) || 'готово').replace(/^@\S+,?\s*/, '').slice(0, 300) }; // v7panel4: bedInfo отдаёт строку
    }
    if (PANEL_FARM.includes(cmd) ) { // огород считает Streamer.bot: игра просит бота выполнить команду как от этого зрителя, тихо
      if (P.farmViaBot === false) return { ok: false, msg: 'кнопки огорода пока выключены — пишите команду в чат' };
      const h = getHero(n, false), before = farmSnapOf(h);
      const r = emitBot({ event: 'panelCmd', user: n, userName: n, command: text, cmd, arg, silent: true }, (C.botActions && C.botActions.panelCmd) || 'Пульт: команда');
      // v7panel8 п.4: раньше здесь был chatCommand → при «старых» farmVars герой шёл к грядке с репликой («Магия!») даже в КД; теперь анимация — только по реальному изменению farmVars (farmReact)
      if (!r.sent) return { ok: false, msg: 'бот огорода сейчас не подключён', code: 'nobot' };
      // v7panel4 п.6: ждём ответ бота (farmReply от действия «Пульт: команда») — текст как у бота в чате; не пришёл — свой текст по farmVars
      return farmWait(n, cmd, h, before);
    }
    PANEL_QUIET = true; PANEL_QUIET_LOG = []; let r;
    const hh = getHero(n, false), hj = () => { try { return JSON.stringify(hh); } catch (e) { return ''; } }, hb = hh ? hj() : ''; // v7panel8 п.6: если команда успела изменить героя, а потом что-то упало — это не «ошибка игры»
    try { r = chat(n || login, text); } catch (e) { console.error(e); const ch = hh && hb && hj() !== hb; r = ch ? { ok: true, msg: (PANEL_QUIET_LOG.filter(x => typeof x === 'string').join(' ') || 'выполнено') } : { ok: false, msg: 'ошибка игры' }; } finally { PANEL_QUIET = false; }
    r = r || { ok: PANEL_QUIET_LOG.length > 0 };
    let msg = r.msg || PANEL_QUIET_LOG.filter(x => typeof x === 'string').join(' ') || (r.ok ? 'готово' : 'не получилось');
    msg = String(msg).replace(/^@\S+,?\s*/, '').slice(0, 300);
    publishSnapSoon();
    return { ok: !!r.ok, msg };
  }
  // ===== v7panel4 п.6: ответ огорода для пульта =====
  const FARM_WAIT = {}, FARM_WAIT_MS = () => Math.min(7000, Math.max(1000, +((C.panel || {}).farmReplyMs) || 6000));
  function forceSync(h) {
    if (!h) return;
    emitBot({ event: 'farmRequest', user: h.user, txid: h.user + '-fs' + Date.now().toString(36) }, (C.bot && C.bot.farmRequestAction) || 'RPG Farm Request');
  }
  const FV_N = {}; // счётчик farmVars по герою — чтобы понять, прислал ли бот новые данные
  const VEG_IC = { veg_cucumber: '🥒', veg_tomato: '🍅', veg_carrot: '🥕', veg_eggplant: '🍆', veg_pumpkin: '🎃', veg_weed: '🌿' };
  function bedText(h) { // состояние грядки по данным игры (farmVars бота или своя грядка), без изменения состояния
    if (!h) return 'нет героя';
    if (h.bugAttack) return 'на грядке жуки! Отгони их: !жуки';
    if (h.gardenStatus === 2) return 'твоё растение уже созрело!🌾 Можно собирать: !собрать';
    if (h.gardenStatus === 1 && (!(h.plantedAt > 0) || h._paGuess)) return 'семечко растёт, время созревания неизвестно';
    if (h.gardenStatus === 1 && h.plantedAt > 0) { const left = G().growSeconds - (now() - h.plantedAt); return left > 0 ? `осталось примерно ${Math.max(1, Math.ceil(left / 60))} мин до созревания!` : 'твоё растение уже созрело!🌾 Пиши !собрать'; }
    return 'на грядке ничего не растёт 🌱 Посади: !посадить';
  }
  function farmDiffText(cmd, b, h) {
    if (cmd === 'грядка') return { ok: true, msg: bedText(h) + ' (по данным игры)' };
    if (!b || !h || (FV_N[lc(h.user)] || 0) === b.n) return null; // бот не прислал новых данных
    const parts = [], d = k => (+h[k] || 0) - (b[k] || 0);
    VEGK.forEach(k => { const x = d(k); if (x) parts.push(`${VEG_IC[k]} ${x > 0 ? '+' : ''}${x}`); });
    const ds = (+h.seeds || 0) - b.seeds, dp = (+h.seedsPrem || 0) - b.seedsPrem;
    if (ds) parts.push(`семена ${ds > 0 ? '+' : ''}${ds} (теперь ${+h.seeds || 0})`); if (dp) parts.push(`волшебные семена ${dp > 0 ? '+' : ''}${dp}`);
    if (b.bug && !h.bugAttack) parts.push('жуки прогнаны');
    if (b.st !== 1 && h.gardenStatus === 1) parts.push('семечко посажено');
    if (!parts.length) return { ok: false, msg: 'ничего не изменилось' + (cmd === 'обмен' ? ' (нужно 10 сорняков)' : '') + ' — подробности в чате' };
    return { ok: true, msg: (cmd === 'обмен' ? 'обмен: ' : cmd === 'магия' ? 'магия: ' : cmd === 'салат' ? 'салат: ' : '') + parts.join(', ') };
  }
  function farmSnapOf(h) { if (!h) return null; const o = { seeds: +h.seeds || 0, seedsPrem: +h.seedsPrem || 0, st: h.gardenStatus, bug: !!h.bugAttack, pa: h.plantedAt, n: FV_N[lc(h.user)] || 0 }; VEGK.forEach(k => o[k] = +h[k] || 0); return o; } // v43b: восстановлено (пропало в v7panel35 → огород пульта падал до DoAction, relay «игра не ответила»)
  function farmWait(n, cmd, h, before) {
    const key = lc(n) + '|' + cmd; if (FARM_WAIT[key]) FARM_WAIT[key].done(null);
    return new Promise(resolve => {
      const w = FARM_WAIT[key] = { done(r) { if (FARM_WAIT[key] !== w) return; delete FARM_WAIT[key]; clearTimeout(w.t); publishSnapSoon();
        resolve(r || farmDiffText(cmd, before, getHero(n, false) || h) || { ok: true, msg: 'бот не прислал ответ за ' + Math.round(FARM_WAIT_MS() / 1000) + ' с — результат смотрите в чате стрима', code: 'noreply' }); } };
      w.t = setTimeout(() => w.done(null), FARM_WAIT_MS());
    });
  }
  function farmEventIn(d) { if (d.event === 'farmReply') return farmReply(d); if (d.event === 'farmVars' && d.user) { syncVars(d.user, typeof d.vars === 'string' ? JSON.parse(d.vars) : d.vars); FV_N[lc(d.user)] = (FV_N[lc(d.user)] || 0) + 1; return true; } return false; }
  function farmReply(d) { // {event:'farmReply', user, command:'!обмен', ok, text}
    const cmd = lc(String(d.command || d.cmd || '')).replace(/^!/, '').split(' ')[0], w = FARM_WAIT[lc(d.user) + '|' + cmd]; if (!w) return false;
    const ok = !(d.ok === false || d.ok === 'false' || d.ok === 'False' || d.ok === 0);
    w.done({ ok, msg: String(d.text || d.message || (ok ? 'готово' : 'не получилось')).replace(/^@\S+,?\s*/, '').slice(0, 300) }); return true;
  }
  let PANEL_SOON = 0;
  function publishSnapSoon() { if (PANEL_SOON) return; PANEL_SOON = setTimeout(() => { PANEL_SOON = 0; PREF = null; panelSend(); }, 150); }
  function panelSend() {
    const ws = PANEL.ws; if (!ws || ws.readyState !== 1 || !PANEL.ok) return;
    if (ws.bufferedAmount > 256 * 1024) return; // сеть не успевает — пропускаем кадр
    try { const s = JSON.stringify({ type: 'snap', d: panelSnapshot() }); ws.send(s); PANEL.sent++; PANEL.bytes = s.length; } catch (e) { console.warn('panel', e); }
  }
  function panelConnect() {
    const P = C.panel || {}; if (!P.enabled || !P.url || !P.key || typeof WebSocket === 'undefined') { PANEL.state = 'off'; return; }
    if ((!S || !S.order.length) && !params.has('panelEmpty')) { PANEL.state = 'wait-heroes'; clearTimeout(PANEL.timer); PANEL.timer = setTimeout(panelConnect, 3000); return; } // v7panel19: копия игры без героев (вкладка браузера, пустой OBS-профиль) не перехватывает пульт
    let ws; PANEL.state = 'connecting';
    try { ws = new WebSocket(String(P.url).replace(/\/+$/, '') + '/game'); } catch (e) { PANEL.state = 'error'; return panelRetry(); }
    PANEL.ws = ws; PANEL.ok = false;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', key: P.key }));
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.type === 'hello-ok') { PANEL.ok = true; PANEL.state = 'online'; PANEL.retry = 2000; panelSend(); }
      else if (m.type === 'cmd' && m.rid) { const send = r => { try { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'cmd-res', rid: m.rid, ok: !!r.ok, msg: r.msg, code: r.code || null })); } catch (x) { } }; // v7panel4: ответ огорода приходит позже (Promise)
        const r = panelCmd(m.login, m.cmd, m.arg); if (r && typeof r.then === 'function') r.then(send, () => send({ ok: false, msg: 'ошибка игры' })); else send(r); } };
    ws.onclose = e => { PANEL.ok = false; PANEL.ws = null; const c = e && e.code; PANEL.state = c === 4003 ? 'bad-key' : c === 4009 ? 'replaced' : 'closed'; if (c === 4003) return; // неверный ключ — не долбимся
      if (c === 4009) { console.warn('panel: к пульту подключилась другая копия игры — эта отключена (v7panel19)'); return; } // v7panel19: раньше обе копии переподключались по кругу и пульт мигал
      panelRetry(); };
    ws.onerror = () => {};
  }
  function panelRetry() { clearTimeout(PANEL.timer); PANEL.timer = setTimeout(panelConnect, PANEL.retry); PANEL.retry = Math.min(60000, PANEL.retry * 2); }
  if ((C.panel || {}).enabled) { panelConnect(); setInterval(panelSend, Math.max(500, +(C.panel.everyMs) || 1000)); }
  const api = {
    createHero: (nick, classId, gender) => createHero(nick, classId, gender),
    reward: (nick, text, ids) => { const ex = findNick(nick); if (!ex) { const sp = parseHeroSpec(text); if (!sp.ok) return heroNeedInfo(String(nick || '').trim(), text, sp.why, ids); CREATE_WHY = CREATE_WHY || 'награда канала'; createHero(nick, sp.cls, sp.gender, false); } const h = getHero(nick, false); if (!h) return { ok: false }; const before = Object.assign({}, h.rpg_reward || {}); if (ex) redeem(h); giveReward(h); const exh = ex ? heroExists(h, text, before, ids) : null, full = ex && !exh ? rewardFull(h, before, ids) : null; const hb = ex ? hikeBusy(h) : '', hint = hb ? expeditionHint(h, hb) : null; save(); refreshUI(); return { ok: true, reward: h.rpg_reward, hikeBusy: hb, hint, heroExists: exh, rewardFull: full }; },
    removeTests: () => { const L = S.order.filter(n => /^Тест_\d+$/.test(n)); if (S.boss && S.boss.test && bossActive()) endBoss(false, 'тест'); L.forEach(n => removeHero(n)); return { ok: true, msg: L.length ? `удалено тестовых: ${L.length}` : 'тестовых героев нет' }; }, // v49.10: кнопка дока «Удалить тестовых»
    streamerShoo: (target) => { // v6.50b: кнопка стримера «Отогнать жуков у зрителя» (!отогнать <ник> — только стример)
      const t = findNick(String(target || '').trim()); if (!t) return { ok: false, msg: 'нет героя с таким ником' };
      const st = params.has('standalone') || params.has('test'), me = C.streamerNick || 'стример';
      if (st) { getHero(me, true); return farm.shoo(me, t); }
      const r = emitBot({ event: 'streamerShoo', user: me, target: t, command: '!отогнать ' + t, silent: true }, (C.botActions && C.botActions.streamerShoo) || 'Пульт: команда');
      if (Date.now() - FARMVARS_SEEN > 120000 && S.heroes[t] && S.heroes[t].bugAttack) farmShow(S.heroes[t], 'shoo'); // v7panel11
      return { ok: true, sent: r.sent, msg: `отогнать жуков у ${t} → бот` };
    },
    redeem: (nick, text) => { if (!findNick(nick)) return api.reward(nick, text); const h = getHero(nick, true); redeem(h); giveReward(h); save(); refreshUI(); return { ok: true }; },
    removeHero, listHeroes: () => S.order.slice(), getHero: nick => { const n = findNick(nick); return n ? JSON.parse(JSON.stringify(S.heroes[n])) : null; }, hairOf: nick => { const n = findNick(nick); return n ? hairOf(S.heroes[n]) : null; }, hairDrop: nick => { const n = findNick(nick); if (n) delete S.heroes[n].rpg_hair; }, hairPortrait: nick => { const n = findNick(nick), h = n && S.heroes[n], k = h && hero6Key(h, {}); return k ? portraitSrc(h, k) : null; },
    sendToGarden: (nick, action) => action && farm[action] ? farm[action](nick) : gardenAuto(nick),
    plots: () => PLOTS.slice(),
    // v6.31: тестовые помощники готовки
    cookState: () => S.cooking.map(j => Object.assign({}, j)), recipeSec: id => recipeSec(recipeById(id)),
    cookTest: (nick, o) => { const h = getHero(nick, true); for (const k in (o.veg || {})) h['veg_' + k] = o.veg[k]; if (o.skill) for (const k in o.skill) skill(h, k).lv = o.skill[k]; if (o.quest) h.rpg_quest = { id: o.quest, prog: 0 }; if (o.save) save(); return { ok: true, quest: h.rpg_quest, cooked: h.rpg_cooked, dishes: h.rpg_dishes.concat(h.rpg_buffs.map(b => b.id)), bag: Object.assign({}, h.rpg_bag) }; },
    topRects: () => TOP6.map(r => ({ id: r[4], x1: r[0], y1: r[1], x2: r[2], y2: r[3] })), labelRects: () => LBL6.map(r => r.map(Math.round)), campSlots: () => B6.camp ? campSlots() : [], rtInfo: () => Object.fromEntries(Object.entries(RT).map(([u, r]) => [u, { loc: r.loc, x: Math.round(r.x), y: Math.round(r.y), flip: !!r.flip, ghost: !!r.ghost, mode: r.mode, sit6: !!r.sit6, behind: !!(r.formation && r.formation.behind), bub: r.bubble && r.bubXY ? r.bubXY : null }])), bossFaceRight: () => bossFaceRight(SPOT('boss', 'boss')),
    sendToExpedition, cook, sellVeg, sellLoot, gearSellPrice, gearBonusTxt, parseLootSellArg, chat, cmd: runCmd, panelCmd,
    // v6.32
    streamNew: (why, goalId) => { const s = streamNew(why || 'кнопка стримера', goalId); save(); return { id: s.id, goal: s.goal }; },
    streamOnline: (src, startedAt) => { const r = liveSet(true, src || 'вручную', true); twMark(startedAt); return r; }, streamOffline: src => liveSet(false, src || 'вручную'), panelTest: on => { S.ptest = on === undefined ? !S.ptest : !!on; save(); return { test: panelTestOn(), owner: streamerLogin() }; }, liveInfo: () => ({ live: liveNow(), stream: streamFlag(), test: panelTestOn(), owner: streamerLogin() }),
    lootCfg: () => ({ rare: RARE_LOOT(), RL: Object.assign({}, RL), LB: LOOTB(), eqIcons2: EQI2(), obsPlus: OBS_LOG_PLUS(), icons: DCSS_ON() ? 'dcss' : (C.invIcons || 'pixel') }), // v7panel21
    streamReset: () => { S.stream = null; STREAMCARD = false; const s = streamNew('сброс из control'); save(); return { id: s.id, goal: s.goal }; },
    goalReset: () => { const s = streamCur(); s.goal = null; const list = (SG.list || []).filter(g => g.enabled !== false && g.need > 0); const d = list[Math.floor(Math.random() * list.length)]; if (d) { s.goal = { id: d.id, type: d.type, text: d.text, need: d.need, prog: 0, done: false, ms: 0, doneAt: 0, rewarded: 0, t0: Date.now(), ev: 0 }; goalSay('start'); } save(); return s.goal; },
    goalAdd: (type, n, nick) => { goalAdd(type, n, nick ? getHero(nick, true) : null); save(); return S.stream && S.stream.goal; },
    syncVars: (n, v) => syncVars(n, v), parseHeroSpec: (t, strict) => parseHeroSpec(t, strict), vegAcct: n => { const h = getHero(n, false); if (!h) return null; const a = vegAcct(h); return { on: a.on, base: Object.assign({}, a.base), counted: Object.fromEntries(VEGK.map(k => [k, vegCounted(h, k)])) }; }, goalMinSec: sec => { SG.goalMinSec = sec; return SG.goalMinSec; },
    streamGoal: () => S.stream && S.stream.goal ? Object.assign({ textFull: goalText(S.stream.goal) }, S.stream.goal) : null,
    setBossMusicStyle: st => setBossMusicStyle(st), bossMusicState: () => Object.assign({ style: bmStyle(), on: bmOn() }, BAUD ? BAUD.state() : {}),
    streamDemo: () => { S.order.forEach((n, i) => { const h = S.heroes[n]; sStat(h, 'dmg', 400 + i * 230); sStat(h, 'heal', h.rpg_class === 'priest' ? 1500 : i * 40); sStat(h, 'gold', 30 + i * 10); if (S.stream) S.stream.gold += 30 + i * 10; }); return streamSummary(); },
    fameList: n => S.fame.slice(0, n || 20), streamSummary, streamCard, recapStart: w => recapStart(w), recapStop, recapState, recapCards: () => recapCards().map(c => ({ title: c.title, sub: c.sub, lines: c.lines })), heroOfDay: () => { const h = heroOfDay(); return h ? { user: h.user, dmg: h.dmg, heal: h.heal, contrib: h.contrib, score: h.score } : null; },
    streamFinish: () => { const h = streamFinish(); save(); return h ? h.user : null; },
    fairStart: min => fairStart(min), fairStop: () => fairStop(), fairState: () => ({ active: fairActive(), until: S.fair ? S.fair.until : 0, left: S.fair ? Math.max(0, S.fair.until - now()) : 0, bonusVeg: FAIR.bonusVeg, bonusPumpkin: FAIR.bonusPumpkin }),
    freeSeeds: farm.freeSeeds, giveSeeds: farm.giveSeeds, giveMagicSeeds: farm.giveMagicSeeds,
    plant: farm.plant, bugs: farm.bugs, shoo: farm.shoo,
    harvest: farm.harvest, exchange: farm.exchange, magic: farm.magic, salad: farm.salad,
    bag: farm.bag, bedInfo: farm.bedInfo, setEvent,
    styleSat: () => { const ms = c => { const x = c.getContext ? c.getContext('2d') : null; let cv = c; if (!x) { cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); } const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let S = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 100) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); S += mx ? (mx - mn) / mx : 0; n++; } return n ? S / n : 0; };
      return Object.keys(M6).filter(k => !k.endsWith('_sit')).map(k => { const cls = Object.keys(CLS_PROF).concat(['warrior', 'archer', 'priest', 'paladin', 'assassin', 'mage']).find(c => k.includes(c)) || ''; const c = sprite('h6_' + k, 240); if (!c) return { k }; const a = ms(c), b = ms(unified(c, 1, cls)); return { k, cls, before: +a.toFixed(3), after: +b.toFixed(3), drop: +(1 - b / a).toFixed(3) }; }); },
    toggleCombatLog, combatLog: () => ({ show: CLOG_SHOW, lines: CLOG.map(l => l.text), queue: CLOGQ.length, queued: CLOGQ.map(l => l.text) /* v7panel21: при obsLogPlus строки ждут в очереди */, plus: OBS_LOG_PLUS(), hist: CLOGH.length }), clogTest: (t, c) => clog(t, c),
    joinGuild, chooseQuest, getQuestOffers, abandonQuest, donate, equip, bInfo, lblDebug: () => JSON.parse(JSON.stringify(LBLDBG)), openMenu: id => { MENU = id ? { id, loc: C.buildings[id].loc } : null; }, // v7panel17: тест — окно постройки
    // v7panel3b: подготовка облегчённых спрайтов для пульта (tools/bake_viewer_heroes.mjs) — тот же «unify», что в игре, без окраски/волос
    bakeHero6: (k, sc) => { const m = M6[k]; if (!m || !IMG['h6_' + k] || !IMG['h6_' + k].width) return null; const hh = Math.round(m.h * sc);
      const c0 = sprite('h6_' + k, hh / K), c = unified(c0, unifyLevel(), k.split('_')[2]); if (!c) return null;
      const mi = IMG['hm_' + k], out = { w: c.width, h: c.height, png: c.toDataURL('image/png'), hm: null };
      if (mi && mi.width && !isPH('hm_' + k)) { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(mi, 0, 0, o.width, o.height); out.hm = o.toDataURL('image/png'); }
      return out; },
    giveGold: (nick, n) => { const h = getHero(nick, true); h.rpg_gold += +n || 100; save(); refreshUI(); return { ok: true, gold: h.rpg_gold }; },
    lootPopups: () => LOOTPOP.map(p => ({ user: p.user, title: p.title, lines: p.lines.slice(), gold: p.gold })),
    lastLoot: () => LASTLOOT.map(o => JSON.parse(JSON.stringify(o))), bossRewards: () => BOSSREWARDS.map(o => JSON.parse(JSON.stringify(o))), fxKinds: () => FX.map(f => f.kind),
    testBossReward: (n, sp) => { if (sp) api.setSpeed(sp); testBossSquad(n || 5, true); hudTab = 'boss'; goLoc('boss'); const g0 = {}; S.boss.signup.forEach(u => g0[u] = S.heroes[u].rpg_gold); const r = endBoss(true, 'тест награды');
      return { ok: r.ok, killed: r.killed, heroes: Object.keys(g0).map(u => ({ user: u, gold: S.heroes[u].rpg_gold - g0[u], reward: S.heroes[u]._lastBossReward || [] })) }; },
    // v6.44: тест/скриншоты — следующий моб в походе героя (id из C.monsters) и подмена текущего босса (id или имя из bossEvent.bosses)
    testMob: (nick, id) => { const b = BATTLES.find(x => x.user === (findNick(nick) || nick)); if (!b) return { ok: false, msg: 'нет похода' }; b.forceMon = id; if (b.mon && !b.mon.dead) { b.mon = null; b.phase = 'spawn'; } return { ok: true }; },
    mobState: (nick) => { const b = BATTLES.find(x => x.user === (findNick(nick) || nick)); if (!b) return { b: false }; return { b: true, phase: b.phase, mon: b.mon && !b.mon.dead ? b.mon.d && b.mon.d.id || b.mon.id || '?' : null }; },
    testBossDef: (key) => { const d = BE.bosses.find(x => x.name === key) || BE.bosses.find(x => x.id === key); if (!d || !S.boss) return { ok: false }; Object.assign(S.boss, { key: d.id, name: d.name, gen: d.gen || d.name, acc: d.acc || d.name, filter: d.filter || '', fem: !!d.fem, size: d.size || 0, recLevel: d.recLevel || 0 }); if (BF) BF.def = d; return { ok: true, name: d.name }; },
    bossPick: (idx) => { const d = bossDef(idx); return { id: d.id, name: d.name, top: bossTopLevel() }; },
    v657b2: nick => { const b = BATTLES.find(x => x.user === nick); const T = b && (b.G || b); return { fx: FX.map(f => f.kind), mimicAt: T ? T.mimicAt : null, phase: T ? T.phase : null, mon: b && b.mon ? { id: b.mon.d.id, mimic: !!b.mon.d.mimic, x: b.mon.x, dead: !!b.mon.dead } : null, wave: b ? b.wave : null, chestH: CHEST_H }; },
    partyOrder: () => { const g = BATTLES.filter(b => b.G); return g.map(b => ({ user: b.user, cls: getHero(b.user, true).rpg_class, slot: b.slot, x: b.x })); },
    petSet: (nick, pet) => { const h = getHero(nick, true); if (!h) return false; h.rpg_eq.pet = pet; return true; },
    petLookTest: () => ({ look: C.petLook, faces: C.monFacesRight }),
    mimicNext: nick => { const b = BATTLES.find(x => x.user === nick); if (!b) return false; (b.G || b)._forceMimicChest = true; return true; },
    mimicSpawn: (nick, k) => { const b = BATTLES.find(x => x.user === nick && !x.G) || BATTLES.find(x => x.user === nick); if (!b) return { ok: false }; const T = b.G || b; T.forceMon = 'mimic'; if (T.mon && !T.mon.dead) { T.mon.d = mimicDef(C.monsters.filter(m => m.minLevel <= 1)); T.forceMon = null; } return { ok: true, group: !!b.G, now: !!T.mon }; },
    mimicDef: () => mimicDef(C.monsters.filter(m => m.minLevel <= 1)), mimicLoot: (nick, n) => { const h = getHero(nick, true), r = []; for (let i = 0; i < (n || 1); i++) r.push(mimicLoot(h, { x: 1400, y: ROAD, d: { name: 'Мимик' } }, false)); return r; },
    chestFxTest: (tier, x, y) => { goLoc('forest'); FX.push({ kind: 'chestdrop', loc: 'forest', x: x || 1400, y: y || ROAD, tier, name: (C.chests[tier] || {}).name || tier, lines: ['тест'], color: '#fff', t: 0, life: 4 }); return true; },
    mimicFreeze: (nick, anim, fi) => { const b = BATTLES.find(x => x.user === nick); if (!b || !b.mon) return false; const T = b.G || b; b.mon._anim = anim ? [anim, fi | 0] : null; T.timer = anim ? 999 : 0.2; return { x: b.mon.x, y: b.mon.y, id: b.mon.d.id, hp: b.mon.hp, atk: b.mon.atk, phase: T.phase }; },
    mimicRollN: n => { let k = 0; for (let i = 0; i < n; i++) if (mimicRoll(5)) k++; return k / n; }, monState: nick => { const b = BATTLES.find(x => x.user === nick); return b && b.mon ? { id: b.mon.d.id, hp: b.mon.hp, maxhp: b.mon.maxhp, phase: (b.G || b).phase, dead: b.mon.dead } : null; },
    testMonsterLoot: (nick, tier) => { const h = getHero(nick, true); const pos = { x: 1400, y: ROAD, loc: 'forest' }; goLoc('forest'); const r = giveChest(h, tier || 'wooden', 'тест', pos); return { ok: true, items: r.map(o => o.text) }; },
    giveChest: (nick, tier) => { const h = getHero(nick, true); giveChest(h, tier || 'wooden', 'панель'); save(); refreshUI(); return { ok: true }; },
    giveMats: (nick, n) => { const h = getHero(nick, true); C.materials.forEach(m => h.rpg_mats[m.id] = (h.rpg_mats[m.id] || 0) + (+n || 10)); save(); return { ok: true }; },
    giveVeg: (nick, n) => { const h = getHero(nick, true); ['cucumber', 'tomato', 'carrot', 'eggplant', 'pumpkin', 'weed'].forEach(v => h['veg_' + v] += (+n || 5)); save(); refreshUI(); return { ok: true }; },
    testRealPrize: nick => { const h = getHero(nick || ACTIVE || 'Тест', true); const p = rollRealPrize(h, 'test', true); return { ok: !!p, prize: p && p.name }; },
    markPrize, fameText,
    startBoss: opts => startBoss(opts), endBoss: (k, why) => endBoss(!!k, why), joinBoss, strike, heal, _say: (n, t) => { const h = getHero(n, false); if (h) say(h, t, 30); }, testBossSquad: (n, fight, sp, key) => { if (sp) api.setSpeed(sp); const r = testBossSquad(n, fight, key); hudTab = 'boss'; goLoc('boss'); return r; }, beginFight: () => beginFight(), spawnBoss: () => { if (!S.boss || S.boss.phase !== 'wait') sessionTouch('кнопка'); spawnBoss(); return { ok: true }; }, sessionTouch: w => sessionTouch(w || 'кнопка'), bossCC: (n, ab) => bossCC(n, ab), hikeBusy: n => { const h = S.heroes[findNick(n)]; return h ? hikeBusy(h) : null; }, heroHintReset: () => { for (const k in HERO_EX_T) delete HERO_EX_T[k]; for (const k in REW_FULL_T) delete REW_FULL_T[k]; }, hikeHintReset: () => { for (const k in HIKE_HINT_T) delete HIKE_HINT_T[k]; }, bossFight: () => BF, testCast: win => { if (!BF) return { ok: false, msg: 'бой не идёт' }; const force = () => { const c = BF && BF.cast; if (!c) return; if (win) { const i = c.order.indexOf(win); if (i >= 0) c.p = i / 3 + 0.03; } }; if (!BF.cast) { BF.castT = 0; setTimeout(force, 400); } else force(); return { ok: true }; },
    testCC: ab => { if (!BF) return { ok: false, msg: 'бой не идёт' }; const A = BC.CC[ab]; const id = Object.keys(BF.all).find(n => { const u = BF.all[n]; return u.sq >= 0 && u.hp > 0 && A.classes.includes(u.cls) && BF.t >= (u.cd || 0); }); if (!id) return { ok: false, msg: 'нет свободного героя нужного класса' }; return Object.assign({ nick: id }, bossCC(id, ab)); },
    guildSim: (n, pref) => { pref = pref || [55, 25, 12, 8]; const tot = pref.reduce((a, b) => a + b, 0); let blocked = 0; for (let i = 0; i < (n || 100); i++) { let r = Math.random() * tot, k = 0; while (k < pref.length - 1 && (r -= pref[k]) > 0) k++; const nick = 'Гильд_' + (S.order.length + 1); createHero(nick, C.classes[i % C.classes.length].id, i % 2 ? 'f' : 'm', true); const h = S.heroes[findNick(nick)]; if (Math.random() < 0.6) { const r2 = joinGuild(nick, String(k + 1)); if (!r2.ok) { blocked++; autoGuild(h); } } else autoGuild(h); } return { counts: guildCounts(), blocked, underdog: underdogGuilds().map(g => g.name) }; },
    logTail: n => S.log.slice(-(n || 30)).map(l => l.text),
    farmShows: () => Object.assign({}, FARM_LAST), fxTexts: () => FX.filter(f => f.kind === 'text').map(f => f.text), // v7panel8 п.4: тесты реакций огорода
    hairCanvas: (k, hid) => { const im = IMG['h6_' + k]; if (!im || !im.width) return null; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return [c, haired(c, k, hid)]; }, // v7panel8: тест перекраски на file:// (пиксели не читаются — сравнение по скриншоту)
    hairChanged: (k, hid) => { const im = IMG['h6_' + k]; if (!im || !im.width) return -1; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); // v7panel4 п.7: тест — сколько пикселей перекрашено
      const o = haired(c, k, hid); if (o === c) return 0; const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, b = o.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; },
    partyJoin: n => partyJoin(n), panelCmd: (l, c, a) => panelCmd(l, c, a), farmEvent: d => farmEventIn(d), partyTag: n => { const h = getHero(n, false); return h ? partyTagText(h) : ''; }, partyGo: () => partyGo(), partyQueue: () => ({ users: PARTYQ.users.slice(), t0: PARTYQ.t0, cfg: PTY() }), battles: () => BATTLES.map(b => ({ user: b.user, party: !!b.party, wave: b.wave, lane: b.lane, group: b.G ? b.G.id : null, slot: b.slot, gphase: b.G ? b.G.phase : null, mon: b.mon && { id: b.mon.d.id, hp: b.mon.maxhp, cur: b.mon.hp, atk: b.mon.atk } })), expQueue: () => EXPQ.slice(), queueLines: () => queueLines(),
    heroWinVar: () => hwVar(), heroWinExpand: () => hwExpandToggle(),
    heroWin: (open, v, tab, inv) => { if (v) HW_VAR = v; if (tab) hwTab = tab; if (inv) invTab = inv; HW_OPEN = open !== false; renderHeroWin(); return { open: HW_OPEN, v: hwVar() }; },
    buyEquip: (n, q) => buyEquip(n, q), equipBonus: n => equipBonus(S.heroes[n]), stats: n => stats(S.heroes[n]),
    invTab: k => { invTab = k; hudTab = 'camp'; renderHUD(true); return invTab; },
    questList: () => QUESTS().map(q => q.id + ':' + q.type), // v7panel33
    questEvent: (type, data, n) => { const h = S.heroes[findNick(n)]; if (h) questEvent(type, data || {}, h); return h ? h.rpg_questsDone : null; }, // v6.55 тест
    questOpen: u => { QOPEN = u || null; return QOPEN; }, scrollRects: () => SCROLL6.map(s => ({ ...s })), hoverRects: () => HOVER.map(b => ({ id: b.id, loc: b.loc, x: b.x, y: b.y, w: b.w, h: b.h })),
    noteDisp: (n, d) => noteDisp(n, d), dispName: n => { const h = S.heroes[findNick(n)]; return h ? DN(h) : null; },
    gardenTest: nick => { const list = nick ? [findNick(nick)].filter(Boolean) : S.order.slice(0, 8); return list.map(n => { farm.plant(n); return n; }); }, joinGuild: (n, g) => joinGuild(n, g), guildAsk: (n, g, ui) => guildAsk(n, g, ui), guildConfirm: (n, y) => guildConfirm(n, y !== false), bannerText: () => BANNER_TXT, recapSpeed: v => recapSpeed(v), recapGo: i => recapGo(i), streamCardBoxes: () => SC_BOXES.slice(), setBossMusic: on => setBossMusic(on !== false), bossAudio: () => ({ on: bmOn(), music: AUD.music, fails: AUD.fails, player: BAUD ? BAUD.state() : null }), testFailSfx: () => { bossFailSfx(); return { ok: true }; }, guildPending: () => ({ pend: JSON.parse(JSON.stringify(GPEND)), modal: GMODAL }), guildCounts: () => guildCounts(), guildJoinInfo: u => guildJoinInfo(u), testPopups: (n, modal) => { const h = S.heroes[findNick(n)]; if (!h) return null; lootPopup(h.user, 'Добыча: ' + h.user, ['Шкура волка ×2', 'Клык ×1'], '#ffd27a', 12, ''); if (modal) MODALS.push({ type: 'chest', user: h.user, tier: 'gold', items: [], t: 0 }); return { ok: true }; }, uiMini: () => ({ hud: HUD_MINI, clog: CLOG_MINI, clogBtn: CLOG_BTN && { ...CLOG_BTN } }), zoomInfo: () => ({ zoom: ZOOM, view: ZVIEW && { ...ZVIEW }, live: { ...ZLIVE }, toScreen: (x, y) => { const z = ZC; ZC = ZVIEW; const r = zw2s(x, y); ZC = z; return r; } }), heroScreen: n => { const h = S.heroes[findNick(n)]; if (!h) return null; const rt = ensureRT(h); const z = ZC; ZC = ZVIEW; const r = zw2s(rt.x, rt.y - heroH(rt) / 2); ZC = z; return r; }, testGuildSet: (n, gid, ago) => { const h = S.heroes[findNick(n)]; if (!h) return null; if (gid !== undefined) h.rpg_guild = gid; if (ago) h.rpg_guildJoined = now() - ago; delete h.rpg_guildAuto; save(); return { g: h.rpg_guild, j: h.rpg_guildJoined }; }, underdog: () => underdogGuilds().map(g => g.id),
    camSettled: () => CAM.t >= 1,
    panelInfo: () => ({ state: PANEL.state, sent: PANEL.sent, bytes: PANEL.bytes, enabled: !!(C.panel || {}).enabled }), panelSnapshot: () => panelSnapshot(), // v7 пульт шаг 2
    chicken: () => ({ enabled: !!chickCfg().enabled, x: CHK.x, y: CHK.y, st: CHK.st, fi: CHK.fi, flip: CHK.flip, draws: CHK.draws, last: CHK.lastDraw, moved: CHK.moved, zone: chickZone() }), // v6.53
    chickenSet: (st, loops) => { chickSet(st, loops); return CHK.st; },
    bossInfo: () => S.boss ? JSON.parse(JSON.stringify(S.boss)) : null,
    setCamera: loc => setCamera(loc, true), forceLoc: loc => setCamera(loc, true, true), bossLock: () => !!bossLock(), goLoc: l => goLoc(l), rt: n => RT[findNick(n)], nav: { route, snap }, scale: () => K, getCamera: () => CAM.loc,
    setActive: nick => setActive(nick, true), setFollow: v => { FOLLOW = !!v; CAM.followLoc = null; return FOLLOW; }, getSeats: () => S.seats.slice(0, seatCount()),
    recipeVerbs: () => C.recipes.map(r => Object.assign({ id: r.id, name: r.name, kind: r.kind }, recipeVerb(r))),
    heroState: nick => { const n = findNick(nick); if (!n) return null; const h = S.heroes[n], rt = ensureRT(h); return { loc: rt.loc, mode: rt.mode, state: heroState(h), x: Math.round(rt.x), y: Math.round(rt.y), bubble: rt.bubble ? rt.bubble.lines.join(' ') : null }; },
    toggleHUD: v => { toggleHUD(v); return !$('hud').classList.contains('hidden'); },
    setVip: (nick, v) => { const h = getHero(nick, true); h.vip = !!v; save(); return { ok: true }; },
    setSpeed: n => { const i = C.speedSteps.indexOf(+n); if (i >= 0) speedIdx = i; return C.speedSteps[speedIdx]; },
    fastForward: sec => { sec = +sec || 0; const step = 5; for (let t = 0; t < sec; t += step) { const d = Math.min(step, sec - t); S.clock += d; cookTick(d); bossTick(d); } farmTick(); bossTick(0); save(); refreshUI(); return now(); },
    resetSeedCooldown: nick => { const list = nick ? [findNick(nick)].filter(Boolean) : S.order; list.forEach(n => { const h = S.heroes[n]; h.seedsLastTime = 0; h.seedsCooldown = false; h.plantCooldown = false; }); save(); return { ok: true, n: list.length }; },
    syncVars, syncFromBot: syncVars, emitBot,
    _t: { snap: () => panelSnapshot(), ref: () => { PREF = null; return panelRef(); }, banner: () => seasonBannerText(), shQuote: (n, s, l) => shQuote(getHero(n, false), s, l), shChance: (n, id, t, l) => shChance(getHero(n, false), eqItem(id), t, l), shBonus: (n) => sharpBonus(getHero(n, false)), shDrops: { boss: (n, t3, t1) => shBossDrop(getHero(n, false), t3, t1), chest: (n, tier) => { const o = []; shChestDrop(getHero(n, false), tier, o); return o; }, mimic: n => { const o = []; shMimicDrop(getHero(n, false), o); return o; }, weekly: (n, wd) => shWeeklyDrop(getHero(n, false), wd || {}) }, bvHearts: bvHeartDrop, seasonLast: () => SEASON_LAST, QSW, qsw: () => BF && BF.sw, lairKey: () => lairKey(), lairCfg: k => lairCfg(k || lairKey()), lairSpot: k => SPOT('boss', k), bossDefOf: () => bossDefOf(S.boss), bossDef: i => bossDef(i), formation: () => formationSpots(), swarmOn: () => swarmOn(bossDefOf(S.boss)), qLarvaXY: l => qLarvaXY(l), mobFlip: id => ({ forest: !!(C.monFacesRight || []).includes(id), boss: BOSS_MIRROR(id) }), gearCap: (n, raw) => equipBonus(getHero(n, false), raw), locDbg: () => ({ REG6, BEDS6, PLOT_STAND, PLOT_XY, CAULDRON, CAULDRON6, FIRE, TENTS, TOWN, SHED, GROUND6, campSlots: SLOTS6.camp, townSlots: SLOTS6.town, nav: (window.LAYOUT6 || {}).nav, hover: HOVER.map(h => ({ id: h.id, loc: h.loc, x: h.x, y: h.y, w: h.w, h: h.h })) }), // locations_v1: отладка координат
      expGo: n => sendToExpedition(n), mobLvK: (lv, k) => mobLvK(lv, k), soloWaveHeal: () => soloWaveHeal(), trophyCmd: (n, q) => trophyCmd(n, q), trophyOn: n => trophyOn(getHero(n, false)), guildCounts: (e, a) => guildCounts(e, a), eqSellPrice: (n, id) => { const h = getHero(n, false); return eqSellPrice(h, eqItem(id), false); }, eqResolve: q => eqResolve(q), autoGuild: n => autoGuild(getHero(n, false)), durWear: (n, slots, k) => durWear(getHero(n, false), slots, k), durHit: (n, k) => { const h = getHero(n, false); for (let i = 0; i < (k || 1); i++) durOnHit(h); }, durHurt: (n, k) => { const h = getHero(n, false); for (let i = 0; i < (k || 1); i++) durOnHurt(h); }, durInfo: n => { const h = getHero(n, false); return DUR_SLOTS.map(s => eqItem((h.rpg_equip || {})[s])).filter(Boolean).map(it => ({ id: it.id, slot: it.slot, price: it.price, cur: durCur(h, it), max: durMax(it), mul: durMul(h, it), cost: durCost(h, it) })); }, durRepair: n => durRepairList(getHero(n, false)), fmtHP,  heroStats: n => { const h = getHero(n, false); return h ? stats(h) : null; }, mobK: ids => mobAtkK(ids), gearCapCfg: () => GEARCAP(), eqIcons: () => Object.fromEntries(EQ().items.map(i => [i.id, eqIcSpec(i.id)])), nerfCfg: () => ({ md: MOBDIF(), k: mobAtkK(), pal: NERF('paladin'), pri: NERF('priest'), pct: PCT() }), rewNow: h => { h._rewStream = streamCur().id; }, chestItem, lootVeg, lootK, lootHikeMark, eq2Key, dcKey, panelLog, log, botSent: () => BOTSENT.slice(), battlesRaw: () => BATTLES, loseBattle, finishExpedition, panelSnapshot, heroRaw: n => getHero(n, false), rt: n => ensureRT(getHero(n, false)), streamStats: () => streamCur().stats, sellLoot, gearSellPrice, gearBonusTxt, parseLootSellArg, farmSnapOf, hybridOf: n => hybridOf(getHero(n, false)), bossHyHeal, buySeeds, seedJournal, rollRealPrize, realStreamTotal, realStreamCap, chatT: (n, t) => chat(n, t), setsCmd, panelSets: n => panelSets(getHero(n, false)), panelCmd }, // v7panel28/44 (+v46): тестовые хуки
    demo,
    wearEquip: (n, q) => wearEquip(n, q), sellEquip: (n, q, c) => sellEquip(n, q, c), repairCmd: (n, a) => repairCmd(n, a), stoneToIron: (n, a) => stoneToIron(n, a), seasonExport: () => seasonExport(), seasonInfo: () => seasonInfo(), seasonRestore: () => seasonRestore(), seasonBoot: () => seasonBoot(false), sharpen: (n, a) => sharpenCmd(n, a), changeCmd: (n, a) => changeCmd(n, a), seasonRank: () => seasonRanking().map(x => ({ user: x.h.user, sc: x.sc, lp: x.lp, wp: x.wp, sp: x.sp, r: x.r })), bvInfo: id => bvInfo(id), bvStreamTick, bLvEff: (id, k) => bEff(id, k),
    reset: () => { S = newState(); S.season = seasonTarget() > 1 && SEASON_NOW() >= seasonStartMs() ? seasonTarget() : 1; resetRuntime(); ACTIVE = ''; save(); renderLog(); log('Игра сброшена'); refreshUI(); return { ok: true }; },
    exportState: () => JSON.stringify(S, null, 1),
    importState: json => { try { S = migrate(JSON.parse(json)); if (seasonTarget() > seasonNo() && SEASON_NOW() >= seasonStartMs()) S.seasonSkip = seasonSkipKey(); /* v49: ручной импорт сохранения не запускает вайп повторно */ resetRuntime(); S.order.forEach(n => goCamp(S.heroes[n])); save(); renderLog(); refreshUI(); return { ok: true }; } catch (e) { return { ok: false, msg: String(e.message || e) }; } },
    snapshot,
    get state() { return S; },
  };
  window.game = api;

  // ?ws=ws://127.0.0.1:8080/ — WebSocket-сервер Streamer.bot (запасной канал, если панель не видит игру)
  function connectWS(url) {
    let ws;
    try { ws = new WebSocket(url); } catch (e) { log('WebSocket: неверный адрес'); return; }
    WS = ws;
    ws.onopen = () => { log('WebSocket Streamer.bot подключён', '#9fc5e8'); setTimeout(() => { while (BOTQ.length) { const q = BOTQ.shift(); if (Date.now() - q.t < 120000) try { ws.send(q.msg); } catch (e) { } } }, 300); try { ws.send(JSON.stringify({ request: 'Subscribe', id: 'rpgfarm-sub', events: { General: ['Custom'] } })); } catch (e) { } };
    ws.onmessage = ev => {
      let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (d && d.data && d.event && d.event.source) d = d.data;
      if (!d) return;
      CREATE_WHY = '';
      if (d.user) { const dn = [d.displayName, d.userDisplayName, d.display_name, d.user].find(x => typeof x === 'string' && /[A-ZА-ЯЁ]/.test(x)); if (dn) noteDisp(d.user, dn); } // v6.55
      if (d.game && typeof api[d.game] === 'function') { const a0 = (d.args || [])[0]; if (typeof a0 === 'string' && !/^(goLoc|forceLoc|setCamera|setSpeed|demo|exportState|importState|reset|getSeats|recapOpen)$/.test(d.game) && !mayCreate(a0, (d.game === 'reward' || d.game === 'redeem' || d.game === 'createHero') ? 'reward' : 'ws ' + d.game)) return; CREATE_WHY = CREATE_WHY && ('ws game:' + d.game); api[d.game].apply(null, d.args || []); CREATE_WHY = ''; return; }
      if (d.type === 'cmd') { wsControl = true; onCmd(d); return; }
      if ((d.event === 'farm' || d.event === 'reward') && d.user && !mayCreate(d.user, d.event === 'reward' ? 'reward' : d.event)) return;
      if (d.event === 'farmReply' && d.user) { farmReply(d); return; } // v7panel4 п.6: ответ действия «Пульт: команда»
      if (d.event === 'farmVars' && d.user) { syncVars(d.user, typeof d.vars === 'string' ? JSON.parse(d.vars) : d.vars); FV_N[lc(d.user)] = (FV_N[lc(d.user)] || 0) + 1; return; }
      if (d.event === 'farmBag' && d.user) syncVars(d.user, d);
      if (d.event === 'farm' && d.user) { const fh = getHero(d.user, true), fa = String(d.action || 'garden'); { const pc = panelWin(fh); if (pc && !(PANEL_FX_ALLOW[pc] || []).includes(fa === 'bugs' ? 'shoo' : fa)) return; } /* v7panel11 */ farmShow(fh, fa); return; }
      if (d.event === 'reward' && d.user) { { const one = [d.input, d.userInput, d.rawInput, d.message].find(x => typeof x === 'string' && x.trim()); api.reward(d.user, one !== undefined ? one : [d.cls, d.class, d.gender].filter(x => typeof x === 'string').join(' '), { rewardId: d.rewardId, redemptionId: d.redemptionId }); } return; }
      if (d.event === 'recap') { d.stop ? recapStop() : recapStart('команда стримера'); return; } // v6.41: действие Streamer.bot «RPG Recap»
      if (d.event === 'streamOnline') { liveSet(true, 'Twitch: стрим запущен', true); twMark(d.startedAt); return; } // v7panel20 (v7panel37: + статус live)
      if (d.event === 'streamOffline') { liveSet(false, 'Twitch: стрим завершён'); return; } // v7panel37
      if (d.event === 'streamStatus') { liveSet(d.live === true || d.live === 'true' || d.live === 'True', 'проверка при запуске'); return; } // v7panel37: запасной вариант
      if (d.event === 'chat' && d.user) chat(d.user, d.text || d.message, d.color);
    };
    ws.onclose = () => { if (WS === ws) WS = null; setTimeout(() => connectWS(url), 5000); };
    ws.onerror = () => { };
  }

  // ===================== СТАРТ =====================
  const fontReady = (document.fonts ? Promise.all([document.fonts.load(`700 32px 'Rubik'`, 'Привет Aa 123')]).then(() => document.fonts.ready) : Promise.resolve()).catch(() => { });
  Promise.all([fontReady, window.Assets.loadAll(C.classes)]).then(() => {
    const _ld = load(); S = _ld || newState(); window.__seasonBoot = seasonBoot(!_ld); // v49: вайп «Сезон 2» — один раз, если config.season.id больше номера сезона в сохранении и время ≥ startAt
    S.order.forEach(n => { const h = S.heroes[n]; if (h && h._vegCr) vegSync(h); }); // v7panel34: синхронизация овощей при загрузке
    S.order.forEach(n => { const h = S.heroes[n], rt = ensureRT(h); const i = S.seats.indexOf(n); if (i >= 0 && i < seatCount()) { const p = seatXY(i); rt.x = p.x; rt.y = p.y; rt.mode = 'seat'; } });
    CAM.x = locX(CAM.loc);
    S.order.forEach(n => { const h = S.heroes[n]; if (h) h7Load(hero7Name(h)); }); // v49.7: спрайты цирюльника
    setupInput(); renderLog();
    if (params.has('hide')) toggleHUD(false);
    if (params.get('hero')) setActive(params.get('hero'), false);
    if (params.get('ws')) connectWS(params.get('ws'));
    else if (C.bot && C.bot.wsUrl && params.get('ws') !== '0') connectWS(C.bot.wsUrl);
    const ch = params.get('channel') || C.twitchChannel; if (ch) connectTwitch(ch);
    const sim = params.has('standalone') || params.has('test');
    if (sim && params.has('demo') && !S.order.length) demo(+params.get('demo') || 12);
    if (sim && params.get('speed')) api.setSpeed(params.get('speed'));
    publishSnap(); renderHUD(true); setInterval(publishSnap, 1000); setInterval(partyTick, 1000); // таймер работает и во вкладке на фоне
    requestAnimationFrame(t => { lastT = t; frame(t); });
  });
})();
