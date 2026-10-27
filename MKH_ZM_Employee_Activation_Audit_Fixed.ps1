# MKH ZM Employee Activation Workflow Audit (READ-ONLY)
# Scans the active project code and local SQL migrations for existing employee
# provisioning, approval, profile activation, and ZM-to-zone assignment logic.
# Does NOT modify project files, execute SQL, or change Supabase.

$ErrorActionPreference = 'Stop'
$ProjectRoot = 'C:\MKH\mkh-app'
if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "Project folder not found: $ProjectRoot. Open this script from the MKH project environment."
}

$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ReportPath = Join-Path $ProjectRoot "mkh_zm_employee_activation_audit_$Timestamp.txt"

$Extensions = @('.ts', '.tsx', '.js', '.jsx', '.sql', '.json', '.md')
$Terms = @(
    'employment_status', 'employee_approvals', 'approval_status', 'approved_at',
    'approved_by', 'Pending Activation', 'pending activation', 'Onboarding',
    'activateEmployee', 'activate employee', 'activation', 'employee_roles',
    'system_role', 'profile_id', 'must_change_password', 'status.*active',
    'zonal_manager_zones', 'ZONAL_MANAGER', 'Zonal Manager',
    'reports_to', 'createEmployee', 'employees/create', 'employee.*approve',
    'approve.*employee', 'reject.*employee', 'set.*profile.*status'
)

$allFiles = Get-ChildItem -LiteralPath $ProjectRoot -File -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object {
        $Extensions -contains $_.Extension.ToLowerInvariant() -and
        -not ($_.FullName -match '\\node_modules\\|\\\.next\\|\\\.git\\|\\dist\\|\\build\\|\\coverage\\|\\\.vercel\\|\\app\\manager-v3\\|\\app\\manager-dashboard-v3\\') -and
        -not ($_.Name -match '\.bak($|[-.])|\.backup($|[-.])|\.old($|[-.])|page1\.tsx$|package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$')
    }

$report = New-Object System.Collections.Generic.List[string]
$report.Add('MKH ZM EMPLOYEE ACTIVATION WORKFLOW AUDIT (READ-ONLY)')
$report.Add("Project: $ProjectRoot")
$report.Add("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$report.Add("Scanned source files: $($allFiles.Count)")
$report.Add('Excluded: dependencies, build output, backups, retired Manager Dashboard V3 paths.')
$report.Add('No files or Supabase database objects were modified.')
$report.Add('')
$report.Add('IMPORTANT: This is a local source-code audit. It does not prove live Supabase state or execute any activation workflow.')
$report.Add('')

$maxFiles = 1800
$scanned = 0
$matchedFiles = 0
foreach ($file in $allFiles) {
    $scanned++
    if ($scanned -gt $maxFiles) { break }
    try {
        $lines = [System.IO.File]::ReadAllLines($file.FullName)
    } catch { continue }

    $lineFindings = New-Object System.Collections.Generic.List[object]
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        $matchedTerms = @($Terms | Where-Object { $line -match $_ })
        if ($matchedTerms.Count -gt 0) {
            $start = [Math]::Max(0, $i - 3)
            $end = [Math]::Min($lines.Length - 1, $i + 3)
            $context = New-Object System.Collections.Generic.List[string]
            for ($j = $start; $j -le $end; $j++) {
                $context.Add(('{0,5}: {1}' -f ($j + 1), $lines[$j]))
            }
            $lineFindings.Add([PSCustomObject]@{
                Line = $i + 1
                Terms = ($matchedTerms -join ', ')
                Context = ($context -join "`r`n")
            })
        }
    }
    if ($lineFindings.Count -gt 0) {
        $matchedFiles++
        $report.Add(('=' * 100))
        $report.Add("FILE: $($file.FullName.Substring($ProjectRoot.Length + 1))")
        $report.Add("MATCHING LINES: $($lineFindings.Count)")
        # Limit per file to keep the report practical and useful
        $limit = [Math]::Min(18, $lineFindings.Count)
        for ($k = 0; $k -lt $limit; $k++) {
            $m = $lineFindings[$k]
            $report.Add("--- line $($m.Line) | matched: $($m.Terms) ---")
            $report.Add($m.Context)
        }
        if ($lineFindings.Count -gt $limit) {
            $report.Add("... $($lineFindings.Count - $limit) additional matching lines in this file omitted.")
        }
        $report.Add('')
    }
}

$report.Add(('=' * 100))
$report.Add('AUDIT SUMMARY')
$report.Add("Files examined: $([Math]::Min($scanned, $maxFiles))")
$report.Add("Files with relevant matches: $matchedFiles")
if ($scanned -gt $maxFiles) { $report.Add("Scan capped at $maxFiles files to avoid excessive runtime.") }
$report.Add('Review: employee create API/service, approval/activation handlers, profile status changes, role definitions, and ZM-zone assignment workflow.')
$report.Add('No implementation or database changes were performed.')

[System.IO.File]::WriteAllLines($ReportPath, $report.ToArray(), [System.Text.UTF8Encoding]::new($true))
Write-Host ''
Write-Host 'AUDIT COMPLETE' -ForegroundColor Green
Write-Host "Report created: $ReportPath" -ForegroundColor Cyan
Write-Host "Files scanned: $([Math]::Min($scanned, $maxFiles))"
Write-Host "Files with relevant matches: $matchedFiles"
Write-Host 'Read-only audit: no source files or database objects were changed.'
