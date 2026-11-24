// Пульт зрителя, шаги 2–3 — логика relay (просмотр + кнопки-действия v7panel3). Общая для Cloudflare Durable Object (worker.js) и тестового node-сервера (devserver.mjs).
// Протокол:
//  игра  → /game   : 1-е сообщение {type:'hello', key}  (ключ — секрет GAME_KEY в Cloudflare, не в коде), дальше {type:'snap', d:{...}} ~1 раз/с
//  зритель → /viewer: 1-е сообщение {type:'auth', token} (Twitch-токен). Relay проверяет его через id.twitch.tv/oauth2/validate.
//  relay → зритель: {type:'state', online:true, t, locs, boss, me} — me только СВОЙ герой (по login из Twitch), чужих не отдаём
//                   {type:'offline'} — игра не подключена («Стрим не идёт»)
//  v7panel3 — кнопки-действия:
//   зритель → relay: {type:'cmd', id, cmd, arg}   (ника в сообщении НЕТ — relay берёт login из проверенного Twitch-токена)
//   relay → игра:    {type:'cmd', rid, login, user_id, cmd, arg}  — только команды из белого списка CMD_RULES, с rate limit
//   игра → relay:    {type:'cmd-res', rid, ok, msg, code}  → relay → тому же зрителю {type:'cmd-res', id, ok, msg, code}
export const LIMITS = {
  authTimeoutMs: 8000,      // не прислал auth/hello — закрываем
  viewerMsgPer10s: 15,      // больше — закрываем (спам)
  cmdMinGapMs: 1500,        // кнопка пульта: не чаще 1 команды в 1,5 с на зрителя (Twitch user_id)
  cmdPerMin: 12,            // и не больше 12 команд в минуту
  cmdTimeoutMs: 8000,       // игра не ответила — зрителю «нет ответа»
  maxPending: 500,
  perUser: 4,               // соединений на один Twitch user_id
  perIp: 60,                // соединений с одного IP
  staleMs: 150 * 1000,      // зритель молчит дольше (пульт пингует каждые 20 с) — соединение мёртвое, освобождаем место
  maxViewers: 2000,
  sendEveryMs: 1000,        // не чаще 1 снимка в секунду на зрителя
  maxSnapBytes: 256 * 1024, // больше — снимок игры отбрасываем
  gameMsgPer10s: 40,
  revalidateMs: 3600 * 1000 // перепроверка токена раз в час (требование Twitch)
};
// Белый список команд пульта: arg — 'none' (без аргумента) | 'opt' | 'req'; re — допустимый аргумент
const ARG = /^[0-9a-zа-яё_\- ]{1,40}$/i;
export const CMD_RULES = {
  'поход': { arg: 'none' }, 'пати': { arg: 'none' }, 'огород': { arg: 'none' }, 'готовить': { arg: 'opt' }, 'продать': { arg: 'req' },
  'квест': { arg: 'opt', re: /^[1-9]$/ }, 'вклад': { arg: 'req' }, 'титул': { arg: 'opt', re: /^([1-9]|[12][0-9]|снять)$/ },
  'парикмахер': { arg: 'opt' }, 'купить': { arg: 'opt' }, 'экип': { arg: 'req' }, 'снять': { arg: 'req' },
  'гильдия': { arg: 'req', re: /^[1-4]$|^[a-z]{2,10}$/ }, 'вступить': { arg: 'opt' }, 'да': { arg: 'none' }, 'нет': { arg: 'none' },
  'ход': { arg: 'none' }, 'босс': { arg: 'none' }, 'удар': { arg: 'none' }, 'лечить': { arg: 'none' }, 'оглушить': { arg: 'none' }, 'связать': { arg: 'none' },
  'очистить': { arg: 'none' }, 'замедлить': { arg: 'none' }, 'заслон': { arg: 'none' }, 'воскресить': { arg: 'none' },
  'семена': { arg: 'none' }, 'посадить': { arg: 'none' }, 'грядка': { arg: 'none' }, 'жуки': { arg: 'none' }, 'собрать': { arg: 'none' },
  'магия': { arg: 'none' }, 'обмен': { arg: 'none' }, 'урожай': { arg: 'none' }, 'салат': { arg: 'none' },
  'погладить': { arg: 'opt' }, 'котик': { arg: 'none' }, // v8.7: пёсик и котик
  'голос': { arg: 'opt' }, 'гм': { arg: 'none' }, 'наградить': { arg: 'req' }, 'казна': { arg: 'opt' }, 'бафф': { arg: 'opt', re: /^[1-9]$/ }, 'гильдпоход': { arg: 'none' } // v9: механики гильдий
};
export function checkCmd(cmd, arg) {
  if (typeof cmd !== 'string' || !Object.prototype.hasOwnProperty.call(CMD_RULES, cmd)) return 'not-allowed';
  const r = CMD_RULES[cmd]; arg = arg == null ? '' : arg;
  if (typeof arg !== 'string') return 'bad-arg';
  arg = arg.trim();
  if (!arg) return r.arg === 'req' ? 'bad-arg' : null;
  if (r.arg === 'none' || !ARG.test(arg) || (r.re && !r.re.test(arg))) return 'bad-arg';
  return null;
}
const VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';

