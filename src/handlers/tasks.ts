import type { DB } from '../db';
import { Embeddings } from './embeddings';

export async function processDailyChatRecords(db: DB) {
    const embeddings = new Embeddings(db);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const groups = await db.getGroups();
    if (groups && groups.length > 0) {
        for (const groupId of groups) {
            const summary = await db.serializeChatRecords(groupId, {start: today, end: tomorrow});
            // process chatRecords here
            await embeddings.add(groupId, summary);
        }
    }
}
