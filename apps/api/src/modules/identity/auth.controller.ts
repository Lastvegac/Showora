import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { apiSchema } from '../../common/openapi';
import {
  registrationSchema,
  loginSchema,
  emailSchema,
  verifyEmailSchema,
  resetPasswordSchema,
  acceptInviteSchema,
  type RegistrationInput,
  type LoginInput,
} from '@showora/shared-validation';
import { Public } from '../authorization/auth.guard';
import type { AppRequest } from '../authorization/actor';
import { OnboardingService } from './onboarding.service';
import { SessionService } from './session.service';
import { PasswordService } from './password.service';
import { InvitationService } from './invitation.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { ZodPipe } from '../../common/validation';
import { ApiError } from '../../common/errors';
import { CsrfGuard } from '../../common/csrf';
import { SETTINGS, type Settings } from '../../common/config';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(OnboardingService) private readonly onboarding: OnboardingService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(TenancyService) private readonly tenants: TenancyService,
    @Inject(CsrfGuard) private readonly csrf: CsrfGuard,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}
  private platform(req: AppRequest) {
    if (req.hostContext.tenantId) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy trang.');
  }
  private tenant(req: AppRequest) {
    if (!req.hostContext.tenantId)
      throw new ApiError(
        422,
        'TENANT_HOST_REQUIRED',
        'Vui lòng đăng nhập tại tên miền doanh nghiệp.',
      );
    return req.hostContext.tenantId;
  }
  private authResponse(
    res: Response,
    value: { accessToken: string; refreshToken: string; expiresIn: number },
  ) {
    res.cookie('showora_refresh', value.refreshToken, {
      httpOnly: true,
      secure: this.settings.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 14 * 86400000,
    });
    return { accessToken: value.accessToken, expiresIn: value.expiresIn };
  }
  @Public()
  @Get('csrf')
  issueCsrf(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    return this.csrf.issue(req, res);
  }
  @Public()
  @Get('context')
  context(@Req() req: AppRequest) {
    return {
      isPlatform: !req.hostContext.tenantId,
      hostname: req.hostContext.hostname,
      baseDomain: this.settings.BASE_DOMAIN,
      platformOrigin: this.settings.ADMIN_ORIGIN,
    };
  }
  @Public()
  @Post('registrations')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBody({ schema: apiSchema(registrationSchema) })
  register(
    @Req() req: AppRequest,
    @Body(new ZodPipe(registrationSchema)) input: RegistrationInput,
  ) {
    this.platform(req);
    return this.onboarding.register(input);
  }
  @Public()
  @Post('verify-email')
  @HttpCode(200)
  @ApiBody({ schema: apiSchema(verifyEmailSchema) })
  verify(
    @Req() req: AppRequest,
    @Body(new ZodPipe(verifyEmailSchema)) input: { token: string; desiredSubdomain?: string },
  ) {
    this.platform(req);
    return this.onboarding.verify(input.token, req.requestId, input.desiredSubdomain);
  }
  @Public()
  @Post('resend-verification')
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiBody({ schema: apiSchema(emailSchema) })
  resend(@Req() req: AppRequest, @Body(new ZodPipe(emailSchema)) input: { email: string }) {
    this.platform(req);
    return this.onboarding.resend(input.email);
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @ApiBody({ schema: apiSchema(loginSchema) })
  async login(
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodPipe(loginSchema)) input: LoginInput,
  ) {
    return this.authResponse(
      res,
      await this.sessions.login(input, this.tenant(req), req.requestId),
    );
  }
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const raw: unknown = req.cookies?.showora_refresh;
    if (typeof raw !== 'string') throw new ApiError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.');
    return this.authResponse(
      res,
      await this.sessions.refresh(raw, this.tenant(req), req.requestId),
    );
  }
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const raw: unknown = req.cookies?.showora_refresh;
    await this.sessions.logout(
      typeof raw === 'string' ? raw : undefined,
      this.tenant(req),
      req.requestId,
    );
    res.clearCookie('showora_refresh', {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: this.settings.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }
  @ApiBearerAuth()
  @Get('me')
  me(@Req() req: AppRequest) {
    return this.tenants.me(req.actor, req.hostContext.hostname);
  }
  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiBody({ schema: apiSchema(emailSchema) })
  forgot(@Body(new ZodPipe(emailSchema)) input: { email: string }) {
    return this.passwords.forgot(input.email);
  }
  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBody({ schema: apiSchema(resetPasswordSchema) })
  reset(@Body(new ZodPipe(resetPasswordSchema)) input: { token: string; password: string }) {
    return this.passwords.reset(input.token, input.password);
  }
}

@ApiTags('Account sessions')
@ApiBearerAuth()
@Controller('account/sessions')
export class AccountController {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
  @Get() list(@Req() req: AppRequest) {
    return this.sessions.list(req.actor);
  }
  @Delete(':id') @HttpCode(204) revoke(
    @Req() req: AppRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessions.revoke(req.actor, id);
  }
}

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationAcceptController {
  constructor(@Inject(InvitationService) private readonly invitations: InvitationService) {}
  @Public()
  @Post('accept')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBody({ schema: apiSchema(acceptInviteSchema) })
  accept(
    @Req() req: AppRequest,
    @Body(new ZodPipe(acceptInviteSchema))
    body: { token: string; displayName: string; password: string },
  ) {
    if (!req.hostContext.tenantId) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy trang.');
    return this.invitations.accept(
      req.hostContext.tenantId,
      body.token,
      body.displayName,
      body.password,
      req.requestId,
    );
  }
}
