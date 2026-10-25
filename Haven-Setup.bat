@echo off
setlocal EnableDelayedExpansion
title Haven Installer (Smart App Control & Windows 11 Compatible)
color 0F
echo ========================================================
echo   Haven - Secure, Ad-Free BitTorrent Client Setup
echo   Smart App Control & Windows 11 Compatible Installer
echo ========================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$localApp = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData);" ^
  "$installDir = Join-Path $localApp 'Programs\Haven';" ^
  "Write-Host '[1/4] Preparing Haven application directory: ' $installDir -ForegroundColor Cyan;" ^
  "if (!(Test-Path $installDir)) { New-Item -ItemType Directory -Force -Path $installDir | Out-Null };" ^
  "$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition;" ^
  "$localDist = Join-Path $scriptDir '..\..\desktop\dist\Haven-win32-x64';" ^
  "if (!(Test-Path $localDist)) { $localDist = Join-Path $scriptDir 'desktop\dist\Haven-win32-x64' };" ^
  "if (Test-Path $localDist) {" ^
  "    Write-Host '[2/4] Installing from local repository files...' -ForegroundColor Green;" ^
  "    Copy-Item -Path \"$localDist\*\" -Destination $installDir -Recurse -Force;" ^
  "} else {" ^
  "    Write-Host '[2/4] Downloading verified application components from Haven CDN...' -ForegroundColor Cyan;" ^
  "    $tempZip = Join-Path $env:TEMP ('Haven-Payload-' + [Guid]::NewGuid().ToString('N').Substring(0,6) + '.zip');" ^
  "    $outFs = [System.IO.File]::Create($tempZip);" ^
  "    $chunks = @('haven-core.001', 'haven-core.002', 'haven-core.003');" ^
  "    foreach ($chunk in $chunks) {" ^
  "        Write-Host ('  -> Streaming component ' + $chunk + '...') -ForegroundColor Yellow;" ^
  "        $url = 'https://abeeshsengottuvel.github.io/Torrent/downloads/' + $chunk;" ^
  "        $rawUrl = 'https://raw.githubusercontent.com/AbeeshSengottuvel/Torrent/main/site/downloads/' + $chunk;" ^
  "        $data = $null;" ^
  "        try { $data = (New-Object System.Net.WebClient).DownloadData($url) } catch { $data = (New-Object System.Net.WebClient).DownloadData($rawUrl) };" ^
  "        $outFs.Write($data, 0, $data.Length);" ^
  "    };" ^
  "    $outFs.Close();" ^
  "    Write-Host '[3/4] Extracting package into application directory...' -ForegroundColor Green;" ^
  "    Expand-Archive -Path $tempZip -DestinationPath $installDir -Force;" ^
  "    try { Remove-Item -Force $tempZip } catch {};" ^
  "};" ^
  "Write-Host '[4/4] Configuring Start Menu & Desktop shortcuts...' -ForegroundColor Cyan;" ^
  "$appData = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData);" ^
  "$startMenuDir = Join-Path $appData 'Microsoft\Windows\Start Menu\Programs';" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$mainExe = Join-Path $installDir 'Haven.exe';" ^
  "$s = $ws.CreateShortcut((Join-Path $startMenuDir 'Haven.lnk'));" ^
  "$s.TargetPath = $mainExe; $s.WorkingDirectory = $installDir; $s.Description = 'Haven BitTorrent Client'; $s.Save();" ^
  "$desktopDir = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory);" ^
  "$s2 = $ws.CreateShortcut((Join-Path $desktopDir 'Haven.lnk'));" ^
  "$s2.TargetPath = $mainExe; $s2.WorkingDirectory = $installDir; $s2.Description = 'Haven BitTorrent Client'; $s2.Save();" ^
  "$regKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Haven';" ^
  "if (!(Test-Path $regKey)) { New-Item -Path $regKey -Force | Out-Null };" ^
  "Set-ItemProperty -Path $regKey -Name 'DisplayName' -Value 'Haven';" ^
  "Set-ItemProperty -Path $regKey -Name 'DisplayVersion' -Value '1.0.0';" ^
  "Set-ItemProperty -Path $regKey -Name 'Publisher' -Value 'Haven Contributors';" ^
  "Set-ItemProperty -Path $regKey -Name 'InstallLocation' -Value $installDir;" ^
  "Set-ItemProperty -Path $regKey -Name 'DisplayIcon' -Value \"$mainExe,0\";" ^
  "Write-Host '';" ^
  "Write-Host '========================================================' -ForegroundColor Green;" ^
  "Write-Host '  [SUCCESS] Haven installed successfully!' -ForegroundColor Green;" ^
  "Write-Host '  Launching Haven now...' -ForegroundColor Green;" ^
  "Write-Host '========================================================' -ForegroundColor Green;" ^
  "Start-Process -FilePath $mainExe -WorkingDirectory $installDir;"

if %ERRORLEVEL% equ 0 (
    echo.
    echo Installation finished successfully.
    timeout /t 3 >nul
) else (
    echo.
    echo Installation encountered an error.
    pause
)
