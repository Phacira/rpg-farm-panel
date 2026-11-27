// v11: подлёдная рыбалка — мини-игра поверх пульта. Игра шлёт в снимке героя fs: { ph: 'wait'|'bite'|'pull', d (резвость рыбы), z (зона), left, tok }.
// Клюёт → окно «Клюёт! Жми куда угодно» → вываживание (зажать — зона вверх) → «рыбалка ок/срыв». Без ответа игра сама даст обычную рыбу.
(function () {
  const $ = s => document.querySelector(s);
  const CSS = `#fishOv{position:fixed;inset:0;z-index:9999;background:rgba(10,8,18,.55);display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer}
#fishOv[hidden]{display:none}
#fishOv .fo-card{width:min(320px,92vw);background:#1f1829;border:1px solid rgba(232,184,102,.35);border-radius:18px;padding:16px;box-shadow:0 14px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;align-items:center;gap:10px;font-family:Rubik,system-ui,sans-serif;color:#efe6d8;position:relative;overflow:hidden}
#fishOv .fo-title{font-size:22px;font-weight:600;color:#e8b866}
#fishOv:not(.play):not(.done) .fo-title{animation:foP .6s infinite}
@keyframes foP{50%{transform:scale(1.12)}}
#fishOv .fo-area{display:flex;gap:10px;height:min(340px,52vh)}
#fishOv .fo-bar{position:relative;width:64px;height:100%;border-radius:14px;background:linear-gradient(#0f2a40,#173d5c);border:2px solid #5d87a6;overflow:hidden}
#fishOv .fo-zone{position:absolute;left:4px;right:4px;border-radius:10px;background:rgba(126,224,138,.35);border:2px solid #7ee08a}
#fishOv .fo-zone.off{background:rgba(126,224,138,.15);border-color:rgba(126,224,138,.5)}
#fishOv .fo-fish{position:absolute;left:50%;width:34px;height:22px;margin:-11px 0 0 -17px;font-size:24px;line-height:22px;text-align:center}
#fishOv .fo-prog{position:relative;width:16px;height:100%;border-radius:8px;background:#120d18;border:1px solid #2e2540;overflow:hidden}
#fishOv .fo-prog i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(#f3d9a4,#e8b866)}
#fishOv .fo-prog i.low{background:linear-gradient(#ff9a7a,#e06a4a)}
#fishOv .fo-hint{font-size:14px;color:#cfc3dc;text-align:center;min-height:20px}
#fishOv .fo-timer{position:absolute;left:0;right:0;top:0;height:4px}
#fishOv .fo-timer i{display:block;height:100%;background:#e8b866;width:100%}
#fishOv .fo-x{background:transparent;color:#a89cb4;border:1px solid #2e2540;border-radius:10px;padding:8px 14px;font:500 14px Rubik,system-ui,sans-serif;cursor:pointer}
#fishOv.done .fo-x{visibility:hidden}`;
  let st = 'off', tok = '', fishD = 0.3, zoneH = 0.2, name = '', raf = 0, last = 0, hold = false, until = 0;
  let zy = 0, zv = 0, fy = 0.3, fv = 0, ft = 0.5, fn = 0, prog = 0.3;
  const ICON = { karas: '🐟', okun: '🐟', yorsh: '🐡', shuka: '🐟', som: '🐋', karp: '🐠', chest: '🎁' };
  const FILT = { okun: 'hue-rotate(60deg)', shuka: 'hue-rotate(100deg) saturate(1.5)', karp: 'drop-shadow(0 0 6px gold)' };
  function el() {
    let o = $('#fishOv'); if (o) return o;
    const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
    o = document.createElement('div'); o.id = 'fishOv'; o.hidden = true;
    o.innerHTML = '<div class="fo-card"><div class="fo-title">🎣 <span id="foTitle">Клюёт!</span></div>' +
      '<div class="fo-area" id="foArea"><div class="fo-bar" id="foBar"><div class="fo-zone" id="foZone"></div><div class="fo-fish" id="foFish">🐟</div></div><div class="fo-prog"><i id="foPg"></i></div></div>' +
      '<div class="fo-hint" id="foHint">Жми в любом месте, чтобы подсечь!</div><div class="fo-timer"><i id="foT"></i></div><button type="button" class="fo-x" id="foX">Отпустить</button></div>';
    document.body.appendChild(o);
    o.addEventListener('pointerdown', e => { if (e.target.id === 'foX') return; e.preventDefault(); if (st === 'bite') start(); if (st === 'play') hold = true; }, { passive: false });
    window.addEventListener('pointerup', () => { hold = false; }); window.addEventListener('pointercancel', () => { hold = false; }); window.addEventListener('blur', () => { hold = false; });
    window.addEventListener('keydown', e => { if (st === 'off' || e.code !== 'Space') return; e.preventDefault(); if (st === 'bite' && !e.repeat) start(); else if (st === 'play') hold = true; });
    window.addEventListener('keyup', e => { if (e.code === 'Space') hold = false; });
    o.querySelector('#foX').onclick = () => { if (st === 'play') finish(false); else close(); };
    return o;
  }
  function send(arg) { try { if (window.PanelActions) PanelActions.fire('рыбалка', arg, 'Рыбалка'); } catch (e) {} }
  function close() { st = 'off'; cancelAnimationFrame(raf); const o = $('#fishOv'); if (o) o.hidden = true; document.body.classList.remove('fishing'); }
  function bite(fs) {
    const o = el(); st = 'bite'; tok = fs.tok; fishD = +fs.d || 0.3; zoneH = +fs.z || 0.2; name = fs.nm || 'Рыба'; until = Date.now() + Math.max(3, +fs.left || 20) * 1000;
    o.hidden = false; o.classList.remove('play', 'done'); document.body.classList.add('fishing');
    $('#foTitle').textContent = 'Клюёт!'; $('#foHint').textContent = 'Жми в любом месте, чтобы подсечь!'; $('#foArea').style.visibility = 'hidden';
    const f = $('#foFish'); f.textContent = ICON[fs.f] || '🐟'; f.style.filter = FILT[fs.f] || '';
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(tick);
  }
  function start() {
    st = 'play'; send('тяну'); $('#fishOv').classList.add('play'); $('#foArea').style.visibility = 'visible';
    $('#foTitle').textContent = 'Тяни!'; $('#foHint').textContent = 'Держи — зона вверх, отпусти — вниз';
    zy = 0; zv = 0; fy = 0.3; fv = 0; ft = 0.5; fn = 0; prog = 0.3; until = Date.now() + 110000;
  }
  function finish(ok) {
    st = 'done'; hold = false; cancelAnimationFrame(raf); send(ok ? 'ок' : 'срыв');
    $('#fishOv').classList.add('done'); $('#foTitle').textContent = ok ? 'Есть!' : 'Сорвалась…'; $('#foHint').textContent = ok ? `${name} на крючке — смотри улов в игре` : `${name} ушла подо лёд`;
    setTimeout(close, 2200);
  }
  function tick(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    const tl = $('#foT'); if (tl) tl.style.width = Math.max(0, Math.min(1, (until - Date.now()) / (st === 'bite' ? 25000 : 110000))) * 100 + '%';
    if (st === 'bite') { if (Date.now() > until) { close(); return; } raf = requestAnimationFrame(tick); return; }
    if (st !== 'play') return;
    if (Date.now() > until) return finish(false);
    const d = fishD, H = zoneH;
    zv += (hold ? 1.9 : -1.6) * dt; zv = Math.max(-1, Math.min(1, zv)); zy += zv * dt;
    if (zy < 0) { zy = 0; zv = -zv * 0.35; } if (zy > 1 - H) { zy = 1 - H; zv = 0; }
    fn -= dt;
    if (fn <= 0) { let sg = Math.random() < .5 ? -1 : 1; if (fy > .7) sg = Math.random() < .8 ? -1 : 1; if (fy < .3) sg = Math.random() < .8 ? 1 : -1; let t2 = fy + sg * (0.06 + d * 0.6) * (0.35 + 0.65 * Math.random()); if (Math.random() < d * d * 0.45) t2 = 0.08 + Math.random() * 0.84; ft = Math.max(0.06, Math.min(0.94, t2)); fn = (2.0 - d * 1.75) * (0.4 + Math.random()); }
    const k = 2.5 + d * d * 22, damp = 3.2 - d * 1.6; fv += ((ft - fy) * k - fv * damp) * dt; fy += fv * dt; fy = Math.max(0.02, Math.min(0.98, fy));
    const inZ = fy >= zy && fy <= zy + H; prog += (inZ ? 0.26 - d * 0.04 : -(0.07 + d * 0.10)) * dt;
    const bar = $('#foBar'), bh = bar.clientHeight, z = $('#foZone'), f = $('#foFish'), pg = $('#foPg');
    z.classList.toggle('off', !inZ); z.style.height = (H * bh) + 'px'; z.style.top = ((1 - zy - H) * bh) + 'px';
    f.style.top = ((1 - fy) * bh) + 'px'; f.style.transform = inZ ? '' : `translateX(${(Math.random() - .5) * 4}px)`;
    pg.style.height = Math.max(0, Math.min(1, prog)) * 100 + '%'; pg.classList.toggle('low', prog < 0.2);
    if (prog >= 1) return finish(true); if (prog <= 0) return finish(false);
    raf = requestAnimationFrame(tick);
  }
  // следим за снимком: своя поклёвка → открыть окно (один раз на поклёвку)
  setInterval(() => {
    try {
      const P = window.__panel; if (!P || !P.state) return;
      const me = P.state.me, fs = me && me.fs; if (!fs) return;
      if (fs.ph === 'bite' && fs.tok && fs.tok !== tok && st === 'off') bite(fs);
    } catch (e) {}
  }, 300);
  window.__fishTest = fs => bite(Object.assign({ ph: 'bite', d: 0.4, z: 0.2, left: 25, nm: 'Окунь', f: 'okun' }, fs || {}, { tok: 't' + Math.random() }));
})();
