# Haven Windows Packaging Tool (Task D1a)
# Builds portable ZIP and per-user setup executable (no admin rights)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "desktop\dist"
$appDir = Join-Path $dist "Haven-win32-x64"
$portableZip = Join-Path $dist "Haven-1.0.0-win-x64-portable.zip"
$installerSrc = Join-Path $root "tools\installer_src\Installer.cs"
$uninstallerSrc = Join-Path $root "tools\installer_src\Uninstaller.cs"
$installerExe = Join-Path $dist "Haven-Setup-1.0.0-x64.exe"
$uninstallerExe = Join-Path $appDir "Haven-Uninstall.exe"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

Write-Host "================================================="
Write-Host " Building Haven Windows Installers (Task D1a)    "
Write-Host "================================================="

if (!(Test-Path $appDir)) {
    Write-Host "Packaging Electron application first..."
    Push-Location (Join-Path $root "desktop")
    npm run package
    Pop-Location
}

$iconIco = Join-Path $root "desktop\icon.ico"

# 1. Compile Uninstaller into application directory
Write-Host "Compiling per-user Uninstaller..."
& $csc /target:exe /out:$uninstallerExe /platform:x64 /win32icon:$iconIco $uninstallerSrc
Write-Host "  -> $uninstallerExe"

# 2. Build Portable ZIP
Write-Host "Building Portable ZIP package..."
if (Test-Path $portableZip) {
    Remove-Item -Force $portableZip
}
Compress-Archive -Path "$appDir\*" -DestinationPath $portableZip -CompressionLevel Optimal
Write-Host "  -> $portableZip ($([Math]::Round((Get-Item $portableZip).Length / 1MB, 2)) MB)"

# 3. Compile Per-User Setup Installer
Write-Host "Compiling per-user Installer (.exe)..."
& $csc /target:exe /out:$installerExe /platform:x64 /win32icon:$iconIco /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll $installerSrc
Write-Host "  -> $installerExe"

# 4. Generate SHA256 checksums
$portableHash = (Get-FileHash -Algorithm SHA256 $portableZip).Hash.ToLower()
$installerHash = (Get-FileHash -Algorithm SHA256 $installerExe).Hash.ToLower()

$sumsPath = Join-Path $dist "SHA256SUMS.txt"
@"
$installerHash  Haven-Setup-1.0.0-x64.exe
$portableHash  Haven-1.0.0-win-x64-portable.zip
"@ | Set-Content -Path $sumsPath -Encoding utf8

Write-Host ""
Write-Host "Packaging Complete!"
Write-Host "  Installer:    $installerExe"
Write-Host "  Portable ZIP: $portableZip"
Write-Host "  Checksums:    $sumsPath"
Get-Content $sumsPath
