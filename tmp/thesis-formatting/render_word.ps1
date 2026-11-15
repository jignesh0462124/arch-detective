param([string]$Docx,[string]$Pdf)
$ErrorActionPreference='Stop'
$wordApp=$null
$wordDocument=$null
try {
  $Docx=[IO.Path]::GetFullPath($Docx).Replace('/','\')
  $Pdf=[IO.Path]::GetFullPath($Pdf).Replace('/','\')
  $wordApp=New-Object -ComObject Word.Application
  $wordApp.Visible=$false
  $wordApp.DisplayAlerts=0
  $wordApp.AutomationSecurity=3
  $wordDocument=$wordApp.Documents.Open($Docx,$false,$false,$false)
  for($pass=0;$pass -lt 3;$pass++) {
    $wordDocument.Repaginate()
    $wordDocument.Fields.Update() | Out-Null
    foreach($toc in $wordDocument.TablesOfContents){$toc.Update()}
  }
  $wordDocument.Save()
  $wordDocument.ExportAsFixedFormat($Pdf,17)
  Write-Output ('Rendered pages: '+$wordDocument.ComputeStatistics(2))
} finally {
  if($null -ne $wordDocument){$wordDocument.Close(0)}
  if($null -ne $wordApp){$wordApp.Quit();[Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordApp)|Out-Null}
}
