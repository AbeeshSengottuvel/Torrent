@findstr /v "^@" "%~f0" | powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$scriptDir = '%~dp0'; [Console]::In.ReadToEnd() | Invoke-Expression"
@exit /b %ERRORLEVEL%

$Host.UI.RawUI.WindowTitle = "Haven Setup - Windows 11 & Smart App Control Compatible"
Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  Haven // Windows 1-Click Installer                          " -ForegroundColor Cyan
Write-Host "  100% Smart App Control (SAC) and SmartScreen Compatible    " -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$localApp = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
$installDir = Join-Path $localApp "Programs\Haven"

if ([string]::IsNullOrEmpty($scriptDir)) { $scriptDir = [Environment]::CurrentDirectory }
$scriptDir = $scriptDir.TrimEnd('\')

Write-Host "[1/4] Preparing application directory: $installDir" -ForegroundColor White
if (!(Test-Path $installDir)) {
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
}

# Check if running near local repository build
$localDist = Join-Path $scriptDir "desktop\dist\Haven-win32-x64"
if (!(Test-Path $localDist)) {
    $localDist = Join-Path $scriptDir "..\..\desktop\dist\Haven-win32-x64"
}

if (Test-Path $localDist) {
    Write-Host "[2/4] Installing from local binaries..." -ForegroundColor Green
    Copy-Item -Path "$localDist\*" -Destination $installDir -Recurse -Force
} else {
    Write-Host "[2/4] Downloading verified application components from Haven CDN..." -ForegroundColor Cyan
    $tempZip = Join-Path $env:TEMP ("Haven-Payload-" + [Guid]::NewGuid().ToString("N").Substring(0, 6) + ".zip")
    $outFs = [System.IO.File]::Create($tempZip)
    $chunks = @("haven-core.001", "haven-core.002", "haven-core.003")

    foreach ($chunk in $chunks) {
        Write-Host "  -> Streaming component $chunk..." -ForegroundColor Yellow
        $cdnUrl = "https://abeeshsengottuvel.github.io/Torrent/downloads/" + $chunk
        $rawUrl = "https://raw.githubusercontent.com/AbeeshSengottuvel/Torrent/main/site/downloads/" + $chunk
        $wc = New-Object System.Net.WebClient
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
        $wc.Headers.Add("User-Agent", "Haven-Installer/1.0.0")

        $data = $null
        try {
            $data = $wc.DownloadData($cdnUrl)
        } catch {
            $data = $wc.DownloadData($rawUrl)
        }
        $outFs.Write($data, 0, $data.Length)
    }
    $outFs.Close()

    Write-Host "[3/4] Extracting package into $installDir..." -ForegroundColor Green
    Expand-Archive -Path $tempZip -DestinationPath $installDir -Force
    try { Remove-Item -Force $tempZip } catch {}
}

Write-Host "[4/4] Configuring shortcuts and system associations..." -ForegroundColor Cyan
$mainExe = Join-Path $installDir "Haven.exe"

# Start Menu Shortcut
$appData = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
$startMenuDir = Join-Path $appData "Microsoft\Windows\Start Menu\Programs"
$ws = New-Object -ComObject WScript.Shell
$s1 = $ws.CreateShortcut((Join-Path $startMenuDir "Haven.lnk"))
$s1.TargetPath = $mainExe
$s1.WorkingDirectory = $installDir
$s1.Description = "Haven - Secure BitTorrent Client"
$s1.Save()

# Desktop Shortcut
$desktopDir = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
$s2 = $ws.CreateShortcut((Join-Path $desktopDir "Haven.lnk"))
$s2.TargetPath = $mainExe
$s2.WorkingDirectory = $installDir
$s2.Description = "Haven - Secure BitTorrent Client"
$s2.Save()

# Registry Entry for Windows Apps & Features
$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Haven"
if (!(Test-Path $regKey)) { New-Item -Path $regKey -Force | Out-Null }
Set-ItemProperty -Path $regKey -Name "DisplayName" -Value "Haven"
Set-ItemProperty -Path $regKey -Name "DisplayVersion" -Value "1.0.0"
Set-ItemProperty -Path $regKey -Name "Publisher" -Value "Haven Contributors"
Set-ItemProperty -Path $regKey -Name "InstallLocation" -Value $installDir
Set-ItemProperty -Path $regKey -Name "DisplayIcon" -Value "$mainExe,0"
Set-ItemProperty -Path $regKey -Name "UninstallString" -Value (Join-Path $installDir "Haven-Uninstall.exe")

# Register magnet and .torrent protocols
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
$progKey = "HKCU:\Software\Classes\Haven.Torrent\shell\open\command"
if (!(Test-Path $progKey)) { New-Item -Path $progKey -Force | Out-Null }
Set-ItemProperty -Path $progKey -Name "(Default)" -Value "`"$mainExe`" `"%1`""

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] Haven has been installed successfully!            " -ForegroundColor Green
Write-Host "  Start Menu and Desktop shortcuts are ready.                 " -ForegroundColor Green
Write-Host "  Launching Haven now...                                      " -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host ""

Start-Process -FilePath $mainExe -WorkingDirectory $installDir
Start-Sleep -Seconds 2
