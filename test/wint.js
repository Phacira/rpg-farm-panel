// v13: зима — нажми на другого героя на большом экране: «Кинуть снежок» или «Подарить коробку»
(function () {
  const st = document.createElement('style');
  st.textContent = `#bs.xmc .hero:not(.me) img{pointer-events:auto;cursor:pointer}#bs.xmc .hero:not(.me) img:hover{filter:drop-shadow(0 0 6px #ffe08a) drop-shadow(0 1px 2px #000)}
#xmMenu{position:fixed;z-index:2147482000;background:rgba(28,22,40,.97);border:2px solid #e8b860;border-radius:12px;padding:8px;display:none;min-width:190px;box-shadow:0 8px 24px rgba(0,0,0,.5);font:600 14px system-ui,sans-serif;color:#fff}
#xmMenu .h{font-size:13px;opacity:.85;margin:0 4px 6px;text-align:center}#xmMenu button{display:block;width:100%;margin:4px 0;min-height:42px;border-radius:9px;border:1px solid #c99b4a;background:linear-gradient(#7a4b22,#5a3416);color:#fff;font:700 15px system-ui,sans-serif;cursor:pointer}
#xmMenu button[disabled]{opacity:.45;cursor:default}#xmMenu small{display:block;font-weight:400;font-size:11px;opacity:.8}`;
  document.head.appendChild(st);
  const menu = document.createElement('div'); menu.id = 'xmMenu'; document.body.appendChild(menu);
  const WF = /[?&]winter=1/.test(location.search);
  const xm = () => { const P = window.__panel, me = P && P.state && P.state.me; return me && (me.xm || (WF ? { gl: 3, gc: 40, sb: 0 } : null)); };
  const close = () => { menu.style.display = 'none'; };
  function open(n, x, y) {
    const X = xm(); if (!X) return; const P = window.__panel, me = P.state.me, gold = (me && me.gold) || 0;
    const sb = X.sb > 0, gOk = X.gl > 0 && gold >= X.gc;
    menu.innerHTML = `<div class="h">${n.replace(/[<>&]/g, '')}</div>
      <button data-c="снежок"${sb ? ' disabled' : ''}>❄ Кинуть снежок<small>${sb ? 'лепится… ' + X.sb + ' с' : 'попадание ~80%'}</small></button>
      <button data-c="подарить"${gOk ? '' : ' disabled'}>🎁 Подарить коробку<small>${X.gl <= 0 ? 'на этот стрим всё (3 из 3)' : gold < X.gc ? 'нужно ' + X.gc + ' з' : X.gc + ' з · ещё ' + X.gl + ' за стрим'}</small></button>`;
    menu.querySelectorAll('button').forEach(b => b.onclick = () => { close(); const c = b.dataset.c; if (c === 'подарить' && !confirm(`Подарить ${n} новогоднюю коробку за ${X.gc} золота?`)) return; try { PanelActions.fire(c, n, c === 'снежок' ? 'Снежок' : 'Подарить'); } catch (e) {} });
    menu.style.display = 'block'; const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(6, Math.min(innerWidth - w - 6, x - w / 2)) + 'px'; menu.style.top = Math.max(6, Math.min(innerHeight - h - 6, y - h - 14)) + 'px';
  }
  document.addEventListener('click', e => {
    const img = e.target.closest && e.target.closest('#bs.xmc .hero:not(.me) img');
    if (img) { const n = img.closest('.hero').dataset.n; if (n) { e.stopPropagation(); open(n, e.clientX, e.clientY); return; } }
    if (!menu.contains(e.target)) close();
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  setInterval(() => { const bs = document.getElementById('bs'); if (bs) bs.classList.toggle('xmc', !!xm()); }, 1000);
})();
