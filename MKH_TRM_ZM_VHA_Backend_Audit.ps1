[CmdletBinding()]
param(
    [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "Project folder not found: $ProjectRoot"
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$reportPath = Join-Path $ProjectRoot "mkh_trm_zm_vha_backend_audit_$timestamp.txt"

$excludedSegments = @(
    '\node_modules\', '\.next\', '\.git\', '\dist\', '\build\',
    '\coverage\', '\.vercel\', '\.turbo\', '\out\'
)
# The old/truncated Manager Dashboard V3 is intentionally excluded.
$excludedPaths = @(
    '\app\manager-v3\', '\app\manager-dashboard-v3\'
)

$extensions = @('.ts', '.tsx', '.js', '.jsx', '.sql', '.json', '.prisma', '.md')
$scanRoots = @(
    'app\territory-relationship-manager',
    'app\api',
    'supabase',
    'migrations',
    'lib\services',
    'lib',
    'components\territory-manager',
    'components'
) | ForEach-Object { Join-Path $ProjectRoot $_ } | Where-Object { Test-Path -LiteralPath $_ -PathType Container }

$patterns = @(
    'admin_assign_rider',
    'assignRider',
    'rider_id',
    'territory_relationship_manager',
    'territory-relationship-manager',
    'zone_manager',
    'zone-manager',
    'zone manager',
    'zone_id',
    'territory_id',
    'vendor_id',
    'profiles.*role',
    'role.*profile',
    'user_roles',
    'has_role',
    'is_admin',
    'is_manager',
    'vendor_hub_agent',
    'vha',
    'rider.*reassign',
    'reassign.*rider',
    'create policy.*orders',
    'on public\.orders',
    'security definer',
    'auth\.uid\(\)',
    'order_events'
)

function Test-ExcludedPath([string]$Path) {
    foreach ($segment in $script:excludedSegments) {
        if ($Path -match [regex]::Escape($segment)) { return $true }
    }
    foreach ($segment in $script:excludedPaths) {
        if ($Path -match [regex]::Escape($segment)) { return $true }
    }
    if ($Path -match '\.bak([.-]|$)' -or $Path -match '\.backup([.-]|$)') { return $true }
    return $false
}

$files = New-Object System.Collections.Generic.List[string]
foreach ($root in $scanRoots) {
    Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
        $full = $_.FullName
        if (($extensions -contains $_.Extension.ToLowerInvariant()) -and -not (Test-ExcludedPath $full)) {
            if (-not $files.Contains($full)) { $files.Add($full) }
        }
    }
}

# Also include project configuration files at the root that may define routes or scripts.
Get-ChildItem -LiteralPath $ProjectRoot -File -ErrorAction SilentlyContinue | ForEach-Object {
    if (($extensions -contains $_.Extension.ToLowerInvariant()) -and -not (Test-ExcludedPath $_.FullName)) {
        if (-not $files.Contains($_.FullName)) { $files.Add($_.FullName) }
    }
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('MKH ACTIVE TRM + FUTURE ZM/VHA REASSIGNMENT BACKEND AUDIT (READ-ONLY)')
$lines.Add("Project: $ProjectRoot")
$lines.Add("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$lines.Add("Files scanned: $($files.Count)")
$lines.Add('Scope: active TRM dashboard, API/backend, Supabase/migration SQL, service code, and related components.')
$lines.Add('Excluded: app\manager-v3 and app\manager-dashboard-v3 (retired/truncated dashboard), dependencies, build output, backups.')
$lines.Add('No source files, database objects, or Supabase policies were modified.')
$lines.Add('')
$lines.Add('IMPORTANT: This report is a source-code audit only. It cannot prove the live Supabase policies match local migrations.')
$lines.Add('')

$matchCount = 0
foreach ($file in ($files | Sort-Object)) {
    try {
        $content = Get-Content -LiteralPath $file -ErrorAction Stop
    } catch { continue }
    if (-not $content -or $content.Count -eq 0) { continue }

    $matched = New-Object System.Collections.Generic.List[int]
    for ($i = 0; $i -lt $content.Count; $i++) {
        foreach ($pattern in $patterns) {
            if ($content[$i] -match $pattern) {
                $matched.Add($i)
                break
            }
        }
    }
    if ($matched.Count -eq 0) { continue }

    $matchCount += $matched.Count
    $lines.Add(('=' * 100))
    $relative = $file.Substring($ProjectRoot.Length).TrimStart('\','/')
    $lines.Add("FILE: $relative")
    $lines.Add("MATCHING LINES: $($matched.Count)")

    # Print compact context, merging near matches to keep the report usable.
    $ranges = New-Object System.Collections.Generic.List[object]
    foreach ($idx in $matched) {
        $start = [Math]::Max(0, $idx - 3)
        $end = [Math]::Min($content.Count - 1, $idx + 3)
        if ($ranges.Count -gt 0 -and $start -le ($ranges[$ranges.Count - 1].End + 2)) {
            $ranges[$ranges.Count - 1].End = [Math]::Max($ranges[$ranges.Count - 1].End, $end)
        } else {
            $ranges.Add([pscustomobject]@{ Start = $start; End = $end })
        }
    }

    $maxRanges = 12
    $shownRanges = 0
    foreach ($range in $ranges) {
        if ($shownRanges -ge $maxRanges) {
            $lines.Add("... omitted $($ranges.Count - $shownRanges) additional context blocks for this file")
            break
        }
        $lines.Add(('--- lines {0}-{1} ---' -f ($range.Start + 1), ($range.End + 1)))
        for ($i = $range.Start; $i -le $range.End; $i++) {
            $lineText = $content[$i]
            if ($lineText.Length -gt 300) { $lineText = $lineText.Substring(0, 300) + ' ...[line truncated]' }
            $lines.Add(('{0,5}: {1}' -f ($i + 1), $lineText))
        }
        $shownRanges++
    }
    $lines.Add('')
}

$lines.Add(('=' * 100))
$lines.Add('AUDIT SUMMARY')
$lines.Add("Files examined: $($files.Count)")
$lines.Add("Relevant matching lines before context expansion: $matchCount")
$lines.Add('Review this report to identify the authoritative role names/IDs, live RPC pathway, existing order event/audit conventions, and territory-zone-vendor relationships.')
$lines.Add('Do not treat a role label in frontend code as proof of database authorization; live Supabase RLS/functions must still be verified before granting ZM reassignment.')

# UTF-8 with BOM for reliable viewing in Windows Notepad and VS Code.
$lines | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host ''
Write-Host 'READ-ONLY AUDIT COMPLETE' -ForegroundColor Green
Write-Host "Report: $reportPath"
Write-Host "Files scanned: $($files.Count)"
Write-Host "Relevant matching lines: $matchCount"
Write-Host 'Source files and Supabase policies were not modified.'
Write-Host 'The retired Manager V3 dashboard was excluded.'
