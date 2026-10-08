$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
& npm.cmd run dev:backend:preview
exit $LASTEXITCODE
