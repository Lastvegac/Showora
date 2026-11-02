import { normalizeHost } from './host.service';
describe('Host boundary', () => {
  it('normalizes a host without trusting ports or forwarded headers', () => {
    expect(normalizeHost('COMPANY.localhost:5173')).toBe('company.localhost');
  });
  it('rejects malformed and ambiguous host values', () => {
    for (const host of [
      'foo.localhost/path',
      'foo.localhost@evil.test',
      'foo..localhost',
      'foo.localhost.',
      'a,b',
      '',
    ])
      expect(() => normalizeHost(host)).toThrow();
  });
});
