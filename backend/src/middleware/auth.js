import * as demoStore from '../demoStore.js';
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from '../config/constants.js';
import { prisma } from '../prisma.js';
import { isDemoMode } from '../state.js';

export function setSessionCookie(res, userId) {
  res.cookie(SESSION_COOKIE, String(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export async function getUserFromSession(req) {
  const rawId = req.cookies?.[SESSION_COOKIE];

  if (!rawId) {
    return null;
  }

  const userId = Number(rawId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  if (isDemoMode()) {
    return demoStore.findUserById(userId);
  }

  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requireAdmin(req) {
  const user = await getUserFromSession(req);

  if (!user) {
    const error = new Error('Not authenticated.');
    error.status = 401;
    throw error;
  }

  if (user.role !== 'ADMIN') {
    const error = new Error('Admin access is required.');
    error.status = 403;
    throw error;
  }

  return user;
}

export async function requireStudent(req) {
  const user = await getUserFromSession(req);

  if (!user) {
    const error = new Error('Not authenticated.');
    error.status = 401;
    throw error;
  }

  if (user.role !== 'STUDENT') {
    const error = new Error('Student access is required.');
    error.status = 403;
    throw error;
  }

  return user;
}
