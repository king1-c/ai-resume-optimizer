import { env } from '@/config/env';
import { logger } from '@/config/logger';

export interface AIStreamOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Agnes AI 客户端
 */
export class AIClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private maxRetries: number;

  constructor() {
    this.apiKey = env.AI_API_KEY || '';
    this.baseUrl = env.AI_BASE_URL || 'https://api.agnes.ai/v1';
    this.defaultModel = env.AI_MODEL || 'Agnes-2.0-Flash';
    this.maxRetries = 2; // 对临时性网络错误重试 2 次

    if (!this.apiKey) {
      logger.warn('AI API Key 未配置，AI 功能将不可用');
    } else {
      // 安全：记录 API Key 的最后 4 位用于调试，不记录完整密钥
      logger.info(`AI API 已配置，Key 后缀: ...${this.apiKey.slice(-4)}`);
    }
  }

  /**
   * 带重试的 fetch 包装（处理冷启动期间的临时性网络错误）
   * 每次重试创建独立的 AbortController，避免已 abort 的 signal 导致后续重试全部瞬间失败
   */
  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = this.maxRetries,
    timeoutMs = 90000
  ): Promise<Response> {
    const { signal: externalSignal, ...rest } = init;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // 外部 signal 触发时也 abort 当前尝试的 controller
      const onExternalAbort = () => controller.abort();
      externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

      try {
        const response = await fetch(url, {
          ...rest,
          signal: controller.signal,
        });
        return response;
      } catch (error: any) {
        const isLastAttempt = attempt === retries;
        const isRetryable = 
          error.name === 'AbortError' ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNREFUSED' ||
          error.message?.includes('fetch failed');

        if (isLastAttempt || !isRetryable) {
          throw error;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        logger.warn(`AI API 请求失败（第 ${attempt + 1} 次），${delay}ms 后重试: ${error.message}`);
        await new Promise((r) => setTimeout(r, delay));
      } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', onExternalAbort);
      }
    }
    throw new Error('fetchWithRetry: unreachable');
  }

  /**
   * 发送聊天请求（非流式）
   */
  async chat(
    messages: AIMessage[],
    options: AIStreamOptions = {}
  ): Promise<AIResponse> {
    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 4000,
    } = options;

    if (!this.apiKey) {
      throw new Error('AI API Key 未配置');
    }

    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API 错误: ${response.status} ${errorText}`);
      }

      const data = await response.json() as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      logger.error('AI 请求失败:', error);
      throw error;
    }
  }

  /**
   * 发送流式聊天请求
   */
  async *chatStream(
    messages: AIMessage[],
    options: AIStreamOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 4000,
    } = options;

    if (!this.apiKey) {
      throw new Error('AI API Key 未配置');
    }

    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API 错误: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      logger.error('AI 流式请求失败:', error);
      throw error;
    }
  }

  /**
   * 简单的文本补全
   */
  async complete(
    prompt: string,
    systemPrompt?: string,
    options: AIStreamOptions = {}
  ): Promise<AIResponse> {
    const messages: AIMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return this.chat(messages, options);
  }

  /**
   * 流式文本补全
   */
  async *completeStream(
    prompt: string,
    systemPrompt?: string,
    options: AIStreamOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const messages: AIMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    yield* this.chatStream(messages, options);
  }
}

// 导出单例
export const aiClient = new AIClient();
