import { Injectable } from '@nestjs/common';
import type { Tx } from '../../common/database';
import { ApiError } from '../../common/errors';
import { z } from 'zod';
export const limitsSchema = z
  .object({
    staff: z.number().int().positive(),
    products: z.number().int().nonnegative(),
    leads: z.number().int().nonnegative(),
    mediaBytes: z.number().int().nonnegative(),
  })
  .strict();
export function effectiveStatus(
  tenantStatus: string,
  status: string,
  endsAt: Date,
  graceEndsAt: Date | null,
  now = new Date(),
) {
  if (tenantStatus !== 'active' || status === 'SUSPENDED') return 'SUSPENDED';
  if (status === 'PAST_DUE') return graceEndsAt && graceEndsAt > now ? 'PAST_DUE' : 'EXPIRED';
  if ((status === 'TRIALING' || status === 'ACTIVE') && endsAt > now) return status;
  return 'EXPIRED';
}
@Injectable()
export class EntitlementService {
  async read(tx: Tx, tenantId: string) {
    const [tenant, subscription, active, invited] = await Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      tx.subscription.findFirstOrThrow({
        where: { tenantId },
        include: { planVersion: { include: { plan: true } } },
      }),
      tx.tenantMember.count({ where: { tenantId, status: 'active' } }),
      tx.memberInvitation.count({
        where: { tenantId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);
    const limits = limitsSchema.parse(subscription.planVersion.limits);
    const status = effectiveStatus(
      tenant.status,
      subscription.status,
      subscription.periodEnd,
      subscription.graceEndsAt,
    );
    return {
      status,
      writable: ['TRIALING', 'ACTIVE'].includes(status),
      planName: subscription.planVersion.plan.name,
      endsAt: subscription.periodEnd.toISOString(),
      staffLimit: limits.staff,
      staffUsed: active + invited,
    };
  }
  async writable(tx: Tx, tenantId: string) {
    const value = await this.read(tx, tenantId);
    if (!value.writable)
      throw new ApiError(
        403,
        'TENANT_READ_ONLY',
        'Doanh nghiệp đang ở chế độ chỉ đọc hoặc đã hết hạn.',
      );
    return value;
  }
  async reserveStaff(tx: Tx, tenantId: string) {
    const value = await this.writable(tx, tenantId);
    if (value.staffUsed >= value.staffLimit)
      throw new ApiError(409, 'QUOTA_EXCEEDED', 'Đã đạt giới hạn nhân sự của gói dịch vụ.');
  }
  async syncStaff(tx: Tx, tenantId: string) {
    const value = await this.read(tx, tenantId);
    await tx.usageRecord.upsert({
      where: { tenantId_resource: { tenantId, resource: 'staff' } },
      create: { tenantId, resource: 'staff', used: value.staffUsed },
      update: { used: value.staffUsed },
    });
  }
}
