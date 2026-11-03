import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AlertsModule } from './alerts/alerts.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CaretakersModule } from './caretakers/caretakers.module';
import { CryptoModule } from './crypto/crypto.module';
import { DevicesModule } from './devices/devices.module';
import { DosesModule } from './doses/doses.module';
import { MedicationsModule } from './medications/medications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RobotSettingsModule } from './robot-settings/robot-settings.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // loads .env
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ScheduleModule.forRoot(), // background jobs
    PrismaModule,
    CryptoModule,
    AuthModule,
    UsersModule,
    RobotSettingsModule,
    MedicationsModule,
    DosesModule,
    DevicesModule,
    CaretakersModule,
    AlertsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
