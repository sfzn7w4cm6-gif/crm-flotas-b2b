<#
  El equipo de ventas solo tenia permiso de lectura sobre fl_objetivo. Para la
  nueva seccion de Configuracion (donde puede fijar el objetivo mensual de
  cada concesionario) necesita tambien Create/Write/Delete. Solo añade
  privilegio, no quita nada existente. Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- Privilegios: fl_objetivo para Equipo de Ventas ---"
$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_objetivo" -Actions @("Create","Read","Write","Delete") -Depth "Global"

Write-Host "=== Listo ==="
