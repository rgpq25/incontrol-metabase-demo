param(
  [int]$Port = 3100
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$npmCmd = Join-Path $env:ProgramFiles 'nodejs\npm.cmd'
if (-not (Test-Path $npmCmd)) {
  $npmCmd = 'npm.cmd'
}

$logDir = Join-Path $repoRoot 'output\logs'
$serverLog = Join-Path $logDir 'app-pages-artifact-server.log'
$artifactDistDir = ".next-artifact-$([DateTime]::Now.ToString('yyyyMMdd-HHmmss'))"

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

Write-Host "[artifact] Using artifact build directory $artifactDistDir"
$env:ARTIFACT_DIST_DIR = $artifactDistDir

Write-Host "[artifact] Building the app"
& $npmCmd run build
if ($LASTEXITCODE -ne 0) {
  throw "Build failed with exit code $LASTEXITCODE"
}

Write-Host "[artifact] Starting the app on http://127.0.0.1:$Port"
$serverProcess = Start-Process `
  -FilePath $npmCmd `
  -ArgumentList @('run', 'start', '--', '--hostname', '127.0.0.1', '--port', $Port) `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $serverLog `
  -RedirectStandardError $serverLog `
  -PassThru

try {
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -MaximumRedirection 0 -UseBasicParsing
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        break
      }
    } catch {
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -ge 200 -and $_.Exception.Response.StatusCode.value__ -lt 400) {
        break
      }
    }

    if ($serverProcess.HasExited) {
      throw "App server exited early. See $serverLog"
    }

    Start-Sleep -Seconds 1
  }

  if ((Get-Date) -ge $deadline) {
    throw "Timed out waiting for the app server. See $serverLog"
  }

  Write-Host "[artifact] Generating screenshots and PDF deck"
  $env:APP_ARTIFACT_PORT = [string]$Port
  & node (Join-Path $repoRoot 'scripts\generate-app-pages-artifact.mjs')
  if ($LASTEXITCODE -ne 0) {
    throw "Artifact generation failed with exit code $LASTEXITCODE"
  }
}
finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }

  Remove-Item Env:APP_ARTIFACT_PORT -ErrorAction SilentlyContinue
  Remove-Item Env:ARTIFACT_DIST_DIR -ErrorAction SilentlyContinue
}
