<#
  Pantalla de inicio del concesionario (Mi actividad): añade lo que hace falta
  para tareas, objetivos e importe facturado. Solo añade, no cambia nada
  existente. Idempotente.

  - fl_lead.fl_importeventa: precio final de la venta (se rellena al cerrar).
  - fl_tarea: tareas de seguimiento de un lead (llamada, correo, visita...).
    UserOwned para que el concesionario solo vea las suyas (Basic).
  - fl_objetivo: objetivo de leads al mes. Una fila sin concesionario es el
    objetivo general; una fila con concesionario lo sustituye solo para ese.
    La pantalla de administracion para editarlo vendra despues.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- fl_lead ---"
Add-DvMoneyColumn -Entity "fl_lead" -Name "fl_importeventa" -Label "Importe de venta"

Write-Host "--- fl_tarea ---"
New-DvTable -Name "fl_tarea" -DisplayName "Tarea" -DisplayCollectionName "Tareas" -PrimaryColumnName "fl_titulo" -PrimaryColumnLabel "Titulo"
Add-DvChoiceColumn -Entity "fl_tarea" -Name "fl_tipo" -Label "Tipo" -Options @("Llamada","Correo","Reunion","Visita","Otro") -Required "ApplicationRequired"
Add-DvDateColumn -Entity "fl_tarea" -Name "fl_fecha" -Label "Fecha" -Required "ApplicationRequired"
Add-DvChoiceColumn -Entity "fl_tarea" -Name "fl_estado" -Label "Estado" -Options @("Pendiente","En curso","Completada","Cancelada") -Required "ApplicationRequired"
Add-DvMemoColumn -Entity "fl_tarea" -Name "fl_notas" -Label "Notas" -MaxLength 2000
New-DvLookup -ReferencingEntity "fl_tarea" -SchemaName "fl_lead" -ReferencedEntity "fl_lead" -Label "Lead" -Required "ApplicationRequired"

Write-Host "--- fl_objetivo ---"
New-DvTable -Name "fl_objetivo" -DisplayName "Objetivo" -DisplayCollectionName "Objetivos" -PrimaryColumnName "fl_nombre" -PrimaryColumnLabel "Nombre"
Add-DvIntColumn -Entity "fl_objetivo" -Name "fl_leadsmes" -Label "Objetivo de leads al mes" -Required "ApplicationRequired" -Min 0 -Max 100000
New-DvLookup -ReferencingEntity "fl_objetivo" -SchemaName "fl_concesionario" -ReferencedEntity "fl_concesionario" -Label "Concesionario (vacio = general)"

Write-Host "--- Privilegios ---"
$APPEND = @("Append","AppendTo")
$FULL = @("Create","Read","Write","Delete","Append","AppendTo","Assign","Share")

$rConcesionario = New-DvRole -Name "CRM Flotas B2B - Concesionario"
Grant-DvTablePrivileges -RoleId $rConcesionario -Table "fl_tarea" -Actions @("Create","Read","Write","Delete") -Depth "Basic"
Grant-DvTablePrivileges -RoleId $rConcesionario -Table "fl_objetivo" -Actions @("Read") -Depth "Global"

$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_tarea" -Actions @("Read") -Depth "Global"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_objetivo" -Actions @("Read") -Depth "Global"

foreach ($r in @($rConcesionario, $rVentas)) {
    foreach ($t in @("fl_tarea","fl_objetivo")) {
        Grant-DvTablePrivileges -RoleId $r -Table $t -Actions $APPEND -Depth "Global"
    }
}

$rAdmin = New-DvRole -Name "CRM Flotas B2B - Administrador"
foreach ($t in @("fl_tarea","fl_objetivo")) {
    Grant-DvTablePrivileges -RoleId $rAdmin -Table $t -Actions $FULL -Depth "Global"
}

Write-Host "--- Objetivo general inicial ---"
Ensure-DvRecord -Table "fl_objetivo" -KeyField "fl_nombre" -KeyValue "General" -Fields @{ fl_leadsmes = 10 } | Out-Null

Write-Host "=== Listo ==="
