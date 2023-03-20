import type TelegramBot from 'node-telegram-bot-api';
import type {ChatGPT} from '../api';
import {BotOptions} from '../types';
import {logWithTime} from '../utils';

class CommandHandler {
  debug: number;
  protected _opts: BotOptions;
  protected _bot: TelegramBot;
  protected _api: ChatGPT;

  constructor(bot: TelegramBot, api: ChatGPT, botOpts: BotOptions, debug = 1) {
    this.debug = debug;
    this._bot = bot;
    this._api = api;
    this._opts = botOpts;
  }

  handle = async (
    msg: TelegramBot.Message,
    command: string,
    isMentioned: boolean,
    botUsername: string
  ) => {
    const userInfo = `@${msg.from?.username ?? ''} (${msg.from?.id})`;
    const chatInfo =
      msg.chat.type == 'private'
        ? 'private chat'
        : `group ${msg.chat.title} (${msg.chat.id})`;
    if (this.debug >= 1) {
      logWithTime(
        `👨‍💻️ User ${userInfo} issued command "${command}" in ${chatInfo} (isMentioned=${isMentioned}).`
      );
    }

    // Ignore commands without mention in groups.
    if (msg.chat.type != 'private' && !isMentioned) return;

    switch (command) {
      case '/help':
        await this._bot.sendMessage(
          msg.chat.id,
          '与我聊天，您可以：\n' +
            '  • 直接发送消息（群组中不支持）📩\n' +
            `  • 在群组中 @${botUsername} 并发送消息\n` +
            '  • 回复我的上一条消息💬\n\n' +
            '命令列表：\n' +
            `(在群组中使用命令时，请确保在命令后加上提及，例如 /help@${botUsername}）。\n` +
            '  • /help 显示帮助信息。🆘\n' +
            '  • /reset 重置当前聊天线程并开始新的聊天。🔄\n' +
            '  • /reload (需要管理员权限) 刷新ChatGPT会话。🔁'
        );
        break;

      case '/reset':
        await this._bot.sendChatAction(msg.chat.id, 'typing');
        await this._api.resetThread();
        await this._bot.sendMessage(
          msg.chat.id,
          '🔄 聊天线程已重置。新的聊天线程已开始。'
        );
        logWithTime(`🔄 Chat thread reset by ${userInfo}.`);
        break;

      case '/reload':
        if (this._opts.userIds.indexOf(msg.from?.id ?? 0) == -1) {
          await this._bot.sendMessage(
            msg.chat.id,
            '⛔️ 抱歉，您没有权限执行此命令。'
          );
          logWithTime(
            `⚠️ Permission denied for "${command}" from ${userInfo}.`
          );
        } else {
          await this._bot.sendChatAction(msg.chat.id, 'typing');
          await this._api.refreshSession();
          await this._bot.sendMessage(msg.chat.id, '🔄 会话已刷新。');
          logWithTime(`🔄 Session refreshed by ${userInfo}.`);
        }
        break;
      case '/mode':
        const options = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'ChatGPT',
                  callback_data: 'chatgpt',
                },
                {
                  text: 'Bing AI',
                  callback_data: 'bing',
                },
              ],
            ],
          },
        };
        this._bot.sendMessage(
          msg.chat.id,
          '请选择您想要使用的AI引擎：',
          options
        ).then(() => {
          this._bot.on('callback_query', async (callbackQuery) => {
            if (callbackQuery.data === 'chatgpt') {
              await this._api.changeAPIType('official');
              await this._bot.sendMessage(
                msg.chat.id,
                '已切换至ChatGPT引擎。'
              );
            } else if (callbackQuery.data === 'bing') {
              await this._api.changeAPIType('bing');
              await this._bot.sendMessage(
                msg.chat.id,
                '已切换至Bing AI引擎。'
              );
            }
          });
        });
        break;
      default:
        await this._bot.sendMessage(
          msg.chat.id,
          '⚠️ 不支持的命令。运行 /help 查看使用方法。'
        );
        break;
    }
  };
}

export {CommandHandler};
