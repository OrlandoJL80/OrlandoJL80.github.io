$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
if (-not $env:XAI_API_KEY -and (Test-Path ".env")) {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*XAI_API_KEY\s*=\s*(.+)\s*$') { $env:XAI_API_KEY = $Matches[1].Trim().Trim('"') }
  }
}
if (-not $env:XAI_API_KEY) {
  Write-Host "Put your xAI key in .env as XAI_API_KEY=...  (console.x.ai)"
  exit 1
}
py -3 server.py
