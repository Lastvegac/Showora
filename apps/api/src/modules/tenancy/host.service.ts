import { Inject, Injectable } from '@nestjs/common';
import { domainToASCII } from 'node:url';
import type { Request } from 'express';
import { SETTINGS, type Settings } from '../../common/config';
import { Database } from '../../common/database';
import { notFound } from '../../common/errors';

export interface HostContext {
  hostname: string;
  host: string;
  tenantId?: string;
}
export function normalizeHost(host: string): string {
  if (!/^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/.test(host)) throw notFound();
  const name = domainToASCII(host.replace(/:[0-9]+$/, '').toLowerCase());
  if (!name || name.endsWith('.') || name.length > 253 || name.includes('..')) throw notFound();
  return name;
}
@Injectable()
export class HostService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}
  async resolve(request: Request): Promise<HostContext> {
    const host = request.headers.host ?? '';
    const hostname = normalizeHost(host);
    if (hostname === this.settings.BASE_DOMAIN) return { hostname, host };
    const [domain] = await this.db.$queryRaw<
      { tenant_id: string }[]
    >`SELECT tenant_id FROM resolve_tenant_host(${hostname})`;
    if (!domain) throw notFound();
    return { hostname, host, tenantId: domain.tenant_id };
  }
  platformOrigin() {
    return this.settings.ADMIN_ORIGIN;
  }
  tenantOrigin(hostname: string) {
    const origin = new URL(this.settings.ADMIN_ORIGIN);
    origin.hostname = hostname;
    return origin.origin;
  }
}
