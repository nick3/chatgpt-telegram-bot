import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
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
        try {
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 140,
                chunkOverlap: 1,
            });
            const docOutput = await splitter.splitDocuments([
                new Document({ pageContent: text, metadata: { source: chatId.toString() } }),
            ]);
            await this._vectorStore.addDocuments(docOutput);
        } catch (error) {
            console.error(error);
        }
    }
}

export { Embeddings };