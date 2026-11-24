// v8.5: «Что нового» — список обновлений для зрителей. Новые записи добавляются В НАЧАЛО списка (id — уникальный).
// Показывается на пульте (блок над вкладками) и на большом экране (кнопка «🆕 Что нового»). Непрочитанное подсвечивается (localStorage).
(function () {
  const NEWS = [
    { id: 'h8', d: '24.11', t: 'Новые герои', l: [
      'Все классы перерисованы в едином мультяшном стиле, в цветах своей гильдии.',
      'Цирюльник: мужским героям можно отрастить или сбрить бороду — кнопка у парикмахера или <b>!парикмахер борода</b>. Борода в цвет волос.',
      'На большом экране все герои стоят, а тень лежит прямо под ногами.',
      'На стриме в лесу и у босса герои стали крупнее, в бою все смотрят вправо.',
      'Большой экран: «Цель стрима» и «Задания» можно свернуть, задания листаются, локации и кнопки — в одну строку внизу.',
      'Большой экран: на телефоне листается окно кузницы; у босса больше не видно героев из похода.'
    ] },
    { id: 'bs530', d: '23.11', t: 'Напоминание о ходе', l: [
      'Пульт напоминает о награде «Сделать ход» за баллы канала.'
    ] }
  ];
  const KEY = 'rpgNewsSeen';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const seen = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const unseen = () => NEWS.length && seen() !== NEWS[0].id;
  function markSeen() { try { if (NEWS.length) localStorage.setItem(KEY, NEWS[0].id); } catch (e) {} paint(); }
  // текст записей — свой, поэтому <b> в строках разрешён; заголовки экранируются
  function html(max) {
    const last = seen(); let old = false;
    return NEWS.slice(0, max || NEWS.length).map(n => { if (n.id === last) old = true;
      return `<div class="news-it${old ? '' : ' new'}"><div class="news-h"><span class="news-d">${esc(n.d)}</span> ${esc(n.t)}${old ? '' : ' <span class="news-new">новое</span>'}</div><ul>${n.l.map(x => '<li>' + x + '</li>').join('')}</ul></div>`; }).join('');
  }
  // пульт: блок над вкладками
  function paint() {
    const el = document.getElementById('news'); if (!el) return;
    const open = el.querySelector('details') && el.querySelector('details').open;
    el.innerHTML = `<details${open ? ' open' : ''}><summary>🆕 Что нового${unseen() ? ' <span class="news-dot">новое</span>' : ''}</summary><div class="news-body">${html(5)}</div></details>`;
    el.querySelector('details').addEventListener('toggle', e => { if (e.target.open && unseen()) setTimeout(markSeen, 1500); });
  }
  window.RPGNews = { html, unseen, markSeen, list: NEWS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
})();
