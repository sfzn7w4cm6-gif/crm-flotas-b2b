<#
  Busca el registro canvasapp correspondiente al Code App (power.config.json
  appId), para poder compartirlo despues con GrantAccess. Solo lectura.
#>
. "$PSScriptRoot\lib.ps1"

$r = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/canvasapps?`$filter=contains(name,'CRM Flotas')" -Headers (Get-DvHeaders)
if ($r.value.Count -eq 0) {
    Write-Host "No se encontro canvasapp con ese nombre."
} else {
    $r.value | ConvertTo-Json -Depth 5
}
