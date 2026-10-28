<#
  Red comercial real de EBRO y catalogo de modelos, a partir de
  "BBDD FLOTAS.xlsx" (pestañas RESPONSABLE EBRO BUSINESS y MODELOS DE
  INTERES), exportado a datos/red-ebro.json. Idempotente.

  - fl_zona: Zona 1..7 con su area manager.
  - fl_ubicacion.fl_zona: la zona va en la SEDE, no en el concesionario,
    porque un concesionario puede tener sedes en zonas distintas
    (M Automocion: Barcelona en la 2, Madrid en la 4).
  - fl_modelo: catalogo para los desplegables (familia, motorizacion, acabado).

  Concesionarios y sedes se buscan por nombre normalizado (sin tildes,
  mayusculas ni signos), asi "M Automocion Barcelona" (demo) se reutiliza
  como "M Automoción-Barcelona" y sus leads y usuarios siguen enlazados.
  Las sedes y concesionarios de demo que no estan en el Excel no se tocan.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- Esquema ---"
New-DvTable -Name "fl_zona" -DisplayName "Zona" -DisplayCollectionName "Zonas" -PrimaryColumnName "fl_nombre" -PrimaryColumnLabel "Nombre"
Add-DvIntColumn -Entity "fl_zona" -Name "fl_numero" -Label "Numero" -Min 0 -Max 1000
Add-DvStringColumn -Entity "fl_zona" -Name "fl_areamanager" -Label "Area Manager" -MaxLength 200
New-DvLookup -ReferencingEntity "fl_ubicacion" -SchemaName "fl_zona" -ReferencedEntity "fl_zona" -Label "Zona"

New-DvTable -Name "fl_modelo" -DisplayName "Modelo" -DisplayCollectionName "Modelos" -PrimaryColumnName "fl_nombre" -PrimaryColumnLabel "Nombre"
Add-DvStringColumn -Entity "fl_modelo" -Name "fl_familia" -Label "Familia" -MaxLength 50
Add-DvStringColumn -Entity "fl_modelo" -Name "fl_motorizacion" -Label "Motorizacion" -MaxLength 50
Add-DvStringColumn -Entity "fl_modelo" -Name "fl_acabado" -Label "Acabado" -MaxLength 50
Add-DvIntColumn -Entity "fl_modelo" -Name "fl_orden" -Label "Orden" -Min 0 -Max 10000
Add-DvBoolColumn -Entity "fl_modelo" -Name "fl_activo" -Label "Activo" -Default $true

Write-Host "--- Privilegios (lectura para todos, todo para Administrador) ---"
$FULL = @("Create","Read","Write","Delete","Append","AppendTo","Assign","Share")
foreach ($rol in @("CRM Flotas B2B - Concesionario", "CRM Flotas B2B - Equipo de Ventas")) {
    $id = New-DvRole -Name $rol
    foreach ($t in @("fl_zona","fl_modelo")) {
        Grant-DvTablePrivileges -RoleId $id -Table $t -Actions @("Read","Append","AppendTo") -Depth "Global"
    }
}
$rAdmin = New-DvRole -Name "CRM Flotas B2B - Administrador"
foreach ($t in @("fl_zona","fl_modelo")) { Grant-DvTablePrivileges -RoleId $rAdmin -Table $t -Actions $FULL -Depth "Global" }

# ---------------------------------------------------------------- datos

$api = "$($script:DvOrgUrl)/api/data/v9.2"
$datos = Get-Content "$PSScriptRoot\datos\red-ebro.json" -Raw -Encoding UTF8 | ConvertFrom-Json

