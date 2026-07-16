import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import { validRequestStatuses } from '../config/constants.js';
import {
  getWritableDynamicData,
  mergeDynamicColumns,
  updateDynamicColumns,
} from '../lib/dynamicColumns.js';
import { joinRequestInclude } from '../lib/includes.js';
import { activateMembershipForJoin } from '../lib/memberships.js';
import { parseId, parseOptionalId } from '../lib/parse.js';
import { stripPasswordDeep } from '../lib/sanitize.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { prisma } from '../prisma.js';
import { demoUnavailable, isDemoMode } from '../state.js';

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { studentId, placementId, note } = req.body;

  if (!studentId || !placementId) {
    return res.status(400).json({ error: 'studentId and placementId are required.' });
  }

  if (isDemoMode()) {
    const joinRequest = demoStore.createJoinRequest({
      studentId: parseId(studentId, 'studentId'),
      placementId: parseId(placementId, 'placementId'),
      note,
    });
    return res.status(201).json(stripPasswordDeep(joinRequest));
  }

  const dynamicData = await getWritableDynamicData('join-requests', req.body, ['studentId', 'placementId', 'note']);
  const joinRequest = await prisma.joinRequest.create({
    data: {
      studentId: parseId(studentId, 'studentId'),
      placementId: parseId(placementId, 'placementId'),
      note,
    },
    include: joinRequestInclude,
  });

  await updateDynamicColumns('join-requests', joinRequest.id, dynamicData);

  res.status(201).json(await mergeDynamicColumns('join-requests', stripPasswordDeep(joinRequest)));
}));

router.get('/', asyncHandler(async (req, res) => {
  const { status, supervisorId, studentId } = req.query;

  if (isDemoMode()) {
    return res.json(stripPasswordDeep(demoStore.listJoinRequests({
      status: status && validRequestStatuses.has(status) ? status : undefined,
      studentId: studentId ? parseId(studentId, 'studentId') : undefined,
      supervisorId: supervisorId ? parseId(supervisorId, 'supervisorId') : undefined,
    })));
  }

  const joinRequests = await prisma.joinRequest.findMany({
    where: {
      ...(status && validRequestStatuses.has(status) ? { status } : {}),
      ...(studentId ? { studentId: parseId(studentId, 'studentId') } : {}),
      ...(supervisorId ? {
        placement: { supervisorId: parseId(supervisorId, 'supervisorId') },
      } : {}),
    },
    include: joinRequestInclude,
    orderBy: { createdAt: 'desc' },
  });

  res.json(await mergeDynamicColumns('join-requests', stripPasswordDeep(joinRequests)));
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const { status, reviewerId } = req.body;

  if (!validRequestStatuses.has(status) || !reviewerId) {
    return res.status(400).json({ error: 'status and reviewerId are required.' });
  }

  if (isDemoMode()) {
    return res.json(stripPasswordDeep(demoStore.patchJoinRequest(id, {
      status,
      reviewerId: parseId(reviewerId, 'reviewerId'),
    })));
  }

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const request = await tx.joinRequest.findUniqueOrThrow({
      where: { id },
      include: { placement: true },
    });

    const reviewed = await tx.joinRequest.update({
      where: { id },
      data: {
        status,
        reviewedById: parseId(reviewerId, 'reviewerId'),
        reviewedAt: new Date(),
      },
      include: joinRequestInclude,
    });

    if (status === 'APPROVED') {
      await activateMembershipForJoin(tx, request.studentId, request.placementId);
    }

    return reviewed;
  });

  res.json(await mergeDynamicColumns('join-requests', stripPasswordDeep(updatedRequest)));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Updating join requests');
  }

  const id = parseId(req.params.id, 'id');
  const {
    studentId,
    placementId,
    status,
    note,
    reviewerId,
  } = req.body;
  const dynamicData = await getWritableDynamicData('join-requests', req.body, [
    'studentId',
    'placementId',
    'status',
    'note',
    'reviewerId',
    'reviewedById',
  ]);

  if (status !== undefined && !validRequestStatuses.has(status)) {
    return res.status(400).json({ error: 'status must be valid.' });
  }

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const data = {};
    if (studentId !== undefined) data.studentId = parseId(studentId, 'studentId');
    if (placementId !== undefined) data.placementId = parseId(placementId, 'placementId');
    if (status !== undefined) data.status = status;
    if (note !== undefined) data.note = note || null;

    const parsedReviewerId = parseOptionalId(reviewerId, 'reviewerId');
    if (reviewerId !== undefined || status !== undefined) {
      data.reviewedById = parsedReviewerId;
      data.reviewedAt = status === 'PENDING' ? null : new Date();
    }

    const request = await tx.joinRequest.update({
      where: { id },
      data,
      include: joinRequestInclude,
    });

    if (request.status === 'APPROVED') {
      await activateMembershipForJoin(tx, request.studentId, request.placementId);
    }

    return request;
  });

  await updateDynamicColumns('join-requests', id, dynamicData);

  res.json(await mergeDynamicColumns('join-requests', stripPasswordDeep(updatedRequest)));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Deleting join requests');
  }

  const id = parseId(req.params.id, 'id');

  await prisma.joinRequest.delete({ where: { id } });
  res.status(204).end();
}));

export default router;
