// Настройки пульта. Здесь нет секретов: Client ID у Twitch публичный, адрес relay тоже.
window.PANEL_CONFIG = {
  TWITCH_CLIENT_ID: 'i2x36knagljdvhec1eu040c0c4ehq1',
  // После «wrangler deploy» впишите сюда адрес вашего Worker'а, например 'wss://rpg-farm-relay.ИМЯ.workers.dev'
  RELAY_URL: 'wss://rpg-farm-relay.phaciaa.workers.dev'
};
