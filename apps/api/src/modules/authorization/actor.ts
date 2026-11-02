import type { Request } from 'express';
import type { Permission } from '@showora/shared-types';
import type { HostContext } from '../tenancy/host.service';
export interface Actor {
  userId: string;
  tenantId: string;
  memberId: string;
  sessionId: string;
  permissions: Permission[];
  requestId: string;
}
export interface AppRequest extends Request {
  actor: Actor;
  hostContext: HostContext;
  requestId: string;
}
