// v11: события похода — всплывающая плашка с кнопкой (туман, бросок удачи, паника, слабое место, развилка, ловушка)
(function () {
  const css = `#xeBox{position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:9000;min-width:260px;max-width:92vw;background:rgba(28,22,40,.96);border:2px solid #e8b860;border-radius:14px;padding:10px 14px;color:#fff;font:600 15px/1.3 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.55);text-align:center;display:none;animation:xeIn .2s ease-out}
#xeBox .t{font-size:16px;margin-bottom:4px}#xeBox .s{font-weight:400;font-size:13px;opacity:.85;margin-bottom:8px}
#xeBox .b{display:flex;gap:8px;justify-content:center}#xeBox button{flex:1;min-height:48px;border-radius:10px;border:1px solid #c99b4a;background:linear-gradient(#7a4b22,#5a3416);color:#fff;font:700 16px system-ui,sans-serif;cursor:pointer}
#xeBox .bar{height:4px;background:#e8b860;border-radius:2px;margin-top:8px;transition:width .3s linear}@keyframes xeIn{from{opacity:0;transform:translate(-50%,20px)}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const box = document.createElement('div'); box.id = 'xeBox'; document.body.appendChild(box);
  const TXT = {
    fog: x => x.me ? ['😵 Ты в тумане', 'Жди, пока союзник тебя встряхнёт'] : ['😵 Туман в голове', `${x.u} не может бить — встряхни!`],
    luck: () => ['🎲 Бросок удачи', 'Удар ×2.2 или промах — рискнёшь?'],
    flee: x => x.me ? ['😱 Ты в панике', 'Сейчас сбежишь из похода… если не удержат'] : ['😱 Паника!', `${x.u} хочет сбежать — удержи!`],
    weak: () => ['🎯 Слабое место!', 'Успей ударить — урон ×2'],
    fork: () => ['🧭 Развилка', 'Один путь — тайник, другой — засада'],
    trap: () => ['🪤 Ловушка!', 'Прыгай, иначе поранишься']
  };
  const LBL = { встряхнуть: 'Встряхнуть', удержать: 'Удержать', рискнуть: 'Рискнуть', бей: 'Бей!', налево: '← Налево', направо: 'Направо →', прыжок: 'Прыжок!' };
  let key = '', t0 = 0, L0 = 1, sent = '';
  function fire(cmd, arg) { sent = key; box.style.display = 'none'; try { if (window.PanelActions) PanelActions.fire(cmd, arg || '', LBL[cmd] || cmd); } catch (e) {} }
  function show(x) {
    const k = x.k + ':' + x.u + ':' + (x.btn ? x.btn.join() : '');
    if (k === key && box.style.display !== 'none') return;
    if (k === sent) return; key = k; t0 = Date.now(); L0 = Math.max(1, x.left);
    const [t, s] = TXT[x.k] ? TXT[x.k](x) : [x.n, ''];
    let btns = '';
    if (x.btn) { const B = x.k === 'fork' ? x.btn.map(c => [c, '']) : [[x.btn[0], x.btn[1]]]; btns = B.map(([c, a]) => `<button data-c="${c}" data-a="${a}">${LBL[c] || c}</button>`).join(''); }
    box.innerHTML = `<div class="t">${t}</div><div class="s">${s}</div><div class="b">${btns}</div><div class="bar" style="width:100%"></div>`;
    box.querySelectorAll('button').forEach(b => b.onclick = () => fire(b.dataset.c, b.dataset.a));
    box.style.display = 'block';
  }
  setInterval(() => {
    try {
      const P = window.__panel, me = P && P.state && P.state.me, x = window.__xeMock || (me && me.xe);
      if (!x) { box.style.display = 'none'; key = ''; sent = ''; return; }
      show(x); const bar = box.querySelector('.bar'); if (bar) bar.style.width = Math.max(0, 100 - (Date.now() - t0) / (L0 * 10)) + '%';
    } catch (e) {}
  }, 300);
  window.__xeTest = x => { window.__xeMock = x; };
  // демо: ?xe=1 — по кругу показывает все события (для теста вида)
  if (/[?&]xe=1/.test(location.search)) { const D = [{ k: 'fog', u: 'Phacia', me: 0, left: 10, btn: ['встряхнуть', 'Phacia'] }, { k: 'luck', u: '', me: 1, left: 8, btn: ['рискнуть', ''] }, { k: 'flee', u: 'kioku_n', me: 0, left: 8, btn: ['удержать', 'kioku_n'] }, { k: 'weak', u: '', me: 0, left: 3, btn: ['бей', ''] }, { k: 'fork', u: '', me: 0, left: 12, btn: ['налево', 'направо'] }, { k: 'trap', u: '', me: 0, left: 6, btn: ['прыжок', ''] }];
    let i = 0; const nx = () => { window.__xeMock = Object.assign({}, D[i++ % D.length]); setTimeout(() => { window.__xeMock = null; setTimeout(nx, 1500); }, 6000); }; setTimeout(nx, 2500);
    const f0 = () => { if (window.PanelActions && !PanelActions.__xeWrap) { const o = PanelActions.fire; PanelActions.fire = (c, a, l) => /^(встряхнуть|удержать|рискнуть|бей|налево|направо|прыжок)$/.test(c) ? (window.__xeMock = null) : o.call(PanelActions, c, a, l); PanelActions.__xeWrap = 1; } else setTimeout(f0, 500); }; f0(); }
})();
