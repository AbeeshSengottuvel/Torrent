@echo off
setlocal
title Haven - Torrent Client Launcher

echo ========================================================
echo   Haven - Secure, Ad-Free BitTorrent Client
echo ========================================================
echo.

if exist "desktop\dist\Haven-win32-x64\Haven.exe" (
    echo Launching Native Desktop Application (Haven.exe)...
    start "" "desktop\dist\Haven-win32-x64\Haven.exe"
    goto :eof
)

if exist "desktop\node_modules\electron" (
    echo Launching Native Desktop App via Electron...
    cd desktop
    npm start
    goto :eof
)

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting Haven preview server via Node.js...
    start "" http://127.0.0.1:3000
    node web\server.js
    goto :eof
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting Haven preview via Python...
    start "" http://127.0.0.1:3000
    cd web
    python -m http.server 3000
    goto :eof
)

echo [Error] Neither Node.js nor Python was found on your system.
pause
