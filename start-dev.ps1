$ErrorActionPreference = 'Stop'
Write-Host "Starting Backend and Frontend servers..." -ForegroundColor Green

$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -NoExit -Command Set-Location '$backendPath'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -NoExit -Command Set-Location '$frontendPath'; npm run dev"

Write-Host "Backend: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
