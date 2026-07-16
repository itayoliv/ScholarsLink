import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import { parseId } from '../lib/parse.js';
import { stripPassword, stripPasswordDeep } from '../lib/sanitize.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { prisma } from '../prisma.js';
import { isDemoMode } from '../state.js';

const router = Router();

router.get('/:id/summary', asyncHandler(async (req, res) => {
  const studentId = parseId(req.params.id, 'id');

  if (isDemoMode()) {
    const summary = demoStore.getStudentSummary(studentId);
    if (!summary) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    return res.json(stripPasswordDeep(summary));
  }

  const student = await prisma.user.findUnique({ where: { id: studentId } });

  if (!student || student.role !== 'STUDENT') {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const [membership, approvedHours] = await Promise.all([
    prisma.placementMembership.findFirst({
      where: { studentId, active: true },
      include: {
        placement: { include: { supervisor: true } },
      },
    }),
    prisma.hourLog.aggregate({
      where: { studentId, status: 'APPROVED' },
      _sum: { hours: true },
    }),
  ]);

  res.json(stripPasswordDeep({
    student: stripPassword(student),
    currentPlacement: membership?.placement || null,
    membership: membership
      ? {
          id: membership.id,
          startedAt: membership.startedAt,
          active: membership.active,
        }
      : null,
    approvedHours: approvedHours._sum.hours || 0,
  }));
}));

export default router;
