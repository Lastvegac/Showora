import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '');
  const origin = new URL(env.ADMIN_ORIGIN ?? 'http://localhost:5178');
  const domain = env.BASE_DOMAIN ?? 'localhost';
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('/node_modules/')) return;
            if (/\/(react-router|react-router-dom)\//.test(id)) return 'router';
            if (/\/(react|react-dom|scheduler)\//.test(id)) return 'framework';
            if (id.includes('/@tanstack/')) return 'query';
          },
        },
      },
    },
    server: {
      port: Number(origin.port || 80),
      strictPort: true,
      allowedHosts: [domain, `.${domain}`],
      proxy: {
        '/api': { target: `http://127.0.0.1:${env.API_PORT ?? 4400}`, changeOrigin: false },
      },
    },
  };
});
