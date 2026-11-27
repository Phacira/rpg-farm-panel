// v8.6: «живые» фоны — облака, звёзды, вечер/ночь, свет костра, искры, пар, окна замка, флаги на ветру, светлячки, листья, птицы.
// Один модуль для игры (OBS) и для большого экрана на сайте. Координаты — мира 2560×1440. Рисуется поверх фона, под героями.
// Время суток общее для всех (по часам): CONFIG.live.cycleMin — длина круга «закат → ночь → закат» в минутах.
// Выключить всё: CONFIG.live = { enabled: false }. Выключить эффект: CONFIG.live.off = ['birds', 'leaves', ...]
(function () {
  const W = 2560, H = 1440, SK = 1, SKY_H = 620, SKR = 0.5; // небо — полоса сверху в полном разрешении (облака чёткие) // небо считается в половинном разрешении — дёшево, облака мягкие
  const LOC = {
    camp: {
      sky: 'camp_sky.png', // маска неба: PNG с прозрачностью (небо непрозрачное), 1280×720
      stars: [[663,38,0.78,0.3,1.91],[192,93,0.91,5.71,0.94],[856,17,0.67,3.46,0.69],[1158,31,1.16,3.96,1.53],[272,74,0.79,3.4,1.51],[370,26,0.91,4.01,1.2],[643,119,0.91,2.85,1.08],[499,20,0.9,3.3,2.0],[919,73,0.93,0.46,1.42],[700,38,1.15,2.65,2.14],[642,87,0.99,3.73,1.53],[934,17,1.09,5.93,1.36],[133,15,1.01,1.94,1.52],[912,72,1.0,5.57,1.16],[945,90,0.62,0.74,0.69],[588,33,1.02,2.5,2.07],[1016,20,0.62,2.52,1.04],[850,91,0.98,2.39,0.97],[169,45,0.61,4.14,0.62],[1206,46,0.68,0.03,1.27],[815,102,0.78,3.02,1.24],[390,17,1.19,2.77,0.78],[1230,13,0.57,3.56,1.46],[52,18,1.11,3.86,0.84],[516,88,0.92,2.98,0.78],[638,21,0.6,4.71,1.78],[1112,6,1.03,1.87,1.63],[534,132,0.76,1.05,1.84],[464,51,0.86,2.23,0.65],[572,120,0.68,4.35,2.13],[715,93,0.56,0.64,1.35],[691,52,0.84,6.19,1.58],[245,99,1.05,4.71,1.36],[680,22,1.06,6.1,1.23],[325,43,1.2,0.17,1.55],[717,39,0.88,0.82,0.62],[432,7,0.68,1.84,0.98],[268,15,1.14,2.22,1.33],[1027,33,0.87,3.29,0.63],[306,44,0.6,3.89,0.79],[116,63,0.63,0.27,0.76],[1048,51,0.98,2.84,1.45],[1071,66,1.15,5.61,0.92],[916,35,0.79,2.46,1.11],[492,109,0.55,4.2,1.85],[749,36,0.68,0.86,1.35],[997,41,1.19,5.23,0.86],[827,86,0.79,2.24,0.75],[749,4,0.74,2.88,1.73],[787,84,0.86,1.86,2.14],[468,26,0.56,1.71,2.05],[371,69,1.03,5.15,1.96],[529,103,0.6,5.77,1.51],[669,22,0.7,5.02,0.89],[148,68,1.16,3.98,1.88],[455,17,0.69,0.76,0.62],[264,11,0.87,1.5,0.78],[330,67,0.54,1.27,1.1],[624,135,1.03,1.82,1.4],[364,69,0.74,0.11,1.0],[31,4,1.01,3.46,0.9],[972,62,1.15,0.67,1.91],[440,58,0.74,5.23,1.73],[286,103,1.19,6.17,1.94],[29,18,0.94,5.53,1.29],[113,21,0.97,2.39,1.41],[600,11,0.82,0.99,1.31],[539,93,1.17,6.11,1.48],[500,8,1.18,1.94,1.17],[781,21,0.83,3.16,0.92],[183,36,0.78,0.26,0.64],[476,21,0.91,3.32,1.8],[1012,38,0.7,3.89,0.83],[1035,35,1.14,4.73,1.51],[470,21,0.52,0.84,1.18],[500,125,0.68,2.87,0.71],[1077,16,1.02,2.98,1.89],[543,60,1.01,1.29,1.78],[783,19,0.84,4.29,1.83],[406,19,0.92,2.08,1.64]], // [x, y, r, фаза, частота] в половинном разрешении
      fire: [1257, 846], steam: [1257, 683],
      flagAtlas: 'camp_flags.png', // вырезанные флаги (верхний ряд) и место под ними без флага (нижний ряд) — колышется только ткань флага
      flags: [[324, 290, 157, 298, 0, 0, 306], [863, 300, 139, 278, 157, 0, 306], [1523, 308, 136, 280, 296, 0, 306], [2043, 290, 149, 306, 432, 0, 306]], // [x, y, w, h, x в атласе, y флага, y подложки]
      windows: [[1446, 223, 4], [1431, 254, 4], [1524, 253, 4], [1524, 264, 12], [1310, 261, 3], [1537, 267, 10], [1480, 291, 14], [1476, 293, 15], [1354, 323, 11], [1320, 329, 10], [1386, 334, 29], [1413, 340, 10], [1527, 386, 37], [1534, 393, 34]],
      flies: [[20, 1030, 470, 1400], [2085, 1030, 2540, 1400]], leaves: true, birds: true
    },
    town: {
      sky: 'town_sky.png', stars: [[1085,3,1.09,4.87,1.0],[960,31,0.77,0.64,1.0],[443,52,0.7,5.75,1.83],[428,27,1.17,1.04,0.87],[642,25,0.88,4.26,0.93],[403,49,0.71,2.27,0.87],[617,77,0.91,3.74,1.73],[727,39,0.84,1.98,1.37],[524,2,1.16,2.25,1.25],[749,48,0.9,0.06,0.67],[402,15,1.03,5.84,2.11],[513,59,0.58,4.7,1.88],[605,4,0.8,6.14,0.93],[742,18,0.74,5.8,1.47],[639,87,0.72,1.11,0.73],[633,61,0.61,0.3,2.18],[512,58,0.96,0.91,2.17],[684,26,0.59,4.59,2.12],[847,13,0.62,2.34,0.69],[861,37,0.6,5.79,1.59],[928,62,0.98,2.0,1.04],[962,51,1.13,0.71,1.92],[1089,22,0.94,3.14,1.14],[557,65,1.05,5.45,1.18],[575,62,0.69,6.16,1.75],[667,85,0.69,1.81,1.4],[560,82,0.74,5.89,1.25],[921,46,1.17,3.25,1.45],[579,88,0.56,4.21,1.27],[861,38,0.94,4.87,1.62],[370,28,1.03,1.13,1.75],[965,28,0.62,5.6,0.78],[952,44,0.77,3.84,1.54],[487,47,0.5,2.55,1.05],[839,14,0.98,3.44,2.14],[617,12,0.71,3.22,2.12],[600,45,1.07,2.63,1.9],[957,18,0.61,2.4,1.36],[407,17,0.93,2.21,2.03],[1104,18,0.73,5.5,1.5],[879,55,1.18,3.1,1.37],[777,49,1.17,5.74,1.55],[532,38,0.85,2.61,1.11],[629,62,1.15,0.9,0.64],[502,37,0.53,0.86,1.23],[498,60,1.05,1.54,1.03],[600,63,0.93,2.98,1.63],[615,36,0.87,2.11,1.07],[1085,3,0.83,2.27,1.79],[516,70,0.82,5.76,2.02],[1117,24,0.51,4.89,1.28],[974,50,0.98,4.52,2.04],[952,8,0.71,0.02,1.85],[967,39,0.6,3.0,1.48],[1019,42,0.88,2.67,1.47],[471,34,1.07,4.97,1.66],[879,8,1.2,4.4,0.68],[599,56,0.6,3.83,1.26],[776,9,0.7,3.59,0.79],[816,79,0.59,2.71,1.1]],
      flagAtlas: 'town_flags.png', flags: [[74, 121, 168, 424, 0, 0, 424], [536, 128, 152, 417, 168, 0, 424]],
      fire: [1596, 600], fireR: 0.45,
      dog: { img: 'town_dog.png', x: 1330, y: 800, w: 105, px: 0.758, py: 0.849 }, // пёсик: тело + хвост (хвост вращается вокруг px,py)
      lanterns: [[870, 497, 26], [1255, 497, 26]], // v8.7: фонари у доски заданий
      windows: [[790, 304, 30], [769, 431, 20], [1993, 264, 30], [2343, 186, 40], [1993, 417, 20], [2343, 214, 40]],
      birds: true
    },
    forest: {
      sky: 'forest_sky.png', stars: [[684,70,1.16,4.4,1.77],[596,26,0.97,4.56,1.27],[575,43,1.07,1.25,2.02],[552,71,0.98,5.35,1.79],[552,41,1.07,1.93,1.06],[594,21,0.98,5.5,0.65],[602,78,0.51,5.02,1.06],[568,17,1.17,4.69,1.07],[561,76,1.12,3.11,0.76],[615,8,1.01,4.53,0.77],[683,10,1.05,0.05,2.13],[645,77,1.11,4.01,1.69],[650,56,0.67,3.79,1.39],[710,51,0.8,0.49,1.08],[665,11,0.62,3.42,0.9],[662,65,0.85,2.91,0.61],[552,25,0.72,2.42,0.89],[558,36,0.6,2.84,1.69],[677,18,1.02,2.18,1.56],[705,3,0.9,3.38,2.12],[726,33,1.12,4.82,2.15],[693,36,1.0,2.07,1.23],[637,13,0.64,0.09,1.34],[635,37,0.66,1.12,1.62],[556,47,1.16,2.19,1.5],[566,58,0.7,2.74,2.17],[660,54,0.85,1.94,0.73],[598,1,0.86,3.72,0.61],[630,18,1.1,2.64,0.89],[624,60,0.7,4.58,1.89],[643,87,0.85,5.41,0.69],[690,9,1.06,1.02,2.12],[542,71,0.62,0.04,2.0],[663,22,0.61,6.16,1.71],[652,42,0.83,5.54,1.12],[580,12,1.17,1.61,1.87],[625,52,0.66,1.85,1.2],[588,1,0.84,1.83,0.69],[551,59,0.67,4.37,1.01],[680,17,0.65,5.07,0.98]],
      lanterns: [[2236, 404, 28]],
      eyes: { c: '255,40,20', core: '200,160', gap: [3, 7], at: [[96, 528, .9], [896, 512, .8], [1616, 548, .8], [2448, 560, .9], [60, 1110, 1.1], [2496, 1130, 1.1]] }, // v8.7: жуткий лес — красные глаза в кустах
      mist: [560, 700, '150,140,190', 0.10],
      flies: [[20, 1100, 600, 1420], [1950, 1100, 2540, 1420], [300, 650, 900, 760]], leaves: 3, birds: true
    },
    garden: {
      sky: 'garden_sky.png', stars: [[381,12,0.81,0.89,1.46],[121,4,0.63,1.52,0.65],[520,40,1.03,3.22,0.65],[221,51,0.58,1.83,0.71],[429,6,0.83,6.16,1.24],[552,43,0.56,2.09,2.14],[241,17,0.67,0.63,0.7],[268,53,0.95,0.73,1.27],[435,0,0.69,6.1,1.89],[622,2,0.65,2.48,1.97],[528,1,1.04,2.07,1.07],[150,9,0.56,3.66,0.99],[315,39,1.14,5.14,1.0],[212,13,0.53,6.05,0.98],[140,16,0.66,3.51,1.96],[573,27,1.14,1.28,0.63],[123,5,0.62,2.32,1.52],[269,11,0.75,5.6,2.17],[279,9,0.55,3.43,1.78],[164,11,0.95,6.24,2.01],[616,18,0.97,1.27,0.87],[494,41,0.78,1.57,1.61],[410,27,0.77,3.66,1.11],[278,17,0.85,5.26,1.96],[346,14,0.82,1.73,0.94],[278,51,0.82,0.16,1.93],[236,57,0.58,3.36,1.62],[405,25,1.08,1.61,1.74],[458,11,0.79,5.61,1.22],[252,27,0.67,2.45,0.74],[341,8,1.15,2.88,2.07],[532,16,0.99,6.14,0.66],[318,29,0.51,1.78,1.76],[279,29,1.14,3.94,1.16],[398,27,1.04,1.22,0.75],[490,16,1.01,1.63,0.76],[258,25,0.78,4.3,0.63],[217,3,0.53,3.46,1.42],[300,24,0.63,1.28,1.94],[126,17,1.17,2.9,1.82],[338,12,0.86,0.1,2.03],[528,35,1.14,4.68,1.84],[378,9,1.06,1.89,0.76],[485,32,0.81,3.17,1.82],[201,33,0.68,5.69,1.48],[606,3,0.51,1.54,0.67],[499,5,0.87,5.89,1.76],[235,6,0.94,2.86,0.93],[254,46,0.81,4.19,1.33],[280,37,1.01,1.5,0.78],[490,24,1.17,3.15,1.64],[124,1,0.69,2.67,1.6],[209,28,0.88,0.46,0.74],[245,57,1.07,3.92,1.83],[528,49,1.07,2.32,1.65],[292,28,0.75,4.56,1.19],[240,41,1.0,3.58,2.07],[173,3,0.94,0.9,1.79],[225,53,1.15,5.75,0.99],[343,41,0.64,2.67,1.07]],
      fire: [2029, 1193], steam: [2029, 1007], fireR: 0.6,
      lanterns: [[1826, 139, 24]], windows: [[2400, 307, 60]],
      flies: [[20, 1150, 500, 1420], [2100, 1150, 2540, 1420]], leaves: true, birds: true,
      cat: { img: 'garden_cat.png', x: 1110, y: 282, w: 85 } // спящий котик на заборе
    },
    // v8.7: логова боссов — без неба; свои живые эффекты
    boss: {
      fires: [[220, 440, 0.9], [2360, 462, 0.9], [1253, 528, 1.3]],
      lanterns: [[773, 578, 14, '255,150,60'], [885, 613, 10, '255,150,60'], [971, 586, 13, '255,150,60']],
      motes: { r: [0, 300, 2560, 900], c: '255,150,70', n: 26, up: 22 },
      mist: [760, 900, '90,40,60', 0.12]
    },
    boss_queen: {
      glows: [[213, 432, 150, '190,80,255', 1.3, .14, .16], [400, 456, 140, '190,80,255', 1.1, .14, .16], [1408, 576, 110, '190,80,255', 1.6, .12, .14], [1824, 616, 120, '190,80,255', 1.4, .12, .14], [2256, 480, 150, '190,80,255', 1.2, .14, .16], [1672, 540, 260, '200,90,255', 0.7, .14, .14], [1040, 432, 240, '170,90,255', 0.5, .10, .10]],
      lanterns: [[531, 310, 22, '220,140,255'], [2109, 310, 22, '220,140,255']],
      drips: [[184, 672, 150, '200,110,255'], [392, 616, 150, '200,110,255'], [616, 704, 60, '200,110,255'], [2040, 640, 130, '200,110,255'], [2328, 720, 150, '200,110,255']],
      motes: { r: [0, 200, 2560, 1300], c: '210,130,255', n: 30, up: 12 },
      mist: [800, 1000, '120,60,170', 0.10]
    },
    boss_treant: {
      rays: [[1240, -20, 160, 820, 0.12, '255,240,170'], [1360, -20, 120, 760, 0.05, '255,240,170'], [1120, -20, 110, 700, 0.2, '255,240,170']],
      glows: [[1280, 600, 170, '170,255,150', 0.6, .10, .10]],
      flies: [[300, 350, 2300, 900], [200, 900, 800, 1300], [1800, 900, 2400, 1300]], leaves: 2, leafC: ['#7a9a2e', '#5d7d22', '#a0a838'],
      mist: [720, 860, '170,210,170', 0.10]
    },
  };
  const ALL = ['eyes', 'dog', 'cat', 'clouds', 'stars', 'shoot', 'daynight', 'fire', 'sparks', 'steam', 'windows', 'flags', 'ffly', 'leaves', 'birds'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let T = 0;
  const st = {}; // состояние по локациям

  function cfg() { const c = (window.CONFIG && window.CONFIG.live) || (window.C && window.C.live) || {}; return Object.assign({ enabled: true, cycleMin: 240, off: [] }, c); }
  function on(k) { const c = cfg(); return c.enabled !== false && !(c.off || []).includes(k); }
  // 0 = закат, 1 = глубокая ночь; общий для игры и сайта (по часам)
  function nightK() { if (!on('daynight')) return 0.35; const c = cfg(), per = Math.max(1, +c.cycleMin || 240) * 60000, t = (Date.now() % per) / per; return 0.5 - 0.5 * Math.cos(t * Math.PI * 2); }

  // облако как нарисованные на фоне: вытянутая тёмная полоса из нескольких «лепёшек», светлее сверху, тонкая тёплая кайма заката снизу
  function makeCloud(w) {
    const h = Math.round(w * 0.16), pad = 8, c = mk(w + pad * 2, h + pad * 2), g = c.getContext('2d'), n = 3 + Math.floor(Math.random() * 4), lobes = [];
    for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1), rx = w * rnd(.18, .3) * (0.7 + 0.5 * Math.sin(t * Math.PI)), ry = h * rnd(.28, .45) * (0.6 + 0.6 * Math.sin(t * Math.PI)); lobes.push([pad + rx + t * (w - 2 * rx), pad + h * 0.62 - ry * rnd(.2, .6), rx, ry]); }
    const shape = (oy, k) => { g.beginPath(); lobes.forEach(([x, y, rx, ry]) => { g.moveTo(x + rx * k, y + oy); g.ellipse(x, y + oy, rx * k, ry * k, 0, 0, 7); }); };
    g.fillStyle = '#e48a5c'; shape(2.5, 1); g.fill(); // тёплая кайма снизу (выглядывает из-под тела облака)
    g.fillStyle = '#3a2650'; shape(0, 1); g.fill();
    g.fillStyle = '#4b3366'; shape(-h * 0.12, 0.82); g.fill(); // светлый верх
    g.fillStyle = 'rgba(110,80,140,.45)'; shape(-h * 0.2, 0.55); g.fill();
    return c;
  }
  function newFly(L) { const r = L.flies[Math.floor(Math.random() * L.flies.length)]; return { x: rnd(r[0], r[2]), y: rnd(r[1], r[3]), vx: rnd(-8, 8), vy: rnd(-5, 5), p: rnd(0, 6.28), life: rnd(6, 14) }; }

  function init(loc, base) {
    const L = LOC[loc]; if (!L) return null;
    let s = st[loc]; if (s) return s;
    s = st[loc] = { ready: false, clouds: [], sprites: [], stars: [], sparks: [], steam: [], flies: [], leaves: [], birds: [], shoot: null, nextShoot: 4, nextBirds: 8 };
    const sw = W, sh = SKY_H;
    s.eyes = []; s.nextEyes = rnd(2, 5); s.drops = []; s.motes = []; s.mist = [];
    if (L.mist) for (let i = 0; i < 7; i++) s.mist.push({ x: rnd(-400, W), y: rnd(L.mist[0], L.mist[1]), r: rnd(260, 480), v: rnd(10, 26) * (Math.random() < .5 ? 1 : -1), a: rnd(.5, 1) });
    if (!L.sky) { s.ready = true; } else {
    s.sky = mk(Math.round(sw * SKR), Math.round(sh * SKR)); s.mask = mk(Math.round(sw * SKR), Math.round(sh * SKR)); // v8.9: небо в половинном разрешении — в OBS вдвое-вчетверо дешевле
    const im = new Image();
    im.onerror = () => console.warn('live6: нет маски неба', base + L.sky);
    im.onload = () => {
      s.mask.getContext('2d').drawImage(im, 0, 0, im.width, im.height * SKY_H / H, 0, 0, s.mask.width, s.mask.height); // без getImageData: в OBS (file://) чтение пикселей картинки запрещено
      s.stars = (L.stars || []).map(([x, y, r, p, f]) => ({ x: x * 2, y: y * 2, r: r * 1.6, p, f }));
      s.ready = true;
    };
    im.src = base + L.sky + '?v=2'; }
    if (L.dog) { const d = new Image(); d.onload = () => { s.dog = d; }; d.src = base + L.dog.img + '?v=1'; s.dogHappy = 0; s.dogBark = rnd(6, 14); s.dogSay = 0; }
    if (L.cat) { const c = new Image(); c.onload = () => { s.cat = c; }; c.src = base + L.cat.img + '?v=1'; }
    if (L.flagAtlas) { const a = new Image(); a.onload = () => { s.atlas = a; }; a.src = base + L.flagAtlas + '?v=1'; }
    for (let i = 0; i < 7; i++) s.sprites.push(makeCloud(Math.round(rnd(120, 250))));
    for (let i = 0; i < 6; i++) s.clouds.push({ s: s.sprites[i % s.sprites.length], x: rnd(-300, sw), y: rnd(20, 260), v: rnd(6, 14), a: rnd(.75, .95) });
    if (L.flies) for (let i = 0; i < 7; i++) s.flies.push(newFly(L));
    return s;
  }

  function skyLayer(s, dt, nk, L) {
    const g = s.sky.getContext('2d'), sw = W, sh = SKY_H;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s.sky.width, s.sky.height); g.setTransform(SKR, 0, 0, SKR, 0, 0);
    if (on('daynight')) { g.fillStyle = `rgba(18,10,40,${0.45 * nk})`; g.fillRect(0, 0, sw, sh); }
    if (on('stars')) { g.fillStyle = '#fff7e0'; s.stars.forEach(t => { const tw = 0.55 + 0.45 * Math.sin(T * t.f + t.p); g.globalAlpha = Math.min(1, (0.35 + 0.65 * nk) * tw); g.beginPath(); g.arc(t.x, t.y, t.r, 0, 7); g.fill(); }); g.globalAlpha = 1; }
    if (on('shoot')) {
      s.nextShoot -= dt; if (!s.shoot && s.nextShoot <= 0 && nk > .3) { s.shoot = { x: rnd(200, sw - 200), y: rnd(10, 120), vx: rnd(380, 520) * (Math.random() < .5 ? -1 : 1), vy: rnd(120, 180), t: 0 }; s.nextShoot = rnd(10, 25); }
      const o = s.shoot; if (o) { o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt; const a = Math.max(0, 1 - o.t / 0.9), gr = g.createLinearGradient(o.x, o.y, o.x - o.vx * .12, o.y - o.vy * .12); gr.addColorStop(0, `rgba(255,250,230,${a})`); gr.addColorStop(1, 'rgba(255,250,230,0)'); g.strokeStyle = gr; g.lineWidth = 2.5; g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.x - o.vx * .12, o.y - o.vy * .12); g.stroke(); if (o.t > .9) s.shoot = null; }
    }
    if (on('clouds')) { s.clouds.forEach(c => { c.x += c.v * dt; if (c.x > sw + 10) { c.x = -c.s.width - rnd(0, 400); c.y = rnd(20, 260); c.v = rnd(6, 14); c.s = s.sprites[Math.floor(Math.random() * s.sprites.length)]; } g.globalAlpha = c.a * (1 - 0.25 * nk); g.drawImage(c.s, Math.round(c.x), Math.round(c.y)); }); g.globalAlpha = 1; }
    if (L.birds && on('birds')) { s.nextBirds -= dt; if (s.nextBirds <= 0 && !s.birds.length) { const n = 3 + Math.floor(Math.random() * 4), y = rnd(60, 200), dir = Math.random() < .5 ? 1 : -1; for (let i = 0; i < n; i++) s.birds.push({ x: dir > 0 ? -60 - i * 31 : W + 60 + i * 31, y: y + (i % 2) * 14 + i * 4, v: dir * rnd(100, 130), p: rnd(0, 6) }); s.nextBirds = rnd(20, 40); }
      g.save(); g.strokeStyle = 'rgba(25,15,30,.85)'; g.lineWidth = 3; s.birds = s.birds.filter(b => { b.x += b.v * dt; const f = Math.sin(T * 9 + b.p) * 6; g.beginPath(); g.moveTo(b.x - 10, b.y - f); g.quadraticCurveTo(b.x - 4, b.y - 3, b.x, b.y); g.quadraticCurveTo(b.x + 4, b.y - 3, b.x + 10, b.y - f); g.stroke(); return b.x > -120 && b.x < W + 120; }); g.restore(); } // v8.7: птицы — в слое неба, за домами
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(s.mask, 0, 0); g.globalCompositeOperation = 'source-over';
  }

  // ctx — в координатах мира 2560×1440 (масштаб уже выставлен). bg — картинка фона (для флагов). base — папка, где лежит <loc>_sky.png
  function draw(ctx, loc, bg, dt, base) {
    if (!cfg().enabled) return;
    const L = LOC[loc]; if (!L) return;
    const s = init(loc, base || 'assets/bg/'); if (!s || !s.ready) return;
    const now = performance.now(); if (s.last == null) s.last = now; dt = Math.min(0.1, Math.max(0, (now - s.last) / 1000)); s.last = now; T = now / 1000;
    const nk = nightK();
    if (L.sky) { const sn = now - (s.skyAt || 0); if (!s.skyAt || sn > 45) { skyLayer(s, Math.min(0.2, s.skyAt ? sn / 1000 : dt), nk, L); s.skyAt = now; } // v8.9: небо перерисовывается ~22 раза в секунду (облака и звёзды медленные)
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(s.sky, 0, 0, W, SKY_H); ctx.restore(); }
    if (on('flags') && L.flags && s.atlas) {
      const sc = Math.abs(ctx.getTransform().a) || 1, step = Math.max(1, 1 / sc), A = s.atlas;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      L.flags.forEach(([X, Y, w, h, ax, fy, uy], i) => {
        ctx.drawImage(A, ax, uy, w, h, X, Y, w, h); // подложка: палатка без флага (видна на краях, когда флаг сдвинут)
        for (let y = 0; y < h; y += step) { const k = Math.max(0, (y - 22) / h), dx = Math.sin(T * 1.6 + i * 1.3 - k * 4) * 3 * k * k, sh = Math.min(step + 0.5, h - y); ctx.drawImage(A, ax, fy + y, w, sh, X + dx, Y + y, w, sh); }
      });
      ctx.restore(); }
    if (L.sky && on('daynight')) {
      // ночь: дальний план темнеет сильнее, земля внизу (где стоят герои) — слабее, чтобы герои читались
      const col = k => `rgb(${Math.round(255 - 95 * nk * k)},${Math.round(255 - 85 * nk * k)},${Math.round(255 - 30 * nk * k)})`, tg = ctx.createLinearGradient(0, 0, 0, H);
      tg.addColorStop(0, col(1)); tg.addColorStop(0.5, col(0.85)); tg.addColorStop(1, col(0.45));
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.18 * (1 - nk); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = '#ff9a5a'; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    // v8.7: фонари (сверкают), огни/факелы, свечение, капли, искорки, туман, глаза в темноте — для логов и жуткого леса
    if (L.lanterns && on('windows')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; L.lanterns.forEach(([x, y, r, c], i) => { const f = 0.78 + 0.12 * Math.sin(T * 7.3 + i * 2) + 0.07 * Math.sin(T * 17.1 + i) + 0.05 * Math.sin(T * 29 + i * 3), R = r * f * (1 + 0.25 * nk), cc = c || '255,190,90';
      let g = ctx.createRadialGradient(x, y, 0, x, y, R * 2.6); g.addColorStop(0, `rgba(${cc},${0.22 + 0.18 * nk})`); g.addColorStop(1, `rgba(${cc},0)`); ctx.fillStyle = g; ctx.fillRect(x - R * 2.6, y - R * 2.6, R * 5.2, R * 5.2);
      g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.7); g.addColorStop(0, `rgba(255,245,210,${0.45 * f})`); g.addColorStop(1, `rgba(${cc},0)`); ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2); }); ctx.restore(); }
    if (L.glows && on('fire')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; L.glows.forEach(([x, y, r, c, sp, a0, a1], i) => { const k = 0.5 + 0.5 * Math.sin(T * (sp || 1) + i * 1.7), a = (a0 == null ? .18 : a0) + (a1 == null ? .14 : a1) * k, g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }); ctx.restore(); }
    if (L.rays && on('fire')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; L.rays.forEach(([x, y, w, len, ang, c], i) => { const a = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(T * 0.6 + i * 2.3)); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); const g = ctx.createLinearGradient(0, 0, 0, len); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w * .35, 0); ctx.lineTo(w * .35, 0); ctx.lineTo(w * .7, len); ctx.lineTo(-w * .7, len); ctx.closePath(); ctx.fill(); ctx.restore(); }); ctx.restore(); }
    if (L.fires && on('fire')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; L.fires.forEach(([x, y, sc], i) => { const fl = 0.85 + 0.1 * Math.sin(T * 9 + i * 2) + 0.07 * Math.sin(T * 23 + i) + 0.05 * Math.sin(T * 41 + i * 3), R = 300 * sc * fl, g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, 'rgba(255,150,60,.32)'); g.addColorStop(.35, 'rgba(255,110,40,.10)'); g.addColorStop(1, 'rgba(255,90,30,0)'); ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
        const g2 = ctx.createRadialGradient(x, y - 20 * sc, 0, x, y - 20 * sc, 60 * sc * fl); g2.addColorStop(0, 'rgba(255,215,130,.35)'); g2.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = g2; ctx.fillRect(x - 70 * sc, y - 90 * sc, 140 * sc, 140 * sc);
        if (on('sparks') && Math.random() < dt * 7 * sc) s.sparks.push({ x: x + rnd(-20, 20) * sc, y: y - 30 * sc, vx: rnd(-15, 15), vy: rnd(-95, -50), t: 0, l: rnd(.7, 1.6) }); }); ctx.restore(); }
    if (L.drips && on('steam')) { L.drips.forEach(([x, y, len, c], i) => { if (Math.random() < dt * 0.6) s.drops.push({ x: x + rnd(-6, 6), y, y1: y + len, v: 0, c, t: 0, sp: 0 }); });
      ctx.save(); s.drops = s.drops.filter(d => { if (!d.sp) { d.v += 900 * dt; d.y += d.v * dt; if (d.y >= d.y1) { d.y = d.y1; d.sp = 0.001; } } else { d.sp += dt; if (d.sp > .5) return false; }
        const a = d.sp ? 1 - d.sp * 2 : 0.9; ctx.globalAlpha = a; ctx.fillStyle = `rgb(${d.c})`; ctx.shadowColor = `rgb(${d.c})`; ctx.shadowBlur = 8; ctx.beginPath(); if (d.sp) ctx.ellipse(d.x, d.y, 4 + d.sp * 30, 2 + d.sp * 4, 0, 0, 7); else ctx.ellipse(d.x, d.y, 3.5, 6, 0, 0, 7); ctx.fill(); return true; }); ctx.restore(); }
    if (L.motes && on('ffly')) { const M = L.motes; while (s.motes.length < M.n) s.motes.push({ x: rnd(M.r[0], M.r[2]), y: rnd(M.r[1], M.r[3]), vx: rnd(-8, 8), vy: -rnd(4, M.up || 14), p: rnd(0, 6.3), sz: rnd(1.5, 3.2) });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; s.motes.forEach((m, i) => { m.x += (m.vx + Math.sin(T + m.p) * 6) * dt; m.y += m.vy * dt; if (m.y < M.r[1] - 40 || m.x < M.r[0] - 40 || m.x > M.r[2] + 40) { m.x = rnd(M.r[0], M.r[2]); m.y = M.r[3]; }
        const a = 0.35 + 0.35 * Math.sin(T * 2.2 + m.p); ctx.fillStyle = `rgba(${M.c},${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.sz, 0, 7); ctx.fill(); }); ctx.restore(); }
    if (L.mist && on('steam')) { ctx.save(); s.mist.forEach(m => { m.x += m.v * dt; if (m.x > W + 500) m.x = -500; if (m.x < -500) m.x = W + 500; const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r); g.addColorStop(0, `rgba(${L.mist[2]},${L.mist[3] * m.a})`); g.addColorStop(1, `rgba(${L.mist[2]},0)`); ctx.fillStyle = g; ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1, 0.32); ctx.translate(-m.x, -m.y); ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2); ctx.restore(); }); ctx.restore(); }
    if (L.eyes && on('eyes')) { const E = L.eyes; s.nextEyes -= dt; if (s.nextEyes <= 0 && s.eyes.length < 2) { const sp = E.at[Math.floor(Math.random() * E.at.length)]; if (!s.eyes.some(e => e.x === sp[0])) s.eyes.push({ x: sp[0], y: sp[1], sz: sp[2] || 1, t: 0, l: rnd(2.5, 5), b: rnd(0.8, 1.8) }); s.nextEyes = rnd(E.gap ? E.gap[0] : 3, E.gap ? E.gap[1] : 8); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; s.eyes = s.eyes.filter(e => { e.t += dt; if (e.t > e.l) return false; let a = Math.min(1, e.t / .5, (e.l - e.t) / .5) * (0.55 + 0.45 * nk); const bt = (e.t % 2.3); if (Math.abs(bt - e.b) < 0.08) a *= 0.05; // моргнули
        const sz = e.sz * 1.7, d = 15 * sz; [-1, 1].forEach(k => { const x = e.x + k * d / 2, g = ctx.createRadialGradient(x, e.y, 0, x, e.y, 16 * sz); g.addColorStop(0, `rgba(${E.c},${0.7 * a})`); g.addColorStop(1, `rgba(${E.c},0)`); ctx.fillStyle = g; ctx.fillRect(x - 16 * sz, e.y - 16 * sz, 32 * sz, 32 * sz); ctx.fillStyle = `rgba(255,${E.core || '235,200'},${a})`; ctx.beginPath(); ctx.ellipse(x, e.y, 3.6 * sz, 2.1 * sz, k * -0.3, 0, 7); ctx.fill(); }); return true; }); ctx.restore(); }
    const F = L.fire;
    if (F && on('fire')) { const fl = 0.85 + 0.1 * Math.sin(T * 9) + 0.07 * Math.sin(T * 23 + 1) + 0.05 * Math.sin(T * 41), R = (430 + 85 * nk) * fl * (L.fireR || 1), fy = F[1] - 28;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      let g = ctx.createRadialGradient(F[0], fy, 0, F[0], fy, R); g.addColorStop(0, `rgba(255,150,60,${0.30 + 0.15 * nk})`); g.addColorStop(.35, `rgba(255,110,40,${0.10 + 0.06 * nk})`); g.addColorStop(1, 'rgba(255,90,30,0)'); ctx.fillStyle = g; ctx.fillRect(F[0] - R, fy - R, R * 2, R * 2);
      g = ctx.createRadialGradient(F[0], F[1] - 14, 0, F[0], F[1] - 14, 86 * fl); g.addColorStop(0, 'rgba(255,210,120,.35)'); g.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = g; ctx.fillRect(F[0] - 100, F[1] - 114, 200, 200);
      ctx.restore(); }
    if (L.windows && on('windows')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; L.windows.forEach(([wx, wy, sz], i) => { const f = 0.6 + 0.4 * Math.sin(T * (0.7 + i * 0.13) + i * 2.1) * Math.sin(T * 0.31 + i), r = 6 + Math.sqrt(sz) * 1.7, g = ctx.createRadialGradient(wx, wy, 0, wx, wy, r); g.addColorStop(0, `rgba(255,200,110,${(0.25 + 0.35 * nk) * Math.max(0.2, f)})`); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(wx - r, wy - r, r * 2, r * 2); }); ctx.restore(); }
    const S2 = L.steam;
    if (S2 && on('steam')) { if (Math.random() < dt * 3) s.steam.push({ x: S2[0] + rnd(-20, 20), y: S2[1], r: rnd(11, 18), t: 0, l: rnd(2.5, 3.8), vx: rnd(-6, 6) });
      ctx.save(); ctx.fillStyle = '#d8cfe6'; s.steam = s.steam.filter(p => { p.t += dt; const k = p.t / p.l; if (k >= 1) return false; p.y -= 31 * dt; p.x += p.vx * dt + Math.sin(T * 1.3 + p.l) * 0.2; ctx.globalAlpha = 0.10 * (1 - k) * Math.min(1, k * 5); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 1.6), 0, 7); ctx.fill(); return true; }); ctx.restore(); }
    if ((F || L.fires) && on('sparks')) { if (F && Math.random() < dt * 14 * (L.fireR || 1)) s.sparks.push({ x: F[0] + rnd(-37, 37), y: F[1] - 28, vx: rnd(-17, 17), vy: rnd(-100, -57), t: 0, l: rnd(.8, 1.8) });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; s.sparks = s.sparks.filter(p => { p.t += dt; p.x += p.vx * dt + Math.sin(T * 3 + p.l * 9) * 0.4; p.y += p.vy * dt; const a = 1 - p.t / p.l; if (a <= 0) return false; ctx.fillStyle = `rgba(255,${160 + Math.round(80 * a)},80,${a})`; ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); return true; }); ctx.restore(); }
    if (L.flies && on('ffly')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; s.flies.forEach((f, i) => { f.life -= dt; if (f.life <= 0) s.flies[i] = f = newFly(L); f.vx += rnd(-28, 28) * dt; f.vy += rnd(-28, 28) * dt; f.vx *= .98; f.vy *= .98; f.x += f.vx * dt; f.y += f.vy * dt; const b = Math.max(0, Math.sin(T * 2 + f.p)), a = (0.25 + 0.6 * nk) * b; if (a < 0.03) return; const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9); g.addColorStop(0, `rgba(220,255,140,${a})`); g.addColorStop(1, 'rgba(200,255,120,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - 9, f.y - 9, 18, 18); }); ctx.restore(); }
    if (L.leaves && on('leaves')) { if (Math.random() < dt * 0.35 * (+L.leaves || 1)) s.leaves.push({ x: Math.random() < .5 ? rnd(-30, W * 0.25) : rnd(W * 0.75, W), y: rnd(0, 280), vx: rnd(20, 50), vy: rnd(30, 55), a: rnd(0, 6.28), c: (L.leafC || ['#c8742e', '#a8531f', '#d99a3a'])[Math.floor(Math.random() * 3)] });
      s.leaves = s.leaves.filter(l => { l.a += dt * 2.5; l.x += l.vx * dt + Math.sin(l.a) * 1.1; l.y += l.vy * dt; if (l.y > H) return false; ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(Math.sin(l.a) * 0.9); ctx.fillStyle = l.c; ctx.strokeStyle = '#3a1e10'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 4.2, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); return true; }); }
  }
  // v8.7: пёсик и котик — отдельным слоем ПОВЕРХ героев (чтобы оружие их не загораживало)
  function drawTop(ctx, loc, base) {
    if (!cfg().enabled) return;
    const L = LOC[loc]; if (!L || !(L.dog || L.cat)) return;
    const s = init(loc, base || 'assets/bg/'); if (!s || !s.ready) return;
    const now = performance.now(); if (s.lastTop == null) s.lastTop = now; const dt = Math.min(0.1, Math.max(0, (now - s.lastTop) / 1000)); s.lastTop = now; T = now / 1000;
    const nk = nightK();
    if (L.dog && s.dog && on('dog')) { const DD = loc === 'town' && window.__danceDog ? window.__danceDog() : null; /* v16: в хоровод — пёсик танцует со всеми */
      if (DD) { if (!s.dogDX) { s.dogDX = L.dog.x; s.dogDY = L.dog.y; } const k = Math.min(1, dt * 3); s.dogDX += (DD.x - s.dogDX) * k; s.dogDY += (DD.y - s.dogDY) * k; s.dogHappy = Math.max(s.dogHappy, 0.5); }
      else if (s.dogDX) { const k = Math.min(1, dt * 2); s.dogDX += (L.dog.x - s.dogDX) * k; s.dogDY += (L.dog.y - s.dogDY) * k; if (Math.hypot(L.dog.x - s.dogDX, L.dog.y - s.dogDY) < 2) s.dogDX = 0; }
      const P = s.dogDX ? Object.assign({}, L.dog, { x: s.dogDX, y: s.dogDY - (DD ? Math.abs(Math.sin(T * 7)) * 10 : 0) }) : L.dog, sw = s.dog.width / 2, sh = s.dog.height, w = P.w, h = w * sh / sw, x0 = P.x - w / 2, y0 = P.y - h;
      if (petQ[loc]) { s.dogHappy = 4; s.dogSay = 1.2; petQ[loc] = 0; s.hearts = 1.6; }
      s.dogHappy = Math.max(0, s.dogHappy - dt); s.dogBark -= dt; if (s.dogBark <= 0) { s.dogSay = 1; s.dogBark = rnd(14, 30); }
      const happy = s.dogHappy > 0, wag = Math.sin(T * (happy ? 16 : 5)) * (happy ? 0.32 : 0.14), bob = s.dogSay > 0 ? Math.abs(Math.sin(T * 14)) * 3 : 0;
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.filter = 'brightness(' + (0.85 - 0.22 * nk).toFixed(2) + ')'; if (DD && DD.flip) { ctx.translate(P.x, 0); ctx.scale(-1, 1); ctx.translate(-P.x, 0); }
      const pX = x0 + P.px * w, pY = y0 + P.py * h - bob; ctx.save(); ctx.translate(pX, pY); ctx.rotate(wag); ctx.drawImage(s.dog, sw, 0, sw, sh, -P.px * w, -P.py * h, w, h); ctx.restore();
      ctx.drawImage(s.dog, 0, 0, sw, sh, x0, y0 - bob, w, h); ctx.restore();
      if (s.dogSay > 0) { s.dogSay -= dt; const a = Math.min(1, s.dogSay * 3); ctx.save(); ctx.globalAlpha = a; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#1e120a'; ctx.fillStyle = '#fff3d0'; ctx.strokeText('Гав!', x0 + w * 0.2, y0 - 6); ctx.fillText('Гав!', x0 + w * 0.2, y0 - 6); ctx.restore(); }
      if (s.hearts > 0) { s.hearts -= dt; for (let i = 0; i < 3; i++) { const k = ((1.6 - s.hearts) / 1.6 + i * 0.25) % 1; ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ff7aa8'; ctx.font = '24px sans-serif'; ctx.fillText('♥', x0 + w * (0.3 + 0.2 * i), y0 - 10 - k * 50); ctx.restore(); } }
    }
    if (L.cat && s.cat && on('cat')) { const P = L.cat, w = P.w, h = w * s.cat.height / s.cat.width;
      if (petQ[loc]) { s.catHappy = 4; s.hearts = 1.6; petQ[loc] = 0; }
      s.catHappy = Math.max(0, (s.catHappy || 0) - dt); const happy = s.catHappy > 0, br = 1 + (happy ? 0.06 * Math.abs(Math.sin(T * 6)) : 0.03 * Math.sin(T * 1.7)); // дышит / мурчит
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.filter = 'brightness(' + (0.82 - 0.22 * nk).toFixed(2) + ') saturate(0.85)'; ctx.drawImage(s.cat, P.x - w / 2, P.y - h * br, w, h * br); ctx.restore();
      if (happy) { const a = Math.min(1, s.catHappy * 2); ctx.save(); ctx.globalAlpha = a; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#1e120a'; ctx.fillStyle = '#fff3d0'; const ty = P.y - h - 10 - Math.sin(T * 3) * 3; ctx.strokeText('Мрр~', P.x, ty); ctx.fillText('Мрр~', P.x, ty); ctx.restore(); }
      if (s.hearts > 0) { s.hearts -= dt; for (let i = 0; i < 3; i++) { const k = ((1.6 - s.hearts) / 1.6 + i * 0.25) % 1; ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ff7aa8'; ctx.font = '22px sans-serif'; ctx.fillText('♥', P.x - w * 0.4 + w * 0.35 * i, P.y - h - 30 - k * 50); ctx.restore(); } }
      const zp = (T * 0.35) % 1; if (!happy) { ctx.save(); ctx.globalAlpha = Math.sin(zp * Math.PI) * 0.8; ctx.fillStyle = '#e8e0ff'; ctx.font = 'bold ' + Math.round(18 + 10 * zp) + 'px sans-serif'; ctx.fillText('z', P.x - w * 0.35 + zp * 26, P.y - h - 6 - zp * 40); ctx.restore(); } }
  }
  const petQ = {};
  window.LIVE6 = { pet: loc => { petQ[loc || 'town'] = 1; }, dogXY: loc => { const d = (LOC[loc || 'town'] || {}).dog; return d ? { x: d.x, y: d.y } : null; }, draw, drawTop, catXY: loc => { const c = (LOC[loc || 'garden'] || {}).cat; return c ? { x: c.x, y: c.y } : null; }, has: loc => !!LOC[loc] && cfg().enabled !== false, nightK, LOC, ALL, _st: st };
})();
