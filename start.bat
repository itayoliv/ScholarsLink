@echo off
setlocal EnableExtensions
title ScholarsLink - Setup and Run
cd /d "%~dp0"

set "DB_OK=1"

echo ========================================
echo   ScholarsLink - setup and run
echo ========================================
echo.

:: --- Prerequisites (hard fail) ---
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js was not found on PATH.
  echo Install Node.js 20+ from https://nodejs.org/ then run this again.
  goto :fail
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm was not found on PATH.
  echo Reinstall Node.js so npm is included, then run this again.
  goto :fail
)

echo [OK] Node.js and npm found.
echo.

:: --- Env files (do not overwrite) ---
if not exist "backend\.env" (
  if not exist "backend\.env.example" (
    echo ERROR: backend\.env.example is missing.
    goto :fail
  )
  copy /Y "backend\.env.example" "backend\.env" >nul
  echo Created backend\.env from example.
) else (
  echo backend\.env already exists.
)

if not exist "frontend\.env" (
  if not exist "frontend\.env.example" (
    echo ERROR: frontend\.env.example is missing.
    goto :fail
  )
  copy /Y "frontend\.env.example" "frontend\.env" >nul
  echo Created frontend\.env from example.
) else (
  echo frontend\.env already exists.
)
echo.

:: --- Install (hard fail) ---
echo Installing backend dependencies...
call npm install --prefix backend
if errorlevel 1 (
  echo ERROR: backend npm install failed.
  goto :fail
)

echo Installing frontend dependencies...
call npm install --prefix frontend
if errorlevel 1 (
  echo ERROR: frontend npm install failed.
  goto :fail
)

echo Installing SQL editor dependencies...
call npm install --prefix sql-editor\server
if errorlevel 1 (
  echo ERROR: sql-editor server npm install failed.
  goto :fail
)
call npm install --prefix sql-editor\client
if errorlevel 1 (
  echo ERROR: sql-editor client npm install failed.
  goto :fail
)

if not exist "sql-editor\server\.env" (
  if exist "sql-editor\server\.env.example" (
    copy /Y "sql-editor\server\.env.example" "sql-editor\server\.env" >nul
    echo Created sql-editor\server\.env from example.
  )
)

echo Generating Prisma client...
pushd backend
call node scripts\ensure-prisma-client.js
if errorlevel 1 (
  echo ERROR: prisma generate failed and no usable Prisma client was found.
  popd
  goto :fail
)
popd
echo [OK] Dependencies installed.
echo.

:: --- Database (soft-fail) ---
echo Setting up MySQL database...
where docker >nul 2>&1
if errorlevel 1 (
  echo WARNING: Docker was not found. Skipping database setup.
  set "DB_OK=0"
  goto :after_db
)

echo Starting MySQL container...
call npm run db:up
if errorlevel 1 (
  echo WARNING: Could not start MySQL ^(is Docker Desktop running?^). Skipping migrate/seed.
  set "DB_OK=0"
  goto :after_db
)

echo Waiting for MySQL to become ready...
timeout /t 8 /nobreak >nul

echo Applying Prisma migrations...
pushd backend
call npx prisma migrate deploy --schema prisma/schema.prisma
if errorlevel 1 (
  echo WARNING: prisma migrate deploy failed. Continuing without a ready database.
  set "DB_OK=0"
  popd
  goto :after_db
)
popd

echo Seeding form options...
call npm run db:seed --prefix backend
if errorlevel 1 (
  echo WARNING: database seed failed. Continuing anyway.
  set "DB_OK=0"
) else (
  echo [OK] Database is ready.
)

:after_db
echo.

:: --- Start apps ---
echo Opening Backend, Frontend, and SQL Editor windows...

netstat -ano | findstr ":4000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo WARNING: Port 4000 is already in use.
  echo   Another ScholarsLink Backend is probably still running.
  echo   Close that Backend window first, or login will hit the wrong API
  echo   ^(demo accounts will fail if that process is not in DEMO MODE^).
  echo.
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo WARNING: Port 5173 is already in use.
  echo   Close the other ScholarsLink Frontend window first.
  echo   This frontend uses strictPort and will fail if 5173 is busy.
  echo.
)

netstat -ano | findstr ":5174" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo WARNING: Port 5174 is already in use.
  echo   That is usually another Vite app ^(not the SQL editor^).
  echo   Close that window so the SQL editor can use http://localhost:5174
  echo.
)

if "%DB_OK%"=="0" (
  echo Starting Backend in DEMO MODE ^(DEMO_MODE=1^)...
  start "ScholarsLink Backend" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-with-job.ps1" -WorkDir "%~dp0backend" -Command "set DEMO_MODE=1&& npm run dev" -Label "Backend"
) else (
  start "ScholarsLink Backend" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-with-job.ps1" -WorkDir "%~dp0backend" -Command "npm run dev" -Label "Backend"
)
start "ScholarsLink Frontend" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-with-job.ps1" -WorkDir "%~dp0frontend" -Command "npm run dev" -Label "Frontend"
start "SQL Editor Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-with-job.ps1" -WorkDir "%~dp0sql-editor\server" -Command "npm run dev" -Label "SQL Editor Server"
start "SQL Editor Client" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-with-job.ps1" -WorkDir "%~dp0sql-editor\client" -Command "npm run dev" -Label "SQL Editor Client"

echo.
echo ========================================
echo   Frontend:    http://localhost:5173
echo   API:         http://localhost:4000
echo   SQL Editor:  http://localhost:5174
echo   SQL API:     http://localhost:4100
echo ========================================
if "%DB_OK%"=="0" (
  echo.
  echo NOTE: Database setup did not fully succeed.
  echo   The API will start in DEMO MODE with sample accounts:
  echo     adm@gmail.com / sup@gmail.com / stu1@gmail.com / stu2@gmail.com
  echo     password: 123456
  echo   Demo data is in-memory and resets when the backend restarts.
  echo   SQL Editor needs MySQL — start Docker Desktop and run start.bat again.
  echo   For MySQL mode, start Docker Desktop and run start.bat again.
)
echo.
echo Keep the Backend, Frontend, and SQL Editor windows open while using the app.
pause
exit /b 0

:fail
echo.
echo Setup stopped. Fix the error above and run start.bat again.
pause
exit /b 1
