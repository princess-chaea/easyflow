$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

$root = Split-Path -Parent $PSScriptRoot
$source = Get-ChildItem -LiteralPath $root -Filter '*.html' -File |
    Where-Object { Select-String -LiteralPath $_.FullName -Pattern 'const checklistDatabase' -Quiet } |
    Select-Object -First 1
if (-not $source) { throw 'Checklist HTML was not found.' }

$html = [System.IO.File]::ReadAllText($source.FullName, [System.Text.Encoding]::UTF8)
$dbMatch = [regex]::Match($html, 'const checklistDatabase\s*=\s*(\{.*?\n\s*\});', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $dbMatch.Success) { throw 'checklistDatabase was not found.' }
$database = $dbMatch.Groups[1].Value | ConvertFrom-Json

function Replace-Nth([string]$Text, [string]$Search, [string]$Replacement, [int]$Occurrence) {
    $from = 0
    $found = -1
    for ($i = 0; $i -lt $Occurrence; $i++) {
        $found = $Text.IndexOf($Search, $from)
        if ($found -lt 0) { return $Text }
        $from = $found + $Search.Length
    }
    return $Text.Substring(0, $found) + $Replacement + $Text.Substring($found + $Search.Length)
}

$failed = $false
foreach ($sector in @('academic', 'finance')) {
    $templateMatch = [regex]::Match($html, $sector + ':\s*"([A-Za-z0-9+/=]+)"')
    if (-not $templateMatch.Success) { throw "Template not found: $sector" }

    $bytes = [Convert]::FromBase64String($templateMatch.Groups[1].Value)
    $memory = [System.IO.MemoryStream]::new($bytes)
    $zip = [System.IO.Compression.ZipArchive]::new($memory, [System.IO.Compression.ZipArchiveMode]::Read)
    try {
        $mimeEntry = $zip.Entries | Where-Object FullName -eq 'mimetype' | Select-Object -First 1
        if (-not $mimeEntry) { throw "${sector}: mimetype entry missing" }
        $mimeReader = [System.IO.StreamReader]::new($mimeEntry.Open(), [System.Text.Encoding]::ASCII)
        try { $mime = $mimeReader.ReadToEnd() } finally { $mimeReader.Dispose() }
        if ($mime -ne 'application/hwp+zip') { throw "${sector}: invalid mimetype $mime" }

        $sections = $zip.Entries | Where-Object { $_.FullName -like 'Contents/section*.xml' }
        if (-not $sections) { throw "${sector}: section XML missing" }
        $xmlText = ''
        foreach ($entry in $sections) {
            $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8)
            try { $sectionText = $reader.ReadToEnd() } finally { $reader.Dispose() }
            $null = [xml]$sectionText
            $xmlText += $sectionText
        }

        if ($sector -eq 'academic') {
            $xmlText = $xmlText.Replace('[[2-3_1_3_A]]', '[[2-3-1_3_A]]')
        }
        if ($sector -eq 'finance') {
            $xmlText = Replace-Nth $xmlText '[[7-4_21_R]]' '[[7-4_21_R_b]]' 2
            $xmlText = Replace-Nth $xmlText '[[7-4_21_A]]' '[[7-4_21_A_b]]' 2
        }

        $expected = [System.Collections.Generic.HashSet[string]]::new()
        $missingItems = [System.Collections.Generic.List[string]]::new()
        foreach ($category in $database.$sector.categories) {
            foreach ($item in $category.items) {
                if ($item.isGroupHeader -or -not $item.no) { continue }
                $exportNo = [string]$item.no
                if (-not $xmlText.Contains('[[' + $exportNo + ']]')) {
                    $match = [regex]::Match($exportNo, '^(.+_R)_[a-z]+$')
                    if ($match.Success -and $xmlText.Contains('[[' + $match.Groups[1].Value + ']]')) {
                        $exportNo = $match.Groups[1].Value
                    } else {
                        $missingItems.Add([string]$item.no)
                        continue
                    }
                }
                $null = $expected.Add('[[' + $exportNo + ']]')
                $actionNo = [regex]::Replace($exportNo, '_R(?=(_[a-z]+)?$)', '_A')
                $null = $expected.Add('[[' + $actionNo + ']]')
            }
        }

        $tagMatches = [regex]::Matches($xmlText, '\[\[[^\]]+\]\]')
        $templateTags = [System.Collections.Generic.List[string]]::new()
        foreach ($tagMatch in $tagMatches) { $templateTags.Add([string]$tagMatch.Value) }
        $templateSet = [System.Collections.Generic.HashSet[string]]::new()
        foreach ($templateTag in $templateTags) { $null = $templateSet.Add([string]$templateTag) }
        $extras = @($templateSet | Where-Object { -not $expected.Contains($_) })
        $missingTags = @($expected | Where-Object { -not $templateSet.Contains($_) })
        $duplicates = @($templateTags | Group-Object | Where-Object Count -gt 1 | ForEach-Object { "$($_.Name) x$($_.Count)" })

        foreach ($tag in $expected) { $xmlText = $xmlText.Replace($tag, 'OK') }
        $leftovers = @([regex]::Matches($xmlText, '\[\[[^\]]]+\]\]') | ForEach-Object { $_.Value } | Sort-Object -Unique)

        Write-Output ("{0}: bytes={1}, entries={2}, items={3}, tags={4}" -f $sector, $bytes.Length, $zip.Entries.Count, (($database.$sector.categories.items | Where-Object { $_.no }).Count), $templateSet.Count)
        if ($missingItems.Count -or $extras.Count -or $missingTags.Count -or $duplicates.Count -or $leftovers.Count) {
            $failed = $true
            if ($missingItems.Count) { Write-Output ("missing item mapping: " + ($missingItems -join ', ')) }
            if ($extras.Count) { Write-Output ("extra template tags: " + ($extras -join ', ')) }
            if ($missingTags.Count) { Write-Output ("missing template tags: " + ($missingTags -join ', ')) }
            if ($duplicates.Count) { Write-Output ("duplicate template tags: " + ($duplicates -join ', ')) }
            if ($leftovers.Count) { Write-Output ("replacement leftovers: " + ($leftovers -join ', ')) }
        } else {
            Write-Output "${sector}: PASS"
        }
    } finally {
        $zip.Dispose()
        $memory.Dispose()
    }
}

if ($failed) { exit 1 }
Write-Output 'All embedded HWPX templates passed.'
