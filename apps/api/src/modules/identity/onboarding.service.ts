import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import type { RegistrationInput } from '@showora/shared-validation';
import { Database } from '../../common/database';
import { ApiError } from '../../common/errors';
import { hashToken, secretToken } from '../../common/crypto';
import { HostService } from '../tenancy/host.service';
import { MailService } from '../notifications/mail.service';
import { systemRoles } from '../authorization/policy';
import { SETTINGS, type Settings } from '../../common/config';

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(HostService) private readonly hosts: HostService,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}
  async register(input: RegistrationInput) {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await this.db.$transaction(async (tx) => {
      await tx.onboardingRequest.updateMany({
        where: { status: 'pending', expiresAt: { lte: new Date() } },
        data: { status: 'expired' },
      });
      if (await tx.user.findUnique({ where: { email: input.email } })) return;
      if (!(await tx.planVersion.findFirst({ where: { isOnboarding: true } })))
        throw new ApiError(
          503,
          'ONBOARDING_UNAVAILABLE',
          'Hệ thống chưa mở đăng ký. Vui lòng thử lại sau.',
        );
      const user = await tx.user.create({
        data: { email: input.email, displayName: input.displayName, passwordHash },
      });
      const request = await tx.onboardingRequest.create({
        data: {
          userId: user.id,
          tenantName: input.tenantName,
          subdomain: input.desiredSubdomain,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      const token = secretToken();
      await tx.identityToken.create({
        data: {
          userId: user.id,
          purpose: 'VERIFY_EMAIL',
          onboardingId: request.id,
          tokenHash: hashToken(token),
          expiresAt: request.expiresAt,
        },
      });
      await this.mail.queue(
        tx,
        `verify:${request.id}`,
        user.email,
        'Xác minh email để bắt đầu với SHOWORA',
        `Xác minh email và tạo không gian doanh nghiệp của bạn:\n${this.hosts.platformOrigin()}/verify-email?token=${token}\n\nLiên kết có hiệu lực 24 giờ. Nếu không phải bạn, hãy bỏ qua email này.`,
      );
    });
    return { message: 'Nếu thông tin hợp lệ, email hướng dẫn sẽ được gửi đến bạn.' };
  }
  async verify(token: string, requestId: string, desiredSubdomain?: string) {
    return this.db.$transaction(async (tx) => {
      const tokenHash = hashToken(token);
      await tx.$queryRaw`SELECT id FROM identity_tokens WHERE token_hash = ${tokenHash} FOR UPDATE`;
      const record = await tx.identityToken.findUnique({
        where: { tokenHash },
        include: { onboarding: true, user: true },
      });
      if (!record || record.purpose !== 'VERIFY_EMAIL' || !record.onboarding)
        throw new ApiError(422, 'INVALID_TOKEN', 'Liên kết không hợp lệ hoặc đã hết hạn.');
      const request = record.onboarding;
      const previousHostname = `${request.subdomain}.${this.settings.BASE_DOMAIN}`;
      if (record.consumedAt && request.status === 'completed')
        return { hostname: previousHostname, adminUrl: this.hosts.tenantOrigin(previousHostname) };
      if (
        record.consumedAt ||
        record.expiresAt < new Date() ||
        !['pending', 'expired'].includes(request.status)
      )
        throw new ApiError(422, 'INVALID_TOKEN', 'Liên kết không hợp lệ hoặc đã hết hạn.');
      const chosenSubdomain = desiredSubdomain ?? request.subdomain;
      const hostname = `${chosenSubdomain}.${this.settings.BASE_DOMAIN}`;
      await tx.onboardingRequest.update({
        where: { id: request.id },
        data: { subdomain: chosenSubdomain },
      });
      const plan = await tx.planVersion.findFirst({ where: { isOnboarding: true } });
      if (!plan)
        throw new ApiError(503, 'ONBOARDING_UNAVAILABLE', 'Đăng ký tạm thời chưa khả dụng.');
      const tenantId = randomUUID();
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.tenant.create({ data: { id: tenantId, name: request.tenantName } });
      await tx.tenantDomain.create({ data: { tenantId, hostname, verifiedAt: new Date() } });
      const member = await tx.tenantMember.create({ data: { tenantId, userId: record.userId } });
      for (const definition of systemRoles) {
        const role = await tx.role.create({
          data: { tenantId, key: definition.key, name: definition.name, isSystem: true },
        });
        await tx.rolePermission.createMany({
          data: definition.permissions.map((p) => ({
            tenantId,
            roleId: role.id,
            permissionKey: p.key,
            scope: p.scope,
          })),
        });
        if (definition.key === 'TENANT_OWNER')
          await tx.memberRole.create({ data: { tenantId, memberId: member.id, roleId: role.id } });
      }
      await tx.subscription.create({
        data: {
          tenantId,
          planVersionId: plan.id,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + plan.trialDays * 86400000),
        },
      });
      await tx.usageRecord.create({ data: { tenantId, resource: 'staff', used: 1 } });
      await tx.websiteSettings.create({ data: { tenantId } });
      await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      await tx.identityToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
      await tx.onboardingRequest.update({
        where: { id: request.id },
        data: { status: 'completed' },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: record.userId,
          action: 'tenant.created',
          entityId: tenantId,
          requestId,
        },
      });
      return { hostname, adminUrl: this.hosts.tenantOrigin(hostname) };
    });
  }
  async resend(email: string) {
    await this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { email } });
      if (!user || user.emailVerifiedAt || user.disabledAt) return;
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
      const request = await tx.onboardingRequest.findFirst({
        where: { userId: user.id, status: { in: ['pending', 'expired'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (!request) return;
      const expiresAt = new Date(Date.now() + 86400000);
      await tx.onboardingRequest.update({
        where: { id: request.id },
        data: { expiresAt, ...(request.expiresAt < new Date() ? { status: 'expired' } : {}) },
      });
      await tx.identityToken.updateMany({
        where: { userId: user.id, purpose: 'VERIFY_EMAIL', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      const token = secretToken();
      const record = await tx.identityToken.create({
        data: {
          userId: user.id,
          purpose: 'VERIFY_EMAIL',
          onboardingId: request.id,
          tokenHash: hashToken(token),
          expiresAt,
        },
      });
      await this.mail.queue(
        tx,
        `verify:${record.id}`,
        email,
        'Liên kết xác minh SHOWORA mới',
        `${this.hosts.platformOrigin()}/verify-email?token=${token}`,
      );
    });
    return { message: 'Nếu thông tin hợp lệ, email hướng dẫn sẽ được gửi đến bạn.' };
  }
}
