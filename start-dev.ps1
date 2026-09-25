$ErrorActionPreference = 'Stop'
Write-Host "Starting Backend and Frontend servers..." -ForegroundColor Green

$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -NoExit -Command Set-Location '$backendPath'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8005"
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -NoExit -Command Set-Location '$frontendPath'; npm run dev"

Write-Host "Backend: http://127.0.0.1:8005" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
