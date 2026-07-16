import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import { validRoles } from '../config/constants.js';
import {
  getWritableDynamicData,
  mergeDynamicColumns,
  updateDynamicColumns,
} from '../lib/dynamicColumns.js';
import { encryptPassword } from '../lib/passwords.js';
import { parseId } from '../lib/parse.js';
import { stripPassword } from '../lib/sanitize.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { prisma } from '../prisma.js';
import { demoUnavailable, isDemoMode } from '../state.js';

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !validRoles.has(role)) {
    return res.status(400).json({ error: 'name, email, password, and a valid role are required.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters.' });
  }

  if (isDemoMode()) {
    if (demoStore.findUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const user = demoStore.createUser({
      name,
      email,
      password,
      role,
      phone: req.body.phone || null,
    });
    return res.status(201).json(stripPassword(user));
  }

  const dynamicData = await getWritableDynamicData('users', req.body, ['name', 'email', 'password', 'role']);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const encryptedPassword = await encryptPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: encryptedPassword,
      role,
    },
  });

  await updateDynamicColumns('users', user.id, dynamicData);

  res.status(201).json(await mergeDynamicColumns('users', stripPassword(user)));
}));

router.get('/', asyncHandler(async (req, res) => {
  const { role } = req.query;

  if (isDemoMode()) {
    return res.json(demoStore.listUsers({
      role: role && validRoles.has(role) ? role : undefined,
    }));
  }

  const users = await prisma.user.findMany({
    where: role && validRoles.has(role) ? { role } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  res.json(await mergeDynamicColumns('users', users.map(stripPassword)));
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Updating users');
  }
  const id = parseId(req.params.id, 'id');
  const { name, email, password, role } = req.body;
  const dynamicData = await getWritableDynamicData('users', req.body, ['name', 'email', 'password', 'role']);
  const data = {};

  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;

  if (role !== undefined) {
    if (!validRoles.has(role)) {
      return res.status(400).json({ error: 'role must be valid.' });
    }

    data.role = role;
  }

  if (password) {
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters.' });
    }

    data.password = await encryptPassword(password);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
  });

  await updateDynamicColumns('users', id, dynamicData);

  res.json(await mergeDynamicColumns('users', stripPassword(user)));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Deleting users');
  }

  const id = parseId(req.params.id, 'id');

  await prisma.$transaction(async (tx) => {
    const placements = await tx.placement.findMany({
      where: { supervisorId: id },
      select: { id: true },
    });
    const placementIds = placements.map((placement) => placement.id);

    await tx.joinRequest.updateMany({
      where: { reviewedById: id },
      data: { reviewedById: null, reviewedAt: null },
    });
    await tx.hourLog.updateMany({
      where: { reviewedById: id },
      data: { reviewedById: null, reviewedAt: null },
    });

    if (placementIds.length > 0) {
      await tx.hourLog.deleteMany({ where: { placementId: { in: placementIds } } });
      await tx.placementMembership.deleteMany({ where: { placementId: { in: placementIds } } });
      await tx.joinRequest.deleteMany({ where: { placementId: { in: placementIds } } });
      await tx.placement.deleteMany({ where: { id: { in: placementIds } } });
    }

    await tx.hourLog.deleteMany({ where: { studentId: id } });
    await tx.placementMembership.deleteMany({ where: { studentId: id } });
    await tx.joinRequest.deleteMany({ where: { studentId: id } });
    await tx.user.delete({ where: { id } });
  });

  res.status(204).end();
}));

export default router;