function Normalizar([string]$s) {
    $d = $s.Normalize([Text.NormalizationForm]::FormD)
    $sinTildes = -join ($d.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' })
    return ($sinTildes.ToLower() -replace '[^a-z0-9]', '')
}
function Actualizar([string]$Set, [string]$Id, [hashtable]$Campos) {
    $h = Get-DvHeaders
    $h["If-Match"] = "*"
    $body = [Text.Encoding]::UTF8.GetBytes(($Campos | ConvertTo-Json -Depth 5))
    Invoke-RestMethod -Method Patch -Uri "$api/$Set($Id)" -Headers $h -Body $body | Out-Null
}
function Crear([string]$Set, [hashtable]$Campos) {
    $body = [Text.Encoding]::UTF8.GetBytes(($Campos | ConvertTo-Json -Depth 5))
    $r = Invoke-WebRequest -Method Post -Uri "$api/$Set" -Headers (Get-DvHeaders) -Body $body -UseBasicParsing
    return ([string]$r.Headers["OData-EntityId"] -replace ".*\(([0-9a-fA-F-]+)\).*", '$1')
}

Write-Host "--- Zonas ---"
$zonasExistentes = @{}
(Invoke-RestMethod -Uri "$api/fl_zonas?`$select=fl_zonaid,fl_nombre" -Headers (Get-DvHeaders)).value | ForEach-Object { $zonasExistentes[$_.fl_nombre] = $_.fl_zonaid }
$zonaId = @{}
$zonaAM = @{}
foreach ($z in $datos.zonas) {
    $campos = @{ fl_nombre = $z.nombre; fl_numero = [int]$z.numero; fl_areamanager = $z.areaManager }
    if ($zonasExistentes.ContainsKey($z.nombre)) { $id = $zonasExistentes[$z.nombre]; Actualizar "fl_zonas" $id $campos }
    else { $id = Crear "fl_zonas" $campos; Write-Host "  [+] $($z.nombre) - $($z.areaManager)" }
    $zonaId[[int]$z.numero] = $id
    $zonaAM[[int]$z.numero] = $z.areaManager
}

Write-Host "--- Concesionarios ---"
$concPorNombre = @{}
(Invoke-RestMethod -Uri "$api/fl_concesionarios?`$select=fl_concesionarioid,fl_nombre" -Headers (Get-DvHeaders)).value | ForEach-Object { $concPorNombre[(Normalizar $_.fl_nombre)] = $_.fl_concesionarioid }
foreach ($nombre in ($datos.sedes | ForEach-Object { $_.concesionario } | Sort-Object -Unique)) {
    $k = Normalizar $nombre
    if (-not $concPorNombre.ContainsKey($k)) {
        $concPorNombre[$k] = Crear "fl_concesionarios" @{ fl_nombre = $nombre; fl_activo = $true }
        Write-Host "  [+] $nombre"
    }
}

Write-Host "--- Sedes ---"
$sedePorNombre = @{}
(Invoke-RestMethod -Uri "$api/fl_ubicacions?`$select=fl_ubicacionid,fl_nombre" -Headers (Get-DvHeaders)).value | ForEach-Object { $sedePorNombre[(Normalizar $_.fl_nombre)] = $_.fl_ubicacionid }
$creadas = 0; $actualizadas = 0
foreach ($s in $datos.sedes) {
    $z = [int]$s.zona
    $campos = @{
        fl_nombre = $s.sede
        fl_ciudad = $s.ciudad
        fl_activo = $true
        fl_areamanager = "$($zonaAM[$z]) (Zona $z)"
        "fl_zona@odata.bind" = "/fl_zonas($($zonaId[$z]))"
        "fl_concesionario@odata.bind" = "/fl_concesionarios($($concPorNombre[(Normalizar $s.concesionario)]))"
    }
    $k = Normalizar $s.sede
    if ($sedePorNombre.ContainsKey($k)) { Actualizar "fl_ubicacions" $sedePorNombre[$k] $campos; $actualizadas++ }
    else { $sedePorNombre[$k] = Crear "fl_ubicacions" $campos; $creadas++ }
}
Write-Host "  Sedes creadas: $creadas, actualizadas: $actualizadas"

Write-Host "--- Modelos ---"
$modExistentes = @{}
(Invoke-RestMethod -Uri "$api/fl_modelos?`$select=fl_modeloid,fl_nombre" -Headers (Get-DvHeaders)).value | ForEach-Object { $modExistentes[$_.fl_nombre] = $_.fl_modeloid }
$orden = 0
foreach ($m in $datos.modelos) {
    $orden += 10
    $campos = @{ fl_nombre = $m.nombre; fl_familia = $m.familia; fl_motorizacion = $m.motorizacion; fl_acabado = $m.acabado; fl_orden = $orden; fl_activo = $true }
    if ($modExistentes.ContainsKey($m.nombre)) { Actualizar "fl_modelos" $modExistentes[$m.nombre] $campos }
    else { Crear "fl_modelos" $campos | Out-Null; Write-Host "  [+] $($m.nombre)" }
}

Write-Host "=== Listo ==="
