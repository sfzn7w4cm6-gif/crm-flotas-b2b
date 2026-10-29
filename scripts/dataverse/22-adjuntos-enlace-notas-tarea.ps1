<#
  Adjuntos, enlace de llamada y notas dentro de las tareas (29/10/2026). Solo añade. Idempotente.

  - Adjuntos: notas nativas de Dataverse (annotation, con el archivo en documentbody)
    colgadas de fl_tarea (los de la tarea al crearla) y de fl_nota (los de cada nota).
    Se activa "HasNotes" en las dos tablas (no se puede desactivar despues).
  - fl_tarea.fl_enlace: enlace de la llamada o reunion (Teams, Meet...).
  - fl_nota.fl_tarea: una nota con tarea es una nota de esa tarea (lo que se apunta al
    completarla o en cualquier momento); sin tarea, es una nota general de la oportunidad.
    El texto antiguo fl_tarea.fl_resultado se sigue mostrando como la primera nota.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- Columnas ---"
Add-DvStringColumn -Entity "fl_tarea" -Name "fl_enlace" -Label "Enlace" -MaxLength 1000
New-DvLookup -ReferencingEntity "fl_nota" -SchemaName "fl_tarea" -ReferencedEntity "fl_tarea" -Label "Tarea"

Write-Host "--- Adjuntos (HasNotes) ---"
foreach ($t in @("fl_tarea", "fl_nota")) {
    $uri = "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$t')"
    $meta = Invoke-RestMethod -Uri "$uri`?`$select=MetadataId,HasNotes" -Headers (Get-DvHeaders)
    if ($meta.HasNotes) { Write-Host "    [=] $t ya admite adjuntos"; continue }
    $full = Invoke-RestMethod -Uri $uri -Headers (Get-DvHeaders)
    $full.HasNotes = $true
    $full.PSObject.Properties.Remove("@odata.context")
    $full | Add-Member -NotePropertyName "@odata.type" -NotePropertyValue "Microsoft.Dynamics.CRM.EntityMetadata" -Force
    $headers = Get-DvHeaders -WithSolution
    $headers["MSCRM.MergeLabels"] = "true"
    $body = [Text.Encoding]::UTF8.GetBytes(($full | ConvertTo-Json -Depth 12))
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions($($full.MetadataId))" -Headers $headers -Method Put -Body $body | Out-Null
    Write-Host "    [+] $t admite adjuntos"
}

Write-Host "--- Publicar ---"
$xml = "<importexportxml><entities><entity>fl_tarea</entity><entity>fl_nota</entity></entities></importexportxml>"
Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/PublishXml" -Headers (Get-DvHeaders) -Method Post -Body (@{ ParameterXml = $xml } | ConvertTo-Json) | Out-Null
Write-Host "    [+] publicado"

Write-Host "--- Privilegios sobre adjuntos (Note) ---"
$APPEND = @("Append","AppendTo")
$FULL = @("Create","Read","Write","Delete","Append","AppendTo","Assign","Share")

# Como las tareas: cada comercial los suyos. Assign para que pasen con la oportunidad al reasignarla.
$rConcesionario = New-DvRole -Name "CRM Flotas B2B - Concesionario"
Grant-DvTablePrivileges -RoleId $rConcesionario -Table "Note" -Actions @("Create","Read","Write","Delete","Assign") -Depth "Basic"

$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
Grant-DvTablePrivileges -RoleId $rVentas -Table "Note" -Actions @("Read") -Depth "Global"

foreach ($r in @($rConcesionario, $rVentas)) {
    Grant-DvTablePrivileges -RoleId $r -Table "Note" -Actions $APPEND -Depth "Global"
}

$rAdmin = New-DvRole -Name "CRM Flotas B2B - Administrador"
Grant-DvTablePrivileges -RoleId $rAdmin -Table "Note" -Actions $FULL -Depth "Global"

Write-Host "=== Listo ==="
