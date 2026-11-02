import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { LoginInput } from '@showora/shared-validation';
import { randomUUID } from 'node:crypto';
import { Database, type Tx } from '../../common/database';
import { SETTINGS, type Settings } from '../../common/config';
import { hashToken, secretToken } from '../../common/crypto';
import { unauthorized } from '../../common/errors';
import type { Actor } from '../authorization/actor';

@Injectable()
export class SessionService {
  private readonly dummyHash = argon2.hash(secretToken(), { type: argon2.argon2id });
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}
  private async access(
    userId: string,
    tenantId: string,
    memberId: string,
    sessionId: string,
    v: number,
  ) {
    return this.jwt.signAsync(
      { sub: userId, tenantId, memberId, sid: sessionId, v, jti: randomUUID() },
      {
        secret: this.settings.JWT_SECRET,
        algorithm: 'HS256',
        issuer: 'showora',
        audience: 'tenant',
        expiresIn: 600,
      },
    );
  }
  async create(
    tx: Tx,
    userId: string,
    tenantId: string,
    memberId: string,
    authzVersion: number,
    requestId: string,
  ) {
    const expiresAt = new Date(Date.now() + 14 * 86400000);
    const session = await tx.authSession.create({
      data: { userId, tenantId, memberId, expiresAt },
    });
    const refreshToken = secretToken();
    await tx.refreshToken.create({
      data: { sessionId: session.id, tokenHash: hashToken(refreshToken), expiresAt },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'auth.session_created',
        entityId: session.id,
        requestId,
      },
    });
    return {
      accessToken: await this.access(userId, tenantId, memberId, session.id, authzVersion),
      refreshToken,
      expiresIn: 600,
    };
  }
  async login(input: LoginInput, tenantId: string, requestId: string) {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const valid = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), input.password);
    if (!valid || !user || !user.emailVerifiedAt || user.disabledAt) throw unauthorized();
    return this.db.scoped(tenantId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
      const currentUser = await tx.user.findUnique({ where: { id: user.id } });
      if (
        !currentUser ||
        currentUser.passwordHash !== user.passwordHash ||
        currentUser.disabledAt ||
        !currentUser.emailVerifiedAt
      )
        throw unauthorized();
      const member = await tx.tenantMember.findFirst({
        where: { tenantId, userId: user.id, status: 'active' },
      });
      if (!member) throw unauthorized();
      return this.create(tx, user.id, tenantId, member.id, member.authzVersion, requestId);
    });
  }
  async refresh(raw: string, tenantId: string, requestId: string) {
    const result = await this.db.scoped(tenantId, async (tx) => {
      const tokenHash = hashToken(raw);
      await tx.$queryRaw`SELECT id FROM refresh_tokens WHERE token_hash = ${tokenHash} FOR UPDATE`;
      const token = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { session: { include: { user: true } } },
      });
      if (!token || token.session.tenantId !== tenantId) return null;
      if (token.consumedAt) {
        await tx.authSession.update({
          where: { id: token.sessionId },
          data: { revokedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            actorId: token.session.userId,
            action: 'auth.refresh_replay',
            entityId: token.sessionId,
            requestId,
          },
        });
        return null;
      }
      const session = token.session;
      if (
        token.expiresAt < new Date() ||
        session.expiresAt < new Date() ||
        session.revokedAt ||
        session.user.disabledAt
      )
        return null;
      const member = await tx.tenantMember.findFirst({
        where: { tenantId, id: session.memberId, userId: session.userId, status: 'active' },
      });
      if (!member) return null;
      const refreshToken = secretToken();
      await tx.refreshToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
      await tx.refreshToken.create({
        data: {
          sessionId: session.id,
          parentId: token.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: session.expiresAt,
        },
      });
      return {
        accessToken: await this.access(
          session.userId,
          tenantId,
          member.id,
          session.id,
          member.authzVersion,
        ),
        refreshToken,
        expiresIn: 600,
      };
    });
    if (!result) throw unauthorized();
    return result;
  }
  async logout(raw: string | undefined, tenantId: string, requestId: string) {
    if (!raw) return;
    await this.db.scoped(tenantId, async (tx) => {
      const token = await tx.refreshToken.findUnique({
        where: { tokenHash: hashToken(raw) },
        include: { session: true },
      });
      if (token?.session.tenantId === tenantId) {
        await tx.authSession.update({
          where: { id: token.sessionId },
          data: { revokedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            actorId: token.session.userId,
            action: 'auth.session_ended',
            entityId: token.sessionId,
            requestId,
          },
        });
      }
    });
  }
  list(actor: Actor) {
    return this.db.authSession.findMany({
      where: { userId: actor.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, tenantId: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async revoke(actor: Actor, id: string) {
    await this.db.authSession.updateMany({
      where: { id, userId: actor.userId },
      data: { revokedAt: new Date() },
    });
  }
}
