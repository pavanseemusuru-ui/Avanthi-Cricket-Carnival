$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    throw "Python environment not found at $python"
}
$uvicornArgs = @('-m', 'uvicorn', 'app.main:app', '--reload', '--host', '0.0.0.0', '--port', '8005')
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.env')) {
    $uvicornArgs += @('--env-file', '.env')
}
& $python @uvicornArgs
