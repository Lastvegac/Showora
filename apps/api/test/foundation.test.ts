import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app';
import { Database } from '../src/common/database';
import { decryptMail } from '../src/common/crypto';
import { MailService } from '../src/modules/notifications/mail.service';
import { permissionKeys } from '../src/modules/authorization/policy';
import type { Member, Page, Role, Viewer } from '@showora/shared-types';

const password = 'integration test passphrase';
const run = randomUUID().slice(0, 8);
let app: INestApplication;
let db: Database;
let admin: PrismaClient;
let server: Server;
let tenantA: string;
let tenantB: string;
let a: Client;
let b: Client;
let platform: Client;
let sales: Client;
let limited: Client;
let owner: Member;
let saleRole: Role;
let limitedRole: string;
let teamId: string;

class Client {
  cookies = new Map<string, string>();
  csrf = '';
  token = '';
  constructor(readonly host: string) {}
  async init() {
    const result = await this.get('/auth/csrf');
    this.csrf = result.body.csrfToken as string;
    this.capture(result);
    return this;
  }
  capture(result: request.Response) {
    const cookies = result.headers['set-cookie'] as string[] | undefined;
    for (const line of cookies ?? []) {
      const pair = line.split(';')[0]!;
      const index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
  cookieHeader() {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  }
  get(path: string) {
    return request(server)
      .get(`/api/v1${path}`)
      .set('Host', this.host)
      .set('Cookie', this.cookieHeader())
      .set('Authorization', `Bearer ${this.token}`);
  }
  async write(method: 'post' | 'patch' | 'delete', path: string, body?: object) {
    const client = request(server);
    const result = await client[method](`/api/v1${path}`)
      .set('Host', this.host)
      .set('Origin', `http://${this.host}`)
      .set('Cookie', this.cookieHeader())
      .set('X-CSRF-Token', this.csrf)
      .set('Authorization', `Bearer ${this.token}`)
      .send(body);
    this.capture(result);
    return result;
  }
  async login(email: string) {
    const result = await this.write('post', '/auth/login', { email, password });
    expect(result.status).toBe(200);
    this.token = result.body.accessToken as string;
    return this;
  }
}
async function queuedToken(needle: string) {
  const jobs = await db.systemOutboxEvent.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  for (const job of jobs) {
    const payload = decryptMail(job.encryptedPayload, process.env.MAIL_ENCRYPTION_KEY!) as {
      to: string;
      text: string;
    };
    if (payload.to === needle) {
      const token = payload.text.match(/[?&]token=([a-f0-9]+)/)?.[1];
      if (token) return token;
    }
  }
  throw new Error('Expected an encrypted transactional email for the test recipient');
}
async function register(email: string, slug: string) {
  const result = await platform.write('post', '/auth/registrations', {
    email,
    password,
    displayName: 'Integration Owner',
    tenantName: slug,
    desiredSubdomain: slug,
    consent: true,
  });
  expect(result.status).toBe(202);
  const token = await queuedToken(email);
  const verified = await platform.write('post', '/auth/verify-email', { token });
  expect(verified.status).toBe(200);
  const again = await platform.write('post', '/auth/verify-email', { token });
  expect(again.status).toBe(200);
  return new Client(`${slug}.localhost:5178`).init();
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.NODE_ENV !== 'test' ||
    !url.pathname.endsWith('_test') ||
    !['127.0.0.1', 'localhost'].includes(url.hostname)
  )
    throw new Error('Integration tests require an isolated local *_test database');
  admin = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  await admin.permission.createMany({
    data: permissionKeys.map((key) => ({ key, description: key })),
    skipDuplicates: true,
  });
  await admin.planVersion.updateMany({
    where: { isOnboarding: true },
    data: { isOnboarding: false },
  });
  await admin.subscriptionPlan.create({
    data: {
      key: `test-${run}`,
      name: 'Integration fixture',
      versions: {
        create: {
          version: 1,
          trialDays: 14,
          isOnboarding: true,
          limits: { staff: 4, products: 0, leads: 0, mediaBytes: 0 },
        },
      },
    },
  });
  app = await createApp();
  await app.init();
  db = app.get(Database);
  server = app.getHttpServer() as Server;
  platform = await new Client('localhost:5178').init();
  a = await register(`a-${run}@example.test`, `tenant-a-${run}`);
  await a.login(`a-${run}@example.test`);
  b = await register(`b-${run}@example.test`, `tenant-b-${run}`);
  await b.login(`b-${run}@example.test`);
  const meA = (await a.get('/auth/me')).body as Viewer;
  const meB = (await b.get('/auth/me')).body as Viewer;
  tenantA = meA.tenant.id;
  tenantB = meB.tenant.id;
  owner = ((await a.get('/members')).body as Page<Member>).data[0]!;
  saleRole = ((await a.get('/roles')).body as Role[]).find((role) => role.key === 'SALES')!;
});
afterAll(async () => {
  if (app) await app.close();
  if (admin) await admin.$disconnect();
});

