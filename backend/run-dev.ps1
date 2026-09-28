$ErrorActionPreference = 'Stop'
$baseDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
Set-Location -LiteralPath $baseDir
$python = Join-Path $baseDir '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    throw "Python environment not found at $python"
}
$uvicornArgs = @('-m', 'uvicorn', 'app.main:app', '--reload', '--host', '0.0.0.0', '--port', '8005')
if (Test-Path -LiteralPath (Join-Path $baseDir '.env')) {
    $uvicornArgs += @('--env-file', '.env')
}
& $python @uvicornArgs
