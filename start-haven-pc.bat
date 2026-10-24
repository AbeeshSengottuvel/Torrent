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

echo [Notice] Pre-packaged binary Haven.exe not found.
echo To build the native desktop application:
echo   cd desktop
echo   npm install
echo   npm run package
echo.
pause
