import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER, AiProvider } from './ai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { FakeAiProvider } from './fake.provider';
import { OpenAiProvider } from './openai.provider';

/**
 * .env
 *   AI_PROVIDER=anthropic | openai | fake
 *                                      (default: anthropic if ANTHROPIC_API_KEY is set,
 *                                       else openai if OPENAI_API_KEY is set, else fake)
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   ANTHROPIC_MODEL=claude-sonnet-5-5               (optional)
 *   ANTHROPIC_MODERATION_MODEL=claude-haiku-5-5     (optional, the safety check)
 *   OPENAI_API_KEY=sk-...
 *   OPENAI_MODEL=gpt-6-luna            (optional)
 *   OPENAI_MODERATION_MODEL=omni-moderation-latest   (optional)
 */
@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiProvider => {
        const logger = new Logger('AiModule');
        const key = config.get<string>('OPENAI_API_KEY');
        const anthropicKey = config.get<string>('ANTHROPIC_API_KEY');
        const choice =
          config.get<string>('AI_PROVIDER') ?? (anthropicKey ? 'anthropic' : key ? 'openai' : 'fake');

        if (choice === 'anthropic') {
          if (!anthropicKey) throw new Error('AI_PROVIDER=anthropic needs ANTHROPIC_API_KEY in .env');
          const model = config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5';
          logger.log(`Using Claude (${model})`);
          return new AnthropicProvider({
            apiKey: anthropicKey,
            model,
            moderationModel: config.get<string>('ANTHROPIC_MODERATION_MODEL') ?? 'claude-haiku-5-5',
            baseUrl: config.get<string>('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com',
            timeoutMs: 30_000,
          });
        }

        if (choice === 'openai') {
          if (!key) throw new Error('AI_PROVIDER=openai needs OPENAI_API_KEY in .env');
          const model = config.get<string>('OPENAI_MODEL') ?? 'gpt-6-luna';
          logger.log(`Using OpenAI (${model})`);
          return new OpenAiProvider({
            apiKey: key,
            model,
            moderationModel:
              config.get<string>('OPENAI_MODERATION_MODEL') ?? 'omni-moderation-latest',
            baseUrl: config.get<string>('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
            timeoutMs: 30_000,
          });
        }
        logger.warn('Using FAKE AI provider (no ANTHROPIC_API_KEY / OPENAI_API_KEY). Replies are canned.');
        return new FakeAiProvider();
      },
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
