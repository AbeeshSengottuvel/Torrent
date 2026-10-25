# Haven Release Publisher Script
# Uploads genuine self-contained installer and portable archives to GitHub Releases
# Usage: pwsh tools/publish_release.ps1 -Tag "v1.0.0"

param (
    [string]$Tag = "v1.0.0",
    [string]$Title = "Haven v1.0.0 — Apple-Grade Secure BitTorrent Client",
    [string]$Notes = "Initial stable release of Haven BitTorrent Client featuring fail-closed Network Guard, WebTorrent v3 engine, self-contained Windows installer, and Apple-grade uninstaller."
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "desktop\dist"

Write-Host "=========================================================="
Write-Host "  Haven // GitHub Release Publisher ($Tag)                "
Write-Host "=========================================================="

$setupExe = Join-Path $dist "Haven-Setup.exe"
$portableZip = Join-Path $dist "Haven-1.0.0-win-x64-portable.zip"
$uninstallExe = Join-Path $dist "Haven-Uninstall.exe"
$sumsFile = Join-Path $dist "SHA256SUMS.txt"

if (!(Test-Path $setupExe) -or !(Test-Path $portableZip)) {
    Write-Host "Distribution files missing. Running packaging tool first..." -ForegroundColor Yellow
    & pwsh -File (Join-Path $PSScriptRoot "build_windows_installer.ps1")
}

# Verify GitHub CLI
$ghCli = Get-Command gh -ErrorAction SilentlyContinue
if ($ghCli) {
    Write-Host "Publishing release $Tag to GitHub via 'gh release'..." -ForegroundColor Cyan
    gh release create $Tag `
        $setupExe `
        $portableZip `
        $uninstallExe `
        $sumsFile `
        --title $Title `
        --notes $Notes
    Write-Host "Release $Tag successfully published to GitHub Releases!" -ForegroundColor Green
} else {
    Write-Host "`n[NOTICE] GitHub CLI ('gh') not found in PATH." -ForegroundColor Yellow
    Write-Host "To publish this release to GitHub Releases manually or install 'gh':"
    Write-Host "  winget install GitHub.cli"
    Write-Host "  gh auth login"
    Write-Host "  gh release create $Tag `"$setupExe`" `"$portableZip`" `"$uninstallExe`" `"$sumsFile`" --title `"$Title`""
    Write-Host "`nAll release assets are ready in: $dist" -ForegroundColor Green
}
