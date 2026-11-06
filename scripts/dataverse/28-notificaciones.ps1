<#
  Tabla de notificaciones para el equipo de ventas (campanita de Inicio):
  oportunidades pendientes de % de marca y empresas contactadas por mas de
  un concesionario a la vez. Nunca se borran solas (quedan como historial);
  el equipo de ventas las puede quitar a mano con un boton si se acumulan.

  Las crea el propio cliente de Equipo de Ventas/Administrador la primera
  vez que detecta cada caso (sincronizarNotificaciones en notificacionesService.ts),
  no el concesionario: por eso ese rol no tiene permisos sobre esta tabla.
#>
. "$PSScriptRoot\lib.ps1"

New-DvTable -Name "fl_notificacion" -DisplayName "Notificacion" -DisplayCollectionName "Notificaciones" -PrimaryColumnName "fl_titulo" -PrimaryColumnLabel "Titulo" -Ownership "OrganizationOwned"
Add-DvChoiceColumn -Entity "fl_notificacion" -Name "fl_tipo" -Label "Tipo" -Options @("Descuento pendiente", "Empresa duplicada")
Add-DvStringColumn -Entity "fl_notificacion" -Name "fl_cif" -Label "CIF" -MaxLength 20
New-DvLookup -ReferencingEntity "fl_notificacion" -SchemaName "fl_lead" -ReferencedEntity "fl_lead" -Label "Oportunidad"
New-DvLookup -ReferencingEntity "fl_notificacion" -SchemaName "fl_empresa" -ReferencedEntity "fl_empresa" -Label "Empresa"

Write-Host "--- Privilegios ---"
$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_notificacion" -Actions @("Create", "Read", "Delete", "Append", "AppendTo") -Depth "Global"
# Sin Assign/Share: la tabla es OrganizationOwned (sin dueño), esos dos privilegios no existen para ella.
$rAdmin = New-DvRole -Name "CRM Flotas B2B - Administrador"
Grant-DvTablePrivileges -RoleId $rAdmin -Table "fl_notificacion" -Actions @("Create", "Read", "Write", "Delete", "Append", "AppendTo") -Depth "Global"

Write-Host "=== Listo ==="
