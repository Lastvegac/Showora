import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Database } from '../../common/database';
import { hashToken, secretToken } from '../../common/crypto';
import { ApiError } from '../../common/errors';
import { HostService } from '../tenancy/host.service';
import { MailService } from '../notifications/mail.service';
@Injectable()
export class PasswordService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(HostService) private readonly hosts: HostService,
  ) {}
  async forgot(email: string) {
    await this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { email } });
      if (!user || !user.emailVerifiedAt || user.disabledAt) return;
      const token = secretToken();
      const record = await tx.identityToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          purpose: 'RESET_PASSWORD',
          expiresAt: new Date(Date.now() + 30 * 60000),
        },
      });
      await this.mail.queue(
        tx,
        `reset:${record.id}`,
        email,
        'Đặt lại mật khẩu SHOWORA',
        `Liên kết có hiệu lực 30 phút:\n${this.hosts.platformOrigin()}/reset-password?token=${token}`,
      );
    });
    return { message: 'Nếu thông tin hợp lệ, email hướng dẫn sẽ được gửi đến bạn.' };
  }
  async reset(token: string, password: string) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.db.$transaction(async (tx) => {
      const tokenHash = hashToken(token);
      await tx.$queryRaw`SELECT id FROM identity_tokens WHERE token_hash = ${tokenHash} FOR UPDATE`;
      const record = await tx.identityToken.findUnique({ where: { tokenHash } });
      if (
        !record ||
        record.purpose !== 'RESET_PASSWORD' ||
        record.consumedAt ||
        record.expiresAt < new Date()
      )
        throw new ApiError(422, 'INVALID_TOKEN', 'Liên kết không hợp lệ hoặc đã hết hạn.');
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${record.userId}::uuid FOR UPDATE`;
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.identityToken.updateMany({
        where: { userId: record.userId, purpose: 'RESET_PASSWORD', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { message: 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.' };
  }
}
