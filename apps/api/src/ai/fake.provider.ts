import { AiProvider, ChatTurn, ModerationResult } from './ai.provider';

/**
 * Offline stand-in for development and demos without an API key
 * (AI_PROVIDER=fake). Replies are canned; nothing leaves the machine.
 */
export class FakeAiProvider implements AiProvider {
  readonly name = 'fake';

  async chat(
    _system: string,
    turns: ChatTurn[],
    opts: { json?: boolean } = {},
  ): Promise<string> {
    const lastUser = [...turns].reverse().find((t) => t.role === 'user');
    if (opts.json) {
      return JSON.stringify({
        summary: `คุยกัน ${turns.length} ข้อความ เรื่องล่าสุด: ${lastUser?.content.slice(0, 60) ?? '-'}`,
        mood: 3,
        memories: [],
      });
    }
    return `ได้ยินแล้วนะ เล่าต่อได้เลย (fake AI: "${lastUser?.content.slice(0, 40) ?? ''}")`;
  }

  async moderate(_text: string): Promise<ModerationResult | null> {
    return { selfHarm: false, selfHarmIntent: false, selfHarmInstructions: false };
  }
}
