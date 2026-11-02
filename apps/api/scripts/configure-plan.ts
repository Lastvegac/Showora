import '../src/common/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { limitsSchema } from '../src/modules/subscription/entitlement.service';
import { permissionKeys } from '../src/modules/authorization/policy';
const file = process.argv[process.argv.indexOf('--file') + 1];
if (!process.argv.includes('--file') || !file)
  throw new Error(
    'Provide --file infrastructure/local/plan.example.json (local only) or an approved configuration file',
  );
const input = z
  .object({
    environment: z.enum(['development', 'test', 'production']),
    key: z.string().min(1).max(40),
    name: z.string().min(1).max(100),
    trialDays: z.number().int().min(1).max(365),
    limits: limitsSchema,
  })
  .strict()
  .parse(JSON.parse(readFileSync(resolve(process.cwd(), '../..', file), 'utf8')));
if (input.environment !== (process.env.NODE_ENV ?? 'development'))
  throw new Error('Plan configuration environment mismatch');
const db = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
async function main() {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(884107)::text AS locked`;
    await tx.permission.createMany({
      data: permissionKeys.map((key) => ({ key, description: key })),
      skipDuplicates: true,
    });
    const plan = await tx.subscriptionPlan.upsert({
      where: { key: input.key },
      create: { key: input.key, name: input.name },
      update: { name: input.name },
    });
    const current = await tx.planVersion.findFirst({
      where: { planId: plan.id },
      orderBy: { version: 'desc' },
    });
    await tx.planVersion.updateMany({
      where: { isOnboarding: true },
      data: { isOnboarding: false },
    });
    await tx.planVersion.create({
      data: {
        planId: plan.id,
        version: (current?.version ?? 0) + 1,
        trialDays: input.trialDays,
        limits: input.limits,
        isOnboarding: true,
      },
    });
  });
  console.log(
    'Configured onboarding plan version and permission catalog from the supplied file. Existing subscriptions are unchanged.',
  );
}
main()
  .catch((error: unknown) => {
    console.error(
      'Configuration failed:',
      error instanceof Error ? error.name : 'unknown',
      typeof error === 'object' && error && 'code' in error ? error.code : '',
      'Verify migration, environment and input file.',
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
