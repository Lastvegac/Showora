import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../../common/database';
import { TenancyService } from './tenancy.service';
import type { Actor } from '../authorization/actor';
import type { RoleInput } from '@showora/shared-validation';
import type { Permission } from '@showora/shared-types';
import { randomUUID } from 'node:crypto';
import { ApiError, notFound } from '../../common/errors';
import { assertDelegation } from '../authorization/policy';

@Injectable()
export class RoleService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(TenancyService) private readonly tenants: TenancyService,
  ) {}
  roles(actor: Actor) {
    return this.db.scoped(actor.tenantId, async (tx) =>
      (
        await tx.role.findMany({
          where: { tenantId: actor.tenantId },
          include: { permissions: true },
          orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        })
      ).map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        isSystem: r.isSystem,
        permissions: r.permissions.map((p) => ({ key: p.permissionKey, scope: p.scope })),
      })),
    );
  }
  async assignableRoles(actor: Actor) {
    return (await this.roles(actor)).filter((role) => {
      if (role.key === 'TENANT_OWNER') return false;
      try {
        assertDelegation(actor.permissions, role.permissions as Permission[]);
        return true;
      } catch {
        return false;
      }
    });
  }
  async saveRole(actor: Actor, input: RoleInput, id?: string) {
    return this.tenants.mutate(actor, 'roles.manage', async (tx, permissions) => {
      assertDelegation(permissions, input.permissions);
      let role;
      if (id) {
        role = await tx.role.findFirst({
          where: { tenantId: actor.tenantId, id },
          include: { permissions: true },
        });
        if (!role) throw notFound();
        if (role.isSystem)
          throw new ApiError(409, 'SYSTEM_ROLE_PROTECTED', 'Vai trò hệ thống không thể thay đổi.');
        assertDelegation(
          permissions,
          role.permissions.map((p) => ({
            key: p.permissionKey,
            scope: p.scope as Permission['scope'],
          })),
        );
        await tx.role.update({
          where: { tenantId_id: { tenantId: actor.tenantId, id } },
          data: { name: input.name },
        });
        await tx.rolePermission.deleteMany({ where: { tenantId: actor.tenantId, roleId: id } });
      } else {
        role = await tx.role.create({
          data: { tenantId: actor.tenantId, key: `CUSTOM_${randomUUID()}`, name: input.name },
        });
      }
      await tx.rolePermission.createMany({
        data: input.permissions.map((p) => ({
          tenantId: actor.tenantId,
          roleId: role.id,
          permissionKey: p.key,
          scope: p.scope,
        })),
      });
      const affected = await tx.memberRole.findMany({
        where: { tenantId: actor.tenantId, roleId: role.id },
        select: { memberId: true },
      });
      await tx.tenantMember.updateMany({
        where: { tenantId: actor.tenantId, id: { in: affected.map((m) => m.memberId) } },
        data: { authzVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: {
          tenantId: actor.tenantId,
          memberId: { in: affected.map((m) => m.memberId) },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await this.tenants.audit(tx, actor, id ? 'role.updated' : 'role.created', role.id);
      return { id: role.id };
    });
  }
  async deleteRole(actor: Actor, id: string) {
    return this.tenants.mutate(actor, 'roles.manage', async (tx, permissions) => {
      const role = await tx.role.findFirst({
        where: { tenantId: actor.tenantId, id },
        include: { permissions: true, _count: { select: { members: true } } },
      });
      if (!role) throw notFound();
      if (role.isSystem || role._count.members)
        throw new ApiError(
          409,
          'ROLE_IN_USE',
          'Không thể xóa vai trò hệ thống hoặc vai trò đang được sử dụng.',
        );
      assertDelegation(
        permissions,
        role.permissions.map((p) => ({
          key: p.permissionKey,
          scope: p.scope as Permission['scope'],
        })),
      );
      await tx.rolePermission.deleteMany({ where: { tenantId: actor.tenantId, roleId: id } });
      await tx.role.delete({ where: { tenantId_id: { tenantId: actor.tenantId, id } } });
      await this.tenants.audit(tx, actor, 'role.deleted', id);
    });
  }
}
