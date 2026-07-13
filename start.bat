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

echo Generating Prisma client...
pushd backend
call npx prisma generate --schema prisma/schema.prisma
if errorlevel 1 (
  echo ERROR: prisma generate failed. The API cannot start without it.
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
echo Opening Backend and Frontend windows...
start "ScholarsLink Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"
start "ScholarsLink Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo ========================================
echo   Frontend: http://localhost:5173
echo   API:      http://localhost:4000
echo ========================================
if "%DB_OK%"=="0" (
  echo.
  echo NOTE: Database setup did not fully succeed.
  echo   The frontend should still open.
  echo   Login / API may not work until Docker Desktop is running
  echo   and you run start.bat again ^(or fix MySQL manually^).
)
echo.
echo Keep the Backend and Frontend windows open while using the app.
pause
exit /b 0

:fail
echo.
echo Setup stopped. Fix the error above and run start.bat again.
pause
exit /b 1
