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
  // 27.11: звук и вибрация, когда в походе появляется мини-игра (выключить: localStorage rpgXeSound = '0')
  let AC = null;
  function ding() {
    try { if (localStorage.getItem('rpgXeSound') === '0') return; } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([90, 60, 90]); } catch (e) {}
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
      const t = AC.currentTime; [[880, 0], [1320, 0.12]].forEach(([f, d]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.22, t + d + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35); o.connect(g).connect(AC.destination); o.start(t + d); o.stop(t + d + 0.4); }); } catch (e) {}
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} }, { once: true, capture: true }));
  function show(x) {
    const base = x.k + ':' + x.u, k = base + (x.k === 'fork' ? ':' + (x.vote || '') + (x.nl || 0) + (x.nr || 0) + (x.hint || '') + (x.btn || []).join() : ':' + (x.btn ? 1 : 0));
    if (k === key) return; if (done && done.split(':').slice(0, 2).join(':') === base && x.k !== 'fork') return;
    const same = key.split(':').slice(0, 2).join(':') === base; key = k; if (!same) { t0 = Date.now(); L0 = Math.max(1, x.left); done = ''; }
    clearT(); box.innerHTML = (UI[x.k] || (() => head(x.n || '', '')))(x); box.style.display = 'block';
  }
  // 27.11: звук в момент старта пати- и гильд-похода (был в очереди → ушёл в поход), чтобы успеть вернуться на вкладку
  // 27.11: настройка сигнала похода — кнопка 🔔 слева внизу: вкл/выкл, громкость, «проверить»; запоминается
  const SND = { on: 1, vol: 0.6 }; try { Object.assign(SND, JSON.parse(localStorage.getItem('rpgHorn') || '{}')); if (localStorage.getItem('rpgXeSound') === '0') SND.on = 0; } catch (e) {}
  const sndSave = () => { try { localStorage.setItem('rpgHorn', JSON.stringify(SND)); } catch (e) {} };
  (function () {
    const st = document.createElement('style'); st.textContent = `#hornBtn{position:fixed;right:12px;top:12px;z-index:2147483000;width:34px;height:34px;border:0;background:none;box-shadow:none;color:#ffd86b;font:20px system-ui;cursor:pointer;opacity:.85;padding:0;overflow:visible;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))}#hornBtn:hover{opacity:1}#musBtn.paired{width:34px!important;height:34px!important;border:0!important;background:none!important;box-shadow:none!important;font-size:20px!important;z-index:2147483000!important;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))}#hornBtn.off{filter:grayscale(1) drop-shadow(0 1px 2px rgba(0,0,0,.8));opacity:.5}
#hornBtn.new::after{content:'';position:absolute;top:5px;right:6px;width:8px;height:8px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 6px #ff4d4d;animation:hornDot 1.2s ease-in-out infinite}@keyframes hornDot{50%{opacity:.25;transform:scale(.8)}}
#hornPop{position:fixed;right:12px;top:50px;z-index:2147483001;background:rgba(30,20,12,.96);border:1px solid #c99b4a;border-radius:10px;padding:10px 12px;color:#f3e3c2;font:500 13px Rubik,system-ui,sans-serif;width:230px;display:none}
#hornPop b{color:#ffd86b}#hornPop label{display:flex;gap:8px;align-items:center;margin:6px 0;cursor:pointer}#hornPop input[type=range]{width:100%;accent-color:#ffd86b}#hornPop button{margin-top:6px;width:100%;min-height:32px;border-radius:8px;border:1px solid #c99b4a;background:linear-gradient(#7a4b22,#5a3416);color:#fff;font:600 13px Rubik,system-ui;cursor:pointer}`;
    document.head.appendChild(st);
    const b = document.createElement('button'); b.id = 'hornBtn'; b.title = 'Сигнал о начале похода'; b.textContent = '🔔';
    const pp = document.createElement('div'); pp.id = 'hornPop';
    pp.innerHTML = '<b>Сигнал похода</b><div style="opacity:.75;font-size:12px;margin-top:2px">звучит, когда твой пати- или гильд-поход стартует</div><label><input type="checkbox" data-k="on"> включён</label><div>Громкость</div><input type="range" min="0" max="100" data-k="vol"><button data-k="test">▶ Проверить</button><div style="border-top:1px solid rgba(201,155,74,.4);margin-top:10px;padding-top:6px"><b>Ауры героев</b></div><label><input type="checkbox" data-k="aur"> показывать чужие ауры</label><div style="opacity:.7;font-size:11.5px">твоя аура видна всегда</div>';
    const sync = () => { try { pp.querySelector('[data-k=aur]').checked = localStorage.getItem('rpgAuraOthers') !== '0'; } catch (e) {} pp.querySelector('[data-k=on]').checked = !!SND.on; pp.querySelector('[data-k=vol]').value = Math.round(SND.vol * 100); b.classList.toggle('off', !SND.on); };
    try { if (!localStorage.getItem('rpgHornSeen2')) b.classList.add('new'); } catch (e) {}
    const seen = () => { b.classList.remove('new'); try { localStorage.setItem('rpgHornSeen2', '1'); } catch (er) {} };
    b.onclick = e => { e.stopPropagation(); const on = pp.style.display !== 'block'; pp.style.display = on ? 'block' : 'none'; sync(); if (on) { const r = b.getBoundingClientRect(), w = 256; pp.style.left = Math.max(8, Math.min(innerWidth - w - 8, Math.round(r.left))) + 'px'; pp.style.right = 'auto'; if (r.top > innerHeight / 2) { pp.style.top = 'auto'; pp.style.bottom = Math.round(innerHeight - r.top + 6) + 'px'; } else { pp.style.bottom = 'auto'; pp.style.top = Math.round(r.bottom + 6) + 'px'; } } };
    // 27.11: телефон — справа сверху (на большом экране под «Обычный пульт»); компьютер — пульт: слева внизу, большой экран: под аватаркой
    setInterval(() => {
      const phone = innerWidth < 760 || (matchMedia && matchMedia('(pointer:coarse)').matches), bs = document.body.classList.contains('bs-on');
      const port = !phone && bs && document.querySelector('#bsUnit .port'), uf = port && port.parentElement;
      const mb = document.getElementById('musBtn'); // 27.11: кнопка музыки (зима) — рядом с колокольчиком, без обводки; на маленьком пульте с ПК — как была
      if (port) { if (b.parentElement !== uf) uf.appendChild(b); const c = port.offsetLeft + port.offsetWidth / 2, top = Math.round(port.offsetTop + port.offsetHeight + 2) + 'px';
        Object.assign(b.style, { position: 'absolute', left: Math.round(c - (mb ? 34 : 17)) + 'px', top, right: 'auto', bottom: 'auto' });
        if (mb) { if (mb.parentElement !== uf) uf.appendChild(mb); mb.classList.add('paired'); Object.assign(mb.style, { position: 'absolute', left: Math.round(c) + 'px', top, right: 'auto', bottom: 'auto' }); } return; }
      if (b.parentElement !== document.body && document.body) document.body.appendChild(b);
      if (mb && mb.parentElement !== document.body && document.body) document.body.appendChild(mb);
      if (phone) { let top = 12; if (bs) { const ex = [...document.querySelectorAll('#bs button, #bs a')].find(x => /Обычный пульт/.test(x.textContent)); if (ex) { const r = ex.getBoundingClientRect(); if (r.width && r.left > innerWidth * 0.5) top = Math.round(r.bottom + 6); } }
        Object.assign(b.style, { position: 'fixed', top: top + 'px', right: '12px', left: 'auto', bottom: 'auto' });
        if (mb) { mb.classList.add('paired'); Object.assign(mb.style, { position: 'fixed', top: top + 'px', right: '48px', left: 'auto', bottom: 'auto' }); } }
      else { Object.assign(b.style, { position: 'fixed', left: '54px', bottom: '10px', top: 'auto', right: 'auto' }); if (mb) { mb.classList.remove('paired'); mb.style.cssText = ''; } }
    }, 400);
    pp.onclick = e => e.stopPropagation();
    pp.addEventListener('input', e => { seen(); const k = e.target.dataset.k; if (k === 'aur') { try { localStorage.setItem('rpgAuraOthers', e.target.checked ? '1' : '0'); } catch (er) {} if (window.__auraRefresh) __auraRefresh(); return; } if (k === 'on') SND.on = e.target.checked ? 1 : 0; if (k === 'vol') SND.vol = e.target.value / 100; sndSave(); sync(); });
    pp.querySelector('[data-k=test]').onclick = () => { seen(); const o = SND.on; SND.on = 1; horn(true); SND.on = o; };
    document.addEventListener('click', () => { pp.style.display = 'none'; });
    const add = () => { document.body.append(b, pp); sync(); }; if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  })();
  function horn(test) {
    if (!SND.on) return;
    try { if (navigator.vibrate) navigator.vibrate([150, 80, 150, 80, 250]); } catch (e) {}
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
      const t = AC.currentTime; // 27.11: негромкий охотничий рожок на старт похода
      [[196, 0, 0.32, 0.1], [196, 0.36, 0.22, 0.09], [294, 0.6, 1.0, 0.11]].forEach(([f, d, len, vol0]) => { const vol = vol0 * SND.vol * 1.6; // охотничий рожок: соль–соль–ре, мягко и бодро
        const g = AC.createGain(), f1 = AC.createBiquadFilter(), f2 = AC.createBiquadFilter(), T = t + d;
        [f1, f2].forEach(F => { F.type = 'lowpass'; F.Q.value = 0.5; F.frequency.setValueAtTime(700, T); F.frequency.linearRampToValueAtTime(1500, T + 0.12); });
        g.gain.setValueAtTime(0.0001, T); g.gain.linearRampToValueAtTime(vol, T + 0.05); g.gain.setValueAtTime(vol, T + len * 0.6); g.gain.linearRampToValueAtTime(0.0001, T + len);
        f1.connect(f2).connect(g).connect(AC.destination);
        const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 5; lg.gain.value = f * 0.004; lfo.connect(lg);
        [0, 5].forEach(dt => { const o = AC.createOscillator(); o.type = 'sawtooth'; o.detune.value = dt; o.frequency.setValueAtTime(f * 0.98, T); o.frequency.linearRampToValueAtTime(f, T + 0.06); lg.connect(o.frequency); o.connect(f1); o.start(T); o.stop(T + len + 0.05); });
        lfo.start(T); lfo.stop(T + len + 0.05);
      }); } catch (e) {}
    if (!test && document.hidden) { const t0 = document.title; let n = 0; const iv = setInterval(() => { document.title = n++ % 2 ? t0 : '⚔ ПОХОД НАЧАЛСЯ!'; if (n > 20 || !document.hidden) { clearInterval(iv); document.title = t0; } }, 700); }
  }
  let wasQ = 0, wasExp = false;
  setInterval(() => {
    try { const P = window.__panel, me = P && P.state && P.state.me; if (!me) return;
      const q = !!(me.pty || (me.g9 && me.g9.inQ)), ex = me.mode === 'exp' || me.st === 'exp';
      if (q) wasQ = Date.now();
      if (ex && !wasExp && Date.now() - wasQ < 20000) horn();
      wasExp = ex; } catch (e) {}
  }, 500);
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
