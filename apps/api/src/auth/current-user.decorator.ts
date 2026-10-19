import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './jwt-auth.guard';

/** Use in a route protected by JwtAuthGuard:  me(@CurrentUser() user: AuthUser) */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
