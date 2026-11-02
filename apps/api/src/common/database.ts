import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { SETTINGS, type Settings } from './config';

export type Tx = Prisma.TransactionClient;
@Injectable()
export class Database extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(SETTINGS) settings: Settings) {
    super({ datasourceUrl: settings.DATABASE_URL, log: [] });
  }
  async onModuleInit() {
    await this.$connect();
    const [role] = await this.$queryRaw<
      { rolsuper: boolean; rolbypassrls: boolean; owns_tables: boolean }[]
    >`SELECT r.rolsuper, r.rolbypassrls, EXISTS(SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user) AS owns_tables FROM pg_roles r WHERE rolname = current_user`;
    if (!role || role.rolsuper || role.rolbypassrls || role.owns_tables)
      throw new Error('Runtime database role must be non-owner, NOSUPERUSER and NOBYPASSRLS');
    const [policies] = await this.$queryRaw<
      { count: bigint; secure: boolean }[]
    >`SELECT count(*) AS count, bool_and(relrowsecurity AND relforcerowsecurity) AS secure FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN ('tenants','tenant_domains','tenant_members','roles','role_permissions','member_roles','sales_teams','team_members','member_invitations','subscriptions','usage_records','website_settings','audit_logs')`;
    if (!policies?.secure || Number(policies.count) !== 13)
      throw new Error('Required tenant RLS migrations are missing');
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  scoped<T>(tenantId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return work(tx);
      },
      { timeout: 15000 },
    );
  }
}
