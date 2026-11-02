import { Inject, Injectable } from '@nestjs/common';
import type { Permission } from '@showora/shared-types';
import { Database, type Tx } from '../../common/database';
import { ApiError, forbidden, notFound } from '../../common/errors';
import type { Actor } from '../authorization/actor';
import { assertDelegation } from '../authorization/policy';
import { AuthorizationService } from '../authorization/authorization.service';
import { EntitlementService } from '../subscription/entitlement.service';

@Injectable()
export class TenancyService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(AuthorizationService) private readonly authz: AuthorizationService,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
  ) {}
  mutate<T>(
    actor: Actor,
    permission: string,
    work: (tx: Tx, permissions: Permission[]) => Promise<T>,
  ) {
    return this.db.scoped(actor.tenantId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${actor.tenantId}::uuid FOR UPDATE`;
      const permissions = await this.authz.require(tx, actor, permission);
      await this.entitlements.writable(tx, actor.tenantId);
      const result = await work(tx, permissions);
      await this.entitlements.syncStaff(tx, actor.tenantId);
      return result;
    });
  }
  audit(tx: Tx, actor: Actor, action: string, entityId: string) {
    return tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorId: actor.userId,
        requestId: actor.requestId,
        action,
        entityId,
      },
    });
  }
  async me(actor: Actor, hostname: string) {
    return this.db.scoped(actor.tenantId, async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { id: true, email: true, displayName: true },
      });
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: actor.tenantId },
        select: { id: true, name: true, status: true, timezone: true },
      });
      return {
        user,
        tenant: { ...tenant, hostname },
        memberId: actor.memberId,
        permissions: actor.permissions,
        entitlement: await this.entitlements.read(tx, actor.tenantId),
      };
    });
  }
  async overview(actor: Actor) {
    return this.db.scoped(actor.tenantId, async (tx) => ({
      activeMembers: await tx.tenantMember.count({
        where: { tenantId: actor.tenantId, status: 'active' },
      }),
      teams: await tx.salesTeam.count({ where: { tenantId: actor.tenantId } }),
      roles: await tx.role.count({ where: { tenantId: actor.tenantId } }),
      pendingInvites: await tx.memberInvitation.count({
        where: {
          tenantId: actor.tenantId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    }));
  }
  async updateTenant(actor: Actor, input: { name: string; timezone: string }) {
    return this.mutate(actor, 'tenant.write', async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: actor.tenantId },
        data: input,
        select: { id: true, name: true, timezone: true },
      });
      await this.audit(tx, actor, 'tenant.updated', tenant.id);
      return tenant;
    });
  }
  async members(actor: Actor, options: { cursor?: string; limit: number }) {
    return this.db.scoped(actor.tenantId, async (tx) => {
      const scope = actor.permissions.find(
        (permission) => permission.key === 'members.read',
      )?.scope;
      const scopeFilter =
        scope === 'all'
          ? {}
          : scope === 'own'
            ? { id: actor.memberId }
            : {
                teams: {
                  some: {
                    team: { members: { some: { memberId: actor.memberId, role: 'manager' } } },
                  },
                },
              };
      const values = await tx.tenantMember.findMany({
        where: {
          AND: [
            { tenantId: actor.tenantId, ...scopeFilter },
            options.cursor ? { id: { gt: options.cursor } } : {},
          ],
        },
        include: {
          user: { select: { displayName: true, email: true } },
          roles: { include: { role: { select: { id: true, key: true, name: true } } } },
        },
        orderBy: { id: 'asc' },
        take: options.limit + 1,
      });
      const items = values.slice(0, options.limit);
      return {
        data: items.map((m) => ({
          id: m.id,
          displayName: m.user.displayName,
          email: m.user.email,
          status: m.status,
          roles: m.roles.map((r) => r.role),
          createdAt: m.createdAt,
        })),
        page: {
          nextCursor: values.length > options.limit ? items.at(-1)!.id : null,
          hasMore: values.length > options.limit,
        },
      };
    });
  }
  async validateRoles(tx: Tx, actor: Actor, roleIds: string[], permissions: Permission[]) {
    const roles = await tx.role.findMany({
      where: { tenantId: actor.tenantId, id: { in: roleIds } },
      include: { permissions: true },
    });
    if (roles.length !== roleIds.length) throw notFound();
    if (roles.some((r) => r.key === 'TENANT_OWNER')) throw forbidden();
    assertDelegation(
      permissions,
      roles.flatMap((r) =>
        r.permissions.map((p) => ({ key: p.permissionKey, scope: p.scope as Permission['scope'] })),
      ),
    );
    return roles;
  }
  async updateMember(actor: Actor, id: string, input: { status: string; roleIds: string[] }) {
    return this.mutate(actor, 'members.manage', async (tx, permissions) => {
      const member = await tx.tenantMember.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: { roles: { include: { role: true } } },
      });
      if (!member) throw notFound();
      if (member.roles.some((r) => r.role.key === 'TENANT_OWNER'))
        throw new ApiError(
          409,
          'OWNER_PROTECTED',
          'Không thể vô hiệu hóa hoặc hạ quyền chủ doanh nghiệp qua thao tác này.',
        );
      await this.validateRoles(tx, actor, input.roleIds, permissions);
      if (member.status !== 'active' && input.status === 'active')
        await this.entitlements.reserveStaff(tx, actor.tenantId);
      await tx.memberRole.deleteMany({ where: { tenantId: actor.tenantId, memberId: id } });
      await tx.memberRole.createMany({
        data: input.roleIds.map((roleId) => ({ tenantId: actor.tenantId, memberId: id, roleId })),
      });
      await tx.tenantMember.update({
        where: { tenantId_id: { tenantId: actor.tenantId, id } },
        data: { status: input.status, authzVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: { tenantId: actor.tenantId, memberId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit(tx, actor, 'member.updated', id);
      return { id };
    });
  }
}
