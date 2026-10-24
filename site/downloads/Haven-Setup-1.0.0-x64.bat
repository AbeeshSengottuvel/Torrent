@echo off
setlocal
title Haven Setup
echo ===================================================
echo   Haven - Per-User Installer (No Admin Rights)
echo ===================================================
echo.
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0..\..\tools\install.ps1"
pause
