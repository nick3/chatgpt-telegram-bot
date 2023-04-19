import {ChatOpenAI} from 'langchain/chat_models/openai';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts';
import {loadConfig} from './utils';

const config = loadConfig();
const {api: apiConfig} = config;

/**
 * Translates the given text using OpenAI's GPT-3 language model.
 *
 * @param text The text to be translated.
 * @returns A Promise for the translated text.
 * @throws An error if the OpenAI API key is invalid or if the translation fails.
 */
export const translate = async (text: string) => {
  const chat = new ChatOpenAI({
    modelName: 'gpt-3.5-turbo',
    temperature: 0.3,
    openAIApiKey: apiConfig.official?.apiKey,
  });
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
      '你是一个翻译高手，懂得用自然、流畅和地道的语言来翻译。如果收到中文，就用美式英文回答。如果收到其他语言，就用简体中文回答。不要解释翻译的内容，只要翻译就行。尽量使用与翻译后语言一致的网上流行词和表达方式，让对方觉得你很懂他们的文化和习惯。'
    ),
    HumanMessagePromptTemplate.fromTemplate('{text}'),
  ]);
  const prompt = await chatPrompt.formatPromptValue({
    text,
  });
  const res = await chat.callPrompt(prompt);
  return res.text;
};
