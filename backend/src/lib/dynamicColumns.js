import { adminEntities } from '../config/adminEntities.js';
import { prisma } from '../prisma.js';
import { stripSensitiveColumns } from './sanitize.js';

let databaseNamePromise;

export function quoteIdent(name) {
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

export function getEntityConfig(entity) {
  const config = adminEntities[entity];

  if (!config) {
    const error = new Error('Unknown admin entity.');
    error.status = 404;
    throw error;
  }

  return config;
}

export async function listTableColumns(tableName) {
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

export async function getAdminEntitySchema(entity) {
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

export async function mergeDynamicColumns(entity, value) {
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

export async function getWritableDynamicData(entity, body, handledKeys = []) {
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

export async function updateDynamicColumns(entity, id, data) {
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
