import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import {
  getWritableDynamicData,
  mergeDynamicColumns,
  updateDynamicColumns,
} from '../lib/dynamicColumns.js';
import { membershipInclude } from '../lib/includes.js';
import { parseId, parseOptionalDate } from '../lib/parse.js';
import { stripPasswordDeep } from '../lib/sanitize.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { prisma } from '../prisma.js';
import { demoUnavailable, isDemoMode } from '../state.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { active, studentId, placementId } = req.query;

  if (isDemoMode()) {
    return res.json(stripPasswordDeep(demoStore.listMemberships({
      studentId: studentId ? parseId(studentId, 'studentId') : undefined,
      placementId: placementId ? parseId(placementId, 'placementId') : undefined,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
    })));
  }

  const where = {
    ...(studentId ? { studentId: parseId(studentId, 'studentId') } : {}),
    ...(placementId ? { placementId: parseId(placementId, 'placementId') } : {}),
  };

  if (active === 'true') where.active = true;
  if (active === 'false') where.active = false;

  const memberships = await prisma.placementMembership.findMany({
    where,
    include: membershipInclude,
    orderBy: { startedAt: 'desc' },
  });

  res.json(await mergeDynamicColumns('memberships', stripPasswordDeep(memberships)));
}));

router.post('/', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Creating memberships');
  }
  const {
    studentId,
    placementId,
    active = true,
    startedAt,
    endedAt,
  } = req.body;
  const dynamicData = await getWritableDynamicData('memberships', req.body, [
    'studentId',
    'placementId',
    'active',
    'startedAt',
    'endedAt',
  ]);

  if (!studentId || !placementId) {
    return res.status(400).json({ error: 'studentId and placementId are required.' });
  }

  const membership = await prisma.$transaction(async (tx) => {
    const parsedStudentId = parseId(studentId, 'studentId');
    const parsedPlacementId = parseId(placementId, 'placementId');
    const isActive = Boolean(active);

    if (isActive) {
      await tx.placementMembership.updateMany({
        where: { studentId: parsedStudentId, active: true },
        data: { active: false, endedAt: new Date() },
      });
    }

    return tx.placementMembership.create({
      data: {
        studentId: parsedStudentId,
        placementId: parsedPlacementId,
        active: isActive,
        ...(startedAt ? { startedAt: parseOptionalDate(startedAt) } : {}),
        endedAt: endedAt ? parseOptionalDate(endedAt) : null,
      },
      include: membershipInclude,
    });
  });

  await updateDynamicColumns('memberships', membership.id, dynamicData);

  res.status(201).json(await mergeDynamicColumns('memberships', stripPasswordDeep(membership)));
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Updating memberships');
  }

  const id = parseId(req.params.id, 'id');
  const {
    studentId,
    placementId,
    active,
    startedAt,
    endedAt,
  } = req.body;
  const dynamicData = await getWritableDynamicData('memberships', req.body, [
    'studentId',
    'placementId',
    'active',
    'startedAt',
    'endedAt',
  ]);

  const membership = await prisma.$transaction(async (tx) => {
    const existing = await tx.placementMembership.findUniqueOrThrow({ where: { id } });
    const nextStudentId = studentId !== undefined ? parseId(studentId, 'studentId') : existing.studentId;
    const nextActive = active !== undefined ? Boolean(active) : existing.active;

    if (nextActive) {
      await tx.placementMembership.updateMany({
        where: { studentId: nextStudentId, active: true, NOT: { id } },
        data: { active: false, endedAt: new Date() },
      });
    }

    const data = {};
    if (studentId !== undefined) data.studentId = nextStudentId;
    if (placementId !== undefined) data.placementId = parseId(placementId, 'placementId');
    if (active !== undefined) data.active = nextActive;
    if (startedAt !== undefined) data.startedAt = parseOptionalDate(startedAt);
    if (endedAt !== undefined) data.endedAt = endedAt ? parseOptionalDate(endedAt) : null;

    return tx.placementMembership.update({
      where: { id },
      data,
      include: membershipInclude,
    });
  });

  await updateDynamicColumns('memberships', id, dynamicData);

  res.json(await mergeDynamicColumns('memberships', stripPasswordDeep(membership)));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Deleting memberships');
  }

  const id = parseId(req.params.id, 'id');

  await prisma.placementMembership.delete({ where: { id } });
  res.status(204).end();
}));

export default router;
