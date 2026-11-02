export type Scope = 'own' | 'team' | 'all';
export interface Permission {
  key: string;
  scope: Scope;
}
export interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: Permission[];
}
export interface Member {
  id: string;
  displayName: string;
  email: string;
  status: string;
  roles: Pick<Role, 'id' | 'key' | 'name'>[];
  createdAt: string;
}
export interface Tenant {
  id: string;
  name: string;
  timezone: string;
  status: string;
  hostname: string;
}
export interface Entitlement {
  status: string;
  writable: boolean;
  planName: string;
  endsAt: string;
  staffLimit: number;
  staffUsed: number;
}
export interface Viewer {
  user: { id: string; email: string; displayName: string };
  tenant: Tenant;
  memberId: string;
  permissions: Permission[];
  entitlement: Entitlement;
}
export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
}
export interface Team {
  id: string;
  name: string;
  members: { memberId: string; role: 'manager' | 'sales'; displayName: string }[];
}
export interface Page<T> {
  data: T[];
  page: { nextCursor: string | null; hasMore: boolean };
}
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
  };
}
