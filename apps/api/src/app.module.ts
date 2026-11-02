import { Controller, Get, Inject, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Database } from './common/database';
import { loadSettings, SETTINGS } from './common/config';
import { CsrfGuard } from './common/csrf';
import { AuthGuard, Public } from './modules/authorization/auth.guard';
import { AuthorizationService } from './modules/authorization/authorization.service';
import { HostService } from './modules/tenancy/host.service';
import { TenancyService } from './modules/tenancy/tenancy.service';
import { RoleService } from './modules/tenancy/role.service';
import { TeamService } from './modules/tenancy/team.service';
import { OnboardingService } from './modules/identity/onboarding.service';
import { SessionService } from './modules/identity/session.service';
import { PasswordService } from './modules/identity/password.service';
import { InvitationService } from './modules/identity/invitation.service';
import { MailService } from './modules/notifications/mail.service';
import { EntitlementService } from './modules/subscription/entitlement.service';
import {
  AuthController,
  AccountController,
  InvitationAcceptController,
} from './modules/identity/auth.controller';
import {
  TenantController,
  MembersController,
  RolesController,
  TeamsController,
  PermissionsController,
  SubscriptionController,
} from './modules/tenancy/tenant.controller';
import { ApiError } from './common/errors';

@Public()
@Controller('health')
class HealthController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Get('live') live() {
    return { status: 'ok' };
  }
  @Get('ready') async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Not ready');
    }
  }
}
@Module({
  imports: [JwtModule.register({}), ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [
    HealthController,
    AuthController,
    AccountController,
    InvitationAcceptController,
    TenantController,
    MembersController,
    RolesController,
    TeamsController,
    PermissionsController,
    SubscriptionController,
  ],
  providers: [
    { provide: SETTINGS, useFactory: loadSettings },
    Database,
    HostService,
    TenancyService,
    RoleService,
    TeamService,
    AuthorizationService,
    EntitlementService,
    OnboardingService,
    SessionService,
    PasswordService,
    InvitationService,
    MailService,
    CsrfGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useExisting: CsrfGuard },
  ],
})
export class AppModule {}
