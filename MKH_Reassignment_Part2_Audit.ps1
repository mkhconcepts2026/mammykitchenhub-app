$ErrorActionPreference = 'Stop'
$projectRoot = (Get-Location).Path
if (-not (Test-Path (Join-Path $projectRoot 'package.json'))) {
    Write-Host "ERROR: Run this script from your MKH project root (the folder containing package.json)." -ForegroundColor Red
    exit 1
}

$skipDirs = @('node_modules', '.next', '.git', 'out', 'dist', 'build', 'coverage')
$rootsToScan = @('app', 'lib', 'components', 'supabase', 'scripts', 'types') | ForEach-Object {
    $p = Join-Path $projectRoot $_
    if (Test-Path $p) { Get-Item $p }
}
$extensions = @('.ts', '.tsx', '.js', '.jsx', '.sql')
$files = @()
foreach ($root in $rootsToScan) {
    $files += Get-ChildItem -LiteralPath $root.FullName -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        ($extensions -contains $_.Extension.ToLowerInvariant()) -and
        ($_.FullName -notmatch '[\\/](node_modules|\.next|\.git|out|dist|build|coverage)[\\/]') -and
        ($_.Name -notmatch '\.bak([.-]|$)')
    }
}
$files = $files | Sort-Object FullName -Unique

$patterns = @(
    'admin_assign_rider', 'assignRider', 'assign_rider', 'reassign', 'rider_locations',
    'ready_for_pickup', 'picked_up_at', 'vendor_id', 'territory_manager',
    'territory-relationship-manager', 'zone_manager', 'zone-manager', 'zm_',
    'role\s*===?\s*["''](admin|zm|zone_manager|territory_relationship_manager|trm|vha)',
    'profiles.*role', 'getUser\(', 'auth\.getUser'
)

$linesOut = [System.Collections.Generic.List[string]]::new()
$linesOut.Add('MKH RIDER REASSIGNMENT — PART 2 READ-ONLY AUDIT')
$linesOut.Add(('Project: ' + $projectRoot))
$linesOut.Add(('Generated: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')))
$linesOut.Add(('Scanned source files: ' + $files.Count))
$linesOut.Add('No project files or Supabase policies were modified.')
$linesOut.Add('')

$importantFiles = $files | Where-Object {
    $_.FullName -match '[\\/](admin-dashboard|manager-v3|territory-relationship-manager|vendor-dashboard|rider-dashboard|services|supabase|migrations)[\\/]' -or
    $_.Name -match '(rider|order|territory|manager|admin|assign|reassign).*(\.ts|\.tsx|\.sql)$'
}
$scanFiles = if ($importantFiles.Count -gt 0) { $importantFiles } else { $files }

foreach ($file in $scanFiles) {
    try { $content = Get-Content -LiteralPath $file.FullName } catch { continue }
    if (-not $content -or $content.Count -eq 0) { continue }
    $hits = @()
    for ($i = 0; $i -lt $content.Count; $i++) {
        foreach ($pattern in $patterns) {
            if ($content[$i] -match $pattern) {
                $hits += $i
                break
            }
        }
    }
    $hits = $hits | Sort-Object -Unique
    if ($hits.Count -eq 0) { continue }
    $linesOut.Add(('=' * 100))
    $linesOut.Add(('FILE: ' + $file.FullName.Substring($projectRoot.Length).TrimStart('\','/')))
    $linesOut.Add(('MATCHING LINES: ' + $hits.Count))
    $ranges = @()
    foreach ($hit in $hits) {
        $start = [Math]::Max(0, $hit - 5)
        $end = [Math]::Min($content.Count - 1, $hit + 7)
        if ($ranges.Count -gt 0 -and $start -le ($ranges[-1].End + 2)) {
            if ($end -gt $ranges[-1].End) { $ranges[-1].End = $end }
        } else {
            $ranges += [pscustomobject]@{ Start = $start; End = $end }
        }
    }
    $printed = 0
    foreach ($range in $ranges) {
        $linesOut.Add(('--- lines ' + ($range.Start + 1) + '-' + ($range.End + 1) + ' ---'))
        for ($j = $range.Start; $j -le $range.End; $j++) {
            $linesOut.Add(('{0,5}: {1}' -f ($j + 1), $content[$j]))
            $printed++
            if ($printed -ge 220) { break }
        }
        if ($printed -ge 220) { $linesOut.Add('[Further matching context omitted for this file to keep the report manageable.]'); break }
    }
    $linesOut.Add('')
}

if ($linesOut.Count -le 6) {
    $linesOut.Add('No matching reassignment/role workflow was found in the scanned source folders.')
}
$reportName = 'mkh_reassignment_part2_audit_' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt'
$reportPath = Join-Path $projectRoot $reportName
$linesOut | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host ''
Write-Host 'READ-ONLY AUDIT COMPLETE' -ForegroundColor Green
Write-Host 'No source files or database policies were changed.'
Write-Host "Report created: $reportPath" -ForegroundColor Cyan
Write-Host 'Please upload that report here. You do not need to open or inspect it yourself.'
