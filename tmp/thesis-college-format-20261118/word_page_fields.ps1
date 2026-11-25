param([string]$Docx,[string]$Json,[string]$Pdf)
$ErrorActionPreference='Stop'
$word=$null
$doc=$null
try {
  $word=New-Object -ComObject Word.Application
  $word.Visible=$false
  $word.DisplayAlerts=0
  $word.AutomationSecurity=3
  $doc=$word.Documents.Open([IO.Path]::GetFullPath($Docx),$false,$true,$false)
  for($i=0;$i -lt 2;$i++) {
    $doc.Repaginate()
    $doc.Fields.Update() | Out-Null
  }
  $values=[ordered]@{}
  foreach($field in $doc.Fields) {
    if($field.Code.Text -match '^\s*PAGEREF\s+(\w+)') {
      $values[$Matches[1]]=$field.Result.Text.Trim()
    }
  }
  if($values.Count -ne 100) { throw "Expected 100 page references; found $($values.Count)" }
  $values | ConvertTo-Json | Set-Content -LiteralPath ([IO.Path]::GetFullPath($Json)) -Encoding UTF8
  if($Pdf) { $doc.ExportAsFixedFormat([IO.Path]::GetFullPath($Pdf),17) }
  Write-Output "Word updated $($values.Count) page references. Page count: $($doc.ComputeStatistics(2))."
} finally {
  if($null -ne $doc){$doc.Close(0)}
  if($null -ne $word){$word.Quit();[Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)|Out-Null}
}
