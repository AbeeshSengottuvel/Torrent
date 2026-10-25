@echo off
setlocal
cd /d "%~dp0"
title Haven - Torrent Client Launcher

echo ========================================================
echo   Haven - Secure, Ad-Free BitTorrent Client
echo ========================================================
echo.

if exist "%LOCALAPPDATA%\Programs\Haven\Haven.exe" (
    echo Launching Installed Haven Client...
    start "" /D "%LOCALAPPDATA%\Programs\Haven" "%LOCALAPPDATA%\Programs\Haven\Haven.exe"
    goto :eof
)

if exist "%~dp0desktop\node_modules\electron\dist\electron.exe" (
    echo Launching Haven Client...
    start "" /D "%~dp0desktop" "%~dp0desktop\node_modules\electron\dist\electron.exe" "."
    goto :eof
)

if exist "%~dp0desktop\dist\Haven-win32-x64\Haven.exe" (
    echo Launching Native Desktop Application (Haven.exe)...
    start "" /D "%~dp0desktop\dist\Haven-win32-x64" "%~dp0desktop\dist\Haven-win32-x64\Haven.exe"
    goto :eof
)

echo [Notice] Pre-packaged binary Haven.exe not found.
echo To build the native desktop application:
echo   cd desktop
echo   npm install
echo   npm run package
echo.
pause
