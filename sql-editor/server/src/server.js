import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4100;
const database = process.env.DB_NAME || 'scholarslink';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'scholarslink_user',
  password: process.env.DB_PASSWORD || 'scholarslink_password',
  database,
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true,
  dateStrings: true,
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function quoteIdent(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function listTables() {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME AS name
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [database],
  );
  return rows.map((row) => row.name);
}

async function listColumns(tableName) {
  const [rows] = await pool.query(
    `SELECT
       COLUMN_NAME AS name,
       COLUMN_TYPE AS type,
       IS_NULLABLE AS nullable,
       COLUMN_KEY AS \`key\`
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [database, tableName],
  );

  return rows.map((row) => ({
    name: row.name,
    type: row.type,
    nullable: row.nullable === 'YES',
    key: row.key,
  }));
}

async function listTablesWithColumns() {
  const tables = await listTables();
  const columnsByTable = await Promise.all(tables.map((table) => listColumns(table)));

  return tables.map((name, index) => ({
    name,
    columns: columnsByTable[index],
  }));
}

async function listProcedures() {
  const [rows] = await pool.query(
    `SELECT ROUTINE_NAME AS name
     FROM information_schema.ROUTINES
     WHERE ROUTINE_SCHEMA = ?
       AND ROUTINE_TYPE = 'PROCEDURE'
     ORDER BY ROUTINE_NAME`,
    [database],
  );
  return rows.map((row) => row.name);
}

function assertSafeIdent(name, label) {
  if (!name || !/^[A-Za-z0-9_]+$/.test(name)) {
    const error = new Error(`Invalid ${label} name.`);
    error.status = 400;
    throw error;
  }
  return name;
}

function serializeValue(value) {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function formatResultSet(rows, fields) {
  const columns = (fields || []).map((field) => field.name);
  return {
    type: 'resultset',
    columns,
    rows: (rows || []).map((row) =>
      columns.map((column) => serializeValue(row[column])),
    ),
  };
}

function formatOkPacket(result) {
  return {
    type: 'ok',
    affectedRows: result.affectedRows ?? 0,
    insertId: result.insertId ?? null,
    message: result.info || `Query OK, ${result.affectedRows ?? 0} row(s) affected`,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sql-editor' });
});

app.get('/api/schema', asyncHandler(async (_req, res) => {
  const [tables, procedures] = await Promise.all([listTablesWithColumns(), listProcedures()]);
  res.json({ database, tables, procedures });
}));

app.get('/api/tables/:name/rows', asyncHandler(async (req, res) => {
  const name = assertSafeIdent(req.params.name, 'table');
  const tables = await listTables();

  if (!tables.includes(name)) {
    return res.status(404).json({ error: `Table "${name}" was not found.` });
  }

  const [rows, fields] = await pool.query(
    `SELECT * FROM ${quoteIdent(name)} LIMIT 500`,
  );

  res.json(formatResultSet(rows, fields));
}));

app.get('/api/procedures/:name', asyncHandler(async (req, res) => {
  const name = assertSafeIdent(req.params.name, 'procedure');
  const procedures = await listProcedures();

  if (!procedures.includes(name)) {
    return res.status(404).json({ error: `Procedure "${name}" was not found.` });
  }

  const [rows] = await pool.query(`SHOW CREATE PROCEDURE ${quoteIdent(name)}`);
  const definition = rows[0]?.['Create Procedure'] || '';

  res.json({ name, definition });
}));

app.post('/api/query', asyncHandler(async (req, res) => {
  const sql = typeof req.body?.sql === 'string' ? req.body.sql.trim() : '';

  if (!sql) {
    return res.status(400).json({ error: 'SQL text is required.' });
  }

  const [result, fields] = await pool.query(sql);
  const outputs = [];

  if (Array.isArray(result) && Array.isArray(fields) && Array.isArray(fields[0])) {
    // multipleStatements: result and fields are arrays of result sets
    for (let i = 0; i < result.length; i += 1) {
      const part = result[i];
      const partFields = fields[i];

      if (Array.isArray(part)) {
        outputs.push(formatResultSet(part, partFields));
      } else {
        outputs.push(formatOkPacket(part));
      }
    }
  } else if (Array.isArray(result)) {
    outputs.push(formatResultSet(result, fields));
  } else {
    outputs.push(formatOkPacket(result));
  }

  res.json({ outputs });
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.sqlMessage || error.message || 'Unexpected server error.',
  });
});

app.listen(port, () => {
  console.log(`SQL Editor API listening on http://localhost:${port}`);
});
