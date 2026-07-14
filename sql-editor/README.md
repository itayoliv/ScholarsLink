# SQL Editor

Standalone MySQL query tool for the ScholarsLink database. Not part of the main app.

## Features

- Schema sidebar with tables and stored procedures
- Click a table to preview the top 500 rows
- Click a procedure to load its definition into the editor (edit + Save procedure)
- SQL syntax highlighting (MySQL keywords colored)
- Run selected text with the **Run** button or **F5** (runs all if nothing is selected)
- Results grid with columns and values, plus OK/error messages for DML/DDL

## Setup

1. Make sure Docker MySQL is running (`npm run db:up` from the repo root).
2. Copy env if needed:

```bash
copy server\.env.example server\.env
```

3. Install dependencies (first time):

```bash
npm install --prefix server
npm install --prefix client
```

## Run

Terminal 1 - API (port 4100):

```bash
npm run dev --prefix server
```

Terminal 2 - UI (port 5174):

```bash
npm run dev --prefix client
```

Open http://localhost:5174

> The client uses `strictPort` on `5174`. If that port is already taken (often by another main frontend Vite), close that process and try again — do not assume the SQL editor moved to another port.

From the repo root you can also use [`start.bat`](../start.bat) or [`run-sql-editor.bat`](../run-sql-editor.bat), or:

```bash
npm run sql-editor:server
npm run sql-editor:client
```

## Security note

This tool can run any SQL including DROP. Use it only on localhost against your own database.
