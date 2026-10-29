// v7panel3b: спрайты героев на превью карты. Картинки — viewer/img/h/<ключ>.webp (один кадр, пиксели как в игре),
// волосы и окраска сета перекрашиваются здесь же теми же правилами, что в игре (маска hm_<ключ>.png). Нет картинки — HeroSprites.get вернёт null (рисуется точка).
(function () {
  const BASE = 'img/h/', IM = {}, OUT = new Map(); let onReady = null;
  const meta = k => window.HERO_SPR && window.HERO_SPR.m[k];
  function load(src) { if (IM[src]) return IM[src]; const i = new Image(); i.onload = () => { OUT.clear(); onReady && onReady(); }; i.onerror = () => { i.bad = true; }; i.src = src; return IM[src] = i; }
  const ok = i => i && i.complete && i.naturalWidth > 0 && !i.bad;
  function canvasOf(i) { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(i, 0, 0); return c; }
  function hsl2(H, S, L) { const C2 = (1 - Math.abs(2 * L - 1)) * S, X = C2 * (1 - Math.abs((H / 60) % 2 - 1)), mm = L - C2 / 2; const [a, b, cc] = H < 60 ? [C2, X, 0] : H < 120 ? [X, C2, 0] : H < 180 ? [0, C2, X] : H < 240 ? [0, X, C2] : H < 300 ? [X, 0, C2] : [C2, 0, X]; return [(a + mm) * 255, (b + mm) * 255, (cc + mm) * 255]; }
  function dye(c, hex) { // как dyed() в game.js
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return; const x = c.getContext('2d'), id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    const n = parseInt(hex.slice(1), 16), tr = (n >> 16) / 255, tg = (n >> 8 & 255) / 255, tb = (n & 255) / 255;
    const tmx = Math.max(tr, tg, tb), tmn = Math.min(tr, tg, tb), td = tmx - tmn; let th = 0; if (td) { th = tmx === tr ? ((tg - tb) / td) % 6 : tmx === tg ? (tb - tr) / td + 2 : (tr - tg) / td + 4; th *= 60; if (th < 0) th += 360; }
    const ts = td / (1 - Math.abs(tmx + tmn - 1) || 1);
    for (let p = 0; p < d.length; p += 4) { if (d[p + 3] < 8) continue;
      const r = d[p] / 255, g = d[p + 1] / 255, b = d[p + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
      const sat = dl ? dl / (1 - Math.abs(2 * l - 1)) : 0; let hue = 0; if (dl) { hue = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; hue *= 60; if (hue < 0) hue += 360; }
      if ((hue >= 4 && hue <= 46 && sat > .28 && l > .2) || l < .12 || l > .95) continue;
      const [R2, G2, B2] = sat < .22 ? hsl2(th, Math.min(1, ts * .75), l * .9) : hsl2(th, Math.min(1, sat * .45 + ts * .55), l); d[p] = R2; d[p + 1] = G2; d[p + 2] = B2; }
    x.putImageData(id, 0, 0);
  }
  function hair(c, mask, ramp) { // как haired() в game.js
    const x = c.getContext('2d'), id = x.getImageData(0, 0, c.width, c.height), d = id.data, md = canvasOf(mask).getContext('2d').getImageData(0, 0, c.width, c.height).data, [A, B, Cc] = ramp;
    for (let p = 0; p < d.length; p += 4) { if (md[p] < 128 || d[p + 3] < 8) continue;
      const l = (Math.max(d[p], d[p + 1], d[p + 2]) + Math.min(d[p], d[p + 1], d[p + 2])) / 510, t = Math.max(0, Math.min(1, (l - .03) / .4));
      const a = t < .5 ? A : B, b = t < .5 ? B : Cc, u = t < .5 ? t * 2 : (t - .5) * 2;
      d[p] = a[0] + (b[0] - a[0]) * u; d[p + 1] = a[1] + (b[1] - a[1]) * u; d[p + 2] = a[2] + (b[2] - a[2]) * u; }
    x.putImageData(id, 0, 0);
  }
  // k — ключ спрайта из снимка, hid — id цвета волос, dy — #цвет окраски сета, ramps — {id: [[r,g,b]×3]} из ref.hair
  function get(k, hid, dy, ramps) {
    const m = meta(k); if (!m || !/^[a-z0-9_]{3,40}$/.test(k)) return null;
    const ramp = hid && ramps && ramps[hid], key = k + '|' + (ramp ? hid : '') + '|' + (dy || '');
    if (OUT.has(key)) return OUT.get(key);
    const im = load(BASE + k + '.webp'), mk = m[5] && ramp ? load(BASE + 'hm_' + k + '.png') : null;
    if (!ok(im) || (mk && !ok(mk) && !mk.bad)) return null;
    let c = canvasOf(im);
    try { if (dy) dye(c, dy); if (mk && ok(mk)) hair(c, mk, ramp); } catch (e) { c = canvasOf(im); }
    const r = { c, w: m[0], h: m[1], fx: m[2], fy: m[3], sy: m[4], sit: /_sit$/.test(k), sc: window.HERO_SPR.sc };
    if (OUT.size > 400) OUT.clear(); OUT.set(key, r); return r;
  }
  window.HeroSprites = { get, onReady: f => { onReady = f; }, has: k => !!meta(k) };
})();
