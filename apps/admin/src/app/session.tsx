import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AuthResponse, Viewer } from '@showora/shared-types';
import type { LoginInput } from '@showora/shared-validation';
import { api, HttpError, jsonBody, refreshSession, setAccessToken } from '../lib/api';
import { useHost } from './host';

const SessionContext = createContext<{
  viewer: Viewer | null | undefined;
  loading: boolean;
  error: unknown;
  retry: () => void;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  can: (key: string) => boolean;
} | null>(null);
async function clearSession(client: QueryClient) {
  setAccessToken(null);
  await client.cancelQueries({ predicate: (query) => query.queryKey[0] !== 'host' });
  client.setQueryData(['viewer'], null);
  client.removeQueries({
    predicate: (query) => !['host', 'viewer'].includes(String(query.queryKey[0])),
  });
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const host = useHost();
  const query = useQuery<Viewer | null>({
    queryKey: ['viewer'],
    enabled: !host.isPlatform,
    queryFn: async () => {
      try {
        await refreshSession();
        return await api<Viewer>('/auth/me');
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 300000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    const clear = () => {
      void clearSession(client);
    };
    window.addEventListener('showora:session-expired', clear);
    return () => window.removeEventListener('showora:session-expired', clear);
  }, [client]);
  const login = async (input: LoginInput) => {
    const value = await api<AuthResponse>('/auth/login', jsonBody(input));
    setAccessToken(value.accessToken);
    const viewer = await api<Viewer>('/auth/me');
    client.setQueryData(['viewer'], viewer);
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    await clearSession(client);
  };
  return (
    <SessionContext.Provider
      value={{
        viewer: query.data,
        loading: !host.isPlatform && query.isPending,
        error: query.error,
        retry: () => {
          void query.refetch();
        },
        login,
        logout,
        can: (key) => query.data?.permissions.some((p) => p.key === key) ?? false,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Session provider missing');
  return value;
}
