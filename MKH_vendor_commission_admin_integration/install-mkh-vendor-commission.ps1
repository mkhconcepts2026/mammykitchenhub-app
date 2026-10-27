[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

function Stop-Safely([string]$Message) {
  Write-Host "`nINTEGRATION STOPPED: $Message" -ForegroundColor Red
  Write-Host 'No dashboard changes were saved by this installer.' -ForegroundColor Yellow
  exit 1
}

try {
  $root = (Resolve-Path -LiteralPath $ProjectRoot).Path
} catch {
  Stop-Safely "Project folder not found: $ProjectRoot"
}

$pagePath = Join-Path $root 'app\admin-dashboard\page.tsx'
$componentSource = Join-Path $PSScriptRoot 'payload\components\admin\VendorCommissionSettings.tsx'
$routeSource = Join-Path $PSScriptRoot 'payload\app\api\admin\vendor-commission\route.ts'
$componentTarget = Join-Path $root 'components\admin\VendorCommissionSettings.tsx'
$routeTarget = Join-Path $root 'app\api\admin\vendor-commission\route.ts'

foreach ($requiredFile in @($pagePath, $componentSource, $routeSource)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    Stop-Safely "Required file not found: $requiredFile"
  }
}

$pageText = [System.IO.File]::ReadAllText($pagePath)
$newline = if ($pageText.Contains("`r`n")) { "`r`n" } else { "`n" }
$importLine = 'import VendorCommissionSettings from "@/components/admin/VendorCommissionSettings";'
$changes = [System.Collections.Generic.List[string]]::new()

if ($pageText -notmatch 'VendorCommissionSettings') {
  $existingImport = [regex]::Match($pageText, '(?m)^import DeliveryAllocationSettings from "@/components/admin/DeliveryAllocationSettings";?[ \t]*\r?$')
  if (-not $existingImport.Success) {
    Stop-Safely 'Could not find the installed DeliveryAllocationSettings import. This installer expects the preceding Delivery Allocations integration to be installed.'
  }
  $pageText = $pageText.Insert($existingImport.Index + $existingImport.Length, $newline + $importLine)
  $changes.Add('Added VendorCommissionSettings import')
} elseif ($pageText -notmatch [regex]::Escape($importLine)) {
  Stop-Safely 'The page mentions VendorCommissionSettings but the expected import is missing. Please inspect the current page before retrying.'
}

# The desktop list already contains the integrated Delivery Allocations item.
if ($pageText -notmatch '\[\s*"vendor-commission"\s*,\s*"Vendor Commission"') {
  $desktopPattern = '(?m)^([ \t]*)\["delivery-allocations",\s*"Delivery Allocations",\s*([A-Za-z_$][\w$]*)\],?[ \t]*\r?$'
  $desktopMatch = [regex]::Match($pageText, $desktopPattern)
  if (-not $desktopMatch.Success) {
    Stop-Safely 'Could not find the Delivery Allocations desktop menu item. No files were overwritten; send me the sidebar section to adapt the installer.'
  }
  $indent = $desktopMatch.Groups[1].Value
  $replacement = $desktopMatch.Value.TrimEnd([char]13) + $newline + $indent + '["vendor-commission", "Vendor Commission", Store],'
  $pageText = $pageText.Remove($desktopMatch.Index, $desktopMatch.Length).Insert($desktopMatch.Index, $replacement)
  $changes.Add('Added Vendor Commission desktop menu item')
}

# Add the mobile nav link as a simple key/label pair.
if ($pageText -notmatch '\[\s*"vendor-commission"\s*,\s*"Vendor Commission"\s*\]') {
  $mobilePattern = '(?m)^([ \t]*)\["delivery-allocations",\s*"Delivery Allocations"\],?[ \t]*\r?$'
  $mobileMatch = [regex]::Match($pageText, $mobilePattern)
  if (-not $mobileMatch.Success) {
    Stop-Safely 'Could not find the Delivery Allocations mobile menu item. No files were overwritten; send me the mobile navigation section to adapt the installer.'
  }
  $indent = $mobileMatch.Groups[1].Value
  $replacement = $mobileMatch.Value.TrimEnd([char]13) + $newline + $indent + '["vendor-commission", "Vendor Commission"],'
  $pageText = $pageText.Remove($mobileMatch.Index, $mobileMatch.Length).Insert($mobileMatch.Index, $replacement)
  $changes.Add('Added Vendor Commission mobile menu item')
}

