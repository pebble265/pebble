import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotifyJobs } from './notify.jobs';
import { NotifyService } from './notify.service';
import {
  ExpoPushProvider,
  LogPushProvider,
  PUSH_PROVIDER,
  PushProvider,
} from './push.provider';
import { PushTokensController } from './push-tokens.controller';
import { RealtimeGateway } from './realtime.gateway';

/**
 * .env
 *   PUSH_PROVIDER=expo | log     (default: log — prints pushes to the console)
 *   EXPO_ACCESS_TOKEN=...        (optional, if "enhanced push security" is on in Expo)
 */
@Global()
@Module({
  controllers: [PushTokensController],
  providers: [
    {
      provide: PUSH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PushProvider => {
        const choice = config.get<string>('PUSH_PROVIDER') ?? 'log';
        const logger = new Logger('NotificationsModule');
        if (choice === 'expo') {
          logger.log('Push notifications via Expo');
          return new ExpoPushProvider(config.get<string>('EXPO_ACCESS_TOKEN'));
        }
        logger.warn('Push notifications are only LOGGED (set PUSH_PROVIDER=expo to send)');
        return new LogPushProvider();
      },
    },
    RealtimeGateway,
    NotifyService,
    NotifyJobs,
  ],
  exports: [NotifyService, RealtimeGateway],
})
export class NotificationsModule {}
