// v13: зима — нажми на другого героя на большом экране: «Кинуть снежок» или «Подарить коробку»
(function () {
  const st = document.createElement('style');
  st.textContent = `#bs.xmc .hero:not(.me) img{pointer-events:auto;cursor:pointer}#bs.xmc .hero:not(.me) img:hover{filter:drop-shadow(0 0 6px #ffe08a) drop-shadow(0 1px 2px #000)}
.xmI{position:fixed;z-index:2147482000;display:none;flex-direction:column;align-items:center;gap:2px;cursor:pointer;animation:xmIn .15s ease-out;-webkit-tap-highlight-color:transparent}
.xmI b{width:38px;height:38px;border-radius:50%;background:rgba(28,22,40,.92);border:1.5px solid #c99b4a;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 3px 10px rgba(0,0,0,.45)}
.xmI:hover b{border-color:#ffe08a;background:rgba(60,44,24,.95)}.xmI small{font:600 10.5px Rubik,system-ui,sans-serif;color:#f3e6c8;background:rgba(20,16,28,.82);padding:1px 6px;border-radius:8px;white-space:nowrap}
.xmI.off{opacity:.45;cursor:default}@keyframes xmIn{from{opacity:0;transform:scale(.6)}}`;
  document.head.appendChild(st);
  const IC = { snow: '<path d="M10 2v16M3.1 6l13.8 8M3.1 14l13.8-8M8 3.5l2 2 2-2M8 16.5l2-2 2 2M3.3 9l2.7.7-.7 2.6M16.7 9l-2.7.7.7 2.6"/>', gift: '<path d="M3 8h14v3H3zM4 11h12v6H4zM10 8v9M10 8c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1"/>' };
  const ico = (k, col) => `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="${col}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
  const bS = document.createElement('div'), bG = document.createElement('div'); bS.className = bG.className = 'xmI'; document.body.append(bS, bG);
  const WF = /[?&]winter=1/.test(location.search);
  const xm = () => { const P = window.__panel, me = P && P.state && P.state.me; return me && (me.xm || (WF ? { gl: 3, gc: 40, sb: 0 } : null)); };
  let tgt = '';
  const close = () => { bS.style.display = bG.style.display = 'none'; tgt = ''; };
  function open(n, img) {
    const X = xm(); if (!X) return; const me = window.__panel.state.me, gold = (me && me.gold) || 0, r = img.getBoundingClientRect();
    const sb = X.sb > 0, gOk = X.gl > 0 && gold >= X.gc; tgt = n;
    bS.innerHTML = `<b>${ico('snow', '#bfe6ff')}</b><small>${sb ? X.sb + ' с' : 'снежок'}</small>`; bS.classList.toggle('off', sb); bS.title = sb ? 'снежок ещё лепится' : `кинуть снежок в ${n}`;
    bG.innerHTML = `<b>${ico('gift', '#e8b866')}</b><small>${X.gl <= 0 ? 'всё' : X.gc + ' з'}</small>`; bG.classList.toggle('off', !gOk); bG.title = X.gl <= 0 ? 'на этот стрим подарки кончились (3 из 3)' : gold < X.gc ? `нужно ${X.gc} золота` : `подарить ${n} коробку за ${X.gc} з (ещё ${X.gl} за стрим)`;
    const y = r.top + r.height * 0.28; bS.style.display = bG.style.display = 'flex';
    bS.style.left = Math.max(4, r.left + r.width * 0.12 - 46) + 'px'; bG.style.left = Math.min(innerWidth - 46, r.right - r.width * 0.12 + 6) + 'px'; bS.style.top = bG.style.top = Math.max(4, y) + 'px';
  }
  bS.onclick = () => { if (bS.classList.contains('off') || !tgt) return; const n = tgt; close(); try { PanelActions.fire('снежок', n, 'Снежок'); } catch (e) {} };
  bG.onclick = () => { if (bG.classList.contains('off') || !tgt) return; const n = tgt, X = xm(); close(); if (!confirm(`Подарить ${n} новогоднюю коробку за ${X.gc} золота?`)) return; try { PanelActions.fire('подарить', n, 'Подарить'); } catch (e) {} };
  document.addEventListener('click', e => {
    const img = e.target.closest && e.target.closest('#bs.xmc .hero:not(.me) img');
    if (img) { const n = img.closest('.hero').dataset.n; if (n) { e.stopPropagation(); if (tgt === n) close(); else open(n, img); return; } }
    if (!bS.contains(e.target) && !bG.contains(e.target)) close();
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  setInterval(() => { const bs = document.getElementById('bs'); if (bs) bs.classList.toggle('xmc', !!xm()); }, 1000);
})();
