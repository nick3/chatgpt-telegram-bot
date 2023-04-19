import { OpenAI } from "langchain/llms/openai";
import { loadSummarizationChain } from "langchain/chains";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { loadConfig } from '../utils';

const config = loadConfig();
const { api: apiConfig } = config;

export const summarize = async (content: string) => {
  // In this example, we use a `MapReduceDocumentsChain` specifically prompted to summarize a set of documents.
  const model = new OpenAI({
      openAIApiKey: apiConfig.official?.apiKey,
      temperature: 0
  });
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments([content]);

  // This convenience function creates a document chain prompted to summarize a set of documents.
  const chain = loadSummarizationChain(model);
  const res = await chain.call({
    input_documents: docs,
  });
  console.log('sum:', res);
  return res;
};
