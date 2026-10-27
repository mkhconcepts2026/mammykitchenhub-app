$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path

# Run from the MKH project root. This script only reads source files and writes a review report.
$searchRoots = @('app', 'components', 'lib', 'src', 'supabase') |
    ForEach-Object { Join-Path $root $_ } |
    Where-Object { Test-Path $_ -PathType Container }

if ($searchRoots.Count -eq 0) {
    throw "Could not find app/components/lib/src/supabase folders. Open the MKH project root in VS Code and run this script there."
}

$extensions = @('.ts', '.tsx', '.js', '.jsx', '.sql')
$excludePattern = '[\\/](node_modules|\.next|\.git|dist|build|coverage)[\\/]'
$pattern = '(?i)reassign|assignRider|assign_rider|rider_id|riderId|ready_for_pickup|ready-for-pickup|waiting for rider|assign.{0,30}order|order.{0,30}assign|process_order_settlement|complete_my_delivery'
$maxMatchesPerFile = 35
$contextBefore = 8
$contextAfter = 12

$files = foreach ($searchRoot in $searchRoots) {
    Get-ChildItem -LiteralPath $searchRoot -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $extensions -contains $_.Extension.ToLowerInvariant() -and $_.FullName -notmatch $excludePattern }
}

$report = New-Object System.Collections.Generic.List[string]
$report.Add('MKH ORDER REASSIGNMENT DIAGNOSTIC')
$report.Add("Project root: $root")
$report.Add("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$report.Add('READ-ONLY: This script does not modify application source files.')
$report.Add('')
$matchCount = 0

foreach ($file in $files) {
    try {
        $lines = [System.IO.File]::ReadAllLines($file.FullName)
    } catch {
        continue
    }

    $matchingLineNumbers = @()
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match $pattern) {
            $matchingLineNumbers += ($i + 1)
        }
    }

    if ($matchingLineNumbers.Count -eq 0) { continue }
    $report.Add(('=' * 100))
    $report.Add('FILE: ' + $file.FullName.Substring($root.Length).TrimStart('\','/'))
    $report.Add("Matching lines: $($matchingLineNumbers.Count)")

    $shown = 0
    $lastPrintedLine = 0
    foreach ($lineNumber in $matchingLineNumbers) {
        if ($shown -ge $maxMatchesPerFile) {
            $report.Add("[Per-file output limit reached; remaining matches omitted: $($matchingLineNumbers.Count - $shown)]")
            break
        }
        $start = [Math]::Max(1, $lineNumber - $contextBefore)
        $end = [Math]::Min($lines.Length, $lineNumber + $contextAfter)
        if ($start -le $lastPrintedLine) { continue }
        $report.Add('')
        $report.Add("--- lines $start-$end (match at $lineNumber) ---")
        for ($j = $start; $j -le $end; $j++) {
            $report.Add(('{0,5}: {1}' -f $j, $lines[$j - 1]))
        }
        $lastPrintedLine = $end
        $shown++
        $matchCount++
        if ($matchCount -ge 180) {
            $report.Add('')
            $report.Add('[Global output limit reached to keep this report manageable.]')
            break
        }
    }
    if ($matchCount -ge 180) { break }
    $report.Add('')
}

if ($matchCount -eq 0) {
    $report.Add('No matching code lines found. Check that this was run from the MKH project root.')
}

$outFile = Join-Path $root 'mkh-reassignment-review.txt'
[System.IO.File]::WriteAllLines($outFile, $report, [System.Text.UTF8Encoding]::new($false))
Write-Host "Diagnostic report created: $outFile"
Write-Host "Context blocks included: $matchCount"
Write-Host 'No application files were changed.'
