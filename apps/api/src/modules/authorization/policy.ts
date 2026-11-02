import type { Permission, Scope } from '@showora/shared-types';
import { forbidden } from '../../common/errors';

export const permissionKeys = [
  'tenant.read',
  'tenant.write',
  'members.read',
  'members.manage',
  'roles.manage',
  'teams.manage',
  'domains.manage',
  'website.read',
  'website.write',
  'products.read',
  'products.write',
  'products.publish',
  'products.import',
  'products.export',
  'categories.read',
  'categories.write',
  'brands.read',
  'brands.write',
  'attributes.read',
  'attributes.write',
  'content.read',
  'content.write',
  'content.publish',
  'media.read',
  'media.write',
  'leads.read',
  'leads.update',
  'leads.assign',
  'leads.reopen',
  'leads.export',
  'notes.write',
  'activities.write',
  'reminders.write',
  'quotations.write',
  'reports.read',
  'billing.read',
  'billing.manage',
  'recovery.export',
  'audit.read',
] as const;
const cms = permissionKeys.filter((key) =>
  /^(products|categories|brands|attributes|content|media)\./.test(key),
);
const crm = [
  'leads.read',
  'leads.update',
  'notes.write',
  'activities.write',
  'reminders.write',
  'quotations.write',
  'reports.read',
];
const grants = (keys: readonly string[], scope: Scope = 'all'): Permission[] =>
  keys.map((key) => ({ key, scope }));
export const systemRoles = [
  { key: 'TENANT_OWNER', name: 'Chủ doanh nghiệp', permissions: grants(permissionKeys) },
  {
    key: 'TENANT_ADMIN',
    name: 'Quản trị viên',
    permissions: grants(permissionKeys.filter((key) => !/^(billing|recovery)\./.test(key))),
  },
  {
    key: 'CONTENT_EDITOR',
    name: 'Biên tập nội dung',
    permissions: grants([...cms, 'tenant.read', 'website.read']),
  },
  {
    key: 'SALES_MANAGER',
    name: 'Quản lý kinh doanh',
    permissions: [
      ...grants([...crm, 'leads.assign', 'leads.reopen', 'leads.export', 'members.read'], 'team'),
      ...grants(['tenant.read']),
    ],
  },
  {
    key: 'SALES',
    name: 'Nhân viên kinh doanh',
    permissions: [...grants(crm, 'own'), ...grants(['tenant.read'])],
  },
];
const ranks: Record<Scope, number> = { own: 0, team: 1, all: 2 };
export function allowedScopes(key: string): Scope[] {
  return key === 'members.read' ||
    /^(leads|notes|activities|reminders|quotations|reports)\./.test(key)
    ? ['own', 'team', 'all']
    : ['all'];
}
export function consolidatePermissions(grants: Permission[]): Permission[] {
  const permissions = new Map<string, Permission>();
  for (const grant of grants)
    if (
      !permissions.has(grant.key) ||
      ranks[grant.scope] > ranks[permissions.get(grant.key)!.scope]
    )
      permissions.set(grant.key, grant);
  return [...permissions.values()];
}
export function can(permissions: Permission[], key: string, scope: Scope = 'own') {
  return permissions.some((p) => p.key === key && ranks[p.scope] >= ranks[scope]);
}
export function assertDelegation(actor: Permission[], requested: Permission[]) {
  if (
    requested.some(
      (p) =>
        !permissionKeys.includes(p.key as (typeof permissionKeys)[number]) ||
        !allowedScopes(p.key).includes(p.scope) ||
        !can(actor, p.key, p.scope),
    )
  )
    throw forbidden();
}
