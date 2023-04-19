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
    openAIApiKey: apiConfig.official?.apiKey,
  });
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
      '你是一个资深的语言翻译者，精通各种语言。你要翻译所有发给你的语句，请翻译时不要带翻译腔，而是要翻译得自然、流畅和地道，可以使用网络用语。若发给你的语句为中文，你需要将其翻译为英文。若发你的语句为其它的语言，你需要将其翻译为中文。不要对翻译的内容进行解释。'
    ),
    HumanMessagePromptTemplate.fromTemplate('{text}'),
  ]);
  const prompt = await chatPrompt.formatPromptValue({
    text,
  });
  const res = await chat.callPrompt(prompt);
  return res.text;
};
