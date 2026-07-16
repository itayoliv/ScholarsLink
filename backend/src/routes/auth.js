import { Router } from 'express';
import * as demoStore from '../demoStore.js';
import { validRoles } from '../config/constants.js';
import {
  getWritableDynamicData,
  mergeDynamicColumns,
  updateDynamicColumns,
} from '../lib/dynamicColumns.js';
import { encryptPassword, passwordMatches } from '../lib/passwords.js';
import { stripPassword } from '../lib/sanitize.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  clearSessionCookie,
  getUserFromSession,
  setSessionCookie,
} from '../middleware/auth.js';
import { prisma } from '../prisma.js';
import { isDemoMode } from '../state.js';

const router = Router();

router.post('/register', asyncHandler(async (req, res) => {
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
    setSessionCookie(res, user.id);
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

  setSessionCookie(res, user.id);
  res.status(201).json(await mergeDynamicColumns('users', stripPassword(user)));
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  if (isDemoMode()) {
    const user = demoStore.findUserByEmail(email);

    if (!user || !demoStore.passwordMatchesDemo(password, user)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    setSessionCookie(res, user.id);
    return res.json(stripPassword(user));
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const matches = await passwordMatches(password, user.password);

  if (!matches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  setSessionCookie(res, user.id);
  res.json(stripPassword(user));
}));

router.get('/me', asyncHandler(async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  res.json(stripPassword(user));
}));

router.post('/logout', asyncHandler(async (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
}));

export default router;
