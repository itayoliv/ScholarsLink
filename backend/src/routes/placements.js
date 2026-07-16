import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import {
  getWritableDynamicData,
  mergeDynamicColumns,
  updateDynamicColumns,
} from '../lib/dynamicColumns.js';
import { placementInclude } from '../lib/includes.js';
import { parseId } from '../lib/parse.js';
import { stripPasswordDeep } from '../lib/sanitize.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { prisma } from '../prisma.js';
import { demoUnavailable, isDemoMode } from '../state.js';

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { name, description, supervisorId } = req.body;

  if (!name || !supervisorId) {
    return res.status(400).json({ error: 'name and supervisorId are required.' });
  }

  if (isDemoMode()) {
    const placement = demoStore.createPlacement({
      name,
      description,
      supervisorId: parseId(supervisorId, 'supervisorId'),
    });
    return res.status(201).json(stripPasswordDeep(placement));
  }

  const dynamicData = await getWritableDynamicData('placements', req.body, ['name', 'description', 'supervisorId']);
  const placement = await prisma.placement.create({
    data: {
      name,
      description,
      supervisorId: parseId(supervisorId, 'supervisorId'),
    },
    include: placementInclude,
  });

  await updateDynamicColumns('placements', placement.id, dynamicData);

  res.status(201).json(await mergeDynamicColumns('placements', stripPasswordDeep(placement)));
}));

router.get('/', asyncHandler(async (req, res) => {
  const { supervisorId } = req.query;

  if (isDemoMode()) {
    return res.json(stripPasswordDeep(demoStore.listPlacements({
      supervisorId: supervisorId ? parseId(supervisorId, 'supervisorId') : undefined,
    })));
  }

  const placements = await prisma.placement.findMany({
    where: supervisorId
      ? { supervisorId: parseId(supervisorId, 'supervisorId') }
      : undefined,
    include: placementInclude,
    orderBy: { name: 'asc' },
  });

  res.json(await mergeDynamicColumns('placements', stripPasswordDeep(placements)));
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Updating placements');
  }
  const id = parseId(req.params.id, 'id');
  const { name, description, supervisorId } = req.body;
  const dynamicData = await getWritableDynamicData('placements', req.body, ['name', 'description', 'supervisorId']);
  const data = {};

  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description || null;
  if (supervisorId !== undefined) data.supervisorId = parseId(supervisorId, 'supervisorId');

  const placement = await prisma.placement.update({
    where: { id },
    data,
    include: placementInclude,
  });

  await updateDynamicColumns('placements', id, dynamicData);

  res.json(await mergeDynamicColumns('placements', stripPasswordDeep(placement)));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Deleting placements');
  }

  const id = parseId(req.params.id, 'id');

  await prisma.$transaction(async (tx) => {
    await tx.hourLog.deleteMany({ where: { placementId: id } });
    await tx.placementMembership.deleteMany({ where: { placementId: id } });
    await tx.joinRequest.deleteMany({ where: { placementId: id } });
    await tx.placement.delete({ where: { id } });
  });

  res.status(204).end();
}));

export default router;
