# Haven Per-User Installer Script (No Admin Rights)
# Installs Haven to %LOCALAPPDATA%\Programs\Haven

$ErrorActionPreference = "Stop"
$localAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
$installDir = Join-Path $localAppData "Programs\Haven"
$appData = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
$startMenuDir = Join-Path $appData "Microsoft\Windows\Start Menu\Programs"
$shortcutPath = Join-Path $startMenuDir "Haven.lnk"

Write-Host "================================================="
Write-Host "  Haven - Per-User Installer (No Admin Rights)   "
Write-Host "================================================="
Write-Host "Installing to: $installDir"

if (!(Test-Path $installDir)) {
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
}

$distDir = Resolve-Path (Join-Path $PSScriptRoot "..\desktop\dist\Haven-win32-x64")
Write-Host "Copying application binaries..."
Copy-Item -Path "$distDir\*" -Destination $installDir -Recurse -Force

# Create Start Menu Shortcut
Write-Host "Creating Start Menu shortcut..."
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($shortcutPath)
$s.TargetPath = Join-Path $installDir "Haven.exe"
$s.WorkingDirectory = $installDir
$s.Description = "Haven - Secure BitTorrent Client"
$s.Save()

# Register in HKCU Uninstall
Write-Host "Registering uninstaller in user registry..."
$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Haven"
if (!(Test-Path $regKey)) {
    New-Item -Path $regKey -Force | Out-Null
}
Set-ItemProperty -Path $regKey -Name "DisplayName" -Value "Haven"
Set-ItemProperty -Path $regKey -Name "DisplayVersion" -Value "1.0.0"
Set-ItemProperty -Path $regKey -Name "Publisher" -Value "Haven Contributors"
Set-ItemProperty -Path $regKey -Name "InstallLocation" -Value $installDir
Set-ItemProperty -Path $regKey -Name "UninstallString" -Value "powershell.exe -ExecutionPolicy Bypass -File `"$installDir\Uninstall.ps1`""
Set-ItemProperty -Path $regKey -Name "DisplayIcon" -Value (Join-Path $installDir "Haven.exe")

# Write uninstaller script that NEVER touches downloaded files
$uninstallScript = @"
Write-Host "Uninstalling Haven from $installDir..."
Write-Host "[SAFETY] Downloaded files and user torrent directories are NEVER touched."
if (Test-Path "$shortcutPath") { Remove-Item -Force "$shortcutPath" }
if (Test-Path "$regKey") { Remove-Item -Recurse -Force "$regKey" }
Start-Process -FilePath "cmd.exe" -ArgumentList "/c timeout /t 2 /nobreak >nul && rmdir /s /q `"$installDir`"" -WindowStyle Hidden
Write-Host "Haven uninstalled successfully."
"@
Set-Content -Path (Join-Path $installDir "Uninstall.ps1") -Value $uninstallScript

Write-Host ""
Write-Host "[SUCCESS] Haven installed successfully into: $installDir"
Write-Host "Start Menu shortcut created at: $shortcutPath"
