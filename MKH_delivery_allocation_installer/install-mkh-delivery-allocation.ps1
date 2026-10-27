[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

function Stop-Safely([string]$Message) {
  Write-Host "`nINTEGRATION STOPPED: $Message" -ForegroundColor Red
  Write-Host 'No page.tsx changes have been written by this script.' -ForegroundColor Yellow
  exit 1
}

try {
  $root = (Resolve-Path -LiteralPath $ProjectRoot).Path
} catch {
  Stop-Safely "Project folder not found: $ProjectRoot"
}

$pagePath = Join-Path $root 'app\admin-dashboard\page.tsx'
$componentSource = Join-Path $PSScriptRoot 'payload\components\admin\DeliveryAllocationSettings.tsx'
$routeSource = Join-Path $PSScriptRoot 'payload\app\api\admin\delivery-allocation\route.ts'
$componentTarget = Join-Path $root 'components\admin\DeliveryAllocationSettings.tsx'
$routeTarget = Join-Path $root 'app\api\admin\delivery-allocation\route.ts'

foreach ($requiredFile in @($pagePath, $componentSource, $routeSource)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    Stop-Safely "Required file not found: $requiredFile"
  }
}

$pageText = [System.IO.File]::ReadAllText($pagePath)
$newline = if ($pageText.Contains("`r`n")) { "`r`n" } else { "`n" }
$componentImport = 'import DeliveryAllocationSettings from "@/components/admin/DeliveryAllocationSettings";'
$changes = [System.Collections.Generic.List[string]]::new()

# Build the page changes in memory first. If an expected anchor is missing, do not partially install.
if ($pageText -notmatch 'DeliveryAllocationSettings') {
  $clientDirective = [regex]::Match($pageText, '(?m)^"use client";?[ \t]*\r?\n')
  if (-not $clientDirective.Success) {
    Stop-Safely 'Could not find the top-level "use client" directive in app\admin-dashboard\page.tsx.'
  }
  $pageText = $pageText.Insert($clientDirective.Index + $clientDirective.Length, $componentImport + $newline)
  $changes.Add('Added DeliveryAllocationSettings import')
} elseif ($pageText -notmatch [regex]::Escape($componentImport)) {
  Stop-Safely 'The page already mentions DeliveryAllocationSettings but does not have the expected import. Review that existing integration manually.'
}

# Add a desktop sidebar item using the same icon already used for Revenue.
if ($pageText -notmatch '\[\s*"delivery-allocations"\s*,\s*"Delivery Allocations"\s*,\s*[A-Za-z_$][\w$]*') {
  $desktopPattern = '(?m)^([ \t]*)\["revenue",\s*"Revenue",\s*([A-Za-z_$][\w$]*)\],?[ \t]*\r?$'
  $desktopMatch = [regex]::Match($pageText, $desktopPattern)
  if (-not $desktopMatch.Success) {
    Stop-Safely 'Could not find the Revenue item in the desktop sidebar array. No page changes have been saved; send me the sidebar section so I can adapt the patch to the current file.'
  }
  $indent = $desktopMatch.Groups[1].Value
  $iconName = $desktopMatch.Groups[2].Value
  $replacement = $desktopMatch.Value.TrimEnd([char]13) + $newline + $indent + '["delivery-allocations", "Delivery Allocations", ' + $iconName + '],'
  $pageText = $pageText.Remove($desktopMatch.Index, $desktopMatch.Length).Insert($desktopMatch.Index, $replacement)
  $changes.Add('Added Delivery Allocations desktop menu item')
}

# Add a mobile menu item if this page has its simple mobile navigation array.
if ($pageText -notmatch '\[\s*"delivery-allocations"\s*,\s*"Delivery Allocations"\s*\],?') {
  $mobilePattern = '(?m)^([ \t]*)\["revenue",\s*"Revenue"\],?[ \t]*\r?$'
  $mobileMatch = [regex]::Match($pageText, $mobilePattern)
  if (-not $mobileMatch.Success) {
    Stop-Safely 'Could not find the Revenue item in the mobile navigation array. No page changes have been saved; send me the mobile navigation section so I can adapt the patch to the current file.'
  }
  $mobileIndent = $mobileMatch.Groups[1].Value
  $mobileReplacement = $mobileMatch.Value.TrimEnd([char]13) + $newline + $mobileIndent + '["delivery-allocations", "Delivery Allocations"],'
  $pageText = $pageText.Remove($mobileMatch.Index, $mobileMatch.Length).Insert($mobileMatch.Index, $mobileReplacement)
  $changes.Add('Added Delivery Allocations mobile menu item')
}

