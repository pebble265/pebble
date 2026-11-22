import { Logger } from '@nestjs/common';
import { AiProvider, ChatTurn, ModerationResult } from './ai.provider';
import { AiBudget } from './budget';

export interface AnthropicConfig {
  apiKey: string;
  /** Pebbi's conversations */
  model: string;
  /** small, fast model for the safety check */
  moderationModel: string;
  baseUrl: string;
  timeoutMs: number;
  /** spending guard; refuses calls once the budget is used up */
  budget?: AiBudget;
}

const MODERATION_SYSTEM = `You are a safety classifier for a mental-health companion app (users write in Thai or English).
Read the text and answer with ONLY a JSON object, no other words:
{"selfHarm": boolean, "selfHarmIntent": boolean, "selfHarmInstructions": boolean}
- selfHarm: the text talks about suicide or self-harm, including the writer's own thoughts or feelings about it.
- selfHarmIntent: the writer states an intention or plan to harm or kill themselves.
- selfHarmInstructions: the text gives or asks for methods, instructions or encouragement for self-harm or suicide.`;

/** Talks to Claude (Anthropic Messages API) over plain HTTPS (no SDK needed). */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);

  constructor(private readonly cfg: AnthropicConfig) {}

  async chat(
    system: string,
    turns: ChatTurn[],
    opts: { json?: boolean; maxTokens?: number } = {},
  ): Promise<string> {
    const text = await this.message(
      this.cfg.model,
      opts.json ? `${system}\n\nRespond with ONLY a valid JSON object, no other text.` : system,
      fixTurns(turns),
      opts.maxTokens ?? 350,
    );
    return opts.json ? stripFences(text) : text;
  }

  async moderate(text: string): Promise<ModerationResult | null> {
    try {
      const raw = await this.message(
        this.cfg.moderationModel,
        MODERATION_SYSTEM,
        [{ role: 'user', content: `<text>\n${text}\n</text>` }],
        60,
      );
      const j = JSON.parse(stripFences(raw));
      return {
        selfHarm: !!j.selfHarm,
        selfHarmIntent: !!j.selfHarmIntent,
        selfHarmInstructions: !!j.selfHarmInstructions,
      };
    } catch (e) {
      this.logger.warn(`Moderation failed: ${(e as Error).message}`);
      return null;
    }
  }

  private async message(model: string, system: string, messages: ChatTurn[], maxTokens: number): Promise<string> {
    this.cfg.budget?.check();
    const res = await fetch(`${this.cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, system, messages, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!res.ok) {
      // Never log the request body: it contains the user's words.
      const detail = await res.text().catch(() => '');
      throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 300)}`);
    }
    const data: any = await res.json();
    this.cfg.budget?.record(model, data?.usage);
    const text = (data?.content ?? [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();
    if (!text) throw new Error('Anthropic returned an empty reply');
    return text;
  }
}

/** The Messages API wants user/assistant turns alternating and starting with the user. */
function fixTurns(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    if (!t.content?.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += `\n\n${t.content}`;
    else out.push({ role: t.role, content: t.content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.length ? out : [{ role: 'user', content: '...' }];
}

function stripFences(s: string) {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s.trim();
}
