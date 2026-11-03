/**
 * The one place the rest of the app talks to an LLM through.
 * Swap OpenAI for another vendor by writing a new class with these methods.
 */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ModerationResult {
  /** Talk about self-harm / suicide (including the user's own feelings). */
  selfHarm: boolean;
  /** Stated intent to self-harm. */
  selfHarmIntent: boolean;
  /** Instructions or encouragement for self-harm. */
  selfHarmInstructions: boolean;
}

export interface AiProvider {
  readonly name: string;

  /** One assistant reply. `json: true` asks for a JSON object back. */
  chat(
    system: string,
    turns: ChatTurn[],
    opts?: { json?: boolean; maxTokens?: number },
  ): Promise<string>;

  /** Safety classifier. Returns null if the check itself failed. */
  moderate(text: string): Promise<ModerationResult | null>;
}
