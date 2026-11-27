// v15: фоновая музыка сайта — вкл/выкл, громкость, выбор мелодии; всё запоминается. По умолчанию — тихий эмбиент.
(function () {
  const TR = [{ id: 'amb', name: 'Зимний эмбиент', f: 'test/audio/bg_ambient.mp3?v=1' }, { id: 'sil', name: '«Тихая ночь» (Ф. Грубер)', f: 'test/audio/bg_silent.mp3?v=1' }];
  const K = 'rpgMusic'; let C = { on: 1, vol: 0.25, tr: 'amb' };
  try { Object.assign(C, JSON.parse(localStorage.getItem(K) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(K, JSON.stringify(C)); } catch (e) {} };
  const au = new Audio(); au.loop = true; au.preload = 'none'; let paused = false, started = false;
  const cur = () => TR.find(t => t.id === C.tr) || TR[0];
  function apply() { au.volume = Math.max(0, Math.min(1, C.vol)); const want = C.on && !paused && !document.hidden;
    const src = cur().f; if (!au.src.endsWith(src)) { au.src = src; }
    if (want && started) au.play().catch(() => {}); else au.pause(); btn.classList.toggle('off', !C.on); }
  const st = document.createElement('style'); st.textContent = `#musBtn{position:fixed;left:10px;bottom:10px;z-index:30;width:38px;height:38px;border-radius:50%;border:1.5px solid #c99b4a;background:rgba(40,26,16,.85);color:#ffd86b;font:700 18px system-ui;cursor:pointer;opacity:.75;display:flex;align-items:center;justify-content:center;padding:0}
#musBtn:hover{opacity:1}#musBtn.off{color:#7d6a52;text-decoration:line-through}
#musPop{position:fixed;left:10px;bottom:54px;z-index:31;background:rgba(30,20,12,.96);border:1px solid #c99b4a;border-radius:10px;padding:10px 12px;color:#f3e3c2;font:500 13px Rubik,system-ui,sans-serif;width:220px;display:none}
#musPop label{display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer}#musPop input[type=range]{width:100%;accent-color:#ffd86b}#musPop b{color:#ffd86b}`;
  document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'musBtn'; btn.title = 'Музыка'; btn.textContent = '♪';
  const pop = document.createElement('div'); pop.id = 'musPop';
  pop.innerHTML = `<b>Музыка</b><label><input type="checkbox" data-k="on"> играть</label><div>Громкость</div><input type="range" min="0" max="100" data-k="vol">` + TR.map(t => `<label><input type="radio" name="musTr" value="${t.id}"> ${t.name}</label>`).join('');
  document.body.append(btn, pop);
  const sync = () => { pop.querySelector('[data-k=on]').checked = !!C.on; pop.querySelector('[data-k=vol]').value = Math.round(C.vol * 100); pop.querySelectorAll('[name=musTr]').forEach(r => r.checked = r.value === C.tr); };
  btn.onclick = e => { e.stopPropagation(); started = true; const on = pop.style.display !== 'block'; pop.style.display = on ? 'block' : 'none'; sync(); apply();
    if (on) { const r = btn.getBoundingClientRect(), w = 246; if (btn.classList.contains('paired')) { pop.style.zIndex = 2147483001; pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, Math.round(r.left))) + 'px'; if (r.top > innerHeight / 2) { pop.style.top = 'auto'; pop.style.bottom = Math.round(innerHeight - r.top + 6) + 'px'; } else { pop.style.bottom = 'auto'; pop.style.top = Math.round(r.bottom + 6) + 'px'; } } else { pop.style.left = ''; pop.style.top = ''; pop.style.bottom = ''; } } };
  pop.onclick = e => e.stopPropagation();
  pop.addEventListener('input', e => { const t = e.target; if (t.dataset.k === 'on') C.on = t.checked ? 1 : 0; else if (t.dataset.k === 'vol') C.vol = t.value / 100; else if (t.name === 'musTr') C.tr = t.value; save(); started = true; apply(); });
  document.addEventListener('click', () => { pop.style.display = 'none'; }, false);
  // браузер не даёт играть звук до первого касания — стартуем с первым кликом по странице
  const first = () => { if (started) return; started = true; apply(); };
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, first, { once: true, capture: true }));
  document.addEventListener('visibilitychange', apply);
  window.__music = { pause(v) { paused = !!v; apply(); }, getVol: () => C.vol, setVol(v) { C.vol = Math.max(0, Math.min(1, +v || 0)); save(); apply(); try { sync(); } catch (e) {} } }; // 27.11: общий ползунок с хороводом
  apply();
})();
