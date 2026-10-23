<#
  Rellena "Area Manager EBRO (Zona)" en las ubicaciones de ejemplo creadas por
  05-seed-data.ps1, para que el detalle de lead no muestre vacio en la demo.
  Idempotente (PATCH directo por nombre de ubicacion).
#>
. "$PSScriptRoot\lib.ps1"

$areaManagers = @{
    "M Automocion Barcelona" = "Marc Soler (Zona Cataluña)"
    "M Automocion Madrid"    = "Laura Gómez (Zona Centro)"
    "Auto Zaragoza"          = "Laura Gómez (Zona Centro)"
    "Norte Motor Bilbao"     = "Iker Etxeberria (Zona Norte)"
    "Norte Motor Valencia"   = "Clara Ibáñez (Zona Levante)"
}

$set = Get-DvEntitySet "fl_ubicacion"
foreach ($nombre in $areaManagers.Keys) {
    $escaped = $nombre -replace "'", "''"
    $r = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/${set}?`$filter=fl_nombre eq '$escaped'&`$select=fl_ubicacionid" -Headers (Get-DvHeaders)
    if ($r.value.Count -eq 0) { Write-Host "  [!] No encontrada: $nombre"; continue }
    $id = $r.value[0].fl_ubicacionid
    $body = @{ fl_areamanager = $areaManagers[$nombre] } | ConvertTo-Json
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/${set}($id)" -Headers (Get-DvHeaders) -Method Patch -Body $body | Out-Null
    Write-Host "  [=] $nombre -> $($areaManagers[$nombre])"
}

Write-Host "=== Listo ==="
