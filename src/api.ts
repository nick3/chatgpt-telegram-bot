import type {
  ChatGPTAPI,
  ChatGPTUnofficialProxyAPI,
  ChatMessage as ChatResponseV4,
} from 'chatgpt';
import type {
  ChatGPTAPIBrowser,
  ChatResponse as ChatResponseV3,
} from 'chatgpt-v3';
import type {
  BingResponse
} from '@waylaidwanderer/chatgpt-api'
import { BingAIClient } from '@waylaidwanderer/chatgpt-api'
import {
  APIBrowserOptions,
  APIOfficialOptions,
  APIBingOptions,
  APIOptions,
  APIUnofficialOptions,
} from './types';
import {logWithTime} from './utils';
import Keyv from 'keyv';
import { KeyvFile } from 'keyv-file';
import {DB} from './db';

const MAX_MESSAGES_PER_CONVERSATION = -1;

class ChatGPT {
  private _messagesSent = 0;
  debug: number;
  protected apiType: string;
  protected _opts: APIOptions;
  protected _api:
    | ChatGPTAPI
    | ChatGPTAPIBrowser
    | ChatGPTUnofficialProxyAPI
    | BingAIClient
    | undefined;
  protected _apiBrowser: ChatGPTAPIBrowser | undefined;
  protected _apiOfficial: ChatGPTAPI | undefined;
  protected _apiUnofficialProxy: ChatGPTUnofficialProxyAPI | undefined;
  protected _timeoutMs: number | undefined;
  protected _bingAIClients: Record<string, {
    client: BingAIClient,
    keyv: Keyv
  }> = {};
  protected _db: DB;

  constructor(apiOpts: APIOptions, db: DB, debug = 1) {
    this.debug = debug;
    this.apiType = apiOpts.type;
    this._opts = apiOpts;
    this._timeoutMs = undefined;
    this._bingAIClients = {};
    this._db = db;
  }

  init = async () => {
    if (this._opts.type == 'browser') {
      const {ChatGPTAPIBrowser} = await import('chatgpt-v3');
      this._apiBrowser = new ChatGPTAPIBrowser(
        this._opts.browser as APIBrowserOptions
      );
      await this._apiBrowser.initSession();
      this._api = this._apiBrowser;
      this._timeoutMs = this._opts.browser?.timeoutMs;
    } else if (this._opts.type == 'official') {
      const {ChatGPTAPI} = await import('chatgpt');
      this._apiOfficial = new ChatGPTAPI(
        this._opts.official as APIOfficialOptions
      );
      this._api = this._apiOfficial;
      this._timeoutMs = this._opts.official?.timeoutMs;
    } else if (this._opts.type == 'unofficial') {
      const {ChatGPTUnofficialProxyAPI} = await import('chatgpt');
      this._apiUnofficialProxy = new ChatGPTUnofficialProxyAPI(
        this._opts.unofficial as APIUnofficialOptions
      );
      this._api = this._apiUnofficialProxy;
      this._timeoutMs = this._opts.unofficial?.timeoutMs;
    } else if (this._opts.type == 'bing') {
      this._bingAIClients = {};
      this._timeoutMs = this._opts.browser?.timeoutMs;
    } else {
      throw new RangeError('Invalid API type');
    }
    logWithTime('🔮 ChatGPT API has started...');
  };

  getApiType = () => {
      return this.apiType;
  };

  changeAPIType = async (type: 'browser' | 'official' | 'unofficial' | 'bing') => {
    this.apiType = type
    this._opts.type = type;
    await this.init();
  };

  createNewBingClient = (chatId: number) => {
    const cacheOptions = {
      // Options for the Keyv cache, see https://www.npmjs.com/package/keyv
      // This is used for storing conversations, and supports additional drivers (conversations are stored in memory by default)
      // For example, to use a JSON file (`npm i keyv-file`) as a database:
      // store: new KeyvFile({ filename: 'cache.json' }),
      store: new KeyvFile({
        filename: `cache-${chatId}.json`,
        expiredCheckDelay: 3 * 3600 * 1000,
        writeDelay: 1000,
        encode: JSON.stringify, // serialize function
        decode: JSON.parse // deserialize function
      }),
      namespace: `bing-${chatId}`,
    };
    const keyv = new Keyv(cacheOptions);
    console.log('keyv', keyv);
    const client = new BingAIClient({
      ...(this._opts.bing as APIBingOptions),
      keyv,
    });
    this._bingAIClients[`${chatId}`] = {
      client,
      keyv,
    };
    return client;
  };
  
  sendMessage = async (
    text: string,
    chatId: number,
    onProgress?: (res: ChatResponseV3 | ChatResponseV4 | BingResponse) => void
  ) => {
    if (this._opts.type !== 'bing' && !this._api) return;

    const contextDB = await this._db.getContext(chatId);

    const context = {
      conversationId: contextDB?.conversationId,
      parentMessageId: contextDB?.parentMessageId,
      jailbreakConversationId: contextDB?.jailbreakConversationId ?? true,
    };
    console.log('jbid', context.jailbreakConversationId);

    let res: ChatResponseV3 | ChatResponseV4 | BingResponse;
    if (this.apiType == 'official') {
      if (!this._apiOfficial) return;
      res = await this._apiOfficial.sendMessage(text, {
        ...context,
        onProgress,
        timeoutMs: this._timeoutMs,
      });
    } else if (this.apiType == 'bing') {
      if (this._bingAIClients[`${chatId}`]) {
        this._api = this._bingAIClients[`${chatId}`]?.client;
      } else {
        this._api = this.createNewBingClient(chatId);
      }
      try {
        res = await this._api.sendMessage(text, {
          ...context,
          toneStyle: 'creative',
          onProgress,
        });
        if (MAX_MESSAGES_PER_CONVERSATION > 0) {
          this._messagesSent++;
          if (this._messagesSent >= MAX_MESSAGES_PER_CONVERSATION) {
              // Start a new conversation with a new token
              await this.startNewBingConversation(chatId);
              this._messagesSent = 0;
          } 
        }
      } catch (error) {
        console.log(error);
        this.startNewBingConversation(chatId);
        return;
      }
    } else {
      if (!this._api) return;
      res = await this._api.sendMessage(text, {
        ...context,
        onProgress,
        timeoutMs: this._timeoutMs,
      });
    }

    let parentMessageId;
    switch (this.apiType) {
      case 'browser':
        parentMessageId = (res as ChatResponseV3).messageId;
        break;
      case 'bing':
        parentMessageId = (res as BingResponse).messageId;
        break;
      default:
        parentMessageId = (res as ChatResponseV4).id;
        break;
    }
    await this._db.updateContext(chatId, {
      conversationId: res.conversationId,
      parentMessageId,
      jailbreakConversationId: (res as BingResponse).jailbreakConversationId as string ?? true,
    });

    return res;
  };

  startNewBingConversation = async (chatId: number) => {
    await this.resetThread(chatId);
    if (this._opts.type == 'bing') {
      this._bingAIClients[`${chatId}`]?.client.conversationsCache.clear();
    }
  };
  
  resetThread = async (chatId: number) => {
    if (this._apiBrowser) {
      await this._apiBrowser.resetThread();
    }
    await this._db.clearContext(chatId);
  };

  refreshSession = async () => {
    if (this._apiBrowser) {
      await this._apiBrowser.refreshSession();
    }
  };
}

export {ChatGPT};