# Render inside the existing dashboard page before the delivery allocation section.
if ($pageText -notmatch 'activeTab\s*===\s*"vendor-commission"') {
  $renderPattern = '(?m)^([ \t]*)\{activeTab\s*===\s*"delivery-allocations"\s*&&\s*<DeliveryAllocationSettings\s*/>\}'
  $renderMatch = [regex]::Match($pageText, $renderPattern)
  if (-not $renderMatch.Success) {
    Stop-Safely 'Could not find the Delivery Allocations content switch. No files were written; send me that section so I can adapt the patch safely.'
  }
  $indent = $renderMatch.Groups[1].Value
  $insert = $indent + '{activeTab === "vendor-commission" && <VendorCommissionSettings />}' + $newline
  $pageText = $pageText.Insert($renderMatch.Index, $insert)
  $changes.Add('Connected Vendor Commission screen to the dashboard content switch')
} elseif ($pageText -notmatch '<VendorCommissionSettings\s*/>') {
  Stop-Safely 'A Vendor Commission tab marker already exists but its component render was not recognized. No files were written.'
}

# This page already uses Store in the vendor navigation. Stop rather than create a broken symbol if changed.
if ($pageText -notmatch '(?s)import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*["\x27]lucide-react["\x27]') {
  Stop-Safely 'The current dashboard does not appear to import Store from lucide-react, which this menu entry uses. No files were written.'
}

$envPath = Join-Path $root '.env.local'
$hasServiceRoleSetting = $false
if (Test-Path -LiteralPath $envPath -PathType Leaf) {
  $envText = [System.IO.File]::ReadAllText($envPath)
  $hasServiceRoleSetting = $envText -match '(?m)^\s*SUPABASE_SERVICE_ROLE_KEY\s*='
}

# Back up any target files and the page before modifying anything.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backupRoot = Join-Path $root ("_mkh_integration_backups\vendor-commission-" + $stamp)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
Copy-Item -LiteralPath $pagePath -Destination (Join-Path $backupRoot 'page.tsx.before') -Force
if (Test-Path -LiteralPath $componentTarget -PathType Leaf) {
  Copy-Item -LiteralPath $componentTarget -Destination (Join-Path $backupRoot 'VendorCommissionSettings.tsx.before') -Force
}
if (Test-Path -LiteralPath $routeTarget -PathType Leaf) {
  Copy-Item -LiteralPath $routeTarget -Destination (Join-Path $backupRoot 'route.ts.before') -Force
}

try {
  New-Item -ItemType Directory -Path (Split-Path -Parent $componentTarget) -Force | Out-Null
  New-Item -ItemType Directory -Path (Split-Path -Parent $routeTarget) -Force | Out-Null
  Copy-Item -LiteralPath $componentSource -Destination $componentTarget -Force
  Copy-Item -LiteralPath $routeSource -Destination $routeTarget -Force
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($pagePath, $pageText, $utf8NoBom)

  $componentHash = (Get-FileHash -LiteralPath $componentSource -Algorithm SHA256).Hash
  $installedComponentHash = (Get-FileHash -LiteralPath $componentTarget -Algorithm SHA256).Hash
  $routeHash = (Get-FileHash -LiteralPath $routeSource -Algorithm SHA256).Hash
  $installedRouteHash = (Get-FileHash -LiteralPath $routeTarget -Algorithm SHA256).Hash
  if ($componentHash -ne $installedComponentHash -or $routeHash -ne $installedRouteHash) {
    throw 'Installed component/API file hashes do not match the supplied payload.'
  }
} catch {
  Copy-Item -LiteralPath (Join-Path $backupRoot 'page.tsx.before') -Destination $pagePath -Force
  $componentBackup = Join-Path $backupRoot 'VendorCommissionSettings.tsx.before'
  $routeBackup = Join-Path $backupRoot 'route.ts.before'
  if (Test-Path -LiteralPath $componentBackup) { Copy-Item -LiteralPath $componentBackup -Destination $componentTarget -Force }
  elseif (Test-Path -LiteralPath $componentTarget) { Remove-Item -LiteralPath $componentTarget -Force }
  if (Test-Path -LiteralPath $routeBackup) { Copy-Item -LiteralPath $routeBackup -Destination $routeTarget -Force }
  elseif (Test-Path -LiteralPath $routeTarget) { Remove-Item -LiteralPath $routeTarget -Force }
  Stop-Safely "Install failed and previous page/component/route files were restored where they existed. Details: $($_.Exception.Message)"
}

Write-Host "`nMKH Vendor Commission Admin integration completed." -ForegroundColor Green
Write-Host "Project: $root"
Write-Host "Backup:  $backupRoot"
Write-Host 'Installed:'
Write-Host '  app\admin-dashboard\page.tsx'
Write-Host '  components\admin\VendorCommissionSettings.tsx'
Write-Host '  app\api\admin\vendor-commission\route.ts'
foreach ($change in $changes) { Write-Host "  + $change" }
if (-not $hasServiceRoleSetting) {
  Write-Host "`nACTION REQUIRED: .env.local does not appear to define SUPABASE_SERVICE_ROLE_KEY." -ForegroundColor Yellow
  Write-Host 'The API reads admin-only records server-side. Add the variable locally without a NEXT_PUBLIC_ prefix; never paste the value into chat or client code.' -ForegroundColor Yellow
}
Write-Host "`nNEXT: run npm run build. Then check Vendor Commission in the local Admin Dashboard. Do not enable enforcement." -ForegroundColor Cyan
