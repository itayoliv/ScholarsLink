import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import { validHoursStatuses } from '../config/constants.js';
import {
  getWritableDynamicData,
  mergeDynamicColumns,
  updateDynamicColumns,
} from '../lib/dynamicColumns.js';
import { hourLogInclude } from '../lib/includes.js';
import { parseId, parseOptionalDate, parseOptionalId } from '../lib/parse.js';
import { stripPasswordDeep } from '../lib/sanitize.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { prisma } from '../prisma.js';
import { demoUnavailable, isDemoMode } from '../state.js';

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { studentId, placementId, date, hours, description } = req.body;

  if (!studentId || !placementId || !date || !hours) {
    return res.status(400).json({ error: 'studentId, placementId, date, and hours are required.' });
  }

  if (isDemoMode()) {
    const hourLog = demoStore.createHourLog({
      studentId: parseId(studentId, 'studentId'),
      placementId: parseId(placementId, 'placementId'),
      date,
      hours,
      description,
    });
    return res.status(201).json(stripPasswordDeep(hourLog));
  }

  const dynamicData = await getWritableDynamicData('hour-logs', req.body, [
    'studentId',
    'placementId',
    'date',
    'hours',
    'description',
  ]);

  const hourLog = await prisma.hourLog.create({
    data: {
      studentId: parseId(studentId, 'studentId'),
      placementId: parseId(placementId, 'placementId'),
      date: new Date(date),
      hours,
      description,
    },
    include: hourLogInclude,
  });

  await updateDynamicColumns('hour-logs', hourLog.id, dynamicData);

  res.status(201).json(await mergeDynamicColumns('hour-logs', stripPasswordDeep(hourLog)));
}));

router.get('/', asyncHandler(async (req, res) => {
  const { status, supervisorId, studentId } = req.query;

  if (isDemoMode()) {
    return res.json(stripPasswordDeep(demoStore.listHourLogs({
      status: status && validHoursStatuses.has(status) ? status : undefined,
      studentId: studentId ? parseId(studentId, 'studentId') : undefined,
      supervisorId: supervisorId ? parseId(supervisorId, 'supervisorId') : undefined,
    })));
  }

  const hourLogs = await prisma.hourLog.findMany({
    where: {
      ...(status && validHoursStatuses.has(status) ? { status } : {}),
      ...(studentId ? { studentId: parseId(studentId, 'studentId') } : {}),
      ...(supervisorId ? {
        placement: { supervisorId: parseId(supervisorId, 'supervisorId') },
      } : {}),
    },
    include: hourLogInclude,
    orderBy: { date: 'desc' },
  });

  res.json(await mergeDynamicColumns('hour-logs', stripPasswordDeep(hourLogs)));
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const { status, reviewerId } = req.body;

  if (!validHoursStatuses.has(status) || !reviewerId) {
    return res.status(400).json({ error: 'status and reviewerId are required.' });
  }

  if (isDemoMode()) {
    return res.json(stripPasswordDeep(demoStore.patchHourLog(id, {
      status,
      reviewerId: parseId(reviewerId, 'reviewerId'),
    })));
  }

  const hourLog = await prisma.hourLog.update({
    where: { id },
    data: {
      status,
      reviewedById: parseId(reviewerId, 'reviewerId'),
      reviewedAt: new Date(),
    },
    include: hourLogInclude,
  });

  res.json(await mergeDynamicColumns('hour-logs', stripPasswordDeep(hourLog)));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Updating hour logs');
  }

  const id = parseId(req.params.id, 'id');
  const {
    studentId,
    placementId,
    date,
    hours,
    description,
    status,
    reviewerId,
  } = req.body;
  const dynamicData = await getWritableDynamicData('hour-logs', req.body, [
    'studentId',
    'placementId',
    'date',
    'hours',
    'description',
    'status',
    'reviewerId',
    'reviewedById',
  ]);

  if (status !== undefined && !validHoursStatuses.has(status)) {
    return res.status(400).json({ error: 'status must be valid.' });
  }

  const data = {};
  if (studentId !== undefined) data.studentId = parseId(studentId, 'studentId');
  if (placementId !== undefined) data.placementId = parseId(placementId, 'placementId');
  if (date !== undefined) data.date = parseOptionalDate(date);
  if (hours !== undefined) data.hours = hours;
  if (description !== undefined) data.description = description || null;
  if (status !== undefined) data.status = status;

  const parsedReviewerId = parseOptionalId(reviewerId, 'reviewerId');
  if (reviewerId !== undefined || status !== undefined) {
    data.reviewedById = parsedReviewerId;
    data.reviewedAt = status === 'PENDING' ? null : new Date();
  }

  const hourLog = await prisma.hourLog.update({
    where: { id },
    data,
    include: hourLogInclude,
  });

  await updateDynamicColumns('hour-logs', id, dynamicData);

  res.json(await mergeDynamicColumns('hour-logs', stripPasswordDeep(hourLog)));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Deleting hour logs');
  }

  const id = parseId(req.params.id, 'id');

  await prisma.hourLog.delete({ where: { id } });
  res.status(204).end();
}));

export default router;
