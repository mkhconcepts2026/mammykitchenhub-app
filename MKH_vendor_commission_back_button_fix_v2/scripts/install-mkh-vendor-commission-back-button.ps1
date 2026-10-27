[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectRoot = "C:\MKH\mkh-app"
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Target = Join-Path $ProjectRoot 'app\vendor-dashboard-v2\commission\page.tsx'
$Marker = 'data-mkh-vendor-dashboard-back="true"'

Write-Host 'MKH Vendor Commission Agreements - Back Button Installer (v2)' -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"

if (-not (Test-Path -LiteralPath $Target -PathType Leaf)) {
    throw "Target page was not found: $Target. No files were changed."
}

$Content = Get-Content -LiteralPath $Target -Raw -Encoding UTF8
if ($Content.Contains($Marker)) {
    Write-Host 'Back to Vendor Dashboard link is already installed. No changes needed.' -ForegroundColor Yellow
    exit 0
}

# Insert a standalone navigation control inside the page's known content wrapper.
# This intentionally avoids matching the page header's exact formatting, which can vary.
$WrapperPattern = '(?m)(?<wrapper><div\s+className="mx-auto max-w-5xl space-y-6"\s*>)'
$WrapperMatches = [regex]::Matches($Content, $WrapperPattern)
if ($WrapperMatches.Count -ne 1) {
    throw "Expected exactly one known content wrapper in $Target, found $($WrapperMatches.Count). No files were changed."
}

$BackButton = @'

        <div className="mb-2">
          <a data-mkh-vendor-dashboard-back="true" href="/vendor-dashboard-v2" className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-[#ff6b00] hover:text-[#ff6b00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b00]" aria-label="Back to Vendor Dashboard">
            <span aria-hidden="true">←</span> Back to Vendor Dashboard
          </a>
        </div>
'@

$Updated = [regex]::Replace(
    $Content,
    $WrapperPattern,
    [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $m.Groups['wrapper'].Value + $BackButton },
    1
)

if (-not $Updated.Contains($Marker)) {
    throw 'Safety check failed: the button marker was not found after preparing the patch. No files were changed.'
}

# Timestamped backup before write.
$BackupRoot = Join-Path $ProjectRoot '_mkh_integration_backups'
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$Backup = Join-Path $BackupRoot "vendor-commission-back-button-v2-$Stamp"
New-Item -ItemType Directory -Path $Backup -Force | Out-Null
Copy-Item -LiteralPath $Target -Destination (Join-Path $Backup 'page.tsx')

[System.IO.File]::WriteAllText($Target, $Updated, [System.Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host 'Back to Vendor Dashboard button installed successfully.' -ForegroundColor Green
Write-Host 'Updated: app\vendor-dashboard-v2\commission\page.tsx'
Write-Host "Backup:  $Backup"
Write-Host 'The button links to /vendor-dashboard-v2. No API, database, agreement, payout, or commission-enforcement logic was changed.'
Write-Host 'NEXT: run npm run build and verify the button returns to the vendor dashboard.' -ForegroundColor Cyan
