import {
  Controller,
  Get,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /users/me  (needs Authorization: Bearer <accessToken>) */
  @Get('me')
  async me(@CurrentUser() current: AuthUser) {
    const user = await this.prisma.users.findFirst({
      where: { id: current.id, deleted_at: null },
      select: {
        id: true,
        email: true,
        display_name: true,
        locale: true,
        timezone: true,
        uses_medication: true,
        onboarded_at: true,
        created_at: true,
      },
    });
    if (!user) throw new NotFoundException();

    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      locale: user.locale,
      timezone: user.timezone,
      usesMedication: user.uses_medication,
      onboardedAt: user.onboarded_at,
      createdAt: user.created_at,
    };
  }
}
