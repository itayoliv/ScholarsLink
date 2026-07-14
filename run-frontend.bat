@echo off
title ScholarsLink Frontend
setlocal

echo Starting ScholarsLink frontend (Vite)
echo Closing this window stops Vite and frees port 5173.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-with-job.ps1" -WorkDir "%~dp0frontend" -Command "npm run dev" -Label "Frontend"
set "EXITCODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXITCODE%
