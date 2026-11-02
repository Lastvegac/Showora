import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
export const secretToken = () => randomBytes(32).toString('hex');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function encryptMail(payload: unknown, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((v) => v.toString('base64url')).join('.');
}
export function decryptMail(value: string, key: string): unknown {
  const [iv, tag, data] = value.split('.');
  if (!iv || !tag || !data) throw new Error('Invalid mail payload');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString(
      'utf8',
    ),
  ) as unknown;
}
