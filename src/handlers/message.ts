import type TelegramBot from 'node-telegram-bot-api';
import type {ChatGPT} from '../api';
import type {DB} from '../db';
import type {BotOptions} from '../types';
import {logWithTime} from '../utils';
import {Authenticator} from './authentication';
import {ChatHandler} from './chat';
import {CommandHandler} from './command';

export enum MessageType {
  COMMAND = 0,
  REPLY = 1,
  FORWARD = 2,
  NORMAL = 3,
}
class MessageHandler {
  debug: number;
  protected _opts: BotOptions;
  protected _bot: TelegramBot;
  protected _botUsername = '';
  protected _api: ChatGPT;
  protected _db: DB;
  protected _authenticator: Authenticator;
  protected _commandHandler: CommandHandler;
  protected _chatHandler: ChatHandler;

  constructor(
    bot: TelegramBot,
    api: ChatGPT,
    botOpts: BotOptions,
    db: DB,
    debug = 1
  ) {
    this.debug = debug;
    this._bot = bot;
    this._api = api;
    this._opts = botOpts;
    this._authenticator = new Authenticator(bot, botOpts, debug);
    this._commandHandler = new CommandHandler(bot, api, botOpts, debug);
    this._db = db;
    this._chatHandler = new ChatHandler(bot, api, botOpts, db, debug);
  }

  init = async () => {
    this._botUsername = (await this._bot.getMe()).username ?? '';
    logWithTime(`🤖 Bot @${this._botUsername} has started...`);
  };

  recordMessage = (msg: TelegramBot.Message, text: string, isCommand: boolean, command?: string) => {
    let msgType = MessageType.NORMAL
    let message = text;
    if (isCommand) {
      msgType = MessageType.COMMAND;
      message = `${command} ${text}`;
    }
    if (msg.chat.type === 'private') {
      const {id, username, first_name, last_name} = msg.from ?? {};
      this._db.addChatRecord((id ?? '').toString(), (id ?? '').toString(), username, first_name, last_name, message, msg.message_id.toString(), msgType, false);
    } else if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      const {id, username, first_name, last_name} = msg.from ?? {};
      const chatId = msg.chat.id.toString();
      this._db.addChatRecord(chatId, (id ?? '').toString(), username, first_name, last_name, message, msg.message_id.toString(), msgType, true);
    }
  }

  handle = async (msg: TelegramBot.Message) => {
    if (this.debug >= 2) logWithTime(msg);

    // Authentication.
    if (!(await this._authenticator.authenticate(msg))) return;

    // Parse message.
    const {text, command, isMentioned} = this._parseMessage(msg);

    let reply;
    
    if (command != '' && command != this._opts.chatCmd) {
      this.recordMessage(msg, text, true, command);
      // For commands except `${chatCmd}`, pass the request to commandHandler.
      reply = await this._commandHandler.handle(
        this._db,
        msg,
        command,
        isMentioned,
        this._botUsername,
        this._chatHandler
      );
      if (reply) {
        this.recordMessage(reply, reply.text ?? '', true, '');
      }
    } else {
      this.recordMessage(msg, text, false);
      // Handles:
      // - direct messages in private chats
      // - replied messages in both private chats and group chats
      // - messages that start with `chatCmd` in private chats and group chats
      reply = await this._chatHandler.handle(this._db, msg, text, isMentioned, this._botUsername);
    }
  };

  protected _parseMessage = (msg: TelegramBot.Message) => {
    let text = msg.text ?? '';
    let command = '';
    let isMentioned = false;
    console.log(msg)
    if ('entities' in msg) {
      // May have bot commands.
      const regMention = new RegExp(`@${this._botUsername}$`);
      for (const entity of msg.entities ?? []) {
        switch (entity.type) {
          case 'bot_command':
            if (entity.offset == 0) {
              text = msg.text?.slice(entity.length).trim() ?? '';
              command = msg.text?.slice(0, entity.length) ?? '';
              isMentioned = regMention.test(command);
              command = command.replace(regMention, ''); // Remove the mention.
            }
            break;
          // Add other entity.type cases here
          case 'mention':
            // Handle mention entity type
            if (msg.text) {
              if (text.includes(`@${this._botUsername}`)) {
                isMentioned = true;
              }
              const { offset, length } = entity;   
              text = msg.text;
              text = (text.slice(0, offset) + text.slice(offset + length)).trim();
              if (msg.reply_to_message) {
                const { forward_from, from, text: replyOriginText } = msg.reply_to_message;
                let first_name: string | undefined = '';
                let last_name: string | undefined = '';
                if (forward_from) {
                  first_name = forward_from.first_name
                  last_name = forward_from.last_name
                } else {
                  first_name = from?.first_name
                  last_name = from?.last_name
                }
                text = `${first_name ?? ''}${last_name ?? ''}刚刚说：“${replyOriginText}”\n\n${text}`;
              }
            } else {
              text = ''
            }
            break;

          case 'hashtag':
            // Handle hashtag entity type
            break;

          case 'url':
            // Handle url entity type
            break;

          // Add more cases for other entity types if needed

          // ...

          default:
            break;
        }
      }
    }
    return {text, command, isMentioned};
  };
}

export {MessageHandler};

