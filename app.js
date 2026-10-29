(function(){
  const G = window.COMMAND_GROUPS, main = document.getElementById('list'), nav = document.getElementById('nav'), q = document.getElementById('q');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  nav.innerHTML = G.map(g => `<a href="#${g.id}">${g.icon} ${esc(g.title)}</a>`).join('');
  function render(f){
    f = (f || '').trim().toLowerCase(); let n = 0;
    main.innerHTML = G.map(g => {
      const it = g.items.filter(i => !f || (i.cmd + ' ' + i.desc + ' ' + g.title).toLowerCase().includes(f)); n += it.length; if (!it.length) return '';
      return `<section id="${g.id}"><h2>${g.icon} ${esc(g.title)}</h2>${g.note ? `<p class="note">${esc(g.note)}</p>` : ''}<div class="grid">` +
        it.map(i => `<div class="card"><div class="cmd">${esc(i.cmd)}${i.arg ? ` <i>[${esc(i.arg)}]</i>` : ''}</div><div class="desc">${esc(i.desc)}</div><button data-c="${esc(i.cmd)}">Скопировать команду</button></div>`).join('') + '</div></section>';
    }).join('') || '<p class="empty">Ничего не найдено. Попробуйте другое слово.</p>';
    return n;
  }
  function copy(t){ if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t); const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } finally { a.remove(); } return Promise.resolve(); }
  main.addEventListener('click', e => { const b = e.target.closest('button[data-c]'); if (!b) return; copy(b.dataset.c).then(() => { b.textContent = 'Скопировано: ' + b.dataset.c; b.classList.add('done'); setTimeout(() => { b.textContent = 'Скопировать команду'; b.classList.remove('done'); }, 1800); }); });
  q.addEventListener('input', () => render(q.value));
  window.__render = render; render('');
})();
