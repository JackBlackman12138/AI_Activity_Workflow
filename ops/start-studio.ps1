param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$logRoot = Join-Path $studioRoot 'data\logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
function Test-StudioReady([string]$Url, [string]$Pattern) {
  try { $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2; return $response.StatusCode -eq 200 -and $response.Content -match $Pattern } catch { return $false }
}
function Start-StudioService([int]$Port, [string]$Url, [string]$Pattern, [string]$Entry, [string]$Directory, [string]$Name, [string[]]$ExtraArgs) {
  if (Test-StudioReady $Url $Pattern) { Write-Host "$Name is already running."; return }
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port is occupied by another service. See $Url" }
  if (!(Test-Path -LiteralPath $Entry)) { throw "Missing $Entry. Run npm install and npm run build in $studioRoot first." }
  $processArgs = @('"' + $Entry + '"') + $ExtraArgs
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $process = Start-Process -FilePath $nodePath -ArgumentList $processArgs -WorkingDirectory $Directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot "$Name-$stamp.log") -RedirectStandardError (Join-Path $logRoot "$Name-$stamp.err.log") -PassThru
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    if (Test-StudioReady $Url $Pattern) { Write-Host "$Name is ready."; return }
    $process.Refresh(); if ($process.HasExited) { throw "$Name failed to start. See $logRoot" }
    Start-Sleep -Milliseconds 500
  }
  throw "$Name did not become ready. See $logRoot"
}
Start-StudioService 3001 'http://127.0.0.1:3001/api/health' '"ok"\s*:\s*true' (Join-Path $studioRoot 'packages\api\dist\server.js') $studioRoot 'api' @()
Start-StudioService 5173 'http://127.0.0.1:5173/' 'src/main.tsx|/assets/index-' (Join-Path $studioRoot 'node_modules\vite\bin\vite.js') (Join-Path $studioRoot 'apps\web') 'web' @('--host','127.0.0.1','--port','5173','--strictPort')
Write-Host 'Studio: http://127.0.0.1:5173/'
if (!$NoBrowser) { Start-Process 'http://127.0.0.1:5173/' }
