declare module '@waylaidwanderer/chatgpt-api' {
  export class BingAIClient {
    constructor(options: {
      cache?: {
        namespace?: string;
        store?: any;
        ttl?: number;
      };
      keyv?: any;
      host?: string;
      userToken?: string;
      cookies?: string;
      proxy?: string;
      debug?: boolean;
    });
    conversationsCache: Keyv;
    setOptions(options: {
      host?: string;
      userToken?: string;
      cookies?: string;
      proxy?: string;
      debug?: boolean;
    }): void;
    createNewConversation(): Promise<{
      conversationId: string;
      conversationSignature: string;
      clientId: string;
    }>;
    createWebSocketConnection(): Promise<WebSocket>;
    static cleanupWebSocketConnection(ws: WebSocket): void;
    sendMessage(
      message: string,
      opts?: {
        clientOptions?: {
          host?: string;
          userToken?: string;
          cookies?: string;
          proxy?: string;
          debug?: boolean;
        };
        jailbreakConversationId?: boolean | string;
        conversationId?: string;
        conversationSignature?: string;
        clientId?: string;
        onProgress?: (progress: any) => void;
        toneStyle?: 'balanced' | 'creative' | 'precise';
        invocationId?: number;
        systemMessage?: string;
        parentMessageId?: string;
        abortController?: AbortController;
      }
    ): Promise<any>;
  }

  export type BingResponse = {
    jailbreakConversationId: boolean | string;
    conversationId: string;
    conversationSignature: string;
    clientId: string;
    invocationId: number;
    messageId: string;
    conversationExpiryTime: string;
    response: string;
    details: any;
  }

  export type SourceAttribution = {
    providerDisplayName: string;
    seeMoreUrl: string;
    searchQuery: string;
  }

  export type SourceAttributions = Array<SourceAttribution>;
}
