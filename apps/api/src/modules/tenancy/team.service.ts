import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../../common/database';
import { TenancyService } from './tenancy.service';
import type { Actor } from '../authorization/actor';
import type { TeamInput } from '@showora/shared-validation';
import { notFound } from '../../common/errors';

@Injectable()
export class TeamService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(TenancyService) private readonly tenants: TenancyService,
  ) {}
  teams(actor: Actor) {
    return this.db.scoped(actor.tenantId, async (tx) =>
      (
        await tx.salesTeam.findMany({
          where: { tenantId: actor.tenantId },
          include: {
            members: {
              include: { member: { include: { user: { select: { displayName: true } } } } },
            },
          },
          orderBy: { name: 'asc' },
        })
      ).map((t) => ({
        id: t.id,
        name: t.name,
        members: t.members.map((m) => ({
          memberId: m.memberId,
          role: m.role,
          displayName: m.member.user.displayName,
        })),
      })),
    );
  }
  eligibleMembers(actor: Actor, options: { cursor?: string; limit: number }) {
    return this.db.scoped(actor.tenantId, async (tx) => {
      const items = await tx.tenantMember.findMany({
        where: {
          tenantId: actor.tenantId,
          ...(options.cursor ? { id: { gt: options.cursor } } : {}),
        },
        select: { id: true, status: true, user: { select: { displayName: true } } },
        orderBy: { id: 'asc' },
        take: options.limit + 1,
      });
      const data = items
        .slice(0, options.limit)
        .map((m) => ({ id: m.id, status: m.status, displayName: m.user.displayName }));
      return {
        data,
        page: {
          nextCursor: items.length > options.limit ? data.at(-1)!.id : null,
          hasMore: items.length > options.limit,
        },
      };
    });
  }
  async saveTeam(actor: Actor, input: TeamInput, id?: string) {
    return this.tenants.mutate(actor, 'teams.manage', async (tx) => {
      if (
        (await tx.tenantMember.count({
          where: {
            tenantId: actor.tenantId,
            id: { in: input.members.map((m) => m.memberId) },
            status: 'active',
          },
        })) !== input.members.length
      )
        throw notFound();
      let team;
      if (id) {
        team = await tx.salesTeam.findFirst({ where: { tenantId: actor.tenantId, id } });
        if (!team) throw notFound();
        await tx.salesTeam.update({
          where: { tenantId_id: { tenantId: actor.tenantId, id } },
          data: { name: input.name },
        });
      } else
        team = await tx.salesTeam.create({ data: { tenantId: actor.tenantId, name: input.name } });
      await tx.teamMember.deleteMany({ where: { tenantId: actor.tenantId, teamId: team.id } });
      if (input.members.length)
        await tx.teamMember.createMany({
          data: input.members.map((m) => ({
            tenantId: actor.tenantId,
            teamId: team.id,
            memberId: m.memberId,
            role: m.role,
          })),
        });
      await this.tenants.audit(tx, actor, id ? 'team.updated' : 'team.created', team.id);
      return { id: team.id };
    });
  }
}
