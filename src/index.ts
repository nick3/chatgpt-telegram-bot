import TelegramBot from 'node-telegram-bot-api';
import {ChatGPT} from './api';
import {MessageHandler} from './handlers/message';
import {loadConfig} from './utils';
import {DB} from './db';
import schedule from 'node-schedule';
import { processDailyChatRecords } from './handlers/tasks';

async function main() {
  const opts = loadConfig();

  const db = new DB(opts.database);

  // Initialize ChatGPT API.
  const api = new ChatGPT(opts.api, db);
  await api.init();

  // Initialize Telegram Bot and message handler.
  const bot = new TelegramBot(opts.bot.token, {
    polling: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request: {proxy: opts.proxy} as any,
  });
  
  const botUsername = (await bot.getMe()).username;
  const messageHandler = new MessageHandler(bot, api, opts.bot, db, opts.debug);
  await messageHandler.init();

  bot.on('message', messageHandler.handle);
  
  // 处理群组离开事件
  bot.on('left_chat_member', (msg) => {
    const chatId = msg.chat.id;
    const username = msg.left_chat_member?.username;
    if (username && botUsername && username === botUsername) {
      db.removeGroup(chatId.toString());
    }
  });
  
  // 处理新成员加入群组事件
  bot.on('new_chat_members', (msg) => {
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members;
    newMembers?.forEach((member) => {
      const username = member.username;
      if (username && botUsername && username === botUsername) {
        db.addGroup(chatId.toString());
      }
    })
  });

  const job = schedule.scheduleJob('52 23 * * *', async () => {
    await processDailyChatRecords(db);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
