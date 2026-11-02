import { effectiveStatus } from './entitlement.service';
describe('Subscription clock policy', () => {
  const now = new Date('2026-11-02T00:00:00Z');
  const future = new Date('2026-11-03T00:00:00Z');
  const past = new Date('2026-11-01T00:00:00Z');
  it('expires trials and active periods at the boundary', () => {
    expect(effectiveStatus('active', 'TRIALING', now, null, now)).toBe('EXPIRED');
    expect(effectiveStatus('active', 'ACTIVE', future, null, now)).toBe('ACTIVE');
  });
  it('requires a live grace period and lets suspension override dates', () => {
    expect(effectiveStatus('active', 'PAST_DUE', past, future, now)).toBe('PAST_DUE');
    expect(effectiveStatus('active', 'PAST_DUE', past, past, now)).toBe('EXPIRED');
    expect(effectiveStatus('suspended', 'ACTIVE', future, null, now)).toBe('SUSPENDED');
  });
});
