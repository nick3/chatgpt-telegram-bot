import Keyv from 'keyv';
import KeyvFile from 'keyv-file';

// 创建一个数据库，用来存储当天的聊天记录和用户名
class DB {
  private chatRecords: Keyv<{username: string, message: string}[]>;

  constructor() {
    this.chatRecords = new Keyv({
      store: new KeyvFile({
        filename: `chatRecords.json`,
        expiredCheckDelay: 12 * 3600 * 1000,
        writeDelay: 1000,
        encode: JSON.stringify, // serialize function
        decode: JSON.parse // deserialize function
      }),
      ttl: 86400000
    });
  }

  // 添加聊天记录和用户名
  async addChatRecord(chatId: string, username: string, message: string): Promise<void> {
    const records = await this.chatRecords.get(chatId) || [];
    records.push({username, message});
    await this.chatRecords.set(chatId, records);
  }

  // 获取聊天记录和用户名
  async getChatRecords(chatId: string): Promise<{username: string, message: string}[] | undefined> {
    return await this.chatRecords.get(chatId);
  }

  // 清除聊天记录和用户名
  async clearChatRecords(chatId: string): Promise<void> {
    await this.chatRecords.delete(chatId);
  }

  // 将聊天记录按照每行一段“用户名：聊天内容”进行字符串拼接
  async serializeChatRecords(chatId: string): Promise<string> {
    let result = '';
    const records = await this.chatRecords.get(chatId);
    if (records) {
      for (const record of records) {
        result += `${record.username}: ${record.message}\n `;
      }
    }
    return result;
  }
}

export {DB};
