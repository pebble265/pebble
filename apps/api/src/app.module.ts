import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AlertsModule } from './alerts/alerts.module';
import { AuditModule } from './audit/audit.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CaretakersModule } from './caretakers/caretakers.module';
import { ChatModule } from './chat/chat.module';
import { CryptoModule } from './crypto/crypto.module';
import { DevicesModule } from './devices/devices.module';
import { DosesModule } from './doses/doses.module';
import { MedicationsModule } from './medications/medications.module';
import { MoodsModule } from './moods/moods.module';
import { MedicalModule } from './medical/medical.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrivacyModule } from './privacy/privacy.module';
import { RobotSettingsModule } from './robot-settings/robot-settings.module';
import { UsersModule } from './users/users.module';
import { LegalModule } from './legal/legal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // loads .env
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ScheduleModule.forRoot(), // background jobs
    PrismaModule,
    CryptoModule,
    AiModule,
    AuthModule,
    NotificationsModule,
    UsersModule,
    LegalModule,
    RobotSettingsModule,
    MedicationsModule,
    DosesModule,
    MoodsModule,
    MedicalModule,
    DevicesModule,
    CaretakersModule,
    AlertsModule,
    ChatModule,
    AuditModule,
    PrivacyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
