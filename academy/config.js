// Настройки сайта Академии. Здесь нет секретов: Client ID у Twitch публичный, адрес relay тоже.
window.PANEL_CONFIG = {
  TWITCH_CLIENT_ID: 'i2x36knagljdvhec1eu040c0c4ehq1',
  // После «npx wrangler deploy» в папке relay впишите сюда адрес Worker'а, например 'wss://academy-relay.ИМЯ.workers.dev'
  RELAY_URL: 'wss://academy-relay.phaciaa.workers.dev'
};
