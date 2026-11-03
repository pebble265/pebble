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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { CaretakersService } from './caretakers.service';
import {
  CreateInviteDto,
  InviteTokenDto,
  PermissionsDto,
} from './dto/caretakers.dto';
import { ConsentGuard, RequireConsents } from '../privacy/consent.guard';

/** The person being cared for manages their caretakers here. */
@Controller('caretakers')
@UseGuards(JwtAuthGuard, ConsentGuard, ThrottlerGuard)
export class CaretakersController {
  constructor(private readonly care: CaretakersService) {}

  /** GET /caretakers */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.care.listMyCaretakers(user.id);
  }

  /** POST /caretakers/invites  { email?, relationshipLabel?, permissions? } -> { token } */
  @Post('invites')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  invite(@CurrentUser() user: AuthUser, @Body() dto: CreateInviteDto) {
    return this.care.createInvite(user.id, dto);
  }

  /** PATCH /caretakers/:id/permissions  { alertOnMissedDose: true, ... } */
  @Patch(':id/permissions')
  permissions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PermissionsDto,
  ) {
    return this.care.updatePermissions(user.id, id, dto);
  }

  /** DELETE /caretakers/:id — remove a caretaker or cancel an invite */
  @Delete(':id')
  @HttpCode(204)
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.care.revoke(user.id, id);
  }
}

/** The caretaker's side. */
@Controller('caretaking')
@UseGuards(JwtAuthGuard, ConsentGuard, ThrottlerGuard)
@RequireConsents('terms')
export class CaretakingController {
  constructor(private readonly care: CaretakersService) {}

  /** POST /caretaking/invites/preview  { token } — who invited me, what I'd see */
  @Post('invites/preview')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  preview(@CurrentUser() user: AuthUser, @Body() dto: InviteTokenDto) {
    return this.care.previewInvite(user.id, dto.token);
  }

  /** POST /caretaking/invites/accept  { token } */
  @Post('invites/accept')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  accept(@CurrentUser() user: AuthUser, @Body() dto: InviteTokenDto) {
    return this.care.acceptInvite(user.id, dto.token);
  }

  /** POST /caretaking/invites/decline  { token } */
  @Post('invites/decline')
  @HttpCode(204)
  async decline(@CurrentUser() user: AuthUser, @Body() dto: InviteTokenDto) {
    await this.care.declineInvite(user.id, dto.token);
  }

  /** GET /caretaking — people I take care of */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.care.listCaringFor(user.id);
  }

  /** GET /caretaking/:linkId — what I'm allowed to see about this person */
  @Get(':linkId')
  overview(
    @CurrentUser() user: AuthUser,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Req() req: { ip?: string },
  ) {
    return this.care.overview(user.id, linkId, req.ip);
  }

  /** DELETE /caretaking/:linkId — stop being a caretaker */
  @Delete(':linkId')
  @HttpCode(204)
  async leave(
    @CurrentUser() user: AuthUser,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.care.leave(user.id, linkId);
  }
}
