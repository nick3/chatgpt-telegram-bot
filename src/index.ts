import TelegramBot from 'node-telegram-bot-api';
import {ChatGPT} from './api';
import {MessageHandler} from './handlers/message';
import {loadConfig} from './utils';
import {DB} from './db'; // 引入InMemoryDatabase类

async function main() {
  const opts = loadConfig();

  const db = new DB(); // 在main函数里对InMemoryDatabase进行实例化

  // Initialize ChatGPT API.
  const api = new ChatGPT(opts.api);
  await api.init();

  // Initialize Telegram Bot and message handler.
  const bot = new TelegramBot(opts.bot.token, {
    polling: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request: {proxy: opts.proxy} as any,
  });
  const messageHandler = new MessageHandler(db, bot, api, opts.bot, opts.debug);
  await messageHandler.init();

  bot.on('message', messageHandler.handle);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
