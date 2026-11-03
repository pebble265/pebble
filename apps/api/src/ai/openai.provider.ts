import { Logger } from '@nestjs/common';
import { AiProvider, ChatTurn, ModerationResult } from './ai.provider';

export interface OpenAiConfig {
  apiKey: string;
  model: string;
  moderationModel: string;
  baseUrl: string;
  timeoutMs: number;
}

/** Talks to OpenAI over plain HTTPS (no SDK needed). */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly cfg: OpenAiConfig) {}

  async chat(
    system: string,
    turns: ChatTurn[],
    opts: { json?: boolean; maxTokens?: number } = {},
  ): Promise<string> {
    const body = {
      model: this.cfg.model,
      messages: [{ role: 'system', content: system }, ...turns],
      max_completion_tokens: opts.maxTokens ?? 800,
      ...(opts.json && { response_format: { type: 'json_object' } }),
    };
    const data = await this.post('/chat/completions', body);
    const text: unknown = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('OpenAI returned an empty reply');
    }
    return text.trim();
  }

  async moderate(text: string): Promise<ModerationResult | null> {
    try {
      const data = await this.post('/moderations', {
        model: this.cfg.moderationModel,
        input: text,
      });
      const c = data?.results?.[0]?.categories ?? {};
      return {
        selfHarm: !!c['self-harm'],
        selfHarmIntent: !!c['self-harm/intent'],
        selfHarmInstructions: !!c['self-harm/instructions'],
      };
    } catch (e) {
      this.logger.warn(`Moderation failed: ${(e as Error).message}`);
      return null;
    }
  }

  private async post(path: string, body: unknown): Promise<any> {
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!res.ok) {
      // Never log the request body: it contains the user's words.
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI ${path} ${res.status}: ${detail.slice(0, 300)}`);
    }
    return res.json();
  }
}
