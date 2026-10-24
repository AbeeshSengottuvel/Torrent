# HAVEN - Magnet URI Protocol Associator for Windows
# Registers 'magnet:' links to open in Haven client

$wsRoot = Split-Path -Parent $PSScriptRoot
$electronPath = Join-Path $wsRoot "desktop\node_modules\electron\dist\electron.exe"
$desktopDir = Join-Path $wsRoot "desktop"
$iconPath = Join-Path $wsRoot "desktop\icon.ico"

if (-not (Test-Path $electronPath)) {
    Write-Error "Electron runtime not found at $electronPath"
    exit 1
}

$keyPath = "HKCU:\Software\Classes\magnet"
if (-not (Test-Path $keyPath)) {
    New-Item -Path $keyPath -Force | Out-Null
}
Set-ItemProperty -Path $keyPath -Name "(Default)" -Value "URL:BitTorrent Magnet Link"
Set-ItemProperty -Path $keyPath -Name "URL Protocol" -Value ""

$iconKey = "HKCU:\Software\Classes\magnet\DefaultIcon"
if (-not (Test-Path $iconKey)) {
    New-Item -Path $iconKey -Force | Out-Null
}
Set-ItemProperty -Path $iconKey -Name "(Default)" -Value "$iconPath,0"

$cmdKey = "HKCU:\Software\Classes\magnet\shell\open\command"
if (-not (Test-Path $cmdKey)) {
    New-Item -Path $cmdKey -Force | Out-Null
}
$cmdValue = "`"$electronPath`" `"$desktopDir`" `"%1`""
Set-ItemProperty -Path $cmdKey -Name "(Default)" -Value $cmdValue

Write-Host "[SUCCESS] Haven registered as default handler for 'magnet:' URIs."
