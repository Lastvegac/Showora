import { describe, expect, it } from 'vitest';
import { registrationSchema, roleSchema, subdomain, teamSchema } from './index';

describe('Untrusted API input', () => {
  it('rejects tenant and role injection during registration', () => {
    const input = {
      email: 'owner@example.test',
      password: 'a long passphrase',
      displayName: 'Owner',
      tenantName: 'Company',
      desiredSubdomain: 'company',
      consent: true,
    };
    expect(registrationSchema.safeParse(input).success).toBe(true);
    expect(
      registrationSchema.safeParse({ ...input, tenant_id: 'other', role: 'SUPER_ADMIN' }).success,
    ).toBe(false);
  });
  it('rejects unsafe and reserved host labels', () => {
    for (const value of ['admin', 'foo.bar', '../tenant', '-tenant', 'tenant-', 'a'.repeat(41)])
      expect(subdomain.safeParse(value).success).toBe(false);
  });
  it('does not allow duplicate grants or team members', () => {
    expect(
      roleSchema.safeParse({
        name: 'Custom',
        permissions: [
          { key: 'leads.read', scope: 'own' },
          { key: 'leads.read', scope: 'all' },
        ],
      }).success,
    ).toBe(false);
    const member = { memberId: '00000000-0000-4000-8000-000000000001', role: 'sales' };
    expect(teamSchema.safeParse({ name: 'Team', members: [member, member] }).success).toBe(false);
  });
});