describe('Real PostgreSQL foundation', () => {
  it('runs ready checks using a non-owner non-bypass runtime role', async () => {
    expect((await platform.get('/health/ready')).status).toBe(200);
    const [role] = await db.$queryRaw<
      { rolsuper: boolean; rolbypassrls: boolean }[]
    >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(role).toMatchObject({ rolsuper: false, rolbypassrls: false });
  });
  it('rejects tenant and role injection, unrecognized hosts and forwarded-host spoofing', async () => {
    const invalid = await platform.write('post', '/auth/registrations', {
      email: `bad-${run}@example.test`,
      password,
      displayName: 'Owner',
      tenantName: 'Company',
      desiredSubdomain: `bad-${run}`,
      consent: true,
      tenant_id: tenantB,
      role: 'SUPER_ADMIN',
    });
    expect(invalid.status).toBe(422);
    expect(
      (await request(server).get('/api/v1/auth/context').set('Host', 'unknown.localhost:5178'))
        .status,
    ).toBe(404);
    const forwarded = await request(server)
      .get('/api/v1/auth/context')
      .set('Host', 'localhost:5178')
      .set('X-Forwarded-Host', a.host);
    expect(forwarded.body.isPlatform).toBe(true);
  });
  it('binds JWT to the tenant host and never exposes another tenant member', async () => {
    expect(
      (
        await request(server)
          .get('/api/v1/members')
          .set('Host', b.host)
          .set('Authorization', `Bearer ${a.token}`)
      ).status,
    ).toBe(401);
    const bOwner = ((await b.get('/members')).body as Page<Member>).data[0]!;
    expect(
      ((await a.get('/members')).body as Page<Member>).data.every((m) => m.email !== bOwner.email),
    ).toBe(true);
    const result = await a.write('patch', `/members/${bOwner.id}`, {
      status: 'disabled',
      roleIds: [saleRole.id],
    });
    expect(result.status).toBe(404);
  });
  it('fails closed without RLS context and clears context when pooled transactions finish', async () => {
    expect(await db.role.findMany()).toEqual([]);
    for (const id of [tenantA, tenantB, tenantA]) {
      const roles = await db.scoped(id, (tx) => tx.role.findMany());
      expect(roles.length).toBeGreaterThan(0);
      expect(roles.every((r) => r.tenantId === id)).toBe(true);
    }
    expect(await db.role.findMany()).toEqual([]);
    await expect(
      db.scoped(tenantA, (tx) =>
        tx.role.create({ data: { tenantId: tenantB, key: `escape-${run}`, name: 'Invalid' } }),
      ),
    ).rejects.toThrow();
  });
  it('protects the owner and server-controlled system roles', async () => {
    expect(
      (
        await a.write('patch', `/members/${owner.id}`, {
          status: 'disabled',
          roleIds: [saleRole.id],
        })
      ).body.error.code,
    ).toBe('OWNER_PROTECTED');
    expect(
      (
        await a.write('patch', `/roles/${saleRole.id}`, {
          name: 'Altered',
          permissions: [{ key: 'billing.manage', scope: 'all' }],
        })
      ).status,
    ).toBe(409);
  });
  it('persists a team and rejects cross-tenant links at the database layer', async () => {
    const result = await a.write('post', '/teams', {
      name: 'Integration team',
      members: [{ memberId: owner.id, role: 'manager' }],
    });
    expect(result.status).toBe(201);
    teamId = result.body.id as string;
    const bOwner = ((await b.get('/members')).body as Page<Member>).data[0]!;
    await expect(
      db.scoped(tenantA, (tx) =>
        tx.teamMember.create({
          data: { tenantId: tenantA, teamId, memberId: bOwner.id, role: 'sales' },
        }),
      ),
    ).rejects.toThrow();
  });
  it('accepts an emailed invitation once and enforces Sales permissions', async () => {
    const email = `sale-${run}@example.test`;
    expect(
      (await a.write('post', '/members/invitations', { email, roleIds: [saleRole.id] })).status,
    ).toBe(201);
    const token = await queuedToken(email);
    sales = await new Client(a.host).init();
    expect(
      (
        await sales.write('post', '/invitations/accept', {
          token,
          displayName: 'Integration Sale',
          password,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await sales.write('post', '/invitations/accept', {
          token,
          displayName: 'Integration Sale',
          password,
        })
      ).status,
    ).toBe(422);
    await sales.login(email);
    expect((await sales.get('/roles')).status).toBe(403);
    expect((await sales.get('/members')).status).toBe(403);
    expect(
      (await sales.write('patch', '/tenant', { name: 'Unauthorized change', timezone: 'UTC' }))
        .status,
    ).toBe(403);
  });
  it('prevents a custom role delegator from escalating beyond their own permissions', async () => {
    const role = await a.write('post', '/roles', {
      name: 'Limited administrator',
      permissions: [
        { key: 'roles.manage', scope: 'all' },
        { key: 'members.manage', scope: 'all' },
        { key: 'members.read', scope: 'all' },
        { key: 'tenant.read', scope: 'all' },
      ],
    });
    expect(role.status).toBe(201);
    limitedRole = role.body.id as string;
    const email = `limited-${run}@example.test`;
    expect(
      (await a.write('post', '/members/invitations', { email, roleIds: [limitedRole] })).status,
    ).toBe(201);
    limited = await new Client(a.host).init();
    expect(
      (
        await limited.write('post', '/invitations/accept', {
          token: await queuedToken(email),
          displayName: 'Limited admin',
          password,
        })
      ).status,
    ).toBe(200);
    await limited.login(email);
    expect(
      (
        await limited.write('post', '/roles', {
          name: 'Escalated',
          permissions: [{ key: 'billing.manage', scope: 'all' }],
        })
      ).status,
    ).toBe(403);
    const adminRole = ((await a.get('/roles')).body as Role[]).find(
      (r) => r.key === 'TENANT_ADMIN',
    )!;
    expect(
      (
        await limited.write('post', '/members/invitations', {
          email: `blocked-${run}@example.test`,
          roleIds: [adminRole.id],
        })
      ).status,
    ).toBe(403);
  });
  it('scopes member directories to managed teams or the actor and revokes changed sessions', async () => {
    const me = (await sales.get('/auth/me')).body as Viewer;
    const teamRole = await a.write('post', '/roles', {
      name: 'Team directory',
      permissions: [{ key: 'members.read', scope: 'team' }],
    });
    expect(
      (
        await a.write('patch', `/teams/${teamId}`, {
          name: 'Integration team',
          members: [
            { memberId: owner.id, role: 'manager' },
            { memberId: me.memberId, role: 'manager' },
          ],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await a.write('patch', `/members/${me.memberId}`, {
          status: 'active',
          roleIds: [saleRole.id, teamRole.body.id],
        })
      ).status,
    ).toBe(200);
    expect((await sales.get('/auth/me')).status).toBe(401);
    await sales.login(`sale-${run}@example.test`);
    const teamMembers = (await sales.get('/members')).body as Page<Member>;
    expect(teamMembers.data.map((m) => m.id).sort()).toEqual([owner.id, me.memberId].sort());
    const ownRole = await a.write('post', '/roles', {
      name: 'Own directory',
      permissions: [{ key: 'members.read', scope: 'own' }],
    });
    expect(
      (
        await a.write('patch', `/members/${me.memberId}`, {
          status: 'active',
          roleIds: [saleRole.id, ownRole.body.id],
        })
      ).status,
    ).toBe(200);
    await sales.login(`sale-${run}@example.test`);
    expect(((await sales.get('/members')).body as Page<Member>).data.map((m) => m.id)).toEqual([
      me.memberId,
    ]);
  });
  it('reserves the last staff seat atomically during concurrent invitations', async () => {
    const results = await Promise.all([
      a.write('post', '/members/invitations', {
        email: `seat1-${run}@example.test`,
        roleIds: [saleRole.id],
      }),
      a.write('post', '/members/invitations', {
        email: `seat2-${run}@example.test`,
        roleIds: [saleRole.id],
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(((await a.get('/auth/me')).body as Viewer).entitlement.staffUsed).toBe(4);
    const invitation = results.find((r) => r.status === 201)!;
    expect((await a.write('delete', `/members/invitations/${invitation.body.id}`)).status).toBe(
      204,
    );
  });
  it('enforces CSRF and origin validation for authenticated mutations', async () => {
    expect(
      (
        await request(server)
          .patch('/api/v1/tenant')
          .set('Host', a.host)
          .set('Authorization', `Bearer ${a.token}`)
          .send({ name: 'Bad', timezone: 'UTC' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .patch('/api/v1/tenant')
          .set('Host', a.host)
          .set('Origin', 'http://evil.test')
          .set('Cookie', a.cookieHeader())
          .set('X-CSRF-Token', a.csrf)
          .set('Authorization', `Bearer ${a.token}`)
          .send({ name: 'Bad', timezone: 'UTC' })
      ).status,
    ).toBe(403);
  });
  it('keeps tenant audit records append-only to the runtime role', async () => {
    await expect(
      db.scoped(tenantA, (tx) => tx.auditLog.deleteMany({ where: { tenantId: tenantA } })),
    ).rejects.toThrow();
  });
  it('revokes a refresh family on replay, including the successor access token', async () => {
    const previous = a.cookies.get('showora_refresh')!;
    const refreshed = await a.write('post', '/auth/refresh');
    expect(refreshed.status).toBe(200);
    a.token = refreshed.body.accessToken as string;
    const successor = a.cookies.get('showora_refresh')!;
    a.cookies.set('showora_refresh', previous);
    expect((await a.write('post', '/auth/refresh')).status).toBe(401);
    a.cookies.set('showora_refresh', successor);
    expect((await a.write('post', '/auth/refresh')).status).toBe(401);
    expect((await a.get('/auth/me')).status).toBe(401);
  });
  it('password reset revokes existing sessions and the reset token is single-use', async () => {
    await a.login(`a-${run}@example.test`);
    const previousAccess = a.token;
    expect(
      (await platform.write('post', '/auth/forgot-password', { email: `a-${run}@example.test` }))
        .status,
    ).toBe(202);
    const token = await queuedToken(`a-${run}@example.test`);
    const body = { token, password: 'new integration passphrase' };
    expect((await platform.write('post', '/auth/reset-password', body)).status).toBe(200);
    expect((await platform.write('post', '/auth/reset-password', body)).status).toBe(422);
    a.token = previousAccess;
    expect((await a.get('/auth/me')).status).toBe(401);
    const login = await a.write('post', '/auth/login', {
      email: `a-${run}@example.test`,
      password: body.password,
    });
    expect(login.status).toBe(200);
    a.token = login.body.accessToken as string;
  });
  it('expires business access while retaining identity and recovery routes', async () => {
    await admin.subscription.update({
      where: { tenantId: tenantA },
      data: {
        periodStart: new Date(Date.now() - 3 * 86400000),
        periodEnd: new Date(Date.now() - 2 * 86400000),
      },
    });
    expect((await a.get('/members')).status).toBe(403);
    expect((await a.get('/auth/me')).body.entitlement.status).toBe('EXPIRED');
    expect((await a.get('/recovery/status')).status).toBe(200);
    expect((await a.get('/subscription')).status).toBe(200);
    expect(
      (await a.write('patch', '/tenant', { name: 'Expired edit', timezone: 'UTC' })).status,
    ).toBe(403);
  });
  it('recovers expired verification and lets a verified email choose an available subdomain', async () => {
    const email = `expired-${run}@example.test`;
    expect(
      (
        await platform.write('post', '/auth/registrations', {
          email,
          password,
          displayName: 'Expired Owner',
          tenantName: 'Expired flow fixture',
          desiredSubdomain: `expired-${run}`,
          consent: true,
        })
      ).status,
    ).toBe(202);
    const user = await admin.user.findUniqueOrThrow({ where: { email } });
    const oldToken = await queuedToken(email);
    await admin.identityToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await admin.onboardingRequest.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await platform.write('post', '/auth/verify-email', { token: oldToken })).status).toBe(
      422,
    );
    expect((await platform.write('post', '/auth/resend-verification', { email })).status).toBe(202);
    const token = await queuedToken(email);
    const before = await admin.tenant.count();
    expect(
      (
        await platform.write('post', '/auth/verify-email', {
          token,
          desiredSubdomain: `tenant-a-${run}`,
        })
      ).status,
    ).toBe(409);
    expect(await admin.tenant.count()).toBe(before);
    expect(
      (
        await platform.write('post', '/auth/verify-email', {
          token,
          desiredSubdomain: `recovered-${run}`,
        })
      ).status,
    ).toBe(200);
  });
  it('dead-letters an exhausted email lease left by a crashed worker', async () => {
    const job = await db.systemOutboxEvent.create({
      data: {
        dedupKey: `crashed:${run}`,
        encryptedPayload: 'unreadable-test-fixture',
        status: 'sending',
        attempts: 8,
        leaseUntil: new Date(Date.now() - 60000),
      },
    });
    await app.get(MailService).flush();
    expect((await db.systemOutboxEvent.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      'dead',
    );
  });
  it('delivers persisted email jobs through the real local SMTP server', async () => {
    await app.get(MailService).flush();
    const sent = await db.systemOutboxEvent.count({ where: { status: 'sent' } });
    expect(sent).toBeGreaterThan(0);
    const mailbox = await fetch('http://127.0.0.1:8025/api/v1/messages');
    expect(mailbox.ok).toBe(true);
    const data = (await mailbox.json()) as { total: number };
    expect(data.total).toBeGreaterThan(0);
    const sentJob = await db.systemOutboxEvent.findFirstOrThrow({ where: { status: 'sent' } });
    expect(sentJob.encryptedPayload).toBe('');
  });
});
