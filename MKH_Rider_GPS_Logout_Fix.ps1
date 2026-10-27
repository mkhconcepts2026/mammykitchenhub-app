# MKH Rider GPS / Logout lifecycle fix
# Run from the project root: C:\MKH\mkh-app
# Creates a backup, makes validated edits, runs TypeScript, and restores the original if validation fails.

$ErrorActionPreference = 'Stop'

function Replace-ExactlyOne {
    param(
        [Parameter(Mandatory=$true)][string]$Text,
        [Parameter(Mandatory=$true)][string]$Pattern,
        [Parameter(Mandatory=$true)][string]$Replacement,
        [Parameter(Mandatory=$true)][string]$Description
    )
    $found = [regex]::Matches($Text, $Pattern)
    if ($found.Count -ne 1) {
        throw "Safety stop: expected exactly one match for '$Description', found $($found.Count). No source file has been changed."
    }
    return [regex]::Replace($Text, $Pattern, $Replacement, 1)
}

function Write-TextPreservingBom {
    param([string]$Path, [string]$Text, [bool]$HadBom)
    $encoding = New-Object System.Text.UTF8Encoding($false)
    $bytes = $encoding.GetBytes($Text)
    if ($HadBom) {
        $withBom = New-Object byte[] ($bytes.Length + 3)
        $withBom[0] = 0xEF; $withBom[1] = 0xBB; $withBom[2] = 0xBF
        [Array]::Copy($bytes, 0, $withBom, 3, $bytes.Length)
        [System.IO.File]::WriteAllBytes($Path, $withBom)
    } else {
        [System.IO.File]::WriteAllBytes($Path, $bytes)
    }
}

$projectRoot = (Get-Location).Path
$target = Join-Path $projectRoot 'app\rider-dashboard\page.tsx'
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "Cannot find '$target'. Open the VS Code terminal in C:\MKH\mkh-app and run this script again. Nothing was changed."
}

$bytes = [System.IO.File]::ReadAllBytes($target)
$hadBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
$original = [System.IO.File]::ReadAllText($target, [System.Text.Encoding]::UTF8)

if ($original.Contains('const isLoggingOut = useRef(false);') -and
    $original.Contains('const logoutInProgress = useRef(false);') -and
    $original.Contains('gpsIntervalRef.current = interval;') -and
    $original.Contains('RIDER LOGOUT ERROR:')) {
    Write-Host 'The GPS/logout lifecycle fix already appears to be installed. No changes made.' -ForegroundColor Green
    exit 0
}
if ($original.Contains('const isLoggingOut = useRef(false);') -or $original.Contains('RIDER LOGOUT ERROR:')) {
    throw 'Safety stop: the file appears partially patched. No source file has been changed.'
}

$gpsMatch = [regex]::Match($original, '(?s)async\s+function\s+checkCurrentLocation\s*\(\s*\)\s*\{.*?(?=\r?\n\s*useEffect\s*\()')
if (-not $gpsMatch.Success) {
    throw 'Safety stop: could not safely locate checkCurrentLocation() and its boundary. No source file has been changed.'
}
if (-not $gpsMatch.Value.Contains('.from("rider_locations")') -or
    -not $gpsMatch.Value.Contains('.upsert(') -or
    -not $gpsMatch.Value.Contains('gpsRequestInProgress.current = false')) {
    throw 'Safety stop: the GPS function does not match the expected structure. No source file has been changed.'
}

$tsc = Join-Path $projectRoot 'node_modules\.bin\tsc.cmd'
if (-not (Test-Path -LiteralPath $tsc -PathType Leaf)) {
    throw 'The local TypeScript compiler was not found. Make sure project dependencies are installed; no source file has been changed.'
}
Write-Host 'Checking the current TypeScript baseline...' -ForegroundColor Cyan
& $tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    throw 'The project already fails TypeScript validation. No source file has been changed.'
}

$updated = $original

# Add refs without changing any unrelated code.
$updated = Replace-ExactlyOne $updated '(?m)^([ \t]*)const gpsRequestInProgress = useRef\(false\);[ \t]*(\r?\n)' '$1const gpsRequestInProgress = useRef(false);$2$1const isLoggingOut = useRef(false);$2$1const logoutInProgress = useRef(false);$2$1const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);$2' 'GPS ref insertion point'

