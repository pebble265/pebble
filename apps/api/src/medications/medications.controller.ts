import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { MedicationsService } from './medications.service';

@Controller('medications')
@UseGuards(JwtAuthGuard)
export class MedicationsController {
  constructor(private readonly meds: MedicationsService) {}

  /** GET /medications */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.meds.list(user.id);
  }

  /** GET /medications/:id */
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.meds.get(user.id, id);
  }

  /** POST /medications  { name, dosage?, instructions?, schedules: [{ time: "08:00" }] } */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMedicationDto) {
    return this.meds.create(user.id, dto);
  }

  /** PATCH /medications/:id  (sending schedules replaces them) */
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    return this.meds.update(user.id, id, dto);
  }

  /** DELETE /medications/:id */
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.meds.remove(user.id, id);
  }
}
