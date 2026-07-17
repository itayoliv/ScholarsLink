import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './env.js';

import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import formOptionsRouter from './routes/formOptions.js';
import healthRouter from './routes/health.js';
import hourLogsRouter from './routes/hourLogs.js';
import joinRequestsRouter from './routes/joinRequests.js';
import membershipsRouter from './routes/memberships.js';
import placementsRouter from './routes/placements.js';
import studentRegistrationRouter from './routes/studentRegistration.js';
import studentsRouter from './routes/students.js';
import usersRouter from './routes/users.js';

const app = express();

const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

function isPrivateLanHostname(hostname) {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    const host = url.hostname;

    if (host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok-free.dev') || host.endsWith('.ngrok.io') || host.endsWith('.ngrok.app')) {
      return true;
    }

    return isPrivateLanHostname(host) && (url.port === '' || /^517\d$/.test(url.port) || url.port === '4173');
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve the built frontend (frontend/dist) so the app and API share one origin in production.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
const indexHtml = path.join(distDir, 'index.html');

if (fs.existsSync(indexHtml)) {
  app.use(express.static(distDir));

  // SPA fallback: browser page navigations (Accept: text/html) get index.html,
  // while fetch() API calls fall through to the API routes below.
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
      return res.sendFile(indexHtml);
    }
    next();
  });
}

app.use(healthRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/users', usersRouter);
app.use('/placements', placementsRouter);
app.use('/join-requests', joinRequestsRouter);
app.use('/hour-logs', hourLogsRouter);
app.use('/memberships', membershipsRouter);
app.use('/form-options', formOptionsRouter);
app.use('/student', studentRegistrationRouter);
app.use('/students', studentsRouter);

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A record with that unique value already exists.' });
  }

  res.status(error.status || 500).json({
    error: error.message || 'Unexpected server error.',
  });
});

export default app;
