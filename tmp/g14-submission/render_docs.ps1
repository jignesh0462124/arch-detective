$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath 'output/G-14 ThreatLens/Code').Path
$dest = Join-Path (Get-Location).Path 'tmp/g14-submission/doc-renders'
New-Item -ItemType Directory -Path $dest -Force | Out-Null
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$word.AutomationSecurity = 3
try {
    foreach ($file in (Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.docx' | Sort-Object FullName)) {
        $document = $word.Documents.Open($file.FullName,$false,$true,$false)
        try {
            $document.Repaginate()
            $document.ExportAsFixedFormat((Join-Path $dest ($file.BaseName + '.pdf')),17)
            '{0}: {1} pages' -f $file.BaseName, $document.ComputeStatistics(2)
        } finally { $document.Close(0) }
    }
} finally { $word.Quit(); [Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) | Out-Null }
