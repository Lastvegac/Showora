import { decryptMail, encryptMail, hashToken, secretToken } from './crypto';
describe('Stored secrets', () => {
  it('authenticates encrypted mail payloads and rejects tampering or a different key', () => {
    const key = secretToken();
    const payload = { to: 'private@example.test', text: secretToken() };
    const encrypted = encryptMail(payload, key);
    expect(encrypted).not.toContain(payload.to);
    expect(encrypted).not.toContain(payload.text);
    expect(decryptMail(encrypted, key)).toEqual(payload);
    expect(() => decryptMail(encrypted, secretToken())).toThrow();
    const pieces = encrypted.split('.');
    pieces[2] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptMail(pieces.join('.'), key)).toThrow();
  });
  it('generates independent opaque tokens and one-way lookup keys', () => {
    const first = secretToken();
    const second = secretToken();
    expect(first).not.toBe(second);
    expect(hashToken(first)).not.toBe(first);
    expect(hashToken(first)).toBe(hashToken(first));
  });
});
