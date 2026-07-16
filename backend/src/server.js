import './env.js';
import app from './app.js';
import { PORT } from './env.js';
import { prisma } from './prisma.js';
import { isDemoMode, setDemoMode } from './state.js';

async function startServer() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    setDemoMode(false);
    console.log('ScholarsLink API connected to MySQL (live mode).');
  } catch (error) {
    setDemoMode(true);
    console.warn('============================================================');
    console.warn(' MySQL unreachable — ScholarsLink API running in DEMO MODE');
    console.warn(' Login with: adm@gmail.com / sup@gmail.com / stu1@gmail.com / stu2@gmail.com');
    console.warn(' Password: 123456');
    console.warn(` Reason: ${error.message}`);
    console.warn('============================================================');
  }

  app.listen(PORT, () => {
    console.log(`ScholarsLink API listening on http://localhost:${PORT}${isDemoMode() ? ' [demoMode]' : ''}`);
  });
}

startServer();
