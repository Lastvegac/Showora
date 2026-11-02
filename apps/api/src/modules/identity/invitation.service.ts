import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Database } from '../../common/database';
import { ApiError, notFound } from '../../common/errors';
import { hashToken, secretToken } from '../../common/crypto';
import type { Actor } from '../authorization/actor';
import { TenancyService } from '../tenancy/tenancy.service';
import { HostService } from '../tenancy/host.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { MailService } from '../notifications/mail.service';

@Injectable()
export class InvitationService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(TenancyService) private readonly tenants: TenancyService,
    @Inject(HostService) private readonly hosts: HostService,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
    @Inject(AuthorizationService) private readonly authz: AuthorizationService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}
  async invite(actor: Actor, email: string, roleIds: string[]) {
    return this.tenants.mutate(actor, 'members.manage', async (tx, permissions) => {
      await tx.memberInvitation.updateMany({
        where: {
          tenantId: actor.tenantId,
          email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { lte: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      if (
        await tx.tenantMember.findFirst({
          where: { tenantId: actor.tenantId, status: 'active', user: { email } },
        })
      )
        throw new ApiError(409, 'MEMBER_EXISTS', 'Người này đã là thành viên.');
      if (
        await tx.memberInvitation.findFirst({
          where: {
            tenantId: actor.tenantId,
            email,
            revokedAt: null,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
        })
      )
        throw new ApiError(409, 'INVITATION_EXISTS', 'Đã có lời mời đang chờ cho email này.');
      await this.tenants.validateRoles(tx, actor, roleIds, permissions);
      await this.entitlements.reserveStaff(tx, actor.tenantId);
      const token = secretToken();
      const invitation = await tx.memberInvitation.create({
        data: {
          tenantId: actor.tenantId,
          email,
          roleIds,
          inviterId: actor.memberId,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 3 * 86400000),
        },
      });
      const domain = await tx.tenantDomain.findFirstOrThrow({
        where: { tenantId: actor.tenantId, status: 'active' },
      });
      await this.mail.queue(
        tx,
        `invitation:${invitation.id}`,
        email,
        'Lời mời tham gia SHOWORA',
        `Bạn được mời tham gia không gian doanh nghiệp:\n${this.hosts.tenantOrigin(domain.hostname)}/accept-invitation?token=${token}\n\nLiên kết có hiệu lực 3 ngày.`,
      );
      await this.tenants.audit(tx, actor, 'invitation.created', invitation.id);
      return { id: invitation.id };
    });
  }
  list(actor: Actor) {
    return this.db.scoped(actor.tenantId, (tx) =>
      tx.memberInvitation.findMany({
        where: {
          tenantId: actor.tenantId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, email: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }
  revoke(actor: Actor, id: string) {
    return this.tenants.mutate(actor, 'members.manage', async (tx) => {
      const result = await tx.memberInvitation.updateMany({
        where: { tenantId: actor.tenantId, id, acceptedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!result.count) throw notFound();
      await this.tenants.audit(tx, actor, 'invitation.revoked', id);
    });
  }
  async accept(
    tenantId: string,
    token: string,
    displayName: string,
    password: string,
    requestId: string,
  ) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    return this.db.scoped(tenantId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      await this.entitlements.writable(tx, tenantId);
      const invite = await tx.memberInvitation.findFirst({
        where: {
          tenantId,
          tokenHash: hashToken(token),
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!invite)
        throw new ApiError(422, 'INVALID_TOKEN', 'Lời mời không hợp lệ hoặc đã hết hạn.');
      const permissions = await this.authz.permissions(tx, tenantId, invite.inviterId);
      const inviter: Actor = {
        tenantId,
        memberId: invite.inviterId,
        userId: '',
        sessionId: '',
        permissions,
        requestId,
      };
      await this.authz.require(tx, inviter, 'members.manage');
      await this.tenants.validateRoles(tx, inviter, invite.roleIds, permissions);
      const entitlement = await this.entitlements.read(tx, tenantId);
      if (entitlement.staffUsed > entitlement.staffLimit)
        throw new ApiError(409, 'QUOTA_EXCEEDED', 'Doanh nghiệp đã đạt giới hạn nhân sự.');
      let user = await tx.user.findUnique({ where: { email: invite.email } });
      if (user) {
        if (
          !user.emailVerifiedAt ||
          user.disabledAt ||
          !(await argon2.verify(user.passwordHash, password))
        )
          throw new ApiError(
            422,
            'ACCOUNT_VERIFICATION_FAILED',
            'Với tài khoản đã có, vui lòng dùng mật khẩu hiện tại.',
          );
      } else
        user = await tx.user.create({
          data: { email: invite.email, displayName, passwordHash, emailVerifiedAt: new Date() },
        });
      const member = await tx.tenantMember.upsert({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        create: { tenantId, userId: user.id },
        update: { status: 'active', authzVersion: { increment: 1 } },
      });
      await tx.memberRole.deleteMany({ where: { tenantId, memberId: member.id } });
      await tx.memberRole.createMany({
        data: invite.roleIds.map((roleId) => ({ tenantId, memberId: member.id, roleId })),
      });
      await tx.memberInvitation.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      await this.entitlements.syncStaff(tx, tenantId);
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: user.id,
          action: 'invitation.accepted',
          entityId: member.id,
          requestId,
        },
      });
      return { message: 'Đã tham gia doanh nghiệp. Bạn có thể đăng nhập.' };
    });
  }
}
