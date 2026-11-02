import { Injectable } from '@nestjs/common';
import type { Permission } from '@showora/shared-types';
import type { Tx } from '../../common/database';
import { forbidden, unauthorized } from '../../common/errors';
import type { Actor } from './actor';
import { can, consolidatePermissions } from './policy';
@Injectable()
export class AuthorizationService {
  async permissions(tx: Tx, tenantId: string, memberId: string): Promise<Permission[]> {
    const member = await tx.tenantMember.findFirst({
      where: { tenantId, id: memberId, status: 'active' },
      include: { roles: { include: { role: { include: { permissions: true } } } } },
    });
    if (!member) throw unauthorized();
    return consolidatePermissions(
      member.roles.flatMap((r) =>
        r.role.permissions.map((p) => ({
          key: p.permissionKey,
          scope: p.scope as Permission['scope'],
        })),
      ),
    );
  }
  async require(tx: Tx, actor: Actor, key: string) {
    const permissions = await this.permissions(tx, actor.tenantId, actor.memberId);
    if (!can(permissions, key, 'all')) throw forbidden();
    return permissions;
  }
}
