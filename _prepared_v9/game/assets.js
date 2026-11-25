// ============================================================
//  МАНИФЕСТ КАРТИНОК. Все пути к картинкам — только здесь.
//  Если файл по пути существует — используется он.
//  Если нет — игра рисует простую пиксельную заглушку.
//  Чтобы заменить заглушку: положите PNG с прозрачным фоном
//  по указанному пути (имя файла должно совпадать).
// ============================================================
window.ASSET_MANIFEST = {
  images: {
    // --- фоны локаций (2560x1440) ---
    bg_camp:      'assets/bg/camp.png',
    bg_garden:    'assets/bg/garden.png',
    bg_forest:    'assets/bg/forest.png',
    bg_town:      'assets/bg/town.png',
    bg_boss:      'assets/bg/boss.png',
    // v6.46: фоны для 1080 (Lanczos из исходников 1280×720 + лёгкая резкость), берутся при масштабе <1
    bg1080_camp: 'assets/bg/1080/camp.png',
    bg1080_garden: 'assets/bg/1080/garden.png',
    bg1080_forest: 'assets/bg/1080/forest.png',
    bg1080_town: 'assets/bg/1080/town.png',
    bg1080_boss: 'assets/bg/1080/boss.png',
    fx_fire:      'assets/fx_fire47.png', // v6.47: огонь в стиле фона, нарисован в проекте по мотивам gif Tim (assets/fx_fire_src.gif), 10 кадров 32×44
    // --- лагерь ---
    campfire:     'assets/campfire.png',            // (старый цельный спрайт, больше не используется)
    campfire_base:'assets/campfire/campfire_base.png', // брёвна и камни — неподвижные
    campfire_flame:'assets/campfire/campfire_flame_strip.png', // лента кадров пламени (см. anim ниже)
    tent:         'assets/tent.png',
    stump:        'assets/props/stump.png',
    stump2:       'assets/props/stump2.png',
    // --- огород ---
    bed:          'assets/beds/bed.png',        // пустая грядка
    bed_wet:      'assets/beds/bed_wet.png',    // политая грядка
    bed_magic:    'assets/beds/bed_magic.png',  // волшебная грядка (светится)
    cauldron:     'assets/props/cauldron52.png', // v6.52: котёл Tim (огонь, пар, пузыри, половник), фон вырезан
    sign_lair48:  'assets/sign_lair48.png', // v6.48: указатель логова от Tim (отзеркален)
    shed:         'assets/buildings/shed.png',
    stage1:       'assets/stages/stage1_seed.png',
    stage2:       'assets/stages/stage2_sprout.png',
    stage3:       'assets/stages/stage3_young.png',
    stage4:       'assets/stages/stage4_big.png',
    ripe:         'assets/stages/stage4_big.png',   // созревшее растение — одинаковое для всех (без спойлеров)
    crop_cucumber:'assets/crops/cucumber.png',
    crop_tomato:  'assets/crops/tomato.png',
    crop_carrot:  'assets/crops/carrot.png',
    crop_eggplant:'assets/crops/eggplant.png',
    crop_pumpkin: 'assets/crops/pumpkin.png',
    crop_weed:    'assets/crops/weed.png',
    magic_flower: 'assets/crops/magic_flower.png',
    fairy:        'assets/crops/fairy.png',
    bug:          'assets/bug.png',
    // --- лес ---
    slime:        'assets/monsters/slime.png',
    goblin:       'assets/monsters/goblin.png',   // v6.44: новый лист (гоблин №2)
    rat:          'assets/monsters/rat.png',      // v6.44: крыса №1 (в лесу — стайкой по 3)
    tree_spirit:  'assets/monsters/tree_spirit.png', // v6.44: дух дерева №2
    wolf:         'assets/monsters/wolf.png',
    guild_wolf_alpha:   'assets/monsters/guild_wolf_alpha.png',   // v9: мини-боссы гильд-похода
    guild_goblin_chief: 'assets/monsters/guild_goblin_chief.png',
    guild_moss_golem:   'assets/monsters/guild_moss_golem.png',
    g9_crown: 'assets/icons/guild/gm_crown.png', g9_medal: 'assets/icons/guild/gm_medal.png', g9_bank: 'assets/icons/guild/guild_bank.png', // v9: иконки гильдий
    g9_buff_gold: 'assets/icons/guild/buff_gold.png', g9_buff_xp: 'assets/icons/guild/buff_xp.png', g9_buff_hp: 'assets/icons/guild/buff_hp.png', g9_buff_dmg: 'assets/icons/guild/buff_dmg.png',
    unicorn:      'assets/unicorn.png',
    ogre_boss:    'assets/monsters/ogre_boss.png',        // v6.44: Огр заменил Лесного тролля
    troll_boss:   'assets/monsters/ogre_boss.png',        // v6.44: старый ключ из сохранений → Огр
    treant_boss:  'assets/monsters/treant_king_boss.png', // v6.44: Король Трентов (поздняя стадия)
    queen_boss:   'assets/monsters/queen_boss.png',       // v6.44: Королева-Матка (поздняя стадия)
    chest:        'assets/props/chest.png',
    chest_open:   'assets/props/chest_open.png',
    chests_anim:  'assets/props/chests_anim.png', // v6.57c: z1 Animated Chests 48x32 (5 кадров × 8 строк)
    ico_shk:      'assets/icons/shikashi.png',    // v6.57c: Shikashi's Fantasy Icons Pack 32x32
    mimic_attack: 'assets/mimic/mimic_attack.png',
    mimic_chew: 'assets/mimic/mimic_chew.png',
    mimic_death: 'assets/mimic/mimic_death.png',
    mimic_hit: 'assets/mimic/mimic_hit.png',
    mimic_jump: 'assets/mimic/mimic_jump.png',
    mimic_lick: 'assets/mimic/mimic_lick.png',
    mimic_rest: 'assets/mimic/mimic_rest.png',

    // --- город ---
    guild_hall:   'assets/buildings/guild_hall.png',
    blacksmith:   'assets/buildings/blacksmith.png',
    notice_board: 'assets/notice_board.png',
    market_stall: 'assets/market_stall.png',
    // --- косметика (assets/cosmetics) ---
    hat_crown:    'assets/cosmetics/hat_crown.png',
    hat_tophat:   'assets/cosmetics/hat_tophat.png',
    hat_pirate:   'assets/cosmetics/hat_pirate.png',
    hat_santa:    'assets/cosmetics/hat_santa.png',
    hat_viking:   'assets/cosmetics/hat_viking.png',
    hat_flower:   'assets/cosmetics/hat_flower.png',
    hat_cowboy:   'assets/cosmetics/hat_cowboy.png',
    hat_halo:     'assets/cosmetics/hat_halo.png',
    pet_cat:      'assets/cosmetics/pet_cat.png',
    pet_dragon:   'assets/cosmetics/pet_dragon.png',
    pet_slime:    'assets/monsters/slime.png',   // временно: тот же спрайт, что у монстра
    pet_fairy:    'assets/crops/fairy.png',      // временно: фея с огорода
    trophy_boss:  'assets/cosmetics/trophy_boss.png',
    banner_guild: 'assets/cosmetics/banner_guild.png', // ткань — пурпурная маска, красится в цвет гильдии
    banner_guild_mask: 'assets/cosmetics/banner_guild_mask.png',
    // --- значки ---
    coins:        'assets/props/coins.png',
    coin_bag:     'assets/coin_bag.png',
    potion:       'assets/potion.png',
    scroll:       'assets/scroll.png',
    chicken_white_rest: 'assets/chicken/chicken_white_rest.png', // v6.53
    chicken_white_feed: 'assets/chicken/chicken_white_feed.png', // v6.53
    chicken_white_strut: 'assets/chicken/chicken_white_strut.png', // v6.53
    chicken_white_run: 'assets/chicken/chicken_white_run.png', // v6.53
    chicken_light_brown_rest: 'assets/chicken/chicken_light_brown_rest.png', // v6.53
    chicken_light_brown_feed: 'assets/chicken/chicken_light_brown_feed.png', // v6.53
    chicken_light_brown_strut: 'assets/chicken/chicken_light_brown_strut.png', // v6.53
    chicken_light_brown_run: 'assets/chicken/chicken_light_brown_run.png', // v6.53
    dagger:       'assets/dagger.png',
    shield:       'assets/shield.png',
  },

  // АНИМАЦИИ-ЛЕНТЫ: кадры одинаковой ширины слева направо
  anim: {
    campfire_flame: { frames: 10, fps: 9 },
    chicken_white_rest: { frames: 7, fps: 0 }, // v6.53: длительности кадров — в game.js (CHICK_DUR)
    chicken_white_feed: { frames: 4, fps: 0 }, // v6.53: длительности кадров — в game.js (CHICK_DUR)
    chicken_white_strut: { frames: 4, fps: 0 }, // v6.53: длительности кадров — в game.js (CHICK_DUR)
    chicken_white_run: { frames: 14, fps: 0 }, // v6.53: длительности кадров — в game.js (CHICK_DUR)
    chicken_light_brown_rest: { frames: 7, fps: 0 }, // v6.53: длительности кадров — в game.js (CHICK_DUR)
    chicken_light_brown_feed: { frames: 4, fps: 0 }, // v6.53: длительности кадров — в game.js (CHICK_DUR)
    chicken_light_brown_strut: { frames: 4, fps: 0 }, // v6.53: длительности кадров — в game.js (CHICK_DUR)
    chicken_light_brown_run: { frames: 14, fps: 0 }, // v6.53: длительности кадров — в game.js (CHICK_DUR)
  },

  // ТАБЛИЦА ГЕРОЕВ: класс + пол -> картинка.
  // src  — свой спрайт (если положите файл, он заменит всё остальное)
  // base — существующий спрайт, из которого делается временный вариант
  // filter — перекраска временного варианта (CSS-фильтр)
  // ┌──────────┬──────────────┬───────────────────────────────┐
  // │ Класс    │ Основа       │ Временный вариант             │
  // ├──────────┼──────────────┼───────────────────────────────┤
  // │ Маг      │ mage_blue    │ как есть                      │
  // │ Жрец     │ mage_white   │ как есть                      │
  // │ Воин     │ knight       │ как есть                      │
  // │ Паладин  │ knight       │ золотая перекраска            │
  // │ Лучник   │ archer       │ как есть                      │
  // │ Ассасин  │ archer       │ тёмно-фиолетовая перекраска   │
  // │ (жен.)   │ та же основа │ + розовый бантик              │
  // └──────────┴──────────────┴───────────────────────────────┘
  heroes: {
    mage:     { base: 'assets/mage_blue.png',  filter: 'none' },
    priest:   { base: 'assets/mage_white.png', filter: 'none' },
    warrior:  { base: 'assets/knight.png',     filter: 'none' },
    paladin:  { base: 'assets/knight.png',     filter: 'sepia(0.7) saturate(2.2) hue-rotate(-8deg) brightness(1.08)' },
    archer:   { base: 'assets/archer.png',     filter: 'none' },
    assassin: { base: 'assets/archer.png',     filter: 'hue-rotate(230deg) saturate(0.9) brightness(0.72)' },
  },
  // свой спрайт для класса и пола: assets/classes/<класс>_m.png и assets/classes/<класс>_f.png
  // перечислите классы, для которых положили свои спрайты, например: ['mage','archer']
  customHeroes: ['warrior', 'paladin', 'archer', 'assassin', 'mage', 'priest'],
  // точка макушки (доля ширины/высоты спрайта) и ширина шляпы (доля ширины) — для шляп
  heroAnchors: {"archer_f": {"x": 0.6, "y": 0.117, "w": 0.46}, "archer_m": {"x": 0.519, "y": 0.144, "w": 0.46}, "assassin_f": {"x": 0.6, "y": 0.035, "w": 0.46}, "assassin_m": {"x": 0.598, "y": 0.116, "w": 0.46}, "mage_f": {"x": 0.565, "y": 0.207, "w": 0.5}, "mage_m": {"x": 0.542, "y": 0.197, "w": 0.5}, "paladin_f": {"x": 0.6, "y": 0.089, "w": 0.46}, "paladin_m": {"x": 0.555, "y": 0.045, "w": 0.46}, "priest_f": {"x": 0.543, "y": 0.118, "w": 0.46}, "priest_m": {"x": 0.494, "y": 0.103, "w": 0.46}, "warrior_f": {"x": 0.6, "y": 0.08, "w": 0.46}, "warrior_m": {"x": 0.539, "y": 0.063, "w": 0.46}},
  // v6.44: спрайты нового листа мобов/боссов — пиксель-арт, масштабируются nearest neighbor (без сглаживания).
  // Все нарисованы ЛИЦОМ ВЛЕВО; игра сама разворачивает их к героям.
  pixelArt: ['cauldron', 'slime', 'wolf', 'goblin', 'rat', 'tree_spirit', 'ogre_boss', 'troll_boss', 'treant_boss', 'queen_boss', 'pet_slime', 'chicken_white_rest', 'chicken_white_feed', 'chicken_white_strut', 'chicken_white_run', 'chicken_light_brown_rest', 'chicken_light_brown_feed', 'chicken_light_brown_strut', 'chicken_light_brown_run'],
  heroSrc: (cls, gender) => `assets/classes/${cls}_${gender === 'female' ? 'f' : 'm'}.png`,
};

