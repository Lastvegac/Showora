import '../src/common/config';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Never prepare test databases from production configuration');
  const source = new URL(process.env.MIGRATION_DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(source.hostname))
    throw new Error('Test database setup is restricted to local PostgreSQL');
  const name = `${source.pathname.slice(1)}_test`;
  if (!/^[a-z][a-z0-9_]{0,45}_test$/.test(name)) throw new Error('Unsafe test database name');
  const adminUrl = new URL(source);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasourceUrl: adminUrl.href });
  try {
    const exists = await admin.$queryRaw<
      { datname: string }[]
    >`SELECT datname FROM pg_database WHERE datname = ${name}`;
    if (!exists.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }
  const migrationUrl = new URL(source);
  migrationUrl.pathname = `/${name}`;
  const runtimeUrl = new URL(process.env.DATABASE_URL ?? '');
  runtimeUrl.pathname = `/${name}`;
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: runtimeUrl.href,
    MIGRATION_DATABASE_URL: migrationUrl.href,
  };
  const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('Test migration failed');
  const local = readFileSync(resolve(process.cwd(), '../../.env'), 'utf8')
    .split('\n')
    .filter((line) => !/^(NODE_ENV|DATABASE_URL|MIGRATION_DATABASE_URL)=/.test(line))
    .join('\n');
  writeFileSync(
    resolve(process.cwd(), '../../.env.test'),
    `${local}\nNODE_ENV=test\nDATABASE_URL=${runtimeUrl.href}\nMIGRATION_DATABASE_URL=${migrationUrl.href}\n`,
    { mode: 0o600 },
  );
  console.log(
    'Prepared isolated local *_test database and .env.test. No existing database was dropped.',
  );
}
main().catch(() => {
  console.error('Test database setup failed. Check local database and migrations.');
  process.exitCode = 1;
});
