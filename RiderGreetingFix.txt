$ErrorActionPreference = 'Stop'

$projectRoot = (Get-Location).Path
$relativePath = 'app\rider-dashboard\page.tsx'
$filePath = Join-Path $projectRoot $relativePath

if (-not (Test-Path -LiteralPath $filePath)) {
    Write-Host "ERROR: Could not find $relativePath from $projectRoot" -ForegroundColor Red
    exit 1
}

# Read/write UTF-8 without altering the original BOM state. This is important
# because this file contains user-facing currency symbols and other Unicode.
$originalBytes = [System.IO.File]::ReadAllBytes($filePath)
$hasUtf8Bom = $originalBytes.Length -ge 3 -and
    $originalBytes[0] -eq 0xEF -and
    $originalBytes[1] -eq 0xBB -and
    $originalBytes[2] -eq 0xBF
$offset = if ($hasUtf8Bom) { 3 } else { 0 }
$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$source = $utf8Strict.GetString($originalBytes, $offset, $originalBytes.Length - $offset)

if ($source.Contains('riderFirstName')) {
    Write-Host 'No change made: riderFirstName already exists in the Rider Dashboard file.' -ForegroundColor Yellow
    Write-Host 'Please send the relevant greeting snippet so we can avoid a duplicate patch.'
    exit 1
}

$greeting = 'Good evening, Rider'
$count = ([regex]::Matches($source, [regex]::Escape($greeting))).Count
if ($count -ne 1) {
    Write-Host "ERROR: Expected exactly one literal '$greeting', found $count. No file changes were made." -ForegroundColor Red
    Write-Host 'This safeguard prevents editing an unexpected version of the dashboard.'
    exit 1
}

# Ensure the React import includes useEffect and useState without duplicates.
$reactImportPattern = '(?s)import\s+(?<clause>[^;]*?)\s+from\s+(?<quote>["''])react\k<quote>\s*;'
$reactImportMatch = [regex]::Match($source, $reactImportPattern)
if ($reactImportMatch.Success) {
    $clause = $reactImportMatch.Groups['clause'].Value
    $braceMatch = [regex]::Match($clause, '\{(?<names>[^}]*)\}')
    if ($braceMatch.Success) {
        $namesText = $braceMatch.Groups['names'].Value
        $newNames = @()
        foreach ($existingName in @('useEffect', 'useState')) {
            if ($namesText -notmatch ('(?<![\w$])' + [regex]::Escape($existingName) + '(?![\w$])')) {
                $newNames += $existingName
            }
        }
        if ($newNames.Count -gt 0) {
            $baseNames = $namesText.Trim()
            if ($baseNames.Length -gt 0 -and -not $baseNames.TrimEnd().EndsWith(',')) {
                $baseNames += ','
            }
            $updatedNames = ($baseNames + ' ' + ($newNames -join ', ')).Trim()
            $openBrace = $braceMatch.Index
            $closeBrace = $braceMatch.Index + $braceMatch.Length - 1
            $clause = $clause.Substring(0, $openBrace + 1) + $updatedNames + $clause.Substring($closeBrace)
        }
    } else {
        $clause = $clause.TrimEnd() + ', { useEffect, useState }'
    }
    $oldClause = $reactImportMatch.Groups['clause'].Value
    $replacementImport = $reactImportMatch.Value.Replace($oldClause, $clause)
    $source = $source.Substring(0, $reactImportMatch.Index) + $replacementImport + $source.Substring($reactImportMatch.Index + $reactImportMatch.Length)
} else {
    $source = "import { useEffect, useState } from 'react';`r`n" + $source
}

# Insert hooks into the exported page component, and fail safely if its shape differs.
$componentPattern = '(?m)^(?<indent>[ \t]*)export\s+default\s+function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{'
$componentMatch = [regex]::Match($source, $componentPattern)
if (-not $componentMatch.Success) {
    $defaultExportMatch = [regex]::Match($source, '(?m)^export\s+default\s+(?<name>[A-Za-z_$][\w$]*)\s*;?\s*$')
    if ($defaultExportMatch.Success) {
        $componentName = [regex]::Escape($defaultExportMatch.Groups['name'].Value)
        $componentPattern = '(?m)^(?<indent>[ \t]*)(?:const|let)\s+' + $componentName + '\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{'
        $componentMatch = [regex]::Match($source, $componentPattern)
    }
}
if (-not $componentMatch.Success) {
    Write-Host 'ERROR: Could not safely identify the exported Rider Dashboard component. No file changes were written.' -ForegroundColor Red
    exit 1
}

# Verify the Supabase client is referenced by this page before injecting its profile lookup.
if ($source -notmatch '\bsupabase\s*\.') {
    Write-Host 'ERROR: Could not find the expected Supabase client reference. No file changes were written.' -ForegroundColor Red
    exit 1
}

$hookCode = @'

  const [riderFirstName, setRiderFirstName] = useState("Rider");

  useEffect(() => {
    let cancelled = false;

    const loadRiderFirstName = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) return;

        const { data: riderProfile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", authData.user.id)
          .maybeSingle();

        const profileName = !profileError && typeof riderProfile?.full_name === "string"
          ? riderProfile.full_name
          : "";
        const metadataName = typeof authData.user.user_metadata?.full_name === "string"
          ? authData.user.user_metadata.full_name
          : typeof authData.user.user_metadata?.name === "string"
            ? authData.user.user_metadata.name
            : "";
        const fullName = (profileName || metadataName).trim();
        const firstName = fullName.split(/\s+/)[0];

        if (!cancelled && firstName) {
          setRiderFirstName(firstName);
        }
      } catch (error) {
        console.error("RIDER GREETING LOAD ERROR:", error);
      }
    };

    void loadRiderFirstName();
    return () => {
      cancelled = true;
    };
  }, []);
'@
$insertAt = $componentMatch.Index + $componentMatch.Length
$source = $source.Insert($insertAt, $hookCode)

# Replace only the visible greeting text, not modal or currency markup.
$source = $source.Replace($greeting, 'Good evening, {riderFirstName}')

# Create a timestamped backup, then write UTF-8 with the original BOM setting.
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = "$filePath.bak-first-name-greeting-$timestamp"
[System.IO.File]::Copy($filePath, $backupPath, $false)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$newBody = $utf8NoBom.GetBytes($source)
if ($hasUtf8Bom) {
    $bom = [byte[]](0xEF, 0xBB, 0xBF)
    $outputBytes = New-Object byte[] ($bom.Length + $newBody.Length)
    [Array]::Copy($bom, 0, $outputBytes, 0, $bom.Length)
    [Array]::Copy($newBody, 0, $outputBytes, $bom.Length, $newBody.Length)
    [System.IO.File]::WriteAllBytes($filePath, $outputBytes)
} else {
    [System.IO.File]::WriteAllBytes($filePath, $newBody)
}

Write-Host ''
Write-Host 'Rider greeting updated successfully.' -ForegroundColor Green
Write-Host "Updated: $filePath"
Write-Host "Backup:  $backupPath"
Write-Host 'The greeting now uses the first name from profiles.full_name, with auth metadata as fallback.'
Write-Host 'Only app\rider-dashboard\page.tsx was modified. No Supabase records or other dashboard files were changed.'
Write-Host 'Next: run npx tsc --noEmit and confirm the Rider Dashboard greeting.'
