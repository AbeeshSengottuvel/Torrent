# Sign Haven Binaries Locally with CurrentUser Code Signing Certificate
# Resolves "Developer Not Trusted" / "Unknown Publisher" on Windows

$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -match "Haven" } | Select-Object -First 1

if (-not $cert) {
    Write-Host "Creating new Code Signing Certificate for Haven..." -ForegroundColor Cyan
    $cert = New-SelfSignedCertificate -Type CodeSigningCert `
        -Subject "CN=Haven Open Source Project, O=Haven" `
        -KeyUsage DigitalSignature `
        -FriendlyName "Haven Open Source Project" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears(5)
}

Write-Host "Cert Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green

# Add to CurrentUser\TrustedPublisher
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "CurrentUser")
$store.Open("ReadWrite")
if (-not ($store.Certificates | Where-Object { $_.Thumbprint -eq $cert.Thumbprint })) {
    $store.Add($cert)
    Write-Host "Added certificate to CurrentUser\TrustedPublisher" -ForegroundColor Green
}
$store.Close()

# Sign local binaries
$filesToSign = @(
    "site\downloads\Haven-Setup.exe",
    "site\downloads\Haven-Setup-1.0.0-x64.exe",
    "$env:LOCALAPPDATA\Programs\Haven\Haven.exe",
    "desktop\dist\Haven-win32-x64\Haven.exe"
)

foreach ($filePath in $filesToSign) {
    if (Test-Path $filePath) {
        $status = Set-AuthenticodeSignature -FilePath $filePath -Certificate $cert
        Write-Host "Signed $filePath : $($status.Status)" -ForegroundColor Cyan
    }
}

Write-Host "`nAll Haven executables are now signed and trusted on this PC!" -ForegroundColor Green
