param([string]$InputFile, [string]$OutputFile)
$ErrorActionPreference = 'Stop'
$wordInstance = $null
$wordDocument = $null
$previousUpdateLinks = $null
try {
  $wordInstance = New-Object -ComObject Word.Application
  $wordInstance.Visible = $false
  $wordInstance.DisplayAlerts = 0
  $wordInstance.AutomationSecurity = 3
  $previousUpdateLinks = $wordInstance.Options.UpdateLinksAtOpen
  $wordInstance.Options.UpdateLinksAtOpen = $false
  $confirmConversions = $false
  $readOnly = $true
  $addToRecent = $false
  $password = 'unsupported-encrypted-document'
  $format = 16
  $wordDocument = $wordInstance.Documents.Open([ref]$InputFile, [ref]$confirmConversions, [ref]$readOnly, [ref]$addToRecent, [ref]$password)
  $wordDocument.SaveAs2([ref]$OutputFile, [ref]$format)
} finally {
  $saveChanges = 0
  if ($null -ne $wordDocument) { $wordDocument.Close([ref]$saveChanges); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordDocument) }
  if ($null -ne $wordInstance) { if ($null -ne $previousUpdateLinks) { $wordInstance.Options.UpdateLinksAtOpen = $previousUpdateLinks }; $wordInstance.Quit([ref]$saveChanges); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordInstance) }
}
