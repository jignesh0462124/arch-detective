$ErrorActionPreference='Stop'
$outputDirectory='C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective\output\docx'
$correctedPath='C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective\output\docx\ThreatLens_Thesis_Corrected.docx'
$supersededPaths=@(
  'C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective\output\docx\ThreatLens_Thesis_Formatted.docx',
  'C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective\output\docx\ThreatLens_Thesis_Reference_Formatted.docx',
  'C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective\output\docx\ThreatLens_Thesis_Logo_Inside_Border.docx'
)
$verification=Get-Content -LiteralPath 'C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective\tmp\pdfs\threatlens-conversion-20261115\banner-render-verification.json' -Raw | ConvertFrom-Json
if ($verification.pages -ne 65 -or -not $verification.other_62_pages_pixel_identical) { throw 'Final render verification is missing.' }
if (-not (Test-Path -LiteralPath $correctedPath -PathType Leaf)) { throw 'The corrected document is missing.' }
foreach($candidate in $supersededPaths) {
  $resolved=[IO.Path]::GetFullPath($candidate)
  if ([IO.Path]::GetDirectoryName($resolved) -ne $outputDirectory -or $resolved -eq $correctedPath -or [IO.Path]::GetExtension($resolved) -ne '.docx') { throw 'Unsafe cleanup target.' }
  if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) { throw "Missing cleanup target: $resolved" }
}
Add-Type -AssemblyName Microsoft.VisualBasic
foreach($candidate in $supersededPaths) {
  [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($candidate,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,[Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
  if(Test-Path -LiteralPath $candidate) { throw "Could not recycle: $candidate" }
  Write-Output ('Recycled: '+[IO.Path]::GetFileName($candidate))
}
$remaining=@(Get-ChildItem -LiteralPath $outputDirectory -Filter '*.docx' -File)
if($remaining.Count -ne 1 -or $remaining[0].FullName -ne $correctedPath) { throw 'Unexpected files remain; no additional files were removed.' }
Write-Output ('Only remaining DOCX: '+$remaining[0].FullName)
