import { createApp } from './app';
import { SETTINGS, type Settings } from './common/config';
async function main() {
  const app = await createApp();
  await app.listen(app.get<Settings>(SETTINGS).API_PORT, '0.0.0.0');
}
main().catch(() => {
  console.error(
    'SHOWORA could not start. Check environment, database role and applied migrations.',
  );
  process.exitCode = 1;
});
