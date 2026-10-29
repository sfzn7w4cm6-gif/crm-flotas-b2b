<#
  Notas de la oportunidad y resultado de las tareas (28/10/2026). Solo añade. Idempotente.

  - fl_nota: nota libre sobre una oportunidad (fl_lead), con su autor (fl_usuarioapp).
    Fecha = createdon. UserOwned; al reasignar la oportunidad, sus notas pasan con ella
    (cascada), pero el autor se conserva.
  - fl_tarea.fl_resultado: cómo fue la tarea (p. ej. comentarios de una visita). Se pide
    al completarla y se puede añadir o editar después.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- fl_nota ---"
New-DvTable -Name "fl_nota" -DisplayName "Nota" -DisplayCollectionName "Notas" -PrimaryColumnName "fl_titulo" -PrimaryColumnLabel "Titulo"
Add-DvMemoColumn -Entity "fl_nota" -Name "fl_texto" -Label "Texto" -MaxLength 4000 -Required "ApplicationRequired"
New-DvLookup -ReferencingEntity "fl_nota" -SchemaName "fl_lead" -ReferencedEntity "fl_lead" -Label "Oportunidad" -Required "ApplicationRequired"
New-DvLookup -ReferencingEntity "fl_nota" -SchemaName "fl_autor" -ReferencedEntity "fl_usuarioapp" -Label "Autor"

Write-Host "--- fl_tarea ---"
Add-DvMemoColumn -Entity "fl_tarea" -Name "fl_resultado" -Label "Resultado" -MaxLength 4000

Write-Host "--- Cascada de asignacion desde fl_lead ---"
$rel = "fl_nota_fl_lead"
$uri = "$($script:DvOrgUrl)/api/data/v9.2/RelationshipDefinitions(SchemaName='$rel')/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
$meta = Invoke-RestMethod -Uri $uri -Headers (Get-DvHeaders)
if ($meta.CascadeConfiguration.Assign -eq "Cascade") {
    Write-Host "    [=] $rel ya cascadea la asignacion"
} else {
    $meta.CascadeConfiguration.Assign = "Cascade"
    $meta.CascadeConfiguration.Share = "Cascade"
    $meta.CascadeConfiguration.Unshare = "Cascade"
    $meta.PSObject.Properties.Remove("@odata.context")
    $meta | Add-Member -NotePropertyName "@odata.type" -NotePropertyValue "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata" -Force
    $headers = Get-DvHeaders -WithSolution
    $headers["MSCRM.MergeLabels"] = "true"
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/RelationshipDefinitions($($meta.MetadataId))" -Headers $headers -Method Put -Body ($meta | ConvertTo-Json -Depth 12) | Out-Null
    Write-Host "    [+] $rel -> asignacion en cascada"
}

Write-Host "--- Privilegios ---"
$APPEND = @("Append","AppendTo")
$FULL = @("Create","Read","Write","Delete","Append","AppendTo","Assign","Share")

$rConcesionario = New-DvRole -Name "CRM Flotas B2B - Concesionario"
Grant-DvTablePrivileges -RoleId $rConcesionario -Table "fl_nota" -Actions @("Create","Read","Write","Delete","Assign") -Depth "Basic"

$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_nota" -Actions @("Read") -Depth "Global"

foreach ($r in @($rConcesionario, $rVentas)) {
    Grant-DvTablePrivileges -RoleId $r -Table "fl_nota" -Actions $APPEND -Depth "Global"
}

$rAdmin = New-DvRole -Name "CRM Flotas B2B - Administrador"
Grant-DvTablePrivileges -RoleId $rAdmin -Table "fl_nota" -Actions $FULL -Depth "Global"

Write-Host "=== Listo ==="
