import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import { adminEntities } from '../config/adminEntities.js';
import { getAdminEntitySchema } from '../lib/dynamicColumns.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { prisma } from '../prisma.js';
import { demoUnavailable, isDemoMode } from '../state.js';

const router = Router();
const execAsync = promisify(exec);

router.get('/schema', asyncHandler(async (req, res) => {
  await requireAdmin(req);

  if (isDemoMode()) {
    return res.json({ entities: demoStore.getStaticAdminSchemas() });
  }

  const schemas = await Promise.all(
    Object.keys(adminEntities).map((entity) => getAdminEntitySchema(entity)),
  );

  res.json({ entities: schemas });
}));

router.get('/schema/:entity', asyncHandler(async (req, res) => {
  await requireAdmin(req);

  if (isDemoMode()) {
    const schema = demoStore.getStaticAdminSchemas().find((item) => item.entity === req.params.entity);
    if (!schema) {
      return res.status(404).json({ error: 'Unknown admin entity.' });
    }
    return res.json(schema);
  }

  res.json(await getAdminEntitySchema(req.params.entity));
}));

router.post('/schema/refresh', asyncHandler(async (req, res) => {
  await requireAdmin(req);

  if (isDemoMode()) {
    throw demoUnavailable('Schema refresh');
  }

  const logs = [];
  let generateWarning = null;

  try {
    const pull = await execAsync('npx prisma db pull', {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 4,
      windowsHide: true,
    });
    logs.push(pull.stdout, pull.stderr);
  } catch (error) {
    const details = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n');
    const refreshError = new Error(`Prisma db pull failed.\n${details}`);
    refreshError.status = 500;
    throw refreshError;
  }

  try {
    const generate = await execAsync('npx prisma generate', {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 4,
      windowsHide: true,
    });
    logs.push(generate.stdout, generate.stderr);
  } catch (error) {
    generateWarning = [
      'Prisma client generate could not finish while the API is running (common on Windows file locks).',
      'schema.prisma was updated from the database. Restart the backend or run refresh-schema.bat to finish generate.',
      error.message,
    ].join(' ');
    logs.push(error.stdout, error.stderr, error.message);
  }

  const schemas = await Promise.all(
    Object.keys(adminEntities).map((entity) => getAdminEntitySchema(entity)),
  );

  res.json({
    ok: true,
    warning: generateWarning,
    output: logs.filter(Boolean).join('\n'),
    entities: schemas,
  });
}));

router.get('/summary', asyncHandler(async (_req, res) => {
  if (isDemoMode()) {
    return res.json(demoStore.getAdminSummary());
  }

  const [students, supervisors, placements, pendingJoinRequests, pendingHourLogs, approvedHours] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'SUPERVISOR' } }),
    prisma.placement.count(),
    prisma.joinRequest.count({ where: { status: 'PENDING' } }),
    prisma.hourLog.count({ where: { status: 'PENDING' } }),
    prisma.hourLog.aggregate({
      where: { status: 'APPROVED' },
      _sum: { hours: true },
    }),
  ]);

  res.json({
    students,
    supervisors,
    placements,
    pendingJoinRequests,
    pendingHourLogs,
    approvedHours: approvedHours._sum.hours || 0,
  });
}));

export default router;
