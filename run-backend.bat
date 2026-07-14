@echo off
title ScholarsLink Backend
setlocal

netstat -ano | findstr ":4000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo ERROR: Port 4000 is already in use.
  echo   Another ScholarsLink Backend is probably still running.
  echo   Close that Backend window first, then run this again.
  echo.
  pause
  exit /b 1
)

echo Starting ScholarsLink backend on http://localhost:4000
echo Closing this window stops the backend and frees port 4000.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-with-job.ps1" -WorkDir "%~dp0backend" -Command "npm run dev" -Label "Backend"
set "EXITCODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXITCODE%
