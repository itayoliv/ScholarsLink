@echo off
title ScholarsLink SQL Editor
setlocal
cd /d "%~dp0"

echo Starting SQL Editor server and client...
echo   Server: http://localhost:4100
echo   Client: http://localhost:5174
echo Closing each window stops that service.
echo.

start "SQL Editor Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-with-job.ps1" -WorkDir "%~dp0sql-editor\server" -Command "npm run dev" -Label "SQL Editor Server"
start "SQL Editor Client" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-with-job.ps1" -WorkDir "%~dp0sql-editor\client" -Command "npm run dev" -Label "SQL Editor Client"

echo Opened two windows: SQL Editor Server and SQL Editor Client.
pause
