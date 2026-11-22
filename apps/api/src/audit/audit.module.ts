import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminAuditController, TbAdminGuard } from './admin-audit.controller';
import { AuditInterceptor } from './audit.interceptor';

/** Logs every change users / robots make, and lets the admin site read it. */
@Module({
  controllers: [AdminAuditController],
  providers: [TbAdminGuard, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AuditModule {}
