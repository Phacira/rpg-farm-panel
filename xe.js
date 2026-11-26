// v11: события похода — всплывающая плашка с мини-действием (туман, кубик, паника, мишень, развилка, ловушка)
(function () {
  const css = `#xeBox{position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:2147483000;width:340px;max-width:94vw;background:rgba(28,22,40,.97);border:2px solid #e8b860;border-radius:14px;padding:10px 14px;color:#fff;font:600 15px/1.3 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.55);text-align:center;display:none;animation:xeIn .2s ease-out;user-select:none;-webkit-user-select:none;touch-action:manipulation}
#xeBox .t{font-size:16px;margin-bottom:4px}#xeBox .s{font-weight:400;font-size:13px;opacity:.85;margin-bottom:8px}
#xeBox .b{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}#xeBox button{flex:1;min-height:48px;border-radius:10px;border:1px solid #c99b4a;background:linear-gradient(#7a4b22,#5a3416);color:#fff;font:700 16px system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
#xeBox button:active{filter:brightness(1.3)}#xeBox .bar{height:4px;background:#e8b860;border-radius:2px;margin-top:8px;transform-origin:left;animation:xeBar linear forwards}
@keyframes xeBar{from{transform:scaleX(var(--f,1))}to{transform:scaleX(0)}}@keyframes xeIn{from{opacity:0;transform:translate(-50%,-20px)}}
#xeBox .meter{height:12px;border-radius:6px;background:#2a2238;border:1px solid #6a5a80;overflow:hidden;margin:6px 0}#xeBox .meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,#8fd8ff,#c9b3ff);transition:width .08s}
#xeBox .die{font:800 54px/1 system-ui,sans-serif;margin:4px 0 8px;color:#ffd86b;text-shadow:0 0 12px rgba(255,200,80,.5)}
#xeBox canvas.g{display:block;margin:2px auto 4px;touch-action:none;cursor:pointer}#xeBox .ring{width:110px;height:110px;margin:4px auto 6px;border-radius:50%;background:conic-gradient(#ff9c7a var(--p,0%),#3a2e4a 0);display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:none}
#xeBox .ring b{width:84px;height:84px;border-radius:50%;background:#2a2238;display:flex;align-items:center;justify-content:center;font-size:15px}
#xeTgt{position:fixed;z-index:2147483001;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:radial-gradient(circle,#ff3b2f 0 12%,#fff 13% 30%,#ff3b2f 31% 50%,#fff 51% 70%,#ff3b2f 71% 100%);box-shadow:0 0 18px rgba(255,80,60,.8);cursor:crosshair;display:none;animation:xeT 2.2s linear forwards;touch-action:none}
@keyframes xeT{0%{transform:scale(.3)}15%{transform:scale(1)}85%{transform:scale(1)}100%{transform:scale(0)}}
#xeBox .arr{display:flex;gap:10px;justify-content:center;margin:6px 0 10px;font-size:40px}#xeBox .arr span{width:62px;height:62px;border-radius:12px;background:#3a2c18;border:2px solid #e8b860;color:#ffe08a;display:flex;align-items:center;justify-content:center}#xeBox .arr span.cur{box-shadow:0 0 0 3px #fff,0 0 16px #ffd86b;animation:xeP .6s ease-in-out infinite alternate}@keyframes xeP{to{transform:scale(1.08)}}
#xeBox .arr span.ok{background:#2f6b3a;border-color:#7dff9a}#xeBox .arr span.bad{background:#7a2626}
#xeBox .pad{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}#xeBox .pad button{background:#2a2238;border-color:#5a4c6e;color:#cfc4e0;min-height:44px;font-size:20px}#xeBox .kbh{font-size:12px;opacity:.7;margin-top:4px}@media (hover:hover) and (pointer:fine){#xeBox .pad{display:none}}@media not ((hover:hover) and (pointer:fine)){#xeBox .kbh{display:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const box = document.createElement('div'); box.id = 'xeBox'; document.body.appendChild(box);
  const tgt = document.createElement('div'); tgt.id = 'xeTgt'; document.body.appendChild(tgt);
  const LBL = { встряхнуть: 'Встряхнуть', удержать: 'Удержать', рискнуть: 'Кубик', бей: 'Бей!', налево: '← Налево', направо: 'Направо →', прыжок: 'Прыжок!', разведка: '🔎 Разведка' };
  let key = '', t0 = 0, L0 = 1, done = '', timers = [], offs = [];
  const clearT = () => { timers.forEach(t => { clearInterval(t); clearTimeout(t); }); timers = []; offs.forEach(f => { try { f(); } catch (e) {} }); offs = []; tgt.style.display = 'none'; };
  function send(cmd, arg) { try { if (window.PanelActions) PanelActions.fire(cmd, arg == null ? '' : String(arg), LBL[cmd] || cmd); } catch (e) {} }
  function finish(msg, cmd, arg) { done = key; clearT(); if (cmd) send(cmd, arg); box.innerHTML = `<div class="t">${msg}</div>`; timers.push(setTimeout(() => { if (done === key) box.style.display = 'none'; }, 1400)); }
  const bar = () => `<div class="bar" style="animation-duration:${Math.max(.1, L0 - (Date.now() - t0) / 1000)}s;--f:${Math.max(0, 1 - (Date.now() - t0) / 1000 / L0)}"></div>`;
  function head(t, s) { return `<div class="t">${t}</div><div class="s">${s}</div>`; }
  // --- мини-действия ---
  function uiFog(x) { if (x.me) return head('😵 Ты в тумане', 'Жди, пока союзник тебя встряхнёт') + bar();
    let n = 0; const N = 6; setTimeout(() => { const b = box.querySelector('button'), m = box.querySelector('.meter i'); if (b) b.onpointerdown = () => { n++; m.style.width = n / N * 100 + '%'; box.style.transform = `translateX(calc(-50% + ${n % 2 ? 6 : -6}px))`; setTimeout(() => box.style.transform = 'translateX(-50%)', 60); if (n >= N) finish('Очнулся!', 'встряхнуть', x.u); }; });
    return head('😵 Туман в голове', `${x.u} не может бить — тряси! Жми быстро ${N} раз`) + '<div class="meter"><i></i></div><div class="b"><button>Трясти!</button></div>' + bar(); }
  function uiLuck(x) { let v = 1, stop = false; timers.push(setInterval(() => { if (stop) return; v = v % 20 + 1; const d = box.querySelector('.die'); if (d) d.textContent = v; }, 55));
    setTimeout(() => { const b = box.querySelector('button'); if (b) b.onpointerdown = () => { stop = true; const r = v === 1 ? 'промах…' : v >= 20 ? 'КРИТ ×3!' : v >= 15 ? 'удар ×2' : v >= 8 ? 'удар ×1.3' : 'слабый удар'; finish(`🎲 ${v} — ${r}`, 'рискнуть', v); }; });
    return head('🎲 Бросок удачи', 'Останови кубик: 1 — промах, 20 — тройной урон') + '<div class="die">?</div><div class="b"><button>Стоп!</button></div>' + bar(); }
  function uiFlee(x) { if (x.me) return head('😱 Ты в панике', 'Сейчас сбежишь… если союзник не удержит') + bar();
    // как в рыбалке: зажимай — стрелка идёт вправо, отпусти — падает влево; держи её в зелёной зоне, пока не наполнится шкала
    let a = 0.15, v = 0, hold = false, prog = 0, zc = 0.5, zt = 0.5, zT = 0, last = 0, raf = 0; const ZW = 0.19, NEED = 2.4;
    const loop = t => { const cv = box.querySelector('canvas.g'); if (!cv || done === key) return; const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
      v += (hold ? 1.7 : -1.4) * dt; v *= 0.9; a = Math.max(0, Math.min(1, a + v * dt * 3)); if (a <= 0 || a >= 1) v = 0;
      zT -= dt; if (zT <= 0) { zT = 0.7 + Math.random() * 1.1; zt = 0.15 + Math.random() * 0.7; } zc += (zt - zc) * dt * 1.8;
      const inZ = Math.abs(a - zc) < ZW / 2; prog = Math.max(0, Math.min(NEED, prog + (inZ ? dt : -dt * 0.7)));
      const g = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = H - 10, R = H - 22, ang = q => Math.PI + q * Math.PI;
      g.clearRect(0, 0, W, H); g.lineCap = 'round'; g.lineWidth = 16; g.strokeStyle = '#3a2e4a'; g.beginPath(); g.arc(cx, cy, R, Math.PI, 0); g.stroke();
      g.strokeStyle = inZ ? '#7dff9a' : '#4fae6a'; g.beginPath(); g.arc(cx, cy, R, ang(Math.max(0, zc - ZW / 2)), ang(Math.min(1, zc + ZW / 2))); g.stroke();
      g.lineWidth = 6; g.strokeStyle = '#ffd86b'; g.beginPath(); g.arc(cx, cy, R + 14, Math.PI, Math.PI + Math.PI * prog / NEED); g.stroke();
      g.lineWidth = 4; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang(a)) * (R + 6), cy + Math.sin(ang(a)) * (R + 6)); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
      if (prog >= NEED) { finish('Удержал!', 'удержать', x.u); return; } raf = requestAnimationFrame(loop); };
    setTimeout(() => { const cv = box.querySelector('canvas.g'), b = box.querySelector('button'); if (!cv) return; const dn = e => { e.preventDefault(); hold = true; }, up = () => { hold = false; };
      [cv, b].forEach(el => { el.onpointerdown = dn; el.onpointerup = up; el.onpointerleave = up; el.onpointercancel = up; });
      const kd = e => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); hold = true; } }, ku = e => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); hold = false; } }; document.addEventListener('keydown', kd, true); document.addEventListener('keyup', ku, true); try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (e) {} offs.push(() => { document.removeEventListener('keydown', kd, true); document.removeEventListener('keyup', ku, true); });
      raf = requestAnimationFrame(loop); offs.push(() => cancelAnimationFrame(raf)); });
    return head('😱 Паника!', `${x.u} хочет сбежать — зажимай и держи стрелку в зелёной зоне`) + '<canvas class="g" width="260" height="140"></canvas><div class="b"><button>Держать (или пробел)</button></div>' + bar(); }
  function uiWeak(x) { setTimeout(() => { const W = innerWidth, H = innerHeight, px = 60 + Math.random() * (W - 120), py = H * 0.45 + Math.random() * (H * 0.45 - 60);
      tgt.style.left = px + 'px'; tgt.style.top = py + 'px'; tgt.style.display = 'block'; tgt.style.animation = 'none'; void tgt.offsetWidth; tgt.style.animation = '';
      tgt.onpointerdown = e => { const d = Math.hypot(e.clientX - px, e.clientY - py), acc = Math.max(0, 1 - d / 42); finish(acc > 0.8 ? '🎯 В яблочко!' : acc > 0.4 ? '🎯 Попал!' : '🎯 Задел', 'бей', Math.round(acc * 100)); };
      timers.push(setTimeout(() => { if (done !== key) finish('Мимо — мишень исчезла'); }, 2200)); }, 350);
    return head('🎯 Слабое место!', 'Попади по мишени — чем ближе к центру, тем сильнее удар') + bar(); }
  function uiTrap(x) { const A = ['←', '↑', '→', '↓'], seq = [0, 1, 2].map(() => Math.floor(Math.random() * 4)); let i = 0;
    const myKey = key, press = k => { const sp = box.querySelectorAll('.arr span'); if (!sp.length || done === key || key !== myKey) return; if (k === seq[i]) { sp[i].classList.remove('cur'); sp[i].classList.add('ok'); i++; if (sp[i]) sp[i].classList.add('cur'); if (i >= 3) finish('🦘 Перепрыгнул!', 'прыжок'); } else { sp[i] && sp[i].classList.add('bad'); finish('Споткнулся… −HP'); } };
    const kb = e => { const m = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3 }[e.key] ?? { KeyA: 0, KeyW: 1, KeyD: 2, KeyS: 3, Numpad4: 0, Numpad8: 1, Numpad6: 2, Numpad2: 3 }[e.code]; if (m != null) { e.preventDefault(); e.stopPropagation(); press(m); } };
    document.addEventListener('keydown', kb, true); offs.push(() => document.removeEventListener('keydown', kb, true));
    setTimeout(() => { box.querySelectorAll('.pad button').forEach((b, k) => b.onpointerdown = () => press(k)); const po = box.querySelector('.padon'); if (po) po.onclick = e => { e.preventDefault(); const pd = box.querySelector('.pad'); if (pd) pd.style.display = 'grid'; po.parentNode.style.display = 'none'; }; });
    return head('🪤 Ловушка!', 'Нажми эти стрелки по порядку') + `<div class="arr">${seq.map((k, n) => `<span${n ? '' : ' class="cur"'}>${A[k]}</span>`).join('')}</div><div class="pad">${A.map(a => `<button>${a}</button>`).join('')}</div><div class="kbh">⌨ стрелки или W A S D · <a href="#" class="padon" style="color:#ffd86b">мышкой</a></div>` + bar(); }
  function uiFork(x) { const s = (x.hint ? '🔎 ' + x.hint + '<br>' : 'Один путь — тайник, другой — засада<br>') + `Голоса: ← ${x.nl || 0} · ${x.nr || 0} →`;
    setTimeout(() => box.querySelectorAll('button').forEach(b => b.onclick = () => send(b.dataset.c, '')));
    return head('🧭 Развилка', s) + `<div class="b">${(x.btn || []).map(c => `<button data-c="${c}"${x.vote === c ? ' style="outline:3px solid #ffe08a"' : ''}>${LBL[c] || c}${x.vote === c ? ' ✓' : ''}</button>`).join('')}</div>` + bar(); }
  const UI = { fog: uiFog, luck: uiLuck, flee: uiFlee, weak: uiWeak, trap: uiTrap, fork: uiFork };
  function show(x) {
    const base = x.k + ':' + x.u, k = base + (x.k === 'fork' ? ':' + (x.vote || '') + (x.nl || 0) + (x.nr || 0) + (x.hint || '') + (x.btn || []).join() : ':' + (x.btn ? 1 : 0));
    if (k === key) return; if (done && done.split(':').slice(0, 2).join(':') === base && x.k !== 'fork') return;
    const same = key.split(':').slice(0, 2).join(':') === base; key = k; if (!same) { t0 = Date.now(); L0 = Math.max(1, x.left); done = ''; }
    clearT(); box.innerHTML = (UI[x.k] || (() => head(x.n || '', '')))(x); box.style.display = 'block';
  }
  setInterval(() => {
    try {
      const P = window.__panel, me = P && P.state && P.state.me, x = window.__xeMock || (me && me.xe);
      if (!x) { if (box.style.display !== 'none' && done !== key) { box.style.display = 'none'; clearT(); } key = ''; return; }
      show(x);
    } catch (e) {}
  }, 300);
  window.__xeTest = x => { window.__xeMock = x; };
  // демо: ?xe=1 — по кругу все события
  if (/[?&]xe=1/.test(location.search)) { const D = [{ k: 'fog', u: 'Phacia', me: 0, left: 10, btn: ['встряхнуть', 'Phacia'] }, { k: 'luck', u: '', me: 1, left: 8, btn: ['рискнуть', ''] }, { k: 'flee', u: 'kioku_n', me: 0, left: 12, btn: ['удержать', 'kioku_n'] }, { k: 'weak', u: '', me: 0, left: 4, btn: ['бей', ''] }, { k: 'fork', u: '', me: 0, left: 12, btn: ['налево', 'направо', 'разведка'], nl: 1, nr: 0, hint: '' }, { k: 'trap', u: '', me: 0, left: 6, btn: ['прыжок', ''] }];
    let i = 0; const nx = () => { const d = D[i++ % D.length]; window.__xeMock = Object.assign({}, d); setTimeout(() => { window.__xeMock = null; setTimeout(nx, 1800); }, d.left * 1000); }; setTimeout(nx, 2500);
    const f0 = () => { if (window.PanelActions && !PanelActions.__xeWrap) { const o = PanelActions.fire; PanelActions.fire = (c, a, l) => { const M = window.__xeMock; if (M && M.k === 'fork') { if (c === 'разведка') { M.hint = 'Вы: «справа следы засады»'; M.btn = ['налево', 'направо']; } else { if (M.vote === 'налево') M.nl--; if (M.vote === 'направо') M.nr--; M.vote = c; if (c === 'налево') M.nl++; else M.nr++; } return; } if (!/^(встряхнуть|удержать|рискнуть|бей|прыжок)$/.test(c)) o.call(PanelActions, c, a, l); }; PanelActions.__xeWrap = 1; } else setTimeout(f0, 500); }; f0(); }
})();
