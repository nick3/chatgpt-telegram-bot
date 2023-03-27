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

    async add(chatId: number | string, text: string) {
        await this._vectorStore.addDocuments([
            new Document({ pageContent: text, metadata: { source: chatId.toString() } }),
        ]);
    }
}

export { Embeddings };