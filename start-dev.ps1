$ErrorActionPreference = 'Stop'
$rootDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
Write-Host "Starting Backend and Frontend servers..." -ForegroundColor Green

$backendPath = Join-Path $rootDir "backend"
$frontendPath = Join-Path $rootDir "frontend"
$backendScript = Join-Path $backendPath "run-dev.ps1"

Start-Process -FilePath powershell.exe -WorkingDirectory $backendPath -ArgumentList @(
	'-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-File', "`"$backendScript`""
)
Start-Process -FilePath powershell.exe -WorkingDirectory $frontendPath -ArgumentList @(
	'-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-Command', "Set-Location `"$frontendPath`"; npm run dev -- --open"
)

Write-Host "Backend: http://localhost:8005" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "For other devices on your network, use this PC's IP address and allow ports 3000 and 8005 through Windows Firewall." -ForegroundColor Yellow
