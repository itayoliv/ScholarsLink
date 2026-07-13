import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const execAsync = promisify(exec);
const port = process.env.PORT || 4000;
const PASSWORD_AES_KEY = process.env.PASSWORD_AES_KEY;
if (!PASSWORD_AES_KEY) {
  throw new Error('PASSWORD_AES_KEY is required. Copy backend/.env.example to backend/.env and set a secret key.');
}
const SESSION_COOKIE = 'scholarslink_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
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

async function encryptPassword(plainPassword) {
  const rows = await prisma.$queryRaw`
    SELECT TO_BASE64(AES_ENCRYPT(${String(plainPassword)}, ${PASSWORD_AES_KEY})) AS encrypted
  `;
  return rows[0]?.encrypted;
}

async function passwordMatches(plainPassword, encryptedPassword) {
  const rows = await prisma.$queryRaw`
    SELECT CAST(AES_DECRYPT(FROM_BASE64(${encryptedPassword}), ${PASSWORD_AES_KEY}) AS CHAR) AS plain
  `;
  return rows[0]?.plain === String(plainPassword);
}

const validRoles = new Set(['STUDENT', 'SUPERVISOR', 'ADMIN']);
const validRequestStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const validHoursStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);

const adminEntities = {
  users: {
    table: 'User',
    readOnly: new Set(['id', 'createdAt', 'updatedAt']),
    sensitive: new Set(['password']),
  },
  placements: {
    table: 'Placement',
    readOnly: new Set(['id', 'createdAt', 'updatedAt']),
    sensitive: new Set(),
  },
  'join-requests': {
    table: 'JoinRequest',
    readOnly: new Set(['id', 'createdAt', 'updatedAt', 'reviewedAt']),
    sensitive: new Set(),
  },
  'hour-logs': {
    table: 'HourLog',
    readOnly: new Set(['id', 'createdAt', 'updatedAt', 'reviewedAt']),
    sensitive: new Set(),
  },
  memberships: {
    table: 'PlacementMembership',
    readOnly: new Set(['id']),
    sensitive: new Set(),
  },
  'form-options': {
    table: 'FormOption',
    readOnly: new Set(['id']),
    sensitive: new Set(),
  },
};

let databaseNamePromise;

