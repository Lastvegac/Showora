import { assertDelegation, can, consolidatePermissions } from './policy';
describe('Permission boundaries', () => {
  it('never lets a delegator widen a scope or invent permissions', () => {
    expect(() =>
      assertDelegation(
        [{ key: 'leads.read', scope: 'team' }],
        [{ key: 'leads.read', scope: 'all' }],
      ),
    ).toThrow();
    expect(() =>
      assertDelegation(
        [{ key: 'roles.manage', scope: 'all' }],
        [{ key: 'platform.tenants.write', scope: 'all' }],
      ),
    ).toThrow();
    expect(() =>
      assertDelegation(
        [{ key: 'leads.read', scope: 'team' }],
        [{ key: 'leads.read', scope: 'own' }],
      ),
    ).not.toThrow();
  });
  it('unions grants using the widest authorized scope', () => {
    expect(
      consolidatePermissions([
        { key: 'leads.read', scope: 'own' },
        { key: 'leads.read', scope: 'team' },
      ]),
    ).toEqual([{ key: 'leads.read', scope: 'team' }]);
    expect(can([], 'leads.read')).toBe(false);
  });
});
