$ErrorActionPreference = 'Stop'
Write-Host "Starting Backend and Frontend servers..." -ForegroundColor Green

$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

Start-Process -FilePath powershell.exe -WorkingDirectory $backendPath -ArgumentList @(
	'-ExecutionPolicy', 'Bypass', '-NoExit', '-File', '.\run-dev.ps1'
)
Start-Process -FilePath powershell.exe -WorkingDirectory $frontendPath -ArgumentList @(
	'-NoExit', '-Command', 'npm run dev'
)

Write-Host "Backend: http://localhost:8005" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "For other devices on your network, use this PC's IP address and allow ports 3000 and 8005 through Windows Firewall." -ForegroundColor Yellow
