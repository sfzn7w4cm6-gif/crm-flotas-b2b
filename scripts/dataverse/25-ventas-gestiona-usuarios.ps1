<#
  El equipo de ventas pasa a gestionar "Usuarios y accesos" (antes solo administracion).
  Para guardar un usuario la app escribe en fl_usuarioapp y fl_asignacion, mete o saca a la
  cuenta de los equipos de los concesionarios y le pone el rol de seguridad de su tipo.

  - fl_usuarioapp: Create/Write Global. fl_asignacion: Create/Write/Delete Global.
  - Cuentas (systemuser), equipos y roles: leer, y escribir/enlazar equipos para cambiar
    sus miembros. "Assign Role" para poner el rol.
  - Dataverse no deja dar un rol con permisos que no tiene quien lo da. Para que ventas pueda
    poner el rol Concesionario, recibe los mismos permisos Basic que ese rol (crear, cambiar,
    asignar y borrar lo suyo propio). Ventas no es dueno de nada de eso y la app no le ofrece
    esas acciones, asi que en la practica no cambia lo que hace.

  Solo anade privilegios, no quita nada. Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"

Write-Host "--- Usuarios y asignaciones ---"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_usuarioapp" -Actions @("Create","Read","Write") -Depth "Global"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_asignacion" -Actions @("Create","Read","Write","Delete") -Depth "Global"

Write-Host "--- Cuentas, equipos y roles ---"
Grant-DvTablePrivileges -RoleId $rVentas -Table "User" -Actions @("Read","Append","AppendTo") -Depth "Global"
Grant-DvTablePrivileges -RoleId $rVentas -Table "Team" -Actions @("Read","Write","Append","AppendTo") -Depth "Global"
Grant-DvTablePrivileges -RoleId $rVentas -Table "Role" -Actions @("Read","Assign") -Depth "Global"

Write-Host "--- Mismos permisos Basic que el rol Concesionario ---"
foreach ($t in @("fl_lead","fl_empresa","fl_fasehistorico","fl_lineaoportunidad","fl_nota","fl_tarea","Note")) {
    Grant-DvTablePrivileges -RoleId $rVentas -Table $t -Actions @("Create","Write","Assign") -Depth "Basic"
}
foreach ($t in @("fl_lineaoportunidad","fl_nota","fl_tarea","Note")) {
    Grant-DvTablePrivileges -RoleId $rVentas -Table $t -Actions @("Delete") -Depth "Basic"
}

Write-Host "=== Listo ==="
