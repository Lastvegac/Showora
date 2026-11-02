import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { SETTINGS, type Settings } from '../../common/config';
import { Database, type Tx } from '../../common/database';
import { encryptMail, decryptMail } from '../../common/crypto';

const mailSchema = z.object({ to: z.string().email(), subject: z.string(), text: z.string() });
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}
  queue(tx: Tx, key: string, to: string, subject: string, text: string) {
    return tx.systemOutboxEvent.create({
      data: {
        dedupKey: key,
        encryptedPayload: encryptMail({ to, subject, text }, this.settings.MAIL_ENCRYPTION_KEY),
      },
    });
  }
  onModuleInit() {
    if (this.settings.NODE_ENV !== 'test')
      this.timer = setInterval(() => {
        void this.flush();
      }, 2000);
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    while (this.running) await new Promise((resolve) => setTimeout(resolve, 20));
  }
  async flush() {
    if (this.running) return;
    this.running = true;
    const transport = nodemailer.createTransport({
      host: this.settings.SMTP_HOST,
      port: this.settings.SMTP_PORT,
      secure: this.settings.SMTP_SECURE === 'true',
      auth: this.settings.SMTP_USER
        ? { user: this.settings.SMTP_USER, pass: this.settings.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 5000,
      socketTimeout: 10000,
    });
    try {
      await this.db.systemOutboxEvent.updateMany({
        where: { status: 'sending', attempts: { gte: 8 }, leaseUntil: { lt: new Date() } },
        data: { status: 'dead', leaseUntil: null },
      });
      const jobs = await this.db.$queryRaw<
        { id: string; encrypted_payload: string; attempts: number }[]
      >`UPDATE system_outbox_events SET status = 'sending', attempts = attempts + 1, lease_until = now() + interval '60 seconds' WHERE id IN (SELECT id FROM system_outbox_events WHERE ((status = 'pending' AND available_at <= now()) OR (status = 'sending' AND lease_until < now())) AND attempts < 8 ORDER BY available_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING id, encrypted_payload, attempts`;
      for (const job of jobs) {
        try {
          const mail = mailSchema.parse(
            decryptMail(job.encrypted_payload, this.settings.MAIL_ENCRYPTION_KEY),
          );
          await transport.sendMail({
            ...mail,
            from: this.settings.MAIL_FROM,
            messageId: `<${job.id}@${this.settings.BASE_DOMAIN}>`,
          });
          await this.db.systemOutboxEvent.update({
            where: { id: job.id },
            data: {
              status: 'sent',
              deliveredAt: new Date(),
              leaseUntil: null,
              encryptedPayload: '',
            },
          });
        } catch {
          await this.db.systemOutboxEvent.update({
            where: { id: job.id },
            data: {
              status: job.attempts >= 8 ? 'dead' : 'pending',
              leaseUntil: null,
              availableAt: new Date(
                Date.now() +
                  Math.min(3600000, 2000 * 2 ** job.attempts) +
                  Math.floor(Math.random() * 1000),
              ),
            },
          });
          console.error(
            JSON.stringify({
              event: 'mail.delivery_failed',
              jobId: job.id,
              attempts: job.attempts,
            }),
          );
        }
      }
    } catch {
      console.error(JSON.stringify({ event: 'mail.poll_failed' }));
    } finally {
      transport.close();
      this.running = false;
    }
  }
}