function quoteIdent(name) {
  if (!/^[A-Za-z0-9_]+$/.test(String(name))) {
    const error = new Error('Invalid database identifier.');
    error.status = 400;
    throw error;
  }

  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function getDatabaseName() {
  if (!databaseNamePromise) {
    databaseNamePromise = prisma.$queryRaw`SELECT DATABASE() AS databaseName`;
  }

  const rows = await databaseNamePromise;
  return rows[0]?.databaseName;
}

function getEntityConfig(entity) {
  const config = adminEntities[entity];

  if (!config) {
    const error = new Error('Unknown admin entity.');
    error.status = 404;
    throw error;
  }

  return config;
}

async function listTableColumns(tableName) {
  const databaseName = await getDatabaseName();
  const rows = await prisma.$queryRaw`
    SELECT
      COLUMN_NAME AS name,
      DATA_TYPE AS dataType,
      COLUMN_TYPE AS columnType,
      IS_NULLABLE AS isNullable,
      COLUMN_KEY AS columnKey,
      EXTRA AS extra,
      COLUMN_DEFAULT AS defaultValue,
      ORDINAL_POSITION AS ordinalPosition
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ${databaseName}
      AND TABLE_NAME = ${tableName}
    ORDER BY ORDINAL_POSITION
  `;

  return rows.map((column) => ({
    name: String(column.name),
    dataType: String(column.dataType),
    columnType: String(column.columnType),
    isNullable: String(column.isNullable),
    columnKey: String(column.columnKey || ''),
    extra: String(column.extra || ''),
    defaultValue: column.defaultValue === null || column.defaultValue === undefined
      ? null
      : typeof column.defaultValue === 'bigint'
        ? column.defaultValue.toString()
        : String(column.defaultValue),
    ordinalPosition: Number(column.ordinalPosition),
    nullable: column.isNullable === 'YES',
    generated: String(column.extra || '').toLowerCase().includes('generated'),
  }));
}

async function getAdminEntitySchema(entity) {
  const config = getEntityConfig(entity);
  const columns = await listTableColumns(config.table);

  return {
    entity,
    table: config.table,
    columns: columns.map((column) => ({
      ...column,
      sensitive: config.sensitive.has(column.name),
      readOnly: config.readOnly.has(column.name) || column.generated,
    })),
  };
}

function stripSensitiveColumns(row, config) {
  if (!row) {
    return row;
  }

  const next = {};

  for (const [key, value] of Object.entries(row)) {
    if (config.sensitive.has(key)) {
      continue;
    }

    if (typeof value === 'bigint') {
      next[key] = Number(value);
    } else {
      next[key] = value;
    }
  }

  return next;
}

async function readRawRowsByIds(entity, ids) {
  if (ids.length === 0) {
    return new Map();
  }

  const config = getEntityConfig(entity);
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM ${quoteIdent(config.table)} WHERE ${quoteIdent('id')} IN (${placeholders})`,
    ...ids,
  );

  return new Map(rows.map((row) => [Number(row.id), stripSensitiveColumns(row, config)]));
}

async function mergeDynamicColumns(entity, value) {
  const records = Array.isArray(value) ? value : [value];
  const ids = records
    .map((record) => Number(record?.id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const rawRows = await readRawRowsByIds(entity, ids);
  const merged = records.map((record) => {
    const raw = rawRows.get(Number(record?.id)) || {};
    return { ...raw, ...record };
  });

  return Array.isArray(value) ? merged : merged[0];
}

function coerceColumnValue(value, column) {
  if (value === '') {
    return column.nullable ? null : '';
  }

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (column.dataType === 'tinyint' && String(column.columnType).startsWith('tinyint(1)')) {
    return Boolean(value);
  }

  return value;
}

async function getWritableDynamicData(entity, body, handledKeys = []) {
  const config = getEntityConfig(entity);
  const handled = new Set(handledKeys);
  const columns = await listTableColumns(config.table);
  const data = {};

  for (const column of columns) {
    if (
      handled.has(column.name)
      || config.readOnly.has(column.name)
      || config.sensitive.has(column.name)
      || column.generated
      || !Object.prototype.hasOwnProperty.call(body, column.name)
    ) {
      continue;
    }

    const value = coerceColumnValue(body[column.name], column);

    if (value !== undefined) {
      data[column.name] = value;
    }
  }

  return data;
}

async function updateDynamicColumns(entity, id, data) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return;
  }

  const config = getEntityConfig(entity);
  const setters = entries.map(([key]) => `${quoteIdent(key)} = ?`).join(', ');
  const values = entries.map(([, value]) => value);

  await prisma.$executeRawUnsafe(
    `UPDATE ${quoteIdent(config.table)} SET ${setters} WHERE ${quoteIdent('id')} = ?`,
    ...values,
    id,
  );
}

async function requireAdmin(req) {
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const FORM_OPTION_FIELD_KEYS = new Set([
  'gender',
  'maritalStatus',
  'spouseStatus',
  'militaryService',
  'academicInstitutionName',
  'yearOfStudy',
  'fieldOfStudy',
]);

const REGISTRATION_FILE_TYPES = new Set([
  'CV',
  'PERSONAL_LETTER',
  'STUDENT_ID_COPY',
  'PARENT_ID_COPY',
  'ENROLLMENT_CERTIFICATE',
  'CLASS_SCHEDULE',
  'SERVICE_CERTIFICATE',
  'PRE_MILITARY_CERTIFICATE',
  'BANK_CONFIRMATION',
]);

const MANDATORY_REGISTRATION_FILES = [
  'CV',
  'PERSONAL_LETTER',
  'STUDENT_ID_COPY',
  'PARENT_ID_COPY',
  'BANK_CONFIRMATION',
];

const REQUIRED_REGISTRATION_FIELDS = [
  'firstName',
  'lastName',
  'idNumber',
  'gender',
  'dateOfBirth',
  'mailingAddress',
  'contactEmail',
  'mobilePhone',
  'fatherName',
  'motherName',
  'maritalStatus',
  'militaryService',
  'academicInstitutionName',
  'yearOfStudy',
  'fieldOfStudy',
  'weeklyStudyHours',
  'volunteeringLocationFirstOption',
  'personalExplanationLetter',
];

async function requireStudent(req) {
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

function parseRegistrationBody(body = {}) {
  return {
    firstName: body.firstName ?? '',
    lastName: body.lastName ?? '',
    idNumber: body.idNumber ?? '',
    gender: body.gender ?? '',
    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
    mailingAddress: body.mailingAddress ?? '',
    additionalAddress: body.additionalAddress || null,
    contactEmail: body.contactEmail ?? '',
    mobilePhone: body.mobilePhone ?? '',
    additionalPhone: body.additionalPhone || null,
    fatherName: body.fatherName ?? '',
    motherName: body.motherName ?? '',
    spouseName: body.spouseName || null,
    maritalStatus: body.maritalStatus ?? '',
    numberOfChildren: Number(body.numberOfChildren ?? 0),
    spouseStatus: body.spouseStatus || null,
    preMilitaryAcademyYear: Boolean(body.preMilitaryAcademyYear),
    militaryService: body.militaryService ?? '',
    loneSoldierStatus: Boolean(body.loneSoldierStatus),
    academicInstitutionName: body.academicInstitutionName ?? '',
    yearOfStudy: body.yearOfStudy ?? '',
    fieldOfStudy: body.fieldOfStudy ?? '',
    weeklyStudyHours: Number(body.weeklyStudyHours ?? 0),
    previousCouncilScholarship: Boolean(body.previousCouncilScholarship),
    volunteeringLocationFirstOption: body.volunteeringLocationFirstOption ?? '',
    firstOptionSubChoice: body.firstOptionSubChoice || null,
    volunteeringLocationSecondOption: body.volunteeringLocationSecondOption || null,
    thirdOptionSubChoice: body.thirdOptionSubChoice || null,
    volunteeringLocationThirdOption: body.volunteeringLocationThirdOption || null,
    secondOptionSubChoice: body.secondOptionSubChoice || null,
    personalExplanationLetter: body.personalExplanationLetter || null,
  };
}

function missingRegistrationFields(registration) {
  const missing = [];

  for (const field of REQUIRED_REGISTRATION_FIELDS) {
    const value = registration?.[field];

    if (value === null || value === undefined || value === '') {
      missing.push(field);
      continue;
    }

    if (field === 'weeklyStudyHours' && Number(value) <= 0) {
      missing.push(field);
    }
  }

  return missing;
}

function serializeRegistration(registration) {
  if (!registration) {
    return null;
  }

  const { files = [], ...fields } = registration;

  return {
    ...fields,
    files: files.map((file) => ({
      fileType: file.fileType,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      uploadedAt: file.uploadedAt,
    })),
  };
}

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function parseId(value, fieldName) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`${fieldName} must be a positive integer.`);
    error.status = 400;
    throw error;
  }

  return id;
}

function stripPassword(user) {
  if (!user) {
    return user;
  }

  const { password, ...safeUser } = user;
  return safeUser;
}

function stripPasswordDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripPasswordDeep);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Keep Date, Prisma.Decimal, Buffer, etc. intact for JSON serialization.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }

  const next = {};

  for (const [key, nested] of Object.entries(value)) {
    if (key === 'password') {
      continue;
    }

    next[key] = stripPasswordDeep(nested);
  }

  return next;
}

function setSessionCookie(res, userId) {
  res.cookie(SESSION_COOKIE, String(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

async function getUserFromSession(req) {
  const rawId = req.cookies?.[SESSION_COOKIE];

  if (!rawId) {
    return null;
  }

  const userId = Number(rawId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return prisma.user.findUnique({ where: { id: userId } });
}

const placementInclude = {
  supervisor: true,
  memberships: {
    where: { active: true },
    include: { student: true },
  },
};

const joinRequestInclude = {
  student: true,
  placement: { include: { supervisor: true } },
  reviewedBy: true,
};

const hourLogInclude = {
  student: true,
  placement: { include: { supervisor: true } },
  reviewedBy: true,
};

const membershipInclude = {
  student: true,
  placement: { include: { supervisor: true } },
};

function parseOptionalId(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parseId(value, fieldName);
}

function parseOptionalDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const error = new Error('date must be valid.');
    error.status = 400;
    throw error;
  }

  return date;
}

async function activateMembershipForJoin(tx, studentId, placementId) {
  await tx.placementMembership.updateMany({
    where: { studentId, active: true },
    data: { active: false, endedAt: new Date() },
  });

  await tx.placementMembership.create({
    data: { studentId, placementId },
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'scholarslink-api' });
});

app.post('/auth/register', asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const dynamicData = await getWritableDynamicData('users', req.body, ['name', 'email', 'password', 'role']);

  if (!name || !email || !password || !validRoles.has(role)) {
    return res.status(400).json({ error: 'name, email, password, and a valid role are required.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters.' });
  }

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

app.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
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

app.get('/auth/me', asyncHandler(async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  res.json(stripPassword(user));
}));

app.post('/auth/logout', asyncHandler(async (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
}));

app.get('/admin/schema', asyncHandler(async (req, res) => {
  await requireAdmin(req);

  const schemas = await Promise.all(
    Object.keys(adminEntities).map((entity) => getAdminEntitySchema(entity)),
  );

  res.json({ entities: schemas });
}));

app.get('/admin/schema/:entity', asyncHandler(async (req, res) => {
  await requireAdmin(req);
  res.json(await getAdminEntitySchema(req.params.entity));
}));

app.post('/admin/schema/refresh', asyncHandler(async (req, res) => {
  await requireAdmin(req);

  const logs = [];
  let generateWarning = null;

  try {
    const pull = await execAsync('npx prisma db pull', {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 4,
      windowsHide: true,
    });
    logs.push(pull.stdout, pull.stderr);
  } catch (error) {
    const details = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n');
    const refreshError = new Error(`Prisma db pull failed.\n${details}`);
    refreshError.status = 500;
    throw refreshError;
  }

  try {
    const generate = await execAsync('npx prisma generate', {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 4,
      windowsHide: true,
    });
    logs.push(generate.stdout, generate.stderr);
  } catch (error) {
    generateWarning = [
      'Prisma client generate could not finish while the API is running (common on Windows file locks).',
      'schema.prisma was updated from the database. Restart the backend or run refresh-schema.bat to finish generate.',
      error.message,
    ].join(' ');
    logs.push(error.stdout, error.stderr, error.message);
  }

  const schemas = await Promise.all(
    Object.keys(adminEntities).map((entity) => getAdminEntitySchema(entity)),
  );

  res.json({
    ok: true,
    warning: generateWarning,
    output: logs.filter(Boolean).join('\n'),
    entities: schemas,
  });
}));

app.post('/users', asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const dynamicData = await getWritableDynamicData('users', req.body, ['name', 'email', 'password', 'role']);

  if (!name || !email || !password || !validRoles.has(role)) {
    return res.status(400).json({ error: 'name, email, password, and a valid role are required.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters.' });
  }

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

app.get('/users', asyncHandler(async (req, res) => {
  const { role } = req.query;

  const users = await prisma.user.findMany({
    where: role && validRoles.has(role) ? { role } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  res.json(await mergeDynamicColumns('users', users.map(stripPassword)));
}));

app.patch('/users/:id', asyncHandler(async (req, res) => {
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

app.delete('/users/:id', asyncHandler(async (req, res) => {
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

app.post('/placements', asyncHandler(async (req, res) => {
  const { name, description, supervisorId } = req.body;
  const dynamicData = await getWritableDynamicData('placements', req.body, ['name', 'description', 'supervisorId']);

  if (!name || !supervisorId) {
    return res.status(400).json({ error: 'name and supervisorId are required.' });
  }

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

app.get('/placements', asyncHandler(async (req, res) => {
  const { supervisorId } = req.query;

  const placements = await prisma.placement.findMany({
    where: supervisorId
      ? { supervisorId: parseId(supervisorId, 'supervisorId') }
      : undefined,
    include: placementInclude,
    orderBy: { name: 'asc' },
  });

  res.json(await mergeDynamicColumns('placements', stripPasswordDeep(placements)));
}));

app.patch('/placements/:id', asyncHandler(async (req, res) => {
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

app.delete('/placements/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');

  await prisma.$transaction(async (tx) => {
    await tx.hourLog.deleteMany({ where: { placementId: id } });
    await tx.placementMembership.deleteMany({ where: { placementId: id } });
    await tx.joinRequest.deleteMany({ where: { placementId: id } });
    await tx.placement.delete({ where: { id } });
  });

  res.status(204).end();
}));

app.post('/join-requests', asyncHandler(async (req, res) => {
  const { studentId, placementId, note } = req.body;
  const dynamicData = await getWritableDynamicData('join-requests', req.body, ['studentId', 'placementId', 'note']);

  if (!studentId || !placementId) {
    return res.status(400).json({ error: 'studentId and placementId are required.' });
  }

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

app.get('/join-requests', asyncHandler(async (req, res) => {
  const { status, supervisorId, studentId } = req.query;

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

app.patch('/join-requests/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const { status, reviewerId } = req.body;

  if (!validRequestStatuses.has(status) || !reviewerId) {
    return res.status(400).json({ error: 'status and reviewerId are required.' });
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

app.put('/join-requests/:id', asyncHandler(async (req, res) => {
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

app.delete('/join-requests/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');

  await prisma.joinRequest.delete({ where: { id } });
  res.status(204).end();
}));

app.post('/hour-logs', asyncHandler(async (req, res) => {
  const { studentId, placementId, date, hours, description } = req.body;
  const dynamicData = await getWritableDynamicData('hour-logs', req.body, [
    'studentId',
    'placementId',
    'date',
    'hours',
    'description',
  ]);

  if (!studentId || !placementId || !date || !hours) {
    return res.status(400).json({ error: 'studentId, placementId, date, and hours are required.' });
  }

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

app.get('/hour-logs', asyncHandler(async (req, res) => {
  const { status, supervisorId, studentId } = req.query;

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

app.patch('/hour-logs/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const { status, reviewerId } = req.body;

  if (!validHoursStatuses.has(status) || !reviewerId) {
    return res.status(400).json({ error: 'status and reviewerId are required.' });
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

app.put('/hour-logs/:id', asyncHandler(async (req, res) => {
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

app.delete('/hour-logs/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');

  await prisma.hourLog.delete({ where: { id } });
  res.status(204).end();
}));

app.get('/memberships', asyncHandler(async (req, res) => {
  const { active, studentId, placementId } = req.query;
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

app.post('/memberships', asyncHandler(async (req, res) => {
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

app.patch('/memberships/:id', asyncHandler(async (req, res) => {
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

app.delete('/memberships/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');

  await prisma.placementMembership.delete({ where: { id } });
  res.status(204).end();
}));

app.get('/form-options', asyncHandler(async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const options = await prisma.formOption.findMany({
    orderBy: [{ fieldKey: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
  });

  res.json(options);
}));

app.post('/form-options', asyncHandler(async (req, res) => {
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

app.patch('/form-options/:id', asyncHandler(async (req, res) => {
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

app.delete('/form-options/:id', asyncHandler(async (req, res) => {
  await requireAdmin(req);
  const id = parseId(req.params.id, 'id');
  await prisma.formOption.delete({ where: { id } });
  res.status(204).end();
}));

app.get('/student/registration', asyncHandler(async (req, res) => {
  const student = await requireStudent(req);
  const registration = await prisma.studentRegistration.findUnique({
    where: { studentId: student.id },
    include: {
      files: {
        select: {
          fileType: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
      },
    },
  });

  res.json(serializeRegistration(registration));
}));

app.put('/student/registration', asyncHandler(async (req, res) => {
  const student = await requireStudent(req);
  const data = parseRegistrationBody(req.body);

  if (data.dateOfBirth && Number.isNaN(data.dateOfBirth.getTime())) {
    return res.status(400).json({ error: 'dateOfBirth must be a valid date.' });
  }

  if (!Number.isInteger(data.numberOfChildren) || data.numberOfChildren < 0) {
    return res.status(400).json({ error: 'numberOfChildren must be a non-negative integer.' });
  }

  if (!Number.isFinite(data.weeklyStudyHours) || data.weeklyStudyHours < 0) {
    return res.status(400).json({ error: 'weeklyStudyHours must be a non-negative number.' });
  }

  const registration = await prisma.studentRegistration.upsert({
    where: { studentId: student.id },
    create: { studentId: student.id, ...data },
    update: data,
    include: {
      files: {
        select: {
          fileType: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
      },
    },
  });

  res.json(serializeRegistration(registration));
}));

app.post('/student/registration/files/:fileType', upload.single('file'), asyncHandler(async (req, res) => {
  const student = await requireStudent(req);
  const fileType = String(req.params.fileType || '').toUpperCase();

  if (!REGISTRATION_FILE_TYPES.has(fileType)) {
    return res.status(400).json({ error: 'Invalid file type.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'A file is required.' });
  }

  let registration = await prisma.studentRegistration.findUnique({
    where: { studentId: student.id },
  });

  if (!registration) {
    registration = await prisma.studentRegistration.create({
      data: { studentId: student.id },
    });
  }

  const saved = await prisma.registrationFile.upsert({
    where: {
      registrationId_fileType: {
        registrationId: registration.id,
        fileType,
      },
    },
    create: {
      registrationId: registration.id,
      fileType,
      fileName: req.file.originalname || `${fileType}.bin`,
      mimeType: req.file.mimetype || 'application/octet-stream',
      fileSize: req.file.size,
      data: req.file.buffer,
    },
    update: {
      fileName: req.file.originalname || `${fileType}.bin`,
      mimeType: req.file.mimetype || 'application/octet-stream',
      fileSize: req.file.size,
      data: req.file.buffer,
      uploadedAt: new Date(),
    },
    select: {
      fileType: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      uploadedAt: true,
    },
  });

  res.status(201).json(saved);
}));

app.get('/student/registration/files/:fileType', asyncHandler(async (req, res) => {
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const fileType = String(req.params.fileType || '').toUpperCase();

  if (!REGISTRATION_FILE_TYPES.has(fileType)) {
    return res.status(400).json({ error: 'Invalid file type.' });
  }

  let studentId = user.id;

  if (user.role === 'ADMIN' && req.query.studentId) {
    studentId = parseId(req.query.studentId, 'studentId');
  } else if (user.role !== 'STUDENT' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied.' });
  } else if (user.role === 'ADMIN' && !req.query.studentId) {
    return res.status(400).json({ error: 'studentId is required for admin downloads.' });
  }

  const registration = await prisma.studentRegistration.findUnique({
    where: { studentId },
  });

  if (!registration) {
    return res.status(404).json({ error: 'Registration not found.' });
  }

  const file = await prisma.registrationFile.findUnique({
    where: {
      registrationId_fileType: {
        registrationId: registration.id,
        fileType,
      },
    },
  });

  if (!file) {
    return res.status(404).json({ error: 'File not found.' });
  }

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/"/g, '')}"`);
  res.setHeader('Content-Length', String(file.fileSize));
  res.send(Buffer.from(file.data));
}));

