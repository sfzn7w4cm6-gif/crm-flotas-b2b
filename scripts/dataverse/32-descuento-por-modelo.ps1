<#
  La oferta pasa a ser por modelo y ventas recibe aviso cuando el concesionario pone condiciones.

  - fl_lineaoportunidad: fl_descuentoconcesionario y fl_descuentoventas (decimal) en cada modelo.
    Los dos del lead se mantienen como resumen (media ponderada por unidades) para listas y avisos.
  - fl_lead: fl_fechacondiciones (cuando el concesionario cambio las condiciones) y
    fl_condicionesrevisadas (ventas ya abrio la oportunidad despues de ese cambio).
  - fl_notificacion.fl_tipo: opcion nueva "Condiciones por revisar" (101000002).
  - Equipo de Ventas: Write Global sobre fl_lineaoportunidad para poner su % de marca por modelo.

  Solo anade, no quita nada. Idempotente.
#>
. "$PSScriptRoot\lib.ps1"
$api = "$($script:DvOrgUrl)/api/data/v9.2"

Write-Host "--- Descuentos por modelo ---"
Add-DvDecimalColumn -Entity "fl_lineaoportunidad" -Name "fl_descuentoconcesionario" -Label "Descuento del concesionario (%)"
Add-DvDecimalColumn -Entity "fl_lineaoportunidad" -Name "fl_descuentoventas" -Label "Descuento de marca (%)"

Write-Host "--- Condiciones pendientes de revisar ---"
Add-DvDateColumn -Entity "fl_lead" -Name "fl_fechacondiciones" -Label "Condiciones actualizadas el"
Add-DvBoolColumn -Entity "fl_lead" -Name "fl_condicionesrevisadas" -Label "Condiciones revisadas por ventas" -Default $true

Write-Host "--- Tipo de notificacion 'Condiciones por revisar' ---"
$attr = Invoke-RestMethod -Uri "$api/EntityDefinitions(LogicalName='fl_notificacion')/Attributes(LogicalName='fl_tipo')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet" -Headers (Get-DvHeaders)
if ($attr.OptionSet.Options.Value -contains 101000002) {
    Write-Host "    [=] opcion 101000002 ya existe"
} else {
    $body = @{ EntityLogicalName = "fl_notificacion"; AttributeLogicalName = "fl_tipo"; Value = 101000002; Label = DvLabel "Condiciones por revisar"; SolutionUniqueName = $script:SolutionUniqueName } | ConvertTo-Json -Depth 8
    Invoke-RestMethod -Uri "$api/InsertOptionValue" -Headers (Get-DvHeaders) -Method Post -Body $body | Out-Null
    Write-Host "    [+] opcion 'Condiciones por revisar'"
}

Write-Host "--- Publicar ---"
$xml = "<importexportxml><entities><entity>fl_lineaoportunidad</entity><entity>fl_lead</entity><entity>fl_notificacion</entity></entities></importexportxml>"
Invoke-RestMethod -Uri "$api/PublishXml" -Headers (Get-DvHeaders) -Method Post -Body (@{ ParameterXml = $xml } | ConvertTo-Json) | Out-Null
Write-Host "    [+] publicado"

Write-Host "--- Privilegios: Equipo de Ventas escribe el % de marca en cada modelo ---"
$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_lineaoportunidad" -Actions @("Write") -Depth "Global"

Write-Host "=== Listo ==="
