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
$uninstallExe = Join-Path $installDir "Haven-Uninstall.exe"
$mainExe = Join-Path $installDir "Haven.exe"

Set-ItemProperty -Path $regKey -Name "DisplayName" -Value "Haven"
Set-ItemProperty -Path $regKey -Name "DisplayVersion" -Value "1.0.0"
Set-ItemProperty -Path $regKey -Name "Publisher" -Value "Haven Contributors"
Set-ItemProperty -Path $regKey -Name "InstallLocation" -Value $installDir
Set-ItemProperty -Path $regKey -Name "UninstallString" -Value "`"$uninstallExe`""
Set-ItemProperty -Path $regKey -Name "QuietUninstallString" -Value "`"$uninstallExe`" --silent"
Set-ItemProperty -Path $regKey -Name "DisplayIcon" -Value "$mainExe,0"
Set-ItemProperty -Path $regKey -Name "NoModify" -Value 1 -Type DWord
Set-ItemProperty -Path $regKey -Name "NoRepair" -Value 1 -Type DWord

# Register magnet and .torrent protocols
Write-Host "Registering magnet: and .torrent protocols..."
$magKey = "HKCU:\Software\Classes\magnet"
if (!(Test-Path $magKey)) { New-Item -Path $magKey -Force | Out-Null }
Set-ItemProperty -Path $magKey -Name "(Default)" -Value "URL:BitTorrent Magnet Link"
Set-ItemProperty -Path $magKey -Name "URL Protocol" -Value ""
$magCmd = "HKCU:\Software\Classes\magnet\shell\open\command"
if (!(Test-Path $magCmd)) { New-Item -Path $magCmd -Force | Out-Null }
Set-ItemProperty -Path $magCmd -Name "(Default)" -Value "`"$mainExe`" `"%1`""

$torKey = "HKCU:\Software\Classes\.torrent"
if (!(Test-Path $torKey)) { New-Item -Path $torKey -Force | Out-Null }
Set-ItemProperty -Path $torKey -Name "(Default)" -Value "Haven.Torrent"
$progKey = "HKCU:\Software\Classes\Haven.Torrent"
if (!(Test-Path $progKey)) { New-Item -Path $progKey -Force | Out-Null }
Set-ItemProperty -Path $progKey -Name "(Default)" -Value "BitTorrent File"
$progCmd = "HKCU:\Software\Classes\Haven.Torrent\shell\open\command"
if (!(Test-Path $progCmd)) { New-Item -Path $progCmd -Force | Out-Null }
Set-ItemProperty -Path $progCmd -Name "(Default)" -Value "`"$mainExe`" `"%1`""

Write-Host ""
Write-Host "[SUCCESS] Haven installed successfully into: $installDir"
Write-Host "Start Menu shortcut created at: $shortcutPath"

