$ErrorActionPreference = 'Stop'

$projectRoot = (Get-Location).Path
$target = Join-Path $projectRoot 'app\admin-dashboard\page.tsx'

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "Cannot find $target. Run this script from C:\MKH\mkh-app. No files changed."
}

# Read the original bytes, preserve a UTF-8 BOM if present, and decode as UTF-8.
$originalBytes = [System.IO.File]::ReadAllBytes($target)
$hasUtf8Bom = $originalBytes.Length -ge 3 -and
    $originalBytes[0] -eq 0xEF -and
    $originalBytes[1] -eq 0xBB -and
    $originalBytes[2] -eq 0xBF

$start = if ($hasUtf8Bom) { 3 } else { 0 }
$payload = if ($start -lt $originalBytes.Length) {
    [byte[]]$originalBytes[$start..($originalBytes.Length - 1)]
} else {
    [byte[]]@()
}
$utf8 = [System.Text.UTF8Encoding]::new($false, $true)
$content = $utf8.GetString($payload)

$pattern = '(?s)  if \(\s*selectedOrder\.status !== "ready_for_pickup"\s*\|\|.*?\)\s*\{\s*alert\(\s*"Only an unassigned order that is ready for pickup can be assigned\."\s*\);\s*return;\s*\}'
$matchCollection = [regex]::Matches($content, $pattern)

if ($matchCollection.Count -ne 1) {
    throw "Expected exactly one old reassignment guard, found $($matchCollection.Count). No files changed. Check app/admin-dashboard/page.tsx before proceeding."
}

$replacement = @'
  if (
    !["ready_for_pickup", "assigned"].includes(selectedOrder.status) ||
    selectedOrder.picked_up_at != null
  ) {
    alert(
      "Only orders ready for pickup or already assigned, and not yet picked up, can be assigned or reassigned."
    );
    return;
  }

  if (selectedOrder.rider_id === selectedRiderId) {
    alert("This rider is already assigned to the order.");
    return;
  }
'@

$updated = [regex]::Replace($content, $pattern, $replacement, 1)
if ($updated -eq $content) {
    throw 'Patch did not change the expected guard. No files changed.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$target.bak-reassignment-guard-$stamp"
[System.IO.File]::Copy($target, $backup, $false)

$newPayload = $utf8.GetBytes($updated)
if ($hasUtf8Bom) {
    [byte[]]$finalBytes = @(0xEF, 0xBB, 0xBF) + $newPayload
} else {
    [byte[]]$finalBytes = $newPayload
}
[System.IO.File]::WriteAllBytes($target, $finalBytes)

Write-Host ''
Write-Host 'Admin reassignment guard updated successfully.' -ForegroundColor Green
Write-Host "Updated: $target"
Write-Host "Backup:  $backup"
Write-Host 'Only the client-side assignment eligibility check was changed.'
Write-Host 'No modal markup, currency formatting, Manager V3 code, or database records were changed.'
Write-Host ''
Write-Host 'Next: run npx tsc --noEmit, then retry reassignment on an order that is ready_for_pickup and not picked up.'
