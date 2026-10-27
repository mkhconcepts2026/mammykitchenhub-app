$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$adminPath = Join-Path $root 'app\admin-dashboard\page.tsx'
$managerV3Path = Join-Path $root 'app\manager-v3\page.tsx'

foreach ($path in @($adminPath, $managerV3Path)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required file not found: $path. No source files were changed. Run this script from the MKH project root."
    }
}

$adminOriginal = Get-Content -LiteralPath $adminPath -Raw
$managerOriginal = Get-Content -LiteralPath $managerV3Path -Raw
$adminUpdated = $adminOriginal
$managerUpdated = $managerOriginal

# Admin dashboard: allow an eligible pre-pickup order to be reassigned as well as assigned.
$adminPattern = '(?s)if\s*\(\s*selectedOrder\.status\s*!==\s*["'']ready_for_pickup["'']\s*\|\|.{0,300}?\)\s*\{\s*alert\s*\(\s*["'']Only an unassigned order that is ready for pickup can be assigned\.["'']\s*\)\s*;\s*return\s*;\s*\}'
$adminMatches = [regex]::Matches($adminOriginal, $adminPattern)
if ($adminMatches.Count -ne 1) {
    throw "Could not uniquely identify the Admin Dashboard assignment guard (matches: $($adminMatches.Count)). No source files were changed."
}
$adminReplacement = @'
if (
    !["ready_for_pickup", "assigned"].includes(selectedOrder.status) ||
    selectedOrder.picked_up_at != null
  ) {
    alert("Only orders ready for pickup and not yet picked up can be assigned or reassigned.");
    return;
  }
'@
$adminUpdated = [regex]::Replace($adminOriginal, $adminPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $adminReplacement }, 1)

# Manager V3: ensure its direct assignment update also writes status='assigned'.
$managerPattern = '(?s)(async\s+function\s+assignRider\s*\(\s*orderId\s*:\s*string\s*,\s*riderId\s*:\s*string\s*\)\s*\{.{0,1500}?\.from\s*\(\s*["'']orders["'']\s*\)\s*\.update\s*\(\s*\{)(.*?)(\}\s*\))'
$managerMatch = [regex]::Match($managerOriginal, $managerPattern)
if (-not $managerMatch.Success) {
    throw 'Could not uniquely locate the Manager V3 assignRider update. No source files were changed.'
}
$managerBody = $managerMatch.Groups[2].Value
if ($managerBody -notmatch '\brider_id\s*:') {
    throw 'Manager V3 assignment update did not contain rider_id. No source files were changed.'
}
if ($managerBody -match '\bstatus\s*:') {
    $managerBodyUpdated = [regex]::Replace(
        $managerBody,
        '\bstatus\s*:\s*["''][^"'']*["'']',
        'status: "assigned"',
        1
    )
} else {
    $trimmedBody = $managerBody.TrimEnd()
    if ($trimmedBody.EndsWith(',')) {
        $managerBodyUpdated = $trimmedBody + "`r`n        status: ""assigned"",`r`n"
    } else {
        $managerBodyUpdated = $trimmedBody + ",`r`n        status: ""assigned"",`r`n"
    }
}
$managerUpdated = $managerOriginal.Substring(0, $managerMatch.Groups[1].Index) +
    $managerMatch.Groups[1].Value + $managerBodyUpdated + $managerMatch.Groups[3].Value +
    $managerOriginal.Substring($managerMatch.Groups[3].Index + $managerMatch.Groups[3].Length)

# Prepare all edits in memory first; make timestamped backups before writing either file.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$adminBackup = "$adminPath.bak-$stamp"
$managerBackup = "$managerV3Path.bak-$stamp"
Copy-Item -LiteralPath $adminPath -Destination $adminBackup
Copy-Item -LiteralPath $managerV3Path -Destination $managerBackup

try {
    Set-Content -LiteralPath $adminPath -Value $adminUpdated -Encoding utf8
    Set-Content -LiteralPath $managerV3Path -Value $managerUpdated -Encoding utf8
} catch {
    Copy-Item -LiteralPath $adminBackup -Destination $adminPath -Force
    Copy-Item -LiteralPath $managerBackup -Destination $managerV3Path -Force
    throw "Patch write failed; original files were restored from backups. $($_.Exception.Message)"
}

Write-Host ''
Write-Host 'MKH reassignment code patch applied.' -ForegroundColor Green
Write-Host "Admin Dashboard backup: $adminBackup"
Write-Host "Manager V3 backup:     $managerBackup"
Write-Host ''
Write-Host 'Next: run the SQL function fix in Supabase, then test assignment and reassignment before deleting the legacy test order.'
