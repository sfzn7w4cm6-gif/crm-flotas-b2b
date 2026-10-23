<#
  Busca definiciones de entidad relacionadas con "code app" / "canvas" en el
  entorno, para saber si los Code Apps se pueden compartir via Dataverse
  (GrantAccess) o si es exclusivamente desde el portal de Power Apps.
#>
. "$PSScriptRoot\lib.ps1"

$r = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions?`$select=LogicalName&`$filter=contains(LogicalName,'app')" -Headers (Get-DvHeaders)
$r.value | ForEach-Object { $_.LogicalName } | Sort-Object
