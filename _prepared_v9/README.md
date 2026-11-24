# v9 — механики гильдий (заготовка, НЕ подключено)

Ветка `guilds-v9`. На сайте (main) ничего не меняется, пока ветку не сольют.

## Что внутри
- `game/game.js` — текущая игра + блок «v9: МЕХАНИКИ ГИЛЬДИЙ». Без `guildsV9.enabled: true` в config.js всё выключено.
- `game/assets.js` — пути к картинкам мини-боссов и иконкам.
- `game/assets/monsters/guild_*.png` — мини-боссы (смотрят влево, как остальные мобы).
- `game/assets/icons/guild/*.png` — корона ГМ, медаль, казна, урна, 4 знамени.
- `config_guildsV9.js.txt` — блок настроек для config.js.
- `relay/core.js` — белый список команд ретранслятора + !голос, !гм, !наградить, !казна, !бафф, !гильдпоход (и !погладить, !котик).
- `streamerbot/StreamerBot_v9_chat_forward.cs` — список CMDS с новыми командами.
- Пульт (в этой ветке): `actions.js` — меню «Гильдия», `img/g9/*` — иконки, `panel.js` — демо `?mock=1&g9=1`.

## Как включить
1. Скопировать `game/*` в папку игры (с заменой), вставить блок из `config_guildsV9.js.txt` в config.js.
2. Залить `relay/core.js` в Cloudflare Worker (`npx wrangler deploy`).
3. В Streamer.bot заменить список CMDS.
4. Слить ветку `guilds-v9` в `main` (сайт).
