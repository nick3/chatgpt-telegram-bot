import type {openai, FetchFn} from 'chatgpt';

export interface BotOptions {
  token: string;
  userIds: number[];
  groupIds: number[];
  chatCmd: string;
  queue: boolean;
}

export interface APIBrowserOptions {
  email: string;
  password: string;
  isGoogleLogin?: boolean;
  isProAccount?: boolean;
  executablePath?: string;
  proxyServer?: string;
  nopechaKey?: string;
  captchaToken?: string;
  userDataDir?: string;
  timeoutMs?: number;
  debug?: boolean;
}

export interface APIOfficialOptions {
  apiKey: string;
  apiBaseUrl?: string;
  completionParams?: Partial<
    Omit<openai.CreateChatCompletionRequest, 'messages' | 'n'>
  >;
  systemMessage?: string;
  maxModelTokens?: number;
  maxResponseTokens?: number;
  timeoutMs?: number;
  fetch?: FetchFn;
  debug?: boolean;
}

export interface APIUnofficialOptions {
  accessToken: string;
  apiReverseProxyUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetch?: FetchFn;
  debug?: boolean;
}

export interface APIBingOptions {
  host?: string;
  userToken?: string;
  cookies?: string;
  proxy?: string;
}

export interface APIOptions {
  type: 'browser' | 'official' | 'unofficial' | 'motohead' | 'bing';
  browser?: APIBrowserOptions;
  official?: APIOfficialOptions;
  unofficial?: APIUnofficialOptions;
  bing?: APIBingOptions;
}

export interface DBOptions {
  supabaseUrl: string;
  supabaseKey: string;
}

export interface Config {
  debug: number;
  bot: BotOptions;
  database: DBOptions;
  api: APIOptions;
  proxy?: string;
}
