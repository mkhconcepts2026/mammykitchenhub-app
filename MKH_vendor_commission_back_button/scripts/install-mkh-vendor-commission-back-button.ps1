param(
  [Parameter(Mandatory=$false)]
  [string]$ProjectRoot = "C:\MKH\mkh-app"
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Target = Join-Path $ProjectRoot 'app\vendor-dashboard-v2\commission\page.tsx'

Write-Host 'MKH Vendor Commission Agreements - Back Button Installer' -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"

if (-not (Test-Path -LiteralPath $Target -PathType Leaf)) {
  throw "Target page was not found: $Target. No files were changed."
}

$Content = Get-Content -LiteralPath $Target -Raw -Encoding UTF8
$Marker = 'data-mkh-vendor-dashboard-back="true"'
if ($Content.Contains($Marker)) {
  Write-Host 'Back to Vendor Dashboard link is already installed. No changes needed.' -ForegroundColor Yellow
  exit 0
}

$Needle = @'
<header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#ff6b00]">Mammy Kitchen Hub · Vendor Workspace</p>
'@
$Replacement = @'
<header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <a data-mkh-vendor-dashboard-back="true" href="/vendor-dashboard-v2" className="mb-4 inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-[#ff6b00] hover:text-[#ff6b00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b00]" aria-label="Back to Vendor Dashboard">
              <span aria-hidden="true">←</span> Back to Vendor Dashboard
            </a>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#ff6b00]">Mammy Kitchen Hub · Vendor Workspace</p>
'@
if (-not $Content.Contains($Needle)) {
  throw 'Expected page header was not found. No files were changed. Please share the current page.tsx header so the patch can be adapted safely.'
}

$BackupDir = Join-Path $ProjectRoot '_mkh_integration_backups'
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$Backup = Join-Path $BackupDir "vendor-commission-back-button-$Stamp"
New-Item -ItemType Directory -Path $Backup -Force | Out-Null
Copy-Item -LiteralPath $Target -Destination (Join-Path $Backup 'page.tsx')

$Updated = $Content.Replace($Needle, $Replacement)
if (-not $Updated.Contains($Marker)) {
  throw 'Safety check failed: back button marker not present after patch. Backup retained; original file not written.'
}
[System.IO.File]::WriteAllText($Target, $Updated, [System.Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host 'Back to Vendor Dashboard button installed successfully.' -ForegroundColor Green
Write-Host "Updated: app\vendor-dashboard-v2\commission\page.tsx"
Write-Host "Backup:  $Backup"
Write-Host 'The button links to /vendor-dashboard-v2. No API, database, agreement, payout, or commission enforcement logic was changed.'
Write-Host 'NEXT: run npm run build and test the button in the local vendor agreement page.' -ForegroundColor Cyan
