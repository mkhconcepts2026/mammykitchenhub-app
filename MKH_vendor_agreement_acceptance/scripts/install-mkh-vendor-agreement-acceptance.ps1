[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\MKH\mkh-app"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$sidebarRelative = "components\vendor\VendorSidebar.tsx"
$apiRelative = "app\api\vendor\commission-agreements\route.ts"
$pageRelative = "app\vendor-dashboard-v2\commission\page.tsx"

$sidebarPath = Join-Path $ProjectRoot $sidebarRelative
$apiPath = Join-Path $ProjectRoot $apiRelative
$pagePath = Join-Path $ProjectRoot $pageRelative
$sourceRoot = Split-Path -Parent $PSScriptRoot
$sourceApi = Join-Path $sourceRoot "app\api\vendor\commission-agreements\route.ts"
$sourcePage = Join-Path $sourceRoot "app\vendor-dashboard-v2\commission\page.tsx"

Write-Host "MKH Vendor Commission Agreement Acceptance Installer" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "Project root not found: $ProjectRoot"
}
if (-not (Test-Path -LiteralPath $sidebarPath -PathType Leaf)) {
    throw "Expected vendor sidebar not found: $sidebarPath. No files were changed."
}
foreach ($source in @($sourceApi, $sourcePage)) {
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Installer package is incomplete: $source. No files were changed."
    }
}
foreach ($target in @($apiPath, $pagePath)) {
    if (Test-Path -LiteralPath $target) {
        throw "Target already exists: $target. Installer stopped rather than overwrite it. Review and merge manually; no files were changed."
    }
}

$sidebar = [System.IO.File]::ReadAllText($sidebarPath)
$marker = 'data-mkh-commission-agreements-link="true"'
if ($sidebar.Contains($marker)) {
    throw "The vendor sidebar already has the Commission Agreements link marker. Installer stopped to prevent duplicate navigation. No files were changed."
}

$link = @'
<a href="/vendor-dashboard-v2/commission" data-mkh-commission-agreements-link="true" className="group flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold text-slate-300 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a26] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220]">
  <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-current text-[9px] font-black">CA</span>
  <span>Commission agreements</span>
</a>
'@

$updatedSidebar = $null
if ($sidebar.Contains("</nav>")) {
    # Current sidebar structure: insert into the existing navigation immediately before its close.
    $updatedSidebar = [regex]::new("</nav>").Replace($sidebar, ($link + "`r`n</nav>"), 1)
} else {
    # Support the earlier simple sidebar variant that uses navItem("kyc", "KYC Verification").
    $fallbackPattern = '(?s)(\{\s*navItem\s*\(\s*"kyc"\s*,\s*"KYC Verification"\s*\)\s*\})'
    if ([regex]::IsMatch($sidebar, $fallbackPattern)) {
        $updatedSidebar = [regex]::new($fallbackPattern).Replace($sidebar, ('$1' + "`r`n" + $link), 1)
    }
}
if ($null -eq $updatedSidebar -or $updatedSidebar -eq $sidebar) {
    throw "Could not safely locate a known vendor navigation insertion point in $sidebarRelative. No files were changed."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ProjectRoot "_mkh_integration_backups\vendor-commission-acceptance-$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
Copy-Item -LiteralPath $sidebarPath -Destination (Join-Path $backupRoot "VendorSidebar.tsx")

try {
    $apiParent = Split-Path -Parent $apiPath
    $pageParent = Split-Path -Parent $pagePath
    New-Item -ItemType Directory -Path $apiParent -Force | Out-Null
    New-Item -ItemType Directory -Path $pageParent -Force | Out-Null
    Copy-Item -LiteralPath $sourceApi -Destination $apiPath
    Copy-Item -LiteralPath $sourcePage -Destination $pagePath
    [System.IO.File]::WriteAllText($sidebarPath, $updatedSidebar, [System.Text.UTF8Encoding]::new($false))
} catch {
    # Restore the only pre-existing project file modified and remove files created by this installer.
    Copy-Item -LiteralPath (Join-Path $backupRoot "VendorSidebar.tsx") -Destination $sidebarPath -Force
    if (Test-Path -LiteralPath $apiPath) { Remove-Item -LiteralPath $apiPath -Force }
    if (Test-Path -LiteralPath $pagePath) { Remove-Item -LiteralPath $pagePath -Force }
    throw "Install failed and the existing sidebar was restored. Details: $($_.Exception.Message)"
}

Write-Host "`nMKH vendor commission agreement acceptance integration completed." -ForegroundColor Green
Write-Host "Installed: $apiRelative"
Write-Host "Installed: $pageRelative"
Write-Host "Updated:   $sidebarRelative (Commission agreements navigation link)"
Write-Host "Backup:    $backupRoot"
Write-Host "`nIMPORTANT: Run the supplied decline-status SQL migration in Supabase before using the Decline offer button."
Write-Host "NEXT: run npm run build, then verify the vendor screen using a dedicated test vendor account with a non-production offer."
Write-Host "Do not create a real vendor offer just to test this page; do not enable global commission enforcement."
