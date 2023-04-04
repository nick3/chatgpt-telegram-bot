import { SupabaseClient, createClient } from "@supabase/supabase-js";
import type { DBOptions } from './types';
import { MessageType } from './handlers/message';
import {open, RootDatabase} from 'lmdb';
import {logWithTime} from './utils';

interface ContextObject {
  conversationId?: string;
  parentMessageId?: string;
  jailbreakConversationId?: string;
}

type Context = ContextObject | undefined;

class DB {
  protected _db: RootDatabase;
  protected supabase: SupabaseClient;

  constructor(dbConfig: DBOptions) {
    this._db = open({
      path: 'database',
      compression: true,
    });
    this.supabase = createClient(dbConfig.supabaseUrl, dbConfig.supabaseKey);
  }

  // 添加聊天记录
  async addChatRecord(chatId: string, userId: string, username: string | undefined, firstName: string | undefined, lastName: string | undefined, message: string, messageId: string, type: MessageType, isInGroup: boolean): Promise<void> {
    const { data, error } = await this.supabase
      .from('chat_records')
      .insert([
        {
          chat_id: chatId,
          user_id: userId,
          username,
          first_name: firstName,
          last_name: lastName,
          message,
          message_id: messageId,
          type,
          is_in_group: isInGroup
        },
      ]);
    if (error) {
      console.error(error);
      return undefined;
    }
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async getGroups(): Promise<string[] | null> {
    const { data: groups, error } = await this.supabase
      .from('groups')
      .select('group_id');
    if (error) {
      console.error(error);
      return null;
    }
    return groups.map((group) => group.group_id);
  }

  async addGroup(groupId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('groups')
      .insert([
        {
          group_id: groupId,
        },
      ]);
    if (error) {
      console.error(error);
      return undefined;
    }
  }

  async removeGroup(groupId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('groups')
      .delete()
      .eq('group_id', groupId);
    if (error) {
      console.error(error);
      return undefined;
    }
  }

  // 获取聊天记录
  async getChatRecords(chatId: string): Promise<{username: string, message: string}[] | undefined> {
    const { data, error } = await this.supabase
      .from('chat_records')
      .select('username, message')
      .eq('chat_id', chatId);
    if (error) {
      console.error(error);
      return undefined;
    }
    return data;
  }

  // 清除聊天记录
  async clearChatRecords(chatId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('chat_records')
      .delete()
      .eq('chat_id', chatId);
    if (error) {
      console.error(error);
    }
  }

  // 将聊天记录按照每行一段“用户名：聊天内容”进行字符串拼接
  async serializeChatRecords(chatId: string, timeRange: {start: Date, end: Date}): Promise<string> {
    const start = new Date(timeRange.start.getTime() + timeRange.start.getTimezoneOffset() * 60 * 1000);
    const end = new Date(timeRange.end.getTime() + timeRange.end.getTimezoneOffset() * 60 * 1000);
    const { data, error } = await this.supabase
      .from('chat_records')
      .select('username, first_name, last_name, message')
      .eq('chat_id', chatId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .neq('type', MessageType.COMMAND);
    if (error) {
      console.error(error);
      return '';
    }
    let result = '';
    for (const record of data) {
      const { username, first_name, last_name } = record;
      let name = '';
      if (first_name && first_name.length > 0) {
        name = first_name;
      }
      if (last_name && last_name.length > 0) {
        name += last_name;
      }
      if (username && name.length === 0) {
        name = username;
      }
      result += `${name}说:“${record.message}”\n`;
    }
    return result;
  }

  getContext = (chatId: number): Promise<Context> => {
    if (this._db) {
      return this._db.get(chatId);
    } else {
      logWithTime('DB is not initialised!');
      return Promise.reject(undefined);
    }
  };
  updateContext = async (
    chatId: number,
    newContext: Pick<ContextObject, 'conversationId'> &
      Required<Pick<ContextObject, 'parentMessageId'>> &
      Pick<ContextObject, 'jailbreakConversationId'>
  ) => {
    if (this._db) {
      await this._db.put(chatId, newContext);
    } else {
      logWithTime('DB is not initialised!');
    }
  };
  clearContext = async (chatId: number) => {
    if (this._db) {
      await this._db.remove(chatId);
    } else {
      logWithTime('DB is not initialised!');
    }
  };
}

export {DB};