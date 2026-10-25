# Haven Windows Packaging Tool (Apple-Grade Standalone Installer & Uninstaller)
# Builds self-contained single-file setup executable, standalone uninstaller, and portable ZIP

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "desktop\dist"
$appDir = Join-Path $dist "Haven-win32-x64"
$portableZip = Join-Path $dist "Haven-1.0.0-win-x64-portable.zip"
$installerSrc = Join-Path $root "tools\installer_src\Installer.cs"
$uninstallerSrc = Join-Path $root "tools\installer_src\Uninstaller.cs"
$installerExe = Join-Path $dist "Haven-Setup-1.0.0-x64.exe"
$installerShortExe = Join-Path $dist "Haven-Setup.exe"
$uninstallerInAppExe = Join-Path $appDir "Haven-Uninstall.exe"
$uninstallerDistExe = Join-Path $dist "Haven-Uninstall.exe"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$iconIco = Join-Path $root "desktop\icon.ico"

Write-Host "=========================================================="
Write-Host "  Haven // Apple-Grade Windows Packaging Engine (1.0.0)   "
Write-Host "=========================================================="

if (!(Test-Path $appDir)) {
    Write-Host "[1/4] Packaging Electron application into binaries..."
    Push-Location (Join-Path $root "desktop")
    npm run package
    Pop-Location
} else {
    Write-Host "[1/4] Application binaries verified at: $appDir"
}

# 1. Compile Uninstaller into application directory & dist (GUI, no console window)
Write-Host "[2/4] Compiling Apple-grade Uninstaller GUI (Haven-Uninstall.exe)..."
& $csc /target:winexe /out:$uninstallerInAppExe /platform:x64 /win32icon:$iconIco /reference:System.Windows.Forms.dll /reference:System.Drawing.dll $uninstallerSrc
Copy-Item -Path $uninstallerInAppExe -Destination $uninstallerDistExe -Force
Write-Host "  -> $uninstallerInAppExe"

# 2. Build Portable ZIP (including Uninstaller)
Write-Host "[3/4] Building Portable ZIP distribution..."
if (Test-Path $portableZip) {
    Remove-Item -Force $portableZip
}
Compress-Archive -Path "$appDir\*" -DestinationPath $portableZip -CompressionLevel Optimal
$zipMb = [Math]::Round((Get-Item $portableZip).Length / 1MB, 2)
Write-Host "  -> $portableZip ($zipMb MB)"

# 3. Compile Real Lightweight 1-Click Installer (Haven-Setup.exe - True Binary, No Git LFS)
Write-Host "[4/5] Compiling True-Binary 1-Click Installer (Haven-Setup.exe)..."
& $csc /target:winexe /out:$installerExe /platform:x64 /win32icon:$iconIco /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll $installerSrc
Copy-Item -Path $installerExe -Destination $installerShortExe -Force

# Copy real executable to site/downloads for direct distribution without Git LFS corruption
$siteDownloads = Join-Path $root "site\downloads"
if (Test-Path $siteDownloads) {
    Copy-Item -Path $installerExe -Destination (Join-Path $siteDownloads "Haven-Setup.exe") -Force
    Copy-Item -Path $installerExe -Destination (Join-Path $siteDownloads "Haven-Setup-1.0.0-x64.exe") -Force
}
$setupKb = [Math]::Round((Get-Item $installerExe).Length / 1KB, 1)
Write-Host "  -> $installerExe ($setupKb KB, True Binary Executable)"

# 4. Compile Standalone Mega-Installer (with Embedded Payload) for Offline Releases
Write-Host "[5/5] Compiling Standalone Mega-Installer (Haven-Setup-Standalone.exe)..."
$standaloneExe = Join-Path $dist "Haven-Setup-Standalone.exe"
$resArg = "/resource:$($portableZip),HavenPayload"
& $csc /target:winexe /out:$standaloneExe /platform:x64 /win32icon:$iconIco $resArg /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll $installerSrc
$standaloneMb = [Math]::Round((Get-Item $standaloneExe).Length / 1MB, 2)
Write-Host "  -> $standaloneExe ($standaloneMb MB, Standalone Embedded)"

# 5. Generate Cryptographic SHA256 Checksums
$portableHash = (Get-FileHash -Algorithm SHA256 $portableZip).Hash.ToLower()
$installerHash = (Get-FileHash -Algorithm SHA256 $installerExe).Hash.ToLower()
$uninstallerHash = (Get-FileHash -Algorithm SHA256 $uninstallerDistExe).Hash.ToLower()
$standaloneHash = (Get-FileHash -Algorithm SHA256 $standaloneExe).Hash.ToLower()

$sumsPath = Join-Path $dist "SHA256SUMS.txt"
@"
$installerHash  Haven-Setup.exe
$installerHash  Haven-Setup-1.0.0-x64.exe
$standaloneHash  Haven-Setup-Standalone.exe
$portableHash  Haven-1.0.0-win-x64-portable.zip
$uninstallerHash  Haven-Uninstall.exe
"@ | Set-Content -Path $sumsPath -Encoding utf8
if (Test-Path $siteDownloads) {
    Copy-Item -Path $sumsPath -Destination (Join-Path $siteDownloads "SHA256SUMS.txt") -Force
}

Write-Host ""
Write-Host "=========================================================="
Write-Host "  Packaging Complete - Ready for Distribution!           "
Write-Host "=========================================================="
Write-Host "  Single-File Setup:   $installerExe"
Write-Host "  Portable ZIP:        $portableZip"
Write-Host "  Clean Uninstaller:   $uninstallerDistExe"
Write-Host "  Checksums:           $sumsPath"
Write-Host ""
Get-Content $sumsPath

