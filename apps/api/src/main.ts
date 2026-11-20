import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { tbRelay } from './tb-relay/tb-relay';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Profile photos are sent as small base64 JPEGs, a bit over the 100 KB default.
  app.useBodyParser('json', { limit: '1mb' });

  // Validate every request body against its DTO; drop unknown fields.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Browsers (the web build of the app) need CORS. Phones don't.
  // CORS_ORIGINS=https://app.example.com,http://localhost:8081  (default: allow any)
  const origins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : true });

  // Admin log site → ThingsBoard (see src/tb-relay). After CORS, so the site's origin is allowed.
  app.use('/tb', tbRelay());

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
