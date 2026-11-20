import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { ConsentGuard } from '../privacy/consent.guard';
import { EmergencyContactDto, MedicalInfoDto } from './dto/medical.dto';
import { MedicalService } from './medical.service';

/** Profile → ข้อมูลทางการแพทย์. Health data: behind the same consent as medications. */
@Controller('medical')
@UseGuards(JwtAuthGuard, ConsentGuard)
export class MedicalController {
  constructor(private readonly medical: MedicalService) {}

  /** GET /medical -> { allergies, conditions, doctor, contacts } */
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.medical.get(user.id);
  }

  /** PATCH /medical  { allergies: [], conditions: [], doctor?: { name, place, phone } } — replaces all three */
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: MedicalInfoDto) {
    return this.medical.update(user.id, dto);
  }

  /** POST /medical/contacts  { label, phone } */
  @Post('contacts')
  addContact(@CurrentUser() user: AuthUser, @Body() dto: EmergencyContactDto) {
    return this.medical.addContact(user.id, dto);
  }

  /** PATCH /medical/contacts/:id  { label, phone } */
  @Patch('contacts/:id')
  updateContact(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EmergencyContactDto) {
    return this.medical.updateContact(user.id, id, dto);
  }

  /** DELETE /medical/contacts/:id */
  @Delete('contacts/:id')
  removeContact(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.medical.removeContact(user.id, id);
  }
}
