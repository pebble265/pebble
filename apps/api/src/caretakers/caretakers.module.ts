import { Module } from '@nestjs/common';
import {
  CaretakersController,
  CaretakingController,
} from './caretakers.controller';
import { CaretakersService } from './caretakers.service';
import { MailService } from '../mail/mail.service';

@Module({
  controllers: [CaretakersController, CaretakingController],
  providers: [CaretakersService, MailService],
  exports: [CaretakersService],
})
export class CaretakersModule {}
