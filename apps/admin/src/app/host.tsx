import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, ErrorState, LoadingState, Logo } from '@showora/ui';
import { api, errorMessage } from '../lib/api';
interface HostInfo {
  isPlatform: boolean;
  hostname: string;
  baseDomain: string;
  platformOrigin: string;
}
const HostContext = createContext<HostInfo | null>(null);
export function HostProvider({ children }: { children: ReactNode }) {
  const query = useQuery<HostInfo>({
    queryKey: ['host'],
    queryFn: () => api('/auth/context'),
    retry: false,
    staleTime: Infinity,
  });
  if (query.isPending || query.error)
    return (
      <div className="app-start">
        <Logo />
        <Card>
          {query.error ? (
            <ErrorState
              message={errorMessage(query.error)}
              retry={() => {
                void query.refetch();
              }}
            />
          ) : (
            <LoadingState label="Đang kết nối không gian doanh nghiệp…" />
          )}
        </Card>
      </div>
    );
  return <HostContext.Provider value={query.data}>{children}</HostContext.Provider>;
}
export function useHost() {
  const value = useContext(HostContext);
  if (!value) throw new Error('Host provider missing');
  return value;
}
