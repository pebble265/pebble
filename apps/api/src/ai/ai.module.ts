import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER, AiProvider } from './ai.provider';
import { FakeAiProvider } from './fake.provider';
import { OpenAiProvider } from './openai.provider';

/**
 * .env
 *   AI_PROVIDER=openai | fake          (default: openai if OPENAI_API_KEY is set, else fake)
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
        const choice = config.get<string>('AI_PROVIDER') ?? (key ? 'openai' : 'fake');

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
        logger.warn('Using FAKE AI provider (no OPENAI_API_KEY). Replies are canned.');
        return new FakeAiProvider();
      },
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
