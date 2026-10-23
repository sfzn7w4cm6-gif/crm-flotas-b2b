<#
  Siembra datos de ejemplo: concesionarios y sus ubicaciones, y el perfil de
  aplicacion del usuario administrador real (para poder entrar y usar
  "Ver como rol"). Idempotente (busca por nombre antes de crear).
#>
. "$PSScriptRoot\lib.ps1"

$adminUserId = "1df23196-6334-f111-88b4-7ced8d74baf1"  # allanos@ebroauto.com
$adminCorreo = "allanos@ebroauto.com"

Write-Host "--- Concesionarios y ubicaciones (datos de ejemplo) ---"
$concesionarios = @{
    "M Automocion" = @("M Automocion Barcelona", "M Automocion Madrid")
    "Auto Zaragoza" = @("Auto Zaragoza")
    "Norte Motor" = @("Norte Motor Bilbao", "Norte Motor Valencia")
}
$ubicacionIds = @{}
foreach ($nombreConc in $concesionarios.Keys) {
    $concId = Ensure-DvRecord -Table "fl_concesionario" -KeyField "fl_nombre" -KeyValue $nombreConc -Fields @{ fl_activo = $true }
    foreach ($nombreUbi in $concesionarios[$nombreConc]) {
        $ciudad = ($nombreUbi -split " ")[-1]
        $ubiId = Ensure-DvRecord -Table "fl_ubicacion" -KeyField "fl_nombre" -KeyValue $nombreUbi -Fields @{
            fl_ciudad = $ciudad
            fl_activo = $true
            "fl_concesionario@odata.bind" = DvLookupBind "fl_concesionario" "fl_concesionario" $concId
        }
        $ubicacionIds[$nombreUbi] = $ubiId
    }
}

Write-Host "--- Perfil de aplicacion del administrador ---"
# fl_rol es una columna de opcion (Picklist); el orden de creacion en 01-tables.ps1
# fue @("Concesionario","Equipo de Ventas","Administrador") -> valores 101000000/1/2.
Ensure-DvRecord -Table "fl_usuarioapp" -KeyField "fl_correo" -KeyValue $adminCorreo -Fields @{
    fl_nombre = "Ariadna Llanos"
    fl_rol = 101000002
    fl_activo = $true
    "fl_systemuserid@odata.bind" = "/systemusers($adminUserId)"
}

Write-Host "=== Listo ==="
