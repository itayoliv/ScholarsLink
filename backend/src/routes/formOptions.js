import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import { FORM_OPTION_FIELD_KEYS } from '../config/constants.js';
import { parseId } from '../lib/parse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getUserFromSession, requireAdmin } from '../middleware/auth.js';
import { prisma } from '../prisma.js';
import { demoUnavailable, isDemoMode } from '../state.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  if (isDemoMode()) {
    return res.json(demoStore.listFormOptions());
  }

  const options = await prisma.formOption.findMany({
    orderBy: [{ fieldKey: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
  });

  res.json(options);
}));

router.post('/', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Creating form options');
  }

  await requireAdmin(req);
  const { fieldKey, value, label, sortOrder = 0, active = true } = req.body;

  if (!FORM_OPTION_FIELD_KEYS.has(fieldKey) || !value || !label) {
    return res.status(400).json({ error: 'fieldKey, value, and label are required.' });
  }

  const option = await prisma.formOption.create({
    data: {
      fieldKey,
      value: String(value),
      label: String(label),
      sortOrder: Number(sortOrder) || 0,
      active: Boolean(active),
    },
  });

  res.status(201).json(option);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Updating form options');
  }

  await requireAdmin(req);
  const id = parseId(req.params.id, 'id');
  const { fieldKey, value, label, sortOrder, active } = req.body;
  const data = {};

  if (fieldKey !== undefined) {
    if (!FORM_OPTION_FIELD_KEYS.has(fieldKey)) {
      return res.status(400).json({ error: 'fieldKey must be valid.' });
    }
    data.fieldKey = fieldKey;
  }

  if (value !== undefined) data.value = String(value);
  if (label !== undefined) data.label = String(label);
  if (sortOrder !== undefined) data.sortOrder = Number(sortOrder) || 0;
  if (active !== undefined) data.active = Boolean(active);

  const option = await prisma.formOption.update({ where: { id }, data });
  res.json(option);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Deleting form options');
  }

  await requireAdmin(req);
  const id = parseId(req.params.id, 'id');
  await prisma.formOption.delete({ where: { id } });
  res.status(204).end();
}));

export default router;
