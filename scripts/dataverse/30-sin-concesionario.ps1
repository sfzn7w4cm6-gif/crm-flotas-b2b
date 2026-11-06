<#
  Concesionario y sede "comodin" para los usuarios que generan leads sin pertenecer
  a ningun concesionario de la red (ej. equipo propio de EBRO). Asi aparecen solos
  en los filtros de Zona/Concesionario/Sede en vez de romper los lookups obligatorios
  del lead. Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- Concesionario y sede 'Sin concesionario' ---"
$concId = Ensure-DvRecord -Table "fl_concesionario" -KeyField "fl_nombre" -KeyValue "Sin concesionario" -Fields @{ fl_activo = $true }
$bind = DvLookupBind "fl_concesionario" "fl_concesionario" $concId
$sedeId = Ensure-DvRecord -Table "fl_ubicacion" -KeyField "fl_nombre" -KeyValue "Sin sede" -Fields @{ fl_activo = $true; "fl_concesionario@odata.bind" = $bind }

Write-Host "Concesionario: $concId"
Write-Host "Sede: $sedeId"
Write-Host "Listo."
