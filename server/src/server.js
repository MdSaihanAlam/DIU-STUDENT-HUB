import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { startReminderJob } from './services/reminders.js';
import { ensureStarterDepartments } from './services/bootstrap.js';

const useMemory = process.argv.includes('--memory');

async function main() {
  if (useMemory && env.isProd) throw new Error('--memory is for local development only');
  const uri = await connectDB(env.mongoUri, { memory: useMemory });
  console.log(`[db] connected${useMemory ? ' (in-memory, data resets on restart)' : ''}`);

  if (useMemory) {
    const { seed } = await import('../scripts/seed.js');
    await seed({ uri, connected: true });
  } else {
    await ensureStarterDepartments();
  }

  const app = createApp();
  const server = app.listen(env.port, () => console.log(`[api] listening on http://localhost:${env.port}/api/v1`));
  const stopJobs = startReminderJob();

  const shutdown = async () => {
    stopJobs();
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
