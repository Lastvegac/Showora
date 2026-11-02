import { useSession } from './session';
export function useTenantKey(resource: string) {
  const { viewer } = useSession();
  return [resource, viewer?.tenant.id, viewer?.memberId, viewer?.permissions] as const;
}