# Render the settings inside the existing content area immediately before the Revenue section.
if ($pageText -notmatch 'activeTab\s*===\s*"delivery-allocations"') {
  $renderPattern = '(?m)^([ \t]*)\{activeTab\s*===\s*"revenue"\s*&&\s*\('
  $renderMatch = [regex]::Match($pageText, $renderPattern)
  if (-not $renderMatch.Success) {
    Stop-Safely 'Could not find the Revenue content section. No page changes have been saved; send me that section so I can adapt the patch to the current file.'
  }
  $renderIndent = $renderMatch.Groups[1].Value
  $renderLine = $renderIndent + '{activeTab === "delivery-allocations" && <DeliveryAllocationSettings />}' + $newline
  $pageText = $pageText.Insert($renderMatch.Index, $renderLine)
  $changes.Add('Connected the settings component to the dashboard content switch')
} elseif ($pageText -notmatch '<DeliveryAllocationSettings\s*/>') {
  Stop-Safely 'A Delivery Allocations tab marker already exists but its component render was not recognized. No page changes have been saved.'
}

# Check service-role key presence without displaying its value.
$envPath = Join-Path $root '.env.local'
$hasServiceRoleSetting = $false
if (Test-Path -LiteralPath $envPath -PathType Leaf) {
  $envText = [System.IO.File]::ReadAllText($envPath)
  $hasServiceRoleSetting = $envText -match '(?m)^\s*SUPABASE_SERVICE_ROLE_KEY\s*='
}

# All anchors passed. Create timestamped backups before writing anything.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $root ("_mkh_integration_backups\delivery-allocation-" + $stamp)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
Copy-Item -LiteralPath $pagePath -Destination (Join-Path $backupRoot 'page.tsx.before') -Force
if (Test-Path -LiteralPath $componentTarget -PathType Leaf) {
  Copy-Item -LiteralPath $componentTarget -Destination (Join-Path $backupRoot 'DeliveryAllocationSettings.tsx.before') -Force
}
if (Test-Path -LiteralPath $routeTarget -PathType Leaf) {
  Copy-Item -LiteralPath $routeTarget -Destination (Join-Path $backupRoot 'route.ts.before') -Force
}

# Copy the component and API first; then save the dashboard integration last.
New-Item -ItemType Directory -Path (Split-Path -Parent $componentTarget) -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $routeTarget) -Force | Out-Null
Copy-Item -LiteralPath $componentSource -Destination $componentTarget -Force
Copy-Item -LiteralPath $routeSource -Destination $routeTarget -Force
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($pagePath, $pageText, $utf8NoBom)

Write-Host "`nMKH Delivery Allocation Settings integration completed." -ForegroundColor Green
Write-Host "Project: $root"
Write-Host "Backup:  $backupRoot"
Write-Host "Files installed:" 
Write-Host "  app\admin-dashboard\page.tsx (integrated; timestamped backup saved)"
Write-Host "  components\admin\DeliveryAllocationSettings.tsx"
Write-Host "  app\api\admin\delivery-allocation\route.ts"
foreach ($change in $changes) { Write-Host "  + $change" }

if (-not $hasServiceRoleSetting) {
  Write-Host "`nACTION REQUIRED: .env.local does not appear to define SUPABASE_SERVICE_ROLE_KEY." -ForegroundColor Yellow
  Write-Host 'Add it locally as a server-only variable. Do not use a NEXT_PUBLIC_ prefix and never paste its value into chat or client code.' -ForegroundColor Yellow
}

Write-Host "`nNEXT: run npm run build from the project root. Do not activate a new allocation draft yet; first verify the screen loads and shows active version 1." -ForegroundColor Cyan