app.post('/student/registration/submit', asyncHandler(async (req, res) => {
  const student = await requireStudent(req);
  const registration = await prisma.studentRegistration.findUnique({
    where: { studentId: student.id },
    include: { files: true },
  });

  if (!registration) {
    return res.status(400).json({ error: 'Save the registration form before submitting.' });
  }

  const missingFields = missingRegistrationFields(registration);
  const uploadedTypes = new Set(registration.files.map((file) => file.fileType));
  const missingFiles = MANDATORY_REGISTRATION_FILES.filter((type) => !uploadedTypes.has(type));

  if (missingFields.length > 0 || missingFiles.length > 0) {
    return res.status(400).json({
      error: 'Registration is incomplete.',
      missingFields,
      missingFiles,
    });
  }

  const updatedUser = await prisma.user.update({
    where: { id: student.id },
    data: { formsCompleted: true },
  });

  res.json(stripPassword(updatedUser));
}));

app.get('/students/:id/summary', asyncHandler(async (req, res) => {
  const studentId = parseId(req.params.id, 'id');

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

app.get('/admin/summary', asyncHandler(async (_req, res) => {
  const [students, supervisors, placements, pendingJoinRequests, pendingHourLogs, approvedHours] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'SUPERVISOR' } }),
    prisma.placement.count(),
    prisma.joinRequest.count({ where: { status: 'PENDING' } }),
    prisma.hourLog.count({ where: { status: 'PENDING' } }),
    prisma.hourLog.aggregate({
      where: { status: 'APPROVED' },
      _sum: { hours: true },
    }),
  ]);

  res.json({
    students,
    supervisors,
    placements,
    pendingJoinRequests,
    pendingHourLogs,
    approvedHours: approvedHours._sum.hours || 0,
  });
}));

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A record with that unique value already exists.' });
  }

  res.status(error.status || 500).json({
    error: error.message || 'Unexpected server error.',
  });
});

app.listen(port, () => {
  console.log(`ScholarsLink API listening on http://localhost:${port}`);
});
