import type {ChatMessage as ChatResponseV4} from 'chatgpt';
import type {ChatResponse as ChatResponseV3} from 'chatgpt-v3';
import type {DB} from '../db';
import _ from 'lodash';
import type TelegramBot from 'node-telegram-bot-api';
import telegramifyMarkdown from 'telegramify-markdown';
import type {ChatGPT} from '../api';
import {BotOptions} from '../types';
import {logWithTime} from '../utils';
import Queue from 'promise-queue';
import { BingResponse, SourceAttributions } from '@waylaidwanderer/chatgpt-api';
import {MsEdgeTTS, OUTPUT_FORMAT} from "msedge-tts";

class ChatHandler {
  debug: number;
  protected _opts: BotOptions;
  protected _bot: TelegramBot;
  protected _api: ChatGPT;
  protected _tts: MsEdgeTTS;
  protected _n_queued = 0;
  protected _n_pending = 0;
  protected _apiRequestsQueue = new Queue(1, Infinity);
  protected _positionInQueue: Record<string, number> = {};
  protected _updatePositionQueue = new Queue(20, Infinity);

  constructor(bot: TelegramBot, api: ChatGPT, botOpts: BotOptions, debug = 1) {
    this.debug = debug;
    this._bot = bot;
    this._api = api;
    this._opts = botOpts;
    this._tts = new MsEdgeTTS();
    this._tts.setMetadata("zh-CN-XiaoxiaoNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  }

  handle = async (db: DB | null, msg: TelegramBot.Message, text: string, isMentioned: boolean, botUsername: string) => {
    if (!text) return;

    const chatId = msg.chat.id;
    if (this.debug >= 1) {
      const userInfo = `@${msg.from?.username ?? ''} (${msg.from?.id})`;
      const chatInfo =
        msg.chat.type == 'private'
          ? 'private chat'
          : `group ${msg.chat.title} (${msg.chat.id})`;
      logWithTime(`📩 Message from ${userInfo} in ${chatInfo}:\n${text}`);
    }

    db?.addChatRecord(`${chatId}`, msg.from?.username ?? '', text);

    // Check if the message is a reply to the bot's message
    const isReplyToBot = msg.reply_to_message?.from?.username === botUsername;
  
    if (msg.chat.type === 'private' || ((msg.chat.type === 'group' || msg.chat.type === 'supergroup') && (isMentioned || isReplyToBot))) {
      // Send a message to the chat acknowledging receipt of their message
      const reply = await this._bot.sendMessage(chatId, '⌛', {
        reply_to_message_id: msg.message_id,
      });

      // add to sequence queue due to chatGPT processes only one request at a time
      const requestPromise = this._apiRequestsQueue.add(() => {
        return this._sendToGpt(text, chatId, reply);
      });
      if (this._n_pending == 0) this._n_pending++;
      else this._n_queued++;
      this._positionInQueue[this._getQueueKey(chatId, reply.message_id)] =
        this._n_queued;

      await this._bot.editMessageText(
        this._n_queued > 0 ? `⌛: 您现在排在第${this._n_queued}位，稍安勿躁哦~` : '🤔',
        {
          chat_id: chatId,
          message_id: reply.message_id,
        }
      );
      await requestPromise;
    }
  };

  protected _sendToGpt = async (
    text: string,
    chatId: number,
    originalReply: TelegramBot.Message
  ) => {
    let reply = originalReply;
    await this._bot.sendChatAction(chatId, 'typing');

    // Send message to ChatGPT or Bing AI
    try {
      let res;
      let resText = '';
      const apiType = this._api.getApiType();
      if (apiType === 'bing') {
        const throt_fun = _.throttle(
          async () => {
            reply = await this._editMessage(reply, resText);
            await this._bot.sendChatAction(chatId, 'typing');
          },
          3000, 
          {leading: true, trailing: false}
        );
        res = await this._api.sendMessage(
          text,
          (token) => {
            resText += token;
            throt_fun()
          }
        )
        await this._editMessage(reply, resText, true, (res as BingResponse).details?.sourceAttributions);
      } else {
        res = await this._api.sendMessage(
          text,
          _.throttle(
            async (partialResponse: ChatResponseV3 | ChatResponseV4) => {
              const resText =
                apiType === 'browser'
                  ? (partialResponse as ChatResponseV3).response
                  : (partialResponse as ChatResponseV4).text;
              reply = await this._editMessage(reply, resText);
              await this._bot.sendChatAction(chatId, 'typing');
            },
            3000,
            {leading: true, trailing: false}
          )
        );
        resText =
          apiType === 'browser'
            ? (res as ChatResponseV3).response
            : (res as ChatResponseV4).text;
        await this._editMessage(reply, resText);
      }
      await this.sendVoice(chatId, resText);

      if (this.debug >= 1) logWithTime(`📨 Response:\n${resText}`);
    } catch (err) {
      logWithTime('⛔️ ChatGPT API error:', (err as Error).message);
      this._bot.sendMessage(
        chatId,
        "⚠️ 抱歉，我无法连接到服务器，请稍后再试。"
      );
    }

    // Update queue order after finishing current request
    await this._updateQueue(chatId, reply.message_id);
  };

  // Edit telegram message
  protected _editMessage = async (
    msg: TelegramBot.Message,
    text: string,
    needParse = true,
    sourceAttributions?: SourceAttributions
  ) => {
    if (text.trim() == '' || msg.text == text) {
      return msg;
    }
    try {
      if (sourceAttributions && sourceAttributions.length > 0) {
        const regex = /\[\^(\d+)\^\]/g;
        text = text.replace(regex, (match, p1) =>
          match + "(" + sourceAttributions[p1 - 1].seeMoreUrl + ")"
        );
      }
      text = telegramifyMarkdown(text, 'escape');
      const res = await this._bot.editMessageText(text, {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: needParse ? 'MarkdownV2' : undefined,
      });
      // type of res is boolean | Message
      if (typeof res === 'object') {
        // return a Message type instance if res is a Message type
        return res as TelegramBot.Message;
      } else {
        // return the original message if res is a boolean type
        return msg;
      }
    } catch (err) {
      logWithTime('⛔️ Edit message error:', (err as Error).message);
      if (this.debug >= 2) logWithTime('⛔️ Message text:', text);
      return msg;
    }
  };

  protected sendVoice = async (chatId: number, text: string) => {
    try {
      const filepath = await this._tts.toFile('./voice.mp3', this._removeNumberedFootnotes(text));
      await this._bot.sendVoice(chatId, filepath);
    } catch (error) {
      console.log(error);
    }
  };

  protected _removeNumberedFootnotes = (text: string) => {
    const regex = /\[\^(\d+)\^\]/g;
    return text.replace(regex, '');
  };


  protected _getQueueKey = (chatId: number, messageId: number) =>
    `${chatId}:${messageId}`;

  protected _parseQueueKey = (key: string) => {
    const [chat_id, message_id] = key.split(':');

    return {chat_id, message_id};
  };

  protected _updateQueue = async (chatId: number, messageId: number) => {
    // delete value for current request
    delete this._positionInQueue[this._getQueueKey(chatId, messageId)];
    if (this._n_queued > 0) this._n_queued--;
    else this._n_pending--;

    for (const key in this._positionInQueue) {
      const {chat_id, message_id} = this._parseQueueKey(key);
      this._positionInQueue[key]--;
      this._updatePositionQueue.add(() => {
        return this._bot.editMessageText(
          this._positionInQueue[key] > 0
            ? `⌛: You are #${this._positionInQueue[key]} in line.`
            : '🤔',
          {
            chat_id,
            message_id: Number(message_id),
          }
        );
      });
    }
  };
}

export {ChatHandler};