export class RelayCore {
  constructor(o) {
    this.clientId = o.clientId; this.gameKey = o.gameKey || '';
    this.fetch = o.fetch; this.validateUrl = o.validateUrl || VALIDATE_URL; // validateUrl меняется только в локальных тестах (мок Twitch)
    this.now = o.now || (() => Date.now());
    this.origins = (o.allowedOrigins || '').split(',').map(s => s.trim()).filter(Boolean);
    this.L = Object.assign({}, LIMITS, o.limits || {});
    this.game = null; this.snap = null; this.snapAt = 0; this.viewers = new Set(); this.tokCache = new Map();
    this.pending = new Map(); this.cmdLog = new Map(); this.rid = 0; // rid → {v, id, timer}; user_id → [время команд]
  }
  originOk(origin) { return !this.origins.length || this.origins.includes(origin || ''); }
  // --- проверка Twitch-токена (мокается в тестах через o.fetch) ---
  async validate(token) {
    if (typeof token !== 'string' || token.length < 10 || token.length > 200) return null;
    const c = this.tokCache.get(token); if (c && c.until > this.now()) return c.who;
    let r; try { r = await this.fetch(this.validateUrl, { headers: { Authorization: 'OAuth ' + token } }); } catch (e) { return null; }
    if (!r || r.status !== 200) return null;
    let j; try { j = await r.json(); } catch (e) { return null; }
    if (!j || j.client_id !== this.clientId || !j.login || !j.user_id) return null; // токен чужого приложения не принимаем
    const who = { login: String(j.login).toLowerCase(), user_id: String(j.user_id) };
    if (this.tokCache.size > 5000) this.tokCache.clear();
    this.tokCache.set(token, { who, until: this.now() + Math.min(this.L.revalidateMs, (j.expires_in || 3600) * 1000) });
    return who;
  }
  // --- игра ---
  gameConnect(sock) {
    const g = { sock, ok: false, msgs: [], timer: setTimeout(() => { if (!g.ok) sock.close(4001, 'no hello'); }, this.L.authTimeoutMs) };
    return {
      message: raw => {
        const t = this.now(); g.msgs = g.msgs.filter(x => t - x < 10000); g.msgs.push(t);
        if (g.msgs.length > this.L.gameMsgPer10s) return; // лишние снимки просто пропускаем
        if (typeof raw !== 'string' || raw.length > this.L.maxSnapBytes) return;
        let m; try { m = JSON.parse(raw); } catch (e) { return; }
        if (!g.ok) {
          if (m.type !== 'hello' || !this.gameKey || !safeEq(String(m.key || ''), this.gameKey)) { sock.close(4003, 'bad key'); return; }
          g.ok = true; clearTimeout(g.timer);
          if (this.game && this.game !== g) try { this.game.sock.close(4009, 'replaced'); } catch (e) {}
          this.game = g; sock.send(JSON.stringify({ type: 'hello-ok' })); return;
        }
        if (m.type === 'snap' && m.d && typeof m.d === 'object') { this.snap = m.d; this.snapAt = t; this.broadcast(); }
        else if (m.type === 'cmd-res' && typeof m.rid === 'string') { // ответ игры идёт только тому зрителю, кто нажал
          const p = this.pending.get(m.rid); if (!p) return; this.pending.delete(m.rid); clearTimeout(p.timer);
          this.reply(p.v, p.id, !!m.ok, String(m.msg == null ? '' : m.msg).slice(0, 300), typeof m.code === 'string' ? m.code.slice(0, 20) : null);
        }
      },
      close: () => { clearTimeout(g.timer); if (this.game === g) { this.game = null; this.snap = null; this.pending.forEach(p => { clearTimeout(p.timer); this.reply(p.v, p.id, false, 'игра отключилась', 'offline'); }); this.pending.clear(); this.viewers.forEach(v => v.ok && this.sendOffline(v)); } }
    };
  }
  // --- зритель ---
  sweepStale() { const t = this.now(); [...this.viewers].forEach(v => { if (t - (v.seen || 0) > this.L.staleMs) { try { v.sock.close(4000, 'stale'); } catch (e) {} this.drop(v); } }); }
  viewerConnect(sock, ip, origin) {
    this.sweepStale();
    if (!this.originOk(origin)) { sock.close(4004, 'origin'); return { message() {}, close() {} }; }
    if (this.viewers.size >= this.L.maxViewers) { sock.close(4029, 'full'); return { message() {}, close() {} }; }
    let ipN = 0; this.viewers.forEach(x => { if (x.ip === ip) ipN++; });
    if (ipN >= this.L.perIp) { sock.close(4029, 'too many from ip'); return { message() {}, close() {} }; }
    const v = { seen: this.now(), sock, ip, ok: false, who: null, msgs: [], lastSend: 0, pending: null, token: null, checkedAt: 0 };
    v.timer = setTimeout(() => { if (!v.ok) sock.close(4001, 'no auth'); }, this.L.authTimeoutMs);
    this.viewers.add(v);
    return {
      message: async raw => {
        const t = this.now(); v.seen = t; v.msgs = v.msgs.filter(x => t - x < 10000); v.msgs.push(t);
        if (v.msgs.length > this.L.viewerMsgPer10s) { sock.close(4029, 'rate'); this.drop(v); return; }
        if (typeof raw !== 'string' || raw.length > 1000) return;
        let m; try { m = JSON.parse(raw); } catch (e) { return; }
        if (m.type === 'ping') { sock.send('{"type":"pong"}'); return; }
        if (m.type === 'cmd') { if (v.ok) this.viewerCmd(v, m); else this.reply(v, m.id, false, 'сначала войдите через Twitch', 'no-auth'); return; }
        if (m.type !== 'auth' || v.ok || v.authing) return;
        v.authing = true; const who = await this.validate(m.token); v.authing = false;
        if (!who) { sock.send(JSON.stringify({ type: 'error', code: 'bad-token' })); sock.close(4003, 'bad token'); this.drop(v); return; }
        // лимит вкладок: новая вкладка всегда пускается, а самую «старую» (дольше всех молчавшую — чаще всего это мёртвое соединение после сна/смены сети) отключаем
        const mine = [...this.viewers].filter(x => x !== v && x.ok && x.who.user_id === who.user_id).sort((a, b) => a.seen - b.seen);
        while (mine.length >= this.L.perUser) { const o = mine.shift(); try { o.sock.send(JSON.stringify({ type: 'error', code: 'too-many' })); o.sock.close(4010, 'replaced by newer tab'); } catch (e) {} this.drop(o); }
        v.ok = true; v.who = who; v.token = m.token; v.checkedAt = t; clearTimeout(v.timer);
        sock.send(JSON.stringify({ type: 'hello', login: who.login, user_id: who.user_id }));
        if (this.snap) this.sendState(v, true); else this.sendOffline(v);
      },
      close: () => this.drop(v)
    };
  }
  drop(v) { clearTimeout(v.timer); clearTimeout(v.pending); this.viewers.delete(v); }
  reply(v, id, ok, msg, code) { try { v.sock.send(JSON.stringify({ type: 'cmd-res', id: typeof id === 'string' || typeof id === 'number' ? String(id).slice(0, 40) : null, ok, msg, code: code || null })); } catch (e) {} }
  // кнопка пульта: проверка белого списка и лимитов, ник — ТОЛЬКО из токена (v.who), всё, что прислал клиент про ник, игнорируется
  viewerCmd(v, m) {
    const t = this.now(), err = checkCmd(m.cmd, m.arg);
    if (err) return this.reply(v, m.id, false, err === 'not-allowed' ? 'такой команды нет в пульте' : 'неверный выбор', err);
    const k = v.who.user_id, log = (this.cmdLog.get(k) || []).filter(x => t - x < 60000);
    if (log.length && t - log[log.length - 1] < this.L.cmdMinGapMs) { this.cmdLog.set(k, log); return this.reply(v, m.id, false, 'слишком часто — подождите секунду', 'rate'); }
    if (log.length >= this.L.cmdPerMin) { this.cmdLog.set(k, log); return this.reply(v, m.id, false, 'лимит: не больше ' + this.L.cmdPerMin + ' нажатий в минуту', 'rate'); }
    if (!this.game || !this.snap) return this.reply(v, m.id, false, 'стрим не идёт — игра не подключена', 'offline');
    if (this.access(v) === 'off') return this.reply(v, m.id, false, 'Стрим не идёт — кнопки заработают, когда начнётся трансляция', 'not-live'); // v7panel37
    if (this.pending.size >= this.L.maxPending) return this.reply(v, m.id, false, 'сервер занят, попробуйте позже', 'busy');
    log.push(t); this.cmdLog.set(k, log); if (this.cmdLog.size > 20000) this.cmdLog.clear();
    const rid = (++this.rid).toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const p = { v, id: m.id, timer: setTimeout(() => { if (this.pending.delete(rid)) this.reply(v, m.id, false, 'игра не ответила', 'timeout'); }, this.L.cmdTimeoutMs) };
    this.pending.set(rid, p);
    try { this.game.sock.send(JSON.stringify({ type: 'cmd', rid, login: v.who.login, user_id: v.who.user_id, cmd: m.cmd, arg: typeof m.arg === 'string' ? m.arg.trim() : '' })); }
    catch (e) { this.pending.delete(rid); clearTimeout(p.timer); this.reply(v, m.id, false, 'нет связи с игрой', 'offline'); }
  }
  // что видит зритель: общее (кто где) + только свой герой
  // v7panel37: доступ к кнопкам. Снимок без поля live (старая игра) — как раньше ('on').
  // live:true — 'on' для всех; live:false + test + зритель = владелец канала (snap.owner) — 'test'; иначе 'off'.
  access(v) {
    const s = this.snap; if (!s) return 'off'; if (s.live === undefined) return 'on'; if (s.live) return 'on';
    const own = typeof s.owner === 'string' ? s.owner.toLowerCase() : '';
    return s.test && own && v.who && String(v.who.login || '').toLowerCase() === own ? 'test' : 'off';
  }
  viewFor(v) {
    const s = this.snap || {}, me = (s.heroes || {})[v.who.login] || null;
    const o = { type: 'state', online: true, t: s.t || this.snapAt, locs: s.locs || {}, boss: s.boss || null, cam: s.cam || null, ref: s.ref || null, me };
    if (s.live !== undefined) { const a = this.access(v); o.live = !!s.live; o.test = a === 'test'; o.stream = a !== 'off'; if (o.ref && typeof o.ref === 'object') o.ref = Object.assign({}, o.ref, { stream: a !== 'off' }); } // v7panel37 (owner/test зрителям не отдаём)
    return o;
  }
  sendOffline(v) { try { v.sock.send(JSON.stringify({ type: 'offline', lastAt: this.snapAt || 0 })); } catch (e) {} }
  sendState(v, force) {
    const t = this.now(), wait = this.L.sendEveryMs - (t - v.lastSend);
    if (!force && wait > 0) { if (!v.pending) v.pending = setTimeout(() => { v.pending = null; if (this.snap && this.viewers.has(v)) this.sendState(v, true); }, wait); return; }
    v.lastSend = t;
    // перепроверка токена раз в час
    if (t - v.checkedAt > this.L.revalidateMs) { v.checkedAt = t; this.tokCache.delete(v.token); this.validate(v.token).then(w => { if (!w || w.user_id !== v.who.user_id) { try { v.sock.close(4003, 'token expired'); } catch (e) {} this.drop(v); } }); }
    try { v.sock.send(JSON.stringify(this.viewFor(v))); } catch (e) { this.drop(v); }
  }
  broadcast() { this.viewers.forEach(v => { if (v.ok) this.sendState(v); }); }
  stats() { return { game: !!this.game, viewers: this.viewers.size, authed: [...this.viewers].filter(v => v.ok).length }; }
}
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
