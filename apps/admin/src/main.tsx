import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SessionProvider } from './app/session';
import { HostProvider } from './app/host';
import { router } from './app/router';
import '@showora/ui/styles.css';
import './styles.css';
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <HostProvider>
        <SessionProvider>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" richColors />
        </SessionProvider>
      </HostProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