// ------------------------------------------------------------
//  Загрузчик и заглушки (менять не обязательно)
// ------------------------------------------------------------
if (window.HERO6_META) for (const k in window.HERO6_META) window.ASSET_MANIFEST.images['h6_' + k] = 'assets/heroes6/' + k + '.png';
if (window.HERO6_META) for (const k in window.HERO6_META) if (!/assassin|paladin/.test(k)) window.ASSET_MANIFEST.images['hm_' + k] = 'assets/heroes6/hair/' + k + '.png'; // v6.57: маски волос (tools/hairmask.py)
window.Assets = (function () {
  const M = window.ASSET_MANIFEST;
  const img = {};      // key -> Image | Canvas
  const isPlaceholder = {};

  function load(src) {
    return new Promise(res => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      if (!src) return res(null);
      i.src = src;
    });
  }
  // маленький холст для пиксельной заглушки
  function pix(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x, (px, py, pw, ph, col) => { x.fillStyle = col; x.fillRect(px, py, pw, ph); }); c._pixel = true; return c; }

  const P = {
    bed: () => pix(26, 16, (x, r) => { r(0, 3, 26, 13, '#5b3a22'); r(1, 2, 24, 12, '#7a4e2d'); for (let i = 0; i < 3; i++) r(2, 4 + i * 4, 22, 2, '#5f3c22'); r(0, 14, 26, 2, '#3e2716'); }),
    bed_wet: () => pix(26, 16, (x, r) => { r(0, 3, 26, 13, '#3d2616'); r(1, 2, 24, 12, '#55341d'); for (let i = 0; i < 3; i++) r(2, 4 + i * 4, 22, 2, '#3f2614'); r(4, 6, 3, 1, '#7aa6c2'); r(15, 10, 3, 1, '#7aa6c2'); r(0, 14, 26, 2, '#2c1a0e'); }),
    stage1: () => pix(8, 6, (x, r) => { r(2, 3, 4, 3, '#4a2e18'); r(3, 2, 2, 2, '#d8c27a'); }),
    stage2: () => pix(10, 10, (x, r) => { r(4, 4, 2, 6, '#3f8f3a'); r(1, 2, 3, 3, '#5fbf4a'); r(6, 1, 3, 3, '#5fbf4a'); r(2, 3, 2, 1, '#3f8f3a'); }),
    crop_carrot: () => pix(12, 14, (x, r) => { r(3, 0, 2, 5, '#4caf50'); r(6, 0, 2, 5, '#66c95a'); r(5, 1, 1, 4, '#4caf50'); r(3, 5, 6, 3, '#f28c28'); r(4, 8, 4, 3, '#f28c28'); r(5, 11, 2, 2, '#e07a1a'); r(4, 6, 1, 1, '#ffb35a'); }),
    crop_tomato: () => pix(12, 12, (x, r) => { r(5, 0, 2, 2, '#3f8f3a'); r(3, 2, 6, 1, '#4caf50'); r(2, 3, 8, 7, '#e0412e'); r(1, 4, 10, 5, '#e0412e'); r(3, 4, 2, 2, '#ff8a75'); r(3, 10, 6, 1, '#b5301f'); }),
    crop_eggplant: () => pix(14, 12, (x, r) => { r(2, 2, 10, 9, '#7cc36a'); r(1, 4, 12, 5, '#7cc36a'); r(4, 3, 6, 6, '#a6e08e'); r(6, 4, 2, 4, '#d4f2b8'); r(1, 9, 3, 2, '#4f9a45'); r(10, 9, 3, 2, '#4f9a45'); }),
    crop_pumpkin: () => pix(16, 13, (x, r) => { r(7, 0, 2, 3, '#4f7a2a'); r(2, 3, 12, 9, '#e8892b'); r(1, 5, 14, 5, '#e8892b'); r(5, 3, 1, 9, '#c96f1d'); r(10, 3, 1, 9, '#c96f1d'); r(3, 4, 2, 2, '#ffb25c'); }),
    crop_cucumber: () => pix(12, 10, (x, r) => { r(5, 0, 2, 3, '#4caf50'); r(2, 3, 8, 6, '#c9a26b'); r(1, 4, 10, 4, '#c9a26b'); r(3, 5, 1, 1, '#8a6a3e'); r(7, 6, 1, 1, '#8a6a3e'); r(3, 4, 2, 1, '#e3c48f'); }),
    bug: () => pix(8, 6, (x, r) => { r(1, 1, 6, 4, '#2b2b2b'); r(2, 0, 4, 1, '#2b2b2b'); r(3, 1, 1, 4, '#c0392b'); r(0, 2, 1, 1, '#2b2b2b'); r(7, 2, 1, 1, '#2b2b2b'); r(2, 2, 1, 1, '#e74c3c'); r(5, 3, 1, 1, '#e74c3c'); }),
    chest: () => pix(20, 16, (x, r) => { r(1, 4, 18, 12, '#8a5a2b'); r(1, 1, 18, 5, '#a86d34'); r(0, 6, 20, 2, '#5c3a1a'); r(2, 2, 2, 14, '#e2b33f'); r(16, 2, 2, 14, '#e2b33f'); r(8, 6, 4, 4, '#f5d142'); r(9, 8, 2, 1, '#5c3a1a'); r(1, 15, 18, 1, '#4a2f14'); }),
    chest_open: () => pix(20, 20, (x, r) => { r(1, 0, 18, 6, '#6b4520'); r(2, 1, 16, 4, '#a86d34'); r(1, 8, 18, 12, '#8a5a2b'); r(2, 8, 16, 3, '#ffe27a'); r(0, 10, 20, 2, '#5c3a1a'); r(2, 8, 2, 12, '#e2b33f'); r(16, 8, 2, 12, '#e2b33f'); r(5, 6, 2, 2, '#fff6b0'); r(12, 5, 2, 2, '#fff6b0'); }),
    cauldron: () => pix(22, 20, (x, r) => { r(3, 6, 16, 10, '#2f2f3a'); r(1, 5, 20, 3, '#45455a'); r(4, 6, 14, 2, '#7bdc6a'); r(7, 3, 3, 3, '#a8f59a'); r(13, 1, 2, 2, '#a8f59a'); r(5, 16, 3, 3, '#2f2f3a'); r(14, 16, 3, 3, '#2f2f3a'); r(6, 19, 10, 1, '#e8892b'); r(8, 18, 6, 1, '#f5d142'); }),
    hero: () => pix(16, 22, (x, r) => { r(4, 1, 8, 8, '#f1c9a5'); r(3, 0, 10, 3, '#6b4a2b'); r(6, 4, 1, 2, '#222'); r(10, 4, 1, 2, '#222'); r(3, 9, 10, 8, '#7a8ec2'); r(4, 17, 3, 5, '#4a3a2a'); r(9, 17, 3, 5, '#4a3a2a'); }),
  };

  function placeholder(key) { isPlaceholder[key] = true; return (P[key] || P.hero)(); }

  // временный герой из основы: перекраска + бантик для девушек
  function deriveHero(base, filter, female) {
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const x = c.getContext('2d');
    if (filter && filter !== 'none') x.filter = filter;
    x.drawImage(base, 0, 0);
    x.filter = 'none';
    if (female) {
      // розовый бантик над головой (временный признак женского варианта)
      const s = base.width / 26, bx = base.width * 0.32, by = base.height * 0.04;
      const r = (px, py, pw, ph, col) => { x.fillStyle = col; x.fillRect(bx + px * s, by + py * s, pw * s, ph * s); };
      r(0, 0, 3, 4, '#3a1020'); r(5, 0, 3, 4, '#3a1020'); r(3, 1, 2, 2, '#3a1020');
      r(0.5, 0.5, 2, 3, '#ff6fa8'); r(5.5, 0.5, 2, 3, '#ff6fa8'); r(3.3, 1.3, 1.4, 1.4, '#ff9cc4'); r(1, 1, 1, 1, '#ffc2da');
    }
    return c;
  }

  async function loadAll(classes) {
    const tasks = Object.entries(M.images).map(async ([k, src]) => {
      const i = await load(src);
      if (i && (M.pixelArt || []).includes(k)) i._pixel = true; // v6.44: пиксель-арт — масштаб без сглаживания (nearest)
      img[k] = i || placeholder(k);
    });
    const baseCache = {};
    for (const cl of classes) {
      for (const g of ['male', 'female']) {
        tasks.push((async () => {
          const key = `hero_${cl.id}_${g}`;
          const own = (M.customHeroes || []).includes(cl.id) ? await load(M.heroSrc(cl.id, g)) : null;
          if (own) { img[key] = own; const mk = await load(M.heroSrc(cl.id, g).replace('.png', '_mask.png')); if (mk) img[key + '_mask'] = mk; return; }
          const def = M.heroes[cl.id] || {};
          if (def.base) {
            baseCache[def.base] = baseCache[def.base] || load(def.base);
            const b = await baseCache[def.base];
            if (b) { img[key] = deriveHero(b, def.filter, g === 'female'); isPlaceholder[key] = 'tint'; return; }
          }
          img[key] = placeholder('hero');
        })());
      }
    }
    await Promise.all(tasks);
  }
  // ПЕРЕКРАСКА без чтения пикселей (работает и с file://): рядом со спрайтом лежит <имя>_mask.png —
  // серые пиксели одежды (яркость = тень). Цвет = цвет × яркость × 1.6 (multiply + lighter).
  const tintCache = {};
  function tinted(key, color) {
    const id = key + '#' + color; if (tintCache[id]) return id;
    const src = img[key], mask = img[key + '_mask']; if (!src || !src.width || !mask || !mask.width) return key;
    const w = src.width, h = src.height;
    const t = document.createElement('canvas'); t.width = w; t.height = h; const tx = t.getContext('2d');
    tx.drawImage(mask, 0, 0, w, h); tx.globalCompositeOperation = 'multiply'; tx.fillStyle = color; tx.fillRect(0, 0, w, h);
    tx.globalCompositeOperation = 'destination-in'; tx.drawImage(mask, 0, 0, w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.drawImage(src, 0, 0); x.drawImage(t, 0, 0); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.6; x.drawImage(t, 0, 0);
    c._pixel = src._pixel; img[id] = c; tintCache[id] = 1; return id;
  }
  return { img, isPlaceholder, loadAll, tinted, anchors: M.heroAnchors || {}, anim: M.anim || {} };
})();
