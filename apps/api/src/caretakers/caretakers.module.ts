import { Module } from '@nestjs/common';
import {
  CaretakersController,
  CaretakingController,
} from './caretakers.controller';
import { CaretakersService } from './caretakers.service';

@Module({
  controllers: [CaretakersController, CaretakingController],
  providers: [CaretakersService],
  exports: [CaretakersService],
})
export class CaretakersModule {}
