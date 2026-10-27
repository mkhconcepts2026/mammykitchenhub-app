[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
function Stop-Safely([string]$Message) {
  Write-Host "`nINTEGRATION STOPPED: $Message" -ForegroundColor Red
  exit 1
}

try { $root = (Resolve-Path -LiteralPath $ProjectRoot).Path }
catch { Stop-Safely "Project folder not found: $ProjectRoot" }

$componentSource = Join-Path $PSScriptRoot 'payload\components\admin\VendorCommissionSettings.tsx'
$routeSource = Join-Path $PSScriptRoot 'payload\app\api\admin\vendor-commission\route.ts'
$componentTarget = Join-Path $root 'components\admin\VendorCommissionSettings.tsx'
$routeTarget = Join-Path $root 'app\api\admin\vendor-commission\route.ts'

foreach ($file in @($componentSource, $routeSource, $componentTarget, $routeTarget)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    Stop-Safely "Required file not found: $file. Install the base Vendor Commission integration first if its target files are missing."
  }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backupRoot = Join-Path $root ("_mkh_integration_backups\vendor-commission-search-" + $stamp)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$componentBackup = Join-Path $backupRoot 'VendorCommissionSettings.tsx.before'
$routeBackup = Join-Path $backupRoot 'route.ts.before'
Copy-Item -LiteralPath $componentTarget -Destination $componentBackup -Force
Copy-Item -LiteralPath $routeTarget -Destination $routeBackup -Force

try {
  Copy-Item -LiteralPath $componentSource -Destination $componentTarget -Force
  Copy-Item -LiteralPath $routeSource -Destination $routeTarget -Force
  $expectedComponent = (Get-FileHash -LiteralPath $componentSource -Algorithm SHA256).Hash
  $actualComponent = (Get-FileHash -LiteralPath $componentTarget -Algorithm SHA256).Hash
  $expectedRoute = (Get-FileHash -LiteralPath $routeSource -Algorithm SHA256).Hash
  $actualRoute = (Get-FileHash -LiteralPath $routeTarget -Algorithm SHA256).Hash
  if ($expectedComponent -ne $actualComponent -or $expectedRoute -ne $actualRoute) {
    throw 'Installed file hashes did not match the supplied search-upgrade payload.'
  }
} catch {
  Copy-Item -LiteralPath $componentBackup -Destination $componentTarget -Force
  Copy-Item -LiteralPath $routeBackup -Destination $routeTarget -Force
  Stop-Safely "Installation failed; both original files have been restored. Details: $($_.Exception.Message)"
}

Write-Host "`nMKH vendor server-side search upgrade installed successfully." -ForegroundColor Green
Write-Host "Project: $root"
Write-Host "Backup:  $backupRoot"
Write-Host 'Updated:'
Write-Host '  components\admin\VendorCommissionSettings.tsx'
Write-Host '  app\api\admin\vendor-commission\route.ts'
Write-Host 'Search behavior: case-insensitive name/email match, 20 results per server request, paginated.'
Write-Host 'Commission enforcement and payout behavior were not changed.'
Write-Host "`nNEXT: run npm run build, then test with a search such as 'ma'. Do not enable enforcement." -ForegroundColor Cyan
