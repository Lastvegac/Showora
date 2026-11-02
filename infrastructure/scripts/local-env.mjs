import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (existsSync(resolve(root, '.env')))
  throw new Error('.env already exists; refusing to replace credentials');
const secret = () => randomBytes(32).toString('hex');
const migrationPassword = secret();
const runtimePassword = secret();
mkdirSync(resolve(root, '.local'), { recursive: true });
writeFileSync(
  resolve(root, '.local/bootstrap.sql'),
  `CREATE ROLE showora_app LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;\nCREATE ROLE showora_resolver NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;\nGRANT USAGE ON SCHEMA public TO showora_app, showora_resolver;\n`,
  { mode: 0o600, flag: 'wx' },
);
writeFileSync(
  resolve(root, '.env'),
  `NODE_ENV=development\nAPI_PORT=4400\nPOSTGRES_PASSWORD=${migrationPassword}\nDATABASE_URL=postgresql://showora_app:${runtimePassword}@127.0.0.1:55432/showora?schema=public\nMIGRATION_DATABASE_URL=postgresql://showora_migrator:${migrationPassword}@127.0.0.1:55432/showora?schema=public\nJWT_SECRET=${secret()}\nCSRF_SECRET=${secret()}\nMAIL_ENCRYPTION_KEY=${secret()}\nBASE_DOMAIN=localhost\nADMIN_ORIGIN=http://localhost:5178\nSMTP_HOST=127.0.0.1\nSMTP_PORT=1025\nSMTP_SECURE=false\nMAIL_FROM=hello@showora.localhost\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Generated .env and .local/bootstrap.sql with random local credentials. No production configuration was created.',
);
