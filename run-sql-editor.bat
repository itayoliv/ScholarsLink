@echo off
title ScholarsLink SQL Editor
cd /d "%~dp0"

echo Starting SQL Editor server and client...
echo   Server: http://localhost:4100
echo   Client: Vite (see terminal for URL)
echo.

start "SQL Editor Server" cmd /k "cd /d ""%~dp0sql-editor\server"" && npm run dev"
start "SQL Editor Client" cmd /k "cd /d ""%~dp0sql-editor\client"" && npm run dev"

echo Opened two windows: SQL Editor Server and SQL Editor Client.
pause