# Add logout guards inside checkCurrentLocation().
$gpsMatch = [regex]::Match($updated, '(?s)async\s+function\s+checkCurrentLocation\s*\(\s*\)\s*\{.*?(?=\r?\n\s*useEffect\s*\()')
if (-not $gpsMatch.Success) { throw 'Safety stop: GPS function could not be re-located after ref insertion. No source file has been changed.' }
$gpsFunctionOriginal = $gpsMatch.Value
$gpsFunction = $gpsFunctionOriginal
$gpsFunction = Replace-ExactlyOne $gpsFunction 'if\s*\(\s*gpsRequestInProgress\.current\s*\|\|\s*!navigator\.geolocation\s*\)\s*\{' 'if (isLoggingOut.current || gpsRequestInProgress.current || !navigator.geolocation) {' 'GPS entry guard'
$gpsFunction = Replace-ExactlyOne $gpsFunction 'if\s*\(\s*authError\s*\|\|\s*!user\s*\)\s*\{' 'if (isLoggingOut.current || authError || !user) {' 'GPS authentication guard'
$gpsFunction = Replace-ExactlyOne $gpsFunction 'if\s*\(\s*profileError\s*\|\|\s*profile\?\.role\s*!==\s*["'']rider["'']\s*\)\s*\{' 'if (isLoggingOut.current || profileError || profile?.role !== "rider") {' 'GPS role/logout guard'
$gpsExactPattern = [regex]::Escape($gpsFunctionOriginal)
$gpsExactMatches = [regex]::Matches($updated, $gpsExactPattern)
if ($gpsExactMatches.Count -ne 1) { throw 'Safety stop: could not uniquely identify the GPS function to update. No source file has been changed.' }
$gpsExactRegex = [regex]::new($gpsExactPattern)
$updated = $gpsExactRegex.Replace($updated, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $gpsFunction }, 1)

# Track the polling interval so it can be stopped at the start of logout.
$intervalPattern = '(?s)([ \t]*const interval = setInterval\(\(\)\s*=>\s*\{\s*checkCurrentLocation\(\);\s*\},\s*15000\);)'
$intervalMatches = [regex]::Matches($updated, $intervalPattern)
if ($intervalMatches.Count -ne 1) { throw "Safety stop: expected one 15-second GPS interval, found $($intervalMatches.Count). No source file has been changed." }
$intervalRegex = [regex]::new($intervalPattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
$updated = $intervalRegex.Replace($updated, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $m.Groups[1].Value + "`r`n    gpsIntervalRef.current = interval;" }, 1)

# Mark the GPS lifecycle inactive when the effect is cleaned up.
$cleanupPattern = '(?m)^([ \t]*)return\s*\(\)\s*=>\s*\{\r?\n[ \t]*clearInterval\(interval\);'
$cleanupReplacement = '$1return () => {' + "`r`n" + '$1  isLoggingOut.current = true;' + "`r`n" + '$1  clearInterval(interval);' + "`r`n" + '$1  gpsIntervalRef.current = null;'
$updated = Replace-ExactlyOne $updated $cleanupPattern $cleanupReplacement 'GPS effect cleanup'

# Replace the existing simple logout function with a guarded, one-click flow.
$logoutPattern = '(?s)async\s+function\s+logout\s*\(\s*\)\s*\{.*?\r?\n\s*\}'
$logoutMatch = [regex]::Match($updated, $logoutPattern)
if (-not $logoutMatch.Success -or $logoutMatch.Value.Contains('while (gpsRequestInProgress.current')) {
    throw 'Safety stop: logout function does not match the expected structure. No source file has been changed.'
}
$logoutReplacement = @'
async function logout() {
    if (logoutInProgress.current) return;

    logoutInProgress.current = true;
    isLoggingOut.current = true;

    if (gpsIntervalRef.current !== null) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }

    // Give a GPS/database operation already in flight time to finish before sign-out.
    let waitCount = 0;
    while (gpsRequestInProgress.current && waitCount < 120) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waitCount += 1;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("RIDER LOGOUT ERROR:", error);
        alert("Logout did not complete. Please try again.");
        logoutInProgress.current = false;
        isLoggingOut.current = false;
        return;
      }
      router.replace("/login");
    } catch (error) {
      console.error("RIDER LOGOUT ERROR:", error);
      alert("Logout did not complete. Please try again.");
      logoutInProgress.current = false;
      isLoggingOut.current = false;
    }
  }
'@
$updated = Replace-ExactlyOne $updated $logoutPattern $logoutReplacement 'logout function replacement'

foreach ($marker in @(
    'const isLoggingOut = useRef(false);',
    'const logoutInProgress = useRef(false);',
    'const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);',
    'if (isLoggingOut.current || gpsRequestInProgress.current || !navigator.geolocation)',
    'while (gpsRequestInProgress.current && waitCount < 120)',
    'router.replace("/login");'
)) {
    if (-not $updated.Contains($marker)) { throw "Safety stop: validation marker missing: $marker. No source file has been changed." }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$target.bak-gps-logout-$stamp"
[System.IO.File]::Copy($target, $backup, $false)
Write-Host "Backup created: $backup" -ForegroundColor Green

try {
    Write-TextPreservingBom -Path $target -Text $updated -HadBom $hadBom
    Write-Host 'Checking TypeScript after the patch...' -ForegroundColor Cyan
    & $tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript validation failed after the patch.' }
    Write-Host ''
    Write-Host 'SUCCESS: GPS is stopped at logout, the polling interval is cleared, in-flight GPS work is given time to finish, and duplicate logout clicks are blocked.' -ForegroundColor Green
    Write-Host 'Supabase RLS policies were not changed.' -ForegroundColor Green
    Write-Host "Backup retained at: $backup" -ForegroundColor Green
}
catch {
    Write-Host "Patch verification failed: $($_.Exception.Message)" -ForegroundColor Red
    [System.IO.File]::Copy($backup, $target, $true)
    Write-Host 'Original Rider Dashboard restored from backup.' -ForegroundColor Yellow
    throw
}
