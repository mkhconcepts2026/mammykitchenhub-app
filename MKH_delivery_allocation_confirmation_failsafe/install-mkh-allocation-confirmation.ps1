[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

function Stop-Safely([string]$Message) {
  Write-Host "`nINSTALLATION STOPPED: $Message" -ForegroundColor Red
  Write-Host 'The existing component was not overwritten.' -ForegroundColor Yellow
  exit 1
}

try {
  $root = (Resolve-Path -LiteralPath $ProjectRoot).Path
} catch {
  Stop-Safely "Project folder not found: $ProjectRoot"
}

$target = Join-Path $root 'components\admin\DeliveryAllocationSettings.tsx'
$source = Join-Path $PSScriptRoot 'payload\components\admin\DeliveryAllocationSettings.tsx'

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
  Stop-Safely "Installed component not found: $target. Check that ProjectRoot points to C:\MKH\mkh-app."
}
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
  Stop-Safely "Updated component not found in this installer folder: $source. Re-extract the complete ZIP."
}

$current = [System.IO.File]::ReadAllText($target)
$requiredAnchors = @(
  'Delivery Allocation Settings',
  'const saveDraft = async () =>',
  'const activateDraft = async () =>',
  'Save draft',
  'Activate version'
)
foreach ($anchor in $requiredAnchors) {
  if (-not $current.Contains($anchor)) {
    Stop-Safely "The installed component does not match the expected version (missing: $anchor). No overwrite performed. Send Adam the current component so the patch can be adapted safely."
  }
}

$updated = [System.IO.File]::ReadAllText($source)
if (-not $updated.Contains('Are you sure you want to save this draft?') -or
    -not $updated.Contains('Are you sure you want to activate this version?') -or
    -not $updated.Contains('No, discard edits') -or
    -not $updated.Contains('Cancel')) {
  Stop-Safely 'The supplied component is missing one or more confirmation safeguards.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backupRoot = Join-Path $root ("_mkh_integration_backups\delivery-allocation-confirmation-" + $stamp)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
Copy-Item -LiteralPath $target -Destination (Join-Path $backupRoot 'DeliveryAllocationSettings.tsx.before') -Force

try {
  Copy-Item -LiteralPath $source -Destination $target -Force
  $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
  $targetHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  if ($sourceHash -ne $targetHash) {
    throw 'The installed file hash does not match the packaged component.'
  }
} catch {
  Copy-Item -LiteralPath (Join-Path $backupRoot 'DeliveryAllocationSettings.tsx.before') -Destination $target -Force
  Stop-Safely "Could not install the update; the previous component was restored. Details: $($_.Exception.Message)"
}

Write-Host "`nMKH confirmation safeguards installed successfully." -ForegroundColor Green
Write-Host "Project: $root"
Write-Host "Updated: components\admin\DeliveryAllocationSettings.tsx"
Write-Host "Backup:  $backupRoot"
Write-Host 'Added confirmation prompts with Yes / No / Cancel for Save Draft and Activate Version.'
Write-Host 'No dashboard page, API route, database, payout behavior, or commission setting was changed.'
Write-Host "`nNEXT: run npm run build from the project root. Do not activate a version as part of this test." -ForegroundColor Cyan
