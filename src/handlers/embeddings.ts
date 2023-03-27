import { SupabaseVectorStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { Document } from "langchain/document";
import { DB } from '../db';
import { loadConfig } from '../utils';

class Embeddings {
    protected _vectorStore: SupabaseVectorStore;
    protected _db: DB;
    constructor(db: DB) {
        const config = loadConfig();
        const { api: apiConfig } = config;
        this._db = db
        this._vectorStore = new SupabaseVectorStore(
            new OpenAIEmbeddings({
              openAIApiKey: apiConfig.official?.apiKey,
            }),
            {
              client: db.getClient(),
              tableName: "documents",
              queryName: "match_documents",
            }
        );
    }

    async addMessage(chatId: number | undefined, userId: number | undefined, username: string | undefined, message: string) {
        const doc = new Document({ pageContent: message, metadata: { source: chatId, userId, username } });
        this._vectorStore.addDocuments([
           doc 
        ]);
    }

}

export { Embeddings };