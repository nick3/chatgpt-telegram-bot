import { setInterval } from 'timers';

// 创建一个内存数据库，用来存储当天的聊天记录和用户名
class InMemoryDatabase {
  private chatRecords: Map<string, {username: string, message: string}[]>;

  constructor() {
    this.chatRecords = new Map();
    this.scheduleDailyChatRecordsCleanup();
  }

  // 添加聊天记录和用户名
  addChatRecord(chatId: string, username: string, message: string): void {
    if (!this.chatRecords.has(chatId)) {
      this.chatRecords.set(chatId, []);
    }
    this.chatRecords.get(chatId)?.push({username, message});
  }

  // 获取聊天记录和用户名
  getChatRecords(chatId: string): {username: string, message: string}[] | undefined {
    return this.chatRecords.get(chatId);
  }

  // 清除聊天记录和用户名
  clearChatRecords(chatId: string): void {
    this.chatRecords.delete(chatId);
  }

  // 将聊天记录按照每行一段“用户名：聊天内容”进行字符串拼接
  serializeChatRecords(): string {
    let result = '';
    for (const [chatId, records] of this.chatRecords.entries()) {
      for (const record of records) {
        result += `${record.username}: ${record.message}\n`;
      }
    }
    return result;
  }

  // 添加每日凌晨1点自动清空前一天的所有聊天记录的功能
  private scheduleDailyChatRecordsCleanup(): void {
    const now = new Date();
    const nextCleanup = new Date(now);
    nextCleanup.setHours(25, 0, 0, 0); // Set to 1 AM the next day
    const timeUntilNextCleanup = nextCleanup.getTime() - now.getTime();

    setInterval(() => {
      this.chatRecords.clear();
    }, timeUntilNextCleanup + 24 * 60 * 60 * 1000); // Repeat every 24 hours
  }
}

export {InMemoryDatabase};