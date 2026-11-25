// Бета нового вида пульта: свои SVG-иконки вместо эмодзи (одинаково во всех браузерах),
// точки «новое» на новых кнопках, ровная сетка. Логика пульта не меняется — этот файл только перерисовывает вид.
(function () {
  'use strict';
  // 20×20, контур currentColor. [путь, цвет или '' — цвет текста]
  const P = {
    town: ['<path d="M3 17V8l7-5 7 5v9M8 17v-5h4v5"/>', ''],
    sprout: ['<path d="M10 17V9M10 9c0-3 2-5 5-5 0 3-2 5-5 5zM10 11c0-2-2-4-5-4 0 2 2 4 5 4z"/>', '#8fd16a'],
    fire: ['<path d="M10 3c2 3 4 5 4 8a4 4 0 01-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-7z"/>', '#ff9a4a'],
    tree: ['<path d="M10 3l5 7h-3l4 5H4l4-5H5zM10 15v3"/>', '#7fbf6a'],
    boss: ['<path d="M5 5l2 3h6l2-3v6a5 5 0 01-10 0zM8 11h.01M12 11h.01"/>', '#ff7a6a'],
    bag: ['<path d="M5 8h10l-1 9H6zM7.5 8V6a2.5 2.5 0 015 0v2"/>', ''],
    scroll: ['<path d="M6 3h9v12a2 2 0 01-2 2H5a2 2 0 01-2-2v-1h10M6 3a2 2 0 00-2 2v8M9 7h3M9 10h3"/>', ''],
    news: ['<path d="M10 2.5l1.8 4.7 4.7 1.8-4.7 1.8L10 15.5l-1.8-4.7L3.5 9l4.7-1.8z"/>', '#e8b866'],
    list: ['<path d="M7 3h6v3H7zM5 5H4v12h12V5h-1M7 10h6M7 13h4"/>', ''],
    hammer: ['<path d="M11 4l5 5-2 2-5-5zM9 6l-6 9 2 2 9-6"/>', ''],
    wrench: ['<path d="M13 3a4 4 0 00-4 5l-6 6 3 3 6-6a4 4 0 005-4l-2 2-2-1-1-2 2-2z"/>', ''],
    build: ['<path d="M3 17h14M5 17V9h10v8M5 13h10M10 9v8M7 9V5h6v4"/>', ''],
    coin: ['<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="3.8"/>', '#e8b866'],
    pot: ['<path d="M3 9h14M4 9c0 4 2.5 7 6 7s6-3 6-7M8 6c0-1 1-1 1-2M12 6c0-1 1-1 1-2"/>', ''],
    swords: ['<path d="M4 4l9 9M16 4l-9 9M11 15l4-4M5 11l4 4M3 17l2-2M17 17l-2-2"/>', ''],
    castle: ['<path d="M3 17V7h2v2h2V7h2v2h2V7h2v2h2V7h2v10zM8 17v-4h4v4"/>', ''],
    flask: ['<path d="M8 3h4M9 3v5l-4 8h10l-4-8V3M7 13h6"/>', '#c9a2ff'],
    star4: ['<path d="M10 3l1.6 5.4L17 10l-5.4 1.6L10 17l-1.6-5.4L3 10l5.4-1.6z"/>', '#e8b866'],
    trophy: ['<path d="M6 3h8v5a4 4 0 01-8 0zM6 5H3c0 3 2 4 3 4M14 5h3c0 3-2 4-3 4M10 12v3M7 17h6"/>', '#e8b866'],
    medal: ['<path d="M7 2l3 5 3-5M10 7a5 5 0 100 10 5 5 0 000-10zM10 10v4"/>', '#e8b866'],
    clover: ['<path d="M10 10a3 3 0 113-3 3 3 0 11-3 3zm0 0a3 3 0 11-3-3 3 3 0 113 3zm0 0a3 3 0 11-3 3M10 10a3 3 0 113 3M10 10l2 7"/>', '#7fbf6a'],
    shield: ['<path d="M10 3l6 2v5c0 4-3 6-6 7-3-1-6-3-6-7V5z"/>', '#8fb4ff'],
    target: ['<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3.5"/><path d="M10 10h.01"/>', '#ff7a6a'],
    log: ['<path d="M4 8h12v6H4zM4 8a1.5 3 0 000 6M16 8a1.5 3 0 010 6"/>', '#c8955a'],
    rock: ['<path d="M3 15l3-7 4-3 5 3 2 7z"/>', '#a8a0b0'],
    dice: ['<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M8 8h.01M12 12h.01M12 8h.01M8 12h.01"/>', ''],
    hourglass: ['<path d="M5 3h10M5 17h10M6 3c0 4 8 4 8 7s-8 3-8 7M14 3c0 4-8 4-8 7"/>', ''],
    chain: ['<path d="M8 12l4-4M7 9l-2 2a3 3 0 004 4l2-2M13 11l2-2a3 3 0 00-4-4L9 7"/>', ''],
    paw: ['<path d="M10 11c-3 0-4 3-3 5h6c1-2 0-5-3-5zM5 9h.01M8 5h.01M12 5h.01M15 9h.01"/>', ''],
    orb: ['<circle cx="10" cy="9" r="6"/><path d="M6 17h8M8 7a3 3 0 012-2"/>', '#c9a2ff'],
    tag: ['<path d="M3 10V4h6l8 8-6 6zM6.5 6.5h.01"/>', ''],
    ring: ['<circle cx="10" cy="12" r="5"/><path d="M8 4h4l1 2-3 2-3-2z"/>', '#e8b866'],
    amulet: ['<path d="M4 3c0 5 3 8 6 8s6-3 6-8M10 11v1M10 12l3 3-3 3-3-3z"/>', '#e8b866'],
    bug: ['<path d="M7 7a3 3 0 016 0M6 8h8v4a4 4 0 01-8 0zM10 8v8M3 10h3M14 10h3M4 15l2-1M16 15l-2-1"/>', '#ff9a4a'],
    gift: ['<path d="M3 8h14v3H3zM4 11h12v6H4zM10 8v9M10 8c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1"/>', '#e8b866'],
    skull: ['<path d="M5 13V9a5 5 0 0110 0v4l-2 1v3H7v-3zM8 10h.01M12 10h.01"/>', ''],
    heart: ['<path d="M10 16s-6-3.5-6-8a3.2 3.2 0 016-1.5A3.2 3.2 0 0116 8c0 4.5-6 8-6 8z"/>', '#ff7a6a'],
    warn: ['<path d="M10 3l8 14H2zM10 8v4M10 14.5h.01"/>', '#ffb45a'],
    leaf: ['<path d="M4 16C4 9 8 4 16 4c0 8-5 12-12 12zM4 16l7-7"/>', '#8fd16a'],
    basket: ['<path d="M3 9h14l-2 8H5zM6 9l3-5M14 9l-3-5M8 12v3M12 12v3"/>', ''],
    book: ['<path d="M3 4h5a2 2 0 012 2v11a2 2 0 00-2-2H3zM17 4h-5a2 2 0 00-2 2v11a2 2 0 012-2h5z"/>', ''],
    razor: ['<path d="M4 15l7-7M9 6l5-3 3 3-3 5zM3 17l2-2"/>', ''],
    axe: ['<path d="M5 17L13 9M11 4c3 0 5 2 5 5l-3 1-3-3z"/>', ''],
    walk: ['<path d="M11 4.5h.01M9 17l2-5-2-2 1-3 3 2 2 1M9 10l-3 1M11 12l2 5"/>', ''],
    seed: ['<path d="M10 4c3 2 4 5 4 7a4 4 0 01-8 0c0-2 1-5 4-7zM10 9v6"/>', '#c8955a'],
    repeat: ['<path d="M4 9a5 5 0 019-3l2 2M16 11a5 5 0 01-9 3l-2-2M15 4v4h-4M5 16v-4h4"/>', ''],
    fist: ['<path d="M5 9h10v4a4 4 0 01-4 4H9a4 4 0 01-4-4zM5 9V6h3v3M8 6V5h3v4M11 5h3v4"/>', '#e8b866'],
    glove: ['<path d="M6 17v-7L4 8l1-2 2 2V4h2v4V3h2v5V4h2v6l2-1v3l-3 5z"/>', ''],
    tent: ['<path d="M2 17L10 4l8 13zM10 4v13M7 17l3-5 3 5"/>', ''],
    shop: ['<path d="M3 8l2-4h10l2 4zM3 8c0 1.5 1 2 2.3 2S7.7 9.5 7.7 8c0 1.5 1 2 2.3 2s2.3-.5 2.3-2c0 1.5 1 2 2.3 2S17 9.5 17 8M4 10v7h12v-7M8 17v-4h4v4"/>', ''],
    bow: ['<path d="M5 3c6 2 9 7 9 14M5 3l9 14M3 10h10l-2-2M13 10l-2 2"/>', ''],
    cross: ['<path d="M10 3v14M5 7h10"/>', '#ffe6a8'],
    star: ['<path d="M10 3l2.1 4.4 4.9.6-3.6 3.4.9 4.8-4.3-2.4-4.3 2.4.9-4.8L3 8l4.9-.6z"/>', '#e8b866'],
    crown: ['<path d="M3 15l1-9 4 4 2-5 2 5 4-4 1 9z"/>', '#e8b866'],
    flag: ['<path d="M5 17V3M5 4h10l-2 3 2 3H5"/>', ''],
    map: ['<path d="M3 5l5-2 4 2 5-2v12l-5 2-4-2-5 2zM8 3v12M12 5v12"/>', ''],
    burst: ['<path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.5 4.5l3 3M12.5 12.5l3 3M15.5 4.5l-3 3M7.5 12.5l-3 3"/>', '#ffb45a'],
    check: ['<path d="M4 10.5l4 4 8-9"/>', '#8fd16a'],
    x: ['<path d="M5 5l10 10M15 5L5 15"/>', ''],
    bowl: ['<path d="M3 10h14c0 4-3 6-7 6s-7-2-7-6zM7 7c1-2 2-2 3-1s2 1 3-1"/>', '#8fd16a'],
    chart: ['<path d="M4 16V9M10 16V4M16 16v-5M3 17h14"/>', ''],
    save: ['<path d="M4 3h10l3 3v11H4zM7 3v4h6V3M7 17v-5h6v5"/>', ''],
    sword: ['<path d="M15 3l2 2-9 9-2-2zM5 13l2 2M3 17l3-3M4 12l4 4"/>', '']
  };
  const MAP = {
    '🏘': 'town', '🏠': 'town', '🌱': 'sprout', '🔥': 'fire', '🌲': 'tree', '👹': 'boss', '👾': 'boss', '🎒': 'bag', '📜': 'scroll', '🆕': 'news',
    '📋': 'list', '⚒': 'hammer', '🔨': 'hammer', '🔧': 'wrench', '🏗': 'build', '💰': 'coin', '🪙': 'coin', '🍲': 'pot', '⚔': 'swords',
    '🗡': 'sword', '🏰': 'castle', '🏛': 'castle', '🧪': 'flask', '✨': 'star4', '✦': 'star4', '💫': 'star4', '🏆': 'trophy', '🥇': 'medal', '🥈': 'medal',
    '🥉': 'medal', '🏅': 'medal', '🎖': 'medal', '🍀': 'clover', '🛡': 'shield', '🎯': 'target', '🪵': 'log', '🪨': 'rock', '🎲': 'dice',
    '⏳': 'hourglass', '⛓': 'chain', '🐾': 'paw', '🔮': 'orb', '🏷': 'tag', '💍': 'ring', '📿': 'amulet', '🐞': 'bug', '🐛': 'bug', '🐌': 'bug',
    '🎁': 'gift', '📦': 'gift', '☠': 'skull', '💀': 'skull', '❤': 'heart', '💖': 'heart', '💚': 'heart', '⚠': 'warn', '⛔': 'warn', '🌿': 'leaf',
    '🌾': 'leaf', '🧺': 'basket', '📖': 'book', '💈': 'razor', '🪒': 'razor', '🪓': 'axe', '🚶': 'walk', '🌰': 'seed', '🔁': 'repeat',
    '🔄': 'repeat', '👊': 'fist', '🧤': 'glove', '⛺': 'tent', '🏪': 'shop', '🛖': 'tent', '🏹': 'bow', '✝': 'cross', '⭐': 'star', '★': 'star',
    '👑': 'crown', '🚩': 'flag', '🗺': 'map', '💥': 'burst', '✅': 'check', '✔': 'check', '✓': 'check', '✖': 'x', '✕': 'x', '🥗': 'bowl',
    '📊': 'chart', '💾': 'save'
  };
  const RX = new RegExp('(' + Object.keys(MAP).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?', 'gu');
  function svg(name) {
    const p = P[name]; if (!p) return null;
    const s = document.createElement('span'); s.className = 'bi bi-' + name; if (p[1]) s.style.color = p[1];
    s.innerHTML = '<svg viewBox="0 0 20 20" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p[0] + '</svg>';
    return s;
  }
  window.BetaIcon = n => { const s = svg(MAP[n] || n); return s ? s.outerHTML : n; };
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|TITLE|CANVAS|SVG|NOSCRIPT)$/i;
  function fixText(t) {
    const v = t.nodeValue; if (!v || !RX.test(v)) return; RX.lastIndex = 0;
    let par = t.parentNode; if (!par) return;
    for (let e = par; e && e !== document.body; e = e.parentNode) if (SKIP.test(e.nodeName) || (e.isContentEditable)) return;
    const frag = document.createDocumentFragment(); let last = 0, m;
    RX.lastIndex = 0;
    while ((m = RX.exec(v))) {
      if (m.index > last) frag.appendChild(document.createTextNode(v.slice(last, m.index)));
      frag.appendChild(svg(MAP[m[1]]) || document.createTextNode(m[0])); last = m.index + m[0].length;
    }
    if (last < v.length) frag.appendChild(document.createTextNode(v.slice(last)));
    par.replaceChild(frag, t);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 || SKIP.test(root.nodeName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) list.push(n);
    list.forEach(fixText);
  }

  // «Новое»: точка на кнопках с недавними изменениями (список ведём вручную), пока на кнопку не нажмут или не выйдет срок
  const NEW = { 'гильдия': '2026-12-09', 'готовить': '2026-12-09', 'ui:news': '' }; // ключ — команда кнопки (data-bc) или ui:…
  const SEEN_K = 'beta_seen_v2';
  let seen; try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_K) || '[]')); } catch (e) { seen = new Set(); }
  const saveSeen = () => { try { localStorage.setItem(SEEN_K, JSON.stringify([...seen])); } catch (e) { } };
  const keyOf = b => b.dataset.bc || (b.dataset.ui ? 'ui:' + b.dataset.ui : '');
  const today = () => new Date().toISOString().slice(0, 10);
  function isNew(k) {
    if (k === 'ui:news') return !!(window.RPGNews && RPGNews.unseen());
    const till = NEW[k]; return !!till && today() <= till && !seen.has(k);
  }
  function markNew(root) {
    (root.querySelectorAll ? root.querySelectorAll('#bs .actionbar button, #bs .sheet-body .more-btn') : []).forEach(b => {
      const k = keyOf(b); if (k) b.classList.toggle('is-new', isNew(k));
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#bs .actionbar button, #bs .sheet-body .more-btn'); if (!b) return;
    const k = keyOf(b); if (k && NEW[k] && !seen.has(k)) { seen.add(k); saveSeen(); b.classList.remove('is-new'); }
  }, true);


  // ---------- поведение кнопок в бете ----------
  const meNow = () => (window.__panel && __panel.state && __panel.state.me) || null;
  const mins = s => s >= 3600 ? Math.floor(s / 3600) + 'ч ' + Math.floor(s % 3600 / 60) + 'м' : s >= 60 ? Math.ceil(s / 60) + 'м' : Math.max(0, Math.round(s)) + 'с';
  // 1) кнопки, которые сейчас не сработают, — приглушены и с короткой причиной (но нажимаются: бот главный, игра может отставать)
  // 2) «Точно?» только там, где тратится что-то ценное
  const FREE = new Set(['готовить', 'магия', 'посадить', 'собрать', 'жуки', 'отогнать', 'салат', 'обмен', 'огород', 'поход', 'урожай', 'грядка',
    'удар', 'лечить', 'босс', 'квест', 'семена', 'да', 'нет', 'пати', 'оглушить', 'связать', 'очистить', 'замедлить', 'заслон', 'прикрыть', 'воскресить',
    'экип', 'снять', 'титул', 'ход', 'гильдпоход', 'цель']);
  window.__betaNoConfirm = cmd => FREE.has(String(cmd || '').toLowerCase()) && cmd !== 'снять';
  window.__betaDefs = (D, ctx) => {
    const me = ctx && ctx.me; if (!me) return;
    Object.keys(D).forEach(k => (D[k] || []).forEach(d => { if (Array.isArray(d) && d[5] && window.__betaNoConfirm(d[2])) d[5] = null; }));
    const b = me.bed, mg = me.mg, sal = me.sal, soft = (d, why) => { d._soft = 1; if (why) d[4] = why; };
    (D.garden || []).forEach(d => {
      if (!Array.isArray(d)) return;
      if (b) {
        const growing = b.st === 1 ? 'растёт' + (b.left > 0 ? ' · ' + mins(b.left) : '') : b.st === 0 ? 'грядка пустая' : '';
        if (d[2] === 'собрать' && b.st !== 2) soft(d, growing);
        if (d[2] === 'посадить' && b.st !== 0) soft(d, b.st === 2 ? 'сначала собрать' : 'грядка занята');
        if (d[2] === 'посадить' && b.st === 0) d[4] = 'грядка свободна';
        if (d[2] === 'жуки' && !b.bugs) soft(d, 'жуков нет');
        if (d[2] === 'жуки' && b.bugs) d[4] = 'срочно!';
        if (d[2] === 'собрать' && b.st === 2) d[4] = 'созрело!';
      }
      if (d[2] === 'магия' && mg && (!mg.left || mg.cd > 0 || !mg.seeds)) soft(d);
      if (d[2] === 'салат' && sal && (!sal.left || !sal.can)) soft(d);
    });
    regroup(D, me);
  };

  // ---------- объединение кнопок в понятные группы ----------
  // опция меню из обычной кнопки: та же команда, то же подменю или подтверждение
  function asOpt(d, label, sub) {
    const cmd = d[2], fix = L => (L || []).map(o => Object.assign({}, o, { cmd: o.cmd || cmd }, o.next ? { next: fix(o.next) } : {}));
    const o = { label: label || d[1], sub: sub != null ? sub : (d[4] || ''), cmd, dis: !!d[6] };
    if (typeof d[3] === 'function') o.next = fix(d[3]()); else { o.arg = d[3] || ''; o.confirm = d[5] || null; }
    return o;
  }
  function group(list, pick, make) {
    if (!list) return list;
    const idx = [], mem = [];
    list.forEach((d, i) => { if (Array.isArray(d) && pick(d)) { idx.push(i); mem.push(d); } });
    if (mem.length < 2) return list;
    const g = make(mem); const out = list.filter((d, i) => !idx.includes(i)); out.splice(idx[0], 0, g); return out;
  }
  const by = cmds => d => cmds.includes(d[2]);
  function regroup(D, me) {
    // огород: сначала то, что нажимают чаще всего (на телефоне в первый ряд попадают первые три)
    if (D.garden) { const ORD = ['собрать', 'посадить', 'жуки', 'магия', 'готовить']; const rk = d => { const i = ORD.indexOf(Array.isArray(d) ? d[2] : ''); return i < 0 ? 99 : i; };
      D.garden = D.garden.map((d, i) => [d, i]).sort((a, b) => (rk(a[0]) - rk(b[0])) || (a[1] - b[1])).map(x => x[0]); }
    // огород: семена, овощи, редкое — по группам
    D.garden = group(D.garden, d => d[2] === 'семена' || (d[2] === 'купить' && /семена/i.test(d[1])), M => ['🌰', 'Семена', '', () => M.map(d => asOpt(d, d[2] === 'семена' ? 'Взять бесплатные' : 'Купить за золото')), M[0][4] || '']);
    D.garden = group(D.garden, by(['урожай', 'продать', 'обмен', 'салат']), M => ['🧺', 'Овощи', '', () => M.slice().sort((a, b) => ['урожай', 'продать', 'салат', 'обмен'].indexOf(a[2]) - ['урожай', 'продать', 'салат', 'обмен'].indexOf(b[2])).map(d => asOpt(d, { урожай: 'Что у меня есть', продать: 'Продать на рынке', обмен: 'Обменять 10 сорняков', салат: 'Приготовить салат' }[d[2]])), 'продать, обмен, салат']);
    // город: задание и кузница
    D.town = group(D.town, by(['квест', 'снять']), M => ['📜', 'Квест', '', () => M.map(d => asOpt(d, d[2] === 'квест' ? 'Взять квест' : 'Отменить квест')), M[0][4] || '']);
    D.town = group(D.town, d => ['купить', 'чинить', 'заточка'].includes(d[2]), M => ['⚒', 'Кузница', '', () => M.map(d => asOpt(d, { купить: 'Купить / надеть / продать', чинить: 'Починить', заточка: 'Заточка' }[d[2]])), M.length > 1 ? 'вещи, починка, заточка' : M[0][4]]);
    // лагерь: «Да/Нет» — это подтверждение выбора гильдии, им место внутри «Гильдии»
    if (D.camp) {
      const gd = D.camp.find(d => Array.isArray(d) && d[2] === 'гильдия'), yn = D.camp.filter(d => Array.isArray(d) && (d[2] === 'да' || d[2] === 'нет'));
      if (gd && yn.length && typeof gd[3] === 'function') {
        const f = gd[3]; gd[3] = () => f().concat(yn.map(d => asOpt(d, d[2] === 'да' ? 'Подтвердить вступление' : 'Отменить выбор гильдии', d[2] === 'да' ? 'если игра спросила «да/нет»' : '')));
        D.camp = D.camp.filter(d => !yn.includes(d));
      }
    }
    // лес: все походы — одна кнопка
    if (D.forest) {
      const hikes = D.forest.filter(d => Array.isArray(d) && (d[2] === 'поход' || d[2] === 'пати'));
      const gd = (D.camp || []).find(d => Array.isArray(d) && d[2] === 'гильдия');
      let gh = null; try { gh = gd && typeof gd[3] === 'function' ? gd[3]().find(o => /Гильд-поход/.test(o.label || '')) : null; } catch (e) { }
      if (hikes.length) {
        const opts = () => hikes.map(d => asOpt(d, d[2] === 'поход' ? 'Одиночный поход' : 'Пати-поход')).concat(gh ? [Object.assign({}, gh, { label: 'Гильд-поход' })] : []);
        const g = ['⚔', 'Походы', '', opts, hikes[0][4] || ''];
        const i = D.forest.indexOf(hikes[0]); D.forest = D.forest.filter(d => !hikes.includes(d)); D.forest.splice(i, 0, g);
      }
    }
  }
  // 5) ПК: редкие кнопки огорода и города — в «Ещё», чтобы всё помещалось без прокрутки
  const RARE = new Set(['вклад', 'грядка']);
  window.__betaPcSplit = (defs, loc) => {
    const rare = d => !d._ui && (RARE.has(d[2]) || (d[2] === 'купить' && /семена/i.test(d[1] || '')) || d[7] === 'other');
    const more = defs.filter(rare); if (!more.length) return { main: defs, more: [] };
    return { main: defs.filter(d => !rare(d)).concat([{ _ui: 'more', 0: '⋯', 1: 'Ещё', 4: '' }]), more };
  };
  // 4) мини-журнал — свои события
  window.__betaFeedMine = true;
  // 3) грядка и магия прямо в карточке героя
  function chips() {
    const u0 = document.getElementById('bsUnit'), me = meNow(); if (!u0) return; const u = u0.querySelector('.unit-main') || u0;
    const old = u0.querySelector(':scope > .b-chips'); if (old && u !== u0) old.remove();
    let c = u.querySelector('.b-chips'); if (!me || (!me.bed && !me.mg)) { if (c) c.remove(); return; }
    const b = me.bed, mg = me.mg, out = [];
    if (b) out.push(b.bugs ? ['bug', 'жуки!', 'warn'] : b.st === 2 ? ['basket', 'созрело', 'ok'] : b.st === 1 ? ['sprout', b.left > 0 ? mins(b.left) : 'растёт', ''] : ['sprout', 'пусто', 'mute']);
    if (mg) out.push(['star4', mg.left + '/' + mg.max + (mg.cd > 0 && mg.left ? ' · ' + mins(mg.cd) : ''), mg.left && !(mg.cd > 0) ? 'ok' : 'mute']);
    const html = out.map(([i, t, k]) => `<span class="b-chip ${k}">${window.BetaIcon(i)}${t}</span>`).join('');
    if (!c) { c = document.createElement('div'); c.className = 'b-chips'; u.appendChild(c); }
    if (c.dataset.h !== html) { c.dataset.h = html; c.innerHTML = html; }
  }

  function start() {
    const tg = document.createElement('div'); tg.className = 'beta-tag'; tg.innerHTML = 'Бета нового вида<a href="./">обычная версия</a>'; document.body.appendChild(tg); setTimeout(() => tg.classList.add('gone'), 6000);
    walk(document.body);
    let q = [], t = 0;
    const flush = () => { t = 0; const l = q; q = []; l.forEach(n => n.isConnected && walk(n)); markNew(document); chips(); };
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') q.push(m.target);
        else m.addedNodes.forEach(n => q.push(n));
      }
      if (!t) t = requestAnimationFrame(flush);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    markNew(document);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
