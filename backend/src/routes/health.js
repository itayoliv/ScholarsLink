import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import { isDemoMode } from '../state.js';

const router = Router();

router.get('/health', (_req, res) => {
  const demoMode = isDemoMode();
  res.json({
    ok: true,
    service: 'scholarslink-api',
    demoMode,
    demoAccounts: demoMode ? demoStore.DEMO_ACCOUNTS : undefined,
  });
});

export default router;
