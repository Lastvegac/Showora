import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Permission } from '@showora/shared-types';
import { Database } from '../../common/database';
import { SETTINGS, type Settings } from '../../common/config';
import { forbidden, unauthorized } from '../../common/errors';
import { HostService } from '../tenancy/host.service';
import type { AppRequest } from './actor';
import { can, consolidatePermissions } from './policy';
import { effectiveStatus } from '../subscription/entitlement.service';
import { ApiError } from '../../common/errors';

export const Public = () => SetMetadata('public', true);
export const Require = (key: string) => SetMetadata('permission', key);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(Database) private readonly db: Database,
    @Inject(HostService) private readonly hosts: HostService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (req.path.startsWith('/api/v1/health/')) return true;
    req.hostContext = await this.hosts.resolve(req);
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    let claims: { sub: string; sid: string; tenantId: string; memberId: string; v: number };
    try {
      claims = await this.jwt.verifyAsync(
        req.headers.authorization?.replace(/^Bearer /, '') ?? '',
        {
          secret: this.settings.JWT_SECRET,
          algorithms: ['HS256'],
          issuer: 'showora',
          audience: 'tenant',
        },
      );
    } catch {
      throw unauthorized();
    }
    if (!req.hostContext.tenantId || req.hostContext.tenantId !== claims.tenantId)
      throw unauthorized();
    const actor = await this.db.scoped(claims.tenantId, async (tx) => {
      const session = await tx.authSession.findFirst({
        where: {
          id: claims.sid,
          userId: claims.sub,
          tenantId: claims.tenantId,
          memberId: claims.memberId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });
      const member = await tx.tenantMember.findFirst({
        where: {
          id: claims.memberId,
          tenantId: claims.tenantId,
          userId: claims.sub,
          status: 'active',
          authzVersion: claims.v,
        },
        include: { roles: { include: { role: { include: { permissions: true } } } } },
      });
      if (!session || session.user.disabledAt || !member) throw unauthorized();
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: claims.tenantId } });
      const subscription = await tx.subscription.findFirstOrThrow({
        where: { tenantId: claims.tenantId },
      });
      const status = effectiveStatus(
        tenant.status,
        subscription.status,
        subscription.periodEnd,
        subscription.graceEndsAt,
      );
      const recoveryPath =
        /^\/api\/v1\/(auth\/me|recovery\/status|subscription|account\/sessions(?:\/[a-f0-9-]+)?)$/;
      if (['EXPIRED', 'SUSPENDED'].includes(status) && !recoveryPath.test(req.path))
        throw new ApiError(403, 'TENANT_UNAVAILABLE', 'Không gian doanh nghiệp đang tạm ngưng.');
      const permissions = consolidatePermissions(
        member.roles.flatMap((r) =>
          r.role.permissions.map((p) => ({
            key: p.permissionKey,
            scope: p.scope as Permission['scope'],
          })),
        ),
      );
      return {
        userId: claims.sub,
        tenantId: claims.tenantId,
        memberId: claims.memberId,
        sessionId: claims.sid,
        permissions,
        requestId: req.requestId,
      };
    });
    const required = this.reflector.getAllAndOverride<string>('permission', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && !can(actor.permissions, required, required === 'members.read' ? 'own' : 'all'))
      throw forbidden();
    req.actor = actor;
    return true;
  }
}
