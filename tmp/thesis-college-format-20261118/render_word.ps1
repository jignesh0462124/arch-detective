param([string]$Docx,[string]$Pdf,[switch]$Refresh)
$ErrorActionPreference='Stop'
$wordApp=$null
$wordDocument=$null
try {
  $inputPath=[IO.Path]::GetFullPath($Docx).Replace('/','\')
  $outputPath=[IO.Path]::GetFullPath($Pdf).Replace('/','\')
  $wordApp=New-Object -ComObject Word.Application
  $wordApp.Visible=$false
  $wordApp.DisplayAlerts=0
  $wordApp.AutomationSecurity=3
  $wordDocument=$wordApp.Documents.Open($inputPath,$false,(!$Refresh),$false)
  if($Refresh) {
    for($pass=0;$pass -lt 2;$pass++) {
      $wordDocument.Repaginate()
      $wordDocument.Fields.Update() | Out-Null
      foreach($toc in $wordDocument.TablesOfContents){$toc.Update()}
    }
    $wordDocument.Save()
  }
  $wordDocument.Repaginate()
  $wordDocument.ExportAsFixedFormat($outputPath,17)
  Write-Output ('Rendered pages: '+$wordDocument.ComputeStatistics(2))
} finally {
  if($null -ne $wordDocument){$wordDocument.Close(0)}
  if($null -ne $wordApp){$wordApp.Quit();[Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordApp)|Out-Null}
}
